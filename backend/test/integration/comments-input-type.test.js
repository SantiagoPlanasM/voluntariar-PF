// test/integration/comments-input-type.test.js — POST /api/projects/:id/comments con un `comment` que no es texto
// (número, objeto, array, booleano) reventaba en `.trim()` y respondía 500. Ahora: 400 en español y no se guarda
// nada. Además, tope de 1000 caracteres, el mismo que el comentario de una reseña (POST /:id/ratings).
// `null` o ausente siguen dando el 400 "Comentario muy corto" de siempre.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Comentarios de proyecto: el comentario tiene que ser un texto', () => {
  let server, token;
  const db = () => require('../../src/db');
  const count = async () => Number((await db().get(`SELECT COUNT(*) AS n FROM comments WHERE project_id='proj-1'`)).n) || 0;
  const post = (body) => fetch(`${server.baseUrl}/api/projects/proj-1/comments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

  before(async () => {
    server = await setupTestServer({ seed: true });
    const r = await fetch(`${server.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maria@example.com', password: 'Password1' }) });
    token = (await r.json()).token;
  });
  after(async () => { if (server) await server.close(); });

  test('número, objeto, array o booleano → 400 "tiene que ser un texto" (antes 500) y no se crea nada', async () => {
    const antes = await count();
    for (const value of [123, 0, { text: 'Hola a todos' }, ['Hola a todos'], true, false]) {
      const r = await post({ comment: value });
      assert.deepEqual([r.status, r.body.error], [400, 'El comentario tiene que ser un texto'], JSON.stringify(value));
    }
    assert.equal(await count(), antes);
  });

  test('null o ausente → el 400 "Comentario muy corto" de siempre', async () => {
    const antes = await count();
    for (const body of [{ comment: null }, {}]) {
      const r = await post(body);
      assert.deepEqual([r.status, r.body.error], [400, 'Comentario muy corto'], JSON.stringify(body));
    }
    assert.equal(await count(), antes);
  });

  test('texto corto (menos de 3 sin espacios) → "Comentario muy corto"', async () => {
    const r = await post({ comment: '  ab  ' });
    assert.deepEqual([r.status, r.body.error], [400, 'Comentario muy corto']);
  });

  test('1001 caracteres → 400 con el tope; 1000 justos → 201', async () => {
    const antes = await count();
    const largo = await post({ comment: 'x'.repeat(1001) });
    assert.deepEqual([largo.status, largo.body.error], [400, 'El comentario puede tener hasta 1000 caracteres']);
    assert.equal(await count(), antes);

    const justo = await post({ comment: 'x'.repeat(1000) });
    assert.equal(justo.status, 201, JSON.stringify(justo.body));
    assert.equal(justo.body.comment.comment, 'x'.repeat(1000));
    assert.equal(await count(), antes + 1);
  });

  test('un comentario normal se sigue publicando (recortado)', async () => {
    const r = await post({ comment: '  Me sumo el sábado  ' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.comment.comment, 'Me sumo el sábado');
  });
});
