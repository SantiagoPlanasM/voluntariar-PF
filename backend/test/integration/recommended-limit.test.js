// test/integration/recommended-limit.test.js — GET /api/projects/recommended acota `limit` con clampInt (default 10,
// mín 1, máx 30), como los otros listados. Antes era `Math.min(parseInt(limit) || 10, 30)`: un negativo pasaba
// tal cual a `slice(0, limit)`, que con -5 devolvía todos los candidatos menos 5 (más de 30).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setupTestServer } = require('./helpers');

describe('Recomendaciones: limit acotado', () => {
  let server, token;
  const db = () => require('../../src/db');
  const recommended = (query) => fetch(`${server.baseUrl}/api/projects/recommended${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

  before(async () => {
    server = await setupTestServer({ seed: true });
    // Más de 30 candidatos (activos, con cupo, sin inscripción de María) para que se note el tope y el default.
    for (let i = 0; i < 40; i++) {
      await db().run(
        `INSERT INTO projects (id, ngo_id, titulo, descripcion, ubicacion, cupos) VALUES ($1, 'ngo-1', $2, 'Proyecto de relleno', 'Córdoba', 10)`,
        [randomUUID(), `Relleno ${i}`]
      );
    }
    const r = await fetch(`${server.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maria@example.com', password: 'Password1' }) });
    token = (await r.json()).token;
  });
  after(async () => { if (server) await server.close(); });

  for (const [query, expected] of [
    ['', 10],
    ['?limit=3', 3],
    ['?limit=-5', 10],   // antes: todos los candidatos menos 5
    ['?limit=0', 10],
    ['?limit=abc', 10],
    ['?limit=100', 30],
    ['?limit=30', 30],
    ['?limit=1', 1],
  ]) {
    test(`${query || 'sin limit'} → ${expected} recomendaciones`, async () => {
      const r = await recommended(query);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.recommendations.length, expected);
    });
  }
});
