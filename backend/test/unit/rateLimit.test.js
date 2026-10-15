// test/unit/rateLimit.test.js — limitador en memoria de intentos (§103). Reloj a mano: sin esperas reales.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLimiter } = require('../../src/lib/rateLimit');

test('hasta `max` intentos en la ventana; con el siguiente queda bloqueado y dice cuántos segundos faltan', () => {
  const l = createLimiter({ max: 3, windowMs: 60_000 });
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) { assert.equal(l.blocked('k', t0 + i), 0); l.hit('k', t0 + i); }
  assert.equal(l.blocked('k', t0 + 10), 60); // el primero sale de la ventana en t0 + 60 s
  assert.equal(l.blocked('k', t0 + 30_000), 30);
});

test('pasada la ventana desde el primero, se libera', () => {
  const l = createLimiter({ max: 2, windowMs: 1_000 });
  l.hit('k', 0); l.hit('k', 500);
  assert.ok(l.blocked('k', 999) > 0);
  assert.equal(l.blocked('k', 1_000), 0); // el de t=0 ya salió
  assert.ok(l.blocked('k', 1_000) === 0);
});

test('reset limpia la clave; las claves son independientes', () => {
  const l = createLimiter({ max: 1, windowMs: 60_000 });
  l.hit('a', 0); l.hit('b', 0);
  assert.ok(l.blocked('a', 1) > 0);
  l.reset('a');
  assert.equal(l.blocked('a', 2), 0);
  assert.ok(l.blocked('b', 2) > 0);
});
