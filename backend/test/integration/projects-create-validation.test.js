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

  // REVISION A3: estos pedidos daban 500 (el CHECK de tipo/montos, `.trim()` de un no-texto, el INTEGER de
  // Postgres desbordado) o guardaban basura (modalidad "otra", meta "abc" → 0). Ahora 400 con un mensaje que
  // nombra el campo, sin crear nada. Se cuentan TODOS los proyectos (un título no-texto no sirve para buscar).
  describe('REVISION A3: tipos y números raros → 400 sin crear nada', () => {
    const totalProjects = () => count('SELECT COUNT(*) AS n FROM projects');
    const rejectedWith = async (over, re, why) => {
      const before = await totalProjects();
      const r = await create(over);
      assert.equal(r.status, 400, `${why}: status (${JSON.stringify(r.body)})`);
      assert.match(r.body.error, re, `${why}: mensaje`);
      assert.equal(await totalProjects(), before, `${why}: no se creó ningún proyecto`);
    };

    test('type fuera de fugaz/sostenido (antes 500 por el CHECK de la base)', async () => {
      for (const type of ['otro', 5, '', 'FUGAZ', ['fugaz']])
        await rejectedWith({ type }, /^Tipo inválido: tiene que ser fugaz o sostenido$/, `type ${JSON.stringify(type)}`);
    });

    test('textos que no son string (antes 500 en .trim() o .toLowerCase())', async () => {
      const cases = [
        [{ title: 12345 }, /^El título tiene que ser un texto$/],
        [{ title: { a: 1 } }, /^El título tiene que ser un texto$/],
        [{ title: ['Un título'] }, /^El título tiene que ser un texto$/],
        [{ description: 1234567890123 }, /^La descripción tiene que ser un texto$/],
        [{ location: 5 }, /^La ubicación tiene que ser un texto$/],
        [{ location: {} }, /^La ubicación tiene que ser un texto$/],
        [{ duration: 5 }, /^La duración tiene que ser un texto$/],
        [{ type: 'sostenido', hours_per_week: 4, duration: 5 }, /^La duración tiene que ser un texto$/],
        [{ full_description: 5 }, /^La descripción completa tiene que ser un texto$/],
        [{ full_description: { a: 1 } }, /^La descripción completa tiene que ser un texto$/],
        [{ image: 5 }, /^La imagen tiene que ser un texto$/],
        [{ image: { a: 1 } }, /^La imagen tiene que ser un texto$/],
      ];
      for (const [over, re] of cases) await rejectedWith(over, re, JSON.stringify(over));
    });

    test('modalidad fuera de presencial/remoto/hibrido (antes 500 con un objeto o se guardaba "otra")', async () => {
      for (const over of [{ modality: { a: 1 } }, { modality: 5 }, { modality: 'otra' }, { modality: ['remoto'] }, { modalidad: 'virtual' }])
        await rejectedWith(over, /^Modalidad inválida: tiene que ser presencial, remoto o hibrido$/, JSON.stringify(over));
    });

    test('cupos y horas fuera de rango (antes 500 en Postgres: INTEGER desbordado)', async () => {
      await rejectedWith({ volunteers_needed: 1e10 }, /^Los cupos pueden ser hasta 100000$/, 'cupos 1e10');
      await rejectedWith({ volunteers_needed: 100001 }, /^Los cupos pueden ser hasta 100000$/, 'cupos 100001');
      await rejectedWith({ type: 'sostenido', hours_per_week: 1e10 }, /^Las horas semanales pueden ser hasta 168$/, 'horas 1e10');
      await rejectedWith({ type: 'sostenido', hours_per_week: 169 }, /^Las horas semanales pueden ser hasta 168$/, 'horas 169');
    });

    test('montos negativos o que no son números (antes 500 por el CHECK, o "abc" se guardaba como 0)', async () => {
      for (const funding_goal of [-5, 'abc', 'Infinity', {}])
        await rejectedWith({ funding_goal }, /^La meta de financiamiento tiene que ser un número mayor o igual a 0$/, `meta ${JSON.stringify(funding_goal)}`);
      for (const cost_per_person of [-1, '1e400'])
        await rejectedWith({ cost_per_person }, /^El costo por persona tiene que ser un número mayor o igual a 0$/, `costo ${JSON.stringify(cost_per_person)}`);
    });

    test('sin type ni duration: es un fugaz (el default) y le falta la duración (antes se creaba sin duración)', async () => {
      await rejectedWith({ type: undefined, duration: undefined }, /^La duración es obligatoria para proyectos fugaces$/, 'sin type ni duration');
    });
  });

  describe('REVISION A3: lo válido se sigue aceptando', () => {
    test('sin type (o null): se crea fugaz', async () => {
      for (const type of [undefined, null]) {
        const r = await create({ type });
        assert.equal(r.status, 201, `type ${type}`);
        assert.equal(r.body.project.type, 'fugaz');
        assert.equal(r.body.project.duration, '1 día');
      }
    });

    test('sostenido en los extremos: 168 horas y 100000 cupos', async () => {
      const r = await create({ type: 'sostenido', hours_per_week: 168, volunteers_needed: 100000, duration: undefined });
      assert.equal(r.status, 201);
      assert.equal(r.body.project.type, 'sostenido');
      assert.equal(r.body.project.hours_per_week, 168);
      assert.equal(r.body.project.volunteers_needed, 100000);
    });

    test('las tres modalidades; vacía o ausente se deduce de la ubicación', async () => {
      for (const modality of ['presencial', 'remoto', 'hibrido']) {
        const r = await create({ modality });
        assert.equal(r.status, 201, modality);
        assert.equal(r.body.project.modality, modality);
      }
      const viaModalidad = await create({ modalidad: 'hibrido' });
      assert.equal(viaModalidad.status, 201);
      assert.equal(viaModalidad.body.project.modality, 'hibrido');
      const vacia = await create({ modality: '', location: 'Remoto' });
      assert.equal(vacia.status, 201);
      assert.equal(vacia.body.project.modality, 'remoto');
      const ausente = await create({ location: 'Córdoba' });
      assert.equal(ausente.body.project.modality, 'presencial');
    });

    test('montos: número, texto numérico, null y vacío (null y vacío = 0); textos opcionales en null', async () => {
      const r = await create({ funding_goal: '1500.5', cost_per_person: 0, full_description: null, image: null });
      assert.equal(r.status, 201);
      assert.equal(r.body.project.funding_goal, 1500.5);
      assert.equal(r.body.project.cost_per_person, 0);
      assert.equal(r.body.project.full_description, null);
      assert.equal(r.body.project.image, null);
      const r2 = await create({ funding_goal: null, cost_per_person: '250', full_description: 'Texto largo', image: 'https://x.test/a.png' });
      assert.equal(r2.status, 201);
      assert.equal(r2.body.project.funding_goal, 0);
      assert.equal(r2.body.project.cost_per_person, 250);
      const r3 = await create({ funding_goal: '', cost_per_person: null });
      assert.equal(r3.status, 201);
      assert.equal(r3.body.project.funding_goal, 0);
      assert.equal(r3.body.project.cost_per_person, 0);
      assert.equal(r2.body.project.full_description, 'Texto largo');
      assert.equal(r2.body.project.image, 'https://x.test/a.png');
    });
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
