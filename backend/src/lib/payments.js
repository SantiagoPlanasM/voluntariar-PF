// src/lib/payments.js
//
// Donaciones con Mercado Pago (Checkout Pro, modo prueba) por su API REST con fetch nativo, sin el SDK oficial:
// mismo criterio que lib/storage.js y lib/email.js (decisión P2 del usuario, PLAN_FALTANTE.md).
//
// Configuración (variables de entorno, leídas en cada llamada):
//   MP_ACCESS_TOKEN    — access token de la aplicación. NUNCA se loguea. OJO (verificado en prod, §173): en el panel
//                        actual las credenciales de PRUEBA también empiezan con "APP_USR-"; "TEST-" es el formato viejo.
//   MP_WEBHOOK_SECRET  — clave secreta de los webhooks de la aplicación (Tus integraciones → Webhooks). Sin ella no se
//                        acepta ningún aviso.
//   MP_CLIENT_ID, MP_CLIENT_SECRET, MP_OAUTH_REDIRECT_URI — Marketplace (§215): la ONG vincula su cuenta de vendedor
//                        por OAuth y sus donaciones se cobran con su token. El secreto NUNCA se loguea.
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

async function send(method, path, headers, body) {
  try {
    return await fetch(`${API}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new PaymentError(`error de red con Mercado Pago: ${err.message}`, { code: 'network' });
  }
}

// `accessToken`: el de la ONG vinculada (Marketplace, §215). Sin él, el de la aplicación (MP_ACCESS_TOKEN): las
// donaciones de antes de §215 se cobraron con esa cuenta.
async function call(method, path, { body, idempotencyKey, accessToken: sellerToken } = {}) {
  const accessToken = sellerToken || getConfig().accessToken;
  if (!accessToken) throw new PaymentError('Mercado Pago no está configurado', { code: 'not_configured' });
  const headers = { Authorization: `Bearer ${accessToken}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;

  const res = await send(method, path, headers, body);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    if (res.status === 401 && !sellerToken) console.error('[payments] Mercado Pago rechazó el access token. Revisá MP_ACCESS_TOKEN (sin espacios ni comillas).');
    const code = res.status === 404 ? 'not_found' : res.status === 401 ? 'unauthorized' : 'http';
    throw new PaymentError(`Mercado Pago respondió ${res.status}: ${msg}`, { status: res.status, code });
  }
  if (data === null) throw new PaymentError('Mercado Pago devolvió una respuesta que no es JSON', { code: 'bad_response' });
  return data;
}

/**
 * Crea la preferencia de Checkout Pro de una donación. `external_reference` es el id de la donación: así un pago se
 * puede atar a su fila. Con `accessToken` (el de la ONG, §215) la plata se acredita en la cuenta de la ONG. Sin
 * comisión de la plataforma (decisión del usuario, §215): no se manda `marketplace_fee`. Devuelve
 * { preferenceId, checkoutUrl }.
 */
async function createPreference({ donationId, title, amount, successUrl, notificationUrl, accessToken }) {
  const data = await call('POST', '/checkout/preferences', {
    accessToken,
    idempotencyKey: donationId,   // reintentar la misma donación no crea dos preferencias
    body: {
      items: [{ id: donationId, title, quantity: 1, unit_price: amount, currency_id: CURRENCY }],
      external_reference: donationId,
      back_urls: { success: successUrl, failure: successUrl, pending: successUrl },
      auto_return: 'approved',
      notification_url: notificationUrl,
    },
  });
  // Con un token "TEST-" (formato viejo de prueba) se usa el link de sandbox, si viene. Con "APP_USR-" (producción, o
  // las credenciales de prueba del panel actual) se usa init_point: con las de prueba se paga LOGUEADO con el usuario
  // comprador de prueba; con la tarjeta sola, Mercado Pago responde "No pudimos procesar tu pago" (§173).
  const checkoutUrl = (isTestToken(accessToken || getConfig().accessToken) && data.sandbox_init_point) || data.init_point;
  if (!data.id || !checkoutUrl) {
    throw new PaymentError('Mercado Pago devolvió una preferencia sin id o sin link', { code: 'bad_response' });
  }
  return { preferenceId: String(data.id), checkoutUrl };
}

/** Consulta un pago. Es la ÚNICA fuente de verdad sobre si se pagó (nunca el aviso ni la URL de vuelta). */
async function getPayment(paymentId, { accessToken } = {}) {
  const id = typeof paymentId === 'number' ? String(paymentId) : typeof paymentId === 'string' ? paymentId.trim() : '';
  if (!id) throw new PaymentError('Falta el id del pago', { code: 'bad_request' });
  const data = await call('GET', `/v1/payments/${encodeURIComponent(id)}`, { accessToken });
  const amount = Number(data.transaction_amount);
  return {
    id: String(data.id ?? id),
    status: data.status ?? null,
    externalReference: data.external_reference ?? null,
    amount: Number.isFinite(amount) ? amount : null,
    currency: data.currency_id ?? null,
  };
}

// ── OAuth del Marketplace (§215): cada ONG vincula su cuenta de vendedor ──────────────────────────────────────────
// Fuentes en test/unit/payments-oauth.test.js. Todo en MODO PRUEBA: el intercambio va con test_token=true y se
// rechaza cualquier token con live_mode distinto de false.
const AUTH_URL = 'https://auth.mercadopago.com/authorization';
const getOAuthConfig = () => ({
  clientId: (process.env.MP_CLIENT_ID || '').trim(),
  clientSecret: (process.env.MP_CLIENT_SECRET || '').trim(),
  redirectUri: (process.env.MP_OAUTH_REDIRECT_URI || '').trim(),
});
const isOAuthConfigured = () => Object.values(getOAuthConfig()).every(Boolean);
function requireOAuthConfig() {
  if (!isOAuthConfigured()) {
    throw new PaymentError('La vinculación con Mercado Pago no está configurada', { code: 'not_configured' });
  }
  return getOAuthConfig();
}

/** URL a la que se manda a la ONG para que autorice la aplicación. `state` es de un solo uso (lo guarda el route). */
function authorizationUrl(state) {
  if (typeof state !== 'string' || !state) throw new PaymentError('Falta el state', { code: 'bad_request' });
  const { clientId, redirectUri } = requireOAuthConfig();
  const qs = new URLSearchParams({ client_id: clientId, response_type: 'code', platform_id: 'mp', state, redirect_uri: redirectUri });
  return `${AUTH_URL}?${qs}`;
}

// POST /oauth/token. Va SIN el access token de la aplicación: autentican client_id y client_secret. El cuerpo de un
// error puede repetir el code o el secreto: del error solo se toma el campo `error` si es un identificador corto.
async function oauthToken(body) {
  const res = await send('POST', '/oauth/token', { 'Content-Type': 'application/json' }, body);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = typeof data?.error === 'string' && /^[a-z_]{1,40}$/.test(data.error) ? data.error : null;
    throw new PaymentError(`Mercado Pago rechazó el pedido de token (${res.status}${err ? `, ${err}` : ''})`, {
      status: res.status, code: err === 'invalid_grant' ? 'invalid_grant' : 'http',
    });
  }
  if (data === null) throw new PaymentError('Mercado Pago devolvió una respuesta que no es JSON', { code: 'bad_response' });
  if (data.live_mode !== false) {
    throw new PaymentError('Mercado Pago devolvió un token productivo: solo se aceptan tokens de prueba', { code: 'live_token' });
  }
  const userId = typeof data.user_id === 'number' || typeof data.user_id === 'string' ? String(data.user_id) : '';
  const expiresIn = Number(data.expires_in);
  const isText = (v) => typeof v === 'string' && v.length > 0;
  if (!isText(data.access_token) || !isText(data.refresh_token) || !/^\d{1,20}$/.test(userId)
      || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new PaymentError('Mercado Pago devolvió un token incompleto', { code: 'bad_response' });
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, mpUserId: userId, expiresIn, liveMode: false };
}

