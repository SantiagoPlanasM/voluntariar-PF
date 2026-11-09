// src/routes/authGoogle.js — "Continuar con Google" (PROJECT_ANALYSIS.md §314). Se monta dentro de routes/auth.js.
//
//   POST /api/auth/google           { credential } → 200 { token, user }  o  200 { needs_registration, profile }
//   POST /api/auth/google/register  { credential, role, name, apellido? } → 201 { token, user }
//
// Decisiones del usuario (9/11):
//   - Sin cuenta: el frontend muestra la pantalla de rol y manda /google/register con la MISMA credencial (dura una
//     hora). No hay estado en el servidor entre los dos pasos: cada uno vuelve a verificar el token con Google.
//   - Un mail que ya tiene cuenta (creada con contraseña) se vincula solo, si Google dice que el mail está verificado.
//     Después se entra por `google_sub`, aunque el mail de Google cambie.
//   - La cuenta creada con Google no tiene contraseña usable (la columna es NOT NULL: se guarda el hash de 32 bytes
//     al azar que no se muestra). Si después quiere una, usa "¿Olvidaste tu contraseña?".
// `googleAuth.verifyCredential` se llama por propiedad, para reemplazarla en los tests.

const express = require('express');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('node:crypto');
const db = require('../db');
const googleAuth = require('../lib/googleAuth');
const { signToken } = require('../middleware/auth');
const { isUniqueViolation } = require('../lib/dbErrors');
const { createLimiter } = require('../lib/rateLimit');
const { tooMany } = require('../lib/authCommon');
const { validateSignup, createAccount } = require('../lib/accounts');

const router = express.Router();

// Cada pedido verifica un token (y, la primera vez, baja las claves de Google): tope por IP, como el registro.
const GOOGLE_PER_IP = createLimiter({ max: 60, windowMs: 15 * 60 * 1000 });
const NOT_AVAILABLE = 'El inicio de sesión con Google no está disponible';
const ALREADY_LINKED = 'Esa cuenta ya está vinculada a otra cuenta de Google';
const EMAIL_TAKEN = 'Ya existe una cuenta con ese email';

const session = (user) => ({
  token: signToken(user),
  user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
});

// Límite, configuración y verificación, comunes a las dos rutas. Si responde, devuelve null.
async function verified(req, res) {
  const wait = GOOGLE_PER_IP.blocked(req.ip);
  if (wait) { tooMany(res, wait); return null; }
  GOOGLE_PER_IP.hit(req.ip);
  if (!googleAuth.isConfigured()) { res.status(503).json({ error: NOT_AVAILABLE }); return null; }
  let google;
  try {
    google = await googleAuth.verifyCredential(req.body?.credential);
  } catch (err) {
    // `not_configured` no llega acá: isConfigured() ya lo filtró. Cualquier otro rechazo es un token que no vale.
    if (err instanceof googleAuth.GoogleAuthError) {
      res.status(401).json({ error: 'No pudimos verificar tu cuenta de Google. Probá de nuevo.' });
      return null;
    }
    throw err;
  }
  if (!google.emailVerified) { res.status(403).json({ error: 'Tu mail de Google no está verificado' }); return null; }
  return google;
}

const USER_COLS = 'id, name, email, role, avatar, google_sub';

// ── POST /api/auth/google ──────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const google = await verified(req, res);
    if (!google) return;

    const bySub = await db.get(`SELECT ${USER_COLS} FROM users WHERE google_sub=$1`, [google.sub]);
    if (bySub) return res.json({ message: 'Sesión iniciada', ...session(bySub) });

    const byEmail = await db.get(`SELECT ${USER_COLS} FROM users WHERE email=$1`, [google.email]);
    if (byEmail) {
      // Compare-and-swap (regla 21): solo si sigue sin vincular. Si no cambió nada, se relee: vinculada a ESTA cuenta
      // de Google (otro pedido igual, a la vez) → entra; a otra → 409.
      try {
        const upd = await db.run('UPDATE users SET google_sub=$1 WHERE id=$2 AND google_sub IS NULL', [google.sub, byEmail.id]);
        if (upd.changes !== 1) {
          const now = await db.get('SELECT google_sub FROM users WHERE id=$1', [byEmail.id]);
          if (now?.google_sub !== google.sub) return res.status(409).json({ error: ALREADY_LINKED });
        }
      } catch (err) {
        if (isUniqueViolation(err)) return res.status(409).json({ error: ALREADY_LINKED });
        throw err;
      }
      return res.json({ message: 'Sesión iniciada', ...session(byEmail) });
    }

    res.json({
      needs_registration: true,
      profile: { email: google.email, name: google.name, given_name: google.givenName, family_name: google.familyName },
    });
  } catch (err) {
    console.error('POST /auth/google error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── POST /api/auth/google/register ─────────────────────────────────────────
router.post('/google/register', async (req, res) => {
  try {
    const google = await verified(req, res);
    if (!google) return;

    const { role, name, apellido } = req.body || {};
    const signupErr = validateSignup({ name, apellido, role });
    if (signupErr) return res.status(400).json({ error: signupErr });

    const taken = await db.get('SELECT email, google_sub FROM users WHERE email=$1 OR google_sub=$2', [google.email, google.sub]);
    if (taken) return res.status(409).json({ error: taken.google_sub === google.sub ? ALREADY_LINKED : EMAIL_TAKEN });

    const unusable = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
    let user;
    try {
      user = await createAccount({ name, email: google.email, passwordHash: unusable, role, apellido, googleSub: google.sub });
    } catch (err) {
      // Dos registros a la vez pasan los dos el SELECT: el UNIQUE (email o google_sub) deja entrar a uno.
      if (isUniqueViolation(err)) return res.status(409).json({ error: EMAIL_TAKEN });
      throw err;
    }
    res.status(201).json({ message: 'Cuenta creada', ...session(user) });
  } catch (err) {
    console.error('POST /auth/google/register error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
module.exports.googleLimiter = GOOGLE_PER_IP;   // los tests pegan muchas veces desde la misma IP
