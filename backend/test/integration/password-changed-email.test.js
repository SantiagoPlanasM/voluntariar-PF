// test/integration/password-changed-email.test.js — aviso por email cuando la contraseña cambia (§278).
//
// Criterio: después de cambiarla con éxito, desde Configuración (PUT /api/auth/me/password) o con el link de
// recuperación (POST /api/auth/reset-password), le llega a la persona un email "tu contraseña cambió" que nunca trae la
// contraseña y le dice qué hacer si no fue ella (recuperarla desde el login). Si el cambio falla, no hay email. El email
// sale DESPUÉS de responder: si falla o tira un error, el cambio igual respondió 200.
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Aviso por email cuando cambia la contraseña', () => {
  let server, baseUrl, email, sent, sendImpl, savedKey;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    email = require('../../src/lib/email');
    mock.method(email, 'sendEmail', async (msg) => sendImpl(msg));
    savedKey = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = 're_test_no_se_usa';
  });
  after(async () => {
    mock.restoreAll();
    if (savedKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = savedKey;
    if (server) await server.close();
  });
  beforeEach(() => { sent = []; sendImpl = async (msg) => { sent.push(msg); return { ok: true }; }; });

  const call = (path, { token, method = 'POST', body } = {}) => fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const register = async (name, mail) => {
    const r = await call('/api/auth/register', { body: { name, email: mail, password: 'Password1', role: 'volunteer' } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.token;
  };
  const change = (token, current_password, new_password) =>
    call('/api/auth/me/password', { token, method: 'PUT', body: { current_password, new_password } });
  const waitFor = async (pred, ms = 2000) => {
    const end = Date.now() + ms;
    while (!pred() && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
  };
  const settle = () => new Promise((r) => setTimeout(r, 150));
  const notices = () => sent.filter((m) => /tu contraseña .*cambió/i.test(m.subject));

  test('desde Configuración: le avisa a la persona, sin la contraseña y con qué hacer si no fue ella', async () => {
    const token = await register('Aviso Uno', 'aviso-uno@example.com');
    const r = await change(token, 'Password1', 'NuevaClave1');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    await waitFor(() => notices().length === 1);
    const [msg] = notices();
    assert.ok(msg, 'llegó el aviso');
    assert.equal(msg.to, 'aviso-uno@example.com');
    assert.ok(!msg.html.includes('NuevaClave1') && !msg.html.includes('Password1'), 'el email no trae ninguna contraseña');
    assert.match(msg.html, /si no fuiste vos/i);
    assert.match(msg.html, /¿Olvidaste tu contraseña\?/);
    assert.match(msg.html, /href="http:\/\/localhost:5173\/?"/);
  });

  test('si el cambio falla (la actual equivocada o una nueva que no cumple), no hay aviso', async () => {
    const token = await register('Aviso Dos', 'aviso-dos@example.com');
    assert.equal((await change(token, 'Equivocada1', 'NuevaClave2')).status, 400);
    assert.equal((await change(token, 'Password1', 'corta')).status, 400);
    await settle();
    assert.equal(notices().length, 0);
  });

  test('con el link de recuperación: también avisa, y un link inválido no', async () => {
    await register('Aviso Tres', 'aviso-tres@example.com');
    assert.equal((await call('/api/auth/forgot-password', { body: { email: 'aviso-tres@example.com' } })).status, 200);
    await waitFor(() => sent.length === 1);
    const token = /\/restablecer\?token=([A-Za-z0-9_-]+)/.exec(sent[0].html)[1];
    assert.equal((await call('/api/auth/reset-password', { body: { token: 'x'.repeat(43), new_password: 'NuevaClave3' } })).status, 400);
    await settle();
    assert.equal(notices().length, 0, 'un link inválido no avisa');
    assert.equal((await call('/api/auth/reset-password', { body: { token, new_password: 'NuevaClave3' } })).status, 200);
    await waitFor(() => notices().length === 1);
    assert.equal(notices()[0]?.to, 'aviso-tres@example.com');
  });

  // Los pedidos que pierden la carrera por el mismo link no avisan (en Postgres llegan hasta el compare-and-swap).
  test('cinco pedidos a la vez con el mismo link: un solo aviso', async () => {
    await register('Aviso Cinco', 'aviso-cinco@example.com');
    await call('/api/auth/forgot-password', { body: { email: 'aviso-cinco@example.com' } });
    await waitFor(() => sent.length === 1);
    const token = /\/restablecer\?token=([A-Za-z0-9_-]+)/.exec(sent[0].html)[1];
    const results = await Promise.all([1, 2, 3, 4, 5].map((i) =>
      call('/api/auth/reset-password', { body: { token, new_password: `Paralela${i}` } })));
    assert.equal(results.filter((r) => r.status === 200).length, 1);
    await waitFor(() => notices().length >= 1);
    await settle();
    assert.deepEqual(notices().map((m) => m.to), ['aviso-cinco@example.com']);
  });

  test('si el email falla o tira un error, el cambio igual responde 200', async () => {
    const token = await register('Aviso Cuatro', 'aviso-cuatro@example.com');
    sendImpl = async () => { throw new Error('Resend caído'); };
    const r = await change(token, 'Password1', 'NuevaClave4');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    await settle();
    const login = await call('/api/auth/login', { body: { email: 'aviso-cuatro@example.com', password: 'NuevaClave4' } });
    assert.equal(login.status, 200);
  });
});
