# Bitácora §34–§50: Infraestructura y Momentos

> Archivo (histórico). Parte de `docs/PROJECT_ANALYSIS.md`, separada el 30/10/2026 sin cambios en el texto. Índice: [`../../PROJECT_ANALYSIS.md`](../../PROJECT_ANALYSIS.md).

## 34. `db.transaction()` + `npm run test:pg` + arreglo de la carrera de `cupos_ocupados`

**Contexto:** era el prerrequisito de Pagos (`BACKEND_ROADMAP_ANALYSIS.md §1.5`) y resolvía una condición de carrera existente. Se hizo primero el harness de Postgres y los tests que **reproducen el bug con el código viejo**, y recién después el arreglo.

### Qué se construyó
- **`db.transaction(async (tx) => ...)` en `src/db/index.js`, ambos motores.** Diseño y reglas en `BACKEND_CONTEXT.md §2`. Se refactorizaron `run/get/all` de Postgres a un `bind(exec)` compartido por el pool y por el cliente de la transacción (mismo código, sin duplicar); el comportamiento de los métodos existentes no cambió.
- **`npm run test:pg`** (`scripts/run-tests-pg.js` —se llamó `test-pg.js` hasta `§38`—, funciona en Windows): corre **la misma suite** contra un Postgres real. `test/integration/helpers.js` ganó `TEST_DB=postgres`, `setupTestDb()` (para tests del adaptador sin servidor HTTP) y quedó dividido en `configureTestDb`/`cleanupTestDb`. Cada archivo usa su propio schema y no toca `public`; ignora `DATABASE_URL`.
- **`routes/enrollments.js`:** `PATCH /:id` y `DELETE /:id` ahora hacen estado + cupo en una transacción, con compare-and-swap sobre el estado leído. Notificaciones y emails quedaron **después** del COMMIT. `RELEASE_SLOT_SQL` reemplaza la query de decremento que estaba duplicada.
- **Tests nuevos:** `db-transaction.test.js` (12, ambos motores) y `enrollments-concurrency.test.js` (6, invariantes bajo carga: 8 aprobaciones/rechazos simultáneos, tormentas mezcladas, 6 cancelaciones simultáneas).

### Hallazgos
1. **La carrera de `cupos_ocupados` es de Postgres y SQLite no puede reproducirla** (cada handler corre entero sin ceder el event loop). Con el código viejo, en Postgres: 8 rechazos simultáneos bajaban el cupo en 5 (23 → 18), una tormenta aprobar/rechazar dejaba el contador en 24 con la inscripción rechazada, y 6 cancelaciones simultáneas daban 6 éxitos y restaban 6 cupos. Se reprodujo antes de arreglar y quedó estable 8/8 corridas después.
2. **La sugerencia del roadmap para SQLite no servía:** `better-sqlite3.transaction(fn)` es síncrono; con un callback `async` haría commit antes de terminar. Además, SQLite tiene **una sola conexión**: una query de otra request durante una transacción abierta caería adentro y se perdería con un ROLLBACK. Se resolvió con `BEGIN/COMMIT` a mano, cola de transacciones y compuerta para las queries ajenas. Detectado por mutation testing: sin la compuerta fallan los tests de aislamiento.
3. **Trampa de divergencia entre motores:** `db.*` dentro del callback quedaría *dentro* de la transacción en SQLite pero *fuera* en Postgres (otra conexión). Pasaba tests en SQLite y rompía la atomicidad en producción, así que el adaptador lo rechaza con un error en ambos motores (`AsyncLocalStorage`). También rechaza transacciones anidadas (en SQLite se colgarían esperando su propio turno) y el uso de `tx` después de terminar.
4. **Cambio de comportamiento (intencional):** re-aprobar o re-rechazar algo que ya tiene ese estado ahora es un no-op (200), **sin notificación ni email duplicados**. Antes cada repetición mandaba otro email al voluntario.
5. **`API_CONTEXT.md` estaba desactualizado:** decía que aprobar "verifica que no exceda `cupos`" y respondía `{ enrollment }` / `{ success: true }`; el código nunca validó capacidad y responde `{ message }`. Corregido.

### ⚠️ Bugs preexistentes encontrados por `test:pg` (NO arreglados en esta tarea)
> **Actualización:** el de `/recommended` se arregló en `§35` (junto con un segundo bug del mismo tipo). El de capacidad sigue abierto.
- **`GET /api/projects/recommended` devuelve 500 en Postgres.** `projects.js:419` hace `p.created_at?.replace(' ', 'T')`; en Postgres `created_at` es `TIMESTAMPTZ` y el driver lo devuelve como `Date`, que no tiene `.replace`. En SQLite es un string y anda. **Afecta a todos los voluntarios en producción (Render).** Son los 2 tests que fallan bajo `test:pg` ("cold start" y "señal social" de recomendaciones).
- ~~**Aprobar no valida capacidad:** una ONG puede aprobar por encima de `cupos` (`cupos_ocupados > cupos`). `AI_RULES.md` regla 20 pide verificar la invariante `cupos_ocupados <= cupos`, pero el código no la impone. Decisión de producto abierta.~~ ✅ **Resuelto en `§39`.**

### Verificación
- SQLite (`npm test`): 91 → **110/110**. Postgres (`npm run test:pg`): **108/110** — las 2 excepciones son las de arriba (recomendaciones), preexistentes. Frontend sin cambios.
- **Mutation testing** sobre el adaptador (3 de 3 detectadas): quitar la compuerta de SQLite, desactivar la guarda de `db.*` en transacción, omitir el ROLLBACK en Postgres. Sobre las rutas: los 3 tests de concurrencia fallaban con el código viejo en Postgres y pasan con el nuevo.
- Sin schemas huérfanos en Postgres tras la suite completa.

### Para correr `test:pg` en tu máquina
Crear la base (`createdb voluntariar_test`) y setear `TEST_PG_USER` / `TEST_PG_PASSWORD` (y `TEST_PG_HOST`/`TEST_PG_PORT` si no es localhost:5432). En PowerShell: `$env:TEST_PG_USER="postgres"; $env:TEST_PG_PASSWORD="..."; npm run test:pg`.

### Pendiente / decisiones abiertas
- ~~**Arreglar `GET /projects/recommended` en Postgres**~~ ✅ hecho en `§35`.
- ~~¿Validar capacidad al aprobar (409 si `cupos_ocupados >= cupos`)?~~ ✅ hecho en `§39`.
- Pagos ya puede apoyarse en `db.transaction()`; recordar `Number()` en `SUM(monto)`.

## 35. Arreglo de los bugs de fechas en Postgres (`/recommended` y `/messages/conversations`)

**Contexto:** `§34` dejó anotado que `GET /api/projects/recommended` devolvía 500 en Postgres. Al arreglarlo se buscó la causa raíz y apareció un segundo caso.

### Causa raíz
Los timestamps llegan distinto según el motor: **SQLite → string** `'YYYY-MM-DD HH:MM:SS'` (UTC, sin zona); **Postgres → objeto `Date`** (todas las columnas de fecha son `TIMESTAMPTZ`). El código los trataba como string, lo cual anda en SQLite y lanza `TypeError` en Postgres.

### Los dos bugs (ambos producían 500 solo en producción)
1. **`GET /api/projects/recommended`** (`projects.js`): `p.created_at?.replace(' ', 'T')` — `Date` no tiene `.replace`. Afectaba a **todo voluntario** con al menos un candidato a recomendar.
2. **`GET /api/messages/conversations`** (`messages.js`): `last_at.localeCompare(...)` — `Date` no tiene `.localeCompare`. **Solo fallaba con 2 o más conversaciones**, porque con 0 o 1 el comparador de `.sort()` nunca se ejecuta: una demo con un solo chat nunca lo habría mostrado. No tenía ningún test.

### Qué se hizo
- **`src/lib/time.js` → `toMillis(value)`:** acepta string de SQLite (lo interpreta como UTC), `Date`, ISO con `Z` u offset; devuelve `null` (nunca lanza ni NaN) para null/vacío/basura. Reemplaza los tres usos: el scoring de recomendaciones (sin fecha válida → no recibe el bonus de "reciente" en vez de romper), el desempate de `/recommended`, y el orden de conversaciones.
- **Tests:** `test/unit/time.test.js` (8) y `test/integration/messages-conversations.test.js` (5, incluye el caso de 2 conversaciones y el reordenamiento por actividad reciente). Los de `/recommended` ya existían: eran justamente los 2 que fallaban en `test:pg`.

### Verificación
- **Rojo → verde:** con el código viejo, el test de 2 conversaciones fallaba en Postgres con `localeCompare is not a function` (y pasaba en SQLite); ahora pasa.
- **Por primera vez la suite completa pasa en los dos motores:** SQLite **123/123** y Postgres **123/123**. Frontend 43/43.
- **Zona horaria:** las suites y los tests de `toMillis` se corrieron también con `TZ=America/Argentina/Cordoba` (UTC−3). Necesario: una mutación de `toMillis` (no forzar UTC) **no** se detecta si se prueba solo en UTC. Mutaciones detectadas: sin forzar UTC (3 tests fallan), solo reconocer `Z` sin offsets (1 falla).
- **Inventario:** todas las columnas de fecha del esquema son `TIMESTAMPTZ`; no queda otro código que las trate como string. No hay un tercer caso escondido de esta familia.

