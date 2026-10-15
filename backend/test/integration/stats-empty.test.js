// test/integration/stats-empty.test.js
//
// GET /api/stats con la base vacía (§129). Va en un archivo aparte: cada archivo de test corre en su propio
// proceso, y dentro de un mismo proceso el módulo de la base queda apuntando a la del primer servidor (con seed).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

const getStats = (server) => fetch(`${server.baseUrl}/api/stats`).then(async (r) => ({ status: r.status, body: await r.json() }));

describe('GET /api/stats con la base vacía (un deploy nuevo)', () => {
  let server;
  before(async () => { server = await setupTestServer({ seed: false }); });
  after(async () => { if (server) await server.close(); });

  test('todo en 0', async () => {
    const r = await getStats(server);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { active_projects: 0, volunteers: 0, ngos: 0 });
  });
});
