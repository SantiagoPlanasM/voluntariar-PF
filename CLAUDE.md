# CLAUDE.md — VoluntariAR

Proyecto final de tesis (UCC): red social de voluntariados (voluntarios, ONGs, empresas).
Respondé en español rioplatense (voseo).

## Stack
- Backend: Node ≥22 + Express 4, SQL crudo con parámetros `$1, $2...` (sin ORM).
  SQLite en dev y tests; Postgres en prod (Render). Adaptador dual en `backend/src/db/index.js`.
- Frontend: React 18 + Vite + Tailwind 4, tests con vitest. Cliente HTTP y tipos en `frontend/src/lib/api.ts`.
- Convención: DB en español, API y frontend en inglés; el puente es `fmt()`/`fmtNgo()`.

## Antes de tocar código
- Leé `docs/AI_RULES.md` (reglas numeradas, obligatorias) y `docs/PROJECT_CONTEXT.md`.
- Para un endpoint: `API_CONTEXT.md` + `DATABASE_CONTEXT.md` + `FRONTEND_CONTEXT.md` de lo que toques.
- Si un pedido choca con AI_RULES, avisá antes de seguir.
- La historia de cada cosa ("§N") está en `docs/PROJECT_ANALYSIS.md` (índice) y `docs/archivo/`. No la cargues si no hace falta.

## Verificación (todo tiene que dar verde)
- **Backend:** `npm test` y `npm run test:pg`. Hoy **1092** en SQLite y **1094** en Postgres (+2 solo de Postgres). El conteo incluye `test/integration/helpers.js`, que no es un test: los reales son **1091**. Un `before()` que falla deja los tests como **cancelled** (no `fail`): mirá ese número y el código de salida.
  - `test:pg` necesita Postgres en `localhost:5432` (`TEST_PG_*` en `helpers.js`): `docker run --rm -d -p 5432:5432 -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=voluntariar_test postgres:16`.
  - `email-redos.test.js` tiene 1500 ms de umbral (con 500 fallaba a veces en local).
  - Scripts del CI aparte: `node --test ".github/scripts/*.test.js"` (con comillas).
- **Frontend:** `npm test`, **solo** (a la par de las suites del backend varios pasan los 5 s). Hoy **1209** tests; cobertura: sentencias 90,6 %, ramas 87,14 %, funciones 86,96 %, líneas 93,39 % (`npm run test:coverage`, reportes en `frontend/reports/`).
  - Tipos: `npm run typecheck` (TypeScript 7), **0 errores**. Nunca `npx tsc`: el paquete `tsc` de npm no es TypeScript.
  - `src/styles/paletteContrast.test.ts` exige 4,5:1 a todo `text-white` sobre la paleta y a los textos de color, en claro y oscuro. Para texto: `text-people-text`/`text-brand-text`, no `text-people`/`text-brand`.
- **CI:** `.github/workflows/ci.yml` corre todo en Node 22, SQLite y Postgres 16, UTC y Córdoba, con cobertura mínima del 80 % en el backend.
- **`npm audit` en 0** en los dos paquetes. La base de avisos cambia sola: si aparece uno, avisá.

## Cómo trabajamos
- Tests primero: rojo → verde. "El módulo no existe" es un rojo débil.
- Mutation testing solo sobre el código nuevo; reportá cuántos mutantes sobrevivieron y si son equivalentes.
- Todo cambio de backend se prueba en SQLite, en Postgres y con `TZ=America/Argentina/Cordoba`.
- Documentá en el mismo cambio (los `docs/*_CONTEXT.md` que correspondan, en estado actual y sin historia) y agregá
  una sección nueva a `docs/PROJECT_ANALYSIS.md` con: qué se hizo, verificación, **errores propios** y **⚠️ NO verificado**.
- Commits chicos: un commit por tarea. Sin línea `Co-Authored-By` ni ninguna atribución a Claude.

