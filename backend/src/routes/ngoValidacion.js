// src/routes/ngoValidacion.js — la ONG pide su validación (PROJECT_ANALYSIS.md §317). Montado en
// /api/ngos/me/validacion, antes que /api/ngos (src/index.js). Solo la dueña de la ONG (rol ngo).
//
//   GET  /                      → { validation: { status: 'none' } | { status, cuit, legal_type, reason, submitted_at, reviewed_at } }
//   POST /  (multipart)         → cuit, legal_type, statute (PDF), registration (PDF) → 201 { validation }
//   GET  /documento/:tipo       → { url, expires_at }   (tipo: statute | registration)
//
// Los PDF van PRIVADOS a Cloudinary, como el CV (regla 24): sesión y rol → límite → validar todo, con la cabecera real
// → subir → guardar → si algo falla, borrar lo subido. Se puede enviar sin pedido o después de un rechazo; en revisión
// o aprobada → 409. Al reenviar, los PDF viejos se borran después del COMMIT.

const express = require('express');
const multer = require('multer');
const { randomUUID } = require('node:crypto');
const db = require('../db');
const storage = require('../lib/storage');   // por propiedad, para reemplazarlo en tests
const { requireAuth, requireRole } = require('../middleware/auth');
const { createLimiter } = require('../lib/rateLimit');
const { isUniqueViolation } = require('../lib/dbErrors');
const { forLog } = require('../lib/logSafe');
const { LEGAL_TYPES, fmtValidation } = require('../lib/ngoValidation');
const { parseCuit } = require('./ngos');

const router = express.Router();
router.use(requireAuth, requireRole('ngo'));

const DOC_MAX_BYTES = 5 * 1024 * 1024;
const SUBMITS_PER_NGO = createLimiter({ max: 10, windowMs: 60 * 60 * 1000 });   // cada envío sube dos archivos
const DOCS = { statute: { col: 'estatuto_id', label: 'El estatuto', missing: 'Falta el estatuto (PDF)' },
  registration: { col: 'constancia_id', label: 'La constancia de inscripción', missing: 'Falta la constancia de inscripción (PDF)' } };

const upload = multer({
  storage: multer.memoryStorage(),   // nada al disco
  limits: { fileSize: DOC_MAX_BYTES, files: 2, fields: 5, parts: 8 },
}).fields([{ name: 'statute', maxCount: 1 }, { name: 'registration', maxCount: 1 }]);

function parseDocs(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Cada PDF puede pesar hasta 5 MB' });
    }
    return res.status(400).json({ error: 'No pudimos leer los documentos. Elegí dos archivos PDF.' });
  });
}

const dropPdf = (publicId, where) => storage.deletePdf(publicId)
  .catch((e) => console.error(`${where}: no se pudo borrar el PDF de Cloudinary:`, forLog(e.message)));

const myNgo = (userId) => db.get('SELECT id FROM ngos WHERE user_id=$1', [userId]);
const COLS = 'id, ngo_id, cuit, personeria, estatuto_id, constancia_id, estado, motivo, revisado_at, created_at, updated_at';

// ── GET / ────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const ngo = await myNgo(req.user.id);
    if (!ngo) return res.status(404).json({ error: 'Perfil ONG no encontrado' });
    const v = await db.get(`SELECT ${COLS} FROM ngo_validaciones WHERE ngo_id=$1`, [ngo.id]);
    res.json({ validation: fmtValidation(v) });
  } catch (err) {
    console.error('GET /ngos/me/validacion error:', err.message);
    res.status(500).json({ error: 'Error al obtener la validación' });
  }
});

