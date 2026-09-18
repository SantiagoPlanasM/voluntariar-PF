// test/integration/follows.test.js
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Sistema de Seguimiento y Feed Personalizado', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
  });

  after(async () => {
    if (server) await server.close();
  });

  const api = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async r => {
      const data = await r.json().catch(() => ({}));
      return { status: r.status, ok: r.ok, body: data };
    });

  let volunteerToken;
  let volunteerId;
  let ngoToken;
  let ngoId;
  let projectId;

  test('Login como voluntario y ONG de prueba (seed data)', async () => {
    // Voluntario: Lucia
    const volRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'lucia@example.com', password: 'Password1' },
    });
    assert.equal(volRes.status, 200);
    volunteerToken = volRes.body.token;
    volunteerId = volRes.body.user.id;

    // Obtener ONGs y proyectos
    const ngosRes = await api('/api/ngos');
    assert.equal(ngosRes.status, 200);
    assert.ok(ngosRes.body.ngos.length > 0);
    ngoId = ngosRes.body.ngos[0].id;

    const projRes = await api('/api/projects');
    assert.equal(projRes.status, 200);
    assert.ok(projRes.body.projects.length > 0);
    projectId = projRes.body.projects[0].id;
  });

  test('Seguir y dejar de seguir una ONG', async () => {
    // 1) Estado inicial: no la sigue
    const st1 = await api(`/api/follows/ngo/${ngoId}/status`, { token: volunteerToken });
    assert.equal(st1.body.following, false);

    // 2) Seguir ONG
    const fol = await api(`/api/follows/ngo/${ngoId}`, { token: volunteerToken, method: 'POST' });
    assert.equal(fol.status, 200);
    assert.equal(fol.body.following, true);

    // 3) Estado ahora: la sigue
    const st2 = await api(`/api/follows/ngo/${ngoId}/status`, { token: volunteerToken });
    assert.equal(st2.body.following, true);

    // 4) Aparece en GET /api/follows/ngo
    const list = await api('/api/follows/ngo', { token: volunteerToken });
    assert.equal(list.status, 200);
    assert.ok(list.body.ngos.some(n => n.id === ngoId));

    // 5) Feed ahora contiene proyectos de esa ONG
    const feed = await api('/api/follows/feed', { token: volunteerToken });
    assert.equal(feed.status, 200);
    assert.ok(feed.body.projects.length > 0);
    assert.ok(feed.body.projects.some(p => p.ngo_id === ngoId));

    // 6) Dejar de seguir ONG
    const unfol = await api(`/api/follows/ngo/${ngoId}`, { token: volunteerToken, method: 'DELETE' });
    assert.equal(unfol.status, 200);
    assert.equal(unfol.body.following, false);

    // 7) Ya no la sigue
    const st3 = await api(`/api/follows/ngo/${ngoId}/status`, { token: volunteerToken });
    assert.equal(st3.body.following, false);
  });

  test('Seguir y dejar de seguir un voluntariado individual', async () => {
    // 1) Estado inicial
    const st1 = await api(`/api/follows/project/${projectId}/status`, { token: volunteerToken });
    assert.equal(st1.body.following, false);

    // 2) Seguir voluntariado
    const fol = await api(`/api/follows/project/${projectId}`, { token: volunteerToken, method: 'POST' });
    assert.equal(fol.status, 200);
    assert.equal(fol.body.following, true);

    // 3) Estado: siguiendo
    const st2 = await api(`/api/follows/project/${projectId}/status`, { token: volunteerToken });
    assert.equal(st2.body.following, true);

    // 4) Aparece en GET /api/follows/feed con follow_source
    const feed = await api('/api/follows/feed', { token: volunteerToken });
    assert.equal(feed.status, 200);
    const p = feed.body.projects.find(x => x.id === projectId);
    assert.ok(p);
    assert.equal(p.follow_source, 'project_follow');

    // 5) Dejar de seguir
    const unfol = await api(`/api/follows/project/${projectId}`, { token: volunteerToken, method: 'DELETE' });
    assert.equal(unfol.status, 200);
    assert.equal(unfol.body.following, false);
  });

  test('Restricción de ratings: solo participantes aprobados pueden calificar', async () => {
    // 1) Voluntario no inscripto intenta calificar proj-5 -> 403 Forbidden
    const unapprovedRes = await api('/api/projects/proj-5/ratings', {
      token: volunteerToken,
      method: 'POST',
      body: { rating: 5, comment: 'Intento sin inscripción' },
    });
    assert.equal(unapprovedRes.status, 403);
    assert.ok(unapprovedRes.body.error.includes('aprobada'));

    // 2) Voluntario con inscripción aprobada (Lucia en proj-4) -> 200 OK
    const approvedRes = await api('/api/projects/proj-4/ratings', {
      token: volunteerToken,
      method: 'POST',
      body: { rating: 5, comment: 'Excelente proyecto donde participé' },
    });
    assert.equal(approvedRes.status, 200);
    assert.ok(approvedRes.body.message.includes('Calificación guardada'));
  });

  test('Comentarios distinguen si el usuario participó o no', async () => {
    // Lucia comenta en proj-5 donde NO participó -> is_participant: 0
    const nonPartRes = await api('/api/projects/proj-5/comments', {
      token: volunteerToken,
      method: 'POST',
      body: { comment: 'Comentario de interesada sin haber participado' },
    });
    assert.equal(nonPartRes.status, 201);
    assert.equal(nonPartRes.body.comment.is_participant, 0);

    // Lucia comenta en proj-4 donde SÍ participó con inscripción aprobada -> is_participant: 1
    const partRes = await api('/api/projects/proj-4/comments', {
      token: volunteerToken,
      method: 'POST',
      body: { comment: 'Comentario de voluntaria que participó activamente' },
    });
    assert.equal(partRes.status, 201);
    assert.equal(partRes.body.comment.is_participant, 1);

    // Consultar el proyecto y ver el flag en los comentarios
    const proj = await api('/api/projects/proj-4');
    const posted = proj.body.project.comments.find(c => c.id === partRes.body.comment.id);
    assert.ok(posted);
    assert.equal(posted.is_participant, 1);
  });
});
