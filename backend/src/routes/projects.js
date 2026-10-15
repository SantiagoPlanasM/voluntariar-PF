// src/routes/projects.js
const express = require('express');
const db = require('../db');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');
const { randomUUID } = require('node:crypto');
const { toMillis } = require('../lib/time');
const { checkText, firstError, clampInt } = require('../lib/inputs');
const { hasBadWord } = require('../lib/badWords');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────
// En Postgres, `pg` ya entrega las columnas json/jsonb (el json_agg del listado) como array:
// se devuelve tal cual. Antes se le hacía JSON.parse(array), fallaba y quedaba [] (REVISION B2).
const parseJson = (val) => { if (Array.isArray(val)) return val; try { return JSON.parse(val || '[]'); } catch { return []; } };

// Forma de una reseña (interface Rating de frontend/src/lib/api.ts). La usan GET /projects/:id y el feed
// (routes/follows.js): antes cada uno tenía su SELECT y el del feed no traía user_id (REVISION, pendiente de §112).
// Quien la use agrega su propio WHERE / ORDER BY.
const RATINGS_SELECT = `SELECT r.id, r.project_id, r.user_id, r.rating, r.comment, r.created_at, u.name AS user_name
       FROM ratings r JOIN users u ON u.id = r.user_id`;

// Campos que algunos endpoints agregan a la fila ANTES de formatear (el feed, routes/follows.js).
const PROJECT_EXTRAS = ['ratings', 'recent_comments', 'comments_count', 'my_enrollment_status', 'follow_source', 'follow_label'];

// Lista blanca: solo estos campos salen por la API (AI_RULES regla 8, REVISION B21). Antes empezaba con
// `...p` y devolvía TODAS las columnas de la fila (titulo, cupos, roles_json…): la próxima columna que se
// agregara a projects habría salido sola por los endpoints públicos. Un campo nuevo para el frontend se
// agrega acá Y en la interface Project de frontend/src/lib/api.ts.
// ── Validación de KPIs (POST y PUT) ─────────────────────────────────────
// Antes: `nombre` faltante en el PUT (NOT NULL), un `nombre` que no era string (`.trim()`) o un tipo fuera de la
// lista (CHECK) daban 500, y valores como `valor: 'mucho'` o un nombre de 1000 caracteres se GUARDABAN
// (PROJECT_ANALYSIS.md §88). El PUT no es parcial (deuda conocida): exige `nombre` igual que el alta.
// 'texto' ya no se acepta al crear ni editar (F3, decisión del usuario, §90): kpis.valor es numérica y un KPI
// de texto se guardaba vacío. El CHECK de la base lo sigue permitiendo para los que ya existían.
const KPI_TIPOS = ['numero', 'porcentaje', 'booleano'];
// 'AAAA-MM-DD' de una fecha que exista (2026-02-30 no). Se compara contra Date.UTC para no depender del huso horario.
function isIsoDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function validateKpi({ nombre, descripcion, valor, tipo_valor, unidad, fecha }) {
  const err = firstError(
    checkText(nombre, { label: 'El nombre del KPI', max: 120, required: true }),
    checkText(descripcion, { label: 'La descripción', max: 500 }),
    checkText(unidad, { label: 'La unidad', max: 40 }),
  );
  if (err) return err;
  if (tipo_valor !== undefined && tipo_valor !== null && !KPI_TIPOS.includes(tipo_valor)) return 'Tipo de KPI inválido';
  if (valor !== undefined && valor !== null && valor !== '' && !Number.isFinite(Number(valor))) return 'El valor tiene que ser un número';
  // Antes se guardaba cualquier texto (§102). Vacía o ausente = sin fecha.
  if (fecha !== undefined && fecha !== null && fecha !== '' && !isIsoDate(fecha)) return 'La fecha tiene que tener el formato AAAA-MM-DD';
  return null;
}
// null/''/ausente → null; si no, el número (ya validado).
const kpiValor = (valor) => (valor === undefined || valor === null || valor === '' ? null : Number(valor));

