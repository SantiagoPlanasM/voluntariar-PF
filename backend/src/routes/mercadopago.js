// src/routes/mercadopago.js
//
// La ONG vincula su cuenta de vendedor de Mercado Pago (Marketplace, PROJECT_ANALYSIS.md §216). Todo en MODO PRUEBA.
// Montado en /api/ngos/me/mercadopago (antes que /api/ngos, src/index.js).
//
//   GET    /           → { account: null | { mp_user_id, status, origin, expires_at }, oauth_available }
//   POST   /connect    → { authorization_url }
//   POST   /callback   { code, state } → { account }
//   DELETE /           → { disconnected }
//
// Flujo: /connect genera un `state` al azar (32 bytes) y guarda SOLO su hash, 10 minutos, uno por ONG (un connect
// nuevo invalida el anterior). La ONG autoriza en Mercado Pago, que la devuelve a la pantalla del frontend
// (MP_OAUTH_REDIRECT_URI = <APP_URL>/ngo/mercadopago/vuelta), y esa pantalla llama a /callback CON LA SESIÓN de la
// ONG: así se comprueba que el state sea de esa ONG sin exponer un endpoint público. El state se consume (DELETE con
// `changes`) ANTES de intercambiar el code, fuera de toda transacción (regla 21: la llamada externa va aparte).
//
// Nunca se devuelven ni se loguean los tokens, el code ni el state. `payments.*` se llama por propiedad (tests).

const express = require('express');
const crypto = require('node:crypto');
const db = require('../db');
const payments = require('../lib/payments');
const tokenCrypto = require('../lib/tokenCrypto');
const sellerAccounts = require('../lib/sellerAccounts');
const { requireAuth, requireRole } = require('../middleware/auth');
const { checkText } = require('../lib/inputs');

const router = express.Router();
router.use(requireAuth, requireRole('ngo'));

const STATE_TTL_MS = 10 * 60 * 1000;   // el code de Mercado Pago también dura 10 minutos (§181)
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const oauthAvailable = () => payments.isOAuthConfigured() && tokenCrypto.isTokenKeyConfigured();

async function myNgoId(req, res) {
  const ngo = await db.get('SELECT id FROM ngos WHERE user_id=$1', [req.user.id]);
  if (!ngo) res.status(404).json({ error: 'ONG no encontrada' });
  return ngo?.id ?? null;
}

// ── GET / ──────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const ngoId = await myNgoId(req, res);
    if (!ngoId) return;
    res.json({ account: await sellerAccounts.publicAccount(ngoId), oauth_available: oauthAvailable() });
  } catch (err) {
    console.error('GET /ngos/me/mercadopago error:', err.message);
    res.status(500).json({ error: 'Error al obtener la cuenta de Mercado Pago' });
  }
});

// ── POST /connect ──────────────────────────────────────────────────────────
router.post('/connect', async (req, res) => {
  try {
    const ngoId = await myNgoId(req, res);
    if (!ngoId) return;
    if (!oauthAvailable()) return res.status(503).json({ error: 'La vinculación con Mercado Pago no está disponible por el momento' });

    const state = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();
    await db.transaction(async (tx) => {
      await tx.run('DELETE FROM mp_oauth_states WHERE ngo_id=$1', [ngoId]);
      await tx.run('INSERT INTO mp_oauth_states (state_hash, ngo_id, expires_at) VALUES ($1,$2,$3)', [sha256(state), ngoId, expiresAt]);
    });
    res.json({ authorization_url: payments.authorizationUrl(state) });
  } catch (err) {
    console.error('POST /ngos/me/mercadopago/connect error:', err.message);
    res.status(500).json({ error: 'No pudimos iniciar la vinculación' });
  }
});

// ── POST /callback ─────────────────────────────────────────────────────────
const EXCHANGE_ERRORS = {
  invalid_grant: [400, 'El permiso de Mercado Pago venció o ya se usó. Probá vincular de nuevo.'],
  live_token: [400, 'Solo se pueden vincular cuentas de prueba de Mercado Pago.'],
};
router.post('/callback', async (req, res) => {
  try {
    const ngoId = await myNgoId(req, res);
    if (!ngoId) return;
    const { code, state } = req.body || {};
    if (checkText(code, { label: 'code', max: 500, required: true }) || checkText(state, { label: 'state', max: 200, required: true })) {
      return res.status(400).json({ error: 'Faltan datos de la vuelta de Mercado Pago. Probá vincular de nuevo.' });
    }
    if (!oauthAvailable()) return res.status(503).json({ error: 'La vinculación con Mercado Pago no está disponible por el momento' });

    // De un solo uso: solo sigue el pedido que efectivamente lo borra. El de otra ONG no lo encuentra (ni lo borra).
    const hash = sha256(state);
    const row = await db.get('SELECT expires_at FROM mp_oauth_states WHERE state_hash=$1 AND ngo_id=$2', [hash, ngoId]);
    const consumed = row && (await db.run('DELETE FROM mp_oauth_states WHERE state_hash=$1', [hash])).changes === 1;
    if (!consumed) return res.status(400).json({ error: 'El link de vinculación no es válido. Probá vincular de nuevo.' });
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'El link de vinculación venció. Probá vincular de nuevo.' });
    }

    let tokens;
    try {
      tokens = await payments.exchangeCode(code);
    } catch (err) {
      const [status, msg] = EXCHANGE_ERRORS[err?.code] ?? [502, 'Mercado Pago no respondió bien. Probá de nuevo en un momento.'];
      // Solo el código del error: el mensaje puede traer partes de la respuesta de Mercado Pago.
      console.error(`POST /ngos/me/mercadopago/callback: el intercambio falló (${err?.code ?? 'desconocido'}, HTTP ${err?.status ?? '-'})`);
      return res.status(status).json({ error: msg });
    }

    const saved = await sellerAccounts.saveAccount(ngoId, tokens, 'oauth');
    if (saved.conflict) return res.status(409).json({ error: 'Esa cuenta de Mercado Pago ya está vinculada a otra ONG.' });
    console.log(`[mercadopago] ONG ${ngoId} vinculó la cuenta ${tokens.mpUserId}`);
    res.json({ account: await sellerAccounts.publicAccount(ngoId) });
  } catch (err) {
    console.error('POST /ngos/me/mercadopago/callback error:', err.message);
    res.status(500).json({ error: 'No pudimos terminar la vinculación' });
  }
});

// ── DELETE / ───────────────────────────────────────────────────────────────
// Mercado Pago no tiene un endpoint para que la aplicación revoque la autorización (IA de Mercado Pago, §215): se
// borran los tokens propios. La ONG puede revocar el permiso desde su cuenta de Mercado Pago.
router.delete('/', async (req, res) => {
  try {
    const ngoId = await myNgoId(req, res);
    if (!ngoId) return;
    res.json({ disconnected: await sellerAccounts.deleteAccount(ngoId) });
  } catch (err) {
    console.error('DELETE /ngos/me/mercadopago error:', err.message);
    res.status(500).json({ error: 'No pudimos desvincular la cuenta' });
  }
});

module.exports = router;
