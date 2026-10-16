// test/unit/payments.test.js
//
// lib/payments.js: Mercado Pago (Checkout Pro, modo prueba) por su API REST con fetch, sin el SDK
// (PLAN_FALTANTE.md, Etapa 6; decisión P2 del usuario). `fetch` se reemplaza por un doble: NO se habla con Mercado Pago.
//
// De dónde sale cada cosa (verificado el 2026-10-16 contra el código del SDK oficial `mercadopago@3.6.1`, porque la
// documentación web carga esas partes con JavaScript):
//   - base `https://api.mercadopago.com` (utils/config), `Authorization: Bearer <access token>`;
//   - `POST /checkout/preferences` (clients/preference/create), respuesta con id, init_point y sandbox_init_point;
//   - `GET /v1/payments/:id` con el id codificado (clients/payment/get);
//   - firma del webhook (utils/webhook): header `x-signature: ts=…,v1=…`; manifiesto
//     `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` omitiendo las partes vacías, HMAC-SHA256 hex con el secreto,
//     comparación en tiempo constante; `data.id` NO se pasa a minúsculas.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const ENV_KEYS = ['MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET'];
const fresh = () => {
  delete require.cache[require.resolve('../../src/lib/payments')];
  return require('../../src/lib/payments');
};
const hmac = (secret, s) => crypto.createHmac('sha256', secret).update(s).digest('hex');

