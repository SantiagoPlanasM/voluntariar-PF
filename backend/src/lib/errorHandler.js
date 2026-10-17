// src/lib/errorHandler.js
//
// Manejador global de errores de Express (el último `app.use` de src/index.js). Antes respondía siempre
// 500 con `err.message`: un JSON mal formado daba `500 {"error":"Unexpected end of JSON input"}`, un cuerpo
// de más de 5 MB también 500, y el rechazo de CORS mandaba `CORS: origen no permitido → <origen>`.
// Ahora (REVISION.md B3): los errores del cliente van con su código y un mensaje fijo en español
// (AI_RULES regla 19); el detalle técnico queda solo en el log.

// Errores que tira express.json() (body-parser), por `err.type`.
const { forLog } = require('./logSafe');   // S5145 (§202)

const BODY_ERRORS = {
  'entity.parse.failed':  [400, 'El cuerpo del pedido no es un JSON válido'],
  'entity.too.large':     [413, 'El pedido es demasiado grande (máximo 5 MB)'],
  'charset.unsupported':  [415, 'Codificación no soportada: usá UTF-8'],
  'encoding.unsupported': [415, 'Codificación no soportada: usá UTF-8'],
};

// Lo usa el callback de CORS en src/index.js para que el rechazo responda 403 y no 500.
function corsError(origin) {
  const err = new Error(`CORS: origen no permitido → ${origin}`); // va al log, nunca al cliente
  err.code = 'CORS_ORIGIN';
  return err;
}

// Los 4 parámetros son obligatorios: Express reconoce un manejador de errores por la cantidad.
function errorHandler(err, req, res, next) {
  console.error(`Error global (${req.method} ${forLog(req.path, 200)}):`, forLog(err.message));
  if (res.headersSent) return next(err); // ya se empezó a responder: que Express corte la conexión

  if (err.code === 'CORS_ORIGIN') return res.status(403).json({ error: 'Origen no permitido' });

  const known = BODY_ERRORS[err.type];
  if (known) return res.status(known[0]).json({ error: known[1] });

  // Otro error del cliente que no conocemos (body-parser marca los suyos con status 4xx).
  const status = err.status || err.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500)
    return res.status(status).json({ error: 'El pedido no es válido' });

  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { errorHandler, corsError };
