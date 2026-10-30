# API_CONTEXT.md — VoluntariAR REST API

> Base URL local: `http://localhost:3001/api` · Producción: `https://voluntariar-api.onrender.com/api` (definido en `frontend/.env`/`.env.example` como `VITE_API_URL`).
> Todas las respuestas son JSON. Errores: `{ "error": "mensaje en español" }` con el código HTTP correspondiente.
> Formato de fecha: ISO 8601 (`TIMESTAMPTZ`/`DATETIME`).
> "Auth" = requiere header `Authorization: Bearer <jwt>`. "Auth opcional" = el endpoint funciona sin token pero personaliza la respuesta si hay uno válido.

> **Convención de altas (`PROJECT_ANALYSIS.md §40`):** los endpoints que crean una fila y la devuelven (`POST` de proyectos, empleados, comentarios, KPIs y mensajes) generan el id con `crypto.randomUUID()` y releen **esa** fila por id. Nunca "la última por `created_at`": en SQLite `created_at` tiene resolución de 1 segundo y dos altas dentro del mismo segundo empatan.

## Índice de endpoints

| Método | Ruta | Auth | Roles | Archivo |
|---|---|---|---|---|
| GET | `/health` | No | — | `index.js` |
| GET | `/api/categorias` | No | — | `index.js` |
| GET | `/api/roles` | No | — | `index.js` |
| GET | `/api/habilidades` | No | — | `index.js` |
| GET | `/api/stats` | No | — | `index.js` |
| POST | `/api/auth/register` | No | — | `routes/auth.js` |
| POST | `/api/auth/login` | No | — | `routes/auth.js` |
| GET | `/api/auth/me` | Sí | cualquiera | `routes/auth.js` |
| PUT | `/api/auth/me` | Sí | cualquiera | `routes/auth.js` |
| PUT | `/api/auth/me/photo` | Sí | cualquiera | `routes/auth.js` |
| PUT | `/api/auth/me/password` | Sí | cualquiera | `routes/authPassword.js` (§290) |
| POST | `/api/auth/me/delete-request` | Sí | cualquiera | `routes/auth.js` |
| POST | `/api/auth/delete-account` | No (código del email) | — | `routes/auth.js` |
| POST | `/api/auth/forgot-password` | No | — | `routes/authPassword.js` (§290) |
| POST | `/api/auth/reset-password` | No (código del email) | — | `routes/authPassword.js` (§290) |
| GET | `/api/projects` | Opcional | — | `routes/projects.js` |
| GET | `/api/projects/recommended` | Sí | volunteer | `routes/projects.js` |
| GET | `/api/projects/:id` | Opcional | — | `routes/projects.js` |
| POST | `/api/projects` | Sí | ngo | `routes/projects.js` |
| PUT | `/api/projects/:id` | Sí | ngo (dueño) | `routes/projects.js` |
| PUT | `/api/projects/:id/photo` | Sí | ngo (dueño) | `routes/projectPhoto.js` |
| DELETE | `/api/projects/:id` | Sí | ngo (dueño) | `routes/projects.js` |
| POST | `/api/projects/:id/comments` | Sí | cualquiera | `routes/projects.js` |
| POST | `/api/projects/:id/ratings` | Sí | cualquiera | `routes/projects.js` |
| GET | `/api/projects/:id/kpis` | No | — | `routes/projects.js` |
| POST | `/api/projects/:id/kpis` | Sí | ngo (dueño) | `routes/projects.js` |
| PUT | `/api/projects/:id/kpis/:kpiId` | Sí | ngo (dueño) | `routes/projects.js` |
| DELETE | `/api/projects/:id/kpis/:kpiId` | Sí | ngo (dueño) | `routes/projects.js` |
| POST | `/api/enrollments` | Sí | volunteer | `routes/enrollments.js` |
| GET | `/api/enrollments/my` | Sí | cualquiera | `routes/enrollments.js` |
| GET | `/api/enrollments/project/:projectId` | Sí | ngo (dueño) o coordinador del equipo (§295) | `routes/enrollments.js` |
| PATCH | `/api/enrollments/:id` | Sí | ngo (dueño) o coordinador del equipo (§295) | `routes/enrollments.js` |
| DELETE | `/api/enrollments/:id` | Sí | dueño de la inscripción | `routes/enrollments.js` |
| PATCH | `/api/enrollments/:id/horas` | Sí | ngo (dueño) o coordinador del equipo (§295) | `routes/enrollments.js` |
| POST | `/api/enrollments/:id/entrevista` | Sí | ngo (dueño) o coordinador del equipo (§295) | `routes/enrollments.js` |
| PATCH | `/api/enrollments/:id/entrevista` | Sí | ngo (dueño del proyecto) | `routes/enrollments.js` |
| GET | `/api/ngos` | No | — | `routes/ngos.js` |
| GET | `/api/ngos/me` | Sí | ngo | `routes/ngos.js` |
| GET | `/api/ngos/:id` | No | — | `routes/ngos.js` |
| PUT | `/api/ngos/me` | Sí | ngo | `routes/ngos.js` |
| GET | `/api/ngos/:id/projects` | No | — | `routes/ngos.js` |
| GET | `/api/ngos/:id/dashboard` | Sí | ngo (dueño) | `routes/ngos.js` |
| GET | `/api/ngos/:id/empleados` | Sí | ngo (dueño) | `routes/ngos.js` |
| POST | `/api/ngos/:id/empleados` | Sí | ngo (dueño) | `routes/ngos.js` |
| GET | `/api/ngos/me/patrocinios` | Sí | ngo | `routes/ngos.js` |
| PATCH | `/api/ngos/me/patrocinios/:empresaId/:projectId` | Sí | ngo | `routes/ngos.js` |
| GET | `/api/empresas` | No | — | `routes/empresas.js` |
| GET | `/api/empresas/me` | Sí | company | `routes/empresas.js` |
| GET | `/api/empresas/:id` | No | — | `routes/empresas.js` |
| PUT | `/api/empresas/me` | Sí | company | `routes/empresas.js` |
| GET | `/api/empresas/me/dashboard` | Sí | company | `routes/empresas.js` |
| GET | `/api/empresas/me/patrocinios` | Sí | company | `routes/empresas.js` |
| POST | `/api/empresas/me/patrocinios` | Sí | company | `routes/empresas.js` |
| DELETE | `/api/empresas/me/patrocinios/:projectId` | Sí | company | `routes/empresas.js` |
| GET | `/api/follows/ngo` | Sí | volunteer | `routes/follows.js` |
| POST | `/api/follows/ngo/:ngoId` | Sí | volunteer | `routes/follows.js` |
| DELETE | `/api/follows/ngo/:ngoId` | Sí | volunteer | `routes/follows.js` |
| GET | `/api/follows/ngo/:ngoId/status` | Opcional | — | `routes/follows.js` |
| GET | `/api/follows/project` | Sí | volunteer | `routes/follows.js` |
| POST | `/api/follows/project/:projectId` | Sí | volunteer | `routes/follows.js` |
| DELETE | `/api/follows/project/:projectId` | Sí | volunteer | `routes/follows.js` |
| GET | `/api/follows/project/:projectId/status` | Opcional | — | `routes/follows.js` |
| GET | `/api/follows/volunteer/following` | Sí | volunteer | `routes/follows.js` |
| GET | `/api/follows/volunteer/followers` | Sí | volunteer | `routes/follows.js` |
| POST | `/api/follows/volunteer/:userId` | Sí | volunteer | `routes/follows.js` |
| DELETE | `/api/follows/volunteer/:userId` | Sí | volunteer | `routes/follows.js` |
| GET | `/api/follows/volunteer/:userId/status` | No | — | `routes/follows.js` |
| GET | `/api/follows/volunteer/:userId/followers` | No | — | `routes/follows.js` |
| GET | `/api/follows/volunteer/:userId/following` | No | — | `routes/follows.js` |
| GET | `/api/follows/feed` | Sí | volunteer | `routes/follows.js` |
| POST | `/api/donaciones` | Sí | volunteer, company | `routes/donaciones.js` |
| POST | `/api/donaciones/webhook` | No (firma de Mercado Pago) | — | `routes/donaciones.js` |
| GET | `/api/donaciones/:id` | Sí | quien donó | `routes/donaciones.js` |
| GET | `/api/posts/eligible-projects` | Sí | volunteer, ngo | `routes/posts.js` |
| POST | `/api/posts` | Sí | volunteer, ngo | `routes/posts.js` |
| GET | `/api/posts` | Opcional | — | `routes/posts.js` |
| GET | `/api/posts/:id` | Opcional | — | `routes/posts.js` |
| POST | `/api/posts/:id/like` | Sí | cualquiera | `routes/posts.js` |
| DELETE | `/api/posts/:id/like` | Sí | cualquiera | `routes/posts.js` |
| DELETE | `/api/posts/:id` | Sí | autor o ONG dueña del proyecto | `routes/posts.js` |
| GET | `/api/faqs` | Opcional | — | `routes/faqs.js` |
| POST | `/api/faqs/ask` | Opcional | — | `routes/faqs.js` |
| GET | `/api/voluntarios/me/habilidades` | Sí | volunteer | `routes/voluntarios.js` |
| PUT | `/api/voluntarios/me/habilidades` | Sí | volunteer | `routes/voluntarios.js` |
| PUT | `/api/voluntarios/me/cv` | Sí | volunteer | `routes/voluntarios.js` |
| DELETE | `/api/voluntarios/me/cv` | Sí | volunteer | `routes/voluntarios.js` |
| GET | `/api/voluntarios/:userId/cv` | Sí | dueño, o ONG (o coordinador de su equipo, §295) con inscripción pendiente/aprobada | `routes/voluntarios.js` |
| GET | `/api/equipo/miembros` | Sí | ngo | `routes/ngoTeam.js` (§294) |
| POST | `/api/equipo/miembros` | Sí | ngo | `routes/ngoTeam.js` |
| PATCH / DELETE | `/api/equipo/miembros/:userId` | Sí | ngo (su equipo) | `routes/ngoTeam.js` |
| GET | `/api/equipo/mias` | Sí | volunteer | `routes/ngoTeam.js` |
| POST | `/api/equipo/mias/:ngoId/aceptar` | Sí | volunteer (invitado) | `routes/ngoTeam.js` |
| DELETE | `/api/equipo/mias/:ngoId` | Sí | volunteer (miembro o invitado) | `routes/ngoTeam.js` |
| GET | `/api/equipo/:ngoId/panel` | Sí | miembro activo | `routes/ngoTeam.js` |
| GET | `/api/voluntarios/:userId` | No | — | `routes/voluntarios.js` |
| GET | `/api/messages/conversations` | Sí | cualquiera | `routes/messages.js` |
| GET | `/api/messages/thread/:userId` | Sí | cualquiera | `routes/messages.js` |
| POST | `/api/messages` | Sí | cualquiera | `routes/messages.js` |
| PATCH | `/api/messages/thread/:userId/read` | Sí | cualquiera | `routes/messages.js` |
| WS | `/ws?token=<jwt>` | Sí (JWT por query string) | cualquiera | `src/ws/index.js` |
| GET | `/api/notifications` | Sí | cualquiera | `routes/notifications.js` |
| PATCH | `/api/notifications/:id/read` | Sí | dueño de la notificación | `routes/notifications.js` |
| PATCH | `/api/notifications/read-all` | Sí | cualquiera (propio usuario) | `routes/notifications.js` |

**Sobre el orden de definición en `projects.js`, `ngos.js` y `empresas.js`:** varias rutas (y helpers como `fmt`, `hasBadWord`) están definidas **después** de `module.exports = router`. Funciona porque `module.exports` referencia el mismo objeto `router`, que sigue mutándose tras la asignación — es el patrón deliberado del proyecto para exportar helpers reutilizables entre routers sin crear un módulo `lib/` aparte (ver `BACKEND_CONTEXT.md §10`).

---

## Auth (`routes/auth.js`)

Desde §290, las tres rutas de contraseña (`PUT /me/password`, `POST /forgot-password` y `POST /reset-password`) están en `routes/authPassword.js`, que `auth.js` monta con `router.use`: las URLs no cambiaron. Las validaciones, la respuesta 429, `sha256` y `appUrl` están en `lib/authCommon.js`.

### `POST /api/auth/register`
- **Body:** `{ name, email, password, role: 'volunteer'|'ngo'|'company', apellido? }` (no lee otros campos; `role` ausente = `volunteer`, fuera de la lista → **400** "Rol inválido").
- **Validación:** `validateName` (letras y espacios, 2–50), `validateEmail` (hasta **254 caracteres** después de recortar, y regex: el tope va antes porque el regex viejo tenía backtracking cuadrático, `PROJECT_ANALYSIS.md §201`; desde §231 el regex es lineal y acepta exactamente lo mismo; lo usan también el login y los empleados de la ONG), `validatePassword` (mín. 8 caracteres, una mayúscula y un número, y **hasta 72 bytes UTF-8**: bcrypt ignora el resto; la ñ cuenta 2 y un emoji 4 → 400 "Máximo 72 caracteres (los acentos, la ñ y los emojis cuentan como más de uno)", `PROJECT_ANALYSIS.md §141`) — reglas duplicadas en `frontend/AuthModal.tsx`, con el mismo límite y mensaje. Todos deben ser strings (§76).
- **`apellido` (opcional, §138 y §142):** texto de hasta 50 (`checkText`; antes uno que no era texto daba 500); si trae algo además de espacios, la misma regla que el nombre (`validateName`: letras y espacios, 2–50) → si no, **400** "El apellido solo puede tener letras y espacios, mínimo 2 caracteres". Si falta, es `null` o vacío, se toma del nombre completo (todo lo que va después de la primera palabra). Solo se guarda en `voluntarios`, pero se valida con cualquier rol. El frontend no lo manda.
- **Efecto:** crea la fila en `users` (id generado en el código, regla 23) y, según `role`, la de `voluntarios`, `ngos` o `empresas`, **en una sola transacción**: si falla el perfil no queda el usuario (`PROJECT_ANALYSIS.md §85`).
- **Respuesta 201:** `{ message, token, user }`
- **Límite (§103):** 20 registros por IP por hora → **429** "Demasiados intentos. Probá de nuevo en unos minutos." con `Retry-After`. Cuenta **todos** los pedidos, también los que terminan en `400` o `409` (el intento se anota antes de validar; a diferencia del login, donde solo cuentan los fallidos).
- **Errores:** `400` validación; **`409`** "Ya existe una cuenta con ese email" (también si dos registros con el mismo email llegan a la vez: el UNIQUE de `users.email` deja pasar a uno, §85).

### `POST /api/auth/login`
- **Body:** `{ email, password }`
- **Respuesta 200:** `{ token, user }`
- **Límite (§103):** solo cuentan los intentos fallidos (401): 10 por email+IP y 50 por IP, cada 15 minutos. Pasado el límite, **429** "Demasiados intentos. Probá de nuevo en unos minutos." con `Retry-After` (en segundos), sin comparar la contraseña. Un login correcto limpia el contador de ese email+IP. Los `400` no cuentan. En memoria, por proceso. En producción `trust proxy` está activo para que `req.ip` sea la del cliente.
- **Errores:** `400` faltan datos o email inválido; `401` **"Email o contraseña incorrectos"** tanto si el email no existe como si la contraseña no coincide, y con el mismo trabajo (se compara contra un hash fijo si no hay cuenta), para no revelar qué emails están registrados (`PROJECT_ANALYSIS.md §91`, REVISION B20). *(Hasta §91 eran dos mensajes distintos.)*
- **Sin máximo de contraseña (§141):** el límite de 72 bytes se aplica solo al registrarse; una cuenta vieja con una contraseña más larga sigue entrando.

