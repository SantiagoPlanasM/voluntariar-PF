# REVISION.md — Revisión de código de VoluntariAR (2026-10-13)

> **Estado (2026-10-14):** este informe se escribió sin tocar el código; después se fueron arreglando ítems en commits separados. Los arreglados tienen ✅ y la sección de `PROJECT_ANALYSIS.md` donde está el detalle (§51–§105; la segunda pasada, en §106, y sus arreglos en §107–§119). Las correcciones a lo que decía este informe (B2 y B8 tenían menos impacto visible del indicado) están en esas secciones.

**Base revisada:** commit `0d6663a` (`main`). **Método:** tres revisiones de solo lectura en paralelo (backend, frontend, tests+docs) y una verificación propia de los hallazgos de severidad alta. No se modificó ningún archivo del proyecto; este informe es lo único nuevo.

**Cómo leer cada hallazgo:** `tipo` es **bug real** (comportamiento incorrecto hoy) o **mejora opcional** (no rompe nada, pero conviene). `certeza`:
- **verificado en Postgres:** ejecutado contra el servidor real + Postgres 16 (Docker) con el seed, comparado con SQLite.
- **probado:** ejecutado (en SQLite, o la expresión exacta en Node con `TZ=America/Argentina/Cordoba`).
- **por lectura:** el camino en el código es claro, pero no se ejecutó.
- **a confirmar:** probable, falta la prueba que se indica.

Los ids (B = backend, F = frontend, T = tests, D = docs) son los de cada revisión; se mantienen para poder rastrearlos.

---

## Resumen por severidad

| Sev. | Id | Tipo | Qué | Certeza |
|---|---|---|---|---|
| **Alta** ✅ §51 | B1 | bug | Chatbot de FAQs: 500 siempre en Postgres (`activo=1` sobre BOOLEAN) | verificado en Postgres |
| **Alta** → media ✅ §52 | B2 | bug | `GET /api/projects` en Postgres devuelve roles y requisitos vacíos | verificado en Postgres |
| **Alta** ✅ §53 | F1 | bug | Hora de los mensajes del chat: "Invalid Date" con timestamps de Postgres | probado (Node) + lectura |
| **Alta** ✅ §55 | T1 | mejora | Ningún test comprueba que una ONG ajena sea rechazada (inscripciones, horas, proyectos, patrocinios) | por lectura |
| Media ✅ §60 | B3 | bug | Errores de cliente (JSON roto, cuerpo grande, CORS) responden 500 con texto técnico en inglés | probado |
| Media ✅ §61 | B4 | bug | El chat carga los **primeros** 300 mensajes, no los últimos | por lectura |
| Media ✅ §59 | B5 | bug | Alta de proyecto: `roles_needed` string ensucia el catálogo; alta a medias sin transacción | probado / lectura |
| Media ✅ §58 | B6 | bug | Habilidades: un pedido con ids repetidos borra las habilidades del voluntario | probado |
| Media ✅ §93 | B7 | bug | Filtro de palabras por subcadena: rechaza "computadora", "disputa", "reputación" | probado |
| Media ✅ §54 | B8 | bug | Búsqueda distingue mayúsculas en Postgres (`LIKE`) | verificado en Postgres |
| Media ✅ §63 | F2 | bug | Fechas de KPI se muestran un día antes | probado (Node) |
| Media ✅ §90 | F3 | bug | KPI de tipo "texto" no se puede guardar (se manda `parseFloat`) | por lectura |
| Media ✅ §62 | F4 | bug | Al recargar, cualquier error de `/auth/me` (red, 502) cierra la sesión | por lectura |
| Media ✅ §62 | F5 | bug | `req()` no tolera respuestas no-JSON (502 HTML de un proxy) | por lectura |
| Media ✅ §66 | F6 | bug | Empresa: el selector de patrocinio solo lista 20 proyectos | por lectura |
| Media ✅ §64 | F7 | bug | Proyecto/ONG/empresa inexistente o error → `navigate(-1)` y página en blanco | por lectura |
| Media ✅ §65 | F9 | bug | Errores tragados: aceptar/rechazar patrocinio, dashboard ONG, KPIs, notificaciones | por lectura |
| Media ✅ §79 + §81 (los 10 modales) | F12 | mejora | Modales sin `role="dialog"`, Escape ni foco (login incluido) | por lectura |
| Media ✅ §78 | D1, D2, D5, D6 | bug (doc) | Docs que contradicen el código (multer, "no hay tests", roles de follows, KPIs) | por lectura |
| Baja ✅ §57 | B9 | bug | `COUNT`/`SUM` sin `Number()` en `/voluntarios/:id` y `/follows/feed` | verificado en Postgres |
| Baja (B18 ✅ §56, B10 ✅ §74, B11 ✅ §74/§76, B12 ✅ §76, B13 ✅ §76, B14 ✅ §75) | B10–B14, B18 | bug | Validaciones de entrada que terminan en 500 en vez de 400 | probado |
| Baja ✅ §77 | B15, B16 | bug | Carreras en follows y en la decisión de patrocinio | verificado en Postgres |
| Baja (B17 ✅ §85, B19 ✅ §87 + JWT_SECRET §94, B20 ✅ §91, B21 ✅ §86) | B17, B19–B21 | mejora | Registro sin transacción, WebSocket, enumeración de emails, `SELECT *` público | por lectura |
| Baja (F8 ✅ §70, F10 ✅ §71, F11 ✅ §72, F14 ✅ §82, F16 ✅ §73) | F8, F10, F11, F14, F16 | bug/mejora | Inscripción rechazada se ve "Pendiente", reconexión WS infinita, etc. | por lectura |
| Baja (F13 ✅ §80, F15 ✅ §83) | F13, F15 | mejora | Botones solo-ícono sin nombre; respuestas viejas (a confirmar) | lectura / a confirmar |
| Baja (T2–T4 ✅ §84; D3, D4, D7 ✅ §78) | T2–T4, D3, D4, D7 | mejora | Tests con nombre que promete más, `setup` como test, docs menores | por lectura |

---

## Severidad alta

