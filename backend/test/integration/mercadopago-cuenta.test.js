// test/integration/mercadopago-cuenta.test.js
//
// Marketplace (PROJECT_ANALYSIS.md §216): la ONG vincula su cuenta de vendedor de Mercado Pago.
//   GET    /api/ngos/me/mercadopago           → { account: null | {...}, oauth_available }
//   POST   /api/ngos/me/mercadopago/connect   → { authorization_url }   (guarda el HASH de un state de un solo uso)
//   POST   /api/ngos/me/mercadopago/callback  { code, state } → { account }  (intercambia el code por los tokens)
//   DELETE /api/ngos/me/mercadopago           → { disconnected }
// Más `linkManually` (scripts/vincular-mp-manual.js): cargar a mano el token del vendedor de PRUEBA, por si no hay
// client_secret (§215).
// Mercado Pago se reemplaza por dobles: estos tests no hablan con nadie.
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { setupTestServer } = require('./helpers');

const ENV = {
  MP_CLIENT_ID: '4252289510479096', MP_CLIENT_SECRET: 'secreto-app-RECONOCIBLE',
  MP_OAUTH_REDIRECT_URI: 'https://voluntariar.example/ngo/mercadopago/vuelta',
  MP_TOKEN_KEY: crypto.randomBytes(32).toString('base64'),
};
const ACCESS = 'APP_USR-access-de-la-ong-RECONOCIBLE';
const REFRESH = 'TG-refresh-de-la-ong-RECONOCIBLE';
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

