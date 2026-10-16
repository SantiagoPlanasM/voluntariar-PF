// test/integration/donaciones.test.js
//
// Donaciones con Mercado Pago (PLAN_FALTANTE.md, Etapa 7; lib/payments.js en §169):
//   POST /api/donaciones { project_id, amount } → { donation_id, checkout_url }
//   applyPayment(paymentId) — la ÚNICA transición de una donación; la usan el webhook y la conciliación (Etapa 8).
// Mercado Pago se reemplaza por un doble: estos tests no hablan con nadie.
//
// Reglas que se prueban:
//   - montos en PESOS ENTEROS entre 100 y 500.000: `monto`/`recaudado` son REAL (float4 en Postgres, ~7 dígitos), y
//     con centavos la comparación "pagado = donado" fallaría;
//   - la donación se crea `pendiente` EXPLÍCITO (el DEFAULT de la tabla es 'completada');
//   - solo un pago `approved` cuyo monto y moneda coinciden la pasa a `completada` y suma a `recaudado`, una sola vez
//     (compare-and-swap dentro de una transacción). Un rechazo NO la marca fallida: Mercado Pago deja reintentar el
//     pago con la misma preferencia, y el segundo intento aprobado tiene que acreditarse.
//
// Seed: proj-1 (ngo-1, Sustentando, activo). maria es voluntaria; techcorp, empresa.
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Donaciones (Mercado Pago)', () => {
  let server, baseUrl, db, payments, donaciones;
  let maria, juan, company, ngo1;
  let prefs, payment, failPreference, configured, lastPreference;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    payments = require('../../src/lib/payments');
    donaciones = require('../../src/routes/donaciones');
    let n = 0;
    mock.method(payments, 'isConfigured', () => configured);
    mock.method(payments, 'createPreference', async (input) => {
      lastPreference = input;
      if (failPreference) throw new payments.PaymentError('Mercado Pago respondió 500: boom', { status: 500 });
      n += 1;
      prefs.push(input);
      return { preferenceId: `pref-${n}`, checkoutUrl: `https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-${n}` };
    });
    mock.method(payments, 'getPayment', async (id) => {
      if (typeof payment === 'function') return payment(id);
      return { id: String(id), ...payment };
    });
  });
  after(async () => { mock.restoreAll(); if (server) await server.close(); });

  beforeEach(async () => {
    prefs = []; failPreference = false; configured = true; payment = null; lastPreference = null;
    delete process.env.API_PUBLIC_URL;
    await db.run(`UPDATE projects SET recaudado=0, status='active' WHERE id='proj-1'`);
  });

  const login = async (email) => {
    const r = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password1' }),
    });
    const b = await r.json();
    assert.equal(r.status, 200, `login ${email}`);
    return { token: b.token, id: b.user.id };
  };
  const donate = (who, body) => fetch(`${baseUrl}/api/donaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${who.token}` } : {}) },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => ({})) }));
  const row = (id) => db.get('SELECT * FROM donaciones WHERE id=$1', [id]);
  const count = async () => Number((await db.get('SELECT COUNT(*) AS n FROM donaciones')).n);
  const recaudado = async () => Number((await db.get(`SELECT recaudado FROM projects WHERE id='proj-1'`)).recaudado);
  const ngoNotifications = async () => Number((await db.get(
    `SELECT COUNT(*) AS n FROM notifications WHERE user_id='user-ngo-1' AND type='donation_received'`)).n);

  before(async () => {
    maria = await login('maria@example.com');
    juan = await login('juan@example.com');
    company = await login('admin@techcorp.com');
    ngo1 = await login('admin@sustentando.org');
  });

  describe('migración', () => {
    test('donaciones tiene external_id, external_payment_id, external_status y moneda (DEFAULT ARS)', async () => {
      const id = 'mig-test-1';
      await db.run(`INSERT INTO donaciones (id, user_id, monto, estado) VALUES ($1,'user-vol-1',100,'pendiente')`, [id]);
      const r = await row(id);
      for (const c of ['external_id', 'external_payment_id', 'external_status', 'moneda']) assert.ok(c in r, c);
      assert.equal(r.moneda, 'ARS');
      await db.run('DELETE FROM donaciones WHERE id=$1', [id]);
    });
  });

  describe('POST /api/donaciones', () => {
    test('voluntario: crea la donación PENDIENTE, arma la preferencia y devuelve el link', async () => {
      process.env.API_PUBLIC_URL = 'https://api.ejemplo.com';
      const r = await donate(maria, { project_id: 'proj-1', amount: 1500 });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.deepEqual(Object.keys(r.body).sort(), ['checkout_url', 'donation_id']);
      assert.equal(r.body.checkout_url, 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1');

      const d = await row(r.body.donation_id);
      assert.equal(d.estado, 'pendiente');
      assert.equal(Number(d.monto), 1500);
      assert.equal(d.moneda, 'ARS');
      assert.equal(d.user_id, maria.id);
      assert.equal(d.project_id, 'proj-1');
      assert.equal(d.ngo_id, 'ngo-1');
      assert.equal(d.external_id, 'pref-1');

      assert.equal(prefs.length, 1);
      assert.equal(prefs[0].donationId, r.body.donation_id);
      assert.equal(prefs[0].amount, 1500);
      assert.match(prefs[0].title, /^Donación: /);
      assert.equal(prefs[0].successUrl, 'http://localhost:5173/donaciones/vuelta');
      assert.equal(prefs[0].notificationUrl, 'https://api.ejemplo.com/api/donaciones/webhook');
      assert.equal(await recaudado(), 0, 'crear la donación no suma nada');
    });

    test('sin URL pública de la API (en local) no manda notification_url', async () => {
      const r = await donate(maria, { project_id: 'proj-1', amount: 100 });
      assert.equal(r.status, 201);
      assert.equal(prefs[0].notificationUrl, undefined);
    });

    test('empresa también puede donar', async () => {
      assert.equal((await donate(company, { project_id: 'proj-1', amount: 5000 })).status, 201);
    });

    test('ONG → 403; sin sesión → 401 (sin crear nada)', async () => {
      const before = await count();
      assert.equal((await donate(ngo1, { project_id: 'proj-1', amount: 1500 })).status, 403);
      assert.equal((await donate(null, { project_id: 'proj-1', amount: 1500 })).status, 401);
      assert.equal(await count(), before);
      assert.equal(prefs.length, 0);
    });

    test('montos inválidos → 400, sin crear nada ni llamar a Mercado Pago', async () => {
      const before = await count();
      const cases = [
        [undefined, 'El monto tiene que ser un número entero de pesos'],
        ['1500', 'El monto tiene que ser un número entero de pesos'],
        [true, 'El monto tiene que ser un número entero de pesos'],
        [[1500], 'El monto tiene que ser un número entero de pesos'],
        [null, 'El monto tiene que ser un número entero de pesos'],
        [100.5, 'El monto tiene que ser un número entero de pesos'],
        [0, 'El monto mínimo es de $100'],
        [-500, 'El monto mínimo es de $100'],
        [99, 'El monto mínimo es de $100'],
        [500001, 'El monto máximo es de $500.000'],
        [1e21, 'El monto máximo es de $500.000'],
      ];
      for (const [amount, msg] of cases) {
        const r = await donate(maria, { project_id: 'proj-1', amount });
        assert.equal(r.status, 400, `amount=${JSON.stringify(amount)}`);
        assert.equal(r.body.error, msg, `amount=${JSON.stringify(amount)}`);
      }
      assert.equal(await count(), before);
      assert.equal(prefs.length, 0);
    });

    test('los bordes 100 y 500.000 se aceptan', async () => {
      assert.equal((await donate(maria, { project_id: 'proj-1', amount: 100 })).status, 201);
      assert.equal((await donate(juan, { project_id: 'proj-1', amount: 500000 })).status, 201);
    });

    test('proyecto: falta → 400; no existe o no está activo → 404 (el mismo mensaje)', async () => {
      const before = await count();
      for (const project_id of [undefined, '', 42, {}]) {
        const r = await donate(maria, { project_id, amount: 1500 });
        assert.equal(r.status, 400, JSON.stringify(project_id));
        assert.equal(r.body.error, 'Falta el proyecto');
      }
      const missing = await donate(maria, { project_id: 'no-existe', amount: 1500 });
      assert.equal(missing.status, 404);
      assert.equal(missing.body.error, 'Proyecto no encontrado o no recibe donaciones');
      await db.run(`UPDATE projects SET status='completed' WHERE id='proj-1'`);
      const closed = await donate(maria, { project_id: 'proj-1', amount: 1500 });
      assert.equal(closed.status, 404);
      assert.equal(closed.body.error, 'Proyecto no encontrado o no recibe donaciones');
      assert.equal(await count(), before);
    });

    test('Mercado Pago sin configurar → 503, sin crear nada', async () => {
      configured = false;
      const before = await count();
      const r = await donate(maria, { project_id: 'proj-1', amount: 1500 });
      assert.equal(r.status, 503);
      assert.equal(r.body.error, 'Las donaciones no están disponibles por el momento');
      assert.equal(await count(), before);
    });

    test('Mercado Pago falla al crear la preferencia → 502 y la donación queda "fallida"', async () => {
      failPreference = true;
      const before = await count();
      const r = await donate(maria, { project_id: 'proj-1', amount: 1500 });
      assert.equal(r.status, 502);
      assert.equal(r.body.error, 'No pudimos iniciar el pago. Probá de nuevo en un momento.');
      assert.equal(await count(), before + 1);
      const d = await row(lastPreference.donationId);
      assert.equal(d.estado, 'fallida');
      assert.equal(d.external_id, null);
    });

    test('más de 10 intentos por hora → 429 con Retry-After', async () => {
      const lucia = await login('lucia@example.com');
      for (let i = 0; i < 10; i++) assert.equal((await donate(lucia, { project_id: 'proj-1', amount: 100 })).status, 201, `donación ${i + 1}`);
      prefs = [];
      const r = await donate(lucia, { project_id: 'proj-1', amount: 100 });
      assert.equal(r.status, 429);
      assert.ok(Number(r.headers.get('retry-after')) > 0);
      assert.equal(r.body.error, 'Hiciste muchas donaciones seguidas. Esperá un rato e intentá de nuevo.');
      assert.equal(prefs.length, 0);
    });
  });

  describe('applyPayment(): la única transición', () => {
    // Directo en la base (como la deja POST /api/donaciones): así applyPayment se prueba aislada y sin chocar con el
    // límite de 10 donaciones por hora de cada usuario.
    let seq = 0;
    const newDonation = async (amount = 1500, who = maria) => {
      const id = `don-test-${++seq}`;
      await db.run(
        `INSERT INTO donaciones (id, user_id, project_id, ngo_id, monto, estado, moneda, external_id)
         VALUES ($1,$2,'proj-1','ngo-1',$3,'pendiente','ARS',$4)`,
        [id, who.id, amount, `pref-${id}`]
      );
      return id;
    };
    const approved = (donationId, over = {}) => ({ status: 'approved', externalReference: donationId, amount: 1500, currency: 'ARS', ...over });

    test('pago aprobado que coincide → completada, guarda el pago y suma a recaudado; avisa a la ONG', async () => {
      const id = await newDonation();
      const notifBefore = await ngoNotifications();
      payment = approved(id);
      assert.deepEqual(await donaciones.applyPayment('pay-1'), { result: 'credited', donationId: id });
      const d = await row(id);
      assert.equal(d.estado, 'completada');
      assert.equal(d.external_payment_id, 'pay-1');
      assert.equal(d.external_status, 'approved');
      assert.equal(await recaudado(), 1500);
      assert.equal(await ngoNotifications(), notifBefore + 1);
    });

    test('el mismo pago dos veces → se acredita UNA vez', async () => {
      const id = await newDonation();
      payment = approved(id);
      assert.equal((await donaciones.applyPayment('pay-2')).result, 'credited');
      assert.deepEqual(await donaciones.applyPayment('pay-2'), { result: 'already', donationId: id });
      assert.equal(await recaudado(), 1500);
    });

    test('cinco a la vez (aviso + conciliación + reintentos) → una sola acreditación', async () => {
      const id = await newDonation();
      payment = approved(id);
      const results = await Promise.all(Array.from({ length: 5 }, () => donaciones.applyPayment('pay-3')));
      assert.equal(results.filter((r) => r.result === 'credited').length, 1, JSON.stringify(results));
      assert.equal(results.filter((r) => r.result === 'already').length, 4);
      assert.equal(await recaudado(), 1500);
      assert.equal((await row(id)).estado, 'completada');
    });

    test('monto o moneda distintos → NO se acredita (queda pendiente)', async () => {
      for (const over of [{ amount: 1 }, { amount: 1499 }, { amount: 1501 }, { amount: null }, { currency: 'USD' }, { currency: null }]) {
        const id = await newDonation();
        payment = approved(id, over);
        assert.deepEqual(await donaciones.applyPayment('pay-x'), { result: 'amount_mismatch', donationId: id }, JSON.stringify(over));
        assert.equal((await row(id)).estado, 'pendiente');
      }
      assert.equal(await recaudado(), 0);
    });

    test('rechazado o pendiente → no cambia el estado (se puede reintentar) y guarda el estado de MP', async () => {
      const id = await newDonation();
      for (const status of ['rejected', 'cancelled', 'pending', 'in_process']) {
        payment = approved(id, { status });
        assert.deepEqual(await donaciones.applyPayment('pay-r'), { result: 'not_approved', donationId: id });
        const d = await row(id);
        assert.equal(d.estado, 'pendiente');
        assert.equal(d.external_status, status);
      }
      assert.equal(await recaudado(), 0);
    });

    test('un primer intento rechazado y un segundo aprobado (misma preferencia) → se acredita', async () => {
      const id = await newDonation();
      payment = approved(id, { status: 'rejected' });
      assert.equal((await donaciones.applyPayment('pay-intento-1')).result, 'not_approved');
      payment = approved(id);
      assert.equal((await donaciones.applyPayment('pay-intento-2')).result, 'credited');
      assert.equal((await row(id)).external_payment_id, 'pay-intento-2');
      assert.equal(await recaudado(), 1500);
    });

    test('un aviso de un rechazo que llega tarde no pisa una donación ya completada', async () => {
      const id = await newDonation();
      payment = approved(id);
      await donaciones.applyPayment('pay-ok');
      payment = approved(id, { status: 'rejected' });
      await donaciones.applyPayment('pay-viejo');
      const d = await row(id);
      assert.equal(d.estado, 'completada');
      assert.equal(d.external_status, 'approved');
      assert.equal(d.external_payment_id, 'pay-ok');
    });

    test('sin external_reference → ignored; referencia a una donación que no existe → unknown_donation', async () => {
      payment = { status: 'approved', externalReference: null, amount: 1500, currency: 'ARS' };
      assert.deepEqual(await donaciones.applyPayment('pay-sin-ref'), { result: 'ignored' });
      payment = approved('no-existe');
      assert.deepEqual(await donaciones.applyPayment('pay-otra'), { result: 'unknown_donation' });
      assert.equal(await recaudado(), 0);
    });

    test('con expectDonationId: un pago de OTRA donación → mismatch, sin acreditar ninguna', async () => {
      const mine = await newDonation();
      const other = await newDonation(1500, juan);
      payment = approved(other);
      assert.deepEqual(await donaciones.applyPayment('pay-ajeno', { expectDonationId: mine }), { result: 'mismatch' });
      assert.equal((await row(other)).estado, 'pendiente');
      assert.equal((await row(mine)).estado, 'pendiente');
      assert.equal(await recaudado(), 0);
    });

    test('si Mercado Pago falla al consultar, el error sube (el que llama decide) y no cambia nada', async () => {
      const id = await newDonation();
      payment = () => { throw new payments.PaymentError('Mercado Pago respondió 404: not found', { status: 404, code: 'not_found' }); };
      await assert.rejects(donaciones.applyPayment('pay-404'), (e) => e.code === 'not_found');
      assert.equal((await row(id)).estado, 'pendiente');
    });

    test('si falla la base a mitad de la transacción, no queda nada a medias y un reintento acredita', async () => {
      const id = await newDonation();
      payment = approved(id);
      const realTx = db.transaction;
      mock.method(db, 'transaction', (fn) => realTx.call(db, async (tx) => {
        const wrapped = Object.create(tx);
        wrapped.run = async (sql, params) => {
          if (/UPDATE projects SET recaudado/.test(sql)) throw new Error('falla simulada de la base');
          return tx.run(sql, params);
        };
        return fn(wrapped);
      }));
      try { await assert.rejects(donaciones.applyPayment('pay-tx')); }
      finally { db.transaction.mock.restore(); }
      assert.equal((await row(id)).estado, 'pendiente', 'el CAS se deshizo');
      assert.equal(await recaudado(), 0);
      assert.equal((await donaciones.applyPayment('pay-tx')).result, 'credited');
      assert.equal(await recaudado(), 1500);
    });

    test('una donación cuyo proyecto se borró (project_id NULL) se completa sin sumar a ningún proyecto', async () => {
      const id = await newDonation();
      await db.run('UPDATE donaciones SET project_id=NULL WHERE id=$1', [id]);
      payment = approved(id);
      assert.equal((await donaciones.applyPayment('pay-huerfana')).result, 'credited');
      assert.equal((await row(id)).estado, 'completada');
      assert.equal(await recaudado(), 0);
    });

    test('si falla la notificación, la acreditación igual queda', async () => {
      const id = await newDonation();
      payment = approved(id);
      const realRun = db.run;
      mock.method(db, 'run', async (sql, params) => {
        if (/INSERT INTO notifications/.test(sql)) throw new Error('falla simulada');
        return realRun.call(db, sql, params);
      });
      try { assert.equal((await donaciones.applyPayment('pay-notif')).result, 'credited'); }
      finally { db.run.mock.restore(); }
      assert.equal((await row(id)).estado, 'completada');
      assert.equal(await recaudado(), 1500);
    });
  });
});
