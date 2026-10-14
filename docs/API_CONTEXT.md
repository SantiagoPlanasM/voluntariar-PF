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
| POST | `/api/auth/register` | No | — | `routes/auth.js` |
| POST | `/api/auth/login` | No | — | `routes/auth.js` |
| GET | `/api/auth/me` | Sí | cualquiera | `routes/auth.js` |
| PUT | `/api/auth/me` | Sí | cualquiera | `routes/auth.js` |
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
| GET | `/api/follows/volunteer/following` | Sí | cualquiera | `routes/follows.js` |
| GET | `/api/follows/volunteer/followers` | Sí | cualquiera | `routes/follows.js` |
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
- **Body:** `{ name, email, password, role: 'volunteer'|'ngo'|'company', ...(campos específicos por rol) }`
- **Validación:** `validateName` (mín. 2 caracteres), `validateEmail` (regex), `validatePassword` (mín. 6 caracteres) — regex duplicadas en `frontend/AuthModal.tsx`.
- **Efecto:** crea fila en `users`; según `role`, crea también fila en `voluntarios`, `ngos` o `empresas` con `user_id` como FK.
- **Respuesta 201:** `{ token, user }`
- **Errores:** `400` (validación o email duplicado — `users.email` es UNIQUE).

### `POST /api/auth/login`
- **Body:** `{ email, password }`
- **Respuesta 200:** `{ token, user }`
- **Errores:** `401` credenciales inválidas (mismo mensaje genérico tanto si el email no existe como si la password no matchea, para no filtrar existencia de cuentas).

### `GET /api/auth/me` — Auth
- **Respuesta 200:** `{ user }` (incluye datos de `users` + perfil extendido según rol, vía JOIN a `voluntarios`/`ngos`/`empresas`).
- **Errores:** `401` sin token o token inválido.

### `PUT /api/auth/me` — Auth
- **Body:** campos actualizables del perfil extendido (`bio`, `location`, `avatar`, y campos propios de la tabla de rol).
- **Respuesta 200:** `{ user }` actualizado.

---

## Projects (`routes/projects.js`)

### `GET /api/projects` — Auth opcional
- **Query params:** `search`, `type`/`tipo` (`fugaz`/`sostenido`), `category`/`categoria` (uno o varios ids), `status` (default `active`), `ngo_id`, `modality`/`modalidad` (`presencial`/`remoto`/`hibrido` — agregado por el usuario 2026-09), `sort` (`featured` default, también `rating`, `recent`), `page`, `limit`, `offset`.
- **⚠️ `limit` default es 20** si no se pasa explícito. Cualquier pantalla que necesite "todos los proyectos" para filtrar/buscar/mapear del lado del cliente (como hace `ExploreScreen.tsx`) **tiene que pasar un `limit` alto a propósito**, o los resultados quedan truncados en silencio — así se manifestó un bug real (`PROJECT_ANALYSIS.md §29`, ya arreglado ahí, pero la causa de fondo — sin paginación real — sigue en pie).
- **Comportamiento:** filtra dinámicamente según los params presentes. **Bifurca implementación según motor de DB** (ver `BACKEND_CONTEXT.md §2`, §10.6):
  - Postgres: una sola query con `json_agg` para traer roles/requisitos/categoría agregados. Los dos `json_agg` agregan **strings** (`DISTINCT ro.nombre`, `DISTINCT req.descripcion`), la misma forma que la rama SQLite y que `GET /:id`; `pg` los entrega ya parseados y `parseJson` los devuelve tal cual. Antes los roles salían como objetos y `parseJson` tiraba todo a `[]` (`PROJECT_ANALYSIS.md §52`). Test: `test/integration/projects-list-shape.test.js` (listado vs. detalle, en los dos motores).
  - SQLite: query base + **loop de queries adicionales por fila** (N+1) para roles, requisitos y categoría — usando la traducción de `translatePg()`.
- **Respuesta 200:** `{ projects: Project[], total, page, limit }`, cada `Project` pasado por `fmt()` (incluye `latitude`/`longitude`/`modality`, agregados por el usuario 2026-09).
- Si hay usuario autenticado (`optionalAuth`), cada proyecto incluye `my_enrollment` si el usuario ya está inscripto.