### `GET /api/auth/me` — Auth
- **Respuesta 200:** `{ user, profile }`. `user`: `id, name, email, role, avatar, bio, location, created_at` de `users`. `profile`: la fila de `voluntarios`, `ngos` o `empresas` según el rol (consulta aparte, no un JOIN), con **lista blanca de columnas** y los nombres en español (regla 8, `PROJECT_ANALYSIS.md §155`; antes `SELECT *`, mismas claves):
  - voluntario: `id, user_id, nombre, apellido, descripcion, ubicacion, foto_perfil, banner, has_cv, followers, created_at, updated_at`. `has_cv` (boolean) reemplaza a `cv_url` desde §165: la columna guarda el public_id de un PDF privado, que no se expone;
  - ONG: `id, user_id, nombre, descripcion, foto_perfil, banner, mision, alias, ubicacion, founded, followers, created_at, updated_at`;
  - empresa: `id, user_id, nombre, descripcion, mision, ubicacion, foto_perfil, banner, industria, followers, created_at, updated_at`.
  Con otro rol, o si el rol es uno de esos tres pero no hay fila, `profile` es `null` *(hasta §158, sin fila la clave no salía: `db.get` devuelve `undefined`)*. El frontend no lee `profile` (`api.auth.me` tipa `{ user }`). Una columna nueva de esas tablas no sale hasta agregarla a la lista en `routes/auth.js` (test: `test/integration/auth-me-profile.test.js`).
- **Errores:** `401` sin token o token inválido; `404` si el usuario del token ya no existe.

### `PUT /api/auth/me` — Auth
- **Validación (`PROJECT_ANALYSIS.md §76`):** `name`, si viene (también `""` o `null`), pasa por `validateName` y se guarda recortado; `bio` ≤ 500, `location` ≤ 150, `avatar` ≤ 1000, todos texto o `null`. Si no → **400**.
- **Body:** `{ name?, bio?, location?, avatar? }` — solo lee esos cuatro, todos de `users` (no toca la tabla del rol). Parcial: un campo que no viene conserva su valor.
- **Respuesta 200:** `{ user }` actualizado (`id, name, email, role, avatar, bio, location`). `404` si el usuario ya no existe.

### Borrar la propia cuenta (`PROJECT_ANALYSIS.md §177`)
**`POST /api/auth/me/delete-request`** — Auth. Manda un email con el link `APP_URL/cuenta/borrar?token=<código>`, que vence en **1 hora** y sirve **una vez**. Un pedido nuevo invalida el anterior. En la base se guarda solo el hash sha256 del código.
- **Respuesta 200:** `{ sent: true }`.
- **Errores:** `401` · `429` con `Retry-After` (más de **3 por hora**) · **`503`** si Resend no está configurado, o **`502`** si el email falla. En los dos casos **no queda ningún link**: sin email no hay borrado.

**`POST /api/auth/delete-account`** — Sin sesión (el link puede abrirse en otro dispositivo). Body `{ token }`.
- Si el código vale, en **una transacción** corrige los contadores (seguidores de ONG, proyectos y voluntarios; `cupos_ocupados` de sus inscripciones aprobadas) y borra el usuario. El resto cae por `ON DELETE CASCADE`: perfil, inscripciones, mensajes, notificaciones, Momentos, follows y, **si es ONG, sus proyectos con las inscripciones de otros**. Después del COMMIT, en lo posible, borra en Cloudinary el CV, las fotos de Momentos y, si es ONG, la foto propia de cada voluntariado suyo (`foto_provider_id`, desde §289).
- **Respuesta 200:** `{ deleted: true }`.
- **Errores:** `400` "El link no es válido o ya se usó…" (forma incorrecta, inexistente o ya usado) · `400` "El link venció…" (y se descarta) · `500` "No pudimos borrar la cuenta…": no se borra nada y el mismo link sirve para reintentar.

### "¿Olvidaste tu contraseña?" (§275)
**`POST /api/auth/forgot-password`** — Sin sesión. Body `{ email }`.
- **No revela si el email tiene cuenta:** con un email válido la respuesta es siempre **200** `{ sent: true }`. El código y el email se hacen **después de responder**, así tampoco se nota por el tiempo ni por un envío que falla. Si hay una cuenta, le manda el link `APP_URL/restablecer?token=<código>`, que vence en **1 hora** y sirve **una vez**; un pedido nuevo invalida el anterior. En la base se guarda solo el hash sha256 del código (`password_reset_tokens`). Si el email no sale, el código se descarta (y queda en el log).
- **Errores:** `400` "Email inválido" (forma o tipo, con el mismo `validateEmail` del registro) · **`503`** sin Resend (`email.isConfigured()`), para todos por igual · `429` con `Retry-After`: más de **3 pedidos por email por hora** ("Pediste recuperar la contraseña muchas veces seguidas…"; cuenta exista o no la cuenta, y con el email normalizado) o más de **20 por IP por hora** ("Demasiados intentos…"). En memoria y por proceso, como el login.

**`POST /api/auth/reset-password`** — Sin sesión (el link puede abrirse en otro dispositivo). Body `{ token, new_password }`.
- Valida la forma del código y después las reglas del registro (`validatePassword`) **antes de gastar el código**: con una contraseña que no cumple, el link sigue sirviendo. Fija la contraseña en una transacción que **consume el código con compare-and-swap** (`DELETE … WHERE token_hash`, mira `changes`) y borra los demás códigos del usuario: cinco pedidos a la vez con el mismo link la cambian una sola vez (probado en Postgres).
- **Respuesta 200:** `{ message: "Contraseña actualizada" }`. **No inicia sesión** (no devuelve token). Después de responder manda el mismo aviso de "tu contraseña cambió" que `PUT /me/password` (§278); los pedidos que pierden la carrera por el link no avisan.
- **Errores:** `400` "El link no es válido o ya se usó. Pedí uno nuevo desde "¿Olvidaste tu contraseña?"." (forma incorrecta, inexistente, ya usado o ganado por otro pedido) · `400` "El link venció…" (y se descarta) · `400` con el mensaje de las reglas de la contraseña. **Límite conocido:** como en `PUT /me/password`, los JWT ya emitidos siguen valiendo hasta que vencen.

### `PUT /api/auth/me/password` — Auth (§272)
- **Body:** `{ current_password, new_password }` (textos; si no, **400** "Contraseña actual y nueva requeridas").
- La actual equivocada: **400** "La contraseña actual no es correcta" (400 y no 401, para que el frontend no cierre la sesión). La nueva, las reglas del registro (`validatePassword`: mínimo 8, una mayúscula, un número, hasta 72 bytes) y distinta de la actual (**400** "La nueva contraseña tiene que ser distinta de la actual").
- **5 intentos con la actual equivocada en 15 minutos por usuario:** **429** (en memoria, por proceso, como el login). Se limpia al cambiarla bien.
- **200:** `{ message: "Contraseña actualizada" }`. **Límite conocido:** los JWT ya emitidos (otras sesiones) siguen valiendo hasta que vencen; no hay revocación. **Avisa por mail** (§278): después de responder, "Tu contraseña de VoluntariAR cambió", sin la contraseña y con qué hacer si no fue la persona; un envío que falla no cambia la respuesta.

### `PUT /api/auth/me/photo` — Auth (cualquier rol)
> Agregado en `PROJECT_ANALYSIS.md §162` (`PLAN_FALTANTE.md`, Etapa 1). Foto de perfil subida como archivo a Cloudinary (`lib/storage.js`).
- **Body:** `multipart/form-data` con **un** archivo en el campo `photo` (JPEG, PNG o WebP; hasta 8 MB = **8.000.000 bytes**, §232). El cliente no fija `Content-Type` (lo pone el navegador con el boundary).
- **Qué guarda:** la miniatura cuadrada de Cloudinary (`storage.thumbUrl`, 480 px) en **`users.avatar`**, que es la foto que muestran el chat, Momentos, comentarios y reseñas. Si el rol es `ngo` o `company`, la misma URL va también a `ngos.foto_perfil` / `empresas.foto_perfil` (el `logo` de `fmtNgo`/`fmtEmpresa`), en la misma transacción. **`voluntarios.foto_perfil` no se toca**: la foto del voluntario es `users.avatar` (decisión F2 de `PLAN_FALTANTE.md`).
- **Respuesta 200:** `{ user }` con las mismas claves que `PUT /api/auth/me`.
- **Errores (en este orden, sin subir nada antes de validar):** `401` sin sesión · `429` (con `Retry-After`) pasadas **10 subidas por hora** por usuario (en memoria, por proceso, `lib/rateLimit.js`) · `503` si Cloudinary no está configurado · `400` "Solo se aceptan fotos JPEG, PNG o WebP" (tipo declarado), "Elegí una foto" (sin archivo, o en otro campo) o "El archivo no es una imagen válida (JPEG, PNG o WebP)" (la **cabecera real** no es de imagen) · `413` más de 8 MB · `404` "Perfil no encontrado" (ONG/empresa sin fila de perfil) · `502` si falla Cloudinary (la foto anterior sigue) · `500` "Error al guardar la foto" si falla la base después de subir: se borra de Cloudinary lo subido y no cambia nada.
- **No borra la foto anterior de Cloudinary** (como borrar un usuario o un proyecto, pendiente conocido; decisión C3 abierta en `PLAN_FALTANTE.md`).
- Tests: `test/integration/profile-photo.test.js`.

---

## Projects (`routes/projects.js`)

### `GET /api/projects` — Auth opcional
- **Query params (los que lee el código, cotejado en §96):** `search`, `type` (`fugaz`/`sostenido`; `Todos` = sin filtro), `category` (**nombre** de una categoría), `status` (si no viene, todos los estados **menos `cancelled`**, en los dos motores: el catálogo público no muestra los cancelados desde que la ONG los cancela desde el panel, §256; con `status=cancelled` explícito sí los trae, y `GET /:id` los sigue abriendo), `modality`/`modalidad` (`presencial`/`remoto`/`hibrido`), `sort` (`featured` default, `rating`, `recent`), `limit`, `offset`. *(Este doc listaba además `tipo`, `categoria` "uno o varios ids", `ngo_id`, `page` y `status` con default `active`: el código nunca los tuvo.)*
- **Paginación (`PROJECT_ANALYSIS.md §96`):** `limit` por defecto 20, entre 1 y **500** (más grande se acota a 500; inválido o < 1 → 20); `offset` ≥ 0 (inválido → 0). Los tres órdenes terminan en `p.id`, así que las páginas son deterministas aunque haya empates (antes, en Postgres, dos páginas podían repetir un proyecto y saltear otro). Una pantalla que quiera "todos" tiene que pasar un `limit` alto a propósito (Explorar pide 200, el selector de patrocinio 500); si algún día hay más de 500 activos, hace falta paginar de verdad del lado de esas pantallas.
- **Comportamiento:** filtra dinámicamente según los params presentes. **Bifurca implementación según motor de DB** (ver `BACKEND_CONTEXT.md §2`, §10.6):
  - Postgres: una sola query con `json_agg` para traer roles/requisitos/categoría agregados. Los dos `json_agg` agregan **strings** (`DISTINCT ro.nombre`, `DISTINCT req.descripcion`), la misma forma que la rama SQLite y que `GET /:id`; `pg` los entrega ya parseados y `parseJson` los devuelve tal cual. Antes los roles salían como objetos y `parseJson` tiraba todo a `[]` (`PROJECT_ANALYSIS.md §52`). Test: `test/integration/projects-list-shape.test.js` (listado vs. detalle, en los dos motores).
  - SQLite: query base + 3 queries en batch (no N+1) para roles, requisitos y categoría — usando la traducción de `translatePg()`.
  - **`search` busca en los mismos campos en los dos motores:** título, descripción, nombre de la ONG, **nombre de la categoría** y ubicación. En SQLite la categoría va por subconsulta, porque esa rama no hace JOIN con `categorias`. Antes, en SQLite, faltaba la categoría (`PROJECT_ANALYSIS.md §136`, REVISION A7).
  - **`search` y el filtro de modalidad no distinguen mayúsculas en ninguno de los dos motores:** usan `ILIKE` (`translatePg` lo vuelve `LIKE` en SQLite). En SQLite eso vale solo para letras ASCII: "MARATÓN" no encuentra "Maratón" en dev, sí en Postgres. Ninguno de los dos ignora tildes ("maraton" no encuentra "Maratón"). `modality=remoto` incluye las ubicaciones con "remoto"/"virtual" en cualquier combinación de mayúsculas (`PROJECT_ANALYSIS.md §54`). Test: `test/integration/projects-search.test.js`. Hoy solo la portada (`PublicFeed`) usa `search`; Explorar filtra en el navegador y ninguna pantalla manda `modality`.
- **Respuesta 200:** `{ projects: Project[] }`, solo la lista (sin `total`, `page` ni `limit`), cada `Project` pasado por `fmt()` (incluye `latitude`/`longitude`/`modality`, agregados por el usuario 2026-09, más `ngo_name`/`ngo_logo`/`ngo_followers`, `avg_rating` y `ratings_count`).
- Aunque la ruta usa `optionalAuth`, la respuesta **no cambia con la sesión**: no trae `my_enrollment` (esta doc decía que sí; la inscripción propia está solo en `GET /api/projects/:id` y en el feed, como `my_enrollment_status`).

### `GET /api/projects/recommended` — Auth, role `volunteer`
- **Query params:** `limit` (default 10, mín. 1, máx. 30; `clampInt(limit, 10, 1, 30)` de `lib/inputs.js`, como los otros listados: inválido, `0` o negativo → 10; más de 30 → 30). *(Antes `Math.min(parseInt(limit) || 10, 30)`: un negativo llegaba a `slice(0, -5)` y devolvía todos los candidatos menos 5, más de 30; `PROJECT_ANALYSIS.md §149`.)*
- **Comportamiento (reescrito por el usuario 2026-09 — bastante más rico que un ranking simple):** scoring por 9 señales independientes, cada una suma puntos y agrega un `tag`/`reason` visible en la UI si aplica:
  1. Afinidad de categoría con el historial de inscripciones. Desde §280 una inscripción **aprobada pesa 2** y una pendiente o rechazada 1, y cada voluntariado **seguido** suma 1 a su categoría. `based_on_history` sigue hablando solo de inscripciones.
  2. Match de habilidades del voluntario contra los roles buscados del proyecto. Desde §287 los roles del motivo ("Busca tus habilidades: A, B") salen en **orden alfabético** (`ORDER BY ro.nombre`; antes, en el orden de la base, distinto en SQLite y Postgres).
  3. ONG seguida por el voluntario (`ngo_follows`).
  4. Cercanía geográfica (`users.location` vs `ubicacion` del proyecto) o modalidad remota.
  5. Cupos limitados / últimos cupos.
  6. Recencia de publicación.
  7. Rating promedio del proyecto.
  8. Popularidad (`project_follows` del proyecto).
  9. Señal social: contactos que el voluntario sigue (`volunteer_follows`) y que están inscriptos/aprobados en ese proyecto.
  - **"Arranque en frío"** (`is_cold_start: true`): sin historial de inscripciones, sin ONGs/proyectos seguidos, sin habilidades que matcheen roles y sin voluntarios seguidos. No se saca ninguna señal (las que dependen de esos datos simplemente no suman): se **multiplican** las de cupos (×2), novedad (×2) y rating (×3), y un proyecto sin ningún motivo lleva el tag "🌟 Destacado".
  - **Universo y orden (§280):** se evalúan hasta **500** candidatos (activos, con cupo, sin inscripción; antes, los 100 más nuevos). Después de ordenar por puntaje, **a lo sumo 2 de la misma ONG** van adelante (`MAX_PER_NGO`); los que sobran quedan detrás, en su orden. Todas las habilidades del catálogo tienen rol en `SKILL_TO_ROLE` (exportado; un test lo exige: Contabilidad y Jardinería no lo tenían).
  - **Dónde está el cálculo (§287):** la ruta junta los datos y arma el contexto; las 9 señales, `scoreProject` y `rankRecommendations` (orden + diversidad) están en `src/lib/recommender.js` como funciones puras, con tests unitarios en `test/unit/recommender.test.js`. `SKILL_TO_ROLE` vive ahí y `projects.js` lo reexporta.
