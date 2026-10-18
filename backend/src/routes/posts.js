// src/routes/posts.js
//
// Publicaciones ("Momentos"): fotos de los voluntariados en los que se participó, estilo Instagram.
// Diseño y decisiones en docs/PROJECT_ANALYSIS.md §43.
//
//   GET    /api/posts/eligible-projects  — en qué proyectos puede publicar quien está logueado
//   POST   /api/posts                    — crear (multipart: project_id, caption?, photos[1..5])
//   GET    /api/posts                    — feed público, paginado (?project_id, ?user_id, ?ngo_id, ?limit, ?offset)
//   GET    /api/posts/:id                — una publicación
//   POST   /api/posts/:id/like           — dar like (idempotente)
//   DELETE /api/posts/:id/like           — quitar el like
//   DELETE /api/posts/:id                — borrar (el autor, o la ONG dueña del proyecto: moderación)
//
// Las fotos se guardan en Cloudinary (lib/storage.js). Este archivo SIEMPRE llama a
// `storage.uploadImage(...)` / `storage.deleteImage(...)` accediendo a la propiedad en cada llamada
// (no desestructurado), para que los tests puedan reemplazarlas.

const express = require('express');
const multer = require('multer');
const { randomUUID } = require('node:crypto');
const db = require('../db');
const storage = require('../lib/storage');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');
const { toMillis } = require('../lib/time');
const { hasBadWord } = require('../lib/badWords');
const { clampInt, checkText } = require('../lib/inputs');

const router = express.Router();

const MAX_PHOTOS = 5;
// 8 MB por foto (el frontend las comprime antes de subir). 8.000.000 y no 8 MiB: es el máximo para subidas de
// SonarCloud S5693 (§232), y el frontend usa el mismo tope.
const MAX_FILE_BYTES = 8_000_000;
const MAX_CAPTION = 500;
const POSTS_PER_HOUR = 10;                // límite de frecuencia por usuario
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// ── subida multipart ────────────────────────────────────────────────────────
// memoryStorage: las fotos quedan en memoria solo mientras dura el request (máx. 5 × 8 MB) y se
// mandan directo a Cloudinary; no se escribe nada en el disco del servidor.
class UploadRejected extends Error {}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_PHOTOS, fields: 10, parts: MAX_PHOTOS + 10 },
  // Primer filtro, por el tipo que DECLARA el cliente (barato, corta temprano). La verificación de
  // verdad es la de la cabecera real del archivo (storage.detectImageType), más abajo.
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new UploadRejected('Solo se aceptan fotos JPEG, PNG o WebP'));
    cb(null, true);
  },
}).array('photos', MAX_PHOTOS);

function parseUpload(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof UploadRejected) return res.status(400).json({ error: err.message });
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Cada foto puede pesar hasta 8 MB' });
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: `Podés subir hasta ${MAX_PHOTOS} fotos por publicación` });
      }
    }
    console.error('POST /posts: no se pudo leer el formulario:', err.message);
    return res.status(400).json({ error: 'No se pudo leer el formulario' });
  });
}

function requireStorage(req, res, next) {
  if (!storage.isConfigured()) {
    return res.status(503).json({ error: 'La subida de fotos no está disponible por el momento' });
  }
  next();
}

// ── helpers ─────────────────────────────────────────────────────────────────

const isoDate = (v) => {
  const ms = toMillis(v);
  return ms === null ? null : new Date(ms).toISOString();   // string en SQLite, Date en Postgres → siempre ISO
};

// Participó = inscripción APROBADA (una pendiente no cuenta). La ONG dueña también puede publicar.
async function canPostTo(user, project) {
  if (user.role === 'ngo') {
    return Boolean(await db.get('SELECT id FROM ngos WHERE id=$1 AND user_id=$2', [project.ngo_id, user.id]));
  }
  return Boolean(await db.get(
    "SELECT id FROM enrollments WHERE project_id=$1 AND user_id=$2 AND status='approved'",
    [project.id, user.id]
  ));
}

// Límite de frecuencia sin depender de aritmética de fechas de cada motor: se traen las últimas N
// publicaciones del usuario y se cuentan las de la última hora con toMillis(). Persiste entre reinicios
// del servidor. No es estricto bajo concurrencia (dos pedidos simultáneos podrían pasarse por poco).
async function recentPostCount(userId) {
  const rows = await db.all('SELECT created_at FROM posts WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2', [userId, POSTS_PER_HOUR]);
  const since = Date.now() - 60 * 60 * 1000;
  return rows.filter((r) => (toMillis(r.created_at) ?? 0) >= since).length;
}

