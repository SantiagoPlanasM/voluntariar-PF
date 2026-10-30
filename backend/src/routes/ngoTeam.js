// src/routes/ngoTeam.js — /api/equipo: el equipo de la ONG (§294, docs/PLAN_EQUIPOS.md paso 2).
//
// El dueño (cuenta ngo) invita por email a una cuenta de voluntario que ya existe, con rol coordinador o comunicador;
// la persona acepta o rechaza, y puede salir cuando quiera. Una persona puede estar en varias ONG. Sin aceptar no ve
// nada: lib/ngoAccess cuenta solo los miembros activos. En la base, rol y estado en español; en la API, en inglés
// (regla 11). Las rutas que se abren al equipo (postulaciones, CV, entrevistas, horas, Momentos) preguntan a ngoAccess.
const express = require('express');
const { randomUUID } = require('node:crypto');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { isUniqueViolation } = require('../lib/dbErrors');
const { ngoAccess } = require('../lib/ngoAccess');
const { validateEmail } = require('../lib/authCommon');
const { pendingEnrollmentsOf } = require('./ngos');

const router = express.Router();

const ROLE_TO_DB = { coordinator: 'coordinador', communicator: 'comunicador' };
const ROLE_TO_API = { coordinador: 'coordinator', comunicador: 'communicator' };
const STATUS_TO_API = { invitado: 'invited', activo: 'active' };
const INVALID_ROLE = 'El rol tiene que ser coordinator o communicator';

const fmtMember = (r) => ({
  user_id: r.user_id, name: r.name, email: r.email, avatar: r.avatar || null,
  role: ROLE_TO_API[r.rol], status: STATUS_TO_API[r.estado], created_at: r.created_at,
});
const fmtMembership = (r) => ({
  ngo_id: r.ngo_id, ngo_name: r.ngo_name, ngo_logo: r.ngo_logo || null,
  role: ROLE_TO_API[r.rol], status: STATUS_TO_API[r.estado],
});
const MEMBER_COLS = `m.user_id, m.rol, m.estado, m.created_at, u.name, u.email, u.avatar`;
const ownNgo = (userId) => db.get('SELECT id, nombre FROM ngos WHERE user_id=$1', [userId]);
const memberRow = (ngoId, userId) => db.get(
  `SELECT ${MEMBER_COLS} FROM ngo_miembros m JOIN users u ON u.id = m.user_id WHERE m.ngo_id=$1 AND m.user_id=$2`,
  [ngoId, userId]);
// Los avisos no frenan la respuesta si fallan (como el resto de las notificaciones).
const notify = (userId, type, title, body, data) => db.run(
  'INSERT INTO notifications (user_id, type, title, body, data) VALUES ($1,$2,$3,$4,$5)',
  [userId, type, title, body, JSON.stringify(data)]).catch(() => {});

// ── Dueño: GET /api/equipo/miembros ──────────────────────────────────────────
router.get('/miembros', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const ngo = await ownNgo(req.user.id);
    if (!ngo) return res.status(404).json({ error: 'Perfil ONG no encontrado' });
    const rows = await db.all(
      `SELECT ${MEMBER_COLS} FROM ngo_miembros m JOIN users u ON u.id = m.user_id
       WHERE m.ngo_id=$1 ORDER BY m.created_at, m.user_id`, [ngo.id]);
    res.json({ members: rows.map(fmtMember) });
  } catch (err) {
    console.error('GET /equipo/miembros error:', err);
    res.status(500).json({ error: 'Error al obtener el equipo' });
  }
});

// ── Dueño: POST /api/equipo/miembros { email, role } ─────────────────────────
router.post('/miembros', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const { email, role } = req.body || {};
    if (validateEmail(email)) return res.status(400).json({ error: 'Email inválido' });
    const rol = ROLE_TO_DB[role];
    if (!rol) return res.status(400).json({ error: INVALID_ROLE });
    const ngo = await ownNgo(req.user.id);
    if (!ngo) return res.status(404).json({ error: 'Perfil ONG no encontrado' });
    const user = await db.get('SELECT id, role FROM users WHERE email=$1', [email.trim().toLowerCase()]);
    if (!user) return res.status(404).json({ error: 'No hay ninguna cuenta con ese email. Pedile que se registre como voluntario.' });
    if (user.role !== 'volunteer') return res.status(400).json({ error: 'Solo se puede sumar al equipo una cuenta de voluntario' });

    try {
      await db.run(
        `INSERT INTO ngo_miembros (id, ngo_id, user_id, rol, estado, invitado_por) VALUES ($1,$2,$3,$4,'invitado',$5)`,
        [randomUUID(), ngo.id, user.id, rol, req.user.id]);
    } catch (err) {
      if (isUniqueViolation(err)) return res.status(409).json({ error: 'Esa persona ya está en el equipo o tiene una invitación' });
      throw err;
    }
    await notify(user.id, 'team_invite', `${ngo.nombre} te invitó a su equipo`,
      `Rol: ${rol}. Aceptá o rechazá la invitación desde Configuración → Equipos.`, { ngo_id: ngo.id, role: ROLE_TO_API[rol] });
    res.status(201).json({ member: fmtMember(await memberRow(ngo.id, user.id)) });
  } catch (err) {
    console.error('POST /equipo/miembros error:', err);
    res.status(500).json({ error: 'Error al invitar' });
  }
});