- **IMPORTANTE — orden de rutas:** esta ruta está declarada antes de `GET /:id` en `projects.js`. Si se moviera después, Express interpretaría `recommended` como el parámetro `:id` y la ruta dejaría de ser alcanzable — cualquier ruta nueva de `projects.js` sin parámetro debe declararse antes de `/:id`.
- **Respuesta 200:** `{ recommendations: Project[], based_on_history: boolean, is_cold_start: boolean }` (`based_on_history`: el voluntario tiene inscripciones en proyectos con categoría; es lo único de los dos que tipa `api.ts`), cada `Project` con `recommendation_score` (número), `recommendation_reasons` (array de strings) y `recommendation_tags` (array de strings cortos con emoji, para chips en la UI).
- **Errores:** `401` sin token, `403` si el rol no es `volunteer`.

### `GET /api/projects/:id` — Auth opcional
- **Desde §266 suma `sponsors: [{ id, name, logo }]`:** las empresas con el acuerdo de patrocinio **aceptado**, por nombre. Pendientes y rechazados no aparecen; los puntos y montos del acuerdo nunca salen acá.
- **Respuesta 200:** `{ project }` con roles, requisitos, categoría, `comments` (todos, del más nuevo al más viejo), `ratings`, `kpis`, rating promedio, (si hay sesión) `my_enrollment`, y **`can_manage: boolean`**: `true` solo si quien pide es la ONG dueña (consulta aparte a `ngos`, sin exponer el `user_id` de la ONG). Lo usa `ProjectDetails` para mostrar "Ver en panel ONG" (`PROJECT_ANALYSIS.md §73`). **`accepts_donations: boolean`** (§217): `true` solo si la ONG tiene su cuenta de Mercado Pago vinculada y activa (`sellerAccounts.acceptsDonations`); el botón "Donar" depende de esto. Solo lo trae este endpoint, no los listados.
- **Reseñas (`ratings`):** `{ id, project_id, user_id, rating, comment, created_at, user_name, user_avatar }` (`RATINGS_SELECT`, el mismo que el feed). `user_avatar` es la foto de quien calificó, o `null` (`PROJECT_ANALYSIS.md §133`). Vienen ordenadas `r.created_at DESC, r.id`: de la más nueva a la más vieja, con desempate fijo (§122).
- **`my_enrollment`** (`null` sin sesión o sin inscripción) sale con los **nombres de columna crudos**: `{ id, user_id, project_id, status, mensaje, horas_realizadas, created_at, updated_at }` (no `message`/`hours_logged` como en `/api/enrollments/*`). El frontend solo lee `status`.
- **Errores:** `404` si no existe. *(Esta doc decía también "o `status='cancelled'` y el requester no es la ONG dueña": el código no hace eso, corregido en §73.)*

### `POST /api/projects` — Auth, role `ngo`
- **Body real (en inglés — a diferencia de otros endpoints, acá el body ya viaja con los mismos nombres que usa el frontend, no en español):** `{ title, description, full_description?, image?, category?, location, type?: 'fugaz'|'sostenido' (ausente o null = 'fugaz'), duration?(si fugaz), hours_per_week?(si sostenido), volunteers_needed, funding_goal?, cost_per_person?, modality?|modalidad?: 'presencial'|'remoto'|'hibrido' (ausente o '' = se deduce de la ubicación), latitude?|latitud?, longitude?|longitud?, roles_needed?: string[], requirements?: string[] }`
- **Validación (`validateProject` y helpers de `routes/projects.js`, `PROJECT_ANALYSIS.md §137` y §143), todo antes de crear nada → 400:** `type` en `fugaz|sostenido` (→ 400 `"Tipo inválido: tiene que ser fugaz o sostenido"`; antes 500 por el `CHECK`).
  - **Textos:** título de 3 a **80** caracteres y descripción de 10 a **1000**. Máximos de los demás: `full_description` **5000**, `location` **150** (obligatoria), `duration` **100** (obligatoria si es fugaz, también si `type` no vino) e `image` **1000**. Mensaje: "<Campo> puede tener hasta N caracteres". `CreateVoluntariado` tiene los mismos topes de título y descripciones (§145).
  - **`volunteers_needed`:** de 1 a **100000**. **`hours_per_week`** (obligatorio si `sostenido`): de 1 a **168**. Antes, por encima de esos topes, Postgres daba 500 por desborde del INTEGER. Los dos tienen que ser **enteros estrictos**: un número entero o un texto de dígitos (`toStrictInt` de `lib/inputs.js`). `3.7`, `"5 personas"`, `[5]` o `"1e21"` → 400 "Los cupos tienen que ser un número entero" / "Las horas semanales tienen que ser un número entero" (antes `parseInt` los recortaba: `"1e21"` → 1).
  - **`latitude`/`longitude`** (o `latitud`/`longitud`, misma precedencia `latitude ?? latitud`): `null`, `''` o ausentes = sin coordenadas. Si no, número o texto numérico con latitud de −90 a 90 y longitud de −180 a 180 → si no, 400 "La latitud tiene que ser un número entre -90 y 90" (ídem longitud). Antes `"abc"` quedaba `null` sin aviso y `500` se guardaba.
  - *(Corregido — hasta hace poco el backend validaba/leía `cupos` en vez de `volunteers_needed`, lo que hacía fallar siempre la creación de proyectos con "Los cupos deben ser un número positivo". Ver `PROJECT_ANALYSIS.md §13`, bug B5.)*
- **Tipos y montos (`PROJECT_ANALYSIS.md §137`, REVISION A3), antes de crear nada:** `title`, `description`, `location`, `full_description`, `image` y `duration`, si vienen y no son `null`, tienen que ser texto (→ 400 `"<Campo> tiene que ser un texto"`; antes 500 en `.trim()`/`.toLowerCase()`). `modality`/`modalidad` fuera de la lista → 400. `funding_goal` y `cost_per_person`: ausentes, `null` o `''` = 0; si no, número finito ≥ 0 (→ 400; antes un negativo daba 500 y `"abc"` se guardaba como 0). Es la misma regla que el PUT (`parseMoney`). *(Hasta §143 `latitude`/`longitude` no se validaban: pasaban por `parseFloat` y un valor no numérico daba `NaN`.)*
- **Validación de listas y categoría (`cleanTextList`, `PROJECT_ANALYSIS.md §59`), antes de crear nada:** `roles_needed` y `requirements` ausentes → `[]`; si vienen, tienen que ser **arrays de strings**, a lo sumo **20** cada uno, rol de **2 a 40** caracteres y requisito de **3 a 100** (los mismos límites que `CreateVoluntariado.tsx`; sin la regex de letras del frontend). Se recortan y se sacan repetidos. `category`, si viene, string de hasta 60. Antes un string se recorría letra por letra (creaba los roles "C", "h", "e", "f" en el catálogo) y un no-string daba 500 con el proyecto creado a medias.
- **Efecto (en una sola `db.transaction()`):** `INSERT` en `projects` (mapeando `volunteers_needed → cupos` internamente); la categoría y los roles se crean en su catálogo si no existen (`ON CONFLICT (nombre) DO NOTHING`) y se asocian; después los `requisitos`. Si algo falla, no queda nada. **Ojo:** cualquier ONG puede crear categorías y roles nuevos en el catálogo global (el frontend manda categorías de una lista fija, pero el backend acepta cualquier texto).
- **Respuesta 201:** `{ project }`, con `roles_needed`/`requirements`/`category` tal como se guardaron (recortados, sin repetidos), no como vinieron en el body.
- **Errores:** `400` validación, `404` si el usuario no tiene perfil de ONG asociado. *(No pasa por `hasBadWord()`: eso es solo para comentarios, reseñas y posts; la doc anterior decía lo contrario.)*
- **Id propio (`PROJECT_ANALYSIS.md §40`):** el handler genera el id con `crypto.randomUUID()`, lo usa en el `INSERT`, para releer la fila y para asociar categoría/roles/requisitos. *(Antes buscaba "el último proyecto de la ONG" por `created_at`: en SQLite, con resolución de 1 s, dos altas de la misma ONG en el mismo segundo empataban, devolvía el más viejo y le enganchaba las asociaciones.)*

### `PUT /api/projects/:id/photo` — Auth, role `ngo` (dueño) (§282)
- **Body:** multipart, campo `photo` (JPEG, PNG o WebP, hasta 8.000.000 bytes; la lectura es `lib/photoUpload.js`, la misma de la foto de perfil). **No fijar `Content-Type`** desde el cliente.
- Orden de la regla 24: sesión y rol → **límite de 20 subidas por hora por ONG** (429 con `Retry-After`) → Cloudinary configurado (**503** si no) → archivo (**400** "Elegí una foto"; **413** si pesa más) → **cabecera real** (`detectImageType`; **400** "El archivo no es una imagen válida…") → propiedad (**404** "Proyecto no encontrado o sin permiso" si no existe o es de otra ONG, sin subir nada) → subida (**502** si Cloudinary falla, sin tocar la base) → guardado en una transacción (si falla, se borra lo subido y **500**).
- Guarda la versión ancha (`feedUrl`, 1080 px) en `projects.foto_perfil` (el `image` de la API) y el id de Cloudinary en `foto_provider_id`, que **no sale en la API**. Al reemplazarla, la anterior se borra de Cloudinary **después del COMMIT** y en lo posible; una URL externa vieja (sin id) no se toca.
- **200:** `{ project }` (formateado con `fmt`; el frontend usa `image`). **Límite conocido:** borrar el voluntariado todavía no borra su foto en Cloudinary.

### `PUT /api/projects/:id` — Auth, role `ngo` (dueño)
- Verifica `ngo_id` de la sesión contra el `ngo_id` del proyecto (join implícito vía `WHERE id=$1 AND ngo_id=$2`).
- **Parcial (`PROJECT_ANALYSIS.md §95`):** cada campo que **no viene conserva su valor**: `title`, `description`, `full_description`, `image`, `location`, `type`, `duration`, `volunteers_needed`, `funding_goal`, `cost_per_person`, `hours_per_week`, `status`, `latitude`/`longitude`, `modality`, `roles_needed`, `requirements`, `category`. `null` o `""` borra los opcionales (`full_description`, `image`, `duration`; montos → 0). El resultado combinado se valida como el alta: `validateProject` (cupos y horas **enteros estrictos**, con los mismos topes de 100000 y 168), tipo `fugaz|sostenido` (`null` incluido) y montos finitos ≥ 0 (`parseMoney`). Los textos que vienen se validan como string y con los mismos largos máximos (80, 1000, 5000, 150, 100 y 1000; un valor viejo más largo no se revalida si no viene). **`modality`/`modalidad`**, si vienen y no están vacías, tienen que ser `presencial|remoto|hibrido` (antes no se validaban: un objeto daba 500 en SQLite); vacías conservan la actual. **`latitude`/`longitude`** (o `latitud`/`longitud`), si vienen, se validan como en el alta, y `null`/`''` las borra. Si algo no cumple → **400** sin cambiar nada (§143). **`image_position` (§297)**, si viene, tiene que ser `top`, `center` o `bottom` (texto: ni `['top']` ni `'toString'`); si no, se conserva. También se acepta en el alta (sin él, `center`), y sale en todas las lecturas (`fmt`). `roles_needed`, `requirements` y `category`, si vienen, se validan como en el alta y **reemplazan** a los actuales (listas vacías o `""` los borran), en la misma transacción. *(Antes se pisaba todo lo no enviado —un status omitido reactivaba un proyecto terminado— y la respuesta devolvía roles/requisitos/categoría del body sin guardarlos.)*
- **Capacidad (`PROJECT_ANALYSIS.md §40`):** `volunteers_needed` **omitido o `null` conserva la capacidad actual** (antes se pisaba con `0`); un valor explícito debe ser un entero ≥ 1 (**400** `"Los cupos deben ser un número positivo"`, o `"Los cupos tienen que ser un número entero"` si no es entero, igual que al crear; antes un negativo violaba el `CHECK(cupos >= 0)` y devolvía 500). **No se puede bajar por debajo de las inscripciones aprobadas**: **400** `"No podés bajar la capacidad a N: ya hay M voluntarios aprobados."`. La condición va dentro del propio `UPDATE` (`... AND cupos_ocupados <= $9`), así que es atómica frente a aprobaciones concurrentes. Desde §255–§256 lo usan dos pantallas: la edición (`CreateVoluntariado` en `/ngo/dashboard/project/:id/editar`, manda solo los campos que cambiaron y `null` para borrar la descripción completa o el lugar) y el estado del detalle del panel (`NGOProjectDetail`: `{ status }` para finalizar, cancelar o volver a activar). *(Esta viñeta decía además que "no es una actualización parcial real" y que un `status` omitido volvía a `'active'`: era de antes de §95 y contradecía la viñeta de arriba. El código es parcial, también para `status`.)*
- **`status`**, si viene, tiene que ser `active`, `completed` o `cancelled` → si no, **400** (antes 500 por el `CHECK`; `§74`).
- **Respuesta 200:** `{ project }` releído de la base (con sus roles, requisitos y categoría guardados). **Errores:** `400` validación o capacidad; `404` si el proyecto no existe o no pertenece a la ONG del usuario (no distingue "no existe" de "no es tuyo", por diseño). *(Decía "No lo usa ninguna pantalla": cierto hasta §255.)*

### `DELETE /api/projects/:id` — Auth, role `ngo` (dueño)
- Borra el proyecto (cascada elimina requisitos, roles, comentarios, ratings, kpis, enrollments asociados — ver `DATABASE_CONTEXT.md §5`).
- **Archivos de Cloudinary (§289):** antes de borrar se leen `foto_provider_id` y los `post_media.provider_id` de sus Momentos (que se van en cascada). Después del `DELETE`, si Cloudinary está configurado, se borran todos con `Promise.allSettled`: si alguno falla, queda en el log y la respuesta sigue siendo 200, porque el voluntariado ya se borró.
- **Respuesta 200:** `{ message: 'Proyecto eliminado' }` (esta doc decía `{ success: true }`). **404** si no existe o no es de la ONG de la sesión.

### `POST /api/projects/:id/comments` — Auth (cualquier rol)
- **Body:** `{ comment }`. Primero `checkText` (`lib/inputs.js`, tope **1000**, el mismo que el comentario de una reseña): si viene y no es un string (número, objeto, array, booleano) → **400** "El comentario tiene que ser un texto" (antes 500, `PROJECT_ANALYSIS.md §148`); más de 1000 caracteres (largo crudo, con espacios) → **400** "El comentario puede tener hasta 1000 caracteres". Después, recortado, menos de 3 caracteres (o vacío, `null` o ausente) → **400** "Comentario muy corto". Pasa por `hasBadWord()` → **400**. **404** si el proyecto no existe (antes 500 por la FK, `§56`). Ningún 400 crea nada. El frontend (`ProjectDetails`, `FeedPostCard`) no limita a 1000.
- **Respuesta 201:** `{ comment }` (incluye `user_name`/`user_avatar` vía JOIN a `users`, más `is_participant` — agregado por el usuario 2026-09, para que el frontend distinga si quien comenta participó del proyecto o no). `is_participant` es **`1`/`0`** (un `CASE`), no `true`/`false`, igual que en el detalle y en el feed; `AppComment` acepta los dos.
- **Ojo en el frontend:** `api.ts` tipa esta respuesta como `{ comment: AppComment }` — si se toca este endpoint, no usar `Comment` a secas como tipo (es el tipo global del DOM, no el propio; ya pasó una vez, ver `PROJECT_ANALYSIS.md §29`).

