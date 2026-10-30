# API_CONTEXT.md — API REST de VoluntariAR

> Base: `http://localhost:3001/api` (local) · `https://voluntariar-api.onrender.com/api` (prod; `VITE_API_URL`).
> JSON siempre. Errores: `{ "error": "mensaje en español" }` con su código. "Auth" = `Authorization: Bearer <jwt>`;
> "opcional" = funciona sin token y personaliza con uno válido. Estado al 30/10/2026; la versión larga, con la
> historia de cada endpoint, está en `archivo/contexto-2026-10-30/API_CONTEXT.md`.

**Convenciones comunes**
- **Altas:** id con `crypto.randomUUID()`, insertar y releer por id (regla 23).
- **Respuestas:** pasan por las listas blancas `fmt`/`fmtNgo`/`fmtEmpresa` (regla 8).
- **Textos libres:** `checkText` (`lib/inputs.js`). Si no es texto → 400 "<Campo> tiene que ser un texto"; si se pasa del largo → 400 "<Campo> puede tener hasta N caracteres".
- **Límites de frecuencia:** en memoria y por proceso (`lib/rateLimit.js`); responden **429** con `Retry-After`.
- **Fotos:** JPEG, PNG o WebP de hasta 8.000.000 bytes, validadas por la cabecera real.
- **Orden de rutas:** en `projects.js`, toda ruta sin parámetro (como `/recommended`) va antes de `/:id`.

## Índice

| Método | Ruta | Auth | Quién |
|---|---|---|---|
| GET | `/health`, `/api/categorias`, `/api/roles`, `/api/habilidades`, `/api/stats` | No | — |
| POST | `/api/auth/register`, `/api/auth/login` | No | — |
| GET, PUT | `/api/auth/me` | Sí | cualquiera |
| PUT | `/api/auth/me/photo`, `/api/auth/me/password` | Sí | cualquiera |
| POST | `/api/auth/me/delete-request` | Sí | cualquiera |
| POST | `/api/auth/delete-account`, `/forgot-password`, `/reset-password` | No (código del email) | — |
| GET | `/api/projects`, `/api/projects/:id` | Opcional | — |
| GET | `/api/projects/recommended` | Sí | volunteer |
| POST | `/api/projects` | Sí | ngo |
| PUT, DELETE | `/api/projects/:id` · PUT `/:id/photo` | Sí | ngo dueña |
| POST | `/api/projects/:id/comments`, `/:id/ratings` | Sí | cualquiera (ratings: con inscripción aprobada) |
| GET | `/api/projects/:id/kpis` | No | — |
| POST · PUT, DELETE | `/api/projects/:id/kpis` · `/:id/kpis/:kpiId` | Sí | ngo dueña |
| POST | `/api/enrollments` | Sí | volunteer |
| GET | `/api/enrollments/my` | Sí | cualquiera |
| GET | `/api/enrollments/project/:projectId` | Sí | ngo dueña o coordinación |
| PATCH | `/api/enrollments/:id`, `/:id/horas` · POST, PATCH `/:id/entrevista` | Sí | ngo dueña o coordinación |
| DELETE | `/api/enrollments/:id` | Sí | el voluntario |
| GET | `/api/ngos`, `/api/ngos/:id`, `/api/ngos/:id/projects` | No | — |
| GET, PUT | `/api/ngos/me` | Sí | ngo |
| GET | `/api/ngos/:id/dashboard` · GET, POST `/:id/empleados` | Sí | ngo dueña |
| GET · PATCH | `/api/ngos/me/patrocinios` · `/me/patrocinios/:empresaId/:projectId` | Sí | ngo |
| GET, POST, DELETE | `/api/ngos/me/mercadopago` (+ POST `/connect`, `/callback`) | Sí | ngo |
| GET | `/api/empresas`, `/api/empresas/:id` | No | — |
| GET, PUT · GET | `/api/empresas/me` · `/me/dashboard` | Sí | company |
| GET, POST · DELETE | `/api/empresas/me/patrocinios` · `/me/patrocinios/:projectId` | Sí | company |
| GET | `/api/patrocinios/:empresaId/:projectId` | Sí | una de las partes |
| POST | `…/puntos`, `…/aceptar`, `…/rechazar`, `…/mensajes` · PATCH, DELETE `…/puntos/:puntoId` | Sí | una de las partes |
| GET, POST · PATCH, DELETE | `/api/equipo/miembros` · `/miembros/:userId` | Sí | ngo |
| GET · POST · DELETE | `/api/equipo/mias` · `/mias/:ngoId/aceptar` · `/mias/:ngoId` | Sí | volunteer |
| GET | `/api/equipo/:ngoId/panel` | Sí | miembro activo |
| GET, PUT | `/api/voluntarios/me/habilidades` | Sí | volunteer |
| PUT, DELETE | `/api/voluntarios/me/cv` | Sí | volunteer |
| GET | `/api/voluntarios/:userId/cv` | Sí | el dueño, o su ONG/coordinación con postulación pendiente o aprobada |
| GET | `/api/voluntarios/:userId` | No | — |
| POST, DELETE | `/api/follows/ngo/:ngoId`, `/project/:projectId`, `/volunteer/:userId` | Sí | volunteer |
| GET | `/api/follows/ngo`, `/project`, `/volunteer/following`, `/volunteer/followers`, `/feed` | Sí | volunteer |
| GET | `/api/follows/ngo/:ngoId/status`, `/project/:projectId/status` (opcional), `/volunteer/:userId/status`, `/volunteer/:userId/followers`, `/volunteer/:userId/following` | No | — |
| GET · POST | `/api/posts/eligible-projects` · `/api/posts` | Sí | volunteer, ngo (y su equipo) |
| GET | `/api/posts`, `/api/posts/:id` | Opcional | — |
| POST, DELETE · DELETE | `/api/posts/:id/like` · `/api/posts/:id` | Sí | cualquiera · autor u ONG dueña |
| GET, POST | `/api/faqs` · `/api/faqs/ask` | Opcional | — |
| GET, POST · PATCH | `/api/messages/conversations`, `/thread/:userId`, `/api/messages` · `/thread/:userId/read` | Sí | cualquiera |
| WS | `/ws?token=<jwt>` | JWT | cualquiera |
| GET · PATCH | `/api/notifications` · `/:id/read`, `/read-all` | Sí | el dueño |
| POST | `/api/donaciones` | Sí | volunteer, company |
| POST | `/api/donaciones/webhook` | Firma de Mercado Pago | — |
| GET | `/api/donaciones/:id` | Sí | quien donó |

