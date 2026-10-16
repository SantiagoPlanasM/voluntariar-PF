// test/integration/projects-partial-update.test.js
//
// PUT /api/projects/:id parcial (deuda conocida "PUT no parcial", aprobada por el usuario; §95). Antes:
//   - un campo que no venía se pisaba: título/descripción/ubicación a NULL, `status` a 'active' (¡reactivaba un
//     proyecto terminado!), montos a 0, horas y textos opcionales a NULL;
//   - respondía roles/requisitos/categoría tomados del BODY, pero no los guardaba;
//   - validaba mucho menos que el alta.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('PUT /api/projects/:id — actualización parcial', () => {
  let server, db, ngo1, projectId;

  const call = (path, { method = 'GET', body } = {}) => fetch(`${server.baseUrl}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ngo1}` },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const put = (body) => call(`/api/projects/${projectId}`, { method: 'PUT', body });
  const row = () => db.get(`SELECT titulo, descripcion, descripcion_full, foto_perfil, ubicacion, tipo, status, duracion,
    cupos, meta_financiera, costo, horas_semanales FROM projects WHERE id=$1`, [projectId]);
  const assoc = async () => ({
    roles: (await db.all(`SELECT ro.nombre FROM project_roles pr JOIN roles ro ON ro.id=pr.rol_id WHERE pr.project_id=$1 ORDER BY ro.nombre`, [projectId])).map((r) => r.nombre),
    reqs: (await db.all('SELECT descripcion FROM requisitos WHERE project_id=$1 ORDER BY descripcion', [projectId])).map((r) => r.descripcion),
    cat: (await db.get(`SELECT c.nombre FROM project_categorias pc JOIN categorias c ON c.id=pc.categoria_id WHERE pc.project_id=$1`, [projectId]))?.nombre ?? null,
  });

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
    const l = await fetch(`${server.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sustentando.org', password: 'Password1' }) });
    ngo1 = (await l.json()).token;
    const c = await call('/api/projects', { method: 'POST', body: {
      title: 'Huerta en la escuela', description: 'Armamos una huerta con los chicos del barrio',
      full_description: 'Detalle largo', image: 'https://x/huerta.jpg', location: 'Córdoba', type: 'sostenido',
      hours_per_week: 4, volunteers_needed: 12, funding_goal: 5000, cost_per_person: 100,
      category: 'Medio Ambiente', roles_needed: ['Jardinero'], requirements: ['Traer guantes'] } });
    assert.equal(c.status, 201, JSON.stringify(c.body));
    projectId = c.body.project.id;
  });
  after(async () => { if (server) await server.close(); });

  test('cambiar solo el título no toca nada más', async () => {
    const before = await row();
    const r = await put({ title: 'Huerta comunitaria en la escuela' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(await row(), { ...before, titulo: 'Huerta comunitaria en la escuela' });
    assert.deepEqual(await assoc(), { roles: ['Jardinero'], reqs: ['Traer guantes'], cat: 'Medio Ambiente' });
  });

  test('un proyecto terminado sigue terminado si no se manda status (antes volvía a active)', async () => {
    assert.equal((await put({ status: 'completed' })).status, 200);
    assert.equal((await put({ description: 'Armamos una huerta grande con los chicos' })).status, 200);
    assert.equal((await row()).status, 'completed');
    assert.equal((await put({ status: 'active' })).status, 200);
  });

  test('roles, requisitos y categoría que vienen se GUARDAN (y la respuesta sale de la base)', async () => {
    const r = await put({ roles_needed: ['Cocinero', 'Fotógrafo'], requirements: ['Gorra', 'Agua'], category: 'Educación' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(await assoc(), { roles: ['Cocinero', 'Fotógrafo'], reqs: ['Agua', 'Gorra'], cat: 'Educación' });
    assert.deepEqual([...r.body.project.roles_needed].sort(), ['Cocinero', 'Fotógrafo']);
    assert.deepEqual([...r.body.project.requirements].sort(), ['Agua', 'Gorra']);
    assert.equal(r.body.project.category, 'Educación');
  });

  test('si no vienen, quedan como estaban (antes la respuesta decía [] aunque estuvieran)', async () => {
    const r = await put({ cost_per_person: 0 });
    assert.equal(r.status, 200);
    assert.deepEqual([...r.body.project.roles_needed].sort(), ['Cocinero', 'Fotógrafo']);
    assert.equal(r.body.project.category, 'Educación');
    assert.deepEqual(await assoc(), { roles: ['Cocinero', 'Fotógrafo'], reqs: ['Agua', 'Gorra'], cat: 'Educación' });
  });

  test('listas vacías y categoría vacía los borran', async () => {
    assert.equal((await put({ roles_needed: [], requirements: [], category: '' })).status, 200);
    assert.deepEqual(await assoc(), { roles: [], reqs: [], cat: null });
  });

  test('null en un texto opcional lo borra; en uno obligatorio es inválido', async () => {
    assert.equal((await put({ full_description: null, image: null })).status, 200);
    const r = await row();
    assert.deepEqual([r.descripcion_full, r.foto_perfil], [null, null]);
    assert.equal((await put({ title: null })).status, 400);
  });

  const BAD = [
    ['título vacío', { title: '' }],
    ['descripción corta', { description: 'corta' }],
    ['ubicación vacía', { location: '  ' }],
    ['tipo inválido', { type: 'eterno' }],
    ['tipo null', { type: null }],
    ['cupos de más (antes 500 en Postgres, REVISION A3)', { volunteers_needed: 1e10 }],
    ['horas de más (antes 500 en Postgres, REVISION A3)', { type: 'sostenido', hours_per_week: 1e10 }],
    ['sostenido sin horas', { type: 'sostenido', hours_per_week: 0 }],
    ['meta no numérica', { funding_goal: 'mucho' }],
    ['costo negativo', { cost_per_person: -5 }],
    ['roles como string', { roles_needed: 'Chef' }],
    ['categoría que no es texto', { category: 123 }],
    ['título que no es texto', { title: ['x'] }],
  ];
  for (const [name, body] of BAD) {
    test(`${name} → 400 y no cambia nada`, async () => {
      const before = { ...(await row()), ...(await assoc()) };
      const r = await put(body);
      assert.equal(r.status, 400, `${name}: ${JSON.stringify(r.body)}`);
      assert.deepEqual({ ...(await row()), ...(await assoc()) }, before);
    });
  }

  test('si algo falla a mitad, no queda nada a medias (transacción)', async () => {
    const before = { ...(await row()), ...(await assoc()) };
    const failOnReq = (run) => (sql, params) =>
      /INSERT INTO requisitos/.test(sql) ? Promise.reject(new Error('falla simulada')) : run(sql, params);
    const origRun = db.run; const origTx = db.transaction;
    db.run = failOnReq(origRun);
    db.transaction = (fn) => origTx((tx) => fn({ ...tx, run: failOnReq(tx.run) }));
    let r;
    try { r = await put({ title: 'No debería quedar', requirements: ['Falla'] }); }
    finally { db.run = origRun; db.transaction = origTx; }
    assert.equal(r.status, 500);
    assert.deepEqual({ ...(await row()), ...(await assoc()) }, before);
  });
});
