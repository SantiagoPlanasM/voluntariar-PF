// src/routes/voluntarios.js
const express = require('express');
const multer = require('multer');
const db = require('../db');
const storage = require('../lib/storage');   // por propiedad (storage.uploadPdf), para poder reemplazarlo en tests
const { createLimiter } = require('../lib/rateLimit');
const { requireAuth, requireRole } = require('../middleware/auth');
const { forLog } = require('../lib/logSafe');   // S5145 (§202)

const router = express.Router();

// ── CV (PLAN_FALTANTE.md, Etapa 4; PROJECT_ANALYSIS.md §165) ─────────────────────────────────────────────────
// voluntarios.cv_url guarda el public_id de un PDF PRIVADO de Cloudinary (lib/storage.js, §164), nunca una URL
// pública: el archivo solo se abre con un link firmado que vence. Al reemplazarlo o borrarlo se borra el anterior
// (decisión C3). Lo ven su dueño y una ONG con una inscripción `pending` o `approved` de ese voluntario en un
// proyecto suyo (decisión C1); a cualquier otro se le responde 404, igual que si no tuviera CV.
const CV_MAX_BYTES = 5 * 1024 * 1024;
const CV_UPLOADS_PER_USER = createLimiter({ max: 10, windowMs: 60 * 60 * 1000 });   // cada subida gasta cuota
const CV_NOT_AVAILABLE = 'CV no disponible';
const CV_RACE = 'Se estaba guardando otro CV al mismo tiempo. Probá de nuevo.';

class CvRejected extends Error {}
const cvUpload = multer({
  storage: multer.memoryStorage(),   // nada al disco
  limits: { fileSize: CV_MAX_BYTES, files: 1, fields: 5, parts: 6 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new CvRejected('El CV tiene que ser un PDF'));
    cb(null, true);
  },
}).single('cv');

function parseCv(req, res, next) {
  cvUpload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof CvRejected) return res.status(400).json({ error: err.message });
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'El CV puede pesar hasta 5 MB' });
    }
    return res.status(400).json({ error: 'Elegí un archivo PDF' });
  });
}

const dropPdf = (publicId, where) => storage.deletePdf(publicId)
  .catch((e) => console.error(`${where}: no se pudo borrar el PDF de Cloudinary:`, e.message));

