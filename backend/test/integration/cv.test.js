// test/integration/cv.test.js
//
// CV del voluntario (PLAN_FALTANTE.md, Etapa 4; storage en PROJECT_ANALYSIS §164):
//   PUT    /api/voluntarios/me/cv       — subir o reemplazar (multipart, campo `cv`, PDF de hasta 5 MB)
//   DELETE /api/voluntarios/me/cv       — borrarlo
//   GET    /api/voluntarios/:userId/cv  — link de descarga que vence
// voluntarios.cv_url guarda el public_id de Cloudinary (privado), nunca una URL pública. Al reemplazar o borrar se
// borra el anterior de Cloudinary (decisión C3). Ven el CV: su dueño y una ONG con una inscripción `pending` o
// `approved` de ese voluntario en un proyecto SUYO (decisión C1). Cualquier otro caso → 404, igual que "no tiene CV".
// Cloudinary se reemplaza por un doble: estos tests no suben nada.
//
// Seed: lucia (user-vol-3) aprobada en proj-4 (ngo-4, techsocial) y pendiente en proj-10 (ngo-3, bancoalimentos).
//       maria (user-vol-1) en proyectos de ngo-1 y ngo-4; juan (user-vol-2) en ngo-1, ngo-2 y ngo-3.
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');
const pdf = () => ({ data: PDF, type: 'application/pdf', name: 'cv.pdf' });

