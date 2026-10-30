// test/integration/project-photo-position.test.js — el encuadre de la foto del voluntariado (§297, PLAN_CIERRE §2).
//
// En las tarjetas de Explorar la foto se recorta (formato vertical). Decisión del usuario: la ONG elige qué parte
// mostrar: arriba, al centro o abajo. Se guarda en projects.foto_posicion ('arriba' | 'centro' | 'abajo', por defecto
// 'centro') y sale en la API como image_position ('top' | 'center' | 'bottom'). Se cambia con PUT /api/projects/:id;
// si no viene, se conserva. Seed: proj-1 es de Sustentando (admin@sustentando.org).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Encuadre de la foto del voluntariado', () => {
  let server, baseUrl, db, owner, other;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    owner = (await call('POST', '/api/auth/login', { email: 'admin@sustentando.org', password: 'Password1' })).body.token;
    other = (await call('POST', '/api/auth/login', { email: 'admin@techsocial.org', password: 'Password1' })).body.token;
  });
  after(async () => { if (server) await server.close(); });

  async function call(method, path, body, token) {
    const r = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }
  const position = async () => (await call('GET', '/api/projects/proj-1')).body.project.image_position;
  const stored = async () => (await db.get(`SELECT foto_posicion FROM projects WHERE id='proj-1'`)).foto_posicion;

  test('por defecto, al centro (en el detalle y en el listado)', async () => {
    assert.equal(await position(), 'center');
    const list = (await call('GET', '/api/projects?limit=100')).body.projects;
    assert.equal(list.find((p) => p.id === 'proj-1').image_position, 'center');
  });

  test('la ONG dueña la cambia (y se guarda en español); un PUT sin el campo la conserva', async () => {
    const r = await call('PUT', '/api/projects/proj-1', { image_position: 'top' }, owner);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.project.image_position, 'top');
    assert.equal(await stored(), 'arriba');
    assert.equal((await call('PUT', '/api/projects/proj-1', { title: 'Reforestación urbana' }, owner)).status, 200);
    assert.equal(await position(), 'top');
    assert.equal((await call('PUT', '/api/projects/proj-1', { image_position: 'bottom' }, owner)).status, 200);
    assert.equal(await stored(), 'abajo');
    assert.equal((await call('PUT', '/api/projects/proj-1', { image_position: 'center' }, owner)).status, 200);
    assert.equal(await stored(), 'centro');
  });

  test('un valor que no es de la lista → 400 y no cambia nada', async () => {
    for (const v of ['left', '', null, 3, 'arriba']) {
      const r = await call('PUT', '/api/projects/proj-1', { image_position: v }, owner);
      assert.equal(r.status, 400, JSON.stringify(v));
    }
    assert.equal(await stored(), 'centro');
  });

  test('otra ONG no la cambia', async () => {
    assert.equal((await call('PUT', '/api/projects/proj-1', { image_position: 'top' }, other)).status, 404);
    assert.equal(await stored(), 'centro');
  });
});
