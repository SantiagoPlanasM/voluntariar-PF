// test/integration/patrocinio-lote.test.js — acuerdo de patrocinio, paso 4: guardar varios cambios como UNA versión (§327).
//
// Decisión del usuario (11/11): la versión nueva se crea al guardar, no por cada punto. POST …/cambios recibe el
// borrador de una parte: `{ version, changes: [{ action: 'add'|'edit'|'remove', … }] }`. Criterio:
// - todo en una transacción: o se aplican todos los cambios y la versión sube UNA vez, o no se aplica ninguno;
// - `version` es la versión sobre la que se armó el borrador: si el acuerdo cambió mientras tanto, 409 "El acuerdo
//   cambió: revisalo de nuevo" y no se aplica nada (no se pisa lo de la otra parte); cerrado, 409 de cerrado;
// - cada cambio se valida como en los endpoints de a un punto; solo puntos del lado propio (si no, 404 y nada);
//   un punto no puede aparecer dos veces; el tope de 20 puntos por lado cuenta lo que queda después del lote;
// - una edición que no cambia nada no cuenta; un lote sin cambios reales es 400 y no sube la versión;
// - el historial registra todos los cambios del lote con la misma versión, quién y cuándo;
// - las aceptaciones anteriores dejan de valer (la versión vigente es otra);
// - dos lotes sobre la misma versión a la vez: entra uno y el otro es 409 (importa en test:pg).
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
  const title = `Lote ${++seq}`;
  const p = await call('/api/projects', {
    token: ngo1, method: 'POST',
    body: { title, description: 'Proyecto de prueba para el lote', location: 'Córdoba', type: 'fugaz',
      duration: '1 día', volunteers_needed: 5, category: 'Medio Ambiente' },
  });
  assert.equal(p.status, 201, JSON.stringify(p.body));
  projectId = (await call('/api/projects?limit=500')).body.projects.find((x) => x.title === title).id;
  const r = await call('/api/empresas/me/patrocinios', { token: company, method: 'POST', body: { project_id: projectId } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return `/api/patrocinios/${empresaId}/${projectId}`;
}
const ver = async (url, token = company) => (await call(url, { token })).body.agreement;
const lote = (url, token, version, changes) => call(`${url}/cambios`, { token, method: 'POST', body: { version, changes } });
const add = (detail, extra = {}) => ({ action: 'add', type: 'supplies', detail, ...extra });

before(async () => {
  server = await setupTestServer({ seed: true });
  baseUrl = server.baseUrl;
  db = require('../../src/db');
  [company, ngo1, ngo2] = await Promise.all(['admin@techcorp.com', 'admin@sustentando.org', 'admin@greencba.org'].map(login));
  empresaId = (await db.get(`SELECT e.id FROM empresas e JOIN users u ON u.id = e.user_id WHERE u.email = 'admin@techcorp.com'`)).id;
});
after(async () => { if (server) await server.close(); });

describe('Acuerdo de patrocinio: guardar un lote de cambios', () => {
  test('agregar, editar y quitar en un lote: una sola versión, con todo en el historial', async () => {
    const url = await acuerdoNuevo();
    const r1 = await lote(url, company, 1, [
      add('Bolsas'), { action: 'add', type: 'money', detail: 'Plantines', amount: 450000 }, add('Guantes'),
    ]);
    assert.equal(r1.status, 200, JSON.stringify(r1.body));
    assert.equal(r1.body.agreement.version, 2, 'tres puntos: una versión');
    assert.deepEqual(r1.body.agreement.points.map((p) => p.detail).sort(), ['Bolsas', 'Guantes', 'Plantines']);
    const id = (d) => r1.body.agreement.points.find((p) => p.detail === d).id;

    const r2 = await lote(url, company, 2, [
      { action: 'edit', point_id: id('Plantines'), detail: 'Plantines y herramientas', amount: 500000 },
      { action: 'remove', point_id: id('Guantes') },
    ]);
    assert.equal(r2.status, 200, JSON.stringify(r2.body));
    const a = r2.body.agreement;
    assert.equal(a.version, 3);
    assert.deepEqual(a.points.map((p) => [p.detail, p.amount]).sort(), [['Bolsas', null], ['Plantines y herramientas', 500000]]);
    assert.equal(a.points.find((p) => p.amount).edited_by_name, 'Admin TechCorp');

    const h = (await call(`${url}/historial`, { token: ngo1 })).body.versions;
    assert.deepEqual(h.map((v) => [v.version, v.changes.map((c) => c.action)]),
      [[3, ['edit', 'remove']], [2, ['add', 'add', 'add']], [1, []]]);
    assert.equal(h[0].author_name, 'Admin TechCorp');
  });

  test('cada parte guarda solo lo suyo; la otra parte no puede tocar esos puntos (404, nada cambia)', async () => {
    const url = await acuerdoNuevo();
    const r = await lote(url, company, 1, [add('De la empresa')]);
    const pid = r.body.agreement.points[0].id;
    const ong = await lote(url, ngo1, 2, [add('De la ONG'), { action: 'remove', point_id: pid }]);
    assert.equal(ong.status, 404, JSON.stringify(ong.body));
    assert.equal(ong.body.error, 'Punto no encontrado');
    const a = await ver(url);
    assert.equal(a.version, 2, 'no subió');
    assert.deepEqual(a.points.map((p) => p.detail), ['De la empresa'], 'tampoco entró lo de la ONG');
    assert.equal((await lote(url, ngo1, 2, [add('De la ONG')])).body.agreement.points.find((p) => p.side === 'ngo').detail, 'De la ONG');
    assert.equal((await lote(url, ngo2, 3, [add('Ajena')])).status, 404, 'una ONG ajena ni lo ve');
  });

  test('versión vieja: 409 y no se aplica nada (no pisa lo de la otra parte)', async () => {
    const url = await acuerdoNuevo();
    await lote(url, ngo1, 1, [add('La ONG pide guantes')]);            // ahora v2
    const r = await lote(url, company, 1, [add('Armado sobre la v1')]);
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'El acuerdo cambió: revisalo de nuevo');
    const a = await ver(url);
    assert.equal(a.version, 2);
    assert.equal(a.points.length, 1);
  });

  test('cerrado: 409 de cerrado', async () => {
    const url = await acuerdoNuevo();
    assert.equal((await call(`${url}/rechazar`, { token: ngo1, method: 'POST' })).status, 200);
    const r = await lote(url, company, 1, [add('Tarde')]);
    assert.deepEqual([r.status, r.body.error], [409, 'El acuerdo ya está cerrado: no se puede cambiar']);
  });

  test('validación: lo mismo que de a un punto, y el lote entero se rechaza', async () => {
    const url = await acuerdoNuevo();
    const casos = [
      [{ version: 1, changes: [] }, 'No hay cambios para guardar'],
      [{ version: 1 }, 'No hay cambios para guardar'],
      [{ changes: [add('x')] }, 'version inválida'],
      [{ version: 1, changes: [{ action: 'mover', point_id: 'x' }] }, 'Cambio inválido'],
      [{ version: 1, changes: [add('Bien'), { action: 'add', type: 'money', detail: 'Sin monto' }] }, 'Un punto de dinero necesita un monto mayor a 0'],
      [{ version: 1, changes: [add('Bien'), { action: 'add', type: 'nada', detail: 'x' }] }, 'Tipo de punto inválido'],
      [{ version: 1, changes: [add('   ')] }, 'El detalle no puede estar vacío'],
      [{ version: 1, changes: [{ action: 'edit' }] }, 'Cambio inválido'],
    ];
    for (const [body, error] of casos) {
      const r = await call(`${url}/cambios`, { token: company, method: 'POST', body });
      assert.deepEqual([r.status, r.body.error], [400, error], JSON.stringify(body));
    }
    const a = await ver(url);
    assert.deepEqual([a.version, a.points.length], [1, 0], 'nada entró');
  });

  test('hasta 60 cambios por vez', async () => {
    const url = await acuerdoNuevo();
    const r = await lote(url, company, 1, Array.from({ length: 61 }, (_, i) => add(`P${i}`)));
    assert.deepEqual([r.status, r.body.error], [400, 'Hasta 60 cambios por vez']);
  });

  test('una edición inválida rechaza el lote entero (con lo que venía antes en el lote)', async () => {
    const url = await acuerdoNuevo();
    const pid = (await lote(url, company, 1, [{ action: 'add', type: 'money', detail: 'Plantines', amount: 1000 }])).body.agreement.points[0].id;
    const r = await lote(url, company, 2, [add('Guantes'), { action: 'edit', point_id: pid, amount: -5 }]);
    assert.deepEqual([r.status, r.body.error], [400, 'Un punto de dinero necesita un monto mayor a 0']);
    const a = await ver(url);
    assert.deepEqual([a.version, a.points.length, a.points[0].amount], [2, 1, 1000]);
  });

  test('cambiar solo el monto es un cambio', async () => {
    const url = await acuerdoNuevo();
    const pid = (await lote(url, company, 1, [{ action: 'add', type: 'money', detail: 'Plantines', amount: 1000 }])).body.agreement.points[0].id;
    const r = await lote(url, company, 2, [{ action: 'edit', point_id: pid, amount: 2000 }]);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual([r.body.agreement.version, r.body.agreement.points[0].amount], [3, 2000]);
  });

  test('un punto dos veces en el lote: 400', async () => {
    const url = await acuerdoNuevo();
    const pid = (await lote(url, company, 1, [add('Bolsas')])).body.agreement.points[0].id;
    const r = await lote(url, company, 2, [{ action: 'edit', point_id: pid, detail: 'Otra' }, { action: 'remove', point_id: pid }]);
    assert.deepEqual([r.status, r.body.error], [400, 'Un punto aparece dos veces en los cambios']);
  });

  test('una edición que no cambia nada no cuenta; si es lo único, 400 y no sube la versión', async () => {
    const url = await acuerdoNuevo();
    const pid = (await lote(url, company, 1, [add('Bolsas')])).body.agreement.points[0].id;
    const igual = await lote(url, company, 2, [{ action: 'edit', point_id: pid, detail: ' Bolsas ' }]);
    assert.deepEqual([igual.status, igual.body.error], [400, 'No hay cambios para guardar']);
    assert.equal((await ver(url)).version, 2);
    const r = await lote(url, company, 2, [{ action: 'edit', point_id: pid, detail: 'Bolsas' }, add('Guantes')]);
    assert.equal(r.status, 200);
    const v3 = (await call(`${url}/historial`, { token: company })).body.versions[0];
    assert.deepEqual(v3.changes.map((c) => c.action), ['add'], 'la edición igual no queda en el historial');
  });

  test('el tope de 20 puntos por lado cuenta lo que queda después del lote', async () => {
    const url = await acuerdoNuevo();
    const veinte = Array.from({ length: 20 }, (_, i) => add(`Punto ${i + 1}`));
    const r = await lote(url, company, 1, veinte);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const mas = await lote(url, company, 2, [add('El 21')]);
    assert.deepEqual([mas.status, mas.body.error], [409, 'Hasta 20 puntos por lado']);
    const uno = r.body.agreement.points[0].id;
    const cambio = await lote(url, company, 2, [{ action: 'remove', point_id: uno }, add('El nuevo 20')]);
    assert.equal(cambio.status, 200, 'quitar uno y agregar otro en el mismo lote entra');
    assert.equal(cambio.body.agreement.points.length, 20);
  });

  test('guardar anula las aceptaciones: hay que volver a aceptar la versión nueva', async () => {
    const url = await acuerdoNuevo();
    assert.deepEqual((await ver(url)).accepted, { company: true, ngo: false });
    const r = await lote(url, ngo1, 1, [add('Guantes')]);
    assert.deepEqual(r.body.agreement.accepted, { company: false, ngo: false });
  });

  test('dos lotes sobre la misma versión a la vez: entra uno, el otro es 409', async () => {
    const url = await acuerdoNuevo();
    const [a, b] = await Promise.all([lote(url, company, 1, [add('Uno')]), lote(url, ngo1, 1, [add('Dos')])]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const ag = await ver(url);
    assert.deepEqual([ag.version, ag.points.length], [2, 1]);
  });

  test('sin sesión 401', async () => {
    const url = await acuerdoNuevo();
    assert.equal((await lote(url, undefined, 1, [add('x')])).status, 401);
  });
});
