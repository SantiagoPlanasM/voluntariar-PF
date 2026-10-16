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
| GET | `/api/projects` | Opcional | — | `routes/projects.js` |
| GET | `/api/projects/recommended` | Sí | volunteer | `routes/projects.js` |
| GET | `/api/projects/:id` | Opcional | — | `routes/projects.js` |
| POST | `/api/projects` | Sí | ngo | `routes/projects.js` |
| PUT | `/api/projects/:id` | Sí | ngo (dueño) | `routes/projects.js` |
| DELETE | `/api/projects/:id` | Sí | ngo (dueño) | `routes/projects.js` |
| POST | `/api/projects/:id/comments` | Sí | cualquiera | `routes/projects.js` |
| POST | `/api/projects/:id/ratings` | Sí | cualquiera | `routes/projects.js` |
| GET | `/api/projects/:id/kpis` | No | — | `routes/projects.js` |
| POST | `/api/projects/:id/kpis` | Sí | ngo (dueño) | `routes/projects.js` |
| PUT | `/api/projects/:id/kpis/:kpiId` | Sí | ngo (dueño) | `routes/projects.js` |
| DELETE | `/api/projects/:id/kpis/:kpiId` | Sí | ngo (dueño) | `routes/projects.js` |
| POST | `/api/enrollments` | Sí | volunteer | `routes/enrollments.js` |
| GET | `/api/enrollments/my` | Sí | cualquiera | `routes/enrollments.js` |
| GET | `/api/enrollments/project/:projectId` | Sí | ngo (dueño) | `routes/enrollments.js` |
| PATCH | `/api/enrollments/:id` | Sí | ngo (dueño) | `routes/enrollments.js` |
| DELETE | `/api/enrollments/:id` | Sí | dueño de la inscripción | `routes/enrollments.js` |
| PATCH | `/api/enrollments/:id/horas` | Sí | ngo (dueño del proyecto) | `routes/enrollments.js` |
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

### `POST /api/auth/register`
- **Body:** `{ name, email, password, role: 'volunteer'|'ngo'|'company', apellido? }` (no lee otros campos; `role` ausente = `volunteer`, fuera de la lista → **400** "Rol inválido").
- **Validación:** `validateName` (letras y espacios, 2–50), `validateEmail` (regex), `validatePassword` (mín. 8 caracteres, una mayúscula y un número, y **hasta 72 bytes UTF-8**: bcrypt ignora el resto; la ñ cuenta 2 y un emoji 4 → 400 "Máximo 72 caracteres (los acentos, la ñ y los emojis cuentan como más de uno)", `PROJECT_ANALYSIS.md §141`) — reglas duplicadas en `frontend/AuthModal.tsx`, con el mismo límite y mensaje. Todos deben ser strings (§76).
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
  - voluntario: `id, user_id, nombre, apellido, descripcion, ubicacion, foto_perfil, banner, cv_url, followers, created_at, updated_at`;
  - ONG: `id, user_id, nombre, descripcion, foto_perfil, banner, mision, alias, ubicacion, founded, followers, created_at, updated_at`;
  - empresa: `id, user_id, nombre, descripcion, mision, ubicacion, foto_perfil, banner, industria, followers, created_at, updated_at`.
  Con otro rol, o si el rol es uno de esos tres pero no hay fila, `profile` es `null` *(hasta §158, sin fila la clave no salía: `db.get` devuelve `undefined`)*. El frontend no lee `profile` (`api.auth.me` tipa `{ user }`). Una columna nueva de esas tablas no sale hasta agregarla a la lista en `routes/auth.js` (test: `test/integration/auth-me-profile.test.js`).
- **Errores:** `401` sin token o token inválido; `404` si el usuario del token ya no existe.

