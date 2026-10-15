// test/integration/login-message.test.js
//
// REVISION B20 (decisión del usuario: mensaje único). El login respondía "No encontramos una cuenta con ese
// email" o "Contraseña incorrecta": con eso se podía averiguar qué emails tienen cuenta. Ahora los dos casos
// responden igual. Y como un email inexistente no calculaba el hash (bcrypt, ~decenas de ms), la diferencia
// de TIEMPO también lo delataba: ahora se compara igual contra un hash fijo.
const { test, describe, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { setupTestServer } = require('./helpers');

describe('Login: mismo mensaje con email inexistente o contraseña incorrecta', () => {
  let server;
  const login = (email, password) =>
    fetch(`${server.baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

  before(async () => { server = await setupTestServer({ seed: true }); });
  after(async () => { mock.restoreAll(); if (server) await server.close(); });

  test('email que no existe y contraseña incorrecta: misma respuesta', async () => {
    const noExiste = await login('nadie@example.com', 'Password1');
    const malaPass = await login('maria@example.com', 'Incorrecta1');
    assert.deepEqual(noExiste, { status: 401, body: { error: 'Email o contraseña incorrectos' } });
    assert.deepEqual(malaPass, noExiste);
  });

  test('con un email inexistente también se calcula el hash (el tiempo no delata si la cuenta existe)', async () => {
    const compare = mock.method(bcrypt, 'compare');
    await login('nadie-2@example.com', 'Password1');
    assert.equal(compare.mock.callCount(), 1);
    compare.mock.restore();
  });

  test('el login correcto sigue andando', async () => {
    const ok = await login('maria@example.com', 'Password1');
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);
  });
});
