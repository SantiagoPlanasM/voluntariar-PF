// test/integration/patrocinio-proponer-puntos.test.js — acuerdo de patrocinio, paso 5: proponer con puntos (§329).
//
// Decisión del usuario (11/11): la empresa propone con puntos. POST /api/empresas/me/patrocinios acepta, además de
// `{ project_id, mensaje }`, `points: [{ type, detail, amount? }]`. Criterio:
// - los puntos son del lado de la empresa y se guardan en la MISMA transacción que la propuesta: o queda la propuesta
//   con todos sus puntos, o no queda nada;
// - van como versión 1 (no suben la versión), cada uno con su registro en `patrocinio_cambios` (en el orden en que se
//   mandaron) y con la aceptación de la empresa a esa misma versión: proponer sigue siendo aceptar;
// - se validan como en POST …/cambios (mismos mensajes); sin `points` o con `[]`, todo sigue como antes;
// - re-proponer tras un rechazo: UNA versión nueva, con esos puntos registrados en ella; los puntos de antes quedan
//   y el tope de 20 por lado cuenta el total (si se pasa, 409 y el acuerdo sigue rechazado, en su versión);
// - propuestas simultáneas: entra una sola, con sus puntos una sola vez (importa en test:pg).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

let server, baseUrl, db, company, ngo1, ngo2, empresaId;
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
async function proyectoNuevo() {
  const title = `Proponer con puntos ${++seq}`;
  const p = await call('/api/projects', {
    token: ngo1, method: 'POST',
    body: { title, description: 'Proyecto de prueba para proponer con puntos', location: 'Córdoba', type: 'fugaz',
      duration: '1 día', volunteers_needed: 5, category: 'Medio Ambiente' },
  });
  assert.equal(p.status, 201, JSON.stringify(p.body));
  return (await call('/api/projects?limit=500')).body.projects.find((x) => x.title === title).id;
}
const proponer = (projectId, extra = {}) =>
  call('/api/empresas/me/patrocinios', { token: company, method: 'POST', body: { project_id: projectId, ...extra } });
const urlDe = (projectId) => `/api/patrocinios/${empresaId}/${projectId}`;
const ver = async (projectId, token = company) => (await call(urlDe(projectId), { token })).body.agreement;
const historial = async (projectId, token = company) => (await call(`${urlDe(projectId)}/historial`, { token })).body.versions;
const fila = (projectId) => db.get(
  'SELECT estado, version, acepta_empresa_version FROM empresa_voluntariados WHERE empresa_id=$1 AND project_id=$2', [empresaId, projectId]);
const cuenta = async (tabla, projectId) => Number((await db.get(
  `SELECT COUNT(*) AS n FROM ${tabla} WHERE empresa_id=$1 AND project_id=$2`, [empresaId, projectId])).n) || 0;
const insumo = (detail) => ({ type: 'supplies', detail });
const PLATA = { type: 'money', detail: 'Plantines', amount: 450000 };

before(async () => {
  server = await setupTestServer({ seed: true });
  baseUrl = server.baseUrl;
  db = require('../../src/db');
  [company, ngo1, ngo2] = await Promise.all(['admin@techcorp.com', 'admin@sustentando.org', 'admin@greencba.org'].map(login));
  empresaId = (await db.get(`SELECT e.id FROM empresas e JOIN users u ON u.id = e.user_id WHERE u.email = 'admin@techcorp.com'`)).id;
});
after(async () => { if (server) await server.close(); });