### `PUT /api/auth/me` — Auth
- **Validación (`PROJECT_ANALYSIS.md §76`):** `name`, si viene (también `""` o `null`), pasa por `validateName` y se guarda recortado; `bio` ≤ 500, `location` ≤ 150, `avatar` ≤ 1000, todos texto o `null`. Si no → **400**.
- **Body:** `{ name?, bio?, location?, avatar? }` — solo lee esos cuatro, todos de `users` (no toca la tabla del rol). Parcial: un campo que no viene conserva su valor.
- **Respuesta 200:** `{ user }` actualizado (`id, name, email, role, avatar, bio, location`). `404` si el usuario ya no existe.

### `PUT /api/auth/me/photo` — Auth (cualquier rol)
> Agregado en `PROJECT_ANALYSIS.md §162` (`PLAN_FALTANTE.md`, Etapa 1). Foto de perfil subida como archivo a Cloudinary (`lib/storage.js`).
- **Body:** `multipart/form-data` con **un** archivo en el campo `photo` (JPEG, PNG o WebP; hasta 8 MB). El cliente no fija `Content-Type` (lo pone el navegador con el boundary).
- **Qué guarda:** la miniatura cuadrada de Cloudinary (`storage.thumbUrl`, 480 px) en **`users.avatar`**, que es la foto que muestran el chat, Momentos, comentarios y reseñas. Si el rol es `ngo` o `company`, la misma URL va también a `ngos.foto_perfil` / `empresas.foto_perfil` (el `logo` de `fmtNgo`/`fmtEmpresa`), en la misma transacción. **`voluntarios.foto_perfil` no se toca**: la foto del voluntario es `users.avatar` (decisión F2 de `PLAN_FALTANTE.md`).
- **Respuesta 200:** `{ user }` con las mismas claves que `PUT /api/auth/me`.
- **Errores (en este orden, sin subir nada antes de validar):** `401` sin sesión · `429` (con `Retry-After`) pasadas **10 subidas por hora** por usuario (en memoria, por proceso, `lib/rateLimit.js`) · `503` si Cloudinary no está configurado · `400` "Solo se aceptan fotos JPEG, PNG o WebP" (tipo declarado), "Elegí una foto" (sin archivo, o en otro campo) o "El archivo no es una imagen válida (JPEG, PNG o WebP)" (la **cabecera real** no es de imagen) · `413` más de 8 MB · `404` "Perfil no encontrado" (ONG/empresa sin fila de perfil) · `502` si falla Cloudinary (la foto anterior sigue) · `500` "Error al guardar la foto" si falla la base después de subir: se borra de Cloudinary lo subido y no cambia nada.
- **No borra la foto anterior de Cloudinary** (como borrar un usuario o un proyecto, pendiente conocido; decisión C3 abierta en `PLAN_FALTANTE.md`).
- Tests: `test/integration/profile-photo.test.js`.

---

## Projects (`routes/projects.js`)

### `GET /api/projects` — Auth opcional
- **Query params (los que lee el código, cotejado en §96):** `search`, `type` (`fugaz`/`sostenido`; `Todos` = sin filtro), `category` (**nombre** de una categoría), `status` (sin default: si no viene, todos los estados), `modality`/`modalidad` (`presencial`/`remoto`/`hibrido`), `sort` (`featured` default, `rating`, `recent`), `limit`, `offset`. *(Este doc listaba además `tipo`, `categoria` "uno o varios ids", `ngo_id`, `page` y `status` con default `active`: el código nunca los tuvo.)*
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
  1. Afinidad de categoría con el historial de inscripciones.
  2. Match de habilidades del voluntario contra los roles buscados del proyecto.
  3. ONG seguida por el voluntario (`ngo_follows`).
  4. Cercanía geográfica (`users.location` vs `ubicacion` del proyecto) o modalidad remota.
  5. Cupos limitados / últimos cupos.
  6. Recencia de publicación.
  7. Rating promedio del proyecto.
  8. Popularidad (`project_follows` del proyecto).
  9. Señal social: contactos que el voluntario sigue (`volunteer_follows`) y que están inscriptos/aprobados en ese proyecto.
  - **"Arranque en frío"** (`is_cold_start: true`): sin historial de inscripciones, sin ONGs/proyectos seguidos, sin habilidades que matcheen roles y sin voluntarios seguidos. No se saca ninguna señal (las que dependen de esos datos simplemente no suman): se **multiplican** las de cupos (×2), novedad (×2) y rating (×3), y un proyecto sin ningún motivo lleva el tag "🌟 Destacado".
