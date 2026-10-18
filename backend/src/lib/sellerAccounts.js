// src/lib/sellerAccounts.js
//
// La cuenta de Mercado Pago de cada ONG (Marketplace, PROJECT_ANALYSIS.md §216). Es el ÚNICO lugar que lee o escribe
// `ngo_cuentas_mp`: los tokens entran y salen cifrados por acá (lib/tokenCrypto.js) y nunca se devuelven al cliente
// ni se loguean.

const db = require('../db');
const tokenCrypto = require('./tokenCrypto');
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

module.exports = { publicAccount, saveAccount, deleteAccount };
