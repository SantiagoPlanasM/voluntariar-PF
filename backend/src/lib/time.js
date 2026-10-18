// src/lib/time.js
//
// Los timestamps llegan distinto según el motor de base de datos:
//   - SQLite:   string 'YYYY-MM-DD HH:MM:SS' (UTC, SIN zona horaria)
//   - Postgres: objeto Date (las columnas son TIMESTAMPTZ)
// Tratarlos como string (`.replace`, `.localeCompare`, `.includes`...) anda en
// SQLite y devuelve 500 en Postgres. Todo cálculo con fechas sobre valores que
// vienen de la base de datos debe pasar por toMillis().

// Solo se busca zona DESPUÉS de la hora: si no, el "-29" de '2026-09-29' pasaría por un offset.
// Antes era /T.*(Z|[+-]\d{2}(:?\d{2})?)$/i, cuadrático por el `.*` (SonarCloud S8786, §231). Acepta lo mismo: la
// zona no tiene ninguna T, así que alcanza con que haya una T en la misma línea (el `.` no cruzaba saltos de línea).
const ZONE_AT_END = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;
function hasZone(iso) {
  const lastLine = iso.split(/[\n\r\u2028\u2029]/).pop();
  return /t/i.test(lastLine) && ZONE_AT_END.test(lastLine);
}

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
  const isDateOnly = !iso.includes('T');   // 'YYYY-MM-DD' ya se interpreta como UTC
  const t = new Date(hasZone(iso) || isDateOnly ? iso : `${iso}Z`).getTime();
  return Number.isNaN(t) ? null : t;
}

module.exports = { toMillis, hasZone };