### `POST /api/projects/:id/ratings` — Auth (cualquier rol)
- **Body:** `{ rating (1-5), comment? }`. `rating` tiene que ser un **entero** de 1 a 5 (acepta `"4"`; la regla es `toStrictInt` de `lib/inputs.js`, compartida con cupos y horas desde §143); `comment`, si viene, texto de hasta 1000 caracteres. Si no → **400** (antes `"abc"` o `3.5` llegaban a la base y daban 500; `PROJECT_ANALYSIS.md §74`). El `comment` pasa por `hasBadWord()` igual que los comentarios del proyecto → **400** "El comentario contiene palabras no permitidas" (`§104`; antes las reseñas no se filtraban).
- **Restricción agregada por el usuario (2026-09):** solo puede calificar quien tenga una `enrollment` con `status='approved'` en ese proyecto — `403` si no. Antes cualquier usuario logueado podía calificar sin haber participado.
- **Comportamiento:** upsert atómico en una sola sentencia, igual en los dos motores: `INSERT … ON CONFLICT (user_id, project_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment` (depende del `UNIQUE(user_id, project_id)` de la tabla). Si ya había una calificación de ese usuario para ese proyecto se pisan nota y comentario (el comentario omitido queda en `null`); se conservan `id` y `created_at` (una reseña editada no sube en el orden `created_at DESC` de las listas). Antes era "leer y después escribir": dos primeras calificaciones simultáneas chocaban con el `UNIQUE` y una respondía **500** (verificado en Postgres; `PROJECT_ANALYSIS.md §152`). Hoy todas responden 200 y queda una sola fila (`test/integration/ratings-concurrency.test.js`).
- **Respuesta 200:** `{ message: 'Calificación guardada' }` (tanto al crear como al actualizar). *(La doc decía `201 { rating }`; corregido en `§104`.)*

### `GET /api/projects/:id/kpis` — Público
- **Respuesta 200:** `{ kpis: KPI[] }` de ese proyecto.

### `POST /api/projects/:id/kpis` — Auth, role `ngo` (dueño)
- **Body:** `{ nombre, descripcion?, valor?, tipo_valor?, unidad?, fecha? }`
- **Validación (`validateKpi`, también en el PUT; `PROJECT_ANALYSIS.md §88`):** `nombre` texto obligatorio ≤ 120; `descripcion` ≤ 500 y `unidad` ≤ 40 (texto o `null`); `tipo_valor` ∈ `numero|porcentaje|booleano` (default `numero`; **`texto` ya no se acepta**, §90); `valor` número finito (`Number()` estricto: `"12abc"` no pasa) o `null`/`""` = sin valor; `fecha` `AAAA-MM-DD` de una fecha que exista (`2026-02-30` no) o vacía = sin fecha (§102). Si no → **400**.
- **Respuesta 201:** `{ kpi }`.
- **403** "Sin permiso sobre este proyecto" si el proyecto no existe o no es de la ONG de la sesión (lo mismo en el `PUT` y el `DELETE`, con "Sin permiso"). El 404 de esos dos es solo para el KPI.

### `PUT /api/projects/:id/kpis/:kpiId` — Auth, role `ngo` (dueño)
- **No es parcial:** pisa todos los campos con lo que manda el body (un campo omitido queda en `null`, incluido `tipo_valor`). Sin `nombre` (o con datos inválidos) responde **400** con la misma validación que el POST (antes 500 por el NOT NULL, §78 → arreglado en §88). El frontend siempre lo manda. **Respuesta 200:** `{ kpi }`.
- **404** si el KPI no existe o no es de ese proyecto (antes respondía 200 con el KPI de otro proyecto, de otra ONG, o con `{}`: `PROJECT_ANALYSIS.md §56`).

### `DELETE /api/projects/:id/kpis/:kpiId` — Auth, role `ngo` (dueño)
- **Respuesta 200:** `{ message: "KPI eliminado" }` (así lo tipa `api.ts`). **404** si el KPI no existe o no es de ese proyecto (antes 200 sin borrar nada, `§56`).

---

## Enrollments (`routes/enrollments.js`)

### `POST /api/enrollments` — Auth, role `volunteer`
- **Body esperado por el backend:** `{ project_id, message, phone }`. **`phone` (§291), opcional:** teléfono de contacto para esta postulación (`enrollments.telefono`). Ausente, `null`, vacío o solo espacios → `null`. Si viene, tiene que ser texto con dígitos, espacios, guiones, paréntesis y un `+` inicial, con 6 a 15 dígitos y hasta 25 caracteres (`parsePhone` de `lib/inputs.js`); si no, **400** "Teléfono inválido: …" y no se crea la postulación. Se guarda sin los espacios de los bordes. *(Corregido — antes el backend leía `mensaje`, hoy lee `message`, igual que lo envía el frontend; se guarda en la columna `mensaje` de la DB y se expone como `message` en todas las lecturas. Ver `PROJECT_ANALYSIS.md §13`.)*
- **Validación:** proyecto debe existir, `status='active'`, `cupos_ocupados < cupos`, y no debe existir ya una fila `(user_id, project_id)` (constraint `UNIQUE`).
- **Efecto:** `INSERT` en `enrollments` con `status='pending'`; notificación fire-and-forget a la ONG dueña del proyecto.
- **Respuesta 201:** `{ enrollment, message }`. **Errores:** `400` solo si falta `project_id`; `404` "Proyecto no encontrado o inactivo" (no existe o no está `active`); `409` "El proyecto no tiene cupos disponibles" y `409` "Ya estás inscripto en este proyecto" (también si dos altas iguales llegan a la vez: `isUniqueViolation`). *(Esta doc decía 400 para ya inscripto, sin cupos y no activo.)*

### `GET /api/enrollments/my` — Auth
- **Respuesta 200:** `{ enrollments: Enrollment[] }` del usuario logueado, con datos del proyecto embebidos (JOIN), `phone` (el suyo, en cualquier estado; §291) y `interview` (ver "Entrevistas" abajo).

### `GET /api/enrollments/project/:projectId` — Auth, role `ngo` (dueño del proyecto) o un coordinador activo de su equipo (§295)
- **Query:** `status` opcional (`pending`/`approved`/`rejected`): filtra por estado; sin él, todas.
- **Respuesta 200:** `{ enrollments: Enrollment[] }` de ese proyecto, del más nuevo al más viejo, con datos del voluntario embebidos (`volunteer_name`, `volunteer_email`, `volunteer_avatar`, `volunteer_bio`) y **`has_cv`** (boolean, §168). `has_cv` es `true` solo si la inscripción es `pending` o `approved` y el voluntario cargó un CV: es exactamente cuando esta ONG puede abrirlo con `GET /api/voluntarios/:userId/cv`. Nunca devuelve `cv_url` ni el public_id. **`phone` (§291)**, con el mismo criterio: el teléfono que dejó en esa postulación si está `pending` o `approved`; si no (o si no dejó), `null`.
- **Errores:** **`403`** "Sin permiso sobre este proyecto" si el proyecto no existe o no pertenece a la ONG de la sesión (esta doc decía 404).

### `PATCH /api/enrollments/:id` — Auth, role `ngo` (dueño del proyecto de la inscripción) o un coordinador activo de su equipo (§295)
- **Equipo (§295):** esta ruta, las dos de la entrevista y la de horas preguntan a `managedNgoOfEnrollment` (`lib/ngoAccess.js`): la ONG de la postulación si quien pide es su dueño o un coordinador activo; si no, `null`, y la consulta de siempre (`AND p.ngo_id = $n`) no encuentra nada → **404**. Un voluntario que no es coordinador recibe 404 (antes 403 por rol); una empresa, 403 por rol.
- **Body:** `{ status: 'approved'|'rejected' }`.
- **Efecto:** en **una transacción** actualiza `status` y ajusta `projects.cupos_ocupados` (+1 al pasar a `approved`, −1 —sin bajar de 0— al pasar de `approved` a `rejected`). Después del COMMIT, notificación y email fire-and-forget al voluntario.
- **Concurrencia (2026-09, `PROJECT_ANALYSIS.md §34`):** el `UPDATE` es un compare-and-swap sobre el estado leído, así que doble click / reintentos no suman el cupo dos veces. **Idempotente:** pedir el estado que la inscripción ya tiene devuelve 200 sin cambiar nada y **sin** notificación ni email duplicados (antes cada re-aprobación mandaba otro email).
- **Capacidad (`PROJECT_ANALYSIS.md §39`):** aprobar impone `cupos_ocupados <= cupos`. El `UPDATE` que suma el cupo es condicional (`... WHERE id=$1 AND cupos_ocupados < cupos`); si no afecta ninguna fila se hace **ROLLBACK de toda la transacción** (la inscripción sigue en su estado anterior) y se responde **409**. Atómico también bajo concurrencia en Postgres. Aplica a `pending→approved` y también a `rejected→approved`; **no** aplica al no-op de re-aprobar algo ya aprobado (200). Es la misma regla y el mismo mensaje que ya usa el alta (`POST /api/enrollments`).
- **Respuesta 200:** `{ message }` (`"Inscripción aprobada"` / `"Inscripción rechazada"`). **409** si otro request cambió el estado a algo distinto entre la lectura y la escritura (`"La inscripción cambió mientras la revisabas..."`), o si al aprobar ya no quedan cupos (`"El proyecto no tiene cupos disponibles"`).

### `DELETE /api/enrollments/:id` — Auth (el propio voluntario dueño de la inscripción)
- Cancela/borra la inscripción. Si estaba `approved`, decrementa `cupos_ocupados` (sin bajar de 0). Borrado y decremento en **una transacción**; el `DELETE` exige que el estado siga siendo el leído (compare-and-swap).
- **Concurrencia:** varias cancelaciones simultáneas del mismo registro → una sola responde 200 y decrementa; las demás **404** (antes todas respondían 200 y cada una restaba un cupo).
- **Respuesta 200:** `{ message: 'Inscripción cancelada' }`. **404** si ya no existe. **409** si el estado cambió justo antes de borrar.

### Entrevistas (§261, `docs/archivo/PLAN_ENTREVISTAS.md`)
Una entrevista es una fila de `reuniones` atada a una postulación (`enrollment_id`). Formato: `interview = { id, enrollment_id, date, time, link, place, note, status }`, con `date` AAAA-MM-DD, `time` HH:MM (hora de Argentina, UTC-3) y `status` `scheduled`/`done`/`cancelled` (en la base: `programada`/`realizada`/`cancelada`). Las dos listas de postulaciones (`/my` y `/project/:projectId`) suman `interview`: la programada si hay; si no, la última; `null` si nunca hubo.

#### `POST /api/enrollments/:id/entrevista` — Auth, role `ngo` (dueño del proyecto)
- **Body:** `{ date, time, link?, place?, note? }`. Validación (400, mensajes literales): fecha real AAAA-MM-DD ("La fecha tiene que ser AAAA-MM-DD"), hora HH:MM de 00:00 a 23:59 ("La hora tiene que ser HH:MM"), fecha y hora futuras ("La entrevista tiene que ser en el futuro"), link o lugar, al menos uno ("Indicá un link o un lugar para la entrevista"), link `https://` (hasta 500), lugar hasta 200, nota hasta 500 (`checkText`). Textos vacíos → `null`.
- **404** si la postulación no existe o no es de un proyecto de la ONG; **403** si no es una ONG.
- **409** "Solo se puede agendar una entrevista con la postulación pendiente": el `INSERT … SELECT … WHERE status='pending'` no inserta si la postulación ya se decidió, aunque cambie entre la lectura y el alta.
- **409** "Ya hay una entrevista programada para esta postulación": índice único parcial `idx_reuniones_una_programada` (con dos pedidos a la vez, pasa uno).
- Avisa a quien se postuló (in-app `interview_scheduled` + mail `interviewScheduledEmail`), después del alta.
- **Respuesta 201:** `{ interview }`.

#### `PATCH /api/enrollments/:id/entrevista` — Auth, role `ngo` (dueño del proyecto)
- Actúa sobre la entrevista **programada** de la postulación; sin programada (o de otra ONG) → **404** "No hay una entrevista programada para esta postulación".
- `{ status: 'cancelled' }` la cancela (aviso `interview_cancelled`). `{ status: 'done' }` la marca realizada solo si ya pasó la fecha y hora (si no, **409** "La entrevista todavía no pasó"; sin aviso). Otro `status` → **400** "status tiene que ser cancelled o done".
- **Sin `status`**, reprograma: mismo body y mismas validaciones que el alta, reemplaza los cinco campos (aviso `interview_rescheduled`).
- `UPDATE … WHERE estado='programada'` (compare-and-swap): si otro pedido la cambió, **409**. Avisos solo in-app.
- **Respuesta 200:** `{ interview }`.
- **Automático:** aprobar o rechazar la postulación (`PATCH /api/enrollments/:id`) cancela la programada en la misma transacción (la realizada queda); cancelar la postulación la borra (`DELETE`) y con ella sus entrevistas (`ON DELETE CASCADE`).

### `PATCH /api/enrollments/:id/horas` — Auth, role `ngo` (dueño del proyecto) o un coordinador activo de su equipo (§295)
- **Decisión de diseño (ver `PROJECT_ANALYSIS.md §21-22`):** originalmente el código dejaba que el propio voluntario auto-reportara sus horas (con la documentación de esta misma sección diciendo lo contrario) y no tenía ninguna UI que lo usara. Se decidió que las horas queden **verificadas por la ONG dueña del proyecto**, no auto-reportadas — patrón estándar en plataformas de voluntariado, y más confiable para las estadísticas del proyecto.
- **Body:** `{ horas }`: número (o string numérico) **finito entre 0 y 10000**; si no → **400** (antes `"1e400"` se guardaba como Infinity y `"12abc"` como 12; `PROJECT_ANALYSIS.md §75`).
- **UI:** `NGOProjectDetail.tsx`, un input + botón por cada inscripto aprobado. El voluntario ve el valor ya cargado (solo lectura) en `MyParticipation.tsx`.
- **Respuesta 200:** `{ message, horas }`. **Errores:** `403` si no sos ONG, `404` si la inscripción no existe, no está aprobada, o el proyecto no es tuyo.

**Alertas por email:** `POST /` y `PATCH /:id` (aprobar/rechazar) además disparan un email (fire-and-forget, vía `lib/email.js` + Resend) a la ONG o al voluntario según corresponda, al lado de la notificación in-app que ya existía. Sin `RESEND_API_KEY` configurada, el envío se omite silenciosamente — nunca bloquea ni rompe la respuesta del endpoint. Ver `PROJECT_ANALYSIS.md §19`.

---

## NGOs (`routes/ngos.js`)

### `GET /api/ngos` — Público
- **No lee parámetros** (ni filtros ni paginación): devuelve todas las ONGs, de la más seguida a la menos (`ORDER BY followers DESC`). *(Esta doc listaba `search`, `categoria`, `ubicacion`, `page` y `limit`: el código no los tiene.)*
- Hace `LEFT JOIN` con `ngo_categorias`/`categorias`, expone `categoria_nombre` en el resultado crudo, y `fmtNgo()` lo mapea a `category` en la respuesta final.
- **Respuesta 200:** `{ ngos: NGO[] }`, solo la lista (sin `total`/`page`/`limit`).
- **`fmtNgo`** (todas las rutas de ONG y `GET /api/follows/ngo`) devuelve `id, user_id, followers, founded, name, logo, cover_image, description, mission, location, category` y, desde §285, **`cuit` y `transparency_url`** (`null` si no se cargaron; públicos a propósito). **No devuelve `alias`**, aunque `PUT /api/ngos/me` lo guarda.