// ── Dueño: PATCH /api/equipo/miembros/:userId { role } ───────────────────────
router.patch('/miembros/:userId', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const rol = ROLE_TO_DB[req.body?.role];
    if (!rol) return res.status(400).json({ error: INVALID_ROLE });
    const ngo = await ownNgo(req.user.id);
    const r = await db.run(
      'UPDATE ngo_miembros SET rol=$1, updated_at=CURRENT_TIMESTAMP WHERE ngo_id=$2 AND user_id=$3',
      [rol, ngo?.id, req.params.userId]);
    if (r.changes !== 1) return res.status(404).json({ error: 'Esa persona no está en tu equipo' });
    res.json({ member: fmtMember(await memberRow(ngo.id, req.params.userId)) });
  } catch (err) {
    console.error('PATCH /equipo/miembros error:', err);
    res.status(500).json({ error: 'Error al cambiar el rol' });
  }
});

// ── Dueño: DELETE /api/equipo/miembros/:userId (saca a alguien o cancela la invitación) ──
router.delete('/miembros/:userId', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const ngo = await ownNgo(req.user.id);
    const r = await db.run('DELETE FROM ngo_miembros WHERE ngo_id=$1 AND user_id=$2', [ngo?.id, req.params.userId]);
    if (r.changes !== 1) return res.status(404).json({ error: 'Esa persona no está en tu equipo' });
    res.json({ removed: true });
  } catch (err) {
    console.error('DELETE /equipo/miembros error:', err);
    res.status(500).json({ error: 'Error al sacar del equipo' });
  }
});

// ── Voluntario: GET /api/equipo/mias ─────────────────────────────────────────
router.get('/mias', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT m.ngo_id, m.rol, m.estado, n.nombre AS ngo_name, n.foto_perfil AS ngo_logo
       FROM ngo_miembros m JOIN ngos n ON n.id = m.ngo_id
       WHERE m.user_id=$1 ORDER BY n.nombre, m.ngo_id`, [req.user.id]);
    res.json({ memberships: rows.map(fmtMembership) });
  } catch (err) {
    console.error('GET /equipo/mias error:', err);
    res.status(500).json({ error: 'Error al obtener tus equipos' });
  }
});

// ── Voluntario: POST /api/equipo/mias/:ngoId/aceptar ─────────────────────────
// Compare-and-swap sobre el estado: aceptar dos veces (o dos pedidos a la vez) avisa al dueño una sola vez.
router.post('/mias/:ngoId/aceptar', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const { ngoId } = req.params;
    const r = await db.run(
      `UPDATE ngo_miembros SET estado='activo', updated_at=CURRENT_TIMESTAMP
       WHERE ngo_id=$1 AND user_id=$2 AND estado='invitado'`, [ngoId, req.user.id]);
    const row = await db.get(
      `SELECT m.ngo_id, m.rol, m.estado, n.nombre AS ngo_name, n.foto_perfil AS ngo_logo, n.user_id AS owner_id
       FROM ngo_miembros m JOIN ngos n ON n.id = m.ngo_id WHERE m.ngo_id=$1 AND m.user_id=$2`, [ngoId, req.user.id]);
    if (!row) return res.status(404).json({ error: 'No tenés una invitación de esa ONG' });
    if (r.changes === 1) {
      await notify(row.owner_id, 'team_joined', `${req.user.name} se sumó a tu equipo`,
        `Rol: ${row.rol}.`, { ngo_id: ngoId, user_id: req.user.id });
    }
    res.json({ membership: fmtMembership(row) });
  } catch (err) {
    console.error('POST /equipo/mias/aceptar error:', err);
    res.status(500).json({ error: 'Error al aceptar la invitación' });
  }
});

// ── Voluntario: DELETE /api/equipo/mias/:ngoId (rechaza la invitación o sale del equipo) ──
router.delete('/mias/:ngoId', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const r = await db.run('DELETE FROM ngo_miembros WHERE ngo_id=$1 AND user_id=$2', [req.params.ngoId, req.user.id]);
    if (r.changes !== 1) return res.status(404).json({ error: 'No estás en el equipo de esa ONG' });
    res.json({ removed: true });
  } catch (err) {
    console.error('DELETE /equipo/mias error:', err);
    res.status(500).json({ error: 'Error al salir del equipo' });
  }
});

// ── Miembro activo: GET /api/equipo/:ngoId/panel ─────────────────────────────
// Los voluntariados de la ONG con sus postulaciones pendientes. Las postulaciones en sí, solo para el coordinador.
router.get('/:ngoId/panel', requireAuth, async (req, res) => {
  try {
    const { ngoId } = req.params;
    const access = await ngoAccess(req.user.id, ngoId);
    if (access !== 'coordinador' && access !== 'comunicador') {
      return res.status(403).json({ error: 'No sos parte del equipo de esta ONG' });
    }
    const ngo = await db.get('SELECT id, nombre, foto_perfil FROM ngos WHERE id=$1', [ngoId]);
    const projects = (await db.all(
      `SELECT p.id, p.titulo, p.status, p.cupos, p.cupos_ocupados, p.foto_perfil,
              (SELECT COUNT(*) FROM enrollments e WHERE e.project_id = p.id AND e.status = 'pending') AS pending
       FROM projects p WHERE p.ngo_id=$1 ORDER BY p.created_at DESC, p.id`, [ngoId]
    )).map((p) => ({
      id: p.id, title: p.titulo, status: p.status, image: p.foto_perfil || null,
      volunteers_needed: Number(p.cupos) || 0, current_volunteers: Number(p.cupos_ocupados) || 0,
      pending: Number(p.pending) || 0,   // COUNT llega como string en Postgres (regla 13)
    }));
    const body = { ngo: { id: ngo.id, name: ngo.nombre, logo: ngo.foto_perfil || null }, role: ROLE_TO_API[access], projects };
    if (access === 'coordinador') body.pending_enrollments = await pendingEnrollmentsOf(ngoId);
    res.json(body);
  } catch (err) {
    console.error('GET /equipo/:ngoId/panel error:', err);
    res.status(500).json({ error: 'Error al obtener el panel' });
  }
});

module.exports = router;
