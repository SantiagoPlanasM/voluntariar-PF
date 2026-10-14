// test/integration/project-subresources.test.js
//
// KPIs y comentarios de un proyecto que no corresponde (REVISION.md B18):
//   - PUT /projects/<propio>/kpis/<KPI de otro proyecto> no modificaba nada pero respondía 200 con el
//     KPI ajeno (releía por id sin filtrar por proyecto): fuga de datos de otra ONG.
//   - PUT/DELETE de un KPI inexistente respondían 200 (`{}` o "KPI eliminado") sin hacer nada.
//   - Comentar un proyecto inexistente daba 500 (violación de FK) en vez de 404.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('KPIs y comentarios: proyecto que no corresponde', () => {
  let server;
  let baseUrl;
  let db;
  let ngo1;  // Sustentando, dueña de proj-1
  let ngo2;  // Green Córdoba, dueña de proj-2
  let vol;
  let kpiId; // KPI de proj-1

  const api = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const login = async (email) =>
    (await api('/api/auth/login', { method: 'POST', body: { email, password: 'Password1' } })).body.token;

  const kpi = (id) => db.get('SELECT project_id, nombre, valor FROM kpis WHERE id=$1', [id]);

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    ngo1 = await login('admin@sustentando.org');
    ngo2 = await login('admin@greencba.org');
    vol = await login('maria@example.com');

    const k = await api('/api/projects/proj-1/kpis', {
      token: ngo1, method: 'POST', body: { nombre: 'Secreto de Sustentando', valor: 42 },
    });
    assert.equal(k.status, 201);
    kpiId = k.body.kpi.id;
  });

  after(async () => {
    if (server) await server.close();
  });

  describe('PUT /projects/:id/kpis/:kpiId', () => {
    test('un KPI de otro proyecto (por la URL de un proyecto propio) → 404, sin datos ajenos', async () => {
      const r = await api(`/api/projects/proj-2/kpis/${kpiId}`, {
        token: ngo2, method: 'PUT', body: { nombre: 'Pisado', valor: 0 },
      });
      assert.equal(r.status, 404);
      assert.equal(r.body.kpi, undefined);
      assert.ok(!JSON.stringify(r.body).includes('Secreto'), 'no devuelve el KPI de la otra ONG');
      assert.deepEqual(await kpi(kpiId), { project_id: 'proj-1', nombre: 'Secreto de Sustentando', valor: 42 });
    });

    test('un KPI inexistente → 404', async () => {
      const r = await api('/api/projects/proj-1/kpis/no-existe', {
        token: ngo1, method: 'PUT', body: { nombre: 'X', valor: 1 },
      });
      assert.equal(r.status, 404);
      assert.equal(r.body.kpi, undefined);
      assert.equal(typeof r.body.error, 'string');
    });

    test('la dueña lo edita: 200 con el KPI actualizado', async () => {
      const r = await api(`/api/projects/proj-1/kpis/${kpiId}`, {
        token: ngo1, method: 'PUT', body: { nombre: 'Árboles', valor: 12 },
      });
      assert.equal(r.status, 200);
      assert.equal(r.body.kpi.id, kpiId);
      assert.equal(r.body.kpi.nombre, 'Árboles');
      assert.equal(r.body.kpi.valor, 12);
    });
  });

  describe('DELETE /projects/:id/kpis/:kpiId', () => {
    test('un KPI de otro proyecto (por la URL de un proyecto propio) → 404 y sigue existiendo', async () => {
      const r = await api(`/api/projects/proj-2/kpis/${kpiId}`, { token: ngo2, method: 'DELETE' });
      assert.equal(r.status, 404);
      assert.ok(await kpi(kpiId));
    });

    test('un KPI inexistente → 404', async () => {
      const r = await api('/api/projects/proj-1/kpis/no-existe', { token: ngo1, method: 'DELETE' });
      assert.equal(r.status, 404);
    });

    test('la dueña lo borra: 200, y un segundo intento da 404', async () => {
      const r = await api(`/api/projects/proj-1/kpis/${kpiId}`, { token: ngo1, method: 'DELETE' });
      assert.equal(r.status, 200);
      assert.equal(await kpi(kpiId), undefined);
      const again = await api(`/api/projects/proj-1/kpis/${kpiId}`, { token: ngo1, method: 'DELETE' });
      assert.equal(again.status, 404);
    });
  });

  describe('POST /projects/:id/comments', () => {
    test('a un proyecto inexistente → 404 (antes 500 por la FK) y no se guarda nada', async () => {
      const r = await api('/api/projects/no-existe/comments', {
        token: vol, method: 'POST', body: { comment: 'Hola, quiero participar' },
      });
      assert.equal(r.status, 404);
      assert.equal(typeof r.body.error, 'string');
      const n = Number((await db.get(`SELECT COUNT(*) AS n FROM comments WHERE project_id='no-existe'`)).n);
      assert.equal(n, 0);
    });

    test('a un proyecto existente → 201', async () => {
      const r = await api('/api/projects/proj-1/comments', {
        token: vol, method: 'POST', body: { comment: 'Hola, quiero participar' },
      });
      assert.equal(r.status, 201);
      assert.equal(r.body.comment.project_id, 'proj-1');
    });
  });
});
