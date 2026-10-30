// src/routes/authPassword.js — las contraseñas: cambiarla con sesión, "¿Olvidaste tu contraseña?" y el aviso por
// email de que cambió (§272, §275, §278). Separado de routes/auth.js en §290 para bajar su complejidad; las rutas
// siguen bajo /api/auth (auth.js lo monta con router.use) y el comportamiento es el mismo.
const express = require('express');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('node:crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createLimiter } = require('../lib/rateLimit');
const email = require('../lib/email');       // por propiedad (email.sendEmail), para poder reemplazarlo en tests
const { passwordResetEmail, passwordChangedEmail } = require('../lib/emailTemplates');
const { forLog } = require('../lib/logSafe');   // S5145 (§202)
const { validateEmail, validatePassword, tooMany, sha256, appUrl } = require('../lib/authCommon');

const router = express.Router();

// ── PUT /api/auth/me/password ──────────────────────────────────────────────
// Cambiar la contraseña (§272): la actual tiene que ser la correcta y la nueva cumple las reglas del registro. Una
// actual equivocada da 400, no 401: el frontend cierra la sesión ante un 401. Límite de intentos fallidos por usuario,
// para que no se pueda adivinar la actual con una sesión robada. Límite conocido: los JWT ya emitidos (otros
// dispositivos) siguen valiendo hasta que vencen; no hay revocación de sesiones.
const PASSWORD_FAILS_PER_USER = createLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

// Aviso por email de que la contraseña cambió (§278): lo usan PUT /me/password y POST /reset-password, DESPUÉS de
// responder. Un email que falla (o que tira) no cambia el resultado: queda en el log. Nunca lleva la contraseña.
function notifyPasswordChanged(user) {
  const { subject, html } = passwordChangedEmail({ name: user.name, appUrl: appUrl() });
  Promise.resolve()
    .then(() => email.sendEmail({ to: user.email, subject, html }))
    .then((result) => { if (!result?.ok) console.error('Aviso de contraseña cambiada no enviado', forLog(result?.error || '')); })
    .catch((err) => console.error('Aviso de contraseña cambiada no enviado:', forLog(err?.message || '')));
}

router.put('/me/password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (typeof current_password !== 'string' || typeof new_password !== 'string' || !current_password)
      return res.status(400).json({ error: 'Contraseña actual y nueva requeridas' });
    const wait = PASSWORD_FAILS_PER_USER.blocked(req.user.id);
    if (wait) return tooMany(res, wait);

    const user = await db.get('SELECT password, name, email FROM users WHERE id=$1', [req.user.id]);
    if (!user || !(await bcrypt.compare(current_password, user.password))) {
      PASSWORD_FAILS_PER_USER.hit(req.user.id);
      return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    }
    const passErr = validatePassword(new_password);
    if (passErr) return res.status(400).json({ error: passErr });
    if (new_password === current_password)
      return res.status(400).json({ error: 'La nueva contraseña tiene que ser distinta de la actual' });

    await db.run('UPDATE users SET password=$1 WHERE id=$2', [await bcrypt.hash(new_password, 10), req.user.id]);
    PASSWORD_FAILS_PER_USER.reset(req.user.id);
    res.json({ message: 'Contraseña actualizada' });
    notifyPasswordChanged(user);
  } catch (err) {
    console.error('PUT /auth/me/password error:', err);
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
});

// ── "¿Olvidaste tu contraseña?" (PROJECT_ANALYSIS.md §275) ───────────────────────────────────────────────────
// 1) POST /forgot-password { email } (sin sesión): NO revela si el email tiene cuenta. La respuesta es siempre
//    { sent: true }, y el código y el email se hacen DESPUÉS de responder (así tampoco se nota por el tiempo ni por un
//    envío que falla). El único error que no depende del email es 503 sin Resend, igual para todos. Límites: 3 por email
//    por hora (cuenta exista o no la cuenta: si no, el 429 diría cuáles existen) y 20 por IP por hora.
// 2) POST /reset-password { token, new_password } (sin sesión): las reglas del registro se validan ANTES de gastar el
//    código; el código se consume con compare-and-swap (DELETE … y mirar `changes`) en la misma transacción que fija la
//    contraseña, así dos pedidos a la vez con el mismo link la cambian una sola vez. No inicia sesión.
// Límite conocido (como en PUT /me/password): los JWT ya emitidos siguen valiendo hasta que vencen.
const RESET_TTL_MS = 60 * 60 * 1000;
const RESETS_PER_EMAIL = createLimiter({ max: 3, windowMs: 60 * 60 * 1000 });
const RESETS_PER_IP    = createLimiter({ max: 20, windowMs: 60 * 60 * 1000 });
const INVALID_RESET_LINK = 'El link no es válido o ya se usó. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".';