// Borra de Cloudinary lo que ya se había subido (si el post no llegó a guardarse). Mejor esfuerzo: un
// fallo acá se loguea pero no cambia la respuesta (el archivo huérfano es un costo, no un error visible).
async function cleanupUploads(publicIds) {
  const results = await Promise.allSettled(publicIds.map((id) => storage.deleteImage(id)));
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`[posts] no se pudo borrar ${publicIds[i]} de Cloudinary:`, r.reason?.message);
  });
}

const POST_SELECT = `
  SELECT po.id, po.caption, po.created_at, po.user_id, po.project_id,
         u.name AS author_name, u.avatar AS author_avatar, u.role AS author_role,
         p.titulo AS project_title, n.user_id AS owner_user_id,
         (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = po.id) AS likes_count
  FROM posts po
  JOIN users u ON u.id = po.user_id
  JOIN projects p ON p.id = po.project_id
  JOIN ngos n ON n.id = p.ngo_id`;

// Convierte filas de POST_SELECT en la forma pública, con las fotos y los "me gusta" de quien mira.
// 2 consultas más para TODA la página (no una por publicación).
async function hydrate(rows, viewerId) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const media = await db.all(
    `SELECT id, post_id, url, position, width, height FROM post_media
     WHERE post_id IN (${ids.map((_, i) => `$${i + 1}`).join(',')}) ORDER BY position`,
    ids
  );
  const byPost = new Map();
  for (const m of media) {
    if (!byPost.has(m.post_id)) byPost.set(m.post_id, []);
    byPost.get(m.post_id).push(m);
  }

  let liked = new Set();
  if (viewerId) {
    const lr = await db.all(
      `SELECT post_id FROM post_likes WHERE user_id=$1 AND post_id IN (${ids.map((_, i) => `$${i + 2}`).join(',')})`,
      [viewerId, ...ids]
    );
    liked = new Set(lr.map((r) => r.post_id));
  }

  const num = (v) => (v === null || v === undefined ? null : Number(v));
  return rows.map((r) => ({
    id: r.id,
    caption: r.caption ?? null,
    created_at: isoDate(r.created_at),
    author: { id: r.user_id, name: r.author_name, avatar: r.author_avatar || null, role: r.author_role },
    project: { id: r.project_id, title: r.project_title },
    photos: (byPost.get(r.id) || []).map((m) => ({
      id: m.id, url: storage.feedUrl(m.url), thumb_url: storage.thumbUrl(m.url), width: num(m.width), height: num(m.height),
    })),
    likes_count: Number(r.likes_count) || 0,      // en Postgres COUNT llega como string
    liked_by_me: liked.has(r.id),
    // Lo calcula el servidor según quién mira, con la misma regla que DELETE /api/posts/:id (el autor, o la
    // ONG dueña del proyecto). El cliente no puede saber quién es la ONG dueña, así que no lo adivina.
    can_delete: Boolean(viewerId) && (r.user_id === viewerId || r.owner_user_id === viewerId),
  }));
}

const loadOne = async (id, viewerId) => {
  const row = await db.get(`${POST_SELECT} WHERE po.id=$1`, [id]);
  return row ? (await hydrate([row], viewerId))[0] : null;
};

// ── GET /api/posts/eligible-projects ────────────────────────────────────────
// Tiene que ir ANTES de '/:id', o "eligible-projects" se interpretaría como un id.
router.get('/eligible-projects', requireAuth, requireRole('volunteer', 'ngo'), async (req, res) => {
  try {
    const rows = req.user.role === 'ngo'
      ? await db.all(
          `SELECT p.id, p.titulo AS title FROM projects p JOIN ngos n ON n.id = p.ngo_id
           WHERE n.user_id=$1 ORDER BY p.titulo`, [req.user.id])
      : await db.all(
          `SELECT DISTINCT p.id, p.titulo AS title FROM enrollments e JOIN projects p ON p.id = e.project_id
           WHERE e.user_id=$1 AND e.status='approved' ORDER BY p.titulo`, [req.user.id]);
    res.json({ projects: rows.map((r) => ({ id: r.id, title: r.title })) });
  } catch (err) {
    console.error('GET /posts/eligible-projects error:', err);
    res.status(500).json({ error: 'Error al obtener los proyectos' });
  }
});

