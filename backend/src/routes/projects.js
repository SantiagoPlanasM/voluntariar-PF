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
    title:              p.titulo,
    description:        p.descripcion,
    full_description:   p.descripcion_full,
    image:              p.foto_perfil,
    category:           p.category_name || p.categoria || '',
    location:           p.ubicacion,
    modality:           p.modalidad || (p.ubicacion && (p.ubicacion.toLowerCase().includes('remoto') || p.ubicacion.toLowerCase().includes('virtual')) ? 'remoto' : 'presencial'),
    latitude:           p.latitud != null ? Number(p.latitud) : (p.latitude != null ? Number(p.latitude) : null),
    longitude:          p.longitud != null ? Number(p.longitud) : (p.longitude != null ? Number(p.longitude) : null),
    type:               p.tipo,
    volunteers_needed:  p.cupos        || 0,
    current_volunteers: p.cupos_ocupados || 0,
    funding_goal:       p.meta_financiera || 0,
    current_funding:    p.recaudado    || 0,
    cost_per_person:    p.costo        || 0,
    hours_per_week:     p.horas_semanales || null,
    duration:           p.duracion     || null,
    roles_needed:       parseJson(p.roles_json),
    requirements:       parseJson(p.requisitos_json),
    followers:          p.followers != null ? Number(p.followers) : 0,
    ngo_followers:      p.ngo_followers != null ? Number(p.ngo_followers) : 0,
    avg_rating:         p.avg_rating != null && Number(p.avg_rating) > 0 ? Number(Number(p.avg_rating).toFixed(1)) : null,
    ratings_count:      p.ratings_count != null ? Number(p.ratings_count) : 0,
  };
}

// ── Validación ────────────────────────────────────────────────────────────
function validateProject(body) {
  const { title, description, location, tipo, duracion, horas_semanales, volunteers_needed } = body;
  if (!title?.trim() || title.trim().length < 3)        return 'El título debe tener al menos 3 caracteres';
  if (!description?.trim() || description.trim().length < 10) return 'La descripción debe tener al menos 10 caracteres';
  if (!location?.trim())                                return 'La ubicación es obligatoria (podés poner "Remoto")';
  if (tipo === 'fugaz' && !duracion?.trim())            return 'La duración es obligatoria para proyectos fugaces';
  if (tipo === 'sostenido') {
    const h = parseInt(horas_semanales);
    if (!horas_semanales || isNaN(h) || h < 1)         return 'Las horas semanales deben ser un número positivo';
  }
  const v = parseInt(volunteers_needed);
  if (!volunteers_needed || isNaN(v) || v < 1)         return 'Los cupos deben ser un número positivo';
  return null;
}

