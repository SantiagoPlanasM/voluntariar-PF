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
| GET | `/api/voluntarios/me/habilidades` | Sí | volunteer | `routes/voluntarios.js` |
| PUT | `/api/voluntarios/me/habilidades` | Sí | volunteer | `routes/voluntarios.js` |
| GET | `/api/messages/conversations` | Sí | cualquiera | `routes/messages.js` |
| GET | `/api/messages/thread/:userId` | Sí | cualquiera | `routes/messages.js` |
| POST | `/api/messages` | Sí | cualquiera | `routes/messages.js` |
| PATCH | `/api/messages/thread/:userId/read` | Sí | cualquiera | `routes/messages.js` |
| WS | `/ws?token=<jwt>` | Sí (JWT por query string) | cualquiera | `src/ws/index.js` |
| GET | `/api/notifications` | Sí | cualquiera | `routes/notifications.js` |
| PATCH | `/api/notifications/:id/read` | Sí | dueño de la notificación | `routes/notifications.js` |
| PATCH | `/api/notifications/read-all` | Sí | cualquiera (propio usuario) | `routes/notifications.js` |

**IMPORTANTE — orden de definición en `routes/projects.js`:** las rutas de `/comments`, `/ratings` y `/kpis` (líneas 358-475) están definidas **después** de `module.exports = router` (línea ~403). Funciona porque `module.exports` referencia el mismo objeto `router`, que sigue mutándose tras la asignación — pero es una señal de organización de código a corregir (ver `BACKEND_CONTEXT.md §10`).

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
- **Query params:** `search`, `tipo` (`fugaz`/`sostenido`), `ubicacion`, `categoria` (uno o varios ids), `status` (default `active`), `ngo_id`, `page`, `limit`.
- **Comportamiento:** filtra dinámicamente según los params presentes. **Bifurca implementación según motor de DB** (ver `BACKEND_CONTEXT.md §2`, §10.6):
  - Postgres: una sola query con `json_agg` para traer roles/requisitos/categoría agregados.
  - SQLite: query base + **loop de queries adicionales por fila** (N+1) para roles, requisitos y categoría — usando la traducción de `translatePg()`.
- **Respuesta 200:** `{ projects: Project[], total, page, limit }`, cada `Project` pasado por `fmt()`.
- Si hay usuario autenticado (`optionalAuth`), cada proyecto incluye `my_enrollment` si el usuario ya está inscripto.

### `GET /api/projects/recommended` — Auth, role `volunteer`
- **Query params:** `limit` (default 10, máx. 30).
- **Comportamiento:** ranking basado en reglas (sin ML/IA) — afinidad de categoría con el historial de inscripciones del voluntario (×3 por coincidencia), ubicación (`users.location`) igual a la del proyecto (+2), publicado hace menos de 7 días (+1 o +2 según haya o no historial), últimos ≤3 cupos (+1). Excluye proyectos donde el voluntario ya está inscripto (en cualquier estado) y proyectos sin cupo/no activos. Con historial vacío ("cold start"), el ranking cae a novedad + urgencia + ubicación.
- **IMPORTANTE — orden de rutas:** esta ruta está declarada antes de `GET /:id` en `projects.js`. Si se moviera después, Express interpretaría `recommended` como el parámetro `:id` y la ruta dejaría de ser alcanzable — cualquier ruta nueva de `projects.js` sin parámetro debe declararse antes de `/:id`.
- **Respuesta 200:** `{ recommendations: Project[], based_on_history: boolean }`, cada `Project` con dos campos extra: `recommendation_score` (número) y `recommendation_reasons` (array de strings en español, para mostrar en la UI por qué se sugiere).
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
- **Respuesta 201:** `{ comment }` (incluye datos del autor vía JOIN a `users`).

### `POST /api/projects/:id/ratings` — Auth (cualquier rol)
- **Body:** `{ rating (1-5), comment? }`.
- **Restricción:** `UNIQUE(user_id, project_id)` en la tabla — si el usuario ya calificó, el `INSERT` falla y el endpoint responde `400`/`409` según motor (no hay upsert explícito, ni un endpoint `PUT` para editar una calificación existente).
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

## Voluntarios (`routes/voluntarios.js`)

### `GET /api/voluntarios/me/habilidades` — Auth, role `volunteer`
- **Respuesta 200:** `{ habilidades: [{ id, nombre, descripcion, nivel }] }` — las habilidades del voluntario logueado, vía `JOIN` a `habilidades`. Devuelve `[]` si todavía no cargó ninguna.

### `PUT /api/voluntarios/me/habilidades` — Auth, role `volunteer`
- **Body:** `{ habilidades: [{ habilidad_id, nivel? }] }` — `nivel` es `'basico'` (default), `'intermedio'` o `'avanzado'`.
- **Comportamiento:** reemplaza el conjunto completo (borra todas las filas previas de `voluntario_habilidades` para ese usuario e inserta las nuevas) — más simple para la UI que calcular altas/bajas/cambios de nivel. Igual patrón que la categoría de ONG (`PUT /api/ngos/me`).
- **Validación:** máximo 20 habilidades, cada `habilidad_id` debe existir en el catálogo (`habilidades`), `nivel` debe ser uno de los tres valores válidos.
- **Respuesta 200:** `{ habilidades: [...] }` (el conjunto ya actualizado, mismo formato que el `GET`).
- **Errores:** `400` (formato inválido, habilidad inexistente, nivel inválido), `403` si el usuario no es `volunteer`.

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

Las tablas `donaciones`, `reuniones`, `empresa_voluntariados`, `ngo_follows` y `project_follows` **existen en el esquema de base de datos pero no tienen ningún endpoint que las lea o escriba**. Cualquier tarea futura que mencione "donaciones", "reuniones/videollamadas" o "seguir una ONG/proyecto" requiere **construir la API desde cero**, no modificar una existente. *(`voluntario_habilidades` dejó de estar en esta lista — ya tiene API completa, ver sección "Voluntarios" arriba y `PROJECT_ANALYSIS.md §17`.)*

## Endpoints duplicados o inconsistentes detectados

1. **Ninguna ruta está técnicamente duplicada** (no hay dos endpoints con el mismo método+path). Las inconsistencias de contrato que existían entre `POST /api/enrollments` (`mensaje` vs `message`) y entre las tres rutas de NGO respecto a `category` fueron corregidas — ver `PROJECT_ANALYSIS.md §13`.
2. **Falta de endpoint de edición/borrado de empleados** (`empleados` solo tiene `GET`/`POST`, no `PUT`/`DELETE`), inconsistente con el resto de recursos del sistema que sí ofrecen CRUD completo (proyectos, KPIs).
3. **Falta de endpoint para editar una calificación (`rating`) existente** — solo se puede crear una vez (`UNIQUE` constraint) y no hay `PUT /api/projects/:id/ratings/:ratingId`.