### B1 — FAQs: 500 siempre en Postgres
- **Dónde:** `backend/src/routes/faqs.js:24,25,35,36,65,66` (`WHERE activo=1`); la columna se crea `BOOLEAN` en Postgres (`backend/scripts/migrate.js`).
- **Qué pasa:** en Postgres `boolean = integer` es un error de tipos. **Verificado:** con el seed, `GET /api/faqs` → `500 {"error":"Error al obtener las preguntas frecuentes"}` y `POST /api/faqs/ask` → 500. En SQLite, 200.
- **Por qué importa:** en producción el chatbot no funciona nunca. Ningún test toca `/api/faqs` (ver cobertura), por eso `test:pg` no lo vio.
- **Arreglo:** `WHERE activo = $n` con `true` como parámetro (better-sqlite3 lo convierte a 1; verificarlo) o `WHERE activo` a secas si ambos motores lo aceptan. Test de integración de los dos endpoints, que corra en los dos motores.

### B2 — Listado de proyectos sin roles ni requisitos en Postgres
- **Dónde:** `backend/src/routes/projects.js:83-89` (rama Postgres con `json_agg`/`jsonb_build_object`) y `parseJson` en `:11`, `:34-35`.
- **Qué pasa:** `pg` ya parsea `json`/`jsonb` a arrays de JS; después `parseJson` hace `JSON.parse(array)`, lanza, y el `catch` devuelve `[]`. Además la rama de roles arma objetos (`jsonb_build_object`) en vez de strings. **Verificado:** mismo seed, `GET /api/projects?limit=100` → SQLite: 12 de 12 proyectos con roles y requisitos; Postgres: 0 de 12.
- **Por qué importa:** ~~en producción, feed y explorar muestran todos los proyectos sin roles ni requisitos~~ **Corregido al arreglarlo (§52):** ninguna pantalla que usa el listado muestra roles ni requisitos; es un bug del contrato de la API sin efecto visible hoy. Los tests leen por `GET /:id` (otra consulta), por eso no lo detectan.
- **Arreglo:** en `parseJson`, si `Array.isArray(val)` devolverlo tal cual; en la rama Postgres, `json_agg(DISTINCT ro.nombre)` para que la forma sea la misma que en SQLite. Test que compare el listado con el detalle del mismo proyecto.

### F1 — Hora del chat: "Invalid Date" en producción
- **Dónde:** `frontend/src/lib/format.ts:35` (`formatTime`), usado en `ChatThread.tsx:93`.
- **Qué pasa:** `new Date(iso.replace(' ', 'T') + 'Z')` le pega una `Z` a todo. `messages.js:131` devuelve `created_at` crudo: en Postgres es `Date` → JSON `"...T15:30:00.000Z"` → `"...ZZ"`. **Probado en Node:** formato SQLite → "12:30 p. m."; ISO con Z → "Invalid Date". Es el mismo error que §46 arregló en `timeAgo`; `formatTime` quedó afuera y su test solo usa el formato SQLite.
- **Por qué importa:** cada burbuja del chat mostraría "Invalid Date".
- **Arreglo:** usar `parseBackendDate(iso)` (ya existe en el mismo archivo) y sumar un test con ISO + `Z`.
- **Certeza:** expresión probada; no se vio en un navegador contra Postgres.

### T1 — Falta probar la autorización por dueño entre ONGs
- **Dónde:** `backend/test/integration/*`; endpoints `PATCH /enrollments/:id` y `/:id/horas` (`enrollments.js:149`, `:292`), `PUT`/`DELETE /projects/:id` (`projects.js:753`, `:819`), `PATCH /ngos/me/patrocinios/...` (`ngos.js:390`), `GET /enrollments/project/:id` (`enrollments.js:118`, expone emails).
- **Qué pasa:** el control (`WHERE ... AND p.ngo_id=$2`) existe y la revisión de backend no encontró IDOR, pero solo `posts.test.js` prueba "ONG ajena". Si alguien saca un filtro, ningún test se pone rojo.
- **Por qué importa:** es el control de acceso de cupos, horas, emails de voluntarios y patrocinios.
- **Arreglo:** `ownership.test.js`: con el seed, `ngo2` contra recursos de `ngo1` → 403/404, y comprobar en la base que nada cambió. Mutación: sacar cada filtro de dueño.
- **Tipo:** mejora (cobertura), pero de alta prioridad.

---

## Severidad media

### B3 — El manejador de errores responde 500 con mensajes técnicos
- **Dónde:** `backend/src/index.js:76-79`.
- **Qué pasa:** `res.status(500).json({ error: err.message || ... })`. **Probado:** JSON mal formado → `500 {"error":"Unexpected end of JSON input"}`; también cuerpo > 5 MB y el rechazo de CORS (filtra `CORS: origen no permitido → X`).
- **Por qué importa:** errores del cliente dan 500 (en vez de 400/413/403) y llegan al usuario en inglés técnico (regla 19).
- **Arreglo:** mapear `err.type` (`entity.parse.failed` → 400, `entity.too.large` → 413) y CORS → 403, con mensajes fijos en español; `err.message` solo al log.

### B4 — El chat carga los primeros 300 mensajes
- **Dónde:** `backend/src/routes/messages.js:130-135` (`ORDER BY created_at ASC LIMIT 300`).
- **Qué pasa:** devuelve los 300 **más viejos**; el comentario y `API_CONTEXT.md:459` prometen los últimos.
- **Por qué importa:** en una conversación de más de 300 mensajes, al reabrirla nunca se ven los nuevos.
- **Arreglo:** subconsulta `ORDER BY created_at DESC, id DESC LIMIT 300` y reordenar ascendente. Test con 301 mensajes.
- **Certeza:** por lectura (no se armó una conversación de 301).

### B5 — Alta de proyecto: entradas sin validar y sin transacción
- **Dónde:** `backend/src/routes/projects.js:719-730` (roles), `:733-739` (requisitos), INSERT del proyecto en `:690`.
- **Qué pasa:** (a) **probado:** `roles_needed: "Chef"` recorre los caracteres y crea los roles `C`, `h`, `e`, `f` en el catálogo global (`/api/roles` los lista). (b) **por lectura:** `roles_needed: [123]` hace fallar `.trim()` **después** del INSERT del proyecto: 500, pero el proyecto queda creado a medias.
- **Por qué importa:** cualquier ONG ensucia el catálogo público; un reintento tras el 500 duplica el proyecto.
- **Arreglo:** exigir arrays de strings con largo máximo (400 si no) y hacer proyecto + categoría + roles + requisitos en `db.transaction()` con `tx.*`.

