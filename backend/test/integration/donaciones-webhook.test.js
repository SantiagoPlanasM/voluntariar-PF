// test/integration/donaciones-webhook.test.js
//
// Cómo se entera la app de que se pagó (PLAN_FALTANTE.md, Etapa 8; applyPayment en §170):
//   POST /api/donaciones/webhook           — aviso de Mercado Pago (público, con firma)
//   GET  /api/donaciones/:id?payment_id=…  — conciliación desde la página de vuelta (solo quien donó)
// La firma se verifica DE VERDAD (lib/payments.verifyWebhookSignature, con MP_WEBHOOK_SECRET); lo único simulado es
// la consulta del pago a Mercado Pago (payments.getPayment).
//
// Formatos de aviso (doc oficial): webhook `?type=payment&data.id=<id>` + headers `x-signature` y `x-request-id`
// (firmado); IPN `?topic=payment&id=<id>` (la doc dice que NO se puede validar con la clave): se responde 200 y no se
// procesa. La acreditación llega igual por el webhook o por la conciliación.
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { setupTestServer } = require('./helpers');

const SECRET = 'secreto-webhook-de-prueba';
const sign = (dataId, requestId, ts = '1704908010') => {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return `ts=${ts},v1=${crypto.createHmac('sha256', SECRET).update(manifest).digest('hex')}`;
};