describe('verifyWebhookSignature()', () => {
  const { verifyWebhookSignature } = fresh();
  const SECRET = 'secreto-de-la-app';
  const sign = (manifest) => hmac(SECRET, manifest);

  test('firma válida: manifiesto "id:…;request-id:…;ts:…;" (con ; al final)', () => {
    const v1 = sign('id:123456;request-id:bb56a2f1-6aae-46ac-982e-9dcd3581d08e;ts:1704908010;');
    assert.equal(verifyWebhookSignature({
      xSignature: `ts=1704908010,v1=${v1}`, xRequestId: 'bb56a2f1-6aae-46ac-982e-9dcd3581d08e', dataId: '123456', secret: SECRET,
    }), true);
  });

  test('el orden de las partes del header y los espacios no importan; las claves desconocidas se ignoran', () => {
    const v1 = sign('id:9;request-id:r;ts:100;');
    assert.equal(verifyWebhookSignature({ xSignature: ` v1=${v1} , foo=bar, ts=100 `, xRequestId: 'r', dataId: '9', secret: SECRET }), true);
    assert.equal(verifyWebhookSignature({ xSignature: `TS=100,V1=${v1}`, xRequestId: 'r', dataId: '9', secret: SECRET }), true);
  });

  test('sin request-id o sin data.id: esa parte se omite del manifiesto', () => {
    assert.equal(verifyWebhookSignature({ xSignature: `ts=100,v1=${sign('id:9;ts:100;')}`, xRequestId: '', dataId: '9', secret: SECRET }), true);
    assert.equal(verifyWebhookSignature({ xSignature: `ts=100,v1=${sign('request-id:r;ts:100;')}`, xRequestId: 'r', dataId: undefined, secret: SECRET }), true);
  });

  test('data.id no se pasa a minúsculas (como el SDK)', () => {
    const v1 = sign('id:ORD01ABC;request-id:r;ts:100;');
    assert.equal(verifyWebhookSignature({ xSignature: `ts=100,v1=${v1}`, xRequestId: 'r', dataId: 'ORD01ABC', secret: SECRET }), true);
    assert.equal(verifyWebhookSignature({ xSignature: `ts=100,v1=${sign('id:ord01abc;request-id:r;ts:100;')}`, xRequestId: 'r', dataId: 'ORD01ABC', secret: SECRET }), false);
  });

  test('cualquier dato cambiado → false', () => {
    const ok = { xSignature: `ts=100,v1=${sign('id:9;request-id:r;ts:100;')}`, xRequestId: 'r', dataId: '9', secret: SECRET };
    assert.equal(verifyWebhookSignature(ok), true);
    assert.equal(verifyWebhookSignature({ ...ok, dataId: '10' }), false, 'otro pago');
    assert.equal(verifyWebhookSignature({ ...ok, xRequestId: 'otro' }), false, 'otro request-id');
    assert.equal(verifyWebhookSignature({ ...ok, secret: 'otro' }), false, 'otro secreto');
    assert.equal(verifyWebhookSignature({ ...ok, xSignature: ok.xSignature.replace('ts=100', 'ts=101') }), false, 'otro ts');
    assert.equal(verifyWebhookSignature({ ...ok, xSignature: `ts=100,v1=${'0'.repeat(64)}` }), false, 'otro hash');
  });

  test('header ausente, mal formado, sin ts, ts no numérico, sin v1 o con un hash de otro largo → false (nunca lanza)', () => {
    const v1 = sign('id:9;request-id:r;ts:100;');
    for (const xSignature of [undefined, null, '', 'basura', `v1=${v1}`, `ts=abc,v1=${v1}`, 'ts=100', 'ts=100,v2=abc', 'ts=100,v1=abc', `ts=100,v1=${v1}00`, 42]) {
      assert.equal(verifyWebhookSignature({ xSignature, xRequestId: 'r', dataId: '9', secret: SECRET }), false, String(xSignature));
    }
  });

  test('un ts no numérico se rechaza aunque la firma esté bien calculada sobre él (como el SDK)', () => {
    const v1 = sign('id:9;request-id:r;ts:abc;');
    assert.equal(verifyWebhookSignature({ xSignature: `ts=abc,v1=${v1}`, xRequestId: 'r', dataId: '9', secret: SECRET }), false);
  });

  test('un hash válido pero recortado (o con un prefijo) → false', () => {
    const v1 = sign('id:9;request-id:r;ts:100;');
    for (const h of [v1.slice(0, 10), v1.slice(0, 63), v1.slice(1)]) {
      assert.equal(verifyWebhookSignature({ xSignature: `ts=100,v1=${h}`, xRequestId: 'r', dataId: '9', secret: SECRET }), false, h);
    }
  });

  test('sin secreto configurado → false (no se aceptan avisos sin poder verificarlos)', () => {
    const v1 = hmac('', 'id:9;request-id:r;ts:100;');
    assert.equal(verifyWebhookSignature({ xSignature: `ts=100,v1=${v1}`, xRequestId: 'r', dataId: '9', secret: '' }), false);
  });

  test('si no se pasa `secret`, usa MP_WEBHOOK_SECRET', () => {
    const saved = process.env.MP_WEBHOOK_SECRET;
    process.env.MP_WEBHOOK_SECRET = SECRET;
    try {
      const v1 = sign('id:9;request-id:r;ts:100;');
      assert.equal(fresh().verifyWebhookSignature({ xSignature: `ts=100,v1=${v1}`, xRequestId: 'r', dataId: '9' }), true);
    } finally { if (saved === undefined) delete process.env.MP_WEBHOOK_SECRET; else process.env.MP_WEBHOOK_SECRET = saved; }
  });
});

