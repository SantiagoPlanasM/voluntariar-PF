// src/routes/ngos.js
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── Helper para formatear ONG ─────────────────────────────────────────────
function fmtNgo(n) {
  return {
    ...n,
    // Compatibilidad con el frontend que espera estos nombres
    name:        n.nombre,
    logo:        n.foto_perfil,
    cover_image: n.banner,
    description: n.descripcion,
    mission:     n.mision,
    location:    n.ubicacion,
  };
}

// ── GET /api/ngos ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const ngos = await db.all(
      `SELECT n.*, COALESCE(c.nombre, '') AS categoria_nombre
       FROM ngos n
       LEFT JOIN ngo_categorias nc ON nc.ngo_id = n.id
       LEFT JOIN categorias c ON c.id = nc.categoria_id
       ORDER BY n.followers DESC`,
      []
    );
    res.json({ ngos: ngos.map(fmtNgo) });
  } catch (err) {
    console.error('GET /ngos error:', err);
    res.status(500).json({ error: 'Error al obtener ONGs' });
  }
});

// ── GET /api/ngos/me ──────────────────────────────────────────────────────
router.get('/me', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const ngo = await db.get('SELECT * FROM ngos WHERE user_id=$1', [req.user.id]);
    if (!ngo) return res.status(404).json({ error: 'Perfil ONG no encontrado' });

    const projects = await db.all(
      'SELECT * FROM projects WHERE ngo_id=$1 ORDER BY created_at DESC',
      [ngo.id]
    );

    // Stats calculadas en SQL
    const statsRow = await db.get(
      `SELECT
         COUNT(*) AS total_projects,
         SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active_projects,
         SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed_projects,
         SUM(COALESCE(cupos_ocupados, 0)) AS total_volunteers,
         SUM(COALESCE(recaudado, 0)) AS total_funding
       FROM projects WHERE ngo_id=$1`,
      [ngo.id]
    );

    const pendingCount = await db.get(
      `SELECT COUNT(*) AS cnt
       FROM enrollments e
       JOIN projects p ON p.id = e.project_id
       WHERE p.ngo_id=$1 AND e.status='pending'`,
      [ngo.id]
    );

    const stats = {
      total_projects:      parseInt(statsRow?.total_projects)    || 0,
      active_projects:     parseInt(statsRow?.active_projects)   || 0,
      completed_projects:  parseInt(statsRow?.completed_projects) || 0,
      total_volunteers:    parseInt(statsRow?.total_volunteers)  || 0,
      total_funding:       parseFloat(statsRow?.total_funding)   || 0,
      pending_enrollments: parseInt(pendingCount?.cnt)           || 0,
    };

    res.json({ ngo: fmtNgo(ngo), projects, stats });
  } catch (err) {
    console.error('GET /ngos/me error:', err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// ── GET /api/ngos/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const ngo = await db.get('SELECT * FROM ngos WHERE id=$1', [req.params.id]);
    if (!ngo) return res.status(404).json({ error: 'ONG no encontrada' });

    const projects = await db.all(
      `SELECT id, titulo AS title, foto_perfil AS image, tipo AS type,
              status, cupos_ocupados AS current_volunteers, cupos AS volunteers_needed,
              COALESCE(c.nombre,'') AS category
       FROM projects p
       LEFT JOIN project_categorias pc ON pc.project_id = p.id
       LEFT JOIN categorias c ON c.id = pc.categoria_id
       WHERE p.ngo_id=$1
       ORDER BY p.created_at DESC`,
      [req.params.id]
    );

    res.json({ ngo: fmtNgo(ngo), projects });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ONG' });
  }
});

// ── PUT /api/ngos/me ──────────────────────────────────────────────────────
router.put('/me', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const { name, description, mission, location, logo, cover_image, alias, founded } = req.body;

    if (name && name.trim().length < 2)
      return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });

    // Verificar alias único si se envía
    if (alias) {
      const existing = await db.get(
        'SELECT id FROM ngos WHERE alias=$1 AND user_id != $2',
        [alias, req.user.id]
      );
      if (existing) return res.status(409).json({ error: 'El alias ya está en uso' });
    }

    await db.run(
      `UPDATE ngos SET
         nombre=$1, descripcion=$2, mision=$3, ubicacion=$4,
         foto_perfil=$5, banner=$6, alias=$7, founded=$8,
         updated_at=CURRENT_TIMESTAMP
       WHERE user_id=$9`,
      [name, description, mission, location, logo, cover_image, alias || null, founded || null, req.user.id]
    );

    const updated = await db.get('SELECT * FROM ngos WHERE user_id=$1', [req.user.id]);
    res.json({ ngo: fmtNgo(updated) });
  } catch (err) {
    console.error('PUT /ngos/me error:', err);
    res.status(500).json({ error: 'Error al actualizar ONG' });
  }
});