## Honestidad
- Decime siempre qué verificaste y qué no. No inventes números: corré los tests.
- No podés ver la interfaz (ni navegador ni dispositivo): lo visual/táctil queda como NO verificado.
- No tenés acceso real a Cloudinary ni a Resend; los tests usan dobles y nunca suben nada.

## Trampas ya resueltas (no reintroducir)
- `SUM`/`COUNT`/`AVG` en Postgres llegan como string → `Number(x) || 0` (no `x || 0`: `'0'` es truthy). SQLite no lo ve.
- Fechas: string en SQLite, `Date` en Postgres → nada de métodos de string; `toMillis()` (backend, `src/lib/time.js`) y
  `parseBackendDate` (frontend; la usan `timeAgo` y `formatTime`). Fechas sin hora (`YYYY-MM-DD`): `formatDateOnly`, nunca `new Date(fecha)` (es UTC: en Córdoba da el día anterior).
- Altas: id con `crypto.randomUUID()`, insertar y releer por id; nunca "el último por `created_at`".
- Dentro de `db.transaction()`, `tx.*`, nunca `db.*`. Llamadas externas, emails y notificaciones, después del COMMIT.
- `storage.*` se llama por propiedad (no desestructurado) para reemplazarlo en tests.
- La subida multipart no fija `Content-Type` (`req()` fuerza JSON y rompería el upload).
- Saltos de línea: varios archivos son CRLF (`git ls-files --eol`). No los conviertas; `sed -i` de Git Bash los pasa a LF: editá con `Edit` o Node.
- `migrate.js` en Postgres: toda consulta a `information_schema` filtra por `table_schema = current_schema()`.
- Búsquedas de texto: `ILIKE`, no `LIKE`. BOOLEAN: `true`/`false`, nunca `1`/`0`. `ON CONFLICT DO NOTHING` anda igual en los dos motores.
- Formatear proyectos: importar `fmt` desde `routes/projects.js`, no copiarlo.

## No tocar sin avisarme
`render.yaml`, `backend/.npmrc` y cualquier archivo de versión de Node (`.nvmrc`, `.node-version`) si se agrega.

## Pendientes conocidos (no "arreglar" sin preguntar, regla 16)
- **Prod (Render):** desplegado. Los valores `sync: false` (`RESEND_API_KEY`, `CLOUDINARY_*`, `MP_*`) se cargan en el panel. Auto-deploy de Render **apagado**: despliega el workflow `Deploy` (deploy hooks + smoke + E2E) cuando el CI de un push a `main` da verde. La base gratuita vence el **14/11/2026**.
- **Cloudinary:** borrar un proyecto borra su foto y las de sus Momentos; borrar la cuenta borra el CV, las fotos de Momentos y, si es ONG, las de sus voluntariados. Las fotos de perfil anteriores no se borran (no se guarda su id). El límite de 10 posts/hora no es estricto.
- **Mercado Pago (modo prueba):** credenciales `APP_USR-`; hay que pagar logueado con el comprador de prueba. Los avisos reales no validan la firma: las donaciones se acreditan por la vuelta.
  - Marketplace: cada ONG cobra en su cuenta; sin cuenta vinculada no recibe donaciones (409 y botón oculto). Tokens cifrados con `MP_TOKEN_KEY`, igual en Render y en el `.env` local.
  - En producción, la ONG SANTI está vinculada a mano con el vendedor de prueba 3772556008 (`scripts/vincular-mp-manual.js`; `--solo-ver` muestra de quién es un token).
  - El botón OAuth está hecho pero **no se probó en vivo**: necesita el `client_secret` de las credenciales productivas, que el usuario decidió no activar.
  - El E2E dona al proyecto "Test" (`E2E_PROJECT_ID`, variable o secret).
- **`JWT_SECRET`:** obligatorio en producción, en un solo lugar (`src/lib/jwtSecret.js`). Si tu `.env` local tiene `NODE_ENV=production`, lo necesita.
