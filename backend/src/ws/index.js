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

const { resolveJwtSecret } = require('../lib/jwtSecret');

// El mismo secreto que el REST (un solo lugar lo define, §94; antes esta era una copia aparte del default).
const JWT_SECRET = resolveJwtSecret();

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const clients = new Map();

// El socket es SOLO para recibir (decisión del usuario, PROJECT_ANALYSIS.md §100): los mensajes se mandan por
// POST /api/messages, que los guarda y llama a sendToUser(). Lo que mande el cliente por acá se ignora.
// maxPayload (REVISION B19, §87): sin él, la librería `ws` acepta hasta 100 MiB por frame; pasado el tope cierra
// la conexión con 1009 sin procesarlo.
const MAX_PAYLOAD = 64 * 1024;

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

    // Sin listener de 'message': hasta §100 aceptaba { type: 'send', to, body } como atajo para mandar; desde §92 ningún
    // cliente lo usaba (el chat manda por REST) y se sacó para que el socket sea solo de recepción.
  });

  return wss;
}

module.exports = { initWebSocket, sendToUser, isUserOnline };
