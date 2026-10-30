// test/integration/ngo-team-access.test.js — qué puede hacer cada miembro del equipo (§295, docs/PLAN_EQUIPOS.md).
//
// Tabla del plan, sobre las rutas que se abren al equipo (las demás siguen siendo solo del dueño):
//   | Acción                                              | Coordinador | Comunicador |
//   | Ver postulaciones (GET /enrollments/project/:id)    | Sí          | No          |
//   | Aprobar o rechazar (PATCH /enrollments/:id)         | Sí          | No          |
//   | Agendar y cambiar entrevistas                       | Sí          | No          |
//   | Cargar horas                                        | Sí          | No          |
//   | Ver el CV de quien se postuló (pendiente/aprobada)  | Sí          | No          |
//   | Publicar Momentos en los voluntariados de la ONG    | Sí          | Sí          |
// Un invitado sin aceptar y un coordinador de OTRA ONG no pueden nada, y la base no cambia.
// Seed: ngo-1 (Sustentando, admin@sustentando.org) con proj-1; ngo-4 (TechSocial, admin@techsocial.org).
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setupTestServer } = require('./helpers');

const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

describe('Equipo de la ONG: permisos en postulaciones, CV y Momentos', () => {
  let server, baseUrl, db, storage, owner, otherOwner, coord, com, invited, foreignCoord, n = 0;
  const PASSWORD_HASH = require('bcryptjs').hashSync('Password1', 4);

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    storage = require('../../src/lib/storage');
    mock.method(storage, 'isConfigured', () => true);
    mock.method(storage, 'pdfDownloadUrl', (publicId) => ({ url: `https://cdn.example/${publicId}`, expiresAt: '2030-01-01T00:00:00Z' }));
    mock.method(storage, 'uploadImage', async () => ({ url: 'https://res.cloudinary.com/demo/m.jpg', publicId: `test/m-${randomUUID()}`, width: 10, height: 10, bytes: 10 }));
    owner = await login('admin@sustentando.org');
    otherOwner = await login('admin@techsocial.org');
    coord = await member('ngo-1', 'coordinador');
    com = await member('ngo-1', 'comunicador');
    invited = await member('ngo-1', 'coordinador', 'invitado');
    foreignCoord = await member('ngo-4', 'coordinador');
  });
  after(async () => { mock.restoreAll(); if (server) await server.close(); });

  async function call(method, path, body, token) {
    const r = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }
  async function login(email) {
    const r = await call('POST', '/api/auth/login', { email, password: 'Password1' });
    return { token: r.body.token, id: r.body.user.id };
  }
  async function volunteerUser() {
    n += 1;
    const id = randomUUID();
    const email = `acc-${n}-${Date.now()}@example.com`;
    await db.run(`INSERT INTO users (id, name, email, password, role) VALUES ($1,$2,$3,$4,'volunteer')`, [id, `Persona ${n}`, email, PASSWORD_HASH]);
    await db.run(`INSERT INTO voluntarios (user_id, nombre, apellido) VALUES ($1,'Persona',$2)`, [id, String(n)]);
    return { ...(await login(email)), id };
  }
  async function member(ngoId, rol, estado = 'activo') {
    const u = await volunteerUser();
    await db.run(`INSERT INTO ngo_miembros (id, ngo_id, user_id, rol, estado) VALUES ($1,$2,$3,$4,$5)`, [randomUUID(), ngoId, u.id, rol, estado]);
    return u;
  }
  // Una postulación pendiente a un voluntariado nuevo de ngo-1, de alguien con CV cargado.
  let projectId, applicant, enrollmentId;
  beforeEach(async () => {
    projectId = randomUUID();
    await db.run(`INSERT INTO projects (id, ngo_id, titulo, descripcion, ubicacion, cupos) VALUES ($1,'ngo-1','Del equipo','d','Córdoba',10)`, [projectId]);
    applicant = await volunteerUser();
    await db.run('UPDATE voluntarios SET cv_url=$1 WHERE user_id=$2', [`cv/${applicant.id}`, applicant.id]);
    enrollmentId = randomUUID();
    await db.run(`INSERT INTO enrollments (id, user_id, project_id, status) VALUES ($1,$2,$3,'pending')`, [enrollmentId, applicant.id, projectId]);
  });
  const status = async () => (await db.get('SELECT status FROM enrollments WHERE id=$1', [enrollmentId])).status;
  const interview = { date: '2030-03-10', time: '18:30', place: 'Sede' };
  const post = (who, project) => {
    const form = new FormData();
    form.append('project_id', project);
    form.append('photos', new Blob([Buffer.concat([JPEG_HEAD, Buffer.alloc(100, 1)])], { type: 'image/jpeg' }), 'f.jpg');
    return fetch(`${baseUrl}/api/posts`, { method: 'POST', headers: { Authorization: `Bearer ${who.token}` }, body: form })
      .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  };

  test('coordinador: ve las postulaciones, el CV, agenda la entrevista, aprueba y carga horas', async () => {
    const list = await call('GET', `/api/enrollments/project/${projectId}`, undefined, coord.token);
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.ok(list.body.enrollments.some((e) => e.id === enrollmentId));
    const cv = await call('GET', `/api/voluntarios/${applicant.id}/cv`, undefined, coord.token);
    assert.equal(cv.status, 200, JSON.stringify(cv.body));
    const iv = await call('POST', `/api/enrollments/${enrollmentId}/entrevista`, interview, coord.token);
    assert.equal(iv.status, 201, JSON.stringify(iv.body));
    const ch = await call('PATCH', `/api/enrollments/${enrollmentId}/entrevista`, { ...interview, time: '19:00' }, coord.token);
    assert.equal(ch.status, 200, JSON.stringify(ch.body));
    const ok = await call('PATCH', `/api/enrollments/${enrollmentId}`, { status: 'approved' }, coord.token);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(await status(), 'approved');
    const h = await call('PATCH', `/api/enrollments/${enrollmentId}/horas`, { horas: 6 }, coord.token);
    assert.equal(h.status, 200, JSON.stringify(h.body));
  });

  test('coordinador: puede rechazar', async () => {
    assert.equal((await call('PATCH', `/api/enrollments/${enrollmentId}`, { status: 'rejected' }, coord.token)).status, 200);
    assert.equal(await status(), 'rejected');
  });

  for (const [who, label] of [[() => com, 'comunicador'], [() => invited, 'invitado sin aceptar'], [() => foreignCoord, 'coordinador de otra ONG'], [() => otherOwner, 'dueña de otra ONG']]) {
    test(`${label}: ni postulaciones, ni CV, ni entrevista, ni aprobar, ni horas; la base no cambia`, async () => {
      const u = who();
      assert.ok([403, 404].includes((await call('GET', `/api/enrollments/project/${projectId}`, undefined, u.token)).status));
      assert.equal((await call('GET', `/api/voluntarios/${applicant.id}/cv`, undefined, u.token)).status, 404);
      assert.ok([403, 404].includes((await call('POST', `/api/enrollments/${enrollmentId}/entrevista`, interview, u.token)).status));
      assert.ok([403, 404].includes((await call('PATCH', `/api/enrollments/${enrollmentId}`, { status: 'approved' }, u.token)).status));
      assert.equal(await status(), 'pending');
      await db.run(`UPDATE enrollments SET status='approved' WHERE id=$1`, [enrollmentId]);
      assert.ok([403, 404].includes((await call('PATCH', `/api/enrollments/${enrollmentId}/horas`, { horas: 3 }, u.token)).status));
      const h = await db.get('SELECT horas_realizadas FROM enrollments WHERE id=$1', [enrollmentId]);
      assert.equal(Number(h.horas_realizadas) || 0, 0);
      assert.equal(await db.get('SELECT id FROM reuniones WHERE enrollment_id=$1', [enrollmentId]), undefined);
    });
  }

  test('el CV de alguien rechazado no lo ve ni el coordinador (mismo criterio que la ONG)', async () => {
    await db.run(`UPDATE enrollments SET status='rejected' WHERE id=$1`, [enrollmentId]);
    assert.equal((await call('GET', `/api/voluntarios/${applicant.id}/cv`, undefined, coord.token)).status, 404);
  });

  test('Momentos: coordinador y comunicador publican en los voluntariados de su ONG; invitado y de otra ONG, no', async () => {
    assert.equal((await post(coord, projectId)).status, 201);
    assert.equal((await post(com, projectId)).status, 201);
    assert.equal((await post(invited, projectId)).status, 403);
    assert.equal((await post(foreignCoord, projectId)).status, 403);
    const eligible = (await call('GET', '/api/posts/eligible-projects', undefined, com.token)).body.projects;
    assert.ok(eligible.some((p) => p.id === projectId), 'el comunicador ve los voluntariados de su ONG para publicar');
    const notMine = (await call('GET', '/api/posts/eligible-projects', undefined, foreignCoord.token)).body.projects;
    assert.ok(!notMine.some((p) => p.id === projectId));
    const notYet = (await call('GET', '/api/posts/eligible-projects', undefined, invited.token)).body.projects;
    assert.ok(!notYet.some((p) => p.id === projectId), 'un invitado sin aceptar todavía no');
  });

  test('el dueño sigue pudiendo todo', async () => {
    assert.equal((await call('GET', `/api/enrollments/project/${projectId}`, undefined, owner.token)).status, 200);
    assert.equal((await call('PATCH', `/api/enrollments/${enrollmentId}`, { status: 'approved' }, owner.token)).status, 200);
  });
});
