// test/integration/patrocinio-publico.test.js — "Patrocinado por" en público (docs/archivo/PLAN_PATROCINIO.md etapa 4, §266).
//
// Criterio: GET /api/projects/:id suma `sponsors` (las empresas con el acuerdo ACEPTADO: id, nombre y logo) y
// GET /api/empresas/:id suma `sponsored_projects` (los voluntariados con el acuerdo aceptado: id, título, imagen, ONG).
// Los dos son públicos (sin sesión). Una propuesta pendiente o rechazada no aparece. Ningún punto ni monto sale.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

let server, baseUrl, db, company, ngo1, empresaId;
let seq = 0;

const call = (path, { token, method = 'GET', body } = {}) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})), text: '' }));
async function login(email) {
  const r = await call('/api/auth/login', { method: 'POST', body: { email, password: 'Password1' } });
  assert.equal(r.status, 200, `login ${email}`);
  return r.body.token;
}
/** Proyecto nuevo de la ONG 1 con una propuesta de TechCorp con un punto de dinero, en el estado pedido. */
async function proyectoCon(estado) {
  const title = `Publico ${++seq}`;
  const p = await call('/api/projects', {
    token: ngo1, method: 'POST',
    body: { title, description: 'Proyecto de prueba para lo público', location: 'Córdoba', type: 'fugaz',
      duration: '1 día', volunteers_needed: 5, category: 'Medio Ambiente' },
  });
  assert.equal(p.status, 201, JSON.stringify(p.body));
  const projectId = (await call('/api/projects?limit=500')).body.projects.find((x) => x.title === title).id;
  if (!estado) return projectId;
  assert.equal((await call('/api/empresas/me/patrocinios', { token: company, method: 'POST', body: { project_id: projectId } })).status, 201);
  const url = `/api/patrocinios/${empresaId}/${projectId}`;
  assert.equal((await call(`${url}/puntos`, { token: company, method: 'POST', body: { type: 'money', detail: 'Aporte', amount: 123456 } })).status, 201);
  if (estado === 'aceptado') {
    assert.equal((await call(`${url}/aceptar`, { token: company, method: 'POST', body: { version: 2 } })).status, 200);
    assert.equal((await call(`${url}/aceptar`, { token: ngo1, method: 'POST', body: { version: 2 } })).body.agreement.status, 'aceptado');
  }
  if (estado === 'rechazado') assert.equal((await call(`${url}/rechazar`, { token: ngo1, method: 'POST' })).status, 200);
  return projectId;
}

before(async () => {
  server = await setupTestServer({ seed: true });
  baseUrl = server.baseUrl;
  db = require('../../src/db');
  [company, ngo1] = await Promise.all(['admin@techcorp.com', 'admin@sustentando.org'].map(login));
  empresaId = (await db.get(`SELECT e.id FROM empresas e JOIN users u ON u.id = e.user_id WHERE u.email = 'admin@techcorp.com'`)).id;
});
after(async () => { if (server) await server.close(); });

describe('Patrocinado por: el detalle del voluntariado', () => {
  test('con el acuerdo aceptado, sin sesión: la empresa con id, nombre y logo, sin montos', async () => {
    const pid = await proyectoCon('aceptado');
    const r = await fetch(`${baseUrl}/api/projects/${pid}`);
    const raw = await r.text();
    const { project } = JSON.parse(raw);
    assert.equal(r.status, 200);
    assert.equal(project.sponsors.length, 1);
    assert.deepEqual(Object.keys(project.sponsors[0]).sort(), ['id', 'logo', 'name']);
    assert.equal(project.sponsors[0].id, empresaId);
    assert.equal(project.sponsors[0].name, 'TechCorp');
    assert.ok(!raw.includes('123456'), 'el monto no tiene que salir en público');
  });

  test('pendiente, rechazado o sin propuesta: sponsors vacío', async () => {
    for (const estado of ['propuesto', 'rechazado', null]) {
      const pid = await proyectoCon(estado);
      const { project } = (await call(`/api/projects/${pid}`)).body;
      assert.deepEqual(project.sponsors, [], String(estado));
    }
  });
});

describe('Patrocinado por: el perfil público de la empresa', () => {
  test('lista solo los voluntariados con el acuerdo aceptado, sin montos', async () => {
    const aceptado = await proyectoCon('aceptado');
    const pendiente = await proyectoCon('propuesto');
    const r = await fetch(`${baseUrl}/api/empresas/${empresaId}`);
    const raw = await r.text();
    const { empresa } = JSON.parse(raw);
    assert.equal(r.status, 200);
    const ids = empresa.sponsored_projects.map((p) => p.id);
    assert.ok(ids.includes(aceptado));
    assert.ok(!ids.includes(pendiente));
    const item = empresa.sponsored_projects.find((p) => p.id === aceptado);
    assert.deepEqual(Object.keys(item).sort(), ['id', 'image', 'ngo_name', 'title']);
    assert.equal(item.ngo_name, 'Sustentando');
    assert.ok(!raw.includes('123456'));
  });
});