// ── POST / ───────────────────────────────────────────────────────────────
router.post('/', (req, res, next) => {
  const wait = SUBMITS_PER_NGO.blocked(req.user.id);
  if (wait) {
    res.set('Retry-After', String(wait));
    return res.status(429).json({ error: 'Enviaste la validación muchas veces seguidas. Esperá un rato.' });
  }
  if (!storage.isConfigured()) {
    return res.status(503).json({ error: 'La subida de archivos no está disponible por el momento' });
  }
  next();
}, parseDocs, async (req, res) => {
  const where = 'POST /ngos/me/validacion';
  try {
    // 1. Validar todo antes de subir nada.
    const cuit = parseCuit(typeof req.body?.cuit === 'string' ? req.body.cuit : '');
    if (cuit.error || !cuit.value) return res.status(400).json({ error: cuit.error || 'El CUIT no es válido: son 11 números con el dígito verificador correcto' });
    const personeria = LEGAL_TYPES[req.body?.legal_type];
    if (!personeria) return res.status(400).json({ error: 'Elegí el tipo de personería' });
    const files = {};
    for (const [field, doc] of Object.entries(DOCS)) {
      const f = req.files?.[field]?.[0];
      if (!f) return res.status(400).json({ error: doc.missing });
      if (!storage.detectPdf(f.buffer)) return res.status(400).json({ error: `${doc.label} no es un PDF válido` });
      files[field] = f.buffer;
    }
    const ngo = await myNgo(req.user.id);
    if (!ngo) return res.status(404).json({ error: 'Perfil ONG no encontrado' });
    const current = await db.get(`SELECT ${COLS} FROM ngo_validaciones WHERE ngo_id=$1`, [ngo.id]);
    if (current?.estado === 'en_revision') return res.status(409).json({ error: 'La validación ya está en revisión' });
    if (current?.estado === 'aprobada') return res.status(409).json({ error: 'Tu ONG ya está validada' });

    // 2. Subir. Si la segunda falla, se borra la primera.
    SUBMITS_PER_NGO.hit(req.user.id);
    const uploaded = {};
    try {
      for (const field of Object.keys(DOCS)) uploaded[field] = (await storage.uploadPdf(files[field])).publicId;
    } catch (err) {
      console.error(`${where}: falló la subida a Cloudinary:`, forLog(err.message));
      for (const id of Object.values(uploaded)) await dropPdf(id, where);
      return res.status(502).json({ error: 'No pudimos subir los documentos. Probá de nuevo en un momento.' });
    }
    const dropUploaded = async () => { for (const id of Object.values(uploaded)) await dropPdf(id, where); };

    // 3. Guardar: alta, o reenvío después de un rechazo (compare-and-swap sobre 'rechazada').
    try {
      if (current) {
        const upd = await db.run(
          `UPDATE ngo_validaciones SET cuit=$1, personeria=$2, estatuto_id=$3, constancia_id=$4, estado='en_revision',
             motivo=NULL, revisado_por=NULL, revisado_at=NULL, updated_at=CURRENT_TIMESTAMP
           WHERE ngo_id=$5 AND estado='rechazada'`,
          [cuit.value, personeria, uploaded.statute, uploaded.registration, ngo.id]);
        if (upd.changes !== 1) {
          await dropUploaded();
          return res.status(409).json({ error: 'La validación cambió mientras la enviabas. Recargá la página.' });
        }
      } else {
        await db.run(
          `INSERT INTO ngo_validaciones (id, ngo_id, cuit, personeria, estatuto_id, constancia_id, estado)
           VALUES ($1,$2,$3,$4,$5,$6,'en_revision')`,
          [randomUUID(), ngo.id, cuit.value, personeria, uploaded.statute, uploaded.registration]);
      }
    } catch (err) {
      await dropUploaded();
      if (isUniqueViolation(err)) return res.status(409).json({ error: 'La validación ya está en revisión' });
      throw err;
    }
    // 4. Los PDF del pedido rechazado ya no se usan (después del guardado; si falla, solo se loguea).
    if (current) {
      await dropPdf(current.estatuto_id, where);
      await dropPdf(current.constancia_id, where);
    }
    const saved = await db.get(`SELECT ${COLS} FROM ngo_validaciones WHERE ngo_id=$1`, [ngo.id]);
    res.status(201).json({ validation: fmtValidation(saved) });
  } catch (err) {
    console.error(`${where} error:`, err);
    res.status(500).json({ error: 'Error al enviar la validación' });
  }
});

// ── GET /documento/:tipo ─────────────────────────────────────────────────
router.get('/documento/:tipo', async (req, res) => {
  try {
    const doc = DOCS[req.params.tipo];
    const ngo = doc ? await myNgo(req.user.id) : null;
    const v = ngo ? await db.get(`SELECT ${COLS} FROM ngo_validaciones WHERE ngo_id=$1`, [ngo.id]) : null;
    if (!v) return res.status(404).json({ error: 'Documento no encontrado' });
    const link = storage.pdfDownloadUrl(v[doc.col]);
    res.json({ url: link.url, expires_at: link.expiresAt });
  } catch (err) {
    console.error('GET /ngos/me/validacion/documento error:', forLog(err.message));
    res.status(500).json({ error: 'No pudimos abrir el documento' });
  }
});

module.exports = router;
module.exports.DOCS = DOCS;
module.exports.submitLimiter = SUBMITS_PER_NGO;
