// src/lib/accounts.js — alta de una cuenta (usuario + perfil de su rol). La comparten el registro con contraseña
// (POST /api/auth/register) y el de Google (POST /api/auth/google/register, §314), para no copiarla (AI_RULES regla 3).

const { randomUUID } = require('node:crypto');
const db = require('../db');
const { checkText } = require('./inputs');
const { validateName } = require('./authCommon');

const ROLES = ['volunteer', 'ngo', 'company'];

/** Nombre, apellido (opcional) y rol del registro. Devuelve el primer error, o null. */
function validateSignup({ name, apellido, role }) {
  const nameErr = validateName(name);
  if (nameErr) return nameErr;
  // Opcional (si falta o viene vacío se toma del nombre completo). Antes no se validaba y un apellido que no
  // era texto reventaba en `.trim()` dentro de la transacción: 500 (REVISION A4). 50, como el nombre.
  const apellidoErr = checkText(apellido, { label: 'El apellido', max: 50 });
  if (apellidoErr) return apellidoErr;
  // Si viene con algo, la misma regla que el nombre (validateName/NAME_RE); antes aceptaba dígitos (§138).
  if (apellido?.trim() && validateName(apellido)) return 'El apellido solo puede tener letras y espacios, mínimo 2 caracteres';
  if (!ROLES.includes(role)) return 'Rol inválido';
  return null;
}

/**
 * Crea el usuario y el perfil de su rol, juntos o ninguno (REVISION B17: antes, si fallaba el perfil quedaba un
 * usuario sin perfil y ese email ya no se podía volver a registrar). El id se genera acá (regla 23). Un email o un
 * google_sub repetidos LANZAN el error de UNIQUE: el que llama responde 409 (isUniqueViolation).
 * Devuelve { id, name, email, role, avatar }.
 */
async function createAccount({ name, email, passwordHash, role, apellido, googleSub = null }) {
  const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`;
  const user = { id: randomUUID(), name: name.trim(), email, role, avatar };
  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO users (id, name, email, password, role, avatar, google_sub) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [user.id, user.name, user.email, passwordHash, role, avatar, googleSub]
    );

    // Crear perfil extendido según rol
    if (role === 'ngo') {
      await tx.run(
        `INSERT INTO ngos (user_id, nombre, foto_perfil) VALUES ($1,$2,$3)`,
        [user.id, user.name, avatar]
      );
    }
    if (role === 'company') {
      await tx.run(
        `INSERT INTO empresas (user_id, nombre, foto_perfil) VALUES ($1,$2,$3)`,
        [user.id, user.name, avatar]
      );
    }
    if (role === 'volunteer') {
      // Separar nombre en nombre + apellido si viene junto
      const parts = user.name.split(' ');
      const firstName = parts[0];
      const lastName  = apellido?.trim() || parts.slice(1).join(' ') || '';
      await tx.run(
        `INSERT INTO voluntarios (user_id, nombre, apellido, foto_perfil) VALUES ($1,$2,$3,$4)`,
        [user.id, firstName, lastName, avatar]
      );
    }
  });
  return user;
}

module.exports = { ROLES, validateSignup, createAccount };