/** Cambia el `code` de la vuelta de Mercado Pago por los tokens de la ONG (de prueba). */
async function exchangeCode(code) {
  if (typeof code !== 'string' || !code) throw new PaymentError('Falta el code', { code: 'bad_request' });
  const { clientId, clientSecret, redirectUri } = requireOAuthConfig();
  return oauthToken({
    client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri, test_token: true,
  });
}

/** Renueva el access token. Devuelve también el refresh token NUEVO: el viejo deja de servir. */
async function refreshAccessToken(refreshToken) {
  if (typeof refreshToken !== 'string' || !refreshToken) throw new PaymentError('Falta el refresh token', { code: 'bad_request' });
  const { clientId, clientSecret } = requireOAuthConfig();
  return oauthToken({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken });
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
  // Con APP_USR- no se puede saber desde acá si son credenciales de prueba o de producción (§173): no se afirma ninguna.
  const mode = isTestToken(accessToken) ? 'Mercado Pago (token TEST-: checkout de sandbox)' : 'Mercado Pago';
  return webhookSecret ? mode : `${mode}, sin MP_WEBHOOK_SECRET: no se aceptan avisos de pago`;
}

module.exports = {
  PaymentError, isConfigured, createPreference, getPayment, verifyWebhookSignature, describePaymentsConfig, CURRENCY,
  isOAuthConfigured, authorizationUrl, exchangeCode, refreshAccessToken,
};
