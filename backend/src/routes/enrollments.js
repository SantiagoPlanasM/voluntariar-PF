// src/routes/enrollments.js
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/enrollments ─────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const { project_id, mensaje } = req.body;
    if (!project_id) return res.status(400).json({ error: 'project_id requerido' });

    const project = await db.get(
      'SELECT id, titulo, cupos, cupos_ocupados FROM projects WHERE id=$1 AND status=$2',
      [project_id, 'active']
    );
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado o inactivo' });

    if (project.cupos_ocupados >= project.cupos)
      return res.status(409).json({ error: 'El proyecto no tiene cupos disponibles' });

    // Verificar duplicado antes de insertar (evita race condition parcial)
    const already = await db.get(
      'SELECT id FROM enrollments WHERE user_id=$1 AND project_id=$2',
      [req.user.id, project_id]
    );
    if (already) return res.status(409).json({ error: 'Ya estás inscripto en este proyecto' });

    await db.run(
      `INSERT INTO enrollments (user_id, project_id, status, mensaje)
       VALUES ($1,$2,'pending',$3)`,
      [req.user.id, project_id, mensaje || null]
    );

    const enrollment = await db.get(
      'SELECT * FROM enrollments WHERE user_id=$1 AND project_id=$2',
      [req.user.id, project_id]
    );

    // Notificar a la ONG
    const ngo = await db.get(
      `SELECT u.id FROM projects p
       JOIN ngos n ON n.id = p.ngo_id
       JOIN users u ON u.id = n.user_id
       WHERE p.id = $1`, [project_id]
    );
    if (ngo) {
      await db.run(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1,'new_enrollment','Nueva solicitud de inscripción',$2,$3)`,
        [ngo.id,
         `${req.user.name} quiere unirse a "${project.titulo}"`,
         JSON.stringify({ project_id, user_id: req.user.id })]
      ).catch(() => {}); // no bloquear si falla la notif
    }

    res.status(201).json({ enrollment, message: 'Inscripción enviada. Pendiente de aprobación.' });
  } catch (err) {
    // Manejar constraint UNIQUE a nivel de BD (race condition)
    if (err.message?.includes('UNIQUE') || err.code === '23505') {
      return res.status(409).json({ error: 'Ya estás inscripto en este proyecto' });
    }
    console.error('POST /enrollments error:', err);
    res.status(500).json({ error: 'Error al inscribirse' });
  }
});

// ── GET /api/enrollments/my ───────────────────────────────────────────────
router.get('/my', requireAuth, async (req, res) => {
  try {
    const enrollments = await db.all(
      `SELECT e.*,
              p.titulo AS title, p.foto_perfil AS image, p.tipo AS type,
              p.ubicacion AS location, p.status AS project_status,
              n.nombre AS ngo_name, n.foto_perfil AS ngo_logo,
              COALESCE(c.nombre, '') AS category
       FROM enrollments e
       JOIN projects p ON p.id = e.project_id
       JOIN ngos n ON n.id = p.ngo_id
       LEFT JOIN project_categorias pc ON pc.project_id = p.id
       LEFT JOIN categorias c ON c.id = pc.categoria_id
       WHERE e.user_id = $1
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json({ enrollments });
  } catch (err) {
    console.error('GET /enrollments/my error:', err);
    res.status(500).json({ error: 'Error al obtener inscripciones' });
  }
});

// ── GET /api/enrollments/project/:projectId ───────────────────────────────
router.get('/project/:projectId', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const ngo = await db.get('SELECT id FROM ngos WHERE user_id=$1', [req.user.id]);
    const project = await db.get(
      'SELECT id FROM projects WHERE id=$1 AND ngo_id=$2',
      [req.params.projectId, ngo?.id]
    );
    if (!project) return res.status(403).json({ error: 'Sin permiso sobre este proyecto' });

    const { status } = req.query;
    let sql = `
      SELECT e.*,
             u.name AS volunteer_name, u.email AS volunteer_email,
             u.avatar AS volunteer_avatar, u.bio AS volunteer_bio
      FROM enrollments e
      JOIN users u ON u.id = e.user_id
      WHERE e.project_id = $1
    `;
    const params = [req.params.projectId];
    if (status) { sql += ' AND e.status = $2'; params.push(status); }
    sql += ' ORDER BY e.created_at DESC';

    const enrollments = await db.all(sql, params);
    res.json({ enrollments });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener inscripciones' });
  }
});

