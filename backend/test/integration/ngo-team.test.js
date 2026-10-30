// test/integration/ngo-team.test.js — el equipo de la ONG: invitación, aceptación y panel (§294, docs/PLAN_EQUIPOS.md).
//
// Dueño (cuenta ngo):  GET/POST /api/equipo/miembros, PATCH/DELETE /api/equipo/miembros/:userId.
// Voluntario:          GET /api/equipo/mias, POST /api/equipo/mias/:ngoId/aceptar, DELETE /api/equipo/mias/:ngoId.
// Miembro activo:      GET /api/equipo/:ngoId/panel.
// Criterio:
//   - se invita por email a una cuenta de VOLUNTARIO que ya existe (si no hay cuenta: 404; ONG o empresa: 400);
//   - la persona invitada recibe una notificación ('team_invite') y no ve nada hasta aceptar;
//   - aceptar es idempotente y avisa al dueño; rechazar o salir borra la membresía;
//   - el panel lo ven los miembros activos: el coordinador con las postulaciones pendientes, el comunicador sin ellas.
// Seed: ngo-1 (Sustentando, admin@sustentando.org); ngo-4 (TechSocial, admin@techsocial.org); maria@example.com es
// voluntaria; proj-1 es de ngo-1.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Equipo de la ONG', () => {
  let server, baseUrl, db, owner, otherOwner, company, n = 0;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    owner = await login('admin@sustentando.org');
    otherOwner = await login('admin@techsocial.org');
    const c = await call('POST', '/api/auth/register', { name: 'Empresa Equipo', email: `emp-eq-${Date.now()}@example.com`, password: 'Password1', role: 'company' });
    company = { token: c.body.token, email: c.body.user.email };
  });
  after(async () => { if (server) await server.close(); });

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
    return { token: r.body.token, id: r.body.user.id, email };
  }
  // Directo en la base: el registro tiene un límite de 20 por hora por IP (§103) y este archivo crea más.
  const PASSWORD_HASH = require('bcryptjs').hashSync('Password1', 4);
  async function volunteer() {
    n += 1;
    const email = `equipo-${n}-${Date.now()}@example.com`;
    await db.run(`INSERT INTO users (id, name, email, password, role) VALUES ($1,$2,$3,$4,'volunteer')`,
      [require('node:crypto').randomUUID(), `Miembro ${n}`, email, PASSWORD_HASH]);
    return login(email);
  }
  const invite = (who, email, role = 'coordinator') => call('POST', '/api/equipo/miembros', { email, role }, who.token);
  const accept = (v, ngoId = 'ngo-1') => call('POST', `/api/equipo/mias/${ngoId}/aceptar`, undefined, v.token);
  const row = (userId, ngoId = 'ngo-1') => db.get('SELECT rol, estado FROM ngo_miembros WHERE ngo_id=$1 AND user_id=$2', [ngoId, userId]);

  test('invitar: queda invitada, le llega el aviso y aparece en la lista del dueño', async () => {
    const v = await volunteer();
    const r = await invite(owner, `  ${v.email.toUpperCase()} `);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.deepEqual({ role: r.body.member.role, status: r.body.member.status, user_id: r.body.member.user_id },
      { role: 'coordinator', status: 'invited', user_id: v.id });
    assert.deepEqual(await row(v.id), { rol: 'coordinador', estado: 'invitado' });
    const notif = await db.get(`SELECT type, body, data FROM notifications WHERE user_id=$1 AND type='team_invite'`, [v.id]);
    assert.ok(notif, 'le llegó la invitación');
    // §302: el rol con su nombre visible y dónde se acepta ahora (antes "Rol: coordinador" y "Configuración → Equipos").
    assert.equal(notif.body, 'Rol: Coordinación. Aceptala o rechazala desde tu Inicio o desde Equipos en tu perfil.');
    const list = (await call('GET', '/api/equipo/miembros', undefined, owner.token)).body.members;
    const m = list.find((x) => x.user_id === v.id);
    assert.equal(m.status, 'invited');
    assert.equal(m.email, v.email);
  });

  test('invitar: email sin cuenta → 404; ONG o empresa → 400; rol inventado o email inválido → 400; repetida → 409', async () => {
    assert.equal((await invite(owner, 'nadie-por-aca@example.com')).status, 404);
    assert.equal((await invite(owner, otherOwner.email)).status, 400);
    assert.equal((await invite(owner, company.email)).status, 400);
    const v = await volunteer();
    assert.equal((await invite(owner, v.email, 'admin')).status, 400);
    assert.equal((await invite(owner, 'no-es-un-email')).status, 400);
    assert.equal((await invite(owner, v.email)).status, 201);
    const again = await invite(owner, v.email, 'communicator');
    assert.equal(again.status, 409);
    assert.deepEqual(await row(v.id), { rol: 'coordinador', estado: 'invitado' }, 'la repetida no cambia nada');
  });

  test('solo una cuenta ONG gestiona su equipo', async () => {
    const v = await volunteer();
    assert.equal((await call('GET', '/api/equipo/miembros', undefined, v.token)).status, 403);
    assert.equal((await invite(v, (await volunteer()).email)).status, 403);
    assert.equal((await call('GET', '/api/equipo/miembros')).status, 401);
  });

  test('la invitada ve la invitación, la acepta (dos veces da lo mismo) y el dueño recibe el aviso', async () => {
    const v = await volunteer();
    await invite(owner, v.email, 'communicator');
    const invitation = await db.get(`SELECT body FROM notifications WHERE user_id=$1 AND type='team_invite'`, [v.id]);
    assert.match(invitation.body, /^Rol: Comunicación\. /);
    const mine = (await call('GET', '/api/equipo/mias', undefined, v.token)).body.memberships;
    assert.equal(mine.length, 1);
    assert.deepEqual({ ngo_id: mine[0].ngo_id, role: mine[0].role, status: mine[0].status }, { ngo_id: 'ngo-1', role: 'communicator', status: 'invited' });
    assert.ok(mine[0].ngo_name);
    const a = await accept(v);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(a.body.membership.status, 'active');
    assert.equal((await accept(v)).status, 200);
    assert.deepEqual(await row(v.id), { rol: 'comunicador', estado: 'activo' });
    const notif = await db.all(`SELECT 1 FROM notifications WHERE user_id=$1 AND type='team_joined' AND CAST(data AS TEXT) LIKE $2`, [owner.id, `%${v.id}%`]);
    assert.equal(notif.length, 1, 'un solo aviso al dueño aunque acepte dos veces');
  });

  test('aceptar sin invitación → 404; rechazar borra la invitación; salir borra la membresía', async () => {
    const v = await volunteer();
    assert.equal((await accept(v)).status, 404);
    await invite(owner, v.email);
    assert.equal((await call('DELETE', '/api/equipo/mias/ngo-1', undefined, v.token)).status, 200);
    assert.equal(await row(v.id), undefined);
    assert.equal((await call('DELETE', '/api/equipo/mias/ngo-1', undefined, v.token)).status, 404);
    await invite(owner, v.email);
    await accept(v);
    assert.equal((await call('DELETE', '/api/equipo/mias/ngo-1', undefined, v.token)).status, 200);
    assert.equal(await row(v.id), undefined);
  });

  test('el dueño cambia el rol y saca a alguien; no puede tocar miembros de otra ONG', async () => {
    const v = await volunteer();
    await invite(owner, v.email);
    await accept(v);
    const ch = await call('PATCH', `/api/equipo/miembros/${v.id}`, { role: 'communicator' }, owner.token);
    assert.equal(ch.status, 200, JSON.stringify(ch.body));
    assert.equal(ch.body.member.role, 'communicator');
    assert.equal((await call('PATCH', `/api/equipo/miembros/${v.id}`, { role: 'jefe' }, owner.token)).status, 400);
    assert.equal((await call('PATCH', `/api/equipo/miembros/${v.id}`, { role: 'coordinator' }, otherOwner.token)).status, 404);
    assert.equal((await call('DELETE', `/api/equipo/miembros/${v.id}`, undefined, otherOwner.token)).status, 404);
    assert.deepEqual(await row(v.id), { rol: 'comunicador', estado: 'activo' }, 'la otra ONG no cambió nada');
    assert.equal((await call('DELETE', `/api/equipo/miembros/${v.id}`, undefined, owner.token)).status, 200);
    assert.equal(await row(v.id), undefined);
  });

  test('se puede estar en dos ONG con roles distintos', async () => {
    const v = await volunteer();
    await invite(owner, v.email, 'coordinator');
    await invite(otherOwner, v.email, 'communicator');
    await accept(v, 'ngo-1');
    await accept(v, 'ngo-4');
    const mine = (await call('GET', '/api/equipo/mias', undefined, v.token)).body.memberships;
    assert.deepEqual(mine.map((m) => [m.ngo_id, m.role, m.status]).sort(), [['ngo-1', 'coordinator', 'active'], ['ngo-4', 'communicator', 'active']]);
  });

  test('panel: el coordinador ve proyectos y pendientes; el comunicador, solo proyectos; invitado u otro, 403', async () => {
    const coord = await volunteer();
    const com = await volunteer();
    const inv = await volunteer();
    await invite(owner, coord.email, 'coordinator'); await accept(coord);
    await invite(owner, com.email, 'communicator'); await accept(com);
    await invite(owner, inv.email, 'coordinator');
    const pc = await call('GET', '/api/equipo/ngo-1/panel', undefined, coord.token);
    assert.equal(pc.status, 200, JSON.stringify(pc.body));
    assert.equal(pc.body.role, 'coordinator');
    assert.equal(pc.body.ngo.id, 'ngo-1');
    assert.ok(pc.body.projects.some((p) => p.id === 'proj-1'));
    assert.ok(pc.body.projects.every((p) => typeof p.pending === 'number'));
    assert.ok(Array.isArray(pc.body.pending_enrollments));
    const pm = await call('GET', '/api/equipo/ngo-1/panel', undefined, com.token);
    assert.equal(pm.status, 200);
    assert.equal(pm.body.role, 'communicator');
    assert.equal(pm.body.pending_enrollments, undefined, 'el comunicador no ve postulaciones');
    assert.equal((await call('GET', '/api/equipo/ngo-1/panel', undefined, inv.token)).status, 403);
    assert.equal((await call('GET', '/api/equipo/ngo-4/panel', undefined, coord.token)).status, 403);
  });
});
