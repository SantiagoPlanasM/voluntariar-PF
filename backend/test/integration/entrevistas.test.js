// test/integration/entrevistas.test.js — entrevistas de la ONG con quienes se postulan (docs/PLAN_ENTREVISTAS.md).
//
// Una entrevista es una fila de `reuniones` atada a una postulación (`enrollment_id`). La tabla existía desde el
// primer esquema sin ningún endpoint; §261 le agrega la postulación, el lugar, la nota y `updated_at`.
// Criterio del esquema: (1) una sola entrevista PROGRAMADA por postulación (índice único parcial: las canceladas o
// realizadas no cuentan); (2) si la postulación se borra (cancelar la borra), sus entrevistas se borran con ella.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { setupTestServer } = require('./helpers');
const { isUniqueViolation } = require('../../src/lib/dbErrors');

// Un solo servidor para todo el archivo: src/db queda en la caché de require y un segundo servidor seguiría
// usando la base del primero.
let server, db;
before(async () => {
  server = await setupTestServer({ seed: true });
  db = require('../../src/db');
});
after(async () => { if (server) await server.close(); });

describe('Entrevistas: esquema de reuniones', () => {
  let enrollment;

  before(async () => {
    enrollment = await db.get(`SELECT id, user_id, project_id FROM enrollments ORDER BY id LIMIT 1`);
    assert.ok(enrollment, 'el seed no trajo postulaciones');
  });

  const insertar = (estado, e = enrollment) => db.run(
    `INSERT INTO reuniones (id, enrollment_id, user_id, project_id, fecha, horario, link, lugar, nota, estado)
     VALUES ($1,$2,$3,$4,'2030-01-15','10:30',NULL,'Sede de la ONG','Traé el DNI',$5)`,
    [crypto.randomUUID(), e.id, e.user_id, e.project_id, estado],
  );

  test('una entrevista guarda la postulación, el lugar y la nota', async () => {
    await db.run(`DELETE FROM reuniones WHERE enrollment_id=$1`, [enrollment.id]);
    await insertar('programada');
    const r = await db.get(`SELECT enrollment_id, lugar, nota, estado, updated_at FROM reuniones WHERE enrollment_id=$1`, [enrollment.id]);
    assert.deepEqual([r.enrollment_id, r.lugar, r.nota, r.estado], [enrollment.id, 'Sede de la ONG', 'Traé el DNI', 'programada']);
    assert.ok(r.updated_at, 'updated_at tiene que tener un valor por defecto');
  });

  test('una segunda entrevista programada de la misma postulación se rechaza; cancelada o realizada, no', async () => {
    await db.run(`DELETE FROM reuniones WHERE enrollment_id=$1`, [enrollment.id]);
    await insertar('programada');
    await assert.rejects(insertar('programada'), (err) => isUniqueViolation(err));
    await insertar('cancelada');
    await insertar('realizada');
    const n = await db.get(`SELECT COUNT(*) AS n FROM reuniones WHERE enrollment_id=$1`, [enrollment.id]);
    assert.equal(Number(n.n) || 0, 3);
  });

  test('borrar la postulación borra sus entrevistas', async () => {
    await db.run(`DELETE FROM reuniones WHERE enrollment_id=$1`, [enrollment.id]);
    await insertar('programada');
    await db.run(`DELETE FROM enrollments WHERE id=$1`, [enrollment.id]);
    const n = await db.get(`SELECT COUNT(*) AS n FROM reuniones WHERE enrollment_id=$1`, [enrollment.id]);
    assert.equal(Number(n.n) || 0, 0);
  });
});

