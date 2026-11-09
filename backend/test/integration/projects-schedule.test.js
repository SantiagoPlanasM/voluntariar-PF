// test/integration/projects-schedule.test.js
//
// Cuándo es un voluntariado (§315; decisión del usuario del 9/11): fecha de inicio y de fin, opcionales, y hora de
// inicio y de fin, también opcionales. Con hora, el evento del calendario lleva hora; sin hora, es de día completo.
//   API: start_date, end_date ("AAAA-MM-DD") y start_time, end_time ("HH:MM", hora de Argentina), o null.
//   Base: projects.fecha_inicio / fecha_fin (ya existían, sin uso) y hora_inicio / hora_fin (nuevas).
// Las reglas valen igual en el alta y en la edición parcial (lo que viene + lo que ya estaba).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

const BASE = {
  title: 'Jornada de plantación', description: 'Plantamos árboles nativos en la costanera',
  location: 'Córdoba', type: 'fugaz', duration: '1 jornada', volunteers_needed: 10,
};
const NONE = { start_date: null, end_date: null, start_time: null, end_time: null };

describe('Fechas y horas de un voluntariado', () => {
  let server, db, ngoToken, maria;

  const call = (path, { method = 'GET', body, token = ngoToken } = {}) => fetch(`${server.baseUrl}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const create = (extra) => call('/api/projects', { method: 'POST', body: { ...BASE, ...extra } });
  const schedule = (p) => ({ start_date: p.start_date, end_date: p.end_date, start_time: p.start_time, end_time: p.end_time });
  const login = async (email) => (await (await fetch(`${server.baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password1' }),
  })).json()).token;

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
    ngoToken = await login('admin@sustentando.org');
    maria = await login('maria@example.com');
  });
  after(async () => { if (server) await server.close(); });

  describe('alta (POST /api/projects)', () => {
    test('con fecha y horas: se guardan y salen en la respuesta y en el detalle', async () => {
      const when = { start_date: '2026-12-05', end_date: '2026-12-05', start_time: '09:00', end_time: '13:30' };
      const r = await create(when);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.deepEqual(schedule(r.body.project), when);
      const row = await db.get('SELECT fecha_inicio, fecha_fin, hora_inicio, hora_fin FROM projects WHERE id=$1', [r.body.project.id]);
      assert.deepEqual({ ...row }, { fecha_inicio: '2026-12-05', fecha_fin: '2026-12-05', hora_inicio: '09:00', hora_fin: '13:30' });
      const d = await call(`/api/projects/${r.body.project.id}`, { token: null });
      assert.deepEqual(schedule(d.body.project), when);
    });

    test('sin nada: los cuatro en null (como los voluntariados de antes)', async () => {
      const r = await create({});
      assert.equal(r.status, 201);
      assert.deepEqual(schedule(r.body.project), NONE);
    });

    test('solo fechas (día completo, varios días) y solo fecha de inicio', async () => {
      const a = await create({ start_date: '2026-12-01', end_date: '2027-03-31' });
      assert.deepEqual(schedule(a.body.project), { ...NONE, start_date: '2026-12-01', end_date: '2027-03-31' });
      const b = await create({ start_date: '2026-12-01', start_time: '18:00' });
      assert.deepEqual(schedule(b.body.project), { ...NONE, start_date: '2026-12-01', start_time: '18:00' });
    });

    test('vacíos ("") cuentan como sin dato', async () => {
      const r = await create({ start_date: '2026-12-01', end_date: '', start_time: '', end_time: '' });
      assert.equal(r.status, 201);
      assert.deepEqual(schedule(r.body.project), { ...NONE, start_date: '2026-12-01' });
    });

    test('varios días con hora: la hora de fin puede ser menor que la de inicio (otro día)', async () => {
      const r = await create({ start_date: '2026-12-05', end_date: '2026-12-06', start_time: '18:00', end_time: '12:00' });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    });

    const bad = [
      [{ start_date: '05/12/2026' }, 'La fecha de inicio tiene que ser una fecha válida (AAAA-MM-DD)'],
      [{ start_date: '2026-02-30' }, 'La fecha de inicio tiene que ser una fecha válida (AAAA-MM-DD)'],
      [{ start_date: 20261205 }, 'La fecha de inicio tiene que ser una fecha válida (AAAA-MM-DD)'],
      [{ start_date: '2026-12-01', end_date: '2026-13-01' }, 'La fecha de fin tiene que ser una fecha válida (AAAA-MM-DD)'],
      [{ end_date: '2026-12-01' }, 'La fecha de fin necesita una fecha de inicio'],
      [{ start_date: '2026-12-02', end_date: '2026-12-01' }, 'La fecha de fin no puede ser anterior a la de inicio'],
      [{ start_date: '2026-12-01', start_time: '9:00' }, 'La hora de inicio tiene que tener el formato HH:MM'],
      [{ start_date: '2026-12-01', start_time: '24:00' }, 'La hora de inicio tiene que tener el formato HH:MM'],
      [{ start_date: '2026-12-01', start_time: '10:00', end_time: '10:60' }, 'La hora de fin tiene que tener el formato HH:MM'],
      [{ start_time: '10:00' }, 'La hora necesita una fecha de inicio'],
      [{ end_time: '12:00' }, 'La hora necesita una fecha de inicio'],
      [{ start_date: '2026-12-01', end_time: '12:00' }, 'La hora de fin necesita una hora de inicio'],
      [{ start_date: '2026-12-01', start_time: '10:00', end_time: '10:00' }, 'La hora de fin tiene que ser posterior a la de inicio'],
      [{ start_date: '2026-12-01', end_date: '2026-12-01', start_time: '10:00', end_time: '09:00' }, 'La hora de fin tiene que ser posterior a la de inicio'],
    ];
    for (const [extra, msg] of bad) {
      test(`400: ${msg} (${JSON.stringify(extra)})`, async () => {
        const before = Number((await db.get('SELECT COUNT(*) AS n FROM projects')).n);
        const r = await create(extra);
        assert.equal(r.status, 400);
        assert.equal(r.body.error, msg);
        assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM projects')).n), before);
      });
    }
  });

  describe('edición parcial (PUT /api/projects/:id)', () => {
    let id;
    before(async () => {
      id = (await create({ start_date: '2026-12-05', start_time: '09:00', end_time: '13:00' })).body.project.id;
    });
    const put = (body) => call(`/api/projects/${id}`, { method: 'PUT', body });

    test('lo que no viene se conserva', async () => {
      const r = await put({ title: 'Jornada de plantación nativa' });
      assert.equal(r.status, 200);
      assert.deepEqual(schedule(r.body.project), { start_date: '2026-12-05', end_date: null, start_time: '09:00', end_time: '13:00' });
    });

    test('cambiar una parte se valida contra lo que ya estaba', async () => {
      const r = await put({ end_time: '08:00' });
      assert.equal(r.status, 400);
      assert.equal(r.body.error, 'La hora de fin tiene que ser posterior a la de inicio');
      assert.equal((await put({ end_date: '2026-12-06', end_time: '08:00' })).status, 200);
    });

    test('borrar la fecha de inicio sin borrar las horas → 400; borrando todo → sin fechas', async () => {
      assert.equal((await put({ start_date: null })).status, 400);
      const r = await put({ ...NONE });
      assert.equal(r.status, 200);
      assert.deepEqual(schedule(r.body.project), NONE);
    });
  });

  test('Mis voluntariados (GET /api/enrollments/my) trae las fechas del voluntariado', async () => {
    const p = (await create({ start_date: '2026-12-10', start_time: '10:00', end_time: '12:00' })).body.project;
    const e = await call('/api/enrollments', { method: 'POST', token: maria, body: { project_id: p.id, message: 'Quiero sumarme', phone: '3511234567' } });
    assert.ok([200, 201].includes(e.status), JSON.stringify(e.body));
    const mine = await call('/api/enrollments/my', { token: maria });
    const item = mine.body.enrollments.find((x) => x.project_id === p.id);
    assert.deepEqual(schedule(item), { start_date: '2026-12-10', end_date: null, start_time: '10:00', end_time: '12:00' });
  });
});