describe('Proponer un patrocinio con puntos', () => {
  test('los puntos quedan en la versión 1, del lado de la empresa, con su historial y su aceptación', async () => {
    const id = await proyectoNuevo();
    const r = await proponer(id, { mensaje: 'Queremos sumar', points: [PLATA, insumo('  Bolsas  '), { type: 'outreach', detail: 'Redes', amount: null }] });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.message, 'Propuesta de patrocinio enviada');

    const a = await ver(id);
    assert.equal(a.version, 1, 'los puntos de la propuesta no suben la versión');
    assert.equal(a.status, "propuesto");
    assert.equal(a.message, 'Queremos sumar');
    assert.deepEqual(a.accepted, { company: true, ngo: false }, 'proponer es aceptar la versión con sus puntos');
    assert.deepEqual(a.accepted_versions, { company: 1, ngo: null });
    assert.deepEqual(a.points.map((p) => [p.side, p.type, p.detail, p.amount]).sort(), [
      ['company', 'money', 'Plantines', 450000],
      ['company', 'outreach', 'Redes', null],
      ['company', 'supplies', 'Bolsas', null],
    ]);
    for (const p of a.points) {
      assert.equal(p.created_by_name, 'Admin TechCorp');
      assert.equal(p.edited_by_name, null);
    }

    // La ONG ve lo mismo (con el monto: es parte).
    const deLaOng = await ver(id, ngo1);
    assert.equal(deLaOng.my_side, 'ngo');
    assert.equal(deLaOng.points.find((p) => p.type === 'money').amount, 450000);

    const h = await historial(id, ngo1);
    assert.equal(h.length, 1);
    assert.equal(h[0].version, 1);
    assert.equal(h[0].side, 'company');
    assert.equal(h[0].author_name, 'Admin TechCorp');
    assert.ok(h[0].created_at);
    assert.deepEqual(h[0].changes.map((c) => [c.action, c.side, c.before, c.after.detail]), [
      ['add', 'company', null, 'Plantines'], ['add', 'company', null, 'Bolsas'], ['add', 'company', null, 'Redes'],
    ], 'en el orden en que se mandaron');
    assert.deepEqual(h[0].changes[0].after, { type: 'money', detail: 'Plantines', amount: 450000 });
    assert.deepEqual(h[0].changes.map((c) => c.point_id).sort(), a.points.map((p) => p.id).sort());
    assert.deepEqual(h[0].accepted_by.map((x) => [x.side, x.author_name]), [['company', 'Admin TechCorp']]);
  });

  test('el orden del historial se mantiene con 15 puntos', async () => {
    const id = await proyectoNuevo();
    const nombres = Array.from({ length: 15 }, (_, i) => `Punto ${String(i + 1).padStart(2, '0')}`);
    assert.equal((await proponer(id, { points: nombres.map(insumo) })).status, 201);
    assert.deepEqual((await historial(id))[0].changes.map((c) => c.after.detail), nombres);
  });

  test('la ONG puede aceptar la versión 1 con sus puntos y el acuerdo se cierra', async () => {
    const id = await proyectoNuevo();
    assert.equal((await proponer(id, { points: [PLATA] })).status, 201);
    const r = await call(`${urlDe(id)}/aceptar`, { token: ngo1, method: 'POST', body: { version: 1 } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.agreement.status, 'aceptado');
    assert.equal(r.body.agreement.points.length, 1);
  });

  test('sin points, con [] o con null: como antes (versión 1 sin cambios)', async () => {
    for (const extra of [{}, { points: [] }, { points: null }]) {
      const id = await proyectoNuevo();
      assert.equal((await proponer(id, extra)).status, 201, JSON.stringify(extra));
      const a = await ver(id);
      assert.equal(a.version, 1);
      assert.deepEqual(a.points, []);
      const h = await historial(id);
      assert.deepEqual(h.map((v) => [v.version, v.changes.length, v.side]), [[1, 0, null]]);
    }
  });

  test('exactamente 20 puntos entran; 21, 409 y no se crea nada', async () => {
    const id = await proyectoNuevo();
    const puntos = (n) => Array.from({ length: n }, (_, i) => insumo(`Punto ${i + 1}`));
    const r21 = await proponer(id, { points: puntos(21) });
    assert.equal(r21.status, 409, JSON.stringify(r21.body));
    assert.equal(r21.body.error, 'Hasta 20 puntos por lado');
    assert.equal(await fila(id), undefined);
    assert.equal((await proponer(id, { points: puntos(20) })).status, 201);
    assert.equal((await ver(id)).points.length, 20);
  });

  describe('validación: 400 con el mensaje de siempre y no se crea nada', () => {
    const casos = [
      ['points que no es una lista (objeto)', { a: 1 }, 'points inválido'],
      ['points que no es una lista (texto)', 'Bolsas', 'points inválido'],
      ['un punto que no es un objeto', [insumo('Bolsas'), 'Guantes'], 'Punto inválido'],
      ['un punto null', [null], 'Punto inválido'],
      ['un punto que es una lista', [[]], 'Punto inválido'],
      ['tipo inválido', [{ type: 'regalo', detail: 'x' }], 'Tipo de punto inválido'],
      ['sin detalle', [{ type: 'supplies' }], 'El detalle es obligatorio'],
      ['detalle vacío', [{ type: 'supplies', detail: '   ' }], 'El detalle no puede estar vacío'],
      ['detalle de 301', [{ type: 'supplies', detail: 'a'.repeat(301) }], 'El detalle puede tener hasta 300 caracteres'],
      ['dinero sin monto', [{ type: 'money', detail: 'Plata' }], 'Un punto de dinero necesita un monto mayor a 0'],
      ['dinero con monto 0', [{ type: 'money', detail: 'Plata', amount: 0 }], 'Un punto de dinero necesita un monto mayor a 0'],
      ['monto de más', [{ type: 'money', detail: 'Plata', amount: 1e9 + 1 }], 'El monto puede ser hasta 1.000.000.000'],
      ['monto en un punto que no es de dinero', [{ type: 'supplies', detail: 'Bolsas', amount: 10 }], 'Solo un punto de dinero lleva monto'],
      ['el segundo punto inválido', [insumo('Bolsas'), { type: 'money', detail: 'Plata' }], 'Un punto de dinero necesita un monto mayor a 0'],
    ];
    for (const [label, points, error] of casos) {
      test(label, async () => {
        const id = await proyectoNuevo();
        const r = await proponer(id, { points });
        assert.equal(r.status, 400, JSON.stringify(r.body));
        assert.equal(r.body.error, error);
        assert.equal(await fila(id), undefined, 'no hay propuesta');
        assert.equal(await cuenta('patrocinio_puntos', id), 0);
        assert.equal(await cuenta('patrocinio_cambios', id), 0);
        assert.equal(await cuenta('patrocinio_aceptaciones', id), 0);
      });
    }

    test('un detalle de exactamente 300 y un monto de exactamente 1.000.000.000 entran', async () => {
      const id = await proyectoNuevo();
      const r = await proponer(id, { points: [{ type: 'money', detail: 'a'.repeat(300), amount: 1e9 }] });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    });

    test('los puntos se validan antes de mirar el proyecto: con un proyecto que no existe, igual 400', async () => {
      const r = await proponer('no-existe', { points: 'x' });
      assert.equal(r.status, 400);
    });
  });
});

