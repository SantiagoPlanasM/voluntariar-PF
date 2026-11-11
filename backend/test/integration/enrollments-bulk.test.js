// test/integration/enrollments-bulk.test.js — la pantalla de postulaciones de la ONG (§319): todas las postulaciones de la
// ONG juntas y la decisión en lote.
//
// Criterio de aceptación (antes de escribir el código):
//   GET /api/enrollments/ngo[?ngo_id=]
//     - la dueña (sin ngo_id) o un coordinador activo (con ngo_id): las postulaciones de TODOS los voluntariados de la
//       ONG, de la más nueva a la más vieja, con el título del voluntariado y la misma forma que /project/:id (CV y
//       teléfono solo si está pendiente o aprobada); y la lista de voluntariados con sus cupos (para filtrar);
//     - comunicador, invitado sin aceptar, coordinador o dueña de otra ONG → 403, sin filtrar mails;
//     - un tope de filas: si hay más, `truncated: true`.
//   POST /api/enrollments/bulk { ids, status }
//     - aprueba o rechaza en el orden pedido, cada una con su compare-and-swap y su cupo (regla 20): al llenarse el
//       voluntariado, las que siguen quedan pendientes con outcome 'full';
//     - las que ya estaban así → 'unchanged' (sin aviso ni mail); las ajenas o inexistentes → 'not_found';
//       si ninguna es gestionable → 404 y la base igual;
//     - rechazar una aprobada libera el cupo; decidir cancela la entrevista programada (como PATCH /:id);
//     - avisa (notificación) solo a las que cambiaron; valida status, ids (1 a 500, strings) y repetidos.
//     - en Postgres, dos lotes a la vez sobre un voluntariado de 1 cupo aprueban una sola (la prueba importa en test:pg).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setupTestServer } = require('./helpers');

