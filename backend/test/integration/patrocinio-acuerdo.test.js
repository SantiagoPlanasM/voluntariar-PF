// test/integration/patrocinio-acuerdo.test.js — el patrocinio como acuerdo negociado, etapa 1 (docs/PLAN_PATROCINIO.md, §263).
//
// Un acuerdo es una fila de empresa_voluntariados con puntos: lo que aporta la empresa (lado `company`) y lo que pide u
// ofrece la ONG (lado `ngo`). Criterio de esta etapa:
// - GET /api/patrocinios/:empresaId/:projectId lo ven solo las dos partes (cualquier otro: 404, sin revelar nada):
//   estado, versión, de qué lado está quien pregunta y los puntos de los dos lados, con el monto de los de dinero;
// - cada parte agrega, edita y borra SOLO puntos de su lado (los del otro: 404), mientras el acuerdo está `propuesto`
//   (cerrado: 409); cada cambio sube la versión (en la misma transacción) y responde el acuerdo completo;
// - validación: tipo de la lista, detalle obligatorio hasta 300, monto solo y obligatorio en `money` (> 0), hasta 20
//   puntos por lado;
// - dos cambios a la vez suben la versión dos veces (no se pisa).
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

/** Proyecto nuevo de la ONG 1 con una propuesta de patrocinio de TechCorp; devuelve la ruta del acuerdo. */
async function acuerdoNuevo() {
  const title = `Patrocinio ${++seq}`;
  const p = await call('/api/projects', {
    token: ngo1, method: 'POST',
    body: { title, description: 'Proyecto de prueba para el acuerdo', location: 'Córdoba', type: 'fugaz',
      duration: '1 día', volunteers_needed: 5, category: 'Medio Ambiente' },
  });
  assert.equal(p.status, 201, JSON.stringify(p.body));
  projectId = (await call('/api/projects?limit=500')).body.projects.find((x) => x.title === title).id;
  const r = await call('/api/empresas/me/patrocinios', { token: company, method: 'POST', body: { project_id: projectId, mensaje: 'Queremos ayudar' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return `/api/patrocinios/${empresaId}/${projectId}`;
}

before(async () => {
  server = await setupTestServer({ seed: true });
  baseUrl = server.baseUrl;
  db = require('../../src/db');
  [company, ngo1, ngo2, maria] = await Promise.all(
    ['admin@techcorp.com', 'admin@sustentando.org', 'admin@greencba.org', 'maria@example.com'].map(login));
  empresaId = (await db.get(`SELECT e.id FROM empresas e JOIN users u ON u.id = e.user_id WHERE u.email = 'admin@techcorp.com'`)).id;
});
after(async () => { if (server) await server.close(); });

describe('Acuerdo de patrocinio: ver', () => {
  test('las dos partes lo ven, cada una con su lado; nadie más (404)', async () => {
    const url = await acuerdoNuevo();
    const e = await call(url, { token: company });
    assert.equal(e.status, 200, JSON.stringify(e.body));
    const a = e.body.agreement;
    assert.deepEqual(
      [a.company_id, a.project_id, a.status, a.version, a.my_side, a.message, a.points],
      [empresaId, projectId, 'propuesto', 1, 'company', 'Queremos ayudar', []]);
    assert.ok(a.company_name && a.ngo_name && a.project_title);
    assert.equal((await call(url, { token: ngo1 })).body.agreement.my_side, 'ngo');
    for (const token of [ngo2, maria]) assert.equal((await call(url, { token })).status, 404);
    assert.equal((await call(url)).status, 401);
    assert.equal((await call(`/api/patrocinios/${empresaId}/no-existe`, { token: company })).status, 404);
  });
});

describe('Acuerdo de patrocinio: puntos', () => {
  test('cada parte agrega puntos de su lado; sube la versión y responde el acuerdo', async () => {
    const url = await acuerdoNuevo();
    const r1 = await call(`${url}/puntos`, { token: company, method: 'POST', body: { type: 'money', detail: 'Aporte para materiales', amount: 200000 } });
    assert.equal(r1.status, 201, JSON.stringify(r1.body));
    assert.equal(r1.body.agreement.version, 2);
    const r2 = await call(`${url}/puntos`, { token: ngo1, method: 'POST', body: { type: 'outreach', detail: 'Logo en las remeras' } });
    assert.equal(r2.status, 201, JSON.stringify(r2.body));
    const pts = r2.body.agreement.points.map(({ side, type, detail, amount }) => ({ side, type, detail, amount }));
    assert.deepEqual(pts, [
      { side: 'company', type: 'money', detail: 'Aporte para materiales', amount: 200000 },
      { side: 'ngo', type: 'outreach', detail: 'Logo en las remeras', amount: null },
    ]);
    assert.equal(r2.body.agreement.version, 3);
  });

  test('validación (400, sin cambiar la versión)', async () => {
    const url = await acuerdoNuevo();
    const casos = [
      [{ type: 'regalo', detail: 'x' }, 'Tipo de punto inválido'],
      [{ type: 'supplies' }, 'El detalle es obligatorio'],
      [{ type: 'supplies', detail: '   ' }, 'El detalle no puede estar vacío'],
      [{ type: 'supplies', detail: 'x'.repeat(301) }, 'El detalle puede tener hasta 300 caracteres'],
      [{ type: 'money', detail: 'Plata' }, 'Un punto de dinero necesita un monto mayor a 0'],
      [{ type: 'money', detail: 'Plata', amount: 0 }, 'Un punto de dinero necesita un monto mayor a 0'],
      [{ type: 'money', detail: 'Plata', amount: '500' }, 'Un punto de dinero necesita un monto mayor a 0'],
      [{ type: 'money', detail: 'Plata', amount: 1e10 }, 'El monto puede ser hasta 1.000.000.000'],
      [{ type: 'supplies', detail: 'Guantes', amount: 10 }, 'Solo un punto de dinero lleva monto'],
    ];
    for (const [body, error] of casos) {
      const r = await call(`${url}/puntos`, { token: company, method: 'POST', body });
      assert.deepEqual([r.status, r.body.error], [400, error], JSON.stringify(body).slice(0, 60));
    }
    assert.equal((await call(url, { token: company })).body.agreement.version, 1);
  });

  test('editar y borrar: solo los puntos propios (los del otro lado, 404)', async () => {
    const url = await acuerdoNuevo();
    const pid = (await call(`${url}/puntos`, { token: company, method: 'POST', body: { type: 'volunteers', detail: '10 empleados' } }))
      .body.agreement.points[0].id;
    assert.equal((await call(`${url}/puntos/${pid}`, { token: ngo1, method: 'PATCH', body: { detail: '50 empleados' } })).status, 404);
    assert.equal((await call(`${url}/puntos/${pid}`, { token: ngo1, method: 'DELETE' })).status, 404);

    const ed = await call(`${url}/puntos/${pid}`, { token: company, method: 'PATCH', body: { detail: '15 empleados, una jornada' } });
    assert.equal(ed.status, 200, JSON.stringify(ed.body));
    assert.deepEqual([ed.body.agreement.points[0].detail, ed.body.agreement.points[0].type, ed.body.agreement.version], ['15 empleados, una jornada', 'volunteers', 3]);
    const toMoney = await call(`${url}/puntos/${pid}`, { token: company, method: 'PATCH', body: { type: 'money' } });
    assert.deepEqual([toMoney.status, toMoney.body.error], [400, 'Un punto de dinero necesita un monto mayor a 0']);

    const money = await call(`${url}/puntos/${pid}`, { token: company, method: 'PATCH', body: { type: 'money', amount: 50000 } });
    assert.deepEqual([money.status, money.body.agreement?.points[0].amount], [200, 50000]);
    const back = await call(`${url}/puntos/${pid}`, { token: company, method: 'PATCH', body: { type: 'supplies' } });
    assert.deepEqual([back.status, back.body.agreement?.points[0].amount], [200, null], 'pasar a otro tipo borra el monto');
    assert.equal(back.body.agreement.version, 5);

    const del = await call(`${url}/puntos/${pid}`, { token: company, method: 'DELETE' });
    assert.deepEqual([del.status, del.body.agreement.points, del.body.agreement.version], [200, [], 6]);
    assert.equal((await call(`${url}/puntos/${pid}`, { token: company, method: 'DELETE' })).status, 404);
  });

  test('con el acuerdo cerrado (aceptado o rechazado) no se tocan los puntos (409)', async () => {
    for (const estado of ['aceptado', 'rechazado']) {
      const url = await acuerdoNuevo();
      const pid = (await call(`${url}/puntos`, { token: company, method: 'POST', body: { type: 'supplies', detail: 'Guantes' } }))
        .body.agreement.points[0].id;
      assert.equal((await call(`/api/ngos/me/patrocinios/${empresaId}/${projectId}`, { token: ngo1, method: 'PATCH', body: { estado } })).status, 200);
      const msg = 'El acuerdo ya está cerrado: no se puede cambiar';
      const add = await call(`${url}/puntos`, { token: company, method: 'POST', body: { type: 'supplies', detail: 'Bolsas' } });
      assert.deepEqual([add.status, add.body.error], [409, msg]);
      assert.equal((await call(`${url}/puntos/${pid}`, { token: company, method: 'PATCH', body: { detail: 'Otra cosa' } })).status, 409);
      assert.equal((await call(`${url}/puntos/${pid}`, { token: company, method: 'DELETE' })).status, 409);
    }
  });

  test('hasta 20 puntos por lado', async () => {
    const url = await acuerdoNuevo();
    for (let i = 0; i < 20; i++) {
      const r = await call(`${url}/puntos`, { token: company, method: 'POST', body: { type: 'other', detail: `Punto ${i}` } });
      assert.equal(r.status, 201);
    }
    const r = await call(`${url}/puntos`, { token: company, method: 'POST', body: { type: 'other', detail: 'Uno más' } });
    assert.deepEqual([r.status, r.body.error], [409, 'Hasta 20 puntos por lado']);
    assert.equal((await call(`${url}/puntos`, { token: ngo1, method: 'POST', body: { type: 'other', detail: 'El de la ONG' } })).status, 201);
  });

  test('dos cambios a la vez: los dos entran y la versión sube dos veces', async () => {
    const url = await acuerdoNuevo();
    const rs = await Promise.all([
      call(`${url}/puntos`, { token: company, method: 'POST', body: { type: 'supplies', detail: 'A' } }),
      call(`${url}/puntos`, { token: ngo1, method: 'POST', body: { type: 'supplies', detail: 'B' } }),
    ]);
    assert.deepEqual(rs.map((r) => r.status), [201, 201]);
    const a = (await call(url, { token: company })).body.agreement;
    assert.deepEqual([a.version, a.points.length], [3, 2]);
  });
});
