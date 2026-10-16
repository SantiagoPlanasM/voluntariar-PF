// test/integration/ngo-own-projects-shape.test.js
//
// REVISION B4 (tercera pasada): GET /api/ngos/me armaba los proyectos con `SELECT * FROM projects` (sin
// categoría, roles ni requisitos: salían `category: ''` y listas vacías en NGODashboard y NGOOwnProfile) y
// GET /api/ngos/:id/projects traía la categoría con el alias `category`, que fmt() no lee (lee
// `category_name`/`categoria`): también `''`, y el JOIN repetía el proyecto con dos categorías.
// AI_RULES reglas 4, 7 y 10: el mismo recurso, la misma forma. Como en ngo-profile-projects-shape.test.js
// (REVISION A1, GET /api/ngos/:id), cada proyecto se compara contra el mismo en el listado GET /api/projects.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Proyectos de la propia ONG y de /ngos/:id/projects: la misma forma que el listado', () => {
  let server;
  let db;
  let token;

  const get = (path, tk) =>
    fetch(`${server.baseUrl}${path}`, { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })
      .then(async (r) => ({ status: r.status, body: await r.json() }));

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
    const r = await fetch(`${server.baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sustentando.org', password: 'Password1' }),
    });
    token = (await r.json()).token;
    assert.ok(token, 'login de la ONG del seed');
  });
  after(async () => { if (server) await server.close(); });

  // Roles y requisitos salen sin orden en las dos consultas: se comparan ordenados.
  const normalize = (p) => ({ ...p, roles_needed: [...p.roles_needed].sort(), requirements: [...p.requirements].sort() });

  const sameAsList = async (projects, where) => {
    const list = (await get('/api/projects?limit=500')).body.projects;
    const own = await db.all(`SELECT id FROM projects WHERE ngo_id = 'ngo-1'`);
    assert.equal(projects.length, own.length, `${where}: todos los proyectos de ngo-1`);
    for (const p of projects) {
      const inList = list.find((x) => x.id === p.id);
      assert.ok(inList, `${where}: ${p.id} está en el listado`);
      assert.deepEqual(normalize(p), normalize(inList), `${where}: ${p.id}`);
    }
    // La comparación no es vacía: hay roles, requisitos, categoría y rating en alguno.
    assert.ok(projects.some((p) => p.roles_needed.length > 0), `${where}: algún proyecto con roles`);
    assert.ok(projects.some((p) => p.requirements.length > 0), `${where}: algún proyecto con requisitos`);
    assert.ok(projects.every((p) => p.category !== ''), `${where}: todos con categoría`);
    assert.ok(projects.some((p) => p.avg_rating !== null && p.ratings_count > 0), `${where}: alguno con reseñas`);
  };

  test('GET /ngos/me: cada proyecto es igual (campos y valores) al del listado', async () => {
    const { status, body } = await get('/api/ngos/me', token);
    assert.equal(status, 200);
    await sameAsList(body.projects, 'GET /ngos/me');
  });

  test('GET /ngos/:id/projects: cada proyecto es igual (campos y valores) al del listado', async () => {
    const { status, body } = await get('/api/ngos/ngo-1/projects');
    assert.equal(status, 200);
    await sameAsList(body.projects, 'GET /ngos/:id/projects');
  });

  // El dashboard de la ONG tenía su propio `SELECT * FROM projects` (sin categoría, roles, requisitos ni rating).
  test('GET /ngos/:id/dashboard: cada proyecto es igual (campos y valores) al del listado', async () => {
    const { status, body } = await get('/api/ngos/ngo-1/dashboard', token);
    assert.equal(status, 200);
    await sameAsList(body.projects, 'GET /ngos/:id/dashboard');
  });

  test('los cuatro endpoints de la ONG devuelven los mismos proyectos, en el mismo orden', async () => {
    // Fechas distintas en un orden que no coincide con el de los ids (el seed crea todo en el mismo segundo).
    await db.run(`UPDATE projects SET created_at = '2026-03-01 10:00:00' WHERE id = 'proj-1'`);
    await db.run(`UPDATE projects SET created_at = '2026-05-01 10:00:00' WHERE id = 'proj-5'`);
    await db.run(`UPDATE projects SET created_at = '2026-04-01 10:00:00' WHERE id = 'proj-7'`);
    const profile = (await get('/api/ngos/ngo-1')).body.projects;
    const me = (await get('/api/ngos/me', token)).body.projects;
    const byId = (await get('/api/ngos/ngo-1/projects')).body.projects;
    const dashboard = (await get('/api/ngos/ngo-1/dashboard', token)).body.projects;
    assert.deepEqual(profile.map((p) => p.id), ['proj-5', 'proj-7', 'proj-1']);
    assert.deepEqual(me.map(normalize), profile.map(normalize));
    assert.deepEqual(byId.map(normalize), profile.map(normalize));
    assert.deepEqual(dashboard.map(normalize), profile.map(normalize));
  });

  test('un proyecto con dos categorías aparece una sola vez en /ngos/:id/projects y en /ngos/me', async () => {
    const otra = await db.get(
      `SELECT c.id FROM categorias c
       WHERE c.id NOT IN (SELECT categoria_id FROM project_categorias WHERE project_id = 'proj-1') LIMIT 1`);
    assert.ok(otra, 'hay otra categoría para agregar');
    await db.run('INSERT INTO project_categorias (project_id, categoria_id) VALUES ($1, $2)', ['proj-1', otra.id]);
    for (const [path, tk] of [['/api/ngos/ngo-1/projects'], ['/api/ngos/me', token], ['/api/ngos/ngo-1/dashboard', token]]) {
      const ids = (await get(path, tk)).body.projects.map((p) => p.id);
      assert.equal(ids.filter((id) => id === 'proj-1').length, 1, `${path}: ${ids.join(', ')}`);
    }
  });

  test('GET /ngos/:id/projects?status= sigue filtrando, con la misma forma', async () => {
    await db.run(`UPDATE projects SET status = 'completed' WHERE id = 'proj-5'`);
    const completed = (await get('/api/ngos/ngo-1/projects?status=completed')).body.projects;
    assert.deepEqual(completed.map((p) => p.id), ['proj-5']);
    assert.equal(completed[0].status, 'completed');
    assert.notEqual(completed[0].category, '');
    const active = (await get('/api/ngos/ngo-1/projects?status=active')).body.projects;
    assert.deepEqual(active.map((p) => p.id), ['proj-7', 'proj-1']);
  });

  test('el dashboard trae los proyectos de todos los estados (no solo los activos)', async () => {
    await db.run(`UPDATE projects SET status = 'completed' WHERE id = 'proj-5'`);
    const { status, body } = await get('/api/ngos/ngo-1/dashboard', token);
    assert.equal(status, 200);
    const p5 = body.projects.find((p) => p.id === 'proj-5');
    assert.ok(p5, 'proj-5 (completed) está en el dashboard');
    assert.equal(p5.status, 'completed');
    assert.equal(body.stats.completed_projects, 1);
  });

  test('una ONG sin proyectos: lista vacía en /ngos/:id/projects', async () => {
    await db.run(`INSERT INTO users (id, name, email, password, role) VALUES ('user-ngo-b4', 'ONG B4', 'b4@ong.test', 'x', 'ngo')`);
    await db.run(`INSERT INTO ngos (id, user_id, nombre) VALUES ('ngo-b4', 'user-ngo-b4', 'ONG sin proyectos')`);
    const { status, body } = await get('/api/ngos/ngo-b4/projects');
    assert.equal(status, 200);
    assert.deepEqual(body.projects, []);
  });

  test('con la misma fecha, desempata por id (como el listado), no por orden de alta', async () => {
    // Se insertan al revés del orden de sus ids: sin el desempate, el orden queda librado al motor.
    for (const id of ['b4-z', 'b4-m', 'b4-a']) {
      await db.run(`INSERT INTO projects (id, ngo_id, titulo, descripcion, tipo, status, ubicacion, duracion, cupos,
        cupos_ocupados, created_at) VALUES ($1,'ngo-b4','Igual','Proyecto igual','fugaz','active','Córdoba','1 día',10,0,'2026-01-01 00:00:00')`,
      [id]);
    }
    const ids = (await get('/api/ngos/ngo-b4/projects')).body.projects.map((p) => p.id);
    assert.deepEqual(ids, ['b4-a', 'b4-m', 'b4-z']);
  });
});