- **IMPORTANTE — orden de rutas:** esta ruta está declarada antes de `GET /:id` en `projects.js`. Si se moviera después, Express interpretaría `recommended` como el parámetro `:id` y la ruta dejaría de ser alcanzable — cualquier ruta nueva de `projects.js` sin parámetro debe declararse antes de `/:id`.
- **Respuesta 200:** `{ recommendations: Project[], based_on_history: boolean, is_cold_start: boolean }` (`based_on_history`: el voluntario tiene inscripciones en proyectos con categoría; es lo único de los dos que tipa `api.ts`), cada `Project` con `recommendation_score` (número), `recommendation_reasons` (array de strings) y `recommendation_tags` (array de strings cortos con emoji, para chips en la UI).
- **Errores:** `401` sin token, `403` si el rol no es `volunteer`.

### `GET /api/projects/:id` — Auth opcional
- **Respuesta 200:** `{ project }` con roles, requisitos, categoría, `comments` (todos, del más nuevo al más viejo), `ratings`, `kpis`, rating promedio, (si hay sesión) `my_enrollment`, y **`can_manage: boolean`**: `true` solo si quien pide es la ONG dueña (consulta aparte a `ngos`, sin exponer el `user_id` de la ONG). Lo usa `ProjectDetails` para mostrar "Ver en panel ONG" (`PROJECT_ANALYSIS.md §73`).
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

### `PUT /api/projects/:id` — Auth, role `ngo` (dueño)
- Verifica `ngo_id` de la sesión contra el `ngo_id` del proyecto (join implícito vía `WHERE id=$1 AND ngo_id=$2`).
- **Parcial (`PROJECT_ANALYSIS.md §95`):** cada campo que **no viene conserva su valor**: `title`, `description`, `full_description`, `image`, `location`, `type`, `duration`, `volunteers_needed`, `funding_goal`, `cost_per_person`, `hours_per_week`, `status`, `latitude`/`longitude`, `modality`, `roles_needed`, `requirements`, `category`. `null` o `""` borra los opcionales (`full_description`, `image`, `duration`; montos → 0). El resultado combinado se valida como el alta: `validateProject` (cupos y horas **enteros estrictos**, con los mismos topes de 100000 y 168), tipo `fugaz|sostenido` (`null` incluido) y montos finitos ≥ 0 (`parseMoney`). Los textos que vienen se validan como string y con los mismos largos máximos (80, 1000, 5000, 150, 100 y 1000; un valor viejo más largo no se revalida si no viene). **`modality`/`modalidad`**, si vienen y no están vacías, tienen que ser `presencial|remoto|hibrido` (antes no se validaban: un objeto daba 500 en SQLite); vacías conservan la actual. **`latitude`/`longitude`** (o `latitud`/`longitud`), si vienen, se validan como en el alta, y `null`/`''` las borra. Si algo no cumple → **400** sin cambiar nada (§143). `roles_needed`, `requirements` y `category`, si vienen, se validan como en el alta y **reemplazan** a los actuales (listas vacías o `""` los borran), en la misma transacción. *(Antes se pisaba todo lo no enviado —un status omitido reactivaba un proyecto terminado— y la respuesta devolvía roles/requisitos/categoría del body sin guardarlos.)*
- **Capacidad (`PROJECT_ANALYSIS.md §40`):** `volunteers_needed` **omitido o `null` conserva la capacidad actual** (antes se pisaba con `0`); un valor explícito debe ser un entero ≥ 1 (**400** `"Los cupos deben ser un número positivo"`, o `"Los cupos tienen que ser un número entero"` si no es entero, igual que al crear; antes un negativo violaba el `CHECK(cupos >= 0)` y devolvía 500). **No se puede bajar por debajo de las inscripciones aprobadas**: **400** `"No podés bajar la capacidad a N: ya hay M voluntarios aprobados."`. La condición va dentro del propio `UPDATE` (`... AND cupos_ocupados <= $9`), así que es atómica frente a aprobaciones concurrentes. Ninguna pantalla del frontend usa hoy este endpoint. *(Esta viñeta decía además que "no es una actualización parcial real" y que un `status` omitido volvía a `'active'`: era de antes de §95 y contradecía la viñeta de arriba. El código es parcial, también para `status`.)*
- **`status`**, si viene, tiene que ser `active`, `completed` o `cancelled` → si no, **400** (antes 500 por el `CHECK`; `§74`).
- **Respuesta 200:** `{ project }` releído de la base (con sus roles, requisitos y categoría guardados). **Errores:** `400` validación o capacidad; `404` si el proyecto no existe o no pertenece a la ONG del usuario (no distingue "no existe" de "no es tuyo", por diseño). No lo usa ninguna pantalla (no hay edición de proyectos en la interfaz).

