// test/integration/messages-conversations.test.js
//
// GET /api/messages/conversations con 2 o más conversaciones.
//
// Regresión de un bug que SOLO se manifestaba en Postgres y solo con 2+
// conversaciones: el orden se calculaba con `last_at.localeCompare(...)`, pero
// en Postgres `created_at` llega como objeto Date (no string) y Date no tiene
// localeCompare. Con 0 o 1 conversación el comparador de .sort() nunca se
// ejecuta, así que el bug pasaba desapercibido (y devolvía 500 en producción).
// Ver PROJECT_ANALYSIS.md §35.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('GET /api/messages/conversations', () => {
  let server, baseUrl, maria, juan, lucia;

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

  const send = async (from, to, body) => {
    const r = await call('/api/messages', { token: from.token, method: 'POST', body: { to: to.id, body } });
    assert.equal(r.status, 201, `enviar "${body}"`);
  };

  const conversations = async (who) => {
    const r = await call('/api/messages/conversations', { token: who.token });
    assert.equal(r.status, 200, 'GET /conversations no debe fallar');
    return r.body.conversations;
  };

  // Sesiones para los tests: es preparación, no un test (REVISION T4; antes era un test('setup') sin asserts).
  before(async () => {
    maria = await login('maria@example.com');
    juan = await login('juan@example.com');
    lucia = await login('lucia@example.com');
  });

  test('sin conversaciones: lista vacía', async () => {
    assert.deepEqual(await conversations(maria), []);
  });

  test('una sola conversación funciona (el comparador del sort ni siquiera se ejecuta)', async () => {
    await send(maria, juan, 'hola juan');
    const list = await conversations(maria);
    assert.equal(list.length, 1);
    assert.equal(list[0].user.id, juan.id);
  });

  test('DOS conversaciones: responde 200 y ordena por actividad más reciente primero', async () => {
    // Pausas de 1.1 s: SQLite guarda created_at con resolución de segundos, y sin
    // ellas los tres mensajes tendrían el mismo timestamp y el orden no sería testeable.
    await sleep(1100);
    await send(maria, lucia, 'hola lucia');
    await sleep(1100);
    await send(maria, juan, 'juan, otra vez');   // reactiva la conversación más vieja

    const list = await conversations(maria);
    assert.equal(list.length, 2);
    assert.deepEqual(list.map((c) => c.user.id), [juan.id, lucia.id],
      'juan (último mensaje más nuevo) debe ir primero, aunque su conversación empezó antes');
    assert.equal(list[0].last_message, 'juan, otra vez');
  });

  test('el receptor también ve sus conversaciones ordenadas y con no leídos', async () => {
    const list = await conversations(juan);
    assert.equal(list.length, 1);
    assert.equal(list[0].user.id, maria.id);
    assert.equal(list[0].unread, 2);
  });
});
