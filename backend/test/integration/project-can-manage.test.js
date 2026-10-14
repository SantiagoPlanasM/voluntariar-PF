// test/integration/project-can-manage.test.js
//
// GET /api/projects/:id devuelve `can_manage`: true solo si quien lo pide es la ONG dueña del proyecto.
// Lo usa ProjectDetails para mostrar "Ver en panel ONG" solo a la dueña: antes se lo ofrecía a cualquier
// ONG, y en un proyecto ajeno el panel respondía 403 (REVISION.md F16).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('GET /api/projects/:id → can_manage', () => {
  let server;
  let baseUrl;
  const tokens = {};

  const get = (path, token) =>
    fetch(`${baseUrl}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (r) => ({ status: r.status, body: await r.json() }));

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    for (const [k, email] of Object.entries({
      owner: 'admin@sustentando.org', other: 'admin@greencba.org', vol: 'maria@example.com', company: 'admin@techcorp.com',
    })) {
      const r = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Password1' }),
      }).then((x) => x.json());
      tokens[k] = r.token;
    }
  });

  after(async () => {
    if (server) await server.close();
  });

  test('la ONG dueña (proj-1 es de Sustentando) → true', async () => {
    const r = await get('/api/projects/proj-1', tokens.owner);
    assert.equal(r.status, 200);
    assert.equal(r.body.project.can_manage, true);
  });

  test('otra ONG, un voluntario, una empresa y sin sesión → false', async () => {
    for (const t of [tokens.other, tokens.vol, tokens.company, undefined]) {
      const r = await get('/api/projects/proj-1', t);
      assert.equal(r.status, 200);
      assert.equal(r.body.project.can_manage, false);
    }
  });

  test('no expone el user_id de la ONG', async () => {
    const r = await get('/api/projects/proj-1', tokens.other);
    assert.ok(!JSON.stringify(r.body).includes('user-ngo-1'));
  });
});
