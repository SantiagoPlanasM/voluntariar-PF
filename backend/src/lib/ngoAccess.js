// src/lib/ngoAccess.js — quién puede actuar sobre una ONG (§293, docs/PLAN_EQUIPOS.md).
//
// La cuenta dueña (ngos.user_id) es 'owner'. Un miembro del equipo (ngo_miembros) cuenta solo con la invitación
// aceptada (estado 'activo') y tiene el rol de esa ONG: 'coordinador' o 'comunicador'. Una persona puede ser miembro
// de varias ONG. Las rutas que se abren al equipo preguntan acá en vez de comparar ngos.user_id; las que siguen siendo
// solo del dueño (editar voluntariados, Mercado Pago, patrocinios, el propio equipo) no cambian.
const db = require('../db');

/** 'owner' | 'coordinador' | 'comunicador' | null */
async function ngoAccess(userId, ngoId) {
  if (!userId || !ngoId) return null;
  const row = await db.get(
    `SELECT n.user_id AS owner_id, m.rol
       FROM ngos n
       LEFT JOIN ngo_miembros m ON m.ngo_id = n.id AND m.user_id = $2 AND m.estado = 'activo'
      WHERE n.id = $1`, [ngoId, userId]);
  if (!row) return null;
  if (row.owner_id === userId) return 'owner';
  return row.rol || null;
}

/** La ONG de un proyecto y el acceso del usuario a ella; null si el proyecto no existe. */
async function projectAccess(userId, projectId) {
  if (!projectId) return null;
  const p = await db.get('SELECT ngo_id FROM projects WHERE id=$1', [projectId]);
  if (!p) return null;
  return { ngoId: p.ngo_id, access: await ngoAccess(userId, p.ngo_id) };
}

/** Postulaciones, CV, entrevistas y horas: el dueño y el coordinador. */
const canManageEnrollments = (access) => access === 'owner' || access === 'coordinador';

module.exports = { ngoAccess, projectAccess, canManageEnrollments };
