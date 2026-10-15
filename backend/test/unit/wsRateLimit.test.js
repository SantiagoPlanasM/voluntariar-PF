// test/unit/wsRateLimit.test.js — límite de frecuencia del WebSocket del chat (REVISION B19).
// El test de integración cubre la ráfaga; acá, con un reloj a mano, que la ventana se libere con el tiempo.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { allowSend, SEND_LIMIT, SEND_WINDOW_MS } = require('../../src/ws');

test('hasta SEND_LIMIT envíos por ventana; el siguiente se rechaza', () => {
  const t0 = 1_000_000;
  for (let i = 0; i < SEND_LIMIT; i++) assert.equal(allowSend('u-rate-1', t0 + i), true, `envío ${i + 1}`);
  assert.equal(allowSend('u-rate-1', t0 + SEND_LIMIT), false);
});

test('pasada la ventana desde los primeros envíos, se vuelve a poder', () => {
  const t0 = 2_000_000;
  for (let i = 0; i < SEND_LIMIT; i++) allowSend('u-rate-2', t0);
  assert.equal(allowSend('u-rate-2', t0 + SEND_WINDOW_MS - 1), false, 'todavía dentro de la ventana');
  assert.equal(allowSend('u-rate-2', t0 + SEND_WINDOW_MS), true, 'ya salieron de la ventana');
});

test('los rechazos no cuentan como envíos (no alargan el bloqueo)', () => {
  const t0 = 3_000_000;
  for (let i = 0; i < SEND_LIMIT; i++) allowSend('u-rate-3', t0);
  for (let i = 1; i <= 50; i++) assert.equal(allowSend('u-rate-3', t0 + i), false);
  assert.equal(allowSend('u-rate-3', t0 + SEND_WINDOW_MS), true);
});

test('cada usuario tiene su propio límite', () => {
  const t0 = 4_000_000;
  for (let i = 0; i < SEND_LIMIT; i++) allowSend('u-rate-4', t0);
  assert.equal(allowSend('u-rate-4', t0 + 1), false);
  assert.equal(allowSend('u-rate-5', t0 + 1), true);
});
