// test/integration/patrocinio-acuerdo-etapa2.test.js — acuerdo de patrocinio, etapa 2: charla y aceptación por versión
// (docs/archivo/PLAN_PATROCINIO.md, §264).
//
// Criterio:
// - proponer cuenta como que la empresa acepta la versión vigente: sin cambios, la ONG acepta y se cierra como antes
//   (el PATCH de siempre responde "Propuesta aceptada");
// - el acuerdo se cierra (`aceptado`) cuando las dos partes aceptaron la versión vigente; si un punto cambia, la versión
//   sube y las aceptaciones anteriores dejan de valer; aceptar una versión vieja: 409 "El acuerdo cambió: revisalo de
//   nuevo"; con el PATCH de la ONG, sin la empresa al día, queda esperando (200, sigue `propuesto`);
// - cualquiera de las dos rechaza; cerrado (aceptado o rechazado), nada más se cambia (409);
// - la charla: las dos partes escriben (1 a 1000 caracteres), se ve en el acuerdo con quién y cuándo, le avisa a la
//   otra parte; cerrado, es de solo lectura (409);
// - volver a proponer después de un rechazo: versión nueva, aceptada por la empresa, no por la ONG;
// - las dos aceptan la misma versión a la vez: se cierra una sola vez.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

let server, baseUrl, db, company, ngo1, ngo2, empresaId, projectId;
let seq = 0;

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
async function acuerdoNuevo() {
  const title = `Acuerdo ${++seq}`;
  const p = await call('/api/projects', {
    token: ngo1, method: 'POST',
    body: { title, description: 'Proyecto de prueba para el acuerdo', location: 'Córdoba', type: 'fugaz',
      duration: '1 día', volunteers_needed: 5, category: 'Medio Ambiente' },
  });
  assert.equal(p.status, 201, JSON.stringify(p.body));
  projectId = (await call('/api/projects?limit=500')).body.projects.find((x) => x.title === title).id;
  const r = await call('/api/empresas/me/patrocinios', { token: company, method: 'POST', body: { project_id: projectId } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return `/api/patrocinios/${empresaId}/${projectId}`;
}
const ver = async (url, token = company) => (await call(url, { token })).body.agreement;
const ongDecide = (estado) => call(`/api/ngos/me/patrocinios/${empresaId}/${projectId}`, { token: ngo1, method: 'PATCH', body: { estado } });
const aceptar = (url, token, version) => call(`${url}/aceptar`, { token, method: 'POST', body: { version } });
const punto = (url, token, detail = 'Guantes') => call(`${url}/puntos`, { token, method: 'POST', body: { type: 'supplies', detail } });
const avisos = async (token) => (await call('/api/notifications', { token })).body.notifications.map((n) => n.type);

before(async () => {
  server = await setupTestServer({ seed: true });
  baseUrl = server.baseUrl;
  db = require('../../src/db');
  [company, ngo1, ngo2] = await Promise.all(['admin@techcorp.com', 'admin@sustentando.org', 'admin@greencba.org'].map(login));
  empresaId = (await db.get(`SELECT e.id FROM empresas e JOIN users u ON u.id = e.user_id WHERE u.email = 'admin@techcorp.com'`)).id;
});
after(async () => { if (server) await server.close(); });

describe('Acuerdo de patrocinio: aceptación por versión', () => {
  test('sin cambios, como antes: la empresa ya aceptó al proponer y el PATCH de la ONG lo cierra', async () => {
    const url = await acuerdoNuevo();
    assert.deepEqual((await ver(url)).accepted, { company: true, ngo: false });
    const r = await ongDecide('aceptado');
    assert.deepEqual([r.status, r.body.message], [200, 'Propuesta aceptada']);
    const a = await ver(url);
    assert.deepEqual([a.status, a.accepted], ['aceptado', { company: true, ngo: true }]);
  });

  test('un punto nuevo anula las aceptaciones; la ONG acepta y espera a la empresa; la empresa acepta y se cierra', async () => {
    const url = await acuerdoNuevo();
    assert.equal((await punto(url, ngo1)).status, 201);
    const a1 = await ver(url);
    assert.deepEqual([a1.version, a1.accepted], [2, { company: false, ngo: false }]);

    const r = await ongDecide('aceptado');
    assert.deepEqual([r.status, r.body.message], [200, 'Aceptaste esta versión del acuerdo; falta que la empresa la acepte']);
    assert.deepEqual([(await ver(url)).status, (await ver(url)).accepted], ['propuesto', { company: false, ngo: true }]);
    assert.ok((await avisos(company)).includes('sponsorship_accepted_by_other'));

    const c = await aceptar(url, company, 2);
    assert.equal(c.status, 200, JSON.stringify(c.body));
    assert.deepEqual([c.body.agreement.status, c.body.agreement.accepted], ['aceptado', { company: true, ngo: true }]);
    assert.ok((await avisos(ngo1)).includes('sponsorship_closed'));
  });

  test('aceptar una versión vieja: 409; versión inválida: 400; cambiar después de aceptar anula la aceptación del otro', async () => {
    const url = await acuerdoNuevo();
    assert.equal((await punto(url, company)).status, 201); // v2
    const viejo = await aceptar(url, ngo1, 1);
    assert.deepEqual([viejo.status, viejo.body.error], [409, 'El acuerdo cambió: revisalo de nuevo']);
    for (const version of [undefined, '2', 2.5, 0]) {
      const r = await aceptar(url, ngo1, version);
      assert.deepEqual([r.status, r.body.error], [400, 'version inválida'], String(version));
    }
    assert.equal((await aceptar(url, ngo1, 2)).status, 200);
    assert.equal((await punto(url, company, 'Bolsas')).status, 201); // v3: la aceptación de la ONG (v2) ya no vale
    const c = await aceptar(url, company, 3);
    assert.deepEqual([c.body.agreement.status, c.body.agreement.accepted], ['propuesto', { company: true, ngo: false }]);
  });

  test('rechazar: cualquiera de las dos; cerrado, no se acepta, no se cambia ni se escribe (409)', async () => {
    for (const quien of ['company', 'ngo']) {
      const url = await acuerdoNuevo();
      const token = quien === 'company' ? company : ngo1;
      const r = await call(`${url}/rechazar`, { token, method: 'POST' });
      assert.deepEqual([r.status, r.body.agreement?.status], [200, 'rechazado'], quien);
      assert.ok((await avisos(quien === 'company' ? ngo1 : company)).includes('sponsorship_rejected'));
      const msg = 'El acuerdo ya está cerrado: no se puede cambiar';
      for (const x of [aceptar(url, company, 1), call(`${url}/rechazar`, { token, method: 'POST' }),
        call(`${url}/mensajes`, { token, method: 'POST', body: { body: 'hola' } }), punto(url, company)]) {
        const res = await x;
        assert.deepEqual([res.status, res.body.error], [409, msg], quien);
      }
    }
  });

  test('volver a proponer después de un rechazo: versión nueva, aceptada por la empresa y no por la ONG', async () => {
    const url = await acuerdoNuevo();
    assert.equal((await ongDecide('rechazado')).status, 200);
    assert.equal((await call('/api/empresas/me/patrocinios', { token: company, method: 'POST', body: { project_id: projectId } })).status, 201);
    const a = await ver(url);
    assert.deepEqual([a.status, a.version, a.accepted], ['propuesto', 2, { company: true, ngo: false }]);
  });

  test('las dos aceptan la misma versión a la vez: se cierra una sola vez', async () => {
    const url = await acuerdoNuevo();
    assert.equal((await punto(url, ngo1)).status, 201); // v2
    const rs = await Promise.all([aceptar(url, company, 2), aceptar(url, ngo1, 2)]);
    assert.deepEqual(rs.map((r) => r.status), [200, 200]);
    const a = await ver(url);
    assert.deepEqual([a.status, a.accepted], ['aceptado', { company: true, ngo: true }]);
    const cierres = await db.get(`SELECT COUNT(*) AS n FROM notifications WHERE type = 'sponsorship_closed' AND CAST(data AS TEXT) LIKE $1`, [`%${projectId}%`]);
    assert.equal(Number(cierres.n) || 0, 1);
  });
});

describe('Acuerdo de patrocinio: la charla', () => {
  test('las dos partes escriben; se ve en orden, con lado y nombre; avisa a la otra parte', async () => {
    const url = await acuerdoNuevo();
    const m1 = await call(`${url}/mensajes`, { token: ngo1, method: 'POST', body: { body: '¿Pueden ser 15 empleados?' } });
    assert.equal(m1.status, 201, JSON.stringify(m1.body));
    const m2 = await call(`${url}/mensajes`, { token: company, method: 'POST', body: { body: '  Dale, lo cambio.  ' } });
    assert.equal(m2.status, 201);
    const msgs = m2.body.agreement.messages.map(({ side, author_name, body }) => ({ side, author_name, body }));
    assert.deepEqual(msgs, [
      { side: 'ngo', author_name: m2.body.agreement.ngo_name, body: '¿Pueden ser 15 empleados?' },
      { side: 'company', author_name: m2.body.agreement.company_name, body: 'Dale, lo cambio.' },
    ]);
    assert.ok(m2.body.agreement.messages[0].created_at);
    assert.ok((await avisos(company)).includes('sponsorship_message'));
    assert.ok((await avisos(ngo1)).includes('sponsorship_message'));
    assert.equal((await ver(url)).version, 1, 'escribir no cambia la versión');
  });

  test('validación (400) y otra ONG (404)', async () => {
    const url = await acuerdoNuevo();
    for (const [body, error] of [[{}, 'El mensaje es obligatorio'], [{ body: '   ' }, 'El mensaje no puede estar vacío'],
      [{ body: 'x'.repeat(1001) }, 'El mensaje puede tener hasta 1000 caracteres']]) {
      const r = await call(`${url}/mensajes`, { token: company, method: 'POST', body });
      assert.deepEqual([r.status, r.body.error], [400, error]);
    }
    assert.equal((await call(`${url}/mensajes`, { token: ngo2, method: 'POST', body: { body: 'hola' } })).status, 404);
  });
});
