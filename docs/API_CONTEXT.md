# API_CONTEXT.md — VoluntariAR REST API

> Base URL local: `http://localhost:3001/api` · Producción: `https://voluntariar-api.onrender.com/api` (definido en `frontend/.env`/`.env.example` como `VITE_API_URL`).
> Todas las respuestas son JSON. Errores: `{ "error": "mensaje en español" }` con el código HTTP correspondiente.
> Formato de fecha: ISO 8601 (`TIMESTAMPTZ`/`DATETIME`).
> "Auth" = requiere header `Authorization: Bearer <jwt>`. "Auth opcional" = el endpoint funciona sin token pero personaliza la respuesta si hay uno válido.

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
  - Postgres: una sola query con `json_agg` para traer roles/requisitos/categoría agregados.
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

### `PUT /api/projects/:id` — Auth, role `ngo` (dueño)
- Verifica `ngo_id` de la sesión contra el `ngo_id` del proyecto (join implícito vía `WHERE id=$1 AND ngo_id=$2`).
- **Body:** mismos campos que create (en inglés: `title`, `description`, `full_description`, `image`, `location`, `type`, `duration`, `volunteers_needed`, `funding_goal`, `cost_per_person`, `hours_per_week`, `status`), todos opcionales (actualización parcial). *(Corregido — tenía el mismo bug que `POST /`, leía `cupos` en vez de `volunteers_needed`. Ver `PROJECT_ANALYSIS.md §13`, bug B5.)*
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
- **Efecto:** actualiza `status`; si pasa a `approved`, incrementa `projects.cupos_ocupados` en 1 (verificando que no exceda `cupos`); notificación fire-and-forget al voluntario.
- **Respuesta 200:** `{ enrollment }`.

### `DELETE /api/enrollments/:id` — Auth (el propio voluntario dueño de la inscripción)
- Cancela/borra la inscripción. Si estaba `approved`, decrementa `cupos_ocupados`.
- **Respuesta 200:** `{ success: true }`.

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

**Todavía sin API**: dashboard agregado de empresa con KPIs, gestión de voluntarios propios (roadmap puntos 6/8). El patrocinio (`empresa_voluntariados`) sí tiene API completa — ver más abajo.

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
