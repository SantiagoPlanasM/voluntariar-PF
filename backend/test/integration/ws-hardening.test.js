// test/integration/ws-hardening.test.js
//
// WebSocket del chat. REVISION B19 (§87) lo reforzó cuando aceptaba envíos (`type: 'send'`): errores internos que
// se reenviaban al cliente, JSON mal formado, `to` no string, sin maxPayload, sin límite de frecuencia. Desde §92 el
// cliente manda siempre por REST, y en §100 (decisión del usuario) el servidor dejó de aceptar envíos por el socket:
// queda SOLO para recibir. Lo que se prueba ahora:
//   - un `type: 'send'` (o cualquier otra cosa que mande el cliente) no se guarda ni se reenvía;
//   - maxPayload: un frame enorme igual cierra la conexión (1009) en vez de procesarse;
//   - REST valida los errores del usuario (los MessageInputError de §87 siguen ahí).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { setupTestServer } = require('./helpers');

describe('WebSocket del chat: solo recepción, tamaño acotado', () => {
  let server, baseUrl, db;
  let maria, juan;
  const sockets = []; // se terminan todos en after(): si una aserción falla antes del close, el server no se cuelga

  const call = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const login = async (email) => {
    const r = await call('/api/auth/login', { method: 'POST', body: { email, password: 'Password1' } });
    assert.equal(r.status, 200, `login ${email}`);
    return { token: r.body.token, id: r.body.user.id };
  };

  // Abre un socket autenticado y junta lo que el servidor le manda (y cómo se cerró, si se cierra).
  const open = (token) => new Promise((resolve, reject) => {
    const ws = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws?token=${token}`);
    const received = [];
    const state = { ws, received, closed: null };
    sockets.push(ws);
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'connected') resolve(state);
      else received.push(msg);
    });
    ws.on('close', (code) => { state.closed = code; });
    ws.on('error', (e) => { if (!state.closed) reject(e); });
  });
  const until = async (cond, ms = 3000) => {
    const t0 = Date.now();
    while (!cond()) {
      if (Date.now() - t0 > ms) throw new Error('timeout esperando al WebSocket');
      await new Promise((r) => setTimeout(r, 20));
    }
  };
  const errors = (s) => s.received.filter((m) => m.type === 'error').map((m) => m.error);
  const countMessages = async (body) => Number((await db.get('SELECT COUNT(*) AS n FROM messages WHERE body=$1', [body])).n) || 0;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    maria = await login('maria@example.com');
    juan = await login('juan@example.com');
  });
  after(async () => {
    for (const ws of sockets) ws.terminate();
    if (server) await server.close();
  });

  test('un \'send\' por el socket NO se guarda ni se le reenvía al destinatario (el envío es por REST)', async () => {
    const rx = await open(juan.token);
    const tx = await open(maria.token);
    tx.ws.send(JSON.stringify({ type: 'send', to: juan.id, body: 'por el socket' }));
    tx.ws.send('{esto no es json');
    // Un mensaje por REST después: cuando llega, el del socket ya habría llegado si se procesara.
    const r = await call('/api/messages', { token: maria.token, method: 'POST', body: { to: juan.id, body: 'por REST' } });
    assert.equal(r.status, 201);
    await until(() => rx.received.some((m) => m.type === 'message' && m.message.body === 'por REST'));
    assert.deepEqual(rx.received.filter((m) => m.type === 'message').map((m) => m.message.body), ['por REST']);
    assert.equal(await countMessages('por el socket'), 0);
    assert.deepEqual(tx.received, [], 'al que manda tampoco se le contesta nada (ni errores)');
  });

  test('REST sigue respondiendo 400 a los mismos errores del usuario (y "Destinatario inválido" también)', async () => {
    const self = await call('/api/messages', { token: maria.token, method: 'POST', body: { to: maria.id, body: 'x' } });
    assert.deepEqual([self.status, self.body.error], [400, 'No podés enviarte mensajes a vos mismo']);
    const obj = await call('/api/messages', { token: maria.token, method: 'POST', body: { to: { id: juan.id }, body: 'x' } });
    assert.deepEqual([obj.status, obj.body.error], [400, 'Destinatario inválido']);
    const none = await call('/api/messages', { token: maria.token, method: 'POST', body: { to: 'no-existe', body: 'x' } });
    assert.deepEqual([none.status, none.body.error], [400, 'Destinatario no encontrado']);
  });

  test('un mensaje de más de 64 KB cierra la conexión (1009) en vez de procesarse', async () => {
    const s = await open(maria.token);
    s.ws.send(JSON.stringify({ type: 'send', to: juan.id, body: 'x'.repeat(200 * 1024) }));
    await until(() => s.closed !== null);
    assert.equal(s.closed, 1009);
  });
});
