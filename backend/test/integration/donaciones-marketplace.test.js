// test/integration/donaciones-marketplace.test.js
//
// Marketplace (PROJECT_ANALYSIS.md §217): la donación se cobra con el token de la ONG dueña del proyecto, así la
// plata se acredita en SU cuenta de Mercado Pago. Sin cuenta vinculada, la ONG no recibe donaciones (decisión del
// usuario). El token se renueva solo cuando faltan menos de 7 días para que venza.
// Mercado Pago se reemplaza por dobles (createPreference, getPayment, refreshAccessToken); el cifrado es el real.
//
// Seed: proj-1 (ngo-1, Sustentando) y proj-2 (ngo-2, Green Córdoba), activos. maria es voluntaria.
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { setupTestServer } = require('./helpers');

const SECRET = 'secreto-webhook-marketplace';
const KEY = crypto.randomBytes(32).toString('base64');
const DAY = 24 * 60 * 60 * 1000;
const SELLER = '3772556008';
const sign = (dataId, requestId, ts = '1704908010') =>
  `ts=${ts},v1=${crypto.createHmac('sha256', SECRET).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex')}`;

describe('Donaciones con la cuenta de la ONG (Marketplace)', () => {
  let server, baseUrl, db, payments, sellerAccounts, tokenCrypto, donaciones;
  let maria;
  let prefs, lookups, refreshes, refreshImpl, payment, prefImpl, saved;

  before(async () => {
    saved = { MP_TOKEN_KEY: process.env.MP_TOKEN_KEY, MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET };
    process.env.MP_TOKEN_KEY = KEY;
    process.env.MP_WEBHOOK_SECRET = SECRET;
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    payments = require('../../src/lib/payments');
    sellerAccounts = require('../../src/lib/sellerAccounts');
    tokenCrypto = require('../../src/lib/tokenCrypto');
    donaciones = require('../../src/routes/donaciones');
    let n = 0;
    mock.method(payments, 'isConfigured', () => true);
    mock.method(payments, 'createPreference', async (input) => {
      prefs.push(input);
      if (prefImpl) return prefImpl(input);
      n += 1;
      return { preferenceId: `pref-mk-${n}`, checkoutUrl: `https://mp/checkout?pref_id=pref-mk-${n}` };
    });
    mock.method(payments, 'getPayment', async (id, opts = {}) => {
      lookups.push({ id: String(id), accessToken: opts.accessToken });
      return { id: String(id), ...(typeof payment === 'function' ? payment(id, opts) : payment) };
    });
    mock.method(payments, 'refreshAccessToken', async (t) => { refreshes.push(t); return refreshImpl(t); });
    const r = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'maria@example.com', password: 'Password1' }),
    });
    maria = { ...(await r.json()) };
  });
  after(async () => {
    mock.restoreAll();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    if (server) await server.close();
  });
  beforeEach(async () => {
    process.env.MP_TOKEN_KEY = KEY;
    prefs = []; lookups = []; refreshes = []; payment = null; prefImpl = null;
    refreshImpl = async () => ({ accessToken: 'APP_USR-renovado', refreshToken: 'TG-renovado', mpUserId: SELLER, expiresIn: 180 * 86400, liveMode: false });
    donaciones.donationLimiter.reset(maria.user.id);   // tope de 10 donaciones por hora y usuario
    await db.run('DELETE FROM ngo_cuentas_mp');
    await db.run('DELETE FROM donaciones');
    await db.run(`DELETE FROM notifications WHERE type='mp_reconnect_needed'`);
    await db.run(`UPDATE projects SET recaudado=0, status='active' WHERE id IN ('proj-1','proj-2')`);
  });

  // Vincula ngo-1 con un token que vence en `days` días (null = manual, sin vencimiento).
  const link = async ({ days = 100, ngoId = 'ngo-1', mpUserId = SELLER, access = 'APP_USR-ong1', refresh = 'TG-ong1' } = {}) => {
    const origin = days === null ? 'manual' : 'oauth';
    await sellerAccounts.saveAccount(ngoId, {
      accessToken: access, refreshToken: days === null ? null : refresh, mpUserId, expiresIn: days === null ? null : days * 86400,
    }, origin);
  };
  const account = (ngoId = 'ngo-1') => db.get('SELECT * FROM ngo_cuentas_mp WHERE ngo_id=$1', [ngoId]);
  const donate = (body = { project_id: 'proj-1', amount: 1500 }) => fetch(`${baseUrl}/api/donaciones`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${maria.token}` }, body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const getDonation = (id, q = '') => fetch(`${baseUrl}/api/donaciones/${id}${q}`, { headers: { Authorization: `Bearer ${maria.token}` } })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const donation = (id) => db.get('SELECT * FROM donaciones WHERE id=$1', [id]);
  const count = async () => Number((await db.get('SELECT COUNT(*) AS n FROM donaciones')).n);
  const reconnectNotices = async () => Number((await db.get(
    `SELECT COUNT(*) AS n FROM notifications WHERE user_id='user-ngo-1' AND type='mp_reconnect_needed'`)).n);
  const insertDonation = async (cobrador, id = `don-mk-${crypto.randomUUID()}`) => {
    await db.run(`INSERT INTO donaciones (id, user_id, project_id, ngo_id, monto, estado, moneda, cobrador_mp_user_id)
                  VALUES ($1,$2,'proj-1','ngo-1',1500,'pendiente','ARS',$3)`, [id, maria.user.id, cobrador]);
    return id;
  };
  const approved = (ref) => ({ status: 'approved', externalReference: ref, amount: 1500, currency: 'ARS' });

  describe('POST /api/donaciones', () => {
    test('ONG sin cuenta vinculada → 409 "todavía no recibe donaciones", sin crear nada ni llamar a Mercado Pago', async () => {
      const before = await count();
      const r = await donate();
      assert.equal(r.status, 409);
      assert.equal(r.body.error, 'Esta ONG todavía no recibe donaciones');
      assert.equal(await count(), before);
      assert.equal(prefs.length, 0);
    });

    test('ONG vinculada: la preferencia se crea con SU token y la donación guarda a qué cuenta se cobró', async () => {
      await link();
      const r = await donate();
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(prefs[0].accessToken, 'APP_USR-ong1');
      const d = await donation(r.body.donation_id);
      assert.equal(d.cobrador_mp_user_id, SELLER);
      assert.equal(d.estado, 'pendiente');
      assert.equal(refreshes.length, 0, 'con 100 días por delante no renueva');
    });

    test('cada ONG cobra con su propia cuenta', async () => {
      await link();
      await link({ ngoId: 'ngo-2', mpUserId: '999', access: 'APP_USR-ong2' });
      await donate({ project_id: 'proj-2', amount: 1500 });
      assert.equal(prefs[0].accessToken, 'APP_USR-ong2');
    });

    test('cuenta manual (sin vencimiento ni refresh): usa el token tal cual', async () => {
      await link({ days: null });
      assert.equal((await donate()).status, 201);
      assert.equal(prefs[0].accessToken, 'APP_USR-ong1');
      assert.equal(refreshes.length, 0);
    });

    test('cuenta que requiere reconexión, o sin MP_TOKEN_KEY → 503, sin crear nada', async () => {
      await link();
      await db.run(`UPDATE ngo_cuentas_mp SET estado='requiere_reconexion'`);
      const before = await count();
      const r = await donate();
      assert.equal(r.status, 503);
      assert.equal(r.body.error, 'Esta ONG no puede recibir donaciones en este momento');
      await db.run(`UPDATE ngo_cuentas_mp SET estado='activa'`);
      delete process.env.MP_TOKEN_KEY;
      assert.equal((await donate()).status, 503);
      assert.equal(await count(), before);
      assert.equal(prefs.length, 0);
      assert.equal((await account()).estado, 'activa', 'falta configuración: no es culpa de la cuenta, no se marca');
      assert.equal(await reconnectNotices(), 0);
    });

    test('un token que no se puede descifrar (otra clave) → la cuenta pasa a requerir reconexión y 503', async () => {
      await link();
      process.env.MP_TOKEN_KEY = crypto.randomBytes(32).toString('base64');
      assert.equal((await donate()).status, 503);
      assert.equal((await account()).estado, 'requiere_reconexion');
      assert.equal(await reconnectNotices(), 1);
    });

    test('Mercado Pago rechaza el token de la ONG (401) → la cuenta pasa a requerir reconexión, la donación queda fallida y 503', async () => {
      await link();
      prefImpl = async () => { throw new payments.PaymentError('Mercado Pago respondió 401', { status: 401, code: 'unauthorized' }); };
      const r = await donate();
      assert.equal(r.status, 503);
      assert.equal((await account()).estado, 'requiere_reconexion');
      assert.equal(await reconnectNotices(), 1);
      const rows = await db.all('SELECT estado FROM donaciones', []);   // el beforeEach vacía la tabla: es la única
      assert.deepEqual(rows.map((d) => d.estado), ['fallida']);
    });

    test('otro error al crear la preferencia → 502 y la cuenta sigue activa', async () => {
      await link();
      prefImpl = async () => { throw new payments.PaymentError('boom', { status: 500, code: 'http' }); };
      assert.equal((await donate()).status, 502);
      assert.equal((await account()).estado, 'activa');
    });
  });

  describe('renovación del token', () => {
    test('faltan menos de 7 días: renueva con el refresh token guardado, guarda los NUEVOS cifrados y usa el nuevo', async () => {
      await link({ days: 6 });
      const v = Number((await account()).version);
      const before = Date.now();
      assert.equal((await donate()).status, 201);
      assert.deepEqual(refreshes, ['TG-ong1']);
      assert.equal(prefs[0].accessToken, 'APP_USR-renovado');
      const row = await account();
      assert.equal(tokenCrypto.decryptToken(row.access_token_cifrado, 'ngo-1'), 'APP_USR-renovado');
      assert.equal(tokenCrypto.decryptToken(row.refresh_token_cifrado, 'ngo-1'), 'TG-renovado');
      assert.equal(Number(row.version), v + 1);
      assert.ok(new Date(row.expires_at).getTime() - before > 179 * DAY);
      assert.ok(!JSON.stringify(row).includes('renovado'), 'cifrados');
    });

    test('con 8 días por delante todavía no renueva', async () => {
      await link({ days: 8 });
      await donate();
      assert.equal(refreshes.length, 0);
    });

    test('ya vencido: renueva igual', async () => {
      await link({ days: 1 });
      await db.run('UPDATE ngo_cuentas_mp SET expires_at=$1', [new Date(Date.now() - DAY).toISOString()]);
      assert.equal((await donate()).status, 201);
      assert.equal(prefs[0].accessToken, 'APP_USR-renovado');
    });

    test('invalid_grant → requiere reconexión, aviso a la ONG (una vez) y 503', async () => {
      await link({ days: 2 });
      refreshImpl = async () => { throw new payments.PaymentError('x', { status: 400, code: 'invalid_grant' }); };
      assert.equal((await donate()).status, 503);
      assert.equal((await account()).estado, 'requiere_reconexion');
      assert.equal(await reconnectNotices(), 1);
      assert.equal((await donate()).status, 503);
      assert.equal(refreshes.length, 1, 'ya marcada, no vuelve a intentar');
      assert.equal(await reconnectNotices(), 1);
    });

    test('la renovación devuelve un token productivo (live_token) → requiere reconexión y 503', async () => {
      await link({ days: 2 });
      refreshImpl = async () => { throw new payments.PaymentError('x', { code: 'live_token' }); };
      assert.equal((await donate()).status, 503);
      assert.equal((await account()).estado, 'requiere_reconexion');
    });

    test('el refresh token guardado no se descifra (el access sí) → requiere reconexión, sin llamar a Mercado Pago', async () => {
      await link({ days: 2 });
      await db.run('UPDATE ngo_cuentas_mp SET refresh_token_cifrado=$1', [tokenCrypto.encryptToken('TG-x', 'ngo-2')]);
      assert.equal((await donate()).status, 503);
      assert.equal(refreshes.length, 0);
      assert.equal((await account()).estado, 'requiere_reconexion');
    });

    test('error transitorio y el token todavía vale → lo usa; ya vencido → 503 y la cuenta sigue activa', async () => {
      await link({ days: 3 });
      refreshImpl = async () => { throw new payments.PaymentError('red', { code: 'network' }); };
      assert.equal((await donate()).status, 201);
      assert.equal(prefs[0].accessToken, 'APP_USR-ong1');
      await db.run('UPDATE ngo_cuentas_mp SET expires_at=$1', [new Date(Date.now() - 1000).toISOString()]);
      assert.equal((await donate()).status, 503);
      assert.equal((await account()).estado, 'activa');
    });

    test('dos donaciones a la vez con el token por vencer: una sola renovación (el refresh token cambia en cada una)', async () => {
      await link({ days: 1 });
      let release;
      const gate = new Promise((r) => { release = r; });
      const inner = refreshImpl;
      refreshImpl = async (t) => { await gate; return inner(t); };
      const a = donate(); const b = donate();
      setTimeout(release, 150);
      const statuses = (await Promise.all([a, b])).map((r) => r.status);
      assert.deepEqual(statuses, [201, 201]);
      assert.equal(refreshes.length, 1);
      assert.deepEqual(prefs.map((p) => p.accessToken), ['APP_USR-renovado', 'APP_USR-renovado']);
    });

    test('otro proceso renovó mientras tanto (cambió la versión) → no pisa sus tokens y usa los de él', async () => {
      await link({ days: 1 });
      refreshImpl = async () => {
        // Simula a otra instancia que renovó primero: tokens nuevos y versión + 1.
        await db.run('UPDATE ngo_cuentas_mp SET access_token_cifrado=$1, version=version+1, expires_at=$2',
          [tokenCrypto.encryptToken('APP_USR-del-otro', 'ngo-1'), new Date(Date.now() + 100 * DAY).toISOString()]);
        return { accessToken: 'APP_USR-mio', refreshToken: 'TG-mio', mpUserId: SELLER, expiresIn: 100, liveMode: false };
      };
      assert.equal((await donate()).status, 201);
      assert.equal(prefs[0].accessToken, 'APP_USR-del-otro');
      assert.equal(tokenCrypto.decryptToken((await account()).access_token_cifrado, 'ngo-1'), 'APP_USR-del-otro');
    });

    test('invalid_grant porque otro proceso ya usó el refresh token → no la marca: usa el token nuevo', async () => {
      await link({ days: 1 });
      refreshImpl = async () => {
        await db.run('UPDATE ngo_cuentas_mp SET access_token_cifrado=$1, version=version+1, expires_at=$2',
          [tokenCrypto.encryptToken('APP_USR-del-otro', 'ngo-1'), new Date(Date.now() + 100 * DAY).toISOString()]);
        throw new payments.PaymentError('x', { status: 400, code: 'invalid_grant' });
      };
      assert.equal((await donate()).status, 201);
      assert.equal(prefs[0].accessToken, 'APP_USR-del-otro');
      assert.equal((await account()).estado, 'activa');
      assert.equal(await reconnectNotices(), 0);
    });
  });

  describe('conciliación (GET /api/donaciones/:id?payment_id=…)', () => {
    test('donación cobrada por la ONG: consulta el pago con el token de la ONG y acredita', async () => {
      await link();
      const id = await insertDonation(SELLER);
      payment = approved(id);
      const r = await getDonation(id, '?payment_id=555');
      assert.equal(r.body.donation.status, 'completed');
      assert.deepEqual(lookups, [{ id: '555', accessToken: 'APP_USR-ong1' }]);
    });

    test('donación vieja (sin cobrador): consulta con el token de la aplicación', async () => {
      const id = await insertDonation(null);
      payment = approved(id);
      assert.equal((await getDonation(id, '?payment_id=556')).body.donation.status, 'completed');
      assert.deepEqual(lookups, [{ id: '556', accessToken: undefined }]);
    });

    test('la ONG desvinculó la cuenta: no consulta y responde el estado actual', async () => {
      const id = await insertDonation(SELLER);
      payment = approved(id);
      const r = await getDonation(id, '?payment_id=557');
      assert.equal(r.body.donation.status, 'pending');
      assert.deepEqual(lookups, []);
    });
  });

  describe('applyPayment: el pago tiene que venir de la cuenta que cobró la donación', () => {
    test('leído con la cuenta de otra ONG, o con la de la aplicación → mismatch, sin tocar nada', async () => {
      const id = await insertDonation(SELLER);
      payment = approved(id);
      assert.equal((await donaciones.applyPayment('p1', { accessToken: 'APP_USR-otra', mpUserId: '999' })).result, 'mismatch');
      assert.equal((await donaciones.applyPayment('p1')).result, 'mismatch');
      const d = await donation(id);
      assert.equal(d.estado, 'pendiente');
      assert.equal(d.external_status, null);
    });
    test('una donación vieja leída con la cuenta de una ONG → mismatch', async () => {
      const id = await insertDonation(null);
      payment = approved(id);
      assert.equal((await donaciones.applyPayment('p2', { accessToken: 'APP_USR-ong1', mpUserId: SELLER })).result, 'mismatch');
    });
    test('con la cuenta correcta → credited', async () => {
      const id = await insertDonation(SELLER);
      payment = approved(id);
      assert.equal((await donaciones.applyPayment('p3', { accessToken: 'APP_USR-ong1', mpUserId: SELLER })).result, 'credited');
    });
  });

  describe('webhook', () => {
    const notify = (dataId, body) => fetch(`${baseUrl}/api/donaciones/webhook?type=payment&data.id=${dataId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-signature': sign(dataId, 'req-1'), 'x-request-id': 'req-1' },
      body: JSON.stringify(body),
    });

    test('user_id de una ONG vinculada: consulta con SU token y acredita', async () => {
      await link();
      const id = await insertDonation(SELLER);
      payment = approved(id);
      assert.equal((await notify('9001', { type: 'payment', user_id: Number(SELLER), data: { id: '9001' } })).status, 200);
      assert.deepEqual(lookups, [{ id: '9001', accessToken: 'APP_USR-ong1' }]);
      assert.equal((await donation(id)).estado, 'completada');
    });

    test('user_id desconocido o ausente: consulta con el token de la aplicación (donaciones viejas)', async () => {
      const id = await insertDonation(null);
      payment = approved(id);
      assert.equal((await notify('9002', { user_id: 123 })).status, 200);
      assert.equal((await notify('9003', {})).status, 200);
      assert.deepEqual(lookups.map((l) => l.accessToken), [undefined, undefined]);
    });

    test('user_id de otra ONG (el cuerpo no está firmado) → no acredita una donación cobrada por otra cuenta', async () => {
      await link();
      await link({ ngoId: 'ngo-2', mpUserId: '999', access: 'APP_USR-ong2' });
      const id = await insertDonation(SELLER);
      payment = approved(id);
      assert.equal((await notify('9004', { user_id: 999 })).status, 200);
      assert.equal((await donation(id)).estado, 'pendiente');
    });

    test('la cuenta de la ONG requiere reconexión → 500 para que Mercado Pago reintente', async () => {
      await link();
      await db.run(`UPDATE ngo_cuentas_mp SET estado='requiere_reconexion'`);
      assert.equal((await notify('9005', { user_id: Number(SELLER) })).status, 500);
      assert.deepEqual(lookups, []);
    });
  });

  describe('GET /api/projects/:id → accepts_donations', () => {
    const detail = async () => (await (await fetch(`${baseUrl}/api/projects/proj-1`)).json()).project;
    test('true solo con una cuenta activa', async () => {
      assert.equal((await detail()).accepts_donations, false);
      await link();
      assert.equal((await detail()).accepts_donations, true);
      await db.run(`UPDATE ngo_cuentas_mp SET estado='requiere_reconexion'`);
      assert.equal((await detail()).accepts_donations, false);
    });
  });
});