describe('Postulaciones de toda la ONG y decisión en lote (§319)', () => {
  let server, baseUrl, db, owner, otherOwner, coord, com, invited, foreignCoord, n = 0;
  const PASSWORD_HASH = require('bcryptjs').hashSync('Password1', 4);

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
    assert.equal(r.status, 200, `login ${email}`);
    return r.body.token;
  }
  async function volunteer() {
    n += 1;
    const id = randomUUID();
    const email = `bulk-${n}-${Date.now()}@example.com`;
    await db.run(`INSERT INTO users (id, name, email, password, role) VALUES ($1,$2,$3,$4,'volunteer')`, [id, `Persona ${n}`, email, PASSWORD_HASH]);
    await db.run(`INSERT INTO voluntarios (user_id, nombre, apellido) VALUES ($1,'Persona',$2)`, [id, String(n)]);
    return { id, email };
  }
  async function member(ngoId, rol, estado = 'activo') {
    const v = await volunteer();
    await db.run(`INSERT INTO ngo_miembros (id, ngo_id, user_id, rol, estado) VALUES ($1,$2,$3,$4,$5)`, [randomUUID(), ngoId, v.id, rol, estado]);
    return login(v.email);
  }
  async function project(ngoId, cupos, title = `Lote ${randomUUID().slice(0, 8)}`) {
    const id = randomUUID();
    await db.run(`INSERT INTO projects (id, ngo_id, titulo, descripcion, ubicacion, cupos, cupos_ocupados) VALUES ($1,$2,$3,'d','Córdoba',$4,0)`,
      [id, ngoId, title, cupos]);
    return id;
  }
  /** Postulaciones pendientes de gente nueva, creadas de a una (created_at distinto en SQLite: 1 s de resolución). */
  async function applicants(projectId, count, status = 'pending') {
    const ids = [];
    for (let i = 0; i < count; i += 1) {
      const v = await volunteer();
      const id = randomUUID();
      await db.run(`INSERT INTO enrollments (id, user_id, project_id, status, telefono, created_at) VALUES ($1,$2,$3,$4,'3515551234',$5)`,
        [id, v.id, projectId, status, new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString()]);   // n siempre crece: sin empates
      ids.push(id);
    }
    return ids;
  }
  const statusOf = async (id) => (await db.get('SELECT status FROM enrollments WHERE id=$1', [id]))?.status;
  const occupied = async (projectId) => Number((await db.get('SELECT cupos_ocupados FROM projects WHERE id=$1', [projectId])).cupos_ocupados);
  const bulk = (body, token = owner) => call('POST', '/api/enrollments/bulk', body, token);

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    owner = await login('admin@sustentando.org');        // ngo-1
    otherOwner = await login('admin@greencba.org');      // ngo-2
    coord = await member('ngo-1', 'coordinador');
    com = await member('ngo-1', 'comunicador');
    invited = await member('ngo-1', 'coordinador', 'invitado');
    foreignCoord = await member('ngo-2', 'coordinador');
  });
  after(async () => { if (server) await server.close(); });

  describe('GET /api/enrollments/ngo', () => {
    let mine, foreign, pendings, rejected;
    before(async () => {
      mine = await project('ngo-1', 5, 'Huerta del lote');
      pendings = await applicants(mine, 2);
      [rejected] = await applicants(mine, 1, 'rejected');
      foreign = await project('ngo-2', 5);
      await applicants(foreign, 1);
    });

    test('la dueña, sin ngo_id: las de todos sus voluntariados, con el título, y la lista de voluntariados con cupos', async () => {
      const r = await call('GET', '/api/enrollments/ngo', undefined, owner);
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.ngo, { id: 'ngo-1', name: (await db.get(`SELECT nombre FROM ngos WHERE id='ngo-1'`)).nombre });
      assert.equal(r.body.truncated, false);
      const ids = r.body.enrollments.map((e) => e.id);
      for (const id of [...pendings, rejected]) assert.ok(ids.includes(id), `falta ${id}`);
      assert.ok(r.body.enrollments.every((e) => e.project_id !== foreign), 'no trae las de otra ONG');
      assert.ok(r.body.enrollments.some((e) => e.project_id === 'proj-1'), 'trae también las de proj-1 (seed)');
      const e = r.body.enrollments.find((x) => x.id === pendings[0]);
      assert.equal(e.project_title, 'Huerta del lote');
      assert.equal(e.status, 'pending');
      assert.equal(e.phone, '3515551234');
      assert.equal(e.has_cv, false);
      assert.equal(e.interview, null);
      assert.match(e.volunteer_name, /^Persona /);
      assert.equal(e.cv_url, undefined, 'el public_id del CV no sale');
      assert.equal(r.body.enrollments.find((x) => x.id === rejected).phone, null, 'rechazada: sin teléfono');
      const p = r.body.projects.find((x) => x.id === mine);
      assert.deepEqual(p, { id: mine, title: 'Huerta del lote', status: 'active', volunteers_needed: 5, current_volunteers: 0 });
      assert.ok(r.body.projects.every((x) => x.id !== foreign));
    });

    test('de la más nueva a la más vieja', async () => {
      const r = await call('GET', '/api/enrollments/ngo', undefined, owner);
      const mineIds = r.body.enrollments.filter((e) => e.project_id === mine).map((e) => e.id);
      assert.deepEqual(mineIds, [rejected, pendings[1], pendings[0]]);
    });

    test('el coordinador con ngo_id: lo mismo; sin ngo_id (no es dueño de una ONG) → 400', async () => {
      const r = await call('GET', '/api/enrollments/ngo?ngo_id=ngo-1', undefined, coord);
      assert.equal(r.status, 200);
      assert.ok(r.body.enrollments.some((e) => e.id === pendings[0]));
      const s = await call('GET', '/api/enrollments/ngo', undefined, coord);
      assert.equal(s.status, 400);
    });

    for (const [label, who] of [['comunicador', () => com], ['invitado sin aceptar', () => invited],
      ['coordinador de otra ONG', () => foreignCoord], ['dueña de otra ONG', () => otherOwner]]) {
      test(`${label}: 403 con ngo_id=ngo-1, sin mails`, async () => {
        const r = await call('GET', '/api/enrollments/ngo?ngo_id=ngo-1', undefined, who());
        assert.equal(r.status, 403);
        assert.equal(r.body.enrollments, undefined);
        assert.ok(!JSON.stringify(r.body).includes('@example.com'));
      });
    }

    test('sin sesión → 401; la dueña pidiendo otra ONG → 403', async () => {
      assert.equal((await call('GET', '/api/enrollments/ngo')).status, 401);
      assert.equal((await call('GET', '/api/enrollments/ngo?ngo_id=ngo-2', undefined, owner)).status, 403);
    });

    test('ngo_id repetido en la URL (llega como lista): se ignora, como si no viniera → 400 para el coordinador', async () => {
      const r = await call('GET', '/api/enrollments/ngo?ngo_id=ngo-1&ngo_id=ngo-1', undefined, coord);
      assert.equal(r.status, 400);
    });

    test('con justo tantas filas como el tope: todas y sin truncated', async () => {
      const enrollments = require('../../src/routes/enrollments');
      const total = (await call('GET', '/api/enrollments/ngo', undefined, owner)).body.enrollments.length;
      const before = enrollments.manageLimit;
      enrollments.manageLimit = total;
      try {
        const r = await call('GET', '/api/enrollments/ngo', undefined, owner);
        assert.equal(r.body.enrollments.length, total);
        assert.equal(r.body.truncated, false);
      } finally { enrollments.manageLimit = before; }
    });

    test('con más filas que el tope: corta y avisa con truncated', async () => {
      const enrollments = require('../../src/routes/enrollments');
      const before = enrollments.manageLimit;
      enrollments.manageLimit = 2;
      try {
        const r = await call('GET', '/api/enrollments/ngo', undefined, owner);
        assert.equal(r.status, 200);
        assert.equal(r.body.enrollments.length, 2);
        assert.equal(r.body.truncated, true);
      } finally { enrollments.manageLimit = before; }
    });
  });

  describe('POST /api/enrollments/bulk', () => {
    test('aprobar 4 en un voluntariado de 2 cupos: las 2 primeras (en el orden pedido) y las otras quedan pendientes', async () => {
      const p = await project('ngo-1', 2);
      const ids = await applicants(p, 4);
      const order = [ids[2], ids[0], ids[3], ids[1]];
      const r = await bulk({ ids: order, status: 'approved' });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.results, [
        { id: ids[2], outcome: 'applied' }, { id: ids[0], outcome: 'applied' },
        { id: ids[3], outcome: 'full' }, { id: ids[1], outcome: 'full' },
      ]);
      assert.deepEqual(r.body.summary, { applied: 2, unchanged: 0, full: 2, stale: 0, not_found: 0 });
      assert.deepEqual(await Promise.all(ids.map(statusOf)), ['approved', 'pending', 'approved', 'pending']);
      assert.equal(await occupied(p), 2);
      const notes = await db.all(`SELECT type FROM notifications WHERE type='enrollment_approved' AND CAST(data AS TEXT) LIKE $1`, [`%${p}%`]);
      assert.equal(notes.length, 2, 'aviso solo a las que cambiaron');
    });

    test('rechazar: la pendiente cambia, la ya rechazada queda (sin aviso) y la aprobada libera el cupo', async () => {
      const p = await project('ngo-1', 3);
      const [pend] = await applicants(p, 1);
      const [rej] = await applicants(p, 1, 'rejected');
      const [appr] = await applicants(p, 1);
      assert.equal((await bulk({ ids: [appr], status: 'approved' })).status, 200);
      assert.equal(await occupied(p), 1);
      const r = await bulk({ ids: [pend, rej, appr], status: 'rejected' });
      assert.deepEqual(r.body.results.map((x) => x.outcome), ['applied', 'unchanged', 'applied']);
      assert.deepEqual(await Promise.all([pend, rej, appr].map(statusOf)), ['rejected', 'rejected', 'rejected']);
      assert.equal(await occupied(p), 0);
      const notes = await db.all(`SELECT type FROM notifications WHERE type='enrollment_rejected' AND CAST(data AS TEXT) LIKE $1`, [`%${p}%`]);
      assert.equal(notes.length, 2);
    });

    test('decidir cancela la entrevista programada (como PATCH /:id)', async () => {
      const p = await project('ngo-1', 3);
      const [e] = await applicants(p, 1);
      const { user_id } = await db.get('SELECT user_id FROM enrollments WHERE id=$1', [e]);
      await db.run(`INSERT INTO reuniones (id, enrollment_id, user_id, project_id, fecha, horario, estado) VALUES ($1,$2,$3,$4,'2030-01-10','10:00','programada')`,
        [randomUUID(), e, user_id, p]);
      await bulk({ ids: [e], status: 'approved' });
      assert.equal((await db.get('SELECT estado FROM reuniones WHERE enrollment_id=$1', [e])).estado, 'cancelada');
    });

    test('las ajenas o inexistentes → not_found (y no cambian); las propias se deciden igual', async () => {
      const mine = await project('ngo-1', 3);
      const [m] = await applicants(mine, 1);
      const foreign = await project('ngo-2', 3);
      const [f] = await applicants(foreign, 1);
      const r = await bulk({ ids: [f, 'no-existe', m], status: 'approved' });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.results, [{ id: f, outcome: 'not_found' }, { id: 'no-existe', outcome: 'not_found' }, { id: m, outcome: 'applied' }]);
      assert.equal(await statusOf(f), 'pending');
      assert.equal(await occupied(foreign), 0);
    });

    test('ninguna gestionable → 404 y la base igual (comunicador, invitado, otra ONG)', async () => {
      const p = await project('ngo-1', 3);
      const [e] = await applicants(p, 1);
      for (const token of [com, invited, foreignCoord, otherOwner]) {
        const r = await bulk({ ids: [e], status: 'approved' }, token);
        assert.equal(r.status, 404);
        assert.equal(r.body.results, undefined);
      }
      assert.equal(await statusOf(e), 'pending');
      assert.equal(await occupied(p), 0);
    });

    test('el coordinador activo puede', async () => {
      const p = await project('ngo-1', 3);
      const [e] = await applicants(p, 1);
      const r = await bulk({ ids: [e], status: 'approved' }, coord);
      assert.equal(r.status, 200);
      assert.equal(await statusOf(e), 'approved');
    });

    test('los ids repetidos cuentan una vez', async () => {
      const p = await project('ngo-1', 3);
      const [e] = await applicants(p, 1);
      const r = await bulk({ ids: [e, e], status: 'approved' });
      assert.deepEqual(r.body.results, [{ id: e, outcome: 'applied' }]);
      assert.equal(await occupied(p), 1);
    });

    test('validación: status, ids (lista de 1 a 500 textos); sin sesión 401; empresa 403', async () => {
      const p = await project('ngo-1', 3);
      const [e] = await applicants(p, 1);
      for (const body of [{ ids: [e], status: 'pending' }, { ids: [e] }, { ids: [], status: 'approved' }, { ids: e, status: 'approved' },
        { ids: [1], status: 'approved' }, { ids: [''], status: 'approved' }, { ids: Array.from({ length: 501 }, (_, i) => `x${i}`), status: 'approved' }]) {
        const r = await bulk(body);
        assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80));
        assert.ok(r.body.error);
      }
      assert.equal((await bulk({ ids: Array.from({ length: 500 }, (_, i) => `x${i}`), status: 'approved' })).status, 404, '500 justos pasan la validación');
      assert.equal((await call('POST', '/api/enrollments/bulk', { ids: [e], status: 'approved' })).status, 401);
      assert.equal((await bulk({ ids: [e], status: 'approved' }, await login('admin@techcorp.com'))).status, 403);
      assert.equal(await statusOf(e), 'pending');
    });

    test('los mails del lote salen de a uno, separados por bulkEmailGapMs (y el primero sin esperar)', async () => {
      const enrollments = require('../../src/routes/enrollments');
      const before = enrollments.bulkEmailGapMs;
      enrollments.bulkEmailGapMs = 40;
      const times = [];
      try {
        const t0 = Date.now();
        await enrollments.sendSpaced([{ to: 'a' }, { to: 'b' }, { to: 'c' }], async () => { times.push(Date.now() - t0); });
      } finally { enrollments.bulkEmailGapMs = before; }
      assert.equal(times.length, 3);
      assert.ok(times[0] < 30, `el primero sale enseguida (${times[0]} ms)`);
      assert.ok(times[1] - times[0] >= 35 && times[2] - times[1] >= 35, `separados: ${times.join(', ')}`);
    });

    // §323 (Sonar S9383): la ruta llama a sendSpaced sin esperarla, después de responder. Si un envío tiraba un error
    // sincrónico, la promesa se rechazaba sin que nadie la manejara (en Node 22 eso tira abajo el proceso).
    test('un mail que falla (rechazo o error sincrónico) no corta a los demás y sendSpaced nunca rechaza', async () => {
      const enrollments = require('../../src/routes/enrollments');
      const before = enrollments.bulkEmailGapMs;
      enrollments.bulkEmailGapMs = 1;
      const sent = [];
      try {
        await enrollments.sendSpaced([{ to: 'a' }, { to: 'b' }, { to: 'c' }], (m) => {
          if (m.to === 'a') throw new Error('sincrónico');
          if (m.to === 'b') return Promise.reject(new Error('rechazo'));
          sent.push(m.to);
          return Promise.resolve();
        });
      } finally { enrollments.bulkEmailGapMs = before; }
      assert.deepEqual(sent, ['c']);
    });

    test('dos lotes a la vez sobre 1 cupo: aprueban una sola (regla 20; importa en test:pg)', async () => {
      const p = await project('ngo-1', 1);
      const ids = await applicants(p, 2);
      const [a, b] = await Promise.all([bulk({ ids: [ids[0]], status: 'approved' }), bulk({ ids: [ids[1]], status: 'approved' })]);
      assert.equal(a.status, 200);
      assert.equal(b.status, 200);
      const outcomes = [a.body.results[0].outcome, b.body.results[0].outcome].sort();
      assert.deepEqual(outcomes, ['applied', 'full']);
      assert.equal(await occupied(p), 1);
    });
  });
});