describe('CV del voluntario', () => {
  let server, baseUrl, db, storage;
  let maria, lucia, juan, ngo1, ngo2, ngo3, ngo4, company;
  let uploaded, deleted, failUpload, failDelete, configured, onUpload;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    storage = require('../../src/lib/storage');
    let n = 0;
    mock.method(storage, 'isConfigured', () => configured);
    mock.method(storage, 'uploadPdf', async (buf) => {
      if (failUpload) throw new storage.StorageError('Cloudinary respondió 500: boom', { status: 500 });
      n += 1;
      const publicId = `test/cv-${n}.pdf`;
      uploaded.push({ bytes: buf.length, publicId });
      if (onUpload) await onUpload(publicId);
      return { publicId };
    });
    mock.method(storage, 'deletePdf', async (publicId) => {
      if (failDelete) throw new storage.StorageError('Cloudinary respondió 500: boom', { status: 500 });
      deleted.push(publicId);
      return true;
    });
    mock.method(storage, 'pdfDownloadUrl', (publicId) => ({
      url: `https://api.cloudinary.com/v1_1/demo/raw/download?public_id=${encodeURIComponent(publicId)}&signature=x`,
      expiresAt: '2026-10-16T12:10:00.000Z',
    }));
  });
  after(async () => { mock.restoreAll(); if (server) await server.close(); });

  beforeEach(async () => {
    uploaded = []; deleted = []; failUpload = false; failDelete = false; configured = true; onUpload = null;
    await db.run('UPDATE voluntarios SET cv_url=NULL');
  });

  const login = async (email) => {
    const r = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password1' }),
    });
    const body = await r.json();
    assert.equal(r.status, 200, `login ${email}`);
    return { token: body.token, id: body.user.id };
  };
  const call = (path, { who, method = 'GET' } = {}) =>
    fetch(`${baseUrl}${path}`, { method, headers: who ? { Authorization: `Bearer ${who.token}` } : {} })
      .then(async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => ({})) }));
  const upload = (who, { file = pdf(), field = 'cv' } = {}) => {
    const form = new FormData();
    if (file) form.append(field, new Blob([file.data], { type: file.type }), file.name);
    return fetch(`${baseUrl}/api/voluntarios/me/cv`, {
      method: 'PUT', headers: who ? { Authorization: `Bearer ${who.token}` } : {}, body: form,
    }).then(async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => ({})) }));
  };
  const cvOf = async (userId) => (await db.get('SELECT cv_url FROM voluntarios WHERE user_id=$1', [userId])).cv_url;
  const setCv = (userId, publicId) => db.run('UPDATE voluntarios SET cv_url=$1 WHERE user_id=$2', [publicId, userId]);

  before(async () => {
    maria = await login('maria@example.com');
    lucia = await login('lucia@example.com');
    juan = await login('juan@example.com');
    ngo1 = await login('admin@sustentando.org');
    ngo2 = await login('admin@greencba.org');
    ngo3 = await login('admin@bancoalimentos.org');
    ngo4 = await login('admin@techsocial.org');
    company = await login('admin@techcorp.com');
  });

  describe('PUT /api/voluntarios/me/cv', () => {
    test('primera vez: sube el PDF privado, guarda el public_id y responde { has_cv: true }', async () => {
      const r = await upload(lucia);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(r.body, { has_cv: true });
      assert.equal(uploaded.length, 1);
      assert.equal(uploaded[0].bytes, PDF.length);
      assert.equal(await cvOf(lucia.id), uploaded[0].publicId);
      assert.deepEqual(deleted, [], 'no había uno anterior');
    });

    test('reemplazo: guarda el nuevo y borra el anterior de Cloudinary (C3)', async () => {
      await setCv(lucia.id, 'test/viejo.pdf');
      const r = await upload(lucia);
      assert.equal(r.status, 200);
      assert.equal(await cvOf(lucia.id), uploaded[0].publicId);
      assert.deepEqual(deleted, ['test/viejo.pdf']);
    });

    test('si falla borrar el anterior, el nuevo queda igual (200; el viejo es privado y solo se loguea)', async () => {
      await setCv(lucia.id, 'test/viejo.pdf');
      failDelete = true;
      const r = await upload(lucia);
      assert.equal(r.status, 200);
      assert.equal(await cvOf(lucia.id), uploaded[0].publicId);
    });

    test('si otro pedido cambió el CV mientras se subía: 409, se borra lo subido y queda el del otro', async () => {
      await setCv(lucia.id, 'test/viejo.pdf');
      onUpload = async () => { await setCv(lucia.id, 'test/del-otro.pdf'); };
      const r = await upload(lucia);
      assert.equal(r.status, 409);
      assert.equal(r.body.error, 'Se estaba guardando otro CV al mismo tiempo. Probá de nuevo.');
      assert.equal(await cvOf(lucia.id), 'test/del-otro.pdf');
      assert.deepEqual(deleted, [uploaded[0].publicId], 'se borra el recién subido, no el del otro');
    });

    test('falla la base después de subir: 500, se borra lo subido y el CV anterior sigue', async () => {
      await setCv(lucia.id, 'test/viejo.pdf');
      const realRun = db.run;
      mock.method(db, 'run', async (sql, params) => {
        if (/UPDATE voluntarios SET cv_url/.test(sql)) throw new Error('falla simulada de la base');
        return realRun.call(db, sql, params);
      });
      try {
        const r = await upload(lucia);
        assert.equal(r.status, 500);
        assert.equal(r.body.error, 'Error al guardar el CV');
      } finally { db.run.mock.restore(); }
      assert.equal(await cvOf(lucia.id), 'test/viejo.pdf');
      assert.deepEqual(deleted, [uploaded[0].publicId]);
    });

    describe('rechazos (sin subir nada)', () => {
      test('sin sesión → 401; ONG o empresa → 403', async () => {
        assert.equal((await upload(null)).status, 401);
        assert.equal((await upload(ngo1)).status, 403);
        assert.equal((await upload(company)).status, 403);
        assert.equal(uploaded.length, 0);
      });

      test('sin archivo o en otro campo → 400 "Elegí un archivo PDF"', async () => {
        for (const opts of [{ file: null }, { field: 'file' }]) {
          const r = await upload(lucia, opts);
          assert.equal(r.status, 400);
          assert.equal(r.body.error, 'Elegí un archivo PDF');
        }
        assert.equal(uploaded.length, 0);
      });

      test('tipo declarado que no es PDF → 400', async () => {
        const r = await upload(lucia, { file: { data: PDF, type: 'image/jpeg', name: 'cv.jpg' } });
        assert.equal(r.status, 400);
        assert.equal(r.body.error, 'El CV tiene que ser un PDF');
        assert.equal(uploaded.length, 0);
      });

      test('dice ser PDF pero la cabecera no lo es → 400', async () => {
        const r = await upload(lucia, { file: { data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), type: 'application/pdf', name: 'cv.pdf' } });
        assert.equal(r.status, 400);
        assert.equal(r.body.error, 'El archivo no es un PDF válido');
        assert.equal(uploaded.length, 0);
        assert.equal(await cvOf(lucia.id), null);
      });

      test('más de 5 MB → 413', async () => {
        const big = { data: Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]), type: 'application/pdf', name: 'cv.pdf' };
        const r = await upload(lucia, { file: big });
        assert.equal(r.status, 413);
        assert.equal(r.body.error, 'El CV puede pesar hasta 5 MB');
        assert.equal(uploaded.length, 0);
      });

      test('Cloudinary sin configurar → 503', async () => {
        configured = false;
        const r = await upload(lucia);
        assert.equal(r.status, 503);
        assert.equal(r.body.error, 'La subida de archivos no está disponible por el momento');
        assert.equal(uploaded.length, 0);
      });

      test('Cloudinary falla → 502 y el CV anterior sigue', async () => {
        await setCv(lucia.id, 'test/viejo.pdf');
        failUpload = true;
        const r = await upload(lucia);
        assert.equal(r.status, 502);
        assert.equal(r.body.error, 'No pudimos subir el CV. Probá de nuevo en un momento.');
        assert.equal(await cvOf(lucia.id), 'test/viejo.pdf');
        assert.deepEqual(deleted, []);
      });
    });
  });

  describe('DELETE /api/voluntarios/me/cv', () => {
    test('borra el public_id de la base y el archivo de Cloudinary', async () => {
      await setCv(lucia.id, 'test/viejo.pdf');
      const r = await call('/api/voluntarios/me/cv', { who: lucia, method: 'DELETE' });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { has_cv: false });
      assert.equal(await cvOf(lucia.id), null);
      assert.deepEqual(deleted, ['test/viejo.pdf']);
    });

    test('sin CV cargado: 200 { has_cv: false } sin llamar a Cloudinary (idempotente)', async () => {
      const r = await call('/api/voluntarios/me/cv', { who: lucia, method: 'DELETE' });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { has_cv: false });
      assert.deepEqual(deleted, []);
    });

    test('si falla Cloudinary, en la base igual queda borrado (el archivo es privado; se loguea)', async () => {
      await setCv(lucia.id, 'test/viejo.pdf');
      failDelete = true;
      const r = await call('/api/voluntarios/me/cv', { who: lucia, method: 'DELETE' });
      assert.equal(r.status, 200);
      assert.equal(await cvOf(lucia.id), null);
    });

    test('sin sesión → 401; ONG → 403', async () => {
      assert.equal((await call('/api/voluntarios/me/cv', { method: 'DELETE' })).status, 401);
      assert.equal((await call('/api/voluntarios/me/cv', { who: ngo1, method: 'DELETE' })).status, 403);
    });
  });

  describe('GET /api/voluntarios/:userId/cv: quién lo puede ver (C1)', () => {
    const view = (who, userId = lucia.id) => call(`/api/voluntarios/${userId}/cv`, { who });
    const ok = (r) => {
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(Object.keys(r.body).sort(), ['expires_at', 'url']);
      assert.match(r.body.url, /public_id=test%2Flucia\.pdf/);
      assert.equal(r.body.expires_at, '2026-10-16T12:10:00.000Z');
    };
    const notFound = (r) => {
      assert.equal(r.status, 404);
      assert.deepEqual(r.body, { error: 'CV no disponible' });
    };
    beforeEach(() => setCv(lucia.id, 'test/lucia.pdf'));

    test('la dueña lo ve', async () => ok(await view(lucia)));
    test('ONG con inscripción APROBADA en un proyecto suyo (techsocial, proj-4) lo ve', async () => ok(await view(ngo4)));
    test('ONG con inscripción PENDIENTE en un proyecto suyo (bancoalimentos, proj-10) lo ve', async () => ok(await view(ngo3)));

    test('ONG sin inscripciones de ella en sus proyectos → 404 (igual que "no tiene CV")', async () => {
      notFound(await view(ngo1));
      notFound(await view(ngo2));
    });

    test('inscripción rechazada o cancelada no alcanza', async () => {
      for (const status of ['rejected', 'cancelled']) {
        await db.run(`UPDATE enrollments SET status=$1 WHERE user_id='user-vol-3' AND project_id='proj-10'`, [status]);
        try { notFound(await view(ngo3)); }
        finally { await db.run(`UPDATE enrollments SET status='pending' WHERE user_id='user-vol-3' AND project_id='proj-10'`); }
      }
    });

    test('otro voluntario y una empresa → 404; sin sesión → 401', async () => {
      notFound(await view(maria));
      notFound(await view(juan));
      notFound(await view(company));
      assert.equal((await view(null)).status, 401);
    });

    test('sin CV cargado: 404 con el mismo mensaje (también para la dueña)', async () => {
      await setCv(lucia.id, null);
      notFound(await view(lucia));
      notFound(await view(ngo4));
    });

    test('un id que no es de un voluntario (la ONG) o que no existe → 404', async () => {
      notFound(await view(ngo4, ngo4.id));
      notFound(await view(ngo4, 'no-existe'));
    });

    test('Cloudinary sin configurar → 503 (solo a quien tiene permiso)', async () => {
      configured = false;
      const r = await view(lucia);
      assert.equal(r.status, 503);
      // Regla R4 de la tabla de decisión (docs/calidad/DISENO_CASOS.md §3): ONG CON permiso → también 503 (§199)
      assert.equal((await view(ngo4)).status, 503);
      notFound(await view(ngo1));
    });
  });

  // §168: el panel de la ONG muestra "Ver CV" solo si hay algo que ver. Antes el botón aparecía siempre y, sin CV,
  // abría y cerraba una pestaña vacía (openCv la abre antes del pedido para que el navegador no la bloquee).
  describe('GET /api/enrollments/project/:id trae has_cv (true solo cuando la ONG puede abrirlo)', () => {
    const list = async (who, projectId) => {
      const r = await call(`/api/enrollments/project/${projectId}`, { who });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      return r;
    };
    const luciaIn = (r) => r.body.enrollments.find((e) => e.user_id === lucia.id);

    test('inscripción aprobada (proj-4) y pendiente (proj-10) con CV → has_cv: true', async () => {
      await setCv(lucia.id, 'test/lucia.pdf');
      assert.equal(luciaIn(await list(ngo4, 'proj-4')).has_cv, true);
      assert.equal(luciaIn(await list(ngo3, 'proj-10')).has_cv, true);
    });

    test('sin CV → has_cv: false (boolean, no null ni 0)', async () => {
      const e = luciaIn(await list(ngo4, 'proj-4'));
      assert.strictEqual(e.has_cv, false);
    });

    test('inscripción rechazada o cancelada → has_cv: false aunque tenga CV (la ONG no puede abrirlo)', async () => {
      await setCv(lucia.id, 'test/lucia.pdf');
      for (const status of ['rejected', 'cancelled']) {
        await db.run(`UPDATE enrollments SET status=$1 WHERE user_id='user-vol-3' AND project_id='proj-10'`, [status]);
        try { assert.strictEqual(luciaIn(await list(ngo3, 'proj-10')).has_cv, false); }
        finally { await db.run(`UPDATE enrollments SET status='pending' WHERE user_id='user-vol-3' AND project_id='proj-10'`); }
      }
    });

    test('cada inscripción trae has_cv, y la respuesta nunca trae cv_url ni el public_id', async () => {
      await setCv(lucia.id, 'test/lucia.pdf');
      const r = await list(ngo4, 'proj-4');
      assert.ok(r.body.enrollments.length > 0);
      for (const e of r.body.enrollments) {
        assert.equal(typeof e.has_cv, 'boolean');
        assert.equal('cv_url' in e, false);
      }
      assert.ok(!JSON.stringify(r.body).includes('test/lucia.pdf'));
    });

    test('con ?status= también', async () => {
      await setCv(lucia.id, 'test/lucia.pdf');
      const r = await call('/api/enrollments/project/proj-10?status=pending', { who: ngo3 });
      assert.equal(luciaIn(r).has_cv, true);
    });
  });

  describe('el public_id no sale por ningún otro lado', () => {
    test('GET /api/auth/me: profile trae has_cv (boolean) y no cv_url', async () => {
      await setCv(lucia.id, 'test/lucia.pdf');
      const me = await call('/api/auth/me', { who: lucia });
      assert.equal(me.body.profile.has_cv, true);
      assert.equal('cv_url' in me.body.profile, false);
      await setCv(lucia.id, null);
      assert.equal((await call('/api/auth/me', { who: lucia })).body.profile.has_cv, false);
    });

    test('el perfil público no trae ni cv_url ni el public_id', async () => {
      await setCv(lucia.id, 'test/lucia.pdf');
      const r = await call(`/api/voluntarios/${lucia.id}`);
      assert.equal(r.status, 200);
      assert.ok(!JSON.stringify(r.body).includes('test/lucia.pdf'));
      assert.equal('cv_url' in r.body.volunteer, false);
    });
  });

  describe('límite de frecuencia de subidas', () => {
    test('pasadas 10 subidas por hora → 429 con Retry-After, sin subir', async () => {
      for (let i = 0; i < 10; i++) assert.equal((await upload(juan)).status, 200, `subida ${i + 1}`);
      uploaded = [];
      const r = await upload(juan);
      assert.equal(r.status, 429);
      assert.ok(Number(r.headers.get('retry-after')) > 0);
      assert.equal(r.body.error, 'Subiste el CV muchas veces seguidas. Esperá un rato e intentá de nuevo.');
      assert.equal(uploaded.length, 0);
    });
  });
});