### `GET /api/projects/recommended` — Auth, role `volunteer`
- **Query params:** `limit` (default 10, máx. 30).
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
  - Con historial vacío ("cold start"), cae a señales 4-8 (sin las que dependen de historial de inscripción/habilidades).
- **IMPORTANTE — orden de rutas:** esta ruta está declarada antes de `GET /:id` en `projects.js`. Si se moviera después, Express interpretaría `recommended` como el parámetro `:id` y la ruta dejaría de ser alcanzable — cualquier ruta nueva de `projects.js` sin parámetro debe declararse antes de `/:id`.
- **Respuesta 200:** `{ recommendations: Project[], is_cold_start: boolean }`, cada `Project` con `recommendation_score` (número), `recommendation_reasons` (array de strings) y `recommendation_tags` (array de strings cortos con emoji, para chips en la UI).
- **Errores:** `401` sin token, `403` si el rol no es `volunteer`.

### `GET /api/projects/:id` — Auth opcional
- **Respuesta 200:** `{ project }` con roles, requisitos, categoría, comentarios recientes, rating promedio, y (si hay sesión) `my_enrollment`.
- **Errores:** `404` si no existe o `status='cancelled'` y el requester no es la ONG dueña.

### `POST /api/projects` — Auth, role `ngo`
- **Body real (en inglés — a diferencia de otros endpoints, acá el body ya viaja con los mismos nombres que usa el frontend, no en español):** `{ title, description, full_description?, image?, category?, location, type: 'fugaz'|'sostenido', duration?(si fugaz), hours_per_week?(si sostenido), volunteers_needed, funding_goal?, cost_per_person?, roles_needed?: string[], requirements?: string[] }`
- **Validación (`validateProject`):** título y descripción no vacíos, `hasBadWord()` contra la blacklist, `volunteers_needed > 0`, duración obligatoria si `type='fugaz'`, `hours_per_week` obligatorio y `>0` si `type='sostenido'`. *(Corregido — hasta hace poco el backend validaba/leía `cupos` en vez de `volunteers_needed`, lo que hacía fallar siempre la creación de proyectos con "Los cupos deben ser un número positivo". Ver `PROJECT_ANALYSIS.md §13`, bug B5.)*
- **Efecto:** `INSERT` en `projects` (mapeando `volunteers_needed → cupos` internamente), luego `INSERT` en `requisitos`, `project_roles`, `project_categorias` para cada elemento de los arrays recibidos.
- **Respuesta 201:** `{ project }`.
- **Errores:** `400` validación / palabra prohibida, `403` si el usuario no tiene perfil de ONG asociado.
- **Id propio (`PROJECT_ANALYSIS.md §40`):** el handler genera el id con `crypto.randomUUID()`, lo usa en el `INSERT`, para releer la fila y para asociar categoría/roles/requisitos. *(Antes buscaba "el último proyecto de la ONG" por `created_at`: en SQLite, con resolución de 1 s, dos altas de la misma ONG en el mismo segundo empataban, devolvía el más viejo y le enganchaba las asociaciones.)*

### `PUT /api/projects/:id` — Auth, role `ngo` (dueño)
- Verifica `ngo_id` de la sesión contra el `ngo_id` del proyecto (join implícito vía `WHERE id=$1 AND ngo_id=$2`).
- **Body:** mismos campos que create (en inglés: `title`, `description`, `full_description`, `image`, `location`, `type`, `duration`, `volunteers_needed`, `funding_goal`, `cost_per_person`, `hours_per_week`, `status`), todos opcionales (actualización parcial). *(Corregido — tenía el mismo bug que `POST /`, leía `cupos` en vez de `volunteers_needed`. Ver `PROJECT_ANALYSIS.md §13`, bug B5.)*
- **Capacidad (`PROJECT_ANALYSIS.md §40`):** `volunteers_needed` **omitido o `null` conserva la capacidad actual** (antes se pisaba con `0`); un valor explícito debe ser un entero ≥ 1 (**400** `"Los cupos deben ser un número positivo"`, igual que al crear; antes un negativo violaba el `CHECK(cupos >= 0)` y devolvía 500). **No se puede bajar por debajo de las inscripciones aprobadas**: **400** `"No podés bajar la capacidad a N: ya hay M voluntarios aprobados."`. La condición va dentro del propio `UPDATE` (`... AND cupos_ocupados <= $9`), así que es atómica frente a aprobaciones concurrentes. **No es una actualización parcial real**: el resto de los campos omitidos no se conserva (p. ej. `status` omitido vuelve a `'active'`); no se verificó qué hace cada uno. Ninguna pantalla del frontend usa hoy este endpoint.
- **Respuesta 200:** `{ project }`. **Errores:** `404` si el proyecto no existe o no pertenece a la ONG del usuario (no distingue "no existe" de "no es tuyo", por diseño).

