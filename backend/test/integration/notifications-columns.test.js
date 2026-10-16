// test/integration/notifications-columns.test.js
//
// §159 (regla 8): GET /api/notifications armaba la lista con `SELECT *`: una columna nueva de `notifications`
// salía sola. Ahora es una lista explícita con las mismas columnas de hoy (la forma no cambia). Como en
// auth-me-profile.test.js: se agrega una columna con un valor centinela y se verifica que no salga.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { setupTestServer } = require('./helpers');

const SENTINEL = 'SECRETO-159-NO-DEBE-SALIR';
// Las columnas de `notifications` en migrate.js (las que devolvía el `SELECT *`), ordenadas.
const EXPECTED = ['body', 'created_at', 'data', 'id', 'read', 'title', 'type', 'user_id'];

describe('GET /api/notifications: lista blanca de columnas (regla 8)', () => {
  let server, db, token, id;

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
    const r = await fetch(`${server.baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maria@example.com', password: 'Password1' }),
    });
    token = (await r.json()).token;
    assert.ok(token, 'login de María');
    await db.run(`ALTER TABLE notifications ADD COLUMN secreto_159 TEXT DEFAULT '${SENTINEL}'`);
    id = crypto.randomUUID();
    await db.run(
      `INSERT INTO notifications (id, user_id, type, title, body, read) VALUES ($1,$2,$3,$4,$5,false)`,
      [id, 'user-vol-1', 'new_project', 'Aviso', 'Cuerpo']);
  });
  after(async () => { if (server) await server.close(); });

  const list = () => fetch(`${server.baseUrl}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } })
    .then(async (r) => ({ status: r.status, text: await r.text() }));

  test('no sale una columna nueva de la tabla', async () => {
    const { status, text } = await list();
    assert.equal(status, 200);
    assert.ok(!text.includes(SENTINEL) && !text.includes('secreto_159'), 'devuelve columnas no elegidas');
  });

  test('cada notificación conserva exactamente las claves de antes, con sus valores', async () => {
    const body = JSON.parse((await list()).text);
    assert.equal(body.notifications.length, 1);
    const n = body.notifications[0];
    assert.deepEqual(Object.keys(n).sort(), EXPECTED);
    assert.equal(n.id, id);
    assert.equal(n.user_id, 'user-vol-1');
    assert.equal(n.type, 'new_project');
    assert.equal(n.title, 'Aviso');
    assert.equal(n.body, 'Cuerpo');
    assert.ok(!n.read, 'no leída');
    assert.equal(body.unread, 1);
  });
});
