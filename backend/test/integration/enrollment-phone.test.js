// test/integration/enrollment-phone.test.js — teléfono de contacto opcional en la postulación (§291).
//
// Lo pidió la entrevistada de FONBEC: para coordinar, a la ONG le sirve más un teléfono que un email. Es un dato
// personal, así que:
//   - es opcional y se guarda por postulación (enrollments.telefono), no en el perfil;
//   - se valida: texto con dígitos, espacios, guiones, paréntesis y un + inicial, con 6 a 15 dígitos;
//   - la ONG lo ve solo mientras la postulación está pendiente o aprobada (el mismo criterio que el CV, §165/§168);
//     rechazada o cancelada, sale null. El voluntario ve el suyo.
// Seed: Sustentando (ngo-1, admin@sustentando.org).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setupTestServer } = require('./helpers');

describe('Postulación: teléfono de contacto', () => {
  let server, baseUrl, db, ngo, n = 0;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    const r = await call('POST', '/api/auth/login', { email: 'admin@sustentando.org', password: 'Password1' });
    ngo = { token: r.body.token };
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
  const volunteer = async () => {
    n += 1;
    const r = await call('POST', '/api/auth/register',
      { name: 'Tel Prueba', email: `tel-${n}-${Date.now()}@example.com`, password: 'Password1', role: 'volunteer' });
    return { token: r.body.token, id: r.body.user.id };
  };
  const project = async () => {
    const id = randomUUID();
    await db.run(`INSERT INTO projects (id, ngo_id, titulo, descripcion, ubicacion, cupos) VALUES ($1,'ngo-1','Con teléfono','d','Córdoba',10)`, [id]);
    return id;
  };
  const enroll = (v, projectId, extra = {}) => call('POST', '/api/enrollments', { project_id: projectId, ...extra }, v.token);
  const asNgo = async (projectId) => (await call('GET', `/api/enrollments/project/${projectId}`, undefined, ngo.token)).body.enrollments;

  test('con teléfono: se guarda sin espacios de los bordes y lo ven el voluntario y la ONG', async () => {
    const v = await volunteer();
    const p = await project();
    const r = await enroll(v, p, { phone: '  +54 9 (351) 555-1234 ' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.enrollment.phone, '+54 9 (351) 555-1234');
    const mine = (await call('GET', '/api/enrollments/my', undefined, v.token)).body.enrollments.find((e) => e.project_id === p);
    assert.equal(mine.phone, '+54 9 (351) 555-1234');
    const theirs = (await asNgo(p)).find((e) => e.user_id === v.id);
    assert.equal(theirs.phone, '+54 9 (351) 555-1234');
    assert.equal(theirs.telefono, undefined, 'el nombre de la columna no sale en la API');
  });

  test('sin teléfono, vacío o solo espacios: null', async () => {
    for (const extra of [{}, { phone: '' }, { phone: '   ' }, { phone: null }]) {
      const v = await volunteer();
      const p = await project();
      const r = await enroll(v, p, extra);
      assert.equal(r.status, 201, JSON.stringify(extra));
      assert.equal(r.body.enrollment.phone, null, JSON.stringify(extra));
    }
  });

  test('teléfono inválido: 400 y no se crea la postulación', async () => {
    const invalid = [123456789, ['3515551234'], 'abc3515551234', '12345', '1234567890123456', '351+5551234', '351.555.1234',
      '1 2 3 4 5 6 7 8 9 0 1 2 3 4'];   // 14 dígitos pero 27 caracteres: el tope de 25
    for (const phone of invalid) {
      const v = await volunteer();
      const p = await project();
      const r = await enroll(v, p, { phone });
      assert.equal(r.status, 400, JSON.stringify(phone));
      assert.match(r.body.error, /teléfono/i);
      assert.equal(await db.get('SELECT id FROM enrollments WHERE user_id=$1', [v.id]), undefined, JSON.stringify(phone));
    }
  });

  test('los bordes: 6 y 15 dígitos valen', async () => {
    for (const phone of ['123456', '+123456789012345']) {
      const v = await volunteer();
      assert.equal((await enroll(v, await project(), { phone })).status, 201, phone);
    }
  });

  test('la ONG lo ve pendiente y aprobada, pero no rechazada', async () => {
    const p = await project();
    const ok = await volunteer();
    const no = await volunteer();
    const okId = (await enroll(ok, p, { phone: '351 555 0001' })).body.enrollment.id;
    const noId = (await enroll(no, p, { phone: '351 555 0002' })).body.enrollment.id;
    assert.equal((await call('PATCH', `/api/enrollments/${okId}`, { status: 'approved' }, ngo.token)).status, 200);
    assert.equal((await call('PATCH', `/api/enrollments/${noId}`, { status: 'rejected' }, ngo.token)).status, 200);
    const list = await asNgo(p);
    assert.equal(list.find((e) => e.id === okId).phone, '351 555 0001');
    assert.equal(list.find((e) => e.id === noId).phone, null, 'rechazada: no se muestra');
    const mine = (await call('GET', '/api/enrollments/my', undefined, no.token)).body.enrollments.find((e) => e.id === noId);
    assert.equal(mine.phone, '351 555 0002', 'el voluntario sigue viendo el suyo');
  });

  test('las pendientes del panel de la ONG (/ngos/me y /ngos/:id/dashboard) traen phone, nunca telefono', async () => {
    const v = await volunteer();
    const p = await project();
    const id = (await enroll(v, p, { phone: '0351 4555555' })).body.enrollment.id;
    const me = (await call('GET', '/api/ngos/me', undefined, ngo.token)).body;
    const fromMe = me.pending_enrollments.find((e) => e.id === id);
    assert.equal(fromMe.phone, '0351 4555555');
    const dash = (await call('GET', `/api/ngos/${me.ngo.id}/dashboard`, undefined, ngo.token)).body;
    const fromDash = dash.pending_enrollments.find((e) => e.id === id);
    assert.equal(fromDash.phone, '0351 4555555');
    assert.equal(fromDash.telefono, undefined);
    assert.equal(fromMe.telefono, undefined);
  });
});
