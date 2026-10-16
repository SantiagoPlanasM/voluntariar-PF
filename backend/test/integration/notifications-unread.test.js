// test/integration/notifications-unread.test.js
//
// §152: GET /api/notifications contaba `unread` filtrando en JS las 50 que devuelve (LIMIT 50). Con más de
// 50 sin leer el contador (el globito de la campana en Root/MainFeed/BottomNav) se quedaba en 50 o menos.
// Ahora es un COUNT(*) aparte en SQL, sobre TODAS las del usuario. La lista sigue limitada a 50.
//
// Corre en los dos motores: en Postgres COUNT llega como string (bigint) y `read` es BOOLEAN de verdad.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { setupTestServer } = require('./helpers');

describe('GET /api/notifications: contador de no leídas', () => {
  let server, db, maria;

  const call = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${server.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  // `read` va como literal SQL (true/false): SQLite no acepta booleanos de JS como parámetro.
  const insert = async (userId, n, read) => {
    for (let i = 0; i < n; i++) {
      await db.run(
        `INSERT INTO notifications (id, user_id, type, title, body, read) VALUES ($1,$2,$3,$4,$5,${read ? 'true' : 'false'})`,
        [crypto.randomUUID(), userId, 'new_project', `Aviso ${i}`, '']
      );
    }
  };
  const list = () => call('/api/notifications', { token: maria });

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
    const l = await call('/api/auth/login', { method: 'POST', body: { email: 'maria@example.com', password: 'Password1' } });
    assert.equal(l.status, 200);
    maria = l.body.token;
    // El seed no trae notificaciones: arrancamos de cero, a mano.
    assert.equal((await db.all('SELECT id FROM notifications WHERE user_id=$1', ['user-vol-1'])).length, 0);
  });
  after(async () => { if (server) await server.close(); });

  test('sin notificaciones: unread es el número 0 (no "0" ni null)', async () => {
    const r = await list();
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { notifications: [], unread: 0 });
  });

  test('pocas: cuenta solo las no leídas del usuario (no las leídas ni las de otro)', async () => {
    await insert('user-vol-1', 3, false);
    await insert('user-vol-1', 2, true);
    await insert('user-vol-2', 4, false);   // de otra persona: no cuentan
    const r = await list();
    assert.equal(r.body.notifications.length, 5);
    assert.strictEqual(r.body.unread, 3);
  });

  test('más de 50 sin leer: la lista sigue en 50 pero unread cuenta TODAS (antes quedaba en ≤50)', async () => {
    await insert('user-vol-1', 60, false);   // 3 + 60 = 63 sin leer; 2 leídas; 65 en total
    const r = await list();
    assert.equal(r.status, 200);
    assert.equal(r.body.notifications.length, 50, 'la lista conserva su LIMIT 50');
    assert.strictEqual(r.body.unread, 63);
  });

  test('marcar una como leída baja el contador en 1; "leer todas" lo deja en 0', async () => {
    const { id } = await db.get('SELECT id FROM notifications WHERE user_id=$1 AND read=false LIMIT 1', ['user-vol-1']);
    const m = await call(`/api/notifications/${id}/read`, { token: maria, method: 'PATCH' });
    assert.equal(m.status, 200);
    assert.strictEqual((await list()).body.unread, 62);

    const all = await call('/api/notifications/read-all', { token: maria, method: 'PATCH' });
    assert.equal(all.status, 200);
    assert.strictEqual((await list()).body.unread, 0);
    // La de la otra persona sigue sin leer: "leer todas" es solo de quien la pide.
    const otra = await db.all('SELECT id FROM notifications WHERE user_id=$1 AND read=false', ['user-vol-2']);
    assert.equal(otra.length, 4);
  });

  test('read NULL cuenta como no leída (igual que el filtro viejo `!n.read`)', async () => {
    await db.run(
      'INSERT INTO notifications (id, user_id, type, title, body, read) VALUES ($1,$2,$3,$4,$5,NULL)',
      [crypto.randomUUID(), 'user-vol-1', 'new_project', 'Sin estado', '']
    );
    assert.strictEqual((await list()).body.unread, 1);
  });
});