describe('Aviso de Mercado Pago y conciliación', () => {
  let server, baseUrl, db, payments;
  let maria, juan, ngo1;
  let lookups, payment, configured, savedSecret;
  let seq = 0;

  before(async () => {
    savedSecret = process.env.MP_WEBHOOK_SECRET;
    process.env.MP_WEBHOOK_SECRET = SECRET;
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    payments = require('../../src/lib/payments');
    mock.method(payments, 'isConfigured', () => configured);
    mock.method(payments, 'getPayment', async (id) => {
      lookups.push(String(id));
      if (typeof payment === 'function') return payment(id);
      return { id: String(id), ...payment };
    });
  });
  after(async () => {
    mock.restoreAll();
    if (savedSecret === undefined) delete process.env.MP_WEBHOOK_SECRET; else process.env.MP_WEBHOOK_SECRET = savedSecret;
    if (server) await server.close();
  });
  beforeEach(async () => {
    lookups = []; payment = null; configured = true;
    await db.run(`UPDATE projects SET recaudado=0 WHERE id='proj-1'`);
  });

  const login = async (email) => {
    const r = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password1' }),
    });
    const b = await r.json();
    return { token: b.token, id: b.user.id };
  };
  before(async () => {
    maria = await login('maria@example.com');
    juan = await login('juan@example.com');
    ngo1 = await login('admin@sustentando.org');
  });

  const newDonation = async (who = maria, amount = 1500) => {
    const id = `don-wh-${++seq}`;
    await db.run(
      `INSERT INTO donaciones (id, user_id, project_id, ngo_id, monto, estado, moneda, external_id)
       VALUES ($1,$2,'proj-1','ngo-1',$3,'pendiente','ARS',$4)`, [id, who.id, amount, `pref-${id}`]);
    return id;
  };
  const row = (id) => db.get('SELECT estado, external_payment_id, external_status FROM donaciones WHERE id=$1', [id]);
  const recaudado = async () => Number((await db.get(`SELECT recaudado FROM projects WHERE id='proj-1'`)).recaudado);
  const approved = (donationId, over = {}) => ({ status: 'approved', externalReference: donationId, amount: 1500, currency: 'ARS', ...over });

  const notify = (query, { headers = {}, body } = {}) => fetch(`${baseUrl}/api/donaciones/webhook?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body ?? {}),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const signedPaymentNotice = (paymentId, requestId = 'req-1') => notify(`type=payment&data.id=${paymentId}`, {
    headers: { 'x-signature': sign(paymentId, requestId), 'x-request-id': requestId },
    body: { action: 'payment.updated', type: 'payment', data: { id: paymentId } },
  });

  describe('POST /api/donaciones/webhook', () => {
    test('aviso firmado de un pago aprobado → 200 y la donación queda acreditada', async () => {
      const id = await newDonation();
      payment = approved(id);
      const r = await signedPaymentNotice('111');
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { received: true });
      assert.deepEqual(lookups, ['111'], 'consultó ESE pago a Mercado Pago');
      assert.equal((await row(id)).estado, 'completada');
      assert.equal(await recaudado(), 1500);
    });

    test('el mismo aviso repetido (reintentos de Mercado Pago) → 200 y una sola acreditación', async () => {
      const id = await newDonation();
      payment = approved(id);
      for (let i = 0; i < 3; i++) assert.equal((await signedPaymentNotice('112', `req-${i}`)).status, 200);
      assert.equal(await recaudado(), 1500);
    });

    test('firma inválida, de otro pago, de otro request-id, sin headers o sin secreto → 401 sin consultar nada', async () => {
      const id = await newDonation();
      payment = approved(id);
      const cases = [
        { 'x-signature': 'ts=1,v1=' + '0'.repeat(64), 'x-request-id': 'req-1' },
        { 'x-signature': sign('999', 'req-1'), 'x-request-id': 'req-1' },   // firmado para otro pago
        { 'x-signature': sign('113', 'req-1'), 'x-request-id': 'req-OTRO' },
        {},
      ];
      for (const headers of cases) {
        const r = await notify('type=payment&data.id=113', { headers, body: { type: 'payment', data: { id: '113' } } });
        assert.equal(r.status, 401, JSON.stringify(headers));
        assert.deepEqual(r.body, { error: 'Firma inválida' });
      }
      process.env.MP_WEBHOOK_SECRET = '';
      try {
        const r = await notify('type=payment&data.id=113', { headers: { 'x-signature': sign('113', 'req-1'), 'x-request-id': 'req-1' } });
        assert.equal(r.status, 401, 'sin secreto configurado no se acepta ningún aviso');
      } finally { process.env.MP_WEBHOOK_SECRET = SECRET; }
      assert.deepEqual(lookups, []);
      assert.equal((await row(id)).estado, 'pendiente');
    });

    test('el id del pago sale de la QUERY firmada, no del cuerpo (un cuerpo cambiado no hace consultar otro pago)', async () => {
      const id = await newDonation();
      payment = approved(id);
      const r = await notify('type=payment&data.id=114', {
        headers: { 'x-signature': sign('114', 'req-1'), 'x-request-id': 'req-1' },
        body: { type: 'payment', data: { id: '999999' } },
      });
      assert.equal(r.status, 200);
      assert.deepEqual(lookups, ['114']);
    });

    test('un aviso firmado de otro tipo (merchant_order, etc.) → 200 sin consultar pagos', async () => {
      const r = await notify('type=merchant_order&data.id=115', {
        headers: { 'x-signature': sign('115', 'req-1'), 'x-request-id': 'req-1' },
      });
      assert.equal(r.status, 200);
      assert.deepEqual(lookups, []);
    });

    test('aviso IPN (?topic=payment&id=…, no se puede validar) → 200 sin procesar', async () => {
      const id = await newDonation();
      payment = approved(id);
      const r = await notify('topic=payment&id=116');
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { received: true });
      assert.deepEqual(lookups, []);
      assert.equal((await row(id)).estado, 'pendiente');
    });

    test('firmado pero sin data.id → 400', async () => {
      // Firma válida para un aviso sin data.id: el manifiesto omite la parte `id` (como el SDK).
      const v1 = crypto.createHmac('sha256', SECRET).update('request-id:req-1;ts:1704908010;').digest('hex');
      const r = await notify('type=payment', { headers: { 'x-signature': `ts=1704908010,v1=${v1}`, 'x-request-id': 'req-1' } });
      assert.equal(r.status, 400);
      assert.deepEqual(lookups, []);
    });

    test('Mercado Pago no encuentra el pago → 200 (reintentar no sirve)', async () => {
      payment = () => { throw new payments.PaymentError('Mercado Pago respondió 404: not found', { status: 404, code: 'not_found' }); };
      assert.equal((await signedPaymentNotice('117')).status, 200);
    });

    test('Mercado Pago caído o la base falla → 500, para que Mercado Pago reintente', async () => {
      const id = await newDonation();
      payment = () => { throw new payments.PaymentError('error de red con Mercado Pago: ECONNRESET', { code: 'network' }); };
      const r = await signedPaymentNotice('118');
      assert.equal(r.status, 500);
      assert.equal(r.body.error, 'No pudimos procesar el aviso');
      assert.equal((await row(id)).estado, 'pendiente');
      payment = approved(id);
      assert.equal((await signedPaymentNotice('118')).status, 200, 'el reintento acredita');
      assert.equal((await row(id)).estado, 'completada');
    });

    // §173: en producción no había forma de saber si un aviso llegó y salió bien (solo se logueaban los errores).
    // Ahora cada aviso deja UNA línea: el pago y el resultado, sin la firma, los headers ni el secreto.
    test('cada aviso deja una línea en el log con el pago y el resultado (sin firma ni secreto)', async () => {
      const id = await newDonation();
      payment = approved(id);
      const lines = [];
      const log = mock.method(console, 'log', (...a) => lines.push(a.join(' ')));
      const warn = mock.method(console, 'warn', (...a) => lines.push(a.join(' ')));
      try {
        await signedPaymentNotice('130');
        await notify('topic=payment&id=131');
        await notify('type=payment&data.id=132', { headers: { 'x-signature': 'ts=1,v1=00', 'x-request-id': 'r' } });
        await notify('type=merchant_order&data.id=133', { headers: { 'x-signature': sign('133', 'req-1'), 'x-request-id': 'req-1' } });
      } finally { log.mock.restore(); warn.mock.restore(); }
      const mine = lines.filter((l) => l.startsWith('[donaciones]'));
      assert.ok(mine.some((l) => l.includes('pago 130') && l.includes('credited')), mine.join('\n'));
      assert.ok(mine.some((l) => l.includes('IPN') && l.includes('ignorado')), mine.join('\n'));
      assert.ok(mine.some((l) => l.includes('firma inválida') && l.includes('132')), mine.join('\n'));
      assert.ok(mine.some((l) => l.includes('merchant_order') && l.includes('ignorado')), mine.join('\n'));
      assert.equal(mine.length, 4, mine.join('\n'));
      const all = lines.join('\n');
      assert.ok(!all.includes(SECRET), 'el secreto no se loguea');
      assert.ok(!all.includes('v1='), 'la firma no se loguea');
    });

    // §287 (SonarCloud S5145): un data.id que no es numérico no se escribe en el log (un id de pago es solo dígitos),
    // igual que user_id. Antes pasaba por forLog(), que lo limpiaba, pero Sonar no lo reconocía en esta línea.
    test('firma inválida con un data.id que no es numérico: el log dice data.id=? y no muestra lo inyectado', async () => {
      const lines = [];
      const warn = mock.method(console, 'warn', (...a) => lines.push(a.join(' ')));
      try {
        await notify(`type=payment&data.id=${encodeURIComponent('99\n[donaciones] pago acreditado FALSO')}`,
          { headers: { 'x-signature': 'ts=1,v1=00', 'x-request-id': 'r' } });
      } finally { warn.mock.restore(); }
      const line = lines.find((l) => l.includes('firma inválida'));
      assert.ok(line, lines.join('\n'));
      assert.match(line, /data\.id=\?;/);
      assert.ok(!line.includes('FALSO') && !line.includes('99'), line);
    });

    // §175: en producción, los avisos REALES de pago no validan y el simulado del panel sí (§174). Para saber por qué,
    // la línea de "firma inválida" suma datos que no son secretos: si vino x-request-id, el ts, y del cuerpo live_mode y
    // user_id (de qué cuenta viene el aviso). Nunca el hash, el secreto ni otros headers.
    test('firma inválida: la línea trae datos de diagnóstico (request-id, ts, live_mode, user_id) y nada secreto', async () => {
      const lines = [];
      const warn = mock.method(console, 'warn', (...a) => lines.push(a.join(' ')));
      try {
        await notify('type=payment&data.id=150', {
          headers: { 'x-signature': 'ts=1742505638683,v1=' + 'ab'.repeat(32), 'x-request-id': 'req-xyz' },
          body: { type: 'payment', live_mode: false, user_id: 1005068765, data: { id: '150' }, email: 'no@loguear.com' },
        });
        await notify('type=payment&data.id=151', {
          headers: { 'x-signature': 'basura' },
          body: { user_id: 'x"; DROP', live_mode: 'quizás' },
        });
      } finally { warn.mock.restore(); }
      const [a, b] = lines.filter((l) => l.startsWith('[donaciones]'));
      assert.match(a, /firma inválida/);
      assert.match(a, /data\.id=150/);
      assert.match(a, /request-id: sí/);
      assert.match(a, /ts=1742505638683/);
      assert.match(a, /live_mode=false/);
      assert.match(a, /user_id=1005068765/);
      assert.ok(!a.includes('ab'.repeat(32)) && !a.includes('req-xyz') && !a.includes('loguear'), a);
      // Valores que no son lo esperado (texto, sin header) no se copian al log.
      assert.match(b, /request-id: no/);
      assert.match(b, /ts=\?/);
      assert.match(b, /live_mode=\?/);
      assert.match(b, /user_id=\?/);
      assert.ok(!b.includes('DROP') && !b.includes('quizás'), b);
    });

    // §202 (SonarCloud S5145): el data.id llega del query string YA DECODIFICADO; con "%0A" se podía inventar una
    // línea entera en los logs de Render ("aviso del pago 999: approved"). Ahora pasa por forLog().
    test('un data.id con salto de línea no parte la línea del log (log injection)', async () => {
      // Arrange
      const lines = [];
      const warn = mock.method(console, 'warn', (...a) => lines.push(a.join(' ')));
      // Act
      try {
        await notify('type=payment&data.id=150%0A%5Bdonaciones%5D%20aviso%20del%20pago%20999%3A%20approved', {
          headers: { 'x-signature': 'basura' },
        });
      } finally { warn.mock.restore(); }
      // Assert: una sola línea, sin \n ni \r, y el texto inyectado quedó dentro de ella
      const line = lines.find((l) => l.startsWith('[donaciones]'));
      assert.ok(line, 'se logueó la firma inválida');
      assert.doesNotMatch(line, /[\r\n]/);
      assert.match(line, /data\.id=150 \[donaciones\] aviso/);
    });

    test('es público (Mercado Pago no manda sesión) y no expone nada de la donación', async () => {
      const id = await newDonation();
      payment = approved(id);
      const r = await signedPaymentNotice('119');
      assert.deepEqual(Object.keys(r.body), ['received']);
    });
  });

  describe('GET /api/donaciones/:id (conciliación desde la vuelta)', () => {
    const get = (who, path) => fetch(`${baseUrl}/api/donaciones/${path}`, { headers: who ? { Authorization: `Bearer ${who.token}` } : {} })
      .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    const KEYS = ['amount', 'currency', 'id', 'project_id', 'project_title', 'status'];

    test('sin payment_id: el estado actual, sin consultar a Mercado Pago', async () => {
      const id = await newDonation();
      const r = await get(maria, id);
      assert.equal(r.status, 200);
      assert.deepEqual(Object.keys(r.body.donation).sort(), KEYS);
      assert.deepEqual(r.body.donation, {
        id, status: 'pending', amount: 1500, currency: 'ARS', project_id: 'proj-1', project_title: r.body.donation.project_title,
      });
      assert.equal(typeof r.body.donation.project_title, 'string');
      assert.deepEqual(lookups, []);
    });

    test('con payment_id de un pago aprobado de ESTA donación: acredita y devuelve "completed"', async () => {
      const id = await newDonation();
      payment = approved(id);
      const r = await get(maria, `${id}?payment_id=120`);
      assert.equal(r.status, 200);
      assert.equal(r.body.donation.status, 'completed');
      assert.deepEqual(lookups, ['120']);
      assert.equal(await recaudado(), 1500);
    });

    test('con el payment_id de OTRA donación: no acredita ninguna (y sigue "pending")', async () => {
      const mine = await newDonation(maria);
      const other = await newDonation(juan);
      payment = approved(other);
      const r = await get(maria, `${mine}?payment_id=121`);
      assert.equal(r.status, 200);
      assert.equal(r.body.donation.status, 'pending');
      assert.equal((await row(other)).estado, 'pendiente');
      assert.equal(await recaudado(), 0);
    });

    test('la conciliación también deja una línea en el log (pago, donación y resultado)', async () => {
      const id = await newDonation();
      payment = approved(id);
      const lines = [];
      const log = mock.method(console, 'log', (...a) => lines.push(a.join(' ')));
      try { await get(maria, `${id}?payment_id=140`); } finally { log.mock.restore(); }
      assert.ok(lines.some((l) => l.startsWith('[donaciones]') && l.includes('conciliación') && l.includes('140') && l.includes(id) && l.includes('credited')),
        lines.join('\n'));
    });

    test('ya completada: no vuelve a consultar', async () => {
      const id = await newDonation();
      payment = approved(id);
      await get(maria, `${id}?payment_id=122`);
      lookups = [];
      const r = await get(maria, `${id}?payment_id=122`);
      assert.equal(r.body.donation.status, 'completed');
      assert.deepEqual(lookups, []);
    });

    test('rechazado: sigue "pending" (se puede reintentar)', async () => {
      const id = await newDonation();
      payment = approved(id, { status: 'rejected' });
      assert.equal((await get(maria, `${id}?payment_id=123`)).body.donation.status, 'pending');
    });

    test('un payment_id que no es numérico se ignora (no se consulta)', async () => {
      const id = await newDonation();
      for (const pid of ['abc', '1%2F..%2Fusers', '', '1'.repeat(31)]) {
        const r = await get(maria, `${id}?payment_id=${pid}`);
        assert.equal(r.status, 200, pid);
      }
      assert.deepEqual(lookups, []);
    });

    test('si Mercado Pago falla, responde igual el estado actual (200, "pending")', async () => {
      const id = await newDonation();
      payment = () => { throw new payments.PaymentError('error de red', { code: 'network' }); };
      const r = await get(maria, `${id}?payment_id=124`);
      assert.equal(r.status, 200);
      assert.equal(r.body.donation.status, 'pending');
    });

    test('Mercado Pago sin configurar: no consulta y responde el estado actual', async () => {
      const id = await newDonation();
      configured = false;
      const r = await get(maria, `${id}?payment_id=125`);
      assert.equal(r.status, 200);
      assert.deepEqual(lookups, []);
    });

    test('la donación de otra persona, una inexistente o sin sesión: 404/401 y sin consultar', async () => {
      const id = await newDonation(maria);
      payment = approved(id);
      for (const who of [juan, ngo1]) {
        const r = await get(who, `${id}?payment_id=126`);
        assert.equal(r.status, 404);
        assert.deepEqual(r.body, { error: 'Donación no encontrada' });
      }
      assert.equal((await get(maria, 'no-existe')).status, 404);
      assert.equal((await get(null, id)).status, 401);
      assert.deepEqual(lookups, []);
      assert.equal((await row(id)).estado, 'pendiente');
    });

    test('estados en inglés: completada → completed, fallida → failed', async () => {
      const a = await newDonation();
      await db.run(`UPDATE donaciones SET estado='fallida' WHERE id=$1`, [a]);
      assert.equal((await get(maria, a)).body.donation.status, 'failed');
    });
  });
});
