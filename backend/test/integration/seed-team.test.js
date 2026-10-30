// test/integration/seed-team.test.js — el equipo de demo que carga el seed (§303).
//
// Sustentando (ngo-1) arranca con una coordinadora activa (Sofía, una voluntaria que solo está para esto: los tests
// usan a María, Juan y Lucía como voluntarios sin acceso) y una invitación pendiente a Lucía (Comunicación). Así el
// Panel muestra "1 miembro · 1 invitación pendiente" y el Inicio de Lucía, el aviso. Correr el seed dos veces no
// duplica nada.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { setupTestServer } = require('./helpers');

describe('seed: equipo de demo de Sustentando', () => {
  let server, baseUrl;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
  });
  after(async () => { if (server) await server.close(); });

  async function call(path_, token) {
    const r = await fetch(`${baseUrl}${path_}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }
  async function login(email) {
    const r = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password1' }),
    });
    return (await r.json()).token;
  }

  test('la ONG ve a Sofía activa (Coordinación) y a Lucía invitada (Comunicación)', async () => {
    const { status, body } = await call('/api/equipo/miembros', await login('admin@sustentando.org'));
    assert.equal(status, 200);
    const byEmail = Object.fromEntries(body.members.map((m) => [m.email, { role: m.role, status: m.status }]));
    assert.deepEqual(byEmail, {
      'sofia@example.com': { role: 'coordinator', status: 'active' },
      'lucia@example.com': { role: 'communicator', status: 'invited' },
    });
  });

  test('Sofía entra al panel de Sustentando, con las postulaciones pendientes', async () => {
    const token = await login('sofia@example.com');
    const mine = (await call('/api/equipo/mias', token)).body.memberships;
    assert.deepEqual(mine.map((m) => [m.ngo_id, m.role, m.status]), [['ngo-1', 'coordinator', 'active']]);
    const panel = await call('/api/equipo/ngo-1/panel', token);
    assert.equal(panel.status, 200);
    assert.ok(Array.isArray(panel.body.pending_enrollments), 'la coordinación ve las postulaciones');
  });

  test('Lucía tiene la invitación pendiente y todavía no entra al panel', async () => {
    const token = await login('lucia@example.com');
    const mine = (await call('/api/equipo/mias', token)).body.memberships;
    assert.deepEqual(mine.map((m) => [m.ngo_id, m.role, m.status]), [['ngo-1', 'communicator', 'invited']]);
    assert.equal((await call('/api/equipo/ngo-1/panel', token)).status, 403);
  });

  test('correr el seed otra vez no duplica el equipo', async () => {
    const env = { ...process.env, NODE_ENV: 'test' };
    execFileSync('node', [path.join(__dirname, '../../scripts/seed.js')], { env, stdio: 'pipe' });
    const { body } = await call('/api/equipo/miembros', await login('admin@sustentando.org'));
    assert.equal(body.members.length, 2);
  });
});
