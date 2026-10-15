// test/integration/auth-rate-limit.test.js
//
// Límite de intentos en login y registro (aprobado por el usuario; §103). Antes se podían probar contraseñas sin
// tope. Ahora:
//   - login: 10 intentos FALLIDOS por email+IP cada 15 min (por email solo, cualquiera podría bloquearle la cuenta a
//     otra persona), y 50 fallidos por IP (muchos emails desde el mismo lugar). Un login correcto limpia el contador.
//   - registro: 20 por IP por hora.
//   - pasado el límite: 429 en español con Retry-After, sin siquiera comparar la contraseña.
// Todos los pedidos de los tests salen de la misma IP (localhost): cada test usa emails propios.
const { test, describe, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { setupTestServer } = require('./helpers');

describe('Límite de intentos en login y registro', () => {
  let server;
  const post = (path, body) => fetch(`${server.baseUrl}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, retryAfter: r.headers.get('retry-after'), body: await r.json() }));
  const login = (email, password) => post('/api/auth/login', { email, password });
  const TOO_MANY = 'Demasiados intentos. Probá de nuevo en unos minutos.';

  before(async () => { server = await setupTestServer({ seed: true }); });
  after(async () => { mock.restoreAll(); if (server) await server.close(); });

  test('10 contraseñas incorrectas para una cuenta → la 11.ª es 429 (aunque sea la correcta), con Retry-After', async () => {
    for (let i = 0; i < 10; i++) assert.equal((await login('maria@example.com', `Mala${i}xx`)).status, 401);
    const blocked = await login('maria@example.com', 'Password1');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error, TOO_MANY);
    assert.ok(Number(blocked.retryAfter) > 0 && Number(blocked.retryAfter) <= 15 * 60);
  });

  test('bloqueado, ni siquiera se compara la contraseña (no gasta CPU en bcrypt)', async () => {
    const compare = mock.method(bcrypt, 'compare');
    assert.equal((await login('maria@example.com', 'Password1')).status, 429);
    assert.equal(compare.mock.callCount(), 0);
    compare.mock.restore();
  });

  test('otra cuenta desde la misma IP sigue pudiendo entrar', async () => {
    assert.equal((await login('juan@example.com', 'Password1')).status, 200);
  });

  test('un login correcto antes del límite limpia el contador', async () => {
    for (let i = 0; i < 9; i++) assert.equal((await login('lucia@example.com', `Mala${i}xx`)).status, 401);
    assert.equal((await login('lucia@example.com', 'Password1')).status, 200);
    for (let i = 0; i < 9; i++) assert.equal((await login('lucia@example.com', `Otra${i}xx`)).status, 401);
    assert.equal((await login('lucia@example.com', 'Password1')).status, 200);
  });

  test('los errores de validación (400) no cuentan como intentos', async () => {
    for (let i = 0; i < 12; i++) assert.equal((await post('/api/auth/login', { email: 'admin@greencba.org', password: '' })).status, 400);
    assert.equal((await login('admin@greencba.org', 'Password1')).status, 200);
  });

  test('50 fallidos desde una IP con emails distintos → el siguiente intento de cualquier email es 429', async () => {
    // Ya hubo 10 (María) + 18 (Lucía) fallidos desde esta IP en los tests de arriba: 28. Faltan 22.
    for (let i = 0; i < 22; i++) assert.equal((await login(`nadie${i}@example.com`, 'Password1')).status, 401);
    const r = await login('admin@techcorp.com', 'Password1');
    assert.equal(r.status, 429);
    assert.equal(r.body.error, TOO_MANY);
  });

  test('registro: 20 por IP por hora; el 21.º es 429', async () => {
    for (let i = 0; i < 20; i++) {
      const r = await post('/api/auth/register', { name: 'Persona Prueba', email: `reg${i}@test.com`, password: 'Password1', role: 'volunteer' });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    }
    const r = await post('/api/auth/register', { name: 'Persona Prueba', email: 'reg20@test.com', password: 'Password1', role: 'volunteer' });
    assert.deepEqual([r.status, r.body.error], [429, TOO_MANY]);
  });
});
