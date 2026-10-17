// test/integration/account-deletion.test.js
//
// Borrar la propia cuenta con confirmación por email (PROJECT_ANALYSIS.md §177; pedido del usuario para la página de
// privacidad):
//   POST /api/auth/me/delete-request         (con sesión)  → manda un email con un link que vence en 1 hora
//   POST /api/auth/delete-account { token }  (sin sesión)  → borra la cuenta (CASCADE) y corrige contadores
// El link lleva un código de un solo uso; en la base se guarda SOLO su hash (sha256). El vencimiento es un ISO calculado
// en JS (no la hora de la base: así no depende del motor ni de la zona horaria). Sin email no hay borrado: si Resend no
// está configurado o falla, no queda ningún link guardado. Después del COMMIT se borran, en lo posible, el CV y las
// fotos de Momentos en Cloudinary (dobles en este test).
//
// Seed: maria (user-vol-1) aprobada en proj-1 (ngo-1) y proj-7 (ngo-1), pendiente en proj-9 (ngo-4).
//       techsocial (user-ngo-4, ngo-4) dueña de proj-4, proj-9 y proj-11; lucia (user-vol-3) aprobada en proj-4.
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { setupTestServer } = require('./helpers');

describe('Borrar la propia cuenta', () => {
  let server, baseUrl, db, email, storage;
  let sent, sendResult, deletedPdfs, deletedImages, failStorage;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    email = require('../../src/lib/email');
    storage = require('../../src/lib/storage');
    mock.method(email, 'sendEmail', async (msg) => { sent.push(msg); return sendResult; });
    mock.method(storage, 'isConfigured', () => true);
    mock.method(storage, 'deletePdf', async (id) => { if (failStorage) throw new Error('boom'); deletedPdfs.push(id); return true; });
    mock.method(storage, 'deleteImage', async (id) => { if (failStorage) throw new Error('boom'); deletedImages.push(id); return true; });
  });
  after(async () => { mock.restoreAll(); if (server) await server.close(); });
  beforeEach(() => { sent = []; sendResult = { ok: true }; deletedPdfs = []; deletedImages = []; failStorage = false; });

  const call = (path, { token, method = 'GET', body } = {}) => fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => ({})) }));
  const login = async (email_, password = 'Password1') => {
    const r = await call('/api/auth/login', { method: 'POST', body: { email: email_, password } });
    return r.status === 200 ? { token: r.body.token, id: r.body.user.id } : null;
  };
  const register = async (name, mail, role = 'volunteer') => {
    const r = await call('/api/auth/register', { method: 'POST', body: { name, email: mail, password: 'Password1', role } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return { token: r.body.token, id: r.body.user.id };
  };
  const requestDeletion = (who) => call('/api/auth/me/delete-request', { token: who?.token, method: 'POST' });
  const confirmDeletion = (token) => call('/api/auth/delete-account', { method: 'POST', body: { token } });
  const linkToken = (msg) => {
    const m = /\/cuenta\/borrar\?token=([A-Za-z0-9_-]+)/.exec(msg.html);
    assert.ok(m, 'el email trae el link');
    return m[1];
  };
  const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
  const userExists = async (id) => Boolean(await db.get('SELECT id FROM users WHERE id=$1', [id]));

  describe('POST /api/auth/me/delete-request', () => {
    test('manda el email con el link a /cuenta/borrar y guarda solo el hash del código', async () => {
      const u = await register('Ana Prueba', 'ana-borrar@example.com');
      const r = await requestDeletion(u);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(r.body, { sent: true });
      assert.equal(sent.length, 1);
      assert.equal(sent[0].to, 'ana-borrar@example.com');
      assert.match(sent[0].subject, /borrar tu cuenta/i);
      assert.match(sent[0].html, /http:\/\/localhost:5173\/cuenta\/borrar\?token=/);
      const t = linkToken(sent[0]);
      assert.ok(t.length >= 40, 'código largo (256 bits)');
      const rows = await db.all('SELECT token_hash, expires_at FROM account_deletion_tokens WHERE user_id=$1', [u.id]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].token_hash, hash(t));
      assert.ok(!JSON.stringify(rows).includes(t), 'el código en claro no se guarda');
      const ms = Date.parse(rows[0].expires_at) - Date.now();
      assert.ok(ms > 55 * 60 * 1000 && ms <= 60 * 60 * 1000, `vence en ~1 hora (${ms} ms)`);
    });

    test('pedirlo de nuevo invalida el link anterior', async () => {
      const u = await register('Beto Prueba', 'beto-borrar@example.com');
      await requestDeletion(u);
      const first = linkToken(sent[0]);
      await requestDeletion(u);
      const second = linkToken(sent[1]);
      assert.notEqual(first, second);
      assert.equal((await confirmDeletion(first)).status, 400);
      assert.equal((await confirmDeletion(second)).status, 200);
    });

    test('sin email configurado → 503 y no queda ningún link guardado', async () => {
      const u = await register('Caro Prueba', 'caro-borrar@example.com');
      sendResult = { ok: false, skipped: true };
      const r = await requestDeletion(u);
      assert.equal(r.status, 503);
      assert.equal(r.body.error, 'No podemos mandar emails por el momento, así que no se puede confirmar el borrado.');
      assert.equal((await db.all('SELECT 1 FROM account_deletion_tokens WHERE user_id=$1', [u.id])).length, 0);
    });

    test('el email falla → 502 y no queda ningún link guardado', async () => {
      const u = await register('Dani Prueba', 'dani-borrar@example.com');
      sendResult = { ok: false, error: 'resend_500' };
      const r = await requestDeletion(u);
      assert.equal(r.status, 502);
      assert.equal(r.body.error, 'No pudimos mandar el email. Probá de nuevo en un rato.');
      assert.equal((await db.all('SELECT 1 FROM account_deletion_tokens WHERE user_id=$1', [u.id])).length, 0);
    });

    test('sin sesión → 401', async () => {
      assert.equal((await requestDeletion(null)).status, 401);
      assert.equal(sent.length, 0);
    });

    test('más de 3 pedidos por hora → 429 con Retry-After, sin mandar email', async () => {
      const u = await register('Eli Prueba', 'eli-borrar@example.com');
      for (let i = 0; i < 3; i++) assert.equal((await requestDeletion(u)).status, 200);
      sent = [];
      const r = await requestDeletion(u);
      assert.equal(r.status, 429);
      assert.ok(Number(r.headers.get('retry-after')) > 0);
      assert.equal(sent.length, 0);
    });
  });

  describe('POST /api/auth/delete-account', () => {
    test('código inválido o con forma rara → 400 sin borrar nada', async () => {
      for (const token of [undefined, '', 'corto', 42, {}, 'a'.repeat(200), 'x'.repeat(43)]) {
        const r = await confirmDeletion(token);
        assert.equal(r.status, 400, JSON.stringify(token));
        assert.equal(r.body.error, 'El link no es válido o ya se usó. Pedí uno nuevo desde tu perfil.');
      }
    });

    test('vencido → 400, se descarta, y la cuenta sigue', async () => {
      const u = await register('Fede Prueba', 'fede-borrar@example.com');
      await requestDeletion(u);
      const t = linkToken(sent[0]);
      await db.run('UPDATE account_deletion_tokens SET expires_at=$1 WHERE user_id=$2', [new Date(Date.now() - 1000).toISOString(), u.id]);
      const r = await confirmDeletion(t);
      assert.equal(r.status, 400);
      assert.equal(r.body.error, 'El link venció. Pedí uno nuevo desde tu perfil.');
      assert.ok(await userExists(u.id));
      assert.equal((await db.all('SELECT 1 FROM account_deletion_tokens WHERE user_id=$1', [u.id])).length, 0);
    });

    test('voluntaria: se borra todo lo suyo, los contadores quedan bien y se limpian sus archivos', async () => {
      const maria = await login('maria@example.com');
      // Estado conocido: sigue a ngo-2, a proj-3 y a juan; tiene CV y una foto en Momentos.
      await db.run(`INSERT INTO ngo_follows (user_id, ngo_id) VALUES ('user-vol-1','ngo-2') ON CONFLICT DO NOTHING`);
      await db.run(`INSERT INTO project_follows (user_id, project_id) VALUES ('user-vol-1','proj-3') ON CONFLICT DO NOTHING`);
      await db.run(`INSERT INTO volunteer_follows (follower_id, following_id) VALUES ('user-vol-1','user-vol-2') ON CONFLICT DO NOTHING`);
      await db.run(`UPDATE ngos SET followers=5 WHERE id='ngo-2'`);
      await db.run(`UPDATE projects SET followers=7 WHERE id='proj-3'`);
      await db.run(`UPDATE voluntarios SET followers=3 WHERE user_id='user-vol-2'`);
      await db.run(`UPDATE voluntarios SET cv_url='test/cv-maria.pdf' WHERE user_id='user-vol-1'`);
      await db.run(`INSERT INTO posts (id, user_id, project_id, caption) VALUES ('post-del-1','user-vol-1','proj-1','hola')`);
      await db.run(`INSERT INTO post_media (id, post_id, url, provider_id, position, width, height) VALUES ('pm-del-1','post-del-1','https://x','test/foto-maria',0,1,1)`);
      const cupos1 = Number((await db.get(`SELECT cupos_ocupados FROM projects WHERE id='proj-1'`)).cupos_ocupados);
      const cupos7 = Number((await db.get(`SELECT cupos_ocupados FROM projects WHERE id='proj-7'`)).cupos_ocupados);
      const cupos9 = Number((await db.get(`SELECT cupos_ocupados FROM projects WHERE id='proj-9'`)).cupos_ocupados);

      await requestDeletion(maria);
      const r = await confirmDeletion(linkToken(sent[0]));
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(r.body, { deleted: true });

      assert.equal(await userExists('user-vol-1'), false);
      for (const [sql, label] of [
        [`SELECT 1 FROM voluntarios WHERE user_id='user-vol-1'`, 'perfil'],
        [`SELECT 1 FROM enrollments WHERE user_id='user-vol-1'`, 'inscripciones'],
        [`SELECT 1 FROM ngo_follows WHERE user_id='user-vol-1'`, 'follows de ONG'],
        [`SELECT 1 FROM posts WHERE user_id='user-vol-1'`, 'Momentos'],
        [`SELECT 1 FROM account_deletion_tokens WHERE user_id='user-vol-1'`, 'links'],
      ]) assert.equal((await db.all(sql)).length, 0, label);

      assert.equal(Number((await db.get(`SELECT followers FROM ngos WHERE id='ngo-2'`)).followers), 4);
      assert.equal(Number((await db.get(`SELECT followers FROM projects WHERE id='proj-3'`)).followers), 6);
      assert.equal(Number((await db.get(`SELECT followers FROM voluntarios WHERE user_id='user-vol-2'`)).followers), 2);
      // Las aprobadas liberan su cupo; la pendiente (proj-9) no ocupaba ninguno.
      assert.equal(Number((await db.get(`SELECT cupos_ocupados FROM projects WHERE id='proj-1'`)).cupos_ocupados), cupos1 - 1);
      assert.equal(Number((await db.get(`SELECT cupos_ocupados FROM projects WHERE id='proj-7'`)).cupos_ocupados), cupos7 - 1);
      assert.equal(Number((await db.get(`SELECT cupos_ocupados FROM projects WHERE id='proj-9'`)).cupos_ocupados), cupos9);

      assert.deepEqual(deletedPdfs, ['test/cv-maria.pdf']);
      assert.deepEqual(deletedImages, ['test/foto-maria']);
      assert.equal(await login('maria@example.com'), null, 'ya no puede iniciar sesión');
    });

    test('el link es de un solo uso', async () => {
      const u = await register('Gabi Prueba', 'gabi-borrar@example.com');
      await requestDeletion(u);
      const t = linkToken(sent[0]);
      assert.equal((await confirmDeletion(t)).status, 200);
      assert.equal((await confirmDeletion(t)).status, 400);
    });

    test('un contador en 0 no baja de 0 (no rompe el CHECK)', async () => {
      const u = await register('Hugo Prueba', 'hugo-borrar@example.com');
      await db.run(`INSERT INTO ngo_follows (user_id, ngo_id) VALUES ($1,'ngo-3')`, [u.id]);
      await db.run(`UPDATE ngos SET followers=0 WHERE id='ngo-3'`);
      await requestDeletion(u);
      assert.equal((await confirmDeletion(linkToken(sent[0]))).status, 200);
      assert.equal(Number((await db.get(`SELECT followers FROM ngos WHERE id='ngo-3'`)).followers), 0);
    });

    test('ONG: se borran sus proyectos (y las inscripciones y fotos de otros en ellos); las donaciones quedan sin proyecto', async () => {
      const ngo4 = await login('admin@techsocial.org');
      await db.run(`INSERT INTO donaciones (id, user_id, project_id, ngo_id, monto, estado, moneda)
                    VALUES ('don-del-1','user-vol-2','proj-4','ngo-4',1500,'completada','ARS')`);
      await db.run(`INSERT INTO posts (id, user_id, project_id, caption) VALUES ('post-del-2','user-vol-3','proj-4','foto de lucia')`);
      await db.run(`INSERT INTO post_media (id, post_id, url, provider_id, position, width, height) VALUES ('pm-del-2','post-del-2','https://x','test/foto-lucia',0,1,1)`);
      await requestDeletion(ngo4);
      assert.equal((await confirmDeletion(linkToken(sent[0]))).status, 200);
      assert.equal((await db.all(`SELECT 1 FROM projects WHERE ngo_id='ngo-4'`)).length, 0);
      assert.equal((await db.all(`SELECT 1 FROM enrollments WHERE project_id='proj-4'`)).length, 0);
      assert.equal(await userExists('user-vol-3'), true, 'la voluntaria sigue');
      const d = await db.get(`SELECT project_id, ngo_id FROM donaciones WHERE id='don-del-1'`);
      assert.deepEqual({ project_id: d.project_id, ngo_id: d.ngo_id }, { project_id: null, ngo_id: null });
      assert.deepEqual(deletedImages, ['test/foto-lucia'], 'las fotos de Momentos de sus proyectos también');
    });

    test('empresa: también se puede', async () => {
      const comp = await login('admin@techcorp.com');
      await requestDeletion(comp);
      assert.equal((await confirmDeletion(linkToken(sent[0]))).status, 200);
      assert.equal((await db.all(`SELECT 1 FROM empresas WHERE user_id='user-comp-1'`)).length, 0);
    });

    test('si Cloudinary falla, la cuenta igual queda borrada (los archivos son privados o huérfanos; se loguea)', async () => {
      const u = await register('Iara Prueba', 'iara-borrar@example.com');
      await db.run(`UPDATE voluntarios SET cv_url='test/cv-iara.pdf' WHERE user_id=$1`, [u.id]);
      failStorage = true;
      await requestDeletion(u);
      assert.equal((await confirmDeletion(linkToken(sent[0]))).status, 200);
      assert.equal(await userExists(u.id), false);
    });

    test('si la base falla a mitad, no se borra nada ni quedan contadores a medias; el link sigue sirviendo', async () => {
      const u = await register('Juli Prueba', 'juli-borrar@example.com');
      await db.run(`INSERT INTO ngo_follows (user_id, ngo_id) VALUES ($1,'ngo-1')`, [u.id]);
      await db.run(`UPDATE ngos SET followers=10 WHERE id='ngo-1'`);
      await requestDeletion(u);
      const t = linkToken(sent[0]);
      const realTx = db.transaction;
      mock.method(db, 'transaction', (fn) => realTx.call(db, async (tx) => {
        const wrapped = Object.create(tx);
        wrapped.run = async (sql, params) => {
          if (/DELETE FROM users/.test(sql)) throw new Error('falla simulada');
          return tx.run(sql, params);
        };
        return fn(wrapped);
      }));
      try {
        const r = await confirmDeletion(t);
        assert.equal(r.status, 500);
        assert.equal(r.body.error, 'No pudimos borrar la cuenta. Probá de nuevo.');
      } finally { db.transaction.mock.restore(); }
      assert.ok(await userExists(u.id));
      assert.equal(Number((await db.get(`SELECT followers FROM ngos WHERE id='ngo-1'`)).followers), 10, 'el contador no bajó');
      assert.equal(deletedPdfs.length + deletedImages.length, 0, 'no se borró nada en Cloudinary');
      assert.equal((await confirmDeletion(t)).status, 200, 'el reintento con el mismo link funciona');
    });
  });
});
