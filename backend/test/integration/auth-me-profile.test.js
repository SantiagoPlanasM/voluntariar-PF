// test/integration/auth-me-profile.test.js
//
// §153 (regla 8): GET /api/auth/me armaba `profile` con `SELECT *` de voluntarios/ngos/empresas. Hoy esas
// columnas no son sensibles, pero la primera que se agregue (un token, datos de facturación) saldría sola.
// Ahora cada rol tiene su lista blanca de columnas. La forma NO cambia: mismas claves en español que antes
// (el frontend no lee `profile`: api.auth.me tipa solo `{ user }` y AuthContext usa solo `user`).
//
// Como public-columns.test.js: a las tres tablas se les agrega una columna con un valor centinela y se
// verifica que no salga; además, que salgan exactamente las columnas de hoy, con los valores de la fila.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

const SENTINEL = 'SECRETO-153-NO-DEBE-SALIR';

// Las columnas que devolvía el `SELECT *` antes del cambio (migrate.js), ordenadas.
const EXPECTED = {
  volunteer: ['apellido', 'banner', 'created_at', 'cv_url', 'descripcion', 'followers', 'foto_perfil', 'id',
    'nombre', 'ubicacion', 'updated_at', 'user_id'],
  ngo: ['alias', 'banner', 'created_at', 'descripcion', 'followers', 'foto_perfil', 'founded', 'id', 'mision',
    'nombre', 'ubicacion', 'updated_at', 'user_id'],
  company: ['banner', 'created_at', 'descripcion', 'followers', 'foto_perfil', 'id', 'industria', 'mision',
    'nombre', 'ubicacion', 'updated_at', 'user_id'],
};
const ACCOUNTS = {
  volunteer: { email: 'maria@example.com', table: 'voluntarios' },
  ngo: { email: 'admin@sustentando.org', table: 'ngos' },
  company: { email: 'admin@techcorp.com', table: 'empresas' },
};

describe('GET /api/auth/me: profile con lista blanca de columnas (regla 8)', () => {
  let server, db;

  const call = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${server.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, text: await r.text() }));

  const me = async (role) => {
    const l = await call('/api/auth/login', { method: 'POST', body: { email: ACCOUNTS[role].email, password: 'Password1' } });
    assert.equal(l.status, 200, `login ${role}`);
    const r = await call('/api/auth/me', { token: JSON.parse(l.text).token });
    assert.equal(r.status, 200, `/auth/me ${role}`);
    return { text: r.text, body: JSON.parse(r.text) };
  };

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
    for (const t of ['users', 'voluntarios', 'ngos', 'empresas']) {
      await db.run(`ALTER TABLE ${t} ADD COLUMN secreto_153 TEXT DEFAULT '${SENTINEL}'`);
    }
  });
  after(async () => { if (server) await server.close(); });

  for (const role of Object.keys(EXPECTED)) {
    test(`${role}: no sale una columna nueva de la tabla del rol (ni de users)`, async () => {
      const { text } = await me(role);
      assert.ok(!text.includes(SENTINEL) && !text.includes('secreto_153'), `/auth/me (${role}) devuelve columnas no elegidas`);
      assert.ok(!/"password"|\$2[aby]\$\d\d\$/.test(text), 'nunca la contraseña ni su hash');
    });

    test(`${role}: profile conserva exactamente las claves de antes, con los valores de la fila`, async () => {
      const { body } = await me(role);
      assert.ok(body.profile, 'profile no es null');
      assert.deepEqual(Object.keys(body.profile).sort(), EXPECTED[role]);
      const row = await db.get(`SELECT id, user_id, nombre FROM ${ACCOUNTS[role].table} WHERE user_id=$1`, [body.user.id]);
      assert.equal(body.profile.id, row.id);
      assert.equal(body.profile.user_id, row.user_id);
      assert.equal(body.profile.nombre, row.nombre);
    });
  }

  test('user sigue con sus 8 campos', async () => {
    const { body } = await me('volunteer');
    assert.deepEqual(Object.keys(body.user).sort(),
      ['avatar', 'bio', 'created_at', 'email', 'id', 'location', 'name', 'role']);
  });
});