// ── GET /api/ngos/:id/projects ────────────────────────────────────────────
router.get('/:id/projects', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT p.*, COALESCE(c.nombre,'') AS category
      FROM projects p
      LEFT JOIN project_categorias pc ON pc.project_id = p.id
      LEFT JOIN categorias c ON c.id = pc.categoria_id
      WHERE p.ngo_id=$1
    `;
    const params = [req.params.id];
    if (status) { sql += ' AND p.status=$2'; params.push(status); }
    sql += ' ORDER BY p.created_at DESC';

    const projects = await db.all(sql, params);
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener proyectos de ONG' });
  }
});

// ── GET /api/ngos/:id/dashboard ───────────────────────────────────────────
router.get('/:id/dashboard', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const ngo = await db.get(
      'SELECT * FROM ngos WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!ngo) return res.status(403).json({ error: 'Sin acceso' });

    const projects = await db.all(
      'SELECT * FROM projects WHERE ngo_id=$1 ORDER BY created_at DESC',
      [req.params.id]
    );

    // Stats en SQL (no en JS)
    const statsRow = await db.get(
      `SELECT
         COUNT(*) AS total_projects,
         SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active_projects,
         SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed_projects,
         SUM(COALESCE(cupos_ocupados, 0)) AS total_volunteers,
         SUM(COALESCE(recaudado, 0)) AS total_funding
       FROM projects WHERE ngo_id=$1`,
      [req.params.id]
    );

    // Inscripciones pendientes con info del voluntario
    const pendingEnrollments = await db.all(
      `SELECT e.*,
              u.name AS volunteer_name, u.email AS volunteer_email,
              u.avatar AS volunteer_avatar,
              p.titulo AS project_title
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       JOIN projects p ON p.id = e.project_id
       WHERE p.ngo_id=$1 AND e.status='pending'
       ORDER BY e.created_at DESC`,
      [req.params.id]
    );

    const stats = {
      total_projects:      parseInt(statsRow?.total_projects)    || 0,
      active_projects:     parseInt(statsRow?.active_projects)   || 0,
      completed_projects:  parseInt(statsRow?.completed_projects) || 0,
      total_volunteers:    parseInt(statsRow?.total_volunteers)  || 0,
      total_funding:       parseFloat(statsRow?.total_funding)   || 0,
      pending_enrollments: pendingEnrollments.length,
    };

    res.json({ ngo: fmtNgo(ngo), projects, pending_enrollments: pendingEnrollments, stats });
  } catch (err) {
    console.error('GET /ngos/:id/dashboard error:', err);
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
});

// ── GET /api/ngos/:id/empleados ───────────────────────────────────────────
router.get('/:id/empleados', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const ngo = await db.get('SELECT id FROM ngos WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!ngo) return res.status(403).json({ error: 'Sin acceso' });

    const empleados = await db.all(
      'SELECT * FROM empleados WHERE ngo_id=$1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ empleados });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener empleados' });
  }
});

// ── POST /api/ngos/:id/empleados ──────────────────────────────────────────
router.post('/:id/empleados', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const ngo = await db.get('SELECT id FROM ngos WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!ngo) return res.status(403).json({ error: 'Sin acceso' });

    const { nombre, apellido, email, rol = 'coordinador', foto_perfil } = req.body;
    if (!nombre?.trim() || !apellido?.trim() || !email?.trim())
      return res.status(400).json({ error: 'Nombre, apellido y email son requeridos' });

    await db.run(
      `INSERT INTO empleados (ngo_id, nombre, apellido, email, rol, foto_perfil)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.params.id, nombre.trim(), apellido.trim(), email.trim().toLowerCase(), rol, foto_perfil || null]
    );

    const empleado = await db.get(
      'SELECT * FROM empleados WHERE ngo_id=$1 ORDER BY created_at DESC LIMIT 1',
      [req.params.id]
    );
    res.status(201).json({ empleado });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear empleado' });
  }
});

module.exports = router;
