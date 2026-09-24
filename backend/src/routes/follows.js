// src/routes/follows.js
const express = require('express');
const db = require('../db');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const parseJson = (val) => { try { return JSON.parse(val || '[]'); } catch { return []; } };

function fmtProject(p) {
  return {
    ...p,
    title:              p.titulo,
    description:        p.descripcion,
    full_description:   p.descripcion_full,
    image:              p.foto_perfil,
    category:           p.category_name || p.categoria || '',
    location:           p.ubicacion,
    type:               p.tipo,
    volunteers_needed:  p.cupos        || 0,
    current_volunteers: p.cupos_ocupados || 0,
    funding_goal:       p.meta_financiera || 0,
    current_funding:    p.recaudado    || 0,
    cost_per_person:    p.costo        || 0,
    hours_per_week:     p.horas_semanales || null,
    duration:           p.duracion     || null,
    roles_needed:       Array.isArray(p.roles_json) ? p.roles_json : parseJson(p.roles_json),
    requirements:       Array.isArray(p.requisitos_json) ? p.requisitos_json : parseJson(p.requisitos_json),
  };
}

function fmtNgo(n) {
  return {
    ...n,
    name:        n.nombre,
    logo:        n.foto_perfil,
    cover_image: n.banner,
    description: n.descripcion,
    mission:     n.mision,
    location:    n.ubicacion,
    category:    n.categoria_nombre || undefined,
  };
}

// ── ONGs ──────────────────────────────────────────────────────────────────

// POST /api/follows/ngo/:ngoId — Seguir ONG
router.post('/ngo/:ngoId', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const { ngoId } = req.params;
    const ngo = await db.get('SELECT id FROM ngos WHERE id = $1', [ngoId]);
    if (!ngo) return res.status(404).json({ error: 'ONG no encontrada' });

    const existing = await db.get(
      'SELECT 1 FROM ngo_follows WHERE user_id = $1 AND ngo_id = $2',
      [req.user.id, ngoId]
    );

    if (!existing) {
      await db.run(
        'INSERT INTO ngo_follows (user_id, ngo_id) VALUES ($1, $2)',
        [req.user.id, ngoId]
      );
      await db.run(
        'UPDATE ngos SET followers = COALESCE(followers, 0) + 1 WHERE id = $1',
        [ngoId]
      );
    }

    const updated = await db.get('SELECT followers FROM ngos WHERE id = $1', [ngoId]);
    res.json({
      following: true,
      followers: updated?.followers || 1,
      message: 'Ahora sigues a esta ONG'
    });
  } catch (err) {
    console.error('POST /follows/ngo error:', err);
    res.status(500).json({ error: 'Error al seguir la ONG' });
  }
});

// DELETE /api/follows/ngo/:ngoId — Dejar de seguir ONG
router.delete('/ngo/:ngoId', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const { ngoId } = req.params;
    const existing = await db.get(
      'SELECT 1 FROM ngo_follows WHERE user_id = $1 AND ngo_id = $2',
      [req.user.id, ngoId]
    );

    if (existing) {
      await db.run(
        'DELETE FROM ngo_follows WHERE user_id = $1 AND ngo_id = $2',
        [req.user.id, ngoId]
      );
      await db.run(
        'UPDATE ngos SET followers = CASE WHEN followers > 0 THEN followers - 1 ELSE 0 END WHERE id = $1',
        [ngoId]
      );
    }

    const updated = await db.get('SELECT followers FROM ngos WHERE id = $1', [ngoId]);
    res.json({
      following: false,
      followers: updated?.followers || 0,
      message: 'Dejaste de seguir a esta ONG'
    });
  } catch (err) {
    console.error('DELETE /follows/ngo error:', err);
    res.status(500).json({ error: 'Error al dejar de seguir la ONG' });
  }
});

