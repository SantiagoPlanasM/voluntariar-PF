// test/integration/creation-and-capacity-edit.test.js
//
// Dos bugs hermanos (PROJECT_ANALYSIS.md §39/§40):
//
//  1. POST /api/projects y POST /api/ngos/:id/empleados hacían INSERT y después buscaban "el
//     último de esta ONG" con ORDER BY created_at DESC LIMIT 1. En SQLite created_at tiene
//     resolución de 1 segundo: dos altas de la misma ONG en el mismo segundo empatan y la consulta
//     devuelve el más viejo. En projects eso además enganchaba categoría/roles/requisitos al
//     proyecto equivocado. Ahora el id se genera en el código y se usa en todo el flujo.
//
//  2. PUT /api/projects/:id permitía bajar `volunteers_needed` por debajo de las inscripciones ya
//     aprobadas (rompía cupos_ocupados <= cupos, AI_RULES regla 20), y si el cliente omitía el
//     campo pisaba la capacidad con 0.
//
// Datos de seed: ngo-1 (admin@sustentando.org) ya tiene proyectos creados en el mismo segundo que
// el seed, así que crear de inmediato reproduce el empate sin necesidad de esperar.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Altas con id propio y edición de capacidad', () => {
  let server, baseUrl, ngo1, ngoId, maria, juan, lucia;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
  });
  after(async () => { if (server) await server.close(); });

  const call = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const login = async (email) => {
    const r = await call('/api/auth/login', { method: 'POST', body: { email, password: 'Password1' } });
    assert.equal(r.status, 200, `login ${email}`);
    return r.body.token;
  };

  const projectBody = (over = {}) => ({
    title: 'Proyecto de prueba', description: 'Descripción suficientemente larga para validar',
    location: 'Córdoba', type: 'fugaz', duration: '1 día',
    volunteers_needed: 3, category: 'Medio Ambiente', roles_needed: [], requirements: [],
    ...over,
  });

  const createProject = (over) => call('/api/projects', { token: ngo1, method: 'POST', body: projectBody(over) });
  const getProject = async (id) => (await call(`/api/projects/${id}`)).body.project;

  // Preparación (sesiones y precondiciones), no un test (REVISION T4): si falla, la suite no corre.
  before(async () => {
    ngo1 = await login('admin@sustentando.org');
    maria = await login('maria@example.com');
    juan = await login('juan@example.com');
    lucia = await login('lucia@example.com');
    ngoId = (await call('/api/ngos/me', { token: ngo1 })).body.ngo.id;
    assert.ok(ngoId);
  });

  describe('POST /api/projects: cada alta devuelve SU proyecto', () => {
    test('tres altas seguidas de la misma ONG (mismo segundo): cada respuesta es la suya, con sus asociaciones', async () => {
      const proj1Before = await getProject('proj-1');   // proyecto del seed de la misma ONG, que NO debe tocarse

      const specs = [
        { title: 'Alta uno',  volunteers_needed: 2, category: 'Educación', roles_needed: ['Docente'],    requirements: ['Ser mayor de 18'] },
        { title: 'Alta dos',  volunteers_needed: 3, category: 'Salud',     roles_needed: ['Enfermero'],  requirements: ['Matrícula vigente'] },
        { title: 'Alta tres', volunteers_needed: 4, category: 'Deportes',  roles_needed: ['Entrenador'], requirements: ['Apto físico'] },
      ];

      const created = [];
      for (const spec of specs) {            // secuencial y sin pausas: caen en el mismo segundo
        const r = await createProject(spec);
        assert.equal(r.status, 201, JSON.stringify(r.body));
        created.push(r.body.project);
      }

      specs.forEach((spec, i) => {
        assert.equal(created[i].title, spec.title, `la alta ${i + 1} devolvió el proyecto equivocado`);
        assert.equal(created[i].volunteers_needed, spec.volunteers_needed);
      });
      assert.equal(new Set(created.map((p) => p.id)).size, 3, 'los tres ids deben ser distintos');

      // Las asociaciones deben colgar del proyecto correcto (se leen de las tablas, no de la respuesta).
      for (let i = 0; i < specs.length; i++) {
        const p = await getProject(created[i].id);
        assert.equal(p.title, specs[i].title);
        assert.equal(p.category, specs[i].category, `categoría de "${specs[i].title}"`);
        assert.deepEqual(p.roles_needed, specs[i].roles_needed, `roles de "${specs[i].title}"`);
        assert.deepEqual(p.requirements, specs[i].requirements, `requisitos de "${specs[i].title}"`);
      }

      const proj1After = await getProject('proj-1');
      assert.equal(proj1After.category, proj1Before.category, 'el proyecto del seed no debe ganar categoría ajena');
      assert.deepEqual(proj1After.roles_needed, proj1Before.roles_needed, 'ni roles ajenos');
      assert.deepEqual(proj1After.requirements, proj1Before.requirements, 'ni requisitos ajenos');
    });

    test('seis altas SIMULTÁNEAS: cada una devuelve su propio proyecto y los ids son distintos', async () => {
      const titles = Array.from({ length: 6 }, (_, i) => `Simultáneo ${i + 1}`);
      const rs = await Promise.all(titles.map((title, i) =>
        createProject({ title, volunteers_needed: i + 1, roles_needed: [`Rol ${i + 1}`] })));

      rs.forEach((r, i) => {
        assert.equal(r.status, 201, JSON.stringify(r.body));
        assert.equal(r.body.project.title, titles[i]);
        assert.equal(r.body.project.volunteers_needed, i + 1);
      });
      assert.equal(new Set(rs.map((r) => r.body.project.id)).size, 6);

      for (let i = 0; i < rs.length; i++) {
        const p = await getProject(rs[i].body.project.id);
        assert.deepEqual(p.roles_needed, [`Rol ${i + 1}`], `roles de "${titles[i]}"`);
      }
    });

    test('el id generado es un UUID con el mismo formato que los de la base', async () => {
      const r = await createProject({ title: 'Formato de id' });
      assert.match(r.body.project.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('POST /api/ngos/:id/empleados: cada alta devuelve SU empleado', () => {
    test('tres altas seguidas: cada respuesta es la suya y el listado las tiene a las tres', async () => {
      const people = [
        { nombre: 'Ana',   apellido: 'Uno',  email: 'ana.uno@test.com' },
        { nombre: 'Bruno', apellido: 'Dos',  email: 'bruno.dos@test.com' },
        { nombre: 'Carla', apellido: 'Tres', email: 'carla.tres@test.com' },
      ];
      const out = [];
      for (const p of people) {
        const r = await call(`/api/ngos/${ngoId}/empleados`, { token: ngo1, method: 'POST', body: p });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        out.push(r.body.empleado);
      }
      people.forEach((p, i) => assert.equal(out[i].email, p.email, `la alta ${i + 1} devolvió el empleado equivocado`));
      assert.equal(new Set(out.map((e) => e.id)).size, 3);

      const list = (await call(`/api/ngos/${ngoId}/empleados`, { token: ngo1 })).body.empleados;
      for (const p of people) assert.ok(list.some((e) => e.email === p.email), `falta ${p.email} en el listado`);
    });
  });

  describe('PUT /api/projects/:id: la capacidad no baja de las inscripciones aprobadas', () => {
    let projectId;

    // Localiza el proyecto por título (no depende de que el id de la respuesta sea el correcto).
    const putCapacity = (volunteers_needed) => call(`/api/projects/${projectId}`, {
      token: ngo1, method: 'PUT',
      body: {
        title: 'Capacidad editable', description: 'Descripción suficientemente larga para validar',
        location: 'Córdoba', type: 'fugaz', duration: '1 día', status: 'active',
        ...(volunteers_needed === undefined ? {} : { volunteers_needed }),
      },
    });

    const enroll = async (token, pid) => {
      const r = await call('/api/enrollments', { token, method: 'POST', body: { project_id: pid, message: 'quiero participar' } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body.enrollment.id;
    };
    const approve = async (id) => assert.equal(
      (await call(`/api/enrollments/${id}`, { token: ngo1, method: 'PATCH', body: { status: 'approved' } })).status, 200);

    // Preparación: proyecto con 3 cupos y 2 inscripciones aprobadas (REVISION T4).
    before(async () => {
      const r = await createProject({ title: 'Capacidad editable', volunteers_needed: 3 });
      assert.equal(r.status, 201);
      projectId = r.body.project.id;
      const a = await enroll(maria, projectId);
      const b = await enroll(juan, projectId);
      await approve(a);
      await approve(b);
      const p = await getProject(projectId);
      assert.equal(p.current_volunteers, 2);
      assert.equal(p.volunteers_needed, 3);
    });

    test('bajar la capacidad por debajo de las aprobadas → 400 y NO se modifica nada', async () => {
      const r = await putCapacity(1);
      assert.equal(r.status, 400);
      assert.match(r.body.error, /capacidad/i);
      assert.match(r.body.error, /2/, 'el mensaje debe decir cuántas aprobadas hay');
      assert.equal((await getProject(projectId)).volunteers_needed, 3, 'la capacidad no debe haber cambiado');
    });

    test('bajar exactamente hasta las aprobadas es válido (cupos == ocupados)', async () => {
      const r = await putCapacity(2);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal((await getProject(projectId)).volunteers_needed, 2);
    });

    test('subir la capacidad es válido', async () => {
      assert.equal((await putCapacity(5)).status, 200);
      assert.equal((await getProject(projectId)).volunteers_needed, 5);
    });

    test('si el cliente OMITE volunteers_needed, la capacidad se conserva (antes se pisaba con 0)', async () => {
      const r = await putCapacity(undefined);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal((await getProject(projectId)).volunteers_needed, 5);
    });

    test('un valor no numérico explícito se rechaza igual que bajar a 0 con aprobadas (400)', async () => {
      const r = await putCapacity('abc');
      assert.equal(r.status, 400);
      assert.equal((await getProject(projectId)).volunteers_needed, 5);
    });

    test('CARRERA: aprobaciones y una baja de capacidad a la vez nunca dejan cupos_ocupados > cupos', async () => {
      // Solo puede fallar en Postgres (pool de conexiones). 4 rondas, cada una con un proyecto nuevo.
      for (let round = 1; round <= 4; round++) {
        const r = await createProject({ title: `Carrera ${round}`, volunteers_needed: 3 });
        const pid = r.body.project.id;
        const [eMaria, eJuan, eLucia] = [await enroll(maria, pid), await enroll(juan, pid), await enroll(lucia, pid)];
        await approve(eMaria);                         // ocupados = 1, cupos = 3

        const rs = await Promise.all([
          call(`/api/enrollments/${eJuan}`,  { token: ngo1, method: 'PATCH', body: { status: 'approved' } }),
          call(`/api/enrollments/${eLucia}`, { token: ngo1, method: 'PATCH', body: { status: 'approved' } }),
          call(`/api/projects/${pid}`, {
            token: ngo1, method: 'PUT',
            body: { title: `Carrera ${round}`, description: 'Descripción suficientemente larga para validar',
                    location: 'Córdoba', type: 'fugaz', duration: '1 día', status: 'active', volunteers_needed: 1 },
          }),
        ]);
        assert.ok(rs.every((x) => [200, 400, 409].includes(x.status)), `ronda ${round}: ${rs.map((x) => x.status)}`);

        const p = await getProject(pid);
        assert.ok(p.current_volunteers <= p.volunteers_needed,
          `ronda ${round}: ocupados ${p.current_volunteers} > cupos ${p.volunteers_needed}`);
      }
    });
  });
});
