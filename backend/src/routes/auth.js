// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const { checkText, firstError } = require('../lib/inputs');
const { isUniqueViolation } = require('../lib/dbErrors');
const { createLimiter } = require('../lib/rateLimit');

const router = express.Router();

// ── Límite de intentos (aprobado por el usuario, PROJECT_ANALYSIS.md §103) ───────────────────────────────
// Login: solo cuentan los FALLIDOS. Por email+IP (no por email solo: cualquiera podría bloquearle la cuenta a otra
// persona) y, aparte, por IP (muchos emails desde el mismo lugar). Un login correcto limpia el de email+IP.
// Registro: por IP. Pasado el límite: 429 sin tocar la base ni bcrypt. En memoria y por proceso (lib/rateLimit).
const LOGIN_FAILS_PER_ACCOUNT = createLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
const LOGIN_FAILS_PER_IP      = createLimiter({ max: 50, windowMs: 15 * 60 * 1000 });
const REGISTERS_PER_IP        = createLimiter({ max: 20, windowMs: 60 * 60 * 1000 });
const tooMany = (res, seconds) => {
  res.set('Retry-After', String(seconds));
  return res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' });
};

// Hash de una contraseña cualquiera, para comparar contra algo cuando el email no existe (ver /login).
const DUMMY_HASH = bcrypt.hashSync('cuenta-inexistente', 10);

// ── Validaciones ──────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE  = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]{2,50}$/;

// `typeof v !== 'string'` primero: antes un número o un array reventaba en `.trim()` y daba 500 (REVISION B13).
function validateEmail(v)    { if (typeof v !== 'string' || !EMAIL_RE.test(v.trim())) return 'Email inválido'; return null; }
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

