// src/lib/photoUpload.js — lectura de UNA foto en multipart (campo `photo`), compartida por la foto de perfil
// (PUT /api/auth/me/photo, §162) y la del voluntariado (PUT /api/projects/:id/photo, §282). Sacada de routes/auth.js
// para no copiarla (AI_RULES regla 3).
//
// En memoria (el disco de Render es efímero). El tipo que declara el cliente se filtra acá, pero la validación real es
// la cabecera del archivo (`storage.detectImageType`), que hace cada ruta antes de subir nada (regla 24).
// 8.000.000 y no 8 MiB: es el máximo para subidas de SonarCloud S5693 (§232), y el frontend usa el mismo tope.
const multer = require('multer');

const PHOTO_MAX_BYTES = 8_000_000;
const PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

class PhotoRejected extends Error {}
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PHOTO_MAX_BYTES, files: 1, fields: 5, parts: 6 },
  fileFilter: (req, file, cb) => {
    if (!PHOTO_MIME.has(file.mimetype)) return cb(new PhotoRejected('Solo se aceptan fotos JPEG, PNG o WebP'));
    cb(null, true);
  },
}).single('photo');

/** Middleware: deja la foto en `req.file` o responde 400/413 con un mensaje para mostrar. */
function parsePhoto(req, res, next) {
  photoUpload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof PhotoRejected) return res.status(400).json({ error: err.message });
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'La foto puede pesar hasta 8 MB' });
    }
    return res.status(400).json({ error: 'Elegí una foto' });   // campo con otro nombre, más de un archivo, etc.
  });
}

module.exports = { parsePhoto, PHOTO_MAX_BYTES };
