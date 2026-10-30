// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const { checkText, firstError } = require('../lib/inputs');
const { isUniqueViolation } = require('../lib/dbErrors');
const { createLimiter } = require('../lib/rateLimit');
const { parsePhoto } = require('../lib/photoUpload');   // la foto en multipart, compartida con la del voluntariado (§282)
const storage = require('../lib/storage');   // por propiedad (storage.uploadImage), para poder reemplazarlo en tests
const email = require('../lib/email');       // por propiedad (email.sendEmail), ídem
const { accountDeletionEmail, passwordResetEmail, passwordChangedEmail } = require('../lib/emailTemplates');
const { forLog } = require('../lib/logSafe');   // S5145 (§202)

const router = express.Router();

// ── Límite de intentos (aprobado por el usuario, PROJECT_ANALYSIS.md §103) ───────────────────────────────
// Login: solo cuentan los FALLIDOS. Por email+IP (no por email solo: cualquiera podría bloquearle la cuenta a otra
// persona) y, aparte, por IP (muchos emails desde el mismo lugar). Un login correcto limpia el de email+IP.
// Registro: por IP. Pasado el límite: 429 sin tocar la base ni bcrypt. En memoria y por proceso (lib/rateLimit).
const LOGIN_FAILS_PER_ACCOUNT = createLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
const LOGIN_FAILS_PER_IP      = createLimiter({ max: 50, windowMs: 15 * 60 * 1000 });
const REGISTERS_PER_IP        = createLimiter({ max: 20, windowMs: 60 * 60 * 1000 });
const tooMany = (res, seconds) => {
  res.set('Retry-After', String(seconds));
  return res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' });
};

// Hash de una contraseña cualquiera, para comparar contra algo cuando el email no existe (ver /login).
const DUMMY_HASH = bcrypt.hashSync('cuenta-inexistente', 10);

// ── Validaciones ──────────────────────────────────────────────────────────
// Dominio con un punto que no sea el primer carácter y con 2 o más caracteres después. Antes,
// [^\s@]+\.[^\s@]{2,}: el punto entraba en las dos clases y el backtracking era cuadrático (SonarCloud S8786,
// §201 y §231). Ahora se busca el primer punto después del primer carácter: acepta lo mismo.
const EMAIL_RE = /^[^\s@]+@[^\s@][^\s@.]*\.[^\s@]{2,}$/;
const NAME_RE  = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]{2,50}$/;

// `typeof v !== 'string'` primero: antes un número o un array reventaba en `.trim()` y daba 500 (REVISION B13).
// Largo máximo ANTES del regex: con el EMAIL_RE viejo, un email de 80 mil caracteres bloqueaba la API 3,4 s por
// pedido (§201). El regex ya es lineal (§231); el tope queda porque 254 es el máximo de RFC 5321.
const EMAIL_MAX = 254;
function validateEmail(v) {
  if (typeof v !== 'string') return 'Email inválido';
  const email = v.trim();
  if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) return 'Email inválido';
  return null;
}
function validateName(v)     { if (typeof v !== 'string' || !NAME_RE.test(v.trim()))  return 'Solo letras y espacios, mínimo 2 caracteres'; return null; }
// bcryptjs usa solo los primeros 72 bytes: dos contraseñas iguales en esos bytes valdrían como la misma. Se
// cuentan bytes UTF-8, no caracteres (la ñ ocupa 2, un emoji 4). Solo se aplica al FIJARLA: el login no la
// llama, así que una cuenta vieja con una contraseña más larga sigue entrando. Mismo límite en AuthModal.tsx.
const PASSWORD_MAX_BYTES = 72;
function validatePassword(v) {
  if (typeof v !== 'string' || v.length < 8) return 'Mínimo 8 caracteres';
  if (Buffer.byteLength(v, 'utf8') > PASSWORD_MAX_BYTES)
    return 'Máximo 72 caracteres (los acentos, la ñ y los emojis cuentan como más de uno)';
  if (!/[A-Z]/.test(v))       return 'Necesita al menos una mayúscula';
  if (!/[0-9]/.test(v))       return 'Necesita al menos un número';
  return null;
}

