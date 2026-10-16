// test/integration/ratings-concurrency.test.js
//
// POST /api/projects/:id/ratings con pedidos SIMULTÁNEOS del mismo usuario al mismo proyecto
// (PROJECT_ANALYSIS.md §154). La ruta hacía "SELECT ¿ya calificó?" y después UPDATE o INSERT: dos
// primeras calificaciones a la vez pasaban las dos el SELECT sin fila e intentaban insertar. No se
// duplicaba la reseña porque `ratings` tiene UNIQUE(user_id, project_id) desde el primer esquema,
// pero el que perdía la carrera chocaba con ese UNIQUE y respondía 500 "Error al calificar".
// Hoy es un upsert atómico (INSERT … ON CONFLICT (user_id, project_id) DO UPDATE).
//
// Corre en los dos motores; la prueba que importa es `npm run test:pg` (pool, READ COMMITTED).
// Como en follows-sponsorship-concurrency.test.js, se verifican invariantes (una sola fila, todas
// 200, el valor guardado es uno de los enviados), no "quién ganó", que no es determinista.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('POST /api/projects/:id/ratings concurrente', () => {
  let server, baseUrl, db, lucia, luciaId;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
  });
  after(async () => { if (server) await server.close(); });

  const call = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const burst = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)));
  const statuses = (rs) => rs.map((r) => r.status).join(',');
  const rate = (projectId, body) => call(`/api/projects/${projectId}/ratings`, { token: lucia, method: 'POST', body });
  const rowsOf = (projectId) => db.all(
    'SELECT id, rating, comment, created_at FROM ratings WHERE user_id=$1 AND project_id=$2', [luciaId, projectId]);

  // Lucía (seed: aprobada solo en proj-4, que ya calificó) queda aprobada en proj-2 y proj-5, sin reseña.
  before(async () => {
    const r = await call('/api/auth/login', { method: 'POST', body: { email: 'lucia@example.com', password: 'Password1' } });
    assert.equal(r.status, 200);
    lucia = r.body.token; luciaId = r.body.user.id;
    for (const p of ['proj-2', 'proj-5']) {
      await db.run(`INSERT INTO enrollments (user_id, project_id, status) VALUES ($1,$2,'approved')`, [luciaId, p]);
      assert.equal((await rowsOf(p)).length, 0, `${p}: arranca sin reseña`);
    }
  });

  test('8 primeras calificaciones simultáneas: todas 200 con el mismo cuerpo y una sola fila', async () => {
    const rs = await burst(8, (i) => rate('proj-2', { rating: (i % 5) + 1, comment: `Reseña ${i}` }));

    assert.ok(rs.every((r) => r.status === 200), `todas deberían ser 200: ${statuses(rs)}`);
    for (const r of rs) assert.deepEqual(r.body, { message: 'Calificación guardada' });
    const rows = await rowsOf('proj-2');
    assert.equal(rows.length, 1, 'una sola reseña por usuario y proyecto');
    const i = Number(rows[0].comment.replace('Reseña ', ''));
    assert.equal(rows[0].rating, (i % 5) + 1, 'la nota guardada es la que vino con ese comentario (mismo pedido)');
  });

  test('calificar de nuevo actualiza la misma fila (mismo id y created_at) y el comentario omitido queda en null', async () => {
    const { toMillis } = require('../../src/lib/time');
    // Fecha vieja conocida: si el upsert pisara created_at se notaría (SQLite guarda segundos y el alta
    // del test anterior fue en el mismo segundo; String(Date) de Postgres tampoco muestra milisegundos).
    await db.run(`UPDATE ratings SET created_at='2026-01-02 03:04:05' WHERE user_id=$1 AND project_id='proj-2'`, [luciaId]);
    const [prev] = await rowsOf('proj-2');
    const r = await rate('proj-2', { rating: 3 });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { message: 'Calificación guardada' });

    const rows = await rowsOf('proj-2');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, prev.id, 'no se crea una fila nueva');
    assert.equal(toMillis(rows[0].created_at), toMillis(prev.created_at), 'la fecha de la reseña no cambia');
    assert.equal(rows[0].rating, 3);
    assert.equal(rows[0].comment, null);
  });

  test('la primera calificación guarda nota y comentario, y no toca reseñas de otros usuarios', async () => {
    const othersBefore = await db.all(
      'SELECT id, rating, comment FROM ratings WHERE user_id<>$1 ORDER BY id', [luciaId]);
    const r = await rate('proj-5', { rating: 4, comment: 'Muy linda jornada' });
    assert.equal(r.status, 200);

    const rows = await rowsOf('proj-5');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].rating, 4);
    assert.equal(rows[0].comment, 'Muy linda jornada');
    assert.ok(rows[0].id, 'tiene id');
    assert.deepEqual(await db.all(
      'SELECT id, rating, comment FROM ratings WHERE user_id<>$1 ORDER BY id', [luciaId]), othersBefore);
  });

  test('re-calificaciones simultáneas: todas 200 y sigue habiendo una sola fila', async () => {
    const rs = await burst(8, (i) => rate('proj-5', { rating: (i % 5) + 1, comment: `Otra ${i}` }));
    assert.ok(rs.every((r) => r.status === 200), statuses(rs));
    const rows = await rowsOf('proj-5');
    assert.equal(rows.length, 1);
    assert.match(rows[0].comment, /^Otra \d$/);
  });

  test('el esquema migrado rechaza una segunda reseña del mismo usuario al mismo proyecto (el upsert depende de ese UNIQUE)', async () => {
    const { isUniqueViolation } = require('../../src/lib/dbErrors');
    await assert.rejects(
      db.run(`INSERT INTO ratings (project_id, user_id, rating) VALUES ('proj-5', $1, 2)`, [luciaId]),
      (err) => isUniqueViolation(err),
    );
    assert.equal((await rowsOf('proj-5')).length, 1);
  });
});
