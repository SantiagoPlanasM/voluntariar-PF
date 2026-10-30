# BACKEND_CONTEXT.md — Arquitectura del backend

> Arquitectura, bibliotecas, flujos internos y convenciones. Cada endpoint está en `API_CONTEXT.md`; las tablas, en
> `DATABASE_CONTEXT.md`. Estado al 30/10/2026; la versión larga con historia está en `archivo/contexto-2026-10-30/`.

## 1. Estructura

Express monolítico sin capas de servicio: cada handler valida, consulta y formatea. La lógica reutilizable o pura va a `src/lib/`.

```
backend/
├── src/
│   ├── index.js          # cors, json, rutas, catálogos (/api/categorias, /roles, /habilidades), 404, errorHandler, listen
│   ├── db/index.js       # adaptador dual SQLite/Postgres: único acceso a datos
│   ├── db/sqlTranslate.js# translatePg(): $N → ? (remapParams), CURRENT_TIMESTAMP, ILIKE → LIKE
│   ├── middleware/auth.js# requireAuth, optionalAuth, requireRole, signToken
│   ├── ws/index.js       # WebSocket del chat, en el mismo puerto; se autentica con el JWT
│   ├── routes/           # ver la tabla
│   └── lib/              # ver la tabla
└── scripts/
    ├── migrate.js        # DDL completo (38 tablas) + datos base (categorías, roles, habilidades, FAQs); idempotente
    ├── seed.js           # demo idempotente; se niega con NODE_ENV=production
    ├── run-tests-pg.js   # npm run test:pg
    └── vincular-mp-manual.js # vincula a mano una ONG con un vendedor de prueba de Mercado Pago (--solo-ver)
```

| Ruta (`src/routes/`) | Monta en | Contenido |
|---|---|---|
| `auth.js` | `/api/auth` | Registro, login, `me`, foto de perfil, borrar la cuenta; monta `authPassword.js` |
| `authPassword.js` | `/api/auth` | Cambiar la contraseña, "¿Olvidaste tu contraseña?" y el aviso por correo |
| `projects.js` | `/api/projects` | CRUD, búsqueda, comentarios, calificaciones, KPIs, recomendaciones, estado. Exporta `fmt`, `validateProject`, `hasBadWord` |
| `projectPhoto.js` | `/api/projects` | `PUT /:id/photo` (foto del voluntariado y su encuadre) |
| `enrollments.js` | `/api/enrollments` | Postulación, aprobación con cupos, horas, entrevistas |
| `ngos.js` | `/api/ngos` | Perfil, panel, embudo, empleados (fichas), patrocinios del lado ONG. Exporta `fmtNgo` |
| `mercadopago.js` | `/api/ngos/me/mercadopago` | Vincular, ver y desvincular la cuenta de la ONG (OAuth) |
| `empresas.js` | `/api/empresas` | Perfil, patrocinios del lado empresa, panel de impacto |
| `patrocinios.js` | `/api/patrocinios` | Acuerdo negociado: puntos, versiones, aceptación, charla |
| `ngoTeam.js` | `/api/equipo` | Invitar, aceptar, salir, cambiar rol, panel del miembro |
| `voluntarios.js` | `/api/voluntarios` | Habilidades, perfil público, CV privado |
| `follows.js` | `/api/follows` | Seguir ONG, proyectos y voluntarios; inicio personalizado |
| `posts.js` | `/api/posts` | Momentos: hasta 5 fotos, "me gusta", moderación |
| `messages.js` | `/api/messages` | Chat 1 a 1 (REST; la entrega es por WebSocket) |
| `donaciones.js` | `/api/donaciones` | Preferencia, vuelta, aviso (webhook) y conciliación |
| `notifications.js`, `faqs.js` | `/api/notifications`, `/api/faqs` | Avisos en la app; asistente por palabras clave |