// GET /api/follows/ngo — Listar ONGs seguidas por el usuario logueado
router.get('/ngo', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const ngos = await db.all(
      `SELECT n.*, COALESCE(c.nombre, '') AS categoria_nombre
       FROM ngos n
       JOIN ngo_follows nf ON nf.ngo_id = n.id
       LEFT JOIN ngo_categorias nc ON nc.ngo_id = n.id
       LEFT JOIN categorias c ON c.id = nc.categoria_id
       WHERE nf.user_id = $1
       ORDER BY nf.created_at DESC`,
      [req.user.id]
    );
    res.json({ ngos: ngos.map(fmtNgo) });
  } catch (err) {
    console.error('GET /follows/ngo error:', err);
    res.status(500).json({ error: 'Error al obtener ONGs seguidas' });
  }
});

// GET /api/follows/ngo/:ngoId/status — Saber si sigo esta ONG
router.get('/ngo/:ngoId/status', optionalAuth, async (req, res) => {
  try {
    if (!req.user) return res.json({ following: false });
    const follow = await db.get(
      'SELECT 1 FROM ngo_follows WHERE user_id = $1 AND ngo_id = $2',
      [req.user.id, req.params.ngoId]
    );
    res.json({ following: !!follow });
  } catch (err) {
    console.error('GET /follows/ngo/:ngoId/status error:', err);
    res.status(500).json({ error: 'Error al consultar estado' });
  }
});

// ── Voluntariados ─────────────────────────────────────────────────────────

// POST /api/follows/project/:projectId — Seguir voluntariado
router.post('/project/:projectId', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await db.get('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (!project) return res.status(404).json({ error: 'Voluntariado no encontrado' });

    const existing = await db.get(
      'SELECT 1 FROM project_follows WHERE user_id = $1 AND project_id = $2',
      [req.user.id, projectId]
    );

    if (!existing) {
      await db.run(
        'INSERT INTO project_follows (user_id, project_id) VALUES ($1, $2)',
        [req.user.id, projectId]
      );
      await db.run(
        'UPDATE projects SET followers = COALESCE(followers, 0) + 1 WHERE id = $1',
        [projectId]
      );
    }

    const updated = await db.get('SELECT followers FROM projects WHERE id = $1', [projectId]);
    res.json({
      following: true,
      followers: updated?.followers || 1,
      message: 'Ahora sigues este voluntariado'
    });
  } catch (err) {
    console.error('POST /follows/project error:', err);
    res.status(500).json({ error: 'Error al seguir el voluntariado' });
  }
});

// DELETE /api/follows/project/:projectId — Dejar de seguir voluntariado
router.delete('/project/:projectId', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const existing = await db.get(
      'SELECT 1 FROM project_follows WHERE user_id = $1 AND project_id = $2',
      [req.user.id, projectId]
    );

    if (existing) {
      await db.run(
        'DELETE FROM project_follows WHERE user_id = $1 AND project_id = $2',
        [req.user.id, projectId]
      );
      await db.run(
        'UPDATE projects SET followers = CASE WHEN followers > 0 THEN followers - 1 ELSE 0 END WHERE id = $1',
        [projectId]
      );
    }

    const updated = await db.get('SELECT followers FROM projects WHERE id = $1', [projectId]);
    res.json({
      following: false,
      followers: updated?.followers || 0,
      message: 'Dejaste de seguir este voluntariado'
    });
  } catch (err) {
    console.error('DELETE /follows/project error:', err);
    res.status(500).json({ error: 'Error al dejar de seguir el voluntariado' });
  }
});

