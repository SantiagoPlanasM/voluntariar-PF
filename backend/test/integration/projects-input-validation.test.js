// test/integration/projects-input-validation.test.js
//
// Entradas inválidas que terminaban en 500 en vez de 400 (REVISION.md B10, B11):
//   - POST /projects/:id/ratings: `rating: "abc"` pasaba la validación (`"abc" < 1` es false) y reventaba
//     en el CHECK de la base; `3.5` lo guardaba SQLite y en Postgres (INTEGER) daba 500.
//   - PUT /projects/:id: un `status` fuera de active/completed/cancelled reventaba en el CHECK.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('projects.js: entradas inválidas → 400', () => {
  let server;
  let baseUrl;
  let db;
  let maria; // inscripción aprobada en proj-1 (puede calificar)
  let ngo;   // Sustentando, dueña de proj-1

  const api = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const login = async (email) =>
    (await api('/api/auth/login', { method: 'POST', body: { email, password: 'Password1' } })).body.token;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    maria = await login('maria@example.com');
    ngo = await login('admin@sustentando.org');
  });

  after(async () => {
    if (server) await server.close();
  });

  const myRating = async () =>
    db.get(`SELECT rating, comment FROM ratings WHERE user_id='user-vol-1' AND project_id='proj-1'`);

  describe('POST /projects/:id/ratings', () => {
    for (const [label, rating] of [['"abc"', 'abc'], ['3.5', 3.5], ['0', 0], ['6', 6], ['null', null], ['un array', [4]], ['"4.0x"', '4.0x']]) {
      test(`rating ${label} → 400 y no cambia la calificación existente`, async () => {
        const before = await myRating(); // el seed ya tiene una de María en proj-1 (5)
        const r = await api('/api/projects/proj-1/ratings', { token: maria, method: 'POST', body: { rating } });
        assert.equal(r.status, 400);
        assert.equal(typeof r.body.error, 'string');
        assert.deepEqual(await myRating(), before);
      });
    }

    test('comment que no es texto → 400', async () => {
      const before = await myRating();
      const r = await api('/api/projects/proj-1/ratings', { token: maria, method: 'POST', body: { rating: 4, comment: { x: 1 } } });
      assert.equal(r.status, 400);
      assert.deepEqual(await myRating(), before);
    });

    test('comment de más de 1000 caracteres → 400', async () => {
      const r = await api('/api/projects/proj-1/ratings', { token: maria, method: 'POST', body: { rating: 4, comment: 'x'.repeat(1001) } });
      assert.equal(r.status, 400);
    });

    test('comment de exactamente 1000 caracteres → 200 (el tope es inclusivo)', async () => {
      const r = await api('/api/projects/proj-1/ratings', { token: maria, method: 'POST', body: { rating: 5, comment: 'y'.repeat(1000) } });
      assert.equal(r.status, 200);
      assert.equal((await myRating()).comment.length, 1000);
    });

    test('rating 4 (o "4") con comentario → 200 y se guarda como número', async () => {
      const r = await api('/api/projects/proj-1/ratings', { token: maria, method: 'POST', body: { rating: '4', comment: 'Muy bueno' } });
      assert.equal(r.status, 200);
      const row = await myRating();
      assert.equal(Number(row.rating), 4);
      assert.equal(row.comment, 'Muy bueno');
    });
  });

  describe('PUT /projects/:id → status', () => {
    const base = { title: 'Reforestación Urbana', description: 'Plantación de árboles nativos', location: 'Córdoba', type: 'fugaz', duration: '1 día' };

    test('status inválido → 400 y el proyecto no cambia', async () => {
      const before = await db.get(`SELECT titulo, status FROM projects WHERE id='proj-1'`);
      const r = await api('/api/projects/proj-1', { token: ngo, method: 'PUT', body: { ...base, title: 'Cambiado', status: 'borrado' } });
      assert.equal(r.status, 400);
      assert.deepEqual(await db.get(`SELECT titulo, status FROM projects WHERE id='proj-1'`), before);
    });

    test('status válido (completed) → 200', async () => {
      const r = await api('/api/projects/proj-1', { token: ngo, method: 'PUT', body: { ...base, status: 'completed' } });
      assert.equal(r.status, 200);
      assert.equal((await db.get(`SELECT status FROM projects WHERE id='proj-1'`)).status, 'completed');
    });
  });
});