### Observación no verificada (no se tocó)
El JSON de una fecha difiere por motor: SQLite manda `'2026-09-29 12:30:45'` (sin zona, en UTC) y Postgres manda ISO con `Z`. Si el frontend hace `new Date(...)` sobre el formato de SQLite, JS lo interpreta como hora local, y en desarrollo (SQLite) las horas podrían verse corridas (3 h en Argentina) mientras que en producción se ven bien. Es una diferencia solo de visualización en dev, no un crash; **no se verificó en el frontend**.

### Pendiente / decisiones abiertas
- ~~¿Validar capacidad al aprobar una inscripción (409 si `cupos_ocupados >= cupos`)? (`§34`)~~ ✅ hecho en `§39`.
- Verificar en Render (Postgres real) que ambos endpoints responden 200.


## 36. Entorno: `better-sqlite3@13` exige Node ≥ 22, y `npm install` intenta compilarlo

**Contexto:** al probar en Windows con Node 20.17.0, `npm install` falló y `node_modules` quedó incompleto, con lo que casi todos los tests fallaban. Eran dos problemas independientes.

### Causas (ambas reproducidas)
1. **Node 20 no puede usar `better-sqlite3@13.0.3`.** Declara `engines: node >=22` y con Node 20.17.0 real su binario termina en `Segmentation fault` (probado en Linux con Node 20.17.0 obtenido del paquete npm `node@20.17.0`). No es un formalismo.
2. **Instalar desde el lockfile ejecuta `node-gyp rebuild` para ese paquete, incluso en Node 22.** El paquete trae sus binarios ya compilados (`prebuilds/<plataforma>.node`) y declara `gypfile: false`, pero los lockfiles no guardan `gypfile`: npm ve un `binding.gyp` y lo trata como script de instalación (por eso el lockfile ganaba `"hasInstallScript": true` tras instalar). Sin Python + herramientas de C++ de Visual Studio falla y **aborta toda la instalación**. Reproducido con `npm ci` en una carpeta limpia.
3. **Contradicción del repo:** `package.json` y README decían "Node ≥ 18" y `PROJECT_CONTEXT.md` "better-sqlite3 9.6", mientras la dependencia real exigía Node ≥ 22.

### Solución adoptada
> **Actualización (`§38`):** el flag `--ignore-scripts` se reemplazó por un `backend/.npmrc` para que `npm install` funcione a secas. Lo de abajo queda como historial.

**Node ≥ 22 + `npm install --ignore-scripts`** en el backend. Mantiene `better-sqlite3@13.0.3` (la versión declarada, sin tocar dependencias). Es seguro para este proyecto: en el lockfile solo `fsevents` (opcional de macOS) tiene scripts de instalación.
- `backend/package.json` y raíz del lockfile: `engines.node` `>=18.0.0` → `>=22.0.0`. Con Node 20 ahora npm avisa `EBADENGINE ... voluntariar-backend requiere >=22` en vez de fallar de forma críptica.
- Lockfile: se adoptó `"hasInstallScript": true` (lo que npm escribe igual), para que una instalación limpia no lo deje "modificado" en git. Verificado estable: `npm install` ya no lo cambia.
- README (requisitos + comando de instalación con su explicación) y `PROJECT_CONTEXT.md` (Node ≥ 22, better-sqlite3 13.0.3).

### Alternativas evaluadas y descartadas
- *Solo actualizar Node:* **insuficiente** (era mi primera recomendación): con Node 22 igual intenta compilar.
- *Quedarse en Node 20 con `better-sqlite3@^12.4.1`:* npm resuelve a la 12.11.1, que **no publica binarios para Node 20** → vuelve a compilar. Fijar la versión exacta `12.4.1` sí funciona (suite 123/123 bajo Node 20.17.0 en Linux), pero cambia una dependencia que usa Render y Node 20 ya salió de soporte (abril 2026).

### Render (producción)
Render resuelve la versión de Node en este orden: `NODE_VERSION` → `.node-version` → `.nvmrc` → `engines` de `package.json`; y un rango sin tope "resuelve siempre a la última release". Como `engines` estaba en `>=18.0.0`, **Render probablemente usa un Node reciente**, lo que explica que el deploy funcionara con `better-sqlite3@13` (**no verificado en el servicio real**: se ve en el log de build).
- Cambiar `engines` a `>=22.0.0` no cambia nada en Render (sigue sin tope).
- **No** se agregó `.nvmrc` ni `.node-version`: tienen precedencia sobre `engines` y cambiarían la versión de producción sin poder probarlo.
- Riesgos conocidos, no resueltos: (a) sin tope, una futura major de Node podría romper el build (Render recomienda poner tope); (b) por el mismo mecanismo del punto 2, el `npm install` del `buildCommand` probablemente compila `better-sqlite3` desde el código fuente en cada deploy (inferido, no verificado). Agregar `--ignore-scripts` al `buildCommand` lo evitaría, pero no se hizo por no poder probarlo contra Render.

### Verificación
Desempaquetado limpio bajo **Node 22.22.2**: `npm install --ignore-scripts` (148 paquetes) y `npm ci --ignore-scripts` OK, **123/123** tests, lockfile estable. Bajo Node 20.17.0 aparece la advertencia `EBADENGINE`. **No se ejecutó en Windows** (todo se probó en Linux; el binario de Windows `prebuilds/win32-x64.node` viene en el mismo paquete).

### Pendiente / decisiones abiertas
- Confirmar en Windows: `npm install --ignore-scripts` + `npm test` con Node 22.
- Mirar el log de build de Render (¿qué Node usa?, ¿compila `better-sqlite3`?) y decidir si conviene un tope de Node y/o `--ignore-scripts` en el `buildCommand`.

## 37. Vulnerabilidades de dependencias (`npm audit`): de 11 a 0, y por qué cada decisión

**Contexto:** la instalación en Windows mostró "6 vulnerabilities (3 moderate, 2 high, 1 critical)" en el frontend y un aviso de `multer` deprecada en el backend. Se auditaron ambos lockfiles.

### Antes / después
| | Antes | Después |
|---|---|---|
| Backend | 5 (4 moderate, 1 high) | **0** |
| Frontend | 6 (3 moderate, 2 high, 1 critical) | **0** |

### Qué era cada cosa (importa más que el número)
- **Frontend: las 6 eran de herramientas de desarrollo**, ninguna llega al sitio publicado. La "crítica" (`vitest`) aplica solo *"cuando el servidor de Vitest UI está escuchando"* (es decir, con `vitest --ui`); `vite`/`esbuild`: servidor de desarrollo; `nanoid`: entra por `postcss` dentro de `vite`, en el build.
- **Backend: `express` → `qs` / `body-parser`** (denegación de servicio al parsear query strings) **sí es código de producción**. `brace-expansion` venía de `nodemon` (solo desarrollo). `uuid` no se usaba.

### Qué se hizo
- **Backend:** `npm audit fix` (sin `--force`) → `express` 4.22.2→4.22.3, `body-parser` 1.20.6→1.20.8, `qs` 6.15.3→6.16.0, `brace-expansion` 5.0.9→5.0.12 (solo lockfile, dentro de los rangos ya declarados). **`uuid` eliminado** (no se importaba en `src`, `scripts` ni `test`; `gen_random_uuid()`/IDs legibles cubren todo). **`multer` `^1.4.5-lts.1` → `^2.4.0`** (la 1.x estaba deprecada con vulnerabilidades; sigue sin usarse, así que no hay cambio de comportamiento, y se evita construir Multimedia sobre una versión vulnerable).
- **Frontend:** `npm audit fix` (→ `nanoid`) y **`vitest` `^2.1.8` → `^5.0.3`**, que era el único arreglo para las otras 5. `vite` **sigue en 6.4.3** (Vitest 5 acepta `^6.4`), así que el build de producción no cambió de herramienta.

### Decisiones descartadas
- `npm audit fix --force` (lo que sugiere npm): habría subido `uuid` a la 14, que es **solo ESM** y este backend es CommonJS. Como no se usa, se eliminó.
- No se agregó `engines` al `package.json` del frontend, aunque Vitest 5 exige Node `^22.12 || ^24 || >=26`: Render lo leería para elegir el Node del sitio estático (sin tope → "última versión") y cambiaría producción sin poder probarlo. El requisito queda solo en el README (Node ≥ 22.12).

### Verificación (Node 22.22.2, Linux)
- Backend: **123/123 en SQLite y 123/123 en Postgres**; `multer` 2.4.0 carga e instancia; `npm audit`: 0.
- Frontend: **43/43**; `vite build` OK (1657 módulos); `npm audit`: 0.
- Formato: CRLF preservado en todos los `package*.json`; cambios de `package.json`: backend (`multer` y `uuid`), frontend (solo `vitest`).

### Riesgos conocidos / no verificado
- **Render (frontend estático):** Vitest 5 pide Node ≥ 22.12. Si el servicio de Render del frontend usa un Node más viejo (los servicios creados antes del 2026-01-14 tienen otro default), `npm install` solo **avisa** (`EBADENGINE`, no falla) y el build usa `vite`, que no cambió. **No se verificó contra Render**: mirar el log del próximo build.
- **Requisito local más estricto:** para correr los tests del frontend hace falta Node ≥ 22.12 (el backend exige ≥ 22). Node 20, 23 y 25 quedan excluidos por Vitest 5.
- `multer` 2.x no se probó subiendo archivos (no hay rutas que lo usen): verificar cuando se implemente Multimedia.


## 38. `npm install` a secas: `backend/.npmrc`, Node 24 y el test que no era un test

