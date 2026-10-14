// test/integration/aggregates-are-numbers.test.js
//
// En Postgres COUNT/SUM llegan como string (bigint/numeric); en SQLite como número. Los endpoints
// tienen que normalizarlos (AI_RULES regla 13, PROJECT_ANALYSIS §33). Quedaban dos sin hacerlo
// (REVISION.md B9): el perfil público de un voluntario y el total del feed de seguidos.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Agregados como números, no strings', () => {
  let server;
  let baseUrl;
  let db;
  let maria; // user-vol-1: inscripta en proj-1 (aprobada), proj-7 (aprobada) y proj-9 (pendiente)

  const api = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    const r = await api('/api/auth/login', { method: 'POST', body: { email: 'maria@example.com', password: 'Password1' } });
    maria = r.body.token;
  });

  after(async () => {
    if (server) await server.close();
  });

  test('GET /api/voluntarios/:id: stats y following_count son números con el valor correcto', async () => {
    await db.run(`UPDATE enrollments SET horas_realizadas=2.5 WHERE user_id='user-vol-1' AND project_id='proj-1'`);
    // El seed ya tiene María → Juan; se suma María → Lucía.
    const f = await api('/api/follows/volunteer/user-vol-3', { token: maria, method: 'POST' });
    assert.equal(f.status, 200);

    const r = await api('/api/voluntarios/user-vol-1');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.stats, { total_enrollments: 3, approved_enrollments: 2, total_horas: 2.5 });
    assert.equal(r.body.volunteer.following_count, 2);
  });

  test('GET /api/voluntarios/:id sin inscripciones ni seguidos: ceros numéricos', async () => {
    // En Postgres COUNT(*) = 0 llega como '0', que es truthy: `'0' || 0` seguía siendo string.
    await db.run("DELETE FROM volunteer_follows WHERE follower_id='user-vol-3'");
    await db.run("DELETE FROM enrollments WHERE user_id='user-vol-3'");
    const r = await api('/api/voluntarios/user-vol-3');
    assert.equal(r.status, 200);
    assert.equal(r.body.volunteer.following_count, 0);
    assert.deepEqual(r.body.stats, { total_enrollments: 0, approved_enrollments: 0, total_horas: 0 });
  });

  test('GET /api/follows/feed: total es un número igual a la cantidad de proyectos', async () => {
    const f = await api('/api/follows/ngo/ngo-1', { token: maria, method: 'POST' });
    assert.equal(f.status, 200);
    const r = await api('/api/follows/feed', { token: maria });
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 3); // proj-1, proj-5 y proj-7 son de ngo-1
    assert.equal(r.body.projects.length, 3);
  });
});
