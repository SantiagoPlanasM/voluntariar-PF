// test/integration/ws-hardening.test.js
//
// REVISION B19 (sin la parte de JWT_SECRET, pendiente de decisión): el listener de mensajes del WebSocket
//   - reenviaba al cliente el `err.message` de CUALQUIER error, incluidos los internos (de la base) y el de un
//     JSON mal formado ("Unexpected token…", en inglés técnico; AI_RULES regla 19);
//   - no validaba que `to` fuera un string (un objeto llegaba directo a la consulta);
//   - no tenía `maxPayload` (el default de la librería `ws` es 100 MiB por mensaje);
//   - no limitaba la frecuencia: se podían mandar mensajes sin tope.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { setupTestServer } = require('./helpers');

describe('WebSocket del chat: errores, tamaño y frecuencia', () => {
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

  test('un error interno (de la base) NO se reenvía: mensaje genérico en español', async () => {
    const s = await open(maria.token);
    const origRun = db.run;
    db.run = (sql, params) => /INSERT INTO messages/.test(sql)
      ? Promise.reject(new Error('SQLITE_IOERR: disk I/O error en /var/data/voluntariar.sqlite'))
      : origRun(sql, params);
    try {
      s.ws.send(JSON.stringify({ type: 'send', to: juan.id, body: 'hola' }));
      await until(() => errors(s).length === 1);
    } finally {
      db.run = origRun;
      s.ws.close();
    }
    assert.deepEqual(errors(s), ['Error al enviar el mensaje']);
  });

  test('JSON mal formado: error en español, sin el detalle técnico', async () => {
    const s = await open(maria.token);
    s.ws.send('{esto no es json');
    await until(() => errors(s).length === 1);
    s.ws.close();
    assert.deepEqual(errors(s), ['Mensaje inválido']);
  });

  test('`to` que no es un string: error claro, sin tocar la base con un objeto', async () => {
    const s = await open(maria.token);
    s.ws.send(JSON.stringify({ type: 'send', to: { id: juan.id }, body: 'objeto' }));
    await until(() => errors(s).length === 1);
    s.ws.close();
    assert.deepEqual(errors(s), ['Destinatario inválido']);
    assert.equal(await countMessages('objeto'), 0);
  });

  test('los errores del usuario se siguen informando tal cual (p. ej. mandarse un mensaje a sí mismo)', async () => {
    const s = await open(maria.token);
    s.ws.send(JSON.stringify({ type: 'send', to: maria.id, body: 'a mí' }));
    await until(() => errors(s).length === 1);
    s.ws.close();
    assert.deepEqual(errors(s), ['No podés enviarte mensajes a vos mismo']);
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

  test('frecuencia: de 30 mensajes seguidos se guardan 20 y al resto se le avisa', async () => {
    // La ráfaga la manda Juan: los tests de arriba ya mandaron mensajes de María, y cuentan para su límite.
    const s = await open(juan.token);
    for (let i = 0; i < 30; i++) s.ws.send(JSON.stringify({ type: 'send', to: maria.id, body: 'ráfaga' }));
    await until(() => s.received.length >= 30); // al remitente le llega el eco de cada guardado + cada aviso
    s.ws.close();
    assert.equal(await countMessages('ráfaga'), 20);
    const limited = errors(s).filter((e) => e === 'Estás enviando mensajes muy rápido. Esperá unos segundos.');
    assert.equal(limited.length, 10);
  });
});
