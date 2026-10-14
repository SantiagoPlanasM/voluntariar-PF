// src/lib/inputs.js
//
// Validación de textos libres del body (perfiles, empleados). Antes cada ruta hacía `if (name && name.trim()...)`:
// un valor que no era string reventaba en `.trim()` (500), `name: ""` se salteaba la validación y quedaba vacío,
// y no había largo máximo (REVISION B12, B13). Un solo helper para no repetir la regla en cada router (AI_RULES 3).

/**
 * Devuelve un mensaje de error (en español) o null si el valor es aceptable.
 * - `undefined` = el campo no vino: válido salvo `required` (en una actualización parcial, "no tocar").
 * - `null` = borrar el valor: válido salvo que el campo sea obligatorio (`required` o `nullable: false`).
 * - Si viene, tiene que ser un string con al menos `min` caracteres sin contar espacios y a lo sumo `max`.
 */
function checkText(value, { label, max, min = 0, required = false, nullable = !required }) {
  if (value === undefined) return required ? `${label} es obligatorio` : null;
  if (value === null) return nullable ? null : `${label} es obligatorio`;
  if (typeof value !== 'string') return `${label} tiene que ser un texto`;
  const len = value.trim().length;
  if (required || !nullable || min > 0) {
    if (len === 0) return `${label} no puede estar vacío`;
    if (len < min) return `${label} tiene que tener al menos ${min} caracteres`;
  }
  if (value.length > max) return `${label} puede tener hasta ${max} caracteres`;
  return null;
}

/** El primer error de una lista de chequeos, o null. */
const firstError = (...errors) => errors.find(Boolean) || null;

module.exports = { checkText, firstError };
