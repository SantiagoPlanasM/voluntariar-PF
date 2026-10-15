// src/lib/rateLimit.js — limitador de intentos en memoria (ventana deslizante), sin dependencias (AI_RULES regla 18).
// Lo usan el login y el registro (PROJECT_ANALYSIS.md §103). Como las conexiones del chat (§18), el estado es por
// proceso: si hubiera varias instancias, cada una cuenta lo suyo.

/**
 * @param {{ max: number, windowMs: number }} opts  hasta `max` intentos por clave dentro de `windowMs`.
 * - `blocked(key)` → 0 si se puede intentar; si no, los segundos hasta que se libere un lugar.
 * - `hit(key)` registra un intento. `reset(key)` limpia la clave (p. ej. tras un login correcto).
 */
function createLimiter({ max, windowMs }) {
  /** @type {Map<string, number[]>} clave -> momentos de sus intentos recientes */
  const hits = new Map();
  const recent = (key, now) => {
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length) hits.set(key, list); else hits.delete(key); // no acumular claves viejas
    return list;
  };
  return {
    blocked(key, now = Date.now()) {
      const list = recent(key, now);
      return list.length < max ? 0 : Math.max(1, Math.ceil((list[0] + windowMs - now) / 1000));
    },
    hit(key, now = Date.now()) {
      const list = recent(key, now);
      list.push(now);
      hits.set(key, list);
    },
    reset(key) { hits.delete(key); },
  };
}

module.exports = { createLimiter };