### `GET /api/ngos/me` — Auth, role `ngo`
- Devuelve el perfil completo de la ONG de la sesión, incluyendo `category` (mismo JOIN que `GET /api/ngos`; corregido — antes no lo incluía, ver `PROJECT_ANALYSIS.md §13`).
- **Respuesta 200:** `{ ngo, projects, stats, pending_enrollments }`. `projects`: los de la ONG con la misma forma que `GET /api/projects` y el perfil público (`ngoProjects` + `fmt`, con categoría, roles, requisitos, rating y `ngo_name`/`ngo_logo`), del más nuevo al más viejo y desempatando por id. *(Hasta §144 salían de un `SELECT *`: `category: ''` y listas vacías.)* Cada solicitud pendiente trae la inscripción, `volunteer_name`/`volunteer_email`/`volunteer_avatar` y **`project_title`** (tipo `PendingEnrollment` en `api.ts`; `NGODashboard` lo muestra, `PROJECT_ANALYSIS.md §82`). Desde §279 trae también **`interview`**, con la misma consulta y la misma regla que las listas de postulaciones (`INTERVIEW_COLS`/`INTERVIEW_JOIN`/`withInterview`, exportadas de `routes/enrollments.js`): la programada si hay; si no, la última; `null` si nunca hubo. Desde §284 la respuesta suma **`funnel`**: `{ applications, interviewed, approved, with_hours, rejected }`, sobre todas las postulaciones de los voluntariados de la ONG (`interviewed` = con una entrevista programada o realizada, con `EXISTS` para no contar dos veces; `with_hours` = aprobadas con `horas_realizadas > 0`), números con `Number(x) || 0`.

### `GET /api/ngos/:id` — Público
- Perfil público de una ONG por id, incluyendo `category` (corregido — antes no lo incluía). *(Corregido — la subquery de proyectos tenía una columna `id` ambigua entre `projects` y `categorias` que causaba un `500` en todos los casos. Ver `PROJECT_ANALYSIS.md §16`, bug B6.)*
- **Respuesta 200:** `{ ngo, projects: Project[] }`. Los proyectos (todos los estados, del más nuevo al más viejo) tienen **la misma forma que en `GET /api/projects`**: pasan por `fmt` e incluyen `duration`, `hours_per_week`, roles, requisitos, categoría, `ngo_name`/`ngo_logo`, `avg_rating` y `ratings_count` (`PROJECT_ANALYSIS.md §134`, REVISION A1; antes eran 8 campos sin duración ni horas, y un proyecto con dos categorías salía repetido).
- **Errores:** `404` si no existe.

### `PUT /api/ngos/me` — Auth, role `ngo`
- **Validación (`§76`, `lib/inputs.js`):** `name` (si viene) texto de 2 a 100 caracteres sin contar espacios, guardado recortado (antes `""` se guardaba vacío); `description` ≤ 2000, `mission` ≤ 1000, `location` ≤ 150, `logo`/`cover_image` ≤ 1000, `alias` ≤ 50, `founded` ≤ 20, `category` ≤ 60, todos texto. Si no → **400** (antes un número daba 500).
- **Body (en inglés, como lo manda `api.ts`):** `{ name?, description?, mission?, location?, logo?, cover_image?, alias?, founded?, category? }` — se guardan en `nombre`, `descripcion`, `mision`, `ubicacion`, `foto_perfil`, `banner`, `alias` y `founded`. Parcial: un campo que no viene conserva su valor. *(Esta doc listaba los nombres en español de las columnas; el código no los lee.)* `category` es el nombre de una categoría (ej. `"Educación"`). *(Corregido — antes no persistía la categoría; ahora busca el `id` en `categorias` por nombre y reemplaza la fila correspondiente en `ngo_categorias`. Si el nombre no matchea ninguna categoría existente, el resto del perfil se guarda igual y la categoría simplemente no cambia.)*
- **Respuesta 200:** `{ ngo }` (incluye `category` actualizada; no incluye `alias`, ver `fmtNgo` arriba).
- **Transparencia (§285):** `cuit` (11 dígitos con o sin guiones y dígito verificador de AFIP; se guarda `XX-XXXXXXXX-X`) y `transparency_url` (`https://`, hasta 500). Opcionales: `''` o `null` los borran, y si no vienen se conservan. Errores **400**: "El CUIT no es válido: son 11 números con el dígito verificador correcto" y "El link de transparencia tiene que empezar con https:// y tener hasta 500 caracteres".
- **Errores:** `400` validación; **`409`** "El alias ya está en uso" si otra ONG ya tiene ese `alias`; `404` sin perfil de ONG.

### `GET /api/ngos/:id/projects` — Público
- **Query params:** `status` opcional (si no se manda, devuelve todos los estados).
- **Respuesta 200:** `{ projects: Project[] }` de esa ONG, con la misma forma que `GET /api/projects`, `GET /api/ngos/:id`, `GET /api/ngos/me` y `GET /api/ngos/:id/dashboard` (los cuatro usan `ngoProjects` en `routes/ngos.js`): categoría, roles, requisitos y rating, cada proyecto una sola vez, del más nuevo al más viejo y desempatando por id. *(Hasta §86 devolvía las filas crudas; hasta §144 la categoría salía `''` —el alias `category` no lo lee `fmt`— y el proyecto con dos categorías se repetía. Ninguna pantalla lo usa.)*
- Como todas las respuestas de proyectos, ONGs y empresas: solo los campos de las listas blancas (`fmt`/`fmtNgo`/`fmtEmpresa`, `PROJECT_ANALYSIS.md §86`). Ya no salen las columnas en español ni `created_at` de ONG/empresa/catálogos.

### `GET /api/ngos/:id/dashboard` — Auth, role `ngo` (dueño)
- **Respuesta 200:** `{ ngo, projects, pending_enrollments, stats }`. `projects`: todos los de la ONG (cualquier estado) con la misma forma que `GET /api/projects` (`ngoProjects`: categoría, roles, requisitos y rating), del más nuevo al más viejo y desempatando por id. *(Hasta §146 salían de un `SELECT *`: `category: ''` y listas vacías.)* `stats`: `total_projects`, `active_projects`, `completed_projects`, `total_volunteers`, `total_funding`, `pending_enrollments`. `pending_enrollments` tiene columnas explícitas desde §291 (`id`, `user_id`, `project_id`, `status`, `message`, `phone`, `hours_logged`, `created_at`, `updated_at` y los datos del voluntario y del proyecto): antes era `e.*`, y el teléfono habría salido como `telefono` y el mensaje como `mensaje`. Ninguna pantalla lo llama: `api.ts` no lo expone y `NGODashboard` usa `GET /api/ngos/me`. *(Esta doc decía que `NGODashboard` lo complementaba con requests por proyecto; ya no es así.)*
- **Errores:** **`403`** "Sin acceso" si la ONG `:id` no existe o no es la de la sesión.

### `GET /api/ngos/:id/empleados` — Auth, role `ngo` (dueño)
- **Respuesta 200:** `{ empleados: Empleado[] }`.
- **Errores:** **`403`** "Sin acceso" si la ONG `:id` no es la de la sesión (lo mismo en el `POST`).

### `POST /api/ngos/:id/empleados` — Auth, role `ngo` (dueño)
- **Validación (`§76`):** `nombre` y `apellido` obligatorios (texto ≤ 100), `email` con formato válido, `rol` en `coordinador`/`comunicador`/`admin`/`otro` (default `coordinador`). Si no → **400** (antes un `rol` fuera de la lista o un `nombre` no-string daban 500).
- **Body:** `{ nombre, apellido, email, foto_perfil?, rol }`
- **Respuesta 201:** `{ empleado }`.
- No hay `PUT`/`DELETE` de empleados — una vez creado, un empleado no puede editarse ni eliminarse desde la API actual.

---

## Empresas (`routes/empresas.js`)

> Agregado 2026-09: materializa el rol `company`, que hasta ahora solo existía en `users.role` y en la tabla `empresas` (creada en el registro) sin ningún endpoint propio ni guarda `requireRole('company')` real. Mismo patrón exacto que `routes/ngos.js`.

### `GET /api/empresas` — Público
- **Respuesta 200:** `{ empresas: Empresa[] }`, con `category` resuelta vía `LEFT JOIN` a `empresa_categorias`/`categorias` (tabla nueva, ver `DATABASE_CONTEXT.md`).

### `GET /api/empresas/me` — Auth, role `company`
- Devuelve el perfil completo de la empresa de la sesión, incluyendo `category`.
- **Errores:** `403` si el rol no es `company`, `404` si no tiene perfil de empresa (no debería pasar en la práctica — se crea en el registro).

### `GET /api/empresas/:id` — Público
- **Desde §266 suma `empresa.sponsored_projects: [{ id, title, image, ngo_name }]`:** los voluntariados con el acuerdo aceptado, el más reciente primero. Sin puntos ni montos.
- Perfil público de una empresa por id. Columnas seleccionadas explícitamente (no `SELECT *`), por si en el futuro se agregan columnas sensibles a `empresas`.
- **Errores:** `404` si no existe.

### `PUT /api/empresas/me` — Auth, role `company`
- **Validación (`§76`, `lib/inputs.js`):** igual que `PUT /api/ngos/me` (`name` 2–100 recortado, `description` ≤ 2000, `mission` ≤ 1000, `location` ≤ 150, `logo`/`cover_image` ≤ 1000, `industry` ≤ 100, `category` ≤ 60). Si no → **400**.
- **Body:** `{ name?, description?, mission?, location?, logo?, cover_image?, industry?, category? }` — actualización parcial real (mismo patrón anti-B8 que `PUT /api/ngos/me`: un campo no enviado conserva su valor anterior, no se pisa con `null`).
- `category` es el nombre de una categoría existente (ej. `"Tecnología"`) — mismo patrón "borrar e insertar" que `ngo_categorias`.
- **Respuesta 200:** `{ empresa }` (incluye `category` actualizada).

### `GET /api/empresas/me/dashboard` — Auth, role `company`
> Agregado 2026-09 (`BACKEND_ROADMAP_ANALYSIS.md §2.3`, `PROJECT_ANALYSIS.md §33`). Una sola llamada, 4 queries fijas (1 de empresa + 3 en paralelo) sin importar cuántos proyectos patrocine — sin N+1.

- **Respuesta 200:**
  ```json
  {
    "stats":  { "sponsored_projects": 2, "pending_proposals": 1, "rejected_proposals": 0 },
    "impact": { "total_hours": 15, "volunteers_reached": 1 },
    "projects": [{
      "project_id": "proj-1", "title": "...", "image": null, "project_status": "active",
      "volunteers_needed": 50, "current_volunteers": 23,
      "ngo_id": "ngo-1", "ngo_name": "...", "ngo_logo": null,
      "sponsorship_status": "aceptado", "decided_at": "...",
      "hours_logged": 10, "volunteers_count": 1
    }]
  }
  ```
- **Semántica de cada número (importante para no malinterpretarlos):**
  - `stats.*`: conteos por estado de `empresa_voluntariados`. **Solo `aceptado` cuenta como "patrocinado"** — una propuesta pendiente no infla el KPI.
  - `impact.*`: impacto **del proyecto patrocinado** (todas las horas `horas_realizadas` de inscripciones `approved`, no solo las de personas de la empresa), limitado a proyectos con patrocinio `aceptado`. `volunteers_reached` cuenta **personas distintas** (`COUNT(DISTINCT user_id)`): quien participa en dos proyectos patrocinados cuenta una vez, aunque aparezca en el `volunteers_count` de ambos.
  - `projects[]`: todos los estados (pendiente/aceptado/rechazado), más reciente primero. `hours_logged`/`volunteers_count` son del proyecto; el frontend solo los muestra si `sponsorship_status === 'aceptado'`. `sponsorship_status` usa los mismos valores que `Patrocinio.estado`.
- **No incluye `aporte_total`**: `empresa_voluntariados.aporte` no lo escribe ningún endpoint ni pantalla (siempre vale el default `0`), así que ese KPI sería un cero permanente. Sumarlo cuando exista una forma real de cargarlo (o cuando Pagos lo derive de una donación completada).
- **Todos los números salen normalizados con `Number()`**: en Postgres `SUM`/`COUNT` llegan como string (el adaptador no configura parsers de tipos de `pg`); ver `AI_RULES.md` regla 13.
- **Errores:** `401` sin token, `403` si el rol no es `company`, `404` si no tiene perfil de empresa.

**Todavía sin API**: gestión de voluntarios propios de la empresa (`BACKEND_ROADMAP_ANALYSIS.md §2.4`). El patrocinio (`empresa_voluntariados`) sí tiene API completa — ver más abajo.

---

## Equipo de la ONG (§293–§296, `docs/PLAN_EQUIPOS.md`) — `routes/ngoTeam.js` y `lib/ngoAccess.js`
El dueño (la cuenta `ngo`) suma voluntarios a su equipo, con rol **`coordinator`** (postulaciones, CV, entrevistas, horas y Momentos) o **`communicator`** (Momentos). En la base `ngo_miembros.rol` es `coordinador`/`comunicador` y `estado` `invitado`/`activo`; en la API, `role` y `status` (`invited`/`active`). Una persona puede estar en varias ONG. **Sin aceptar no ve nada**: `ngoAccess` solo cuenta los activos. Editar voluntariados, KPIs, Mercado Pago, patrocinios y el propio equipo siguen siendo solo del dueño.

### `GET /api/equipo/miembros` — Auth, role `ngo`
- `{ members: [{ user_id, name, email, avatar, role, status, created_at }] }` de su ONG, en orden de invitación.

### `POST /api/equipo/miembros { email, role }` — Auth, role `ngo`
- Invita a una cuenta **de voluntario que ya existe** (el email se recorta y pasa a minúsculas). **400** email o rol inválidos, o la cuenta es de ONG o empresa; **404** "No hay ninguna cuenta con ese email…"; **409** si ya está en el equipo o invitada (también con dos invitaciones a la vez: `isUniqueViolation`). **201** `{ member }` y notificación `team_invite` a la persona (`data: { ngo_id, role }`). No manda email.

### `PATCH /api/equipo/miembros/:userId { role }` y `DELETE /api/equipo/miembros/:userId` — Auth, role `ngo`
- Cambia el rol o saca a alguien (o cancela la invitación). Solo de su equipo: si no está, **404** y la base no cambia (`ownership.test.js`).

### `GET /api/equipo/mias` — Auth, role `volunteer`
- `{ memberships: [{ ngo_id, ngo_name, ngo_logo, role, status }] }`: invitaciones y equipos.

### `POST /api/equipo/mias/:ngoId/aceptar` — Auth, role `volunteer`
- Compare-and-swap (`WHERE estado='invitado'`): aceptar dos veces da 200 y avisa al dueño (`team_joined`) una sola vez. Sin invitación, **404**.

### `DELETE /api/equipo/mias/:ngoId` — Auth, role `volunteer`
- Rechaza la invitación o sale del equipo (borra la fila). Sin fila, **404**.

### `GET /api/equipo/:ngoId/panel` — Auth, miembro activo
- `{ ngo: { id, name, logo }, role, projects: [{ id, title, status, image, volunteers_needed, current_volunteers, pending }] }`; el coordinador recibe además `pending_enrollments` (la misma consulta que `GET /api/ngos/me`, `pendingEnrollmentsOf`). `pending` sale con `Number()` (en Postgres el `COUNT` es texto). Invitado, de otra ONG o el dueño: **403** (el dueño tiene su panel).