// ── POST /api/auth/register ────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const wait = REGISTERS_PER_IP.blocked(req.ip);
    if (wait) return tooMany(res, wait);
    REGISTERS_PER_IP.hit(req.ip);

    const { name, email, password, role = 'volunteer', apellido } = req.body;

    const nameErr  = validateName(name);
    const emailErr = validateEmail(email);
    const passErr  = validatePassword(password);
    if (nameErr)  return res.status(400).json({ error: nameErr });
    if (emailErr) return res.status(400).json({ error: emailErr });
    if (passErr)  return res.status(400).json({ error: passErr });
    // Opcional (si falta o viene vacío se toma del nombre completo). Antes no se validaba y un apellido que no
    // era texto reventaba en `.trim()` dentro de la transacción: 500 (REVISION A4). 50, como el nombre.
    const apellidoErr = checkText(apellido, { label: 'El apellido', max: 50 });
    if (apellidoErr) return res.status(400).json({ error: apellidoErr });

    if (!['volunteer', 'ngo', 'company'].includes(role))
      return res.status(400).json({ error: 'Rol inválido' });

    const normEmail = email.trim().toLowerCase();
    const existing = await db.get('SELECT id FROM users WHERE email=$1', [normEmail]);
    if (existing) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });

    const hashed = await bcrypt.hash(password, 10);
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`;
    const user = { id: randomUUID(), name: name.trim(), email: normEmail, role, avatar };

    // Usuario y perfil, juntos o ninguno (REVISION B17): antes, si fallaba el perfil quedaba un usuario sin
    // perfil y ese email ya no se podía volver a registrar. El id se genera acá (regla 23).
    try {
      await db.transaction(async (tx) => {
        await tx.run(
          `INSERT INTO users (id, name, email, password, role, avatar) VALUES ($1,$2,$3,$4,$5,$6)`,
          [user.id, user.name, user.email, hashed, role, avatar]
        );

        // Crear perfil extendido según rol
        if (role === 'ngo') {
          await tx.run(
            `INSERT INTO ngos (user_id, nombre, foto_perfil) VALUES ($1,$2,$3)`,
            [user.id, user.name, avatar]
          );
        }
        if (role === 'company') {
          await tx.run(
            `INSERT INTO empresas (user_id, nombre, foto_perfil) VALUES ($1,$2,$3)`,
            [user.id, user.name, avatar]
          );
        }
        if (role === 'volunteer') {
          // Separar nombre en nombre + apellido si viene junto
          const parts = user.name.split(' ');
          const firstName = parts[0];
          const lastName  = apellido?.trim() || parts.slice(1).join(' ') || '';
          await tx.run(
            `INSERT INTO voluntarios (user_id, nombre, apellido, foto_perfil) VALUES ($1,$2,$3,$4)`,
            [user.id, firstName, lastName, avatar]
          );
        }
      });
    } catch (err) {
      // Dos registros simultáneos con el mismo email pasan los dos el SELECT de arriba: el UNIQUE deja entrar
      // a uno y el otro es un 409, no un 500.
      if (isUniqueViolation(err)) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });
      throw err;
    }

    const token = signToken(user);
    res.status(201).json({
      message: 'Cuenta creada',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar }
    });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── POST /api/auth/login ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password)
      return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const emailErr = validateEmail(email);
    if (emailErr) return res.status(400).json({ error: emailErr });

    // Los errores de validación (arriba) no cuentan como intento; acá ya es un intento de verdad.
    const accountKey = `${email.trim().toLowerCase()}|${req.ip}`;
    const wait = Math.max(LOGIN_FAILS_PER_ACCOUNT.blocked(accountKey), LOGIN_FAILS_PER_IP.blocked(req.ip));
    if (wait) return tooMany(res, wait);

    const user = await db.get(
      'SELECT id, name, email, password, role, avatar, bio, location FROM users WHERE email=$1',
      [email.trim().toLowerCase()]
    );
    // Mismo mensaje y mismo trabajo exista o no la cuenta (REVISION B20, decisión del usuario): antes decía
    // 'No encontramos una cuenta…' o 'Contraseña incorrecta', y un email inexistente ni calculaba el hash, así
    // que el texto y el tiempo de respuesta permitían averiguar qué emails tienen cuenta.
    const valid = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
    if (!user || !valid) {
      LOGIN_FAILS_PER_ACCOUNT.hit(accountKey);
      LOGIN_FAILS_PER_IP.hit(req.ip);
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }
    LOGIN_FAILS_PER_ACCOUNT.reset(accountKey);

    const token = signToken(user);
    res.json({
      message: 'Sesión iniciada',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar }
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.get(
      'SELECT id, name, email, role, avatar, bio, location, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Perfil extendido según rol
    let profile = null;
    if (user.role === 'volunteer') {
      profile = await db.get('SELECT * FROM voluntarios WHERE user_id=$1', [user.id]);
    } else if (user.role === 'ngo') {
      profile = await db.get('SELECT * FROM ngos WHERE user_id=$1', [user.id]);
    } else if (user.role === 'company') {
      profile = await db.get('SELECT * FROM empresas WHERE user_id=$1', [user.id]);
    }

    res.json({ user, profile });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── PUT /api/auth/me ───────────────────────────────────────────────────────
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { name, bio, location, avatar } = req.body;
    // `name !== undefined` (y no `if (name)`): antes "" se salteaba la validación y dejaba el nombre vacío (B12).
    if (name !== undefined) {
      const nameErr = validateName(name);
      if (nameErr) return res.status(400).json({ error: nameErr });
    }
    const textErr = firstError(
      checkText(bio, { label: 'La bio', max: 500 }),
      checkText(location, { label: 'La ubicación', max: 150 }),
      checkText(avatar, { label: 'La foto', max: 1000 }),
    );
    if (textErr) return res.status(400).json({ error: textErr });

    const current = await db.get(
      'SELECT name, bio, location, avatar FROM users WHERE id=$1',
      [req.user.id]
    );
    if (!current) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Actualización parcial real: un campo no enviado (undefined) conserva
    // su valor anterior en vez de pisarlo con null. better-sqlite3 (y
    // Postgres) además rechazan bindear undefined directamente, así que de
    // paso evita ese error.
    await db.run(
      `UPDATE users SET name=$1, bio=$2, location=$3, avatar=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$5`,
      [
        name !== undefined ? name.trim() : current.name,
        bio !== undefined ? bio : current.bio,
        location !== undefined ? location : current.location,
        avatar !== undefined ? avatar : current.avatar,
        req.user.id,
      ]
    );
    const updated = await db.get(
      'SELECT id, name, email, role, avatar, bio, location FROM users WHERE id=$1',
      [req.user.id]
    );
    res.json({ user: updated });
  } catch (err) {
    console.error('PUT /auth/me error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
// Exportadas aparte para poder testearlas de forma aislada, sin pegarle a la
// API completa (mismo patrón que insertMessage en routes/messages.js).
module.exports.validateEmail = validateEmail;
module.exports.validateName = validateName;
module.exports.validatePassword = validatePassword;
