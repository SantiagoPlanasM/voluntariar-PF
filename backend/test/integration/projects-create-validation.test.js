// test/integration/projects-create-validation.test.js
//
// POST /api/projects: roles, requisitos y categoría validados ANTES de crear nada, y el alta completa
// (proyecto + categoría + roles + requisitos) en una sola transacción (REVISION.md B5). Antes:
//   - `roles_needed: "Chef"` recorría los caracteres y creaba los roles "C", "h", "e", "f" en el
//     catálogo global (que /api/roles lista a todos);
//   - un elemento no-string (`[123]`) fallaba en `.trim()` DESPUÉS del INSERT del proyecto: 500 con el
//     proyecto creado a medias (y un reintento lo duplicaba);
//   - la respuesta devolvía los roles/requisitos tal cual venían en el body, no lo que se guardó.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('POST /api/projects: validación de roles/requisitos y alta atómica', () => {
  let server;
  let baseUrl;
  let db;
  let ngo;

  const api = (path, { method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ngo}` },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  let n = 0;
  const projectBody = (over = {}) => ({
    title: `Alta validada ${++n}`, description: 'Descripción suficientemente larga para validar',
    location: 'Córdoba', type: 'fugaz', duration: '1 día', volunteers_needed: 3,
    category: 'Medio Ambiente', roles_needed: [], requirements: [],
    ...over,
  });
  const create = (over) => api('/api/projects', { method: 'POST', body: projectBody(over) });

  const count = async (sql, params = []) => Number((await db.get(sql, params)).n);
  const projectsNamed = (titulo) => count('SELECT COUNT(*) AS n FROM projects WHERE titulo=$1', [titulo]);
  const rolesCount = () => count('SELECT COUNT(*) AS n FROM roles');

  // Un pedido rechazado no tiene que crear el proyecto ni tocar el catálogo de roles.
  const rejected = async (over, why) => {
    const body = projectBody(over);
    const roles = await rolesCount();
    const r = await api('/api/projects', { method: 'POST', body });
    assert.equal(r.status, 400, `${why}: status`);
    assert.equal(typeof r.body.error, 'string', `${why}: mensaje`);
    assert.equal(await projectsNamed(body.title), 0, `${why}: no se creó el proyecto`);
    assert.equal(await rolesCount(), roles, `${why}: el catálogo de roles no cambió`);
  };

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    const r = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sustentando.org', password: 'Password1' }),
    }).then((x) => x.json());
    ngo = r.token;
  });

  after(async () => {
    if (server) await server.close();
  });

  describe('400 sin crear nada', () => {
    test('roles_needed como string (antes creaba un rol por letra)', async () => {
      await rejected({ roles_needed: 'Chef' }, 'roles string');
      assert.equal(await count(`SELECT COUNT(*) AS n FROM roles WHERE nombre IN ('C','h','e','f')`), 0);
    });

    test('requirements como string', () => rejected({ requirements: 'Puntualidad' }, 'requisitos string'));

    test('roles_needed como objeto (no iterable)', () => rejected({ roles_needed: { a: 'Chef' } }, 'roles objeto'));

    test('un rol o requisito que no es string (antes 500 con el proyecto creado a medias)', async () => {
      await rejected({ roles_needed: [123] }, 'rol número');
      await rejected({ requirements: [{ x: 1 }] }, 'requisito objeto');
      await rejected({ roles_needed: [null] }, 'rol null');
    });

    test('largos fuera de rango (mismos límites que CreateVoluntariado: rol 2–40, requisito 3–100)', async () => {
      await rejected({ roles_needed: ['A'] }, 'rol de 1 letra');
      await rejected({ roles_needed: ['   '] }, 'rol vacío');
      await rejected({ roles_needed: ['x'.repeat(41)] }, 'rol de 41');
      await rejected({ requirements: ['ab'] }, 'requisito de 2');
      await rejected({ requirements: ['x'.repeat(101)] }, 'requisito de 101');
    });

    test('más de 20 roles o 20 requisitos', async () => {
      await rejected({ roles_needed: Array.from({ length: 21 }, (_, i) => `Rol número ${i}`) }, '21 roles');
      await rejected({ requirements: Array.from({ length: 21 }, (_, i) => `Requisito ${i}`) }, '21 requisitos');
    });

    test('category que no es string', () => rejected({ category: ['Salud'] }, 'categoría array'));
  });

  describe('alta válida', () => {
    test('los extremos válidos se aceptan (rol de 2 y de 40, requisito de 3 y de 100, 20 de cada uno)', async () => {
      const r = await create({
        roles_needed: ['Ab', 'y'.repeat(40), ...Array.from({ length: 18 }, (_, i) => `Rol extremo ${i}`)],
        requirements: ['abc', 'z'.repeat(100), ...Array.from({ length: 18 }, (_, i) => `Requisito extremo ${i}`)],
      });
      assert.equal(r.status, 201);
      assert.equal(r.body.project.roles_needed.length, 20);
      assert.equal(r.body.project.requirements.length, 20);
    });

    test('recorta espacios, saca repetidos y responde lo mismo que se guardó', async () => {
      const r = await create({
        roles_needed: ['Cocinero', ' Cocinero ', 'Chofer'],
        requirements: ['Puntualidad', 'Puntualidad '],
        category: 'Salud',
      });
      assert.equal(r.status, 201);
      assert.deepEqual(r.body.project.roles_needed, ['Cocinero', 'Chofer']);
      assert.deepEqual(r.body.project.requirements, ['Puntualidad']);
      assert.equal(r.body.project.category, 'Salud');

      const d = (await api(`/api/projects/${r.body.project.id}`)).body.project;
      assert.deepEqual([...d.roles_needed].sort(), ['Chofer', 'Cocinero']);
      assert.deepEqual(d.requirements, ['Puntualidad']);
      assert.equal(d.category, 'Salud');
    });

    test('sin roles_needed ni requirements en el body: listas vacías', async () => {
      const body = projectBody();
      delete body.roles_needed;
      delete body.requirements;
      const r = await api('/api/projects', { method: 'POST', body });
      assert.equal(r.status, 201);
      assert.deepEqual(r.body.project.roles_needed, []);
      assert.deepEqual(r.body.project.requirements, []);
    });
  });

  test('si algo falla a mitad del alta, no queda nada: ni proyecto, ni roles nuevos, ni categoría', async () => {
    // Ningún pedido válido falla ahí (se valida todo antes), así que se inyecta la falla en el INSERT de
    // requisitos, interceptando `db.run` y el `tx.run` de la transacción (el server corre en este proceso).
    const body = projectBody({
      roles_needed: ['Rol que no debe quedar'], requirements: ['Requisito que falla'], category: 'Categoría que no debe quedar',
    });
    const failOnReq = (run) => (sql, params) =>
      /INSERT INTO requisitos/.test(sql) ? Promise.reject(new Error('falla simulada')) : run(sql, params);
    const origRun = db.run;
    const origTx = db.transaction;
    db.run = failOnReq(origRun);
    db.transaction = (fn) => origTx((tx) => fn({ ...tx, run: failOnReq(tx.run) }));
    let r;
    try {
      r = await api('/api/projects', { method: 'POST', body });
    } finally {
      db.run = origRun;
      db.transaction = origTx;
    }
    assert.equal(r.status, 500);
    assert.equal(await projectsNamed(body.title), 0, 'no quedó el proyecto a medias');
    assert.equal(await count(`SELECT COUNT(*) AS n FROM roles WHERE nombre='Rol que no debe quedar'`), 0);
    assert.equal(await count(`SELECT COUNT(*) AS n FROM categorias WHERE nombre='Categoría que no debe quedar'`), 0);
  });
});
