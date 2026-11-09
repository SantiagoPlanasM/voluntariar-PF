// test/integration/mp-desvinculacion.test.js
//
// Desvinculación de Mercado Pago (PLAN_FEBRERO.md, Etapa 1; PROJECT_ANALYSIS.md §313). Cuando la ONG le quita el
// acceso a la aplicación, Mercado Pago borra sus tokens y manda un aviso `mp-connect` al webhook. La documentación no
// muestra el formato del aviso: se toma como un AVISO PARA VERIFICAR. Por cada id de vendedor que traiga (data.id de la
// query firmada o user_id del cuerpo) que sea de una ONG vinculada, se prueba su token contra Mercado Pago
// (getSellerUser): si lo rechaza (401), la cuenta pasa a "requiere reconexión" (se oculta el botón de donar y se avisa
// a la ONG). Si el token sigue andando, no cambia nada: un aviso falso o una vinculación nueva no cortan nada.
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { setupTestServer } = require('./helpers');

const SECRET = 'secreto-webhook-desvinculacion';
const KEY = crypto.randomBytes(32).toString('base64');
const SELLER = '3772556008';
const sign = (dataId, requestId, ts = '1704908010') => {
  const manifest = `${dataId ? `id:${dataId};` : ''}request-id:${requestId};ts:${ts};`;
  return `ts=${ts},v1=${crypto.createHmac('sha256', SECRET).update(manifest).digest('hex')}`;
};

