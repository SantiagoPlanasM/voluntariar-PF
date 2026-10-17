// .github/scripts/post-deploy.test.js — lógica del smoke y del E2E post-deploy (TP de Calidad, T9; §193).
// Criterios de aceptación (escritos antes del código):
//  - el deploy está listo cuando /health responde 200, status 'ok' y el commit esperado;
//  - smoke (solo lectura): /api/projects devuelve { projects: [] } (array), /api/stats tres números ≥ 0, y la
//    portada del sitio es el HTML del SPA (tiene <div id="root">);
//  - E2E de donación: POST /api/donaciones responde 201 con donation_id y un checkout_url https de Mercado Pago;
//    GET /api/donaciones/:id devuelve esa misma donación en estado 'pending' (no se paga);
//  - cada chequeo devuelve la lista de errores (vacía = pasa); los reintentos tienen tope.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  checkHealth, checkProjects, checkStats, checkIndexHtml, checkDonationCreated, checkDonationStatus, retry,
} = require('./post-deploy');

describe('checkHealth', () => {
  const body = { status: 'ok', timestamp: '2026-10-17T00:00:00Z', commit: 'abc123' };
  test('200, ok y el commit esperado: pasa', () => {
    assert.deepEqual(checkHealth(200, body, 'abc123'), []);
  });
  test('commit distinto: todavía no es este deploy', () => {
    assert.equal(checkHealth(200, body, 'zzz999').length, 1);
  });
  test('sin commit esperado, solo mira status', () => {
    assert.deepEqual(checkHealth(200, { status: 'ok', commit: null }, undefined), []);
  });
  test('no 200 o status distinto de ok: falla', () => {
    assert.equal(checkHealth(502, null, 'abc123').length > 0, true);
    assert.equal(checkHealth(200, { status: 'down', commit: 'abc123' }, 'abc123').length, 1);
    // un 500 con un cuerpo que igual dice ok (proxy, caché) no es un deploy sano
    assert.equal(checkHealth(500, { status: 'ok', commit: 'abc123' }, 'abc123').length, 1);
  });
});

describe('checkProjects / checkStats / checkIndexHtml', () => {
  test('projects: 200 con un array (vacío también vale)', () => {
    assert.deepEqual(checkProjects(200, { projects: [] }), []);
    assert.deepEqual(checkProjects(200, { projects: [{ id: 'p1' }] }), []);
  });
  test('projects: otra forma o error: falla', () => {
    assert.equal(checkProjects(200, { items: [] }).length, 1);
    assert.equal(checkProjects(500, { error: 'x' }).length > 0, true);
  });
  test('stats: tres números enteros ≥ 0', () => {
    assert.deepEqual(checkStats(200, { active_projects: 3, volunteers: 0, ngos: 2 }), []);
    assert.equal(checkStats(200, { active_projects: '3', volunteers: 0, ngos: 2 }).length, 1);
    assert.equal(checkStats(200, { active_projects: -1, volunteers: 0, ngos: 2 }).length, 1);
    assert.equal(checkStats(200, { active_projects: 2.5, volunteers: 0, ngos: 2 }).length, 1);
    assert.equal(checkStats(200, { volunteers: 0, ngos: 2 }).length, 1);
  });
  test('portada: 200 y el contenedor del SPA', () => {
    assert.deepEqual(checkIndexHtml(200, '<html><body><div id="root"></div></body></html>'), []);
    assert.equal(checkIndexHtml(200, '<html>Service Unavailable</html>').length, 1);
    assert.equal(checkIndexHtml(404, '').length > 0, true);
  });
});

describe('E2E de donación', () => {
  const created = {
    donation_id: '3f2a1c4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b',
    checkout_url: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=123-abc',
  };
  test('201 con id y link de checkout de Mercado Pago: pasa', () => {
    assert.deepEqual(checkDonationCreated(201, created), []);
  });
  test('también acepta el link de producción de Mercado Pago (www.mercadopago.com.ar)', () => {
    assert.deepEqual(checkDonationCreated(201, { ...created, checkout_url: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1' }), []);
  });
  test('link que no es de Mercado Pago, http o falta: falla', () => {
    assert.equal(checkDonationCreated(201, { ...created, checkout_url: 'https://evil.example/mercadopago.com?pref_id=1-abc' }).length, 1);
    assert.equal(checkDonationCreated(201, { ...created, checkout_url: 'http://www.mercadopago.com.ar/x?pref_id=1-abc' }).length, 1);
    assert.equal(checkDonationCreated(201, { donation_id: created.donation_id }).length, 1);
    // dominios que CONTIENEN "mercadopago.com" pero no son de Mercado Pago
    assert.equal(checkDonationCreated(201, { ...created, checkout_url: 'https://www.mercadopago.com.evil.example/x?pref_id=1-abc' }).length, 1);
    assert.equal(checkDonationCreated(201, { ...created, checkout_url: 'https://evilmercadopago.com/x?pref_id=1-abc' }).length, 1);
  });
  test('link de Mercado Pago sin pref_id (o vacío): falla — sin preferencia no hay checkout', () => {
    // El checkout de MP no se puede abrir desde un script (CloudFront responde 403 sin navegador y 200 con un
    // pref_id inventado: §194), así que la evidencia de que MP creó la preferencia es el 201 + el pref_id del link.
    assert.equal(checkDonationCreated(201, { ...created, checkout_url: 'https://www.mercadopago.com.ar/checkout/v1/redirect' }).length, 1);
    assert.equal(checkDonationCreated(201, { ...created, checkout_url: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=' }).length, 1);
  });
  test('201 sin donation_id: falla aunque el link sea bueno', () => {
    assert.equal(checkDonationCreated(201, { checkout_url: created.checkout_url }).length, 1);
  });
  test('otro código (503 sin MP configurado, 429, 502): falla con el código en el mensaje', () => {
    const errs = checkDonationCreated(503, { error: 'Las donaciones no están disponibles por el momento' });
    assert.equal(errs.length > 0, true);
    assert.match(errs.join(' '), /503/);
  });
  test('estado: la misma donación, pending', () => {
    const body = { donation: { id: created.donation_id, status: 'pending', amount: 100 } };
    assert.deepEqual(checkDonationStatus(200, body, created.donation_id), []);
    assert.equal(checkDonationStatus(200, { donation: { ...body.donation, status: 'completed' } }, created.donation_id).length, 1);
    assert.equal(checkDonationStatus(200, body, 'otro-id').length, 1);
    assert.equal(checkDonationStatus(404, { error: 'x' }, created.donation_id).length > 0, true);
  });
});

describe('retry', () => {
  const noSleep = async () => {};
  test('devuelve en cuanto el chequeo da sin errores', async () => {
    let n = 0;
    const r = await retry(async () => (++n < 3 ? ['todavía no'] : []), { attempts: 5, delayMs: 1, sleep: noSleep });
    assert.deepEqual(r, { ok: true, attempts: 3, errors: [] });
  });
  test('con tope: después de N intentos devuelve los últimos errores', async () => {
    let n = 0;
    const r = await retry(async () => [`fallo ${++n}`], { attempts: 4, delayMs: 1, sleep: noSleep });
    assert.deepEqual(r, { ok: false, attempts: 4, errors: ['fallo 4'] });
  });
  test('una excepción (red, timeout) cuenta como error y se reintenta', async () => {
    let n = 0;
    const r = await retry(async () => { if (++n === 1) throw new Error('ECONNRESET'); return []; },
      { attempts: 3, delayMs: 1, sleep: noSleep });
    assert.equal(r.ok, true);
    assert.equal(r.attempts, 2);
  });
});
