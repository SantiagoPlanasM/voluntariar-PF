// src/routes/messages.js
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const MAX_BODY_LEN = 2000;

/**
 * Inserta un mensaje y devuelve la fila guardada (con datos del remitente).
 * Compartida entre el endpoint REST (POST /) y el listener de WebSocket
 * (src/ws/index.js), para no duplicar la lógica de validación/inserción.
 */
async function insertMessage(senderId, receiverId, body) {
  const trimmed = (body || '').toString().trim();
  if (!trimmed) throw new Error('El mensaje no puede estar vacío');
  if (trimmed.length > MAX_BODY_LEN) throw new Error(`El mensaje es demasiado largo (máx. ${MAX_BODY_LEN} caracteres)`);
  if (senderId === receiverId) throw new Error('No podés enviarte mensajes a vos mismo');

  const receiver = await db.get('SELECT id FROM users WHERE id=$1', [receiverId]);
  if (!receiver) throw new Error('Destinatario no encontrado');

  await db.run(
    'INSERT INTO messages (sender_id, receiver_id, body) VALUES ($1,$2,$3)',
    [senderId, receiverId, trimmed]
  );

  return db.get(
    `SELECT m.id, m.sender_id, m.receiver_id, m.body, m.read, m.created_at,
            u.name AS sender_name, u.avatar AS sender_avatar
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.sender_id=$1 AND m.receiver_id=$2
     ORDER BY m.created_at DESC LIMIT 1`,
    [senderId, receiverId]
  );
}

// ── GET /api/messages/conversations ────────────────────────────────────────
// Lista las conversaciones del usuario logueado: la otra persona, el último
// mensaje y cuántos sin leer tiene de esa persona.
//
// Optimización: en vez de 1 + 3N queries (una por cada conversación — usuario,
// último mensaje, no leídos), se resuelve con 3 queries fijas sin importar
// cuántas conversaciones tenga el usuario: los ids de las contrapartes, sus
// datos de usuario en un solo IN, y todos los mensajes de esas conversaciones
// en un solo SELECT — el "último mensaje" y el conteo de no leídos por
// conversación se calculan agregando en JS sobre esa única lista.
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const pairs = await db.all(
      `SELECT DISTINCT CASE WHEN sender_id=$1 THEN receiver_id ELSE sender_id END AS other_id
       FROM messages
       WHERE sender_id=$1 OR receiver_id=$1`,
      [req.user.id]
    );
    const otherIds = pairs.map(p => p.other_id);
    if (otherIds.length === 0) return res.json({ conversations: [] });

    // $1 = mi id (reutilizado en ambas mitades del OR — soportado desde el
    // fix del adaptador, ver PROJECT_ANALYSIS.md §18/B9); $2..$N+1 = las
    // contrapartes, también reutilizados en las dos mitades del OR.
    const placeholders = otherIds.map((_, i) => `$${i + 2}`).join(',');
    const params = [req.user.id, ...otherIds];

    const userRows = await db.all(
      `SELECT id, name, avatar, role FROM users WHERE id IN (${otherIds.map((_, i) => `$${i + 1}`).join(',')})`,
      otherIds
    );
    const userById = Object.fromEntries(userRows.map(u => [u.id, u]));

    const allMsgs = await db.all(
      `SELECT sender_id, receiver_id, body, read, created_at
       FROM messages
       WHERE (sender_id=$1 AND receiver_id IN (${placeholders}))
          OR (receiver_id=$1 AND sender_id IN (${placeholders}))
       ORDER BY created_at ASC`,
      params
    );

    const lastByOther = {};
    const unreadByOther = {};
    for (const m of allMsgs) {
      const otherId = m.sender_id === req.user.id ? m.receiver_id : m.sender_id;
      lastByOther[otherId] = { body: m.body, created_at: m.created_at, from_me: m.sender_id === req.user.id };
      if (m.receiver_id === req.user.id && !m.read) {
        unreadByOther[otherId] = (unreadByOther[otherId] || 0) + 1;
      }
    }

    const conversations = otherIds
      .map(otherId => {
        const other = userById[otherId];
        if (!other) return null; // usuario borrado
        const last = lastByOther[otherId];
        return {
          user: other,
          last_message: last?.body || '',
          last_at: last?.created_at || null,
          last_from_me: !!last?.from_me,
          unread: unreadByOther[otherId] || 0,
        };
      })
      .filter(Boolean);

    conversations.sort((a, b) => (b.last_at || '').localeCompare(a.last_at || ''));
    res.json({ conversations });
  } catch (err) {
    console.error('GET /messages/conversations error:', err);
    res.status(500).json({ error: 'Error al obtener conversaciones' });
  }
});

// ── GET /api/messages/thread/:userId ───────────────────────────────────────
// Historial de mensajes con un usuario puntual (últimos 300, orden cronológico).
router.get('/thread/:userId', requireAuth, async (req, res) => {
  try {
    const otherId = req.params.userId;
    const other = await db.get('SELECT id, name, avatar, role FROM users WHERE id=$1', [otherId]);
    if (!other) return res.status(404).json({ error: 'Usuario no encontrado' });

    const messages = await db.all(
      `SELECT id, sender_id, receiver_id, body, read, created_at
       FROM messages
       WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)
       ORDER BY created_at ASC
       LIMIT 300`,
      [req.user.id, otherId]
    );
    res.json({ messages, other });
  } catch (err) {
    console.error('GET /messages/thread/:userId error:', err);
    res.status(500).json({ error: 'Error al obtener la conversación' });
  }
});

// ── POST /api/messages ──────────────────────────────────────────────────────
// Envía un mensaje. Persiste siempre en la base (fuente de verdad); si el
// destinatario tiene una conexión de WebSocket abierta, se lo empuja en
// tiempo real. Si no está conectado, lo va a ver la próxima vez que abra la
// conversación (o vía el badge de no leídos).
router.post('/', requireAuth, async (req, res) => {
  try {
    const { to, body } = req.body;
    if (!to) return res.status(400).json({ error: 'Falta el destinatario' });

    const saved = await insertMessage(req.user.id, to, body);

    const { sendToUser } = require('../ws');
    sendToUser(to, { type: 'message', message: saved });

    res.status(201).json({ message: saved });
  } catch (err) {
    const clientErrors = ['vacío', 'largo', 'mismo', 'no encontrado'];
    if (clientErrors.some(k => err.message?.includes(k)))
      return res.status(400).json({ error: err.message });
    console.error('POST /messages error:', err);
    res.status(500).json({ error: 'Error al enviar el mensaje' });
  }
});

// ── PATCH /api/messages/thread/:userId/read ────────────────────────────────
// Marca como leídos todos los mensajes que me mandó ese usuario.
router.patch('/thread/:userId/read', requireAuth, async (req, res) => {
  try {
    await db.run(
      `UPDATE messages SET read=true WHERE sender_id=$1 AND receiver_id=$2 AND read=false`,
      [req.params.userId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /messages/thread/:userId/read error:', err);
    res.status(500).json({ error: 'Error al marcar como leído' });
  }
});

module.exports = router;
module.exports.insertMessage = insertMessage;
