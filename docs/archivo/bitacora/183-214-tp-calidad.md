# Bitácora §183–§214: TP de Calidad

> Archivo (histórico). Parte de `docs/PROJECT_ANALYSIS.md`, separada el 30/10/2026 sin cambios en el texto. Índice: [`../../PROJECT_ANALYSIS.md`](../../PROJECT_ANALYSIS.md).

## 183. TP de Calidad: plan (`docs/PLAN_CALIDAD_TP.md`) y plan de pruebas (`docs/calidad/PLAN_PRUEBAS.md`) — T0 y T1

**Qué se hizo (solo docs):**
- `docs/PLAN_CALIDAD_TP.md`: decisiones del usuario (nivel 3, GitHub Issues, Mercado Pago, PDF aparte), línea base real, brecha requisito del TP → repo → falta, plan día por día hasta el 26/10, borrador de la matriz de decisión de la herramienta nueva (sin elegir), métrica de proyecto propuesta (densidad de pruebas), defectos reutilizados y riesgos.
- `docs/calidad/PLAN_PRUEBAS.md` (v0.1): objetivos medibles, contingencia por dependencia (con archivo y línea), niveles de prueba, matriz ISO/IEC 25010 (8 características, 2011) con evidencia y top 3, riesgos P×I, QA vs QC, criterios de entrada/salida, los 7 principios, plantillas de caso y de defecto, trazabilidad inicial.

### Verificación
- Línea base del 2026-10-17 (Windows, Node 24.21, `950e558`): `node --test --experimental-test-coverage` → **782 pass**, 0 fail, 0 cancelled; cobertura **92,94 % líneas / 84,20 % ramas / 90,54 % funciones**. Frontend `vitest run` → **694 pass**. Las dos también con `TZ=UTC` (782 y 694). Build de Vite en verde (a una carpeta temporal).
- Los tests del backend pasan sin `backend/.env`: corridos desde un directorio vacío → 781/781.

### Errores propios
- **El "782" que veníamos informando incluye `test/integration/helpers.js`**: `node --test` toma por defecto `**/test/**/*.js` y cuenta ese archivo (que no define tests) como un test que pasa (TAP `ok 25 - test\integration\helpers.js`). Los tests reales son **781**. No lo cambié en el código (el conteo de `CLAUDE.md` se aclara); los docs del TP usan 781.
- En el primer borrador de `PLAN_PRUEBAS.md` §9 atribuí A6 a "los tests de concurrencia" (lo encontró una sonda de la revisión) y usé un conteo de tests de otra fecha para §168: corregidos antes del commit.

### ⚠️ NO verificado
- `npm run test:pg`, `typecheck` y `npm audit` no se corrieron en esta sesión (los números de Postgres siguen siendo los de `CLAUDE.md`).
- Los datos de las herramientas del borrador de la matriz (licencias, planes gratis) son de memoria: se verifican en el paso 2 (mercado).
- La trazabilidad inicial se armó por nombres de archivo y comentarios, no revisando test por test.

## 184. TP de Calidad: CI en GitHub Actions (`.github/workflows/ci.yml`) — T3

**Qué se hizo:** primer pipeline del repo. Jobs: backend en **SQLite** y en **Postgres 16** (contenedor de servicio), cada uno en **UTC** y en **`America/Argentina/Cordoba`**; cobertura del backend con el runner de Node y **umbral de 80 %** en líneas, ramas y funciones (bloqueante); frontend: tests en las dos zonas horarias, `typecheck` y build; `npm audit` en los dos paquetes. Reportes: resumen en la página del run (conteos del TAP, tabla de cobertura, conteo del junit) y artefactos (`tap.txt`, `lcov.info`, `junit.xml`). Node 22, el de Render. No despliega (T9) y no instala nada nuevo.

### Verificación (local, antes del primer run)
- `--experimental-test-coverage` con `--test-coverage-lines/branches/functions` y el reporter `lcov`: probados en Node 24.21.
- `vitest run --reporter=junit --outputFile.junit=…`: `tests="694" failures="0"`.
- `better-sqlite3` 13.0.3 trae `prebuilds/linux-x64.node` (N-API 10) y lo elige por plataforma: por eso `npm ci` con `ignore-scripts` (`backend/.npmrc`, sin tocar) debería alcanzar en Linux.
- El lock del frontend incluye los binarios de Linux (rollup, tailwind oxide, lightningcss, esbuild, TypeScript 7).

### Errores propios
- Ninguno detectado todavía: el primer run lo dice. Si falla por algo real, queda como el run fallido del TP y se corrige en un commit posterior (decisión del usuario: no se reescribe).

### ⚠️ NO verificado
- **Nada corrió todavía en GitHub Actions.** En particular: que Node 22 soporte el umbral de cobertura y el reporter `lcov`; N-API 10 en el Node 22.x del runner; Postgres como servicio; que `npm run test:pg -- …` pase los argumentos al runner; las versiones de las acciones (`checkout@v5`, `setup-node@v5`, `upload-artifact@v4`); la sintaxis del YAML (no hay parser local).
- `npm ci` no se corrió localmente (borra `node_modules`).
- Duración del run (estimada 5–8 min, no medida).

## 185. TP de Calidad: primer run del CI (#1) y cobertura del frontend (T4, OK del usuario para la dependencia)

**Run #1 del CI** (`c77fe6e`, 2026-10-17, https://github.com/SantiagoPlanasM/voluntariar-PF/actions/runs/39043595627): **los 8 jobs en verde**, 1 min 19 s en total. Números del resumen del run (los pegó el usuario): SQLite UTC **782/782**; Postgres 16 UTC y Córdoba **784/784**; frontend UTC y Córdoba **694/694**. Con eso quedan verificadas las suposiciones de §184: sintaxis del YAML y versiones de las acciones, `better-sqlite3` con su prebuild en Linux, Postgres como servicio, `npm run test:pg -- …`, el umbral de cobertura y el reporter `lcov` en Node 22, `typecheck` en 0 y `npm audit` en 0.

**Avisos del run (no errores):** `actions/upload-artifact@v4` usa Node 20, que GitHub da por deprecado (lo fuerza a Node 24); y `ubuntu-latest` pasa a Ubuntu 26 desde el 19/10/2026. No los cambié: van como propuesta al usuario.

**Cobertura del frontend (T4):**
- `@vitest/coverage-v8` **5.0.3** exacto como devDependency (su peer exige `vitest` 5.0.3; suma 8 paquetes al lock; `npm audit` 0). Regla 18: OK del usuario.
- `vite.config.ts`: `coverage` con proveedor v8, `include: src/**/*.{ts,tsx}` (los archivos que ningún test importa cuentan como 0 %), excluidos solo los tests y `src/test/`. Script `npm run test:coverage`. Reportes en `frontend/reports/coverage/` (`text`, `json-summary`, `lcov`); `backend/reports/` y `frontend/reports/` al `.gitignore`.
- CI: el job de tests del frontend corre `test:coverage` y muestra el resumen en la página del run. **Informativa, sin umbral**, hasta que el usuario decida la métrica (ver abajo).

### Verificación
- Local (Windows, TZ de Córdoba): 694/694 con cobertura; **68 archivos**; líneas **83,14 %** (2393/2878), sentencias **79,63 %** (2850/3579), ramas **73,97 %** (2342/3166), funciones **67,82 %** (683/1007).
- `npm run typecheck`: 0 errores. `npm audit` (frontend): 0.
- El comando del resumen del CI (`node -e … coverage-summary.json`) probado en local.

### Errores propios
- La primera medición incluía `src/test/postFixtures.ts` (un helper de tests): 69 archivos y 83,17 % de líneas. Excluido; los números de arriba son sin él.
- `npm install` reescribió `package.json` y `package-lock.json` con LF en la copia de trabajo (eran CRLF). Los devolví a CRLF; en el índice siguen en LF, así que el diff es solo el contenido.

### ⚠️ NO verificado / decisión pendiente
- **Qué métrica cuenta para el "80 % del código existente" del nivel 3.** Con líneas el frontend pasa (83,14 %); con sentencias queda apenas abajo (79,63 %); con ramas (73,97 %) y funciones (67,82 %), lejos. El eje 5 del TP habla de cobertura de **sentencia** y de **decisión** (ramas). El backend da líneas, ramas y funciones (el runner de Node no informa sentencias).
- La cobertura del frontend en el CI (Linux, UTC) todavía no corrió: puede variar unas décimas con la zona horaria.
- Los conteos del job SQLite en Córdoba y la tabla de cobertura del backend del run #1 no los vi (el usuario no los pegó).

## 186. CI: umbral de cobertura del frontend, runner fijo y `upload-artifact` en Node 24 (decisiones del usuario sobre §185)

**Qué se hizo:**
- **Umbral bloqueante del frontend: líneas ≥ 80 %** (`coverage.thresholds` en `vite.config.ts`, así que vale igual en local y en el CI). Sentencias, ramas y funciones se siguen informando, sin umbral. Decisión del usuario sobre la pregunta de §185.
- **`runs-on: ubuntu-24.04`** en los 5 jobs (antes `ubuntu-latest`, que migra a Ubuntu 26 desde el 2026-10-19), para que el runner no cambie antes de la entrega.
- **`actions/upload-artifact@v7`** (antes v4, que corre en Node 20 y GitHub lo marca deprecado). Verificado en el `action.yml` de cada tag: v5 todavía es `node20`, v6 y v7 son `node24`. v7 (2026-02-26, última 7.0.2) agrega `archive: false` y pasa a ESM; con el valor por defecto se comporta como antes.

### Verificación
- `npm run test:coverage` (local): salida 0, 694/694, líneas 83,14 %.
- Control del umbral: con `--coverage.thresholds.lines=90` la salida es **1** con `ERROR: Coverage for lines (83.14%) does not meet global threshold (90%)`, y los 694 tests pasan igual (el rojo viene del umbral, no de un test).

### Errores propios
- Ninguno detectado.

### ⚠️ NO verificado
- El run #2 en GitHub (se pushea con este commit): `upload-artifact@v7` y `ubuntu-24.04` en la práctica, y la cobertura del frontend en Linux y UTC.
- No subí `checkout` ni `setup-node` (v5; hay v7): el run #1 no avisó nada sobre ellas.

## 187. La cobertura del backend en el CI estaba inflada (96,51 % contra 92,9 %): `include` explícito

**Qué pasó:** el resumen del run #2 (`15bb69c`) dio `all files` **96,51 % líneas / 91,61 % ramas / 95,78 % funciones** (UTC; Córdoba 96,52 / 91,60 / 95,78). Localmente da **92,94 / 84,20 / 90,54 %**. La tabla del CI tiene la columna de archivos mucho más ancha (nombres más largos), así que en Node 22 el reporte incluye **otros archivos** que en Node 24. Lo más probable es que sean los propios tests, que están cerca del 100 % y suben el total. Es un **defecto del pipeline**, no del producto: el número que habría ido al informe era falso. Lo detectó la comparación pipeline ↔ local.

**Corrección:** `--test-coverage-include='src/**' --test-coverage-include='scripts/**'` en el job de SQLite. El umbral de 80 % sigue igual.