// ── PUT /api/voluntarios/me/cv — subir o reemplazar ────────────────────────
// Regla 24: sesión y rol → límite → validar todo (cabecera real incluida) → subir → guardar → limpiar si falla.
router.put('/me/cv', requireAuth, requireRole('volunteer'), (req, res, next) => {
  const wait = CV_UPLOADS_PER_USER.blocked(req.user.id);
  if (wait) {
    res.set('Retry-After', String(wait));
    return res.status(429).json({ error: 'Subiste el CV muchas veces seguidas. Esperá un rato e intentá de nuevo.' });
  }
  if (!storage.isConfigured()) {
    return res.status(503).json({ error: 'La subida de archivos no está disponible por el momento' });
  }
  next();
}, parseCv, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Elegí un archivo PDF' });
    if (!storage.detectPdf(req.file.buffer)) return res.status(400).json({ error: 'El archivo no es un PDF válido' });
    const row = await db.get('SELECT cv_url FROM voluntarios WHERE user_id=$1', [req.user.id]);
    if (!row) return res.status(404).json({ error: 'Perfil no encontrado' });
    const previous = row.cv_url || null;

    CV_UPLOADS_PER_USER.hit(req.user.id);
    let publicId;
    try {
      ({ publicId } = await storage.uploadPdf(req.file.buffer));
    } catch (err) {
      console.error('PUT /voluntarios/me/cv: falló la subida a Cloudinary:', forLog(err.message));
      return res.status(502).json({ error: 'No pudimos subir el CV. Probá de nuevo en un momento.' });
    }

    // Compare-and-swap: solo se guarda si el CV sigue siendo el que se leyó antes de subir. Si otro pedido lo
    // cambió mientras tanto, se borra lo recién subido (no queda huérfano) y se responde 409.
    let upd;
    try {
      upd = await db.run(
        `UPDATE voluntarios SET cv_url=$1, updated_at=CURRENT_TIMESTAMP WHERE user_id=$2 AND COALESCE(cv_url, '')=$3`,
        [publicId, req.user.id, previous || '']
      );
    } catch (err) {
      console.error('PUT /voluntarios/me/cv: no se pudo guardar:', err);
      await dropPdf(publicId, 'PUT /voluntarios/me/cv');
      return res.status(500).json({ error: 'Error al guardar el CV' });
    }
    if (upd.changes === 0) {
      await dropPdf(publicId, 'PUT /voluntarios/me/cv');
      return res.status(409).json({ error: CV_RACE });
    }
    if (previous) await dropPdf(previous, 'PUT /voluntarios/me/cv');   // el viejo ya no se puede abrir: si falla, solo se loguea
    res.json({ has_cv: true });
  } catch (err) {
    console.error('PUT /voluntarios/me/cv error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── DELETE /api/voluntarios/me/cv ──────────────────────────────────────────
router.delete('/me/cv', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const row = await db.get('SELECT cv_url FROM voluntarios WHERE user_id=$1', [req.user.id]);
    if (!row) return res.status(404).json({ error: 'Perfil no encontrado' });
    if (!row.cv_url) return res.json({ has_cv: false });
    const upd = await db.run(
      'UPDATE voluntarios SET cv_url=NULL, updated_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND cv_url=$2',
      [req.user.id, row.cv_url]
    );
    if (upd.changes === 0) return res.status(409).json({ error: CV_RACE });
    await dropPdf(row.cv_url, 'DELETE /voluntarios/me/cv');
    res.json({ has_cv: false });
  } catch (err) {
    console.error('DELETE /voluntarios/me/cv error:', err);
    res.status(500).json({ error: 'Error al borrar el CV' });
  }
});

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

    // Un id repetido violaba la PK (user_id, habilidad_id) en el INSERT: se deduplica, y gana la
    // última aparición (el body es el estado final). REVISION B6.
    const nivelPorId = new Map();
    for (const h of habilidades) nivelPorId.set(h.habilidad_id, h.nivel || 'basico');

    // Reemplazo completo: borrar y volver a insertar (mismo patrón que la
    // categoría de ONG en ngos.js — más simple y menos propenso a errores
    // que calcular un diff de altas/bajas/cambios de nivel). En una transacción: antes, si un
    // INSERT fallaba después del DELETE, el voluntario se quedaba sin ninguna habilidad.
    await db.transaction(async (tx) => {
      await tx.run('DELETE FROM voluntario_habilidades WHERE user_id=$1', [req.user.id]);
      for (const [habilidadId, nivel] of nivelPorId) {
        await tx.run(
          'INSERT INTO voluntario_habilidades (user_id, habilidad_id, nivel) VALUES ($1,$2,$3)',
          [req.user.id, habilidadId, nivel]
        );
      }
    });

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
// ── GET /api/voluntarios/:userId/cv — link de descarga que vence ───────────
// Primero el permiso y después la existencia: a quien no puede verlo se le responde lo mismo que si no hubiera CV,
// así no se puede averiguar quién cargó uno.
router.get('/:userId/cv', requireAuth, async (req, res) => {
  try {
    const target = req.params.userId;
    let allowed = req.user.role === 'volunteer' && req.user.id === target;
    if (!allowed && req.user.role === 'ngo') {
      allowed = Boolean(await db.get(
        `SELECT e.id FROM enrollments e
         JOIN projects p ON p.id = e.project_id
         JOIN ngos n ON n.id = p.ngo_id
         WHERE e.user_id = $1 AND n.user_id = $2 AND e.status IN ('pending', 'approved')
         LIMIT 1`,
        [target, req.user.id]
      ));
    }
    if (!allowed) return res.status(404).json({ error: CV_NOT_AVAILABLE });

    const row = await db.get(
      `SELECT v.cv_url FROM voluntarios v JOIN users u ON u.id = v.user_id WHERE v.user_id = $1 AND u.role = 'volunteer'`,
      [target]
    );
    if (!row?.cv_url) return res.status(404).json({ error: CV_NOT_AVAILABLE });
    if (!storage.isConfigured()) {
      return res.status(503).json({ error: 'La descarga de archivos no está disponible por el momento' });
    }
    const { url, expiresAt } = storage.pdfDownloadUrl(row.cv_url);
    res.json({ url, expires_at: expiresAt });
  } catch (err) {
    console.error('GET /voluntarios/:userId/cv error:', err);
    res.status(500).json({ error: 'Error interno' });
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
        following_count: Number(followingCount?.count) || 0,
        created_at: user.created_at,
      },
      habilidades,
      stats: {
        // Number(): en Postgres COUNT/SUM llegan como string, y '0' || 0 sigue siendo '0' (REVISION B9).
        total_enrollments: Number(enrollmentStats?.total) || 0,
        approved_enrollments: Number(enrollmentStats?.approved) || 0,
        total_horas: Number(enrollmentStats?.total_horas) || 0,
      },
      participaciones,
    });
  } catch (err) {
    console.error('GET /voluntarios/:userId error:', err);
    res.status(500).json({ error: 'Error al obtener perfil del voluntario' });
  }
});

module.exports = router;
