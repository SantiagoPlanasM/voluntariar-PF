// test/integration/register-password-max.test.js
//
// bcryptjs usa solo los primeros 72 bytes de la contraseña: dos contraseñas que coinciden en esos 72 bytes
// valen como la misma (§138 lo dejó anotado). Al FIJAR una contraseña (registro; no hay otro endpoint que la
// cambie) se rechaza la que pasa de 72 bytes UTF-8. El login no cambia: una cuenta vieja con una contraseña
// más larga sigue entrando.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');
const { setupTestServer } = require('./helpers');

const MSG = 'Máximo 72 caracteres (los acentos, la ñ y los emojis cuentan como más de uno)';

describe('Registro: contraseña de hasta 72 bytes', () => {
  let server;
  let db;

  const post = (path, body) =>
    fetch(`${server.baseUrl}/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const usersWith = async (email) =>
    Number((await db.get('SELECT COUNT(*) AS n FROM users WHERE email=$1', [email])).n) || 0;

  before(async () => {
    server = await setupTestServer();
    db = require('../../src/db');
  });
  after(async () => { if (server) await server.close(); });

  const reg = (email, password) => post('register', { name: 'Ana Prueba', email, password, role: 'volunteer' });

  test('73 caracteres ASCII → 400 en español y no se crea nada', async () => {
    const email = 'pass-73@test.com';
    const r = await reg(email, 'Password1' + 'x'.repeat(64));
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.equal(r.body.error, MSG);
    assert.equal(await usersWith(email), 0);
  });

  test('exactamente 72 ASCII → 201 y después entra con esa contraseña', async () => {
    const email = 'pass-72@test.com';
    const password = 'Password1' + 'x'.repeat(63);
    assert.equal(Buffer.byteLength(password), 72);
    const r = await reg(email, password);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const login = await post('login', { email, password });
    assert.equal(login.status, 200, JSON.stringify(login.body));
  });

  test('cuenta bytes, no caracteres: 38 caracteres con ñ (74 bytes) → 400', async () => {
    const email = 'pass-enie-74@test.com';
    const password = 'A1' + 'ñ'.repeat(36);
    assert.equal(password.length, 38);
    assert.equal(Buffer.byteLength(password), 74);
    const r = await reg(email, password);
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.equal(r.body.error, MSG);
    assert.equal(await usersWith(email), 0);
  });

  test('con ñ hasta 72 bytes justos → 201', async () => {
    const password = 'A1' + 'ñ'.repeat(35);
    assert.equal(Buffer.byteLength(password), 72);
    const r = await reg('pass-enie-72@test.com', password);
    assert.equal(r.status, 201, JSON.stringify(r.body));
  });

  test('el mínimo sigue mandando primero: corta → "Mínimo 8 caracteres"', async () => {
    const r = await reg('pass-corta@test.com', 'Ab1');
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'Mínimo 8 caracteres');
  });

  test('login sin cambios: una cuenta vieja con contraseña de 80 bytes sigue entrando', async () => {
    const email = 'pass-vieja-80@test.com';
    const password = 'Password1' + 'z'.repeat(71);
    assert.equal(Buffer.byteLength(password), 80);
    await db.run(
      'INSERT INTO users (id, name, email, password, role, avatar) VALUES ($1,$2,$3,$4,$5,$6)',
      [randomUUID(), 'Cuenta Vieja', email, await bcrypt.hash(password, 4), 'volunteer', null]
    );
    const ok = await post('login', { email, password });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    // Una contraseña larga equivocada da el 401 de siempre, no el 400 del registro.
    const bad = await post('login', { email, password: 'Otra1' + 'q'.repeat(80) });
    assert.equal(bad.status, 401, JSON.stringify(bad.body));
    assert.equal(bad.body.error, 'Email o contraseña incorrectos');
  });
});
