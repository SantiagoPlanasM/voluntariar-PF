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

// Límites (REVISION B19). Un mensaje válido entra en unos KB (cuerpo de hasta 2000 caracteres + JSON); sin
// maxPayload, la librería `ws` acepta hasta 100 MiB por mensaje. Pasado el tope cierra la conexión con 1009.
const MAX_PAYLOAD = 64 * 1024;
// Frecuencia: hasta SEND_LIMIT envíos por usuario cada SEND_WINDOW_MS (todas sus conexiones juntas). Cuenta los
// intentos, no solo los guardados: es para cortar una ráfaga, no para validar.
const SEND_LIMIT = 20;
const SEND_WINDOW_MS = 10_000;
/** @type {Map<string, number[]>} userId -> momentos de sus últimos envíos */
const recentSends = new Map();

function allowSend(userId, now = Date.now()) {
  const times = (recentSends.get(userId) || []).filter((t) => now - t < SEND_WINDOW_MS);
  if (times.length >= SEND_LIMIT) { recentSends.set(userId, times); return false; }
  times.push(now);
  recentSends.set(userId, times);
  return true;
}

const sendError = (ws, error) => ws.send(JSON.stringify({ type: 'error', error }));

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
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_PAYLOAD });

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
      let msg;
      try { msg = JSON.parse(raw.toString()); }
      catch { return sendError(ws, 'Mensaje inválido'); } // antes: el texto de JSON.parse, en inglés técnico
      if (!msg || msg.type !== 'send' || !msg.to || !msg.body) return;
      if (!allowSend(userId)) return sendError(ws, 'Estás enviando mensajes muy rápido. Esperá unos segundos.');

      const { insertMessage, MessageInputError } = require('../routes/messages');
      try {
        const saved = await insertMessage(userId, msg.to, msg.body);
        sendToUser(msg.to, { type: 'message', message: saved });
        sendToUser(userId, { type: 'message', message: saved }); // eco a otras pestañas propias
      } catch (err) {
        // Solo los errores del usuario se le muestran; los internos (de la base, etc.) van al log. Antes se le
        // reenviaba cualquier err.message, con detalles del servidor (REVISION B19).
        if (err instanceof MessageInputError) return sendError(ws, err.message);
        console.error('WS send error:', err);
        sendError(ws, 'Error al enviar el mensaje');
      }
    });
  });

  return wss;
}

module.exports = { initWebSocket, sendToUser, isUserOnline, allowSend, SEND_LIMIT, SEND_WINDOW_MS };
