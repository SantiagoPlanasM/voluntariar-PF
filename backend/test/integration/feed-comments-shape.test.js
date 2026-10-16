// test/integration/feed-comments-shape.test.js
//
// REVISION A2 (tercera pasada): los comentarios recientes de GET /api/follows/feed no traían `user_id`, y
// FeedPostCard.tsx linkea el autor a `/volunteer/${c.user_id}` → `/volunteer/undefined`. AI_RULES regla 10:
// el mismo recurso, la misma forma. Se compara comentario por comentario el feed contra GET /api/projects/:id
// (la forma de la interface AppComment de frontend/src/lib/api.ts) y se fijan los valores contra la base.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Comentarios: misma forma en el feed y en el detalle del proyecto', () => {
  let server;
  let db;
  let token;

  const call = (path, { method = 'GET', body } = {}) => fetch(`${server.baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

  // En proj-1: user-vol-1 tiene la inscripción aprobada (participó), user-vol-2 pendiente, user-vol-3 ninguna.
  // Fechas distintas para que el orden sea el mismo en los dos endpoints; 4 comentarios: el feed muestra 3.
  const COMMENTS = [
    ['com-a2-1', 'user-vol-1', 'Primero de María', '2026-01-01 10:00:00'],
    ['com-a2-2', 'user-vol-2', 'Juan opina', '2026-01-02 10:00:00'],
    ['com-a2-3', 'user-vol-3', 'Lucía pregunta', '2026-01-03 10:00:00'],
    ['com-a2-4', 'user-vol-1', 'Segundo de María', '2026-01-04 10:00:00'],
  ];

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
    for (const [id, userId, comment, createdAt] of COMMENTS) {
      await db.run('INSERT INTO comments (id, project_id, user_id, comment, created_at) VALUES ($1, $2, $3, $4, $5)',
        [id, 'proj-1', userId, comment, createdAt]);
    }
    const login = await call('/api/auth/login', { method: 'POST', body: { email: 'lucia@example.com', password: 'Password1' } });
    assert.equal(login.status, 200);
    token = login.body.token;
    const follow = await call('/api/follows/project/proj-1', { method: 'POST' });
    assert.equal(follow.status, 200);
  });
  after(async () => { if (server) await server.close(); });

  const feedProject = async () => {
    const feed = await call('/api/follows/feed');
    assert.equal(feed.status, 200);
    const p = feed.body.projects.find((x) => x.id === 'proj-1');
    assert.ok(p, 'proj-1 está en el feed');
    return p;
  };

  test('cada comentario reciente del feed tiene user_id, el de quien lo escribió', async () => {
    const recent = (await feedProject()).recent_comments;
    assert.equal(recent.length, 3);
    for (const c of recent) {
      const row = COMMENTS.find(([id]) => id === c.id);
      assert.ok(row, `comentario inesperado ${c.id}`);
      assert.equal(c.user_id, row[1], c.id);
    }
  });

  test('los comentarios del feed son iguales (campos y valores) a los primeros 3 del detalle', async () => {
    const detail = await call('/api/projects/proj-1');
    assert.equal(detail.status, 200);
    const fromDetail = detail.body.project.comments.slice(0, 3);
    const fromFeed = (await feedProject()).recent_comments;
    assert.deepEqual(fromFeed.map((c) => c.id), ['com-a2-4', 'com-a2-3', 'com-a2-2']);
    assert.deepEqual(fromFeed.map((c) => Object.keys(c).sort()), fromDetail.map((c) => Object.keys(c).sort()));
    assert.deepEqual(fromFeed, fromDetail);
  });

  // Lo de arriba solo prueba que coinciden; esto fija QUÉ devuelven (si los dos pierden un campo a la vez, el
  // frontend se rompe igual). Campos de AppComment + project_id.
  test('campos y valores, tomados de la base (participó solo quien tiene la inscripción aprobada)', async () => {
    const { toMillis } = require('../../src/lib/time');
    const users = Object.fromEntries((await db.all(
      `SELECT id, name, avatar FROM users WHERE id IN ('user-vol-1', 'user-vol-2', 'user-vol-3')`)).map((u) => [u.id, u]));
    const recent = (await feedProject()).recent_comments;
    for (const c of recent) {
      const [id, userId, comment, createdAt] = COMMENTS.find(([cid]) => cid === c.id);
      assert.deepEqual(Object.keys(c).sort(),
        ['comment', 'created_at', 'id', 'is_participant', 'project_id', 'user_avatar', 'user_id', 'user_name'], id);
      assert.equal(c.project_id, 'proj-1', id);
      assert.equal(c.user_id, userId, id);
      assert.equal(c.user_name, users[userId].name, id);
      assert.equal(c.user_avatar, users[userId].avatar, id);
      assert.equal(c.comment, comment, id);
      assert.equal(toMillis(c.created_at), toMillis(createdAt), id);
      assert.equal(Boolean(c.is_participant), userId === 'user-vol-1', `${id}: is_participant`);
    }
    assert.equal((await feedProject()).comments_count, COMMENTS.length);
  });
});
