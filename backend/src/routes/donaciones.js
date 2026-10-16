// src/routes/donaciones.js
//
// Donaciones a proyectos con Mercado Pago, Checkout Pro en modo prueba (PROJECT_ANALYSIS.md §170;
// BACKEND_ROADMAP_ANALYSIS.md §1.4; lib/payments.js en §169).
//
//   POST /api/donaciones  { project_id, amount }  → { donation_id, checkout_url }
//   applyPayment(paymentId, { expectDonationId? }) — la ÚNICA transición de una donación (la usan el webhook y la
//                                                    conciliación de la Etapa 8)
//
// Reglas:
//   - Montos en PESOS ENTEROS (100 a 500.000): `donaciones.monto` y `projects.recaudado` son REAL, que en Postgres es
//     float4 (~7 dígitos): con centavos, "lo pagado coincide con lo donado" fallaría por redondeo.
//   - La donación se inserta 'pendiente' EXPLÍCITO: el DEFAULT de la tabla es 'completada'.
//   - El estado SOLO cambia después de consultar el pago a Mercado Pago (payments.getPayment), nunca por el cuerpo de
//     un aviso ni por la URL de vuelta. Y solo `approved` lo cambia: un rechazo deja la donación pendiente, porque
//     Mercado Pago permite reintentar el pago con la misma preferencia.
//   - Acreditar = compare-and-swap 'pendiente' → 'completada' + `recaudado = recaudado + monto`, en UNA transacción
//     (regla 21). La notificación a la ONG va después del COMMIT.
//
// `payments.*` se llama por propiedad (no desestructurado) para poder reemplazarlo en los tests.

const express = require('express');
const { randomUUID } = require('node:crypto');
const db = require('../db');
const payments = require('../lib/payments');
const { createLimiter } = require('../lib/rateLimit');
const { checkText } = require('../lib/inputs');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const MIN_AMOUNT = 100;
const MAX_AMOUNT = 500000;
const DONATIONS_PER_USER = createLimiter({ max: 10, windowMs: 60 * 60 * 1000 });   // sin límite, se llenaría de pendientes
const appUrl = () => process.env.APP_URL || 'http://localhost:5173';
// URL pública de esta API, para el aviso de Mercado Pago. Render define RENDER_EXTERNAL_URL solo; en local no hay
// (Mercado Pago no puede llegar a localhost) y la donación se confirma por la conciliación.
const apiPublicUrl = () => (process.env.API_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');

function amountError(amount) {
  if (typeof amount !== 'number' || !Number.isInteger(amount)) return 'El monto tiene que ser un número entero de pesos';
  if (amount < MIN_AMOUNT) return 'El monto mínimo es de $100';
  if (amount > MAX_AMOUNT) return 'El monto máximo es de $500.000';
  return null;
}

// ── POST /api/donaciones ───────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('volunteer', 'company'), async (req, res) => {
  try {
    const wait = DONATIONS_PER_USER.blocked(req.user.id);
    if (wait) {
      res.set('Retry-After', String(wait));
      return res.status(429).json({ error: 'Hiciste muchas donaciones seguidas. Esperá un rato e intentá de nuevo.' });
    }
    if (!payments.isConfigured()) return res.status(503).json({ error: 'Las donaciones no están disponibles por el momento' });

    const { project_id: projectId, amount } = req.body || {};
    if (checkText(projectId, { label: 'El proyecto', max: 100, required: true })) {
      return res.status(400).json({ error: 'Falta el proyecto' });
    }
    const amountErr = amountError(amount);
    if (amountErr) return res.status(400).json({ error: amountErr });

    const project = await db.get('SELECT id, ngo_id, titulo, status FROM projects WHERE id=$1', [projectId.trim()]);
    if (!project || project.status !== 'active') {
      return res.status(404).json({ error: 'Proyecto no encontrado o no recibe donaciones' });
    }

    DONATIONS_PER_USER.hit(req.user.id);
    const id = randomUUID();   // regla 23: el id se genera acá y es el external_reference del pago
    await db.run(
      `INSERT INTO donaciones (id, user_id, project_id, ngo_id, monto, estado, moneda)
       VALUES ($1,$2,$3,$4,$5,'pendiente',$6)`,
      [id, req.user.id, project.id, project.ngo_id, amount, payments.CURRENCY]
    );

    let preference;
    try {
      const api = apiPublicUrl();
      preference = await payments.createPreference({
        donationId: id,
        title: `Donación: ${project.titulo}`.slice(0, 250),
        amount,
        successUrl: `${appUrl()}/donaciones/vuelta`,
        notificationUrl: api ? `${api}/api/donaciones/webhook` : undefined,
      });
    } catch (err) {
      console.error('POST /donaciones: no se pudo crear la preferencia:', err.message);
      await db.run(`UPDATE donaciones SET estado='fallida', external_status='preference_error' WHERE id=$1 AND estado='pendiente'`, [id])
        .catch((e) => console.error('POST /donaciones: no se pudo marcar fallida:', e.message));
      return res.status(502).json({ error: 'No pudimos iniciar el pago. Probá de nuevo en un momento.' });
    }

    await db.run('UPDATE donaciones SET external_id=$1 WHERE id=$2', [preference.preferenceId, id]);
    res.status(201).json({ donation_id: id, checkout_url: preference.checkoutUrl });
  } catch (err) {
    console.error('POST /donaciones error:', err);
    res.status(500).json({ error: 'Error al iniciar la donación' });
  }
});