### B6 — Guardar habilidades puede borrarlas
- **Dónde:** `backend/src/routes/voluntarios.js:49` (dedup solo para validar), `:60` (DELETE), `:61-65` (INSERT).
- **Qué pasa:** **probado:** con `[{X},{X}]` responde 500 (PK duplicada) y el voluntario se queda sin sus habilidades anteriores (DELETE e INSERT no están en transacción).
- **Arreglo:** deduplicar por `habilidad_id` y envolver DELETE + INSERT en `db.transaction()`.

### B7 — Filtro de palabras prohibidas por subcadena
- **Dónde:** `backend/src/routes/projects.js:831` (`hasBadWord`, también lo usa `posts.js:205`); la lista está duplicada en `ProjectDetails.tsx` (ya documentado).
- **Qué pasa:** `t.toLowerCase().includes(w)`. **Probado:** "computadora", "diputado", "reputación", "disputa" dan positivo; "Traigan la computadora" → 400.
- **Por qué importa:** se rechazan comentarios y captions legítimos.
- **Arreglo:** comparar palabras completas (tokenizar con `\p{L}`); cambiarlo **también** en el frontend para que sigan iguales.

### B8 — Búsqueda sensible a mayúsculas en Postgres
- **Dónde:** `backend/src/routes/projects.js:140` (search), `:130,132` (modalidad, `NOT LIKE '%remoto%'`).
- **Qué pasa:** **verificado:** buscar "Maratón" → 1 resultado en ambos motores; "maratón" → 1 en SQLite, **0 en Postgres**.
- **Por qué importa:** en producción la búsqueda falla con minúsculas, y el filtro de modalidad no excluye "Remoto".
- **Arreglo:** `ILIKE` (`translatePg` ya lo pasa a `LIKE` en SQLite). Test con minúsculas (correrá en `test:pg`).

### F2 — Fechas de KPI un día antes
- **Dónde:** `frontend/src/app/components/NGOKPIs.tsx:254` (`new Date(kpi.fecha)`).
- **Qué pasa:** `fecha` es `"YYYY-MM-DD"` y se interpreta como medianoche UTC. **Probado** con TZ de Córdoba: `2026-10-01` → "30 de sept de 2026".
- **Arreglo:** construir la fecha local (`new Date(y, m-1, d)`) o agregar `'T00:00:00'`. Test con TZ fija.

### F3 — KPI de tipo "texto" no se puede guardar
- **Dónde:** `NGOKPIs.tsx:61` (`parseFloat(form.valor)`), `:178` (input `type="text"`); columna `kpis.valor` REAL.
- **Qué pasa:** "Alta" → `NaN` → `null` en JSON; el KPI queda con "—".
- **Arreglo:** **decisión tuya:** sacar "texto" de los tipos, o agregar una columna de texto (cambio de esquema). En ambos casos, validar antes de enviar.
- **Certeza:** front por lectura; qué guarda cada motor, a confirmar.

### F4 — Recargar con el backend caído cierra la sesión
- **Dónde:** `frontend/src/lib/AuthContext.tsx:38`.
- **Qué pasa:** `api.auth.me().catch(() => { removeToken(); ... })` ante **cualquier** error (red, 500, 502), no solo 401.
- **Por qué importa:** con Render "dormido" o sin red, el usuario pierde la sesión.
- **Arreglo:** que `req()` lance un error con `status` (p. ej. `ApiError`) y borrar el token solo con 401.

### F5 — `req()` sin protección ante respuestas no-JSON
- **Dónde:** `frontend/src/lib/api.ts:23` (`await res.json()` sin catch; `upload()` en `:37` sí lo protege).
- **Qué pasa:** un 502/503 en HTML de un proxy muestra `Unexpected token '<' ...` al usuario.
- **Arreglo:** `await res.json().catch(() => ({}))`, como `upload()`. Conviene hacerlo junto con F4.

### F6 — Patrocinar: solo aparecen 20 proyectos
- **Dónde:** `frontend/src/app/components/CompanyOwnProfile.tsx:42` (`api.projects.list({ status: 'active' })` sin `limit`; el backend usa 20 por defecto, `projects.js:62`).
- **Qué pasa:** el mismo bug que §29 (bug 4) arregló en `ExploreScreen`.
- **Por qué importa:** con más de 20 proyectos activos, una empresa no puede patrocinar los demás (el botón "Patrocinar" de `ProjectDetails.tsx:138` lleva ahí).
- **Arreglo:** `limit` explícito, o mejor, preseleccionar el proyecto por query param desde `ProjectDetails`. Ligado al conocido "sin paginación".

### F7 — Link a un recurso que falla → página en blanco
- **Dónde:** `ProjectDetails.tsx:54`, `NGOPublicProfile.tsx:39`, `CompanyPublicProfile.tsx:19`, `NGOProjectDetail.tsx:28` (`catch { navigate(-1) }` y luego `return null`).
- **Qué pasa:** abierto en una pestaña nueva (link compartido), `navigate(-1)` no tiene a dónde volver: queda en blanco, sin mensaje.
- **Arreglo:** estado `error` con mensaje y "Volver/Reintentar", como `VolunteerPublicProfile.tsx:93-99`.
- **Certeza:** código por lectura; lo visual, a confirmar (sin navegador).

### F9 — Errores tragados en silencio
- **Dónde:** `NGOPatrocinios.tsx:24`, `:32`; `CompanyOwnProfile.tsx:65`; `NGODashboard.tsx:30`; `NGOKPIs.tsx:49`; `NotificationsScreen.tsx:38`.
- **Qué pasa:** el error se descarta y se muestra el estado vacío ("No hay proyectos aún").
- **Por qué importa:** aceptar un patrocinio que falla no muestra nada; con un 500, el dashboard parece una ONG sin proyectos.
- **Arreglo:** estado de error visible con "Reintentar" (patrón de `CompanyDashboard.tsx`). `FRONTEND_CONTEXT` §12 lo menciona en general, pero no estas ubicaciones.

### F12 — Modales no accesibles (mejora)
- **Dónde:** `AuthModal.tsx:133-137`, `ReviewModal.tsx`, `VolunteerProfile.tsx:419`, `VolunteerPublicProfile.tsx:270`, `ChatbotWidget.tsx`.
- **Qué pasa:** sin `role="dialog"`/`aria-modal`, sin Escape ni foco inicial (solo `MomentsGrid` y `PostComposer` lo hacen).
- **Arreglo:** extraer un `<Modal>` común con el patrón de `PostComposer`.