// ── GET /api/projects ─────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category, type, status, search, modality, modalidad, sort = 'featured', limit = 20, offset = 0 } = req.query;
    const modFilter = modality || modalidad;

    let orderSql;
    if (sort === 'recent') {
      orderSql = 'p.created_at DESC';
    } else if (sort === 'rating') {
      orderSql = 'COALESCE(r.avg_rating, 0) DESC, COALESCE(r.ratings_count, 0) DESC, p.created_at DESC';
    } else {
      // sort === 'featured' (por defecto): score ponderado por estado activo, participantes, rating y followers
      // Prioridad máxima a los seguidores del voluntariado específico (p.followers * 8) + respaldo secundario por seguidores de la ONG (n.followers * 0.005)
      orderSql = `(
        CASE WHEN p.status = 'active' THEN 20 ELSE 0 END
        + (COALESCE(p.cupos_ocupados, 0) * 4)
        + (COALESCE(r.avg_rating, 0) * (CASE WHEN COALESCE(r.ratings_count, 0) >= 4 THEN 16 WHEN COALESCE(r.ratings_count, 0) >= 2 THEN 10 WHEN COALESCE(r.ratings_count, 0) >= 1 THEN 5 ELSE 0 END))
        + (COALESCE(p.followers, 0) * 8)
        + (CASE WHEN COALESCE(n.followers, 0) > 0 THEN (COALESCE(n.followers, 0) * 0.005) ELSE 0 END)
      ) DESC, p.created_at DESC`;
    }

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
        COALESCE(n.followers, 0) AS ngo_followers,
        c.nombre    AS category_name,
        COALESCE(r.avg_rating, 0) AS avg_rating,
        COALESCE(r.ratings_count, 0) AS ratings_count,
        ${rolesAgg},
        ${reqAgg}
      FROM projects p
      JOIN ngos n ON n.id = p.ngo_id
      LEFT JOIN project_categorias pc ON pc.project_id = p.id
      LEFT JOIN categorias c ON c.id = pc.categoria_id
      LEFT JOIN (
        SELECT project_id, AVG(rating) AS avg_rating, COUNT(*) AS ratings_count
        FROM ratings
        GROUP BY project_id
      ) r ON r.project_id = p.id
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
    if (modFilter && modFilter !== 'all' && modFilter !== 'Todos') {
      if (modFilter === 'remoto') {
        sql += ` AND (p.modalidad = 'remoto' OR p.ubicacion LIKE '%remoto%' OR p.ubicacion LIKE '%virtual%')`;
      } else if (modFilter === 'presencial') {
        sql += ` AND (p.modalidad = 'presencial' AND (p.ubicacion NOT LIKE '%remoto%' AND p.ubicacion NOT LIKE '%virtual%'))`;
      } else if (modFilter === 'hibrido') {
        sql += ` AND p.modalidad = 'hibrido'`;
      }
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      const si = i; const ti = i+1; const ni = i+2; const ci = i+3; const ui = i+4;
      sql += ` AND (p.titulo LIKE $${si} OR p.descripcion LIKE $${ti} OR n.nombre LIKE $${ni} OR c.nombre LIKE $${ci} OR p.ubicacion LIKE $${ui})`;
      params.push(q, q, q, q, q); i += 5;
    }

    sql += ` GROUP BY p.id, n.nombre, n.foto_perfil, n.followers, c.nombre, r.avg_rating, r.ratings_count`;
    sql += ` ORDER BY ${orderSql} LIMIT $${i++} OFFSET $${i++}`;
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
               COALESCE(n.followers, 0) AS ngo_followers,
               '[]' AS roles_json, '[]' AS requisitos_json, NULL AS category_name,
               COALESCE(r.avg_rating, 0) AS avg_rating,
               COALESCE(r.ratings_count, 0) AS ratings_count
        FROM projects p
        JOIN ngos n ON n.id = p.ngo_id
        LEFT JOIN (
          SELECT project_id, AVG(rating) AS avg_rating, COUNT(*) AS ratings_count
          FROM ratings
          GROUP BY project_id
        ) r ON r.project_id = p.id
        WHERE 1=1
      `;
      const simpleParams = [];
      let si = 1;
      if (category && category !== 'Todos') {
        // En SQLite buscamos en tabla project_categorias
        simpleSql += ` AND p.id IN (SELECT project_id FROM project_categorias pc2 JOIN categorias c2 ON c2.id=pc2.categoria_id WHERE c2.nombre=$${si++})`;
        simpleParams.push(category);
      }
      if (type && type !== 'Todos')  { simpleSql += ` AND p.tipo=$${si++}`;   simpleParams.push(type); }
      if (status)                    { simpleSql += ` AND p.status=$${si++}`; simpleParams.push(status); }
      if (modFilter && modFilter !== 'all' && modFilter !== 'Todos') {
        if (modFilter === 'remoto') {
          simpleSql += ` AND (p.modalidad = 'remoto' OR p.ubicacion LIKE '%remoto%' OR p.ubicacion LIKE '%virtual%')`;
        } else if (modFilter === 'presencial') {
          simpleSql += ` AND (p.modalidad = 'presencial' AND (p.ubicacion NOT LIKE '%remoto%' AND p.ubicacion NOT LIKE '%virtual%'))`;
        } else if (modFilter === 'hibrido') {
          simpleSql += ` AND p.modalidad = 'hibrido'`;
        }
      }
      if (search && search.trim()) {
        const q = `%${search.trim()}%`;
        simpleSql += ` AND (p.titulo LIKE $${si} OR p.descripcion LIKE $${si+1} OR n.nombre LIKE $${si+2} OR p.ubicacion LIKE $${si+3})`;
        simpleParams.push(q, q, q, q); si += 4;
      }
      simpleSql += ` ORDER BY ${orderSql} LIMIT $${si++} OFFSET $${si++}`;
      simpleParams.push(parseInt(limit), parseInt(offset));
      rows = await db.all(simpleSql, simpleParams);

      // Enriquecer con roles, requisitos y categoría — en batch (antes era
      // N+1: hasta 3 queries por fila, es decir hasta 60 queries extra para
      // una página de 20 proyectos). Ahora son 3 queries fijas sin importar
      // cuántas filas traiga la página.
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
        for (const r of allCats)  if (!catByProject[r.project_id]) catByProject[r.project_id] = r.nombre; // primera categoría (mismo criterio que el LIMIT 1 anterior)

        for (const row of rows) {
          row.roles_json      = JSON.stringify(rolesByProject[row.id] || []);
          row.requisitos_json = JSON.stringify(reqsByProject[row.id]  || []);
          row.category_name   = catByProject[row.id] || '';
        }
      }
    }

    res.json({ projects: rows.map(fmt) });
  } catch (err) {
    console.error('GET /projects error:', err);
    res.status(500).json({ error: 'Error al obtener proyectos' });
  }
});

// ── GET /api/projects/recommended ─────────────────────────────────────────
// Recomendación basada en reglas (sin ML/IA), usando 8 señales disponibles
// en la plataforma para un scoring de 0-100 puntos explicable y portable.
//
// Señales: afinidad temática (30pts), match de habilidades (20pts),
// afinidad con ONG (15pts), actividad social (15pts), proximidad
// geográfica (10pts), urgencia de cupos (8pts), novedad (7pts),
// popularidad/rating (5pts), momentum (5pts).
//
// IMPORTANTE: esta ruta tiene que estar declarada ANTES de GET /:id — si
// fuera después, Express interpretaría "recommended" como si fuera el
// parámetro :id y esta ruta nunca se alcanzaría.

// Mapping de habilidades de voluntario → roles de proyecto compatibles
const SKILL_TO_ROLE = {
  'programación':       ['Programador'],
  'fotografía':         ['Fotógrafo'],
  'enseñanza':          ['Educador'],
  'cocina':             ['Cocinero'],
  'conducción':         ['Conductor'],
  'primeros auxilios':  ['Médico / Enfermero'],
  'comunicación':       ['Comunicador'],
  'redes sociales':     ['Comunicador'],
  'electricidad':       ['Técnico'],
  'carpintería':        ['Técnico'],
  'diseño gráfico':     ['Comunicador'],
  'administración':     ['Coordinador'],
  'idiomas':            ['Educador'],
};

router.get('/recommended', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);

    // ── 1) Historial del voluntario: categorías de interés ────────────
    const myEnrolledProjectIds = await db.all(
      'SELECT project_id FROM enrollments WHERE user_id=$1',
      [req.user.id]
    );
    const enrolledIds = myEnrolledProjectIds.map(r => r.project_id);

    const categoryFreq = {};
    if (enrolledIds.length) {
      const ph = enrolledIds.map((_, i) => `$${i + 1}`).join(',');
      const catRows = await db.all(
        `SELECT categoria_id FROM project_categorias WHERE project_id IN (${ph})`,
        enrolledIds
      );
      for (const { categoria_id } of catRows) {
        categoryFreq[categoria_id] = (categoryFreq[categoria_id] || 0) + 1;
      }
    }

    // ── 2) Ubicación del voluntario ───────────────────────────────────
    const userRow = await db.get('SELECT location FROM users WHERE id=$1', [req.user.id]);
    const myLocation = userRow?.location?.trim().toLowerCase() || null;

    // ── 3) ONGs seguidas (directas + indirectas vía project_follows) ──
    const [followedNgos, followedProjectNgos] = await Promise.all([
      db.all('SELECT ngo_id FROM ngo_follows WHERE user_id=$1', [req.user.id]),
      db.all(
        `SELECT DISTINCT p.ngo_id FROM project_follows pf
         JOIN projects p ON p.id = pf.project_id
         WHERE pf.user_id = $1`,
        [req.user.id]
      ),
    ]);
    const followedNgoSet = new Set(followedNgos.map(r => r.ngo_id));
    const interestedNgoIds = new Set([
      ...followedNgoSet,
      ...followedProjectNgos.map(r => r.ngo_id),
    ]);

    // ── 4) Habilidades del voluntario → roles compatibles ─────────────
    const mySkillRows = await db.all(
      `SELECT h.nombre FROM voluntario_habilidades vh
       JOIN habilidades h ON h.id = vh.habilidad_id
       WHERE vh.user_id = $1`,
      [req.user.id]
    );
    const myCompatibleRoles = new Set();
    for (const { nombre } of mySkillRows) {
      const mapped = SKILL_TO_ROLE[nombre.toLowerCase()];
      if (mapped) mapped.forEach(r => myCompatibleRoles.add(r));
    }

    // ── 4b) Voluntarios que sigo (para señal social) ──────────────────
    const myFollowingRows = await db.all(
      'SELECT following_id FROM volunteer_follows WHERE follower_id=$1',
      [req.user.id]
    );
    const myFollowingIds = myFollowingRows.map(r => r.following_id);

    // ── 4c) Detectar historial y cold start ──────────────────────────
    const hasHistory = Object.keys(categoryFreq).length > 0;
    const hasFollows = interestedNgoIds.size > 0;
    const hasSkills  = myCompatibleRoles.size > 0;
    const hasSocial  = myFollowingIds.length > 0;
    const isColdStart = !hasHistory && !hasFollows && !hasSkills && !hasSocial;

    // ── 5) Pool de candidatos (activos, con cupo, no inscripto) ───────
    let sql = `
      SELECT p.*, n.nombre AS ngo_name, n.foto_perfil AS ngo_logo
      FROM projects p
      JOIN ngos n ON n.id = p.ngo_id
      WHERE p.status = 'active' AND p.cupos_ocupados < p.cupos
    `;
    const params = [];
    if (enrolledIds.length) {
      const ph = enrolledIds.map((_, i) => `$${i + 1}`).join(',');
      sql += ` AND p.id NOT IN (${ph})`;
      params.push(...enrolledIds);
    }
    sql += ` ORDER BY p.created_at DESC LIMIT 100`;
    const candidates = await db.all(sql, params);

    if (!candidates.length) {
      return res.json({ recommendations: [], based_on_history: hasHistory, is_cold_start: isColdStart });
    }

    // ── 6) Datos auxiliares en batch (categorías, roles, ratings) ──────
    const candidateIds = candidates.map(c => c.id);
    const ph = candidateIds.map((_, i) => `$${i + 1}`).join(',');

    const [catRows, roleRows, ratingRows] = await Promise.all([
      db.all(
        `SELECT pc.project_id, pc.categoria_id, c.nombre
         FROM project_categorias pc JOIN categorias c ON c.id = pc.categoria_id
         WHERE pc.project_id IN (${ph})`,
        candidateIds
      ),
      db.all(
        `SELECT pr.project_id, ro.nombre
         FROM project_roles pr JOIN roles ro ON ro.id = pr.rol_id
         WHERE pr.project_id IN (${ph})`,
        candidateIds
      ),
      db.all(
        `SELECT project_id, AVG(rating) AS avg_rating, COUNT(*) AS count
         FROM ratings WHERE project_id IN (${ph})
         GROUP BY project_id`,
        candidateIds
      ),
    ]);

    // ── 6b) Enrollments de seguidos en candidatos (señal social) ───────
    const socialByProject = {};
    if (myFollowingIds.length > 0) {
      const fPh = myFollowingIds.map((_, i) => `$${i + 1}`).join(',');
      const cPh = candidateIds.map((_, i) => `$${myFollowingIds.length + i + 1}`).join(',');
      const socialRows = await db.all(
        `SELECT e.project_id, e.user_id, u.name
         FROM enrollments e
         JOIN users u ON u.id = e.user_id
         WHERE e.user_id IN (${fPh})
           AND e.status = 'approved'
           AND e.project_id IN (${cPh})`,
        [...myFollowingIds, ...candidateIds]
      );
      for (const r of socialRows) {
        (socialByProject[r.project_id] ||= []).push(r.name);
      }
    }

    const catsByProject = {};
    const catNameById = {};
    for (const r of catRows) {
      (catsByProject[r.project_id] ||= []).push(r.categoria_id);
      catNameById[r.categoria_id] = r.nombre;
    }

    const rolesByProject = {};
    for (const r of roleRows) {
      (rolesByProject[r.project_id] ||= []).push(r.nombre);
    }

    const ratingByProject = {};
    for (const r of ratingRows) {
      ratingByProject[r.project_id] = { avg: parseFloat(r.avg_rating), count: parseInt(r.count) };
    }


    // ── 8) Scoring: 9 señales, máximo ~115 puntos ─────────────────────
    const now = Date.now();

    const scored = candidates.map(p => {
      const cats = catsByProject[p.id] || [];
      const roles = rolesByProject[p.id] || [];
      const rating = ratingByProject[p.id] || { avg: 0, count: 0 };
      const spotsLeft = (p.cupos || 0) - (p.cupos_ocupados || 0);
      const fillRatio = p.cupos > 0 ? (p.cupos_ocupados / p.cupos) : 0;
      const createdAt = p.created_at?.replace(' ', 'T');
      const daysOld = (now - new Date(createdAt + (createdAt.includes('Z') ? '' : 'Z')).getTime()) / 86400000;
      const reasons = [];
      const tags = [];
      let score = 0;

      // ─── Señal 1: Afinidad temática (máx 30) ─────────────────────
      if (hasHistory) {
        const bestFreq = cats.reduce((best, c) => Math.max(best, categoryFreq[c] || 0), 0);
        if (bestFreq >= 3) {
          score += 30;
        } else if (bestFreq === 2) {
          score += 22;
        } else if (bestFreq === 1) {
          score += 15;
        }
        if (bestFreq > 0) {
          const matchedCat = cats.find(c => categoryFreq[c] === bestFreq);
          reasons.push(`Coincide con tu interés en "${catNameById[matchedCat] || 'esta categoría'}"`);
          tags.push(`💚 ${catNameById[matchedCat]}`);
        }
      }

      // ─── Señal 2: Match de habilidades (máx 20) ──────────────────
      if (hasSkills && roles.length > 0) {
        const matchedRoles = roles.filter(r => myCompatibleRoles.has(r));
        if (matchedRoles.length >= 2) {
          score += 20;
          reasons.push(`Busca tus habilidades: ${matchedRoles.join(', ')}`);
          tags.push('🎯 Match de habilidades');
        } else if (matchedRoles.length === 1) {
          score += 14;
          reasons.push(`Busca tu habilidad: ${matchedRoles[0]}`);
          tags.push('🎯 Match de habilidades');
        }
      }

      // ─── Señal 3: Afinidad con ONG (máx 15) ──────────────────────
      if (followedNgoSet.has(p.ngo_id)) {
        score += 15;
        reasons.push(`De ${p.ngo_name}, una ONG que seguís`);
        tags.push(`❤️ ${p.ngo_name}`);
      } else if (interestedNgoIds.has(p.ngo_id)) {
        score += 10;
        reasons.push(`De ${p.ngo_name}, que te podría interesar`);
      }

      // ─── Señal 4: Proximidad geográfica (máx 10) ─────────────────
      if (myLocation) {
        const projLoc = p.ubicacion?.trim().toLowerCase() || '';
        const isRemote = p.modalidad === 'remoto' || projLoc.includes('remoto') || projLoc.includes('virtual');
        if (projLoc === myLocation) {
          score += 10;
          reasons.push(`En tu zona: ${p.ubicacion}`);
          tags.push('📍 Cerca tuyo');
        } else if (myLocation.split(',')[0] && projLoc.includes(myLocation.split(',')[0].trim())) {
          score += 6;
          reasons.push(`Cerca tuyo, en ${p.ubicacion}`);
        } else if (isRemote) {
          score += 4;
          reasons.push('Disponible en remoto');
          tags.push('💻 Remoto');
        }
      }

      // ─── Señal 5: Urgencia de cupos (máx 8) ──────────────────────
      const urgencyMultiplier = isColdStart ? 2 : 1;
      if (fillRatio >= 0.90) {
        score += 8 * urgencyMultiplier;
        reasons.push(`¡Últimos ${spotsLeft} cupo${spotsLeft === 1 ? '' : 's'}!`);
        tags.push('🔥 Últimos cupos');
      } else if (fillRatio >= 0.75) {
        score += 5 * urgencyMultiplier;
        reasons.push('Cupos limitados');
        tags.push('⏳ Cupos limitados');
      } else if (fillRatio >= 0.50) {
        score += 2 * urgencyMultiplier;
      }

      // ─── Señal 6: Novedad (máx 7) ────────────────────────────────
      const noveltyMultiplier = isColdStart ? 2 : 1;
      if (daysOld <= 3) {
        score += 7 * noveltyMultiplier;
        reasons.push('Recién publicado');
        tags.push('✨ Nuevo');
      } else if (daysOld <= 7) {
        score += 5 * noveltyMultiplier;
        reasons.push('Publicado hace poco');
        tags.push('🆕 Reciente');
      } else if (daysOld <= 14) {
        score += 2 * noveltyMultiplier;
      }

      // ─── Señal 7: Popularidad por rating (máx 5) ─────────────────
      const ratingMultiplier = isColdStart ? 3 : 1;
      if (rating.avg >= 4.5 && rating.count >= 3) {
        score += 5 * ratingMultiplier;
        reasons.push(`⭐ ${rating.avg.toFixed(1)}/5 (${rating.count} reseñas)`);
        tags.push('⭐ Bien valorado');
      } else if (rating.avg >= 4.0 && rating.count >= 2) {
        score += 3 * ratingMultiplier;
        reasons.push(`⭐ ${rating.avg.toFixed(1)}/5 (${rating.count} reseñas)`);
      } else if (rating.avg >= 3.5 && rating.count >= 1) {
        score += 1 * ratingMultiplier;
      }

      // ─── Señal 8: Momentum / followers (máx 5) ───────────────────
      const followers = p.followers || 0;
      if (followers >= 20) {
        score += 5;
        reasons.push(`${followers} personas siguen este proyecto`);
        tags.push('🚀 Popular');
      } else if (followers >= 10) {
        score += 3;
        reasons.push(`${followers} seguidores`);
      } else if (followers >= 5) {
        score += 1;
      }

      // ─── Señal 9: Actividad social / contactos que participan (máx 15) ─
      const socialNames = socialByProject[p.id] || [];
      if (socialNames.length >= 3) {
        const socialMultiplier = isColdStart ? 1.5 : 1;
        score += Math.round(15 * socialMultiplier);
        reasons.push(`${socialNames.length} personas que seguís participan acá`);
        tags.push('👥 Tus contactos participan');
      } else if (socialNames.length === 2) {
        const socialMultiplier = isColdStart ? 1.5 : 1;
        score += Math.round(10 * socialMultiplier);
        reasons.push(`${socialNames[0]} y ${socialNames[1]} participan acá`);
        tags.push('👥 Tus contactos participan');
      } else if (socialNames.length === 1) {
        const socialMultiplier = isColdStart ? 1.5 : 1;
        score += Math.round(6 * socialMultiplier);
        reasons.push(`${socialNames[0]} participa acá`);
        tags.push('👥 Un contacto participa');
      }

      // ─── Fallback ────────────────────────────────────────────────
      if (reasons.length === 0) {
        reasons.push('Podría interesarte');
        if (isColdStart) tags.push('🌟 Destacado');
      }

      return { project: p, score, reasons, tags };
    });

    // ── 9) Ordenar y limitar ──────────────────────────────────────────
    scored.sort((a, b) => b.score - a.score || new Date(b.project.created_at) - new Date(a.project.created_at));

    const top = scored.slice(0, limit).map(({ project, score, reasons, tags }) => ({
      ...fmt({ ...project, category_name: catNameById[(catsByProject[project.id] || [])[0]] || '' }),
      recommendation_score: score,
      recommendation_reasons: reasons,
      recommendation_tags: tags,
    }));

    res.json({ recommendations: top, based_on_history: hasHistory, is_cold_start: isColdStart });
  } catch (err) {
    console.error('GET /projects/recommended error:', err);
    res.status(500).json({ error: 'Error al generar recomendaciones' });
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

    project.roles_json      = JSON.stringify(rolesRows.map(r => r.nombre));
    project.requisitos_json = JSON.stringify(reqRows.map(r => r.descripcion));
    project.category_name   = catRow?.nombre || '';

    const comments = await db.all(
      `SELECT c.*, u.name AS user_name, u.avatar AS user_avatar,
              CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END AS is_participant
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN enrollments e ON e.user_id = c.user_id AND e.project_id = c.project_id AND e.status = 'approved'
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

    const kpis = await db.all(
      'SELECT * FROM kpis WHERE project_id=$1 ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json({
      project: {
        ...fmt(project),
        comments,
        ratings,
        kpis,
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
      type, duration, volunteers_needed, funding_goal, cost_per_person,
      hours_per_week, roles_needed = [], requirements = [],
      latitude, longitude, latitud, longitud, modality, modalidad
    } = req.body;

    const mod = modality || modalidad || (location && (location.toLowerCase().includes('remoto') || location.toLowerCase().includes('virtual')) ? 'remoto' : 'presencial');

    const err = validateProject({
      title, description, location,
      tipo: type, duracion: duration,
      horas_semanales: hours_per_week, volunteers_needed
    });
    if (err) return res.status(400).json({ error: err });

    const lat = latitude != null ? parseFloat(latitude) : (latitud != null ? parseFloat(latitud) : null);
    const lng = longitude != null ? parseFloat(longitude) : (longitud != null ? parseFloat(longitud) : null);

    // Insertar proyecto
    await db.run(
      `INSERT INTO projects (ngo_id, titulo, descripcion, descripcion_full, foto_perfil,
        tipo, status, ubicacion, duracion, cupos, cupos_ocupados,
        meta_financiera, recaudado, costo, horas_semanales, latitud, longitud, modalidad)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,0,$10,0,$11,$12,$13,$14,$15)`,
      [ngo.id, title.trim(), description.trim(), full_description?.trim() || null,
       image || null, type || 'fugaz', location.trim(), duration?.trim() || null,
       parseInt(volunteers_needed) || 0, parseFloat(funding_goal) || 0,
       parseFloat(cost_per_person) || 0,
       type === 'sostenido' ? parseInt(hours_per_week) : null,
       lat, lng, mod]
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
      ).catch(() => {}); // ignorar duplicado
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
      ).catch(() => {});
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
            volunteers_needed, funding_goal, cost_per_person, hours_per_week, status,
            latitude, longitude, latitud, longitud, modality, modalidad } = req.body;

    const lat = latitude !== undefined ? (latitude != null ? parseFloat(latitude) : null)
              : (latitud !== undefined ? (latitud != null ? parseFloat(latitud) : null) : project.latitud);
    const lng = longitude !== undefined ? (longitude != null ? parseFloat(longitude) : null)
              : (longitud !== undefined ? (longitud != null ? parseFloat(longitud) : null) : project.longitud);
    const mod = modality || modalidad || project.modalidad ||
              (location && (location.toLowerCase().includes('remoto') || location.toLowerCase().includes('virtual')) ? 'remoto' : 'presencial');

    await db.run(
      `UPDATE projects SET titulo=$1, descripcion=$2, descripcion_full=$3, foto_perfil=$4,
       ubicacion=$5, tipo=$6, status=$7, duracion=$8, cupos=$9, meta_financiera=$10,
       costo=$11, horas_semanales=$12, latitud=$13, longitud=$14, modalidad=$15, updated_at=CURRENT_TIMESTAMP WHERE id=$16`,
      [title?.trim(), description?.trim(), full_description?.trim() || null, image || null,
       location?.trim(), type, status || 'active', duration?.trim() || null,
       parseInt(volunteers_needed) || 0, parseFloat(funding_goal) || 0,
       parseFloat(cost_per_person) || 0,
       type === 'sostenido' ? parseInt(hours_per_week) : null,
       lat, lng, mod,
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
const BLACKLIST = ['pelotudo','boludo','idiota','imbecil','mierda','puto','puta','hdp','concha','forro','tarado'];
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
      `SELECT c.*, u.name AS user_name, u.avatar AS user_avatar,
              CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END AS is_participant
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN enrollments e ON e.user_id = c.user_id AND e.project_id = c.project_id AND e.status = 'approved'
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

    // Validación de participación aprobada para calificar
    const enrollment = await db.get(
      'SELECT id FROM enrollments WHERE user_id=$1 AND project_id=$2 AND status=$3',
      [req.user.id, req.params.id, 'approved']
    );
    if (!enrollment) {
      return res.status(403).json({ error: 'Solo voluntarios que hayan participado con inscripción aprobada pueden calificar' });
    }

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
// Exportadas aparte para poder testearlas de forma aislada (mismo patrón
// que insertMessage en routes/messages.js).
module.exports.validateProject = validateProject;
module.exports.hasBadWord = hasBadWord;

// ── GET /api/projects/:id/kpis ────────────────────────────────────────────
router.get('/:id/kpis', async (req, res) => {
  try {
    const kpis = await db.all(
      'SELECT * FROM kpis WHERE project_id=$1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ kpis });
  } catch (err) { res.status(500).json({ error: 'Error al obtener KPIs' }); }
});

// ── POST /api/projects/:id/kpis ───────────────────────────────────────────
router.post('/:id/kpis', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const ngo = await db.get('SELECT id FROM ngos WHERE user_id=$1', [req.user.id]);
    const project = await db.get('SELECT id FROM projects WHERE id=$1 AND ngo_id=$2', [req.params.id, ngo?.id]);
    if (!project) return res.status(403).json({ error: 'Sin permiso sobre este proyecto' });

    const { nombre, descripcion, valor, tipo_valor = 'numero', unidad, fecha } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre del KPI es obligatorio' });

    await db.run(
      `INSERT INTO kpis (project_id, nombre, descripcion, valor, tipo_valor, unidad, fecha)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.params.id, nombre.trim(), descripcion?.trim() || null,
       valor !== undefined ? parseFloat(valor) : null,
       tipo_valor, unidad?.trim() || null, fecha || null]
    );

    const kpi = await db.get(
      'SELECT * FROM kpis WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1',
      [req.params.id]
    );
    res.status(201).json({ kpi });
  } catch (err) {
    console.error('POST /kpis error:', err);
    res.status(500).json({ error: 'Error al crear KPI' });
  }
});

