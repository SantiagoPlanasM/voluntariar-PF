// src/db/sqlTranslate.js
//
// Funciones puras de traducción SQL Postgres → SQLite, separadas de
// db/index.js para poder testearlas sin necesidad de abrir una conexión de
// base de datos real (index.js abre la conexión apenas se lo requiere, lo
// que lo hace incómodo de importar en un test unitario aislado).

// Detecta si la query devuelve filas (SELECT/WITH) o es DDL/DML
function isReadQuery(sql) {
  const s = sql.trimStart().toUpperCase();
  return s.startsWith('SELECT') || s.startsWith('WITH');
}

// Traduce sintaxis PostgreSQL → SQLite (todo excepto los placeholders $N,
// que se manejan aparte en remapParams porque también necesitan reordenar
// el array de parámetros).
function translatePg(sql) {
  return sql
    // Timestamps
    .replace(/CURRENT_TIMESTAMP/gi, "datetime('now')")
    // Funciones de string case-insensitive
    .replace(/\bILIKE\b/gi, 'LIKE')
    // Conflict handling
    .replace(/\bON CONFLICT\s+DO NOTHING\b/gi, 'OR IGNORE')
    .replace(/\bON CONFLICT\s*\([^)]+\)\s*DO NOTHING\b/gi, 'OR IGNORE');
}

// Reemplaza cada $N por ? (placeholder posicional de SQLite) y devuelve un
// array de parámetros alineado a cada aparición. Esto es necesario porque
// en Postgres es válido reusar el mismo $N más de una vez en una query
// (p. ej. `WHERE (a=$1 AND b=$2) OR (a=$2 AND b=$1)`), pero el binding
// posicional de better-sqlite3/SQLite exige un valor por cada `?`, no por
// cada número de parámetro único. Sin este remapeo, una query que reusa un
// $N queda con menos valores bindeados que `?` tiene, y termina
// devolviendo cero filas en silencio (sin lanzar error) en vez del
// resultado esperado. (Bug real que hubo en este proyecto — ver
// docs/PROJECT_ANALYSIS.md §18, bug B9. Estos tests existen para que no
// vuelva a pasar sin que un test rojo lo avise.)
function remapParams(sql, params) {
  const order = [];
  const translated = sql.replace(/\$(\d+)/g, (_, n) => { order.push(Number(n) - 1); return '?'; });
  return { translated, remapped: order.map(i => params[i]) };
}

module.exports = { isReadQuery, translatePg, remapParams };