### D1, D2, D5, D6 — Documentación que contradice el código
- **D1** `docs/PROJECT_CONTEXT.md:79` y `:202`: dicen que `multer` no se usa y que no hay subida de archivos; `routes/posts.js:19` lo usa (y la línea 234 del mismo doc lo da por resuelto).
- **D2** `docs/PROJECT_CONTEXT.md:67` y `:82`: "No usa: testing framework / tests"; hay vitest y node:test con 255/249 tests.
- **D5** `docs/API_CONTEXT.md:66-67`, `:383`: `GET /api/follows/volunteer/following` y `/followers` figuran para "cualquiera"; el código exige `requireRole('volunteer')` (`follows.js:508`, `:529`).
- **D6** `docs/API_CONTEXT.md:191-195`: el PUT de KPI figura como "parcial" (el código pisa todos los campos y sin `nombre` daría 500 por NOT NULL, a confirmar) y el DELETE como `{ success: true }` (el código responde `{ message: 'KPI eliminado' }`, igual que `api.ts:77`).
- **Arreglo:** un commit de solo docs.

---

## Severidad baja

**Backend**
- **B9** (bug, verificado en Postgres): `voluntarios.js:149,154-156` y `follows.js:418` sin `Number()`. Con el seed, `/api/voluntarios/user-vol-1` devuelve `total_enrollments: "3"`, `approved_enrollments: "2"` en Postgres (números en SQLite). Hoy solo se muestran como texto. Arreglo: `Number(x) || 0` (como `num()` de `empresas.js:323`).
- **B10** (bug, probado): `projects.js:865`, `rating: "abc"` → 500 por el CHECK. Arreglo: `Number.isInteger(r) && 1 <= r <= 5` → 400. (`3.5` en Postgres: a confirmar.)
- **B11** (bug, probado): enums sin validar → 500: `status` en PUT de proyecto (`projects.js:790`), `rol` de empleado (`ngos.js:329`). Arreglo: validar contra la lista → 400.
- **B12** (bug, probado): `name: ""` saltea la validación y deja nombres vacíos (`auth.js:148,166`, `ngos.js:151,180`, `empresas.js:108,124`). Arreglo: validar si `name !== undefined`.
- **B13** (bug, probado): `.trim()` sobre valores no-string → 500 (`auth.js:13`; p. ej. login con `email: [...]`). Arreglo: `typeof v === 'string'` en validadores y largos máximos en textos libres.
- **B14** (bug, probado): horas `"1e400"` → `Infinity` pasa la validación (`enrollments.js:295-296`), se guarda y el total queda `null`. Arreglo: `Number.isFinite` y tope.
- **B15** (bug, a confirmar con concurrencia en `test:pg`): dejar de seguir descuenta el contador sin mirar `changes` y fuera de transacción (`follows.js:73-81`, `:177-185`, `:484-492`); seguir dos veces a la vez → 500. Arreglo: `ON CONFLICT DO NOTHING` + contador solo si `changes === 1`, en transacción.
- **B16** (bug, a confirmar con concurrencia): decidir patrocinio sin compare-and-swap (`ngos.js:410-417`): aceptar y rechazar a la vez pasan los dos. Arreglo: `AND estado='propuesto'` y 409 si `changes === 0`.
- **B17** (mejora, lectura): registro sin transacción (`auth.js:43-75`): si falla el segundo INSERT queda un usuario sin perfil; email duplicado concurrente → 500 en vez de 409.
- **B18** (bug, probado/lectura): comentar un proyecto inexistente → 500 por FK (`projects.js:844`); PUT de un KPI de otro proyecto responde 200 con datos ajenos o `{}` (`:951-960`).
- **B19** (mejora, lectura): `ws/index.js:86` reenvía `err.message` interno, sin `maxPayload` ni límite de frecuencia; y `ws/index.js:19` tiene **su propia copia** del fallback de `JWT_SECRET` (ver "conocidos").
- **B20** (mejora, lectura): el login distingue "no hay cuenta" de "contraseña incorrecta" (`auth.js:102,105`): permite enumerar emails. Decisión de UX tuya.
- **B21** (mejora, lectura): `SELECT *` en endpoints públicos (`ngos.js:37`, `:224`; `empresas.js:43`; catálogos en `index.js:51,58,65`), contra la regla 8; hoy sin columnas sensibles. `ngos.js:224` además devuelve filas crudas sin `fmt`.

**Frontend**
- **F8** (bug, lectura): `ProjectDetails.tsx:129`, `:166`: una inscripción **rechazada** se muestra "Inscripto · Pendiente" para siempre. Arreglo: contemplar `rejected` como `MyParticipation`.
- **F10** (bug, lectura): `ChatContext.tsx:59-65`: si el servidor cierra con `4001` (token vencido), reconecta cada 10 s para siempre. Arreglo: no reconectar con 4001.
- **F11** (bug, probado; solo dev/SQLite): `NotificationsScreen.tsx:15-16` tiene su propio `timeAgo` que interpreta la hora UTC de SQLite como local (3 h de desfase). Arreglo: importar `timeAgo` de `lib/format.ts`.
- **F13** (mejora, lectura): botones solo-ícono sin `aria-label` (`AuthModal.tsx:155`, `:213`; `ChatThread.tsx:68`, `:112`; `NGODashboard.tsx:121`, `:125` —aprobar/rechazar indistinguibles—; `NGOKPIs.tsx:237`, `:241`; `NGOOwnProfile.tsx:54`, `:58`; `ChatbotWidget.tsx:69`, `:126`) e inputs sin label (login, chat, horas en `NGOProjectDetail.tsx:160`).
- **F14** (mejora, lectura): `NGODashboard.tsx:115-118`: el backend manda `project_title` en cada solicitud pendiente, pero el tipo (`api.ts:260`) no lo declara y no se muestra.
- **F15** (mejora, a confirmar con latencia simulada): respuestas viejas que pueden pisar a las nuevas, sin flag `cancelled` (`ChatThread.tsx:25-33`, `PublicFeed.tsx:54-64`, `VolunteerPublicProfile.tsx:40-56`).
- **F16** (bug, lectura): `ProjectDetails.tsx:145-153`: a cualquier ONG se le ofrece "Ver en panel ONG" en proyectos ajenos; termina en 403 + F7.