### `DELETE /api/projects/:id` — Auth, role `ngo` (dueño)
- Borra el proyecto (cascada elimina requisitos, roles, comentarios, ratings, kpis, enrollments asociados — ver `DATABASE_CONTEXT.md §5`).
- **Respuesta 200:** `{ success: true }`.

### `POST /api/projects/:id/comments` — Auth (cualquier rol)
- **Body:** `{ comment }`. Pasa por `hasBadWord()`.
- **Respuesta 201:** `{ comment }` (incluye datos del autor vía JOIN a `users`, más `is_participant: boolean` — agregado por el usuario 2026-09, para que el frontend distinga si quien comenta participó del proyecto o no).
- **Ojo en el frontend:** `api.ts` tipa esta respuesta como `{ comment: AppComment }` — si se toca este endpoint, no usar `Comment` a secas como tipo (es el tipo global del DOM, no el propio; ya pasó una vez, ver `PROJECT_ANALYSIS.md §29`).

### `POST /api/projects/:id/ratings` — Auth (cualquier rol)
- **Body:** `{ rating (1-5), comment? }`.
- **Restricción agregada por el usuario (2026-09):** solo puede calificar quien tenga una `enrollment` con `status='approved'` en ese proyecto — `403` si no. Antes cualquier usuario logueado podía calificar sin haber participado.
- **Comportamiento:** hace upsert real (`UPDATE` si ya existe una calificación de ese usuario para ese proyecto, `INSERT` si no) — ya no es "calificar una sola vez sin poder editar".
- **Respuesta 201:** `{ rating }`.

### `GET /api/projects/:id/kpis` — Público
- **Respuesta 200:** `{ kpis: KPI[] }` de ese proyecto.

### `POST /api/projects/:id/kpis` — Auth, role `ngo` (dueño)
- **Body:** `{ nombre, descripcion?, valor?, tipo_valor?, unidad?, fecha? }`
- **Respuesta 201:** `{ kpi }`.

### `PUT /api/projects/:id/kpis/:kpiId` — Auth, role `ngo` (dueño)
- Actualización parcial de un KPI existente. **Respuesta 200:** `{ kpi }`.

### `DELETE /api/projects/:id/kpis/:kpiId` — Auth, role `ngo` (dueño)
- **Respuesta 200:** `{ success: true }`.

---

## Enrollments (`routes/enrollments.js`)

### `POST /api/enrollments` — Auth, role `volunteer`
- **Body esperado por el backend:** `{ project_id, message }`. *(Corregido — antes el backend leía `mensaje`, hoy lee `message`, igual que lo envía el frontend; se guarda en la columna `mensaje` de la DB y se expone como `message` en todas las lecturas. Ver `PROJECT_ANALYSIS.md §13`.)*
- **Validación:** proyecto debe existir, `status='active'`, `cupos_ocupados < cupos`, y no debe existir ya una fila `(user_id, project_id)` (constraint `UNIQUE`).
- **Efecto:** `INSERT` en `enrollments` con `status='pending'`; notificación fire-and-forget a la ONG dueña del proyecto.
- **Respuesta 201:** `{ enrollment }`. **Errores:** `400` (ya inscripto / sin cupos / proyecto no activo), `404` (proyecto no existe).

### `GET /api/enrollments/my` — Auth
- **Respuesta 200:** `{ enrollments: Enrollment[] }` del usuario logueado, con datos del proyecto embebidos (JOIN).

