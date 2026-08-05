// src/routes/projects.js
const express = require('express');
const db = require('../db');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────
const parseJson = (val) => { try { return JSON.parse(val || '[]'); } catch { return []; } };

function fmt(p) {
  return {
    ...p,
    // Compatibilidad frontend: mapear campos nuevos a los nombres que espera el front
    title: p.titulo,
    description: p.descripcion,
    full_description: p.descripcion_full,
    image: p.foto_perfil,
    category: p.category_name || p.categoria || '',
    location: p.ubicacion,
    type: p.tipo,
    volunteers_needed: p.cupos || 0,
    current_volunteers: p.cupos_ocupados || 0,
    funding_goal: p.meta_financiera || 0,
    current_funding: p.recaudado || 0,
    cost_per_person: p.costo || 0,
    hours_per_week: p.horas_semanales || null,
    duration: p.duracion || null,
    roles_needed: parseJson(p.roles_json),
    requirements: parseJson(p.requisitos_json),
  };
}

// ── Validación ────────────────────────────────────────────────────────────
function validateProject(body) {
  const { title, description, location, tipo, duracion, horas_semanales, cupos } = body;
  if (!title?.trim() || title.trim().length < 3) return 'El título debe tener al menos 3 caracteres';
  if (!description?.trim() || description.trim().length < 10) return 'La descripción debe tener al menos 10 caracteres';
  if (!location?.trim()) return 'La ubicación es obligatoria (podés poner "Remoto")';
  if (tipo === 'fugaz' && !duracion?.trim()) return 'La duración es obligatoria para proyectos fugaces';
  if (tipo === 'sostenido') {
    const h = parseInt(horas_semanales);
    if (!horas_semanales || isNaN(h) || h < 1) return 'Las horas semanales deben ser un número positivo';
  }
  const v = parseInt(cupos);
  if (!cupos || isNaN(v) || v < 1) return 'Los cupos deben ser un número positivo';
  return null;
}