---

## Auth (`routes/auth.js` y `routes/authPassword.js`)

**Validaciones comunes** (`lib/authCommon.js`, iguales en `AuthModal.tsx`):
- `validateName`: letras y espacios, de 2 a 50.
- `validateEmail`: hasta 254 caracteres, con un regex lineal.
- `validatePassword`: mínimo 8 caracteres, con una mayúscula y un número, y hasta **72 bytes UTF-8** (la ñ ocupa 2 y un emoji 4) → 400 "Máximo 72 caracteres (los acentos, la ñ y los emojis cuentan como más de uno)".

### `POST /register`
- **Body:** `{ name, email, password, role?, apellido? }`.
  - `role` es `volunteer` (por defecto), `ngo` o `company`; otro valor → 400 "Rol inválido".
  - `apellido` es opcional (hasta 50, misma regla que el nombre). Si falta, se toma del nombre completo. Solo se guarda en `voluntarios`.
- Crea `users` y el perfil del rol **en una transacción**.
- **Respuesta 201:** `{ message, token, user }`.
- **Errores:** 400 validación · 409 "Ya existe una cuenta con ese email" (también si llegan dos a la vez, por el UNIQUE) · 429 pasados 20 registros por IP por hora (cuentan todos los intentos).

### `POST /login`
- **Body:** `{ email, password }` → **200** `{ token, user }`.
- **Errores:** 400 si faltan datos · 401 "Email o contraseña incorrectos", igual exista o no el email y con el mismo trabajo (compara contra un hash fijo).
- **Límite:** cuentan solo los 401: 10 por email+IP y 50 por IP cada 15 minutos → 429. Un login correcto limpia el contador. En producción, `trust proxy` está activo.
- El tope de 72 bytes solo se aplica al registrarse.

### `GET /me`
- **200:** `{ user, profile }`.
  - `user`: `id, name, email, role, avatar, bio, location, created_at`.
  - `profile`: la fila del rol, con una lista blanca de columnas en español. El voluntario lleva `has_cv` en vez de `cv_url`. Es `null` si no hay fila.
- **Errores:** 401 · 404 si el usuario ya no existe.

### `PUT /me`
- **Body:** `{ name?, bio? (≤ 500), location? (≤ 150), avatar? (≤ 1000) }`, parcial. Solo toca `users`.
- **200:** `{ user }` · 400 · 404.

### `PUT /me/photo`
- Multipart, con un archivo en el campo `photo`. El cliente no fija `Content-Type`.
- Guarda la miniatura de 480 px en `users.avatar`. Si es ONG o empresa, también en su `foto_perfil` (`logo`), en la misma transacción.
- **200:** `{ user }`.
- **Errores, en orden:** 401 · 429 (10 por hora) · 503 sin Cloudinary · 400 tipo, "Elegí una foto" o "El archivo no es una imagen válida (JPEG, PNG o WebP)" · 413 · 404 sin perfil · 502 si falla Cloudinary · 500 si falla la base (y se borra lo subido).
- La foto anterior no se borra de Cloudinary.

### `PUT /me/password`
- **Body:** `{ current_password, new_password }`.
- **Errores:**
  - 400 "La contraseña actual no es correcta": es 400 y no 401, para que el frontend no cierre la sesión.
  - 400 si la nueva no cumple las reglas, o "La nueva contraseña tiene que ser distinta de la actual".
  - 429 tras 5 intentos fallidos en 15 minutos por usuario.
- **200:** `{ message: "Contraseña actualizada" }`. Después avisa por mail ("Tu contraseña de VoluntariAR cambió").
- Los JWT ya emitidos siguen valiendo: no hay revocación.

### Borrar la cuenta
- **`POST /me/delete-request`** (con sesión): manda el link `APP_URL/cuenta/borrar?token=…`, que vence en 1 hora y es de un solo uso. Se guarda solo el sha256 y un pedido nuevo invalida el anterior.
  - **200:** `{ sent: true }`.
  - **Errores:** 429 (más de 3 por hora) · 503 sin Resend · 502 si falla el mail. En los dos últimos casos no queda ningún link.
- **`POST /delete-account`** (sin sesión): body `{ token }`.
  - En una transacción corrige los contadores (seguidores y `cupos_ocupados`) y borra el usuario. El resto cae en cascada.
  - Después borra en Cloudinary el CV, los Momentos y, si es ONG, las fotos de sus voluntariados.
  - **200:** `{ deleted: true }`.
  - **Errores:** 400 "El link no es válido o ya se usó…" · 400 "El link venció…" · 500 sin borrar nada (el link sirve para reintentar).

### "¿Olvidaste tu contraseña?"
- **`POST /forgot-password`** `{ email }`:
  - **Siempre 200** `{ sent: true }` con un email válido, exista o no la cuenta. El código y el envío se hacen después de responder.
  - El link es `APP_URL/restablecer?token=…`: vence en 1 hora y es de un solo uso (`password_reset_tokens`).
  - **Errores:** 400 "Email inválido" · 503 sin Resend · 429 con más de 3 pedidos por email por hora o 20 por IP.
- **`POST /reset-password`** `{ token, new_password }`:
  - Valida la contraseña **antes** de gastar el código.
  - Consume el código con compare-and-swap y borra los demás del usuario: varios pedidos a la vez cambian la contraseña una sola vez.
  - **200:** `{ message: "Contraseña actualizada" }`. No inicia sesión, y avisa por mail.
  - **Errores:** 400 por link inválido, usado o vencido, o por las reglas de la contraseña.

---

## Projects (`routes/projects.js`, `routes/projectPhoto.js`)

