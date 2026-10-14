// test/integration/follows-sponsorship-concurrency.test.js
//
// Requests CONCURRENTES sobre follows (contador `followers`) y sobre la decisión
// de un patrocinio (REVISION.md B15 y B16). Corre en los dos motores; la prueba
// que importa es `npm run test:pg` (pool de conexiones, READ COMMITTED).
//
// Como en enrollments-concurrency.test.js, cada aserción verifica un INVARIANTE
// (contador = filas reales; una sola notificación por transición real), no
// "quién ganó la carrera", que no es determinista.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Concurrencia en follows y en la decisión de patrocinio', () => {
  let server, baseUrl, db;
  let lucia, luciaId, juanId, ngo1, company, empresaId;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
  });
  after(async () => { if (server) await server.close(); });

  const call = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const login = async (email) => {
    const r = await call('/api/auth/login', { method: 'POST', body: { email, password: 'Password1' } });
    assert.equal(r.status, 200, `login ${email}`);
    return r.body;
  };

  const burst = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)));
  const statuses = (rs) => rs.map((r) => r.status).join(',');

  // Cada caso: endpoint, contador y filas de follow del par (seguidor, seguido).
  const cases = {
    ngo: {
      path: () => '/api/follows/ngo/ngo-1',
      counter: async () => Number((await db.get(`SELECT followers FROM ngos WHERE id='ngo-1'`)).followers),
      rows: async () => Number((await db.get(
        `SELECT COUNT(*) AS n FROM ngo_follows WHERE user_id=$1 AND ngo_id='ngo-1'`, [luciaId])).n),
    },
    project: {
      path: () => '/api/follows/project/proj-1',
      counter: async () => Number((await db.get(`SELECT followers FROM projects WHERE id='proj-1'`)).followers),
      rows: async () => Number((await db.get(
        `SELECT COUNT(*) AS n FROM project_follows WHERE user_id=$1 AND project_id='proj-1'`, [luciaId])).n),
    },
    volunteer: {
      path: () => `/api/follows/volunteer/${juanId}`,
      counter: async () => Number((await db.get(
        'SELECT COALESCE(followers, 0) AS f FROM voluntarios WHERE user_id=$1', [juanId])).f),
      rows: async () => Number((await db.get(
        'SELECT COUNT(*) AS n FROM volunteer_follows WHERE follower_id=$1 AND following_id=$2', [luciaId, juanId])).n),
    },
  };

  const followerNotifs = async () => Number((await db.get(
    `SELECT COUNT(*) AS n FROM notifications WHERE user_id=$1 AND type='new_follower'`, [juanId])).n);

  test('setup', async () => {
    const l = await login('lucia@example.com');
    lucia = l.token; luciaId = l.user.id;
    juanId = (await login('juan@example.com')).user.id;
    ngo1 = (await login('admin@sustentando.org')).token;
    company = (await login('admin@techcorp.com')).token;
    empresaId = (await db.get(`SELECT id FROM empresas WHERE user_id='user-comp-1'`)).id;
    for (const c of Object.values(cases)) assert.equal(await c.rows(), 0, 'lucia arranca sin seguir a nadie');
  });

  for (const [kind, c] of Object.entries(cases)) {
    describe(`follow de ${kind}`, () => {
      let base;

      test('8 "seguir" simultáneos: todos 200, una sola fila y el contador sube 1', async () => {
        base = await c.counter();
        const notifsBefore = await followerNotifs();
        const rs = await burst(8, () => call(c.path(), { token: lucia, method: 'POST' }));

        assert.ok(rs.every((r) => r.status === 200), `todas deberían ser 200: ${statuses(rs)}`);
        assert.equal(await c.rows(), 1);
        assert.equal(await c.counter(), base + 1, 'el contador sube exactamente 1');
        if (kind === 'volunteer')
          assert.equal(await followerNotifs(), notifsBefore + 1, 'una sola notificación de nuevo seguidor');
      });

      test('8 "dejar de seguir" simultáneos: todos 200, sin fila y el contador vuelve al valor original', async () => {
        const rs = await burst(8, () => call(c.path(), { token: lucia, method: 'DELETE' }));

        assert.ok(rs.every((r) => r.status === 200), `todas deberían ser 200: ${statuses(rs)}`);
        assert.equal(await c.rows(), 0);
        assert.equal(await c.counter(), base, 'baja exactamente 1, no 8');
      });

      test('seguir/dejar de seguir mezclados: el contador siempre es el original + las filas que quedaron', async () => {
        for (let round = 1; round <= 5; round++) {
          const rs = await burst(12, (i) => call(c.path(), { token: lucia, method: i % 2 === 0 ? 'POST' : 'DELETE' }));
          assert.ok(rs.every((r) => r.status === 200), `ronda ${round}: ${statuses(rs)}`);
          assert.equal(await c.counter(), base + await c.rows(), `ronda ${round}: contador desincronizado`);
        }
      });
    });
  }

  describe('decisión de patrocinio', () => {
    const estado = async (projectId) => (await db.get(
      'SELECT estado FROM empresa_voluntariados WHERE empresa_id=$1 AND project_id=$2', [empresaId, projectId])).estado;
    const decisionNotifs = async (projectId) => (await db.all(
      `SELECT type, data FROM notifications
       WHERE type IN ('sponsor_accepted','sponsor_rejected')
         AND user_id=(SELECT user_id FROM empresas WHERE id=$1)`, [empresaId]))
      .filter((n) => (typeof n.data === 'string' ? JSON.parse(n.data) : n.data)?.project_id === projectId);

    const propose = async (projectId) => {
      const p = await call('/api/empresas/me/patrocinios', {
        token: company, method: 'POST', body: { project_id: projectId, mensaje: 'Queremos sumarnos' },
      });
      assert.ok(p.status === 200 || p.status === 201, `propuesta: ${p.status}`);
      assert.equal(await estado(projectId), 'propuesto');
    };
    const decide = (projectId, e) =>
      call(`/api/ngos/me/patrocinios/${empresaId}/${projectId}`, { token: ngo1, method: 'PATCH', body: { estado: e } });

    test('aceptar y rechazar a la vez: gana una sola decisión (200), el resto 409, y una sola notificación', async () => {
      await propose('proj-1');
      const rs = await burst(8, (i) => decide('proj-1', i % 2 === 0 ? 'aceptado' : 'rechazado'));

      const ok = rs.filter((r) => r.status === 200);
      assert.equal(ok.length, 1, `exactamente una decisión real: ${statuses(rs)}`);
      assert.ok(rs.every((r) => r.status === 200 || r.status === 409), statuses(rs));

      const final = await estado('proj-1');
      assert.equal(ok[0].body.message, `Propuesta ${final}`, 'el estado guardado es el de la decisión que respondió 200');
      const notifs = await decisionNotifs('proj-1');
      assert.equal(notifs.length, 1, 'la empresa recibe una sola notificación');
      assert.equal(notifs[0].type, final === 'aceptado' ? 'sponsor_accepted' : 'sponsor_rejected');
    });

    test('la misma decisión 8 veces a la vez: una 200 y siete 409, una sola notificación', async () => {
      await propose('proj-7');
      const rs = await burst(8, () => decide('proj-7', 'aceptado'));

      assert.equal(rs.filter((r) => r.status === 200).length, 1, statuses(rs));
      assert.equal(rs.filter((r) => r.status === 409).length, 7, statuses(rs));
      assert.equal(await estado('proj-7'), 'aceptado');
      assert.equal((await decisionNotifs('proj-7')).length, 1);
    });
  });
});
