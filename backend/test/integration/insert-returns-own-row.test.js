// test/integration/insert-returns-own-row.test.js
//
// Mensajes, comentarios y KPIs devuelven la fila que ACABAN de insertar.
//
// Mismo bug que POST /api/projects y POST /api/ngos/:id/empleados (PROJECT_ANALYSIS.md §40): después
// del INSERT se releía "la última fila del remitente/usuario/proyecto" con
// ORDER BY created_at DESC LIMIT 1. En SQLite created_at tiene resolución de 1 segundo, así que dos
// altas dentro del mismo segundo empatan y la consulta devuelve la MÁS VIEJA.
//
// En el chat es lo más visible: POST /api/messages le empuja `saved` al destinatario por WebSocket,
// o sea que el receptor veía el mensaje anterior repetido y nunca el nuevo.
//
// En Postgres (timestamps con microsegundos) el empate casi no ocurre, así que estos tests pasan
// ahí con o sin el arreglo; el rojo se ve en SQLite (que es donde se desarrolla y se testea).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Las altas devuelven su propia fila (mensajes, comentarios, KPIs)', () => {
  let server, baseUrl, maria, juan, ngo1;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
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
    return { token: r.body.token, id: r.body.user.id };
  };

  test('setup', async () => {
    maria = await login('maria@example.com');
    juan = await login('juan@example.com');
    ngo1 = await login('admin@sustentando.org');
  });

  describe('mensajes del chat', () => {
    test('tres mensajes seguidos (mismo segundo): cada respuesta es el suyo', async () => {
      const bodies = ['uno', 'dos', 'tres'];
      const saved = [];
      for (const body of bodies) {           // secuencial y sin pausas
        const r = await call('/api/messages', { token: maria.token, method: 'POST', body: { to: juan.id, body } });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        saved.push(r.body.message);
      }
      bodies.forEach((b, i) => assert.equal(saved[i].body, b, `el mensaje ${i + 1} devolvió el contenido equivocado`));
      assert.equal(new Set(saved.map((m) => m.id)).size, 3, 'ids distintos');
    });

    test('insertMessage (lo usan el endpoint REST Y el WebSocket) con 5 envíos simultáneos: cada uno devuelve el suyo', async () => {
      const { insertMessage } = require('../../src/routes/messages');
      const bodies = ['a', 'b', 'c', 'd', 'e'];
      const saved = await Promise.all(bodies.map((b) => insertMessage(maria.id, juan.id, b)));
      saved.forEach((m, i) => assert.equal(m.body, bodies[i]));
      assert.equal(new Set(saved.map((m) => m.id)).size, 5);
      assert.ok(saved.every((m) => m.sender_name), 'sigue trayendo los datos del remitente (JOIN con users)');
    });

    test('los mensajes quedaron todos en la conversación, sin duplicar ni perder', async () => {
      const r = await call(`/api/messages/thread/${juan.id}`, { token: maria.token });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const texts = r.body.messages.map((m) => m.body);
      assert.equal(texts.length, 8, `deben ser exactamente 8 mensajes, hay ${texts.length}: ${texts}`);
      for (const b of ['uno', 'dos', 'tres', 'a', 'b', 'c', 'd', 'e']) {
        assert.equal(texts.filter((t) => t === b).length, 1, `"${b}" debe aparecer exactamente una vez`);
      }
    });
  });

  describe('chat en tiempo real (WebSocket de punta a punta)', () => {
    const WebSocket = require('ws');

    // Abre un socket autenticado y junta todo lo que el servidor le empuja.
    const openSocket = (token) => new Promise((resolve, reject) => {
      const ws = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws?token=${token}`);
      const received = [];
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'connected') resolve({ ws, received });
        else received.push(msg);
      });
      ws.on('error', reject);
    });
    const until = async (cond, ms = 3000) => {
      const t0 = Date.now();
      while (!cond()) {
        if (Date.now() - t0 > ms) throw new Error('timeout esperando mensajes por WebSocket');
        await new Promise((r) => setTimeout(r, 25));
      }
    };

    test('el destinatario conectado recibe CADA mensaje enviado por REST, no el anterior repetido', async () => {
      const rx = await openSocket(juan.token);
      const bodies = ['rt-uno', 'rt-dos', 'rt-tres'];
      for (const body of bodies) {
        const r = await call('/api/messages', { token: maria.token, method: 'POST', body: { to: juan.id, body } });
        assert.equal(r.status, 201);
      }
      await until(() => rx.received.length >= 3);
      rx.ws.close();
      assert.deepEqual(rx.received.map((m) => m.message.body), bodies,
        'el destinatario debe ver los tres mensajes distintos, en orden');
    });

    test('mensajes enviados POR el WebSocket: el destinatario y el eco al remitente reciben cada uno el suyo', async () => {
      const rx = await openSocket(juan.token);
      const tx = await openSocket(maria.token);
      const bodies = ['ws-uno', 'ws-dos', 'ws-tres'];
      for (const body of bodies) tx.ws.send(JSON.stringify({ type: 'send', to: juan.id, body }));
      await until(() => rx.received.length >= 3 && tx.received.length >= 3);
      rx.ws.close(); tx.ws.close();
      assert.deepEqual(rx.received.map((m) => m.message.body).sort(), [...bodies].sort(), 'destinatario');
      assert.deepEqual(tx.received.map((m) => m.message.body).sort(), [...bodies].sort(), 'eco al remitente');
    });
  });

  describe('comentarios', () => {
    test('tres comentarios seguidos del mismo usuario al mismo proyecto: cada respuesta es el suyo', async () => {
      const texts = ['Primer comentario', 'Segundo comentario', 'Tercer comentario'];
      const saved = [];
      for (const comment of texts) {
        const r = await call('/api/projects/proj-1/comments', { token: maria.token, method: 'POST', body: { comment } });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        saved.push(r.body.comment);
      }
      texts.forEach((t, i) => assert.equal(saved[i].comment, t, `el comentario ${i + 1} devolvió el texto equivocado`));
      assert.equal(new Set(saved.map((c) => c.id)).size, 3);
      assert.ok(saved.every((c) => c.user_name !== undefined), 'conserva los campos del JOIN (user_name, is_participant)');
    });
  });

  describe('KPIs', () => {
    test('tres KPIs seguidos en el mismo proyecto: cada respuesta es el suyo', async () => {
      const names = ['KPI uno', 'KPI dos', 'KPI tres'];
      const saved = [];
      for (const [i, nombre] of names.entries()) {
        const r = await call('/api/projects/proj-1/kpis', { token: ngo1.token, method: 'POST', body: { nombre, valor: i + 1 } });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        saved.push(r.body.kpi);
      }
      names.forEach((n, i) => {
        assert.equal(saved[i].nombre, n, `el KPI ${i + 1} devolvió el nombre equivocado`);
        assert.equal(Number(saved[i].valor), i + 1);
      });
      assert.equal(new Set(saved.map((k) => k.id)).size, 3);
    });
  });
});
