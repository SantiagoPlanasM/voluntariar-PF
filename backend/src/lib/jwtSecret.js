// src/lib/jwtSecret.js — el secreto con el que se firman y verifican los JWT. ÚNICO lugar que lo define: lo usan
// middleware/auth.js (REST) y ws/index.js (WebSocket). Antes cada uno tenía su copia de
// `process.env.JWT_SECRET || 'voluntariar_dev_secret'` (REVISION B19, AI_RULES regla 17).
//
// Decisión del usuario (PROJECT_ANALYSIS.md §94): en producción es OBLIGATORIO. Sin la variable (o con el valor de
// desarrollo, que es público en el repo) el servidor no arranca: con ese valor cualquiera podría fabricar tokens
// válidos de cualquier usuario y rol. En desarrollo y tests sigue el valor de desarrollo, como siempre.
// En Render la genera render.yaml (`generateValue: true`).
const DEV_JWT_SECRET = 'voluntariar_dev_secret';

function resolveJwtSecret(env = process.env) {
  const secret = env.JWT_SECRET;
  if (env.NODE_ENV === 'production') {
    if (!secret) throw new Error('Falta JWT_SECRET: en producción es obligatoria (definila en el entorno del servidor).');
    if (secret === DEV_JWT_SECRET) throw new Error('JWT_SECRET tiene el valor de desarrollo: en producción usá uno propio y aleatorio.');
    return secret;
  }
  return secret || DEV_JWT_SECRET;
}

module.exports = { resolveJwtSecret, DEV_JWT_SECRET };