### `DELETE /api/projects/:id` — Auth, role `ngo` (dueño)
- Borra el proyecto (cascada elimina requisitos, roles, comentarios, ratings, kpis, enrollments asociados — ver `DATABASE_CONTEXT.md §5`).
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
- **Body esperado por el backend:** `{ project_id, message }`. *(Corregido — antes el backend leía `mensaje`, hoy lee `message`, igual que lo envía el frontend; se guarda en la columna `mensaje` de la DB y se expone como `message` en todas las lecturas. Ver `PROJECT_ANALYSIS.md §13`.)*
- **Validación:** proyecto debe existir, `status='active'`, `cupos_ocupados < cupos`, y no debe existir ya una fila `(user_id, project_id)` (constraint `UNIQUE`).
- **Efecto:** `INSERT` en `enrollments` con `status='pending'`; notificación fire-and-forget a la ONG dueña del proyecto.
- **Respuesta 201:** `{ enrollment, message }`. **Errores:** `400` solo si falta `project_id`; `404` "Proyecto no encontrado o inactivo" (no existe o no está `active`); `409` "El proyecto no tiene cupos disponibles" y `409` "Ya estás inscripto en este proyecto" (también si dos altas iguales llegan a la vez: `isUniqueViolation`). *(Esta doc decía 400 para ya inscripto, sin cupos y no activo.)*

### `GET /api/enrollments/my` — Auth
- **Respuesta 200:** `{ enrollments: Enrollment[] }` del usuario logueado, con datos del proyecto embebidos (JOIN).

### `GET /api/enrollments/project/:projectId` — Auth, role `ngo` (dueño del proyecto)
- **Query:** `status` opcional (`pending`/`approved`/`rejected`): filtra por estado; sin él, todas.
- **Respuesta 200:** `{ enrollments: Enrollment[] }` de ese proyecto, del más nuevo al más viejo, con datos del voluntario embebidos (`volunteer_name`, `volunteer_email`, `volunteer_avatar`, `volunteer_bio`).
- **Errores:** **`403`** "Sin permiso sobre este proyecto" si el proyecto no existe o no pertenece a la ONG de la sesión (esta doc decía 404).

