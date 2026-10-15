# CLAUDE.md — VoluntariAR

Proyecto final de tesis (UCC): red social de voluntariados (voluntarios, ONGs, empresas).
Respondé en español rioplatense (voseo).

## Stack
- Backend: Node ≥22 + Express 4, SQL crudo con parámetros `$1, $2...` (sin ORM).
  SQLite en dev y tests; Postgres en prod (Render). Adaptador dual en `backend/src/db/index.js`.
- Frontend: React 18 + Vite + Tailwind 4, tests con vitest. Cliente HTTP y tipos en `frontend/src/lib/api.ts`.
- Convención: DB en español, API y frontend en inglés; el puente es `fmt()`/`fmtNgo()`.

## Antes de tocar código
- Leé `docs/AI_RULES.md` (reglas numeradas, son obligatorias) y `docs/PROJECT_CONTEXT.md`.
- Para un endpoint: `API_CONTEXT.md` + `DATABASE_CONTEXT.md` + `FRONTEND_CONTEXT.md` de lo que toques.
- Si un pedido choca con AI_RULES, avisá antes de seguir.

## Verificación (todo tiene que dar verde)
- Backend: `npm test` y `npm run test:pg`. Hoy: **490** en SQLite y **492** en Postgres (+2 solo de Postgres). Bajó de 381 a propósito: 10 `test('setup')` pasaron a `before()` (§84). Un `before()` que falla deja los tests como **cancelled** (no `fail`): mirá también ese número y el código de salida.
  `test:pg` necesita un Postgres en `localhost:5432` (ver `TEST_PG_*` en `test/integration/helpers.js`); sirve
  `docker run --rm -d -p 5432:5432 -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=voluntariar_test postgres:16`.
- Frontend: `npm test`. Hoy: **544** tests. Tipos: `npm run typecheck` (TypeScript 7, instalado el 2026-10-14). Hoy: **0 errores** (§68–§69). Nunca `npx tsc`: el paquete `tsc` de npm no es TypeScript.
- `npm audit` en **0** en los dos paquetes (la base de avisos cambia sola: si aparece uno, avisá).

## Cómo trabajamos
- Tests primero: rojo → verde. "El módulo no existe" es un rojo débil.
- Mutation testing solo sobre el código nuevo; reportá cuántos mutantes sobrevivieron y si son equivalentes.
- Todo cambio de backend se prueba en SQLite, en Postgres y con `TZ=America/Argentina/Cordoba`.
- Documentá en el mismo cambio (los `docs/*_CONTEXT.md` que correspondan) y agregá una sección
  nueva a `docs/PROJECT_ANALYSIS.md` con: qué se hizo, verificación, **errores propios** y **⚠️ NO verificado**.
- Commits chicos: un commit por tarea. Sin línea `Co-Authored-By` ni ninguna atribución a Claude.

## Honestidad
- Decime siempre qué verificaste y qué no. No inventes números: corré los tests.
- No podés ver la interfaz (ni navegador ni dispositivo): lo visual/táctil queda como NO verificado.
- No tenés acceso real a Cloudinary ni a Resend; los tests usan dobles y nunca suben nada.

## Trampas ya resueltas (no reintroducir)
- `SUM`/`COUNT`/`AVG` en Postgres llegan como string → normalizar con `Number(x) || 0` (no `x || 0`: `'0'` es truthy). Los tests SQLite no lo ven.
- Fechas: string en SQLite, `Date` en Postgres → nada de métodos de string; usar `toMillis()`
  (backend, `src/lib/time.js`) y `parseBackendDate` (frontend: la usan `timeAgo` y `formatTime`; acepta ISO con zona y formato viejo). Fechas sin hora (`YYYY-MM-DD`): `formatDateOnly`, nunca `new Date(fecha)` (es UTC: en Córdoba muestra el día anterior).
- Nunca releer "el último por `created_at`" tras un INSERT: generar el id con `crypto.randomUUID()`,
  insertar y releer por id (los tests de altas tienen que correr en SQLite).
- Dentro de `db.transaction()` usar `tx.*`, nunca `db.*`. Llamadas externas, emails y notificaciones van fuera/después del COMMIT.
- `storage.*` se llama por propiedad (no desestructurado) para poder reemplazarlo en tests.
- La subida multipart no fija `Content-Type` (`req()` fuerza JSON y rompería el upload).
- Respetá los saltos de línea de cada archivo: varios son CRLF (`git ls-files --eol`). No los conviertas;
  `sed -i` de Git Bash los pasa a LF: editá con `Edit` o Node.
- `migrate.js` en Postgres: toda consulta a `information_schema` filtra por `table_schema = current_schema()`.
- Búsquedas de texto: `ILIKE`, no `LIKE` (en Postgres `LIKE` distingue mayúsculas; `translatePg` lo traduce en SQLite).
- Columnas BOOLEAN: comparar con `true`/`false`, nunca `1`/`0` (en Postgres `boolean = integer` da 500).
- `ON CONFLICT DO NOTHING` funciona igual en ambos motores; `translatePg` ya no lo reescribe.
- Formatear proyectos: importar `fmt` desde `routes/projects.js`, no copiarlo.

## No tocar sin avisarme
`render.yaml`, `backend/.npmrc` y cualquier archivo de versión de Node (`.nvmrc`, `.node-version`) si se agrega.

## Pendientes conocidos (no "arreglar" sin preguntar, regla 16)
- Prod (Render): los valores de `RESEND_API_KEY` y `CLOUDINARY_*` (`sync: false`) se cargan en el panel; deploy no verificado.
- Borrar usuario/proyecto no borra los archivos en Cloudinary; el límite de 10 posts/hora no es estricto.
- ~~Fallback inseguro de `JWT_SECRET`~~ — resuelto en §94 (con permiso): obligatorio en producción, un solo lugar (`src/lib/jwtSecret.js`). Si tu `.env` local tiene `NODE_ENV=production`, necesita `JWT_SECRET`.
