# DATABASE_CONTEXT.md — Esquema de la base

> La única fuente del esquema es `backend/scripts/migrate.js`, que es idempotente (`CREATE TABLE IF NOT EXISTS` y
> `addColumnIfNotExists`, regla 12). Corre en SQLite (dev y tests) y en PostgreSQL (producción). Estado al 30/10/2026;
> la versión larga, con la historia de cada columna, está en `archivo/contexto-2026-10-30/`.

## 0. Tipos según el motor

| En `migrate.js` | SQLite | PostgreSQL |
|---|---|---|
| `UUID_PK` | `TEXT PRIMARY KEY DEFAULT (randomblob…)` | `TEXT PRIMARY KEY DEFAULT gen_random_uuid()` |
| `NOW` | `DATETIME DEFAULT (datetime('now'))`, string UTC con resolución de 1 s | `TIMESTAMPTZ DEFAULT NOW()`, `Date` |
| `BOOL` | `INTEGER` (0/1) | `BOOLEAN` (comparar con `true`/`false`) |
| `JSONB` | `TEXT` | `JSONB` |

- Las 24 tablas con entidad propia usan `id TEXT` (UUID), pero las altas no usan el default: generan el id con `crypto.randomUUID()` y releen por id (regla 23).
- Las 10 tablas N:M tienen PK compuesta.
- Las otras 4 tienen otra PK: los dos tokens de un solo uso y `mp_oauth_states`, el hash del código; `ngo_cuentas_mp`, el `ngo_id`.
- En SQLite, dos filas del mismo segundo empatan en `created_at`: no usarlo para identificar ni para ordenar estrictamente.

## 1. Tablas (38)

| Grupo | Tablas |
|---|---|
| Usuarios y perfiles | `users`, `voluntarios`, `ngos`, `empresas`, `ngo_miembros` (equipo de la ONG), `empleados` (fichas sin cuenta, sin uso desde el equipo) |
| Catálogos | `categorias`, `habilidades`, `roles`, `faqs` |
| Voluntariados | `projects`, `requisitos`, `kpis`, `project_categorias`, `project_roles` |
| Participación | `enrollments`, `reuniones` (entrevistas), `comments`, `ratings` |
| Social | `ngo_follows`, `project_follows`, `volunteer_follows`, `messages`, `notifications`, `posts`, `post_media`, `post_likes` |
| Dinero | `donaciones`, `ngo_cuentas_mp`, `mp_oauth_states` |
| Patrocinio | `empresa_voluntariados`, `patrocinio_puntos`, `patrocinio_mensajes` |
| Perfil N:M | `ngo_categorias`, `empresa_categorias`, `voluntario_habilidades` |
| Seguridad | `account_deletion_tokens`, `password_reset_tokens` |

## 2. Columnas

Notación: `FK→tabla` con su `ON DELETE` (CASCADE si no se dice otra cosa). Todas tienen `created_at`; las marcadas con `upd` tienen también `updated_at`.

### Usuarios y perfiles
- **`users`** (upd): id · name NOT NULL · email NOT NULL UNIQUE · password (hash bcrypt) · role (`volunteer`/`ngo`/`company`, default `volunteer`) · avatar · bio · location.
  - `avatar` es **la foto de la persona**: la usan el chat, Momentos y comentarios. La escriben `PUT /api/auth/me` y `/me/photo`.
- **`voluntarios`** (upd): id · user_id UNIQUE FK→users · nombre · apellido · descripcion · ubicacion · foto_perfil · banner · cv_url · followers.
  - **`cv_url` guarda el `public_id` de un PDF privado de Cloudinary, no una URL.** Ninguna respuesta lo expone.
  - `foto_perfil` es una copia del registro que nada actualiza; la foto real es `users.avatar`.
- **`ngos`** (upd): id · user_id UNIQUE FK→users · nombre NOT NULL · descripcion · foto_perfil · banner · mision · alias UNIQUE · ubicacion · founded · followers (≥ 0) · cuit · transparencia_url.
  - `cuit` se guarda normalizado (`XX-XXXXXXXX-X`, con dígito verificador válido) y `transparencia_url` es https. Son públicos (`cuit`, `transparency_url`) y **no son una verificación**.
- **`empresas`** (upd): id · user_id UNIQUE FK→users · nombre · descripcion · mision · ubicacion · foto_perfil · banner · industria · followers.
- **`ngo_miembros`** (upd): id · ngo_id FK→ngos · user_id FK→users (un voluntario) · rol (`coordinador`/`comunicador`) · estado (`invitado`/`activo`, default `invitado`) · invitado_por FK→users SET NULL · `UNIQUE(ngo_id, user_id)`.
  - El dueño no está acá: es `ngos.user_id`.
  - Solo cuentan los `activo` (`lib/ngoAccess.js`), y una persona puede estar en varias ONG.
- **`empleados`**: id · ngo_id FK→ngos · nombre · apellido · email · foto_perfil · rol (`coordinador`/`comunicador`/`admin`/`otro`). Es el directorio viejo, que se saca después de la defensa.

