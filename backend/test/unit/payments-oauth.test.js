// test/unit/payments-oauth.test.js
//
// lib/payments.js, parte Marketplace (PROJECT_ANALYSIS.md §215): la ONG vincula su cuenta de vendedor por OAuth y
// las preferencias se crean con SU token. `fetch` se reemplaza por un doble: NO se habla con Mercado Pago.
//
// De dónde sale cada cosa:
//   - URL de autorización `https://auth.mercadopago.com/authorization` con client_id, response_type=code,
//     platform_id=mp, state y redirect_uri: SDK oficial `mercadopago@3.6.1` (OAuth.getAuthorizationURL), §181;
//     validada en vivo en §181 (el vendedor de prueba devolvió el code).
//   - `POST /oauth/token` con client_id, client_secret, grant_type=authorization_code, code, redirect_uri y
//     test_token=true: SDK (OAuth.create) + documentación "Obtener Access Token" + la IA de Mercado Pago (2026-10-18).
//   - renovación con grant_type=refresh_token, SIN test_token, y el refresh_token cambia en cada renovación:
//     documentación "Renovar Access Token" según la IA de Mercado Pago (2026-10-18). NO verificado en vivo.
//   - la respuesta: access_token, refresh_token, user_id, expires_in, public_key, live_mode (SDK, §181).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const ENV_KEYS = ['MP_ACCESS_TOKEN', 'MP_CLIENT_ID', 'MP_CLIENT_SECRET', 'MP_OAUTH_REDIRECT_URI'];
const fresh = () => {
  delete require.cache[require.resolve('../../src/lib/payments')];
  return require('../../src/lib/payments');
};
const CLIENT_SECRET = 'secreto-de-la-app-RECONOCIBLE';
const REDIRECT = 'https://voluntariar.example/ngo/mercadopago/vuelta';
const tokenBody = (over = {}) => ({
  access_token: 'APP_USR-ong-access', refresh_token: 'TG-ong-refresh', user_id: 3772556008, expires_in: 15552000,
  public_key: 'APP_USR-pk', live_mode: false, token_type: 'bearer', scope: 'offline_access read write', ...over,
});

