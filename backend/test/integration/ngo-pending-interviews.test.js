// test/integration/ngo-pending-interviews.test.js — el panel de la ONG ve la entrevista de cada postulación (§279).
//
// Pedido del usuario: desde el panel no se veía nada de las entrevistas (había que entrar al voluntariado). Criterio:
// GET /api/ngos/me trae en cada postulación pendiente `interview`, con la misma forma y la misma regla que las otras
// listas (§261): la programada si hay; si no, la última; null si nunca hubo.
// Seed: maria (user-vol-1) tiene una postulación pendiente en proj-9, de techsocial (ngo-4).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Panel de la ONG: la entrevista de cada postulación pendiente', () => {
  let server, ngoToken, enrollmentId;
  const call = (path, { method = 'GET', body } = {}) => fetch(`${server.baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ngoToken}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const pendingOfMaria = async () => {
    const r = await call('/api/ngos/me');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.pending_enrollments.find((e) => e.id === enrollmentId);
  };

  before(async () => {
    server = await setupTestServer({ seed: true });
    const login = await fetch(`${server.baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@techsocial.org', password: 'Password1' }),
    }).then((r) => r.json());
    ngoToken = login.token;
    const db = require('../../src/db');
    const row = await db.get(`SELECT id FROM enrollments WHERE user_id='user-vol-1' AND project_id='proj-9' AND status='pending'`);
    assert.ok(row, 'el seed trae la postulación pendiente de maria en proj-9');
    enrollmentId = row.id;
  });
  after(async () => { if (server) await server.close(); });

  test('sin entrevista: interview es null (y el campo está)', async () => {
    const e = await pendingOfMaria();
    assert.ok(e, 'la postulación está en el panel');
    assert.ok('interview' in e, 'la fila trae el campo interview');
    assert.equal(e.interview, null);
  });

  test('con una agendada: la trae con fecha, hora, lugar y estado', async () => {
    const r = await call(`/api/enrollments/${enrollmentId}/entrevista`, {
      method: 'POST', body: { date: '2030-03-10', time: '18:30', place: 'Sede de la ONG' },
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const e = await pendingOfMaria();
    assert.deepEqual(
      { date: e.interview.date, time: e.interview.time, place: e.interview.place, status: e.interview.status, enrollment_id: e.interview.enrollment_id },
      { date: '2030-03-10', time: '18:30', place: 'Sede de la ONG', status: 'scheduled', enrollment_id: enrollmentId },
    );
  });

  test('cancelada: muestra la última (cancelada), como las otras listas', async () => {
    const r = await call(`/api/enrollments/${enrollmentId}/entrevista`, { method: 'PATCH', body: { status: 'cancelled' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const e = await pendingOfMaria();
    assert.equal(e.interview.status, 'cancelled');
  });
});