// GET /api/follows/project — Listar voluntariados seguidos por el usuario
router.get('/project', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT p.*, n.nombre AS ngo_name, n.foto_perfil AS ngo_logo,
              '[]' AS roles_json, '[]' AS requisitos_json, NULL AS category_name
       FROM projects p
       JOIN ngos n ON n.id = p.ngo_id
       JOIN project_follows pf ON pf.project_id = p.id
       WHERE pf.user_id = $1
       ORDER BY pf.created_at DESC`,
      [req.user.id]
    );

    const ids = rows.map(r => r.id);
    if (ids.length) {
      const ph = ids.map((_, i) => `$${i + 1}`).join(',');
      const [allRoles, allReqs, allCats] = await Promise.all([
        db.all(`SELECT pr.project_id, ro.nombre FROM project_roles pr JOIN roles ro ON ro.id=pr.rol_id WHERE pr.project_id IN (${ph})`, ids),
        db.all(`SELECT project_id, descripcion FROM requisitos WHERE project_id IN (${ph})`, ids),
        db.all(`SELECT pc.project_id, c.nombre FROM project_categorias pc JOIN categorias c ON c.id=pc.categoria_id WHERE pc.project_id IN (${ph})`, ids),
      ]);

      const rolesByProject = {}, reqsByProject = {}, catByProject = {};
      for (const r of allRoles) (rolesByProject[r.project_id] ||= []).push(r.nombre);
      for (const r of allReqs)  (reqsByProject[r.project_id]  ||= []).push(r.descripcion);
      for (const r of allCats)  if (!catByProject[r.project_id]) catByProject[r.project_id] = r.nombre;

      for (const row of rows) {
        row.roles_json      = JSON.stringify(rolesByProject[row.id] || []);
        row.requisitos_json = JSON.stringify(reqsByProject[row.id]  || []);
        row.category_name   = catByProject[row.id] || '';
      }
    }

    res.json({ projects: rows.map(fmtProject) });
  } catch (err) {
    console.error('GET /follows/project error:', err);
    res.status(500).json({ error: 'Error al obtener voluntariados seguidos' });
  }
});

// GET /api/follows/project/:projectId/status — Saber si sigo este voluntariado
router.get('/project/:projectId/status', optionalAuth, async (req, res) => {
  try {
    if (!req.user) return res.json({ following: false });
    const follow = await db.get(
      'SELECT 1 FROM project_follows WHERE user_id = $1 AND project_id = $2',
      [req.user.id, req.params.projectId]
    );
    res.json({ following: !!follow });
  } catch (err) {
    console.error('GET /follows/project/:projectId/status error:', err);
    res.status(500).json({ error: 'Error al consultar estado' });
  }
});

// ── Feed Personalizado Unificado ──────────────────────────────────────────

// GET /api/follows/feed — Proyectos de ONGs seguidas + proyectos individuales seguidos
router.get('/feed', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = parseInt(req.query.offset) || 0;

    // Obtener ONGs seguidas e IDs de proyectos seguidos
    const [followedNgos, followedProjects] = await Promise.all([
      db.all('SELECT ngo_id FROM ngo_follows WHERE user_id = $1', [req.user.id]),
      db.all('SELECT project_id FROM project_follows WHERE user_id = $1', [req.user.id]),
    ]);

    const ngoIds = followedNgos.map(r => r.ngo_id);
    const projectIds = followedProjects.map(r => r.project_id);

    if (ngoIds.length === 0 && projectIds.length === 0) {
      return res.json({ projects: [], total: 0 });
    }

    // Traemos proyectos que pertenezcan a las ONGs seguidas O que estén en project_follows
    let whereClauses = [];
    let params = [];
    let pIdx = 1;

    if (ngoIds.length > 0) {
      const ngoPh = ngoIds.map(() => `$${pIdx++}`).join(',');
      whereClauses.push(`p.ngo_id IN (${ngoPh})`);
      params.push(...ngoIds);
    }
    if (projectIds.length > 0) {
      const projPh = projectIds.map(() => `$${pIdx++}`).join(',');
      whereClauses.push(`p.id IN (${projPh})`);
      params.push(...projectIds);
    }

    const whereSql = whereClauses.join(' OR ');

    const countRow = await db.get(
      `SELECT COUNT(DISTINCT p.id) as total FROM projects p WHERE (${whereSql})`,
      params
    );

    const rows = await db.all(
      `SELECT DISTINCT p.*, n.nombre AS ngo_name, n.foto_perfil AS ngo_logo,
              '[]' AS roles_json, '[]' AS requisitos_json, NULL AS category_name
       FROM projects p
       JOIN ngos n ON n.id = p.ngo_id
       WHERE (${whereSql})
       ORDER BY p.created_at DESC
       LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      [...params, limit, offset]
    );

    const ids = rows.map(r => r.id);
    if (ids.length) {
      const ph = ids.map((_, i) => `$${i + 1}`).join(',');
      const [allRoles, allReqs, allCats, allRatings, allComments, myEnrollments] = await Promise.all([
        db.all(`SELECT pr.project_id, ro.nombre FROM project_roles pr JOIN roles ro ON ro.id=pr.rol_id WHERE pr.project_id IN (${ph})`, ids),
        db.all(`SELECT project_id, descripcion FROM requisitos WHERE project_id IN (${ph})`, ids),
        db.all(`SELECT pc.project_id, c.nombre FROM project_categorias pc JOIN categorias c ON c.id=pc.categoria_id WHERE pc.project_id IN (${ph})`, ids),
        db.all(
          `SELECT r.id, r.project_id, r.rating, r.comment, r.created_at,
                  u.name AS user_name, u.avatar AS user_avatar
           FROM ratings r
           JOIN users u ON u.id = r.user_id
           WHERE r.project_id IN (${ph})
           ORDER BY r.created_at DESC`,
          ids
        ),
        // Últimos 3 comentarios con info de usuario e indicador de si participó
        db.all(
          `SELECT c.id, c.project_id, c.comment, c.created_at,
                  u.name AS user_name, u.avatar AS user_avatar,
                  CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END AS is_participant
           FROM comments c
           JOIN users u ON u.id = c.user_id
           LEFT JOIN enrollments e ON e.user_id = c.user_id AND e.project_id = c.project_id AND e.status = 'approved'
           WHERE c.project_id IN (${ph})
           ORDER BY c.created_at DESC`,
          ids
        ),
        db.all(
          `SELECT project_id, status FROM enrollments WHERE user_id = $1 AND project_id IN (${ph})`,
          [req.user.id, ...ids]
        ),
      ]);

      const rolesByProject = {}, reqsByProject = {}, catByProject = {};
      for (const r of allRoles) (rolesByProject[r.project_id] ||= []).push(r.nombre);
      for (const r of allReqs)  (reqsByProject[r.project_id]  ||= []).push(r.descripcion);
      for (const r of allCats)  if (!catByProject[r.project_id]) catByProject[r.project_id] = r.nombre;

      const ratingsByProject = {};
      for (const r of allRatings) (ratingsByProject[r.project_id] ||= []).push(r);

      const commentsByProject = {};
      const commentsCountByProject = {};
      for (const c of allComments) {
        commentsCountByProject[c.project_id] = (commentsCountByProject[c.project_id] || 0) + 1;
        if (!commentsByProject[c.project_id]) commentsByProject[c.project_id] = [];
        if (commentsByProject[c.project_id].length < 3) {
          commentsByProject[c.project_id].push({
            id: c.id,
            comment: c.comment,
            user_name: c.user_name,
            user_avatar: c.user_avatar,
            is_participant: Boolean(c.is_participant),
            created_at: c.created_at,
          });
        }
      }

      const enrollmentByProject = {};
      for (const e of myEnrollments) enrollmentByProject[e.project_id] = e.status;

      const ngoSet = new Set(ngoIds);
      const projSet = new Set(projectIds);

      for (const row of rows) {
        row.roles_json      = JSON.stringify(rolesByProject[row.id] || []);
        row.requisitos_json = JSON.stringify(reqsByProject[row.id]  || []);
        row.category_name   = catByProject[row.id] || '';

        const projectRatings = ratingsByProject[row.id] || [];
        row.avg_rating = projectRatings.length
          ? projectRatings.reduce((a, b) => a + b.rating, 0) / projectRatings.length
          : 0;
        row.ratings_count = projectRatings.length;
        row.ratings = projectRatings;

        row.recent_comments = commentsByProject[row.id] || [];
        row.comments_count = commentsCountByProject[row.id] || 0;
        row.my_enrollment_status = enrollmentByProject[row.id] || null;

        // Contexto de seguimiento
        const fromNgo = ngoSet.has(row.ngo_id);
        const fromProj = projSet.has(row.id);
        if (fromNgo && fromProj) {
          row.follow_source = 'both';
          row.follow_label = `Siguiendo a ${row.ngo_name} y este voluntariado`;
        } else if (fromNgo) {
          row.follow_source = 'ngo_follow';
          row.follow_label = `Siguiendo a ${row.ngo_name}`;
        } else {
          row.follow_source = 'project_follow';
          row.follow_label = 'Siguiendo este voluntariado';
        }
      }
    }

    res.json({
      projects: rows.map(fmtProject),
      total: countRow?.total || 0,
    });
  } catch (err) {
    console.error('GET /follows/feed error:', err);
    res.status(500).json({ error: 'Error al obtener feed' });
  }
});