| Biblioteca (`src/lib/`) | Qué hace |
|---|---|
| `authCommon.js` | `validateEmail/Name/Password` (iguales a las del frontend), `tooMany` (429), `sha256`, `appUrl` |
| `jwtSecret.js` | `resolveJwtSecret`: único lugar del secreto (obligatorio en producción) |
| `ngoAccess.js` | Rol sobre una ONG: `owner` / `coordinador` / `comunicador` / `null`; `managedNgoOfEnrollment` |
| `recommender.js` | Puntaje de `/projects/recommended`: 9 señales puras, `scoreProject`, `rankRecommendations` |
| `projectAssoc.js` | `attachAssoc`: roles, requisitos y categoría de varios proyectos en 3 consultas |
| `inputs.js` | `checkText()`/`firstError()`: tipo, vacío y largo de textos libres |
| `badWords.js` | `hasBadWord`: palabras completas, sin mayúsculas ni acentos; igual a `frontend/src/lib/badWords.ts` (lo controla un test) |
| `errorHandler.js` | 400/413/415/403 con mensaje fijo en español; el resto, 500 genérico |
| `dbErrors.js` | `isUniqueViolation(err)` en los dos motores → 409 |
| `rateLimit.js` | Limitador en memoria (ventana deslizante): login, registro, contraseñas, donaciones, CV y fotos |
| `time.js` | `toMillis()`: fecha string (SQLite) o `Date` (Postgres) → ms |
| `logSafe.js` | Texto seguro para los logs (sin saltos de línea inyectados) |
| `storage.js` | Cloudinary por REST: imágenes y PDF privados |
| `photoUpload.js` | Lectura de una foto multipart (`photo`), compartida por perfil y voluntariado |
| `email.js`, `emailTemplates.js` | Resend por REST y plantillas HTML |
| `payments.js` | Mercado Pago por REST (preferencias, pagos, OAuth, firma) |
| `sellerAccounts.js` | Único acceso a `ngo_cuentas_mp`: tokens de cada ONG, renovación |
| `tokenCrypto.js` | AES-256-GCM para los tokens de Mercado Pago |

## 2. Adaptador de base de datos (`src/db/index.js`)

`USE_POSTGRES = process.env.USE_POSTGRES === 'true' || !!process.env.DATABASE_URL`. Misma interfaz en los dos motores: `query`, `run` (devuelve `changes`), `get`, `all`, `transaction`, `type`.

- **Postgres:** `pg.Pool`, con `ssl: { rejectUnauthorized: false }` si hay `DATABASE_URL`. `get()` agrega `LIMIT 1` si falta.
- **SQLite:** `better-sqlite3` síncrono, `journal_mode = WAL`, `foreign_keys = ON`. `translatePg()` cambia `$N` por `?` (con `remapParams`, así que un `$N` se puede repetir), `CURRENT_TIMESTAMP` y `ILIKE`. **No** traduce `json_agg`, `jsonb_build_object`, `FILTER`, `GREATEST`: lo que los necesite se escribe dos veces (como `GET /api/projects`).

### Transacciones

```js
const outcome = await db.transaction(async (tx) => {
  const swap = await tx.run('UPDATE enrollments SET status=$1 WHERE id=$2 AND status=$3', [nuevo, id, viejo]);
  if (swap.changes === 0) return 'stale';
  await tx.run('UPDATE projects SET cupos_ocupados = cupos_ocupados + 1 WHERE id=$1', [pid]);
  return 'applied';
});
// emails, notificaciones y llamadas externas: acá, después del COMMIT
```

- COMMIT si el callback termina; ROLLBACK y se relanza el error si lanza. Devuelve lo que devuelva el callback.
- **Postgres:** `BEGIN/COMMIT/ROLLBACK` en un cliente del pool, `READ COMMITTED`. Las transacciones corren en paralelo: contra la doble aplicación, `UPDATE` atómico o compare-and-swap mirando `changes`.
- **SQLite:** `BEGIN/COMMIT` a mano (no `better-sqlite3.transaction`, que es síncrono). Hay una sola conexión: las demás consultas esperan en cola.
- **El adaptador lanza un error** si se usa `db.*` dentro del callback, si se anida `db.transaction` o si se usa `tx` después de terminar.
- **Convención:** nada de I/O externo adentro; no envolver `tx.*` en `.catch(() => {})` (una consulta fallida aborta toda la transacción en Postgres).

### Diferencias de tipos

| Dato | SQLite | Postgres | Qué hacer |
|---|---|---|---|
| `SUM` / `COUNT` / `AVG` | número | **string** | `Number(x) \|\| 0` |
| Fechas (`TIMESTAMPTZ`) | string `'YYYY-MM-DD HH:MM:SS'` (UTC) | **`Date`** | `toMillis()`; nunca métodos de string |
| BOOLEAN | 0/1 | boolean | comparar con `true`/`false` |

### Tests en los dos motores

