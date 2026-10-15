// test/integration/kpis-input-validation.test.js
//
// KPIs con datos inválidos daban 500 (REVISION D6/§78 para el PUT sin `nombre`; el resto, mismo tipo de bug
// que B12/B13 en §76): `nombre` faltante en el PUT (NOT NULL), `nombre` que no es string (`.trim()`),
// `tipo_valor` fuera de la lista (CHECK de la base), textos que no son string. Ahora: 400 con un mensaje claro
// y la base sin cambios. El PUT sigue sin ser parcial (deuda conocida, no se tocó): exige `nombre`.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('KPIs: datos inválidos → 400, no 500', () => {
  let server, baseUrl, db, ngo1, kpiId;

  const call = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const kpiCount = async () => Number((await db.get(`SELECT COUNT(*) AS n FROM kpis WHERE project_id='proj-1'`)).n) || 0;
  const kpiRow = () => db.get('SELECT nombre, descripcion, valor, tipo_valor, unidad FROM kpis WHERE id=$1', [kpiId]);

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    ngo1 = (await call('/api/auth/login', { method: 'POST', body: { email: 'admin@sustentando.org', password: 'Password1' } })).body.token;
    const k = await call('/api/projects/proj-1/kpis', { token: ngo1, method: 'POST', body: { nombre: 'Árboles', valor: 10, unidad: 'u' } });
    assert.equal(k.status, 201);
    kpiId = k.body.kpi.id;
  });
  after(async () => { if (server) await server.close(); });

  const BAD = [
    ['sin nombre', { valor: 5 }, 'El nombre del KPI es obligatorio'],
    ['nombre vacío', { nombre: '   ' }, 'El nombre del KPI no puede estar vacío'],
    ['nombre no es texto', { nombre: 123 }, 'El nombre del KPI tiene que ser un texto'],
    ['nombre muy largo', { nombre: 'x'.repeat(121) }, 'El nombre del KPI puede tener hasta 120 caracteres'],
    ['descripción no es texto', { nombre: 'Ok', descripcion: ['a'] }, 'La descripción tiene que ser un texto'],
    ['unidad no es texto', { nombre: 'Ok', unidad: { u: 1 } }, 'La unidad tiene que ser un texto'],
    ['tipo inválido', { nombre: 'Ok', tipo_valor: 'moneda' }, 'Tipo de KPI inválido'],
    // F3 (decisión del usuario, §90): 'texto' ya no se acepta al crear ni al editar (valor es numérico).
    ['tipo texto', { nombre: 'Ok', tipo_valor: 'texto' }, 'Tipo de KPI inválido'],
    // fecha (§102): 'AAAA-MM-DD' y una fecha que exista; antes se guardaba cualquier texto.
    ['fecha en texto libre', { nombre: 'Ok', fecha: 'ayer' }, 'La fecha tiene que tener el formato AAAA-MM-DD'],
    ['fecha con otro formato', { nombre: 'Ok', fecha: '01/10/2026' }, 'La fecha tiene que tener el formato AAAA-MM-DD'],
    ['fecha que no existe', { nombre: 'Ok', fecha: '2026-02-30' }, 'La fecha tiene que tener el formato AAAA-MM-DD'],
    ['mes 13', { nombre: 'Ok', fecha: '2026-13-01' }, 'La fecha tiene que tener el formato AAAA-MM-DD'],
    ['fecha con un dígito de más', { nombre: 'Ok', fecha: '2026-10-012' }, 'La fecha tiene que tener el formato AAAA-MM-DD'],
    ['fecha que no es texto', { nombre: 'Ok', fecha: 20261001 }, 'La fecha tiene que tener el formato AAAA-MM-DD'],
    ['valor no numérico', { nombre: 'Ok', valor: 'mucho' }, 'El valor tiene que ser un número'],
    ['valor infinito', { nombre: 'Ok', valor: '1e400' }, 'El valor tiene que ser un número'],
    ['valor con basura al final', { nombre: 'Ok', valor: '12abc' }, 'El valor tiene que ser un número'],
  ];

  for (const [name, body, error] of BAD) {
    test(`POST — ${name} → 400, no se crea nada`, async () => {
      const before = await kpiCount();
      const r = await call('/api/projects/proj-1/kpis', { token: ngo1, method: 'POST', body });
      assert.deepEqual([r.status, r.body.error], [400, error]);
      assert.equal(await kpiCount(), before);
    });

    test(`PUT — ${name} → 400, el KPI no cambia`, async () => {
      const before = await kpiRow();
      const r = await call(`/api/projects/proj-1/kpis/${kpiId}`, { token: ngo1, method: 'PUT', body });
      assert.deepEqual([r.status, r.body.error], [400, error]);
      assert.deepEqual(await kpiRow(), before);
    });
  }

  test('los válidos siguen andando (valor null, tipos de la lista, texto recortado)', async () => {
    const r = await call('/api/projects/proj-1/kpis', { token: ngo1, method: 'POST',
      body: { nombre: '  Familias  ', tipo_valor: 'porcentaje', valor: '85', descripcion: null } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.deepEqual([r.body.kpi.nombre, r.body.kpi.tipo_valor, r.body.kpi.valor], ['Familias', 'porcentaje', 85]);
    const u = await call(`/api/projects/proj-1/kpis/${kpiId}`, { token: ngo1, method: 'PUT', body: { nombre: 'Árboles', valor: null } });
    assert.equal(u.status, 200, JSON.stringify(u.body));
    assert.equal(u.body.kpi.valor, null);
    const e = await call(`/api/projects/proj-1/kpis/${kpiId}`, { token: ngo1, method: 'PUT', body: { nombre: 'Árboles', valor: '' } });
    assert.equal(e.status, 200);
    assert.equal(e.body.kpi.valor, null, 'un valor vacío es "sin valor", no 0');
    const d = await call(`/api/projects/proj-1/kpis/${kpiId}`, { token: ngo1, method: 'PUT', body: { nombre: 'Árboles', fecha: '2024-02-29' } });
    assert.deepEqual([d.status, d.body.kpi.fecha], [200, '2024-02-29'], 'un 29 de febrero de año bisiesto es válido');
    const v = await call(`/api/projects/proj-1/kpis/${kpiId}`, { token: ngo1, method: 'PUT', body: { nombre: 'Árboles', fecha: '' } });
    assert.deepEqual([v.status, v.body.kpi.fecha], [200, null], 'fecha vacía = sin fecha');
  });
});