### `GET /api/enrollments/project/:projectId` — Auth, role `ngo` (dueño del proyecto)
- **Respuesta 200:** `{ enrollments: Enrollment[] }` de ese proyecto, con datos del voluntario embebidos.
- **Errores:** `404` si el proyecto no pertenece a la ONG de la sesión.

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
- **Body:** `{ horas }`.
- **UI:** `NGOProjectDetail.tsx`, un input + botón por cada inscripto aprobado. El voluntario ve el valor ya cargado (solo lectura) en `MyParticipation.tsx`.
- **Respuesta 200:** `{ message, horas }`. **Errores:** `403` si no sos ONG, `404` si la inscripción no existe, no está aprobada, o el proyecto no es tuyo.
- **Respuesta 200:** `{ enrollment }`.

**Alertas por email:** `POST /` y `PATCH /:id` (aprobar/rechazar) además disparan un email (fire-and-forget, vía `lib/email.js` + Resend) a la ONG o al voluntario según corresponda, al lado de la notificación in-app que ya existía. Sin `RESEND_API_KEY` configurada, el envío se omite silenciosamente — nunca bloquea ni rompe la respuesta del endpoint. Ver `PROJECT_ANALYSIS.md §19`.

---

## NGOs (`routes/ngos.js`)

### `GET /api/ngos` — Público
- **Query params:** `search`, `categoria`, `ubicacion`, `page`, `limit`.
- Hace `JOIN` con `ngo_categorias`/`categorias`, expone `categoria_nombre` en el resultado crudo, y `fmtNgo()` lo mapea a `category` en la respuesta final.
- **Respuesta 200:** `{ ngos: NGO[], total, page, limit }`.

### `GET /api/ngos/me` — Auth, role `ngo`
- Devuelve el perfil completo de la ONG de la sesión, incluyendo `category` (mismo JOIN que `GET /api/ngos`; corregido — antes no lo incluía, ver `PROJECT_ANALYSIS.md §13`).

### `GET /api/ngos/:id` — Público
- Perfil público de una ONG por id, incluyendo `category` (corregido — antes no lo incluía) y la lista de proyectos de esa ONG con su categoría. *(Corregido — la subquery de proyectos tenía una columna `id` ambigua entre `projects` y `categorias` que causaba un `500` en todos los casos. Ver `PROJECT_ANALYSIS.md §16`, bug B6.)*
- **Errores:** `404` si no existe.

### `PUT /api/ngos/me` — Auth, role `ngo`
- **Body:** campos escalares de `ngos` (`nombre`, `descripcion`, `foto_perfil`, `banner`, `mision`, `ubicacion`, etc.) más `category` (nombre de categoría, ej. `"Educación"`). *(Corregido — antes no persistía la categoría; ahora busca el `id` en `categorias` por nombre y reemplaza la fila correspondiente en `ngo_categorias`. Si el nombre no matchea ninguna categoría existente, el resto del perfil se guarda igual y la categoría simplemente no cambia.)*
- **Respuesta 200:** `{ ngo }` (incluye `category` actualizada).

### `GET /api/ngos/:id/projects` — Público
- **Query params:** `status` (default `active`).
- **Respuesta 200:** `{ projects: Project[] }` de esa ONG.

### `GET /api/ngos/:id/dashboard` — Auth, role `ngo` (dueño)
- **Respuesta 200:** agregados para el dashboard: total de proyectos, proyectos activos, total de inscripciones, inscripciones pendientes, etc. (No se llama una vez por el frontend para todo — `NGODashboard.tsx` complementa esto con requests individuales por proyecto, ver `FRONTEND_CONTEXT.md §15.5`.)

### `GET /api/ngos/:id/empleados` — Auth, role `ngo` (dueño)
- **Respuesta 200:** `{ empleados: Empleado[] }`.

