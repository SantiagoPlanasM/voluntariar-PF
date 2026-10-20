// test/integration/enrollments-state-transitions.test.js
//
// Transición de estados de una inscripción (técnica de caja negra; DISENO_CASOS.md §5).
//
// Estados: SIN inscripción, PENDIENTE, APROBADA, RECHAZADA. Eventos: inscribirse y cancelar (la voluntaria),
// aprobar y rechazar (la ONG dueña), y pedir un estado que no es un evento válido (`pending`, `cancelled`).
// Cancelar BORRA la fila (DELETE): se vuelve a SIN inscripción. `cancelled` está en el CHECK de la tabla, pero
// ninguna ruta lo usa.
//
// Criterio de aceptación (escrito a partir de la tabla, antes de correr el archivo):
// - cada celda estado × evento de la tabla da el código HTTP, el estado siguiente y el cupo ocupado que dice ahí;
// - un evento inválido responde 400 y no cambia ni el estado ni el cupo;
// - el cupo solo sube al ENTRAR en aprobada y solo baja al SALIR de aprobada;
// - la guarda [hay cupo] de aprobar: sin cupo, 409 y el estado no cambia.
//
// Varias celdas ya estaban probadas sueltas (enrollments-capacity, enrollments-concurrency). Este archivo recorre la
// tabla entera, una celda por test, para que se vea qué transición cubre cada uno.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

const NONE = 'SIN inscripción';
const FULL_MSG = 'El proyecto no tiene cupos disponibles';
const DUPLICATE_MSG = 'Ya estás inscripto en este proyecto';
const INVALID_MSG = 'Status debe ser: approved o rejected';

