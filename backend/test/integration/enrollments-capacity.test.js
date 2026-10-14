// test/integration/enrollments-capacity.test.js
//
// Aprobar una inscripción debe respetar la capacidad del proyecto: cupos_ocupados <= cupos
// (AI_RULES.md regla 20; PROJECT_ANALYSIS.md §34/§39).
//
// Antes, PATCH /api/enrollments/:id aprobaba sin mirar `cupos`. El alta ya devolvía 409 con el
// proyecto lleno, pero `cupos_ocupados` cuenta solo APROBADAS, así que podían acumularse
// pendientes y la ONG las aprobaba por encima del tope.
//
// Este archivo crea sus propios proyectos con capacidad chica (1 y 2) para poder llenarlos.
// El caso concurrente solo puede fallar en Postgres (pool de conexiones); en SQLite pasa con o
// sin el arreglo. La prueba que importa es `npm run test:pg`.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

const FULL_MSG = 'El proyecto no tiene cupos disponibles';

describe('Capacidad al aprobar inscripciones', () => {
  let server, baseUrl, ngo1, maria, juan, lucia;
  const created = [];   // proyectos que crea este archivo

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

  const createProject = async (cupos, title) => {
    const r = await call('/api/projects', {
      token: ngo1, method: 'POST',
      body: {
        title, description: 'Proyecto de prueba para verificar la capacidad al aprobar',
        location: 'Córdoba', type: 'fugaz', duration: '1 día',
        volunteers_needed: cupos, category: 'Medio Ambiente',
      },
    });
    assert.equal(r.status, 201, `crear proyecto: ${JSON.stringify(r.body)}`);

    // NO se usa el `id` de la respuesta: POST /api/projects vuelve a buscar "el último proyecto de
    // la ONG" con ORDER BY created_at DESC LIMIT 1, y en SQLite (created_at con resolución de 1 s)
    // dos proyectos de la misma ONG creados en el mismo segundo empatan y devuelve el más viejo
    // (PROJECT_ANALYSIS.md §39). Se localiza por título, que es único en este archivo.
    const list = await call('/api/projects?limit=500');
    const found = list.body.projects.find((p) => p.title === title);
    assert.ok(found, `no se encontró el proyecto "${title}" en el listado`);
    assert.equal(found.volunteers_needed, cupos, 'el proyecto debe haberse creado con la capacidad pedida');
    created.push(found.id);
    return found.id;
  };

  // Todos se inscriben ANTES de aprobar a nadie: con el proyecto lleno el alta ya da 409.
  const enroll = async (token, projectId) => {
    const r = await call('/api/enrollments', { token, method: 'POST', body: { project_id: projectId, message: 'quiero participar' } });
    assert.equal(r.status, 201, `inscribir: ${JSON.stringify(r.body)}`);
    return r.body.enrollment.id;
  };

  const decide = (id, status) =>
    call(`/api/enrollments/${id}`, { token: ngo1, method: 'PATCH', body: { status } });

  const spots = async (projectId) => (await call(`/api/projects/${projectId}`)).body.project.current_volunteers;

  const statusOf = async (projectId, id) =>
    (await call(`/api/enrollments/project/${projectId}`, { token: ngo1 })).body.enrollments.find((e) => e.id === id)?.status;

  // Sesiones para los tests: es preparación, no un test (REVISION T4; antes era un test('setup') sin asserts).
  before(async () => {
    ngo1 = await login('admin@sustentando.org');
    maria = await login('maria@example.com');
    juan = await login('juan@example.com');
    lucia = await login('lucia@example.com');
  });

  describe('proyecto con 1 solo cupo', () => {
    let projectId, mariaEnr, juanEnr;

    test('con el cupo libre, aprobar funciona', async () => {
      projectId = await createProject(1, 'Un solo cupo');
      mariaEnr = await enroll(maria, projectId);
      juanEnr = await enroll(juan, projectId);

      const r = await decide(mariaEnr, 'approved');
      assert.equal(r.status, 200);
      assert.equal(await spots(projectId), 1);
    });

    test('con el proyecto lleno, aprobar a otra persona da 409 y la deja PENDIENTE (el cambio de estado se deshace)', async () => {
      const r = await decide(juanEnr, 'approved');
      assert.equal(r.status, 409);
      assert.equal(r.body.error, FULL_MSG);
      assert.equal(await statusOf(projectId, juanEnr), 'pending', 'el ROLLBACK debe dejarla como estaba');
      assert.equal(await spots(projectId), 1, 'el contador no debe pasarse de cupos');
    });

    test('volver a aprobar la que YA está aprobada, con el proyecto lleno, es un no-op (200), no un error', async () => {
      const r = await decide(mariaEnr, 'approved');
      assert.equal(r.status, 200);
      assert.equal(await spots(projectId), 1);
    });

    test('rechazar a la aprobada libera el cupo, y entonces la otra sí se puede aprobar', async () => {
      assert.equal((await decide(mariaEnr, 'rejected')).status, 200);
      assert.equal(await spots(projectId), 0);

      assert.equal((await decide(juanEnr, 'approved')).status, 200);
      assert.equal(await spots(projectId), 1);
    });

    test('una inscripción RECHAZADA no se puede re-aprobar si otra ya ocupó el cupo', async () => {
      const r = await decide(mariaEnr, 'approved');   // maria estaba rechazada; juan ocupa el único cupo
      assert.equal(r.status, 409);
      assert.equal(r.body.error, FULL_MSG);
      assert.equal(await statusOf(projectId, mariaEnr), 'rejected', 'sigue rechazada');
      assert.equal(await spots(projectId), 1);
    });
  });

  describe('concurrencia: 3 pendientes, 2 cupos, aprobaciones simultáneas', () => {
    test('nunca se aprueban más de 2 y el contador coincide con las aprobadas', async () => {
      const projectId = await createProject(2, 'Dos cupos');
      const enrollments = [
        await enroll(maria, projectId),
        await enroll(juan, projectId),
        await enroll(lucia, projectId),
      ];

      // 9 requests a la vez: cada inscripción se intenta aprobar 3 veces (doble click incluido).
      const rs = await Promise.all(
        enrollments.flatMap((id) => [0, 1, 2].map(() => decide(id, 'approved')))
      );
      assert.ok(rs.every((r) => r.status === 200 || r.status === 409),
        `solo 200/409, llegó ${rs.map((r) => r.status)}`);
      for (const r of rs.filter((x) => x.status === 409)) assert.equal(r.body.error, FULL_MSG);

      const statuses = await Promise.all(enrollments.map((id) => statusOf(projectId, id)));
      const approved = statuses.filter((s) => s === 'approved').length;
      assert.equal(approved, 2, `deben quedar exactamente 2 aprobadas, quedaron: ${statuses}`);
      assert.equal(statuses.filter((s) => s === 'pending').length, 1);
      assert.equal(await spots(projectId), 2, 'cupos_ocupados == aprobadas == cupos');
    });
  });

  test('invariante final: ninguno de los proyectos creados aquí quedó con más ocupados que cupos', async () => {
    assert.equal(created.length, 2);
    for (const id of created) {
      const p = (await call(`/api/projects/${id}`)).body.project;
      assert.ok(p.current_volunteers <= p.volunteers_needed, `${p.title}: ${p.current_volunteers}/${p.volunteers_needed}`);
    }
  });
});