`npm test` usa SQLite. `npm run test:pg` corre la misma suite en Postgres (`TEST_PG_HOST`, `_PORT`, `_DB` = `voluntariar_test`, `_USER`, `_PASSWORD`). Cada archivo crea su schema `test_<pid>_<rand>` y lo borra; nunca toca `public` e ignora `DATABASE_URL`.

## 3. Autenticación y permisos

| Función (`middleware/auth.js`) | Comportamiento |
|---|---|
| `requireAuth` | Exige `Authorization: Bearer <token>`; si no verifica, 401. Deja el payload en `req.user` (`{ id, email, role, name }`) |
| `optionalAuth` | Igual, pero nunca bloquea (endpoints públicos que personalizan si hay sesión) |
| `requireRole(...roles)` | Después de `requireAuth`: 401 sin usuario, 403 con otro rol |
| `signToken(user)` | JWT con `JWT_EXPIRES_IN` (7 días por defecto) y el secreto de `jwtSecret.js` |

**Propiedad del recurso:** se resuelve en la consulta. Si no es de la ONG de la sesión, no hay fila y se responde 404, que no revela si existe:

```js
const ngo = await db.get('SELECT id FROM ngos WHERE user_id=$1', [req.user.id]);
const recurso = await db.get('SELECT ... WHERE id=$1 AND ngo_id=$2', [req.params.id, ngo?.id]);
```

**Equipo de la ONG:** donde puede actuar un miembro (postulaciones, CV, entrevistas, horas, Momentos), el endpoint pregunta a `ngoAccess` en vez de buscar la ONG por `user_id`:
- la coordinación gestiona postulaciones, CV, entrevistas y horas;
- la comunicación publica Momentos;
- editar voluntariados, Mercado Pago y patrocinios sigue exigiendo la cuenta de la ONG.

## 4. Respuestas: `fmt()` y nombres de campos

La base está en español y la API en inglés. `projects.js::fmt`, `ngos.js::fmtNgo` y `empresas.js::fmtEmpresa` son **listas blancas**: un campo que no nombran no sale por la API. `fmt` además parsea `roles_json`/`requisitos_json` y deja pasar los extras del feed (`ratings`, `recent_comments`, `comments_count`, `my_enrollment_status`, `follow_source`, `follow_label`). Los demás routers importan `fmt` y `fmtNgo`, nunca los copian. `test/integration/public-columns.test.js` controla lo que sale y lo que falta.

| Concepto | Columna | Campo API |
|---|---|---|
| Proyecto | `titulo`, `descripcion`, `descripcion_full`, `foto_perfil`, `ubicacion`, `tipo` | `title`, `description`, `full_description`, `image`, `location`, `type` |
| Cupos | `cupos`, `cupos_ocupados` | `volunteers_needed`, `current_volunteers` |
| Fondos | `meta_financiera`, `recaudado`, `costo` | `funding_goal`, `current_funding`, `cost_per_person` |
| Tiempo y lugar | `horas_semanales`, `duracion`, `latitud`, `longitud`, `modalidad` | `hours_per_week`, `duration`, `latitude`, `longitude`, `modality` |
| ONG | `nombre`, `foto_perfil`, `banner`, `descripcion`, `mision`, `ubicacion` | `name`, `logo`, `cover_image`, `description`, `mission`, `location` |
| Inscripción | `mensaje` | `message` |

Un campo nuevo va a `migrate.js`, a su `fmt` y al `interface` de `api.ts` (regla 7).

**Excepción:** el **body** de `POST` y `PUT /api/projects` ya llega en inglés (`title`, `volunteers_needed`...). Verificar siempre contra `CreateVoluntariado.tsx` / `app/volunteering/projectForm.ts` (`toBody`).

## 5. Servicios externos

Los tres se usan por REST con `fetch`, sin SDK. Se llaman **por propiedad** (`storage.uploadImage`, `payments.createPreference`, `email.sendEmail`) para reemplazarlos en los tests, que nunca hablan con el servicio real.

