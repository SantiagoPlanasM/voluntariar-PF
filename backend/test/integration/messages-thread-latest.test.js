// test/integration/messages-thread-latest.test.js
//
// GET /api/messages/thread/:userId tiene que devolver los ÚLTIMOS 300 mensajes en orden cronológico
// (así lo dicen el comentario de la ruta y API_CONTEXT). Hacía `ORDER BY created_at ASC LIMIT 300`:
// los 300 MÁS VIEJOS, así que en una conversación larga nunca se veían los nuevos (REVISION.md B4).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setupTestServer } = require('./helpers');

describe('Chat: el historial trae los últimos 300 mensajes', () => {
  let server;
  let baseUrl;
  let db;
  let maria;

  const thread = async (otherId) => {
    const r = await fetch(`${baseUrl}/api/messages/thread/${otherId}`, {
      headers: { Authorization: `Bearer ${maria}` },
    });
    assert.equal(r.status, 200);
    return (await r.json()).messages.map((m) => m.body);
  };

  // created_at explícito, un segundo distinto por mensaje: en SQLite created_at tiene resolución de
  // 1 s y 301 mensajes mandados por la API empatarían casi todos.
  const at = (i) => new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString().replace('T', ' ').slice(0, 19);
  const insert = (from, to, body, i) =>
    db.run('INSERT INTO messages (id, sender_id, receiver_id, body, created_at) VALUES ($1,$2,$3,$4,$5)',
      [randomUUID(), from, to, body, at(i)]);

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    const r = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maria@example.com', password: 'Password1' }),
    }).then((x) => x.json());
    maria = r.token;

    // 301 mensajes alternados María ↔ Juan: m0 (el más viejo) … m300 (el más nuevo).
    for (let i = 0; i <= 300; i++) {
      const [from, to] = i % 2 ? ['user-vol-2', 'user-vol-1'] : ['user-vol-1', 'user-vol-2'];
      await insert(from, to, `m${i}`, i);
    }
    // Una conversación corta con Lucía, insertada en desorden.
    await insert('user-vol-3', 'user-vol-1', 'L2', 2);
    await insert('user-vol-1', 'user-vol-3', 'L0', 0);
    await insert('user-vol-3', 'user-vol-1', 'L1', 1);
  });

  after(async () => {
    if (server) await server.close();
  });

  test('con 301 mensajes devuelve los 300 más nuevos (m1…m300), en orden cronológico', async () => {
    const bodies = await thread('user-vol-2');
    assert.equal(bodies.length, 300);
    assert.equal(bodies[0], 'm1', 'el más viejo (m0) queda afuera');
    assert.equal(bodies[299], 'm300', 'el más nuevo está al final');
    assert.deepEqual(bodies, Array.from({ length: 300 }, (_, k) => `m${k + 1}`));
  });

  test('una conversación corta viene completa y en orden cronológico', async () => {
    assert.deepEqual(await thread('user-vol-3'), ['L0', 'L1', 'L2']);
  });
});
