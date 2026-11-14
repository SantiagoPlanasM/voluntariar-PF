// src/routes/admin.js — panel de administración (PROJECT_ANALYSIS.md §317). Montado en /api/admin. Solo los mails de
// ADMIN_EMAILS (lib/ngoValidation.js, requireAdmin); el resto 403.
//
//   GET  /validaciones?status=pending|all       → { validations: [{ id, ngo_id, ngo_name, status, cuit, legal_type, reason, submitted_at, reviewed_at }] }
//   GET  /validaciones/:id/documento/:tipo      → { url, expires_at }   (link firmado al PDF privado)
//   POST /validaciones/:id/aprobar              → { validation }
//   POST /validaciones/:id/rechazar { reason }  → { validation }   (motivo de 10 a 500 caracteres)
//
// Decidir es un compare-and-swap sobre 'en_revision' (regla 21): dos decisiones a la vez → una gana y la otra 409.
// La notificación y el mail a la ONG van después (regla 21).

const express = require('express');
const db = require('../db');
const storage = require('../lib/storage');   // por propiedad (storage.pdfDownloadUrl)
const email = require('../lib/email');       // por propiedad (email.sendEmail)
const { requireAuth } = require('../middleware/auth');
const { requireAdmin, fmtValidation } = require('../lib/ngoValidation');
const { ngoValidationEmail } = require('../lib/emailTemplates');
const { checkText } = require('../lib/inputs');
const { forLog } = require('../lib/logSafe');
const { notify } = require('../lib/notify');
const { DOCS } = require('./ngoValidacion');

const router = express.Router();
router.use(requireAuth, requireAdmin);

const APP_URL = () => process.env.APP_URL || 'http://localhost:5173';
const COLS = `v.id, v.ngo_id, v.cuit, v.personeria, v.estatuto_id, v.constancia_id, v.estado, v.motivo, v.revisado_at,
  v.created_at, v.updated_at, n.nombre AS ngo_name, n.user_id AS ngo_user_id`;
const load = (id) => db.get(`SELECT ${COLS} FROM ngo_validaciones v JOIN ngos n ON n.id = v.ngo_id WHERE v.id=$1`, [id]);
const listItem = (v) => ({ id: v.id, ngo_id: v.ngo_id, ngo_name: v.ngo_name, ...fmtValidation(v) });

// ── GET /validaciones ────────────────────────────────────────────────────
router.get('/validaciones', async (req, res) => {
  try {
    const all = req.query.status === 'all';
    const rows = await db.all(
      `SELECT ${COLS} FROM ngo_validaciones v JOIN ngos n ON n.id = v.ngo_id
       ${all ? '' : `WHERE v.estado = 'en_revision'`}
       ORDER BY v.updated_at ASC`);
    res.json({ validations: rows.map(listItem) });
  } catch (err) {
    console.error('GET /admin/validaciones error:', err.message);
    res.status(500).json({ error: 'Error al obtener las validaciones' });
  }
});

// ── GET /validaciones/:id/documento/:tipo ────────────────────────────────
router.get('/validaciones/:id/documento/:tipo', async (req, res) => {
  try {
    const doc = DOCS[req.params.tipo];
    const v = doc ? await load(req.params.id) : null;
    if (!v) return res.status(404).json({ error: 'Documento no encontrado' });
    const link = storage.pdfDownloadUrl(v[doc.col]);
    res.json({ url: link.url, expires_at: link.expiresAt });
  } catch (err) {
    console.error('GET /admin/validaciones/documento error:', forLog(err.message));
    res.status(500).json({ error: 'No pudimos abrir el documento' });
  }
});

// Aprobar o rechazar: compare-and-swap, y después del cambio, el aviso.
async function decide(req, res, approved) {
  const where = `POST /admin/validaciones/${approved ? 'aprobar' : 'rechazar'}`;
  try {
    let reason = null;
    if (!approved) {
      const r = req.body?.reason;
      if (typeof r !== 'string' || checkText(r, { label: 'El motivo', min: 10, max: 500, required: true })) {
        return res.status(400).json({ error: 'Escribí el motivo del rechazo (de 10 a 500 caracteres)' });
      }
      reason = r.trim();
    }
    const v = await load(req.params.id);
    if (!v) return res.status(404).json({ error: 'Validación no encontrada' });
    const upd = await db.run(
      `UPDATE ngo_validaciones SET estado=$1, motivo=$2, revisado_por=$3, revisado_at=$4, updated_at=CURRENT_TIMESTAMP
       WHERE id=$5 AND estado='en_revision'`,
      [approved ? 'aprobada' : 'rechazada', reason, req.user.id, new Date().toISOString(), v.id]);
    if (upd.changes !== 1) return res.status(409).json({ error: 'Esa validación ya no está en revisión' });

    // Después del cambio (regla 21): notificación y mail. Si fallan, la decisión ya quedó.
    try {
      await notify(v.ngo_user_id, approved ? 'ngo_validation_approved' : 'ngo_validation_rejected',
        approved ? 'Tu ONG está validada' : 'Revisamos la validación de tu ONG',
        approved ? 'Ya aparece con la insignia azul.' : `No pudimos validarla: ${reason}`,
        { ngo_id: v.ngo_id });
      const owner = await db.get('SELECT email FROM users WHERE id=$1', [v.ngo_user_id]);
      if (owner?.email) {
        await email.sendEmail({ to: owner.email, ...ngoValidationEmail({ ngoName: v.ngo_name, approved, reason, appUrl: APP_URL() }) });
      }
    } catch (err) {
      console.error(`${where}: no se pudo avisar a la ONG:`, forLog(err.message));
    }
    const saved = await load(v.id);
    res.json({ validation: listItem(saved) });
  } catch (err) {
    console.error(`${where} error:`, err);
    res.status(500).json({ error: 'Error al guardar la decisión' });
  }
}
router.post('/validaciones/:id/aprobar', (req, res) => decide(req, res, true));
router.post('/validaciones/:id/rechazar', (req, res) => decide(req, res, false));

module.exports = router;