### Cloudinary (`lib/storage.js`)
- **Firma:** parámetros ordenados por código de carácter + `api_secret`, en SHA-256. Un test la verifica contra el vector oficial.
- **Configuración:** sin `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET`, las subidas responden 503 y el resto de la API anda. `CLOUDINARY_FOLDER` es opcional.
- **Imágenes:** `uploadImage`, `deleteImage`, tipo real por la cabecera y URLs optimizadas (`thumbUrl`). `multer` con `memoryStorage`, hasta 8 MB por foto (Momentos: hasta 5).
- **CV privado (PDF):** `detectPdf` (cabecera `%PDF-`), `uploadPdf` (`type=private`, sin URL pública), `pdfDownloadUrl` (link firmado, 10 minutos) y `deletePdf`.
- Reglas de subida: AI_RULES regla 24.

### Mercado Pago (`lib/payments.js`, modo prueba)
- **Pagos:**
  - `createPreference({ donationId, title, amount, successUrl, notificationUrl, accessToken })` → `{ preferenceId, checkoutUrl }`. Un ítem en ARS; `external_reference` e idempotencia con el id de la donación; sin `marketplace_fee`.
  - `getPayment(id, { accessToken })` es la única fuente de verdad del pago.
  - Con el token de la ONG, la operación va contra su cuenta. Sin él, contra `MP_ACCESS_TOKEN`.
- **Avisos:** `verifyWebhookSignature` (con `MP_WEBHOOK_SECRET`) nunca lanza. Los avisos de prueba no validan la firma: la donación se acredita por la vuelta y la conciliación.
- **OAuth** (`MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_OAUTH_REDIRECT_URI`):
  - `authorizationUrl`, `exchangeCode` y `refreshAccessToken`;
  - un token con `live_mode` distinto de `false` se rechaza;
  - `getSellerUser` sirve para la carga manual.
- **Errores:** `PaymentError` con `code`: `not_configured`, `network`, `not_found`, `unauthorized`, `http`, `bad_response`, `bad_request`, `invalid_grant`, `live_token`. Nunca incluye secretos.
- **`lib/sellerAccounts.js`** (`ngo_cuentas_mp`):
  - `publicAccount`, `saveAccount` (`UNIQUE` de `mp_user_id` → `conflict`), `deleteAccount`, `acceptsDonations`, `findNgoByMpUser`.
  - **`getValidToken(ngoId)`:** renueva si faltan menos de 7 días para el vencimiento. Hay una renovación por ONG por proceso (`Map` de promesas) y un compare-and-swap sobre `version` entre procesos.
  - Si Mercado Pago rechaza la renovación, la cuenta queda `requiere_reconexion` y la ONG recibe el aviso `mp_reconnect_needed`. Si el error es transitorio, sigue con el token actual.
- **`lib/tokenCrypto.js`:** AES-256-GCM con `MP_TOKEN_KEY` (32 bytes en base64). Formato `v1:<iv>:<tag>:<cifrado>`, con el `ngo_id` como dato asociado.

### Resend (`lib/email.js`)
Fire-and-forget: nunca lanza ni demora la respuesta, y la configuración se lee en cada envío.

| Variable | Efecto |
|---|---|
| `RESEND_API_KEY` | Sin ella, los mails se omiten. Los tests la fijan en `''` |
| `EMAIL_FROM` | Remitente; por defecto `VoluntariAR <onboarding@resend.dev>` |
| `EMAIL_REDIRECT_TO` | Modo prueba: todo va a esa casilla, con el destinatario real en el asunto. Si no parece un email, no se manda nada |

Con `onboarding@resend.dev`, Resend solo entrega a la casilla de la cuenta (403 `Testing domain restriction`). Para mandar a cada usuario hace falta un dominio verificado.

## 6. Notificaciones

Se insertan en `notifications` después de la operación principal, con `.catch(() => {})`: si fallan, no se registra y no se reintenta. `ngoTeam.js` tiene su propio helper `notify`.

## 7. Problemas conocidos

- **Rutas después de `module.exports`:** `projects.js`, `ngos.js` y `empresas.js` registran rutas después de exportar el router. Es el patrón para exportar helpers.
- **`GET /api/projects` tiene dos ramas:** Postgres usa `json_agg` y SQLite hace 3 consultas en lote. `projects-list-shape.test.js` compara su forma en los dos motores. El bloque de `attachAssoc` sigue copiado en `GET /api/follows/project` y `/feed`.
- **Sin paginación real:** el `limit` por defecto es 20 y el tope 500, que es lo que pide Explorar.
- **Búsquedas sin índice:** `ILIKE` sobre título y descripción hace un recorrido completo.
- **Notificaciones silenciosas:** si fallan, nadie se entera.
