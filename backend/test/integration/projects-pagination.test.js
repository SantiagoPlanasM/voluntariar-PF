// test/integration/projects-pagination.test.js
//
// GET /api/projects sin paginación real (deuda conocida, aprobada por el usuario; §96):
//   - `limit`/`offset` iban con parseInt directo al SQL: `limit=abc` → `LIMIT NaN`; sin tope (`limit=100000`);
//   - el orden no tenía desempate: con proyectos empatados (mismo created_at, mismo puntaje) dos páginas
//     podían repetir uno y saltear otro.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('GET /api/projects: limit, offset y orden estable', () => {
  let server, db;
  const list = (qs) => fetch(`${server.baseUrl}/api/projects?${qs}`).then(async (r) => ({ status: r.status, body: await r.json() }));

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
    // 520 proyectos activos IDÉNTICOS salvo el id (mismo created_at y mismo puntaje): empates en los tres órdenes.
    const ngo = await db.get(`SELECT id FROM ngos WHERE id='ngo-1'`);
    const ids = Array.from({ length: 520 }, (_, i) => `pag-${String(i).padStart(3, '0')}`);
    await db.transaction(async (tx) => {
      for (const id of ids) {
        await tx.run(`INSERT INTO projects (id, ngo_id, titulo, descripcion, tipo, status, ubicacion, duracion, cupos,
          cupos_ocupados, created_at) VALUES ($1,$2,'Igual','Proyecto igual a los demás','fugaz','active','Córdoba','1 día',10,0,'2026-01-01 00:00:00')`,
        [id, ngo.id]);
      }
    });
  });
  after(async () => { if (server) await server.close(); });

  for (const qs of ['limit=abc', 'limit=-5', 'offset=abc', 'offset=-3', 'limit=abc&offset=xyz', 'limit=1.5']) {
    test(`${qs}: 200 con valores por defecto (antes LIMIT/OFFSET NaN)`, async () => {
      const r = await list(qs);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.ok(r.body.projects.length >= 1 && r.body.projects.length <= 20);
    });
  }

  test('sin limit: 20 (el default de siempre)', async () => {
    assert.equal((await list('')).body.projects.length, 20);
  });

  test('limit enorme: se acota a 500', async () => {
    const r = await list('limit=100000');
    assert.equal(r.status, 200);
    assert.equal(r.body.projects.length, 500);
  });

  for (const sort of ['featured', 'recent', 'rating']) {
    test(`sort=${sort}: las páginas con empates no se pisan ni dejan huecos`, async () => {
      const all = (await list(`sort=${sort}&limit=500`)).body.projects.map((p) => p.id);
      const pages = [];
      for (let off = 0; off < 60; off += 15) pages.push(...(await list(`sort=${sort}&limit=15&offset=${off}`)).body.projects.map((p) => p.id));
      assert.equal(new Set(pages).size, pages.length, 'sin repetidos entre páginas');
      assert.deepEqual(pages, all.slice(0, 60), 'las páginas, una detrás de otra, son el listado completo en orden');
    });
  }
});
