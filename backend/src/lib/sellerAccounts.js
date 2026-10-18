// src/lib/sellerAccounts.js
//
// La cuenta de Mercado Pago de cada ONG (Marketplace, PROJECT_ANALYSIS.md §216). Es el ÚNICO lugar que lee o escribe
// `ngo_cuentas_mp`: los tokens entran y salen cifrados por acá (lib/tokenCrypto.js) y nunca se devuelven al cliente
// ni se loguean.

const db = require('../db');
const tokenCrypto = require('./tokenCrypto');
const payments = require('./payments');   // por propiedad (payments.refreshAccessToken), para los tests
const { isUniqueViolation } = require('./dbErrors');

const STATUS_EN = { activa: 'active', requiere_reconexion: 'needs_reconnect' };
const ORIGIN_EN = { oauth: 'oauth', manual: 'manual' };

/** Lo que puede ver la ONG de su cuenta (sin tokens), o null. */
async function publicAccount(ngoId) {
  const row = await db.get('SELECT mp_user_id, estado, origen, expires_at FROM ngo_cuentas_mp WHERE ngo_id=$1', [ngoId]);
  if (!row) return null;
  return {
    mp_user_id: row.mp_user_id,
    status: STATUS_EN[row.estado] ?? row.estado,
    origin: ORIGIN_EN[row.origen] ?? row.origen,
    expires_at: row.expires_at ?? null,
  };
}

/**
 * Guarda (o reemplaza) la cuenta de una ONG. `tokens`: { accessToken, refreshToken?, mpUserId, expiresIn? }.
 * Devuelve { ok: true } o { conflict: true } si esa cuenta de Mercado Pago ya es de otra ONG.
 */
async function saveAccount(ngoId, { accessToken, refreshToken = null, mpUserId, expiresIn = null }, origin = 'oauth') {
  const access = tokenCrypto.encryptToken(accessToken, ngoId);
  const refresh = refreshToken ? tokenCrypto.encryptToken(refreshToken, ngoId) : null;
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  try {
    await db.transaction(async (tx) => {
      const upd = await tx.run(
        `UPDATE ngo_cuentas_mp SET mp_user_id=$1, access_token_cifrado=$2, refresh_token_cifrado=$3, expires_at=$4,
           estado='activa', origen=$5, version = version + 1, updated_at=CURRENT_TIMESTAMP
         WHERE ngo_id=$6`,
        [mpUserId, access, refresh, expiresAt, origin, ngoId]
      );
      if (upd.changes === 1) return;
      await tx.run(
        `INSERT INTO ngo_cuentas_mp (ngo_id, mp_user_id, access_token_cifrado, refresh_token_cifrado, expires_at, estado, origen, version)
         VALUES ($1,$2,$3,$4,$5,'activa',$6,1)`,
        [ngoId, mpUserId, access, refresh, expiresAt, origin]
      );
    });
  } catch (err) {
    // UNIQUE de mp_user_id (otra ONG) o, en una carrera, de ngo_id (dos vinculaciones de la misma ONG a la vez).
    if (isUniqueViolation(err)) return { conflict: true };
    throw err;
  }
  return { ok: true };
}

/** Desvincula: borra la fila con los tokens. Devuelve si había una. */
async function deleteAccount(ngoId) {
  const r = await db.run('DELETE FROM ngo_cuentas_mp WHERE ngo_id=$1', [ngoId]);
  return r.changes === 1;
}

// ── Token vigente para cobrar (§217) ────────────────────────────────────────────────────────────────────────────
// Se renueva cuando se va a usar, si faltan menos de 7 días (no hay cron: Render gratis se duerme). El refresh token
// cambia en cada renovación (IA de Mercado Pago, §215), así que dos renovaciones a la vez se pisarían:
//   - en este proceso, una sola por ONG (`inflight`);
//   - entre procesos, compare-and-swap sobre `version`: el que pierde relee y usa los tokens del otro. Un
//     invalid_grant con la versión ya cambiada es justamente eso, y no marca la cuenta.
const REFRESH_MARGIN_MS = 7 * 24 * 60 * 60 * 1000;
const inflight = new Map();

class SellerAccountError extends Error {
  // not_linked: la ONG no vinculó una cuenta. needs_reconnect: hay que volver a vincular. unavailable: transitorio
  // o falta configuración (MP_TOKEN_KEY).
  constructor(message, code) {
    super(message);
    this.name = 'SellerAccountError';
    this.code = code;
  }
}
const needsReconnect = () => new SellerAccountError('La cuenta de Mercado Pago de la ONG requiere reconexión', 'needs_reconnect');

const loadRow = (ngoId) => db.get(
  `SELECT ngo_id, mp_user_id, access_token_cifrado, refresh_token_cifrado, expires_at, estado, version
   FROM ngo_cuentas_mp WHERE ngo_id=$1`, [ngoId]);

/**
 * Marca la cuenta como "requiere reconexión" solo si sigue en la versión `version` (si otro proceso la renovó, no).
 * Avisa a la ONG con una notificación, después del UPDATE. Devuelve si la marcó.
 */