**Contexto:** tras entregar `§36`/`§37`, en Windows el backend volvió a fallar. El log mostraba **Node 24.21.0** (ya cumplía el requisito) y `npm install` **sin** `--ignore-scripts`: `node-gyp` buscaba Python, abortaba, y `node_modules` quedaba incompleto (`Cannot find module 'express'`/`'dotenv'` en casi todos los tests). No eran tests rotos: los que no necesitan esos módulos pasaban. Era la **tercera** vez que se tropezaba con el flag, así que se dejó de depender de recordarlo. El frontend funcionó completo en Windows (43/43, `vite` levantó, 0 vulnerabilidades).

### Entorno reproducido
Node **24.21.0** + npm **11.21.0** (trae `node-gyp@12.4.0`, idéntico al log del usuario), obtenidos del registro de npm (paquetes `node` y `npm`). Con `npm install` plano reproduce el `node-gyp rebuild` de `better-sqlite3`.

### Solución: `backend/.npmrc` con `ignore-scripts=true`
Se evaluaron dos opciones, ambas probadas en el entorno reproducido:
- **`allowScripts: {"better-sqlite3": false}` en `package.json`** (mecanismo nuevo de npm): funciona en npm 11.21 y 12, pero **un npm 10 (el que trae Node 22) lo ignora** y vuelve a compilar. Descartada: un evaluador o colaborador con Node 22 volvería a fallar.
- **`.npmrc` `ignore-scripts=true`** (adoptada): lo entienden todas las versiones de npm. Es seguro acá porque el backend **no tiene hooks `pre`/`post`/`postinstall`** (verificado) y `npm run`/`npm start`/`npm test` siguen corriendo su script. Atajo para el caso contrario: `npm install --ignore-scripts=false`. Contra: apaga los scripts de instalación de *cualquier* dependencia futura que los necesite (documentado en el propio `.npmrc`).

### Render (producción)
- **Todos los runtimes nativos de Render corren Debian 12** (glibc 2.36, libstdc++ 3.4.30). El binario precompilado de Linux de `better-sqlite3` exige glibc ≥ 2.34 y libstdc++ ≥ 3.4.29 → cumple. Las herramientas `gcc`/`g++`/`make` figuran en la lista de Render, confirmando que hoy compila desde fuente.
- Con el `.npmrc`, el `buildCommand: npm install` del backend deja de compilar y usa el precompilado (build más rápido).
- **Producción no carga `better-sqlite3`**: `require('better-sqlite3')` está solo en la rama SQLite de `src/db/index.js`; con `DATABASE_URL` (Postgres) nunca se ejecuta. Verificado borrando por completo el binario: la suite contra Postgres pasó 101/102 (el único fallo es `validators.test.js`, un artefacto del arnés que importa las rutas sin configurar Postgres y por eso carga el adaptador SQLite). En la práctica es una dependencia solo de desarrollo.
- El `.npmrc` está en `backend/`, no en `frontend/`: el sitio estático de Render no cambia.

### El test que no era un test
El runner de Node 22+ toma por defecto cualquier archivo `**/test-*.js` como test. `scripts/test-pg.js` se ejecutaba dentro de `npm test` (frenado por el aviso "run() is being called recursively") y **contaba como 1 test sin probar nada**. Renombrado a **`scripts/run-tests-pg.js`** (con nota en el archivo). Por eso el total pasó de **123 a 122**: los números de `§35`/`§37` incluían ese test fantasma. `test/integration/helpers.js` también se cuenta como "test" por el patrón `**/test/**/*.js` (preexistente, inofensivo, no se tocó).

### Verificación (matriz; cada celda con copia limpia y `npm install` plano)
| Entorno | Resultado |
|---|---|
| Node 24.21.0 + npm 11.21.0 (el del usuario) | instala sin `node-gyp`, `better-sqlite3` carga, **122/122** |
| Node 22.22.2 + npm 10.9.7 | instala, **122/122** |
| Node 24.21.0 + npm 12.2.0 | instala |
| `npm ci` (Node 24.21 + npm 11.21) | OK |
| `npm install --ignore-scripts=false` | vuelve a intentar `node-gyp` (atajo de escape funciona) |
| `npm run test:pg` (Postgres real, Node 24.21) | **122/122**, sin schemas huérfanos |

### No verificado
- ~~**Windows:** todo se probó en Linux.~~ **Verificado por el usuario en Windows (2026-10-01):** `npm install` a secas (134 paquetes, 0 vulnerabilidades) y `npm test` **122/122**, usando el zip entregado. La terminal venía usando Node 24.21.0 en el intento anterior (este log no imprime la versión). Queda sin probar `npm run test:pg` en Windows (requiere Postgres local).
- **Render:** no se desplegó. Mirar el log del próximo build: ya no debería compilar `better-sqlite3`.
- **`EBUSY`/`EPERM` al instalar** (visto en los logs del usuario): el proyecto está en `Desktop`, que en Windows suele sincronizarse con OneDrive; es la causa típica, **no verificada**. Si reaparece, pausar OneDrive o mover el proyecto fuera de `Desktop`.


## 39. Capacidad al aprobar inscripciones (+ bug de `POST /api/projects` encontrado al verificarlo)

**Contexto:** cierra la decisión abierta de `§34`/`§35`. Se trató como corrección y no como decisión de producto: `AI_RULES.md` regla 20 exige `cupos_ocupados <= cupos`, y el alta de inscripción (`POST /api/enrollments`) ya devolvía 409 "El proyecto no tiene cupos disponibles" con el proyecto lleno. Pero `cupos_ocupados` cuenta solo **aprobadas**, así que podían acumularse pendientes sin tope y la ONG las aprobaba por encima de `cupos` (el control se evadía en el paso de aprobar).

### Qué se hizo (`routes/enrollments.js`)
- Dentro de la transacción de `PATCH /:id`, el `UPDATE` que suma el cupo pasó a ser **condicional y atómico**: `UPDATE projects SET cupos_ocupados = cupos_ocupados + 1 WHERE id=$1 AND cupos_ocupados < cupos`. Si no afecta filas se lanza `NoCapacityError`, que fuerza el **ROLLBACK de toda la transacción** (la inscripción conserva su estado anterior; un simple `return` habría hecho COMMIT del cambio de estado) y se responde **409** con el mismo mensaje que el alta.
- Sin leer-y-después-escribir: en Postgres, dos aprobaciones simultáneas con un solo cupo libre se serializan sobre la fila del proyecto y la segunda ve 0 filas afectadas.
- Cubre `pending→approved` y `rejected→approved`. **No** bloquea re-aprobar algo ya aprobado (sigue siendo el no-op de `§34`).
- **Frontend sin cambios:** `NGODashboard.tsx` y `NGOProjectDetail.tsx` ya hacen `catch (e) { alert(e.message) }`, así que la ONG ve el mensaje del servidor.
- El esquema tiene `cupos NOT NULL CHECK(cupos >= 0)`, por lo que la comparación nunca es contra NULL.

### Tests (`test/integration/enrollments-capacity.test.js`, 8)
Con 1 cupo: aprobar la primera funciona; la segunda da 409 **y queda `pending`** (verifica el rollback); re-aprobar la ya aprobada con el proyecto lleno es no-op 200; rechazar libera el cupo y la otra se puede aprobar; una `rejected` no se puede re-aprobar si otra ocupó el cupo. Con 2 cupos y 3 pendientes, 9 aprobaciones simultáneas: quedan exactamente 2 aprobadas, 1 pendiente, contador = 2.

### Verificación
- **Rojo → verde:** con el código viejo fallan 6 de 8 (en Postgres el 409 esperado llegaba como 200 y el contador pasaba de 1 a 2); con el nuevo pasan 8/8 en SQLite y Postgres.
- **Mutación** (`return` en vez de `throw`, o sea COMMIT del cambio de estado): detectada (`expected 'pending', actual 'approved'`).
- Suite completa: **130/130** en SQLite y Postgres (Node 22) y en SQLite con **Node 24.21.0**, con `TZ=America/Argentina/Cordoba`.

### ⚠️ Bug preexistente encontrado (NO arreglado, fuera de alcance)
**`POST /api/projects` puede devolver un proyecto equivocado.** Tras el `INSERT` hace `SELECT * FROM projects WHERE ngo_id=$1 ORDER BY created_at DESC LIMIT 1` y usa el resultado para la respuesta y para insertar `requisitos`, `project_roles` y `project_categorias`. En SQLite `created_at` tiene resolución de **1 segundo**: dos proyectos de la misma ONG creados dentro del mismo segundo empatan y la consulta devuelve el de menor `rowid` (el más viejo). Verificado: tras esperar a que pase el segundo del seed, A→A (bien), B inmediatamente después→**A (mal)**, C 1,1 s después→C (bien). La fila insertada queda correcta; **se confunden la respuesta y las asociaciones** (categoría/roles/requisitos podrían engancharse al proyecto equivocado). En Postgres (microsegundos) el riesgo es mucho menor pero el patrón sigue siendo frágil (concurrencia). *Mi primera hipótesis (un problema de formato ISO vs. espacio en el seed) era errónea y se descartó mirando los datos.* Arreglo posible: generar el id en JS (`crypto.randomUUID()`) y usarlo en el `INSERT` y en las asociaciones, o `RETURNING`. Los tests nuevos no dependen de esto: localizan el proyecto por título.

### Otra grieta de la misma invariante (anotada, sin tocar)
`PUT /api/projects/:id` guarda `cupos = parseInt(volunteers_needed) || 0` sin compararlo con `cupos_ocupados`: se puede bajar la capacidad por debajo de los ya aprobados. Con `cupos_ocupados >= cupos` las aprobaciones nuevas quedan bloqueadas (degradación segura), pero la invariante queda rota.