## Acuerdo de patrocinio (§263, `docs/archivo/PLAN_PATROCINIO.md`) — `routes/patrocinios.js`
La propuesta de siempre (`empresa_voluntariados`, abajo) suma **puntos** de cada parte y una **versión** (etapa 1, §263), y desde §264 **la aceptación por versión y la charla**: el acuerdo pasa a `aceptado` cuando **las dos partes aceptaron la versión vigente**. Proponer cuenta como que la empresa acepta, y el `PATCH` de la ONG de abajo es "aceptar mi parte": sin cambios en los puntos, se cierra como siempre.
- Lo ven y lo tocan **solo las dos partes** (la empresa de la propuesta y la ONG dueña del proyecto); cualquier otro usuario, o un acuerdo que no existe: **404** "Acuerdo no encontrado" (no se revela que existe). Sin sesión: 401.
- `agreement = { company_id, project_id, company_name, ngo_name, project_title, status, version, message, my_side, accepted: { company, ngo }, points[], messages[] }`; `accepted.*` es `true` si esa parte aceptó la versión **vigente** (una aceptación de una versión anterior no cuenta); `messages[] = { id, side, author_name, body, created_at }`, en orden; `status` con los valores de siempre (`propuesto`/`aceptado`/`rechazado`); `my_side` `company` o `ngo`; `points[] = { id, side, type, detail, amount, created_at, updated_at }`, primero los de la empresa. `type`: `money`, `supplies`, `volunteers`, `outreach`, `other` (en la base: `dinero`, `insumos`, `voluntarios`, `difusion`, `otro`). **`amount`** solo en `money` (número > 0, hasta 1.000.000.000): privado de las partes, no sale en ningún endpoint público.

### `GET /api/patrocinios/:empresaId/:projectId` — Auth, una de las partes
- **200:** `{ agreement }`.

### `POST /api/patrocinios/:empresaId/:projectId/puntos` — Auth, una de las partes
- **Body:** `{ type, detail, amount? }`, siempre del lado de quien lo manda. 400 (literales): "Tipo de punto inválido", "El detalle es obligatorio", "El detalle no puede estar vacío", "El detalle puede tener hasta 300 caracteres", "Un punto de dinero necesita un monto mayor a 0", "El monto puede ser hasta 1.000.000.000", "Solo un punto de dinero lleva monto". **409** "Hasta 20 puntos por lado".
- **201:** `{ agreement }` (completo, con la versión nueva).

### `PATCH` / `DELETE /api/patrocinios/:empresaId/:projectId/puntos/:puntoId` — Auth, la parte dueña del punto
- Un punto del otro lado o que no existe: **404** "Punto no encontrado". `PATCH` es parcial (`type`, `detail`, `amount`) y valida el resultado combinado; pasar de `money` a otro tipo sin mandar `amount` borra el monto.
- **200:** `{ agreement }`.

**Reglas de los tres cambios:** solo con el acuerdo `propuesto` (si no, **409** "El acuerdo ya está cerrado: no se puede cambiar"). Dentro de `db.transaction`, primero `UPDATE … SET version = version + 1 … AND estado = 'propuesto'` (si no cambia nada, 409: cubre también un acuerdo que se cierra en el medio) y después el cambio del punto. En Postgres ese `UPDATE` bloquea la fila: dos cambios a la vez se ordenan y la versión sube dos veces. Los cambios de puntos no avisan (sería mucho ruido); la charla, aceptar y rechazar sí.

### `POST /api/patrocinios/:empresaId/:projectId/aceptar` — Auth, una de las partes (§264)
- **Body:** `{ version }` (entero ≥ 1: la versión que vio quien acepta; si no, **400** "version inválida").
- Versión que ya no es la vigente: **409** "El acuerdo cambió: revisalo de nuevo". Cerrado: **409** "El acuerdo ya está cerrado: no se puede cambiar".
- En una transacción (`acceptVersion`, la usa también el `PATCH` de la ONG): guarda la aceptación solo si la versión sigue vigente y el acuerdo `propuesto`; después lo cierra si las dos coinciden (compare-and-swap: con dos aceptaciones a la vez, se cierra una sola vez).
- Aviso a la otra parte: `sponsorship_closed` si este pedido lo cerró; si no, `sponsorship_accepted_by_other`. **200:** `{ agreement }`.

### `POST /api/patrocinios/:empresaId/:projectId/rechazar` — Auth, una de las partes (§264)
- `propuesto` → `rechazado` (compare-and-swap; cerrado: 409). Aviso `sponsorship_rejected`. **200:** `{ agreement }`. La empresa puede volver a proponer (`POST /api/empresas/me/patrocinios`): versión nueva, aceptada por la empresa y no por la ONG.

### `POST /api/patrocinios/:empresaId/:projectId/mensajes` — Auth, una de las partes (§264)
- **Body:** `{ body }` (`checkText`, obligatorio, hasta 1000; se guarda sin espacios en los bordes). Solo con el acuerdo `propuesto` (`INSERT … SELECT … WHERE estado = 'propuesto'`; cerrado: 409): después es de solo lectura. No cambia la versión. Aviso `sponsorship_message` a la otra parte. **201:** `{ agreement }`.

## Patrocinio (Empresa ↔ Proyecto) — `routes/empresas.js` + `routes/ngos.js`

> Agregado 2026-09 (roadmap punto 5). Usa `empresa_voluntariados`, que existía sin API — ahora con columnas `estado` (`propuesto`/`aceptado`/`rechazado`), `mensaje` y `updated_at` agregadas vía `ALTER TABLE` en `scripts/migrate.js`.

### `POST /api/empresas/me/patrocinios` — Auth, role `company`
- **Body:** `{ project_id, mensaje? }`. El proyecto debe existir y estar `active` (si no, `404`). `project_id` falta → **400** "project_id requerido"; no es texto → **400** "project_id inválido". `mensaje` opcional, texto de hasta 1000 caracteres (`checkText`; si no → **400**); `null` o vacío se guarda como `null` (`PROJECT_ANALYSIS.md §140`).
- Crea la propuesta en estado `propuesto`. Si ya existe una propuesta **rechazada** con ese proyecto, la reutiliza (resetea a `propuesto`) en vez de fallar — así se puede volver a proponer. Si ya existe una `propuesta`/`aceptada` sin decidir o vigente, `409` "Ya existe una propuesta de patrocinio con este proyecto".
- **Concurrencia (`PROJECT_ANALYSIS.md §140`, regla 21):** dos propuestas simultáneas al mismo proyecto → una 201 y la otra **409** (el INSERT protegido con `isUniqueViolation`; antes 500 en Postgres). Al re-proponer tras un rechazo, el UPDATE es compare-and-swap (`AND estado='rechazado'`, mirando `changes`): solo una pasa a `propuesto` y solo esa notifica; las demás, 409.
- Notifica a la ONG (in-app + email, fire-and-forget).
- **Respuesta 201:** `{ message }`.

### `DELETE /api/empresas/me/patrocinios/:projectId` — Auth, role `company`
- Retira una propuesta propia **solo si sigue en `propuesto`** (no se puede retirar una ya aceptada/rechazada). `404` si no aplica.

### `GET /api/empresas/me/patrocinios` — Auth, role `company`
- Todas las propuestas de la empresa logueada (cualquier estado), con datos del proyecto y de la ONG ya resueltos (sin N+1).

### `GET /api/ngos/me/patrocinios` — Auth, role `ngo`
- Todas las propuestas de patrocinio (cualquier estado) sobre los proyectos de la ONG logueada, con datos de la empresa ya resueltos.

### `PATCH /api/ngos/me/patrocinios/:empresaId/:projectId` — Auth, role `ngo`
- **Desde §264, `aceptado` = aceptar la versión vigente del acuerdo** (`acceptVersion`): si la empresa también la aceptó, se cierra como siempre (200 "Propuesta aceptada", aviso `sponsor_accepted` y mail); si no (cambiaron los puntos después de proponer), queda `propuesto`, responde **200** "Aceptaste esta versión del acuerdo; falta que la empresa la acepte" y avisa a la empresa (`sponsorship_accepted_by_other`). `rechazado` sigue igual.
- **Body:** `{ estado: 'aceptado' | 'rechazado' }`.
- Autorización por `JOIN` a `projects.ngo_id` en el `WHERE` (nunca se confía en los IDs de la URL sin validar dueño) → `404` si la propuesta no existe o no es de un proyecto propio.
- `409` si la propuesta ya fue decidida antes (no se puede revertir una decisión por acá).
- **Concurrencia (`PROJECT_ANALYSIS.md §77`):** el `UPDATE` es compare-and-swap (`... AND estado='propuesto'`). Si dos decisiones llegan a la vez, solo una cambia la fila (200); la otra responde el mismo `409` y no notifica.
- Notifica a la empresa (in-app + email), solo la decisión que ganó.
- **Respuesta 200:** `{ message }`: **"Propuesta aceptada"** o **"Propuesta rechazada"** según `estado` (antes interpolaba el valor de la DB y decía "Propuesta aceptado"/"rechazado"; `PROJECT_ANALYSIS.md §153`). `NGOPatrocinios.tsx` descarta la respuesta y no lo muestra.

---

## Chatbot FAQ (`routes/faqs.js`)

> Agregado 2026-09 (roadmap punto 9). Explícitamente **sin IA**: matching por keywords, sin embeddings ni LLM. Stateless — no hay tabla de historial de conversación.
>
> Las FAQs las carga `scripts/migrate.js`. Si la pregunta ya existe, **actualiza la respuesta** (no `activo` ni el resto de la fila): antes solo insertaba las nuevas y una base ya migrada se quedaba con el texto viejo (D24, §246). No hay forma de editar FAQs desde la app, así que el código es la fuente. Las respuestas nombran pantallas y botones del frontend: si se renombra uno, hay que cambiarlas (`test/integration/faqs-ui-names.test.js`).

### `GET /api/faqs?categoria=voluntario` — Público
- Catálogo completo (para listar como acordeón), opcionalmente filtrado por `categoria` (`voluntario`/`ngo`/`general`).
- **Respuesta 200:** `{ faqs: [{ id, categoria, pregunta, respuesta }] }`.

### `POST /api/faqs/ask` — Público
- **Body:** `{ question, categoria? }`.
- Trae todo el pool de FAQs activas (tabla chica por diseño, sin pre-filtro SQL) y puntúa por coincidencia de keywords en JS (substring bidireccional, sin heurísticas de prefijo — ver comentarios en el código sobre por qué se descartó esa idea).
- **Respuesta 200 con match:** `{ matched: true, best: Faq, alternatives: Faq[] }`.
- **Respuesta 200 sin match:** `{ matched: false, suggestions: [{id, pregunta}] }` (nunca deja al frontend sin nada que mostrar).
- **400** si `question` falta o tiene menos de 3 caracteres ("La pregunta es muy corta"), si `question` o `categoria` no son texto, o si `question` pasa de 500 caracteres o `categoria` de 50 (`checkText`, `PROJECT_ANALYSIS.md §139`; antes un `question` que no era texto daba 500 en los dos motores, y un `categoria` objeto también en SQLite).
- Solo FAQs con `activo` verdadero, en las dos rutas. El filtro es `activo=true` (no `activo=1`: en Postgres la columna es BOOLEAN y daba 500 siempre, `PROJECT_ANALYSIS.md §51`). Tests: `test/integration/faqs.test.js`.

---

## Follows y Feed personalizado (`routes/follows.js`)

> Agregado por el usuario (2026-09), documentado retroactivamente tras la revisión de código (ver `PROJECT_ANALYSIS.md §28`). Cubre 3 tipos de "seguir": Voluntario→ONG (`ngo_follows`), Voluntario→Proyecto (`project_follows`) y Voluntario→Voluntario (`volunteer_follows`, tabla nueva). Todo bajo `/api/follows`.

**Importante para cualquier endpoint nuevo que devuelva proyectos:** este router **reusa `fmt` exportado desde `routes/projects.js`** (`const { fmt: fmtProject } = require('./projects')`) — no mantener una copia propia del formateador acá ni en ningún router nuevo. Una copia duplicada ya se desincronizó una vez (le faltaban `latitude`/`longitude`/`modality`) y causó un bug real, arreglado en `PROJECT_ANALYSIS.md §29`.

**Seguir / dejar de seguir (los 3 tipos) es idempotente y seguro bajo concurrencia (`PROJECT_ANALYSIS.md §77`):** el helper `toggleFollow` hace, en una transacción, `INSERT ... ON CONFLICT DO NOTHING` (o el `DELETE`) y mueve el contador `followers` **solo si la fila cambió** (`changes === 1`). Repetir el pedido, o mandarlo varias veces a la vez, responde 200 sin tocar el contador. La notificación `new_follower` sale después del COMMIT y solo por un follow real.

### ONG (`ngo_follows`)
- `POST /ngo/:ngoId` / `DELETE /ngo/:ngoId` — seguir/dejar de seguir (auth, `volunteer`). El `POST` da **404** si la ONG no existe (el `DELETE` no lo chequea: 200 igual).
- `GET /ngo` — mis ONGs seguidas (auth, `volunteer`).
- `GET /ngo/:ngoId/status` — ¿la sigo? (público, `optionalAuth`).

### Proyecto (`project_follows`)
- `POST /project/:projectId` / `DELETE /project/:projectId` — seguir/dejar de seguir (auth, `volunteer`). El `POST` da **404** si el proyecto no existe.
- `GET /project` — mis proyectos seguidos (auth, `volunteer`).
- `GET /project/:projectId/status` — ¿lo sigo? (público, `optionalAuth`).

### Voluntario (`volunteer_follows`)
- `POST /volunteer/:userId` / `DELETE /volunteer/:userId` — seguir/dejar de seguir a otro voluntario (auth, `volunteer`). Seguirse a sí mismo → **400** "No podés seguirte a vos mismo" (lo corta el handler antes del CHECK de la base); un usuario que no existe o no es voluntario → **404** "Voluntario no encontrado".
- `GET /volunteer/following` / `GET /volunteer/followers` — mis seguidos/seguidores (auth, `volunteer`; otro rol → 403).
- `GET /volunteer/:userId/status` — ¿lo sigo? (público).
- `GET /volunteer/:userId/followers` / `GET /volunteer/:userId/following` — listas públicas de otro usuario.

### Feed
- `GET /feed` (auth, `volunteer`) — proyectos de las ONGs/proyectos seguidos, con `my_enrollment_status` resuelto por proyecto (batched, sin N+1) y formateados con el mismo `fmt` de `/api/projects` (incluye `latitude`/`longitude`/`modality`). Cada reseña de `ratings` tiene **la misma forma que en `GET /api/projects/:id`**: `{ id, project_id, user_id, rating, comment, created_at, user_name, user_avatar }` (el SELECT es uno solo, `RATINGS_SELECT` de `routes/projects.js`). Antes el feed no mandaba `user_id` (que el tipo `Rating` de `api.ts` declara obligatorio); lo prueba `test/integration/feed-ratings-shape.test.js`. `user_avatar` se había sacado porque nadie lo leía y volvió en §133 (la foto en `ReviewsModal`; `null` si no tiene). En los dos lugares vienen ordenadas `r.created_at DESC, r.id` (§122).
- **Paginación:** `limit` (default 20, máx. 50) y `offset` (default 0) por query; no se acotan por abajo (un negativo no da error: la sonda de la tercera pasada dio 200 en los dos motores). **Respuesta 200:** `{ projects, total }`, donde `total` es la cantidad de proyectos distintos del feed sin paginar (`Number()`, en Postgres el `COUNT` llega como string). Sin follows: `{ projects: [], total: 0 }`.
- **`recent_comments`:** los 3 comentarios más nuevos del proyecto, con **la misma forma que `comments` de `GET /api/projects/:id`** (interface `AppComment`): `id`, `project_id`, `user_id`, `comment`, `created_at`, `user_name`, `user_avatar` e `is_participant` (`1` si quien comentó tiene la inscripción aprobada en ese proyecto, `0` si no). `comments_count` es el total. *(REVISION A2, `PROJECT_ANALYSIS.md §135`: antes faltaban `user_id` y `project_id` —el link al autor en `FeedPostCard` iba a `/volunteer/undefined`— e `is_participant` salía `true`/`false`.)*
- Además de `fmt`, cada proyecto trae `my_enrollment_status` (o `null`), `follow_source` (`ngo_follow`/`project_follow`/`both`) y `follow_label`.

---

## Publicaciones — "Momentos" (`routes/posts.js`)
> Agregado 2026-10 (`PROJECT_ANALYSIS.md §43`). Fotos de los voluntariados en los que se participó, estilo Instagram. Las fotos viven en Cloudinary (`lib/storage.js`); la base guarda solo URL, `public_id`, orden y medidas.

