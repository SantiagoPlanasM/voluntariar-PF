// src/lib/dbErrors.js
//
// ¿El error es una violación de UNIQUE / PRIMARY KEY? Pasa cuando dos pedidos simultáneos pasan el mismo
// chequeo previo ("¿ya existe?") y los dos intentan insertar: la base deja entrar a uno y rechaza al otro.
// Ese rechazo es un 409 para el cliente, no un 500.
//   - Postgres: código SQLSTATE 23505 (unique_violation).
//   - SQLite (better-sqlite3): código SQLITE_CONSTRAINT_UNIQUE / _PRIMARYKEY; por las dudas también el mensaje.
function isUniqueViolation(err) {
  if (!err) return false;
  if (err.code === '23505') return true;
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return true;
  return typeof err.message === 'string' && err.message.includes('UNIQUE constraint failed');
}

module.exports = { isUniqueViolation };
