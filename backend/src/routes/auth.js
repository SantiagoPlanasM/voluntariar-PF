// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── Validaciones ──────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE  = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]{2,50}$/;

function validateEmail(v)    { if (!v || !EMAIL_RE.test(v.trim())) return 'Email inválido'; return null; }
function validateName(v)     { if (!v || !NAME_RE.test(v.trim()))  return 'Solo letras y espacios, mínimo 2 caracteres'; return null; }
function validatePassword(v) {
  if (!v || v.length < 8)     return 'Mínimo 8 caracteres';
  if (!/[A-Z]/.test(v))       return 'Necesita al menos una mayúscula';
  if (!/[0-9]/.test(v))       return 'Necesita al menos un número';
  return null;
}

// ── POST /api/auth/register ────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'volunteer', apellido } = req.body;

    const nameErr  = validateName(name);
    const emailErr = validateEmail(email);
    const passErr  = validatePassword(password);
    if (nameErr)  return res.status(400).json({ error: nameErr });
    if (emailErr) return res.status(400).json({ error: emailErr });
    if (passErr)  return res.status(400).json({ error: passErr });

    if (!['volunteer', 'ngo', 'company'].includes(role))
      return res.status(400).json({ error: 'Rol inválido' });

    const existing = await db.get('SELECT id FROM users WHERE email=$1', [email.trim().toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });

    const hashed = await bcrypt.hash(password, 10);
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`;

    await db.run(
      `INSERT INTO users (name, email, password, role, avatar) VALUES ($1,$2,$3,$4,$5)`,
      [name.trim(), email.trim().toLowerCase(), hashed, role, avatar]
    );

    const user = await db.get(
      'SELECT id, name, email, role, avatar FROM users WHERE email=$1',
      [email.trim().toLowerCase()]
    );

    // Crear perfil extendido según rol
    if (role === 'ngo') {
      await db.run(
        `INSERT INTO ngos (user_id, nombre, foto_perfil) VALUES ($1,$2,$3)`,
        [user.id, name.trim(), avatar]
      );
    }
    if (role === 'company') {
      await db.run(
        `INSERT INTO empresas (user_id, nombre, foto_perfil) VALUES ($1,$2,$3)`,
        [user.id, name.trim(), avatar]
      );
    }
    if (role === 'volunteer') {
      // Separar nombre en nombre + apellido si viene junto
      const parts = name.trim().split(' ');
      const firstName = parts[0];
      const lastName  = apellido?.trim() || parts.slice(1).join(' ') || '';
      await db.run(
        `INSERT INTO voluntarios (user_id, nombre, apellido, foto_perfil) VALUES ($1,$2,$3,$4)`,
        [user.id, firstName, lastName, avatar]
      );
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
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const emailErr = validateEmail(email);
    if (emailErr) return res.status(400).json({ error: emailErr });

    const user = await db.get(
      'SELECT id, name, email, password, role, avatar, bio, location FROM users WHERE email=$1',
      [email.trim().toLowerCase()]
    );
    if (!user) return res.status(401).json({ error: 'No encontramos una cuenta con ese email' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });

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
    if (name) {
      const nameErr = validateName(name);
      if (nameErr) return res.status(400).json({ error: nameErr });
    }

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
        name ?? current.name,
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
