// test/integration/projects-cancelled-hidden.test.js
//
// §256: desde que la ONG puede cancelar un voluntariado desde el panel, un cancelado no tiene que aparecer en el
// catálogo público (Explorar, su mapa y la portada piden GET /api/projects sin `status`). Antes no se podía cancelar
// desde la interfaz y el listado traía todos los estados. Un finalizado sí sigue apareciendo ("Ver cómo salió").
// Pedido explícito con `status=cancelled`, sí los trae; el detalle (GET /:id) también, para quien tenga el link.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('GET /api/projects: los cancelados no salen en el catálogo', () => {
  let server;
  let baseUrl;
  let db;
  const CANCELADO = 'Maratón Solidaria de Donaciones';
  const FINALIZADO = 'Digitalización de ONGs';

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    await db.run(`UPDATE projects SET status='cancelled' WHERE titulo=$1`, [CANCELADO]);
    await db.run(`UPDATE projects SET status='completed' WHERE titulo=$1`, [FINALIZADO]);
  });

  after(async () => {
    if (server) await server.close();
  });

  const list = async (query = '') => {
    const r = await fetch(`${baseUrl}/api/projects?limit=500${query}`);
    assert.equal(r.status, 200);
    return (await r.json()).projects;
  };

  test('sin status: no trae el cancelado, sí el finalizado y los activos', async () => {
    const projects = await list();
    const titles = projects.map((p) => p.title);
    assert.ok(!titles.includes(CANCELADO), 'el cancelado no tiene que aparecer');
    assert.ok(titles.includes(FINALIZADO), 'el finalizado sigue apareciendo');
    assert.ok(projects.length >= 10, 'los demás (activos) siguen');
    assert.ok(projects.every((p) => p.status !== 'cancelled'));
  });

  test('con los otros filtros (búsqueda, orden reciente) tampoco aparece', async () => {
    assert.deepEqual((await list(`&search=${encodeURIComponent('maratón')}`)).map((p) => p.title), []);
    assert.ok(!(await list('&sort=recent')).some((p) => p.title === CANCELADO));
  });

  test('status=cancelled los trae explícitamente; status=active no', async () => {
    assert.deepEqual((await list('&status=cancelled')).map((p) => p.title), [CANCELADO]);
    assert.ok(!(await list('&status=active')).some((p) => p.title === CANCELADO));
  });

  test('el detalle del cancelado se sigue pudiendo abrir', async () => {
    const [p] = await list('&status=cancelled');
    const r = await fetch(`${baseUrl}/api/projects/${p.id}`);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).project.status, 'cancelled');
  });
});