// Columnas de un KPI que devuelve la API (todas las de hoy, pero elegidas: regla 8, REVISION B21).
const KPI_COLS = 'id, project_id, nombre, descripcion, valor, tipo_valor, unidad, fecha, created_at';

function fmt(p) {
  const out = {
    id:                 p.id,
    ngo_id:             p.ngo_id,
    status:             p.status,
    created_at:         p.created_at,
    ngo_name:           p.ngo_name,
    ngo_logo:           p.ngo_logo,
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
  for (const k of PROJECT_EXTRAS) if (p[k] !== undefined) out[k] = p[k];
  return out;
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

// Lista de textos del body (roles_needed, requirements): ausente → []; tiene que ser un array de strings
// con largo entre min y max (los mismos límites que CreateVoluntariado.tsx) y a lo sumo maxItems.
// Devuelve la lista recortada y sin repetidos, o { error }. Antes un string se recorría letra por letra
// y un no-string rompía en .trim() después del INSERT del proyecto (REVISION B5).
function cleanTextList(val, { label, min, max, maxItems }) {
  if (val === undefined || val === null) return { list: [] };
  if (!Array.isArray(val)) return { error: `${label}: tiene que ser una lista` };
  if (val.length > maxItems) return { error: `${label}: máximo ${maxItems}` };
  const list = [];
  for (const item of val) {
    const t = typeof item === 'string' ? item.trim() : null;
    if (t === null || t.length < min || t.length > max)
      return { error: `${label}: cada uno tiene que tener entre ${min} y ${max} caracteres` };
    if (!list.includes(t)) list.push(t);
  }
  return { list };
}

// Roles, requisitos y categoría de un proyecto, leídos de sus tablas, en la forma que espera fmt().
// `q` es db o tx. Lo usan GET /:id y PUT /:id (antes el PUT respondía con lo que mandaba el body).
async function loadAssoc(q, projectId) {
  const roles = await q.all(
    `SELECT ro.nombre FROM project_roles pr JOIN roles ro ON ro.id = pr.rol_id WHERE pr.project_id = $1`, [projectId]);
  const reqs = await q.all(`SELECT descripcion FROM requisitos WHERE project_id = $1`, [projectId]);
  const cat = await q.get(
    `SELECT c.nombre FROM project_categorias pc JOIN categorias c ON c.id = pc.categoria_id WHERE pc.project_id = $1 LIMIT 1`, [projectId]);
  return {
    roles_json: JSON.stringify(roles.map((r) => r.nombre)),
    requisitos_json: JSON.stringify(reqs.map((r) => r.descripcion)),
    category_name: cat?.nombre || '',
  };
}

// ── GET /api/projects ─────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category, type, status, search, modality, modalidad, sort = 'featured' } = req.query;
    // Paginación (deuda conocida, §96): antes limit/offset iban con parseInt directo al SQL (`limit=abc` → LIMIT NaN,
    // 500 en Postgres) y sin tope. 500 es lo máximo que pide hoy el frontend (CompanyOwnProfile y Explore, §119).
    const limit = clampInt(req.query.limit, 20, 1, 500);
    const offset = clampInt(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const modFilter = modality || modalidad;

    let orderSql;
    if (sort === 'recent') {
      orderSql = 'p.created_at DESC, p.id';
    } else if (sort === 'rating') {
      orderSql = 'COALESCE(r.avg_rating, 0) DESC, COALESCE(r.ratings_count, 0) DESC, p.created_at DESC, p.id';
    } else {
      // sort === 'featured' (por defecto): score ponderado por estado activo, participantes, rating y followers
      // Prioridad máxima a los seguidores del voluntariado específico (p.followers * 8) + respaldo secundario por seguidores de la ONG (n.followers * 0.005)
      orderSql = `(
        CASE WHEN p.status = 'active' THEN 20 ELSE 0 END
        + (COALESCE(p.cupos_ocupados, 0) * 4)
        + (COALESCE(r.avg_rating, 0) * (CASE WHEN COALESCE(r.ratings_count, 0) >= 4 THEN 16 WHEN COALESCE(r.ratings_count, 0) >= 2 THEN 10 WHEN COALESCE(r.ratings_count, 0) >= 1 THEN 5 ELSE 0 END))
        + (COALESCE(p.followers, 0) * 8)
        + (CASE WHEN COALESCE(n.followers, 0) > 0 THEN (COALESCE(n.followers, 0) * 0.005) ELSE 0 END)
      ) DESC, p.created_at DESC, p.id`; // p.id: desempate, para que las páginas no se pisen (§96)
    }

    // Roles y requisitos como arrays de strings, la misma forma que arma la rama SQLite y GET /:id
    const rolesAgg = db.type === 'postgres'
      ? `COALESCE(json_agg(DISTINCT ro.nombre) FILTER (WHERE ro.nombre IS NOT NULL), '[]'::json) AS roles_json`
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
    // ILIKE y no LIKE: en Postgres LIKE distingue mayúsculas ("maratón" no encontraba "Maratón" y
    // "%remoto%" no reconocía "Remoto"). translatePg lo vuelve LIKE en SQLite, que ya no distingue (solo ASCII). REVISION B8.
    if (modFilter && modFilter !== 'all' && modFilter !== 'Todos') {
      if (modFilter === 'remoto') {
        sql += ` AND (p.modalidad = 'remoto' OR p.ubicacion ILIKE '%remoto%' OR p.ubicacion ILIKE '%virtual%')`;
      } else if (modFilter === 'presencial') {
        sql += ` AND (p.modalidad = 'presencial' AND (p.ubicacion NOT ILIKE '%remoto%' AND p.ubicacion NOT ILIKE '%virtual%'))`;
      } else if (modFilter === 'hibrido') {
        sql += ` AND p.modalidad = 'hibrido'`;
      }
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      const si = i; const ti = i+1; const ni = i+2; const ci = i+3; const ui = i+4;
      sql += ` AND (p.titulo ILIKE $${si} OR p.descripcion ILIKE $${ti} OR n.nombre ILIKE $${ni} OR c.nombre ILIKE $${ci} OR p.ubicacion ILIKE $${ui})`;
      params.push(q, q, q, q, q); i += 5;
    }

    sql += ` GROUP BY p.id, n.nombre, n.foto_perfil, n.followers, c.nombre, r.avg_rating, r.ratings_count`;
    sql += ` ORDER BY ${orderSql} LIMIT $${i++} OFFSET $${i++}`;
    params.push(limit, offset);

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
          simpleSql += ` AND (p.modalidad = 'remoto' OR p.ubicacion ILIKE '%remoto%' OR p.ubicacion ILIKE '%virtual%')`;
        } else if (modFilter === 'presencial') {
          simpleSql += ` AND (p.modalidad = 'presencial' AND (p.ubicacion NOT ILIKE '%remoto%' AND p.ubicacion NOT ILIKE '%virtual%'))`;
        } else if (modFilter === 'hibrido') {
          simpleSql += ` AND p.modalidad = 'hibrido'`;
        }
      }
      if (search && search.trim()) {
        const q = `%${search.trim()}%`;
        simpleSql += ` AND (p.titulo ILIKE $${si} OR p.descripcion ILIKE $${si+1} OR n.nombre ILIKE $${si+2} OR p.ubicacion ILIKE $${si+3})`;
        simpleParams.push(q, q, q, q); si += 4;
      }
      simpleSql += ` ORDER BY ${orderSql} LIMIT $${si++} OFFSET $${si++}`;
      simpleParams.push(limit, offset);
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
      // created_at es string en SQLite y Date en Postgres: siempre vía toMillis() (src/lib/time.js).
      // Sin fecha válida → Infinity: simplemente no recibe el bonus de "reciente", en vez de romper.
      const createdMs = toMillis(p.created_at);
      const daysOld = createdMs === null ? Infinity : (now - createdMs) / 86400000;
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
    scored.sort((a, b) => b.score - a.score || (toMillis(b.project.created_at) ?? 0) - (toMillis(a.project.created_at) ?? 0));

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
    Object.assign(project, await loadAssoc(db, req.params.id));

    const comments = await db.all(
      `SELECT c.id, c.project_id, c.user_id, c.comment, c.created_at, u.name AS user_name, u.avatar AS user_avatar,
              CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END AS is_participant
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN enrollments e ON e.user_id = c.user_id AND e.project_id = c.project_id AND e.status = 'approved'
       WHERE c.project_id = $1 ORDER BY c.created_at DESC`, [req.params.id]
    );
    const ratings = await db.all(
      `${RATINGS_SELECT}
       WHERE r.project_id = $1
       ORDER BY r.created_at DESC, r.id`, [req.params.id]
    );
    const avgRating = ratings.length
      ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;

    let myEnrollment = null;
    if (req.user) {
      myEnrollment = await db.get(
        `SELECT id, user_id, project_id, status, mensaje, horas_realizadas, created_at, updated_at
         FROM enrollments WHERE user_id=$1 AND project_id=$2`,
        [req.user.id, req.params.id]
      );
    }

    const kpis = await db.all(
      `SELECT ${KPI_COLS} FROM kpis WHERE project_id=$1 ORDER BY created_at DESC`,
      [req.params.id]
    );

    // ¿Quien pide es la ONG dueña? Lo usa ProjectDetails para ofrecer "Ver en panel ONG" solo a ella (antes se
    // ofrecía a cualquier ONG y el panel daba 403; REVISION F16). Consulta aparte: n.user_id no hace falta en
    // la respuesta.
    const canManage = req.user?.role === 'ngo'
      && !!(await db.get('SELECT 1 AS ok FROM ngos WHERE id=$1 AND user_id=$2', [project.ngo_id, req.user.id]));

    res.json({
      project: {
        ...fmt(project),
        comments,
        ratings,
        kpis,
        avg_rating: Math.round(avgRating * 10) / 10,
        my_enrollment: myEnrollment,
        can_manage: canManage,
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
      hours_per_week, roles_needed, requirements,
      latitude, longitude, latitud, longitud, modality, modalidad
    } = req.body;

    const mod = modality || modalidad || (location && (location.toLowerCase().includes('remoto') || location.toLowerCase().includes('virtual')) ? 'remoto' : 'presencial');

    const err = validateProject({
      title, description, location,
      tipo: type, duracion: duration,
      horas_semanales: hours_per_week, volunteers_needed
    });
    if (err) return res.status(400).json({ error: err });

    const roles = cleanTextList(roles_needed, { label: 'Roles', min: 2, max: 40, maxItems: 20 });
    if (roles.error) return res.status(400).json({ error: roles.error });
    const reqs = cleanTextList(requirements, { label: 'Requisitos', min: 3, max: 100, maxItems: 20 });
    if (reqs.error) return res.status(400).json({ error: reqs.error });
    if (category != null && (typeof category !== 'string' || category.trim().length > 60))
      return res.status(400).json({ error: 'Categoría inválida' });
    const categoryName = category?.trim() || '';

    const lat = latitude != null ? parseFloat(latitude) : (latitud != null ? parseFloat(latitud) : null);
    const lng = longitude != null ? parseFloat(longitude) : (longitud != null ? parseFloat(longitud) : null);

    // El id se genera acá (UUID v4: mismo formato que el default de la base en ambos motores) y se
    // usa para releer la fila y para todas las asociaciones. Antes se hacía el INSERT y después
    // "SELECT ... WHERE ngo_id=$1 ORDER BY created_at DESC LIMIT 1": en SQLite created_at tiene
    // resolución de 1 segundo, así que dos altas de la misma ONG en el mismo segundo empataban,
    // devolvía el proyecto más viejo y le enganchaba categoría/roles/requisitos (PROJECT_ANALYSIS §40).
    const projectId = randomUUID();

    // Proyecto + categoría + roles + requisitos en UNA transacción (regla 21): antes eran queries sueltas
    // y un error a mitad dejaba el proyecto creado sin sus asociaciones (REVISION B5). Adentro, nada de
    // .catch(() => {}) para "ignorar duplicados": en Postgres un error aborta la transacción entera; los
    // duplicados se evitan antes (listas sin repetidos) o con ON CONFLICT DO NOTHING.
    const newProject = await db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO projects (id, ngo_id, titulo, descripcion, descripcion_full, foto_perfil,
          tipo, status, ubicacion, duracion, cupos, cupos_ocupados,
          meta_financiera, recaudado, costo, horas_semanales, latitud, longitud, modalidad)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,0,$11,0,$12,$13,$14,$15,$16)`,
        [projectId, ngo.id, title.trim(), description.trim(), full_description?.trim() || null,
         image || null, type || 'fugaz', location.trim(), duration?.trim() || null,
         parseInt(volunteers_needed) || 0, parseFloat(funding_goal) || 0,
         parseFloat(cost_per_person) || 0,
         type === 'sostenido' ? parseInt(hours_per_week) : null,
         lat, lng, mod]
      );

      // Categoría y roles: se crean en el catálogo si no existen (ON CONFLICT: otra alta concurrente
      // pudo crearlos recién) y se releen por nombre (es UNIQUE).
      if (categoryName) {
        await tx.run('INSERT INTO categorias (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING', [categoryName]);
        const cat = await tx.get('SELECT id FROM categorias WHERE nombre=$1', [categoryName]);
        await tx.run('INSERT INTO project_categorias (project_id, categoria_id) VALUES ($1,$2)', [projectId, cat.id]);
      }
      for (const rolNombre of roles.list) {
        await tx.run('INSERT INTO roles (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING', [rolNombre]);
        const rol = await tx.get('SELECT id FROM roles WHERE nombre=$1', [rolNombre]);
        await tx.run('INSERT INTO project_roles (project_id, rol_id) VALUES ($1,$2)', [projectId, rol.id]);
      }
      for (const desc of reqs.list) {
        await tx.run('INSERT INTO requisitos (project_id, descripcion) VALUES ($1,$2)', [projectId, desc]);
      }

      return tx.get('SELECT * FROM projects WHERE id=$1', [projectId]);
    });

    // Lo que se guardó (recortado y sin repetidos), no lo que vino en el body.
    newProject.roles_json = JSON.stringify(roles.list);
    newProject.requisitos_json = JSON.stringify(reqs.list);
    newProject.category_name = categoryName;

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

    // PARCIAL (deuda conocida resuelta con OK del usuario, PROJECT_ANALYSIS.md §95): un campo que no viene
    // (undefined) conserva su valor. Antes se pisaba: título/descripción/ubicación a NULL (500 por NOT NULL),
    // status a 'active' (reactivaba un proyecto terminado), montos a 0, horas y textos opcionales a NULL.
    const b = req.body || {};
    const has = (k) => b[k] !== undefined;

    for (const [k, label] of [['title', 'El título'], ['description', 'La descripción'], ['location', 'La ubicación']])
      if (has(k) && b[k] !== null && typeof b[k] !== 'string') return res.status(400).json({ error: `${label} tiene que ser un texto` });
    for (const [k, label] of [['full_description', 'La descripción completa'], ['image', 'La imagen'], ['duration', 'La duración']])
      if (has(k) && b[k] !== null && typeof b[k] !== 'string') return res.status(400).json({ error: `${label} tiene que ser un texto` });
    if (has('type') && !['fugaz', 'sostenido'].includes(b.type))
      return res.status(400).json({ error: 'Tipo inválido: tiene que ser fugaz o sostenido' });
    // Antes un status fuera de la lista reventaba en el CHECK de la base (500). REVISION B11.
    if (b.status != null && !['active', 'completed', 'cancelled'].includes(b.status))
      return res.status(400).json({ error: 'Estado inválido: tiene que ser active, completed o cancelled' });

    // El resultado (lo que viene + lo que ya estaba) tiene que cumplir lo mismo que un alta.
    const m = {
      titulo:      has('title') ? b.title : project.titulo,
      descripcion: has('description') ? b.description : project.descripcion,
      ubicacion:   has('location') ? b.location : project.ubicacion,
      tipo:        has('type') ? b.type : project.tipo,
      duracion:    has('duration') ? (b.duration?.trim() || null) : project.duracion,
      horas:       has('hours_per_week') ? b.hours_per_week : project.horas_semanales,
      // Capacidad: omitida o null se CONSERVA (antes `parseInt(undefined) || 0` la pisaba con 0).
      cupos:       b.volunteers_needed != null ? b.volunteers_needed : project.cupos,
    };
    const invalid = validateProject({ title: m.titulo, description: m.descripcion, location: m.ubicacion, tipo: m.tipo,
      duracion: m.duracion, horas_semanales: m.horas, volunteers_needed: m.cupos });
    if (invalid) return res.status(400).json({ error: invalid });
    const newCupos = Number.parseInt(m.cupos, 10);

    // Montos: si vienen, número finito >= 0 (null = 0); si no, se conservan.
    const money = (k, current, label) => {
      if (!has(k)) return { value: current };
      if (b[k] === null || b[k] === '') return { value: 0 };
      const n = Number(b[k]);
      return Number.isFinite(n) && n >= 0 ? { value: n } : { error: `${label} tiene que ser un número mayor o igual a 0` };
    };
    const meta = money('funding_goal', project.meta_financiera, 'La meta de financiamiento');
    if (meta.error) return res.status(400).json({ error: meta.error });
    const costo = money('cost_per_person', project.costo, 'El costo por persona');
    if (costo.error) return res.status(400).json({ error: costo.error });

    // Roles, requisitos y categoría: si vienen se validan como en el alta (REVISION B5) y REEMPLAZAN a los
    // actuales; si no vienen, no se tocan. Antes no se guardaban y la respuesta los inventaba del body.
    const roles = has('roles_needed') ? cleanTextList(b.roles_needed, { label: 'Roles', min: 2, max: 40, maxItems: 20 }) : null;
    if (roles?.error) return res.status(400).json({ error: roles.error });
    const reqs = has('requirements') ? cleanTextList(b.requirements, { label: 'Requisitos', min: 3, max: 100, maxItems: 20 }) : null;
    if (reqs?.error) return res.status(400).json({ error: reqs.error });
    if (has('category') && b.category !== null && (typeof b.category !== 'string' || b.category.trim().length > 60))
      return res.status(400).json({ error: 'Categoría inválida' });

    const { latitude, longitude, latitud, longitud, modality, modalidad } = b;
    const lat = latitude !== undefined ? (latitude != null ? parseFloat(latitude) : null)
              : (latitud !== undefined ? (latitud != null ? parseFloat(latitud) : null) : project.latitud);
    const lng = longitude !== undefined ? (longitude != null ? parseFloat(longitude) : null)
              : (longitud !== undefined ? (longitud != null ? parseFloat(longitud) : null) : project.longitud);
    const mod = modality || modalidad || project.modalidad ||
              (m.ubicacion && (m.ubicacion.toLowerCase().includes('remoto') || m.ubicacion.toLowerCase().includes('virtual')) ? 'remoto' : 'presencial');

    // Proyecto + asociaciones en UNA transacción (regla 21): si algo falla, no queda nada a medias.
    const result = await db.transaction(async (tx) => {
      // `AND cupos_ocupados <= $9`: no se puede bajar la capacidad por debajo de las inscripciones ya
      // aprobadas (AI_RULES regla 20), atómico en el propio UPDATE (§40).
      const upd = await tx.run(
        `UPDATE projects SET titulo=$1, descripcion=$2, descripcion_full=$3, foto_perfil=$4,
         ubicacion=$5, tipo=$6, status=$7, duracion=$8, cupos=$9, meta_financiera=$10,
         costo=$11, horas_semanales=$12, latitud=$13, longitud=$14, modalidad=$15, updated_at=CURRENT_TIMESTAMP
         WHERE id=$16 AND cupos_ocupados <= $9`,
        [m.titulo.trim(), m.descripcion.trim(),
         has('full_description') ? (b.full_description?.trim() || null) : project.descripcion_full,
         has('image') ? (b.image || null) : project.foto_perfil,
         m.ubicacion.trim(), m.tipo, b.status != null ? b.status : project.status, m.duracion,
         newCupos, meta.value, costo.value,
         m.tipo === 'sostenido' ? parseInt(m.horas) : null,
         lat, lng, mod,
         req.params.id]
      );
      if (upd.changes === 0) return { capacity: true };

      if (has('category')) {
        await tx.run('DELETE FROM project_categorias WHERE project_id=$1', [req.params.id]);
        const name = b.category?.trim() || '';
        if (name) {
          await tx.run('INSERT INTO categorias (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING', [name]);
          const cat = await tx.get('SELECT id FROM categorias WHERE nombre=$1', [name]);
          await tx.run('INSERT INTO project_categorias (project_id, categoria_id) VALUES ($1,$2)', [req.params.id, cat.id]);
        }
      }
      if (roles) {
        await tx.run('DELETE FROM project_roles WHERE project_id=$1', [req.params.id]);
        for (const rolNombre of roles.list) {
          await tx.run('INSERT INTO roles (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING', [rolNombre]);
          const rol = await tx.get('SELECT id FROM roles WHERE nombre=$1', [rolNombre]);
          await tx.run('INSERT INTO project_roles (project_id, rol_id) VALUES ($1,$2)', [req.params.id, rol.id]);
        }
      }
      if (reqs) {
        await tx.run('DELETE FROM requisitos WHERE project_id=$1', [req.params.id]);
        for (const desc of reqs.list)
          await tx.run('INSERT INTO requisitos (project_id, descripcion) VALUES ($1,$2)', [req.params.id, desc]);
      }
      return { capacity: false };
    });

    if (result.capacity) {
      // O el proyecto desapareció, o la nueva capacidad quedaría por debajo de las aprobadas.
      const fresh = await db.get('SELECT cupos_ocupados FROM projects WHERE id=$1', [req.params.id]);
      if (!fresh) return res.status(404).json({ error: 'Proyecto no encontrado o sin permiso' });
      return res.status(400).json({
        error: `No podés bajar la capacidad a ${newCupos}: ya hay ${fresh.cupos_ocupados} voluntarios aprobados.`,
      });
    }

    // La respuesta sale de la base (lo guardado), no del body.
    const updated = await db.get('SELECT * FROM projects WHERE id=$1', [req.params.id]);
    Object.assign(updated, await loadAssoc(db, req.params.id));
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

router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment?.trim() || comment.trim().length < 3)
      return res.status(400).json({ error: 'Comentario muy corto' });
    if (hasBadWord(comment))
      return res.status(400).json({ error: 'El comentario contiene palabras no permitidas' });

    // Proyecto inexistente: 404. Antes el INSERT fallaba por la FK y respondía 500 (REVISION B18).
    const project = await db.get('SELECT id FROM projects WHERE id=$1', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

    // id propio: ver POST / (PROJECT_ANALYSIS §40). Antes se releía "el último comentario de este
    // usuario en este proyecto" por created_at, que en SQLite empata dentro del mismo segundo.
    const commentId = randomUUID();
    await db.run(
      `INSERT INTO comments (id, project_id, user_id, comment) VALUES ($1,$2,$3,$4)`,
      [commentId, req.params.id, req.user.id, comment.trim()]
    );
    const saved = await db.get(
      `SELECT c.*, u.name AS user_name, u.avatar AS user_avatar,
              CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END AS is_participant
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN enrollments e ON e.user_id = c.user_id AND e.project_id = c.project_id AND e.status = 'approved'
       WHERE c.id=$1`,
      [commentId]
    );
    res.status(201).json({ comment: saved });
  } catch (err) { res.status(500).json({ error: 'Error al comentar' }); }
});

// ── POST /api/projects/:id/ratings ────────────────────────────────────────
router.post('/:id/ratings', requireAuth, async (req, res) => {
  try {
    const { comment } = req.body;
    // Entero de 1 a 5 (también llega como "4" desde un form). Antes "abc" pasaba la validación ("abc" < 1 es
    // false) y reventaba en el CHECK; 3.5 lo guardaba SQLite y en Postgres (INTEGER) daba 500. REVISION B10.
    const rating = typeof req.body.rating === 'string' && /^\d+$/.test(req.body.rating) ? Number(req.body.rating) : req.body.rating;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return res.status(400).json({ error: 'La calificación tiene que ser un número entero del 1 al 5' });
    if (comment != null && (typeof comment !== 'string' || comment.length > 1000))
      return res.status(400).json({ error: 'El comentario tiene que ser un texto de hasta 1000 caracteres' });
    // Mismo filtro que los comentarios del proyecto (PROJECT_ANALYSIS §104); antes las reseñas no pasaban por él.
    if (comment && hasBadWord(comment))
      return res.status(400).json({ error: 'El comentario contiene palabras no permitidas' });

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
// fmt (title/description/latitude/longitude/modality, etc.) también se
// exporta para que otros routers que devuelven proyectos (ej. follows.js)
// reusen la misma función en vez de mantener una copia — evita que las dos
// queden desincronizadas cuando se agrega un campo nuevo acá.
module.exports.fmt = fmt;
module.exports.RATINGS_SELECT = RATINGS_SELECT;

// ── GET /api/projects/:id/kpis ────────────────────────────────────────────
router.get('/:id/kpis', async (req, res) => {
  try {
    const kpis = await db.all(
      `SELECT ${KPI_COLS} FROM kpis WHERE project_id=$1 ORDER BY created_at DESC`,
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
    const invalid = validateKpi(req.body);
    if (invalid) return res.status(400).json({ error: invalid });

    // id propio: ver POST / (PROJECT_ANALYSIS §40).
    const kpiId = randomUUID();
    await db.run(
      `INSERT INTO kpis (id, project_id, nombre, descripcion, valor, tipo_valor, unidad, fecha)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [kpiId, req.params.id, nombre.trim(), descripcion?.trim() || null,
       kpiValor(valor),
       tipo_valor, unidad?.trim() || null, fecha || null]
    );

    const kpi = await db.get(`SELECT ${KPI_COLS} FROM kpis WHERE id=$1`, [kpiId]);
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
    const invalid = validateKpi(req.body);
    if (invalid) return res.status(400).json({ error: invalid });
    const upd = await db.run(
      `UPDATE kpis SET nombre=$1, descripcion=$2, valor=$3, tipo_valor=$4, unidad=$5, fecha=$6
       WHERE id=$7 AND project_id=$8`,
      [nombre.trim(), descripcion?.trim() || null,
       kpiValor(valor),
       tipo_valor, unidad?.trim() || null, fecha || null,
       req.params.kpiId, req.params.id]
    );
    // Si el KPI no es de ESTE proyecto (o no existe) el UPDATE no toca nada: 404. Antes se releía por id
    // sin filtrar y se respondía 200 con el KPI de otra ONG (REVISION B18).
    if (upd.changes === 0) return res.status(404).json({ error: 'KPI no encontrado en este proyecto' });
    const kpi = await db.get(`SELECT ${KPI_COLS} FROM kpis WHERE id=$1 AND project_id=$2`, [req.params.kpiId, req.params.id]);
    res.json({ kpi });
  } catch (err) { res.status(500).json({ error: 'Error al actualizar KPI' }); }
});

// ── DELETE /api/projects/:id/kpis/:kpiId ─────────────────────────────────
router.delete('/:id/kpis/:kpiId', requireAuth, requireRole('ngo'), async (req, res) => {
  try {
    const ngo = await db.get('SELECT id FROM ngos WHERE user_id=$1', [req.user.id]);
    const project = await db.get('SELECT id FROM projects WHERE id=$1 AND ngo_id=$2', [req.params.id, ngo?.id]);
    if (!project) return res.status(403).json({ error: 'Sin permiso' });
    const del = await db.run('DELETE FROM kpis WHERE id=$1 AND project_id=$2', [req.params.kpiId, req.params.id]);
    if (del.changes === 0) return res.status(404).json({ error: 'KPI no encontrado en este proyecto' });
    res.json({ message: 'KPI eliminado' });
  } catch (err) { res.status(500).json({ error: 'Error al eliminar KPI' }); }
});
