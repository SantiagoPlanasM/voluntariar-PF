// test/integration/ngo-funnel.test.js — el embudo de postulaciones del panel de la ONG (§284).
//
// Pedido en la entrevista a FONBEC: "ver dónde invertimos nuestro tiempo". GET /api/ngos/me trae `funnel`, sumando
// TODOS los voluntariados de la ONG (y solo los suyos):
//   applications = postulaciones (cualquier estado); interviewed = con una entrevista programada o realizada (una
//   cancelada no cuenta); approved = aprobadas; with_hours = aprobadas con horas certificadas (> 0); rejected.
// Números (no texto): en Postgres los COUNT llegan como string (regla 13).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setupTestServer } = require('./helpers');

describe('Panel de la ONG: embudo de postulaciones', () => {
  let server, db, token, ngoId;
  const me = () => fetch(`${server.baseUrl}/api/ngos/me`, { headers: { Authorization: `Bearer ${token}` } })
    .then(async (r) => ({ status: r.status, body: await r.json() }));
  const post = (path, body) => fetch(`${server.baseUrl}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then((r) => r.json());

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
    const r = await post('/api/auth/register', { name: 'ONG Embudo', email: 'embudo@example.com', password: 'Password1', role: 'ngo' });
    token = r.token;
    ngoId = (await db.get('SELECT id FROM ngos WHERE user_id=$1', [r.user.id])).id;
  });
  after(async () => { if (server) await server.close(); });

  const project = async () => {
    const id = randomUUID();
    await db.run(`INSERT INTO projects (id, ngo_id, titulo, descripcion, ubicacion, cupos) VALUES ($1,$2,'Embudo','d','Córdoba',10)`, [id, ngoId]);
    return id;
  };
  const enroll = async (userId, projectId, status, horas = 0) => {
    const id = randomUUID();
    await db.run('INSERT INTO enrollments (id, user_id, project_id, status, horas_realizadas) VALUES ($1,$2,$3,$4,$5)',
      [id, userId, projectId, status, horas]);
    return id;
  };
  const interview = (enrollmentId, userId, projectId, estado) => db.run(
    `INSERT INTO reuniones (id, enrollment_id, user_id, project_id, fecha, horario, lugar, estado)
     VALUES ($1,$2,$3,$4,'2030-01-10','10:00','Sede',$5)`, [randomUUID(), enrollmentId, userId, projectId, estado]);

  test('sin postulaciones: todo en 0, y son números', async () => {
    const r = await me();
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.funnel, { applications: 0, interviewed: 0, approved: 0, with_hours: 0, rejected: 0 });
  });

  test('cuenta cada etapa sobre todos sus voluntariados, y nada de otras ONG', async () => {
    const p1 = await project();
    const p2 = await project();
    const a = await enroll('user-vol-1', p1, 'pending');
    await interview(a, 'user-vol-1', p1, 'programada');            // entrevistada
    const b = await enroll('user-vol-2', p1, 'pending');
    await interview(b, 'user-vol-2', p1, 'cancelada');             // cancelada: no cuenta
    const c = await enroll('user-vol-3', p2, 'approved', 4);
    await interview(c, 'user-vol-3', p2, 'realizada');             // entrevistada, aprobada, con horas
    await interview(c, 'user-vol-3', p2, 'cancelada');             // una cancelada vieja no la cuenta dos veces
    await interview(c, 'user-vol-3', p2, 'programada');            // realizada + programada: una sola postulación
    await enroll('user-vol-1', p2, 'approved', 0);                 // aprobada sin horas
    await enroll('user-vol-2', p2, 'rejected', 3);                 // rechazada después de cargarle horas: no cuenta
    const r = await me();
    assert.deepEqual(r.body.funnel, { applications: 5, interviewed: 2, approved: 2, with_hours: 1, rejected: 1 });
    for (const v of Object.values(r.body.funnel)) assert.equal(typeof v, 'number');
  });
});
