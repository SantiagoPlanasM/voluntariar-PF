// test/integration/habilidades.test.js
//
// PUT /api/voluntarios/me/habilidades reemplaza el set completo. Con un habilidad_id repetido el
// INSERT violaba la PK (user_id, habilidad_id) DESPUÉS del DELETE, sin transacción: respondía 500 y el
// voluntario se quedaba sin ninguna habilidad (REVISION.md B6). Ahora se deduplica (gana la última
// aparición, porque el body es "el estado final") y DELETE + INSERT van en una transacción.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('PUT /api/voluntarios/me/habilidades', () => {
  let server;
  let baseUrl;
  let db;
  let token;
  const id = {}; // nombre → id del catálogo

  const api = (path, { method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const mine = async () => (await api('/api/voluntarios/me/habilidades')).body.habilidades.map((h) => [h.nombre, h.nivel]);
  const save = (habilidades) => api('/api/voluntarios/me/habilidades', { method: 'PUT', body: { habilidades } });

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    for (const r of await db.all(`SELECT id, nombre FROM habilidades WHERE nombre IN ('Cocina','Fotografía','Idiomas')`)) {
      id[r.nombre] = r.id;
    }
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maria@example.com', password: 'Password1' }),
    }).then((r) => r.json());
    token = login.token;
  });

  after(async () => {
    if (server) await server.close();
  });

  test('guarda el set completo (ordenado por nombre)', async () => {
    const r = await save([
      { habilidad_id: id['Fotografía'], nivel: 'avanzado' },
      { habilidad_id: id.Cocina },
    ]);
    assert.equal(r.status, 200);
    assert.deepEqual(await mine(), [['Cocina', 'basico'], ['Fotografía', 'avanzado']]);
  });

  test('un id repetido no da 500 ni borra todo: se guarda una vez, con el nivel de la última aparición', async () => {
    const r = await save([
      { habilidad_id: id.Idiomas, nivel: 'basico' },
      { habilidad_id: id.Cocina, nivel: 'intermedio' },
      { habilidad_id: id.Cocina, nivel: 'avanzado' },
    ]);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.habilidades.map((h) => [h.nombre, h.nivel]), [['Cocina', 'avanzado'], ['Idiomas', 'basico']]);
    assert.deepEqual(await mine(), [['Cocina', 'avanzado'], ['Idiomas', 'basico']]);
  });

  test('un pedido inválido (400) no toca las habilidades guardadas', async () => {
    const before = await mine();
    const r = await save([{ habilidad_id: id.Cocina }, { habilidad_id: 'no-existe' }]);
    assert.equal(r.status, 400);
    assert.deepEqual(await mine(), before);
  });

  test('si un INSERT falla después del DELETE, se conservan las habilidades anteriores (transacción)', async () => {
    // Ningún pedido válido llega a fallar ahí (se valida y deduplica antes), así que se inyecta la falla
    // en el adaptador (el server corre en este mismo proceso). Se intercepta tanto `db.run` como el
    // `tx.run` de la transacción, para que el test no dependa de cómo esté escrita la ruta.
    assert.equal((await save([{ habilidad_id: id.Cocina }, { habilidad_id: id['Fotografía'] }])).status, 200);
    const before = await mine();

    const failOnIdiomas = (run) => (sql, params) =>
      /INSERT INTO voluntario_habilidades/.test(sql) && params?.[1] === id.Idiomas
        ? Promise.reject(new Error('falla simulada'))
        : run(sql, params);
    const origRun = db.run;
    const origTx = db.transaction;
    db.run = failOnIdiomas(origRun);
    db.transaction = (fn) => origTx((tx) => fn({ ...tx, run: failOnIdiomas(tx.run) }));
    let r;
    try {
      r = await save([{ habilidad_id: id.Cocina, nivel: 'avanzado' }, { habilidad_id: id.Idiomas }]);
    } finally {
      db.run = origRun;
      db.transaction = origTx;
    }
    assert.equal(r.status, 500);
    assert.deepEqual(await mine(), before, 'ni se borraron ni se cambiaron las anteriores');
  });

  test('un array vacío borra todas', async () => {
    const r = await save([]);
    assert.equal(r.status, 200);
    assert.deepEqual(await mine(), []);
  });
});
