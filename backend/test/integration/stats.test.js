// test/integration/stats.test.js
//
// GET /api/stats (§129): los números de la portada (PublicFeed) estaban fijos en el código ("24 proyectos
// activos", "2.4k voluntarios", "12 ONGs aliadas") y en producción, con la base vacía, mentían. Ahora salen de la
// base. Ojo con Postgres: COUNT llega como string y tiene que salir como número (CLAUDE.md, trampas).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

const getStats = (server) => fetch(`${server.baseUrl}/api/stats`).then(async (r) => ({ status: r.status, body: await r.json() }));

describe('GET /api/stats con el seed', () => {
  let server, db;
  before(async () => { server = await setupTestServer({ seed: true }); db = require('../../src/db'); });
  after(async () => { if (server) await server.close(); });

  const count = async (sql) => Number((await db.get(sql)).n);

  test('público, con números (no strings) iguales a los de la base', async () => {
    const r = await getStats(server);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, {
      active_projects: await count(`SELECT COUNT(*) AS n FROM projects WHERE status = 'active'`),
      volunteers: await count('SELECT COUNT(*) AS n FROM voluntarios'),
      ngos: await count('SELECT COUNT(*) AS n FROM ngos'),
    });
    for (const v of Object.values(r.body)) assert.equal(typeof v, 'number');
    assert.ok(r.body.active_projects > 0 && r.body.volunteers > 0 && r.body.ngos > 0, 'el seed tiene de todo');
  });

  test('un proyecto que termina deja de contar como activo', async () => {
    const before = (await getStats(server)).body.active_projects;
    await db.run(`UPDATE projects SET status = 'completed' WHERE id = 'proj-1'`);
    assert.equal((await getStats(server)).body.active_projects, before - 1);
  });
});
