// src/routes/notifications.js
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/notifications ────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    // Lista blanca (regla 8, §159): antes `SELECT *` y una columna nueva salía sola. Son las mismas de hoy.
    const notifications = await db.all(
      `SELECT id, user_id, type, title, body, read, data, created_at
       FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    // Contador sobre TODAS las del usuario, no sobre las 50 de la lista (antes quedaba en ≤50; §152).
    // `read` es BOOLEAN: se compara con false, nunca con 0. NULL cuenta como no leída (como el `!n.read` viejo).
    // COUNT llega como string en Postgres: Number(x) || 0.
    const row = await db.get(
      'SELECT COUNT(*) AS n FROM notifications WHERE user_id=$1 AND (read = false OR read IS NULL)',
      [req.user.id]
    );
    const unread = Number(row?.n) || 0;
    res.json({ notifications, unread });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// ── PATCH /api/notifications/:id/read ─────────────────────────────────────
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    await db.run(
      'UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Marcada como leída' });
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

// ── PATCH /api/notifications/read-all ────────────────────────────────────
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    await db.run('UPDATE notifications SET read=true WHERE user_id=$1', [req.user.id]);
    res.json({ message: 'Todas marcadas como leídas' });
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