describe('Re-proponer con puntos después de un rechazo', () => {
  test('una versión nueva con esos puntos; los de antes quedan y la aceptación es de la versión nueva', async () => {
    const id = await proyectoNuevo();
    assert.equal((await proponer(id, { points: [insumo('Bolsas')] })).status, 201);
    // La ONG suma un punto (v2) y rechaza.
    const lote = await call(`${urlDe(id)}/cambios`, { token: ngo1, method: 'POST',
      body: { version: 1, changes: [{ action: 'add', type: 'outreach', detail: 'Mención en redes' }] } });
    assert.equal(lote.status, 200, JSON.stringify(lote.body));
    assert.equal((await call(`${urlDe(id)}/rechazar`, { token: ngo1, method: 'POST' })).status, 200);

    const r = await proponer(id, { mensaje: 'Mejoramos la oferta', points: [PLATA, insumo('Guantes')] });
    assert.equal(r.status, 201, JSON.stringify(r.body));

    const a = await ver(id);
    assert.equal(a.status, 'propuesto');
    assert.equal(a.version, 3, 'una sola versión nueva, no una por punto');
    assert.deepEqual(a.accepted_versions, { company: 3, ngo: null });
    assert.deepEqual(a.accepted, { company: true, ngo: false });
    assert.deepEqual(a.points.map((p) => [p.side, p.detail]).sort(), [
      ['company', 'Bolsas'], ['company', 'Guantes'], ['company', 'Plantines'], ['ngo', 'Mención en redes'],
    ]);

    const h = await historial(id);
    assert.deepEqual(h.map((v) => [v.version, v.side, v.changes.map((c) => c.after.detail)]), [
      [3, 'company', ['Plantines', 'Guantes']], [2, 'ngo', ['Mención en redes']], [1, 'company', ['Bolsas']],
    ]);
    assert.deepEqual(h[0].accepted_by.map((x) => x.side), ['company']);
  });

  test('si con los puntos nuevos se pasa de 20 del lado de la empresa: 409 y sigue rechazado, en su versión', async () => {
    const id = await proyectoNuevo();
    const puntos = (n, pre) => Array.from({ length: n }, (_, i) => insumo(`${pre} ${i + 1}`));
    assert.equal((await proponer(id, { points: puntos(15, 'Viejo') })).status, 201);
    assert.equal((await call(`${urlDe(id)}/rechazar`, { token: ngo1, method: 'POST' })).status, 200);

    const r = await proponer(id, { mensaje: 'otra vez', points: puntos(6, 'Nuevo') });
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body.error, 'Hasta 20 puntos por lado');
    const f = await fila(id);
    assert.equal(f.estado, 'rechazado', 'la transacción se deshace entera');
    assert.equal(Number(f.version), 1);
    assert.equal(await cuenta('patrocinio_puntos', id), 15);
    assert.equal(await cuenta('patrocinio_cambios', id), 15);
    assert.equal(await cuenta('patrocinio_aceptaciones', id), 1);
    assert.equal((await ver(id)).message, null, 'el mensaje tampoco cambia');

    // Con 5 llega justo a 20 y entra. Los puntos de la ONG no cuentan para el tope de la empresa.
    const ok = await proponer(id, { points: puntos(5, 'Nuevo') });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal((await ver(id)).points.length, 20);
  });

  test('los puntos de la ONG no cuentan para el tope de la empresa', async () => {
    const id = await proyectoNuevo();
    assert.equal((await proponer(id)).status, 201);
    const lote = await call(`${urlDe(id)}/cambios`, { token: ngo1, method: 'POST',
      body: { version: 1, changes: Array.from({ length: 20 }, (_, i) => ({ action: 'add', type: 'other', detail: `ONG ${i}` })) } });
    assert.equal(lote.status, 200, JSON.stringify(lote.body));
    assert.equal((await call(`${urlDe(id)}/rechazar`, { token: ngo1, method: 'POST' })).status, 200);
    const r = await proponer(id, { points: Array.from({ length: 20 }, (_, i) => insumo(`Empresa ${i}`)) });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal((await ver(id)).points.length, 40);
  });
});

