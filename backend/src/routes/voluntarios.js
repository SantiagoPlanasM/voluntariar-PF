// src/routes/voluntarios.js
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

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

    // Reemplazo completo: borrar y volver a insertar (mismo patrón que la
    // categoría de ONG en ngos.js — más simple y menos propenso a errores
    // que calcular un diff de altas/bajas/cambios de nivel).
    await db.run('DELETE FROM voluntario_habilidades WHERE user_id=$1', [req.user.id]);
    for (const h of habilidades) {
      await db.run(
        'INSERT INTO voluntario_habilidades (user_id, habilidad_id, nivel) VALUES ($1,$2,$3)',
        [req.user.id, h.habilidad_id, h.nivel || 'basico']
      );
    }

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

module.exports = router;