### `PATCH /api/enrollments/:id` — Auth, role `ngo` (dueño del proyecto de la inscripción)
- **Body:** `{ status: 'approved'|'rejected' }`.
- **Efecto:** en **una transacción** actualiza `status` y ajusta `projects.cupos_ocupados` (+1 al pasar a `approved`, −1 —sin bajar de 0— al pasar de `approved` a `rejected`). Después del COMMIT, notificación y email fire-and-forget al voluntario.
- **Concurrencia (2026-09, `PROJECT_ANALYSIS.md §34`):** el `UPDATE` es un compare-and-swap sobre el estado leído, así que doble click / reintentos no suman el cupo dos veces. **Idempotente:** pedir el estado que la inscripción ya tiene devuelve 200 sin cambiar nada y **sin** notificación ni email duplicados (antes cada re-aprobación mandaba otro email).
- **Capacidad (`PROJECT_ANALYSIS.md §39`):** aprobar impone `cupos_ocupados <= cupos`. El `UPDATE` que suma el cupo es condicional (`... WHERE id=$1 AND cupos_ocupados < cupos`); si no afecta ninguna fila se hace **ROLLBACK de toda la transacción** (la inscripción sigue en su estado anterior) y se responde **409**. Atómico también bajo concurrencia en Postgres. Aplica a `pending→approved` y también a `rejected→approved`; **no** aplica al no-op de re-aprobar algo ya aprobado (200). Es la misma regla y el mismo mensaje que ya usa el alta (`POST /api/enrollments`).
- **Respuesta 200:** `{ message }` (`"Inscripción aprobada"` / `"Inscripción rechazada"`). **409** si otro request cambió el estado a algo distinto entre la lectura y la escritura (`"La inscripción cambió mientras la revisabas..."`), o si al aprobar ya no quedan cupos (`"El proyecto no tiene cupos disponibles"`).

### `DELETE /api/enrollments/:id` — Auth (el propio voluntario dueño de la inscripción)
- Cancela/borra la inscripción. Si estaba `approved`, decrementa `cupos_ocupados` (sin bajar de 0). Borrado y decremento en **una transacción**; el `DELETE` exige que el estado siga siendo el leído (compare-and-swap).
- **Concurrencia:** varias cancelaciones simultáneas del mismo registro → una sola responde 200 y decrementa; las demás **404** (antes todas respondían 200 y cada una restaba un cupo).
- **Respuesta 200:** `{ message: 'Inscripción cancelada' }`. **404** si ya no existe. **409** si el estado cambió justo antes de borrar.

### `PATCH /api/enrollments/:id/horas` — Auth, role `ngo` (dueño del proyecto)
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
- **`fmtNgo`** (todas las rutas de ONG y `GET /api/follows/ngo`) devuelve `id, user_id, followers, founded, name, logo, cover_image, description, mission, location, category`. **No devuelve `alias`**, aunque `PUT /api/ngos/me` lo guarda.

### `GET /api/ngos/me` — Auth, role `ngo`
- Devuelve el perfil completo de la ONG de la sesión, incluyendo `category` (mismo JOIN que `GET /api/ngos`; corregido — antes no lo incluía, ver `PROJECT_ANALYSIS.md §13`).
- **Respuesta 200:** `{ ngo, projects, stats, pending_enrollments }`. `projects`: los de la ONG con la misma forma que `GET /api/projects` y el perfil público (`ngoProjects` + `fmt`, con categoría, roles, requisitos, rating y `ngo_name`/`ngo_logo`), del más nuevo al más viejo y desempatando por id. *(Hasta §144 salían de un `SELECT *`: `category: ''` y listas vacías.)* Cada solicitud pendiente trae la inscripción, `volunteer_name`/`volunteer_email`/`volunteer_avatar` y **`project_title`** (tipo `PendingEnrollment` en `api.ts`; `NGODashboard` lo muestra, `PROJECT_ANALYSIS.md §82`).

### `GET /api/ngos/:id` — Público
- Perfil público de una ONG por id, incluyendo `category` (corregido — antes no lo incluía). *(Corregido — la subquery de proyectos tenía una columna `id` ambigua entre `projects` y `categorias` que causaba un `500` en todos los casos. Ver `PROJECT_ANALYSIS.md §16`, bug B6.)*
- **Respuesta 200:** `{ ngo, projects: Project[] }`. Los proyectos (todos los estados, del más nuevo al más viejo) tienen **la misma forma que en `GET /api/projects`**: pasan por `fmt` e incluyen `duration`, `hours_per_week`, roles, requisitos, categoría, `ngo_name`/`ngo_logo`, `avg_rating` y `ratings_count` (`PROJECT_ANALYSIS.md §134`, REVISION A1; antes eran 8 campos sin duración ni horas, y un proyecto con dos categorías salía repetido).
- **Errores:** `404` si no existe.

