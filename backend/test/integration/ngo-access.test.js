// test/integration/ngo-access.test.js — quién puede actuar sobre una ONG (§293, docs/PLAN_EQUIPOS.md paso 1).
//
// Hasta acá, todo lo de una ONG lo hacía la cuenta dueña (ngos.user_id). Con el equipo, un voluntario puede ser
// miembro de una o varias ONG (ngo_miembros), con rol coordinador o comunicador, y solo cuenta si aceptó la
// invitación (estado 'activo'). lib/ngoAccess.js es el único lugar que responde:
//   ngoAccess(userId, ngoId)         → 'owner' | 'coordinador' | 'comunicador' | null
//   projectAccess(userId, projectId) → { ngoId, access } (access como arriba) o null si el proyecto no existe
//   canManageEnrollments(access)     → true para el dueño y el coordinador
// Seed: ngo-1 (Sustentando, admin@sustentando.org), ngo-4 (TechSocial); proj-1 es de ngo-1.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setupTestServer } = require('./helpers');

describe('lib/ngoAccess', () => {
  let server, db, access, owner1, n = 0;

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
    access = require('../../src/lib/ngoAccess');
    owner1 = (await db.get(`SELECT user_id FROM ngos WHERE id='ngo-1'`)).user_id;
  });
  after(async () => { if (server) await server.close(); });

  const volunteer = async () => {
    n += 1;
    const id = randomUUID();
    await db.run(`INSERT INTO users (id, name, email, password, role) VALUES ($1,'Miembro',$2,'x','volunteer')`,
      [id, `miembro-${n}-${Date.now()}@example.com`]);
    return id;
  };
  const member = (ngoId, userId, rol, estado = 'activo') => db.run(
    `INSERT INTO ngo_miembros (id, ngo_id, user_id, rol, estado) VALUES ($1,$2,$3,$4,$5)`, [randomUUID(), ngoId, userId, rol, estado]);

  test('la cuenta dueña es owner', async () => {
    assert.equal(await access.ngoAccess(owner1, 'ngo-1'), 'owner');
  });

  test('un miembro activo tiene su rol; invitado sin aceptar, nada', async () => {
    const coord = await volunteer();
    const com = await volunteer();
    const inv = await volunteer();
    await member('ngo-1', coord, 'coordinador');
    await member('ngo-1', com, 'comunicador');
    await member('ngo-1', inv, 'coordinador', 'invitado');
    assert.equal(await access.ngoAccess(coord, 'ngo-1'), 'coordinador');
    assert.equal(await access.ngoAccess(com, 'ngo-1'), 'comunicador');
    assert.equal(await access.ngoAccess(inv, 'ngo-1'), null);
  });

  test('cada membresía vale solo para su ONG; se puede estar en varias con roles distintos', async () => {
    const u = await volunteer();
    await member('ngo-1', u, 'coordinador');
    await member('ngo-4', u, 'comunicador');
    assert.equal(await access.ngoAccess(u, 'ngo-1'), 'coordinador');
    assert.equal(await access.ngoAccess(u, 'ngo-4'), 'comunicador');
    assert.equal(await access.ngoAccess(u, 'ngo-2'), null);
    assert.equal(await access.ngoAccess(owner1, 'ngo-4'), null, 'la dueña de una ONG no es dueña de otra');
  });

  test('sin usuario, ONG inexistente o cualquier otro: null', async () => {
    assert.equal(await access.ngoAccess(await volunteer(), 'ngo-1'), null);
    assert.equal(await access.ngoAccess(owner1, 'no-existe'), null);
    assert.equal(await access.ngoAccess(null, 'ngo-1'), null);
    assert.equal(await access.ngoAccess(undefined, undefined), null);
  });

  test('projectAccess: la ONG del proyecto y el acceso; proyecto inexistente, null', async () => {
    const coord = await volunteer();
    await member('ngo-1', coord, 'coordinador');
    assert.deepEqual(await access.projectAccess(owner1, 'proj-1'), { ngoId: 'ngo-1', access: 'owner' });
    assert.deepEqual(await access.projectAccess(coord, 'proj-1'), { ngoId: 'ngo-1', access: 'coordinador' });
    assert.deepEqual(await access.projectAccess(await volunteer(), 'proj-1'), { ngoId: 'ngo-1', access: null });
    assert.equal(await access.projectAccess(owner1, 'no-existe'), null);
  });

  test('canManageEnrollments: dueño y coordinador sí; comunicador y nadie, no', () => {
    assert.equal(access.canManageEnrollments('owner'), true);
    assert.equal(access.canManageEnrollments('coordinador'), true);
    assert.equal(access.canManageEnrollments('comunicador'), false);
    assert.equal(access.canManageEnrollments(null), false);
  });

  test('la base no deja roles ni estados inventados, ni dos membresías en la misma ONG', async () => {
    const u = await volunteer();
    await assert.rejects(member('ngo-1', u, 'admin'));
    await assert.rejects(member('ngo-1', u, 'coordinador', 'raro'));
    await member('ngo-1', u, 'coordinador');
    await assert.rejects(member('ngo-1', u, 'comunicador'));
  });
});
