// test/integration/feed-ratings-shape.test.js
//
// REVISION, "Pendientes que surgieron al arreglarlos" (§112): el tipo `Rating` de frontend/src/lib/api.ts declara
// `user_id` obligatorio, pero las reseñas de GET /api/follows/feed no lo traían (sí GET /api/projects/:id).
// AI_RULES regla 10: dos endpoints que devuelven el mismo recurso tienen que devolver la misma forma.
// Acá se compara, reseña por reseña, el feed contra el detalle del mismo proyecto.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Reseñas: misma forma en el feed y en el detalle del proyecto', () => {
  let server;
  let token;

  const call = (path, { method = 'GET', body } = {}) => fetch(`${server.baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

  before(async () => {
    server = await setupTestServer({ seed: true });
    const login = await call('/api/auth/login', { method: 'POST', body: { email: 'lucia@example.com', password: 'Password1' } });
    assert.equal(login.status, 200);
    token = login.body.token;
    // Seguir proj-1 (tiene reseñas en el seed) para que aparezca en el feed.
    const follow = await call('/api/follows/project/proj-1', { method: 'POST' });
    assert.equal(follow.status, 200);
  });
  after(async () => { if (server) await server.close(); });

  const byId = (list) => [...list].sort((a, b) => (a.id < b.id ? -1 : 1));

  test('cada reseña del feed tiene exactamente los mismos campos y valores que en GET /projects/:id', async () => {
    const detail = await call('/api/projects/proj-1');
    assert.equal(detail.status, 200);
    const feed = await call('/api/follows/feed');
    assert.equal(feed.status, 200);
    const inFeed = feed.body.projects.find((p) => p.id === 'proj-1');
    assert.ok(inFeed, 'proj-1 está en el feed');

    const fromDetail = byId(detail.body.project.ratings);
    const fromFeed = byId(inFeed.ratings);
    assert.ok(fromDetail.length > 0, 'el seed tiene reseñas en proj-1');
    assert.deepEqual(fromFeed.map((r) => Object.keys(r).sort()), fromDetail.map((r) => Object.keys(r).sort()));
    assert.deepEqual(fromFeed, fromDetail);
  });

  // Lo de arriba solo prueba que las dos coinciden; esto fija QUÉ devuelven (si las dos pierden un campo a la vez,
  // el frontend se rompe igual). Campos de la interface Rating de api.ts + project_id (el feed agrupa por él).
  test('campos y valores de cada reseña: los de la interface Rating, tomados de la base', async () => {
    const db = require('../../src/db');
    const { toMillis } = require('../../src/lib/time');
    const rows = await db.all(
      `SELECT r.id, r.user_id, r.rating, r.comment, r.created_at, u.name
       FROM ratings r JOIN users u ON u.id = r.user_id WHERE r.project_id = 'proj-1'`
    );
    assert.ok(rows.length > 0);
    const detail = (await call('/api/projects/proj-1')).body.project.ratings;
    const feed = (await call('/api/follows/feed')).body.projects.find((p) => p.id === 'proj-1').ratings;
    for (const [label, list] of [['detalle', detail], ['feed', feed]]) {
      assert.equal(list.length, rows.length, label);
      for (const row of rows) {
        const r = list.find((x) => x.id === row.id);
        assert.ok(r, `${label}: falta la reseña ${row.id}`);
        assert.deepEqual(Object.keys(r).sort(),
          ['comment', 'created_at', 'id', 'project_id', 'rating', 'user_id', 'user_name'], label);
        assert.equal(r.project_id, 'proj-1', label);
        assert.equal(r.user_id, row.user_id, label);
        assert.equal(r.user_name, row.name, label);
        assert.equal(r.rating, row.rating, label);
        assert.equal(r.comment, row.comment, label);
        assert.equal(toMillis(r.created_at), toMillis(row.created_at), label);
      }
    }
  });

  test('las reseñas del feed traen user_id (el tipo Rating lo declara obligatorio)', async () => {
    const feed = await call('/api/follows/feed');
    const inFeed = feed.body.projects.find((p) => p.id === 'proj-1');
    for (const r of inFeed.ratings) {
      assert.equal(typeof r.user_id, 'string');
      assert.ok(r.user_id.length > 0);
    }
  });
});
