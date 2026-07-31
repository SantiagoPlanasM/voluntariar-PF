// src/middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'voluntariar_dev_secret';

/**
 * Middleware de autenticación obligatoria.
 * Coloca req.user con { id, email, role, name } si el token es válido.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/**
 * Middleware de autenticación opcional.
 * Si hay token válido lo verifica, si no, sigue sin req.user.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
    } catch (_) {}
  }
  next();
}

/**
 * Middleware de autorización por rol.
 * Uso: requireRole('ngo') o requireRole(['ngo', 'company'])
 */
function requireRole(...roles) {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: `Requiere rol: ${allowed.join(' o ')}` });
    }
    next();
  };
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { requireAuth, optionalAuth, requireRole, signToken };