// ── Voluntarios (follow entre voluntarios) ────────────────────────────────

// POST /api/follows/volunteer/:userId — Seguir a un voluntario
router.post('/volunteer/:userId', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) return res.status(400).json({ error: 'No podés seguirte a vos mismo' });

    const target = await db.get('SELECT id, role FROM users WHERE id = $1', [userId]);
    if (!target || target.role !== 'volunteer') return res.status(404).json({ error: 'Voluntario no encontrado' });

    const existing = await db.get(
      'SELECT 1 FROM volunteer_follows WHERE follower_id = $1 AND following_id = $2',
      [req.user.id, userId]
    );

    if (!existing) {
      await db.run(
        'INSERT INTO volunteer_follows (follower_id, following_id) VALUES ($1, $2)',
        [req.user.id, userId]
      );
      await db.run(
        'UPDATE voluntarios SET followers = COALESCE(followers, 0) + 1 WHERE user_id = $1',
        [userId]
      );

      // Notificación in-app al voluntario seguido
      await db.run(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1,'new_follower',$2,$3,$4)`,
        [userId,
         'Nuevo seguidor',
         `${req.user.name} empezó a seguirte`,
         JSON.stringify({ follower_id: req.user.id })]
      ).catch(() => {});
    }

    const updated = await db.get('SELECT COALESCE(followers, 0) AS followers FROM voluntarios WHERE user_id = $1', [userId]);
    res.json({
      following: true,
      followers: updated?.followers || 1,
      message: 'Ahora seguís a este voluntario'
    });
  } catch (err) {
    console.error('POST /follows/volunteer error:', err);
    res.status(500).json({ error: 'Error al seguir al voluntario' });
  }
});

// DELETE /api/follows/volunteer/:userId — Dejar de seguir a un voluntario
router.delete('/volunteer/:userId', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const { userId } = req.params;
    const existing = await db.get(
      'SELECT 1 FROM volunteer_follows WHERE follower_id = $1 AND following_id = $2',
      [req.user.id, userId]
    );

    if (existing) {
      await db.run(
        'DELETE FROM volunteer_follows WHERE follower_id = $1 AND following_id = $2',
        [req.user.id, userId]
      );
      await db.run(
        'UPDATE voluntarios SET followers = CASE WHEN followers > 0 THEN followers - 1 ELSE 0 END WHERE user_id = $1',
        [userId]
      );
    }

    const updated = await db.get('SELECT COALESCE(followers, 0) AS followers FROM voluntarios WHERE user_id = $1', [userId]);
    res.json({
      following: false,
      followers: updated?.followers || 0,
      message: 'Dejaste de seguir a este voluntario'
    });
  } catch (err) {
    console.error('DELETE /follows/volunteer error:', err);
    res.status(500).json({ error: 'Error al dejar de seguir al voluntario' });
  }
});

// GET /api/follows/volunteer/following — Voluntarios que yo sigo
router.get('/volunteer/following', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT u.id AS user_id, u.name, u.avatar, u.bio, u.location,
              v.nombre, v.apellido, v.foto_perfil, v.ubicacion,
              COALESCE(v.followers, 0) AS followers
       FROM volunteer_follows vf
       JOIN users u ON u.id = vf.following_id
       LEFT JOIN voluntarios v ON v.user_id = u.id
       WHERE vf.follower_id = $1
       ORDER BY vf.created_at DESC`,
      [req.user.id]
    );
    res.json({ volunteers: rows });
  } catch (err) {
    console.error('GET /follows/volunteer/following error:', err);
    res.status(500).json({ error: 'Error al obtener seguidos' });
  }
});

