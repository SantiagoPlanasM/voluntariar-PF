// src/lib/time.js
//
// Los timestamps llegan distinto según el motor de base de datos:
//   - SQLite:   string 'YYYY-MM-DD HH:MM:SS' (UTC, SIN zona horaria)
//   - Postgres: objeto Date (las columnas son TIMESTAMPTZ)
// Tratarlos como string (`.replace`, `.localeCompare`, `.includes`...) anda en
// SQLite y devuelve 500 en Postgres. Todo cálculo con fechas sobre valores que
// vienen de la base de datos debe pasar por toMillis().

/**
 * Convierte un timestamp de la base de datos a milisegundos desde epoch.
 * Devuelve `null` si el valor es null/undefined o no es una fecha válida
 * (nunca lanza ni devuelve NaN, para que el llamador decida qué hacer).
 *
 * Un string sin zona horaria se interpreta como UTC (así los guarda SQLite).
 */
function toMillis(value) {
  if (value == null) return null;

  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }

  const iso = String(value).trim().replace(' ', 'T');
  // Solo se busca zona DESPUÉS de la hora: si no, el "-29" de '2026-09-29' pasaría por un offset.
  const hasZone = /T.*(Z|[+-]\d{2}(:?\d{2})?)$/i.test(iso);
  const isDateOnly = !iso.includes('T');   // 'YYYY-MM-DD' ya se interpreta como UTC
  const t = new Date(hasZone || isDateOnly ? iso : `${iso}Z`).getTime();
  return Number.isNaN(t) ? null : t;
}

module.exports = { toMillis };