// ── PATCH /api/enrollments/:id ────────────────────────────────────────────
router.patch('/:id', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status))
      return res.status(400).json({ error: 'Status debe ser: approved o rejected' });

    const ngo = await db.get('SELECT id FROM ngos WHERE user_id=$1', [req.user.id]);
    const enrollment = await db.get(
      `SELECT e.*, p.titulo, p.ngo_id
       FROM enrollments e
       JOIN projects p ON p.id = e.project_id
       WHERE e.id = $1 AND p.ngo_id = $2`,
      [req.params.id, ngo?.id]
    );
    if (!enrollment) return res.status(404).json({ error: 'Inscripción no encontrada o sin permiso' });

    const oldStatus = enrollment.status;

    await db.run(
      'UPDATE enrollments SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
      [status, req.params.id]
    );

    // Actualizar cupos_ocupados con CASE WHEN para evitar negativos (compatible SQLite y PG)
    if (status === 'approved' && oldStatus !== 'approved') {
      await db.run(
        'UPDATE projects SET cupos_ocupados = cupos_ocupados + 1 WHERE id=$1',
        [enrollment.project_id]
      );
    } else if (status === 'rejected' && oldStatus === 'approved') {
      await db.run(
        `UPDATE projects SET cupos_ocupados =
          CASE WHEN cupos_ocupados > 0 THEN cupos_ocupados - 1 ELSE 0 END
         WHERE id=$1`,
        [enrollment.project_id]
      );
    }

    // Notificar al voluntario
    const notifTitle = status === 'approved'
      ? `¡Inscripción aprobada en "${enrollment.titulo}"!`
      : `Inscripción no seleccionada en "${enrollment.titulo}"`;

    await db.run(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1,$2,$3,$4,$5)`,
      [enrollment.user_id,
       status === 'approved' ? 'enrollment_approved' : 'enrollment_rejected',
       notifTitle,
       status === 'approved'
         ? 'Ya podés ver los detalles en "Mis participaciones".'
         : 'Gracias por tu interés. Seguí explorando otros proyectos.',
       JSON.stringify({ project_id: enrollment.project_id })]
    ).catch(() => {});

    res.json({ message: `Inscripción ${status === 'approved' ? 'aprobada' : 'rechazada'}` });
  } catch (err) {
    console.error('PATCH /enrollments/:id error:', err);
    res.status(500).json({ error: 'Error al actualizar inscripción' });
  }
});

// ── DELETE /api/enrollments/:id ───────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const enrollment = await db.get(
      'SELECT * FROM enrollments WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!enrollment) return res.status(404).json({ error: 'Inscripción no encontrada' });

    await db.run('DELETE FROM enrollments WHERE id=$1', [req.params.id]);

    // Decrementar cupos si estaba aprobada
    if (enrollment.status === 'approved') {
      await db.run(
        `UPDATE projects SET cupos_ocupados =
          CASE WHEN cupos_ocupados > 0 THEN cupos_ocupados - 1 ELSE 0 END
         WHERE id=$1`,
        [enrollment.project_id]
      );
    }

    res.json({ message: 'Inscripción cancelada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cancelar' });
  }
});

// ── PATCH /api/enrollments/:id/horas ─────────────────────────────────────
// Registrar horas realizadas por el voluntario
router.patch('/:id/horas', requireAuth, async (req, res) => {
  try {
    const { horas } = req.body;
    const h = parseFloat(horas);
    if (isNaN(h) || h < 0) return res.status(400).json({ error: 'Horas debe ser un número positivo' });

    const enrollment = await db.get(
      'SELECT * FROM enrollments WHERE id=$1 AND user_id=$2 AND status=$3',
      [req.params.id, req.user.id, 'approved']
    );
    if (!enrollment) return res.status(404).json({ error: 'Inscripción aprobada no encontrada' });

    await db.run(
      'UPDATE enrollments SET horas_realizadas=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
      [h, req.params.id]
    );
    res.json({ message: 'Horas registradas', horas: h });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar horas' });
  }
});

module.exports = router;
