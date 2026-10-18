// src/lib/tokenCrypto.js
//
// Cifrado de los tokens de Mercado Pago de cada ONG (Marketplace, PROJECT_ANALYSIS.md §215). AES-256-GCM con
// `node:crypto`, sin dependencias.
//
//   MP_TOKEN_KEY — 32 bytes al azar en base64 (o base64url). NUNCA se loguea. Se genera una vez con
//                  `node -p "require('crypto').randomBytes(32).toString('base64')"` y se carga en el .env / el panel.
//                  Si se pierde o se cambia, los tokens guardados no se descifran: las ONGs vuelven a vincular.
//
// Formato guardado: `v1:<iv>:<tag>:<cifrado>` (base64url). IV de 12 bytes al azar por cifrado; tag de 16 bytes.
// El `ngo_id` va como dato asociado (AAD): un token copiado a la fila de otra ONG no se descifra. El prefijo `v1`
// deja lugar para rotar la clave más adelante.
//
// Los errores nunca incluyen el token, la clave ni el cifrado.

const crypto = require('node:crypto');

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

class TokenCryptoError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'TokenCryptoError';
    this.code = code;
  }
}

function getKey() {
  // Node acepta base64 y base64url con el mismo decodificador e ignora los espacios; vacío → 0 bytes.
  const key = Buffer.from(process.env.MP_TOKEN_KEY || '', 'base64');
  return key.length === 32 ? key : null;
}
const isTokenKeyConfigured = () => getKey() !== null;

function requireKey() {
  const key = getKey();
  if (!key) throw new TokenCryptoError('MP_TOKEN_KEY no está configurada (32 bytes en base64)', 'not_configured');
  return key;
}
function requireNgoId(ngoId) {
  if (typeof ngoId !== 'string' || !ngoId) throw new TokenCryptoError('Falta el ngo_id', 'bad_input');
  return Buffer.from(ngoId, 'utf8');
}

function encryptToken(token, ngoId) {
  if (typeof token !== 'string' || !token) throw new TokenCryptoError('Falta el token', 'bad_input');
  const aad = requireNgoId(ngoId);
  const key = requireKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ct.toString('base64url')].join(':');
}

function decryptToken(blob, ngoId) {
  const aad = requireNgoId(ngoId);
  const key = requireKey();
  const invalid = () => new TokenCryptoError('No se pudo descifrar el token', 'invalid');
  if (typeof blob !== 'string') throw invalid();
  const parts = blob.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) throw invalid();
  const [iv, tag, ct] = parts.slice(1).map((p) => Buffer.from(p, 'base64url'));
  // No hace falta chequear largos: con authTagLength fijo, un tag de otro largo hace fallar setAuthTag, y cualquier
  // cambio del IV o del cifrado falla la autenticación de GCM. Todo termina en el catch.
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    throw invalid();
  }
}

module.exports = { TokenCryptoError, encryptToken, decryptToken, isTokenKeyConfigured };
