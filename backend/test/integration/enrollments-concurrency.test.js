// test/integration/enrollments-concurrency.test.js
//
// Integridad de projects.cupos_ocupados frente a requests CONCURRENTES
// (docs/BACKEND_ROADMAP_ANALYSIS.md §1.5, PROJECT_ANALYSIS.md §34).
//
// Importante: este bug solo se manifiesta en POSTGRES (pool de conexiones). En
// SQLite cada handler corre entero sin ceder el event loop, así que estos tests
// pasan en SQLite con o sin el arreglo. La prueba que importa es
// `npm run test:pg`.
//
// Cada aserción verifica un INVARIANTE (el contador cambia exactamente lo que
// corresponde; una sola notificación por transición real), no "quién ganó la
// carrera", que no es determinista.
//
// Datos de seed:
//   proj-1: cupos_ocupados = 23 · juan (user-vol-2) PENDING · maria (vol-1) approved
//   proj-7: cupos_ocupados =  8 · maria approved
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Concurrencia en inscripciones (cupos_ocupados)', () => {
  let server, baseUrl;
  let ngo1, juan, maria, juanEnrollmentId, mariaProj7EnrollmentId;

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

  const spots = async (projectId) =>
    (await call(`/api/projects/${projectId}`)).body.project.current_volunteers;

  const decide = (id, status) =>
    call(`/api/enrollments/${id}`, { token: ngo1, method: 'PATCH', body: { status } });

  const enrollmentStatus = async (projectId, id) => {
    const list = await call(`/api/enrollments/project/${projectId}`, { token: ngo1 });
    return list.body.enrollments.find((e) => e.id === id)?.status;
  };

  // Cuántas notificaciones de un tipo recibió el usuario para un proyecto.
  const notifCount = async (token, type, projectId) => {
    const r = await call('/api/notifications', { token });
    return r.body.notifications.filter((n) => {
      if (n.type !== type) return false;
      const data = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
      return data?.project_id === projectId;
    }).length;
  };

  const burst = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)));

  test('setup', async () => {
    ngo1 = await login('admin@sustentando.org');
    juan = await login('juan@example.com');
    maria = await login('maria@example.com');

    const p1 = await call('/api/enrollments/project/proj-1', { token: ngo1 });
    juanEnrollmentId = p1.body.enrollments.find((e) => e.status === 'pending').id;
    const p7 = await call('/api/enrollments/project/proj-7', { token: ngo1 });
    mariaProj7EnrollmentId = p7.body.enrollments.find((e) => e.status === 'approved').id;

    assert.equal(await spots('proj-1'), 23);
    assert.equal(await spots('proj-7'), 8);
  });

  test('8 aprobaciones simultáneas de la MISMA inscripción: el cupo sube 1 (no 8) y se notifica 1 vez', async () => {
    const before = await notifCount(juan, 'enrollment_approved', 'proj-1');
    const rs = await burst(8, () => decide(juanEnrollmentId, 'approved'));

    // Idempotente: quien "pierde" la carrera ve el estado pedido ya aplicado → 200, sin efectos.
    assert.ok(rs.every((r) => r.status === 200), `todas deberían ser 200: ${rs.map((r) => r.status)}`);
    assert.equal(await spots('proj-1'), 24, 'cupos_ocupados debe subir exactamente 1');
    assert.equal(await notifCount(juan, 'enrollment_approved', 'proj-1'), before + 1,
      'una sola notificación por la transición real');
  });

  test('aprobar de nuevo algo ya aprobado (secuencial): no-op, sin cupo extra ni notificación duplicada', async () => {
    const before = await notifCount(juan, 'enrollment_approved', 'proj-1');
    const r = await decide(juanEnrollmentId, 'approved');
    assert.equal(r.status, 200);
    assert.equal(await spots('proj-1'), 24);
    assert.equal(await notifCount(juan, 'enrollment_approved', 'proj-1'), before);
  });

  test('8 rechazos simultáneos de una inscripción aprobada: el cupo baja 1 (no 8) y se notifica 1 vez', async () => {
    const before = await notifCount(juan, 'enrollment_rejected', 'proj-1');
    const rs = await burst(8, () => decide(juanEnrollmentId, 'rejected'));

    assert.ok(rs.every((r) => r.status === 200), `todas deberían ser 200: ${rs.map((r) => r.status)}`);
    assert.equal(await spots('proj-1'), 23, 'vuelve al valor original, sin quedar en 16');
    assert.equal(await notifCount(juan, 'enrollment_rejected', 'proj-1'), before + 1);
  });

  test('tormenta de aprobar/rechazar mezclados: el contador siempre coincide con el estado final', async () => {
    // 5 rondas de 12 requests alternando aprobar/rechazar sobre la misma inscripción.
    for (let round = 1; round <= 5; round++) {
      const rs = await burst(12, (i) => decide(juanEnrollmentId, i % 2 === 0 ? 'approved' : 'rejected'));
      assert.ok(rs.every((r) => r.status === 200 || r.status === 409),
        `ronda ${round}: solo 200/409, llegó ${rs.map((r) => r.status)}`);

      const final = await enrollmentStatus('proj-1', juanEnrollmentId);
      const expected = final === 'approved' ? 24 : 23;   // 23 base + 1 si quedó aprobada
      assert.equal(await spots('proj-1'), expected,
        `ronda ${round}: estado final "${final}" ⇒ cupos debe ser ${expected}`);
    }
  });

  test('6 cancelaciones simultáneas de una inscripción aprobada: una sola tiene éxito y el cupo baja 1', async () => {
    const rs = await burst(6, () =>
      call(`/api/enrollments/${mariaProj7EnrollmentId}`, { token: maria, method: 'DELETE' }));

    const ok = rs.filter((r) => r.status === 200).length;
    assert.equal(ok, 1, `exactamente una cancelación real, llegaron ${rs.map((r) => r.status)}`);
    assert.ok(rs.filter((r) => r.status !== 200).every((r) => r.status === 404 || r.status === 409));
    assert.equal(await spots('proj-7'), 7, 'baja exactamente 1 (8 → 7), no 6');
  });
});
