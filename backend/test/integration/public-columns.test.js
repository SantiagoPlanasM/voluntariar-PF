// test/integration/public-columns.test.js
//
// REVISION B21 / AI_RULES regla 8: los endpoints PÚBLICOS no pueden exponer columnas que no eligieron.
// Varios hacían `SELECT *` y devolvían la fila tal cual: hoy no hay columnas sensibles, pero el día que se
// agregue una (un token, datos de facturación) saldría sola por la API.
//
// La prueba: a cada tabla con datos que muestra algún endpoint público se le agrega una columna nueva con un
// valor centinela, y se recorren todos los endpoints públicos buscando ese valor. Si aparece, ese endpoint
// devuelve columnas que no eligió. Además: nunca la contraseña (ni su hash) ni el email de los usuarios.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

const SENTINEL = 'SECRETO-B21-NO-DEBE-SALIR';
const TABLES = [
  'users', 'ngos', 'empresas', 'voluntarios', 'projects', 'categorias', 'roles', 'habilidades', 'faqs',
  'posts', 'post_media', 'comments', 'ratings', 'kpis', 'enrollments', 'requisitos',
];

describe('Endpoints públicos: solo columnas elegidas (regla 8)', () => {
  let server;
  let db;
  const get = (path, init) => fetch(`${server.baseUrl}${path}`, init)
    .then(async (r) => ({ path, status: r.status, text: await r.text() }));

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
    for (const t of TABLES) await db.run(`ALTER TABLE ${t} ADD COLUMN secreto_b21 TEXT DEFAULT '${SENTINEL}'`);
    // Un KPI y un comentario en proj-1, para que esas subconsultas devuelvan filas (las calificaciones ya vienen del seed).
    await db.run(`INSERT INTO kpis (id, project_id, nombre, valor) VALUES ('kpi-b21', 'proj-1', 'Árboles', 10)`);
    await db.run(`INSERT INTO comments (id, project_id, user_id, comment) VALUES ('com-b21', 'proj-1', 'user-vol-1', 'Muy lindo')`);
  });
  after(async () => { if (server) await server.close(); });

  const publicPaths = async () => {
    const empresa = JSON.parse((await get('/api/empresas')).text).empresas[0];
    const posts = JSON.parse((await get('/api/posts')).text).posts || [];
    return [
      '/api/categorias', '/api/roles', '/api/habilidades', '/api/stats',
      '/api/projects', '/api/projects?limit=100', '/api/projects/proj-1', '/api/projects/proj-1/kpis',
      '/api/ngos', '/api/ngos/ngo-1', '/api/ngos/ngo-1/projects',
      '/api/empresas', `/api/empresas/${empresa.id}`,
      '/api/follows/ngo/ngo-1/status', '/api/follows/project/proj-1/status',
      '/api/follows/volunteer/user-vol-1/status', '/api/follows/volunteer/user-vol-1/followers',
      '/api/follows/volunteer/user-vol-1/following',
      '/api/posts', '/api/posts?ngo_id=ngo-1', ...(posts[0] ? [`/api/posts/${posts[0].id}`] : []),
      '/api/faqs', '/api/voluntarios/user-vol-1',
    ];
  };

  test('ningún endpoint público devuelve una columna que no eligió', async () => {
    const leaks = [];
    for (const path of await publicPaths()) {
      const r = await get(path);
      assert.ok(r.status < 500, `${path} respondió ${r.status}`);
      if (r.text.includes(SENTINEL) || r.text.includes('secreto_b21')) leaks.push(path);
    }
    const ask = await get('/api/faqs/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: '¿Cómo me inscribo?' }),
    });
    if (ask.text.includes(SENTINEL)) leaks.push('POST /api/faqs/ask');
    assert.deepEqual(leaks, [], `devuelven columnas no elegidas: ${leaks.join(', ')}`);
  });

  test('ningún endpoint público devuelve contraseñas, hashes ni emails de usuarios', async () => {
    const leaks = [];
    for (const path of await publicPaths()) {
      const { text } = await get(path);
      if (/"password"|\$2[aby]\$\d\d\$/.test(text)) leaks.push(`${path} (password)`);
      if (/"email"\s*:/.test(text) || /@example\.com|@sustentando\.org|@techcorp\.com/.test(text)) leaks.push(`${path} (email)`);
    }
    assert.deepEqual(leaks, []);
  });

  // La otra mitad: la lista blanca no puede dejar afuera lo que el frontend usa (las interfaces de api.ts).
  // Al pasar fmt() a lista blanca, el feed perdía `ratings` (follows.js lo agrega a la fila antes de
  // formatear) y FeedPostCard se quedaba sin reseñas: lo vio una comparación de claves, no un test.
  describe('…pero sí todo lo que el frontend espera', () => {
    const PROJECT = ['id', 'ngo_id', 'title', 'description', 'category', 'location', 'type', 'status', 'volunteers_needed',
      'current_volunteers', 'funding_goal', 'current_funding', 'cost_per_person', 'roles_needed', 'followers', 'created_at',
      'latitude', 'longitude', 'modality', 'ratings_count'];
    const NGO = ['id', 'user_id', 'name', 'logo', 'description', 'mission', 'location', 'followers'];
    const EMPRESA = ['id', 'user_id', 'name', 'logo', 'description', 'mission', 'industry', 'location', 'followers'];
    const call = async (path, token) => {
      const r = await fetch(`${server.baseUrl}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      assert.equal(r.status, 200, path);
      return r.json();
    };
    const login = async (email) => (await (await fetch(`${server.baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password1' }),
    })).json()).token;
    const has = (obj, keys, where) => { for (const k of keys) assert.ok(k in obj, `${where}: falta "${k}"`); };

    test('proyectos: listado, detalle y recomendaciones', async () => {
      const maria = await login('maria@example.com');
      has((await call('/api/projects')).projects[0], PROJECT, 'GET /projects');
      const { project } = await call('/api/projects/proj-1', maria);
      has(project, [...PROJECT, 'ngo_name', 'comments', 'ratings', 'kpis', 'avg_rating', 'my_enrollment', 'can_manage'], 'GET /projects/:id');
      const rec = (await call('/api/projects/recommended', maria)).recommendations[0];
      has(rec, [...PROJECT, 'recommendation_score', 'recommendation_reasons'], 'GET /projects/recommended');
    });

    test('feed: además los campos que agrega follows.js (ratings, comentarios, inscripción, de dónde viene)', async () => {
      const maria = await login('maria@example.com');
      await fetch(`${server.baseUrl}/api/follows/project/proj-2`, { method: 'POST', headers: { Authorization: `Bearer ${maria}` } });
      const { projects } = await call('/api/follows/feed', maria);
      assert.ok(projects.length > 0, 'el feed tiene proyectos');
      has(projects[0], [...PROJECT, 'ratings', 'recent_comments', 'comments_count', 'my_enrollment_status', 'follow_source', 'follow_label'], 'GET /follows/feed');
      assert.ok(Array.isArray(projects[0].ratings));
    });

    test('ONGs y empresas (públicas y propias)', async () => {
      has((await call('/api/ngos')).ngos[0], NGO, 'GET /ngos');
      has((await call('/api/ngos/ngo-1')).ngo, NGO, 'GET /ngos/:id');
      has((await call('/api/ngos/me', await login('admin@sustentando.org'))).ngo, NGO, 'GET /ngos/me');
      const empresa = (await call('/api/empresas')).empresas[0];
      has(empresa, EMPRESA, 'GET /empresas');
      has((await call(`/api/empresas/${empresa.id}`)).empresa, EMPRESA, 'GET /empresas/:id');
      has((await call('/api/empresas/me', await login('admin@techcorp.com'))).empresa, EMPRESA, 'GET /empresas/me');
    });
  });

});