### Catálogos
- **`categorias`**: id · nombre UNIQUE · descripcion · icono. **`habilidades`** y **`roles`**: id · nombre UNIQUE · descripcion.
- **`faqs`**: id · categoria · pregunta · respuesta · keywords (todas NOT NULL salvo categoria) · orden · activo (BOOL).

### Voluntariados
- **`projects`** (upd): id · ngo_id FK→ngos · titulo, descripcion, ubicacion NOT NULL · descripcion_full · foto_perfil · banner · alias UNIQUE · fechas `fecha_inicio`, `fecha_fin` (TEXT `YYYY-MM-DD`) · followers.
  - **Tipo y estado:** `tipo` (`fugaz`/`sostenido`, default `fugaz`) · `status` (`active`/`completed`/`cancelled`).
  - **Cupos:** `cupos` y `cupos_ocupados` (≥ 0). **No hay CHECK de `cupos_ocupados <= cupos`**: lo impone el código (regla 20).
  - **Fondos:** `meta_financiera`, `recaudado`, `costo` (REAL ≥ 0).
  - **Duración:** `horas_semanales` (> 0, para `sostenido`) y `duracion` (para `fugaz`). Las dos se validan en la app.
  - **Lugar:** `latitud` y `longitud` (REAL) · `modalidad` (`presencial`/`remoto`/`hibrido`, default `presencial`). El frontend lee `modality` tal cual, nunca la infiere del texto.
  - **Foto:**
    - `foto_provider_id`: id de Cloudinary de la foto subida, para borrarla al reemplazarla. Nunca sale en la API.
    - `foto_posicion` (`arriba`/`centro`/`abajo`, default `centro`): en la API, `image_position` = `top`/`center`/`bottom`.
- **`requisitos`**: id · project_id FK · descripcion NOT NULL · cantidad (> 0, default 1) · tipo (default `general`).
- **`kpis`**: id · project_id FK · nombre NOT NULL · descripcion · valor REAL · tipo_valor (`numero`/`porcentaje`/`texto`/`booleano`; la API ya no acepta `texto`) · unidad · fecha.
- **`project_roles`**: (project_id, rol_id) · cantidad (> 0). **`project_categorias`**: (project_id, categoria_id).

### Participación
- **`enrollments`** (upd): id · user_id FK→users · project_id FK→projects · status (`pending`/`approved`/`rejected`/`cancelled`) · mensaje (en la API, `message`) · horas_realizadas (≥ 0) · telefono · `UNIQUE(user_id, project_id)`.
  - `telefono` es opcional y sale como `phone`. La ONG lo ve solo con la postulación `pending` o `approved`.
- **`reuniones`** (entrevistas): id · enrollment_id FK→enrollments · user_id, project_id FK (los llena el backend desde la postulación) · fecha (`YYYY-MM-DD`) · horario (`HH:MM`) · link · lugar · nota · estado (`programada`/`realizada`/`cancelada`) · empleado_id FK→empleados SET NULL (sin uso).
  - Índice único parcial: una sola `programada` por postulación.
- **`comments`**: id · project_id FK · user_id FK · comment NOT NULL.
- **`ratings`**: id · project_id FK · user_id FK · rating (1–5) · comment · `UNIQUE(user_id, project_id)`. El `INSERT … ON CONFLICT (user_id, project_id) DO UPDATE` de la API depende de ese UNIQUE: no sacarlo.

### Social
- **`ngo_follows`** (user_id, ngo_id), **`project_follows`** (user_id, project_id) y **`volunteer_follows`** (follower_id, following_id, con CHECK de que sean distintos).
- **`messages`**: id · sender_id FK · receiver_id FK · body NOT NULL · read (BOOL).
- **`notifications`**: id · user_id FK · type · title · body · read (BOOL) · data (JSONB/TEXT, siempre `JSON.stringify`).
- **`posts`** (Momentos): id · user_id FK · project_id FK · caption (≤ 500 por la API).
  - Pueden publicar quien tiene la inscripción aprobada, la ONG dueña y su comunicación. El límite de 10 por hora se impone en la ruta.
- **`post_media`**: id · post_id FK · url (base de Cloudinary, sin transformaciones) · provider_id (nunca sale en la API) · position · width · height.
- **`post_likes`**: PK (post_id, user_id); la API usa `ON CONFLICT DO NOTHING`.

### Dinero
- **`donaciones`**: id · user_id FK→users · project_id FK SET NULL · ngo_id FK SET NULL · monto (> 0, REAL: pesos enteros) · fecha · estado (`pendiente`/`completada`/`fallida`/`reembolsada`).
  - **Columnas de Mercado Pago:**
    - `external_id`: la preferencia.
    - `external_payment_id`: el pago que la acreditó.
    - `external_status` y `moneda` (`ARS`).
    - `cobrador_mp_user_id`: la cuenta de la ONG con la que se cobró; NULL es la cuenta de la app.
  - **El default `completada` no se usa:** todo `INSERT` pone `pendiente`, y solo `applyPayment` la completa (compare-and-swap + `recaudado`, en una transacción). La conciliación y el aviso solo aceptan un pago leído con la misma cuenta que cobró.