describe('Proponer con puntos: concurrencia y permisos', () => {
  const burst = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)));
  const estados = (rs) => rs.map((r) => r.status).join(',');

  test('8 propuestas con puntos a la vez: entra una, con sus puntos una sola vez', async () => {
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      const id = await proyectoNuevo();
      const rs = await burst(8, (i) => proponer(id, { points: [insumo(`Bolsas ${i}`), insumo(`Guantes ${i}`)] }));
      assert.equal(rs.filter((r) => r.status === 201).length, 1, estados(rs));
      assert.equal(rs.filter((r) => r.status === 409).length, 7, estados(rs));
      assert.equal(await cuenta('patrocinio_puntos', id), 2);
      assert.equal(await cuenta('patrocinio_cambios', id), 2);
      assert.equal(await cuenta('patrocinio_aceptaciones', id), 1);
      const a = await ver(id);
      const quien = a.points[0].detail.split(' ')[1];
      assert.deepEqual(a.points.map((p) => p.detail).sort(), [`Bolsas ${quien}`, `Guantes ${quien}`], 'los dos puntos son del mismo pedido');
    }
  });

  test('re-proponer con puntos 8 veces a la vez: una versión nueva y los puntos de un solo pedido', async () => {
    const id = await proyectoNuevo();
    assert.equal((await proponer(id)).status, 201);
    assert.equal((await call(`${urlDe(id)}/rechazar`, { token: ngo1, method: 'POST' })).status, 200);
    const rs = await burst(8, (i) => proponer(id, { points: [insumo(`Bolsas ${i}`), insumo(`Guantes ${i}`)] }));
    assert.equal(rs.filter((r) => r.status === 201).length, 1, estados(rs));
    assert.equal(rs.filter((r) => r.status === 409).length, 7, estados(rs));
    assert.equal(Number((await fila(id)).version), 2);
    assert.equal(await cuenta('patrocinio_puntos', id), 2);
    assert.equal(await cuenta('patrocinio_cambios', id), 2);
  });

  test('una ONG o alguien sin sesión no proponen, tampoco con puntos', async () => {
    const id = await proyectoNuevo();
    const body = { project_id: id, points: [insumo('Bolsas')] };
    assert.equal((await call('/api/empresas/me/patrocinios', { token: ngo2, method: 'POST', body })).status, 403);
    assert.equal((await call('/api/empresas/me/patrocinios', { method: 'POST', body })).status, 401);
    assert.equal(await cuenta('patrocinio_puntos', id), 0);
  });
});
