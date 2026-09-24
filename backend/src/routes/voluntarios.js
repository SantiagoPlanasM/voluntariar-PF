// src/routes/voluntarios.js
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const NIVELES = ['basico', 'intermedio', 'avanzado'];
const MAX_HABILIDADES = 20;

// ── GET /api/voluntarios/me/habilidades ────────────────────────────────────
router.get('/me/habilidades', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT h.id, h.nombre, h.descripcion, vh.nivel
       FROM voluntario_habilidades vh
       JOIN habilidades h ON h.id = vh.habilidad_id
       WHERE vh.user_id = $1
       ORDER BY h.nombre`,
      [req.user.id]
    );
    res.json({ habilidades: rows });
  } catch (err) {
    console.error('GET /voluntarios/me/habilidades error:', err);
    res.status(500).json({ error: 'Error al obtener habilidades' });
  }
});

// ── PUT /api/voluntarios/me/habilidades ────────────────────────────────────
// Reemplaza el set completo de habilidades del voluntario (más simple para
// la UI: se manda el estado final y el backend hace el diff internamente).
router.put('/me/habilidades', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const { habilidades } = req.body; // [{ habilidad_id, nivel }]

    if (!Array.isArray(habilidades))
      return res.status(400).json({ error: 'habilidades debe ser un array' });
    if (habilidades.length > MAX_HABILIDADES)
      return res.status(400).json({ error: `Máximo ${MAX_HABILIDADES} habilidades` });

    for (const h of habilidades) {
      if (!h || !h.habilidad_id)
        return res.status(400).json({ error: 'Cada habilidad necesita habilidad_id' });
      if (h.nivel && !NIVELES.includes(h.nivel))
        return res.status(400).json({ error: `Nivel inválido: ${h.nivel}` });
    }

    // Validar que las habilidades existan en el catálogo (evita filas huérfanas)
    const ids = [...new Set(habilidades.map(h => h.habilidad_id))];
    if (ids.length) {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      const found = await db.all(`SELECT id FROM habilidades WHERE id IN (${placeholders})`, ids);
      if (found.length !== ids.length)
        return res.status(400).json({ error: 'Alguna habilidad no existe en el catálogo' });
    }

    // Reemplazo completo: borrar y volver a insertar (mismo patrón que la
    // categoría de ONG en ngos.js — más simple y menos propenso a errores
    // que calcular un diff de altas/bajas/cambios de nivel).
    await db.run('DELETE FROM voluntario_habilidades WHERE user_id=$1', [req.user.id]);
    for (const h of habilidades) {
      await db.run(
        'INSERT INTO voluntario_habilidades (user_id, habilidad_id, nivel) VALUES ($1,$2,$3)',
        [req.user.id, h.habilidad_id, h.nivel || 'basico']
      );
    }

    const updated = await db.all(
      `SELECT h.id, h.nombre, h.descripcion, vh.nivel
       FROM voluntario_habilidades vh
       JOIN habilidades h ON h.id = vh.habilidad_id
       WHERE vh.user_id=$1
       ORDER BY h.nombre`,
      [req.user.id]
    );
    res.json({ habilidades: updated });
  } catch (err) {
    console.error('PUT /voluntarios/me/habilidades error:', err);
    res.status(500).json({ error: 'Error al guardar habilidades' });
  }
});
// ── GET /api/voluntarios/:userId — Perfil público de un voluntario ─────────
router.get('/:userId', async (req, res) => {
  try {
    const user = await db.get(
      `SELECT u.id, u.name, u.email, u.role, u.avatar, u.bio, u.location, u.created_at,
              v.nombre, v.apellido, v.descripcion, v.foto_perfil, v.banner,
              v.ubicacion, COALESCE(v.followers, 0) AS followers
       FROM users u
       LEFT JOIN voluntarios v ON v.user_id = u.id
       WHERE u.id = $1 AND u.role = 'volunteer'`,
      [req.params.userId]
    );
    if (!user) return res.status(404).json({ error: 'Voluntario no encontrado' });

    // Habilidades
    const habilidades = await db.all(
      `SELECT h.id, h.nombre, h.descripcion, vh.nivel
       FROM voluntario_habilidades vh
       JOIN habilidades h ON h.id = vh.habilidad_id
       WHERE vh.user_id = $1
       ORDER BY h.nombre`,
      [req.params.userId]
    );

    // Stats de participación
    const enrollmentStats = await db.get(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
              SUM(CASE WHEN status = 'approved' THEN horas_realizadas ELSE 0 END) AS total_horas
       FROM enrollments WHERE user_id = $1`,
      [req.params.userId]
    );

    // Voluntariados en los que participó (aprobados)
    const participaciones = await db.all(
      `SELECT e.id AS enrollment_id, e.status, e.horas_realizadas,
              p.id AS project_id, p.titulo, p.foto_perfil AS project_image,
              p.status AS project_status, p.ubicacion, p.tipo,
              n.nombre AS ngo_name, n.foto_perfil AS ngo_logo
       FROM enrollments e
       JOIN projects p ON p.id = e.project_id
       JOIN ngos n ON n.id = p.ngo_id
       WHERE e.user_id = $1 AND e.status = 'approved'
       ORDER BY e.created_at DESC
       LIMIT 20`,
      [req.params.userId]
    );

    // Counts de seguidores/seguidos
    const followingCount = await db.get(
      'SELECT COUNT(*) AS count FROM volunteer_follows WHERE follower_id = $1',
      [req.params.userId]
    );

    res.json({
      volunteer: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        location: user.location || user.ubicacion,
        nombre: user.nombre,
        apellido: user.apellido,
        foto_perfil: user.foto_perfil,
        banner: user.banner,
        descripcion: user.descripcion,
        followers: user.followers,
        following_count: followingCount?.count || 0,
        created_at: user.created_at,
      },
      habilidades,
      stats: {
        total_enrollments: enrollmentStats?.total || 0,
        approved_enrollments: enrollmentStats?.approved || 0,
        total_horas: enrollmentStats?.total_horas || 0,
      },
      participaciones,
    });
  } catch (err) {
    console.error('GET /voluntarios/:userId error:', err);
    res.status(500).json({ error: 'Error al obtener perfil del voluntario' });
  }
});

module.exports = router;
