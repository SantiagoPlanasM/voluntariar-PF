// test/integration/comments-badwords.test.js — REVISION B7 de punta a punta: un comentario con "computadora"
// (contiene "puta") daba 400 "palabras no permitidas"; ahora pasa. La palabra sola sigue rechazada.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Comentarios: filtro por palabras completas', () => {
  let server, token;
  const comment = (text) => fetch(`${server.baseUrl}/api/projects/proj-1/comments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ comment: text }),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

  before(async () => {
    server = await setupTestServer({ seed: true });
    const r = await fetch(`${server.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maria@example.com', password: 'Password1' }) });
    token = (await r.json()).token;
  });
  after(async () => { if (server) await server.close(); });

  test('"Traigan la computadora" se publica (antes 400)', async () => {
    const r = await comment('Traigan la computadora para el registro');
    assert.equal(r.status, 201, JSON.stringify(r.body));
  });

  test('la palabra sola sigue rechazada, también con acento', async () => {
    for (const t of ['Qué imbécil el que tiró basura', 'sos un BOLUDO']) {
      const r = await comment(t);
      assert.deepEqual([r.status, r.body.error], [400, 'El comentario contiene palabras no permitidas'], t);
    }
  });

  // Las calificaciones no pasaban por el filtro (PROJECT_ANALYSIS §104): "Qué imbécil…" se guardaba y se veía
  // en la pestaña Reseñas. María tiene inscripción aprobada en proj-1, así que puede calificar.
  describe('comentario de una calificación', () => {
    const db = () => require('../../src/db');
    const rate = (body) => fetch(`${server.baseUrl}/api/projects/proj-1/ratings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));
    const myRating = () => db().get(`SELECT rating, comment FROM ratings WHERE user_id='user-vol-1' AND project_id='proj-1'`);

    test('con una palabra de la lista → 400 y la calificación anterior no cambia', async () => {
      const before = await myRating();
      for (const t of ['Qué imbécil el coordinador', 'sos un BOLUDO']) {
        const r = await rate({ rating: 1, comment: t });
        assert.deepEqual([r.status, r.body.error], [400, 'El comentario contiene palabras no permitidas'], t);
      }
      assert.deepEqual(await myRating(), before);
    });

    test('"computadora" (contiene "puta") se guarda: mismo criterio de palabra completa', async () => {
      const r = await rate({ rating: 4, comment: 'Traigan la computadora para el registro' });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal((await myRating()).comment, 'Traigan la computadora para el registro');
    });
  });
});