### `POST /api/ngos/:id/empleados` — Auth, role `ngo` (dueño)
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
- **Body:** `{ project_id, mensaje? }`. El proyecto debe existir y estar `active`.
- Crea la propuesta en estado `propuesto`. Si ya existe una propuesta **rechazada** con ese proyecto, la reutiliza (resetea a `propuesto`) en vez de fallar — así se puede volver a proponer. Si ya existe una `propuesta`/`aceptada` sin decidir o vigente, `409`.
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
- Notifica a la empresa (in-app + email).

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
- **400** si `question` tiene menos de 3 caracteres.
- Solo FAQs con `activo` verdadero, en las dos rutas. El filtro es `activo=true` (no `activo=1`: en Postgres la columna es BOOLEAN y daba 500 siempre, `PROJECT_ANALYSIS.md §51`). Tests: `test/integration/faqs.test.js`.

---

## Follows y Feed personalizado (`routes/follows.js`)

> Agregado por el usuario (2026-09), documentado retroactivamente tras la revisión de código (ver `PROJECT_ANALYSIS.md §28`). Cubre 3 tipos de "seguir": Voluntario→ONG (`ngo_follows`), Voluntario→Proyecto (`project_follows`) y Voluntario→Voluntario (`volunteer_follows`, tabla nueva). Todo bajo `/api/follows`.

**Importante para cualquier endpoint nuevo que devuelva proyectos:** este router **reusa `fmt` exportado desde `routes/projects.js`** (`const { fmt: fmtProject } = require('./projects')`) — no mantener una copia propia del formateador acá ni en ningún router nuevo. Una copia duplicada ya se desincronizó una vez (le faltaban `latitude`/`longitude`/`modality`) y causó un bug real, arreglado en `PROJECT_ANALYSIS.md §29`.

### ONG (`ngo_follows`)
- `POST /ngo/:ngoId` / `DELETE /ngo/:ngoId` — seguir/dejar de seguir (auth, `volunteer`).
- `GET /ngo` — mis ONGs seguidas (auth, `volunteer`).
- `GET /ngo/:ngoId/status` — ¿la sigo? (público, `optionalAuth`).

### Proyecto (`project_follows`)
- `POST /project/:projectId` / `DELETE /project/:projectId` — seguir/dejar de seguir (auth, `volunteer`).
- `GET /project` — mis proyectos seguidos (auth, `volunteer`).
- `GET /project/:projectId/status` — ¿lo sigo? (público, `optionalAuth`).

### Voluntario (`volunteer_follows`)
- `POST /volunteer/:userId` / `DELETE /volunteer/:userId` — seguir/dejar de seguir a otro voluntario (auth, `volunteer`; no se puede auto-seguir, CHECK en DB).
- `GET /volunteer/following` / `GET /volunteer/followers` — mis seguidos/seguidores (auth).
- `GET /volunteer/:userId/status` — ¿lo sigo? (público).
- `GET /volunteer/:userId/followers` / `GET /volunteer/:userId/following` — listas públicas de otro usuario.

### Feed
- `GET /feed` (auth, `volunteer`) — proyectos de las ONGs/proyectos seguidos, con `my_enrollment_status` resuelto por proyecto (batched, sin N+1) y formateados con el mismo `fmt` de `/api/projects` (incluye `latitude`/`longitude`/`modality`).

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
- **Query:** `project_id`, `user_id` (filtros; sirven para la galería de un proyecto y la grilla de un perfil), `limit` (default 12, máx. 30; inválido → default), `offset` (default 0; inválido → 0).
- **Respuesta 200:** `{ posts: [...], has_more }`. Más nuevas primero (desempate por id). Paginación por `limit/offset`: si entran publicaciones nuevas mientras se pagina pueden correrse las páginas; el cliente debe deduplicar por `id`. `liked_by_me` es `false` sin sesión. Tres consultas por página (no una por publicación).

### `GET /api/posts/:id` — Auth opcional
- **Respuesta 200:** `{ post }`. `404` si no existe.

### `POST /api/posts/:id/like` y `DELETE /api/posts/:id/like` — Auth (cualquier rol)
- **Respuesta 200:** `{ liked: true|false, likes_count }`. **Idempotentes**: repetir el like (doble click, pedidos simultáneos) no suma ni falla; quitar uno que no existe no deja el contador en negativo. `404` si el post no existe.