// ── POST /api/posts ─────────────────────────────────────────────────────────
// Orden deliberado: sesión y rol ANTES de leer el cuerpo (no bufferizar hasta 40 MB para un anónimo);
// y todas las validaciones ANTES de subir nada (no gastar cuota de Cloudinary en pedidos inválidos).
router.post('/', requireAuth, requireRole('volunteer', 'ngo'), requireStorage, parseUpload, async (req, res) => {
  try {
    const files = req.files || [];
    const projectId = String(req.body?.project_id ?? '').trim();
    const caption = String(req.body?.caption ?? '').trim();

    if (!projectId) return res.status(400).json({ error: 'Falta el proyecto' });
    if (files.length === 0) return res.status(400).json({ error: 'Subí al menos una foto' });
    if (caption.length > MAX_CAPTION) return res.status(400).json({ error: `El texto no puede superar los ${MAX_CAPTION} caracteres` });
    if (caption && hasBadWord(caption)) return res.status(400).json({ error: 'El texto contiene palabras no permitidas' });

    const project = await db.get('SELECT id, ngo_id FROM projects WHERE id=$1', [projectId]);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
    if (!(await canPostTo(req.user, project))) {
      return res.status(403).json({ error: 'Solo pueden publicar quienes participaron en este voluntariado (con inscripción aprobada) o la ONG responsable' });
    }

    if ((await recentPostCount(req.user.id)) >= POSTS_PER_HOUR) {
      return res.status(429).json({ error: 'Publicaste demasiadas veces seguidas. Esperá un rato e intentá de nuevo.' });
    }

    // El tipo declarado lo escribe quien sube el archivo: se verifica la cabecera real de TODAS.
    if (files.some((f) => !storage.detectImageType(f.buffer))) {
      return res.status(400).json({ error: 'Uno de los archivos no es una imagen válida (JPEG, PNG o WebP)' });
    }

    // Subida en paralelo. Si alguna falla se borran las que sí se subieron (no quedan huérfanas).
    const settled = await Promise.allSettled(files.map((f) => storage.uploadImage(f.buffer)));
    const uploaded = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
    const failed = settled.find((s) => s.status === 'rejected');
    if (failed) {
      console.error('POST /posts: falló la subida a Cloudinary:', failed.reason?.message);
      await cleanupUploads(uploaded.map((u) => u.publicId));
      return res.status(502).json({ error: 'No pudimos subir las fotos. Probá de nuevo en un momento.' });
    }

    // Post + fotos en UNA transacción, DESPUÉS de las llamadas externas (que no van adentro).
    const postId = randomUUID();
    try {
      await db.transaction(async (tx) => {
        await tx.run('INSERT INTO posts (id, user_id, project_id, caption) VALUES ($1,$2,$3,$4)',
          [postId, req.user.id, projectId, caption || null]);
        for (let i = 0; i < uploaded.length; i++) {
          const u = uploaded[i];
          await tx.run(
            'INSERT INTO post_media (id, post_id, url, provider_id, position, width, height) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [randomUUID(), postId, u.url, u.publicId, i, u.width, u.height]
          );
        }
      });
    } catch (err) {
      await cleanupUploads(uploaded.map((u) => u.publicId));
      throw err;
    }

    res.status(201).json({ post: await loadOne(postId, req.user.id) });
  } catch (err) {
    console.error('POST /posts error:', err);
    res.status(500).json({ error: 'Error al crear la publicación' });
  }
});