// ── PUT /api/projects/:id/kpis/:kpiId ────────────────────────────────────
router.put('/:id/kpis/:kpiId', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const ngo = await db.get('SELECT id FROM ngos WHERE user_id=$1', [req.user.id]);
    const project = await db.get('SELECT id FROM projects WHERE id=$1 AND ngo_id=$2', [req.params.id, ngo?.id]);
    if (!project) return res.status(403).json({ error: 'Sin permiso' });

    const { nombre, descripcion, valor, tipo_valor, unidad, fecha } = req.body;
    await db.run(
      `UPDATE kpis SET nombre=$1, descripcion=$2, valor=$3, tipo_valor=$4, unidad=$5, fecha=$6
       WHERE id=$7 AND project_id=$8`,
      [nombre?.trim(), descripcion?.trim() || null,
       valor !== undefined ? parseFloat(valor) : null,
       tipo_valor, unidad?.trim() || null, fecha || null,
       req.params.kpiId, req.params.id]
    );
    const kpi = await db.get('SELECT * FROM kpis WHERE id=$1', [req.params.kpiId]);
    res.json({ kpi });
  } catch (err) { res.status(500).json({ error: 'Error al actualizar KPI' }); }
});

// ── DELETE /api/projects/:id/kpis/:kpiId ─────────────────────────────────
router.delete('/:id/kpis/:kpiId', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const ngo = await db.get('SELECT id FROM ngos WHERE user_id=$1', [req.user.id]);
    const project = await db.get('SELECT id FROM projects WHERE id=$1 AND ngo_id=$2', [req.params.id, ngo?.id]);
    if (!project) return res.status(403).json({ error: 'Sin permiso' });
    await db.run('DELETE FROM kpis WHERE id=$1 AND project_id=$2', [req.params.kpiId, req.params.id]);
    res.json({ message: 'KPI eliminado' });
  } catch (err) { res.status(500).json({ error: 'Error al eliminar KPI' }); }
});