### `DELETE /api/posts/:id` — Auth
- **Quién:** el autor, o la **ONG dueña del proyecto** (moderación: puede borrar cualquier publicación de él). Otro voluntario, una ONG ajena o una empresa → `403`.
- **Efecto:** borra post, fotos y likes en una transacción; **después del COMMIT** y sin esperar, borra los archivos de Cloudinary (mejor esfuerzo: si falla, el post se borra igual y se loguea). **Respuesta 200:** `{ message }`.

## Voluntarios (`routes/voluntarios.js`)

### `GET /api/voluntarios/me/habilidades` — Auth, role `volunteer`
- **Respuesta 200:** `{ habilidades: [{ id, nombre, descripcion, nivel }] }` — las habilidades del voluntario logueado, vía `JOIN` a `habilidades`. Devuelve `[]` si todavía no cargó ninguna.

### `PUT /api/voluntarios/me/habilidades` — Auth, role `volunteer`
- **Body:** `{ habilidades: [{ habilidad_id, nivel? }] }` — `nivel` es `'basico'` (default), `'intermedio'` o `'avanzado'`.
- **Comportamiento:** reemplaza el conjunto completo (borra todas las filas previas de `voluntario_habilidades` para ese usuario e inserta las nuevas) — más simple para la UI que calcular altas/bajas/cambios de nivel. Igual patrón que la categoría de ONG (`PUT /api/ngos/me`).
- **Validación:** máximo 20 habilidades, cada `habilidad_id` debe existir en el catálogo (`habilidades`), `nivel` debe ser uno de los tres valores válidos.
- **Respuesta 200:** `{ habilidades: [...] }` (el conjunto ya actualizado, mismo formato que el `GET`).
- **Errores:** `400` (formato inválido, habilidad inexistente, nivel inválido), `403` si el usuario no es `volunteer`.

### `GET /api/voluntarios/:userId` — Público
- Agregado por el usuario (2026-09). Perfil público de un voluntario: datos básicos + `followers`/`following_count` + últimas participaciones (`LIMIT 20`). Sin auth requerida.
- Nota: mezcla campos en inglés (`name`, `avatar`, `bio`, `location`) con algunos crudos en español (`nombre`, `apellido`, `descripcion`) en la misma respuesta — no es un bug, pero al tocar este endpoint conviene normalizar del todo a inglés en vez de sumar más campos híbridos.

---

## Mensajes / Chat (`routes/messages.js` + `src/ws/index.js`)

Chat 1 a 1 básico. El historial y el envío tienen doble vía: REST (siempre disponible, fuente de verdad) y WebSocket (tiempo real, cuando el destinatario está conectado).

### `GET /api/messages/conversations` — Auth
- **Respuesta 200:** `{ conversations: [{ user: {id,name,avatar,role}, last_message, last_at, last_from_me, unread }] }` — una fila por cada persona con la que el usuario logueado tiene al menos un mensaje, ordenadas por el más reciente primero.

### `GET /api/messages/thread/:userId` — Auth
- **Respuesta 200:** `{ messages: [{id,sender_id,receiver_id,body,read,created_at}], other: {id,name,avatar,role} }` — hasta los últimos 300 mensajes con esa persona, orden cronológico ascendente.
- **Errores:** `404` si `userId` no existe.

### `POST /api/messages` — Auth
- **Body:** `{ to, body }`.
- **Validación:** `body` no vacío, máx. 2000 caracteres, no podés mandarte a vos mismo, el destinatario debe existir.
- **Efecto:** persiste el mensaje; si el destinatario tiene una conexión de WebSocket abierta, se lo empuja en tiempo real (`sendToUser`).
- **Respuesta 201:** `{ message: {...} }`. **Errores:** `400` (validación), `404` (destinatario inexistente).

### `PATCH /api/messages/thread/:userId/read` — Auth
- Marca como leídos todos los mensajes que `userId` le mandó al usuario logueado.
- **Respuesta 200:** `{ success: true }`.