### Pendiente / decisiones abiertas
- ~~¿Arreglo `POST /api/projects` (id propio en vez de "el último por `created_at`")? Es el único cambio que sigue pendiente de este hallazgo.~~ ✅ hecho en `§40` (y en otros 4 lugares con el mismo bug).
- ~~¿`PUT /api/projects/:id` debe rechazar `volunteers_needed < cupos_ocupados` (400)?~~ ✅ hecho en `§40`.


## 40. Id propio en las altas (5 instancias del mismo bug) y capacidad en `PUT /api/projects/:id`

**Contexto:** cierra los dos pendientes de `§39`. Al arreglar el primero resultó que el bug no era uno solo sino un patrón repetido en el código.

### El patrón
Después de un `INSERT` sin id, se releía "la última fila" con `ORDER BY created_at DESC LIMIT 1`. En SQLite `created_at` tiene resolución de **1 segundo**: dos altas dentro del mismo segundo empatan y la consulta devuelve la **más vieja**. La fila insertada en la base queda siempre bien; lo que se confunde es lo que se **devuelve** (y, en proyectos, las asociaciones que se hacen sobre eso). Verificado en los 5 casos con tests que fallaban antes del arreglo.

| Dónde | Efecto del bug (SQLite) |
|---|---|
| `POST /api/projects` | respuesta con el proyecto equivocado; categoría/roles/requisitos enganchados al proyecto equivocado |
| `POST /api/ngos/:id/empleados` | respuesta con el empleado equivocado |
| `insertMessage` (`POST /api/messages` **y** WebSocket) | el remitente recibe el mensaje anterior; **el destinatario lo recibe en tiempo real repetido** y nunca el nuevo |
| `POST /api/projects/:id/comments` | respuesta con el comentario equivocado |
| `POST /api/projects/:id/kpis` | respuesta con el KPI equivocado |

(Son **5 lugares en el código**; `insertMessage` lo comparten el endpoint REST y el WebSocket, así que los caminos que ve el usuario son 6.) Los dos primeros se detectaron por mi propio test; los otros tres, al barrer el código buscando el mismo patrón. **No queda ningún `INSERT` seguido de "el último por `created_at`"** (verificado con `grep`).

### Arreglo
Generar el id en el código (`crypto.randomUUID()`: UUID v4, **el mismo formato** que el default de la base en ambos motores; las cinco tablas usan el mismo `UUID_PK`), insertarlo explícitamente y releer **por id**. Regla 23 en `AI_RULES.md`; advertencia en `DATABASE_CONTEXT.md`; convención en `API_CONTEXT.md`.

### `PUT /api/projects/:id`: capacidad
- No se puede bajar `volunteers_needed` por debajo de las inscripciones aprobadas (**400**). La condición va **dentro del `UPDATE`** (`WHERE id=$16 AND cupos_ocupados <= $9`), no en una lectura previa: así una aprobación concurrente se serializa sobre la misma fila en Postgres y no queda `cupos_ocupados > cupos`.
- `volunteers_needed` omitido o `null` **conserva** la capacidad (antes `parseInt(undefined) || 0` la pisaba con 0). Un valor explícito debe ser un entero ≥ 1 (mismo mensaje que al crear); antes un negativo violaba `CHECK(cupos >= 0)` y devolvía 500.
- **No** se corrigió que el `PUT` no sea una actualización parcial real para el resto de los campos (p. ej. `status` omitido vuelve a `'active'`): fuera de alcance, queda documentado. Ninguna pantalla del frontend usa este endpoint hoy.

### Tests (nuevos: 20)
`creation-and-capacity-edit.test.js` (12) e `insert-returns-own-row.test.js` (8, incluyendo **dos tests de WebSocket de punta a punta con sockets reales**: recepción de mensajes enviados por REST y enviados por el propio socket, con eco al remitente).

### Verificación
- **Rojo → verde:** con el código viejo en SQLite fallan las altas (proyectos ×2, empleados, mensajes ×2, comentarios, KPIs, WebSocket ×2) y, en Postgres, el `PUT` (3 tests, por sí solo). Con el nuevo pasan todos.
- **Mutación** sobre el `PUT`: quitar la condición atómica del `UPDATE` (falla el test de bajada de capacidad **y** el de carrera) y volver a pisar con 0 al omitir el campo (falla). Detectadas.
- Suite completa: **150/150** en SQLite y Postgres (Node 22) y en SQLite con **Node 24.21.0**, con `TZ=America/Argentina/Cordoba`. Frontend 43/43. Los tests de WebSocket (con temporización) se repitieron 6 veces seguidas: estables.

### Hallazgos honestos
- **En Postgres el bug de las altas casi no se manifiesta** (microsegundos): los tests nuevos de altas pasaban ahí incluso con el código viejo, con 6 altas simultáneas. El valor del arreglo es sobre todo para **SQLite** (desarrollo y tests) y para quitar un patrón frágil. Por eso estos tests de altas tienen que correr también en SQLite (regla 23).
- Una versión inicial de mi test de mensajes tenía un `if (r.status === 404) return` porque yo había **adivinado** la ruta de la conversación; un test que pasa en silencio si la ruta no existe no prueba nada. Se corrigió usando la ruta real (`/api/messages/thread/:userId`) con aserciones firmes.
- Mis números de línea quedaron desfasados por mis propias ediciones y por un momento miré el lugar equivocado; se resolvió buscando por texto en vez de por número.

### Pendiente / decisiones abiertas
- `PUT /api/projects/:id` no es una actualización parcial real (ver arriba). ¿Se quiere que lo sea?

## 41. `nodemon` → `node --watch` (el backend queda sin devDependencies)

**Contexto:** al verificar `§40`, la instalación limpia pasó de 0 a **3 vulnerabilidades altas** sin que se tocara ninguna dependencia: apareció un aviso nuevo (`braces` ≤ 3.0.3, denegación de servicio por patrones anidados en extremo) que llega por `chokidar` hasta `nodemon`, la única devDependency.

### Por qué no había otra salida
- **No existe una versión corregida de `braces`:** la última publicada (3.0.3) es justamente la afectada.
- El `nodemon` más nuevo (3.1.14) sigue dependiendo de `chokidar ^3.5.2`, que usa `braces ~3.0.2`. Ninguna actualización de `nodemon` lo resuelve.
- El "arreglo" que propone `npm audit` (`nodemon@1.14.10`, marcado MAJOR) es un **retroceso de años**: se descartó. Tampoco se usó `npm audit fix --force`.
- Era solo de desarrollo (en Render corre `npm start`, o sea `node src/index.js`) y el vector (patrones de glob controlados por un atacante en el watcher) no se expone; el cambio se hizo para dejar `npm audit` en 0 y quitar una dependencia, no por un riesgo explotable.

### Qué se hizo
- `"dev": "nodemon src/index.js"` → **`"dev": "node --watch src/index.js"`**. `node --watch` viene con Node (el proyecto ya exige ≥ 22) y no tenía configuración propia de `nodemon` que migrar (`nodemon.json`/`nodemonConfig`: no existían).
- `nodemon` fuera de `package.json`. El lockfile lo regeneró `npm uninstall` (no a mano): salieron **28 entradas** (la cadena `nodemon`, `chokidar`, `braces`, `brace-expansion`, `minimatch`, etc.), **no se agregó ni cambió la versión de ninguna otra dependencia**, y se conservó `hasInstallScript` de `better-sqlite3`. El bloque `devDependencies` desaparece entero.
- **Producción:** `startCommand` de Render es `npm run db:migrate && npm start` (no usa `dev`), así que no cambia. Render instala 27 paquetes menos.

### Diferencias de comportamiento a conocer
- `node --watch` reinicia al cambiar los archivos **del grafo de módulos importados**; `nodemon` miraba todos los `.js`/`.json` del directorio. En la práctica no cambia nada para este proyecto, pero un archivo suelto que nadie importe (p. ej. un script) ya no dispara reinicios.
- Un cambio en `.env` no reinicia (tampoco lo hacía `nodemon`).
- El mensaje al reiniciar es `Restarting 'src/index.js'` (antes `[nodemon] restarting due to changes...`).

### Verificación
- **`npm audit`: 0** (backend), también desde un `npm install` plano en copia limpia con **Node 24.21.0 + npm 11.21.0**.
- **`npm run dev` real** (por npm, no solo `node --watch` a mano): arranca (`/health` → 200), reinicia al tocar un módulo y responde 200 después; probado en Node 22.22.2 y en Node 24.21.0.
- Suite completa: **150/150** en SQLite y Postgres (Node 22) y en SQLite con **Node 24.21.0**, con `TZ=America/Argentina/Cordoba`.

### No verificado
- **Windows:** todo se probó en Linux. `node --watch` usa el observador de archivos del sistema (soporte nativo de Windows en Node ≥ 22), pero no se ejecutó allí.
- Un detalle de mi propia verificación: dos veces maté sin querer mi propio shell con un `kill` por patrón de texto que coincidía con mi comando; los resultados que importaban ya estaban impresos y se repitió la limpieza usando el PID.

## 42. Emails: `EMAIL_REDIRECT_TO` (modo prueba) y diagnóstico del error 403 de Resend

**Contexto:** al usar la app con el remitente de pruebas, los mails fallaban con `403 Testing domain restriction: The resend.dev domain is for testing and can only send to your own email address`, p. ej. al mandar a `admin@bancoalimentos.org`.

