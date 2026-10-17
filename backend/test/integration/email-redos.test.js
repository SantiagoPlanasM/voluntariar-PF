// test/integration/email-redos.test.js — un email gigante no bloquea la API (SonarCloud S8786; PROJECT_ANALYSIS.md §201).
// Defecto (reproducido el 2026-10-17 contra la API local): POST /api/auth/login con un email de 80 mil caracteres
// armado para el peor caso del regex tardaba 3,4 s, y un /health mandado en paralelo esperaba lo mismo (Node tiene
// un solo hilo). Criterio: login y registro responden 400 "Email inválido" y /health en paralelo responde rápido.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Email gigante (ReDoS): la API sigue atendiendo', () => {
  let baseUrl, close;
  const evil = 'a@' + 'a.'.repeat(40000) + '@';
  const post = (path, body) => fetch(`${baseUrl}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

  before(async () => { ({ baseUrl, close } = await setupTestServer({ seed: false })); });
  after(async () => { await close(); });

  for (const [path, extra] of [['/api/auth/login', { password: 'x' }],
    ['/api/auth/register', { name: 'Ana Prueba', password: 'Password1', role: 'volunteer' }]]) {
    test(`${path}: 400 "Email inválido" en < 500 ms, y /health en paralelo también`, async () => {
      // Arrange: el pedido malicioso sale primero; el /health, 20 ms después. El tiempo del /health solo NO alcanza
      // como prueba: a veces el /health se atiende antes de que empiece la validación y pasa aunque el ataque
      // tarde segundos (visto en 2 de 3 corridas del registro). Por eso se mide también el pedido malicioso.
      const tAttack = Date.now();
      const attack = post(path, { email: evil, ...extra }).then((r) => ({ ...r, ms: Date.now() - tAttack }));
      await new Promise((r) => setTimeout(r, 20));
      // Act
      const t0 = Date.now();
      const health = await fetch(`${baseUrl}/health`);
      const healthMs = Date.now() - t0;
      const r = await attack;
      // Assert
      assert.deepEqual([r.status, r.body.error], [400, 'Email inválido']);
      assert.ok(r.ms < 500, `el pedido con el email gigante tardó ${r.ms} ms`);
      assert.equal(health.status, 200);
      assert.ok(healthMs < 500, `/health tardó ${healthMs} ms mientras se validaba el email`);
    });
  }
});