describe('payments: OAuth del Marketplace', () => {
  let saved, calls, fetchImpl;
  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.MP_ACCESS_TOKEN = 'APP_USR-token-de-la-app';
    process.env.MP_CLIENT_ID = '4252289510479096';
    process.env.MP_CLIENT_SECRET = CLIENT_SECRET;
    process.env.MP_OAUTH_REDIRECT_URI = REDIRECT;
    calls = [];
    fetchImpl = async () => ({ ok: true, status: 200, json: async () => tokenBody() });
    mock.method(globalThis, 'fetch', async (url, opts) => { calls.push({ url, opts }); return fetchImpl(); });
    mock.method(console, 'error', () => {});
  });
  afterEach(() => {
    mock.restoreAll();
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });
  const logged = () => console.error.mock.calls.map((c) => c.arguments.join(' ')).join('\n');

  describe('isOAuthConfigured()', () => {
    test('true solo con client_id, client_secret y redirect_uri (sin espacios sueltos)', () => {
      assert.equal(fresh().isOAuthConfigured(), true);
      for (const k of ['MP_CLIENT_ID', 'MP_CLIENT_SECRET', 'MP_OAUTH_REDIRECT_URI']) {
        const v = process.env[k];
        process.env[k] = '  ';
        assert.equal(fresh().isOAuthConfigured(), false, k);
        process.env[k] = v;
      }
    });
    test('no depende de MP_ACCESS_TOKEN', () => {
      delete process.env.MP_ACCESS_TOKEN;
      assert.equal(fresh().isOAuthConfigured(), true);
    });
  });

  describe('authorizationUrl()', () => {
    test('la URL de §181, con los parámetros codificados', () => {
      const u = new URL(fresh().authorizationUrl('st/at+e'));
      assert.equal(u.origin + u.pathname, 'https://auth.mercadopago.com/authorization');
      assert.deepEqual(Object.fromEntries(u.searchParams), {
        client_id: '4252289510479096', response_type: 'code', platform_id: 'mp', state: 'st/at+e', redirect_uri: REDIRECT,
      });
      assert.ok(!u.href.includes(CLIENT_SECRET), 'el secreto nunca va en la URL');
    });
    test('sin configurar o sin state → PaymentError sin armar nada', () => {
      const { authorizationUrl, PaymentError } = fresh();
      assert.throws(() => authorizationUrl(''), PaymentError);
      delete process.env.MP_CLIENT_ID;
      assert.throws(() => fresh().authorizationUrl('s'), (e) => e.code === 'not_configured');
    });
  });

  describe('exchangeCode()', () => {
    test('POST /oauth/token en JSON con test_token=true y SIN el access token de la app', async () => {
      await fresh().exchangeCode('TG-code-3772556008');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, 'https://api.mercadopago.com/oauth/token');
      assert.equal(calls[0].opts.method, 'POST');
      assert.equal(calls[0].opts.headers['Content-Type'], 'application/json');
      assert.equal(calls[0].opts.headers.Authorization, undefined);
      assert.deepEqual(JSON.parse(calls[0].opts.body), {
        client_id: '4252289510479096', client_secret: CLIENT_SECRET, grant_type: 'authorization_code',
        code: 'TG-code-3772556008', redirect_uri: REDIRECT, test_token: true,
      });
    });

    test('devuelve los tokens normalizados (user_id como texto, expires_in como número)', async () => {
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => tokenBody({ expires_in: '15552000' }) });
      assert.deepEqual(await fresh().exchangeCode('TG-c'), {
        accessToken: 'APP_USR-ong-access', refreshToken: 'TG-ong-refresh', mpUserId: '3772556008', expiresIn: 15552000, liveMode: false,
      });
    });

    test('un token productivo (live_mode true) se rechaza: todo es modo prueba', async () => {
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => tokenBody({ live_mode: true }) });
      await assert.rejects(fresh().exchangeCode('TG-c'), (e) => e.code === 'live_token');
    });

    test('live_mode ausente o que no es booleano → se trata como productivo (no se adivina)', async () => {
      for (const live of [undefined, 'false', 0]) {
        fetchImpl = async () => ({ ok: true, status: 200, json: async () => tokenBody({ live_mode: live }) });
        await assert.rejects(fresh().exchangeCode('TG-c'), (e) => e.code === 'live_token', String(live));
      }
    });

    test('respuesta incompleta → bad_response', async () => {
      for (const over of [{ access_token: '' }, { refresh_token: undefined }, { user_id: null }, { user_id: 'abc' },
        { expires_in: 0 }, { expires_in: 'x' }, { access_token: 5 }]) {
        fetchImpl = async () => ({ ok: true, status: 200, json: async () => tokenBody(over) });
        await assert.rejects(fresh().exchangeCode('TG-c'), (e) => e.code === 'bad_response', JSON.stringify(over));
      }
    });

    test('400 invalid_grant → code invalid_grant; el mensaje no trae el secreto, el code ni el cuerpo', async () => {
      fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({
        error: 'invalid_grant', message: `invalid code TG-code-secreto ${CLIENT_SECRET}`, status: 400,
      }) });
      await assert.rejects(fresh().exchangeCode('TG-code-secreto'), (e) => e.code === 'invalid_grant' && e.status === 400
        && !e.message.includes('TG-code-secreto') && !e.message.includes(CLIENT_SECRET));
      assert.ok(!logged().includes(CLIENT_SECRET) && !logged().includes('TG-code-secreto'));
    });

    test('otro error HTTP → PaymentError http con el estado; un "error" con forma rara no entra al mensaje', async () => {
      fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({ error: 'x\ny <script>' }) });
      await assert.rejects(fresh().exchangeCode('TG-c'), (e) => e.code === 'http' && e.status === 500 && !e.message.includes('<script>'));
    });

    test('error de red o respuesta no JSON → PaymentError', async () => {
      fetchImpl = async () => { throw new Error('ECONNRESET'); };
      await assert.rejects(fresh().exchangeCode('TG-c'), (e) => e.code === 'network');
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } });
      await assert.rejects(fresh().exchangeCode('TG-c'), (e) => e.code === 'bad_response');
    });

    test('sin configurar o sin code → no llama a la red', async () => {
      await assert.rejects(fresh().exchangeCode(''), (e) => e.code === 'bad_request');
      await assert.rejects(fresh().exchangeCode(42), (e) => e.code === 'bad_request');
      delete process.env.MP_CLIENT_SECRET;
      await assert.rejects(fresh().exchangeCode('TG-c'), (e) => e.code === 'not_configured');
      assert.equal(calls.length, 0);
    });
  });

  describe('refreshAccessToken()', () => {
    test('POST /oauth/token con grant_type=refresh_token, sin test_token ni redirect_uri', async () => {
      await fresh().refreshAccessToken('TG-ong-refresh');
      assert.equal(calls[0].url, 'https://api.mercadopago.com/oauth/token');
      assert.equal(calls[0].opts.headers.Authorization, undefined);
      assert.deepEqual(JSON.parse(calls[0].opts.body), {
        client_id: '4252289510479096', client_secret: CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: 'TG-ong-refresh',
      });
    });
    test('devuelve el refresh token NUEVO y rechaza uno productivo', async () => {
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => tokenBody({ access_token: 'APP_USR-nuevo', refresh_token: 'TG-nuevo' }) });
      const t = await fresh().refreshAccessToken('TG-viejo');
      assert.equal(t.accessToken, 'APP_USR-nuevo');
      assert.equal(t.refreshToken, 'TG-nuevo');
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => tokenBody({ live_mode: true }) });
      await assert.rejects(fresh().refreshAccessToken('TG-viejo'), (e) => e.code === 'live_token');
    });
    test('invalid_grant → code invalid_grant (la ONG tiene que volver a vincular)', async () => {
      fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) });
      await assert.rejects(fresh().refreshAccessToken('TG-viejo'), (e) => e.code === 'invalid_grant');
    });
    test('sin refresh token o sin configurar → no llama a la red', async () => {
      await assert.rejects(fresh().refreshAccessToken(''), (e) => e.code === 'bad_request');
      delete process.env.MP_CLIENT_SECRET;
      await assert.rejects(fresh().refreshAccessToken('TG-viejo'), (e) => e.code === 'not_configured');
      assert.equal(calls.length, 0);
    });
  });

  // Para la carga manual (scripts/vincular-mp-manual.js, §216). `GET /users/me` y el tag `test_user` de los usuarios de
  // prueba: NO verificado contra Mercado Pago (conocimiento general de la API).
  describe('getSellerUser()', () => {
    test('GET /users/me con el token dado; devuelve id (texto), nickname y tags', async () => {
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ id: 3772556008, nickname: 'TESTUSER1', tags: ['normal', 'test_user'], email: 'x' }) });
      assert.deepEqual(await fresh().getSellerUser('APP_USR-ong'), { id: '3772556008', nickname: 'TESTUSER1', tags: ['normal', 'test_user'] });
      assert.equal(calls[0].url, 'https://api.mercadopago.com/users/me');
      assert.equal(calls[0].opts.headers.Authorization, 'Bearer APP_USR-ong');
    });
    test('sin tags o sin nickname → [] y null; sin id → bad_response; sin token → no llama', async () => {
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ id: 5, tags: 'raro' }) });
      assert.deepEqual(await fresh().getSellerUser('t'), { id: '5', nickname: null, tags: [] });
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({}) });
      await assert.rejects(fresh().getSellerUser('t'), (e) => e.code === 'bad_response');
      const n = calls.length;
      await assert.rejects(fresh().getSellerUser(''), (e) => e.code === 'bad_request');
      assert.equal(calls.length, n);
    });
  });

  describe('createPreference() / getPayment() con el token de la ONG', () => {
    const input = { donationId: 'don-1', title: 'Donación: X', amount: 1500, successUrl: 'https://app/donaciones/vuelta' };
    const pref = { id: 'pref-1', init_point: 'https://mp/init', sandbox_init_point: 'https://mp/sandbox' };

    test('createPreference usa el accessToken que se le pasa, no MP_ACCESS_TOKEN, y no manda marketplace_fee', async () => {
      fetchImpl = async () => ({ ok: true, status: 201, json: async () => pref });
      const r = await fresh().createPreference({ ...input, accessToken: 'APP_USR-ong-access' });
      assert.equal(calls[0].opts.headers.Authorization, 'Bearer APP_USR-ong-access');
      assert.equal('marketplace_fee' in JSON.parse(calls[0].opts.body), false);
      assert.equal(r.checkoutUrl, 'https://mp/init');
    });
    test('el link de sandbox depende del token usado (TEST- de la ONG)', async () => {
      fetchImpl = async () => ({ ok: true, status: 201, json: async () => pref });
      assert.equal((await fresh().createPreference({ ...input, accessToken: 'TEST-ong' })).checkoutUrl, 'https://mp/sandbox');
    });
    test('con el token de la ONG no hace falta MP_ACCESS_TOKEN', async () => {
      delete process.env.MP_ACCESS_TOKEN;
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ id: 9, status: 'approved' }) });
      await fresh().getPayment('9', { accessToken: 'APP_USR-ong-access' });
      assert.equal(calls[0].opts.headers.Authorization, 'Bearer APP_USR-ong-access');
    });
    test('401 con el token de la ONG → code unauthorized, sin culpar a MP_ACCESS_TOKEN en el log', async () => {
      fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({ message: 'invalid access token' }) });
      await assert.rejects(fresh().getPayment('9', { accessToken: 'APP_USR-ong-access' }), (e) => e.code === 'unauthorized');
      assert.ok(!logged().includes('MP_ACCESS_TOKEN') && !logged().includes('APP_USR-ong-access'));
    });
  });
});
