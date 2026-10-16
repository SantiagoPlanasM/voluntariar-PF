// src/lib/payments.js
//
// Donaciones con Mercado Pago (Checkout Pro, modo prueba) por su API REST con fetch nativo, sin el SDK oficial:
// mismo criterio que lib/storage.js y lib/email.js (decisión P2 del usuario, PLAN_FALTANTE.md).
//
// Configuración (variables de entorno, leídas en cada llamada):
//   MP_ACCESS_TOKEN    — access token de la aplicación (de prueba: empieza con "TEST-"). NUNCA se loguea.
//   MP_WEBHOOK_SECRET  — clave secreta de los webhooks de la aplicación (Tus integraciones → Webhooks). Sin ella no se
//                        acepta ningún aviso.
//
// Fuente (verificada el 2026-10-16): el código del SDK oficial de Node, `mercadopago@3.6.1`, porque la documentación
// web carga esas partes con JavaScript. Base `https://api.mercadopago.com` (utils/config), `POST /checkout/preferences`
// (clients/preference/create), `GET /v1/payments/:id` (clients/payment/get) y la firma del webhook (utils/webhook):
//   x-signature: "ts=<ts>,v1=<hash>"   manifiesto: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" (sin las partes
//   vacías)   hash = HMAC-SHA256(secreto, manifiesto) en hex   comparación en tiempo constante. data.id NO se pasa a
//   minúsculas. Ver test/unit/payments.test.js.
//
// Los routes llaman a `payments.createPreference(...)` / `payments.getPayment(...)` accediendo a la propiedad (no
// desestructurado), para que los tests puedan reemplazarlas sin tocar Mercado Pago.

const crypto = require('node:crypto');

const API = 'https://api.mercadopago.com';
const TIMEOUT_MS = 20000;
const CURRENCY = 'ARS';

class PaymentError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.name = 'PaymentError';
    this.status = status;
    this.code = code;
  }
}

const getConfig = () => ({
  accessToken: (process.env.MP_ACCESS_TOKEN || '').trim(),
  webhookSecret: (process.env.MP_WEBHOOK_SECRET || '').trim(),
});
const isConfigured = () => Boolean(getConfig().accessToken);
const isTestToken = (token) => token.startsWith('TEST-');

async function call(method, path, { body, idempotencyKey } = {}) {
  const { accessToken } = getConfig();
  if (!accessToken) throw new PaymentError('Mercado Pago no está configurado', { code: 'not_configured' });
  const headers = { Authorization: `Bearer ${accessToken}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;

  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new PaymentError(`error de red con Mercado Pago: ${err.message}`, { code: 'network' });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    if (res.status === 401) console.error('[payments] Mercado Pago rechazó el access token. Revisá MP_ACCESS_TOKEN (sin espacios ni comillas).');
    throw new PaymentError(`Mercado Pago respondió ${res.status}: ${msg}`, { status: res.status, code: res.status === 404 ? 'not_found' : 'http' });
  }
  if (data === null) throw new PaymentError('Mercado Pago devolvió una respuesta que no es JSON', { code: 'bad_response' });
  return data;
}

/**
 * Crea la preferencia de Checkout Pro de una donación. `external_reference` es el id de la donación: así un pago se
 * puede atar a su fila. Devuelve { preferenceId, checkoutUrl }.
 */
async function createPreference({ donationId, title, amount, successUrl, notificationUrl }) {
  const data = await call('POST', '/checkout/preferences', {
    idempotencyKey: donationId,   // reintentar la misma donación no crea dos preferencias
    body: {
      items: [{ id: donationId, title, quantity: 1, unit_price: amount, currency_id: CURRENCY }],
      external_reference: donationId,
      back_urls: { success: successUrl, failure: successUrl, pending: successUrl },
      auto_return: 'approved',
      notification_url: notificationUrl,
    },
  });
  // Con un token de prueba, el link de sandbox (si viene); si no, el de producción.
  const checkoutUrl = (isTestToken(getConfig().accessToken) && data.sandbox_init_point) || data.init_point;
  if (!data.id || !checkoutUrl) {
    throw new PaymentError('Mercado Pago devolvió una preferencia sin id o sin link', { code: 'bad_response' });
  }
  return { preferenceId: String(data.id), checkoutUrl };
}

/** Consulta un pago. Es la ÚNICA fuente de verdad sobre si se pagó (nunca el aviso ni la URL de vuelta). */
async function getPayment(paymentId) {
  const id = typeof paymentId === 'number' ? String(paymentId) : typeof paymentId === 'string' ? paymentId.trim() : '';
  if (!id) throw new PaymentError('Falta el id del pago', { code: 'bad_request' });
  const data = await call('GET', `/v1/payments/${encodeURIComponent(id)}`);
  const amount = Number(data.transaction_amount);
  return {
    id: String(data.id ?? id),
    status: data.status ?? null,
    externalReference: data.external_reference ?? null,
    amount: Number.isFinite(amount) ? amount : null,
    currency: data.currency_id ?? null,
  };
}

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * ¿El aviso viene de Mercado Pago? Ver el encabezado del archivo. Nunca lanza: ante cualquier problema, false.
 * `dataId` es el `data.id` de la QUERY del aviso. Sin secreto configurado, siempre false.
 */
function verifyWebhookSignature({ xSignature, xRequestId, dataId, secret = getConfig().webhookSecret }) {
  if (typeof xSignature !== 'string' || !secret) return false;
  let ts = null;
  let v1 = null;
  for (const part of xSignature.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (key === 'ts') ts = value;
    else if (key === 'v1') v1 = value;
  }
  if (!ts || !/^\d+$/.test(ts) || !v1) return false;

  const clean = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
  const parts = [];
  if (clean(dataId)) parts.push(`id:${clean(dataId)}`);
  if (clean(xRequestId)) parts.push(`request-id:${clean(xRequestId)}`);
  parts.push(`ts:${ts}`);
  const expected = crypto.createHmac('sha256', secret).update(parts.join(';') + ';').digest('hex');
  return safeEqual(expected, v1);
}

/** Una línea para el log de arranque. Nunca incluye el token ni el secreto. */
function describePaymentsConfig() {
  const { accessToken, webhookSecret } = getConfig();
  if (!accessToken) return 'sin configurar (falta MP_ACCESS_TOKEN): no se pueden recibir donaciones';
  const mode = isTestToken(accessToken) ? 'Mercado Pago (modo prueba)' : 'Mercado Pago';
  return webhookSecret ? mode : `${mode}, sin MP_WEBHOOK_SECRET: no se aceptan avisos de pago`;
}

module.exports = {
  PaymentError, isConfigured, createPreference, getPayment, verifyWebhookSignature, describePaymentsConfig, CURRENCY,
};