// ── GET /api/projects ─────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category, type, status, search, limit = 20, offset = 0 } = req.query;

    // Roles como JSON agregado compatible con SQLite y PostgreSQL
    const rolesAgg = db.type === 'postgres'
      ? `COALESCE(json_agg(DISTINCT jsonb_build_object('nombre', ro.nombre)) FILTER (WHERE ro.nombre IS NOT NULL), '[]'::json) AS roles_json`
      : `'[]' AS roles_json`;

    const reqAgg = db.type === 'postgres'
      ? `COALESCE(json_agg(DISTINCT req.descripcion) FILTER (WHERE req.descripcion IS NOT NULL), '[]'::json) AS requisitos_json`
      : `'[]' AS requisitos_json`;

    let sql = `
      SELECT
        p.*,
        n.nombre    AS ngo_name,
        n.foto_perfil AS ngo_logo,
        c.nombre    AS category_name,
        ${rolesAgg},
        ${reqAgg}
      FROM projects p
      JOIN ngos n ON n.id = p.ngo_id
      LEFT JOIN project_categorias pc ON pc.project_id = p.id
      LEFT JOIN categorias c ON c.id = pc.categoria_id
      LEFT JOIN project_roles pr ON pr.project_id = p.id
      LEFT JOIN roles ro ON ro.id = pr.rol_id
      LEFT JOIN requisitos req ON req.project_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let i = 1;

    if (category && category !== 'Todos') {
      sql += ` AND c.nombre = $${i++}`; params.push(category);
    }
    if (type && type !== 'Todos') {
      sql += ` AND p.tipo = $${i++}`; params.push(type);
    }
    if (status) {
      sql += ` AND p.status = $${i++}`; params.push(status);
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      const si = i; const ti = i + 1; const ni = i + 2; const ci = i + 3; const ui = i + 4;
      sql += ` AND (p.titulo LIKE $${si} OR p.descripcion LIKE $${ti} OR n.nombre LIKE $${ni} OR c.nombre LIKE $${ci} OR p.ubicacion LIKE $${ui})`;
      params.push(q, q, q, q, q); i += 5;
    }

    sql += ` GROUP BY p.id, n.nombre, n.foto_perfil, c.nombre`;
    sql += ` ORDER BY p.created_at DESC LIMIT $${i++} OFFSET $${i++}`;
    params.push(parseInt(limit), parseInt(offset));

    // SQLite no soporta JOINs con aggregation igual que PG → fallback simple
    let rows;
    if (db.type === 'postgres') {
      const result = await db.query(sql, params);
      rows = result.rows;
    } else {
      // SQLite: query simple sin agregación, roles y requisitos se cargan aparte
      let simpleSql = `
        SELECT p.*, n.nombre AS ngo_name, n.foto_perfil AS ngo_logo,
               '[]' AS roles_json, '[]' AS requisitos_json, NULL AS category_name
        FROM projects p
        JOIN ngos n ON n.id = p.ngo_id
        WHERE 1=1
      `;
      const simpleParams = [];
      let si = 1;
      if (category && category !== 'Todos') {
        // En SQLite buscamos en tabla project_categorias
        simpleSql += ` AND p.id IN (SELECT project_id FROM project_categorias pc2 JOIN categorias c2 ON c2.id=pc2.categoria_id WHERE c2.nombre=$${si++})`;
        simpleParams.push(category);
      }
      if (type && type !== 'Todos') { simpleSql += ` AND p.tipo=$${si++}`; simpleParams.push(type); }
      if (status) { simpleSql += ` AND p.status=$${si++}`; simpleParams.push(status); }
      if (search && search.trim()) {
        const q = `%${search.trim()}%`;
        simpleSql += ` AND (p.titulo LIKE $${si} OR p.descripcion LIKE $${si + 1} OR n.nombre LIKE $${si + 2} OR p.ubicacion LIKE $${si + 3})`;
        simpleParams.push(q, q, q, q); si += 4;
      }
      simpleSql += ` ORDER BY p.created_at DESC LIMIT $${si++} OFFSET $${si++}`;
      simpleParams.push(parseInt(limit), parseInt(offset));
      rows = await db.all(simpleSql, simpleParams);

      // Enriquecer con roles, requisitos y categoría
      for (const row of rows) {
        const roles = await db.all(
          `SELECT ro.nombre FROM project_roles pr JOIN roles ro ON ro.id=pr.rol_id WHERE pr.project_id=$1`, [row.id]
        );
        const reqs = await db.all(
          `SELECT descripcion FROM requisitos WHERE project_id=$1`, [row.id]
        );
        const cat = await db.get(
          `SELECT c.nombre FROM project_categorias pc JOIN categorias c ON c.id=pc.categoria_id WHERE pc.project_id=$1 LIMIT 1`, [row.id]
        );
        row.roles_json = JSON.stringify(roles.map(r => r.nombre));
        row.requisitos_json = JSON.stringify(reqs.map(r => r.descripcion));
        row.category_name = cat?.nombre || '';
      }
    }

    res.json({ projects: rows.map(fmt) });
  } catch (err) {
    console.error('GET /projects error:', err);
    res.status(500).json({ error: 'Error al obtener proyectos' });
  }
});

// ── GET /api/projects/:id ─────────────────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const project = await db.get(
      `SELECT p.*, n.nombre AS ngo_name, n.foto_perfil AS ngo_logo
       FROM projects p JOIN ngos n ON n.id = p.ngo_id WHERE p.id = $1`,
      [req.params.id]
    );
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

    // Roles, requisitos y categoría
    const rolesRows = await db.all(
      `SELECT ro.nombre FROM project_roles pr JOIN roles ro ON ro.id = pr.rol_id WHERE pr.project_id = $1`, [req.params.id]
    );
    const reqRows = await db.all(
      `SELECT descripcion FROM requisitos WHERE project_id = $1`, [req.params.id]
    );
    const catRow = await db.get(
      `SELECT c.nombre FROM project_categorias pc JOIN categorias c ON c.id = pc.categoria_id WHERE pc.project_id = $1 LIMIT 1`, [req.params.id]
    );

    project.roles_json = JSON.stringify(rolesRows.map(r => r.nombre));
    project.requisitos_json = JSON.stringify(reqRows.map(r => r.descripcion));
    project.category_name = catRow?.nombre || '';

    const comments = await db.all(
      `SELECT c.*, u.name AS user_name, u.avatar AS user_avatar
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.project_id = $1 ORDER BY c.created_at DESC`, [req.params.id]
    );
    const ratings = await db.all(
      `SELECT r.*, u.name AS user_name
       FROM ratings r JOIN users u ON u.id = r.user_id
       WHERE r.project_id = $1`, [req.params.id]
    );
    const avgRating = ratings.length
      ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;

    let myEnrollment = null;
    if (req.user) {
      myEnrollment = await db.get(
        'SELECT * FROM enrollments WHERE user_id=$1 AND project_id=$2',
        [req.user.id, req.params.id]
      );
    }

    res.json({
      project: {
        ...fmt(project),
        comments,
        ratings,
        avg_rating: Math.round(avgRating * 10) / 10,
        my_enrollment: myEnrollment,
      }
    });
  } catch (err) {
    console.error('GET /projects/:id error:', err);
    res.status(500).json({ error: 'Error al obtener proyecto' });
  }
});

// ── POST /api/projects ────────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const ngo = await db.get('SELECT id FROM ngos WHERE user_id=$1', [req.user.id]);
    if (!ngo) return res.status(404).json({ error: 'Perfil ONG no encontrado' });

    const {
      title, description, full_description, image, category, location,
      type, duration, cupos, funding_goal, cost_per_person,
      hours_per_week, roles_needed = [], requirements = []
    } = req.body;

    const err = validateProject({
      title, description, location,
      tipo: type, duracion: duration,
      horas_semanales: hours_per_week, cupos
    });
    if (err) return res.status(400).json({ error: err });

    // Insertar proyecto
    await db.run(
      `INSERT INTO projects (ngo_id, titulo, descripcion, descripcion_full, foto_perfil,
        tipo, status, ubicacion, duracion, cupos, cupos_ocupados,
        meta_financiera, recaudado, costo, horas_semanales)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,0,$10,0,$11,$12)`,
      [ngo.id, title.trim(), description.trim(), full_description?.trim() || null,
      image || null, type || 'fugaz', location.trim(), duration?.trim() || null,
      parseInt(cupos) || 0, parseFloat(funding_goal) || 0,
      parseFloat(cost_per_person) || 0,
      type === 'sostenido' ? parseInt(hours_per_week) : null]
    );

    const newProject = await db.get(
      'SELECT * FROM projects WHERE ngo_id=$1 ORDER BY created_at DESC LIMIT 1', [ngo.id]
    );

    // Categoría
    if (category) {
      let cat = await db.get('SELECT id FROM categorias WHERE nombre=$1', [category]);
      if (!cat) {
        await db.run('INSERT INTO categorias (nombre) VALUES ($1)', [category]);
        cat = await db.get('SELECT id FROM categorias WHERE nombre=$1', [category]);
      }
      await db.run(
        'INSERT INTO project_categorias (project_id, categoria_id) VALUES ($1,$2)',
        [newProject.id, cat.id]
      ).catch(() => { }); // ignorar duplicado
    }

    // Roles
    for (const rolNombre of roles_needed) {
      if (!rolNombre?.trim()) continue;
      let rol = await db.get('SELECT id FROM roles WHERE nombre=$1', [rolNombre.trim()]);
      if (!rol) {
        await db.run('INSERT INTO roles (nombre) VALUES ($1)', [rolNombre.trim()]);
        rol = await db.get('SELECT id FROM roles WHERE nombre=$1', [rolNombre.trim()]);
      }
      await db.run(
        'INSERT INTO project_roles (project_id, rol_id) VALUES ($1,$2)',
        [newProject.id, rol.id]
      ).catch(() => { });
    }

    // Requisitos
    for (const desc of requirements) {
      if (!desc?.trim() || desc.trim().length < 2) continue;
      await db.run(
        'INSERT INTO requisitos (project_id, descripcion) VALUES ($1,$2)',
        [newProject.id, desc.trim()]
      );
    }

    newProject.roles_json = JSON.stringify(roles_needed);
    newProject.requisitos_json = JSON.stringify(requirements);
    newProject.category_name = category || '';

    res.status(201).json({ project: fmt(newProject) });
  } catch (err) {
    console.error('POST /projects error:', err);
    res.status(500).json({ error: 'Error al crear proyecto' });
  }
});

// ── PUT /api/projects/:id ─────────────────────────────────────────────────
router.put('/:id', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const ngo = await db.get('SELECT id FROM ngos WHERE user_id=$1', [req.user.id]);
    const project = await db.get('SELECT * FROM projects WHERE id=$1 AND ngo_id=$2', [req.params.id, ngo?.id]);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado o sin permiso' });

    const { title, description, full_description, image, location, type, duration,
      cupos, funding_goal, cost_per_person, hours_per_week, status } = req.body;

    await db.run(
      `UPDATE projects SET titulo=$1, descripcion=$2, descripcion_full=$3, foto_perfil=$4,
       ubicacion=$5, tipo=$6, status=$7, duracion=$8, cupos=$9, meta_financiera=$10,
       costo=$11, horas_semanales=$12, updated_at=CURRENT_TIMESTAMP WHERE id=$13`,
      [title?.trim(), description?.trim(), full_description?.trim() || null, image || null,
      location?.trim(), type, status || 'active', duration?.trim() || null,
      parseInt(cupos) || 0, parseFloat(funding_goal) || 0,
      parseFloat(cost_per_person) || 0,
      type === 'sostenido' ? parseInt(hours_per_week) : null,
      req.params.id]
    );

    const updated = await db.get('SELECT * FROM projects WHERE id=$1', [req.params.id]);
    updated.roles_json = JSON.stringify(req.body.roles_needed || []);
    updated.requisitos_json = JSON.stringify(req.body.requirements || []);
    updated.category_name = req.body.category || '';
    res.json({ project: fmt(updated) });
  } catch (err) {
    console.error('PUT /projects error:', err);
    res.status(500).json({ error: 'Error al actualizar proyecto' });
  }
});

// ── DELETE /api/projects/:id ──────────────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const ngo = await db.get('SELECT id FROM ngos WHERE user_id=$1', [req.user.id]);
    const p = await db.get('SELECT id FROM projects WHERE id=$1 AND ngo_id=$2', [req.params.id, ngo?.id]);
    if (!p) return res.status(404).json({ error: 'Proyecto no encontrado o sin permiso' });
    await db.run('DELETE FROM projects WHERE id=$1', [req.params.id]);
    res.json({ message: 'Proyecto eliminado' });
  } catch (err) { res.status(500).json({ error: 'Error al eliminar' }); }
});

// ── POST /api/projects/:id/comments ──────────────────────────────────────
const BLACKLIST = ['pelotudo', 'boludo', 'idiota', 'imbecil', 'mierda', 'puto', 'puta', 'hdp', 'concha', 'forro', 'tarado'];
const hasBadWord = (t) => BLACKLIST.some(w => t.toLowerCase().includes(w));

router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment?.trim() || comment.trim().length < 3)
      return res.status(400).json({ error: 'Comentario muy corto' });
    if (hasBadWord(comment))
      return res.status(400).json({ error: 'El comentario contiene palabras no permitidas' });

    await db.run(
      `INSERT INTO comments (project_id, user_id, comment) VALUES ($1,$2,$3)`,
      [req.params.id, req.user.id, comment.trim()]
    );
    const saved = await db.get(
      `SELECT c.*, u.name AS user_name, u.avatar AS user_avatar
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.project_id=$1 AND c.user_id=$2 ORDER BY c.created_at DESC LIMIT 1`,
      [req.params.id, req.user.id]
    );
    res.status(201).json({ comment: saved });
  } catch (err) { res.status(500).json({ error: 'Error al comentar' }); }
});

// ── POST /api/projects/:id/ratings ────────────────────────────────────────
router.post('/:id/ratings', requireAuth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ error: 'Rating entre 1 y 5' });

    const existing = await db.get(
      'SELECT id FROM ratings WHERE user_id=$1 AND project_id=$2',
      [req.user.id, req.params.id]
    );
    if (existing) {
      await db.run('UPDATE ratings SET rating=$1, comment=$2 WHERE id=$3', [rating, comment, existing.id]);
    } else {
      await db.run(
        `INSERT INTO ratings (project_id, user_id, rating, comment) VALUES ($1,$2,$3,$4)`,
        [req.params.id, req.user.id, rating, comment]
      );
    }
    res.json({ message: 'Calificación guardada' });
  } catch (err) { res.status(500).json({ error: 'Error al calificar' }); }
});

module.exports = router;
