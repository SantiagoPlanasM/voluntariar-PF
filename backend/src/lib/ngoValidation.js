// src/lib/ngoValidation.js — validación de ONG (PROJECT_ANALYSIS.md §317; DESIGN.md "Validación de ONGs").
//
// Decisiones del usuario (10/11):
//   - Admins: los mails de ADMIN_EMAILS (separados por coma; sin importar mayúsculas ni espacios). No hay un rol
//     'admin': users.role tiene un CHECK que en SQLite no se puede cambiar sin rehacer la tabla (regla 12).
//   - "Validada" es solo la insignia: no habilita ni bloquea nada. Se calcula (verifiedSql), no se guarda en ngos.
// Base en español, API en inglés: los mapas de acá son el puente.

const db = require('../db');

const STATUS_EN = { en_revision: 'pending', aprobada: 'approved', rechazada: 'rejected' };
const LEGAL_TYPES = { civil_association: 'asociacion_civil', foundation: 'fundacion', cooperative: 'cooperativa', mutual: 'mutual', other: 'otra' };
const LEGAL_TYPES_EN = Object.fromEntries(Object.entries(LEGAL_TYPES).map(([en, es]) => [es, en]));

/**
 * La insignia de la ONG cuyo id está en la columna `ngoIdCol` ('n.id', 'p.ngo_id'), como expresión SQL: 0/1 en SQLite,
 * boolean en Postgres (usar Boolean()). En una consulta con GROUP BY, pasar una columna agrupada o que dependa de la
 * clave agrupada (p.ngo_id con GROUP BY p.id), o Postgres la rechaza.
 */
const verifiedSql = (ngoIdCol) =>
  `EXISTS (SELECT 1 FROM ngo_validaciones nv WHERE nv.ngo_id = ${ngoIdCol} AND nv.estado = 'aprobada')`;

/** Los mails de los admins, en minúsculas. Se lee en cada llamada: cambiar la variable no necesita reiniciar el código. */
function adminEmails() {
  return (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/** ¿El usuario es admin? Por su mail actual en la base (no el del token). */
async function isAdmin(userId) {
  const admins = adminEmails();
  if (!userId || admins.length === 0) return false;
  const u = await db.get('SELECT email FROM users WHERE id=$1', [userId]);
  return Boolean(u && admins.includes(String(u.email).toLowerCase()));
}

/** Middleware, después de requireAuth: 403 si no es admin (regla 15: la autorización vive en el backend). */
async function requireAdmin(req, res, next) {
  try {
    if (!(await isAdmin(req.user?.id))) return res.status(403).json({ error: 'Solo para administradores' });
    next();
  } catch (err) {
    console.error('requireAdmin error:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

/** La validación como la ve la API (sin los ids de los archivos). */
function fmtValidation(v) {
  if (!v) return { status: 'none' };
  return {
    status: STATUS_EN[v.estado] ?? v.estado,
    cuit: v.cuit,
    legal_type: LEGAL_TYPES_EN[v.personeria] ?? v.personeria,
    reason: v.motivo ?? null,
    submitted_at: v.updated_at ?? v.created_at,
    reviewed_at: v.revisado_at ?? null,
  };
}

module.exports = { STATUS_EN, LEGAL_TYPES, LEGAL_TYPES_EN, verifiedSql, adminEmails, isAdmin, requireAdmin, fmtValidation };