### `PUT /api/ngos/me` — Auth, role `ngo`
- **Validación (`§76`, `lib/inputs.js`):** `name` (si viene) texto de 2 a 100 caracteres sin contar espacios, guardado recortado (antes `""` se guardaba vacío); `description` ≤ 2000, `mission` ≤ 1000, `location` ≤ 150, `logo`/`cover_image` ≤ 1000, `alias` ≤ 50, `founded` ≤ 20, `category` ≤ 60, todos texto. Si no → **400** (antes un número daba 500).
- **Body (en inglés, como lo manda `api.ts`):** `{ name?, description?, mission?, location?, logo?, cover_image?, alias?, founded?, category? }` — se guardan en `nombre`, `descripcion`, `mision`, `ubicacion`, `foto_perfil`, `banner`, `alias` y `founded`. Parcial: un campo que no viene conserva su valor. *(Esta doc listaba los nombres en español de las columnas; el código no los lee.)* `category` es el nombre de una categoría (ej. `"Educación"`). *(Corregido — antes no persistía la categoría; ahora busca el `id` en `categorias` por nombre y reemplaza la fila correspondiente en `ngo_categorias`. Si el nombre no matchea ninguna categoría existente, el resto del perfil se guarda igual y la categoría simplemente no cambia.)*
- **Respuesta 200:** `{ ngo }` (incluye `category` actualizada; no incluye `alias`, ver `fmtNgo` arriba).
- **Errores:** `400` validación; **`409`** "El alias ya está en uso" si otra ONG ya tiene ese `alias`; `404` sin perfil de ONG.

### `GET /api/ngos/:id/projects` — Público
- **Query params:** `status` opcional (si no se manda, devuelve todos los estados).
- **Respuesta 200:** `{ projects: Project[] }` de esa ONG, con la misma forma que `GET /api/projects`, `GET /api/ngos/:id`, `GET /api/ngos/me` y `GET /api/ngos/:id/dashboard` (los cuatro usan `ngoProjects` en `routes/ngos.js`): categoría, roles, requisitos y rating, cada proyecto una sola vez, del más nuevo al más viejo y desempatando por id. *(Hasta §86 devolvía las filas crudas; hasta §144 la categoría salía `''` —el alias `category` no lo lee `fmt`— y el proyecto con dos categorías se repetía. Ninguna pantalla lo usa.)*
- Como todas las respuestas de proyectos, ONGs y empresas: solo los campos de las listas blancas (`fmt`/`fmtNgo`/`fmtEmpresa`, `PROJECT_ANALYSIS.md §86`). Ya no salen las columnas en español ni `created_at` de ONG/empresa/catálogos.