**Tests y docs**
- **T2** (lectura): `frontend/src/app/components/ProjectCard.test.tsx:38` dice verificar la categoría y no lo hace.
- **T3** (lectura): `backend/test/integration/api.test.js:237` "recomendaciones influenciadas por categoría" solo mira status y un flag.
- **T4** (lectura): cinco `test('setup')` sin asserts (`email-redirect-flow.test.js:73`, `enrollments-capacity.test.js:80`, `insert-returns-own-row.test.js:41`, `messages-conversations.test.js:50`, `posts.test.js:87`): deberían ser `before()`.
- **D3** `docs/BACKEND_CONTEXT.md:35` dice 28 tablas; son 31.
- **D4** `docs/DATABASE_CONTEXT.md:274`: rangos de tablas desactualizados y "id generado por la base" contradice la regla de `crypto.randomUUID()`.
- **D7** `docs/FRONTEND_CONTEXT.md:28` "47 archivos .tsx (sin tests)" se lee como que no hay tests; la lista de `:302` (7 componentes sin test) está corta.

---

## Cobertura de tests (contexto para T1)

- **Backend:** 79 endpoints; **29 no los usa ningún test**. Los de mayor riesgo: `DELETE /api/projects/:id`; `GET/PUT/DELETE` de KPIs; `GET`/`DELETE /api/empresas/me/patrocinios`; `GET /api/ngos/:id/dashboard`; `GET /api/ngos/me/patrocinios`; `GET/PUT /api/auth/me`; `PATCH` de notificaciones (que solo marque las propias); `/api/faqs` (de ahí B1).
- **Frontend:** de 47 componentes, 17 tienen test propio, 5 solo de ubicación y **25 ninguno**. Prioridad por riesgo: `NGOProjectDetail` (aprobar, horas), `ProjectDetails` (inscribirse), `NGODashboard`, `NGOKPIs`, `NGOEmpleados`, `MyParticipation`, `CreateVoluntariado`. En `lib/`, sin test: `ChatContext`, la mayor parte de `api.ts`, `sponsorship.ts`.
- **Conteo:** las corridas reales de hoy dieron 255 (SQLite) / 257 (Postgres) / 249 (frontend), como dicen `CLAUDE.md` y README.

---

## Deuda ya conocida: ¿sigue?

| Conocido | ¿Sigue? | Detalle |
|---|---|---|
| `PUT /projects/:id` no parcial | ✅ **Resuelto en §95** (era: sí) | `projects.js:784-796` pisa título, tipo y `status || 'active'`; además la respuesta arma roles/requisitos/categoría con lo que mandó el body (`:808-810`) aunque no los guarda. |
| `GET /projects` sin paginación | ✅ **Resuelto en §96** (límite acotado, orden estable; era: sí) | `projects.js:62,146,194`: `limit` sin tope, sin desempate en `recent`/`rating`; `limit=abc` → `LIMIT NaN` (500 en Postgres, a confirmar). F6 es una consecuencia nueva. |
| `fmt` compartido | ✅ **Resuelto en §86** (era: a medias) | El `fmt` de proyectos ya se importa (`follows.js:8`, `ngos.js:10`), pero `follows.js:14-25` tiene una **copia de `fmtNgo`**, `follows.js:12` un `parseJson` sin uso, y `ngos.js:224` devuelve filas sin `fmt`. |
| `ReviewModal` duplicado | ✅ **Resuelto en §101** (era: sí) | `ReviewModal` en `MyParticipation.tsx:6,174`; `ReviewsModal` en `FeedPostCard.tsx:10,508`. |
| `JWT_SECRET` con fallback | ✅ **Resuelto en §94** (era: sí, en dos lugares) | `middleware/auth.js:4` **y `ws/index.js:19`** (copia nueva para la lista). En Render `render.yaml` usa `generateValue: true`. |
| Otros conocidos | Siguen | `NGOEmpleados.tsx` con `fetch` directo (✅ resuelto en §98); rutas `/ngo/*` y `/company/*` sin guarda (✅ resuelto en §97) (un voluntario no ve datos ajenos, pero `/ngo/dashboard` le muestra un panel vacío); `OnboardingScreen` sin enrutar (✅ borrado en §99); sin rate limiting en auth (✅ login y registro con límite en §103). |

---

## Orden de arreglo propuesto (un commit por línea)

Cada uno con test primero (rojo → verde), SQLite + Postgres + TZ de Córdoba si es backend, y su sección en `PROJECT_ANALYSIS.md`.

1. **B1** — FAQs en Postgres + tests de `/api/faqs`.
2. **B2** — listado de proyectos en Postgres (`parseJson` + `json_agg` de strings) + test listado vs. detalle.
3. **F1** — `formatTime` con `parseBackendDate` + test con ISO `Z`.
4. **B8** — `ILIKE` en búsqueda y modalidad + test con minúsculas.
5. **T1** — `ownership.test.js` (solo tests; red de seguridad antes de tocar más rutas).
6. **B9** — `Number()` en `voluntarios.js` y `follows.js`.
7. **B6** — habilidades: dedup + transacción.
8. **B5** — alta de proyecto: validar arrays + transacción.
9. **B3** — manejador de errores (400/413/403 en español).
10. **B4** — chat: últimos 300 mensajes.
11. **F4 + F5** — `ApiError` con status, sesión solo se borra con 401, JSON tolerante.
12. **F2** — fecha de KPI local.
13. **F7 + F9** — estados de error visibles (puede partirse por pantalla).
14. **F6** — patrocinar con proyecto preseleccionado / `limit`.
15. **F8, F10, F11, F16** — uno por commit, chicos.
16. **B10–B14, B18** — validaciones de entrada (agrupables por router).
17. **B15, B16** — primero el test de concurrencia en `test:pg`; arreglar solo si falla.
18. **Docs D1–D7** — un commit de solo documentación.
19. **Accesibilidad F12, F13** — `<Modal>` común y `aria-label`.

**Necesitan tu decisión antes:** F3 (sacar "texto" o cambiar el esquema), B7 (criterio del filtro de palabras; tocar backend y frontend a la vez), B20 (mensaje único de login), la deuda conocida (regla 16: confirmar antes de arreglarla) y B19 (el fallback de `JWT_SECRET`: regla 17).

