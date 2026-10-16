// test/integration/register-input-validation.test.js
//
// REVISION A4 (tercera pasada): `POST /api/auth/register` validaba nombre, email, contraseña y rol, pero no
// `apellido`. Un apellido que no era texto llegaba a `apellido?.trim()` DENTRO de la transacción y reventaba
// (500 en los dos motores). Ahora es un 400 en español, antes de tocar la base, y con largo máximo.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Registro: validación de apellido', () => {
  let server;
  let db;

  const register = (body) =>
    fetch(`${server.baseUrl}/api/auth/register`, {
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

  const base = (email) => ({ name: 'Ana Prueba', email, password: 'Password1', role: 'volunteer' });

  for (const [label, apellido] of [['un número', 42], ['un array', ['García']], ['un objeto', { a: 1 }], ['true', true]]) {
    test(`apellido ${label} → 400 en español y no se crea nada`, async () => {
      const email = `apellido-${label.replace(/\W/g, '')}@test.com`;
      const r = await register({ ...base(email), apellido });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      assert.equal(r.body.error, 'El apellido tiene que ser un texto');
      assert.equal(await usersWith(email), 0);
    });
  }

  test('apellido de más de 50 caracteres → 400 y no se crea nada', async () => {
    const email = 'apellido-largo@test.com';
    const r = await register({ ...base(email), apellido: 'x'.repeat(51) });
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.equal(r.body.error, 'El apellido puede tener hasta 50 caracteres');
    assert.equal(await usersWith(email), 0);
  });

  test('apellido de exactamente 50 caracteres: se registra y se guarda', async () => {
    const apellido = 'G'.repeat(50);
    const ok = await register({ ...base('apellido-50@test.com'), apellido });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    const v = await db.get('SELECT nombre, apellido FROM voluntarios WHERE user_id=$1', [ok.body.user.id]);
    assert.deepEqual({ ...v }, { nombre: 'Ana', apellido });
  });

  test('apellido con espacios alrededor se guarda recortado', async () => {
    const r = await register({ ...base('apellido-trim@test.com'), apellido: '  Pérez ' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const v = await db.get('SELECT apellido FROM voluntarios WHERE user_id=$1', [r.body.user.id]);
    assert.equal(v.apellido, 'Pérez');
  });

  for (const [label, apellido] of [['ausente', undefined], ['null', null], ['vacío', '   ']]) {
    test(`apellido ${label}: se toma del nombre completo (como antes)`, async () => {
      const r = await register({ ...base(`apellido-${label}@test.com`), apellido });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      const v = await db.get('SELECT nombre, apellido FROM voluntarios WHERE user_id=$1', [r.body.user.id]);
      assert.deepEqual({ ...v }, { nombre: 'Ana', apellido: 'Prueba' });
    });
  }

  test('ONG con apellido inválido también da 400 (se valida antes de mirar el rol)', async () => {
    const email = 'ong-apellido@test.com';
    const r = await register({ ...base(email), role: 'ngo', apellido: 7 });
    assert.equal(r.status, 400);
    assert.equal(await usersWith(email), 0);
  });
});