### `GET /api/projects` — opcional
- **Query:** `search`, `type` (`fugaz`/`sostenido`; `Todos` = sin filtro), `category` (nombre), `status`, `modality`/`modalidad`, `sort` (`featured` por defecto, `rating` o `recent`), `limit` (20 por defecto, de 1 a **500**) y `offset`.
  - Sin `status`, trae todos menos `cancelled`.
  - `search` busca en título, descripción, ONG, categoría y ubicación, con `ILIKE`: no distingue mayúsculas (en SQLite, solo ASCII) ni ignora tildes.
  - `modality=remoto` incluye las ubicaciones "remoto" y "virtual".
- El orden termina en `p.id`, así que las páginas son deterministas.
- **Dos ramas:** Postgres con `json_agg`, SQLite con 3 consultas en lote. Misma forma (`projects-list-shape.test.js`).
- **200:** `{ projects }`, sin total. Cada uno pasa por `fmt`, con `ngo_name`, `ngo_logo`, `ngo_followers`, `avg_rating`, `ratings_count`, `latitude`, `longitude`, `modality` e `image_position`. No cambia con la sesión.

### `GET /api/projects/recommended` — volunteer
- **Query:** `limit` (10 por defecto, de 1 a 30).
- **9 señales** (`lib/recommender.js`, funciones puras):
  1. categoría del historial (aprobada ×2, otra postulación ×1, seguido +1);
  2. habilidades contra roles ("Busca tus habilidades: A, B", en orden alfabético);
  3. ONG seguida;
  4. cercanía o modalidad remota;
  5. últimos cupos;
  6. novedad;
  7. rating;
  8. popularidad;
  9. contactos seguidos que participan.
- **Arranque en frío** (sin historial, follows ni habilidades que coincidan): cupos ×2, novedad ×2 y rating ×3. Un proyecto sin motivos lleva "🌟 Destacado".
- **Universo y orden:** hasta 500 candidatos (activos, con cupo y sin postulación propia). Van adelante a lo sumo 2 de la misma ONG (`MAX_PER_NGO`). Toda habilidad del catálogo tiene su rol en `SKILL_TO_ROLE`, y un test lo controla.
- **200:** `{ recommendations, based_on_history, is_cold_start }`. Cada proyecto suma `recommendation_score`, `recommendation_reasons[]` y `recommendation_tags[]`.

### `GET /api/projects/:id` — opcional
- **200:** `{ project }` con roles, requisitos, categoría y lo siguiente:
  - `comments`: del más nuevo al más viejo.
  - `ratings`: `{ id, project_id, user_id, rating, comment, created_at, user_name, user_avatar }`, ordenadas `created_at DESC, id`.
  - `kpis` y el promedio.
  - `my_enrollment`: con los nombres crudos (`status`, `mensaje`, `horas_realizadas`…), o `null`.
  - `can_manage`: si quien pide es la ONG dueña.
  - `accepts_donations`: si la ONG tiene Mercado Pago activo. Solo sale acá.
  - `sponsors: [{ id, name, logo }]`: solo los acuerdos aceptados, sin puntos ni montos.
- **Errores:** 404. Los cancelados se abren igual.

### `POST /api/projects` — ngo
- **Body (en inglés):** `{ title, description, full_description?, image?, image_position?, category?, location, type?, duration?, hours_per_week?, volunteers_needed, funding_goal?, cost_per_person?, modality?|modalidad?, latitude?|latitud?, longitude?|longitud?, roles_needed?: string[], requirements?: string[] }`.
- **Validación** (todo antes de crear nada → 400):
  - **Textos:** título de 3 a 80 · descripción de 10 a 1000 · `full_description` ≤ 5000 · `location` obligatoria, ≤ 150 · `duration` ≤ 100, obligatoria si es `fugaz` · `image` ≤ 1000.
  - **Tipo y modalidad:** `type` es `fugaz` (por defecto) o `sostenido`. `modality` es `presencial`, `remoto` o `hibrido`; si falta, se deduce de la ubicación.
  - **Números:** `volunteers_needed` de 1 a 100000 y `hours_per_week` de 1 a 168 (obligatorio si es `sostenido`), los dos **enteros estrictos** (`toStrictInt`). Los montos son finitos ≥ 0 (vacío = 0).
  - **Coordenadas:** latitud de −90 a 90 y longitud de −180 a 180 (vacío = sin coordenadas).
  - **Listas:** `roles_needed` y `requirements` son arrays de strings, hasta 20 cada uno (rol de 2 a 40, requisito de 3 a 100), recortados y sin repetidos.
  - **Otros:** `category` ≤ 60; `image_position` es `top`, `center` (por defecto) o `bottom`.
- **Efecto:** en una transacción, el proyecto, la categoría y los roles (que se crean en el catálogo si no existen) y los requisitos. No pasa por `hasBadWord`.
- **201:** `{ project }`, con lo que quedó guardado.
- **Errores:** 400 · 404 sin perfil de ONG.

### `PUT /api/projects/:id` — ngo dueña
- **Parcial:** un campo que no viene conserva su valor. `null` o `''` borra los opcionales; en los montos, los deja en 0.
- Valida el resultado combinado como el alta. `status` es `active`, `completed` o `cancelled`. `roles_needed`, `requirements` y `category`, si vienen, **reemplazan** a los actuales.
- **Capacidad:** si `volunteers_needed` falta o es `null`, se conserva. No se puede bajar de los aprobados → 400 "No podés bajar la capacidad a N: ya hay M voluntarios aprobados.". La condición va en el propio `UPDATE` (`AND cupos_ocupados <= $n`).
- **Quién lo usa:** la edición (`CreateVoluntariado`, que manda solo lo que cambió) y el estado del panel (`{ status }` para finalizar, cancelar o volver a activar).
- **200:** `{ project }` releído.
- **Errores:** 400 · 404 si no existe o no es suyo.

### `PUT /api/projects/:id/photo` — ngo dueña
- Multipart, campo `photo` (`lib/photoUpload.js`).
- **Orden:** sesión → 429 (20 por hora por ONG) → 503 sin Cloudinary → 400 "Elegí una foto" / 413 → cabecera real (400) → propiedad (404 sin subir nada) → subida (502) → transacción (500, y borra lo subido).
- Guarda la versión ancha (1080 px) en `foto_perfil` (`image`) y el id en `foto_provider_id`, que no sale en la API. La foto anterior se borra después del COMMIT.
- **200:** `{ project }`.

