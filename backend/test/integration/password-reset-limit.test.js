// test/integration/password-reset-limit.test.js
//
// Límites de "¿Olvidaste tu contraseña?" (§275): 3 pedidos por email por hora y 20 por IP por hora. El de email cuenta
// igual exista o no la cuenta (si no, el 429 diría cuáles existen). Pasado el límite: 429 con Retry-After, sin email.
// Todos los pedidos de este archivo salen de la misma IP (localhost) y en un proceso propio (node --test).
const { test, describe, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Límites de "¿Olvidaste tu contraseña?"', () => {
  let server, email, sent, savedKey;

  before(async () => {
    server = await setupTestServer({ seed: true });
    email = require('../../src/lib/email');
    sent = [];
    mock.method(email, 'sendEmail', async (msg) => { sent.push(msg); return { ok: true }; });
    savedKey = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = 're_test_no_se_usa';
  });
  after(async () => {
    mock.restoreAll();
    if (savedKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = savedKey;
    if (server) await server.close();
  });

  const forgot = (mail) => fetch(`${server.baseUrl}/api/auth/forgot-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: mail }),
  }).then(async (r) => ({ status: r.status, retryAfter: r.headers.get('retry-after'), body: await r.json() }));
  const settle = () => new Promise((r) => setTimeout(r, 150));

  test('3 por email por hora: el 4.º es 429, con cuenta y sin cuenta por igual', async () => {
    for (const mail of ['maria@example.com', 'no-existe-limite@example.com']) {
      const statuses = [];
      for (let i = 0; i < 4; i++) statuses.push(await forgot(mail));
      assert.deepEqual(statuses.map((r) => r.status), [200, 200, 200, 429], mail);
      assert.match(statuses[3].body.error, /muchas veces/i);
      assert.ok(Number(statuses[3].retryAfter) > 0 && Number(statuses[3].retryAfter) <= 3600);
    }
    await settle();
    assert.equal(sent.length, 3, 'solo los 3 permitidos de la cuenta que existe');
  });

  test('el email se cuenta normalizado: con mayúsculas es el mismo', async () => {
    assert.equal((await forgot('  MARIA@example.com ')).status, 429);
  });

  test('20 por IP por hora, sumando todos los emails', async () => {
    // Ya van 8 desde esta IP en los tests anteriores (6 permitidos + 2 bloqueados por email + 1 normalizado = 9).
    let last;
    for (let i = 0; i < 30; i++) {
      last = await forgot(`ip-${i}@example.com`);
      if (last.status === 429) break;
    }
    assert.equal(last.status, 429);
    assert.equal(last.body.error, 'Demasiados intentos. Probá de nuevo en unos minutos.');
    assert.ok(Number(last.retryAfter) > 0);
  });
});