// ── GET /api/posts ──────────────────────────────────────────────────────────
// Paginación por limit/offset con desempate por id: determinista, y simple de consumir con scroll
// infinito. Si entran publicaciones nuevas mientras se pagina pueden correrse las páginas (el cliente
// deduplica por id). Se pide uno de más para saber si hay más (`has_more`) sin un COUNT aparte.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
    const offset = clampInt(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);

    // `ngo_id` (id de la tabla `ngos`): publicaciones de los PROYECTOS de esa ONG, sea quien sea el autor
    // (REVISION S2: el panel de la ONG mostraba el feed de toda la plataforma). A diferencia de project_id y
    // user_id, si viene vacío o repetido no se ignora: da 400, para que un error del cliente no termine
    // mostrando el feed general bajo "Fotos de tus voluntariados".
    const ngoErr = req.query.ngo_id === undefined ? null
      : checkText(req.query.ngo_id, { label: 'El filtro de ONG', max: 100, required: true });
    if (ngoErr) return res.status(400).json({ error: ngoErr });

    const where = [];
    const params = [];
    if (req.query.project_id) { params.push(String(req.query.project_id)); where.push(`po.project_id = $${params.length}`); }
    if (req.query.user_id)    { params.push(String(req.query.user_id));    where.push(`po.user_id = $${params.length}`); }
    if (req.query.ngo_id !== undefined) { params.push(req.query.ngo_id.trim()); where.push(`p.ngo_id = $${params.length}`); }
    params.push(limit + 1);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const rows = await db.all(
      `${POST_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY po.created_at DESC, po.id DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );
    const hasMore = rows.length > limit;
    res.json({ posts: await hydrate(rows.slice(0, limit), req.user?.id), has_more: hasMore });
  } catch (err) {
    console.error('GET /posts error:', err);
    res.status(500).json({ error: 'Error al obtener las publicaciones' });
  }
});

// ── GET /api/posts/:id ──────────────────────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const post = await loadOne(req.params.id, req.user?.id);
    if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
    res.json({ post });
  } catch (err) {
    console.error('GET /posts/:id error:', err);
    res.status(500).json({ error: 'Error al obtener la publicación' });
  }
});

// ── Likes ───────────────────────────────────────────────────────────────────
const likesCount = async (postId) => Number((await db.get('SELECT COUNT(*) AS n FROM post_likes WHERE post_id=$1', [postId])).n) || 0;

router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    if (!(await db.get('SELECT id FROM posts WHERE id=$1', [req.params.id]))) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }
    // ON CONFLICT DO NOTHING: dar like dos veces (doble click, pedidos simultáneos) no duplica ni falla.
    await db.run('INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, req.user.id]);
    res.json({ liked: true, likes_count: await likesCount(req.params.id) });
  } catch (err) {
    console.error('POST /posts/:id/like error:', err);
    res.status(500).json({ error: 'Error al dar like' });
  }
});

router.delete('/:id/like', requireAuth, async (req, res) => {
  try {
    if (!(await db.get('SELECT id FROM posts WHERE id=$1', [req.params.id]))) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }
    await db.run('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ liked: false, likes_count: await likesCount(req.params.id) });
  } catch (err) {
    console.error('DELETE /posts/:id/like error:', err);
    res.status(500).json({ error: 'Error al quitar el like' });
  }
});

// ── DELETE /api/posts/:id ───────────────────────────────────────────────────
// El autor borra lo suyo; la ONG dueña del proyecto modera (puede borrar cualquier publicación de él).
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const post = await db.get(
      'SELECT po.id, po.user_id, p.ngo_id FROM posts po JOIN projects p ON p.id = po.project_id WHERE po.id=$1',
      [req.params.id]
    );
    if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });

    let allowed = post.user_id === req.user.id;
    if (!allowed && req.user.role === 'ngo') {
      allowed = Boolean(await db.get('SELECT id FROM ngos WHERE id=$1 AND user_id=$2', [post.ngo_id, req.user.id]));
    }
    if (!allowed) return res.status(403).json({ error: 'No podés borrar esta publicación' });

    const media = await db.all('SELECT provider_id FROM post_media WHERE post_id=$1', [post.id]);

    // Hijos explícitos (no depender solo del ON DELETE CASCADE), todo o nada.
    await db.transaction(async (tx) => {
      await tx.run('DELETE FROM post_likes WHERE post_id=$1', [post.id]);
      await tx.run('DELETE FROM post_media WHERE post_id=$1', [post.id]);
      await tx.run('DELETE FROM posts WHERE id=$1', [post.id]);
    });

    // Después del COMMIT y sin esperar: borrar el archivo es "mejor esfuerzo".
    cleanupUploads(media.map((m) => m.provider_id)).catch(() => {});

    res.json({ message: 'Publicación eliminada' });
  } catch (err) {
    console.error('DELETE /posts/:id error:', err);
    res.status(500).json({ error: 'Error al eliminar la publicación' });
  }
});

module.exports = router;