// ── applyPayment ───────────────────────────────────────────────────────────
// Consulta el pago a Mercado Pago y, si corresponde, acredita la donación. Devuelve { result, donationId? }:
//   credited | already | amount_mismatch | not_approved | mismatch | unknown_donation | ignored.
// Si Mercado Pago falla al consultar, o la base a mitad de la transacción, LANZA: el que llama decide (el webhook
// responde 5xx para que Mercado Pago reintente).
async function applyPayment(paymentId, { expectDonationId } = {}) {
  const p = await payments.getPayment(paymentId);
  const ref = p.externalReference;
  if (!ref) return { result: 'ignored' };
  if (expectDonationId && ref !== expectDonationId) return { result: 'mismatch' };

  const d = await db.get('SELECT id, project_id, monto, moneda FROM donaciones WHERE id=$1', [ref]);
  if (!d) return { result: 'unknown_donation' };

  if (p.status !== 'approved') {
    // No cambia el estado: el comprador puede volver a intentar con la misma preferencia. Solo se anota qué dijo MP
    // (y nunca sobre una donación ya completada).
    await db.run(`UPDATE donaciones SET external_status=$1 WHERE id=$2 AND estado='pendiente'`, [p.status, d.id]);
    return { result: 'not_approved', donationId: d.id };
  }

  const monto = Number(d.monto);
  if (p.currency !== (d.moneda || payments.CURRENCY) || p.amount === null || Math.abs(p.amount - monto) > 0.001) {
    console.error(`applyPayment: el pago ${p.id} no coincide con la donación ${d.id} (pagó ${p.amount} ${p.currency}, esperaba ${monto} ${d.moneda})`);
    return { result: 'amount_mismatch', donationId: d.id };
  }

  let credited = false;
  await db.transaction(async (tx) => {
    const upd = await tx.run(
      `UPDATE donaciones SET estado='completada', external_payment_id=$1, external_status='approved'
       WHERE id=$2 AND estado='pendiente'`,
      [p.id, d.id]
    );
    if (upd.changes !== 1) return;
    credited = true;
    if (d.project_id) {
      await tx.run('UPDATE projects SET recaudado = COALESCE(recaudado, 0) + $1 WHERE id=$2', [monto, d.project_id]);
    }
  });
  if (!credited) return { result: 'already', donationId: d.id };

  // Después del COMMIT (regla 21): avisar a la ONG. Si falla, la acreditación ya quedó.
  if (d.project_id) {
    try {
      const ngo = await db.get(
        'SELECT n.user_id, p.titulo FROM projects p JOIN ngos n ON n.id = p.ngo_id WHERE p.id=$1', [d.project_id]);
      if (ngo) {
        await db.run(
          `INSERT INTO notifications (user_id, type, title, body, data) VALUES ($1,'donation_received','Recibiste una donación',$2,$3)`,
          [ngo.user_id, `Donaron $${monto.toLocaleString('es-AR')} a "${ngo.titulo}"`, JSON.stringify({ project_id: d.project_id, donation_id: d.id })]
        );
      }
    } catch (err) {
      console.error('applyPayment: no se pudo avisar a la ONG:', err.message);
    }
  }
  return { result: 'credited', donationId: d.id };
}

