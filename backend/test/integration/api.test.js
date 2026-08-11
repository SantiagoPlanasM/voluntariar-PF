// test/integration/api.test.js
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('API — flujo completo (integración, servidor real + DB temporal)', () => {
  let baseUrl, close;

  before(async () => {
    ({ baseUrl, close } = await setupTestServer({ seed: false }));
  });

  after(async () => { await close(); });

  const api = (path, opts = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

  let volunteerToken, ngoToken, ngoUserId, volunteerId, projectId, enrollmentId;

  test('health check responde', async () => {
    const { status, body } = await api('/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
  });

  describe('auth', () => {
    test('registra un voluntario', async () => {
      const { status, body } = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Vale Voluntaria', email: 'vale@test.com', password: 'Password1', role: 'volunteer' }),
      });
      assert.equal(status, 201);
      assert.ok(body.token);
      volunteerToken = body.token;
      volunteerId = body.user.id;
    });

    test('registra una ONG', async () => {
      const { status, body } = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Admin Test ONG', email: 'ong@test.com', password: 'Password1', role: 'ngo' }),
      });
      assert.equal(status, 201);
      ngoToken = body.token;
      ngoUserId = body.user.id;
    });

    test('rechaza registrar el mismo email dos veces (409 Conflict)', async () => {
      const { status, body } = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Otro', email: 'vale@test.com', password: 'Password1', role: 'volunteer' }),
      });
      assert.equal(status, 409);
      assert.ok(body.error);
    });

    test('rechaza password débil', async () => {
      const { status } = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', email: 'debil@test.com', password: 'abc', role: 'volunteer' }),
      });
      assert.equal(status, 400);
    });

    test('login con credenciales correctas', async () => {
      const { status, body } = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'vale@test.com', password: 'Password1' }),
      });
      assert.equal(status, 200);
      assert.ok(body.token);
    });

    test('login con password incorrecta → 401', async () => {
      const { status } = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'vale@test.com', password: 'incorrecta' }),
      });
      assert.equal(status, 401);
    });
  });

  describe('proyectos — regresión bug B5 (cupos/volunteers_needed)', () => {
    test('BUG B5 — crear un proyecto con volunteers_needed funciona (antes daba 400 siempre)', async () => {
      const { status, body } = await api('/api/projects', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ngoToken}` },
        body: JSON.stringify({
          title: 'Reforestar el parque',
          description: 'Vamos a plantar árboles nativos en el parque de la ciudad',
          location: 'Córdoba', type: 'fugaz', duration: '1 día',
          volunteers_needed: 5, category: 'Medio Ambiente',
        }),
      });
      assert.equal(status, 201, `esperaba 201, recibí ${status}: ${JSON.stringify(body)}`);
      assert.equal(body.project.volunteers_needed, 5);
      projectId = body.project.id;
    });

    test('rechaza crear proyecto sin volunteers_needed', async () => {
      const { status, body } = await api('/api/projects', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ngoToken}` },
        body: JSON.stringify({
          title: 'Proyecto incompleto', description: 'Descripción de más de 10 caracteres',
          location: 'Córdoba', type: 'fugaz', duration: '1 día',
        }),
      });
      assert.equal(status, 400);
      assert.match(body.error, /cupos/);
    });

    test('un voluntario no puede crear proyectos (403)', async () => {
      const { status } = await api('/api/projects', {
        method: 'POST',
        headers: { Authorization: `Bearer ${volunteerToken}` },
        body: JSON.stringify({ title: 'x', description: 'x', location: 'x', type: 'fugaz', duration: '1', volunteers_needed: 1 }),
      });
      assert.equal(status, 403);
    });

    test('el proyecto aparece en el feed público', async () => {
      const { status, body } = await api('/api/projects');
      assert.equal(status, 200);
      assert.ok(body.projects.some(p => p.id === projectId));
    });
  });

  describe('ONG — regresión bug B2 (categoría no persistía)', () => {
    test('BUG B2 — la categoría se persiste y se refleja en GET /ngos/me', async () => {
      const before = await api('/api/ngos/me', { headers: { Authorization: `Bearer ${ngoToken}` } });
      assert.equal(before.status, 200);

      const put = await api('/api/ngos/me', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ngoToken}` },
        body: JSON.stringify({ name: 'Admin Test ONG', category: 'Educación' }),
      });
      assert.equal(put.status, 200);
      assert.equal(put.body.ngo.category, 'Educación');

      const after = await api('/api/ngos/me', { headers: { Authorization: `Bearer ${ngoToken}` } });
      assert.equal(after.body.ngo.category, 'Educación', 'la categoría tiene que sobrevivir a un segundo GET, no solo aparecer en la respuesta del PUT');
    });
  });

  describe('inscripciones — flujo completo + regresión bug B1 (mensaje)', () => {
    test('BUG B1 — el mensaje de inscripción se guarda y se puede leer después', async () => {
      const { status, body } = await api('/api/enrollments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${volunteerToken}` },
        body: JSON.stringify({ project_id: projectId, message: 'Tengo muchas ganas de ayudar!' }),
      });
      assert.equal(status, 201, JSON.stringify(body));
      assert.equal(body.enrollment.message, 'Tengo muchas ganas de ayudar!');
      enrollmentId = body.enrollment.id;

      const my = await api('/api/enrollments/my', { headers: { Authorization: `Bearer ${volunteerToken}` } });
      const found = my.body.enrollments.find(e => e.id === enrollmentId);
      assert.equal(found.message, 'Tengo muchas ganas de ayudar!');
    });

    test('no se puede inscribir dos veces al mismo proyecto (409 Conflict)', async () => {
      const { status } = await api('/api/enrollments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${volunteerToken}` },
        body: JSON.stringify({ project_id: projectId, message: 'de nuevo' }),
      });
      assert.equal(status, 409);
    });

    test('la ONG ve la solicitud pendiente en GET /ngos/me (optimización: sin N+1)', async () => {
      const { body } = await api('/api/ngos/me', { headers: { Authorization: `Bearer ${ngoToken}` } });
      assert.equal(body.stats.pending_enrollments, 1);
      assert.equal(body.pending_enrollments.length, 1);
      assert.equal(body.pending_enrollments[0].id, enrollmentId);
      assert.ok(body.pending_enrollments[0].volunteer_name, 'debe traer el nombre del voluntario ya resuelto');
    });

    test('la ONG aprueba la inscripción', async () => {
      const { status, body } = await api(`/api/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ngoToken}` },
        body: JSON.stringify({ status: 'approved' }),
      });
      assert.equal(status, 200, JSON.stringify(body));
    });

    test('cupos_ocupados subió a 1 tras aprobar', async () => {
      const { body } = await api(`/api/projects/${projectId}`);
      assert.equal(body.project.current_volunteers, 1);
    });
  });

  describe('horas — decisión de diseño: las carga la ONG, no el voluntario', () => {
    test('el voluntario NO puede auto-reportar sus horas (403)', async () => {
      const { status } = await api(`/api/enrollments/${enrollmentId}/horas`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${volunteerToken}` },
        body: JSON.stringify({ horas: 100 }),
      });
      assert.equal(status, 403);
    });

    test('la ONG dueña del proyecto SÍ puede cargar las horas', async () => {
      const { status, body } = await api(`/api/enrollments/${enrollmentId}/horas`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ngoToken}` },
        body: JSON.stringify({ horas: 6.5 }),
      });
      assert.equal(status, 200, JSON.stringify(body));
    });

    test('el voluntario ve las horas verificadas en su historial', async () => {
      const { body } = await api('/api/enrollments/my', { headers: { Authorization: `Bearer ${volunteerToken}` } });
      const found = body.enrollments.find(e => e.id === enrollmentId);
      assert.equal(found.hours_logged, 6.5);
    });
  });

  describe('recomendaciones', () => {
    test('un voluntario sin historial recibe recomendaciones "cold start"', async () => {
      const reg = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Nuevo Sin Historial', email: 'nuevo@test.com', password: 'Password1', role: 'volunteer' }),
      });
      const { status, body } = await api('/api/projects/recommended', {
        headers: { Authorization: `Bearer ${reg.body.token}` },
      });
      assert.equal(status, 200);
      assert.equal(body.based_on_history, false);
    });

    test('un voluntario con historial recibe recomendaciones influenciadas por categoría', async () => {
      const { status, body } = await api('/api/projects/recommended', {
        headers: { Authorization: `Bearer ${volunteerToken}` },
      });
      assert.equal(status, 200);
      // vale ya está inscripta (aprobada) en el proyecto de arriba
      assert.equal(body.based_on_history, true);
    });

    test('el proyecto donde ya está inscripta no aparece en sus recomendaciones', async () => {
      const { body } = await api('/api/projects/recommended', {
        headers: { Authorization: `Bearer ${volunteerToken}` },
      });
      assert.ok(!body.recommendations.some(p => p.id === projectId));
    });

    test('una ONG no puede pedir recomendaciones (son solo para voluntarios)', async () => {
      const { status } = await api('/api/projects/recommended', { headers: { Authorization: `Bearer ${ngoToken}` } });
      assert.equal(status, 403);
    });
  });

  describe('mensajes (chat)', () => {
    test('enviar y leer un mensaje entre voluntario y ONG', async () => {
      const send = await api('/api/messages', {
        method: 'POST',
        headers: { Authorization: `Bearer ${volunteerToken}` },
        body: JSON.stringify({ to: ngoUserId, body: 'Hola, tengo una pregunta' }),
      });
      assert.equal(send.status, 201, JSON.stringify(send.body));

      const conv = await api('/api/messages/conversations', { headers: { Authorization: `Bearer ${ngoToken}` } });
      assert.equal(conv.status, 200);
      assert.equal(conv.body.conversations.length, 1);
      assert.equal(conv.body.conversations[0].unread, 1);
      assert.equal(conv.body.conversations[0].last_message, 'Hola, tengo una pregunta');
    });

    test('rechaza mandarse un mensaje a uno mismo', async () => {
      const { status } = await api('/api/messages', {
        method: 'POST',
        headers: { Authorization: `Bearer ${volunteerToken}` },
        body: JSON.stringify({ to: volunteerId, body: 'hola yo mismo' }),
      });
      assert.equal(status, 400);
    });
  });
});
