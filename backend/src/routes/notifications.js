// src/routes/notifications.js
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/notifications ────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const notifications = await db.all(
      `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const unread = notifications.filter(n => !n.read && n.read !== 1).length;
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
