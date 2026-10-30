// src/lib/authCommon.js — lo que comparten routes/auth.js y routes/authPassword.js (§290): las validaciones del
// registro, la respuesta 429 de los límites de intentos, el hash de los códigos de un solo uso y la URL de la app.
// Sacado de auth.js al separar las contraseñas, para no copiarlo (AI_RULES regla 3). Sin base ni red: se puede
// probar aislado.
const { createHash } = require('node:crypto');

// ── Validaciones ──────────────────────────────────────────────────────────
// Dominio con un punto que no sea el primer carácter y con 2 o más caracteres después. Antes,
// [^\s@]+\.[^\s@]{2,}: el punto entraba en las dos clases y el backtracking era cuadrático (SonarCloud S8786,
// §201 y §231). Ahora se busca el primer punto después del primer carácter: acepta lo mismo.
const EMAIL_RE = /^[^\s@]+@[^\s@][^\s@.]*\.[^\s@]{2,}$/;
const NAME_RE  = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]{2,50}$/;

// `typeof v !== 'string'` primero: antes un número o un array reventaba en `.trim()` y daba 500 (REVISION B13).
// Largo máximo ANTES del regex: con el EMAIL_RE viejo, un email de 80 mil caracteres bloqueaba la API 3,4 s por
// pedido (§201). El regex ya es lineal (§231); el tope queda porque 254 es el máximo de RFC 5321.
const EMAIL_MAX = 254;
function validateEmail(v) {
  if (typeof v !== 'string') return 'Email inválido';
  const email = v.trim();
  if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) return 'Email inválido';
  return null;
}
function validateName(v)     { if (typeof v !== 'string' || !NAME_RE.test(v.trim()))  return 'Solo letras y espacios, mínimo 2 caracteres'; return null; }
// bcryptjs usa solo los primeros 72 bytes: dos contraseñas iguales en esos bytes valdrían como la misma. Se
// cuentan bytes UTF-8, no caracteres (la ñ ocupa 2, un emoji 4). Solo se aplica al FIJARLA: el login no la
// llama, así que una cuenta vieja con una contraseña más larga sigue entrando. Mismo límite en AuthModal.tsx.
const PASSWORD_MAX_BYTES = 72;
function validatePassword(v) {
  if (typeof v !== 'string' || v.length < 8) return 'Mínimo 8 caracteres';
  if (Buffer.byteLength(v, 'utf8') > PASSWORD_MAX_BYTES)
    return 'Máximo 72 caracteres (los acentos, la ñ y los emojis cuentan como más de uno)';
  if (!/[A-Z]/.test(v))       return 'Necesita al menos una mayúscula';
  if (!/[0-9]/.test(v))       return 'Necesita al menos un número';
  return null;
}

// 429 de los límites de intentos (lib/rateLimit), con Retry-After.
const tooMany = (res, seconds) => {
  res.set('Retry-After', String(seconds));
  return res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' });
};

// Los códigos de un solo uso (borrar la cuenta, recuperar la contraseña) se guardan como hash, nunca en claro.
const sha256 = (t) => createHash('sha256').update(t).digest('hex');
const appUrl = () => process.env.APP_URL || 'http://localhost:5173';

module.exports = { EMAIL_RE, validateEmail, validateName, validatePassword, tooMany, sha256, appUrl };