- **`ngo_cuentas_mp`** (upd): ngo_id PK FK→ngos · mp_user_id UNIQUE · access_token_cifrado · refresh_token_cifrado (NULL si es manual) · expires_at (ISO) · estado (`activa`/`requiere_reconexion`) · origen (`oauth`/`manual`) · version.
  - Tokens cifrados con AES-256-GCM. Solo la toca `lib/sellerAccounts.js` y ningún endpoint la devuelve.
- **`mp_oauth_states`**: state_hash PK · ngo_id FK · expires_at (10 minutos). De un solo uso, a lo sumo uno por ONG.

### Patrocinio
- **`empresa_voluntariados`** (upd): PK (empresa_id, project_id) · aporte (≥ 0) · estado (`propuesto`/`aceptado`/`rechazado`) · mensaje · version · acepta_empresa_version · acepta_ong_version.
  - `version` sube con cada cambio de los puntos. El acuerdo se cierra cuando las dos aceptaciones coinciden con `version`.
- **`patrocinio_puntos`** (upd): id · (empresa_id, project_id) FK compuesta a `empresa_voluntariados` · lado (`empresa`/`ong`) · tipo (`dinero`/`insumos`/`voluntarios`/`difusion`/`otro`) · detalle (≤ 300) · monto (> 0; solo `dinero`, privado de las partes) · autor_id FK SET NULL.
- **`patrocinio_mensajes`**: id · (empresa_id, project_id) FK compuesta · lado · autor_id FK SET NULL · cuerpo (≤ 1000) · created_at, que pone el código con milisegundos para ordenar la charla.

### Perfil N:M y seguridad
- **`ngo_categorias`**, **`empresa_categorias`**: (dueño, categoria_id). **`voluntario_habilidades`**: (user_id, habilidad_id) · nivel (`basico`/`intermedio`/`avanzado`).
- **`account_deletion_tokens`** y **`password_reset_tokens`**: token_hash PK (sha256; el código en claro nunca se guarda) · user_id FK · expires_at (ISO calculado en JS; reset: 1 hora).
  - Un pedido nuevo borra los anteriores del usuario. En el reset, usar uno borra todos.

## 3. Borrado

- **Todo es borrado físico en cascada,** sin soft-delete. Borrar un `user` elimina su perfil, sus proyectos (si es ONG, con sus postulaciones, comentarios, KPIs, etc.), sus postulaciones, mensajes, avisos, seguimientos y Momentos.
- **Excepciones con `SET NULL`:** `donaciones.project_id` y `.ngo_id`, `reuniones.empleado_id`, y los `autor_id` / `invitado_por`.
- **Archivos de Cloudinary:** la base no los borra. Lo hacen las rutas: borrar un voluntariado borra su foto y las de sus Momentos; borrar la cuenta borra el CV, los Momentos y, si es ONG, las fotos de sus voluntariados. Las fotos de perfil anteriores quedan.

## 4. Índices (38)

- **projects:** `ngo_id`, `status`, `tipo`, `ubicacion`.
- **enrollments:** `user_id`, `project_id`, `status`.
- **Del contenido de un proyecto:** `comments`, `ratings`, `requisitos`, `kpis`, `reuniones` (`project_id`, `user_id` y el único parcial `idx_reuniones_una_programada`).
- **Avisos y chat:** `notifications` (`user_id`, `read`); `messages` (`sender_id`, `receiver_id`, `created_at`).
- **Dinero:** `donaciones` (`user_id`, `project_id`, `external_id`); `mp_oauth_states(ngo_id)`.
- **Momentos:** `posts` (`created_at`, `project_id`, `user_id`); `post_media(post_id)`; `post_likes(user_id)`.
- **Patrocinio:** `empresa_voluntariados(estado)`; `patrocinio_puntos` y `patrocinio_mensajes` sobre `(empresa_id, project_id)`.
- **Resto:** `volunteer_follows` (`follower_id`, `following_id`); `faqs` (`activo`, `categoria`); `empleados(ngo_id)`; los dos de tokens (`user_id`).

No hay índices de texto: las búsquedas `ILIKE` sobre título y descripción recorren la tabla.

## 5. Seed (`backend/scripts/seed.js`)

- Es idempotente, con ids legibles (`user-vol-1`, `ngo-1`, `project-…`) y contraseña `Password1` (las credenciales están en el `README.md` de la raíz). Carga voluntarios, ONG, una empresa, unos 12 proyectos con roles y requisitos, y seguimientos.
- **No corre en producción:** con `NODE_ENV=production` sale con código 1 antes de abrir la base. Para una base local con ese `.env`: `NODE_ENV=development npm run db:seed`.

## 6. Problemas conocidos

- Sin registro de migraciones (`schema_migrations`): `migrate.js` se puede volver a correr, pero no hay forma de saber qué cambios ya se aplicaron.
- `cupos_ocupados <= cupos` no tiene CHECK.
- Sin soft-delete ni auditoría.
- Sin índices de texto (`pg_trgm`) para la búsqueda.
- `notifications.data` es TEXT en SQLite, sin validación de JSON.