### `GET /api/ngos/:id/dashboard` — Auth, role `ngo` (dueño)
- **Respuesta 200:** `{ ngo, projects, pending_enrollments, stats }`. `projects`: todos los de la ONG (cualquier estado) con la misma forma que `GET /api/projects` (`ngoProjects`: categoría, roles, requisitos y rating), del más nuevo al más viejo y desempatando por id. *(Hasta §146 salían de un `SELECT *`: `category: ''` y listas vacías.)* `stats`: `total_projects`, `active_projects`, `completed_projects`, `total_volunteers`, `total_funding`, `pending_enrollments`. Ninguna pantalla lo llama: `api.ts` no lo expone y `NGODashboard` usa `GET /api/ngos/me`. *(Esta doc decía que `NGODashboard` lo complementaba con requests por proyecto; ya no es así.)*
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
- **Body:** `{ estado: 'aceptado' | 'rechazado' }`.
- Autorización por `JOIN` a `projects.ngo_id` en el `WHERE` (nunca se confía en los IDs de la URL sin validar dueño) → `404` si la propuesta no existe o no es de un proyecto propio.
- `409` si la propuesta ya fue decidida antes (no se puede revertir una decisión por acá).
- **Concurrencia (`PROJECT_ANALYSIS.md §77`):** el `UPDATE` es compare-and-swap (`... AND estado='propuesto'`). Si dos decisiones llegan a la vez, solo una cambia la fila (200); la otra responde el mismo `409` y no notifica.
- Notifica a la empresa (in-app + email), solo la decisión que ganó.
- **Respuesta 200:** `{ message }`: **"Propuesta aceptada"** o **"Propuesta rechazada"** según `estado` (antes interpolaba el valor de la DB y decía "Propuesta aceptado"/"rechazado"; `PROJECT_ANALYSIS.md §153`). `NGOPatrocinios.tsx` descarta la respuesta y no lo muestra.

---

## Chatbot FAQ (`routes/faqs.js`)

> Agregado 2026-09 (roadmap punto 9). Explícitamente **sin IA**: matching por keywords, sin embeddings ni LLM. Stateless — no hay tabla de historial de conversación.

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
- **Campos:** `project_id` (obligatorio), `caption` (opcional, ≤ 500 caracteres, filtro de lenguaje inapropiado), `photos` (1 a 5 archivos JPEG/PNG/WebP, ≤ 8 MB c/u).
- **Quién puede publicar:** un voluntario con inscripción **aprobada** en ese proyecto (también cuando ya terminó), o la **ONG dueña**. Una empresa, una ONG ajena, una inscripción pendiente o sin inscripción → `403`.
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
- **Respuesta 200:** `{ status: 'ok', timestamp }` — usado por Render para health checks.

---

## Endpoints ausentes (funcionalidad de esquema sin API)

Las tablas `donaciones` y `reuniones` **existen en el esquema de base de datos pero no tienen ningún endpoint que las lea o escriba**. Cualquier tarea futura que mencione "donaciones" o "reuniones/videollamadas" requiere **construir la API desde cero**, no modificar una existente. *(`voluntario_habilidades` dejó de estar en esta lista — ya tiene API completa, ver sección "Voluntarios" arriba y `PROJECT_ANALYSIS.md §17`. El perfil de `empresas` tampoco — ver sección "Empresas" arriba. `empresa_voluntariados` tampoco — ver sección "Patrocinio" arriba y `PROJECT_ANALYSIS.md §26`. `ngo_follows`/`project_follows`/`volunteer_follows` tampoco — ya tienen API completa, ver sección "Follows y Feed personalizado" arriba y `PROJECT_ANALYSIS.md §28`.)*

## Endpoints duplicados o inconsistentes detectados

1. **Ninguna ruta está técnicamente duplicada** (no hay dos endpoints con el mismo método+path). Las inconsistencias de contrato que existían entre `POST /api/enrollments` (`mensaje` vs `message`) y entre las tres rutas de NGO respecto a `category` fueron corregidas — ver `PROJECT_ANALYSIS.md §13`.
2. **Falta de endpoint de edición/borrado de empleados** (`empleados` solo tiene `GET`/`POST`, no `PUT`/`DELETE`), inconsistente con el resto de recursos del sistema que sí ofrecen CRUD completo (proyectos, KPIs).
3. **Calificaciones (`ratings`):** no hace falta un `PUT /api/projects/:id/ratings/:ratingId` para editar: `POST /api/projects/:id/ratings` es un upsert y volver a mandarlo actualiza la reseña propia (el `UNIQUE(user_id, project_id)` garantiza una por persona y proyecto). Lo que falta es **borrar** una reseña: no hay `DELETE`. *(Esta viñeta decía "solo se puede crear una vez", lo que contradecía el upsert.)*