// ── POST /api/donaciones/webhook — aviso de Mercado Pago (§171) ────────────
// Público: Mercado Pago no manda sesión. Formatos (doc oficial de notificaciones):
//   - webhook: `?type=payment&data.id=<id>` + headers `x-signature`/`x-request-id` → se verifica la firma (el id que se
//     usa es el de la QUERY, que es lo firmado; nunca el del cuerpo) y se llama a applyPayment;
//   - IPN: `?topic=payment&id=<id>`. Según la doc, no se puede validar con la clave: se responde 200 y no se procesa
//     (la acreditación llega por el webhook o por la conciliación de GET /:id).
// Respuestas: 200 si se procesó o no hay nada que hacer; 401 firma inválida; 500 si falló Mercado Pago o la base, para
// que Mercado Pago reintente (lo hace cada 15 minutos). applyPayment es idempotente: un reintento no suma dos veces.
router.post('/webhook', async (req, res) => {
  const q = req.query || {};
  if (q.topic !== undefined && q.type === undefined) return res.json({ received: true });   // IPN: sin firma posible

  const dataId = typeof q['data.id'] === 'string' ? q['data.id'].trim() : '';
  const valid = payments.verifyWebhookSignature({
    xSignature: req.get('x-signature'), xRequestId: req.get('x-request-id'), dataId,
  });
  if (!valid) return res.status(401).json({ error: 'Firma inválida' });
  if (q.type !== 'payment') return res.json({ received: true });   // merchant_order, chargebacks, …: no se usan
  if (!dataId) return res.status(400).json({ error: 'Falta el id del pago' });

  try {
    await applyPayment(dataId);
  } catch (err) {
    if (err?.code === 'not_found') return res.json({ received: true });   // reintentar no lo va a encontrar
    console.error('POST /donaciones/webhook: no se pudo procesar el aviso:', err.message);
    return res.status(500).json({ error: 'No pudimos procesar el aviso' });
  }
  res.json({ received: true });
});

// ── GET /api/donaciones/:id?payment_id=… — estado y conciliación (§171) ────
// Solo quien donó (otra persona → 404, igual que si no existiera). Si sigue pendiente y viene `payment_id` (Mercado
// Pago lo agrega a la URL de vuelta), se le pregunta a Mercado Pago por ESE pago y applyPayment comprueba que sea de
// ESTA donación. Cubre el aviso perdido (la API gratuita de Render se duerme). Nunca se usa el `status` de la URL.
const STATUS_EN = { pendiente: 'pending', completada: 'completed', fallida: 'failed', reembolsada: 'refunded' };
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const load = () => db.get(
      `SELECT d.id, d.estado, d.monto, d.moneda, d.project_id, p.titulo AS project_title
       FROM donaciones d LEFT JOIN projects p ON p.id = d.project_id
       WHERE d.id = $1 AND d.user_id = $2`,
      [req.params.id, req.user.id]
    );
    let d = await load();
    if (!d) return res.status(404).json({ error: 'Donación no encontrada' });

    const paymentId = req.query.payment_id;
    if (d.estado === 'pendiente' && typeof paymentId === 'string' && /^\d{1,30}$/.test(paymentId) && payments.isConfigured()) {
      try {
        await applyPayment(paymentId, { expectDonationId: d.id });
        d = await load();
      } catch (err) {
        console.error('GET /donaciones/:id: no se pudo conciliar:', err.message);   // se responde el estado actual
      }
    }
    res.json({
      donation: {
        id: d.id,
        status: STATUS_EN[d.estado] ?? d.estado,
        amount: Number(d.monto),
        currency: d.moneda || payments.CURRENCY,
        project_id: d.project_id,
        project_title: d.project_title ?? null,
      },
    });
  } catch (err) {
    console.error('GET /donaciones/:id error:', err);
    res.status(500).json({ error: 'Error al obtener la donación' });
  }
});

module.exports = router;
module.exports.applyPayment = applyPayment;   // mismo patrón de exports que projects.js