**Forma de una publicación** (todas las respuestas; claves exactas, verificadas por tests):
```json
{
  "id": "…", "caption": "Un día increíble" ,
  "created_at": "2026-10-04T12:30:45.000Z",
  "author":  { "id": "…", "name": "María García", "avatar": "https://…", "role": "volunteer" },
  "project": { "id": "proj-1", "title": "Reforestación Urbana" },
  "photos": [{ "id": "…", "url": "…/upload/f_auto,q_auto,w_1080,c_limit/…", "thumb_url": "…/upload/f_auto,q_auto,w_480,h_480,c_fill,g_auto/…", "width": 1600, "height": 1200 }],
  "likes_count": 3, "liked_by_me": false, "can_delete": false
}
```
`created_at` sale **siempre en ISO 8601 UTC** (en SQLite la base devuelve un string sin zona y en Postgres un `Date`: se normaliza). `url` es la foto optimizada para el feed y `thumb_url` una miniatura cuadrada; el `public_id` de Cloudinary **no se expone**. **`can_delete`** lo calcula el servidor según quién mira, con la misma regla que `DELETE /api/posts/:id` (el autor, o la ONG dueña del proyecto); es siempre un booleano (`false` sin sesión). El cliente no puede deducirlo solo: del post conoce el id del usuario autor, pero no quién es la ONG dueña del proyecto.

### `GET /api/posts/eligible-projects` — Auth, role `volunteer` o `ngo`
- **Respuesta 200:** `{ projects: [{ id, title }] }`. Un voluntario: proyectos con inscripción **aprobada** (una pendiente no cuenta). Una ONG: sus propios proyectos. Es lo que alimenta el selector del compositor.
- **Errores:** `401`; `403` si el rol es `company`.

### `POST /api/posts` — Auth, role `volunteer` o `ngo`; `multipart/form-data`
- **Campos:** `project_id` (obligatorio), `caption` (opcional, ≤ 500 caracteres, filtro de lenguaje inapropiado), `photos` (1 a 5 archivos JPEG/PNG/WebP, ≤ 8 MB c/u: **8.000.000 bytes**, no 8 MiB, §232).
- **Quién puede publicar:** un voluntario con inscripción **aprobada** en ese proyecto (también cuando ya terminó), la **ONG dueña** o, desde §295, un **miembro activo de su equipo** (coordinador o comunicador). `GET /api/posts/eligible-projects` suma los voluntariados de esas ONG. Una empresa, una ONG ajena, una inscripción pendiente o sin inscripción → `403`.
- **Orden de las validaciones (deliberado):** sesión y rol → ¿Cloudinary configurado? (`503`) → lectura del formulario (`413` si una foto pesa más de 8 MB; `400` si hay más de 5 o un tipo no permitido) → campos (`400`) → el proyecto existe (`404`) → permiso (`403`) → límite de frecuencia (`429`: más de 10 publicaciones en la última hora por usuario) → **cabecera real de cada archivo** (`400`; el `mimetype` lo declara el cliente y no se confía en él) → recién ahí se sube. Todo se valida **antes** de subir, para no gastar cuota de Cloudinary en pedidos inválidos.
- **Subida y atomicidad:** las fotos se suben en paralelo; si alguna falla se **borran las que sí se subieron** y se responde `502` (sin detalles internos). El post y sus fotos se guardan en una sola transacción **después** de las llamadas externas; si esa transacción falla también se limpia lo subido.
- **Respuesta 201:** `{ post }`.

### `GET /api/posts` — Auth opcional
- **Query:** `project_id`, `user_id` (filtros; sirven para la galería de un proyecto y la grilla de un perfil), `ngo_id`, `limit` (default 12, máx. 30; inválido → default), `offset` (default 0; inválido → 0). Los filtros se combinan entre sí (todos a la vez, `AND`) y con la paginación.
- **`ngo_id` (`REVISION.md` S2):** id de la tabla `ngos` (el `id` de `GET /api/ngos/me` o de `GET /api/ngos/:id`; **no** el id del usuario de la ONG). Devuelve las publicaciones de los **proyectos** de esa ONG, sea quien sea el autor (voluntarios o la propia ONG). Lo usa el panel de la ONG (`/ngo/momentos`). Una ONG inexistente o sin publicaciones → `200` con `posts: []`. A diferencia de `project_id`/`user_id` (que vacíos se ignoran), un `ngo_id` **vacío o solo espacios, repetido (`?ngo_id=a&ngo_id=b`) o de más de 100 caracteres → `400`** con `{ error }` en español: un error del cliente no tiene que terminar mostrando el feed general. Se recortan los espacios de los costados.
- **Respuesta 200:** `{ posts: [...], has_more }`. Más nuevas primero (desempate por id). Paginación por `limit/offset`: si entran publicaciones nuevas mientras se pagina pueden correrse las páginas; el cliente debe deduplicar por `id`. `liked_by_me` es `false` sin sesión. Tres consultas por página (no una por publicación).

### `GET /api/posts/:id` — Auth opcional
- **Respuesta 200:** `{ post }`. `404` si no existe.

### `POST /api/posts/:id/like` y `DELETE /api/posts/:id/like` — Auth (cualquier rol)
- **Respuesta 200:** `{ liked: true|false, likes_count }`. **Idempotentes**: repetir el like (doble click, pedidos simultáneos) no suma ni falla; quitar uno que no existe no deja el contador en negativo. `404` si el post no existe.

### `DELETE /api/posts/:id` — Auth
- **Quién:** el autor, o la **ONG dueña del proyecto** (moderación: puede borrar cualquier publicación de él). Otro voluntario, una ONG ajena o una empresa → `403`. Una publicación que no existe → **`404`** "Publicación no encontrada".
- **Efecto:** borra post, fotos y likes en una transacción; **después del COMMIT** y sin esperar, borra los archivos de Cloudinary (mejor esfuerzo: si falla, el post se borra igual y se loguea). **Respuesta 200:** `{ message }`.

## Voluntarios (`routes/voluntarios.js`)

### `GET /api/voluntarios/me/habilidades` — Auth, role `volunteer`
- **Respuesta 200:** `{ habilidades: [{ id, nombre, descripcion, nivel }] }` — las habilidades del voluntario logueado, vía `JOIN` a `habilidades`. Devuelve `[]` si todavía no cargó ninguna.

### `PUT /api/voluntarios/me/habilidades` — Auth, role `volunteer`
- **Body:** `{ habilidades: [{ habilidad_id, nivel? }] }` — `nivel` es `'basico'` (default), `'intermedio'` o `'avanzado'`.
- **Comportamiento:** reemplaza el conjunto completo (borra todas las filas previas de `voluntario_habilidades` para ese usuario e inserta las nuevas) — más simple para la UI que calcular altas/bajas/cambios de nivel. Igual patrón que la categoría de ONG (`PUT /api/ngos/me`). El DELETE y los INSERT van en **una transacción**: si algo falla, quedan las habilidades anteriores. Un `habilidad_id` **repetido** se guarda una sola vez, con el nivel de la **última** aparición (antes daba 500 y dejaba al voluntario sin habilidades, `PROJECT_ANALYSIS.md §58`). Tests: `test/integration/habilidades.test.js`.
- **Validación:** máximo 20 habilidades, cada `habilidad_id` debe existir en el catálogo (`habilidades`), `nivel` debe ser uno de los tres valores válidos.
- **Respuesta 200:** `{ habilidades: [...] }` (el conjunto ya actualizado, mismo formato que el `GET`).
- **Errores:** `400` (formato inválido, habilidad inexistente, nivel inválido), `403` si el usuario no es `volunteer`.

### CV del voluntario (`PROJECT_ANALYSIS.md §165`)
> `voluntarios.cv_url` guarda el **public_id de un PDF privado** de Cloudinary (`lib/storage.js`, §164), nunca una URL pública, y **no sale por ninguna respuesta**: `/auth/me` devuelve `has_cv` y el perfil público no lo menciona.

**`PUT /api/voluntarios/me/cv`** — Auth, role `volunteer`. Sube o reemplaza el CV.
- **Body:** `multipart/form-data` con un archivo en el campo **`cv`**: PDF (`application/pdf` y cabecera real `%PDF-`), hasta **5 MB**.
- **Respuesta 200:** `{ has_cv: true }`. Si había uno anterior, **se borra de Cloudinary** (decisión C3). Si ese borrado falla, solo se loguea: el viejo es privado y ya nadie tiene su id.
- **Errores (sin subir nada antes de validar):** `401` · `403` (otro rol) · `429` con `Retry-After`, pasadas **10 subidas por hora** por usuario (en memoria) · `503` sin Cloudinary · `400` "El CV tiene que ser un PDF" (tipo declarado), "Elegí un archivo PDF" (sin archivo o en otro campo) o "El archivo no es un PDF válido" (cabecera) · `413` "El CV puede pesar hasta 5 MB" · `404` sin fila en `voluntarios` · `502` si falla Cloudinary (el anterior sigue) · `500` "Error al guardar el CV" si falla la base (se borra lo subido) · **`409`** "Se estaba guardando otro CV al mismo tiempo. Probá de nuevo." Esto último pasa si el CV cambió mientras se subía: el `UPDATE` es *compare-and-swap* sobre el valor leído antes de subir, y se borra lo recién subido.

**`DELETE /api/voluntarios/me/cv`** — Auth, role `volunteer`.
- **Respuesta 200:** `{ has_cv: false }`. Pone `cv_url` en `NULL` (con CAS) y después borra el PDF de Cloudinary; si ese borrado falla, solo se loguea. Sin CV cargado responde lo mismo, sin llamar a Cloudinary.
- **Errores:** `401` · `403` · `404` sin fila en `voluntarios` · `409` si cambió al mismo tiempo.

**`GET /api/voluntarios/:userId/cv`** — Auth (cualquier rol). Link de descarga.
- **Quién (decisión C1):** el propio voluntario, o una **ONG con una inscripción `pending` o `approved` de ese voluntario en un proyecto suyo** (las `rejected`/`cancelled` no alcanzan). Una empresa u otro voluntario, nunca.
- **Respuesta 200:** `{ url, expires_at }`. `url` es un link firmado de Cloudinary que **vence a los 10 minutos** (`expires_at`, ISO): hay que pedirlo cada vez, no guardarlo.
- **Errores:** `401` · **`404` "CV no disponible"** si no tiene permiso, **o** si no hay CV, o si el id no es de un voluntario: es el mismo mensaje en los tres casos, para no revelar quién cargó uno. Se chequea el permiso antes que la existencia · `503` sin Cloudinary (solo a quien tiene permiso).
- Tests: `test/integration/cv.test.js`; el caso de la ONG ajena también está en `ownership.test.js` (regla 15).

### `GET /api/voluntarios/:userId` — Público
- Agregado por el usuario (2026-09). Perfil público de un voluntario: datos básicos + `followers`/`following_count` + últimas participaciones (`LIMIT 20`). Sin auth requerida.
- **Respuesta 200:** `{ volunteer, habilidades, stats, participaciones }`. `habilidades`: `[{ id, nombre, descripcion, nivel }]` (como `GET /me/habilidades`). `stats`: `{ total_enrollments, approved_enrollments, total_horas }`, normalizados con `Number()`. `participaciones`: solo inscripciones aprobadas, con datos del proyecto y la ONG (nombres de columna crudos: `titulo`, `ubicacion`, `tipo`, `horas_realizadas`…). **404** si el usuario no existe o no es voluntario.
- Nota: mezcla campos en inglés (`name`, `avatar`, `bio`, `location`) con algunos crudos en español (`nombre`, `apellido`, `descripcion`) en la misma respuesta — no es un bug, pero al tocar este endpoint conviene normalizar del todo a inglés en vez de sumar más campos híbridos.

---

## Mensajes / Chat (`routes/messages.js` + `src/ws/index.js`)

Chat 1 a 1 básico. El historial y el envío tienen doble vía: REST (siempre disponible, fuente de verdad) y WebSocket (tiempo real, cuando el destinatario está conectado).

### `GET /api/messages/conversations` — Auth
- **Respuesta 200:** `{ conversations: [{ user: {id,name,avatar,role}, last_message, last_at, last_from_me, unread }] }` — una fila por cada persona con la que el usuario logueado tiene al menos un mensaje, ordenadas por el más reciente primero.

### `GET /api/messages/thread/:userId` — Auth
- **Respuesta 200:** `{ messages: [{id,sender_id,receiver_id,body,read,created_at}], other: {id,name,avatar,role} }` — hasta los últimos 300 mensajes con esa persona, orden cronológico ascendente (subconsulta `ORDER BY created_at DESC, id DESC LIMIT 300` y después ascendente; hasta `PROJECT_ANALYSIS.md §61` devolvía los 300 **más viejos**). No hay paginación: los anteriores a esos 300 no se pueden ver.
- **Errores:** `404` si `userId` no existe.

### `POST /api/messages` — Auth
- **Body:** `{ to, body }`.
- **Validación:** `to` ausente o vacío → **400** "Falta el destinatario" (lo corta el handler REST); `to` que no es string → "Destinatario inválido"; `body` no vacío, máx. 2000 caracteres, no podés mandarte a vos mismo, el destinatario debe existir. Esos errores son `MessageInputError` (`routes/messages.js`): los únicos cuyo texto se le muestra al usuario, por REST y por WebSocket (`PROJECT_ANALYSIS.md §87`).
- **Efecto:** persiste el mensaje; si el destinatario tiene una conexión de WebSocket abierta, se lo empuja en tiempo real (`sendToUser`).
- **Respuesta 201:** `{ message: {...} }`. **Errores:** `400` con el mensaje de la validación (también "Destinatario no encontrado": este doc decía 404, el código siempre dio 400); `500` genérico ante cualquier error interno.

### `PATCH /api/messages/thread/:userId/read` — Auth
- Marca como leídos todos los mensajes que `userId` le mandó al usuario logueado.
- **Respuesta 200:** `{ success: true }`.

### WebSocket — `ws://host/ws?token=<jwt>`
- **Autenticación:** el mismo JWT que usa el resto de la API, pasado por query string (no hay un segundo login para el chat). Si el token falta o es inválido, el servidor cierra la conexión con código `4001` inmediatamente después de aceptarla.
- **Al conectar:** el servidor manda `{ type: 'connected' }`.
- **Mensajes entrantes (servidor → cliente):** `{ type: 'message', message: {...} }` cuando alguien te escribe (ya sea que el otro lo haya mandado por REST o por WS).
- **El socket es solo de recepción** (`PROJECT_ANALYSIS.md §100`, decisión del usuario): lo que mande el cliente se ignora. Hasta §100 aceptaba `{ type: 'send', to, body }` como atajo; desde §92 el cliente web manda siempre por `POST /api/messages`.
- **Errores:** el socket ya no manda `{ type: 'error' }` (no hay envíos que rechazar). Los errores del envío vuelven en la respuesta de `POST /api/messages` (§92).
- **Límites:** `maxPayload` 64 KB (§87): un frame más grande cierra la conexión con `1009`. El límite de frecuencia del socket se sacó junto con el envío (§100); `POST /api/messages` no tiene límite de frecuencia (en REST solo login y registro tienen límite, §103).
- **Multi-dispositivo:** un mismo usuario puede tener varias conexiones abiertas (pestañas/dispositivos); todas reciben los mensajes entrantes.
- **Límite conocido:** el registro de conexiones es un `Map` en memoria de un solo proceso Node — no hay backplane compartido (Redis u otro) entre instancias. Ver `PROJECT_ANALYSIS.md §18` para el detalle.

---

## Notifications (`routes/notifications.js`)