### Diagnóstico
**No era un bug del código sino una restricción de Resend:** con `onboarding@resend.dev` solo entrega al email con el que se registró la cuenta. Los usuarios del seed tienen direcciones inventadas, así que Resend las rechaza. El comentario original de `email.js` ya lo anticipaba, pero no había forma de trabajar con eso en desarrollo.

### Qué se hizo
- **`EMAIL_REDIRECT_TO`** (opcional, `lib/email.js`): redirige **todos** los emails a esa casilla. El destinatario original queda visible en el asunto (`[para: x@y.com] ...`) y en un aviso al principio del cuerpo (HTML escapado con la función `esc` de `emailTemplates.js`, que ahora se exporta). Con varios destinatarios se manda **un** solo email.
- **Falla cerrado:** si `EMAIL_REDIRECT_TO` está definido pero no parece un email, **no se manda nada** (`invalid_redirect`) y se explica en el log. Es preferible a que un error de tipeo termine mandándoles mails de prueba a usuarios reales.
- **Diagnóstico del 403:** se reconoce el error (las dos redacciones conocidas de Resend) y se loguea **qué hacer**, una vez por proceso; el fallo de cada email se sigue registrando. Si ya hay redirección activa pero Resend igual rechaza, el mensaje dice que `EMAIL_REDIRECT_TO` debe ser **exactamente** el email de la cuenta de Resend.
- **Línea `Email:` en el log de arranque** (`describeEmailConfig()`, nunca incluye la key): desactivado / remitente de pruebas (con su limitación) / modo prueba / valor inválido / dominio propio. Advierte si la redirección está activa con `NODE_ENV=production`.
- **La configuración se lee en cada envío** y no al cargar el módulo (antes eran constantes de módulo): la hace visible y testeable.
- `.env.example` y `BACKEND_CONTEXT.md` ("Emails (Resend) y modo prueba") documentados.

### Cómo se usa
- **Local:** en `backend/.env`, `EMAIL_REDIRECT_TO=<el email con el que te registraste en Resend>` y reiniciar. Debe verse en el arranque `Email:   Resend → MODO PRUEBA: todo redirigido a ...`.
- **Render:** definir `RESEND_API_KEY` y `EMAIL_REDIRECT_TO` en *Environment* del servicio del backend y redeployar (`render.yaml` no declara variables de email). Con la redirección activa en producción **ningún usuario real recibe sus emails**: sirve para una demo, no para uso real.
- **Solución definitiva:** verificar un dominio propio en https://resend.com/domains, definir `EMAIL_FROM` con una dirección de ese dominio y dejar `EMAIL_REDIRECT_TO` vacío.

### Tests (nuevos: 29)
`test/unit/email.test.js` (25, con `fetch` reemplazado: destinatario, asunto, cuerpo, escape, varios destinatarios, falla cerrado, espacios, vacío, los dos textos del 403, un 403 por otra causa que no se confunde, 500, error de red, y `describeEmailConfig` en cada modo incluida la ausencia de la key) y `test/integration/email-redirect-flow.test.js` (4, **de punta a punta con los handlers reales**: inscripción → mail a la ONG, aprobación → mail a la voluntaria, propuesta de patrocinio → mail a la ONG, respuesta → mail a la empresa; los 4 salen a la casilla de prueba y ninguno a usuarios del seed).

### Verificación
- **Rojo → verde:** los 16 tests nuevos de `email.test.js` fallaban con el `email.js` anterior (pasaban los 8 comportamientos que ya existían); el de punta a punta también falla con el código viejo.
- **Mutación (4 de 4 detectadas):** que la redirección inválida deje de fallar cerrado, que la redirección no cambie el destinatario, que el aviso no escape el HTML, y que la explicación del 403 salga en cada email.
- Suite completa: **179/179** en SQLite y Postgres (Node 22) y en SQLite con **Node 24.21.0**, con `TZ=America/Argentina/Cordoba`.
- El arranque real se probó en los 6 modos y se comprobó que una API key reconocible **no aparece** en el log.

### Hallazgo en el camino
`test/integration/helpers.js` fija `RESEND_API_KEY = ''` dentro de `setupTestServer()` **a propósito** (ningún test debe mandar mails reales aunque el `.env` de quien lo corra tenga una key). Mi primer test de punta a punta definía la key antes y el helper la pisaba: pasaba "0 emails capturados" y lo habría leído como fallo del código. Se resolvió definiéndola **después** de levantar el servidor (posible porque ahora la configuración se lee en cada envío) y se dejó comentado en el test. Además el test fija `EMAIL_FROM` para no depender del `.env` de cada máquina.

### No verificado
- **La entrega real con Resend.** El sandbox no tiene acceso a `api.resend.com` ni una API key: lo verificado es que el request sale bien armado (a quién, asunto, cuerpo) contra un doble de `fetch`. Si Resend cambiara el formato del error 403, el diagnóstico caería al mensaje genérico `resend_403` (el email igual falla igual que antes).
- Que el email de `EMAIL_REDIRECT_TO` coincida con el de tu cuenta de Resend: no hay forma de comprobarlo desde acá; si no coincide, Resend lo rechaza con el mismo 403 y el log lo explica.

### Pendiente / decisiones abiertas
- Verificar un dominio propio para que cada usuario reciba su email (hoy el modo prueba es un paliativo).

## 43. Momentos (publicaciones con fotos) — Etapa 1: backend

**Pedido:** que los voluntarios suban fotos vinculadas a los voluntariados en los que participaron, y verlas como publicaciones tipo Instagram. Se acordó el diseño con estos valores: pueden publicar los voluntarios con inscripción **aprobada** y también la ONG dueña; solo likes (sin comentarios en v1); el autor borra lo suyo y la ONG dueña del proyecto modera; visibilidad pública; hasta 5 fotos por post, sin videos; se ve en una pestaña del feed, en el proyecto y en el perfil. **Esta entrega es la Etapa 1 (backend).** El frontend (feed estilo Instagram, compositor con compresión en el navegador, galerías) es la Etapa 2 y todavía no existe.

### Qué se construyó
- **Tablas** `posts`, `post_media`, `post_likes` (+5 índices) con **FK reales y `ON DELETE CASCADE`** (se apartó de la tabla `media` polimórfica del roadmap: no deja fotos ni likes huérfanos). Total: **31 tablas**.
- **`lib/storage.js`**: Cloudinary por **REST con `fetch`**, sin SDK (misma lógica que `email.js`). Subida y borrado firmados, detección del tipo **real** de imagen por cabecera (JPEG/PNG/WebP), URLs optimizadas (`f_auto,q_auto,w_1080` para el feed y miniatura cuadrada `w_480,h_480,c_fill`).
- **`routes/posts.js`** (7 endpoints, ver `API_CONTEXT.md`): proyectos elegibles, crear, feed paginado (filtros por proyecto y autor), detalle, like/unlike idempotentes, borrar/moderar.
- `lib/storage` se muestra en el arranque (`Fotos: Cloudinary (nube)` / `sin configurar`) sin filtrar credenciales; `.env.example` documentado.

### Decisiones de diseño que importan
- **Todo se valida antes de subir nada** (sesión/rol → configuración → formulario → campos → permiso → límite → cabecera real de cada archivo → recién ahí se sube): una foto inválida entre varias válidas rechaza todo el post sin gastar cuota.
- **Si la subida falla a mitad se borran las fotos que sí se subieron** (no quedan huérfanas) y se responde 502 sin detalles internos. Post + fotos se guardan en **una transacción después** de las llamadas externas (que no van adentro; regla 21/24).
- **No se confía en el `mimetype` que declara el cliente**: se verifica la cabecera real. Un HTML renombrado `.jpg` o un WAV (`RIFF` sin `WEBP`) se rechazan.
- **Límite de frecuencia**: 10 publicaciones por usuario por hora, calculado con `toMillis()` sobre las últimas 10 (sin aritmética de fechas por motor); persiste entre reinicios. No es estricto bajo concurrencia.
- **Respuesta con claves exactas**, `created_at` siempre ISO UTC (SQLite devolvía un string sin zona y Postgres un `Date`), `likes_count` normalizado con `Number()`, y `provider_id` nunca expuesto.
- **Paginación `limit/offset`** con desempate por id (se descartó keyset por `created_at`: en Postgres el driver trunca los microsegundos a milisegundos y se perderían filas).

### Tests (nuevos: 70)
`test/unit/storage.test.js` (23) y `test/integration/posts.test.js` (45), más 2 en `sqlTranslate.test.js`. La firma se ancla al **vector de prueba oficial** de Cloudinary (`bfd09f95…`, con `api_secret abcd`): se calculó con la implementación y **coincide**. Cobertura de las rutas: elegibilidad (pendiente no cuenta), quién puede/no puede publicar y que en ningún caso se sube nada, validaciones, falla a mitad de la subida con limpieza, feed público, orden, filtros, paginación, likes (idempotencia y 8 simultáneos), borrado con cascada y moderación, y el límite de frecuencia.

### Verificación
- **Rojo → verde** en las rutas (38 de 45 fallaban sin implementación). Suite completa: **249/249** en SQLite y Postgres (Node 22) y en SQLite con **Node 24.21.0**, `TZ=America/Argentina/Cordoba`; sin schemas huérfanos.
- **Mutación de las rutas (8 de 8 detectadas):** que una inscripción pendiente alcance, no verificar la cabecera, no limpiar ante una falla, que cualquier ONG pueda moderar, like sin `ON CONFLICT`, sin límite de frecuencia, orden invertido, y exponer `provider_id`. **Mutación del módulo de storage (4 de 4):** firma con `api_key`, firma sin ordenar, aceptar cualquier `RIFF`, y mandar el secreto en el formulario.

