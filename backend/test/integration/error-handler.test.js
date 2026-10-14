// test/integration/error-handler.test.js
//
// Errores que llegan al manejador global de Express (REVISION.md B3). Antes respondía SIEMPRE 500 con
// err.message: un JSON roto daba `500 {"error":"Unexpected end of JSON input"}`, un cuerpo de más de
// 5 MB también 500, y el rechazo de CORS filtraba `CORS: origen no permitido → <origen>`. Son errores
// del cliente: van con su código (400/413/415/403) y un mensaje fijo en español (regla 19).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Manejador global de errores', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = await setupTestServer();
    baseUrl = server.baseUrl;
  });

  after(async () => {
    if (server) await server.close();
  });

  const raw = (path, { method = 'POST', headers = {}, body } = {}) =>
    fetch(`${baseUrl}${path}`, { method, headers, body })
      .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  // Ningún mensaje técnico en inglés ni detalles internos.
  const isFriendly = (msg) => {
    assert.equal(typeof msg, 'string');
    assert.doesNotMatch(msg, /Unexpected|JSON input|entity|request|charset "|CORS|→|token/i);
  };

  test('JSON mal formado → 400 con mensaje en español', async () => {
    const r = await raw('/api/auth/login', {
      headers: { 'Content-Type': 'application/json' }, body: '{"email": "a@b.com", ',
    });
    assert.equal(r.status, 400);
    isFriendly(r.body.error);
    assert.match(r.body.error, /JSON válido/);
  });

  test('cuerpo de más de 5 MB → 413 con mensaje en español', async () => {
    const big = JSON.stringify({ x: 'a'.repeat(5 * 1024 * 1024 + 10) });
    const r = await raw('/api/auth/login', { headers: { 'Content-Type': 'application/json' }, body: big });
    assert.equal(r.status, 413);
    isFriendly(r.body.error);
    assert.match(r.body.error, /5 MB/, 'dice cuál es el límite');
  });

  test('charset no soportado → 415 con mensaje en español', async () => {
    const r = await raw('/api/auth/login', {
      headers: { 'Content-Type': 'application/json; charset=latin9' }, body: '{}',
    });
    assert.equal(r.status, 415);
    isFriendly(r.body.error);
    assert.match(r.body.error, /UTF-8/, 'dice qué codificación usar');
  });

  test('CORS en producción: origen no permitido → 403 sin revelar el origen; uno permitido pasa', async () => {
    // El callback de CORS lee NODE_ENV en cada pedido: se cambia solo durante este test.
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const bad = await raw('/health', { method: 'GET', headers: { Origin: 'https://sitio-malicioso.example' } });
      assert.equal(bad.status, 403);
      isFriendly(bad.body.error);
      assert.ok(!JSON.stringify(bad.body).includes('sitio-malicioso'), 'no repite el origen');

      const ok = await raw('/health', { method: 'GET', headers: { Origin: 'http://localhost:5173' } });
      assert.equal(ok.status, 200);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  test('un JSON válido sigue funcionando (control)', async () => {
    const r = await raw('/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nadie@example.com', password: 'Password1' }),
    });
    assert.notEqual(r.status, 500);
    assert.ok(r.status >= 400 && r.status < 500);
  });
});
