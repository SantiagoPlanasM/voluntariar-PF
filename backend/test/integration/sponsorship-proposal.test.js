// test/integration/sponsorship-proposal.test.js
//
// REVISION A6 (tercera pasada): `POST /api/empresas/me/patrocinios` hacía SELECT ("¿ya hay propuesta?") y
// después INSERT, sin `isUniqueViolation`. Dos propuestas simultáneas de la misma empresa al mismo proyecto
// pasaban las dos el SELECT y la segunda chocaba con la PK (empresa_id, project_id): 500 en Postgres (en SQLite
// a veces). Lo mismo al re-proponer tras un rechazo: las dos hacían el UPDATE y las dos respondían 201, con dos
// notificaciones a la ONG. Y `mensaje` no se validaba (un objeto daba 500 en SQLite).
//
// Corre en los dos motores; la carrera del INSERT se reproduce en `npm run test:pg` (pool, READ COMMITTED).
// Como en follows-sponsorship-concurrency.test.js, se verifican invariantes, no quién gana la carrera.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Propuesta de patrocinio: concurrencia y validación', () => {
  let server, db, company, empresaId;

  const call = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${server.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const propose = (body) => call('/api/empresas/me/patrocinios', { token: company, method: 'POST', body });
  const burst = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)));
  const statuses = (rs) => rs.map((r) => r.status).join(',');

  const rows = async (projectId) => db.all(
    'SELECT estado, mensaje FROM empresa_voluntariados WHERE empresa_id=$1 AND project_id=$2', [empresaId, projectId]);
  const proposalNotifs = async (projectId) => (await db.all(
    `SELECT data FROM notifications WHERE type='sponsor_proposal'`, []))
    .filter((n) => (typeof n.data === 'string' ? JSON.parse(n.data) : n.data)?.project_id === projectId).length;

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
    const l = await call('/api/auth/login', { method: 'POST', body: { email: 'admin@techcorp.com', password: 'Password1' } });
    assert.equal(l.status, 200);
    company = l.body.token;
    empresaId = (await db.get(`SELECT id FROM empresas WHERE user_id='user-comp-1'`)).id;
  });
  after(async () => { if (server) await server.close(); });

  describe('concurrencia', () => {
    // Cuatro proyectos, una ráfaga por proyecto: la carrera no sale en todas las corridas (en Postgres, antes del
    // arreglo, una ráfaga sola dio 500 en 4 de 5); con cuatro es muy difícil que el bug pase sin verse.
    test('8 propuestas simultáneas al mismo proyecto: una 201 y siete 409 (ningún 500), una fila y una notificación', async () => {
      for (const projectId of ['proj-2', 'proj-10', 'proj-11', 'proj-12']) {
        const rs = await burst(8, (i) => propose({ project_id: projectId, mensaje: `propuesta ${i}` }));

        assert.equal(rs.filter((r) => r.status === 201).length, 1, `${projectId}: ${statuses(rs)}`);
        assert.equal(rs.filter((r) => r.status === 409).length, 7, `${projectId}: ${statuses(rs)}`);
        for (const r of rs.filter((x) => x.status === 409))
          assert.equal(r.body.error, 'Ya existe una propuesta de patrocinio con este proyecto');
        const rr = await rows(projectId);
        assert.equal(rr.length, 1);
        assert.equal(rr[0].estado, 'propuesto');
        assert.equal(await proposalNotifs(projectId), 1, `${projectId}: la ONG recibe una sola notificación`);
      }
    });

    test('re-proponer tras un rechazo, 8 veces a la vez: una 201 y siete 409, una sola notificación nueva', async () => {
      const first = await propose({ project_id: 'proj-4', mensaje: 'primera' });
      assert.equal(first.status, 201);
      await db.run(`UPDATE empresa_voluntariados SET estado='rechazado' WHERE empresa_id=$1 AND project_id='proj-4'`, [empresaId]);
      const before = await proposalNotifs('proj-4');

      const rs = await burst(8, (i) => propose({ project_id: 'proj-4', mensaje: `segunda ${i}` }));

      assert.equal(rs.filter((r) => r.status === 201).length, 1, statuses(rs));
      assert.equal(rs.filter((r) => r.status === 409).length, 7, statuses(rs));
      const rr = await rows('proj-4');
      assert.equal(rr.length, 1);
      assert.equal(rr[0].estado, 'propuesto');
      assert.match(rr[0].mensaje, /^segunda \d$/);
      assert.equal(await proposalNotifs('proj-4'), before + 1);
    });

    test('re-proponer tras un rechazo (sin carrera) sigue andando: 201 y vuelve a "propuesto"', async () => {
      assert.equal((await propose({ project_id: 'proj-5' })).status, 201);
      await db.run(`UPDATE empresa_voluntariados SET estado='rechazado' WHERE empresa_id=$1 AND project_id='proj-5'`, [empresaId]);
      const r = await propose({ project_id: 'proj-5', mensaje: 'de nuevo' });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.deepEqual((await rows('proj-5')).map((x) => ({ ...x })), [{ estado: 'propuesto', mensaje: 'de nuevo' }]);
      assert.equal((await propose({ project_id: 'proj-5' })).status, 409, 'ya propuesto: 409');
    });
  });

  describe('validación del cuerpo', () => {
    for (const [label, mensaje] of [['un número', 5], ['un array', ['hola']], ['un objeto', { a: 1 }], ['true', true]]) {
      test(`mensaje ${label} → 400 en español y no se crea nada`, async () => {
        const r = await propose({ project_id: 'proj-6', mensaje });
        assert.equal(r.status, 400, JSON.stringify(r.body));
        assert.equal(r.body.error, 'El mensaje tiene que ser un texto');
        assert.equal((await rows('proj-6')).length, 0);
      });
    }

    test('mensaje de más de 1000 caracteres → 400 y no se crea nada', async () => {
      const r = await propose({ project_id: 'proj-6', mensaje: 'm'.repeat(1001) });
      assert.equal(r.status, 400);
      assert.equal(r.body.error, 'El mensaje puede tener hasta 1000 caracteres');
      assert.equal((await rows('proj-6')).length, 0);
    });

    for (const [label, project_id] of [['un número', 6], ['un array', ['proj-6']], ['un objeto', { id: 'proj-6' }]]) {
      test(`project_id ${label} → 400 en español`, async () => {
        const r = await propose({ project_id });
        assert.equal(r.status, 400, JSON.stringify(r.body));
        assert.equal(r.body.error, 'project_id inválido');
      });
    }

    test('sin project_id sigue siendo "project_id requerido"', async () => {
      const r = await propose({ mensaje: 'hola' });
      assert.equal(r.status, 400);
      assert.equal(r.body.error, 'project_id requerido');
    });

    test('mensaje de exactamente 1000 caracteres se guarda; null o vacío se guardan como null', async () => {
      const long = 'm'.repeat(1000);
      assert.equal((await propose({ project_id: 'proj-6', mensaje: long })).status, 201);
      assert.equal((await rows('proj-6'))[0].mensaje, long);
      assert.equal((await propose({ project_id: 'proj-8', mensaje: null })).status, 201);
      assert.equal((await rows('proj-8'))[0].mensaje, null);
      assert.equal((await propose({ project_id: 'proj-9', mensaje: '' })).status, 201);
      assert.equal((await rows('proj-9'))[0].mensaje, null);
    });
  });
});