### WebSocket — `ws://host/ws?token=<jwt>`
- **Autenticación:** el mismo JWT que usa el resto de la API, pasado por query string (no hay un segundo login para el chat). Si el token falta o es inválido, el servidor cierra la conexión con código `4001` inmediatamente después de aceptarla.
- **Al conectar:** el servidor manda `{ type: 'connected' }`.
- **Mensajes entrantes (servidor → cliente):** `{ type: 'message', message: {...} }` cuando alguien te escribe (ya sea que el otro lo haya mandado por REST o por WS).
- **Mensajes salientes opcionales (cliente → servidor):** `{ type: 'send', to, body }` — atajo para mandar sin pasar por REST; usa la misma validación e inserción que `POST /api/messages` internamente. El cliente web (`ChatContext.tsx`) lo usa cuando hay conexión abierta, y cae a `POST /api/messages` si no la hay.
- **Multi-dispositivo:** un mismo usuario puede tener varias conexiones abiertas (pestañas/dispositivos); todas reciben los mensajes entrantes.
- **Límite conocido:** el registro de conexiones es un `Map` en memoria de un solo proceso Node — no hay backplane compartido (Redis u otro) entre instancias. Ver `PROJECT_ANALYSIS.md §18` para el detalle.

---

## Notifications (`routes/notifications.js`)

### `GET /api/notifications` — Auth
- **Respuesta 200:** `{ notifications: Notification[] }` del usuario, más recientes primero.

### `PATCH /api/notifications/:id/read` — Auth (dueño)
- Marca una notificación puntual como leída. **Nota de implementación:** el `UPDATE` usa el literal SQL `read=true` (no un parámetro bindeado) — funciona porque SQLite moderno (bundlado por `better-sqlite3`) soporta el literal `TRUE`, pero es una inconsistencia de estilo respecto al resto del código, que siempre usa placeholders `$n`.
- **Respuesta 200:** `{ success: true }`.

### `PATCH /api/notifications/read-all` — Auth
- Marca todas las notificaciones del usuario logueado como leídas.
- **Respuesta 200:** `{ success: true }`.

---

## Catálogos (`src/index.js`, sin archivo de ruta propio)

### `GET /api/categorias` — Público
- **Respuesta 200:** `{ categorias: Categoria[] }` — catálogo completo, sin paginar.

### `GET /api/roles` — Público
- **Respuesta 200:** `{ roles: Rol[] }` — catálogo completo de roles de voluntariado.

### `GET /api/habilidades` — Público
- **Respuesta 200:** `{ habilidades: Habilidad[] }` — catálogo completo de habilidades.

### `GET /health` — Público (fuera de `/api`)
- **Respuesta 200:** `{ status: 'ok', timestamp }` — usado por Render para health checks.

---

## Endpoints ausentes (funcionalidad de esquema sin API)

Las tablas `donaciones` y `reuniones` **existen en el esquema de base de datos pero no tienen ningún endpoint que las lea o escriba**. Cualquier tarea futura que mencione "donaciones" o "reuniones/videollamadas" requiere **construir la API desde cero**, no modificar una existente. *(`voluntario_habilidades` dejó de estar en esta lista — ya tiene API completa, ver sección "Voluntarios" arriba y `PROJECT_ANALYSIS.md §17`. El perfil de `empresas` tampoco — ver sección "Empresas" arriba. `empresa_voluntariados` tampoco — ver sección "Patrocinio" arriba y `PROJECT_ANALYSIS.md §26`. `ngo_follows`/`project_follows`/`volunteer_follows` tampoco — ya tienen API completa, ver sección "Follows y Feed personalizado" arriba y `PROJECT_ANALYSIS.md §28`.)*

## Endpoints duplicados o inconsistentes detectados

1. **Ninguna ruta está técnicamente duplicada** (no hay dos endpoints con el mismo método+path). Las inconsistencias de contrato que existían entre `POST /api/enrollments` (`mensaje` vs `message`) y entre las tres rutas de NGO respecto a `category` fueron corregidas — ver `PROJECT_ANALYSIS.md §13`.
2. **Falta de endpoint de edición/borrado de empleados** (`empleados` solo tiene `GET`/`POST`, no `PUT`/`DELETE`), inconsistente con el resto de recursos del sistema que sí ofrecen CRUD completo (proyectos, KPIs).
3. **Falta de endpoint para editar una calificación (`rating`) existente** — solo se puede crear una vez (`UNIQUE` constraint) y no hay `PUT /api/projects/:id/ratings/:ratingId`.
