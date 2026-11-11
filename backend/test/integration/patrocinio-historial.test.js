// test/integration/patrocinio-historial.test.js — acuerdo de patrocinio: quién cambió qué y el historial (§324).
//
// Paso 1 del rediseño del acuerdo (diseño del 11/11: lista única, "editado por", historial por versión). Criterio:
// - cada cambio de un punto (agregar, editar, quitar) queda registrado con su versión, quién lo hizo, cuándo y el
//   punto antes y después (con el monto: el historial solo lo ven las partes);
// - cada punto dice quién lo agregó y, si alguien lo editó, quién y cuándo;
// - cada aceptación queda registrada (proponer, aceptar y el PATCH de siempre de la ONG), y el acuerdo dice qué
//   versión aceptó cada parte y cuándo aceptó la vigente;
// - GET …/historial: las versiones de la más nueva a la más vieja, con sus cambios y quién las aceptó; solo las partes;
// - dos cambios a la vez quedan en versiones distintas, cada uno con su registro (importa en test:pg).
// Todavía no cambia cómo se negocia: cada cambio de un punto sigue siendo una versión.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

let server, baseUrl, db, company, ngo1, ngo2, maria, empresaId, projectId;
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
  const title = `Historial ${++seq}`;
  const p = await call('/api/projects', {
    token: ngo1, method: 'POST',
    body: { title, description: 'Proyecto de prueba para el historial', location: 'Córdoba', type: 'fugaz',
      duration: '1 día', volunteers_needed: 5, category: 'Medio Ambiente' },
  });
  assert.equal(p.status, 201, JSON.stringify(p.body));
  projectId = (await call('/api/projects?limit=500')).body.projects.find((x) => x.title === title).id;
  const r = await call('/api/empresas/me/patrocinios', { token: company, method: 'POST', body: { project_id: projectId, mensaje: 'Queremos ayudar' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return `/api/patrocinios/${empresaId}/${projectId}`;
}
const ver = async (url, token = company) => (await call(url, { token })).body.agreement;
const historial = async (url, token = company) => {
  const r = await call(`${url}/historial`, { token });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.versions;
};
const agregar = (url, token, body) => call(`${url}/puntos`, { token, method: 'POST', body });
const ongDecide = (estado) => call(`/api/ngos/me/patrocinios/${empresaId}/${projectId}`, { token: ngo1, method: 'PATCH', body: { estado } });

before(async () => {
  server = await setupTestServer({ seed: true });
  baseUrl = server.baseUrl;
  db = require('../../src/db');
  [company, ngo1, ngo2, maria] = await Promise.all(
    ['admin@techcorp.com', 'admin@sustentando.org', 'admin@greencba.org', 'maria@example.com'].map(login));
  empresaId = (await db.get(`SELECT e.id FROM empresas e JOIN users u ON u.id = e.user_id WHERE u.email = 'admin@techcorp.com'`)).id;
});
after(async () => { if (server) await server.close(); });

describe('Acuerdo de patrocinio: quién cambió qué', () => {
  test('cada punto dice quién lo agregó; editado, quién y cuándo', async () => {
    const url = await acuerdoNuevo();
    await agregar(url, company, { type: 'money', detail: 'Plantines', amount: 1000 });
    const r = await agregar(url, ngo1, { type: 'outreach', detail: 'Logo en remeras' });
    const ngoPoint = r.body.agreement.points.find((p) => p.side === 'ngo');
    let a = await ver(url);
    const money = a.points.find((p) => p.side === 'company');
    assert.equal(money.created_by_name, 'Admin TechCorp');
    assert.equal(ngoPoint.created_by_name, 'Admin Sustentando');
    assert.equal(money.edited_by_name, null);
    assert.equal(money.edited_at, null);

    const e = await call(`${url}/puntos/${ngoPoint.id}`, { token: ngo1, method: 'PATCH', body: { detail: 'Logo en remeras y redes' } });
    assert.equal(e.status, 200, JSON.stringify(e.body));
    a = await ver(url);
    const edited = a.points.find((p) => p.id === ngoPoint.id);
    assert.equal(edited.edited_by_name, 'Admin Sustentando');
    assert.ok(edited.edited_at, 'editado: con fecha');
    assert.equal(a.points.find((p) => p.id === money.id).edited_by_name, null, 'el otro sigue sin editar');
  });

  test('el historial: agregar, editar y quitar, cada uno en su versión, con antes y después', async () => {
    const url = await acuerdoNuevo();
    const r1 = await agregar(url, company, { type: 'money', detail: 'Plantines', amount: 450000 });
    const pid = r1.body.agreement.points[0].id;
    await call(`${url}/puntos/${pid}`, { token: company, method: 'PATCH', body: { detail: 'Plantines y herramientas', amount: 500000 } });
    await call(`${url}/puntos/${pid}`, { token: company, method: 'DELETE' });

    const v = await historial(url);
    assert.deepEqual(v.map((x) => x.version), [4, 3, 2, 1], 'de la más nueva a la más vieja');
    const [quita, edita, agrega, propuesta] = v;

    assert.deepEqual(agrega.changes, [{
      action: 'add', point_id: pid, side: 'company', before: null,
      after: { type: 'money', detail: 'Plantines', amount: 450000 },
    }]);
    assert.deepEqual(edita.changes[0].before, { type: 'money', detail: 'Plantines', amount: 450000 });
    assert.deepEqual(edita.changes[0].after, { type: 'money', detail: 'Plantines y herramientas', amount: 500000 });
    assert.equal(edita.changes[0].action, 'edit');
    assert.deepEqual([quita.changes[0].action, quita.changes[0].after], ['remove', null]);
    assert.deepEqual(quita.changes[0].before, { type: 'money', detail: 'Plantines y herramientas', amount: 500000 });

    for (const x of [agrega, edita, quita]) {
      assert.equal(x.side, 'company');
      assert.equal(x.author_name, 'Admin TechCorp');
      assert.ok(x.created_at, `v${x.version} con fecha`);
    }
    // La versión 1 es la propuesta: sin cambios de puntos, aceptada por la empresa; su fecha es la de la aceptación.
    assert.deepEqual(propuesta.changes, []);
    assert.deepEqual(propuesta.accepted_by.map((x) => x.side), ['company']);
    assert.deepEqual([propuesta.side, propuesta.author_name], [null, null]);
    assert.equal(propuesta.created_at, propuesta.accepted_by[0].accepted_at);
  });

  test('el detalle se guarda sin espacios de más, en el punto y en el historial', async () => {
    const url = await acuerdoNuevo();
    const r = await agregar(url, ngo1, { type: 'supplies', detail: '  Guantes  ' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.agreement.points[0].detail, 'Guantes');
    const pid = r.body.agreement.points[0].id;
    await call(`${url}/puntos/${pid}`, { token: ngo1, method: 'PATCH', body: { detail: ' Guantes y bolsas ' } });
    const [edita, agrega] = await historial(url);
    assert.equal(agrega.changes[0].after.detail, 'Guantes');
    assert.deepEqual([edita.changes[0].before.detail, edita.changes[0].after.detail], ['Guantes', 'Guantes y bolsas']);
  });

  test('las aceptaciones: quién aceptó qué versión y cuándo (proponer, aceptar y el PATCH de la ONG)', async () => {
    const url = await acuerdoNuevo();
    let a = await ver(url);
    assert.deepEqual(a.accepted_versions, { company: 1, ngo: null });
    assert.ok(a.accepted_at.company, 'proponer es aceptar: con fecha');
    assert.equal(a.accepted_at.ngo, null);

    await agregar(url, ngo1, { type: 'supplies', detail: 'Guantes' });   // v2: la aceptación de la empresa queda vieja
    a = await ver(url);
    assert.deepEqual(a.accepted_versions, { company: 1, ngo: null });
    assert.equal(a.accepted_at.company, null, 'la fecha es la de la versión vigente');

    const ok = await call(`${url}/aceptar`, { token: ngo1, method: 'POST', body: { version: 2 } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    a = ok.body.agreement;
    assert.deepEqual(a.accepted_versions, { company: 1, ngo: 2 });
    assert.ok(a.accepted_at.ngo);

    const r = await ongDecide('aceptado');            // el PATCH de siempre: la ONG ya había aceptado, sigue igual
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const e = await call(`${url}/aceptar`, { token: company, method: 'POST', body: { version: 2 } });
    assert.equal(e.status, 200, JSON.stringify(e.body));
    assert.equal(e.body.agreement.status, 'aceptado');

    const v = await historial(url, ngo1);
    const v2 = v.find((x) => x.version === 2);
    assert.deepEqual(v2.accepted_by.map((x) => x.side).sort(), ['company', 'ngo']);
    for (const x of v2.accepted_by) {
      assert.ok(x.accepted_at);
      assert.equal(x.author_name, x.side === 'company' ? 'Admin TechCorp' : 'Admin Sustentando');
    }
    assert.deepEqual(v.find((x) => x.version === 1).accepted_by.map((x) => x.side), ['company']);
  });

  test('el PATCH de siempre de la ONG también deja su aceptación', async () => {
    const url = await acuerdoNuevo();
    const r = await ongDecide('aceptado');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const v1 = (await historial(url)).find((x) => x.version === 1);
    assert.deepEqual(v1.accepted_by.map((x) => x.side).sort(), ['company', 'ngo']);
    assert.deepEqual((await ver(url)).accepted_versions, { company: 1, ngo: 1 });
  });

  test('volver a proponer después de un rechazo: la aceptación de la empresa es de la versión nueva', async () => {
    const url = await acuerdoNuevo();
    assert.equal((await call(`${url}/rechazar`, { token: ngo1, method: 'POST' })).status, 200);
    const again = await call('/api/empresas/me/patrocinios', { token: company, method: 'POST', body: { project_id: projectId } });
    assert.equal(again.status, 201, JSON.stringify(again.body));
    const a = await ver(url);
    assert.equal(a.version, 2);
    assert.deepEqual(a.accepted_versions, { company: 2, ngo: null });
    assert.ok(a.accepted_at.company);
    assert.deepEqual((await historial(url)).find((x) => x.version === 2).accepted_by.map((x) => x.side), ['company']);
  });

  test('una aceptación vieja (409) no queda registrada', async () => {
    const url = await acuerdoNuevo();
    await agregar(url, company, { type: 'supplies', detail: 'Bolsas' });   // v2
    const r = await call(`${url}/aceptar`, { token: ngo1, method: 'POST', body: { version: 1 } });
    assert.equal(r.status, 409);
    const v1 = (await historial(url)).find((x) => x.version === 1);
    assert.deepEqual(v1.accepted_by.map((x) => x.side), ['company']);
  });
});

describe('Acuerdo de patrocinio: el historial, solo para las partes', () => {
  test('las dos partes lo ven (también cerrado); nadie más (404) y sin sesión 401', async () => {
    const url = await acuerdoNuevo();
    await agregar(url, company, { type: 'money', detail: 'Secreto', amount: 999 });
    assert.equal((await call(`${url}/rechazar`, { token: company, method: 'POST' })).status, 200);
    assert.equal((await historial(url, ngo1)).length, 2);
    for (const token of [ngo2, maria]) {
      const r = await call(`${url}/historial`, { token });
      assert.equal(r.status, 404);
      assert.ok(!JSON.stringify(r.body).includes('999'), 'no filtra montos');
    }
    assert.equal((await call(`${url}/historial`)).status, 401);
  });

  test('dos cambios a la vez: versiones distintas, un registro cada una', async () => {
    const url = await acuerdoNuevo();
    const [a, b] = await Promise.all([
      agregar(url, company, { type: 'supplies', detail: 'Uno' }),
      agregar(url, ngo1, { type: 'supplies', detail: 'Dos' }),
    ]);
    assert.deepEqual([a.status, b.status], [201, 201]);
    const v = await historial(url);
    assert.deepEqual(v.map((x) => x.version), [3, 2, 1]);
    assert.deepEqual(v.slice(0, 2).map((x) => x.changes.length), [1, 1]);
    assert.deepEqual(v.slice(0, 2).map((x) => x.changes[0].after.detail).sort(), ['Dos', 'Uno']);
  });
});