---

## Qué no se revisó o no se verificó

- **No verificado en Postgres:** B10 (3.5), el `LIMIT NaN` y el PUT de KPI sin `nombre`. B1, B2, B8 y B9 sí (servidor real + Postgres 16 en Docker, schema descartable, comparado con SQLite).
- **Nada visual ni con lector de pantalla** (no hay navegador): F7, F12, F13 y cómo se ve F1.
- **Concurrencia real:** F15. (B15 y B16 se confirmaron con un test de concurrencia en Postgres y se arreglaron: §77.)
- **Sin revisar o revisado poco** *(revisado el 2026-10-15: ver "Segunda pasada" al final)*: `lib/emailTemplates.js` (escape de cada plantilla), `scripts/seed.js`; en frontend, `ProjectMap`, `FilterModal`, `FeedSidebar`, `PostComposer`, `PostCard`, `PhotoCarousel`, `MomentsGrid`, `NGOMoments`, `ReviewsModal`, las barras de navegación, `imageCompress.ts`, `sponsorship.ts`; la calidad de los asserts de los tests unitarios del backend; `docs/PROJECT_ANALYSIS.md` y `BACKEND_ROADMAP_ANALYSIS.md` contra el código; `API_CONTEXT.md` campo por campo (sí se cotejaron los 79 endpoints, que coinciden).
- Los `.env` locales no se abrieron.

---

## Resumen (10 líneas)

1. Tres hallazgos altos que solo aparecen en Postgres/producción y SQLite no muestra: FAQs da 500 siempre (B1), el listado de proyectos pierde roles y requisitos (B2), el chat muestra "Invalid Date" (F1).
2. B1, B2 y B8 (búsqueda sensible a mayúsculas) los verifiqué contra el servidor real con Postgres 16; F1 con la expresión exacta en Node.
3. La autorización por dueño está bien en el código (sin IDOR ni inyección SQL), pero no tiene tests entre ONGs (T1).
4. Backend medio: errores 500 con texto técnico (B3), chat con los mensajes más viejos (B4), altas sin transacción que dejan datos a medias (B5, B6), filtro de palabras con falsos positivos (B7).
5. Frontend medio: fechas de KPI corridas un día (F2), KPI "texto" inservible (F3), sesión que se pierde ante un 502 (F4/F5), páginas en blanco y errores tragados (F7, F9).
6. Docs: cuatro contradicciones con el código (multer, "no hay tests", roles de follows, KPIs).
7. Deuda conocida: sigue toda; el fallback de `JWT_SECRET` está también en `ws/index.js:19`, y `fmt` está resuelto a medias.
8. Cobertura: 29 de 79 endpoints y 25 de 47 componentes sin ningún test.
9. Propuesta: 19 commits chicos, empezando por B1 → B2 → F1 → B8 → T1.
10. Antes necesito tu decisión sobre F3, B7, B20 y JWT_SECRET; no se arregló ni se modificó nada del proyecto.

---

## Segunda pasada (2026-10-15)

**Base:** commit `2b461c0`. **Método:** lectura, de mi parte, de lo que la primera revisión había dejado afuera, más tres controles automáticos (scripts descartables): tests unitarios del backend sin asserts, `catch` que tragan errores en el frontend y códigos de éxito de `API_CONTEXT` contra el código. **No se modificó código.** Mismos criterios de `tipo` y `certeza` que arriba. Todo es **por lectura** salvo donde se indica.

### Hallazgos

| Sev. | Id | Tipo | Qué |
|---|---|---|---|
| Media ✅ §107–§111 | S1 | bug | Errores de carga que se ven como "no hay nada" (lista abajo) |
| Media ✅ §113 (filtro `ngo_id`, decisión del usuario) | S2 | bug | `/ngo/momentos` dice "Fotos de tus voluntariados" y muestra las publicaciones de **todas** las ONGs |
| Baja ✅ §112 | S3 | bug | `ReviewsModal` desde el feed: después de calificar, al reabrirlo se ve la lista vieja |
| Baja ✅ §112 | S4 | mejora | `ReviewsModal` no precarga tu calificación: volver a calificar la reemplaza con 5 ★ y sin comentario, sin avisar |
| Baja ✅ §119 | S5 | bug | Explorar pide `limit: 200`: con más proyectos activos, los demás no aparecen ni en la lista ni en el mapa |
| Baja ✅ §114 | S6 | bug | Seguir/dejar de seguir que falla no avisa nada |
| Baja ✅ §117 (la barra de la ONG queda pendiente de decisión) | S7 | mejora | Duplicaciones: mapas de patrocinio, marcadores de `ProjectMap`, ítems de `BottomNav` |
| Baja ✅ §118 | S8 | mejora | La búsqueda de Explorar no ignora acentos ("cordoba" no encuentra "Córdoba") |
| Baja ✅ §116 | S9 | mejora | `seed.js` no se niega a correr en producción (crearía cuentas con `Password1`) |
| Baja ✅ §115 | S10 | mejora | El error del formulario de `ReviewsModal` no tiene `role="alert"` |

**S1: errores que se ven como vacío** (el mismo patrón que F9 y `NGOEmpleados`, §65 y §98). Un error de red o un 500 se traga, y la pantalla muestra el estado "vacío" como si fuera un dato:
- `FollowListModal.tsx` → "Todavía no tenés seguidores." (era así antes de §105; el refactor lo mantuvo a propósito).
- `ReviewsModal.tsx:42-53` → "Sin reseñas todavía".
- `ExploreScreen.tsx:124-127` → catálogo vacío.
- `VolunteerProfile.tsx:44-55` → sin participaciones, habilidades ni ONGs seguidas, y contadores en 0.
- `MainFeed.tsx:65` → la barra lateral dice "¡Ya seguís a todas las organizaciones recomendadas!".
- **Arreglo:** estado de error con "Reintentar" (`LoadError` / `userMessage`), como en §65. Se puede partir por pantalla.
- **No son problema:** los otros `catch` silenciosos (contadores de no leídos, marcar como leído, sugerencias del chatbot, título del KPI): ahí lo razonable es seguir sin el dato.