### Verificación
- Local con el `include` explícito: **92,90 / 84,06 / 90,54 %**, los mismos 31 archivos que el reporte por defecto de Node 24.
- **Variación entre corridas:** dos corridas locales difieren en ramas de `auth.js` (90,64 contra 90,12 %), `messages.js` (91,96 contra 90,45 % de líneas) y `projects.js` (88,17 contra 87,99 %). El total se mueve unas centésimas. Hay caminos que dependen de los tiempos (WebSocket, carreras). Para el informe vale el número de un run identificado, no "el" número.
- La cobertura del frontend en el pipeline (run #2, UTC y Córdoba): líneas 83,14 %, sentencias 79,63 %, ramas 74 % (2343/3166), funciones 67,72 % (682/1007). En Windows local dan ramas 73,97 % y funciones 67,82 %: una unidad de diferencia en cada una.

### Errores propios
- En §185 di por buena la cobertura del CI ("en Linux también supera el 80 %") sin mirar el número. Pasaba el umbral, pero con un total inflado. El run #1 tiene el mismo problema.

### ⚠️ NO verificado
- **Qué archivos de más contaba Node 22:** no vi la tabla completa del CI, ni tengo Node 22 local. El run #3 tiene que dar alrededor de 92,9 %. Si no da eso, la hipótesis está mal.
- D5: el usuario eligió **SonarCloud** (registrado en `PLAN_CALIDAD_TP.md §0`).

## 188. SonarCloud + el quality gate del TP (prueba de concepto en la rama `sonar-poc`, D5)

**Qué se hizo:**
- `sonar-project.properties` (raíz): organización `santiagoplanasm-1`, proyecto `SantiagoPlanasM_voluntariar-PF` (creados por el usuario en SonarCloud, plan Free). Fuentes: `backend/src`, `backend/scripts`, `frontend/src` sin tests (lo mismo que mide la cobertura). Cobertura: los dos `lcov` del CI.
- Job `sonar` en `ci.yml`: corre después de `backend-sqlite` y `frontend-tests`, baja los artefactos de UTC, **prefija las rutas del `lcov`** con `backend/` o `frontend/` (los runners las escriben relativas a cada paquete: `SF:src/...`), corre `sonarqube-scan-action@v8` y después el gate del TP. Si falta `SONAR_TOKEN`, el job **falla** (antes de corregirlo, se salteaba y quedaba en verde: ver errores propios).
- `.github/scripts/sonar-gate.js`: como el plan gratis solo tiene el gate "Sonar way", este script espera a que SonarCloud procese el análisis (`report-task.txt` → `ce/task`), lee `duplicated_lines_density`, `new_coverage` y los issues BUG con severidad BLOCKER/CRITICAL abiertos (por rama o PR) y **bloquea** si hay ≥ 1 bug crítico, duplicación > 5 % o cobertura de código nuevo < 80 %. Si falta la duplicación o los bugs, bloquea; si no hay código nuevo, esa condición "no aplica" y lo dice. Sin dependencias.

### Verificación
- **Tests primero:** 11 tests (`sonar-gate.test.js`, Arrange–Act–Assert, valores límite 5 % / 5,1 % y 80 % / 79,9 %). Contra un stub: **10 de 11 en rojo** (el que pasa es "todo dentro de los umbrales", que el stub aprueba siempre). Con el código: **11/11**.
- **Mutation testing** (sobre `evaluateGate`, `parseMeasures`, `parseReportTask`; corrida de control en verde antes): **13 mutantes, 0 sobrevivientes** (bordes `<=`/`<` y `>=`/`>`, umbrales 5→6 y 80→70, nulos que aprueban, `every`→`some`, `period` ignorado, métrica ausente → 0, valor cortado en el segundo `=`, número como string).
- Versiones de las acciones verificadas en GitHub: `sonarqube-scan-action` v8.3.0 (`node24`), `download-artifact` v8.0.2 (`node24`). SonarCloud no necesita `SONAR_HOST_URL`.

### Errores propios
- La primera versión del job salteaba el análisis y el gate si faltaba `SONAR_TOKEN`, con lo que el job quedaba **en verde sin medir**. Lo vi al releerlo, antes del commit.

### ⚠️ NO verificado
- **Nada corrió en GitHub todavía.** La rama no dispara el CI con `push` (solo `main`): se prueba abriendo un PR `sonar-poc → main`.
- `main()` del script (fetch, espera del análisis, consultas a la API) **no tiene tests**: depende de SonarCloud real. Lo prueba el run.
- Que `types=BUG&severities=BLOCKER,CRITICAL` siga funcionando en SonarCloud (Sonar pasó a una taxonomía nueva de severidades; los parámetros viejos pueden estar deprecados).
- Que la definición de "código nuevo" del proyecto sea la que el usuario eligió, y cómo se ve `new_coverage` en un PR que no cambia código fuente (se espera "no aplica").
- Que el análisis automático de SonarCloud esté apagado (si estuviera prendido, el escaneo desde el CI falla).
- Que SonarCloud analice bien TypeScript 7.

## 189. Primer run fallido real del CI (#4, PR `sonar-poc`): `node --test <carpeta>` no corre los tests

**Qué pasó:** run #4 (https://github.com/SantiagoPlanasM/voluntariar-PF/actions/runs/39047958104, evento `pull_request`, commit `15c8622`): los 8 jobs de tests en verde y el job **`sonar` en rojo** en el paso "Tests del script del gate" (`node --test .github/scripts/`). El análisis de SonarCloud y el gate no llegaron a correr. Reproducido en local: `node --test` con una carpeta como argumento **no la recorre**: la toma como un módulo, falla con `Cannot find module '…\.github\scripts'` y lo cuenta como 1 test fallido (salida 1).

Es el **primer run fallido real** del pipeline (decisión del usuario: no se arma uno a propósito y no se reescribe). Detectó un defecto real del propio pipeline: un comando que en la máquina de desarrollo parecía andar.

**Corrección (commit posterior, sin reescribir el run):** `node --test ".github/scripts/*.test.js"` (el runner expande el patrón). Local: 11/11, salida 0.

### Errores propios
- **El rojo de §188 lo vi mal.** La primera corrida contra el stub usó `node --test .github/scripts/` y no mostró nada, porque el `grep` buscaba líneas TAP que no aparecieron. No me pregunté por qué no salía nada y pasé a correr el archivo directo, que sí dio 10 de 11 en rojo. Ese silencio era este mismo error. **Lección:** una corrida sin salida no es un rojo ni un verde; hay que mirar el código de salida.

### ⚠️ NO verificado
- El run del PR con la corrección: análisis real de SonarCloud y el gate del TP.

## 190. Runs #3 y #5: cobertura del backend corregida y primer análisis de SonarCloud (PR #1)

**Run #3** (`main`, `aca9058`, push, en verde). Cobertura del backend con `include` explícito (§187), job SQLite · UTC, datos que pegó el usuario: **`all files` 92,94 % líneas / 84,49 % ramas / 90,54 % funciones**. Coincide con la corrida local (92,90–92,94 / 84,06–84,20 / 90,54). **El defecto de §187 queda corregido.** De la hipótesis se confirma la magnitud (el total inflado era el problema), pero **no qué archivos de más contaba Node 22**: no se vio la tabla completa del run #2. Las ramas varían unas décimas entre corridas.

**Run #5** (PR #1 `sonar-poc → main`, `71295d4`, en verde, con los 9 jobs; el run #4 es el fallido de §189). El job `sonar` analizó y el gate del TP pasó. Lo medido, leído de la API pública de SonarCloud (`pullRequest=1`):
- cobertura total **86,3 %**, duplicación **2,2 %**, bugs **0**, vulnerabilidades **0**, code smells **0**;
- bugs BLOCKER/CRITICAL abiertos: **0** (es la consulta que hace el gate: funcionó con `types`/`severities`);
- `new_coverage`: **no viene** (el PR no cambia código fuente) → la condición "no aplica", como estaba previsto;
- gate "Sonar way" de SonarCloud: **OK**.

### ⚠️ NO verificado
- **En un PR, Sonar informa issues solo del código cambiado.** Los ceros no describen el proyecto entero: el análisis completo es el de `main`, después del merge.
- Si `duplicated_lines_density` del PR es de todo el proyecto o solo de lo cambiado.
- Cómo se comporta "código nuevo" en `main` (primer análisis de la rama principal).

## 191. Segundo run fallido real (#7): el gate del TP bloqueó por 2 bugs críticos de SonarCloud — triage y correcciones

**Qué pasó:** run #7 (`77f4fdf`, merge del PR #1 en `main`, https://github.com/SantiagoPlanasM/voluntariar-PF/actions/runs/39048784388): los 8 jobs de tests en verde, el análisis de SonarCloud completo y **el gate del TP en rojo**. Es el primer análisis de todo el proyecto (el del PR #1 solo veía lo cambiado). El gate encontró **2 bugs BLOCKER/CRITICAL** abiertos. El gate "Sonar way" de SonarCloud dio OK: solo mira código nuevo, y en el primer análisis de `main` no hay.

Análisis completo de `main` (API pública de SonarCloud, después del run #7): 17.058 líneas de código; cobertura **86,2 %**; duplicación **2,2 %**; **39 bugs** (BLOCKER 1, CRITICAL 1, MAJOR 37: 36 son `typescript:S9383`, "promesa sin await ni .catch", en el frontend); **18 vulnerabilidades** (CRITICAL 1, MAJOR 2, MINOR 15; 13 son `jssecurity:S5145`, log injection); 103 code smells; complejidad ciclomática 4.041 y cognitiva 2.715; deuda técnica 416 min.

**Triage de los 2 bugs críticos (los dos, falsos positivos):**
1. **BLOCKER `javascript:S2189`, `backend/src/db/index.js:201`:** `while (openTx) await openTx.done;`: "openTx no se modifica en el loop". Falso: la transacción hace `openTx = null` en su `finally` (línea 242) **durante** el `await`; Sonar no ve una escritura desde otra función asíncrona. Decisión del usuario: arreglarlo (ver tarea 1).
2. **CRITICAL `javascript:S2871`, `backend/src/lib/storage.js:57`:** `.sort()` sin comparador en la firma de Cloudinary; Sonar sugiere `localeCompare`. Falso, y la sugerencia sería un defecto: Cloudinary firma ordenando por código de carácter (lo que hace `.sort()` por defecto). Probado: con los parámetros de hoy los dos órdenes coinciden, pero con mayúsculas o signos no (`Z_key` va primera por código y última con `localeCompare`). Decisión del usuario: comparador explícito + test (tarea 2).

Además, una vulnerabilidad CRITICAL que el gate todavía no miraba: **`javascript:S4790`, `storage.js:60`, SHA-1 en la firma**. Decisión del usuario: el gate también bloquea ante vulnerabilidades BLOCKER/CRITICAL, y la firma pasa a SHA-256 (tareas 3 y 4).

El run #7 no se toca: se corrige en commits posteriores.

### Tarea 1 — `waitForOpenTx` recursivo (mismo comportamiento, sin el `while`)
- `backend/src/db/index.js`: `const tx = openTx; if (!tx) return; await tx.done; await waitForOpenTx();`. Igual que el `while`: espera y vuelve a mirar.
- **Verificación:** `db-transaction.test.js` 12/12. Mutante "no esperar" (antes y después del cambio): **muere** (2 fallas). Suite completa: SQLite **782/782**, Postgres **784/784**, SQLite con `TZ=America/Argentina/Cordoba` **782/782**.
- **Mutante que sobrevive, y un hallazgo:** "esperar una sola vez, sin volver a mirar" sobrevive (0 fallas en 3 corridas): ningún test distingue las dos versiones. Al analizarlo apareció una **posible carrera en la cola de SQLite**. Cuando la transacción A termina, su `finally` resuelve `A.done` y libera el turno de B. La consulta que esperaba a A y la transacción B se reanudan en microtareas casi seguidas. Si B hace `BEGIN` antes de que la consulta llegue a ejecutarse, la consulta corre **dentro de B** (y se perdería con un ROLLBACK de B), que es justo lo que la cola quiere evitar. **No está probado con un test**: es una hipótesis por lectura del orden de las microtareas. Solo afecta a SQLite (desarrollo y tests); producción usa Postgres con pool. **No se corrigió** (regla 16): queda para decidir con el usuario.

### Tarea 2 — firma de Cloudinary con comparador explícito por código de carácter
- `backend/src/lib/storage.js`: `.sort(byCodeUnit)` con `byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0)`; mismo orden que `.sort()` por defecto, ahora escrito, con el porqué en un comentario.
- **Test nuevo** (`storage.test.js`, AAA): claves `ab`, `timestamp`, `Z_key`, `a_b` → se firma `Z_key=1&a_b=2&ab=3&timestamp=4`. Es un **test de caracterización**: con el código anterior ya pasaba. Su **rojo es la sugerencia de Sonar**: con `.sort((a, b) => a.localeCompare(b))` falla.
- **Mutantes** sobre el comparador: `localeCompare` (1 falla), orden invertido (5 fallas), siempre 0 (4 fallas): **los 3 mueren**.
- Suite: SQLite **783/783**, Postgres **785/785**, Córdoba **783/783** (+1 por el test nuevo).

### Tarea 3 — la firma de Cloudinary pasa a SHA-256
- **Fuente:** https://cloudinary.com/documentation/authentication_signatures (leída el 2026-10-17): "By default, Cloudinary supports both SHA-1 and SHA-256 digests for validation, and you can use either". No hace falta tocar la cuenta ni mandar un parámetro que indique el algoritmo.
- `signParams(params, apiSecret, algorithm = 'sha256')`. El parámetro existe solo para que el test del **vector oficial** (que la doc publica en SHA-1) pida SHA-1 explícito y siga anclando a la fuente cómo se arma el texto firmado. Lo usan las cinco operaciones: subir y borrar foto, subir y borrar CV, y el **link de descarga del CV**.
- **Tests primero:** con las expectativas en SHA-256 y el código en SHA-1, **10 de 38 en rojo**; con el cambio, 38/38. Mutantes: "por defecto SHA-1" (10 fallas) e "ignora `algorithm`" (1 falla, el del vector oficial): **mueren los dos**.
- Suite: SQLite **783/783**, Postgres **785/785**, Córdoba **783/783**. `BACKEND_CONTEXT.md` actualizado.

### ⚠️ NO verificado (tarea 3) — hay que probarlo en Render antes de la defensa
- **Nada contra Cloudinary real:** los tests usan dobles. La doc no da un ejemplo en SHA-256 (todos sus ejemplos son SHA-1), así que el test de SHA-256 compara contra un hash calculado por el propio test.
- **El link de descarga del CV** (`/raw/download`): la doc de firmas no lo menciona. Que acepte SHA-256 lo deduzco porque el SDK oficial firma ese link con la misma función, que respeta `signature_algorithm`; no lo probé. Si falla, el CV no se puede abrir.
- **Prueba obligatoria después del deploy:** subir una foto de perfil, publicar un Momento con foto, subir un CV, abrirlo desde la ONG y borrarlo. Si algo da 401 de Cloudinary, se vuelve a SHA-1 con un commit (es una línea) y la vulnerabilidad se justifica en Sonar.

### Tarea 4 — el gate del TP también bloquea ante vulnerabilidades críticas
- `sonar-gate.js`: condición nueva `vulnerabilidades_criticas` (issues VULNERABILITY con severidad BLOCKER/CRITICAL abiertos ≤ 0; sin dato, bloquea). `main()` hace la misma consulta que para los bugs, con el otro tipo. Nombre del paso del CI actualizado; `PLAN_PRUEBAS.md` v0.4 (O6) y `PLAN_CALIDAD_TP.md`.
- **Tests primero:** 12 tests; antes del cambio **3 en rojo**; después 12/12. **Mutation testing** (corrida de control en verde): **16 mutantes, 0 sobrevivientes** (los 13 de §188 + vulnerabilidades `<=`→`>=`, nulo que aprueba y umbral 0→1).

### ⚠️ NO verificado (§191 en general)
- El próximo run de `main` con las cuatro tareas: que SonarCloud cierre los 2 bugs y la vulnerabilidad de SHA-1, y que el código cambiado no traiga issues nuevos críticos. Si el gate vuelve a bloquear, se documenta igual.
- La posible carrera de la cola de SQLite (tarea 1) sigue abierta.

## 192. Run #8 en verde: el gate del TP pasa sobre todo el proyecto

Run #8 (`959f74b`, push a `main`, https://github.com/SantiagoPlanasM/voluntariar-PF/actions/runs/39050538062): **los 9 jobs en verde**, incluido el job `sonar` con el gate. SonarCloud después del run (API pública):
- bugs BLOCKER/CRITICAL abiertos: **0** (eran 2: los cerró el cambio de §191); vulnerabilidades BLOCKER/CRITICAL: **0** (era 1, SHA-1);
- bugs **37** (todos MAJOR), vulnerabilidades **17**, code smells **103**, duplicación **2,2 %**, cobertura total **86,2 %**, 17.064 líneas de código;
- **cobertura del código nuevo: 96,875 %** (lo cambiado desde el primer análisis de `main`; umbral 80 %).

Así queda la secuencia que pide el TP: **run fallido real (#7) → triage → corrección en commits posteriores → run en verde (#8)**, sin reescribir nada.

### ⚠️ NO verificado
- SHA-256 contra Cloudinary real: falta el deploy manual de `voluntariar-api` y las pruebas de §191 (foto de perfil, Momento con foto, CV: subir, abrir desde la ONG, borrar).
- Los 37 bugs MAJOR (36 son promesas sin `await` ni `.catch` en el frontend) y las 17 vulnerabilidades no críticas no bloquean el gate: entran en la tabla de métricas del informe, sin triage todavía.
- ~~SHA-256 contra Cloudinary real~~ **Verificado por el usuario el 2026-10-17** después del deploy manual de `voluntariar-api` con `959f74b`: respondió "anda" a la lista de pruebas (foto de perfil, Momento con foto, CV: subir, abrir desde la ONG, borrar). No detalló cuáles hizo una por una.

## 193. Deploy desde el pipeline, smoke y E2E de Mercado Pago (T9)

**Decisiones del usuario (2026-10-17):** E2E con una **cuenta voluntaria dedicada** hasta la preferencia (sin pagar); `/health` con el commit; deploy por **deploy hook** cuando el CI de `main` termina en verde (el auto-deploy de Render sigue apagado; `render.yaml` sin tocar). El usuario mencionó que más adelante quizá quiera dos cuentas vendedoras (el Marketplace de §181): sería otra tarea, y el E2E se adaptaría.

**Qué se hizo:**
- `GET /health` → `{ status, timestamp, commit }`, con `commit = RENDER_GIT_COMMIT || null`, leído en cada pedido (`backend/src/index.js`; `API_CONTEXT.md`).
- `.github/scripts/post-deploy.js`, con tres modos:
  - `wait`: reintenta `/health` hasta ver el commit esperado (60 intentos × 20 s);
  - `smoke` (solo lectura): despierta la API, `/api/projects`, `/api/stats`, la portada y `/explore` (rewrite del SPA);
  - `e2e`: login de la cuenta dedicada → primer proyecto activo → `POST /api/donaciones` de $100 → `checkout_url` https de Mercado Pago → el checkout responde → `GET /api/donaciones/:id` = `pending`.

  Resumen en la página del run. Nunca imprime el token ni la contraseña. Sin dependencias.
- `.github/workflows/deploy.yml`: `workflow_run` del CI (solo si terminó en verde y fue un push a `main`) o `workflow_dispatch`. Pasos: falla si falta algún secreto (`RENDER_DEPLOY_HOOK_API`, `RENDER_DEPLOY_HOOK_WEB`, `E2E_EMAIL`, `E2E_PASSWORD`) → tests de los scripts → deploy hooks → `wait` → `smoke` → `e2e`. `concurrency` sin cancelar: un deploy a la vez.
- **Corrección de lo dicho en el plan:** `GET /api/donaciones/:id` consulta a Mercado Pago **solo con `payment_id`**. En el E2E, lo que habla con Mercado Pago es la creación de la preferencia (nuestra API → MP) y abrir el checkout.

### Verificación
- **Tests primero.**
  - `health-commit.test.js`: 3 tests, **3/3 en rojo** antes del cambio, después verdes.
  - `post-deploy.test.js`: 16 tests, **11 en rojo** contra un stub (los 5 que pasaban son los casos "todo bien", que el stub aprueba); con el código, verdes.
- **Mutation testing** de `post-deploy.js`: primera corrida **19 mutantes, 6 sobrevivientes**.
  - 1 era **equivalente**: el `typeof v === 'number'` sobraba, porque `Number.isInteger` ya rechaza strings. Se sacó del código.
  - 5 eran **agujeros de los tests**: un 500 con `status: ok`; estadísticas con decimales; dominios que contienen "mercadopago.com" (al final o al principio); un 201 sin `donation_id`.
  - Se agregaron esos casos (ahora 17 tests). Segunda corrida: **18 mutantes, 0 sobrevivientes**.
- Scripts del CI: `node --test ".github/scripts/*.test.js"` → **29/29**.
- **Smoke real contra producción** (solo lectura, desde local): los 5 chequeos en verde (API despierta al primer intento, projects, stats, portada, `/explore`).
- Backend completo: SQLite **786/786**, Postgres **788/788**, Córdoba **786/786** (+3 por `/health`).

### Errores propios
- En el plan dije que el E2E "consulta a MP" con `GET /api/donaciones/:id`: no es así sin `payment_id` (corregido arriba).
- La primera versión de los tests de `post-deploy` dejaba pasar 5 mutantes: la cobertura de casos de borde era más floja de lo que parecía.

### ⚠️ NO verificado
- **`deploy.yml` no corrió nunca:** faltan los secretos y la cuenta de E2E.
- **Que Render defina `RENDER_GIT_COMMIT`** en este servicio: si no lo define, `wait` agota el tiempo (~20 min) y falla. Se ve en el primer deploy.
- **El sitio estático no informa su commit:** el pipeline espera solo a la API. El smoke del sitio puede ver la versión anterior si el build del frontend tarda más.
- **El deploy hook despliega el último commit de la rama**, no necesariamente el del run. Si entra otro push en el medio, `wait` no ve el commit esperado y falla. El siguiente run lo despliega.
- **Cada push a `main` en verde despliega**, también los de solo documentación, y cada deploy consume minutos de build del plan gratuito de Render (el límite exacto no lo verifiqué).
- **El E2E deja una donación `pendiente` por deploy** en la base de producción.
- **El E2E puede fallar si no hay proyectos activos**, o con 429 si se corre más de 10 veces en una hora con la misma cuenta.

## 194. Deploy #1: el primer deploy desde el pipeline anduvo; el E2E falló en el login (401) — y el chequeo del checkout no servía

**Deploy #1** (https://github.com/SantiagoPlanasM/voluntariar-PF/actions/runs/39059784573, disparado por el CI #9 de `f414c07`, en verde): pasaron los deploy hooks, **`wait`** y el **smoke**; falló el **E2E**. Lo que esto deja verificado:
- **Render define `RENDER_GIT_COMMIT`** (era un NO verificado de §193): la API respondió `"commit":"f414c073…"` y `wait` lo vio.
- El deploy hook funciona, con el auto-deploy apagado.

**Por qué falló el E2E:** el resumen del run (lo pegó el usuario) dice `❌ login de la cuenta de E2E: login respondió 401`. Los secretos `E2E_EMAIL` / `E2E_PASSWORD` no coinciden con la cuenta creada en producción. Es un **error de configuración**, no del código: el script cortó ahí y **no creó ninguna donación**. El pipeline lo detectó, que es para lo que está. No se reescribe: el próximo deploy corre con los secretos corregidos.

**Error propio, con hallazgo real:** antes de ver el resumen supuse que había fallado el chequeo "el link de checkout responde", y la suposición estaba mal. Al investigarla, igual apareció un problema verdadero, que habría hecho fallar el próximo run:
- el checkout de Mercado Pago (`sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=…`) responde **403** a `curl` y al `fetch` de Node, porque CloudFront bloquea los clientes que no son navegadores;
- con un User-Agent de navegador responde **200 aun con un `pref_id` inventado**.

O sea, el chequeo **no podía pasar** desde un script, y aunque se lo forzara **no probaba nada**. Mi supuesto de §193 ("el checkout responde") estaba mal.

**Corrección (commit posterior):** el E2E ya no abre el checkout. `checkDonationCreated` exige un link **https de Mercado Pago con `pref_id` no vacío** (no se asume un formato de `pref_id`: el repo no tiene ninguno real). La evidencia de que Mercado Pago creó la preferencia es que nuestra API solo responde 201 si `createPreference` tuvo éxito (`routes/donaciones.js`), más el `pref_id` en el link.

### Verificación
- **Test nuevo:** link sin `pref_id` o con `pref_id=` vacío → falla (**rojo** antes del cambio: 17/18; después 18/18). Scripts del CI: **30/30**.
- **Mutación:** con el cambio reaparecieron 3 sobrevivientes ("acepta http", "sin ancla final", "sin ancla inicial"). Las URLs falsas de los tests no traían `pref_id`, así que fallaban por eso y no por lo que cada test quería probar. Se les agregó `?pref_id=1-abc`. Resultado: **19 mutantes, 0 sobrevivientes** (incluido "sin pref_id").

### ⚠️ NO verificado
- El E2E completo en producción: falta que el usuario corrija los secretos.
- El formato real de un `pref_id` de Mercado Pago (no hay ninguno en el repo; se exige solo que no esté vacío).

## 195. Deploy #2: login OK, pero la cuenta de E2E era una ONG (403 en la donación)

**Deploy #2** (https://github.com/SantiagoPlanasM/voluntariar-PF/actions/runs/39061235908, CI #10 de `6ecb6a6` en verde): deploy, `wait` (la API respondió `6ecb6a6`) y smoke en verde. El E2E siguió más que en el #1, según el resumen que pegó el usuario:
- ✅ login de la cuenta de E2E;
- ✅ hay un proyecto activo;
- ❌ `POST /api/donaciones respondió 403: Requiere rol: volunteer o company`.

**Causa (confirmada por el usuario):** la cuenta de E2E **se registró como ONG**. El rol no se puede cambiar desde la app: hay que crear otra cuenta como voluntaria y actualizar los secretos. Igual que en el #1, es configuración y no un defecto. No se creó ninguna donación.

**Mejora del script (commit posterior):** `checkLogin` exige 200 + token + rol `volunteer`, y si el rol es otro, lo dice en el login ("la cuenta es "ngo"; tiene que ser voluntaria") en vez de esperar al 403 de la donación.
- Tests: 4 nuevos (3 con rojo débil, porque la función no existía) → **33/33**.
- Mutación: **23 mutantes**. Sobrevivió "no mira el 200": se agregó el caso 500 + token. Resultado final: **0 sobrevivientes**.

### ⚠️ NO verificado
- El E2E completo con una cuenta voluntaria: pendiente de que el usuario la cree y cambie los secretos.

## 196. Primer deploy completo en verde desde el pipeline: deploy + smoke + E2E de Mercado Pago (T9 cerrada)

**Deploy #3** (https://github.com/SantiagoPlanasM/voluntariar-PF/actions/runs/39062074795, CI #11 de `528afeb` en verde): deploy, `wait` y smoke en verde; **E2E en rojo**. El usuario dijo "creo que puse mal el mail" y corrigió `E2E_EMAIL`. **La causa exacta del #3 no está confirmada**: no se vio su resumen.

**Deploy #4, disparado a mano** ("Run workflow", `workflow_dispatch`, sobre `528afeb`; https://github.com/SantiagoPlanasM/voluntariar-PF/actions/runs/39062374570): el usuario pegó el resumen del E2E, **todo en verde**:
- ✅ login de la cuenta de E2E (voluntaria);
- ✅ hay un proyecto activo para donar;
- ✅ `POST /api/donaciones` ($100) crea la preferencia en Mercado Pago (201 + link con `pref_id`);
- ✅ `GET /api/donaciones/:id`: pendiente (no se paga).

Con esto, **T9 queda cumplida para el nivel 3**: deploy por el pipeline después del CI en verde, smoke automático y flujo E2E con la plataforma externa en cada despliegue. La secuencia completa de runs de deploy quedó en el historial sin reescribir: #1 (login 401), #2 (la cuenta era ONG), #3 (secreto mal cargado, sin confirmar) y el manual en verde.

### Errores propios
- **Agoté el cupo de la API pública de GitHub** (60 pedidos por hora sin sesión) siguiendo los runs cada 30 segundos con varias consultas por vuelta. Por eso no pude confirmar por la API el número ni el link del deploy en verde. **Lección:** seguir los runs cada 60–90 s, con una sola consulta por vuelta.

### ⚠️ NO verificado
- ~~El número y el link del deploy manual en verde~~ Completado en §198: es el **Deploy #4**.
- Cada E2E que pasa deja **una donación pendiente** en producción (por diseño). No revisé cuántas hay.

## 197. Pruebas de carga con k6: stress, esfuerzo sostenido y una corrida corta en producción (T10)

**Decisiones del usuario (2026-10-17, antes de correr nada):**
- **Umbrales:**
  - **stress:** rampa 0→25→50 usuarios con umbral p95 < 500 ms y errores < 1 %; de 50 a 100 usuarios ("quiebre") se mide sin umbral;
  - **esfuerzo sostenido:** 20 usuarios constantes 10 min, p95 < 300 ms y errores < 1 %;
  - **producción:** 10 usuarios 2 min, p95 < 2 s y errores < 1 %.
- **Dónde:** el stress y el sostenido corren siempre contra una API local en el runner. Producción, solo a mano.
- **k6 en local:** con la imagen Docker oficial.

**Qué se hizo:**
- `load/common.js`: solo lectura. Cada "visita" hace `GET /api/projects?limit=20`, `GET /api/stats` y el detalle de un proyecto al azar, y después espera un rato (tiempo de lectura). No hace login, registro, donaciones ni subidas: así no aparecen 429 de los limitadores y no se crean datos.
  - `setup()` despierta la API (hasta 10 intentos de 60 s) y elige los proyectos. **Todos los umbrales están acotados a su escenario** (`{scenario:…}`), así que el pedido que despierta la API no cuenta.
- `load/stress.js` (escenarios `hasta50` y `quiebre`, el segundo con métricas propias), `load/soak.js` (`SOAK_DURATION`, solo para una corrida corta de prueba) y `load/prod.js`. `summaryTrendStats` incluye el p99.
- `load/lib/summary.js`: el reporte en Markdown que arma `handleSummary`, con el veredicto, p95/p99/mediana/máximo, errores, pedidos por segundo y **cada umbral con su valor medido**. Escribe `load/reports/<escenario>.md` y `.json` (ignorados por git). `load/package.json` existe solo para que Node trate esos `.js` como módulos ES en los tests: no tiene dependencias.
- `.github/workflows/load.yml` ("Carga", solo `workflow_dispatch`):
  - job `runner`: SQLite + seed + API en `localhost:3001` → k6 2.3.0 (`grafana/setup-k6-action@v1`) → stress → sostenido; reporte en el resumen y artefacto `carga-runner`;
  - job `produccion` (opción `produccion`): **se niega a correr después del 25/10/2026**.
- `ci.yml`: el job `sonar` también corre `node --test "load/lib/*.test.js"`.

### Verificación
- **Tests primero** (`load/lib/summary.test.js`):
  - 8 tests, **7 en rojo** contra un stub. Al ver el primer reporte real faltaban el valor medido de cada umbral y la unidad: 2 tests más (rojo → verde) y un tercero para "ms". Total **9/9**.
  - **Mutación:** **13 mutantes, 0 sobrevivientes**.
- **Corridas locales de validación** (Windows, Docker Desktop, `grafana/k6:latest` = **k6 v2.3.0**, API local con SQLite + seed: 12 proyectos activos). **No son las oficiales:** la red pasa por Docker Desktop y la máquina es otra que el runner.
  - **Stress:** ✅. 77.364 pedidos (286,5/s) en 270 s; p95 19,38 ms, p99 48,57 ms, máximo 127,09 ms; errores 0 %. Umbral `hasta50`: p95 **8,03 ms** (< 500). Quiebre (50→100): p95 24,89 ms, errores 0 %.
  - **Sostenido corto (1 min, no el oficial de 10):** ✅. p95 10,11 ms, errores 0 %.
  - **`prod.js` apuntado a la API LOCAL** (solo para probar el script): ✅. p95 8,98 ms.
  - Antes de agregar el p99 y el valor medido hubo una primera corrida del stress: ✅, 78.128 pedidos, p95 10,83 ms, quiebre p95 12,94 ms.

### Errores propios
- La primera versión del reporte no mostraba **el valor medido** de cada umbral (solo ✅) ni el p99, porque k6 no lo calcula si no se le pide. Lo vi en la primera corrida real. También había puesto `node --test load/lib/` en un comentario: el mismo error de §189, corregido antes del commit.
- Al cambiar un test con `sed`, los escapes no coincidieron y no se modificó nada. Me di cuenta porque el test siguió en verde cuando tenía que ponerse rojo, y lo rehice con el editor.

### Hallazgo para el informe
- **En local, la API no mostró un punto de quiebre hasta 100 usuarios** (p95 < 25 ms, 0 errores). Con este tamaño de datos (seed) y solo lecturas, 100 usuarios no alcanzan para degradarla. Encontrar el quiebre real necesitaría más carga (otra decisión con el usuario: no se cambió lo aprobado).

### ⚠️ NO verificado
- **El workflow `Carga` no corrió nunca** en GitHub: hace falta el push y "Run workflow". Los números del informe tienen que salir de ahí.
- Los inputs de `setup-k6-action@v1` (`k6-version`) los saqué de su README, no de su `action.yml` (no lo pude leer: 404 y la API de GitHub sin cupo).
- La corrida contra producción no se hizo todavía.

## 198. Números oficiales: Carga #1 del pipeline (k6 2.3.0) y Deploy #5, el primer deploy automático completo en verde

**CI #12 → Deploy #5** (`df86dde`, https://github.com/SantiagoPlanasM/voluntariar-PF/actions/runs/39064610099): en verde, **disparado solo** por el CI de un push. Es el primer deploy automático completo (deploy + smoke + E2E de Mercado Pago). El #4 (§196) había sido manual.

**Carga #1** (https://github.com/SantiagoPlanasM/voluntariar-PF/actions/runs/39065266810, `workflow_dispatch` con `produccion`, sobre `df86dde`, después del Deploy #5): **los dos jobs en verde**, runner 886 s y producción 130 s. Números del resumen del run (los pegó el usuario), **k6 v2.3.0 (go1.26.8, linux/amd64)**:

| Prueba | Pedidos | p95 | p99 | Mediana | Máximo | Errores | Umbral (medido) |
|---|---|---|---|---|---|---|---|
| **Stress** (runner, rampa 0→100 usuarios, 270 s) | 79.811 (295,6/s) | 3,99 ms | 7,58 ms | 1,41 ms | 97,31 ms | 0,00 % | `hasta50`: p95 < 500 ms → **3,06 ms** ✅; errores < 1 % → **0** ✅ |
| └ Quiebre (50→100 usuarios, sin umbral) | — | 4,56 ms | — | — | 97,31 ms | 0,00 % | — |
| **Esfuerzo sostenido** (runner, 20 usuarios, 601 s) | 35.828 (59,6/s) | 3,17 ms | 6,46 ms | 1,39 ms | 40,07 ms | 0,00 % | p95 < 300 ms → **3,17 ms** ✅; errores < 1 % → **0** ✅ |
| **Producción** (Render gratis, 10 usuarios, 122 s) | 2.414 (19,8/s) | 418,69 ms | 799,16 ms | 103,00 ms | 2.637,10 ms | 0,00 % | p95 < 2 s → **418,90 ms** ✅; errores < 1 % → **0** ✅ |

**Lectura para el informe:**
- En el runner, la API **no se degradó hasta 100 usuarios**: el p95 pasó de 3,06 ms (hasta 50) a 4,56 ms (50→100), sin errores. Con solo lecturas y los datos del seed, **no se encontró el punto de quiebre** dentro de la carga aprobada. Encontrarlo exige más usuarios o más datos (decisión pendiente).
- En el sostenido no se vio degradación en 10 minutos: p95 3,17 ms y máximo 40 ms. Lo que no se midió es si **crece con el tiempo**: k6 da el agregado, no la evolución minuto a minuto.
- **Producción es unas 100 veces más lenta que el runner** (mediana 103 ms contra 1,4 ms). Es lo esperable en el plan gratuito de Render (poca CPU, Postgres por red y la latencia desde GitHub hasta Render), pero no está medido qué parte corresponde a cada cosa. El máximo de 2,6 s probablemente sea el pedido que despierta la API en `setup()`, que entra en el agregado general pero no en el umbral (el umbral está acotado al escenario: 418,90 ms contra 418,69 ms del agregado). Eso **no está verificado**.
- Las corridas locales de §197 dieron números más altos (p95 8–19 ms) que el runner (3–4 ms): Docker Desktop en Windows agrega la red virtual. **Los números del informe son los del pipeline.**

### ⚠️ NO verificado
- Que el máximo de 2,6 s en producción sea el pedido de `setup()`. Se ve en `prod.json` (artefacto `carga-produccion`), que no abrí.

## 199. Diseño de casos (eje 5) y contraste rojo/verde de un defecto real (eje 2): `docs/calidad/DISENO_CASOS.md` (T6 y T7)

**Qué se hizo:**
- **T7, rojo/verde del defecto B7:** el test de regresión de integración `comments-badwords.test.js` (de `da8ac95`) se corrió en dos worktrees aparte (en el scratchpad, con `node_modules` enlazado por junction y borrado después **sacando primero la junction**):
  - sobre `ae17116`, el commit anterior al arreglo: **2/2 rojo**. "computadora" → 400, se esperaba 201 (falso positivo); "imbécil" → 201, se esperaba 400 (falso negativo por los acentos);
  - sobre `da8ac95`: **2/2 verde**.

  Las salidas, sin rutas locales ni stack, quedaron en `docs/calidad/evidencia/b7-{antes,despues}.txt`. El test unitario del arreglo **se descartó para el contraste**: importa `src/lib/badWords.js`, que crea el mismo commit, y daría un rojo débil.
- **T6, monto de donación:** `amountError` exportada (mismo patrón que `applyPayment`). Test unitario nuevo `test/unit/donation-amount.test.js` (7 tests AAA) con 5 clases de equivalencia y los valores límite 99/100/101 y 499.999/500.000/500.001. Los que faltaban antes eran 101, 499.999 y un valor válido del medio.
- **T6, contraseña:** 4 tests AAA de valores límite en `test/unit/validators.test.js`: 7/8 caracteres, 72/73 bytes en ASCII y con ñ, y entradas que no son texto.
- **T6, tabla de decisión del CV:** 10 reglas mapeadas a los tests de `cv.test.js`. Se agregó la que faltaba (R4: una **ONG con permiso** y Cloudinary sin configurar → 503).
- `docs/calidad/DISENO_CASOS.md`: AAA y criterio previo, las tablas, la cobertura de sentencia y decisión de `amountError` y el contraste B7. `PLAN_PRUEBAS.md` v0.7.

### Verificación
- **Rojo:** `donation-amount.test.js` dio 7/7 en rojo **débil** (la función no estaba exportada). Los tests de la contraseña y del CV son de **caracterización** (el código ya era correcto). El rojo con sentido lo dieron los mutantes:
  - `amountError`: mueren 6 (`<`→`<=`, `>`→`>=`, sin `isInteger`, mínimo 99, máximo 500.001, `return ''`). **Sobrevive 1 equivalente:** "sin `typeof`", porque `Number.isInteger` ya rechaza lo que no es un número;
  - `validatePassword`: **antes de los tests nuevos, `v.length < 7` sobrevivía** (ningún test probaba el borde: solo `'Ab1'`). Después mueren los 5 mutantes de los bordes;
  - regla del CV: "la ONG nunca tiene permiso" (3 fallas) y "cualquier estado de inscripción" (1 falla), mueren los dos.
- **Cobertura de `amountError` medida** (lcov del runner, solo ese test): 6/6 líneas y todas las ramas. **Con un solo caso válido: 6/6 líneas pero 1 de 4 ramas.** Es el ejemplo de sentencia ≠ decisión. Salvedades: el runner mide líneas, no sentencias, y la cantidad de ramas de V8 cambia entre corridas. Por eso la decisión se documenta con una tabla a mano.
- Suite completa: SQLite **797/797**, Postgres **799/799**, Córdoba **797/797** (+11). `CLAUDE.md` actualizado.

### Errores propios
- El primer intento de guardar la evidencia usó un `sed` con paréntesis mal escapados: los archivos quedaron solo con el encabezado. Se rehízo con un script de Node desde las salidas guardadas, y se verificó que no quedaran rutas locales (0).
- El primer intento de crear las junctions con `cmd //c mklink` falló por el escapado desde Git Bash: se hicieron con PowerShell.

### ⚠️ NO verificado
- Que las tablas no omitan una condición: salen de leer el código, y la mutación lo refuerza pero no lo garantiza.

## 200. Mejora medida (eje 4): las 36 "promesas sin manejar" de SonarCloud (S9383) — revisión una por una y `void`

**Decisión del usuario (2026-10-17):** atacar las issues de SonarCloud por prioridad, y no las 157 de una: S9383 como la **mejora medida antes/después**, revisar los regex (S8786), hacer el triage del resto y la accesibilidad (§201–§203). El usuario habilitó Chrome para verificar la UI.

**Antes** (análisis de SonarCloud de `df86dde`, 2026-10-17 19:51 UTC, API pública): **bugs 37** (36 `typescript:S9383` "Promises should not be left unhandled" + 1 `S8985` en un test), **calificación de fiabilidad C (3.0)**, vulnerabilidades 17, code smells 103, duplicación 2,2 %, cobertura 86,3 %.

**Revisión (no a ciegas):** las 36 líneas llaman a **12 funciones**: `handleSend`, `ask`, `load` (en 11 pantallas), `loadPatrocinios`, `loadProjects`, `loadRecs`, `loadSidebarData`, `loadFollowingFeed`, `loadRatings` y `fetchFollowStatus`. Se leyó el cuerpo de cada una (script en el scratchpad que extrae la función entera). **Todas capturan cualquier error**: `try/catch` alrededor de cada `await`, `Promise.allSettled` (`loadSidebarData`) o `.then(ok, err)` (`fetchFollowStatus`). Ninguna promesa puede rechazarse, así que **ninguna de las 36 era un bug real** (no había rechazos sin manejar). Si alguna no hubiera capturado, se arreglaba con su test en vez de silenciarla.

**Cambio:** `void` adelante de las 36 llamadas (35 líneas en 17 componentes), con un script que toca solo esas líneas y respeta CRLF/LF. `void` deja explícito que el resultado no se espera, y **el comportamiento no cambia**.

### Verificación
- `git diff`: 35 líneas en 17 archivos, una por línea marcada (ningún cambio de fin de línea).
- Frontend: `npm run typecheck` 0 errores; `vitest run --coverage` **694/694**, cobertura igual (líneas 83,14 %, sentencias 79,63 %, ramas 73,97 %, funciones 67,82 %).
- No hace falta mutación: no hay lógica nueva (es la misma llamada con `void`).

### ⚠️ NO verificado
- **El "después" de SonarCloud:** sale del análisis del pipeline después del push. Se espera bugs 37 → 1 (el `S8985` del test queda para el triage, §202).
- Lo visual no cambia (no hay cambios de UI): no se miró en Chrome.

## 201. Vulnerabilidad real encontrada por SonarCloud (S8786): un email gigante bloqueaba toda la API — tope de 254 antes del regex

**Los 6 regex marcados por S8786** ("backtracking no lineal") se midieron con entradas armadas para el peor caso (script en el scratchpad):

| Dónde | Regex | 40 mil caracteres | ¿Lo controla un usuario? |
|---|---|---|---|
| `backend/src/routes/auth.js:33` `EMAIL_RE` | `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$` | **813 ms** (cuadrático) | **Sí**: `/login` y `/register` son públicos, sin tope de largo (el JSON acepta 5 MB) |
| `frontend/.../AuthModal.tsx:11` | el mismo | ídem | Solo el propio usuario en su navegador |
| `backend/src/lib/email.js:34` `looksLikeEmail` | similar | 621 ms | No: valida `EMAIL_REDIRECT_TO` (variable de entorno) |
| `backend/src/lib/time.js:27` y `frontend/src/lib/format.ts:13` `hasZone` | `T.*(Z\|[+-]…)$` | 324 ms (20 mil) | No: fechas que genera la base |
| `frontend/src/lib/format.ts:73` | `\s+$` | 309 ms (20 mil) | No: corre sobre un texto ya recortado a un largo fijo |

**Reproducción contra la API local** (SQLite + seed, puerto 3002):
- `POST /api/auth/login` con `'a@' + 'a.'×40000 + '@'` → **400 en 3.427 ms**;
- un `/health` mandado 30 ms después **esperó 3.357 ms**: Node tiene un solo hilo, así que **un pedido bloquea a todos los usuarios**.

Con el tope del JSON (5 MB), el crecimiento cuadrático daría horas por pedido. **Es una vulnerabilidad de denegación de servicio real.** El primer intento de reproducirlo falló porque la entrada terminaba en un espacio y `validateEmail` hace `.trim()` antes del regex: se rehízo terminando en `@`.

**Corrección:** `validateEmail` (backend) corta en **254 caracteres (RFC 5321) antes del regex**. Lo usan el registro, el login y `ngos.js` (empleados). Mismo tope en `AuthModal.tsx` (regla 3: misma validación en los dos lados). Los otros 4 regex **no se tocaron**: no reciben texto de un usuario, y van al triage (§202) con esta tabla como justificación.

### Verificación
- **Tests primero:**
  - `validators.test.js`: 254 pasa / 255 no; 80 mil caracteres en < 100 ms; los espacios de los costados no cuentan. Rojo: **2 de 3**, el de 80 mil tardó 3.900 ms.
  - `test/integration/email-redos.test.js`: login y registro → 400 "Email inválido" **en < 500 ms**, con `/health` en paralelo < 500 ms. Rojo: **2/2**, 3,3 s por pedido.
  - `AuthModal.test.tsx`: 255 → "Email inválido" sin llamar al servidor; 254 → se registra. Rojo: **1 de 10**.
- **Error propio en el test de integración:** la primera versión medía solo el `/health` y era **inestable**: en 2 de 3 corridas del registro el `/health` se atendía antes de que empezara la validación y pasaba aunque el ataque tardara 3,4 s. Se agregó la medición del propio pedido malicioso, y el rojo quedó estable (2/2 en dos corridas).
- **Mutantes** (backend): tope 255 (1 falla), tope 253 (2), sin el tope (4) y sin `trim` (1): **mueren los 4**.
- **Suites:** backend SQLite **802/802**, Postgres **804/804**, Córdoba **802/802**; frontend **696/696**; `typecheck` 0. `API_CONTEXT.md` y `CLAUDE.md` actualizados.
- Los mutantes se aplicaron con `sed -i` sobre `auth.js`, que es CRLF, y se restauró con `cp` desde una copia byte a byte. Se verificó que sigue en CRLF (`file`, `git ls-files --eol`).

### ⚠️ NO verificado
- Que en producción (Render) el bloqueo fuera igual de largo: no se atacó producción, a propósito.
- Las sesiones de Render no se reiniciaron por esto: no hay evidencia de que alguien lo haya explotado.

## 202. Triage del resto de SonarCloud + inyección en logs arreglada (`forLog`) — `docs/calidad/TRIAGE_SONAR.md`

**Inyección en logs (`jssecurity:S5145`, 13), es real:** el `data.id` del webhook de Mercado Pago llega del query string **ya decodificado**. Con `%0A` se podía escribir una línea falsa en los logs de Render (por ejemplo, `[donaciones] aviso del pago 999: approved`). Lo mismo, en menor medida, con `topic` y `type`, `req.path` en el manejador de errores, y los mensajes de error de Cloudinary, Mercado Pago o Resend.
- `backend/src/lib/logSafe.js`: `forLog(value, max = 300)` reemplaza los caracteres de control (`U+0000–U+001F`, `U+007F`) y los separadores de línea Unicode (`U+2028`, `U+2029`) por un espacio, y corta con "…".
- Aplicado en los 13 logs marcados: `donaciones.js` ×9, `voluntarios.js`, `auth.js` (foto), `errorHandler.js` y `email.js`. Los cambios se hicieron con un script que exige que cada texto aparezca una sola vez y respeta CRLF/LF.

**Triage del resto:** `docs/calidad/TRIAGE_SONAR.md` lista cada regla con su decisión, y el **texto listo para pegar** en SonarCloud al marcarla como "Accept":
- `S8985` (es un test, a propósito);
- `S5693` ×2 (los límites existen: 8 MB por archivo, límite de frecuencia y cabecera real);
- `S8475` (en localStorage solo hay datos de nuestra API);
- `S8480` (URL de configuración y token propio; **mejora anotada**: mandar el token en el primer mensaje del socket y no en el query string);
- los 4 `S8786` no explotables (§201).

`S7773` (63, `Number.parseInt`) queda **sin tocar**: es cosmético y va a la tabla de métricas.

### Verificación
- **`logSafe.test.js`:** 5 tests AAA, **3/5 en rojo** contra un stub, después 5/5.
- **Mutación:** 8 mutantes, **0 sobrevivientes**: solo LF..CR, sin separadores Unicode, sin DEL, `>`→`>=`, 300→299, sin "…", borrar en vez de espacio, sin `g`.
- **De punta a punta** (`donaciones-webhook.test.js`): un `data.id` con `%0A` deja **una sola línea** en el log. Con la línea vieja (`dataId.slice(0, 40)`) el test **falla**; con `forLog`, pasa.
- **Suite:** SQLite **808/808**, Postgres **810/810**, Córdoba **808/808** (+6).

### Errores propios
- **El editor convirtió los escapes ` `/` ` del regex en los caracteres reales.** Para JavaScript son **saltos de línea**: el archivo no cargaba ("missing /"). Lo peor es que la primera tanda de mutantes "murió" **por eso** (cada corrida daba `tests 1, fail 1`: el archivo no cargaba). La línea se rehízo con `String.fromCharCode(92)`, se verificó que no quedaran separadores literales (`od -c`) y se repitieron los mutantes **chequeando que corrieran los 5 tests**. Dos de los mutantes no se habían aplicado (el `sed` no coincidía): se aplicaron por Node.
- **Lección:** un mutante solo cuenta si la corrida ejecuta los tests. Hay que mirar `tests N`, no solo `fail`.

### ⚠️ NO verificado
- **Si SonarCloud reconoce `forLog()` como sanitizador:** se ve en el próximo análisis. Si no, se marcan como "Accept" con el texto de `TRIAGE_SONAR.md`.
- **Las marcas "Accept" en SonarCloud las hace el usuario** (hace falta su sesión).

## 203. Accesibilidad (SonarCloud S6853/S6848/S6845) verificada en Chrome; resultado medido de §200–§202; último S5145

**Resultado medido de la mejora (eje 4):** el análisis de SonarCloud de `2a53138` (CI #14 y Deploy #7 en verde, 2026-10-17 20:56 UTC), comparado con el de `df86dde` (§200):

| | Antes | Después |
|---|---|---|
| Bugs | 37 | **1** (`S8985`, en un test: se acepta) |
| Vulnerabilidades | 17 | **5** |
| Issues abiertas | 157 | 109 |
| Calificación de fiabilidad / seguridad | C / — | C (por el bug MAJOR que queda) / C |

De los 13 `S5145`, **SonarCloud cerró 12, o sea que reconoció `forLog()`** como sanitizador. El que quedaba (`ts` y `user_id` en la línea de firma inválida, ya validados como dígitos) se pasó también por `forLog()` (no cambia nada: un dígito queda igual). Los 6 `S8786` siguen marcados, porque el regex no cambió (en el email se agregó el tope): se aceptan con los textos de `TRIAGE_SONAR.md`.

**Accesibilidad (34 smells; decisión del usuario):**
- **`S6853`, 29 `<label>` sin asociar** (CreateVoluntariado, FilterModal, NGOEmpleados, NGOKPIs, VolunteerProfile):
  - **20** tenían un campo: se agregó `htmlFor` + `id` (ids descriptivos y únicos: `crear-*`, `empleado-*`, `kpi-*`, `perfil-*`). Se mantiene el `aria-label`, porque el texto visible lleva "*" u "(opcional)" y no se quiso cambiar el nombre accesible ni los tests.
  - **9** titulaban un grupo de botones (Categoría, Modalidad, Roles, Requisitos, Habilidades, los 4 filtros): pasaron de `<label>` a `<p>` con las mismas clases.
  - **Pendiente:** sumar `role="group"` y `aria-labelledby` a esos grupos (mejora anotada, no hecha).
- **`S6848`, 4 tarjetas de Explorar** ("Para vos" en móvil y escritorio, Destacados y el catálogo) eran `<div onClick={navigate}>`. **Con el teclado no se podían enfocar ni abrir.** Ahora son `<Link to="/project/:id">`, y `useNavigate` se sacó porque ya no se usa. Se verificó antes que no tuvieran botones adentro ni arrastre con el mouse.
- **`S6848` en `Modal` (clic en el fondo) y `S6845` en `PhotoCarousel` (`tabIndex`):** son a propósito y se aceptan (`TRIAGE_SONAR.md`).
- Los cambios se hicieron con scripts que verifican el contenido de cada línea antes de tocarla y respetan CRLF/LF. `FRONTEND_CONTEXT.md` suma la convención.

### Verificación
- **Tests primero:**
  - `ExploreScreen.test.tsx`: "cada tarjeta es un link a /project/:id". **Rojo** antes (no había links), verde después.
  - `CreateVoluntariadoLimits.test.tsx`: busca los 7 campos **por el texto visible** de su etiqueta (con el "*", que el `aria-label` no tiene). **Rojo 2/2 con el componente anterior** (se cambió el archivo por el de `HEAD` y se restauró desde una copia), verde con el nuevo.
- **Error propio en un test:** esperaba "Descripción completa (opcional)" con espacio, pero JSX descarta el salto de línea antes del `<span>` y el espacio que se ve es un margen (`ml-1`). Se usa un regex.
- **Chrome** (backend local con SQLite + seed, sin Resend, Cloudinary ni Mercado Pago, y Vite con `VITE_API_URL` local; el `frontend/.env` apunta a producción):
  - **Explorar:** 12 links a `/project/…`, `display: block` y 240 px de ancho, igual que antes. Se enfocó una tarjeta y **Enter abrió el proyecto**.
  - **Perfil (voluntaria):** clic en el texto "Ubicación" → foco en su campo (borde verde); las 3 etiquetas encuentran su campo; "Habilidades" es un `<p>` con el mismo aspecto.
  - **Crear voluntariado (ONG local del seed, sesión puesta por la API y restaurada al final):** pasos 1 y 2, etiquetas asociadas; clic en "Descripción corta" y en "Duración del evento" → foco en el campo; "Categoría" y "Modalidad" en `<p>` con el mismo aspecto.
  - **KPIs** (`/ngo/kpis/proj-4`) y **Equipo** (`/ngo/empleados/ngo-4`): 5 y 4 etiquetas asociadas; el clic lleva al campo.
  - **Filtros de Explorar:** los títulos son `<p>`, no queda ningún `<label>` suelto y el aspecto es el mismo.
- **Suites:** backend SQLite **808/808**, Postgres **810/810**, Córdoba **808/808**; frontend **699/699** (+3), `typecheck` 0; cobertura del frontend: líneas 83,26 %, sentencias 79,75 %, ramas 74,05 %, funciones 68,09 % (subió un poco por los tests nuevos).

### ⚠️ NO verificado
- **Lector de pantalla real y celular:** no se probó.
- **El paso 3 de crear voluntariado no se abrió en Chrome** (lo cubre el test).
- **No se mandó ningún formulario:** se escribieron datos de prueba sin guardar.
- **El análisis de SonarCloud de estos cambios:** sale con el próximo push.

## 204. Registro de defectos en GitHub Issues (T12) y cierre del triage de SonarCloud

**Registro de defectos:** 18 defectos ya documentados (nada inventado), cargados en **GitHub Issues #2–#19** (el #1 es el PR de Sonar) con `gh` 2.102.0, autorizado y logueado por el usuario. Todo se publicó después del "publicá" explícito del usuario.
- **13 labels:** `defecto`, `sev:alta/media/baja`, `encontrado:revision/ci/sonar/mutacion/prod`, `area:backend/frontend/ci/tests`.
- **Cada Issue** sigue la plantilla de `PLAN_PRUEBAS.md §10`: requisito, caso, origen, entorno, pasos, esperado, obtenido, commit del arreglo y prueba de regresión. Se **cerró como "completado"** con un comentario que linkea el commit.
- `docs/calidad/REGISTRO_DEFECTOS.md` (trazabilidad requisito → caso → defecto → Issue) y los cuerpos de los Issues **salen del mismo archivo de datos**, así que dicen lo mismo.
- `.github/ISSUE_TEMPLATE/defecto.md` deja la plantilla para los defectos que aparezcan de acá en adelante. `PLAN_PRUEBAS.md` v0.8.
- Severidad: alta 2, media 8, baja 8. **Dónde se encontraron:** revisión 6, CI 4, SonarCloud 3, mutación 1, **producción 4**. Tasa de escapados **4/18 = 22,2 % sobre este registro**. El documento aclara que es una **selección**: con todos los hallazgos de `REVISION.md` el denominador sería mucho mayor.

**Triage de SonarCloud, cierre:** 14 issues aceptadas con su comentario (6 por el usuario y 8 por Claude en Chrome, con autorización explícita; se destildó la opción de compartir el comentario con Sonar), 17 FIXED, **gate "Sonar way" en OK**, y 63 abiertas, todas `S7773` (cosméticas). `TRIAGE_SONAR.md` actualizado.

### Verificación
- `gh issue view 12`: CLOSED/COMPLETED, 4 labels y el comentario con el commit. `gh issue list --label defecto --state all`: **18**.
- SonarCloud (API): los 14 triados en `ACCEPTED` con 1 comentario cada uno; `qualitygates/project_status` = **OK**; issues abiertas: **63**.

### Errores propios
- **El primer borrador del registro tenía 15 defectos y dejaba afuera los 3 de producción de §173**, aunque `PLAN_CALIDAD_TP.md` decía que §173 se había encontrado en producción. Con eso la tasa de escapados daba 1/15: estaba sesgada a favor. Se agregaron D16–D18 antes de publicar.
- **En D05 había puesto una fecha de ejemplo que no estaba documentada** (15/10). Se cambió por la probada en `REVISION.md` (2026-10-01 → "30 de sept").
- **En Chrome, varias veces el clic cayó en la pestaña "More info"** porque el panel se desplazaba solo al cargar el código. Fue inofensivo (no cambia nada) y se resolvió verificando cada issue (archivo y línea) por la página antes de aceptarla.

### ⚠️ NO verificado
- Si las 6 issues que aceptó el usuario quedaron con "Share this comment with Sonar" tildado (no se puede ver desde la API pública).

## 205. Métricas del producto, del proceso y del proyecto (T11): `docs/calidad/METRICAS.md`

**Qué se hizo:** un solo documento con todas las métricas, interpretadas, y **cada número trazable a una ejecución**:
- **CI #15** (`80042fb`), leído con `gh run view --log`: tests 808/810/699, cobertura del backend 92,95/84,57/90,59 % (UTC; Córdoba 92,99/84,62/90,59) y del frontend 83,26/79,75/74,08/67,99 %, y la tabla del gate del TP;
- **SonarCloud**, API pública: medidas actuales del proyecto, del backend y del frontend; los 5 archivos más complejos; el historial de análisis;
- **Carga #1** (k6);
- **`gh run list`**: los 24 runs.

**Métricas elegidas:**
- **de proceso**, la tasa de éxito del pipeline (CI 86,7 %, Deploy 62,5 %) y el tiempo hasta volver a verde (5,1 min y 30,0 min en el CI); además, los defectos escapados del registro (22,2 %, sobre la selección);
- **de proyecto**, la densidad de pruebas: backend 145,5 y frontend 60,6 tests/KLOC (ncloc de SonarCloud);
- **la mejora antes/después**, la de SonarCloud: `77f4fdf` → estado actual.

`PLAN_CALIDAD_TP.md`: D3 resuelto así (la duplicación de `safeMoney` queda como deuda).

### Verificación
- Los números del documento se compararon con las salidas crudas: logs del CI #15, JSON de `gh run list`, respuestas de la API de SonarCloud (`measures/component`, `component_tree`, `search_history`, `project_analyses`). Los 5 análisis de la tabla de mejora coinciden con `search_history`.

### Errores propios
- **En el plan (§183) había estimado la densidad con líneas físicas de `git ls-files`** (106 y 55 tests/KLOC). Para el informe se usa el ncloc de SonarCloud, que no cuenta comentarios ni líneas en blanco (145,5 y 60,6). Las dos se pueden defender, pero no hay que mezclarlas.
- **El primer análisis de la historia de SonarCloud no sirve como línea de base:** 33.577 líneas, porque fue el análisis automático, que contaba los tests. Se usa el primero del CI.

### ⚠️ NO verificado
- Lo listado al final de `METRICAS.md`: qué mide la duración del deploy, el tiempo de trabajo dentro del tiempo de recuperación, la deuda como estimación de la herramienta, y las calificaciones A/A sin un análisis nuevo del CI.

## 206. Herramienta nueva (eje 8): SonarCloud con el proceso de 5 pasos, la matriz y el mapa de herramientas — `docs/calidad/HERRAMIENTA_NUEVA.md`

**Qué se hizo:**
- Los 5 pasos documentados con los hechos reales:
  1. **requisitos**;
  2. **mercado**, con 4 alternativas: SonarCloud, ESLint + jscpd + gate propio, Codacy y Qlty;
  3. **prueba de concepto** en `sonar-poc` (PR #1, runs #4 rojo / #5 verde);
  4. **matriz de decisión** con los pesos que eligió el usuario (25/15/15/15/10/10/5/5);
  5. **despliegue incremental**: PR → `main` con gate bloqueante (run #7 rojo real) → corrección y ampliación → mejora medida → triage.
- **Matriz:** SonarCloud **92**, Codacy **84**, Qlty **72**, ESLint + jscpd **65** (totales recalculados aparte).
- El **mapa de herramientas** del proyecto, por propósito.

### Verificación del paso 2 (búsquedas del 2026-10-17)
- **Codacy:** su página oficial de precios dice que el plan Team es **gratis para proyectos open source**, y fuentes de terceros mencionan gates con umbrales configurables. **No se confirmó** una acción oficial de GitHub Actions.
- **Qlty:** la documentación oficial confirma cobertura, duplicación y quality gates. Los precios para open source solo aparecen en fuentes de terceros (no verificados).
- **SonarCloud:** gates propios solo en los planes pagos (§188).

### Errores propios / honestidad
- **Codacy quedó cerca (84 contra 92)** y en el criterio de más peso empata con SonarCloud. La diferencia sale de criterios donde SonarCloud tiene una prueba real y Codacy solo documentación. Queda dicho en el documento, con una prueba de concepto de Codacy como trabajo futuro.
- **Cronología:** la elección (D5) se hizo con el borrador de la matriz, sin los datos verificados. La matriz completa se terminó después de la prueba de concepto. Queda dicho en el documento.

### ⚠️ NO verificado
- Las funciones de Codacy y de Qlty en la práctica (sin prueba de concepto).

## 207. Lo que faltaba según el enunciado: objetivos por perspectiva, documento de la integración y un comando por prueba

**Contexto:** el usuario pasó el enunciado del TP (PDF de la cátedra). Al leerlo contra lo hecho aparecieron tres faltantes, y el usuario decidió completarlos antes del informe:
1. **Eje 1 — objetivos "desde el usuario, el equipo y la organización, con las prácticas que los sostienen":** `PLAN_PRUEBAS.md §2.1` (v0.9), con 13 objetivos medibles por perspectiva, la práctica que sostiene cada uno y el valor medido. Dos quedan marcados como **no cumplidos o con reparos**: las ramas del frontend (74,1 %) y la tasa de escapados (sobre una selección).
2. **Entregable "documentación de la integración externa":** `docs/calidad/INTEGRACION_MERCADOPAGO.md`, con el contrato (sacado de `payments.js`), `applyPayment` (CAS, una sola acreditación), los tres niveles de prueba de la tabla de metas, los límites del modo prueba, la contingencia y los defectos de la integración.
3. **Entregable "todas ejecutables con un comando":** `docs/calidad/COMO_CORRER_PRUEBAS.md`, con un comando por tipo (unitarias, integración, Postgres, cobertura, scripts, smoke, E2E, stress, esfuerzo, producción) y los tres workflows.

### Verificación
- El contrato se tomó del código (`payments.js`, `donaciones.js`). La cabecera `X-Idempotency-Key` y el test "cinco a la vez → una sola acreditación" (`donaciones.test.js:261`) se verificaron con `grep`. Los conteos de tests de cada archivo de donaciones (31, 27 y 24) salen de `grep -c "test("`.

### Errores propios
- En la tabla del eje 1 había escrito "desde el Deploy #4, todos verdes", pero lo verifiqué solo hasta el #8. Quedó acotado a lo verificado.

### ⚠️ NO verificado
- Que los comandos de PowerShell y de Docker de `COMO_CORRER_PRUEBAS.md` anden tal cual en otra máquina. Se corrieron en esta sesión con Git Bash y Docker Desktop.

## 208. Informe del TP en PDF (T13): `docs/calidad/informe/INFORME_TP_CALIDAD.{html,pdf}`

**Qué se hizo:** el informe con la estructura que pide el enunciado (PDF de la cátedra):
- carátula, con marcadores para nombre, legajo y docente, por decisión del usuario;
- **nivel declarado (3)**;
- **metas cumplidas y no cumplidas**, aspecto por aspecto contra la tabla del nivel 3;
- los 8 ejes más la documentación transversal;
- **evolución de las métricas** (SonarCloud análisis por análisis, tests y cobertura, pipeline, carga);
- **análisis crítico** y **conclusiones**;
- anexo con los entregables, cómo verificar cada número y el uso de IA.

Se escribió en HTML con estilos de impresión A4 y se convirtió con Chrome headless (`--print-to-pdf`, sin instalar nada): **8 páginas, 272 KB**. El HTML queda versionado para regenerarlo.

**Metas declaradas como no cumplidas o parciales:**
- **cobertura del código existente del frontend**: 83,26 % de líneas, pero sentencias 79,75 %, ramas 74,08 % y funciones 67,99 %;
- **E2E** "cumplido con un límite": hasta la preferencia en Mercado Pago, sin el pago.

### Verificación
- Las cifras del informe salen de los documentos de `docs/calidad/`, que ya citan sus runs y análisis. Antes de generar se revisaron con `grep` y `ls` dos que estaban escritas de memoria: los archivos de integración (60, correcto) y las versiones del plan (eran **9**, no 10: corregido).
- El PDF se miró **página por página en Chrome**, servido en `127.0.0.1:8099` porque la extensión no abre archivos locales: carátula, índice, la tabla de metas en dos páginas, los ejes, la evolución, el análisis crítico y las conclusiones, sin cortes de tabla rotos.

### Errores propios
- "10 versiones" del plan: eran 9 (corregido antes de generar).
- La página 3 queda medio vacía por el salto de página forzado antes de la sección 3. Es estético y se dejó así.

### ⚠️ NO verificado
- Que la cátedra pida un formato distinto (carátula, extensión). El enunciado no fija ninguno.
- **Los datos personales de la carátula los completa el usuario.** Después de editar el HTML, se regenera con el comando de `COMO_CORRER_PRUEBAS.md` (sección "Regenerar el informe en PDF") o con Chrome → Imprimir → Guardar como PDF.

## 209. Cobertura del frontend, fase 1: test de contrato de todo `lib/api.ts` (decisión del usuario: subir la cobertura)

**Por qué:** es la única meta del nivel 3 que quedaba parcial (`INFORME_TP_CALIDAD`, §2). `lib/api.ts` tenía **61 funciones sin cubrir**: los tests de pantallas reemplazan `api` por dobles, así que **ningún test miraba lo que sale por la red**.

**Qué se hizo:** `frontend/src/lib/api.contract.test.ts`, una tabla con **85 casos** (cada método de `api`, con variantes de parámetros) más las 3 subidas multipart. Cada caso verifica `BASE` + la ruta, el método HTTP, el cuerpo JSON (con los nombres de campo que lee el backend: `horas`, `estado`, `mensaje`, `nombre`…) y el token. Las subidas mandan el `FormData` y **no fijan `Content-Type`**. Hay un test que **falla si se agrega un método a `api` sin sumarlo a la tabla**. Es la regla 10 de `AI_RULES.md` (que el frontend mande lo que el backend lee) convertida en test.

**Verificación de la regla 10 contra el backend** (script de una sola vez, en el scratchpad): se extrajeron las 89 rutas que define Express (`app.use` + `router.METHOD`) y las **81 rutas distintas que usa el frontend existen todas**.

### Verificación
- **89/89** en verde. Son de caracterización (el código ya era correcto). El rojo con sentido lo dio la mutación sobre `api.ts`, con la corrida de control en verde y el archivo CRLF restaurado byte a byte: **12 mutantes, 0 sobrevivientes**:
  - `horas`→`hours`, la ruta de horas, `PATCH`→`PUT`, `estado`→`status`, `mensaje`→`message`;
  - la subida que fija `Content-Type` (3 fallas) y `req` sin `Authorization` (84 fallas);
  - `posts.list` sin descartar vacíos, los valores por defecto del feed y de las recomendaciones, sin `encodeURIComponent`, y el CV por `POST`.
- **Cobertura del frontend** (local): sentencias **79,75 % → 81,48 %**, líneas 83,26 % → 85,39 %, funciones 68,09 % → 74,27 %, ramas 74,05 % → 74,33 %. **Sentencias ya pasa el 80 %**; funciones y ramas todavía no (fases siguientes). `typecheck` 0.

### ⚠️ NO verificado
- La cobertura en el CI (se ve después del push).
- El chequeo de rutas contra el backend es por expresión regular sobre el código. Si una ruta se definiera de otra forma (con comillas dobles o armada en tiempo de ejecución), el script no la vería. Hoy todas usan comillas simples.

## 210. Cobertura del frontend, fase 2: tests de componentes (las cuatro métricas pasan el 80 %)

**Por qué:** después de §209 seguían abajo del 80 % **funciones (74,27 %)** y **ramas (74,33 %)**. Se eligieron los archivos por lo que les faltaba cubrir (ranking sacado de `coverage-summary.json`). En los grandes se miraron en el `lcov` las funciones que **nunca se ejecutaban**, para escribir casos sobre comportamiento real y no a ciegas.

**Qué se hizo:** solo tests; **ningún archivo de producto cambió**. Cada archivo nuevo empieza con su **criterio de aceptación**, escrito antes de los casos.

**Archivos nuevos:**
- `MessagesScreen.test.tsx` (**8**). Estaba en 0 %. Cubre:
  - el vacío según el rol;
  - la foto o la inicial y el "Vos: ";
  - los no leídos con el límite 9 / 10 → "9+";
  - la ruta del hilo para cada rol.
- `CompanySidebarNav.test.tsx` (**11**). Estaba en 0 %. Cubre:
  - las rutas de los links y el resaltado en las subrutas (`/company/profilex` no resalta "Mi Empresa");
  - los no leídos 0 / 3 / 9 / 10;
  - foto o inicial, y sin usuario;
  - "Cerrar sesión", que cierra y vuelve a `/`.
- `FeedPostCard.test.tsx` (**27**). No tenía test propio. El modal de reseñas se reemplazó por un doble. Cubre:
  - los textos por defecto;
  - los montos en pesos (`$1.500 / $10.000`, `$0` si no es número) y el tope de 100 % de las barras;
  - quién sigue el proyecto, en singular y plural;
  - roles, costo y hasta 3 comentarios con "Participó";
  - comentar: sin sesión, éxito, vacío y error;
  - inscribirse: sin sesión, ONG, éxito con `onRefresh`, error y ya inscripto;
  - seguir y dejar de seguir con los seguidores del servidor;
  - el nuevo promedio al calificar.
- `MyParticipation.test.tsx` (**13**). Cubre:
  - sin sesión;
  - las redirecciones de la ONG y de la empresa;
  - las cantidades y el filtrado;
  - el vacío de cada filtro;
  - una carga que falla;
  - el estado desconocido, que se ve como "Rechazado";
  - horas en singular y plural;
  - cancelar: sin confirmar, confirmado y con error.

**Archivos ampliados:**
- `ExploreScreen.test.tsx` (**+9**, en CRLF). Cubre:
  - la cruz del buscador;
  - aplicar los cuatro filtros desde el modal: las pastillas, el contador, "Para vos" que se esconde y la lista filtrada;
  - cada cruz, "Limpiar todo", y la cruz y "Limpiar filtros" del modal;
  - "Ver todos"/"Ver menos" de "Para vos" con más de 4 y hasta 3 etiquetas;
  - "Ver todos"/"Ver carrusel";
  - las flechas, con medidas simuladas porque jsdom no tiene layout: desplazan el mínimo de 260 px.
- `NGOKPIs.test.tsx` (**+11**, en CRLF; `useNavigate` pasó a un doble compartido para poder verificar "Volver"). Cubre:
  - el alta con el cuerpo normalizado (sin espacios de más, el valor como número, los vacíos como `undefined`) y la recarga;
  - nombre obligatorio y error del alta;
  - la etiqueta del tipo booleano y la cruz del formulario;
  - borrar: sin confirmar, confirmado y con error;
  - "Volver";
  - el título que no carga.

### Verificación
- Frontend: **867/867** tests, 80 archivos, salida 0. `typecheck` 0 errores, salida 0. `npm audit` 0.
- **Cobertura** (local, `vitest run --coverage`):

| Métrica | Antes de §209 | Después de §209 | Ahora |
|---|---|---|---|
| Sentencias | 79,75 % | 81,48 % | **85,87 %** (3071/3576) |
| Ramas | 74,05 % | 74,33 % | **80,42 %** (2548/3168) |
| Funciones | 68,09 % | 74,27 % | **81,75 %** (820/1003) |
| Líneas | 83,26 % | 85,39 % | **89,70 %** (2579/2875) |

- **Mutación** sobre los seis componentes (script del scratchpad; corrida de control en verde por archivo; cada archivo se restaura byte a byte; ningún `.tsx` de producto queda modificado en `git status`).
  - **25 mutantes**. En la primera corrida **sobrevivieron 2**, y **ninguno era equivalente**:
    - "9+ desde 11" en Mensajes: el test probaba 3 y 12, no el límite;
    - "dejar de seguir resta 1 localmente" en la tarjeta: el servidor del test devolvía justo 3 − 1.
  - Se agregó el caso del límite y el servidor pasó a devolver 0. Segunda corrida: **0 de 25**.

### Errores propios
- **§209 no actualizó el número de tests del frontend en `CLAUDE.md`** (quedó en 699 cuando ya eran 788). Se corrige acá con el número actual.
- Un caso de "Para vos" falló en la primera corrida: el botón "Ver todos" solo aparece con **más de 4** recomendaciones y yo había puesto 1. Se corrigió el caso, no el componente.

### ⚠️ NO verificado
- **La cobertura en el CI** (se ve después del push). El margen en ramas es chico: **13 ramas** sobre el 80 %.
- **El umbral bloqueante sigue siendo solo de líneas** (decisión del §186). Subir sentencias, ramas y funciones a bloqueantes es decisión del usuario.
- `ProjectCard.tsx` (36 ramas sin cubrir) **no se importa en ninguna pantalla**, solo en su propio test: es código muerto. **No se borró:** necesita el OK del usuario (reglas 5 y 16).
- Nada visual: estos tests miran el DOM, no cómo se ve.

## 211. Borrar `ProjectCard.tsx`, código muerto (con OK del usuario)

**Por qué:** §210 encontró que **ninguna pantalla lo importa**, solo su propio test.
- `git log -S "import { ProjectCard }"` muestra que el último import se quitó en `f58b72d`, cuando el feed vertical pasó a `FeedPostCard`.
- Tenía su propia copia de `safeMoney`, la deuda de duplicación vista en §172.
- Sumaba 36 ramas sin cubrir al total del frontend.

**Qué se hizo:**
- `git rm` de `ProjectCard.tsx` y `ProjectCard.test.tsx` (3 tests);
- en `FRONTEND_CONTEXT.md`, la entrada queda tachada con el motivo.

### Verificación
- `grep` de `ProjectCard` en `frontend/src`: sin referencias fuera de esos dos archivos, antes de borrar.
- Frontend: **864/864** tests (867 − 3), 79 archivos. `typecheck` 0 errores. `vite build` OK.
- Cobertura local:
  - sentencias 85,87 → **86,36 %**;
  - ramas 80,42 → **81,14 %**;
  - funciones 81,75 → **82,21 %**;
  - líneas 89,70 → **90,11 %**.

### ⚠️ NO verificado
- Nada visual. No hay nada que ver: el componente no se mostraba en ninguna pantalla.

## 212. Umbral bloqueante del 80 % en las cuatro métricas de cobertura del frontend (decisión del usuario)

**Qué se hizo:** en `frontend/vite.config.ts` el umbral pasa de `{ lines: 80 }` (§186) a `{ lines: 80, statements: 80, branches: 80, functions: 80 }`. El job del frontend del CI corre `npm run test:coverage`, así que el pipeline **falla si cualquiera de las cuatro baja del 80 %**.

### Verificación
- `npm run test:coverage` con los umbrales nuevos: 864/864, **salida 0**.
- **Rojo del umbral:** misma corrida con `--coverage.thresholds.branches=82` → **salida 1**, con `ERROR: Coverage for branches (81.14%) does not meet global threshold (82%)`. El umbral bloquea de verdad.

### ⚠️ NO verificado
- La corrida en el CI (después del push).
- **El margen es chico:** ramas 81,14 % es **~35 ramas** sobre el mínimo. Código nuevo del frontend sin tests puede romper el pipeline. Es el efecto buscado, pero hay que tenerlo en cuenta cerca de la defensa.
- `METRICAS.md`, `PLAN_PRUEBAS.md` (O3) y el informe todavía dicen "solo líneas". Se actualizan con el número del run del CI que lo confirme.

## 213. Docs del TP con los números del CI #19: la cobertura del frontend pasa a "Cumplida"

**Fuente:** **CI #19** (run `39089747158`, commit `df529c3`), los 9 jobs en verde, y **Deploy #12** en verde (smoke + E2E).
- **Backend:** 808/808 en SQLite y 810/810 en Postgres, en UTC y en Córdoba, 0 cancelled.
- **Frontend:** 864/864.
- **Cobertura del frontend:** sacada del artefacto `frontend-tests-0/1` (`coverage-summary.json`, las dos zonas horarias iguales):
  - sentencias **86,36 %** (3053/3535);
  - ramas **81,18 %** (2515/3098);
  - funciones **82,11 %** (817/995);
  - líneas **90,11 %** (2563/2844).
- **Gate del TP:** pasa (duplicación 1,9 %, cobertura de código nuevo 91,1 %, 0 bugs y 0 vulnerabilidades críticas).
- **ncloc del frontend en SonarCloud** (API, `frontend/src`): **11.386**.

**Qué se actualizó:**
- `METRICAS.md`: la fila de cobertura del frontend y una fila nueva de densidad, 864 / 11,386 = **75,9 tests/KLOC**.
- `PLAN_PRUEBAS.md` (O3): umbral en las cuatro métricas y los valores del CI #19.
- `FRONTEND_CONTEXT.md` (punto 8).
- El informe:
  - "En números";
  - la meta "Cobertura del código existente": de **Parcial** a **Cumplida**;
  - una fila del CI #19 en la evolución;
  - el análisis crítico ("el frontend era la deuda") y las conclusiones ("se cumplen todas las metas del nivel 3").
- **PDF regenerado**: ahora tiene **9 páginas**.

### Verificación
- Cada edición la hizo un script que corta si el texto original no aparece exactamente una vez.
- El PDF se miró en Chrome (servido en `127.0.0.1:8099`):
  - la fila de metas se ve completa, en verde "Cumplida";
  - la página 9 nueva es el anexo completo, no una hoja casi vacía.

### Errores propios
- La espera del CI en segundo plano buscaba el run con el **SHA corto** (`--commit df529c3`). `gh` no lo encuentra así y la espera no terminaba nunca: el run ya había terminado en verde. Se detectó listando los runs sin filtro.
- **Local y CI difieren en una unidad** (local: ramas 2514 y funciones 818; CI: 2515 y 817), igual que en el Run #2. Los documentos usan los números del CI.

### ⚠️ NO verificado
- El resto del PDF no se miró página por página de nuevo, solo las páginas 3 y 9. El contenido de las otras no cambió, pero se corrió una página.
- El anexo y la fila "Pipeline" siguen citando el CI #15 como "run en verde". Sigue siendo cierto, y ahora el CI #19 también lo es.

## 214. Carátula del informe con los dos integrantes

**Qué se hizo:**
- **Carátula:** el usuario completó los datos. Son **dos integrantes** y la plantilla preveía uno, así que la carátula pasa a una fila por integrante con su legajo al lado, y el nombre del docente en mayúsculas y minúsculas.
- **Uso de IA (7.3):** "las tomó el alumno" pasa a "las tomó el equipo".
- **Nota al pie de la carátula:** decía que el último cambio de código era `80042fb` (CI #15) y que lo posterior era solo documentación. Desde §209 eso ya no era cierto. Ahora dice `df529c3` (CI #19).
- **PDF regenerado:** 9 páginas.

### Verificación
- Captura de la carátula con Chrome headless: los dos integrantes con sus legajos, el docente, el nivel, la fecha y el repositorio.
- `git log df529c3..HEAD --stat`: después de ese commit solo cambiaron archivos de `docs/`.

### Errores propios
- **La nota del último cambio de código quedó vieja en §213.** Se actualizaron los números, pero no esa frase. Se encontró al mirar la carátula.

### ⚠️ NO verificado
- El orden de los integrantes y el formato de la carátula: el enunciado no fija ninguno.