### `DELETE /api/projects/:id` — ngo dueña
- Borra en cascada.
- Después borra en Cloudinary la foto y las de sus Momentos (`Promise.allSettled`). Un fallo de Cloudinary solo queda en el log.
- **200:** `{ message: 'Proyecto eliminado' }` · 404.

### `POST /api/projects/:id/comments` — cualquiera
- **Body:** `{ comment }`: texto ≤ 1000 y, recortado, de al menos 3 caracteres ("Comentario muy corto"). Pasa por `hasBadWord` (400).
- **201:** `{ comment }` con `user_name`, `user_avatar` e `is_participant` (1/0). En `api.ts` se tipa `AppComment`, no `Comment`.
- **Errores:** 400 · 404 si el proyecto no existe.

### `POST /api/projects/:id/ratings` — con inscripción aprobada
- **Body:** `{ rating, comment? }`. `rating` es un entero de 1 a 5 (acepta `"4"`); `comment` ≤ 1000 y pasa por `hasBadWord`.
- Sin inscripción aprobada → 403.
- Es un upsert atómico (`ON CONFLICT (user_id, project_id) DO UPDATE`) que conserva `id` y `created_at`.
- **200:** `{ message: 'Calificación guardada' }`.

### KPIs — ngo dueña (el GET es público)
- **`GET /:id/kpis`** → `{ kpis }`.
- **`POST /:id/kpis`** `{ nombre, descripcion?, valor?, tipo_valor?, unidad?, fecha? }` (`validateKpi`):
  - `nombre` obligatorio, ≤ 120; `descripcion` ≤ 500; `unidad` ≤ 40;
  - `tipo_valor` es `numero` (por defecto), `porcentaje` o `booleano`;
  - `valor` es un número finito o vacío; `fecha` es una fecha `YYYY-MM-DD` que exista.
  - **201:** `{ kpi }`.
- **`PUT /:id/kpis/:kpiId`:** **no es parcial**: pisa todo con el body. **200:** `{ kpi }`.
- **`DELETE /:id/kpis/:kpiId`** → `{ message: "KPI eliminado" }`.
- **Errores:** 403 "Sin permiso sobre este proyecto" si el proyecto no es suyo; 404 si el KPI no es de ese proyecto.

---

## Enrollments (`routes/enrollments.js`)

**Equipo:** las rutas de la ONG preguntan a `managedNgoOfEnrollment`, que responde por el dueño o la coordinación activa. Cualquier otro voluntario recibe 404; una empresa, 403 por rol.

### `POST /api/enrollments` — volunteer
- **Body:** `{ project_id, message?, phone? }`.
  - `phone` es opcional: dígitos, espacios, guiones, paréntesis y un `+` inicial, con 6 a 15 dígitos y hasta 25 caracteres (`parsePhone`). Si no cumple → 400 "Teléfono inválido: …".
- El proyecto tiene que estar `active` y con cupo.
- Crea la postulación `pending`. Después avisa a la ONG en la app y por mail.
- **201:** `{ enrollment, message }`.
- **Errores:** 400 sin `project_id` · 404 "Proyecto no encontrado o inactivo" · 409 "El proyecto no tiene cupos disponibles" / "Ya estás inscripto en este proyecto" (también si llegan dos a la vez).

### `GET /api/enrollments/my`
- **200:** `{ enrollments }` con el proyecto, el `phone` propio y `interview`.

### `GET /api/enrollments/project/:projectId` — ngo dueña o coordinación
- **Query:** `status` opcional.
- **200:** `{ enrollments }`, del más nuevo al más viejo, con estos datos del voluntario: `volunteer_name`, `_email`, `_avatar` y `_bio`.
  - `has_cv` y `phone`: solo si la postulación está `pending` o `approved`.
  - `interview`.
- **Errores:** 403 "Sin permiso sobre este proyecto".

### `PATCH /api/enrollments/:id` — ngo dueña o coordinación
- **Body:** `{ status: 'approved'|'rejected' }`.
- **Transacción:**
  - Compare-and-swap del estado y ajuste de `cupos_ocupados`: +1 al aprobar y −1 (sin bajar de 0) al pasar de aprobada a rechazada.
  - Aprobar exige `cupos_ocupados < cupos` en el `UPDATE`. Si no hay cupo, ROLLBACK y 409.
  - Cancela la entrevista programada.
- Pedir el estado que ya tiene responde 200 sin cambiar nada ni volver a avisar.
- Después del COMMIT, aviso en la app y mail al voluntario.
- **200:** `{ message }` ("Inscripción aprobada" o "Inscripción rechazada").
- **Errores:** 409 "La inscripción cambió mientras la revisabas…" / "El proyecto no tiene cupos disponibles".

### `DELETE /api/enrollments/:id` — el voluntario
- Si estaba aprobada, devuelve el cupo. Es una transacción con compare-and-swap: entre varias cancelaciones a la vez, una da 200 y las demás 404.
- Borra sus entrevistas en cascada.
- **200:** `{ message: 'Inscripción cancelada' }` · 404 · 409.

### Entrevistas — ngo dueña o coordinación
**Forma:** `interview = { id, enrollment_id, date, time, link, place, note, status }`.
- `date` es `YYYY-MM-DD` y `time` es `HH:MM`, en hora de Argentina.
- `status` es `scheduled`, `done` o `cancelled`; en la base, `programada`, `realizada` o `cancelada`.
- Las listas devuelven la programada; si no hay, la última; si nunca hubo, `null`.

**`POST /:id/entrevista`**
- **Body:** `{ date, time, link?, place?, note? }`. Errores 400, con estos mensajes literales:
  - "La fecha tiene que ser AAAA-MM-DD";
  - "La hora tiene que ser HH:MM";
  - "La entrevista tiene que ser en el futuro";
  - "Indicá un link o un lugar para la entrevista".
