// test/integration/notifications-push.test.js — notificaciones instantáneas por el WebSocket (§336).
//
// Hasta acá el socket solo empujaba mensajes del chat: una notificación (postulación nueva, decisión, seguidor…)
// se veía recién al cambiar de pantalla, cuando la barra volvía a pedir GET /notifications. Ahora toda notificación
// se crea en un solo lugar (lib/notify.js), que después de guardarla manda `{ type: 'notification', kind }` a las
// conexiones abiertas del destinatario. El aviso no lleva el texto ni los datos: el cliente vuelve a pedir la lista.
//   - llega solo al destinatario, y después de que la fila existe;
//   - sin conexión abierta no pasa nada (la notificación queda guardada);
//   - ningún archivo fuera de lib/notify.js inserta en `notifications` (si no, esa no avisaría).
// Seed: Sustentando (ngo-1, user-ngo-1, admin@sustentando.org), María y Juan (voluntarios).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const WebSocket = require('ws');
const { setupTestServer } = require('./helpers');

describe('Notificaciones instantáneas por el WebSocket', () => {
  let server, baseUrl, db;
  let ngo, maria, juan;
  const sockets = [];

  const call = (p, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${p}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const login = async (email) => {
    const r = await call('/api/auth/login', { method: 'POST', body: { email, password: 'Password1' } });
    assert.equal(r.status, 200, `login ${email}`);
    return { token: r.body.token, id: r.body.user.id };
  };
  const open = (token) => new Promise((resolve, reject) => {
    const ws = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws?token=${token}`);
    const received = [];
    const state = { ws, received };
    sockets.push(ws);
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'connected') resolve(state);
      else received.push(msg);
    });
    ws.on('error', reject);
  });
  const until = async (cond, ms = 3000) => {
    const t0 = Date.now();
    while (!cond()) {
      if (Date.now() - t0 > ms) throw new Error('timeout esperando al WebSocket');
      await new Promise((r) => setTimeout(r, 20));
    }
  };
  const project = async () => {
    const id = randomUUID();
    await db.run(`INSERT INTO projects (id, ngo_id, titulo, descripcion, ubicacion, cupos) VALUES ($1,'ngo-1','Con aviso','d','Córdoba',10)`, [id]);
    return id;
  };
  const count = async (userId, type) =>
    Number((await db.get('SELECT COUNT(*) AS n FROM notifications WHERE user_id=$1 AND type=$2', [userId, type])).n) || 0;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    ngo = await login('admin@sustentando.org');
    maria = await login('maria@example.com');
    juan = await login('juan@example.com');
  });
  after(async () => {
    for (const ws of sockets) ws.terminate();
    if (server) await server.close();
  });

  test('postulación nueva: la ONG recibe el aviso al instante, con la notificación ya guardada; los demás, nada', async () => {
    const p = await project();
    const ngoWs = await open(ngo.token);
    const ngoWs2 = await open(ngo.token);   // otra pestaña de la misma cuenta
    const mariaWs = await open(maria.token);
    const juanWs = await open(juan.token);
    const before = await count(ngo.id, 'new_enrollment');

    const r = await call('/api/enrollments', { token: maria.token, method: 'POST', body: { project_id: p } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    await until(() => ngoWs.received.length > 0 && ngoWs2.received.length > 0);
    // Solo el tipo: ni el texto ni los ids viajan por el socket.
    assert.deepEqual(ngoWs.received, [{ type: 'notification', kind: 'new_enrollment' }]);
    assert.deepEqual(ngoWs2.received, [{ type: 'notification', kind: 'new_enrollment' }]);
    assert.equal(await count(ngo.id, 'new_enrollment'), before + 1, 'cuando llega el aviso, la fila ya está');
    const list = await call('/api/notifications', { token: ngo.token });
    assert.equal(list.body.notifications[0].type, 'new_enrollment');
    assert.deepEqual(mariaWs.received, []);
    assert.deepEqual(juanWs.received, []);
  });

  test('decisión de la ONG: el aviso le llega al voluntario (aprobada y, en otra, rechazada)', async () => {
    const mariaWs = await open(maria.token);
    const ngoWs = await open(ngo.token);
    for (const [status, kind] of [['approved', 'enrollment_approved'], ['rejected', 'enrollment_rejected']]) {
      const p = await project();
      await call('/api/enrollments', { token: maria.token, method: 'POST', body: { project_id: p } });
      const e = await db.get('SELECT id FROM enrollments WHERE user_id=$1 AND project_id=$2', [maria.id, p]);
      mariaWs.received.length = 0;
      const r = await call(`/api/enrollments/${e.id}`, { token: ngo.token, method: 'PATCH', body: { status } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      await until(() => mariaWs.received.length > 0);
      assert.deepEqual(mariaWs.received, [{ type: 'notification', kind }]);
    }
    assert.deepEqual(ngoWs.received.map((m) => m.kind), ['new_enrollment', 'new_enrollment'], 'a la ONG, solo las postulaciones');
  });

  test('seguir a un voluntario: un aviso al seguido; repetir el pedido (ya lo sigue) no avisa de nuevo', async () => {
    const reg = await call('/api/auth/register', { method: 'POST',
      body: { name: 'Seguidora Nueva', email: `sigue-${Date.now()}@example.com`, password: 'Password1', role: 'volunteer' } });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    const juanWs = await open(juan.token);
    const before = await count(juan.id, 'new_follower');
    const r = await call(`/api/follows/volunteer/${juan.id}`, { token: reg.body.token, method: 'POST' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    await until(() => juanWs.received.length > 0);
    assert.deepEqual(juanWs.received, [{ type: 'notification', kind: 'new_follower' }]);
    assert.equal(await count(juan.id, 'new_follower'), before + 1);
    // Otra vez: el follow ya existe, no se crea otra notificación y no hay otro aviso.
    await call(`/api/follows/volunteer/${juan.id}`, { token: reg.body.token, method: 'POST' });
    await new Promise((res) => setTimeout(res, 150));
    assert.equal(await count(juan.id, 'new_follower'), before + 1);
    assert.equal(juanWs.received.length, 1);
  });

  test('sin conexión abierta: la notificación se guarda igual y el pedido responde bien', async () => {
    for (const ws of sockets) ws.terminate();
    await new Promise((res) => setTimeout(res, 100));
    const p = await project();
    const before = await count(ngo.id, 'new_enrollment');
    const r = await call('/api/enrollments', { token: juan.token, method: 'POST', body: { project_id: p } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(await count(ngo.id, 'new_enrollment'), before + 1);
  });

  test('lib/notify: si no se puede guardar, rechaza y no avisa', async () => {
    const { notify } = require('../../src/lib/notify');
    const ngoWs = await open(ngo.token);
    // user_id y title son NOT NULL: el alta falla en los dos motores. La segunda es para la ONG, que está conectada:
    // si avisara antes de guardar, le llegaría un aviso de algo que no existe.
    await assert.rejects(() => notify(null, 'new_follower', 't', 'b', {}));
    await assert.rejects(() => notify(ngo.id, 'new_follower', null, 'b', {}));
    await notify(ngo.id, 'sponsor_proposal', 'Título', 'Cuerpo', { project_id: 'x' });
    await until(() => ngoWs.received.length > 0);
    assert.deepEqual(ngoWs.received, [{ type: 'notification', kind: 'sponsor_proposal' }], 'solo el de la que sí se guardó');
    const row = await db.get(
      `SELECT type, title, body, data FROM notifications WHERE user_id=$1 AND type='sponsor_proposal' AND title='Título'`, [ngo.id]);
    assert.equal(row.body, 'Cuerpo');
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    assert.deepEqual(data, { project_id: 'x' });
  });

  test('en el código: solo lib/notify.js inserta en `notifications`', () => {
    const SRC = path.join(__dirname, '..', '..', 'src');
    const found = [];
    let seen = 0;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith('.js')) continue;
        seen += 1;
        if (/INSERT\s+INTO\s+notifications/i.test(fs.readFileSync(full, 'utf8'))) found.push(path.relative(SRC, full).split(path.sep).join('/'));
      }
    };
    walk(SRC);
    assert.ok(seen > 30, `leyó ${seen} archivos`);
    assert.deepEqual(found, ['lib/notify.js']);
  });
});
