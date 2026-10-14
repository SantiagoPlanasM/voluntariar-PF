// test/integration/register-transaction.test.js
//
// REVISION B17: el registro hacía INSERT del usuario y DESPUÉS, suelto, el del perfil (voluntarios/ngos/
// empresas). Si el segundo fallaba quedaba un usuario sin perfil, y ese email ya no se podía volver a
// registrar ("Ya existe una cuenta"). Y dos registros simultáneos con el mismo email pasaban los dos el
// SELECT previo: el segundo chocaba con el UNIQUE y respondía 500 en vez de 409.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Registro: usuario y perfil juntos, email duplicado → 409', () => {
  let server;
  let db;

  const register = (body) =>
    fetch(`${server.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const n = async (sql, params) => Number((await db.get(sql, params)).n) || 0;
  const usersWith = (email) => n('SELECT COUNT(*) AS n FROM users WHERE email=$1', [email]);

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
  });
  after(async () => { if (server) await server.close(); });

  const PROFILE = { volunteer: 'voluntarios', ngo: 'ngos', company: 'empresas' };

  for (const [role, table] of Object.entries(PROFILE)) {
    test(`${role}: si falla el alta del perfil (${table}), no queda el usuario y el email se puede volver a usar`, async () => {
      const email = `falla-${role}@test.com`;
      const failOnProfile = (run) => (sql, params) =>
        new RegExp(`INSERT INTO ${table}\\b`).test(sql) ? Promise.reject(new Error('falla simulada')) : run(sql, params);
      const origRun = db.run;
      const origTx = db.transaction;
      db.run = failOnProfile(origRun);
      db.transaction = (fn) => origTx((tx) => fn({ ...tx, run: failOnProfile(tx.run) }));
      let r;
      try {
        r = await register({ name: 'Persona Prueba', email, password: 'Password1', role });
      } finally {
        db.run = origRun;
        db.transaction = origTx;
      }
      assert.equal(r.status, 500);
      assert.equal(await usersWith(email), 0, 'no quedó un usuario sin perfil');

      const retry = await register({ name: 'Persona Prueba', email, password: 'Password1', role });
      assert.equal(retry.status, 201, JSON.stringify(retry.body));
      assert.equal(await usersWith(email), 1);
      assert.equal(await n(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=$1`, [retry.body.user.id]), 1);
    });
  }

  test('el mismo email registrado 6 veces a la vez: un 201 y cinco 409 (ningún 500), un solo usuario y un perfil', async () => {
    const email = 'simultaneo@test.com';
    const results = await Promise.all(Array.from({ length: 6 }, () =>
      register({ name: 'Doble Registro', email, password: 'Password1', role: 'volunteer' })));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409, 409, 409, 409, 409], JSON.stringify(results.map((r) => [r.status, r.body.error])));
    for (const r of results.filter((x) => x.status === 409)) assert.equal(r.body.error, 'Ya existe una cuenta con ese email');
    assert.equal(await usersWith(email), 1);
    const created = results.find((r) => r.status === 201).body.user;
    assert.equal(await n('SELECT COUNT(*) AS n FROM voluntarios WHERE user_id=$1', [created.id]), 1);
  });

  test('la respuesta trae el usuario recién creado (id generado en el código, regla 23)', async () => {
    const r = await register({ name: 'Ana Nueva', email: 'Ana.Nueva@Test.com', password: 'Password1', role: 'ngo' });
    assert.equal(r.status, 201);
    const row = await db.get('SELECT id, name, email, role FROM users WHERE id=$1', [r.body.user.id]);
    assert.deepEqual(row, { id: r.body.user.id, name: 'Ana Nueva', email: 'ana.nueva@test.com', role: 'ngo' });
    assert.match(r.body.user.id, /^[0-9a-f-]{36}$/);
  });
});