### Hallazgos honestos
1. **Bug latente del adaptador, corregido:** `translatePg` reescribía `ON CONFLICT DO NOTHING` como el texto `OR IGNORE` **en el mismo lugar**, lo que produce `INSERT ... VALUES (...) OR IGNORE`, SQL inválido en SQLite. Ninguna ruta lo usaba y su test solo comparaba el texto de la sustitución. Los likes lo hicieron aparecer (500 en SQLite). SQLite ≥ 3.24 entiende la cláusula de forma nativa (verificado en la 3.53, con y sin objetivo de conflicto), así que **se quitó la traducción**; el test ahora **ejecuta** el SQL contra una SQLite real. Regla 13 actualizada.
2. **Un error mío en los tests:** silencié `console.error` de forma global y eso **escondió el error real del servidor** (el 500 de arriba). Un mock demasiado amplio oculta justo lo que hay que ver; se acotó a los dos tests que provocan fallos a propósito.
3. **Otro error mío:** una aserción decía que el `public_id` no debía aparecer en la respuesta, pero la URL pública de Cloudinary lo contiene por construcción. Lo que no se expone es el **campo** `provider_id` (lo cubre la comprobación de claves exactas).
4. **Mutante equivalente:** mi primera mutación de "exponer `provider_id`" no cambiaba nada observable (la consulta ni seleccionaba la columna); se rehízo seleccionando y exponiendo, y entonces fue detectada. No era un hueco del test.
5. **Una guarda mal pensada en `detectImageType`:** un mínimo global de 12 bytes (pensado para WebP) rechazaba un JPEG válido de 11 bytes; ahora cada formato exige el largo que necesita (JPEG 3, PNG 8, WebP 12).
6. Mi `grep` de conteo de tablas sobrecontaba por coincidir con texto de comentarios; el número real (31) se verificó contra el esquema.

### ⚠️ NO verificado
- **La subida real a Cloudinary.** El sandbox no tiene acceso a su API ni una cuenta: `fetch` y las funciones de storage se reemplazan por dobles. Lo anclado a la fuente oficial es el **algoritmo de firma** (vector de la documentación); lo no verificado es todo el intercambio real (el formato exacto de la respuesta, el comportamiento de la cuenta). Se asume SHA-1 (el algoritmo documentado por defecto); si una cuenta estuviera configurada para exigir otro, Cloudinary respondería "Invalid Signature" y el log lo orienta (`CLOUDINARY_API_SECRET`...). **Se verifica con una subida real en cuanto haya credenciales.**
- **Que `multer` 2.x lea bien un multipart real desde un navegador**: los tests mandan `FormData` de Node con `fetch`, no un navegador. Se cubre en la Etapa 2.
- Windows (todo se probó en Linux).

### Límites conocidos (decisiones, no olvidos)
- Borrar un **usuario o proyecto** elimina sus posts por cascada en la base, pero **no** los archivos en Cloudinary (solo se borran al borrar el post por la API).
- El límite de 10/hora no es estricto si llegan pedidos simultáneos del mismo usuario.
- `GET /api/posts` no filtra por "seguidos" (solo `project_id` y `user_id`); se deja para cuando el frontend lo pida.
- No hay denuncia de publicaciones (solo moderación por la ONG dueña y borrado por el autor).

### Pendiente — Etapa 2 y 3 *(resuelto: Etapa 2 en §47, Etapa 3 en §48)*
- **Etapa 2 (frontend):** pestaña "Momentos" con feed estilo Instagram (tarjeta con carrusel, corazón, texto), compositor (selector de proyecto, vista previa, **compresión a ~1600 px en el navegador antes de subir**, aviso de subir solo fotos propias o con permiso), y sus tests.
- **Etapa 3:** galería en el detalle del proyecto, grilla en el perfil público del voluntario, y acciones de moderación en la pantalla de la ONG.

## 44. Aviso crítico en `proxy-addr` (dependencia transitiva de `express`)

**Contexto:** al verificar `§43` desde un zip limpio, `npm install` pasó a reportar **1 vulnerabilidad crítica** cuando antes daba 0, sin que se hubiera tocado ninguna dependencia (`package.json` y el lockfile no habían cambiado): apareció un aviso nuevo, igual que había pasado con `braces` (`§41`).

### Qué era
`proxy-addr` 2.0.7, **dependencia transitiva de `express`** (producción), con el aviso *"vulnerable to IP spoofing via IPv4-mapped IPv6 trust subnet"* (GHSA-jqcg-44mw-7w3h, CVSS 9.1, afecta `>=1.1.0 <2.0.8`). Es el mecanismo con el que `express` decide en qué proxies confiar cuando se configura `trust proxy`.

### Exposición real
**Prácticamente nula hoy:** el código no usa `trust proxy`, `req.ip`, `req.ips` ni `X-Forwarded-For` (verificado con `grep` en `src/`), así que ese camino no se ejecuta. Importa hacia adelante: un rate limiting **por IP** (que está en el roadmap) sí dependería de ese mecanismo, y detrás del proxy de Render habría que configurar `trust proxy`.

### Arreglo
A diferencia de `braces`, **tiene arreglo compatible** (`fix: true`, sin salto de versión mayor): `npm audit fix` (sin `--force`) en una copia descartable. Único cambio del lockfile: **`proxy-addr` 2.0.7 → 2.0.8** (nada agregado ni quitado; `package.json` intacto; `express` pide `~2.0.7`, que admite la 2.0.8; CRLF preservado). `npm audit`: **0**.

### Verificación
Instalación limpia desde el lockfile nuevo (instala la 2.0.8) y suite completa: **249/249** en SQLite y en Postgres (Node 22).

### Un error mío de proceso
El zip de `§43` se había armado **antes** de encontrar este aviso y, al arreglar el lockfile, **no lo regeneré**: durante un rato el archivo entregado todavía traía la versión vulnerable. Se reconstruyó y se verificó desde cero que `audit` da 0. Lección: después de cualquier cambio posterior al empaquetado, volver a empaquetar y volver a verificar **el zip**, no solo el árbol de trabajo.

## 45. Aviso en `source-map-js` (frontend): otro aviso nuevo sin que se tocara nada

**Contexto:** al instalar el frontend en Windows, `npm install` reportó **1 vulnerabilidad alta** que en `§37` estaba en 0. No se había modificado ninguna dependencia del frontend desde entonces: apareció un aviso nuevo (como `braces` en `§41` y `proxy-addr` en `§44`). Es un patrón a esperar: **`npm audit` depende de una base de avisos que cambia**, así que un proyecto con 0 hoy puede mostrar 1 mañana sin un solo cambio de código.

### Qué era
`source-map-js` 1.2.1, dependencia **transitiva** (`vite` → `postcss` → `source-map-js`): *"allows event-loop denial of service through indexed source-map section offsets"* (GHSA-68fv-2mgg-jv7q, CVSS 7.5, afecta `>=1.0.0 <1.2.2`). La usa el compilador para leer source maps **mientras se construye** el sitio; **no forma parte de lo que se publica** ni corre en el navegador. Para explotarlo habría que darle al propio build un archivo hostil: exposición real prácticamente nula.

### Arreglo
Tiene arreglo compatible (`fix: true`): `npm audit fix` (sin `--force`) en una copia descartable. Único cambio del lockfile: **`source-map-js` 1.2.1 → 1.2.2** (nada agregado ni quitado, `package.json` intacto, CRLF preservado). `npm audit`: **0**. **43/43** tests y `vite build` OK (1657 módulos).

### Sobre el aviso de `esbuild` ("install scripts not yet covered by allowScripts")
Es de la política de scripts de instalación de los npm nuevos y **es inofensivo**: el postinstall de `esbuild` solo verifica su binario y el paquete usa el binario de su dependencia opcional de la plataforma; los tests y el build funcionan igual sin ejecutarlo (verificado en Windows por el usuario y en Linux). No se hizo nada.

### Proceso
Esta vez se regeneró el zip **después** del cambio y se verificó el zip mismo (corrección del error de `§44`).

## 46. Momentos — Etapa 2 (frontend), primera parte: piezas de base y `can_delete` (se completó en §47)

> **Estado honesto:** esta entrega **no incluye todavía ninguna pantalla** de Momentos. Está el backend completo (`§43`) y, del frontend, las piezas de base. Para un usuario, lo único que cambia es el arreglo de `timeAgo`.

### Hecho en esta entrega
- **`can_delete` en la API (backend).** Cada publicación trae un booleano calculado por el servidor según quién mira, con la misma regla que `DELETE /api/posts/:id` (autor, o ONG dueña del proyecto). Hace falta porque el cliente conoce el id del usuario autor pero **no** quién es la ONG dueña del proyecto, así que no puede decidir solo si mostrar el botón de borrar. Se verificó contra el `DELETE` real (si el flag es `false`, borrar da 403; si es `true`, funciona).
- **`api.posts` + helper de subida multipart (frontend).** El helper **no fija `Content-Type`**: `req()` fuerza `application/json`, y con eso el servidor nunca recibiría los archivos.
- **`lib/imageCompress.ts`**: compresión de fotos en el navegador (1600 px, JPEG 0,82, fondo blanco para PNG transparentes, sin tocar fotos chicas y livianas, mensajes de error para el usuario). Sus dependencias del navegador se inyectan, para probar la lógica real sin `canvas`.
- **Arreglo de `timeAgo`** (afecta a toda la app).