describe('Cuenta de Mercado Pago de la ONG (Marketplace)', () => {
  let server, baseUrl, db, payments, tokenCrypto, linkManually, inspectToken;
  let ngo1, ngo2, maria;
  let exchanges, exchangeImpl, saved;

  before(async () => {
    saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]]));
    Object.assign(process.env, ENV);
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    payments = require('../../src/lib/payments');
    tokenCrypto = require('../../src/lib/tokenCrypto');
    ({ linkManually, inspectToken } = require('../../scripts/vincular-mp-manual'));
    mock.method(payments, 'exchangeCode', async (code) => { exchanges.push(code); return exchangeImpl(code); });
    ngo1 = await login('admin@sustentando.org');
    ngo2 = await login('admin@greencba.org');
    maria = await login('maria@example.com');
  });
  after(async () => {
    mock.restoreAll();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    if (server) await server.close();
  });
  beforeEach(async () => {
    Object.assign(process.env, ENV);
    exchanges = [];
    exchangeImpl = async () => ({ accessToken: ACCESS, refreshToken: REFRESH, mpUserId: '3772556008', expiresIn: 15552000, liveMode: false });
    await db.run('DELETE FROM ngo_cuentas_mp');
    await db.run('DELETE FROM mp_oauth_states');
  });

  async function login(email) {
    const r = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password1' }),
    });
    assert.equal(r.status, 200, `login ${email}`);
    return (await r.json()).token;
  }
  const api = (path, { token, method = 'GET', body } = {}) => fetch(`${baseUrl}/api/ngos/me/mercadopago${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
  }).then(async (r) => { const text = await r.text(); return { status: r.status, text, body: JSON.parse(text || '{}') }; });
  const connect = async (token = ngo1) => {
    const r = await api('/connect', { token, method: 'POST' });
    assert.equal(r.status, 200, r.text);
    return new URL(r.body.authorization_url).searchParams.get('state');
  };
  const account = (ngoId = 'ngo-1') => db.get('SELECT * FROM ngo_cuentas_mp WHERE ngo_id=$1', [ngoId]);
  const stateCount = async () => Number((await db.get('SELECT COUNT(*) AS n FROM mp_oauth_states')).n);

  describe('migración', () => {
    test('las tablas existen y se pueden consultar en los dos motores', async () => {
      assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM ngo_cuentas_mp')).n), 0);
      assert.equal(await stateCount(), 0);
    });
  });

  describe('acceso', () => {
    test('sin sesión → 401; voluntario o empresa → 403, en los cuatro endpoints', async () => {
      const company = await login('admin@techcorp.com');
      for (const [path, method] of [['', 'GET'], ['/connect', 'POST'], ['/callback', 'POST'], ['', 'DELETE']]) {
        assert.equal((await api(path, { method })).status, 401, `${method} ${path}`);
        assert.equal((await api(path, { token: maria, method, body: {} })).status, 403, `${method} ${path} voluntaria`);
        assert.equal((await api(path, { token: company, method, body: {} })).status, 403, `${method} ${path} empresa`);
      }
      assert.equal(exchanges.length, 0);
    });
  });

  describe('GET /', () => {
    test('sin cuenta: account null y oauth_available según la configuración', async () => {
      assert.deepEqual((await api('', { token: ngo1 })).body, { account: null, oauth_available: true });
      delete process.env.MP_CLIENT_SECRET;
      assert.equal((await api('', { token: ngo1 })).body.oauth_available, false);
      Object.assign(process.env, ENV);
      delete process.env.MP_TOKEN_KEY;
      assert.equal((await api('', { token: ngo1 })).body.oauth_available, false, 'sin clave de cifrado tampoco');
    });
  });

  describe('POST /connect', () => {
    test('devuelve la URL de autorización y guarda SOLO el hash del state, con 10 minutos de vida', async () => {
      const before = Date.now();
      const state = await connect();
      assert.match(state, /^[A-Za-z0-9_-]{43}$/, '32 bytes en base64url');
      const rows = await db.all('SELECT * FROM mp_oauth_states', []);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].state_hash, sha256(state));
      assert.equal(rows[0].ngo_id, 'ngo-1');
      assert.ok(!JSON.stringify(rows).includes(state), 'el state en claro no se guarda');
      const ttl = new Date(rows[0].expires_at).getTime() - before;
      assert.ok(ttl > 9 * 60 * 1000 && ttl <= 10 * 60 * 1000 + 5000, `ttl ${ttl}`);
    });

    test('un connect nuevo invalida el anterior de la misma ONG (a lo sumo un state por ONG), no el de otra', async () => {
      await connect(ngo2);
      const first = await connect();
      const second = await connect();
      assert.notEqual(first, second);
      assert.equal(await stateCount(), 2);
      assert.equal((await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c', state: first } })).status, 400);
      assert.equal((await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c', state: second } })).status, 200);
    });

    test('sin OAuth configurado o sin clave de cifrado → 503 y no guarda nada', async () => {
      for (const k of ['MP_CLIENT_ID', 'MP_TOKEN_KEY']) {
        Object.assign(process.env, ENV);
        delete process.env[k];
        const r = await api('/connect', { token: ngo1, method: 'POST' });
        assert.equal(r.status, 503, k);
        assert.match(r.body.error, /no está disponible/i);
      }
      assert.equal(await stateCount(), 0);
    });
  });

  describe('POST /callback', () => {
    test('intercambia el code, guarda los tokens CIFRADOS y devuelve la cuenta sin tokens', async () => {
      const state = await connect();
      const before = Date.now();
      const r = await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-code-1', state } });
      assert.equal(r.status, 200, r.text);
      assert.deepEqual(exchanges, ['TG-code-1']);
      assert.equal(r.body.account.mp_user_id, '3772556008');
      assert.equal(r.body.account.status, 'active');
      assert.equal(r.body.account.origin, 'oauth');
      const exp = new Date(r.body.account.expires_at).getTime() - before;
      assert.ok(Math.abs(exp - 15552000 * 1000) < 5000, `vence en 180 días (${exp})`);
      assert.ok(!r.text.includes('RECONOCIBLE'), 'la respuesta no trae tokens');

      const row = await account();
      assert.ok(!JSON.stringify(row).includes('RECONOCIBLE'), 'en la base solo está cifrado');
      assert.equal(tokenCrypto.decryptToken(row.access_token_cifrado, 'ngo-1'), ACCESS);
      assert.equal(tokenCrypto.decryptToken(row.refresh_token_cifrado, 'ngo-1'), REFRESH);
      assert.equal(row.estado, 'activa');
      assert.equal(row.origen, 'oauth');
      assert.equal(Number(row.version), 1);
      assert.equal(await stateCount(), 0, 'el state se consumió');

      const g = await api('', { token: ngo1 });
      assert.deepEqual(g.body.account, r.body.account);
      assert.deepEqual((await api('', { token: ngo2 })).body.account, null, 'otra ONG no ve la cuenta');
    });

    test('sin OAuth configurado o sin clave → 503, sin consumir el state ni intercambiar', async () => {
      const state = await connect();
      for (const k of ['MP_CLIENT_SECRET', 'MP_TOKEN_KEY']) {
        Object.assign(process.env, ENV);
        delete process.env[k];
        assert.equal((await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c', state } })).status, 503, k);
      }
      assert.equal(exchanges.length, 0);
      assert.equal(await stateCount(), 1);
    });

    test('el state es de un solo uso', async () => {
      const state = await connect();
      assert.equal((await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c', state } })).status, 200);
      const again = await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c', state } });
      assert.equal(again.status, 400);
      assert.equal(exchanges.length, 1);
    });

    test('dos vueltas simultáneas con el mismo state: un solo intercambio', async () => {
      const state = await connect();
      let release;
      const gate = new Promise((r) => { release = r; });
      exchangeImpl = async () => { await gate; return { accessToken: ACCESS, refreshToken: REFRESH, mpUserId: '3772556008', expiresIn: 100, liveMode: false }; };
      const a = api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c', state } });
      const b = api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c', state } });
      setTimeout(release, 200);
      const statuses = (await Promise.all([a, b])).map((r) => r.status).sort();
      assert.deepEqual(statuses, [200, 400]);
      assert.equal(exchanges.length, 1);
    });

    test('el state de OTRA ONG → 400, sin intercambiar ni consumirlo (la dueña lo sigue pudiendo usar)', async () => {
      const state = await connect(ngo1);
      const r = await api('/callback', { token: ngo2, method: 'POST', body: { code: 'TG-c', state } });
      assert.equal(r.status, 400);
      assert.equal(exchanges.length, 0);
      assert.equal(await account('ngo-2'), undefined);
      assert.equal((await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c', state } })).status, 200);
    });

    test('state vencido → 400 y se borra; state desconocido → 400; sin code o sin state → 400 (sin intercambiar)', async () => {
      const state = await connect();
      await db.run('UPDATE mp_oauth_states SET expires_at=$1', [new Date(Date.now() - 1000).toISOString()]);
      const r = await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c', state } });
      assert.equal(r.status, 400);
      assert.match(r.body.error, /venció/i);
      assert.equal(await stateCount(), 0);
      assert.equal((await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c', state: 'no-existe' } })).status, 400);
      const fresh = await connect();
      for (const body of [{ state: fresh }, { code: 'TG-c' }, { code: '', state: fresh }, { code: 5, state: fresh },
        { code: 'TG-c', state: ['x'] }, { code: 'x'.repeat(501), state: fresh }]) {
        assert.equal((await api('/callback', { token: ngo1, method: 'POST', body })).status, 400, JSON.stringify(body).slice(0, 60));
      }
      assert.equal(exchanges.length, 0);
    });

    test('errores del intercambio: invalid_grant y live_token → 400, otro → 502; no guarda nada y el state queda usado', async () => {
      const cases = [['invalid_grant', 400, /venció|ya se usó/i], ['live_token', 400, /prueba/i], ['http', 502, /Mercado Pago/], ['network', 502, /Mercado Pago/]];
      for (const [code, status, msg] of cases) {
        exchangeImpl = async () => { throw new payments.PaymentError(`detalle interno ${REFRESH}`, { code }); };
        const state = await connect();
        const r = await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c', state } });
        assert.equal(r.status, status, code);
        assert.match(r.body.error, msg, code);
        assert.ok(!r.text.includes('RECONOCIBLE') && !r.text.includes('detalle interno'), 'no filtra el detalle');
        assert.equal(await account(), undefined);
        assert.equal(await stateCount(), 0);
      }
    });

    test('la misma cuenta de Mercado Pago ya vinculada a OTRA ONG → 409 y no cambia nada', async () => {
      assert.equal((await api('/callback', { token: ngo2, method: 'POST', body: { code: 'TG-c', state: await connect(ngo2) } })).status, 200);
      const r = await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c', state: await connect(ngo1) } });
      assert.equal(r.status, 409);
      assert.match(r.body.error, /otra ONG/i);
      assert.equal(await account('ngo-1'), undefined);
      assert.equal((await account('ngo-2')).mp_user_id, '3772556008');
    });

    test('volver a vincular la misma ONG reemplaza los tokens, sube la versión y la deja activa', async () => {
      await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c', state: await connect() } });
      await db.run(`UPDATE ngo_cuentas_mp SET estado='requiere_reconexion' WHERE ngo_id='ngo-1'`);
      exchangeImpl = async () => ({ accessToken: 'APP_USR-nuevo', refreshToken: 'TG-nuevo', mpUserId: '3772556999', expiresIn: 100, liveMode: false });
      const r = await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c2', state: await connect() } });
      assert.equal(r.status, 200);
      assert.equal(r.body.account.mp_user_id, '3772556999');
      const row = await account();
      assert.equal(tokenCrypto.decryptToken(row.access_token_cifrado, 'ngo-1'), 'APP_USR-nuevo');
      assert.equal(row.estado, 'activa');
      assert.equal(Number(row.version), 2);
      assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM ngo_cuentas_mp')).n), 1);
    });

    test('ningún token ni el secreto llegan a los logs', async () => {
      const lines = [];
      for (const m of ['log', 'warn', 'error']) mock.method(console, m, (...a) => lines.push(a.join(' ')));
      try {
        await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-code-LOG', state: await connect() } });
        exchangeImpl = async () => { throw new payments.PaymentError(`boom ${REFRESH}`, { code: 'http' }); };
        await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-code-LOG', state: await connect() } });
      } finally {
        for (const m of ['log', 'warn', 'error']) console[m].mock.restore();
      }
      const all = lines.join('\n');
      assert.ok(!all.includes('RECONOCIBLE') && !all.includes('TG-code-LOG'), all);
    });
  });

  describe('DELETE /', () => {
    test('borra la cuenta (y sus tokens); repetirlo responde disconnected: false', async () => {
      await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c', state: await connect() } });
      await api('/callback', { token: ngo2, method: 'POST', body: { code: 'TG-c', state: await connect(ngo2) } }).catch(() => {});
      const r = await api('', { token: ngo1, method: 'DELETE' });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { disconnected: true });
      assert.equal(await account(), undefined);
      assert.deepEqual((await api('', { token: ngo1, method: 'DELETE' })).body, { disconnected: false });
    });
    test('una ONG no puede desvincular la cuenta de otra', async () => {
      await api('/callback', { token: ngo1, method: 'POST', body: { code: 'TG-c', state: await connect() } });
      assert.deepEqual((await api('', { token: ngo2, method: 'DELETE' })).body, { disconnected: false });
      assert.ok(await account('ngo-1'));
    });
  });

  describe('linkManually (scripts/vincular-mp-manual.js)', () => {
    const testUser = async () => ({ id: '3772556008', nickname: 'TESTUSER123', tags: ['normal', 'test_user'] });

    test('guarda el token cifrado, sin refresh ni vencimiento, origen manual', async () => {
      const r = await linkManually({ ngoId: 'ngo-1', accessToken: ACCESS, getUser: testUser });
      assert.equal(r.mpUserId, '3772556008');
      const row = await account();
      assert.equal(tokenCrypto.decryptToken(row.access_token_cifrado, 'ngo-1'), ACCESS);
      assert.equal(row.refresh_token_cifrado, null);
      assert.equal(row.expires_at, null);
      assert.equal(row.origen, 'manual');
      assert.equal((await api('', { token: ngo1 })).body.account.origin, 'manual');
    });

    test('rechaza un usuario que no es de prueba, una ONG inexistente, un token vacío o una cuenta de otra ONG', async () => {
      await assert.rejects(linkManually({ ngoId: 'ngo-1', accessToken: ACCESS, getUser: async () => ({ id: '1', tags: ['normal'] }) }), /prueba/i);
      await assert.rejects(linkManually({ ngoId: 'ngo-1', accessToken: ACCESS, getUser: async () => ({ id: '1' }) }), /prueba/i);
      await assert.rejects(linkManually({ ngoId: 'ngo-nada', accessToken: ACCESS, getUser: testUser }), /ONG/);
      let asked = 0;
      await assert.rejects(linkManually({ ngoId: 'ngo-1', accessToken: '  ', getUser: async () => { asked++; return testUser(); } }), /token/i);
      assert.equal(asked, 0, 'con un token vacío no le pregunta nada a Mercado Pago');
      assert.equal(await account(), undefined);
      await linkManually({ ngoId: 'ngo-2', accessToken: ACCESS, getUser: testUser });
      await assert.rejects(linkManually({ ngoId: 'ngo-1', accessToken: ACCESS, getUser: testUser }), /otra ONG/i);
    });

    // §221: --solo-ver. La IA de Mercado Pago dice que el token de prueba sale del panel de la aplicación, y en §181 ese
    // era de una cuenta oculta (3771872304), no del vendedor de la ONG: antes de vincular hay que poder ver DE QUIÉN es.
    test('inspectToken: dice de quién es el token y si es de prueba, sin guardar nada', async () => {
      assert.deepEqual(await inspectToken({ accessToken: ` ${ACCESS} `, getUser: testUser }),
        { mpUserId: '3772556008', nickname: 'TESTUSER123', tags: ['normal', 'test_user'], isTestUser: true });
      let seen;
      assert.deepEqual(await inspectToken({ accessToken: ` ${ACCESS} `, getUser: async (t) => { seen = t; return { id: 9 }; } }),
        { mpUserId: '9', nickname: null, tags: [], isTestUser: false }, 'sin nickname ni tags');
      assert.equal(seen, ACCESS, 'el token va sin espacios');
      assert.equal(await account(), undefined);
      let asked = 0;
      await assert.rejects(inspectToken({ accessToken: '', getUser: async () => { asked++; return testUser(); } }), /token/i);
      assert.equal(asked, 0);
    });

    test('pide el usuario con el token que se va a guardar', async () => {
      let seen;
      await linkManually({ ngoId: 'ngo-1', accessToken: ` ${ACCESS} `, getUser: async (t) => { seen = t; return testUser(); } });
      assert.equal(seen, ACCESS);
    });
  });
});