describe('createPreference() / getPayment() / configuración', () => {
  let saved, calls, fetchImpl;
  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.MP_ACCESS_TOKEN = 'TEST-1234-token-secreto';
    calls = [];
    fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({}) });
    mock.method(globalThis, 'fetch', async (url, opts) => { calls.push({ url, opts }); return fetchImpl(); });
    mock.method(console, 'error', () => {});
  });
  afterEach(() => {
    mock.restoreAll();
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });

  describe('isConfigured()', () => {
    test('true con MP_ACCESS_TOKEN; false sin él o con solo espacios', () => {
      assert.equal(fresh().isConfigured(), true);
      process.env.MP_ACCESS_TOKEN = '   ';
      assert.equal(fresh().isConfigured(), false);
      delete process.env.MP_ACCESS_TOKEN;
      assert.equal(fresh().isConfigured(), false);
    });
  });

  describe('createPreference()', () => {
    const input = {
      donationId: 'don-1', title: 'Donación: Reforestación', amount: 1500,
      successUrl: 'https://app/donaciones/vuelta', notificationUrl: 'https://api/api/donaciones/webhook',
    };
    const okBody = { id: 'pref-1', init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1', sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1' };

    test('POST a /checkout/preferences con el token, JSON e idempotencia por donación', async () => {
      fetchImpl = async () => ({ ok: true, status: 201, json: async () => okBody });
      await fresh().createPreference(input);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, 'https://api.mercadopago.com/checkout/preferences');
      assert.equal(calls[0].opts.method, 'POST');
      assert.equal(calls[0].opts.headers.Authorization, 'Bearer TEST-1234-token-secreto');
      assert.equal(calls[0].opts.headers['Content-Type'], 'application/json');
      assert.equal(calls[0].opts.headers['X-Idempotency-Key'], 'don-1');
    });

    test('el cuerpo: un ítem en ARS, external_reference = id de la donación, vuelta y aviso', async () => {
      fetchImpl = async () => ({ ok: true, status: 201, json: async () => okBody });
      await fresh().createPreference(input);
      assert.deepEqual(JSON.parse(calls[0].opts.body), {
        items: [{ id: 'don-1', title: 'Donación: Reforestación', quantity: 1, unit_price: 1500, currency_id: 'ARS' }],
        external_reference: 'don-1',
        back_urls: { success: 'https://app/donaciones/vuelta', failure: 'https://app/donaciones/vuelta', pending: 'https://app/donaciones/vuelta' },
        auto_return: 'approved',
        notification_url: 'https://api/api/donaciones/webhook',
      });
    });

    test('con token de prueba (TEST-…) devuelve el link de sandbox; con otro, el init_point', async () => {
      fetchImpl = async () => ({ ok: true, status: 201, json: async () => okBody });
      assert.deepEqual(await fresh().createPreference(input), { preferenceId: 'pref-1', checkoutUrl: okBody.sandbox_init_point });
      process.env.MP_ACCESS_TOKEN = 'APP_USR-9999';
      assert.deepEqual(await fresh().createPreference(input), { preferenceId: 'pref-1', checkoutUrl: okBody.init_point });
    });

    test('"de prueba" es solo el prefijo TEST- (no un TEST en el medio)', async () => {
      fetchImpl = async () => ({ ok: true, status: 201, json: async () => okBody });
      process.env.MP_ACCESS_TOKEN = 'APP_USR-123-TEST-456';
      assert.equal((await fresh().createPreference(input)).checkoutUrl, okBody.init_point);
    });

    test('con token de prueba pero sin sandbox_init_point: usa init_point', async () => {
      fetchImpl = async () => ({ ok: true, status: 201, json: async () => ({ id: 'pref-1', init_point: okBody.init_point }) });
      assert.equal((await fresh().createPreference(input)).checkoutUrl, okBody.init_point);
    });

    test('respuesta sin id o sin link → PaymentError', async () => {
      const { createPreference, PaymentError } = fresh();
      fetchImpl = async () => ({ ok: true, status: 201, json: async () => ({ init_point: 'x' }) });
      await assert.rejects(createPreference(input), PaymentError);
      fetchImpl = async () => ({ ok: true, status: 201, json: async () => ({ id: 'p' }) });
      await assert.rejects(createPreference(input), PaymentError);
    });

    test('error HTTP → PaymentError con el estado; el mensaje NO incluye el token', async () => {
      const { createPreference, PaymentError } = fresh();
      fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({ message: 'invalid access token' }) });
      await assert.rejects(createPreference(input), (e) => e instanceof PaymentError && e.status === 401 && /invalid access token/.test(e.message) && !e.message.includes('TEST-1234'));
      const logged = console.error.mock.calls.map((c) => c.arguments.join(' ')).join('\n');
      assert.ok(!logged.includes('TEST-1234-token-secreto'), 'el token no se loguea');
    });

    test('respuesta que no es JSON, o error de red → PaymentError', async () => {
      const { createPreference, PaymentError } = fresh();
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } });
      await assert.rejects(createPreference(input), PaymentError);
      fetchImpl = async () => { throw new Error('ECONNRESET'); };
      await assert.rejects(createPreference(input), (e) => e instanceof PaymentError && e.code === 'network');
    });

    test('sin token no intenta nada', async () => {
      delete process.env.MP_ACCESS_TOKEN;
      const { createPreference, PaymentError } = fresh();
      await assert.rejects(createPreference(input), (e) => e instanceof PaymentError && e.code === 'not_configured');
      assert.equal(calls.length, 0);
    });
  });

  describe('getPayment()', () => {
    test('GET a /v1/payments/:id (codificado) con el token; devuelve lo que se usa, con tipos normalizados', async () => {
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({
        id: 987654321, status: 'approved', status_detail: 'accredited', external_reference: 'don-1',
        transaction_amount: 1500, currency_id: 'ARS', live_mode: false, payer: { email: 'no@importa' },
      }) });
      const p = await fresh().getPayment('987654321');
      assert.equal(calls[0].url, 'https://api.mercadopago.com/v1/payments/987654321');
      assert.equal(calls[0].opts.method, 'GET');
      assert.equal(calls[0].opts.headers.Authorization, 'Bearer TEST-1234-token-secreto');
      assert.deepEqual(p, { id: '987654321', status: 'approved', externalReference: 'don-1', amount: 1500, currency: 'ARS' });
    });

    test('el id va codificado en la ruta (no se puede salir de /v1/payments/)', async () => {
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ id: 1, status: 'approved' }) });
      await fresh().getPayment('1/../../users/me');
      assert.equal(calls[0].url, 'https://api.mercadopago.com/v1/payments/1%2F..%2F..%2Fusers%2Fme');
    });

    test('campos ausentes → null (y el monto como número)', async () => {
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ id: 5, transaction_amount: '12.5' }) });
      assert.deepEqual(await fresh().getPayment('5'), { id: '5', status: null, externalReference: null, amount: 12.5, currency: null });
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ id: 5 }) });
      assert.strictEqual((await fresh().getPayment('5')).amount, null, 'sin monto: null, no NaN');
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ id: 5, transaction_amount: 'abc' }) });
      assert.strictEqual((await fresh().getPayment('5')).amount, null);
    });

    test('una respuesta que no es JSON → PaymentError (no un pago con todo en null)', async () => {
      const { getPayment, PaymentError } = fresh();
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } });
      await assert.rejects(getPayment('5'), (e) => e instanceof PaymentError && e.code === 'bad_response');
    });

    test('404 → PaymentError con code not_found; otro error → PaymentError con el estado', async () => {
      const { getPayment, PaymentError } = fresh();
      fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({ message: 'Payment not found' }) });
      await assert.rejects(getPayment('1'), (e) => e instanceof PaymentError && e.code === 'not_found' && e.status === 404);
      fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
      await assert.rejects(getPayment('1'), (e) => e instanceof PaymentError && e.status === 500);
    });

    test('id vacío o que no es texto/número → PaymentError sin llamar a la red', async () => {
      const { getPayment, PaymentError } = fresh();
      for (const id of ['', '   ', undefined, null, {}, []]) await assert.rejects(getPayment(id), PaymentError, String(id));
      assert.equal(calls.length, 0);
    });

    test('sin token no intenta nada', async () => {
      delete process.env.MP_ACCESS_TOKEN;
      const { getPayment, PaymentError } = fresh();
      await assert.rejects(getPayment('1'), (e) => e instanceof PaymentError && e.code === 'not_configured');
      assert.equal(calls.length, 0);
    });
  });

  describe('describePaymentsConfig() (línea del log de arranque)', () => {
    test('nunca muestra el token ni el secreto; dice si es de prueba', () => {
      process.env.MP_WEBHOOK_SECRET = 'SECRETO_RECONOCIBLE';
      const d = fresh().describePaymentsConfig();
      assert.match(d, /prueba/i);
      assert.ok(!d.includes('TEST-1234') && !d.includes('SECRETO_RECONOCIBLE'));
    });
    test('sin token: avisa que no se pueden recibir donaciones; sin secreto, que no se aceptan avisos', () => {
      delete process.env.MP_ACCESS_TOKEN;
      assert.match(fresh().describePaymentsConfig(), /sin configurar/i);
      process.env.MP_ACCESS_TOKEN = 'TEST-x';
      assert.match(fresh().describePaymentsConfig(), /MP_WEBHOOK_SECRET/);
    });
  });
});
