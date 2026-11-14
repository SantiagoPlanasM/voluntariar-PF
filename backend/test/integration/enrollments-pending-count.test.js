// test/integration/enrollments-pending-count.test.js — GET /api/enrollments/pending-count (§336).
//
// El contador de "Postulaciones" en la barra lateral de la ONG. Quedó afuera en §320 porque la única forma de saber
// cuántas hay sin responder era GET /ngos/me (el panel entero, con cada postulación y su entrevista). Este endpoint
// devuelve solo el número: las postulaciones `pending` de los voluntariados de la ONG de quien pregunta.
//   - cuenta las mismas que el Panel (`pending_enrollments` de GET /ngos/me);
//   - no cuenta las de otra ONG ni las que ya se respondieron o cancelaron;
//   - es un número (en Postgres COUNT llega como string);
//   - solo para el rol ONG.
// Seed: Sustentando (ngo-1) y GreenCba (ngo-2).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setupTestServer } = require('./helpers');

describe('GET /api/enrollments/pending-count', () => {
  let server, baseUrl, db, ngo, other, n = 0;

  async function call(method, path, body, token) {
    const r = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }
  const login = async (email) => (await call('POST', '/api/auth/login', { email, password: 'Password1' })).body.token;
  const volunteer = async () => {
    n += 1;
    const r = await call('POST', '/api/auth/register',
      { name: 'Cuenta Prueba', email: `cuenta-${n}-${Date.now()}@example.com`, password: 'Password1', role: 'volunteer' });
    return { token: r.body.token, id: r.body.user.id };
  };
  const project = async (ngoId) => {
    const id = randomUUID();
    await db.run(`INSERT INTO projects (id, ngo_id, titulo, descripcion, ubicacion, cupos) VALUES ($1,$2,'Para contar','d','Córdoba',10)`, [id, ngoId]);
    return id;
  };
  const enroll = async (v, projectId) => {
    const r = await call('POST', '/api/enrollments', { project_id: projectId }, v.token);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.enrollment.id;
  };
  const pending = async (token) => {
    const r = await call('GET', '/api/enrollments/pending-count', undefined, token);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    ngo = await login('admin@sustentando.org');
    other = await login('admin@greencba.org');
  });
  after(async () => { if (server) await server.close(); });

  test('es un número y coincide con las pendientes del Panel', async () => {
    const body = await pending(ngo);
    assert.deepEqual(Object.keys(body), ['pending']);
    assert.equal(typeof body.pending, 'number');
    const panel = await call('GET', '/api/ngos/me', undefined, ngo);
    assert.equal(body.pending, panel.body.pending_enrollments.length);
  });

  test('sube con cada postulación a un voluntariado propio; las de otra ONG no cuentan', async () => {
    const mine = await project('ngo-1');
    const theirs = await project('ngo-2');
    const [a, b] = [await pending(ngo), await pending(other)];
    await enroll(await volunteer(), mine);
    await enroll(await volunteer(), mine);
    await enroll(await volunteer(), theirs);
    assert.equal((await pending(ngo)).pending, a.pending + 2);
    assert.equal((await pending(other)).pending, b.pending + 1);
  });

  test('baja cuando se responde (aprobada o rechazada) y cuando el voluntario cancela', async () => {
    const p = await project('ngo-1');
    const base = (await pending(ngo)).pending;
    const [v1, v2, v3] = [await volunteer(), await volunteer(), await volunteer()];
    const e1 = await enroll(v1, p);
    const e2 = await enroll(v2, p);
    const e3 = await enroll(v3, p);
    assert.equal((await pending(ngo)).pending, base + 3);
    assert.equal((await call('PATCH', `/api/enrollments/${e1}`, { status: 'approved' }, ngo)).status, 200);
    assert.equal((await pending(ngo)).pending, base + 2);
    assert.equal((await call('PATCH', `/api/enrollments/${e2}`, { status: 'rejected' }, ngo)).status, 200);
    assert.equal((await pending(ngo)).pending, base + 1);
    assert.equal((await call('DELETE', `/api/enrollments/${e3}`, undefined, v3.token)).status, 200);
    assert.equal((await pending(ngo)).pending, base);
  });

  test('una ONG sin postulaciones pendientes: 0 (número, no null ni "0")', async () => {
    const r = await call('POST', '/api/auth/register',
      { name: 'ONG Nueva', email: `ong-cuenta-${Date.now()}@example.com`, password: 'Password1', role: 'ngo' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.deepEqual(await pending(r.body.token), { pending: 0 });
  });

  test('sin sesión: 401; un voluntario o una empresa: 403', async () => {
    assert.equal((await call('GET', '/api/enrollments/pending-count')).status, 401);
    const v = await volunteer();
    assert.equal((await call('GET', '/api/enrollments/pending-count', undefined, v.token)).status, 403);
    const company = await login('admin@techcorp.com');
    assert.equal((await call('GET', '/api/enrollments/pending-count', undefined, company)).status, 403);
  });
});
