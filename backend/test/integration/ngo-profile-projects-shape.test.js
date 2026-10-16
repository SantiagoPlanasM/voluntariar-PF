// test/integration/ngo-profile-projects-shape.test.js
//
// REVISION A1 (tercera pasada): GET /api/ngos/:id armaba los proyectos con un SELECT propio de 8 campos, sin
// fmt(). El perfil público de la ONG (NGOPublicProfile.tsx) lee `duration` y `hours_per_week`: un sostenido
// mostraba "h/semana" sin el número. AI_RULES reglas 4, 7 y 10: el mismo recurso, la misma forma. Acá se
// compara cada proyecto del perfil contra el mismo proyecto en GET /api/projects (el listado, que también
// trae rating y seguidores de la ONG) y se fijan duración y horas contra la base.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Perfil público de ONG: los proyectos con la misma forma que el listado', () => {
  let server;
  let db;

  const get = (path) =>
    fetch(`${server.baseUrl}${path}`).then(async (r) => ({ status: r.status, body: await r.json() }));

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
  });
  after(async () => { if (server) await server.close(); });

  // Roles y requisitos salen sin orden en las dos consultas: se comparan ordenados.
  const normalize = (p) => ({ ...p, roles_needed: [...p.roles_needed].sort(), requirements: [...p.requirements].sort() });

  test('duración del fugaz y horas del sostenido, tomadas de la base', async () => {
    const rows = await db.all(
      `SELECT id, tipo, duracion, horas_semanales FROM projects WHERE ngo_id = 'ngo-1'`);
    const { status, body } = await get('/api/ngos/ngo-1');
    assert.equal(status, 200);
    assert.ok(rows.some((r) => r.tipo === 'sostenido'), 'el seed tiene un sostenido en ngo-1');
    assert.ok(rows.some((r) => r.tipo === 'fugaz'), 'el seed tiene un fugaz en ngo-1');
    assert.equal(body.projects.length, rows.length);
    for (const row of rows) {
      const p = body.projects.find((x) => x.id === row.id);
      assert.ok(p, `falta ${row.id}`);
      assert.equal(p.type, row.tipo, row.id);
      if (row.tipo === 'sostenido') {
        assert.equal(typeof p.hours_per_week, 'number', `${row.id}: hours_per_week`);
        assert.equal(p.hours_per_week, Number(row.horas_semanales), row.id);
      } else {
        assert.equal(p.duration, row.duracion, `${row.id}: duration`);
      }
    }
  });

  test('cada proyecto es igual (campos y valores) al del listado GET /api/projects', async () => {
    const profile = (await get('/api/ngos/ngo-1')).body.projects;
    const list = (await get('/api/projects?limit=500')).body.projects;
    assert.ok(profile.length > 0);
    for (const p of profile) {
      const inList = list.find((x) => x.id === p.id);
      assert.ok(inList, `${p.id} está en el listado`);
      assert.deepEqual(normalize(p), normalize(inList), p.id);
    }
    // La comparación no es vacía: hay roles, requisitos, categoría y rating en alguno.
    assert.ok(profile.some((p) => p.roles_needed.length > 0), 'algún proyecto con roles');
    assert.ok(profile.some((p) => p.requirements.length > 0), 'algún proyecto con requisitos');
    assert.ok(profile.every((p) => p.category !== ''), 'todos con categoría');
    assert.ok(profile.some((p) => p.avg_rating !== null && p.ratings_count > 0), 'alguno con reseñas');
  });

  test('ordenados del más nuevo al más viejo, como antes', async () => {
    // El seed crea los proyectos en el mismo segundo (SQLite): se fijan fechas distintas, en un orden que no
    // coincide con el de los ids ni con el de alta, para que el orden sea observable.
    await db.run(`UPDATE projects SET created_at = '2026-03-01 10:00:00' WHERE id = 'proj-1'`);
    await db.run(`UPDATE projects SET created_at = '2026-05-01 10:00:00' WHERE id = 'proj-5'`);
    await db.run(`UPDATE projects SET created_at = '2026-04-01 10:00:00' WHERE id = 'proj-7'`);
    const profile = (await get('/api/ngos/ngo-1')).body.projects;
    assert.deepEqual(profile.map((p) => p.id), ['proj-5', 'proj-7', 'proj-1']);
  });

  test('un proyecto con dos categorías aparece una sola vez (antes el JOIN lo duplicaba)', async () => {
    const otra = await db.get(
      `SELECT c.id FROM categorias c
       WHERE c.id NOT IN (SELECT categoria_id FROM project_categorias WHERE project_id = 'proj-7') LIMIT 1`);
    assert.ok(otra, 'hay otra categoría para agregar');
    await db.run('INSERT INTO project_categorias (project_id, categoria_id) VALUES ($1, $2)', ['proj-7', otra.id]);
    const profile = (await get('/api/ngos/ngo-1')).body.projects;
    const ids = profile.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, `ids repetidos: ${ids.join(', ')}`);
    assert.equal(ids.filter((id) => id === 'proj-7').length, 1);
  });

  test('una ONG sin proyectos devuelve la lista vacía', async () => {
    const sin = await db.get(`SELECT n.id FROM ngos n WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.ngo_id = n.id) LIMIT 1`);
    if (!sin) {
      await db.run(`INSERT INTO users (id, name, email, password, role) VALUES ('user-ngo-a1', 'ONG A1', 'a1@ong.test', 'x', 'ngo')`);
      await db.run(`INSERT INTO ngos (id, user_id, nombre) VALUES ('ngo-a1', 'user-ngo-a1', 'ONG sin proyectos')`);
    }
    const { status, body } = await get(`/api/ngos/${sin ? sin.id : 'ngo-a1'}`);
    assert.equal(status, 200);
    assert.deepEqual(body.projects, []);
  });
});
