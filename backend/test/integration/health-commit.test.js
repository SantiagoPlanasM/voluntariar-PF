// test/integration/health-commit.test.js — /health informa el commit desplegado (TP de Calidad, T9; §193).
// Criterio de aceptación (escrito antes del código): el pipeline de deploy espera a que /health muestre el commit
// que acaba de mandar a Render antes de correr el smoke. /health responde { status: 'ok', commit } con el valor de
// RENDER_GIT_COMMIT (variable que Render define en cada deploy), o commit: null si no está (local, tests). No
// expone ninguna otra variable de entorno.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('/health con el commit desplegado', () => {
  let baseUrl, close;
  const health = () => fetch(`${baseUrl}/health`).then(async (r) => ({ status: r.status, body: await r.json() }));

  before(async () => { ({ baseUrl, close } = await setupTestServer({ seed: false })); });
  after(async () => { delete process.env.RENDER_GIT_COMMIT; await close(); });

  test('sin RENDER_GIT_COMMIT: commit null', async () => {
    // Arrange
    delete process.env.RENDER_GIT_COMMIT;
    // Act
    const { status, body } = await health();
    // Assert
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.commit, null);
  });

  test('con RENDER_GIT_COMMIT: lo devuelve tal cual (se lee en cada pedido)', async () => {
    process.env.RENDER_GIT_COMMIT = '959f74b0c0ffee0000000000000000000000abcd';
    const { body } = await health();
    assert.equal(body.commit, '959f74b0c0ffee0000000000000000000000abcd');
  });

  test('solo status, timestamp y commit: ninguna otra variable de entorno', async () => {
    process.env.RENDER_GIT_COMMIT = 'abc';
    const { body } = await health();
    assert.deepEqual(Object.keys(body).sort(), ['commit', 'status', 'timestamp']);
  });
});