**S2: Momentos de la ONG.** `NGOMoments.tsx` renderiza `<MomentsFeed />` sin filtros, y `GET /api/posts` solo filtra por `project_id` o `user_id`. Una ONG ve, dentro de su panel, el feed de toda la plataforma bajo el texto "Fotos de tus voluntariados. Podés borrar cualquier publicación de tus proyectos." Es una **decisión tuya**:
- (a) cambiar el texto (es el feed general; el botón de borrar aparece solo en las de sus proyectos, porque lo decide el servidor), o
- (b) agregar un filtro `ngo_id` en `GET /api/posts` y usarlo acá (backend + frontend + tests).

**S3: reseñas viejas al reabrir.** En `FeedPostCard`, `cardRatings` es estado que nunca se actualiza. `ReviewsModal` recarga después de calificar, pero al cerrarlo y volver a abrirlo su efecto (`:55-65`) vuelve a poner `initialRatings` (la lista vieja) si no estaba vacía. Además el promedio del modal se calcula con esa lista, distinto del que muestra la tarjeta. **Arreglo:** que `onReviewAdded` también devuelva la lista y `FeedPostCard` actualice `cardRatings`, o que el modal recargue siempre al abrirse.

**S4: volver a calificar.** El backend hace upsert (§74), pero el formulario arranca siempre en 5 ★ y vacío. Quien ya calificó y vuelve a mandar el formulario reemplaza su reseña sin ver la anterior, y si no escribe nada, borra su comentario. **Arreglo:** precargar la calificación propia (está en `ratings`, por `user_id`) y decir "Editar tu reseña".

**S5: Explorar con tope de 200.** `ExploreScreen.tsx:123` pide `limit: '200'` (el backend acepta hasta 500, §96) y filtra en el cliente. No pasa nada hasta que haya más de 200 proyectos activos; a partir de ahí, los que sobran desaparecen sin aviso. Con los datos de una tesis no se alcanza; queda anotado.

**S6: seguir sin aviso de error.** `VolunteerPublicProfile.tsx:73` (`catch { }`), `NGOPublicProfile.tsx:72`, `FeedPostCard.tsx:111` y `MainFeed.tsx:76` solo loguean. El botón deja de girar y queda como estaba, sin mensaje.

**S7: duplicaciones.**
- `SPONSORSHIP_BADGE`/`SPONSORSHIP_LABEL` siguen copiados en `NGOPatrocinios.tsx:8-13` y `CompanyOwnProfile.tsx:17-22`; el propio `lib/sponsorship.ts` pide migrarlos.
- `ProjectMap.tsx` arma los marcadores y el punto del usuario dos veces (mapa chico `~:200-230`, ampliado `~:600-630`).
- `BottomNav.tsx:35-48` tiene su propia lista de ítems para ONG y empresa, distinta de `NGOBottomNav`/`CompanyBottomNav`: la de empresa no tiene "Panel" y la de ONG tiene 6 ítems y "Explorar". Según la pantalla, la misma persona ve barras distintas.

**S8: acentos en la búsqueda.** `filterProjects` (`FilterModal.tsx:35-43`) compara en minúsculas pero con acentos. El backend usa `ILIKE`, que tampoco los ignora. Se podría reusar la normalización de `lib/badWords.ts` (NFD).

**S9: seed en producción.** `render.yaml` no corre el seed (solo `db:migrate`), así que hoy no pasa. Pero `npm run db:seed` contra la base de producción crearía 8 cuentas con `Password1`. Una guarda `NODE_ENV === 'production'` → salir con error lo evitaría. Detalle menor: el resumen final no lista `admin@techcorp.com`.

**S10:** `ReviewsModal.tsx:204-205`: el error se muestra en un `<p>` sin `role="alert"`, así que un lector de pantalla no lo anuncia. El resto de los formularios ya lo tienen (§80).

### Revisado sin hallazgos
- `lib/emailTemplates.js`: todo lo que escribe el usuario pasa por `esc()` antes de entrar al HTML. Los asuntos no son HTML. Las URLs usan `APP_URL` e ids generados por el servidor.
- `lib/email.js`: falla cerrado con un `EMAIL_REDIRECT_TO` inválido, nunca lanza y no loguea la API key.
- `imageCompress.ts`, `PostComposer`, `PostCard`, `PhotoCarousel`, `MomentsGrid`, `FeedSidebar` y las barras de navegación (salvo S7).
- `ProjectMap`: el HTML de los pines (`divIcon`) solo usa colores de una tabla fija. Una categoría arbitraria, que cualquier ONG puede crear, no inyecta nada: a lo sumo el color queda `undefined`.
- **Tests unitarios del backend** (12 archivos), **probado** con un script: ningún `test()` sin `assert`.
- **`API_CONTEXT`, códigos de éxito**, **probado** con un script: coinciden con el código en todos los endpoints de los routers. El único que no coincidía (`/ratings`, documentado como 201) se corrigió en §104.

### Qué sigue sin revisar
- `API_CONTEXT` campo por campo (solo comparé los códigos de éxito) y `PROJECT_ANALYSIS`/`BACKEND_ROADMAP_ANALYSIS` contra el código.
- Nada visual ni táctil: S2, S7 (barras) y S10 son por lectura del código.

### Pendientes que surgieron al arreglarlos (no tocados; necesitan tu decisión)
- ✅ **§121** — **Barra inferior de la ONG en pantallas públicas** (S7, §117): unificarla con `NGOBottomNav` le saca "Explorar", su único acceso a `/explore` en celular. Opciones: agregar "Explorar" a `NGOBottomNav` o aceptar perderlo. `SidebarNav` de `Root.tsx` (escritorio) tiene una tercera copia de las listas.
- ✅ **§122** — **Tipo `Rating` vs. el feed** (§112): `api.ts` declara `user_id` obligatorio y `GET /api/follows/feed` no lo manda (regla 2). Agregarlo al SELECT o marcarlo opcional.
- ✅ **§123** — **`ProjectDetails` tiene su propio formulario de calificación** (no usa `ReviewsModal`): por lectura, el mismo problema de S4.
- ✅ **§124** — **`InlineError` sin `role="alert"` propio:** cada pantalla nueva lo envuelve en un `<div role="alert">`; ponerlo en el componente lo resolvería para todas.
- ✅ **§125** `NGOPublicProfile` traga el error de `ngoStatus` (muestra "Seguir" aunque ya la sigas); seguir una ONG sugerida en Inicio no bloquea el doble clic (✅ **§126**).
- `/api/ngos/me` es pesado para sacar solo el id en `NGOMoments` (§113).
- ✅ **§132** — Iniciar sesión desde el perfil de una ONG no volvía a consultar si ya la seguís: el perfil se recarga al cambiar la sesión.
- **Descartado (§132): "dos avisos de error a la vez"** (`NotificationsScreen`, `NGOPatrocinios`, `CompanyOwnProfile`). Analizado y no se puede dar: sin lista no hay botones de acción (en Notificaciones, "Marcar todas leídas" depende de `unread`, que con error queda en 0; en las otras dos las acciones van por fila), y la recarga solo corre al entrar, desde "Reintentar" (que exige un error de carga) o después de una acción que salió bien. Además, cada acción limpia su propio aviso al empezar. No se tocó código.
- ✅ **§133** (decisión del usuario: mostrarlo) — el avatar en las reseñas. §122 dejó de mandar `user_avatar` en el feed para igualarlo con el detalle; ninguna lista de reseñas muestra avatar hoy (muestran la inicial).