### Hallazgo importante: `timeAgo` mostraría "NaN min"
`timeAgo` le pegaba una `Z` a **todo** timestamp, pensado para el formato viejo sin zona (`"2026-08-10 11:55:00"`). La API de Momentos devuelve ISO 8601 completo (`"...T12:30:45.000Z"`), con lo que quedaba `"...000ZZ"`: fecha inválida. Se detectó **al diseñar la tarjeta, antes de escribirla**, leyendo la utilidad que iba a reutilizar. Ahora acepta ambos formatos (el ISO con `Z` u offset se respeta; sin zona se asume UTC) y devuelve `''` ante un valor que no es una fecha, con la misma lógica de zona que `toMillis` del backend.

### Tests (nuevos: 35 en total en esta entrega)
- **Backend:** 6 de `can_delete` (255 en total).
- **Frontend:** 5 de `timeAgo`, 9 del cliente `api.posts`, 14 de `imageCompress` (71 en total).

### Verificación
- Backend **255/255** en SQLite y Postgres (Node 22); frontend **71/71**; `vite build` OK (1657 módulos); `tsc`: los mismos 3 errores preexistentes de `ImportMeta.env`, ninguno propio.
- **Mutación (10 de 10 detectadas):** `can_delete` ignorando a la ONG dueña; en el cliente, forzar `Content-Type: application/json` en la subida y descartar un `offset=0`; en la compresión, sin fondo blanco, agrandar fotos chicas, no liberar el bitmap y recomprimir siempre.

### Errores míos en esta etapa
1. En mis primeros tests de `can_delete` dejé una condición **absurda** en el test del listado (`|| p.project.id === 'proj-0'`) y otra comprobación que comparaba el flag contra mi propia expectativa en vez de contra el `DELETE` real. Se reescribieron.
2. Esos tests creaban publicaciones de María y **consumían el límite de 10 por hora** que los tests de este archivo comparten, haciendo fallar tests de borrado que antes pasaban. Se rehicieron con Juan como autor (en un proyecto de otra ONG). Lección: en un archivo con límite de frecuencia, el presupuesto de publicaciones es un recurso compartido.
3. Mi regex sobre el formato de fecha corta asumía `"01 jul"`; este entorno devuelve `"01-jul"`. Se cambió por una comparación independiente del formato (ISO vs. formato viejo dan lo mismo para el mismo instante).
4. `npm run build` parecía no imprimir nada: era el problema de siempre de mi sandbox (`vite` sin permiso de ejecución por venir de un zip, código 127), no del proyecto; se verificó con `node node_modules/vite/bin/vite.js build`.

### Pendiente (Etapa 2) *(resuelto en §47)*
`PhotoCarousel`, `PostCard` (like optimista, borrar según `can_delete`), `PostComposer`, `FeedTabs`, `MomentsFeed`, las rutas `/momentos` y `/ngo/momentos`, la pestaña en `MainFeed`/`PublicFeed`, y sus tests. Luego la Etapa 3 (galería del proyecto y grilla del perfil).

## 47. Momentos — Etapa 2 (frontend) completa: pantallas, rutas y pestañas

**Pedido:** las pantallas de Momentos sobre las piezas de base de §46, con las decisiones ya acordadas (publican voluntarios con inscripción aprobada y la ONG dueña; solo likes; el autor borra lo suyo y la ONG dueña modera según `can_delete` del servidor; visibilidad pública; hasta 5 fotos; pestaña dentro del feed). **No se tocó el backend.**

### Qué se construyó
`PhotoCarousel`, `PostCard`, `PostComposer`, `FeedTabs`, `MomentsFeed`, `MomentsPage` (`/momentos`) y `NGOMoments` (`/ngo/momentos`); `truncateText` y `userMessage` en `lib/format.ts`; pestañas en `MainFeed` y `PublicFeed`; acceso de la ONG por su barra lateral y por un botón en el header de `NGODashboard`. Detalle y reglas de comportamiento en `FRONTEND_CONTEXT.md` (sección "Momentos").

### Decisiones que tomé (revisables)
1. **Las pestañas son enlaces** (`/feed` ↔ `/momentos`), no estado local: funcionan el botón "atrás" y los links directos, y no se cargan los dos feeds a la vez.
2. **`PublicFeed` redirige a todo usuario logueado**, así que su pestaña solo la ve el visitante (ahí Momentos es de lectura y el like abre el modal de ingreso).
3. **No hay ítem nuevo en ninguna barra inferior** (la del voluntario y la de la ONG ya tienen 5). La ONG entra por la barra lateral (escritorio) y por un botón en el header de `NGODashboard` (celular).
4. **Una ONG que abre `/momentos` es redirigida a `/ngo/momentos`** (tiene su propio menú). Una empresa ve `/momentos` y su pestaña "Proyectos" va a `/explore` (el `/feed` es el feed personalizado de un voluntario).
5. **El feed recarga cuando cambia el id del usuario**: `liked_by_me` y `can_delete` los calcula el servidor según quién mira, y un visitante puede iniciar sesión desde el modal sin salir de la pantalla (si no, quedaban calculados para un anónimo).
6. **Paginación**: el `offset` avanza por lo que el servidor devolvió (no por lo mostrado), se deduplica por id y el offset se corrige al borrar/publicar. Una publicación nueva que no corresponde al filtro de la vista no se agrega.
7. Confirmaciones con `window.confirm` (igual que el cierre de sesión de `NGOBottomNav`).

### Tests (nuevos: 158)
Frontend **71 → 229**: `PhotoCarousel` 17, `FeedTabs` 5, `PostCard` 34, `PostComposer` 36, `MomentsFeed` 36, `MomentsPage` 6, `NGOMoments` 3, ruteo 3, `NGOSidebarNav` 2, pestañas en `MainFeed`/`PublicFeed` 2, y 14 de `format.ts` (`truncateText` y `userMessage`). `useAuth` se simula con `vi.mock`; `PostCard` y `PostComposer` se reemplazan por dobles al probar `MomentsFeed`.

### Verificación
- **Rojo → verde** en cada pieza (los tests se escribieron antes que la implementación y fallaron primero). Ojo: en varios casos el rojo fue "el módulo no existe", que es un rojo débil; por eso se sumó la mutación.
- **Mutación: 75 mutantes, 73 detectados.** Los 2 que sobreviven son **equivalentes**: quitar `if (deleting) return` en `PostCard` (el botón ya está `disabled`; es defensa en profundidad) y quitar la bandera `cancelled` del compositor (en React 18, `setState` tras desmontar no tiene efecto observable). Hubo **11 sobrevivientes en la primera pasada** (9 reales + 2 equivalentes); los 9 reales eran huecos de mis tests y se cerraron con tests nuevos que ahora los matan (ver errores).
- `vite build` OK. `tsc` (instalado fuera del proyecto): **0 errores en los archivos nuevos**; quedan 5 en archivos que no toqué (`ImportMeta.env` en `api.ts` y `NGOEmpleados.tsx`, y `global`/`.at` en `setup.ts` y `api.posts.test.ts`, por no tener `@types/node` ni los tipos de Vite en ese chequeo).
- Backend sin cambios: ver el resumen de la entrega para los números del zip.

### Errores míos en esta etapa
1. **Inicial del avatar en el nombre accesible**: sin avatar, la letra ("M") entraba en el nombre del enlace ("M María García"). Lo detectó un test; se marcó `aria-hidden`.
2. **Mi primer helper del test de rutas estaba mal** (comparaba `route.Component`, pero `createBrowserRouter` lo normaliza a `element`): dio un falso rojo incluso para `/ngo/:id`, que ya existía. Se vio porque falló algo que no debía fallar, y se corrigió antes de implementar. Ese test, de paso, confirmó el riesgo real: sin la ruta nueva, `/ngo/momentos` caía en el perfil público de una ONG.
3. **Huecos en mis tests (9 mutantes reales sobrevivieron)**: el corte a mitad de palabra y el umbral de `truncateText`; el `Escape` mientras se sube (el `window.confirm` de jsdom devuelve `undefined`, lo que tapaba la falla); el reset del `input` de archivos; el bloqueo del botón tras publicar; el doble toque en la misma pasada; el aviso de borrado de un id que ya no está; la respuesta vieja de "Ver más" tras cambiar de filtro; y que la pantalla de la ONG no oculte el compositor. Los tests del compositor pasaron todos al primer intento, y eso fue justamente lo que me hizo desconfiar y mutar.
4. **El arnés de mutación murió a mitad de camino** (el proceso en segundo plano no sobrevivió al fin de la llamada) y dejó `PostCard.tsx` con un mutante aplicado. Lo detecté comparando checksums, lo restauré y verifiqué que todos los archivos coinciden con los originales antes de seguir.
5. **Entorno**: `apt-get install postgresql` falló con 404 hasta hacer `apt-get update`. Y el sandbox tiene Node 22.22.2 / npm 10.9.7, no Node 24.21 / npm 11.

### ⚠️ NO verificado
- **Cómo se ve nada** (no hay navegador): maquetación, Tailwind, proporciones del carrusel, el modal en celular.
- **El deslizar con el dedo** en un dispositivo real (los tests simulan los eventos `touch`).
- **Foco y teclado del modal**: no hay *focus trap* ni se devuelve el foco al cerrar. Solo se probó Escape.
- **`compressImage` con un `canvas` real** (los tests usan dobles) y **que `multer` lea un multipart que mande un navegador real** (los tests del backend usan `FormData` de Node). Sigue pendiente lo de §43: **la subida real a Cloudinary**.
- **El botón "Momentos" de `NGODashboard`** no tiene test propio (esa pantalla no tiene tests); el de la barra lateral sí.
- Windows, Render, Resend.