- El link es `https://` (≤ 500), el lugar ≤ 200 y la nota ≤ 500.
- **Otros errores:**
  - 404 si la postulación no es de la ONG.
  - 409 "Solo se puede agendar una entrevista con la postulación pendiente".
  - 409 "Ya hay una entrevista programada para esta postulación": lo garantiza el índice único parcial.
- Avisa en la app (`interview_scheduled`) y por mail.
- **201:** `{ interview }`.

**`PATCH /:id/entrevista`**
- Actúa sobre la programada; si no hay, 404.
- `{ status: 'cancelled' }` → aviso `interview_cancelled`.
- `{ status: 'done' }` solo si ya pasó; si no, 409 "La entrevista todavía no pasó".
- Sin `status`, la reprograma con las validaciones del alta → aviso `interview_rescheduled`.
- Es un compare-and-swap sobre `programada` (409).
- **200:** `{ interview }`.

### `PATCH /api/enrollments/:id/horas` — ngo dueña o coordinación
- **Body:** `{ horas }`: un número finito de 0 a 10000. Las horas **las certifica la ONG**: el voluntario no las carga.
- **200:** `{ message, horas }`.
- **Errores:** 400 · 404 si no existe, no está aprobada o no es suya.

---

## NGOs (`routes/ngos.js`)

**`fmtNgo`** devuelve `id, user_id, followers, founded, name, logo, cover_image, description, mission, location, category, cuit, transparency_url`. No devuelve `alias`.

**`ngoProjects`** da forma a los proyectos de `/me`, `/:id`, `/:id/projects` y `/:id/dashboard`, igual que `GET /api/projects`: del más nuevo al más viejo, cada uno una vez.

### `GET /api/ngos` — público
- **200:** `{ ngos }`, de la más seguida a la menos. No lee parámetros.

### `GET /api/ngos/me` — ngo
- **200:** `{ ngo, projects, stats, pending_enrollments, funnel }`.
  - `pending_enrollments`: con `volunteer_name`, `_email`, `_avatar`, `project_title` e `interview`.
  - `funnel`: `{ applications, interviewed, approved, with_hours, rejected }`. `interviewed` cuenta las postulaciones con una entrevista programada o realizada.

### `GET /api/ngos/:id` — público
- **200:** `{ ngo, projects }`, con proyectos de todos los estados · 404.

### `PUT /api/ngos/me` — ngo
- **Body:** `{ name? (2–100), description? (≤ 2000), mission? (≤ 1000), location? (≤ 150), logo?, cover_image? (≤ 1000), alias? (≤ 50), founded? (≤ 20), category? (≤ 60), cuit?, transparency_url? }`, parcial.
  - `category` es el nombre de una categoría: si no existe, se ignora.
  - `cuit` tiene 11 dígitos y dígito verificador de AFIP, y se guarda `XX-XXXXXXXX-X`.
  - `transparency_url` es `https://`, ≤ 500.
  - `''` o `null` los borra.
- **200:** `{ ngo }`.
- **Errores:** 400 · 409 "El alias ya está en uso" · 404.

### `GET /api/ngos/:id/projects` — público
- **Query:** `status?`. **200:** `{ projects }`. Ninguna pantalla lo usa.

### `GET /api/ngos/:id/dashboard` — ngo dueña
- **200:** `{ ngo, projects, pending_enrollments, stats }`, con estas columnas explícitas: `message`, `phone`, `hours_logged`.
- No lo usa ninguna pantalla: el panel usa `/me`.
- **Errores:** 403 "Sin acceso".

### Empleados (fichas sin cuenta; se sacan después de la defensa)
- `GET` y `POST /api/ngos/:id/empleados` (ngo dueña; 403 "Sin acceso").
- `POST` `{ nombre, apellido, email, foto_perfil?, rol }`: nombre y apellido obligatorios (≤ 100); `rol` es `coordinador`, `comunicador`, `admin` u `otro`. **201:** `{ empleado }`.
- No hay `PUT` ni `DELETE`.

---

## Empresas (`routes/empresas.js`)

- **`GET /api/empresas`:** `{ empresas }`, con `category`.
- **`GET /api/empresas/:id`:** el perfil público, con `sponsored_projects: [{ id, title, image, ngo_name }]` (solo los aceptados) · 404.
- **`GET /me`** (company): 404 si no tiene perfil.
- **`PUT /me`** (company): `{ name?, description?, mission?, location?, logo?, cover_image?, industry? (≤ 100), category? }`, parcial y con los mismos topes que la ONG → `{ empresa }`.
- **`GET /me/dashboard`** (company): 4 consultas fijas.
  - **200:** `{ stats: { sponsored_projects, pending_proposals, rejected_proposals }, impact: { total_hours, volunteers_reached }, projects: [{ project_id, title, image, project_status, volunteers_needed, current_volunteers, ngo_id, ngo_name, ngo_logo, sponsorship_status, decided_at, hours_logged, volunteers_count }] }`.
  - Solo cuenta como patrocinado lo `aceptado`. El impacto son las horas y personas distintas de los proyectos aceptados.
  - No hay `aporte_total`, porque `aporte` siempre vale 0.
  - Todos los números pasan por `Number()`.

---

## Patrocinio

### Propuesta (`empresas.js` y `ngos.js`; tabla `empresa_voluntariados`)
- **`POST /api/empresas/me/patrocinios`** (company):
  - **Body:** `{ project_id, mensaje? (≤ 1000) }`. El proyecto tiene que estar `active` (si no, 404).
  - Si la propuesta anterior fue rechazada, se reutiliza con un compare-and-swap.
  - **Errores:** 409 "Ya existe una propuesta de patrocinio con este proyecto" (también si llegan dos a la vez).
  - Avisa a la ONG en la app y por mail. **201:** `{ message }`.
- **`DELETE /api/empresas/me/patrocinios/:projectId`:** retira la propuesta solo si está `propuesto` (si no, 404).
- **`GET /api/empresas/me/patrocinios`** y **`GET /api/ngos/me/patrocinios`:** todas las propuestas, con los datos del otro lado.
- **`PATCH /api/ngos/me/patrocinios/:empresaId/:projectId`** `{ estado: 'aceptado'|'rechazado' }`:
  - `aceptado` acepta la versión vigente (`acceptVersion`). Si la empresa ya la había aceptado, se cierra ("Propuesta aceptada", aviso `sponsor_accepted` y mail). Si no, responde "Aceptaste esta versión del acuerdo; falta que la empresa la acepte".
  - Usa compare-and-swap.
  - **Errores:** 404 si no es de un proyecto propio · 409 si ya se decidió.