async function markNeedsReconnect(ngoId, version) {
  const r = await db.run(
    `UPDATE ngo_cuentas_mp SET estado='requiere_reconexion', version = version + 1, updated_at=CURRENT_TIMESTAMP
     WHERE ngo_id=$1 AND version=$2`, [ngoId, version]);   // todo cambio de estado o de tokens sube version
  if (r.changes !== 1) return false;
  console.warn(`[mercadopago] la cuenta de la ONG ${ngoId} requiere reconexión`);
  try {
    const ngo = await db.get('SELECT user_id FROM ngos WHERE id=$1', [ngoId]);
    if (ngo) {
      await db.run(
        `INSERT INTO notifications (user_id, type, title, body, data) VALUES ($1,'mp_reconnect_needed',$2,$3,$4)`,
        [ngo.user_id, 'Volvé a vincular Mercado Pago',
          'Tu cuenta de Mercado Pago dejó de funcionar y no podés recibir donaciones. Vinculala de nuevo desde tu perfil.',
          JSON.stringify({ ngo_id: ngoId })]);
    }
  } catch (err) {
    console.error('markNeedsReconnect: no se pudo avisar a la ONG:', err.message);
  }
  return true;
}

// Descifra una fila activa. Si el token no se descifra (cambió MP_TOKEN_KEY), la cuenta requiere reconexión. La falta
// de clave no llega acá: getValidToken la chequea antes.
async function tokenFrom(row) {
  if (row.estado !== 'activa') throw needsReconnect();
  try {
    return { accessToken: tokenCrypto.decryptToken(row.access_token_cifrado, row.ngo_id), mpUserId: row.mp_user_id, version: Number(row.version) };
  } catch (err) {
    await markNeedsReconnect(row.ngo_id, row.version);
    throw needsReconnect();
  }
}

// Relee después de perder una carrera con otro proceso.
async function reread(ngoId) {
  const row = await loadRow(ngoId);
  if (!row) throw new SellerAccountError('La ONG no tiene una cuenta de Mercado Pago', 'not_linked');
  return tokenFrom(row);
}

async function refresh(row, expiresMs) {
  const current = await tokenFrom(row);
  let tokens;
  try {
    tokens = await payments.refreshAccessToken(tokenCrypto.decryptToken(row.refresh_token_cifrado, row.ngo_id));
  } catch (err) {
    if (err.code === 'invalid_grant' || err.code === 'live_token' || err.code === 'invalid') {
      if (await markNeedsReconnect(row.ngo_id, row.version)) throw needsReconnect();
      return reread(row.ngo_id);   // otro proceso la renovó (o la marcó) primero
    }
    console.error(`[mercadopago] no se pudo renovar el token de la ONG ${row.ngo_id} (${err.code ?? 'desconocido'})`);
    if (expiresMs > Date.now()) return current;   // todavía vale: se reintenta la próxima vez
    throw new SellerAccountError('No se pudo renovar el token de Mercado Pago', 'unavailable');
  }
  const upd = await db.run(
    `UPDATE ngo_cuentas_mp SET access_token_cifrado=$1, refresh_token_cifrado=$2, expires_at=$3, version = version + 1,
       updated_at=CURRENT_TIMESTAMP
     WHERE ngo_id=$4 AND version=$5 AND estado='activa'`,
    [tokenCrypto.encryptToken(tokens.accessToken, row.ngo_id), tokenCrypto.encryptToken(tokens.refreshToken, row.ngo_id),
      new Date(Date.now() + tokens.expiresIn * 1000).toISOString(), row.ngo_id, row.version]);
  if (upd.changes !== 1) return reread(row.ngo_id);
  return { accessToken: tokens.accessToken, mpUserId: row.mp_user_id, version: Number(row.version) + 1 };
}

/**
 * Token con el que cobrar a nombre de la ONG: { accessToken, mpUserId, version }. Renueva si hace falta.
 * Lanza SellerAccountError (not_linked | needs_reconnect | unavailable).
 */
async function getValidToken(ngoId) {
  if (!tokenCrypto.isTokenKeyConfigured()) throw new SellerAccountError('Falta MP_TOKEN_KEY', 'unavailable');
  const row = await loadRow(ngoId);
  if (!row) throw new SellerAccountError('La ONG no tiene una cuenta de Mercado Pago', 'not_linked');
  const expiresMs = row.expires_at ? new Date(row.expires_at).getTime() : null;
  // Sin vencimiento (carga manual, sin refresh token) o con tiempo por delante: se usa tal cual. Una cuenta que
  // requiere reconexión la rechaza tokenFrom (también al principio de refresh).
  if (expiresMs === null || expiresMs - Date.now() > REFRESH_MARGIN_MS) {
    return tokenFrom(row);
  }
  if (!inflight.has(ngoId)) inflight.set(ngoId, refresh(row, expiresMs).finally(() => inflight.delete(ngoId)));
  return inflight.get(ngoId);
}

/** La ONG dueña de una cuenta de Mercado Pago, o null. */
async function findNgoByMpUser(mpUserId) {
  const row = await db.get('SELECT ngo_id FROM ngo_cuentas_mp WHERE mp_user_id=$1', [String(mpUserId)]);
  return row?.ngo_id ?? null;
}

/** ¿La ONG puede recibir donaciones? (una cuenta vinculada y activa) */
async function acceptsDonations(ngoId) {
  return Boolean(await db.get(`SELECT 1 AS ok FROM ngo_cuentas_mp WHERE ngo_id=$1 AND estado='activa'`, [ngoId]));
}

module.exports = {
  publicAccount, saveAccount, deleteAccount,
  SellerAccountError, getValidToken, markNeedsReconnect, findNgoByMpUser, acceptsDonations,
};