### Límites conocidos
- En `/momentos` ningún ítem de la barra del voluntario queda resaltado ("Inicio" solo se marca en `/feed`).
- Un visitante en `/momentos` ve la barra del voluntario (mismo comportamiento que ya tenía en `/explore`).
- No hay denuncia de publicaciones ni comentarios (decisión de producto de §43).

### Pendiente — Etapa 3 *(resuelto en §48)*
Galería en `ProjectDetails`, grilla de miniaturas en `VolunteerPublicProfile` y moderación en pantallas de la ONG. `MomentsFeed` ya acepta `filters` (`project_id`/`user_id`).

## 48. Momentos — Etapa 3 (galerías y moderación)

**Origen (importante):** el código base de esta etapa (`MomentsGrid` + su test, `MomentsPlacement.test.tsx` y las secciones "Momentos" de `ProjectDetails`, `VolunteerPublicProfile` y `NGOProjectDetail`) **no lo escribí en el turno donde lo revisé**: apareció en el árbol de trabajo después de entregar el zip de §47. El autor aclaró después que un turno se había trabado, que lo interrumpió con Escape y reenvió el mensaje, así que ese turno interrumpido llegó a escribir esos archivos. Se decidió **adoptarla**; lo que sigue es la revisión y el endurecimiento, no el diseño original.

**Qué hay:** `MomentsGrid` en la galería del proyecto (`project_id`) y en el perfil público del voluntario (`user_id`, id de *usuario*); `MomentsFeed` filtrado por proyecto y sin compositor en `NGOProjectDetail` (moderación: el borrado lo decide `can_delete` del servidor).

**Revisión:** se leyó el código completo. La lógica de paginación/recarga replica la de `MomentsFeed` (offset por lo devuelto, deduplicar, recarga por id de usuario, descartar respuestas viejas) y los ids de ruta son los correctos (`/project/:id`, `/volunteer/:id` = id de usuario).

**Mutación: 22 mutantes.** Con los tests heredados **sobrevivieron 11** (offset en la 3.ª página, doble toque, borrar y corrimiento del offset, aviso de un id inexistente, respuestas viejas de la carga inicial y de "Ver más", indicador de fotos, cierre del modal al recargar, error de "Ver más", filtro `user_id`). Se agregaron 9 tests y **los 22 quedan detectados**. Los tests de integración (`MomentsPlacement`) ya mataban los 4 mutantes de ubicación/filtros.

**Tests:** frontend **249** (los 229 de §47 + 11 heredados: 8 de `MomentsGrid` y 3 de ubicación + 9 nuevos de `MomentsGrid`).

**No verificado:** lo mismo de §47 (nada visual, sin navegador, Cloudinary, compresión con canvas real) y el límite del modal (me gusta dentro del modal queda desactualizado al reabrir; solo por lectura).

## 49. Verificación local de Cloudinary y Resend (hecha por Matías, no por Claude)

**Qué pasó:** al probar la primera subida real, `POST /posts` respondió un error de Cloudinary: `403 … Request forbidden due to missing permissions (actions=["create"])`. Era un problema de **configuración de la cuenta/API key de Cloudinary**, no de código (el error llegó bien armado hasta la pantalla). Las causas probables que se le indicaron: cuenta creada para otro producto (Media Optimizer en vez de Programmable Media), API key con permisos restringidos, o credenciales mezcladas. **Matías no dijo cuál era**; solo que después funcionó, así que la causa concreta queda sin documentar.

**Resultado informado por Matías:** *en local, Cloudinary y Resend funcionan.* Esto lo verificó él en su máquina; yo no pude (sin navegador ni acceso a esos servicios).

**Lo que eso implica (inferencia, no comprobación mía):** como el 403 se produjo dentro de `POST /posts`, antes de eso el navegador ya había comprimido las fotos y mandado el multipart, y `multer` lo había leído; los dos puntos "no verificados" de §47 sobre eso quedan razonablemente cubiertos, aunque no se hizo una prueba específica de cada uno.

### Sigue sin verificar
- **Producción (Render):** `render.yaml` **no declara** `CLOUDINARY_*`, `RESEND_API_KEY`, `EMAIL_FROM` ni `APP_URL`; hay que cargarlas a mano en el panel de Render (o agregarlas a `render.yaml` con `sync: false`, decisión pendiente de Matías). Sin ellas, publicar responde 503 y los emails se omiten. Tampoco se verificó la versión de Node de Render ni el log de build. *(Declaradas en `render.yaml` en §50; los valores secretos se siguen cargando en el panel.)*
- **Resend con dominio propio / usuarios reales:** con `onboarding@resend.dev` solo se entrega al email registrado en Resend (ver `EMAIL_REDIRECT_TO` en `BACKEND_CONTEXT.md`).
- Lo visual y táctil de §47 (Tailwind, deslizar en celular real, foco del modal) y Windows.


## 50. `test:pg` fallaba en paralelo: `columnExists()` no filtraba por schema · variables de Resend/Cloudinary en `render.yaml`

**Contexto:** al armar el `CLAUDE.md` se corrieron todas las verificaciones en Windows (12 núcleos, Node 24.21.0, Postgres 16.15 en Docker). SQLite daba 255/255, pero `npm run test:pg` fallaba: entre 2 y 140 tests cancelados, **distinto en cada corrida**, con `❌ Error en migraciones: column "estado" does not exist`.

### Causa
`columnExists()` en `scripts/migrate.js` consultaba `information_schema.columns` filtrando solo por tabla y columna, **sin filtrar por schema**. En `test:pg` cada archivo de test migra su propio schema (`test_<pid>_<rand>`) en la misma base y los archivos corren en paralelo. Si otro schema ya tenía `empresa_voluntariados.estado`, `addColumnIfNotExists()` se salteaba el `ALTER TABLE` en el schema propio y después fallaba el índice sobre esa columna. Por eso el resultado dependía del orden y de cuántos archivos corrían a la vez. Además, los schemas de las corridas fallidas **quedaban sin borrar** (la limpieza no llegaba a correr) y rompían también las corridas siguientes.

Con los archivos de a uno (`-- --test-concurrency=1`) y la base limpia pasaba 255/255, lo que confirmó la causa antes de tocar código.

**Arreglo:** `AND table_schema = current_schema()`: el schema donde `CREATE TABLE` crea las tablas (el primero del `search_path` que existe), así que la consulta mira el mismo lugar que la migración. En producción (solo `public`) el comportamiento no cambia.

### Tests (nuevos: 2, solo en `test:pg`)
`test/integration/migrate-schemas.test.js`: migra un schema, después otro en la misma base, y exige que el segundo no falle, que tenga `estado`/`mensaje`/`updated_at` y las **mismas columnas** que el primero; y que volver a migrar sea idempotente. No depende del paralelismo: reproduce el bug de forma determinística. En SQLite se saltea (ahí no hay schemas). `helpers.js` ahora exporta `pgConfig` y `USE_PG_TESTS`.

### Verificación
- **Rojo → verde:** sin el arreglo, los 2 tests fallaban con el mismo error que la suite (`column "estado" does not exist`); con el arreglo, pasan.
- **Mutación (2 de 2 detectadas):** sacar el filtro de schema (el bug original) y fijarlo a `'public'` (falla con `column "latitud" of relation "projects" already exists`).
- **Suites completas:** SQLite **255/255** (normal y con `TZ=America/Argentina/Cordoba`); Postgres **257/257** **en paralelo** (sin `--test-concurrency`), tres corridas (una con la TZ de Córdoba), 0 schemas sobrantes antes y después.

### `render.yaml`: variables de Resend y Cloudinary (pedido del usuario)
Se declararon en el servicio `voluntariar-api`: `APP_URL` (`https://voluntariar.onrender.com`; sin ella los links de los emails apuntaban a `http://localhost:5173`), `EMAIL_FROM` (el mismo remitente de pruebas que el default del código), y `RESEND_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` con `sync: false` (el valor no va en el repo). Las opcionales (`EMAIL_REDIRECT_TO`, `CLOUDINARY_FOLDER`) no se declararon. El YAML se validó con `js-yaml`. README actualizado.

### Errores míos
1. **Convertí `migrate.js` de CRLF a LF** al editarlo con `sed -i` desde Git Bash (convierte el archivo entero). Lo vi con `git ls-files --eol`, lo restauré a CRLF y rehíce el comentario con Node; el diff final son 3 líneas. Lección: en este repo, editar archivos CRLF con `Edit`/Node, no con `sed`.
2. Al principio supuse que `test:pg` solo necesitaba un Postgres levantado; la primera corrida con Docker ya mostró que había un bug.

### ⚠️ NO verificado
- **Render:** no se desplegó. No verifiqué si, en un Blueprint **ya creado**, Render pide los valores de las variables `sync: false` nuevas al sincronizar o si hay que cargarlas a mano en el panel (no consulté la documentación de Render). Tampoco que `APP_URL` sea la URL real del frontend desplegado: se tomó de `CORS_ORIGINS`.
- Por qué la verificación anterior en Postgres (Linux) no lo detectó: probablemente corría menos archivos en paralelo, pero no lo comprobé.