// POST /api/enrollments/:id/entrevista — la ONG dueña agenda una entrevista ante una postulación PENDIENTE.
// Criterio: 201 con la entrevista y aviso a quien se postuló; fecha y hora válidas y futuras (hora de Argentina);
// link (https) o lugar, al menos uno; solo la ONG dueña (otra ONG: 404; un voluntario: 403); solo con la postulación
// pendiente (409); una sola programada (409), también con dos pedidos a la vez.
describe('Entrevistas: agendar', () => {
  let baseUrl, ngo1, ngo2, maria, juan, lucia;
  let seq = 0;

  before(async () => {
    baseUrl = server.baseUrl;
    [ngo1, ngo2, maria, juan, lucia] = await Promise.all(
      ['admin@sustentando.org', 'admin@greencba.org', 'maria@example.com', 'juan@example.com', 'lucia@example.com'].map(login));
  });

  const call = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  async function login(email) {
    const r = await call('/api/auth/login', { method: 'POST', body: { email, password: 'Password1' } });
    assert.equal(r.status, 200, `login ${email}`);
    return r.body.token;
  }

  /** Proyecto nuevo de la ONG 1 y una postulación pendiente de `token` (por defecto, María). */
  const postulacion = async (token = maria) => {
    const title = `Entrevistas ${++seq}`;
    const p = await call('/api/projects', {
      token: ngo1, method: 'POST',
      body: { title, description: 'Proyecto de prueba para las entrevistas', location: 'Córdoba', type: 'fugaz',
        duration: '1 día', volunteers_needed: 5, category: 'Medio Ambiente' },
    });
    assert.equal(p.status, 201, JSON.stringify(p.body));
    const projectId = (await call('/api/projects?limit=500')).body.projects.find((x) => x.title === title).id;
    const e = await call('/api/enrollments', { token, method: 'POST', body: { project_id: projectId } });
    assert.equal(e.status, 201, JSON.stringify(e.body));
    return e.body.enrollment;
  };
  const VALIDA = { date: '2030-03-10', time: '18:00', link: 'https://meet.google.com/abc-defg-hij', note: 'Charla corta' };
  const agendar = (id, body = VALIDA, token = ngo1) => call(`/api/enrollments/${id}/entrevista`, { token, method: 'POST', body });

  test('la ONG agenda: 201 con la entrevista, y a quien se postuló le llega el aviso', async () => {
    const e = await postulacion();
    const r = await agendar(e.id, { ...VALIDA, place: 'Sede de la ONG' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.deepEqual(
      { ...r.body.interview, id: undefined },
      { id: undefined, enrollment_id: e.id, date: '2030-03-10', time: '18:00', link: VALIDA.link, place: 'Sede de la ONG',
        note: 'Charla corta', status: 'scheduled' });
    const notifs = (await call('/api/notifications', { token: maria })).body.notifications;
    assert.ok(notifs.some((n) => n.type === 'interview_scheduled'), JSON.stringify(notifs.map((n) => n.type)));
  });

  test('valida fecha, hora, que sea futura, link o lugar, el link https y los largos (400, sin crear nada)', async () => {
    const e = await postulacion(juan);
    const casos = [
      [{ ...VALIDA, date: '10/03/2030' }, 'La fecha tiene que ser AAAA-MM-DD'],
      [{ ...VALIDA, date: '2030-02-30' }, 'La fecha tiene que ser AAAA-MM-DD'],
      [{ ...VALIDA, time: '25:00' }, 'La hora tiene que ser HH:MM'],
      [{ ...VALIDA, time: '9:00' }, 'La hora tiene que ser HH:MM'],
      [{ ...VALIDA, date: '2020-01-01' }, 'La entrevista tiene que ser en el futuro'],
      [{ date: VALIDA.date, time: VALIDA.time }, 'Indicá un link o un lugar para la entrevista'],
      [{ ...VALIDA, link: 'http://meet.google.com/x' }, 'El link tiene que empezar con https://'],
      [{ ...VALIDA, link: 'https://' + 'a'.repeat(500) }, 'El link puede tener hasta 500 caracteres'],
      [{ ...VALIDA, place: 'x'.repeat(201) }, 'El lugar puede tener hasta 200 caracteres'],
      [{ ...VALIDA, note: 'x'.repeat(501) }, 'La nota puede tener hasta 500 caracteres'],
      [{ ...VALIDA, note: 5 }, 'La nota tiene que ser un texto'],
    ];
    for (const [body, error] of casos) {
      const r = await agendar(e.id, body);
      assert.deepEqual([r.status, r.body.error], [400, error], JSON.stringify(body).slice(0, 80));
    }
    assert.equal((await agendar(e.id)).status, 201, 'ninguno de los inválidos tenía que crear una entrevista');
  });

  test('solo la ONG dueña: otra ONG 404, un voluntario 403', async () => {
    const e = await postulacion(lucia);
    assert.equal((await agendar(e.id, VALIDA, ngo2)).status, 404);
    assert.equal((await agendar(e.id, VALIDA, lucia)).status, 403);
    assert.equal((await agendar('no-existe', VALIDA)).status, 404);
  });

  test('con la postulación aprobada o rechazada no se agenda (409)', async () => {
    for (const status of ['approved', 'rejected']) {
      const e = await postulacion();
      assert.equal((await call(`/api/enrollments/${e.id}`, { token: ngo1, method: 'PATCH', body: { status } })).status, 200);
      const r = await agendar(e.id);
      assert.deepEqual([r.status, r.body.error], [409, 'Solo se puede agendar una entrevista con la postulación pendiente']);
    }
  });

  // PATCH /api/enrollments/:id/entrevista — sobre la entrevista PROGRAMADA de la postulación.
  // Criterio: { status: 'cancelled' } la cancela (aviso); { status: 'done' } la marca realizada solo si ya pasó la
  // fecha (409 si no); sin status, reprograma con las mismas validaciones del alta (aviso). Sin programada: 404.
  // Solo la ONG dueña. Y al aprobar o rechazar la postulación, la programada se cancela sola.
  const cambiar = (id, body, token = ngo1) => call(`/api/enrollments/${id}/entrevista`, { token, method: 'PATCH', body });
  const estadoEnBase = async (enrollmentId) =>
    (await db.all('SELECT estado FROM reuniones WHERE enrollment_id=$1 ORDER BY created_at, id', [enrollmentId])).map((r) => r.estado);

  test('reprogramar: cambia fecha, hora, link y lugar, valida igual que el alta y avisa', async () => {
    const e = await postulacion(juan);
    assert.equal((await agendar(e.id)).status, 201);
    const r = await cambiar(e.id, { date: '2030-04-01', time: '09:15', place: 'Plaza San Martín' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual([r.body.interview.date, r.body.interview.time, r.body.interview.link, r.body.interview.place, r.body.interview.status],
      ['2030-04-01', '09:15', null, 'Plaza San Martín', 'scheduled']);
    const bad = await cambiar(e.id, { date: '2020-01-01', time: '09:15', place: 'x' });
    assert.deepEqual([bad.status, bad.body.error], [400, 'La entrevista tiene que ser en el futuro']);
    const notifs = (await call('/api/notifications', { token: juan })).body.notifications;
    assert.ok(notifs.some((n) => n.type === 'interview_rescheduled'));
  });

  test('cancelar: queda cancelada, avisa, y se puede agendar otra', async () => {
    const e = await postulacion(lucia);
    assert.equal((await agendar(e.id)).status, 201);
    const r = await cambiar(e.id, { status: 'cancelled' });
    assert.deepEqual([r.status, r.body.interview?.status], [200, 'cancelled']);
    assert.deepEqual(await estadoEnBase(e.id), ['cancelada']);
    const notifs = (await call('/api/notifications', { token: lucia })).body.notifications;
    assert.ok(notifs.some((n) => n.type === 'interview_cancelled'));
    assert.equal((await agendar(e.id)).status, 201);
  });

  test('marcar realizada: antes de la fecha 409; después, realizada', async () => {
    const e = await postulacion();
    assert.equal((await agendar(e.id)).status, 201);
    const early = await cambiar(e.id, { status: 'done' });
    assert.deepEqual([early.status, early.body.error], [409, 'La entrevista todavía no pasó']);
    await db.run(`UPDATE reuniones SET fecha='2021-05-05' WHERE enrollment_id=$1`, [e.id]); // ya pasó
    const r = await cambiar(e.id, { status: 'done' });
    assert.deepEqual([r.status, r.body.interview?.status], [200, 'done']);
  });

  test('sin entrevista programada 404; status inválido 400; otra ONG 404; un voluntario 403', async () => {
    const e = await postulacion(juan);
    assert.equal((await cambiar(e.id, { status: 'cancelled' })).status, 404);
    assert.equal((await agendar(e.id)).status, 201);
    const bad = await cambiar(e.id, { status: 'scheduled' });
    assert.deepEqual([bad.status, bad.body.error], [400, 'status tiene que ser cancelled o done']);
    assert.equal((await cambiar(e.id, { status: 'cancelled' }, ngo2)).status, 404);
    assert.equal((await cambiar(e.id, { status: 'cancelled' }, juan)).status, 403);
    assert.deepEqual(await estadoEnBase(e.id), ['programada']);
  });

  test('aprobar o rechazar la postulación cancela la entrevista programada (la realizada queda)', async () => {
    for (const status of ['approved', 'rejected']) {
      const e = await postulacion(lucia);
      assert.equal((await agendar(e.id)).status, 201);
      assert.equal((await call(`/api/enrollments/${e.id}`, { token: ngo1, method: 'PATCH', body: { status } })).status, 200);
      assert.deepEqual(await estadoEnBase(e.id), ['cancelada'], status);
    }
    const e = await postulacion();
    assert.equal((await agendar(e.id)).status, 201);
    await db.run(`UPDATE reuniones SET estado='realizada' WHERE enrollment_id=$1`, [e.id]);
    assert.equal((await call(`/api/enrollments/${e.id}`, { token: ngo1, method: 'PATCH', body: { status: 'approved' } })).status, 200);
    assert.deepEqual(await estadoEnBase(e.id), ['realizada']);
  });

  test('cancelar la postulación (la borra) borra su entrevista', async () => {
    const e = await postulacion(juan);
    assert.equal((await agendar(e.id)).status, 201);
    assert.equal((await call(`/api/enrollments/${e.id}`, { token: juan, method: 'DELETE' })).status, 200);
    assert.deepEqual(await estadoEnBase(e.id), []);
  });

  test('una sola programada: la segunda da 409, y con dos pedidos a la vez pasa uno solo', async () => {
    const e = await postulacion();
    assert.equal((await agendar(e.id)).status, 201);
    const r = await agendar(e.id);
    assert.deepEqual([r.status, r.body.error], [409, 'Ya hay una entrevista programada para esta postulación']);

    const e2 = await postulacion(juan);
    const both = await Promise.all([agendar(e2.id), agendar(e2.id)]);
    assert.deepEqual(both.map((x) => x.status).sort(), [201, 409]);
  });
});