### Orden propuesto (si los aprobás; un commit cada uno) — hecho en §107–§119
1. **S1**, por pantalla: `ReviewsModal` y `FollowListModal` primero (las dos son modales chicos).
2. **S3 + S4** juntos (los dos son `ReviewsModal` + `FeedPostCard`).
3. **S2**: necesito que elijas (a) o (b).
4. **S6**, **S10**, **S9**: chicos.
5. **S7, S8, S5**: opcionales.

---

## Tercera pasada: `API_CONTEXT.md` contra el código (2026-10-15)

**Método:** un subagente leyó los 81 endpoints de la tabla y comparó auth, body, query, respuesta, errores y efectos contra el código, sin modificar nada. Después, **verifiqué yo** los posibles bugs: los visibles leyendo el código, y los "da 500" con una sonda descartable contra el servidor real, en **SQLite y en Postgres** (3 corridas en Postgres, con el mismo resultado). **45 endpoints coinciden sin observaciones.** Los nombres de campos que manda `api.ts` coinciden con lo que lee el backend en todos los casos (regla 10).

### Bugs confirmados — todos arreglados con OK del usuario (§134–§140)
| Id | Qué | Cómo se confirmó |
|---|---|---|
| A1 ✅ §134 | **Perfil público de ONG:** los proyectos no traen `duration` ni `hours_per_week` (SELECT propio en `ngos.js:135`, no `fmt`). Un sostenido muestra "h/semana" sin el número. | sonda: `hours_per_week` → `undefined` |
| A2 ✅ §135 | **Feed:** los comentarios recientes no traen `user_id` (`follows.js:290`, `:328`). El link del autor en `FeedPostCard.tsx:414` va a `/volunteer/undefined`. | lectura |
| A3 ✅ §137 | **`POST /api/projects`:** `type` fuera de fugaz/sostenido, o `title`/`description` que no son texto → **500** (el CHECK de la base; el PUT sí valida). | sonda: 500 en los dos motores |
| A4 ✅ §138 | **`POST /api/auth/register`:** `apellido` que no es texto → **500**. | sonda: 500 en los dos motores |
| A5 ✅ §139 | **`POST /api/faqs/ask`:** `question` que no es texto → **500**. | sonda: 500 en los dos motores |
| A6 ✅ §140 | **Dos propuestas de patrocinio simultáneas** (misma empresa y proyecto) → la segunda da **500 en Postgres** (409 en SQLite). Falta `isUniqueViolation` (regla 21). | sonda: 201/500 en Postgres, 3 de 3 |
| A7 ✅ §136 | El buscador de proyectos no busca por categoría en **SQLite** (`projects.js:288`), sí en Postgres. Solo afecta a desarrollo. | lectura |

**Descartados con la sonda:** `limit`/`offset` negativos en el feed (200 en los dos motores) y la reseña sin comentario (200).

### Documentación desactualizada (el código está bien)
- **Formas de respuesta que no coinciden:**
  - `GET /api/auth/me` devuelve `{ user, profile }`.
  - `GET /api/projects` y `GET /api/ngos` devuelven solo la lista (sin `total`/`page`/`limit`), y `GET /api/ngos` no lee parámetros.
  - `DELETE /api/projects/:id` y los `PATCH` de notificaciones devuelven `{ message }`, no `{ success: true }`.
  - `PATCH …/horas` tiene una línea de respuesta de más.
- **Cuerpos que no coinciden:**
  - `PUT /api/ngos/me` lee los campos en inglés que manda `api.ts`, no los en español que lista la doc.
  - `PUT /api/auth/me` solo lee `name`, `bio`, `location` y `avatar`.
  - `POST /api/auth/register` solo agrega `apellido`, y su límite de intentos cuenta también los 400.
- **Códigos de error:**
  - Inscripciones: 409/404, no 400.
  - `GET /api/enrollments/project/:id`: 403, no 404.
- **`PUT /api/projects/:id`:** la doc se contradice (dice "parcial" y "no parcial"); el código es parcial (§95).
- **Recomendaciones:**
  - devuelven también `based_on_history`;
  - el "arranque en frío" no saca señales: multiplica las de cupos, novedad y rating.
- **Reseñas:**
  - la doc no tiene `user_avatar` ni el orden (§122 y §133);
  - el punto "solo se puede crear una vez" contradice el upsert.

### Omisiones
- Errores 403/404/409/400 que existen y no se mencionan:
  - KPIs, dashboard y empleados de una ONG ajena;
  - alias repetido;
  - comentario corto;
  - mensaje sin destinatario;
  - seguirse a sí mismo;
  - borrar una publicación inexistente.
- Campos que existen y la doc no menciona:
  - `latitude`, `longitude` y `modality` en el alta de proyectos;
  - `?status=` en las inscripciones de un proyecto;
  - `limit`, `offset` y `total` en el feed;
  - `unread` en notificaciones;
  - `habilidades` y `stats` en el perfil de voluntario.
- Detalles menores:
  - `my_enrollment` del detalle con nombres de columna crudos (`mensaje`, `horas_realizadas`; el frontend solo lee `status`);
  - `fmtNgo` no devuelve `alias`;
  - ~~"Propuesta aceptado" (concordancia)~~ — resuelto en PROJECT_ANALYSIS §153;
  - `mensaje` del patrocinio sin validar.
