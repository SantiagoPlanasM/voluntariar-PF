// test/integration/profiles-input-validation.test.js
//
// Entradas inválidas en auth y perfiles que daban 500 o se guardaban mal (REVISION.md B11, B12, B13):
//   - B13: `.trim()` sobre valores que no son string → 500 (login con `email: [...]`, registro con `name: 5`).
//   - B12: `name: ""` se salteaba la validación (`if (name)`) y dejaba el nombre vacío (auth, ONG, empresa).
//   - Textos libres sin tipo ni largo máximo (bio, descripción, misión...): un objeto o 1 MB de texto se guardaban.
//   - B11: `rol` de un empleado fuera de la lista reventaba en el CHECK (500).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('auth y perfiles: entradas inválidas → 400', () => {
  let server;
  let baseUrl;
  let db;
  const t = {};

  const api = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const bad = async (req, why) => {
    const r = await req;
    assert.equal(r.status, 400, `${why}: status ${r.status} ${JSON.stringify(r.body)}`);
    assert.equal(typeof r.body.error, 'string', `${why}: mensaje`);
  };

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    for (const [k, email] of Object.entries({ vol: 'maria@example.com', ngo: 'admin@sustentando.org', comp: 'admin@techcorp.com' })) {
      t[k] = (await api('/api/auth/login', { method: 'POST', body: { email, password: 'Password1' } })).body.token;
    }
  });

  after(async () => {
    if (server) await server.close();
  });

  describe('login y registro con tipos incorrectos (B13)', () => {
    test('login con email array / número → 400', async () => {
      await bad(api('/api/auth/login', { method: 'POST', body: { email: ['a@b.com'], password: 'Password1' } }), 'email array');
      await bad(api('/api/auth/login', { method: 'POST', body: { email: 5, password: 'Password1' } }), 'email número');
    });

    test('login con password que no es texto → 400', async () => {
      await bad(api('/api/auth/login', { method: 'POST', body: { email: 'maria@example.com', password: ['Password1'] } }), 'password array');
    });

    test('registro con name, email o password que no son texto → 400 y no crea el usuario', async () => {
      const ok = { name: 'Ana Pérez', email: 'ana.tipos@example.com', password: 'Password1', role: 'volunteer' };
      await bad(api('/api/auth/register', { method: 'POST', body: { ...ok, name: 5 } }), 'name número');
      await bad(api('/api/auth/register', { method: 'POST', body: { ...ok, email: { x: 1 } } }), 'email objeto');
      await bad(api('/api/auth/register', { method: 'POST', body: { ...ok, password: ['Password1'] } }), 'password array');
      assert.equal(await db.get(`SELECT id FROM users WHERE email='ana.tipos@example.com'`), undefined);
    });
  });

  describe('PUT /api/auth/me', () => {
    const me = () => db.get(`SELECT name, bio FROM users WHERE id='user-vol-1'`);

    test('name vacío, solo espacios o null → 400 y no cambia (B12)', async () => {
      const before = await me();
      await bad(api('/api/auth/me', { token: t.vol, method: 'PUT', body: { name: '' } }), 'name ""');
      await bad(api('/api/auth/me', { token: t.vol, method: 'PUT', body: { name: '   ' } }), 'name espacios');
      await bad(api('/api/auth/me', { token: t.vol, method: 'PUT', body: { name: null } }), 'name null');
      assert.deepEqual(await me(), before);
    });

    test('bio que no es texto o de más de 500 → 400', async () => {
      await bad(api('/api/auth/me', { token: t.vol, method: 'PUT', body: { bio: { x: 1 } } }), 'bio objeto');
      await bad(api('/api/auth/me', { token: t.vol, method: 'PUT', body: { bio: 'x'.repeat(501) } }), 'bio 501');
      await bad(api('/api/auth/me', { token: t.vol, method: 'PUT', body: { location: 'x'.repeat(151) } }), 'location 151');
    });

    test('válido → 200, el nombre se guarda recortado y bio null la borra', async () => {
      const r = await api('/api/auth/me', { token: t.vol, method: 'PUT', body: { name: '  María García  ', bio: null } });
      assert.equal(r.status, 200);
      assert.deepEqual(await me(), { name: 'María García', bio: null });
    });
  });

  describe('PUT /api/ngos/me y PUT /api/empresas/me', () => {
    for (const [label, path, token, table] of [['ONG', '/api/ngos/me', 'ngo', 'ngos'], ['empresa', '/api/empresas/me', 'comp', 'empresas']]) {
      test(`${label}: name vacío o espacios → 400 y no cambia (B12)`, async () => {
        const before = await db.get(`SELECT nombre FROM ${table} WHERE user_id=(SELECT id FROM users WHERE email=$1)`,
          [token === 'ngo' ? 'admin@sustentando.org' : 'admin@techcorp.com']);
        await bad(api(path, { token: t[token], method: 'PUT', body: { name: '' } }), 'name ""');
        await bad(api(path, { token: t[token], method: 'PUT', body: { name: '  ' } }), 'name espacios');
        await bad(api(path, { token: t[token], method: 'PUT', body: { name: null } }), 'name null');
        const after = await db.get(`SELECT nombre FROM ${table} WHERE user_id=(SELECT id FROM users WHERE email=$1)`,
          [token === 'ngo' ? 'admin@sustentando.org' : 'admin@techcorp.com']);
        assert.deepEqual(after, before);
      });

      test(`${label}: name o description que no son texto, o demasiado largos → 400`, async () => {
        await bad(api(path, { token: t[token], method: 'PUT', body: { name: 123 } }), 'name número');
        await bad(api(path, { token: t[token], method: 'PUT', body: { description: ['x'] } }), 'description array');
        await bad(api(path, { token: t[token], method: 'PUT', body: { description: 'x'.repeat(2001) } }), 'description 2001');
        await bad(api(path, { token: t[token], method: 'PUT', body: { mission: 'x'.repeat(1001) } }), 'mission 1001');
      });

      test(`${label}: válido → 200 con el nombre recortado`, async () => {
        const r = await api(path, { token: t[token], method: 'PUT', body: { name: '  Nombre Nuevo  ', description: 'Una descripción' } });
        assert.equal(r.status, 200);
        const row = await db.get(`SELECT nombre, descripcion FROM ${table} WHERE user_id=(SELECT id FROM users WHERE email=$1)`,
          [token === 'ngo' ? 'admin@sustentando.org' : 'admin@techcorp.com']);
        assert.deepEqual(row, { nombre: 'Nombre Nuevo', descripcion: 'Una descripción' });
      });
    }
  });

  describe('POST /api/ngos/:id/empleados', () => {
    const count = async () => Number((await db.get(`SELECT COUNT(*) AS n FROM empleados WHERE ngo_id='ngo-1'`)).n);
    const ok = { nombre: 'Laura', apellido: 'Gómez', email: 'laura@example.org', rol: 'comunicador' };

    test('rol fuera de la lista → 400 (antes 500 por el CHECK; B11)', async () => {
      const n = await count();
      await bad(api('/api/ngos/ngo-1/empleados', { token: t.ngo, method: 'POST', body: { ...ok, rol: 'jefe' } }), 'rol jefe');
      assert.equal(await count(), n);
    });

    test('nombre, apellido o email que no son texto → 400 (B13)', async () => {
      const n = await count();
      await bad(api('/api/ngos/ngo-1/empleados', { token: t.ngo, method: 'POST', body: { ...ok, nombre: 5 } }), 'nombre número');
      await bad(api('/api/ngos/ngo-1/empleados', { token: t.ngo, method: 'POST', body: { ...ok, email: ['x@y.com'] } }), 'email array');
      await bad(api('/api/ngos/ngo-1/empleados', { token: t.ngo, method: 'POST', body: { ...ok, email: 'no-es-email' } }), 'email inválido');
      await bad(api('/api/ngos/ngo-1/empleados', { token: t.ngo, method: 'POST', body: { ...ok, nombre: '   ' } }), 'nombre vacío');
      const { apellido, ...sinApellido } = ok;
      await bad(api('/api/ngos/ngo-1/empleados', { token: t.ngo, method: 'POST', body: sinApellido }), 'sin apellido');
      assert.equal(await count(), n);
    });

    test('válido → 201 (y sin rol usa coordinador)', async () => {
      const r = await api('/api/ngos/ngo-1/empleados', { token: t.ngo, method: 'POST', body: { nombre: 'Pablo', apellido: 'Ruiz', email: 'pablo@example.org' } });
      assert.equal(r.status, 201);
      assert.equal(r.body.empleado.rol, 'coordinador');
    });
  });
});