### Acuerdo negociado (`routes/patrocinios.js`)
- **Quién:** solo las dos partes. Para cualquier otro, 404 "Acuerdo no encontrado".
- **Forma:** `agreement = { company_id, project_id, company_name, ngo_name, project_title, status, version, message, my_side, accepted: { company, ngo }, points[], messages[] }`.
  - `points[] = { id, side, type, detail, amount, created_at, updated_at }`, con `type` igual a `money`, `supplies`, `volunteers`, `outreach` u `other`.
  - `amount` va solo en `money` (> 0 y ≤ 1.000.000.000) y es privado.
  - `accepted.*` cuenta solo la versión vigente.
- **`GET`** → `{ agreement }`.
- **`POST …/puntos`** `{ type, detail (≤ 300), amount? }`, del lado de quien lo manda → 201 `{ agreement }`.
  - **400:** "Tipo de punto inválido", "El detalle es obligatorio", "El detalle no puede estar vacío", "El detalle puede tener hasta 300 caracteres", "Un punto de dinero necesita un monto mayor a 0", "El monto puede ser hasta 1.000.000.000", "Solo un punto de dinero lleva monto".
  - **409:** "Hasta 20 puntos por lado".
- **`PATCH` / `DELETE …/puntos/:puntoId`:** solo la parte dueña del punto (404 "Punto no encontrado"). El `PATCH` es parcial, y pasar de `money` a otro tipo borra el monto.
- **Reglas de los cambios de puntos:**
  - Solo con el acuerdo `propuesto`; si no, 409 "El acuerdo ya está cerrado: no se puede cambiar".
  - En una transacción, primero `version = version + 1 … AND estado = 'propuesto'` y después el punto.
  - No avisan.
- **`POST …/aceptar`** `{ version }`:
  - **Errores:** 400 "version inválida" · 409 "El acuerdo cambió: revisalo de nuevo" · 409 si está cerrado.
  - Si cierra el acuerdo, avisa `sponsorship_closed`; si no, `sponsorship_accepted_by_other`.
- **`POST …/rechazar`:** pasa de `propuesto` a `rechazado` → aviso `sponsorship_rejected`.
- **`POST …/mensajes`** `{ body (≤ 1000) }`: solo con el acuerdo `propuesto`, y no cambia la versión → aviso `sponsorship_message`, 201.

---

## Equipo de la ONG (`routes/ngoTeam.js`, `lib/ngoAccess.js`)

**Roles:**
- `coordinator`: postulaciones, CV, entrevistas, horas y Momentos.
- `communicator`: solo Momentos.

En la base, el rol es `coordinador`/`comunicador` y el estado `invitado`/`activo`. En la API, `role` y `status` (`invited`/`active`).

Solo cuentan los activos. Editar voluntariados, KPIs, Mercado Pago, patrocinios y el equipo es solo del dueño.

- **`GET /miembros`** (ngo) → `{ members: [{ user_id, name, email, avatar, role, status, created_at }] }`.
- **`POST /miembros`** `{ email, role }` (ngo): invita a una cuenta **de voluntario** que ya existe.
  - **Errores:** 400 si el email o el rol son inválidos, o si la cuenta no es de voluntario · 404 "No hay ninguna cuenta con ese email…" · 409 si ya está.
  - **201:** `{ member }`, más el aviso `team_invite` ("Rol: Coordinación/Comunicación. Aceptala o rechazala desde tu Inicio o desde Equipos en tu perfil."). No manda mail.
- **`PATCH /miembros/:userId`** `{ role }` y **`DELETE /miembros/:userId`:** solo su equipo (si no, 404).
- **`GET /mias`** (volunteer) → `{ memberships: [{ ngo_id, ngo_name, ngo_logo, role, status }] }`.
- **`POST /mias/:ngoId/aceptar`:** compare-and-swap; avisa `team_joined` una sola vez. Sin invitación, 404.
- **`DELETE /mias/:ngoId`:** rechaza la invitación o sale del equipo (404 si no hay nada).
- **`GET /:ngoId/panel`** (miembro activo) → `{ ngo: { id, name, logo }, role, projects: [{ id, title, status, image, volunteers_needed, current_volunteers, pending }] }`. La coordinación recibe además `pending_enrollments`.
  - **Errores:** 403 para el invitado, el miembro de otra ONG y el dueño.

---

## Voluntarios (`routes/voluntarios.js`)

- **`GET /me/habilidades`** → `{ habilidades: [{ id, nombre, descripcion, nivel }] }`.
- **`PUT /me/habilidades`** `{ habilidades: [{ habilidad_id, nivel? }] }`:
  - Reemplaza el conjunto en una transacción. Hasta 20; un id repetido vale con la última aparición.
  - `nivel` es `basico` (por defecto), `intermedio` o `avanzado`.
  - **Errores:** 400 · 403.
- **CV** (`cv_url` guarda un `public_id` privado que nunca sale en la API):
  - **`PUT /me/cv`:** multipart, campo `cv`, un PDF (cabecera `%PDF-`) de hasta 5 MB.
    - **200:** `{ has_cv: true }`, y borra el CV anterior.
    - **Errores:** 429 (10 por hora) · 503 · 400 "El CV tiene que ser un PDF" / "Elegí un archivo PDF" / "El archivo no es un PDF válido" · 413 · 404 · 502 · 500 · 409 si cambió mientras se subía (compare-and-swap).
  - **`DELETE /me/cv`** → `{ has_cv: false }` · 409.
  - **`GET /:userId/cv`:**
    - Pueden pedirlo el dueño, o su ONG o coordinación con una postulación `pending`/`approved`.
    - **200:** `{ url, expires_at }`. El link firmado vence a los **10 minutos**.
    - **Errores:** **404 "CV no disponible"**, igual sin permiso, sin CV o si no es voluntario · 503.