// ── POST /api/auth/register ────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const wait = REGISTERS_PER_IP.blocked(req.ip);
    if (wait) return tooMany(res, wait);
    REGISTERS_PER_IP.hit(req.ip);

    const { name, email, password, role = 'volunteer', apellido } = req.body;

    const nameErr  = validateName(name);
    const emailErr = validateEmail(email);
    const passErr  = validatePassword(password);
    if (nameErr)  return res.status(400).json({ error: nameErr });
    if (emailErr) return res.status(400).json({ error: emailErr });
    if (passErr)  return res.status(400).json({ error: passErr });
    // Opcional (si falta o viene vacío se toma del nombre completo). Antes no se validaba y un apellido que no
    // era texto reventaba en `.trim()` dentro de la transacción: 500 (REVISION A4). 50, como el nombre.
    const apellidoErr = checkText(apellido, { label: 'El apellido', max: 50 });
    if (apellidoErr) return res.status(400).json({ error: apellidoErr });
    // Si viene con algo, la misma regla que el nombre (validateName/NAME_RE); antes aceptaba dígitos (§138).
    if (apellido?.trim() && validateName(apellido))
      return res.status(400).json({ error: 'El apellido solo puede tener letras y espacios, mínimo 2 caracteres' });

    if (!['volunteer', 'ngo', 'company'].includes(role))
      return res.status(400).json({ error: 'Rol inválido' });

    const normEmail = email.trim().toLowerCase();
    const existing = await db.get('SELECT id FROM users WHERE email=$1', [normEmail]);
    if (existing) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });

    const hashed = await bcrypt.hash(password, 10);
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`;
    const user = { id: randomUUID(), name: name.trim(), email: normEmail, role, avatar };

    // Usuario y perfil, juntos o ninguno (REVISION B17): antes, si fallaba el perfil quedaba un usuario sin
    // perfil y ese email ya no se podía volver a registrar. El id se genera acá (regla 23).
    try {
      await db.transaction(async (tx) => {
        await tx.run(
          `INSERT INTO users (id, name, email, password, role, avatar) VALUES ($1,$2,$3,$4,$5,$6)`,
          [user.id, user.name, user.email, hashed, role, avatar]
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
    } catch (err) {
      // Dos registros simultáneos con el mismo email pasan los dos el SELECT de arriba: el UNIQUE deja entrar
      // a uno y el otro es un 409, no un 500.
      if (isUniqueViolation(err)) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });
      throw err;
    }

    const token = signToken(user);
    res.status(201).json({
      message: 'Cuenta creada',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar }
    });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── POST /api/auth/login ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password)
      return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const emailErr = validateEmail(email);
    if (emailErr) return res.status(400).json({ error: emailErr });

    // Los errores de validación (arriba) no cuentan como intento; acá ya es un intento de verdad.
    const accountKey = `${email.trim().toLowerCase()}|${req.ip}`;
    const wait = Math.max(LOGIN_FAILS_PER_ACCOUNT.blocked(accountKey), LOGIN_FAILS_PER_IP.blocked(req.ip));
    if (wait) return tooMany(res, wait);

    const user = await db.get(
      'SELECT id, name, email, password, role, avatar, bio, location FROM users WHERE email=$1',
      [email.trim().toLowerCase()]
    );
    // Mismo mensaje y mismo trabajo exista o no la cuenta (REVISION B20, decisión del usuario): antes decía
    // 'No encontramos una cuenta…' o 'Contraseña incorrecta', y un email inexistente ni calculaba el hash, así
    // que el texto y el tiempo de respuesta permitían averiguar qué emails tienen cuenta.
    const valid = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
    if (!user || !valid) {
      LOGIN_FAILS_PER_ACCOUNT.hit(accountKey);
      LOGIN_FAILS_PER_IP.hit(req.ip);
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }
    LOGIN_FAILS_PER_ACCOUNT.reset(accountKey);

    const token = signToken(user);
    res.json({
      message: 'Sesión iniciada',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar }
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.get(
      'SELECT id, name, email, role, avatar, bio, location, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Perfil extendido según rol. Lista blanca (regla 8, §153): antes `SELECT *`, y una columna nueva de
    // estas tablas (un token, datos de facturación) salía sola. Son las mismas columnas que devolvía el
    // `SELECT *`, con sus nombres en español: la forma no cambió. Una columna nueva se agrega acá a propósito.
    let profile = null;
    if (user.role === 'volunteer') {
      profile = await db.get(
        `SELECT id, user_id, nombre, apellido, descripcion, ubicacion, foto_perfil, banner, cv_url, followers,
                created_at, updated_at
         FROM voluntarios WHERE user_id=$1`, [user.id]);
      // cv_url es el public_id de un PDF privado de Cloudinary: no se expone (regla 24); solo si hay CV (§165).
      if (profile) {
        const { cv_url: cvId, ...rest } = profile;
        profile = { ...rest, has_cv: Boolean(cvId) };
      }
    } else if (user.role === 'ngo') {
      profile = await db.get(
        `SELECT id, user_id, nombre, descripcion, foto_perfil, banner, mision, alias, ubicacion, founded, followers,
                created_at, updated_at
         FROM ngos WHERE user_id=$1`, [user.id]);
    } else if (user.role === 'company') {
      profile = await db.get(
        `SELECT id, user_id, nombre, descripcion, mision, ubicacion, foto_perfil, banner, industria, followers,
                created_at, updated_at
         FROM empresas WHERE user_id=$1`, [user.id]);
    }

    // Sin fila de perfil, db.get da undefined y la clave desaparecía del JSON: `null`, como dice la doc (§158).
    res.json({ user, profile: profile ?? null });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── PUT /api/auth/me ───────────────────────────────────────────────────────
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { name, bio, location, avatar } = req.body;
    // `name !== undefined` (y no `if (name)`): antes "" se salteaba la validación y dejaba el nombre vacío (B12).
    if (name !== undefined) {
      const nameErr = validateName(name);
      if (nameErr) return res.status(400).json({ error: nameErr });
    }
    const textErr = firstError(
      checkText(bio, { label: 'La bio', max: 500 }),
      checkText(location, { label: 'La ubicación', max: 150 }),
      checkText(avatar, { label: 'La foto', max: 1000 }),
    );
    if (textErr) return res.status(400).json({ error: textErr });

    const current = await db.get(
      'SELECT name, bio, location, avatar FROM users WHERE id=$1',
      [req.user.id]
    );
    if (!current) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Actualización parcial real: un campo no enviado (undefined) conserva
    // su valor anterior en vez de pisarlo con null. better-sqlite3 (y
    // Postgres) además rechazan bindear undefined directamente, así que de
    // paso evita ese error.
    await db.run(
      `UPDATE users SET name=$1, bio=$2, location=$3, avatar=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$5`,
      [
        name !== undefined ? name.trim() : current.name,
        bio !== undefined ? bio : current.bio,
        location !== undefined ? location : current.location,
        avatar !== undefined ? avatar : current.avatar,
        req.user.id,
      ]
    );
    const updated = await db.get(
      'SELECT id, name, email, role, avatar, bio, location FROM users WHERE id=$1',
      [req.user.id]
    );
    res.json({ user: updated });
  } catch (err) {
    console.error('PUT /auth/me error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── PUT /api/auth/me/password ──────────────────────────────────────────────
// Cambiar la contraseña (§272): la actual tiene que ser la correcta y la nueva cumple las reglas del registro. Una
// actual equivocada da 400, no 401: el frontend cierra la sesión ante un 401. Límite de intentos fallidos por usuario,
// para que no se pueda adivinar la actual con una sesión robada. Límite conocido: los JWT ya emitidos (otros
// dispositivos) siguen valiendo hasta que vencen; no hay revocación de sesiones.
const PASSWORD_FAILS_PER_USER = createLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

// Aviso por email de que la contraseña cambió (§278): lo usan PUT /me/password y POST /reset-password, DESPUÉS de
// responder. Un email que falla (o que tira) no cambia el resultado: queda en el log. Nunca lleva la contraseña.
function notifyPasswordChanged(user) {
  const { subject, html } = passwordChangedEmail({ name: user.name, appUrl: appUrl() });
  Promise.resolve()
    .then(() => email.sendEmail({ to: user.email, subject, html }))
    .then((result) => { if (!result?.ok) console.error('Aviso de contraseña cambiada no enviado', forLog(result?.error || '')); })
    .catch((err) => console.error('Aviso de contraseña cambiada no enviado:', forLog(err?.message || '')));
}

router.put('/me/password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (typeof current_password !== 'string' || typeof new_password !== 'string' || !current_password)
      return res.status(400).json({ error: 'Contraseña actual y nueva requeridas' });
    const wait = PASSWORD_FAILS_PER_USER.blocked(req.user.id);
    if (wait) return tooMany(res, wait);

    const user = await db.get('SELECT password, name, email FROM users WHERE id=$1', [req.user.id]);
    if (!user || !(await bcrypt.compare(current_password, user.password))) {
      PASSWORD_FAILS_PER_USER.hit(req.user.id);
      return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    }
    const passErr = validatePassword(new_password);
    if (passErr) return res.status(400).json({ error: passErr });
    if (new_password === current_password)
      return res.status(400).json({ error: 'La nueva contraseña tiene que ser distinta de la actual' });

    await db.run('UPDATE users SET password=$1 WHERE id=$2', [await bcrypt.hash(new_password, 10), req.user.id]);
    PASSWORD_FAILS_PER_USER.reset(req.user.id);
    res.json({ message: 'Contraseña actualizada' });
    notifyPasswordChanged(user);
  } catch (err) {
    console.error('PUT /auth/me/password error:', err);
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
});

// ── PUT /api/auth/me/photo ─────────────────────────────────────────────────
// Foto de perfil subida como archivo (multipart, campo `photo`), a Cloudinary (lib/storage.js). Un solo endpoint
// para los tres roles: la foto va siempre a users.avatar (la que muestran chat, Momentos, comentarios y reseñas) y,
// si es ONG o empresa, también a ngos/empresas.foto_perfil (el logo de su perfil). voluntarios.foto_perfil no se
// toca: users.avatar es la única foto del voluntario (PLAN_FALTANTE.md, decisión F2).
// Orden de la regla 24 de AI_RULES: sesión → límite → validar todo (cabecera real incluida) → subir fuera de la
// transacción → guardar en una transacción → si falla, borrar lo subido.
// Como Momentos (el frontend comprime antes de subir). La lectura del multipart es lib/photoUpload (§282).
const PHOTO_CHANGES_PER_USER = createLimiter({ max: 10, windowMs: 60 * 60 * 1000 });   // cada subida gasta cuota
const PROFILE_TABLE = { ngo: 'ngos', company: 'empresas' };   // tablas fijas, nunca texto del cliente

router.put('/me/photo', requireAuth, (req, res, next) => {
  const wait = PHOTO_CHANGES_PER_USER.blocked(req.user.id);
  if (wait) {
    res.set('Retry-After', String(wait));
    return res.status(429).json({ error: 'Cambiaste la foto muchas veces seguidas. Esperá un rato e intentá de nuevo.' });
  }
  if (!storage.isConfigured()) {
    return res.status(503).json({ error: 'La subida de fotos no está disponible por el momento' });
  }
  next();
}, parsePhoto, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Elegí una foto' });
    if (!storage.detectImageType(req.file.buffer)) {
      return res.status(400).json({ error: 'El archivo no es una imagen válida (JPEG, PNG o WebP)' });
    }
    const table = PROFILE_TABLE[req.user.role];
    const exists = await db.get('SELECT id FROM users WHERE id=$1', [req.user.id]);
    const profile = table ? await db.get(`SELECT id FROM ${table} WHERE user_id=$1`, [req.user.id]) : true;
    if (!exists || !profile) return res.status(404).json({ error: 'Perfil no encontrado' });

    PHOTO_CHANGES_PER_USER.hit(req.user.id);
    let uploaded;
    try {
      uploaded = await storage.uploadImage(req.file.buffer);
    } catch (err) {
      console.error('PUT /auth/me/photo: falló la subida a Cloudinary:', forLog(err.message));
      return res.status(502).json({ error: 'No pudimos subir la foto. Probá de nuevo en un momento.' });
    }

    const url = storage.thumbUrl(uploaded.url);   // cuadrada, 480 px: alcanza para avatares y logos
    try {
      await db.transaction(async (tx) => {
        await tx.run('UPDATE users SET avatar=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [url, req.user.id]);
        if (table) {
          await tx.run(`UPDATE ${table} SET foto_perfil=$1, updated_at=CURRENT_TIMESTAMP WHERE user_id=$2`, [url, req.user.id]);
        }
      });
    } catch (err) {
      console.error('PUT /auth/me/photo: no se pudo guardar:', err);
      await storage.deleteImage(uploaded.publicId).catch((e) => console.error('PUT /auth/me/photo: no se pudo borrar lo subido:', e.message));
      return res.status(500).json({ error: 'Error al guardar la foto' });
    }

    const user = await db.get('SELECT id, name, email, role, avatar, bio, location FROM users WHERE id=$1', [req.user.id]);
    res.json({ user });
  } catch (err) {
    console.error('PUT /auth/me/photo error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── Borrar la propia cuenta, con confirmación por email (PROJECT_ANALYSIS.md §177) ───────────────────────────
// 1) POST /me/delete-request (con sesión): genera un código de 256 bits, guarda SOLO su hash (sha256) con vencimiento
//    en 1 hora (ISO calculado en JS: no depende del motor ni de la zona) y lo manda por email como link a
//    APP_URL/cuenta/borrar?token=…. Un pedido nuevo invalida el anterior. Sin email no hay link: si Resend no está
//    configurado (503) o falla (502), no queda nada guardado.
// 2) POST /delete-account { token } (sin sesión: el link puede abrirse en otro dispositivo): si el código existe y no
//    venció, en UNA transacción corrige los contadores que la cascada no toca (seguidores de ONG, proyectos y
//    voluntarios; cupos de sus inscripciones aprobadas) y borra el usuario: el resto cae por ON DELETE CASCADE (perfil,
//    inscripciones, mensajes, notificaciones, Momentos, follows y, si es ONG, sus proyectos). Después del COMMIT se
//    borran, en lo posible, el CV y las fotos de Momentos en Cloudinary.
const DELETION_TTL_MS = 60 * 60 * 1000;
const DELETION_REQUESTS_PER_USER = createLimiter({ max: 3, windowMs: 60 * 60 * 1000 });
const INVALID_LINK = 'El link no es válido o ya se usó. Pedí uno nuevo desde tu perfil.';
const sha256 = (t) => createHash('sha256').update(t).digest('hex');
const appUrl = () => process.env.APP_URL || 'http://localhost:5173';

router.post('/me/delete-request', requireAuth, async (req, res) => {
  try {
    const wait = DELETION_REQUESTS_PER_USER.blocked(req.user.id);
    if (wait) {
      res.set('Retry-After', String(wait));
      return res.status(429).json({ error: 'Pediste borrar la cuenta muchas veces seguidas. Esperá un rato.' });
    }
    const user = await db.get('SELECT id, name, email FROM users WHERE id=$1', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    DELETION_REQUESTS_PER_USER.hit(req.user.id);

    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);
    await db.transaction(async (tx) => {
      await tx.run('DELETE FROM account_deletion_tokens WHERE user_id=$1', [user.id]);   // un pedido nuevo invalida el anterior
      await tx.run('INSERT INTO account_deletion_tokens (token_hash, user_id, expires_at) VALUES ($1,$2,$3)',
        [tokenHash, user.id, new Date(Date.now() + DELETION_TTL_MS).toISOString()]);
    });

    // El email va DESPUÉS del COMMIT (regla 21). Si no sale, el link no sirve: se descarta.
    const { subject, html } = accountDeletionEmail({ name: user.name, link: `${appUrl()}/cuenta/borrar?token=${token}` });
    const result = await email.sendEmail({ to: user.email, subject, html });
    if (!result?.ok) {
      await db.run('DELETE FROM account_deletion_tokens WHERE token_hash=$1', [tokenHash]);
      if (result?.skipped) {
        return res.status(503).json({ error: 'No podemos mandar emails por el momento, así que no se puede confirmar el borrado.' });
      }
      return res.status(502).json({ error: 'No pudimos mandar el email. Probá de nuevo en un rato.' });
    }
    res.json({ sent: true });
  } catch (err) {
    console.error('POST /auth/me/delete-request error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/delete-account', async (req, res) => {
  try {
    const token = req.body?.token;
    // base64url de 32 bytes = 43 caracteres. Cualquier otra cosa ni se busca.
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return res.status(400).json({ error: INVALID_LINK });
    const tokenHash = sha256(token);
    const row = await db.get('SELECT user_id, expires_at FROM account_deletion_tokens WHERE token_hash=$1', [tokenHash]);
    if (!row) return res.status(400).json({ error: INVALID_LINK });
    if (!(Date.parse(row.expires_at) > Date.now())) {
      await db.run('DELETE FROM account_deletion_tokens WHERE token_hash=$1', [tokenHash]);
      return res.status(400).json({ error: 'El link venció. Pedí uno nuevo desde tu perfil.' });
    }
    const userId = row.user_id;

    // Archivos a limpiar en Cloudinary DESPUÉS del COMMIT (la cascada borra las filas que los referencian).
    const cv = await db.get('SELECT cv_url FROM voluntarios WHERE user_id=$1', [userId]);
    const media = await db.all(
      `SELECT pm.provider_id FROM post_media pm
       JOIN posts po ON po.id = pm.post_id
       LEFT JOIN projects pr ON pr.id = po.project_id
       LEFT JOIN ngos n ON n.id = pr.ngo_id
       WHERE po.user_id = $1 OR n.user_id = $1`, [userId]);
    // §289: y la foto propia de cada voluntariado de la ONG (§282), que también se va en cascada.
    const projectPhotos = await db.all(
      `SELECT pr.foto_provider_id AS provider_id FROM projects pr JOIN ngos n ON n.id = pr.ngo_id
       WHERE n.user_id = $1 AND pr.foto_provider_id IS NOT NULL`, [userId]);

    let deleted = false;
    await db.transaction(async (tx) => {
      // Contadores que la cascada no corrige (los CHECK >= 0 se respetan: nunca baja de 0).
      await tx.run(`UPDATE ngos SET followers = followers - 1
                    WHERE followers > 0 AND id IN (SELECT ngo_id FROM ngo_follows WHERE user_id = $1)`, [userId]);
      await tx.run(`UPDATE projects SET followers = followers - 1
                    WHERE followers > 0 AND id IN (SELECT project_id FROM project_follows WHERE user_id = $1)`, [userId]);
      await tx.run(`UPDATE voluntarios SET followers = followers - 1
                    WHERE followers > 0 AND user_id IN (SELECT following_id FROM volunteer_follows WHERE follower_id = $1)`, [userId]);
      await tx.run(`UPDATE projects SET cupos_ocupados = cupos_ocupados - 1
                    WHERE cupos_ocupados > 0 AND id IN (SELECT project_id FROM enrollments WHERE user_id = $1 AND status = 'approved')`, [userId]);
      const del = await tx.run('DELETE FROM users WHERE id=$1', [userId]);
      deleted = del.changes === 1;
    });
    if (!deleted) return res.status(400).json({ error: INVALID_LINK });

    if (storage.isConfigured()) {
      const jobs = [];
      if (cv?.cv_url) jobs.push(storage.deletePdf(cv.cv_url));
      for (const m of [...media, ...projectPhotos]) if (m.provider_id) jobs.push(storage.deleteImage(m.provider_id));
      const results = await Promise.allSettled(jobs);
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed) console.error(`POST /auth/delete-account: no se pudieron borrar ${failed} archivo(s) de Cloudinary`);
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error('POST /auth/delete-account error:', err);
    res.status(500).json({ error: 'No pudimos borrar la cuenta. Probá de nuevo.' });
  }
});

// ── "¿Olvidaste tu contraseña?" (PROJECT_ANALYSIS.md §275) ───────────────────────────────────────────────────
// 1) POST /forgot-password { email } (sin sesión): NO revela si el email tiene cuenta. La respuesta es siempre
//    { sent: true }, y el código y el email se hacen DESPUÉS de responder (así tampoco se nota por el tiempo ni por un
//    envío que falla). El único error que no depende del email es 503 sin Resend, igual para todos. Límites: 3 por email
//    por hora (cuenta exista o no la cuenta: si no, el 429 diría cuáles existen) y 20 por IP por hora.
// 2) POST /reset-password { token, new_password } (sin sesión): las reglas del registro se validan ANTES de gastar el
//    código; el código se consume con compare-and-swap (DELETE … y mirar `changes`) en la misma transacción que fija la
//    contraseña, así dos pedidos a la vez con el mismo link la cambian una sola vez. No inicia sesión.
// Límite conocido (como en PUT /me/password): los JWT ya emitidos siguen valiendo hasta que vencen.
const RESET_TTL_MS = 60 * 60 * 1000;
const RESETS_PER_EMAIL = createLimiter({ max: 3, windowMs: 60 * 60 * 1000 });
const RESETS_PER_IP    = createLimiter({ max: 20, windowMs: 60 * 60 * 1000 });
const INVALID_RESET_LINK = 'El link no es válido o ya se usó. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".';

async function sendResetLink(normEmail) {
  const user = await db.get('SELECT id, name, email FROM users WHERE email=$1', [normEmail]);
  if (!user) return;
  const token = randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM password_reset_tokens WHERE user_id=$1', [user.id]);   // un pedido nuevo invalida el anterior
    await tx.run('INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1,$2,$3)',
      [tokenHash, user.id, new Date(Date.now() + RESET_TTL_MS).toISOString()]);
  });
  // El email va DESPUÉS del COMMIT (regla 21). Si no sale, el link no sirve: se descarta.
  const { subject, html } = passwordResetEmail({ name: user.name, link: `${appUrl()}/restablecer?token=${token}` });
  const result = await email.sendEmail({ to: user.email, subject, html });
  if (!result?.ok) {
    await db.run('DELETE FROM password_reset_tokens WHERE token_hash=$1', [tokenHash]);
    console.error('POST /auth/forgot-password: no se pudo mandar el email', forLog(result?.error || ''));
  }
}

router.post('/forgot-password', async (req, res) => {
  try {
    const raw = req.body?.email;
    if (validateEmail(raw)) return res.status(400).json({ error: 'Email inválido' });
    if (!email.isConfigured()) {
      return res.status(503).json({ error: 'No podemos mandar emails por el momento, así que no se puede recuperar la contraseña.' });
    }
    const normEmail = raw.trim().toLowerCase();
    const waitIp = RESETS_PER_IP.blocked(req.ip);
    if (waitIp) return tooMany(res, waitIp);
    const waitEmail = RESETS_PER_EMAIL.blocked(normEmail);
    if (waitEmail) {
      res.set('Retry-After', String(waitEmail));
      return res.status(429).json({ error: 'Pediste recuperar la contraseña muchas veces seguidas. Esperá un rato.' });
    }
    RESETS_PER_IP.hit(req.ip);
    RESETS_PER_EMAIL.hit(normEmail);

    res.json({ sent: true });
    sendResetLink(normEmail).catch((err) => console.error('POST /auth/forgot-password error:', err));
  } catch (err) {
    console.error('POST /auth/forgot-password error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body || {};
    // base64url de 32 bytes = 43 caracteres. Cualquier otra cosa ni se busca.
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return res.status(400).json({ error: INVALID_RESET_LINK });
    const passErr = validatePassword(new_password);
    if (passErr) return res.status(400).json({ error: passErr });

    const tokenHash = sha256(token);
    const row = await db.get('SELECT user_id, expires_at FROM password_reset_tokens WHERE token_hash=$1', [tokenHash]);
    if (!row) return res.status(400).json({ error: INVALID_RESET_LINK });
    if (!(Date.parse(row.expires_at) > Date.now())) {
      await db.run('DELETE FROM password_reset_tokens WHERE token_hash=$1', [tokenHash]);
      return res.status(400).json({ error: 'El link venció. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".' });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    let used = false;
    await db.transaction(async (tx) => {
      const del = await tx.run('DELETE FROM password_reset_tokens WHERE token_hash=$1', [tokenHash]);
      if (del.changes !== 1) return;   // otro pedido con el mismo link llegó primero
      await tx.run('UPDATE users SET password=$1 WHERE id=$2', [hashed, row.user_id]);
      await tx.run('DELETE FROM password_reset_tokens WHERE user_id=$1', [row.user_id]);
      used = true;
    });
    if (!used) return res.status(400).json({ error: INVALID_RESET_LINK });
    res.json({ message: 'Contraseña actualizada' });
    const owner = await db.get('SELECT name, email FROM users WHERE id=$1', [row.user_id]);
    if (owner) notifyPasswordChanged(owner);
  } catch (err) {
    console.error('POST /auth/reset-password error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'No pudimos cambiar la contraseña. Probá de nuevo.' });
  }
});

module.exports = router;
// Exportadas aparte para poder testearlas de forma aislada, sin pegarle a la
// API completa (mismo patrón que insertMessage en routes/messages.js).
module.exports.validateEmail = validateEmail;
module.exports.EMAIL_RE = EMAIL_RE;
module.exports.validateName = validateName;
module.exports.validatePassword = validatePassword;