async function sendResetLink(normEmail) {
  const user = await db.get('SELECT id, name, email FROM users WHERE email=$1', [normEmail]);
  if (!user) return;
  const token = randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM password_reset_tokens WHERE user_id=$1', [user.id]);   // un pedido nuevo invalida el anterior
    await tx.run('INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1,$2,$3)',
      [tokenHash, user.id, new Date(Date.now() + RESET_TTL_MS).toISOString()]);
  });
  // El email va DESPUÉS del COMMIT (regla 21). Si no sale, el link no sirve: se descarta.
  const { subject, html } = passwordResetEmail({ name: user.name, link: `${appUrl()}/restablecer?token=${token}` });
  const result = await email.sendEmail({ to: user.email, subject, html });
  if (!result?.ok) {
    await db.run('DELETE FROM password_reset_tokens WHERE token_hash=$1', [tokenHash]);
    console.error('POST /auth/forgot-password: no se pudo mandar el email', forLog(result?.error || ''));
  }
}

router.post('/forgot-password', async (req, res) => {
  try {
    const raw = req.body?.email;
    if (validateEmail(raw)) return res.status(400).json({ error: 'Email inválido' });
    if (!email.isConfigured()) {
      return res.status(503).json({ error: 'No podemos mandar emails por el momento, así que no se puede recuperar la contraseña.' });
    }
    const normEmail = raw.trim().toLowerCase();
    const waitIp = RESETS_PER_IP.blocked(req.ip);
    if (waitIp) return tooMany(res, waitIp);
    const waitEmail = RESETS_PER_EMAIL.blocked(normEmail);
    if (waitEmail) {
      res.set('Retry-After', String(waitEmail));
      return res.status(429).json({ error: 'Pediste recuperar la contraseña muchas veces seguidas. Esperá un rato.' });
    }
    RESETS_PER_IP.hit(req.ip);
    RESETS_PER_EMAIL.hit(normEmail);

    res.json({ sent: true });
    sendResetLink(normEmail).catch((err) => console.error('POST /auth/forgot-password error:', err));
  } catch (err) {
    console.error('POST /auth/forgot-password error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body || {};
    // base64url de 32 bytes = 43 caracteres. Cualquier otra cosa ni se busca.
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return res.status(400).json({ error: INVALID_RESET_LINK });
    const passErr = validatePassword(new_password);
    if (passErr) return res.status(400).json({ error: passErr });

    const tokenHash = sha256(token);
    const row = await db.get('SELECT user_id, expires_at FROM password_reset_tokens WHERE token_hash=$1', [tokenHash]);
    if (!row) return res.status(400).json({ error: INVALID_RESET_LINK });
    if (!(Date.parse(row.expires_at) > Date.now())) {
      await db.run('DELETE FROM password_reset_tokens WHERE token_hash=$1', [tokenHash]);
      return res.status(400).json({ error: 'El link venció. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".' });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    let used = false;
    await db.transaction(async (tx) => {
      const del = await tx.run('DELETE FROM password_reset_tokens WHERE token_hash=$1', [tokenHash]);
      if (del.changes !== 1) return;   // otro pedido con el mismo link llegó primero
      await tx.run('UPDATE users SET password=$1 WHERE id=$2', [hashed, row.user_id]);
      await tx.run('DELETE FROM password_reset_tokens WHERE user_id=$1', [row.user_id]);
      used = true;
    });
    if (!used) return res.status(400).json({ error: INVALID_RESET_LINK });
    res.json({ message: 'Contraseña actualizada' });
    const owner = await db.get('SELECT name, email FROM users WHERE id=$1', [row.user_id]);
    if (owner) notifyPasswordChanged(owner);
  } catch (err) {
    console.error('POST /auth/reset-password error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'No pudimos cambiar la contraseña. Probá de nuevo.' });
  }
});

module.exports = router;