- **`GET /:userId`** (público) → `{ volunteer, habilidades, stats: { total_enrollments, approved_enrollments, total_horas }, participaciones }`.
  - `participaciones` son las aprobadas, con columnas crudas en español; el endpoint mezcla nombres en inglés y en español.
  - 404 si no existe o no es voluntario.

---

## Follows y feed (`routes/follows.js`)

- **`toggleFollow`:** `ON CONFLICT DO NOTHING` o `DELETE`, en una transacción. El contador se mueve solo si cambió la fila: es idempotente bajo concurrencia. `new_follower` avisa solo un follow real.
- **ONG y proyecto:** el `POST` da 404 si no existe; el `DELETE` no lo chequea. `GET /ngo`, `/project`: los seguidos. `…/status`: opcional.
- **Voluntario:**
  - Seguirse a uno mismo → 400 "No podés seguirte a vos mismo".
  - Si no existe o no es voluntario → 404 "Voluntario no encontrado".
  - `GET /volunteer/following` y `/followers`: los propios (otro rol, 403). `/:userId/…`: públicos.
- **`GET /feed`** (volunteer): proyectos de las ONG y proyectos seguidos, con `fmt` y los extras.
  - Extras: `my_enrollment_status`, `follow_source` (`ngo_follow`/`project_follow`/`both`), `follow_label`, `ratings` (con la forma del detalle), `recent_comments` (los 3 últimos, con la forma de `comments`) y `comments_count`.
  - **Query:** `limit` (20, máx. 50) y `offset`.
  - **200:** `{ projects, total }`.

---

## Momentos (`routes/posts.js`)

**Forma:** `{ id, caption, created_at (ISO UTC), author: { id, name, avatar, role }, project: { id, title }, photos: [{ id, url, thumb_url, width, height }], likes_count, liked_by_me, can_delete }`.
- `url` va a 1080 px y `thumb_url` es un cuadrado de 480. El `public_id` nunca sale.
- `can_delete` lo calcula el servidor: el autor o la ONG dueña.

- **`GET /eligible-projects`** (volunteer o ngo) → `{ projects: [{ id, title }] }`.
  - Son los voluntariados con inscripción aprobada, los propios y los de las ONG donde la persona es miembro. Una empresa recibe 403.
- **`POST /`** (multipart): `project_id`, `caption?` (≤ 500, con `hasBadWord`), `photos` (de 1 a 5).
  - **Quién:** quien tiene la inscripción aprobada, la ONG dueña o un miembro activo de su equipo. Si no, 403.
  - **Orden:** sesión → 503 → formulario (413, 400) → campos → 404 → 403 → 429 (10 por hora) → cabecera real → subida.
  - Si falla una subida, borra las ya subidas y responde 502. El post se guarda en una transacción después.
  - **201:** `{ post }`.
- **`GET /`** (opcional): filtros `project_id`, `user_id`, `ngo_id` (id de `ngos`; vacío, repetido o de más de 100 caracteres → 400); `limit` (12, máx. 30) y `offset`.
  - **200:** `{ posts, has_more }`, de las más nuevas a las más viejas. El cliente deduplica por id.
- **`GET /:id`** → `{ post }` · 404.
- **`POST` y `DELETE /:id/like`** → `{ liked, likes_count }`. Son idempotentes (404 si no existe).
- **`DELETE /:id`:** el autor o la ONG dueña (403 para otros, 404 si no existe). Borra en una transacción y después las fotos de Cloudinary. **200:** `{ message }`.

---

## Mensajes y WebSocket

- **`GET /conversations`** → `{ conversations: [{ user: { id, name, avatar, role }, last_message, last_at, last_from_me, unread }] }`.
- **`GET /thread/:userId`** → `{ messages: [{ id, sender_id, receiver_id, body, read, created_at }], other }`. Trae los **últimos 300** en orden cronológico, sin paginar · 404.
- **`POST /`** `{ to, body }`:
  - `body` no vacío, ≤ 2000. No se puede uno mandar a sí mismo y el destinatario tiene que existir.
  - **Errores:** 400 "Falta el destinatario", "Destinatario inválido", "Destinatario no encontrado", etc. (`MessageInputError`, el único texto de error que se muestra).
  - Guarda y empuja por WebSocket. **201:** `{ message }`.
- **`PATCH /thread/:userId/read`** → `{ success: true }`.
- **WebSocket** `ws://host/ws?token=<jwt>`:
  - Con un token inválido cierra con `4001`. Al conectar manda `{ type: 'connected' }`; después, `{ type: 'message', message }`.
  - **Solo recibe:** lo que manda el cliente se ignora, y se envía por REST.
  - `maxPayload` es de 64 KB (cierra con `1009`). Admite varias conexiones por usuario.
  - Las conexiones viven en un `Map` en memoria (un solo proceso).

## Notificaciones

- **`GET /api/notifications`** → `{ notifications, unread }`:
  - `notifications`: a lo sumo 50, con `id, user_id, type, title, body, read, data, created_at`.
  - `unread`: el total sin leer, contado en SQL.
- **`PATCH /:id/read`** → `{ message: 'Marcada como leída' }`. Una notificación ajena o inexistente da 200 sin tocar nada.
- **`PATCH /read-all`** → `{ message: 'Todas marcadas como leídas' }`.

## FAQs (`routes/faqs.js`; sin IA)

- `migrate.js` carga las FAQs y actualiza las respuestas existentes. Las respuestas nombran pantallas y botones, y `faqs-ui-names.test.js` controla que existan.
- **`GET /api/faqs?categoria=`** (`voluntario`/`ngo`/`general`) → `{ faqs: [{ id, categoria, pregunta, respuesta }] }`.
- **`POST /ask`** `{ question (3–500), categoria? (≤ 50) }`: puntúa por palabras clave en JS, solo entre las activas (`activo = true`).
  - Con coincidencia: `{ matched: true, best, alternatives }`.
  - Sin coincidencia: `{ matched: false, suggestions: [{ id, pregunta }] }`.
  - **400:** "La pregunta es muy corta" y los tipos inválidos.