describe('Desvinculación de Mercado Pago (aviso mp-connect)', () => {
  let server, baseUrl, db, payments, sellerAccounts;
  let checks, userImpl, saved;

  before(async () => {
    saved = { MP_TOKEN_KEY: process.env.MP_TOKEN_KEY, MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET };
    process.env.MP_TOKEN_KEY = KEY;
    process.env.MP_WEBHOOK_SECRET = SECRET;
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    payments = require('../../src/lib/payments');
    sellerAccounts = require('../../src/lib/sellerAccounts');
    mock.method(payments, 'getSellerUser', async (token) => { checks.push(token); return userImpl(token); });
    mock.method(payments, 'getPayment', async () => { throw new Error('un aviso mp-connect no consulta pagos'); });
  });
  after(async () => {
    mock.restoreAll();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    if (server) await server.close();
  });
  beforeEach(async () => {
    process.env.MP_TOKEN_KEY = KEY;
    checks = [];
    userImpl = async () => ({ id: SELLER, nickname: 'TESTUSER', tags: ['test_user'] });
    await db.run('DELETE FROM ngo_cuentas_mp');
    await db.run(`DELETE FROM notifications WHERE type='mp_reconnect_needed'`);
  });

  const revoked = () => { throw new payments.PaymentError('Mercado Pago respondió 401: invalid_token', { status: 401, code: 'unauthorized' }); };
  const link = (ngoId = 'ngo-1', mpUserId = SELLER, access = 'APP_USR-ong1') =>
    sellerAccounts.saveAccount(ngoId, { accessToken: access, refreshToken: null, mpUserId, expiresIn: null }, 'manual');
  const state = async (ngoId = 'ngo-1') => (await db.get('SELECT estado FROM ngo_cuentas_mp WHERE ngo_id=$1', [ngoId]))?.estado;
  const notices = async () => Number((await db.get(
    `SELECT COUNT(*) AS n FROM notifications WHERE user_id='user-ngo-1' AND type='mp_reconnect_needed'`)).n);
  const acceptsDonations = async () => (await (await fetch(`${baseUrl}/api/projects/proj-1`)).json()).project.accepts_donations;

  // Aviso mp-connect firmado. `dataId` va en la query (lo firmado); `body` es lo que no está firmado.
  const notify = ({ dataId = SELLER, body = { type: 'mp-connect', user_id: Number(SELLER) }, requestId = 'req-1', signature } = {}) =>
    fetch(`${baseUrl}/api/donaciones/webhook?type=mp-connect${dataId ? `&data.id=${dataId}` : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-signature': signature ?? sign(dataId, requestId), 'x-request-id': requestId },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  test('Mercado Pago ya no acepta el token → requiere reconexión, aviso a la ONG y sin botón de donar', async () => {
    await link();
    assert.equal(await acceptsDonations(), true);
    userImpl = revoked;
    const r = await notify();
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { received: true });
    assert.deepEqual(checks, ['APP_USR-ong1'], 'probó el token de ESA ONG');
    assert.equal(await state(), 'requiere_reconexion');
    assert.equal(await notices(), 1);
    assert.equal(await acceptsDonations(), false);
  });

  test('el token sigue andando (vinculación nueva o aviso falso) → no cambia nada', async () => {
    await link();
    const r = await notify();
    assert.equal(r.status, 200);
    assert.deepEqual(checks, ['APP_USR-ong1']);
    assert.equal(await state(), 'activa');
    assert.equal(await notices(), 0);
  });

  test('el vendedor puede venir solo en data.id (query) o solo en user_id (cuerpo)', async () => {
    await link();
    userImpl = revoked;
    assert.equal((await notify({ body: {} })).status, 200);
    assert.equal(await state(), 'requiere_reconexion');

    await db.run('DELETE FROM ngo_cuentas_mp');
    await link();
    checks = [];
    assert.equal((await notify({ dataId: '', body: { user_id: Number(SELLER) } })).status, 200, 'firmado sin data.id: no es un 400');
    assert.deepEqual(checks, ['APP_USR-ong1']);
    assert.equal(await state(), 'requiere_reconexion');
  });

  test('el mismo vendedor en data.id y en user_id se prueba una sola vez', async () => {
    await link();
    await notify();
    assert.deepEqual(checks, ['APP_USR-ong1']);
  });

  test('ids de otras dos ONG (query y cuerpo) → prueba las dos y marca solo la revocada', async () => {
    await link('ngo-1', SELLER, 'APP_USR-ong1');
    await link('ngo-2', '999', 'APP_USR-ong2');
    userImpl = async (t) => (t === 'APP_USR-ong2' ? revoked() : { id: SELLER, tags: [] });
    assert.equal((await notify({ body: { user_id: 999 } })).status, 200);
    assert.deepEqual(checks.sort(), ['APP_USR-ong1', 'APP_USR-ong2']);
    assert.equal(await state('ngo-1'), 'activa');
    assert.equal(await state('ngo-2'), 'requiere_reconexion');
  });

  test('un vendedor que no es de ninguna ONG, o ids que no son numéricos → 200 sin consultar', async () => {
    await link();
    const lines = [];
    const log = mock.method(console, 'log', (...a) => lines.push(a.join(' ')));
    try {
      assert.equal((await notify({ dataId: '123', body: { user_id: 456 } })).status, 200);
      assert.equal((await notify({ dataId: 'abc', body: { user_id: 'x;1' } })).status, 200);
    } finally { log.mock.restore(); }
    assert.deepEqual(checks, []);
    assert.deepEqual(lines.filter((l) => l.includes('mp-connect')), [], 'sin ONG no hay nada que anotar');
  });

  test('sin MP_TOKEN_KEY no se puede probar el token → 500 (para que reintente) sin marcar nada', async () => {
    await link();
    userImpl = revoked;
    delete process.env.MP_TOKEN_KEY;
    const r = await notify();
    assert.equal(r.status, 500);
    assert.deepEqual(checks, []);
    assert.equal(await state(), 'activa');
  });

  test('la cuenta ya requiere reconexión → no consulta ni avisa de nuevo', async () => {
    await link();
    await db.run(`UPDATE ngo_cuentas_mp SET estado='requiere_reconexion'`);
    assert.equal((await notify()).status, 200);
    assert.deepEqual(checks, []);
    assert.equal(await notices(), 0);
  });

  test('el aviso repetido (reintentos) avisa a la ONG una sola vez', async () => {
    await link();
    userImpl = revoked;
    for (let i = 0; i < 3; i++) assert.equal((await notify({ requestId: `req-${i}` })).status, 200);
    assert.equal(await notices(), 1);
  });

  test('Mercado Pago caído → 500 (para que reintente) y la cuenta sigue activa', async () => {
    await link();
    userImpl = () => { throw new payments.PaymentError('error de red con Mercado Pago', { code: 'network' }); };
    const r = await notify();
    assert.equal(r.status, 500);
    assert.equal(r.body.error, 'No pudimos procesar el aviso');
    assert.equal(await state(), 'activa');
    userImpl = revoked;
    assert.equal((await notify()).status, 200, 'el reintento la marca');
    assert.equal(await state(), 'requiere_reconexion');
  });

  test('firma inválida → 401 sin consultar nada', async () => {
    await link();
    userImpl = revoked;
    const r = await notify({ signature: sign('999', 'req-1') });
    assert.equal(r.status, 401);
    assert.deepEqual(checks, []);
    assert.equal(await state(), 'activa');
  });

  test('deja una línea en el log por vendedor, con el resultado y sin el token', async () => {
    await link();
    userImpl = revoked;
    const lines = [];
    const log = mock.method(console, 'log', (...a) => lines.push(a.join(' ')));
    const warn = mock.method(console, 'warn', (...a) => lines.push(a.join(' ')));
    try { await notify(); } finally { log.mock.restore(); warn.mock.restore(); }
    const mine = lines.filter((l) => l.startsWith('[donaciones]'));
    assert.ok(mine.some((l) => l.includes('mp-connect') && l.includes(SELLER) && l.includes('revoked')), lines.join('\n'));
    assert.ok(!lines.join('\n').includes('APP_USR-ong1'), 'el token no se loguea');
  });
});
