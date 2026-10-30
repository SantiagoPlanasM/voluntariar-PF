// src/routes/projectPhoto.js — la foto del voluntariado (§282).
//
// PUT /api/projects/:id/photo (multipart, campo `photo`), solo la ONG dueña. Antes `projects.foto_perfil` existía (es
// el `image` de la API) pero no había forma de cargarla desde la aplicación.
// Orden de la regla 24 de AI_RULES: sesión y rol → límite → Cloudinary configurado → leer el archivo → validar la
// cabecera real y la propiedad → subir FUERA de la transacción → guardar → si falla, borrar lo subido. Se guarda la
// versión ancha (feedUrl, 1080 px: la tarjeta y el detalle) y el id de Cloudinary en `foto_provider_id`, que no sale en
// la API (fmt es una lista blanca). Al reemplazarla, la anterior se borra DESPUÉS del COMMIT, en lo posible; una URL
// externa vieja (sin id) no se toca. Borrar el voluntariado todavía no borra su foto (pendiente conocido).
// Archivo aparte para no agrandar routes/projects.js, el de mayor complejidad del proyecto.
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createLimiter } = require('../lib/rateLimit');
const { parsePhoto } = require('../lib/photoUpload');
const storage = require('../lib/storage');   // por propiedad, para poder reemplazarlo en los tests
const { forLog } = require('../lib/logSafe');
const { fmt } = require('./projects');

const router = express.Router();
const PROJECT_PHOTOS_PER_USER = createLimiter({ max: 20, windowMs: 60 * 60 * 1000 });   // cada subida gasta cuota

router.put('/:id/photo', requireAuth, requireRole('ngo'), (req, res, next) => {
  const wait = PROJECT_PHOTOS_PER_USER.blocked(req.user.id);
  if (wait) {
    res.set('Retry-After', String(wait));
    return res.status(429).json({ error: 'Cambiaste fotos muchas veces seguidas. Esperá un rato e intentá de nuevo.' });
  }
  if (!storage.isConfigured()) {
    return res.status(503).json({ error: 'La subida de fotos no está disponible por el momento' });
  }
  next();
}, parsePhoto, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Elegí una foto' });
    if (!storage.detectImageType(req.file.buffer)) {
      return res.status(400).json({ error: 'El archivo no es una imagen válida (JPEG, PNG o WebP)' });
    }
    const project = await db.get(
      `SELECT p.id, p.ngo_id, p.foto_provider_id FROM projects p JOIN ngos n ON n.id = p.ngo_id
       WHERE p.id=$1 AND n.user_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado o sin permiso' });

    PROJECT_PHOTOS_PER_USER.hit(req.user.id);
    let uploaded;
    try {
      uploaded = await storage.uploadImage(req.file.buffer);
    } catch (err) {
      console.error('PUT /projects/:id/photo: falló la subida a Cloudinary:', forLog(err.message));
      return res.status(502).json({ error: 'No pudimos subir la foto. Probá de nuevo en un momento.' });
    }

    const url = storage.feedUrl(uploaded.url);
    try {
      await db.transaction(async (tx) => {
        await tx.run('UPDATE projects SET foto_perfil=$1, foto_provider_id=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3 AND ngo_id=$4',
          [url, uploaded.publicId, project.id, project.ngo_id]);
      });
    } catch (err) {
      console.error('PUT /projects/:id/photo: no se pudo guardar:', err);
      await storage.deleteImage(uploaded.publicId).catch((e) => console.error('PUT /projects/:id/photo: no se pudo borrar lo subido:', forLog(e.message)));
      return res.status(500).json({ error: 'Error al guardar la foto' });
    }

    // La anterior, después del COMMIT y en lo posible: si falla, queda en Cloudinary (y en el log).
    if (project.foto_provider_id) {
      await storage.deleteImage(project.foto_provider_id)
        .catch((e) => console.error('PUT /projects/:id/photo: no se pudo borrar la foto anterior:', forLog(e.message)));
    }

    const row = await db.get(
      `SELECT p.*, n.nombre AS ngo_name, n.foto_perfil AS ngo_logo FROM projects p JOIN ngos n ON n.id = p.ngo_id WHERE p.id=$1`,
      [project.id]
    );
    res.json({ project: fmt(row) });
  } catch (err) {
    console.error('PUT /projects/:id/photo error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
