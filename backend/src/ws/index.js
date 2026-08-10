// src/ws/index.js
// Servidor de WebSocket para el chat 1 a 1. Se cuelga del mismo servidor HTTP
// que Express (no levanta un puerto aparte), en el path /ws.
//
// Autenticación: el cliente se conecta a `wss://host/ws?token=<jwt>` — el
// mismo JWT que ya usa para las llamadas REST. No hay un segundo sistema de
// login para el chat.
//
// Estado: un Map en memoria de userId -> Set<WebSocket>. Un mismo usuario
// puede tener varias conexiones abiertas (varias pestañas/dispositivos); se
// les manda el mensaje a todas. Este estado es puramente in-memory: si el
// proceso reinicia, las conexiones se pierden y el cliente debe reconectar
// (el historial de mensajes siempre está a salvo en la base de datos, esto
// solo afecta la entrega en tiempo real).

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'voluntariar_dev_secret';

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const clients = new Map();

function addClient(userId, ws) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(ws);
}

function removeClient(userId, ws) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) clients.delete(userId);
}

/** Manda `payload` (se serializa a JSON) a todas las conexiones abiertas de `userId`. */
function sendToUser(userId, payload) {
  const set = clients.get(userId);
  if (!set || set.size === 0) return false;
  const data = JSON.stringify(payload);
  let sent = false;
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) { ws.send(data); sent = true; }
  }
  return sent;
}

function isUserOnline(userId) {
  return clients.has(userId) && clients.get(userId).size > 0;
}

function initWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    let userId = null;
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      const payload = jwt.verify(token, JWT_SECRET);
      userId = payload.id;
    } catch {
      ws.close(4001, 'No autorizado');
      return;
    }

    addClient(userId, ws);
    ws.send(JSON.stringify({ type: 'connected' }));

    ws.on('close', () => removeClient(userId, ws));
    ws.on('error', () => removeClient(userId, ws));

    // El envío principal de mensajes va por REST (POST /api/messages), que
    // persiste en la base y después llama a sendToUser(). Este listener es
    // un atajo opcional para que el propio cliente mande por WS y ahorre la
    // ida y vuelta HTTP — usa la misma función de inserción que la ruta REST.
    ws.on('message', async raw => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type !== 'send' || !msg.to || !msg.body) return;
        const { insertMessage } = require('../routes/messages');
        const saved = await insertMessage(userId, msg.to, msg.body);
        sendToUser(msg.to, { type: 'message', message: saved });
        sendToUser(userId, { type: 'message', message: saved }); // eco a otras pestañas propias
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', error: err.message || 'Error al enviar el mensaje' }));
      }
    });
  });

  return wss;
}

module.exports = { initWebSocket, sendToUser, isUserOnline };