// GET /api/follows/volunteer/followers — Voluntarios que me siguen
router.get('/volunteer/followers', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT u.id AS user_id, u.name, u.avatar, u.bio, u.location,
              v.nombre, v.apellido, v.foto_perfil, v.ubicacion,
              COALESCE(v.followers, 0) AS followers
       FROM volunteer_follows vf
       JOIN users u ON u.id = vf.follower_id
       LEFT JOIN voluntarios v ON v.user_id = u.id
       WHERE vf.following_id = $1
       ORDER BY vf.created_at DESC`,
      [req.user.id]
    );
    res.json({ volunteers: rows });
  } catch (err) {
    console.error('GET /follows/volunteer/followers error:', err);
    res.status(500).json({ error: 'Error al obtener seguidores' });
  }
});

// GET /api/follows/volunteer/:userId/status — ¿Sigo a este voluntario?
router.get('/volunteer/:userId/status', optionalAuth, async (req, res) => {
  try {
    if (!req.user) return res.json({ following: false });
    const follow = await db.get(
      'SELECT 1 FROM volunteer_follows WHERE follower_id = $1 AND following_id = $2',
      [req.user.id, req.params.userId]
    );
    res.json({ following: !!follow });
  } catch (err) {
    console.error('GET /follows/volunteer/:userId/status error:', err);
    res.status(500).json({ error: 'Error al consultar estado' });
  }
});

// GET /api/follows/volunteer/:userId/followers — Seguidores de un voluntario específico
router.get('/volunteer/:userId/followers', optionalAuth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT u.id AS user_id, u.name, u.avatar, u.bio, u.location,
              v.nombre, v.apellido, v.foto_perfil, v.ubicacion,
              COALESCE(v.followers, 0) AS followers
       FROM volunteer_follows vf
       JOIN users u ON u.id = vf.follower_id
       LEFT JOIN voluntarios v ON v.user_id = u.id
       WHERE vf.following_id = $1
       ORDER BY vf.created_at DESC`,
      [req.params.userId]
    );
    res.json({ volunteers: rows });
  } catch (err) {
    console.error('GET /follows/volunteer/:userId/followers error:', err);
    res.status(500).json({ error: 'Error al obtener seguidores' });
  }
});

// GET /api/follows/volunteer/:userId/following — Seguidos de un voluntario específico
router.get('/volunteer/:userId/following', optionalAuth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT u.id AS user_id, u.name, u.avatar, u.bio, u.location,
              v.nombre, v.apellido, v.foto_perfil, v.ubicacion,
              COALESCE(v.followers, 0) AS followers
       FROM volunteer_follows vf
       JOIN users u ON u.id = vf.following_id
       LEFT JOIN voluntarios v ON v.user_id = u.id
       WHERE vf.follower_id = $1
       ORDER BY vf.created_at DESC`,
      [req.params.userId]
    );
    res.json({ volunteers: rows });
  } catch (err) {
    console.error('GET /follows/volunteer/:userId/following error:', err);
    res.status(500).json({ error: 'Error al obtener seguidos' });
  }
});

module.exports = router;