### `GET /api/notifications` — Auth
- **Respuesta 200:** `{ notifications: Notification[], unread }` del usuario, más recientes primero y **a lo sumo 50**. `unread` es un número: cuántas del usuario no están leídas **en total** (`COUNT(*)` aparte en SQL, `read = false OR read IS NULL`, normalizado con `Number()`), no solo entre las 50 de la lista. Antes se contaba en JS sobre esas 50 y con más de 50 sin leer quedaba corto (`PROJECT_ANALYSIS.md §154`). Test: `test/integration/notifications-unread.test.js`.
- **Columnas (lista blanca, regla 8, §159):** cada notificación trae `id, user_id, type, title, body, read, data, created_at` (las mismas que el `SELECT *` de antes; una columna nueva de la tabla no sale hasta agregarla en `routes/notifications.js`). Test: `test/integration/notifications-columns.test.js`.

### `PATCH /api/notifications/:id/read` — Auth (dueño)
- Marca una notificación puntual como leída. **Nota de implementación:** el `UPDATE` usa el literal SQL `read=true` (no un parámetro bindeado) — funciona porque SQLite moderno (bundlado por `better-sqlite3`) soporta el literal `TRUE`, pero es una inconsistencia de estilo respecto al resto del código, que siempre usa placeholders `$n`.
- **Respuesta 200:** `{ message: 'Marcada como leída' }` (esta doc decía `{ success: true }`). Una notificación inexistente o ajena también da 200 (no toca nada).

### `PATCH /api/notifications/read-all` — Auth
- Marca todas las notificaciones del usuario logueado como leídas.
- **Respuesta 200:** `{ message: 'Todas marcadas como leídas' }` (esta doc decía `{ success: true }`).

---

## Catálogos (`src/index.js`, sin archivo de ruta propio)

### `GET /api/categorias` — Público
- **Respuesta 200:** `{ categorias: Categoria[] }` — catálogo completo, sin paginar.

### `GET /api/roles` — Público
- **Respuesta 200:** `{ roles: Rol[] }` — catálogo completo de roles de voluntariado.

### `GET /api/habilidades` — Público
- **Respuesta 200:** `{ habilidades: Habilidad[] }` — catálogo completo de habilidades.

### `GET /api/stats` — Público
- **Respuesta 200:** `{ active_projects, volunteers, ngos }`, números: proyectos con `status = 'active'`, perfiles de `voluntarios` y filas de `ngos`. Los `COUNT` se normalizan con `Number(x) || 0` (en Postgres llegan como string). Los usa la portada (`PublicFeed`) en lugar de los números fijos que tenía (`PROJECT_ANALYSIS.md §129`). Está en `public-columns.test.js`.

### `GET /health` — Público (fuera de `/api`)
- **Respuesta 200:** `{ status: 'ok', timestamp, commit }` — usado por Render para health checks. `commit` es `RENDER_GIT_COMMIT` (el commit desplegado; `null` en local), leído en cada pedido: el pipeline de deploy espera a verlo antes del smoke (`PROJECT_ANALYSIS.md §193`). No consulta la base.

---

## Donaciones (`routes/donaciones.js`) — Mercado Pago, modo prueba (`PROJECT_ANALYSIS.md §170`)

> Backend completo desde §171 (alta, aviso y conciliación); frontend desde §172 (`DonateModal`, `/donaciones/vuelta`). Falta la prueba real (Etapa 10 de `PLAN_FALTANTE.md`). Diseño en `BACKEND_ROADMAP_ANALYSIS.md §1.4`.

### `POST /api/donaciones` — Auth, role `volunteer` o `company`
- **Body:** `{ project_id, amount }`. `amount` es un **número entero de pesos** entre **100** y **500.000**: un string, un decimal, un booleano o un array dan **400**. Se exige entero porque `monto` y `recaudado` son `REAL`, que en Postgres es `float4` (~7 dígitos), y con centavos "lo pagado coincide con lo donado" fallaría por redondeo.
- **Efecto:** inserta la donación con estado **`pendiente`** (explícito: el `DEFAULT` de la tabla es `'completada'`), `moneda='ARS'`, `ngo_id` del proyecto y el id generado en el código (regla 23). Después crea la preferencia de Checkout Pro (`payments.createPreference`): `external_reference` es el id de la donación, la vuelta es `APP_URL/donaciones/vuelta`. **No se manda `notification_url`** (§175): en producción, los avisos que disparaba no pasaban la firma y llegaban junto con IPN. El aviso que vale es el del **webhook configurado en el panel de Mercado Pago** (`/api/donaciones/webhook`), y la conciliación de `GET /:id` cubre el resto. Guarda el id de la preferencia en `external_id`. **No suma nada a `recaudado`**: eso pasa solo cuando Mercado Pago confirma el pago (`applyPayment`).
- **Marketplace (§217): se cobra con la cuenta de la ONG.**
  - Antes de insertar, `sellerAccounts.getValidToken(ngo_id)` da el token de la ONG y lo renueva si faltan menos de 7 días.
  - La preferencia se crea con ese token, sin comisión, y la donación guarda `cobrador_mp_user_id`.
  - **Una ONG sin cuenta vinculada no recibe donaciones** (decisión del usuario).
  - `MP_ACCESS_TOKEN` ya no hace falta para donar: solo para conciliar las donaciones de antes de §217.
- **Respuesta 201:** `{ donation_id, checkout_url }`. El frontend redirige a `checkout_url`.
- **Errores:** `401` · `403` (ONG) · `429` con `Retry-After`, pasadas **10 donaciones por hora** por usuario (en memoria) · **`409` "Esta ONG todavía no recibe donaciones"** (sin cuenta vinculada, §217) · **`503` "Esta ONG no puede recibir donaciones en este momento"** (la cuenta requiere reconexión, falta `MP_TOKEN_KEY`, la renovación falló con el token ya vencido, o Mercado Pago respondió 401 al crear la preferencia: en ese caso la cuenta pasa a requerir reconexión y la donación queda `fallida`). Hasta §216 había un `503` "Las donaciones no están disponibles por el momento" cuando faltaba `MP_ACCESS_TOKEN`; ya no existe · `400` "Falta el proyecto", "El monto tiene que ser un número entero de pesos", "El monto mínimo es de $100" o "El monto máximo es de $500.000" · `404` "Proyecto no encontrado o no recibe donaciones" (no existe o no está `active`) · `502` "No pudimos iniciar el pago…" si Mercado Pago falla: la donación queda `fallida` con `external_status='preference_error'`.

### `POST /api/donaciones/webhook` — Público (aviso de Mercado Pago, §171)
- **Webhook** `?type=payment&data.id=<id>` con los headers `x-signature` y `x-request-id`: se verifica la firma (`payments.verifyWebhookSignature`, con `MP_WEBHOOK_SECRET`). El id que se usa es el de la **query**, que es lo firmado, **nunca el del cuerpo**. Después se llama a `applyPayment(data.id)`.
- **Marketplace (§217):**
  - El `user_id` del cuerpo (el vendedor) **no está firmado**. Solo se usa para elegir con qué token consultar el pago: el de la ONG dueña de esa cuenta, o el de la aplicación si no es de ninguna.
  - `applyPayment` exige además que la donación se haya cobrado con esa misma cuenta.
  - Si la cuenta de la ONG requiere reconexión, responde 500 para que Mercado Pago reintente.
- **IPN** `?topic=…&id=…`: según la doc oficial, no se puede validar con la clave. Se responde **200 sin procesarlo**, y la acreditación llega por el webhook o por la conciliación.
- **Log (§173):** cada aviso deja una línea `[donaciones] …` con el pago y el resultado de `applyPayment` (o "IPN ignorado", "firma inválida" con el `data.id` y, desde §175, si vino `x-request-id`, el `ts`, y del cuerpo `live_mode` y `user_id`, solo si son número o booleano, "tipo … ignorado", "Mercado Pago no lo encuentra"). La conciliación de `GET /:id` deja otra, con el pago, la donación y el resultado. Nunca se loguean la firma, los headers ni el secreto.
- **Respuestas:** `200 { received: true }` si se procesó, si es de otro tipo (`merchant_order`, etc.) o si Mercado Pago no encuentra el pago (reintentar no serviría) · `401 { error: "Firma inválida" }` (también si falta `MP_WEBHOOK_SECRET`) · `400` firmado pero sin `data.id` · **`500`** "No pudimos procesar el aviso" si falló Mercado Pago o la base, **para que Mercado Pago reintente** (cada 15 minutos; `applyPayment` es idempotente). No devuelve nada de la donación.

### `GET /api/donaciones/:id` — Auth (solo quien donó, §171)
- **Respuesta 200:** `{ donation: { id, status, amount, currency, project_id, project_title } }`. `status` va en inglés: `pending`, `completed`, `failed` o `refunded`.
- **Conciliación:** con `?payment_id=<id>` (Mercado Pago lo agrega a la URL de vuelta), si la donación sigue pendiente, el id es numérico (hasta 30 dígitos) y hay con qué consultar, se llama a `applyPayment(payment_id, { expectDonationId })`. "Hay con qué consultar" (§217) significa:
  - la cuenta de la ONG que cobró (`cobrador_mp_user_id`), si sigue vinculada;
  - o `MP_ACCESS_TOKEN`, si la donación es de antes de §217.

  Si la ONG desvinculó la cuenta, no se consulta. Eso solo acredita si el pago es **de esta donación**. Cubre el aviso perdido, por ejemplo con la API dormida. Si Mercado Pago falla, responde igual el estado actual. **Nunca** se usa el `status` de la URL de vuelta.
- **Errores:** `401` · `404` "Donación no encontrada" si no existe **o es de otra persona** (incluida la ONG que la recibe). Ese caso está en `ownership.test.js`.

### `applyPayment(paymentId, { expectDonationId? })` — exportada por `routes/donaciones.js` (no es un endpoint)
La **única** transición de una donación; la van a usar el aviso y la conciliación.
1. Consulta el pago a Mercado Pago (`payments.getPayment`). Nunca se usa el cuerpo del aviso ni la URL de vuelta.
2. Sin `external_reference` → `ignored`. Con `expectDonationId` distinto → `mismatch`. Donación inexistente → `unknown_donation`. **Pago leído con otra cuenta que la que cobró la donación** → `mismatch`, sin tocar nada (§217; `applyPayment(id, { accessToken, mpUserId })`, y sin ellos es la cuenta de la aplicación, que solo vale para `cobrador_mp_user_id` NULL).
3. Pago **no** `approved` (`rejected`, `cancelled`, `pending`, `in_process`) → `not_approved`: **no cambia el estado**, porque Mercado Pago deja reintentar con la misma preferencia; solo anota `external_status` si sigue `pendiente`.
4. `approved` con monto o moneda distintos → `amount_mismatch`: no se acredita y se loguea.
5. `approved` que coincide: en **una transacción**, un CAS `pendiente` → `completada` (guarda `external_payment_id`) y, si cambió una fila, `recaudado = recaudado + monto` → `credited`. Si ya estaba completada → `already`: un aviso repetido o simultáneo no suma dos veces.
6. Después del COMMIT avisa a la ONG con una notificación `donation_received`; si eso falla, la acreditación queda.
- Si Mercado Pago o la base fallan, **lanza**, y el que llama decide (el aviso va a responder 5xx para que Mercado Pago reintente).

## Cuenta de Mercado Pago de la ONG (`routes/mercadopago.js`) — Marketplace, modo prueba (`PROJECT_ANALYSIS.md §216`)

Montado en `/api/ngos/me/mercadopago`, **antes** que `/api/ngos` (`src/index.js`). Los cuatro piden Auth y rol `ngo` (401 sin sesión, 403 otro rol). Nunca devuelven tokens.

### `GET /api/ngos/me/mercadopago`
→ `{ account: null | { mp_user_id, status: 'active'|'needs_reconnect', origin: 'oauth'|'manual', expires_at: string|null }, oauth_available: boolean }`. `oauth_available` exige `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_OAUTH_REDIRECT_URI` y `MP_TOKEN_KEY`.

### `POST /api/ngos/me/mercadopago/connect`
→ `{ authorization_url }`.
- Genera un `state` de 32 bytes y guarda **solo su hash**, con 10 minutos de vida.
- Antes borra cualquier `state` anterior de la misma ONG.
- Sin configuración responde 503.

### `POST /api/ngos/me/mercadopago/callback` `{ code, state }`
Lo llama la pantalla del frontend a la que vuelve Mercado Pago, `/ngo/mercadopago/vuelta`, **con la sesión de la ONG**.
- Consume el `state`: tiene que ser de esa ONG, sin vencer, y de un solo uso (`DELETE` mirando `changes`).
- **Después**, ya fuera de toda transacción, llama a `payments.exchangeCode`.
- Guarda los tokens cifrados y responde `{ account }`.

| Situación | Respuesta |
|---|---|
| Sin `code` o sin `state`, `state` desconocido, de otra ONG o vencido | 400 |
| Mercado Pago responde `invalid_grant` | 400 |
| El token es productivo (`live_token`) | 400 |
| Otro error de Mercado Pago | 502 |
| Esa cuenta ya está vinculada a otra ONG | 409 |
| Sin configuración | 503 |

Si el intercambio falla, el `state` igual queda usado.

### `DELETE /api/ngos/me/mercadopago`
→ `{ disconnected: boolean }`. Borra la fila con los tokens. Mercado Pago no tiene un endpoint para que la aplicación revoque la autorización; la ONG la puede revocar desde su cuenta.

**Carga manual (no es un endpoint):** `MP_MANUAL_SELLER_TOKEN=… node scripts/vincular-mp-manual.js <ngo_id>`.
- Guarda el access token de un vendedor de prueba, sin OAuth. Es para cuando no hay `client_secret` (§215).
- Comprueba con `GET /users/me` que el usuario tenga el tag `test_user`.
- La cuenta queda con origen `manual`, sin refresh token ni vencimiento.
- Con `--solo-ver` (§221) solo muestra de quién es el token (`user_id`, nickname, tags) y no guarda nada.

## Endpoints ausentes (funcionalidad de esquema sin API)

Hoy no queda ninguna tabla sin API. *(`reuniones` dejó de estar en esta lista con §261: la usan las entrevistas, ver "Entrevistas" arriba; solo las atadas a una postulación. `donaciones` dejó de estar con §170: ver "Donaciones" arriba.* *`voluntario_habilidades` dejó de estar en esta lista — ya tiene API completa, ver sección "Voluntarios" arriba y `PROJECT_ANALYSIS.md §17`. El perfil de `empresas` tampoco — ver sección "Empresas" arriba. `empresa_voluntariados` tampoco — ver sección "Patrocinio" arriba y `PROJECT_ANALYSIS.md §26`. `ngo_follows`/`project_follows`/`volunteer_follows` tampoco — ya tienen API completa, ver sección "Follows y Feed personalizado" arriba y `PROJECT_ANALYSIS.md §28`.)*

## Endpoints duplicados o inconsistentes detectados

1. **Ninguna ruta está técnicamente duplicada** (no hay dos endpoints con el mismo método+path). Las inconsistencias de contrato que existían entre `POST /api/enrollments` (`mensaje` vs `message`) y entre las tres rutas de NGO respecto a `category` fueron corregidas — ver `PROJECT_ANALYSIS.md §13`.
2. **Falta de endpoint de edición/borrado de empleados** (`empleados` solo tiene `GET`/`POST`, no `PUT`/`DELETE`), inconsistente con el resto de recursos del sistema que sí ofrecen CRUD completo (proyectos, KPIs).
3. **Calificaciones (`ratings`):** no hace falta un `PUT /api/projects/:id/ratings/:ratingId` para editar: `POST /api/projects/:id/ratings` es un upsert y volver a mandarlo actualiza la reseña propia (el `UNIQUE(user_id, project_id)` garantiza una por persona y proyecto). Lo que falta es **borrar** una reseña: no hay `DELETE`. *(Esta viñeta decía "solo se puede crear una vez", lo que contradecía el upsert.)*