## Catálogos y salud (`src/index.js`)

- **`/api/categorias`** → `{ categorias }` · **`/api/roles`** → `{ roles }` · **`/api/habilidades`** → `{ habilidades }`.
- **`/api/stats`** → `{ active_projects, volunteers, ngos }`, normalizados con `Number`.
- **`GET /health`** → `{ status: 'ok', timestamp, commit }`. `commit` es `RENDER_GIT_COMMIT`, que el deploy espera ver. No consulta la base.

---

## Donaciones (`routes/donaciones.js`; Mercado Pago en modo prueba)

### `POST /api/donaciones` — volunteer o company
- **Body:** `{ project_id, amount }`. `amount` es un **entero de pesos** de 100 a 500.000, porque `monto` es REAL (`float4` en Postgres).
- **Pasos:**
  1. `sellerAccounts.getValidToken(ngo_id)`: el token de la ONG, renovado si hace falta.
  2. Inserta la donación `pendiente`, con `cobrador_mp_user_id`.
  3. Crea la preferencia con el token de la ONG, sin comisión ni `notification_url`. La vuelta es `APP_URL/donaciones/vuelta`.
  4. Guarda `external_id`. **No suma** a `recaudado`.
- **201:** `{ donation_id, checkout_url }`.
- **Errores:**
  - 400: "Falta el proyecto", "El monto tiene que ser un número entero de pesos", "El monto mínimo es de $100" o "El monto máximo es de $500.000".
  - 403 (ONG) · 404 "Proyecto no encontrado o no recibe donaciones" · 429 (10 por hora).
  - **409 "Esta ONG todavía no recibe donaciones"**, cuando la ONG no tiene una cuenta vinculada.
  - **503 "Esta ONG no puede recibir donaciones en este momento"**, si la cuenta requiere reconexión, falta `MP_TOKEN_KEY` o Mercado Pago responde 401 (en ese caso la donación queda `fallida`).
  - 502 si falla la preferencia (la donación queda `fallida` con `external_status='preference_error'`).

### `POST /api/donaciones/webhook` — firma de Mercado Pago
- **Webhook** `?type=payment&data.id=…`:
  - Verifica la firma (`x-signature`, `x-request-id`, `MP_WEBHOOK_SECRET`) con el id de la **query**, nunca el del cuerpo.
  - El `user_id` del cuerpo no está firmado: solo elige el token con el que consultar.
  - Llama a `applyPayment`.
- **IPN** (`?topic=…`): 200 sin procesar.
- **Respuestas:** 200 `{ received: true }` (procesado, de otro tipo o pago inexistente) · 401 "Firma inválida" · 400 sin `data.id` · **500** "No pudimos procesar el aviso", para que Mercado Pago reintente.
- **Log:** una línea `[donaciones] …`, nunca con la firma ni secretos.

### `GET /api/donaciones/:id` — quien donó
- **200:** `{ donation: { id, status (pending/completed/failed/refunded), amount, currency, project_id, project_title } }`.
- **Conciliación:** con `?payment_id=` (numérico, hasta 30 dígitos) y la donación pendiente, llama a `applyPayment(payment_id, { expectDonationId })`. Consulta con la cuenta que cobró, o con `MP_ACCESS_TOKEN` si la donación es vieja. Nunca usa el `status` de la URL de vuelta.
- **Errores:** 404 "Donación no encontrada", también si es de otra persona.

### `applyPayment(paymentId, { expectDonationId? })` (exportada, no es un endpoint)
1. Consulta el pago a Mercado Pago, que es la única fuente de verdad.
2. Resultados que no cambian la donación:
   - `ignored`: sin `external_reference`;
   - `mismatch`: otra donación, u otra cuenta que la que cobró;
   - `unknown_donation`.
3. No aprobado → `not_approved`: solo anota `external_status`.
4. Monto o moneda distintos → `amount_mismatch`.
5. Aprobado: en una transacción, compare-and-swap `pendiente` → `completada` y `recaudado += monto` → `credited`. Si ya estaba completada → `already`.
6. Después del COMMIT avisa a la ONG (`donation_received`). Si Mercado Pago o la base fallan, **lanza**.

## Cuenta de Mercado Pago de la ONG (`routes/mercadopago.js`)

Se monta en `/api/ngos/me/mercadopago`, antes que `/api/ngos`. Pide rol ngo y nunca devuelve tokens.
- **`GET`** → `{ account: null | { mp_user_id, status: 'active'|'needs_reconnect', origin: 'oauth'|'manual', expires_at }, oauth_available }`. `oauth_available` exige `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_OAUTH_REDIRECT_URI` y `MP_TOKEN_KEY`.
- **`POST /connect`** → `{ authorization_url }`. Guarda el hash de un `state` de 32 bytes, que vive 10 minutos (uno por ONG) · 503 sin configuración.
- **`POST /callback`** `{ code, state }`: lo llama `/ngo/mercadopago/vuelta`, con la sesión de la ONG.
  - Consume el `state` y después, fuera de la transacción, llama a `exchangeCode`. Guarda los tokens cifrados → `{ account }`.
  - **400:** `state` inválido, de otra ONG o vencido; `invalid_grant`; token productivo.
  - **502:** otro error de Mercado Pago · **409:** la cuenta ya está vinculada a otra ONG · **503:** sin configuración.
  - El `state` queda usado aunque falle.
- **`DELETE`** → `{ disconnected }`. Mercado Pago no permite revocar desde la app.
- **Carga manual:** `MP_MANUAL_SELLER_TOKEN=… node scripts/vincular-mp-manual.js <ngo_id>`.
  - Exige el tag `test_user` y guarda origen `manual`, sin vencimiento.
  - Con `--solo-ver`, solo muestra de quién es el token.

---

## Tablas sin API y faltantes

- **Tablas sin API:** ninguna. `reuniones` se usa solo para las entrevistas atadas a una postulación.
- **Faltan:**
  - editar y borrar empleados (se van a sacar);
  - borrar una reseña propia (editarla es reenviar el `POST`, que es un upsert);
  - paginar el chat más allá de 300 mensajes.
