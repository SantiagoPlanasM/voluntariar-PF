// test/integration/enrollments-hours-validation.test.js
//
// PATCH /api/enrollments/:id/horas (REVISION.md B14): validaba con parseFloat + isNaN. "1e400" (o el número
// 1e400 en el JSON, que JSON.parse convierte en Infinity) pasaba como Infinity, se guardaba, y los totales
// de horas quedaban rotos. "12abc" se guardaba como 12 en silencio. Ahora: número finito entre 0 y 10000.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('PATCH /api/enrollments/:id/horas: validación', () => {
  let server;
  let baseUrl;
  let db;
  let ngo;
  let enrollmentId; // inscripción aprobada de María en proj-1 (de Sustentando)

  const patchRaw = (rawBody) =>
    fetch(`${baseUrl}/api/enrollments/${enrollmentId}/horas`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ngo}` }, body: rawBody,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const patch = (horas) => patchRaw(JSON.stringify({ horas }));
  const stored = async () => (await db.get('SELECT horas_realizadas AS h FROM enrollments WHERE id=$1', [enrollmentId])).h;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    ngo = (await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sustentando.org', password: 'Password1' }),
    }).then((x) => x.json())).token;
    enrollmentId = (await db.get(`SELECT id FROM enrollments WHERE user_id='user-vol-1' AND project_id='proj-1'`)).id;
    assert.equal((await patch(3)).status, 200); // punto de partida conocido
  });

  after(async () => {
    if (server) await server.close();
  });

  for (const [label, send] of [
    ['"1e400" (string)', () => patch('1e400')],
    ['1e400 crudo en el JSON (Infinity)', () => patchRaw('{"horas":1e400}')],
    ['"12abc"', () => patch('12abc')],
    ['10001 (más del tope)', () => patch(10001)],
    ['-1', () => patch(-1)],
    ['"" (vacío)', () => patch('')],
    ['null', () => patch(null)],
    ['un array', () => patch([5])],
  ]) {
    test(`${label} → 400 y no cambia las horas`, async () => {
      const r = await send();
      assert.equal(r.status, 400);
      assert.equal(typeof r.body.error, 'string');
      assert.equal(Number(await stored()), 3);
    });
  }

  for (const [label, horas, expected] of [['7.5', 7.5, 7.5], ['"7.5" (string)', '7.5', 7.5], ['0', 0, 0], ['10000 (el tope)', 10000, 10000]]) {
    test(`${label} → 200 y se guarda ${expected}`, async () => {
      const r = await patch(horas);
      assert.equal(r.status, 200);
      assert.equal(Number(await stored()), expected);
    });
  }
});
