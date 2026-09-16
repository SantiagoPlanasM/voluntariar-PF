// src/routes/ngos.js
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendEmail } = require('../lib/email');
const { sponsorDecisionEmail } = require('../lib/emailTemplates');

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

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
    // categoria_nombre viene del LEFT JOIN con ngo_categorias/categorias
    // cuando la query lo incluye; si no, queda undefined (no rompe nada)
    category:    n.categoria_nombre || undefined,
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
    const ngo = await db.get(
      `SELECT n.*, COALESCE(c.nombre, '') AS categoria_nombre
       FROM ngos n
       LEFT JOIN ngo_categorias nc ON nc.ngo_id = n.id
       LEFT JOIN categorias c ON c.id = nc.categoria_id
       WHERE n.user_id=$1`,
      [req.user.id]
    );
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

    // Solicitudes pendientes, con los datos de contacto ya incluidos —
    // antes el frontend (NGODashboard.tsx) pedía esto con una llamada
    // extra POR CADA proyecto (N+1: hasta 1 llamada HTTP por proyecto listado,
    // ver PROJECT_ANALYSIS.md §21). Trayéndolo acá, en la misma respuesta que
    // ya arma projects/stats, esa pantalla pasa a necesitar una sola llamada.
    const pendingEnrollments = await db.all(
      `SELECT e.id, e.user_id, e.project_id, e.status, e.mensaje AS message, e.created_at,
              u.name AS volunteer_name, u.email AS volunteer_email, u.avatar AS volunteer_avatar,
              p.titulo AS project_title
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       JOIN projects p ON p.id = e.project_id
       WHERE p.ngo_id=$1 AND e.status='pending'
       ORDER BY e.created_at DESC`,
      [ngo.id]
    );

    const stats = {
      total_projects:      parseInt(statsRow?.total_projects)    || 0,
      active_projects:     parseInt(statsRow?.active_projects)   || 0,
      completed_projects:  parseInt(statsRow?.completed_projects) || 0,
      total_volunteers:    parseInt(statsRow?.total_volunteers)  || 0,
      total_funding:       parseFloat(statsRow?.total_funding)   || 0,
      pending_enrollments: pendingEnrollments.length,
    };

    res.json({ ngo: fmtNgo(ngo), projects, stats, pending_enrollments: pendingEnrollments });
  } catch (err) {
    console.error('GET /ngos/me error:', err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// ── GET /api/ngos/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const ngo = await db.get(
      `SELECT n.*, COALESCE(c.nombre, '') AS categoria_nombre
       FROM ngos n
       LEFT JOIN ngo_categorias nc ON nc.ngo_id = n.id
       LEFT JOIN categorias c ON c.id = nc.categoria_id
       WHERE n.id=$1`,
      [req.params.id]
    );
    if (!ngo) return res.status(404).json({ error: 'ONG no encontrada' });

    const projects = await db.all(
      `SELECT p.id, p.titulo AS title, p.foto_perfil AS image, p.tipo AS type,
              p.status, p.cupos_ocupados AS current_volunteers, p.cupos AS volunteers_needed,
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
    console.error('GET /ngos/:id error:', err);
    res.status(500).json({ error: 'Error al obtener ONG' });
  }
});

// ── PUT /api/ngos/me ──────────────────────────────────────────────────────
router.put('/me', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const { name, description, mission, location, logo, cover_image, alias, founded, category } = req.body;

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

    const ngoRow = await db.get('SELECT * FROM ngos WHERE user_id=$1', [req.user.id]);
    if (!ngoRow) return res.status(404).json({ error: 'Perfil ONG no encontrado' });

    // Actualización parcial real: un campo no enviado (undefined) conserva
    // su valor anterior en vez de pisarse con null — mismo bug y mismo fix
    // que tuvo PUT /api/auth/me (ver docs/PROJECT_ANALYSIS.md §13, bug B8).
    // Acá pasaba en la práctica incluso desde el formulario real de la app:
    // NGOOwnProfile.tsx nunca manda `logo`/`cover_image`/`alias`/`founded`
    // en su estado, así que esos campos llegaban `undefined` y SQLite
    // rechazaba el bind con un 500 en cualquier edición de perfil de ONG.
    await db.run(
      `UPDATE ngos SET
         nombre=$1, descripcion=$2, mision=$3, ubicacion=$4,
         foto_perfil=$5, banner=$6, alias=$7, founded=$8,
         updated_at=CURRENT_TIMESTAMP
       WHERE user_id=$9`,
      [
        name ?? ngoRow.nombre,
        description !== undefined ? description : ngoRow.descripcion,
        mission !== undefined ? mission : ngoRow.mision,
        location !== undefined ? location : ngoRow.ubicacion,
        logo !== undefined ? logo : ngoRow.foto_perfil,
        cover_image !== undefined ? cover_image : ngoRow.banner,
        alias !== undefined ? alias : ngoRow.alias,
        founded !== undefined ? founded : ngoRow.founded,
        req.user.id,
      ]
    );

    // Persistir la categoría (viene como nombre, ej. "Educación") en la tabla N:M
    if (category) {
      const categoria = await db.get('SELECT id FROM categorias WHERE nombre=$1', [category]);
      if (categoria) {
        await db.run('DELETE FROM ngo_categorias WHERE ngo_id=$1', [ngoRow.id]);
        await db.run(
          'INSERT INTO ngo_categorias (ngo_id, categoria_id) VALUES ($1,$2)',
          [ngoRow.id, categoria.id]
        );
      }
    }

    const updated = await db.get(
      `SELECT n.*, COALESCE(c.nombre, '') AS categoria_nombre
       FROM ngos n
       LEFT JOIN ngo_categorias nc ON nc.ngo_id = n.id
       LEFT JOIN categorias c ON c.id = nc.categoria_id
       WHERE n.user_id=$1`,
      [req.user.id]
    );
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

// ── Sistema de Patrocinio (Empresa ↔ Proyecto) — lado ONG ──────────────────
// Agregado 2026-09 (roadmap punto 5). La propuesta la crea la empresa
// (ver POST /api/empresas/me/patrocinios); acá la ONG dueña del proyecto la
// lista y decide.

function fmtPatrocinioParaNgo(p) {
  return {
    empresa_id: p.empresa_id,
    project_id: p.project_id,
    estado: p.estado,
    mensaje: p.mensaje,
    aporte: p.aporte,
    created_at: p.created_at,
    updated_at: p.updated_at,
    project_title: p.project_title,
    empresa_name: p.empresa_name,
    empresa_logo: p.empresa_logo,
    empresa_industry: p.empresa_industry,
  };
}

// ── GET /api/ngos/me/patrocinios ───────────────────────────────────────────
// Todas las propuestas de patrocinio (cualquier estado) sobre los proyectos
// de la ONG logueada.
router.get('/me/patrocinios', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const ngo = await db.get('SELECT id FROM ngos WHERE user_id=$1', [req.user.id]);
    if (!ngo) return res.status(404).json({ error: 'Perfil ONG no encontrado' });

    const patrocinios = await db.all(
      `SELECT ev.*, p.titulo AS project_title,
              e.nombre AS empresa_name, e.foto_perfil AS empresa_logo, e.industria AS empresa_industry
       FROM empresa_voluntariados ev
       JOIN projects p ON p.id = ev.project_id
       JOIN empresas e ON e.id = ev.empresa_id
       WHERE p.ngo_id=$1
       ORDER BY ev.updated_at DESC`,
      [ngo.id]
    );
    res.json({ patrocinios: patrocinios.map(fmtPatrocinioParaNgo) });
  } catch (err) {
    console.error('GET /ngos/me/patrocinios error:', err);
    res.status(500).json({ error: 'Error al obtener patrocinios' });
  }
});

// ── PATCH /api/ngos/me/patrocinios/:empresaId/:projectId ──────────────────
// Aceptar o rechazar una propuesta de patrocinio sobre un proyecto propio.
// La autorización de propiedad se hace con el JOIN a projects.ngo_id en el
// WHERE — nunca se confía en el :projectId de la URL sin validar el dueño
// (mismo criterio que el resto de los endpoints de escritura de este archivo).
router.patch('/me/patrocinios/:empresaId/:projectId', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const { estado } = req.body;
    if (!['aceptado', 'rechazado'].includes(estado))
      return res.status(400).json({ error: 'Estado debe ser: aceptado o rechazado' });

    const ngo = await db.get('SELECT id FROM ngos WHERE user_id=$1', [req.user.id]);
    if (!ngo) return res.status(404).json({ error: 'Perfil ONG no encontrado' });

    const patrocinio = await db.get(
      `SELECT ev.*, p.titulo, p.ngo_id, e.nombre AS empresa_name,
              u.id AS empresa_user_id, u.email AS empresa_email
       FROM empresa_voluntariados ev
       JOIN projects p ON p.id = ev.project_id
       JOIN empresas e ON e.id = ev.empresa_id
       JOIN users u ON u.id = e.user_id
       WHERE ev.empresa_id=$1 AND ev.project_id=$2 AND p.ngo_id=$3`,
      [req.params.empresaId, req.params.projectId, ngo.id]
    );
    if (!patrocinio) return res.status(404).json({ error: 'Propuesta no encontrada o sin permiso' });
    if (patrocinio.estado !== 'propuesto')
      return res.status(409).json({ error: 'Esta propuesta ya fue decidida' });

    await db.run(
      `UPDATE empresa_voluntariados SET estado=$1, updated_at=CURRENT_TIMESTAMP
       WHERE empresa_id=$2 AND project_id=$3`,
      [estado, req.params.empresaId, req.params.projectId]
    );

    const ngoRow = await db.get('SELECT nombre FROM ngos WHERE id=$1', [ngo.id]);

    await db.run(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1,$2,$3,$4,$5)`,
      [patrocinio.empresa_user_id,
       estado === 'aceptado' ? 'sponsor_accepted' : 'sponsor_rejected',
       estado === 'aceptado'
         ? `¡${ngoRow.nombre} aceptó tu patrocinio de "${patrocinio.titulo}"!`
         : `${ngoRow.nombre} no aceptó tu propuesta de patrocinio a "${patrocinio.titulo}"`,
       estado === 'aceptado'
         ? 'Ya podés coordinar los detalles por mensaje.'
         : 'Podés proponer patrocinar otros proyectos.',
       JSON.stringify({ project_id: patrocinio.project_id })]
    ).catch(() => {});

    const { subject, html } = sponsorDecisionEmail({
      empresaName: patrocinio.empresa_name, projectTitle: patrocinio.titulo,
      ngoName: ngoRow.nombre, accepted: estado === 'aceptado', appUrl: APP_URL,
    });
    sendEmail({ to: patrocinio.empresa_email, subject, html }).catch(() => {});

    res.json({ message: `Propuesta ${estado}` });
  } catch (err) {
    console.error('PATCH /ngos/me/patrocinios/:empresaId/:projectId error:', err);
    res.status(500).json({ error: 'Error al actualizar propuesta' });
  }
});
