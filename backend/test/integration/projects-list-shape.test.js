// test/integration/projects-list-shape.test.js
//
// GET /api/projects (listado) y GET /api/projects/:id (detalle) tienen que
// devolver los mismos roles y requisitos para un mismo proyecto, en los dos
// motores. En Postgres el listado usa otra consulta (json_agg) y devolvía
// listas vacías: `pg` ya entrega el JSON parseado, `parseJson` hacía
// JSON.parse(array), fallaba y caía en []. Además los roles salían como
// objetos {nombre} y no como strings (REVISION.md B2).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Listado de proyectos: misma forma que el detalle', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
  });

  after(async () => {
    if (server) await server.close();
  });

  const get = (path) =>
    fetch(`${baseUrl}${path}`).then(async (r) => ({ status: r.status, body: await r.json() }));

  // Sin ORDER BY en ninguna de las dos consultas: se compara sin importar el orden.
  const sorted = (arr) => [...arr].sort();

  test('cada proyecto del listado trae los mismos roles y requisitos que su detalle', async () => {
    const list = await get('/api/projects?limit=100');
    assert.equal(list.status, 200);
    const projects = list.body.projects;
    assert.ok(projects.length > 0);

    for (const p of projects) {
      const detail = await get(`/api/projects/${p.id}`);
      assert.equal(detail.status, 200);
      const d = detail.body.project ?? detail.body;
      assert.deepEqual(sorted(p.roles_needed), sorted(d.roles_needed), `roles de "${p.title}"`);
      assert.deepEqual(sorted(p.requirements), sorted(d.requirements), `requisitos de "${p.title}"`);
    }
  });

  test('el seed tiene proyectos con roles y con requisitos (la comparación no es vacía)', async () => {
    const { body } = await get('/api/projects?limit=100');
    assert.ok(body.projects.some((p) => p.roles_needed.length > 0));
    assert.ok(body.projects.some((p) => p.requirements.length > 0));
  });

  test('roles y requisitos del listado son strings', async () => {
    const { body } = await get('/api/projects?limit=100');
    for (const p of body.projects) {
      for (const r of p.roles_needed) assert.equal(typeof r, 'string', `rol de "${p.title}": ${JSON.stringify(r)}`);
      for (const r of p.requirements) assert.equal(typeof r, 'string', `requisito de "${p.title}": ${JSON.stringify(r)}`);
    }
  });
});
