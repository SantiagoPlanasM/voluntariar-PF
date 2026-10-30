// test/integration/ownership.test.js
//
// Autorización por dueño entre ONGs (REVISION.md T1). Los controles existen en el código
// (`WHERE ... AND p.ngo_id = $n`), pero hasta ahora solo posts.test.js probaba una "ONG ajena": si
// alguien sacaba un filtro, ningún test se ponía rojo. Acá una ONG (Green Córdoba) intenta operar
// sobre recursos de otra (Sustentando, dueña de proj-1) y en cada caso se comprueba el código de
// respuesta Y que la base no cambió. Al final la ONG dueña hace lo mismo con éxito: eso prueba que
// los ids usados eran correctos (que el rechazo no venía de un id mal armado).
const { test, describe, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Autorización por dueño entre ONGs', () => {
  let server;
  let baseUrl;
  let db;
  let owner;   // Sustentando (ngo-1), dueña de proj-1
  let other;   // Green Córdoba (ngo-2), dueña de proj-2
  let company; // TechCorp
  let pendingId;  // inscripción pendiente de user-vol-2 en proj-1
  let approvedId; // inscripción aprobada de user-vol-1 en proj-1
  let kpiId;      // KPI de proj-1
  let empresaId;

  const api = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const login = async (email) => {
    const r = await api('/api/auth/login', { method: 'POST', body: { email, password: 'Password1' } });
    assert.equal(r.status, 200, `login ${email}`);
    return r.body.token;
  };

  const enrollment = (id) => db.get('SELECT status, horas_realizadas FROM enrollments WHERE id=$1', [id]);
  const project1 = () => db.get(`SELECT titulo, status, cupos, cupos_ocupados FROM projects WHERE id='proj-1'`);
  const kpi = (id) => db.get('SELECT nombre, valor FROM kpis WHERE id=$1', [id]);
  const patrocinio = () =>
    db.get(`SELECT estado FROM empresa_voluntariados WHERE empresa_id=$1 AND project_id='proj-1'`, [empresaId]);

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');

    owner = await login('admin@sustentando.org');
    other = await login('admin@greencba.org');
    company = await login('admin@techcorp.com');

    pendingId = (await db.get(`SELECT id FROM enrollments WHERE user_id='user-vol-2' AND project_id='proj-1'`)).id;
    approvedId = (await db.get(`SELECT id FROM enrollments WHERE user_id='user-vol-1' AND project_id='proj-1'`)).id;
    assert.equal((await enrollment(pendingId)).status, 'pending');
    assert.equal((await enrollment(approvedId)).status, 'approved');

    const k = await api('/api/projects/proj-1/kpis', {
      token: owner, method: 'POST', body: { nombre: 'Árboles plantados', valor: 10 },
    });
    assert.equal(k.status, 201);
    kpiId = k.body.kpi.id;

    const p = await api('/api/empresas/me/patrocinios', {
      token: company, method: 'POST', body: { project_id: 'proj-1', mensaje: 'Queremos ayudar' },
    });
    assert.ok(p.status === 200 || p.status === 201, `propuesta de patrocinio: ${p.status}`);
    empresaId = (await db.get(`SELECT id FROM empresas WHERE user_id='user-comp-1'`)).id;
    assert.equal((await patrocinio()).estado, 'propuesto');
  });

  after(async () => {
    if (server) await server.close();
  });

  describe('una ONG ajena NO puede', () => {
    test('ver las inscripciones (con emails) de un proyecto ajeno', async () => {
      const r = await api('/api/enrollments/project/proj-1', { token: other });
      assert.equal(r.status, 403);
      assert.equal(r.body.enrollments, undefined);
      assert.ok(!JSON.stringify(r.body).includes('@example.com'), 'no filtra emails de voluntarios');
    });

    test('aprobar o rechazar inscripciones de un proyecto ajeno', async () => {
      const before = await project1();
      const a = await api(`/api/enrollments/${pendingId}`, { token: other, method: 'PATCH', body: { status: 'approved' } });
      assert.equal(a.status, 404);
      const r = await api(`/api/enrollments/${approvedId}`, { token: other, method: 'PATCH', body: { status: 'rejected' } });
      assert.equal(r.status, 404);
      assert.equal((await enrollment(pendingId)).status, 'pending');
      assert.equal((await enrollment(approvedId)).status, 'approved');
      assert.deepEqual(await project1(), before, 'el cupo no cambió');
    });

    test('cargar horas en una inscripción de un proyecto ajeno', async () => {
      const before = (await enrollment(approvedId)).horas_realizadas;
      const r = await api(`/api/enrollments/${approvedId}/horas`, { token: other, method: 'PATCH', body: { horas: 99 } });
      assert.equal(r.status, 404);
      assert.equal((await enrollment(approvedId)).horas_realizadas, before);
    });

    test('editar un proyecto ajeno', async () => {
      const before = await project1();
      const r = await api('/api/projects/proj-1', {
        token: other, method: 'PUT',
        body: { title: 'Proyecto tomado', description: 'x', location: 'x', type: 'fugaz', status: 'closed', volunteers_needed: 50 },
      });
      assert.equal(r.status, 404);
      assert.deepEqual(await project1(), before);
    });

    test('borrar un proyecto ajeno', async () => {
      const r = await api('/api/projects/proj-1', { token: other, method: 'DELETE' });
      assert.equal(r.status, 404);
      assert.ok(await project1(), 'el proyecto sigue existiendo');
    });

    test('crear, editar o borrar KPIs de un proyecto ajeno', async () => {
      const count = async () => Number((await db.get(`SELECT COUNT(*) AS n FROM kpis WHERE project_id='proj-1'`)).n);
      const n = await count();
      const c = await api('/api/projects/proj-1/kpis', { token: other, method: 'POST', body: { nombre: 'Intruso', valor: 1 } });
      assert.equal(c.status, 403);
      assert.equal(await count(), n);

      const u = await api(`/api/projects/proj-1/kpis/${kpiId}`, { token: other, method: 'PUT', body: { nombre: 'Pisado', valor: 0 } });
      assert.equal(u.status, 403);
      const d = await api(`/api/projects/proj-1/kpis/${kpiId}`, { token: other, method: 'DELETE' });
      assert.equal(d.status, 403);
      assert.deepEqual(await kpi(kpiId), { nombre: 'Árboles plantados', valor: 10 });
    });

    test('editar o borrar un KPI ajeno pasando por la URL de un proyecto propio', async () => {
      // proj-2 es de la ONG ajena: pasa el control de dueño del proyecto, pero el KPI no es de ese proyecto.
      // Los códigos de respuesta (404, sin datos ajenos) los prueba project-subresources.test.js (B18).
      await api(`/api/projects/proj-2/kpis/${kpiId}`, { token: other, method: 'PUT', body: { nombre: 'Pisado', valor: 0 } });
      await api(`/api/projects/proj-2/kpis/${kpiId}`, { token: other, method: 'DELETE' });
      assert.deepEqual(await kpi(kpiId), { nombre: 'Árboles plantados', valor: 10 });
    });

    test('ver ni decidir un patrocinio propuesto a un proyecto ajeno', async () => {
      const list = await api('/api/ngos/me/patrocinios', { token: other });
      assert.equal(list.status, 200);
      assert.ok(!JSON.stringify(list.body).includes('proj-1'), 'no ve patrocinios de proyectos ajenos');

      const r = await api(`/api/ngos/me/patrocinios/${empresaId}/proj-1`, {
        token: other, method: 'PATCH', body: { estado: 'aceptado' },
      });
      assert.equal(r.status, 404);
      assert.equal((await patrocinio()).estado, 'propuesto');
    });

    test('ver en su propio panel las inscripciones pendientes (con emails) de proyectos ajenos', async () => {
      // GET /ngos/me y GET /ngos/:id/dashboard listan las pendientes de la ONG con nombre y email del voluntario.
      const ids = (body) => (body.pending_enrollments || []).map((e) => e.id);
      const me = await api('/api/ngos/me', { token: other });
      const dash = await api('/api/ngos/ngo-2/dashboard', { token: other });
      assert.equal(me.status, 200);
      assert.equal(dash.status, 200);
      assert.ok(!ids(me.body).includes(pendingId), 'GET /ngos/me no muestra pendientes ajenas');
      assert.ok(!ids(dash.body).includes(pendingId), 'el dashboard no muestra pendientes ajenas');

      // Control (solo lectura): a la dueña sí le aparece en los dos.
      assert.ok(ids((await api('/api/ngos/me', { token: owner })).body).includes(pendingId));
      assert.ok(ids((await api('/api/ngos/ngo-1/dashboard', { token: owner })).body).includes(pendingId));
    });

    test('ver el dashboard ni los empleados de otra ONG, ni agregarle empleados', async () => {
      assert.equal((await api('/api/ngos/ngo-1/dashboard', { token: other })).status, 403);
      assert.equal((await api('/api/ngos/ngo-1/empleados', { token: other })).status, 403);
      const p = await api('/api/ngos/ngo-1/empleados', {
        token: other, method: 'POST', body: { nombre: 'Intruso', apellido: 'X', email: 'intruso@example.com' },
      });
      assert.equal(p.status, 403);
      const n = Number((await db.get(`SELECT COUNT(*) AS n FROM empleados WHERE ngo_id='ngo-1'`)).n);
      assert.equal(n, 0);
    });

    // §165: el CV de María (inscripta solo en proyectos de Sustentando y de TechSocial) lo ve Sustentando y no
    // Green Córdoba. Los casos completos (pendiente, rechazada, otros roles) están en cv.test.js.
    test('ver el CV de un voluntario que no se inscribió en ningún proyecto suyo (y la dueña sí)', async () => {
      const storage = require('../../src/lib/storage');
      mock.method(storage, 'isConfigured', () => true);
      mock.method(storage, 'pdfDownloadUrl', () => ({ url: 'https://api.cloudinary.com/x', expiresAt: '2026-10-16T00:00:00.000Z' }));
      await db.run(`UPDATE voluntarios SET cv_url='test/maria.pdf' WHERE user_id='user-vol-1'`);
      try {
        const denied = await api('/api/voluntarios/user-vol-1/cv', { token: other });
        assert.equal(denied.status, 404);
        assert.ok(!JSON.stringify(denied.body).includes('cloudinary'));
        assert.equal((await api('/api/voluntarios/user-vol-1/cv', { token: owner })).status, 200);
      } finally {
        mock.restoreAll();
        await db.run(`UPDATE voluntarios SET cv_url=NULL WHERE user_id='user-vol-1'`);
      }
    });

    // §171: GET /api/donaciones/:id filtra por `user_id`. Ni la ONG que la recibe ni otra persona la ven; la dueña sí.
    test('ver una donación de otra persona (ni siquiera la ONG que la recibe), y la dueña sí', async () => {
      await db.run(`INSERT INTO donaciones (id, user_id, project_id, ngo_id, monto, estado, moneda)
                    VALUES ('don-own-1','user-vol-1','proj-1','ngo-1',1500,'pendiente','ARS')`);
      try {
        for (const token of [owner, other, company]) {
          const r = await api('/api/donaciones/don-own-1', { token });
          assert.equal(r.status, 404);
          assert.ok(!JSON.stringify(r.body).includes('1500'));
        }
        const maria = await login('maria@example.com');
        assert.equal((await api('/api/donaciones/don-own-1', { token: maria })).status, 200);
      } finally {
        await db.run(`DELETE FROM donaciones WHERE id='don-own-1'`);
      }
    });
  });

  // Marketplace (§216): los endpoints son /me, así que "ajeno" es usar el state de otra ONG o tocar su cuenta.
  describe('cuenta de Mercado Pago de otra ONG', () => {
    test('no puede usar el state de la vinculación de otra ONG, ni ver ni desvincular su cuenta; la dueña sí', async () => {
      const { mock } = require('node:test');
      const crypto = require('node:crypto');
      const payments = require('../../src/lib/payments');
      const env = { MP_CLIENT_ID: '1', MP_CLIENT_SECRET: 's', MP_OAUTH_REDIRECT_URI: 'https://x/ngo/mercadopago/vuelta', MP_TOKEN_KEY: crypto.randomBytes(32).toString('base64') };
      const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
      Object.assign(process.env, env);
      const exchange = mock.method(payments, 'exchangeCode', async () => ({ accessToken: 'APP_USR-a', refreshToken: 'TG-r', mpUserId: '3772556008', expiresIn: 100, liveMode: false }));
      try {
        const c = await api('/api/ngos/me/mercadopago/connect', { token: owner, method: 'POST' });
        const state = new URL(c.body.authorization_url).searchParams.get('state');
        const stolen = await api('/api/ngos/me/mercadopago/callback', { token: other, method: 'POST', body: { code: 'TG-c', state } });
        assert.equal(stolen.status, 400);
        assert.equal(exchange.mock.callCount(), 0);
        assert.equal(await db.get(`SELECT 1 AS x FROM ngo_cuentas_mp WHERE ngo_id='ngo-2'`), undefined);

        assert.equal((await api('/api/ngos/me/mercadopago/callback', { token: owner, method: 'POST', body: { code: 'TG-c', state } })).status, 200);
        assert.equal((await api('/api/ngos/me/mercadopago', { token: other })).body.account, null);
        assert.equal((await api('/api/ngos/me/mercadopago', { token: other, method: 'DELETE' })).body.disconnected, false);
        assert.equal((await api('/api/ngos/me/mercadopago', { token: owner })).body.account.mp_user_id, '3772556008');
        assert.equal((await api('/api/ngos/me/mercadopago', { token: owner, method: 'DELETE' })).body.disconnected, true);
      } finally {
        exchange.mock.restore();
        for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
        await db.run(`DELETE FROM ngo_cuentas_mp`);
      }
    });
  });

  // §282: la foto del voluntariado. Multipart, así que va aparte del helper JSON; Cloudinary es un doble.
  describe('foto del voluntariado (§282)', () => {
    test('otra ONG no puede cambiar la foto de proj-1 (404, sin subir nada, la base igual); la dueña sí', async () => {
      const storage = require('../../src/lib/storage');
      const uploads = [];
      const mocks = [
        mock.method(storage, 'isConfigured', () => true),
        mock.method(storage, 'uploadImage', async () => { uploads.push(1); return { url: 'https://res.cloudinary.com/demo/image/upload/v1/x.jpg', publicId: 'test/x' }; }),
        mock.method(storage, 'deleteImage', async () => true),
      ];
      try {
        const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]), Buffer.alloc(100, 1)]);
        const put = (token) => {
          const form = new FormData();
          form.append('photo', new Blob([jpeg], { type: 'image/jpeg' }), 'f.jpg');
          return fetch(`${baseUrl}/api/projects/proj-1/photo`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form });
        };
        const photo = () => db.get(`SELECT foto_perfil, foto_provider_id FROM projects WHERE id='proj-1'`);
        const before_ = await photo();
        assert.equal((await put(other)).status, 404);
        assert.equal(uploads.length, 0);
        assert.deepEqual(await photo(), before_);
        assert.equal((await put(owner)).status, 200);
        assert.equal((await photo()).foto_provider_id, 'test/x');
      } finally {
        for (const m of mocks) m.mock.restore();
      }
    });
  });

  describe('equipo de la ONG (§294–§295)', () => {
    test('otra ONG no cambia el rol ni saca a un miembro ajeno, ni ve su equipo; la dueña sí', async () => {
      // user-vol-3 (Lucía) es coordinadora activa de ngo-1.
      await db.run(`INSERT INTO ngo_miembros (id, ngo_id, user_id, rol, estado) VALUES ('mbr-own-1','ngo-1','user-vol-3','coordinador','activo')`);
      const row = () => db.get(`SELECT rol, estado FROM ngo_miembros WHERE id='mbr-own-1'`);
      assert.equal((await api('/api/equipo/miembros/user-vol-3', { token: other, method: 'PATCH', body: { role: 'communicator' } })).status, 404);
      assert.equal((await api('/api/equipo/miembros/user-vol-3', { token: other, method: 'DELETE' })).status, 404);
      const list = await api('/api/equipo/miembros', { token: other });
      assert.ok(!list.body.members.some((m) => m.user_id === 'user-vol-3'), 'la otra ONG no ve el equipo ajeno');
      assert.deepEqual(await row(), { rol: 'coordinador', estado: 'activo' });
      assert.equal((await api('/api/equipo/miembros/user-vol-3', { token: owner, method: 'PATCH', body: { role: 'communicator' } })).status, 200);
      assert.equal((await row()).rol, 'comunicador');
      assert.equal((await api('/api/equipo/miembros/user-vol-3', { token: owner, method: 'DELETE' })).status, 200);
      assert.equal(await row(), undefined);
    });
  });

  // Control: con los MISMOS ids, la dueña sí puede. Va después de los rechazos porque modifica los datos.
  describe('la ONG dueña SÍ puede (mismos ids)', () => {
    test('ver inscripciones, cargar horas y aprobar', async () => {
      const list = await api('/api/enrollments/project/proj-1', { token: owner });
      assert.equal(list.status, 200);
      assert.ok(list.body.enrollments.some((e) => e.id === pendingId));

      const h = await api(`/api/enrollments/${approvedId}/horas`, { token: owner, method: 'PATCH', body: { horas: 7 } });
      assert.equal(h.status, 200);
      assert.equal(Number((await enrollment(approvedId)).horas_realizadas), 7);

      const a = await api(`/api/enrollments/${pendingId}`, { token: owner, method: 'PATCH', body: { status: 'approved' } });
      assert.equal(a.status, 200);
      assert.equal((await enrollment(pendingId)).status, 'approved');
    });

    test('editar el KPI y decidir el patrocinio', async () => {
      const u = await api(`/api/projects/proj-1/kpis/${kpiId}`, { token: owner, method: 'PUT', body: { nombre: 'Árboles', valor: 12 } });
      assert.equal(u.status, 200);
      assert.deepEqual(await kpi(kpiId), { nombre: 'Árboles', valor: 12 });

      const list = await api('/api/ngos/me/patrocinios', { token: owner });
      assert.ok(JSON.stringify(list.body).includes('proj-1'));
      const r = await api(`/api/ngos/me/patrocinios/${empresaId}/proj-1`, {
        token: owner, method: 'PATCH', body: { estado: 'aceptado' },
      });
      assert.equal(r.status, 200);
      assert.equal((await patrocinio()).estado, 'aceptado');
    });

    test('ver su dashboard y sus empleados, editar y borrar su proyecto', async () => {
      assert.equal((await api('/api/ngos/ngo-1/dashboard', { token: owner })).status, 200);
      assert.equal((await api('/api/ngos/ngo-1/empleados', { token: owner })).status, 200);

      const before = await project1();
      const put = await api('/api/projects/proj-1', {
        token: owner, method: 'PUT',
        // description válida: desde §95 el PUT valida como el alta (antes aceptaba 'x').
        body: { title: 'Reforestación Urbana 2', description: 'Plantamos árboles nativos en la ciudad', location: 'Córdoba', type: 'fugaz', status: 'active' },
      });
      assert.equal(put.status, 200);
      assert.equal((await project1()).titulo, 'Reforestación Urbana 2');
      assert.equal((await project1()).cupos, before.cupos);

      const del = await api(`/api/projects/proj-1/kpis/${kpiId}`, { token: owner, method: 'DELETE' });
      assert.equal(del.status, 200);
      assert.equal(await kpi(kpiId), undefined);

      const d = await api('/api/projects/proj-1', { token: owner, method: 'DELETE' });
      assert.equal(d.status, 200);
      assert.equal(await project1(), undefined);
    });
  });
});
