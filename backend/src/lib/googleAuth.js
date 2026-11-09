// src/lib/googleAuth.js — "Continuar con Google" (PROJECT_ANALYSIS.md §314).
//
// El frontend usa el botón de Google Identity Services, que devuelve un ID token (un JWT firmado por Google). Acá se
// verifica con la librería oficial (`google-auth-library`, decisión del usuario del 9/11): firma con las claves
// públicas de Google (las baja y las cachea), emisor, vencimiento y que la audiencia sea NUESTRO client id. Sin esa
// última comprobación, un token emitido para otra aplicación serviría para entrar acá.
//
// Configuración: GOOGLE_CLIENT_ID (el "ID de cliente" de OAuth de tipo Aplicación web; no es secreto). Sin él, el
// login con Google responde 503 y el frontend no muestra el botón (VITE_GOOGLE_CLIENT_ID).
//
// Las rutas llaman a `googleAuth.verifyCredential(...)` por propiedad, para poder reemplazarla en los tests.

const { OAuth2Client } = require('google-auth-library');

const MAX_CREDENTIAL = 4096;   // un ID token de Google ronda los 1.000–1.500 caracteres

class GoogleAuthError extends Error {
  // invalid: el token no vale (o no es de esta aplicación). not_configured: falta GOOGLE_CLIENT_ID.
  constructor(message, code) {
    super(message);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

const clientId = () => (process.env.GOOGLE_CLIENT_ID || '').trim();
const isConfigured = () => Boolean(clientId());

/**
 * Verifica el ID token y devuelve { sub, email (en minúsculas), emailVerified, name, givenName, familyName }.
 * `sub` es el id estable de la cuenta de Google; el mail puede cambiar. Lanza GoogleAuthError.
 */
async function verifyCredential(credential) {
  const audience = clientId();
  if (!audience) throw new GoogleAuthError('Falta GOOGLE_CLIENT_ID', 'not_configured');
  if (typeof credential !== 'string' || !credential.trim() || credential.length > MAX_CREDENTIAL) {
    throw new GoogleAuthError('Falta el token de Google', 'invalid');
  }
  let payload;
  try {
    const ticket = await new OAuth2Client(audience).verifyIdToken({ idToken: credential.trim(), audience });
    payload = ticket.getPayload();
  } catch (err) {
    throw new GoogleAuthError(`Google no validó el token: ${err.message}`, 'invalid');
  }
  if (!payload || typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string' || !payload.email) {
    throw new GoogleAuthError('El token de Google no trae la cuenta o el mail', 'invalid');
  }
  const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: text(payload.name),
    givenName: text(payload.given_name),
    familyName: text(payload.family_name),
  };
}

module.exports = { GoogleAuthError, isConfigured, verifyCredential };
