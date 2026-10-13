// test/integration/email-redirect-flow.test.js
//
// De punta a punta, con los handlers reales: con EMAIL_REDIRECT_TO activo, CADA email que dispara la
// app sale hacia la casilla de prueba y ninguno hacia los usuarios del seed (PROJECT_ANALYSIS.md §42).
//
// Los usuarios del seed tienen direcciones inventadas (admin@sustentando.org...). Con el remitente de
// pruebas de Resend, mandarles falla con 403: justo lo que EMAIL_REDIRECT_TO evita.
//
// Solo se intercepta fetch hacia api.resend.com (no se manda nada de verdad); el resto de las
// llamadas, incluidas las que este test le hace a su propio servidor, pasan al fetch real.
const { test, describe, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

const REDIRECT = 'yo@mi-casilla.com';

describe('Emails de los flujos reales con EMAIL_REDIRECT_TO', () => {
  let server, baseUrl, ngo1, lucia, company, ngoEmpresaId;
  const sent = [];
  const saved = {};

  before(async () => {
    for (const k of ['RESEND_API_KEY', 'EMAIL_REDIRECT_TO', 'EMAIL_FROM']) saved[k] = process.env[k];

    const realFetch = globalThis.fetch;
    mock.method(globalThis, 'fetch', async (url, opts) => {
      if (String(url).startsWith('https://api.resend.com')) {
        sent.push(JSON.parse(opts.body));
        return { ok: true, status: 200, text: async () => '{"id":"fake"}' };
      }
      return realFetch(url, opts);
    });

    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;

    // DESPUÉS de levantar el servidor: setupTestServer() fija RESEND_API_KEY='' a propósito para que
    // ningún test mande mails de verdad (aunque el .env de quien lo corra tenga una key real).
    // email.js lee la configuración en cada envío, así que alcanza con definirla acá.
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'VoluntariAR <onboarding@resend.dev>';   // fijo: el .env de cada máquina puede traer otro
    process.env.EMAIL_REDIRECT_TO = REDIRECT;
  });

  after(async () => {
    mock.restoreAll();
    for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    if (server) await server.close();
  });

  const call = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const login = async (email) => {
    const r = await call('/api/auth/login', { method: 'POST', body: { email, password: 'Password1' } });
    assert.equal(r.status, 200, `login ${email}`);
    return r.body.token;
  };

  // Los emails son fire-and-forget: se espera a que lleguen a la cola.
  const waitForEmails = async (n) => {
    const t0 = Date.now();
    while (sent.length < n) {
      if (Date.now() - t0 > 3000) assert.fail(`se esperaban ${n} emails y salieron ${sent.length}: ${JSON.stringify(sent.map((m) => m.subject))}`);
      await new Promise((r) => setTimeout(r, 25));
    }
  };

  test('setup', async () => {
    ngo1 = await login('admin@sustentando.org');
    lucia = await login('lucia@example.com');
    company = await login('admin@techcorp.com');
    ngoEmpresaId = (await call('/api/empresas/me', { token: company })).body.empresa.id;
  });

  test('inscripción → mail a la ONG; aprobación → mail al voluntario: los dos van a la casilla de prueba', async () => {
    const enr = await call('/api/enrollments', { token: lucia, method: 'POST', body: { project_id: 'proj-1', message: 'quiero ayudar' } });
    assert.equal(enr.status, 201, JSON.stringify(enr.body));
    await waitForEmails(1);
    assert.equal(sent[0].to, REDIRECT);
    assert.match(sent[0].subject, /^\[para: admin@sustentando\.org\] /, 'iba dirigido a la ONG');

    const ok = await call(`/api/enrollments/${enr.body.enrollment.id}`, { token: ngo1, method: 'PATCH', body: { status: 'approved' } });
    assert.equal(ok.status, 200);
    await waitForEmails(2);
    assert.equal(sent[1].to, REDIRECT);
    assert.match(sent[1].subject, /^\[para: lucia@example\.com\] /, 'iba dirigido a la voluntaria');
  });

  test('propuesta de patrocinio → mail a la ONG; respuesta → mail a la empresa: también a la casilla de prueba', async () => {
    const prop = await call('/api/empresas/me/patrocinios', { token: company, method: 'POST', body: { project_id: 'proj-1', mensaje: 'queremos sumarnos' } });
    assert.equal(prop.status, 201, JSON.stringify(prop.body));
    await waitForEmails(3);
    assert.equal(sent[2].to, REDIRECT);
    assert.match(sent[2].subject, /^\[para: admin@sustentando\.org\] /);

    const dec = await call(`/api/ngos/me/patrocinios/${ngoEmpresaId}/proj-1`, { token: ngo1, method: 'PATCH', body: { estado: 'aceptado' } });
    assert.equal(dec.status, 200);
    await waitForEmails(4);
    assert.equal(sent[3].to, REDIRECT);
    assert.match(sent[3].subject, /^\[para: admin@techcorp\.com\] /);
  });

  test('NINGÚN email salió hacia un usuario del seed, y todos explican a quién iban dirigidos', () => {
    assert.equal(sent.length, 4, `salieron ${sent.length}`);
    for (const m of sent) {
      assert.equal(m.to, REDIRECT, `"${m.subject}" no debía salir hacia ${m.to}`);
      assert.match(m.html, /Modo prueba/, 'el cuerpo debe traer el aviso');
      assert.equal(m.from, 'VoluntariAR <onboarding@resend.dev>');
    }
  });
});
