// test/integration/password-change.test.js — cambiar la contraseña desde la cuenta (§272).
//
// Criterio: PUT /api/auth/me/password con { current_password, new_password }, con sesión.
// - la actual tiene que ser la correcta (400 "La contraseña actual no es correcta"; 400 y no 401, para no cerrar la
//   sesión en el frontend); la nueva, las mismas reglas que el registro, y distinta de la actual;
// - después, el login entra con la nueva y no con la vieja;
// - 5 intentos con la actual equivocada en 15 minutos: 429, aunque la sexta sea la correcta;
// - sin sesión: 401; tipos que no son texto: 400.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

let server, baseUrl;
const call = (path, { token, method = 'GET', body } = {}) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const login = (email, password) => call('/api/auth/login', { method: 'POST', body: { email, password } });
const change = (token, current_password, new_password) =>
  call('/api/auth/me/password', { token, method: 'PUT', body: { current_password, new_password } });

before(async () => { server = await setupTestServer({ seed: true }); baseUrl = server.baseUrl; });
after(async () => { if (server) await server.close(); });

describe('Cambiar la contraseña', () => {
  test('con la actual correcta: cambia, y el login entra con la nueva y no con la vieja', async () => {
    const token = (await login('maria@example.com', 'Password1')).body.token;
    const r = await change(token, 'Password1', 'NuevaClave2');
    assert.deepEqual([r.status, r.body.message], [200, 'Contraseña actualizada']);
    assert.equal((await login('maria@example.com', 'NuevaClave2')).status, 200);
    assert.equal((await login('maria@example.com', 'Password1')).status, 401);
  });

  test('validación: actual equivocada, reglas de la nueva, igual a la actual, tipos (400, sin cambiar nada)', async () => {
    const token = (await login('juan@example.com', 'Password1')).body.token;
    const casos = [
      ['Otra1234', 'NuevaClave2', 'La contraseña actual no es correcta'],
      ['Password1', 'corta1A', 'Mínimo 8 caracteres'],
      ['Password1', 'sinmayuscula1', 'Necesita al menos una mayúscula'],
      ['Password1', 'SinNumeros', 'Necesita al menos un número'],
      ['Password1', 'Password1', 'La nueva contraseña tiene que ser distinta de la actual'],
      [undefined, 'NuevaClave2', 'Contraseña actual y nueva requeridas'],
      ['Password1', 12345678, 'Contraseña actual y nueva requeridas'],
    ];
    for (const [cur, nue, error] of casos) {
      const r = await change(token, cur, nue);
      assert.deepEqual([r.status, r.body.error], [400, error], `${cur} → ${nue}`);
    }
    assert.equal((await login('juan@example.com', 'Password1')).status, 200, 'la contraseña no cambió');
  });

  test('sin sesión: 401', async () => {
    assert.equal((await change(undefined, 'Password1', 'NuevaClave2')).status, 401);
  });

  test('5 intentos con la actual equivocada: el sexto da 429, aunque sea la correcta', async () => {
    const token = (await login('lucia@example.com', 'Password1')).body.token;
    for (let i = 0; i < 5; i++) assert.equal((await change(token, 'Mala1234', 'NuevaClave2')).status, 400);
    const r = await change(token, 'Password1', 'NuevaClave2');
    assert.equal(r.status, 429);
    assert.equal((await login('lucia@example.com', 'Password1')).status, 200, 'no cambió');
  });
});
