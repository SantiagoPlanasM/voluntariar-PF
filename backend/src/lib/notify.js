// src/lib/notify.js — el único lugar que crea notificaciones (§336).
//
// Guarda la notificación y, cuando ya está guardada, avisa por el WebSocket a las conexiones abiertas del
// destinatario para que su interfaz actualice los contadores sin esperar a cambiar de pantalla. El aviso lleva solo
// el tipo (`kind`): el texto y los datos se piden por GET /api/notifications, con la sesión de siempre.
//
// Se llama DESPUÉS del COMMIT (regla 21), nunca dentro de db.transaction(): usa `db`, y avisar de algo que después
// se deshace sería mentir. Si el alta falla, rechaza y no avisa; quien llama decide si eso frena su respuesta (casi
// todos lo ignoran con `.catch(() => {})`: una notificación que no sale no rompe la acción que la originó).
// Un test (notifications-push.test.js) controla que ningún otro archivo inserte en `notifications`.
const db = require('../db');
const { sendToUser } = require('../ws');

/**
 * @param {string} userId  a quién le llega
 * @param {string} type    el tipo que entiende el frontend (`notificationHref`)
 * @param {string} title
 * @param {string} body
 * @param {object} [data]  ids para armar el destino; se guarda como JSON
 */
async function notify(userId, type, title, body, data = {}) {
  await db.run(
    'INSERT INTO notifications (user_id, type, title, body, data) VALUES ($1,$2,$3,$4,$5)',
    [userId, type, title, body, JSON.stringify(data)]
  );
  sendToUser(userId, { type: 'notification', kind: type });
}

module.exports = { notify };