describe('Inscripción: tabla de transición de estados', () => {
  let server, baseUrl, ngo1, maria, juan;
  let seq = 0;

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

  before(async () => {
    ngo1 = await login('admin@sustentando.org');
    maria = await login('maria@example.com');
    juan = await login('juan@example.com');
  });

  // Se localiza por título (único por test), no por el id de la respuesta: ver enrollments-capacity.test.js.
  const createProject = async (cupos) => {
    const title = `Transiciones ${++seq}`;
    const r = await call('/api/projects', {
      token: ngo1, method: 'POST',
      body: {
        title, description: 'Proyecto de prueba para la tabla de transición de estados',
        location: 'Córdoba', type: 'fugaz', duration: '1 día', volunteers_needed: cupos, category: 'Medio Ambiente',
      },
    });
    assert.equal(r.status, 201, `crear proyecto: ${JSON.stringify(r.body)}`);
    const found = (await call('/api/projects?limit=500')).body.projects.find((p) => p.title === title);
    assert.ok(found, `no se encontró "${title}"`);
    return found.id;
  };

  const ev = {
    inscribirse: (projectId, token = maria) =>
      call('/api/enrollments', { token, method: 'POST', body: { project_id: projectId, message: 'quiero participar' } }),
    aprobar: (id) => call(`/api/enrollments/${id}`, { token: ngo1, method: 'PATCH', body: { status: 'approved' } }),
    rechazar: (id) => call(`/api/enrollments/${id}`, { token: ngo1, method: 'PATCH', body: { status: 'rejected' } }),
    cancelar: (id, token = maria) => call(`/api/enrollments/${id}`, { token, method: 'DELETE' }),
    pedirPending: (id) => call(`/api/enrollments/${id}`, { token: ngo1, method: 'PATCH', body: { status: 'pending' } }),
    pedirCancelled: (id) => call(`/api/enrollments/${id}`, { token: ngo1, method: 'PATCH', body: { status: 'cancelled' } }),
  };

  const spots = async (projectId) => (await call(`/api/projects/${projectId}`)).body.project.current_volunteers;
  const stateOf = async (projectId, id) => {
    const e = (await call(`/api/enrollments/project/${projectId}`, { token: ngo1 })).body.enrollments.find((x) => x.id === id);
    return e ? { pending: 'PENDIENTE', approved: 'APROBADA', rejected: 'RECHAZADA' }[e.status] : NONE;
  };

  // Lleva la inscripción de María a `state` en un proyecto nuevo con 3 cupos, donde Juan ya ocupa uno (aprobado).
  // Con 3, el cupo no es la guarda que corta (salvo en los tests de la guarda). Juan está para que el cupo nunca
  // arranque en 0: liberar tiene piso en 0 (RELEASE_SLOT_SQL), y sin él "cancelar una pendiente resta un cupo"
  // pasaría inadvertido.
  const OTHER = 1;
  const inState = async (state) => {
    const projectId = await createProject(3);
    const juanEnr = (await ev.inscribirse(projectId, juan)).body.enrollment.id;
    assert.equal((await ev.aprobar(juanEnr)).status, 200);
    const r = await ev.inscribirse(projectId);
    assert.equal(r.status, 201, `inscribir: ${JSON.stringify(r.body)}`);
    const id = r.body.enrollment.id;
    if (state === 'APROBADA') assert.equal((await ev.aprobar(id)).status, 200);
    if (state === 'RECHAZADA') assert.equal((await ev.rechazar(id)).status, 200);
    assert.equal(await stateOf(projectId, id), state, 'preparación');
    return { projectId, id };
  };

  // Una fila por celda: [estado inicial, evento, código esperado, estado siguiente, cupo de María después, mensaje].
  // El cupo ocupado del proyecto es ese número más el de Juan (OTHER).
  const TABLE = [
    ['PENDIENTE', 'inscribirse',    409, 'PENDIENTE', 0, DUPLICATE_MSG],
    ['PENDIENTE', 'aprobar',        200, 'APROBADA',  1],
    ['PENDIENTE', 'rechazar',       200, 'RECHAZADA', 0],
    ['PENDIENTE', 'cancelar',       200, NONE,        0],
    ['PENDIENTE', 'pedirPending',   400, 'PENDIENTE', 0, INVALID_MSG],
    ['PENDIENTE', 'pedirCancelled', 400, 'PENDIENTE', 0, INVALID_MSG],
    ['APROBADA',  'inscribirse',    409, 'APROBADA',  1, DUPLICATE_MSG],
    ['APROBADA',  'aprobar',        200, 'APROBADA',  1],          // idempotente: no suma otro cupo
    ['APROBADA',  'rechazar',       200, 'RECHAZADA', 0],          // sale de aprobada: libera el cupo
    ['APROBADA',  'cancelar',       200, NONE,        0],          // ídem
    ['APROBADA',  'pedirPending',   400, 'APROBADA',  1, INVALID_MSG],
    ['APROBADA',  'pedirCancelled', 400, 'APROBADA',  1, INVALID_MSG],
    ['RECHAZADA', 'inscribirse',    409, 'RECHAZADA', 0, DUPLICATE_MSG],
    ['RECHAZADA', 'aprobar',        200, 'APROBADA',  1],
    ['RECHAZADA', 'rechazar',       200, 'RECHAZADA', 0],          // idempotente
    ['RECHAZADA', 'cancelar',       200, NONE,        0],
    ['RECHAZADA', 'pedirPending',   400, 'RECHAZADA', 0, INVALID_MSG],
    ['RECHAZADA', 'pedirCancelled', 400, 'RECHAZADA', 0, INVALID_MSG],
  ];

  for (const [from, event, code, to, after_, msg] of TABLE) {
    test(`${from} --${event}--> ${to} (${code}, cupo de María ${after_})`, async () => {
      // Arrange
      const { projectId, id } = await inState(from);
      // Act
      const r = event === 'inscribirse' ? await ev.inscribirse(projectId) : await ev[event](id);
      // Assert
      assert.equal(r.status, code, JSON.stringify(r.body));
      if (msg) assert.equal(r.body.error, msg);
      assert.equal(await stateOf(projectId, id), to);
      assert.equal(await spots(projectId), OTHER + after_);
    });
  }

  describe(`desde ${NONE}`, () => {
    test(`${NONE} --inscribirse--> PENDIENTE (201), también después de cancelar`, async () => {
      // Arrange: una inscripción cancelada (la fila ya no existe)
      const { projectId, id } = await inState('PENDIENTE');
      assert.equal((await ev.cancelar(id)).status, 200);
      // Act
      const r = await ev.inscribirse(projectId);
      // Assert
      assert.equal(r.status, 201);
      assert.equal(r.body.enrollment.status, 'pending');
      assert.equal(await stateOf(projectId, r.body.enrollment.id), 'PENDIENTE');
      assert.equal(await spots(projectId), OTHER);
    });

    test(`${NONE}: aprobar, rechazar o cancelar una inscripción que ya no existe → 404`, async () => {
      // Arrange
      const { projectId, id } = await inState('APROBADA');
      assert.equal((await ev.cancelar(id)).status, 200);
      // Act
      const rs = [await ev.aprobar(id), await ev.rechazar(id), await ev.cancelar(id)];
      // Assert
      assert.deepEqual(rs.map((r) => r.status), [404, 404, 404]);
      assert.equal(await spots(projectId), OTHER, 'el cupo no se toca dos veces');
    });
  });

  describe('guarda [hay cupo] de aprobar', () => {
    for (const from of ['PENDIENTE', 'RECHAZADA']) {
      test(`${from} --aprobar [sin cupo]--> ${from} (409, el cupo no se pasa)`, async () => {
        // Arrange: proyecto de 1 cupo; Juan y María inscriptos; Juan aprobado ocupa el único lugar
        const projectId = await createProject(1);
        const mariaEnr = (await ev.inscribirse(projectId)).body.enrollment.id;
        const juanEnr = (await ev.inscribirse(projectId, juan)).body.enrollment.id;
        if (from === 'RECHAZADA') assert.equal((await ev.rechazar(mariaEnr)).status, 200);
        assert.equal((await ev.aprobar(juanEnr)).status, 200);
        // Act
        const r = await ev.aprobar(mariaEnr);
        // Assert
        assert.equal(r.status, 409);
        assert.equal(r.body.error, FULL_MSG);
        assert.equal(await stateOf(projectId, mariaEnr), from);
        assert.equal(await spots(projectId), 1);
      });
    }
  });

  test('solo la voluntaria cancela la suya: otra persona recibe 404 y no cambia nada', async () => {
    // Arrange
    const { projectId, id } = await inState('APROBADA');
    // Act
    const r = await ev.cancelar(id, juan);
    // Assert
    assert.equal(r.status, 404);
    assert.equal(await stateOf(projectId, id), 'APROBADA');
    assert.equal(await spots(projectId), OTHER + 1);
  });
});
