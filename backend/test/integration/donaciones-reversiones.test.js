// test/integration/donaciones-reversiones.test.js
//
// Devoluciones y contracargos de una donación ya acreditada (PLAN_FEBRERO.md, Etapa 1; PROJECT_ANALYSIS.md §311).
//   - Aviso de pago (type=payment): si Mercado Pago dice que ESE pago (el que acreditó) quedó `refunded` o
//     `charged_back` perdido, la donación pasa a 'reembolsada', `recaudado` baja y se avisa a la ONG.
//   - Aviso de contracargo (type=topic_chargebacks_wh, o chargebacks): misma firma; se consulta el contracargo y se
//     repasa cada pago con applyPayment.
// Lo simulado: payments.getPayment y payments.getChargeback. La firma se verifica de verdad.
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { setupTestServer } = require('./helpers');

const SECRET = 'secreto-webhook-de-prueba';
const sign = (dataId, requestId, ts = '1704908010') => {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return `ts=${ts},v1=${crypto.createHmac('sha256', SECRET).update(manifest).digest('hex')}`;
};

describe('Devoluciones y contracargos', () => {
  let server, baseUrl, db, payments;
  let maria, ngoUserId;
  let lookups, chargebackLookups, payment, chargeback, savedSecret;
  let seq = 0;

  before(async () => {
    savedSecret = process.env.MP_WEBHOOK_SECRET;
    process.env.MP_WEBHOOK_SECRET = SECRET;
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    payments = require('../../src/lib/payments');
    mock.method(payments, 'isConfigured', () => true);
    mock.method(payments, 'getPayment', async (id) => {
      lookups.push(String(id));
      if (typeof payment === 'function') return payment(String(id));
      return { id: String(id), ...payment };
    });
    mock.method(payments, 'getChargeback', async (id) => {
      chargebackLookups.push(String(id));
      if (typeof chargeback === 'function') return chargeback(String(id));
      return { id: String(id), ...chargeback };
    });
    const r = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maria@example.com', password: 'Password1' }),
    });
    const b = await r.json();
    maria = { token: b.token, id: b.user.id };
    ngoUserId = (await db.get(`SELECT user_id FROM ngos WHERE id='ngo-1'`)).user_id;
  });
  after(async () => {
    mock.restoreAll();
    if (savedSecret === undefined) delete process.env.MP_WEBHOOK_SECRET; else process.env.MP_WEBHOOK_SECRET = savedSecret;
    if (server) await server.close();
  });
  beforeEach(async () => {
    lookups = []; chargebackLookups = []; payment = null; chargeback = null;
    await db.run(`UPDATE projects SET recaudado=0 WHERE id='proj-1'`);
    await db.run(`DELETE FROM notifications WHERE type='donation_reversed'`);
  });

  // Una donación ya acreditada por el pago `paymentId` (como la deja applyPayment), con `recaudado` sumado.
  const creditedDonation = async (paymentId, amount = 1500) => {
    const id = `don-rev-${++seq}`;
    await db.run(
      `INSERT INTO donaciones (id, user_id, project_id, ngo_id, monto, estado, moneda, external_id, external_payment_id, external_status)
       VALUES ($1,$2,'proj-1','ngo-1',$3,'completada','ARS',$4,$5,'approved')`, [id, maria.id, amount, `pref-${id}`, paymentId]);
    await db.run(`UPDATE projects SET recaudado = COALESCE(recaudado, 0) + $1 WHERE id='proj-1'`, [amount]);
    return id;
  };
  const pendingDonation = async () => {
    const id = `don-rev-${++seq}`;
    await db.run(
      `INSERT INTO donaciones (id, user_id, project_id, ngo_id, monto, estado, moneda, external_id)
       VALUES ($1,$2,'proj-1','ngo-1',1500,'pendiente','ARS',$3)`, [id, maria.id, `pref-${id}`]);
    return id;
  };
  const row = (id) => db.get('SELECT estado, external_payment_id, external_status FROM donaciones WHERE id=$1', [id]);
  const recaudado = async () => Number((await db.get(`SELECT recaudado FROM projects WHERE id='proj-1'`)).recaudado);
  const reversalNotices = () => db.all(
    `SELECT user_id, title, body, data FROM notifications WHERE type='donation_reversed' ORDER BY created_at`);
  const paid = (donationId, over = {}) => ({ status: 'approved', statusDetail: 'accredited', externalReference: donationId, amount: 1500, currency: 'ARS', ...over });

  const notify = (query, { headers = {}, body } = {}) => fetch(`${baseUrl}/api/donaciones/webhook?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body ?? {}),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const paymentNotice = (paymentId, requestId = 'req-1') => notify(`type=payment&data.id=${paymentId}`, {
    headers: { 'x-signature': sign(paymentId, requestId), 'x-request-id': requestId },
    body: { action: 'payment.updated', type: 'payment', data: { id: paymentId } },
  });
  const chargebackNotice = (chargebackId, { type = 'topic_chargebacks_wh', requestId = 'req-cb' } = {}) =>
    notify(`type=${type}&data.id=${chargebackId}`, {
      headers: { 'x-signature': sign(chargebackId, requestId), 'x-request-id': requestId },
      body: { actions: ['changed_case_status'], type, data: { id: chargebackId } },
    });

  describe('aviso de pago de una donación acreditada', () => {
    test('devolución total (refunded) del pago que la acreditó → reembolsada, recaudado baja y se avisa a la ONG', async () => {
      const id = await creditedDonation('500');
      assert.equal(await recaudado(), 1500);
      payment = paid(id, { status: 'refunded', statusDetail: 'refunded' });
      const r = await paymentNotice('500');
      assert.equal(r.status, 200);
      assert.deepEqual(lookups, ['500']);
      const d = await row(id);
      assert.equal(d.estado, 'reembolsada');
      assert.equal(d.external_status, 'refunded');
      assert.equal(await recaudado(), 0);
      const notices = await reversalNotices();
      assert.equal(notices.length, 1);
      assert.equal(notices[0].user_id, ngoUserId);
      assert.match(notices[0].body, /1\.500/);
      const data = typeof notices[0].data === 'string' ? JSON.parse(notices[0].data) : notices[0].data;   // JSONB en Postgres
      assert.deepEqual(data, { project_id: 'proj-1', donation_id: id });
    });

    test('contracargo perdido (charged_back / settled) → reembolsada y recaudado baja', async () => {
      const id = await creditedDonation('501');
      payment = paid(id, { status: 'charged_back', statusDetail: 'settled' });
      assert.equal((await paymentNotice('501')).status, 200);
      assert.equal((await row(id)).estado, 'reembolsada');
      assert.equal(await recaudado(), 0);
    });

    test('charged_back con un detalle desconocido o sin detalle → se trata como perdido', async () => {
      for (const statusDetail of ['algo_nuevo', null]) {
        const id = await creditedDonation(`50${statusDetail ? 2 : 3}`);
        payment = paid(id, { status: 'charged_back', statusDetail });
        await paymentNotice(statusDetail ? '502' : '503');
        assert.equal((await row(id)).estado, 'reembolsada', String(statusDetail));
      }
      assert.equal(await recaudado(), 0);
    });

    test('contracargo en disputa (in_process) o ganado por la ONG (reimbursed) → no cambia nada', async () => {
      for (const [pid, statusDetail] of [['504', 'in_process'], ['505', 'reimbursed']]) {
        const id = await creditedDonation(pid);
        payment = paid(id, { status: 'charged_back', statusDetail });
        assert.equal((await paymentNotice(pid)).status, 200);
        assert.equal((await row(id)).estado, 'completada', statusDetail);
      }
      assert.equal(await recaudado(), 3000);
      assert.equal((await reversalNotices()).length, 0);
    });

    test('el aviso repetido (reintentos) resta una sola vez y avisa una sola vez', async () => {
      const id = await creditedDonation('506');
      payment = paid(id, { status: 'refunded' });
      for (let i = 0; i < 3; i++) assert.equal((await paymentNotice('506', `req-${i}`)).status, 200);
      assert.equal(await recaudado(), 0);
      assert.equal((await reversalNotices()).length, 1);
    });

    test('dos avisos a la vez (regla 21) → una sola resta', async () => {
      const id = await creditedDonation('507');
      payment = paid(id, { status: 'refunded' });
      const rs = await Promise.all([paymentNotice('507', 'req-a'), paymentNotice('507', 'req-b')]);
      assert.deepEqual(rs.map((r) => r.status), [200, 200]);
      assert.equal(await recaudado(), 0);
      assert.equal((await reversalNotices()).length, 1);
    });

    test('la devolución de OTRO pago de la misma donación (no el que la acreditó) → no la revierte', async () => {
      const id = await creditedDonation('508');
      payment = paid(id, { status: 'refunded' });
      assert.equal((await paymentNotice('509')).status, 200);
      assert.equal((await row(id)).estado, 'completada');
      assert.equal(await recaudado(), 1500);
    });

    test('recaudado nunca queda negativo (si alguien lo bajó a mano)', async () => {
      const id = await creditedDonation('510');
      await db.run(`UPDATE projects SET recaudado=200 WHERE id='proj-1'`);
      payment = paid(id, { status: 'refunded' });
      await paymentNotice('510');
      assert.equal((await row(id)).estado, 'reembolsada');
      assert.equal(await recaudado(), 0);
    });

    test('una donación PENDIENTE con su pago devuelto sigue pendiente y no toca recaudado', async () => {
      const id = await pendingDonation();
      payment = paid(id, { status: 'refunded' });
      assert.equal((await paymentNotice('511')).status, 200);
      const d = await row(id);
      assert.equal(d.estado, 'pendiente');
      assert.equal(d.external_status, 'refunded');
      assert.equal(await recaudado(), 0);
      assert.equal((await reversalNotices()).length, 0);
    });

    test('el log dice "reversed" y la donación revertida se ve como "refunded" para quien donó', async () => {
      const id = await creditedDonation('512');
      payment = paid(id, { status: 'refunded' });
      const lines = [];
      const log = mock.method(console, 'log', (...a) => lines.push(a.join(' ')));
      try { await paymentNotice('512'); } finally { log.mock.restore(); }
      assert.ok(lines.some((l) => l.startsWith('[donaciones]') && l.includes('512') && l.includes('reversed')), lines.join('\n'));
      const r = await fetch(`${baseUrl}/api/donaciones/${id}`, { headers: { Authorization: `Bearer ${maria.token}` } });
      assert.equal((await r.json()).donation.status, 'refunded');
    });

    test('un pago aprobado sobre una donación ya revertida no la vuelve a acreditar', async () => {
      const id = await creditedDonation('513');
      payment = paid(id, { status: 'refunded' });
      await paymentNotice('513');
      payment = paid(id);
      await paymentNotice('513', 'req-otra');
      assert.equal((await row(id)).estado, 'reembolsada');
      assert.equal(await recaudado(), 0);
    });
  });

  describe('aviso de contracargo', () => {
    test('type=topic_chargebacks_wh firmado → consulta el contracargo y revierte sus pagos', async () => {
      const id = await creditedDonation('600');
      chargeback = { paymentIds: ['600'] };
      payment = paid(id, { status: 'charged_back', statusDetail: 'settled' });
      const r = await chargebackNotice('9001');
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { received: true });
      assert.deepEqual(chargebackLookups, ['9001'], 'consulta ESE contracargo (el id firmado)');
      assert.deepEqual(lookups, ['600']);
      assert.equal((await row(id)).estado, 'reembolsada');
      assert.equal(await recaudado(), 0);
    });

    test('también con type=chargebacks', async () => {
      const id = await creditedDonation('601');
      chargeback = { paymentIds: ['601'] };
      payment = paid(id, { status: 'charged_back', statusDetail: 'settled' });
      assert.equal((await chargebackNotice('9002', { type: 'chargebacks' })).status, 200);
      assert.equal((await row(id)).estado, 'reembolsada');
    });

    test('contracargo recién abierto (in_process) → consulta pero no cambia nada', async () => {
      const id = await creditedDonation('602');
      chargeback = { paymentIds: ['602'] };
      payment = paid(id, { status: 'charged_back', statusDetail: 'in_process' });
      assert.equal((await chargebackNotice('9003')).status, 200);
      assert.deepEqual(lookups, ['602']);
      assert.equal((await row(id)).estado, 'completada');
      assert.equal(await recaudado(), 1500);
    });

    test('un contracargo con varios pagos los repasa todos', async () => {
      const a = await creditedDonation('603');
      const b = await creditedDonation('604', 2000);
      chargeback = { paymentIds: ['603', '604'] };
      payment = (pid) => ({ id: pid, ...paid(pid === '603' ? a : b, { status: 'charged_back', statusDetail: 'settled', amount: pid === '603' ? 1500 : 2000 }) });
      assert.equal((await chargebackNotice('9004')).status, 200);
      assert.deepEqual(lookups, ['603', '604']);
      assert.equal((await row(a)).estado, 'reembolsada');
      assert.equal((await row(b)).estado, 'reembolsada');
      assert.equal(await recaudado(), 0);
    });

    test('firma inválida → 401 sin consultar nada', async () => {
      await creditedDonation('605');
      const r = await notify('type=topic_chargebacks_wh&data.id=9005', {
        headers: { 'x-signature': sign('9999', 'req-1'), 'x-request-id': 'req-1' },
      });
      assert.equal(r.status, 401);
      assert.deepEqual(chargebackLookups, []);
      assert.deepEqual(lookups, []);
    });

    test('firmado pero sin data.id → 400', async () => {
      const v1 = crypto.createHmac('sha256', SECRET).update('request-id:req-1;ts:1704908010;').digest('hex');
      const r = await notify('type=topic_chargebacks_wh', { headers: { 'x-signature': `ts=1704908010,v1=${v1}`, 'x-request-id': 'req-1' } });
      assert.equal(r.status, 400);
      assert.deepEqual(chargebackLookups, []);
    });

    test('Mercado Pago no encuentra el contracargo → 200; Mercado Pago caído → 500 (para que reintente)', async () => {
      chargeback = () => { throw new payments.PaymentError('Mercado Pago respondió 404', { status: 404, code: 'not_found' }); };
      assert.equal((await chargebackNotice('9006')).status, 200);
      const id = await creditedDonation('606');
      chargeback = () => { throw new payments.PaymentError('error de red', { code: 'network' }); };
      const r = await chargebackNotice('9007');
      assert.equal(r.status, 500);
      assert.equal(r.body.error, 'No pudimos procesar el aviso');
      chargeback = { paymentIds: ['606'] };
      payment = paid(id, { status: 'charged_back', statusDetail: 'settled' });
      assert.equal((await chargebackNotice('9007')).status, 200, 'el reintento revierte');
      assert.equal((await row(id)).estado, 'reembolsada');
    });

    test('un contracargo sin pagos → 200 sin consultar pagos', async () => {
      chargeback = { paymentIds: [] };
      assert.equal((await chargebackNotice('9008')).status, 200);
      assert.deepEqual(lookups, []);
    });

    test('cada aviso de contracargo deja una línea en el log con el id y el resultado', async () => {
      const id = await creditedDonation('607');
      chargeback = { paymentIds: ['607'] };
      payment = paid(id, { status: 'charged_back', statusDetail: 'settled' });
      const lines = [];
      const log = mock.method(console, 'log', (...a) => lines.push(a.join(' ')));
      try { await chargebackNotice('9009'); } finally { log.mock.restore(); }
      assert.ok(lines.some((l) => l.startsWith('[donaciones]') && l.includes('contracargo 9009') && l.includes('607') && l.includes('reversed')),
        lines.join('\n'));
    });
  });
});
