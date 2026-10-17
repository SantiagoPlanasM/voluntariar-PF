# PLAN_CALIDAD_TP.md — TP Integrador de Calidad de Software sobre VoluntariAR (2026-10-17)

> Plan para cumplir el TP (presentación **26/10/2026**). No reemplaza a `PLAN_FALTANTE.md` (producto) ni a
> `PROJECT_ANALYSIS.md` (registro de lo hecho). Fuentes leídas: `CLAUDE.md`, `AI_RULES.md`, `PROJECT_CONTEXT.md`,
> `PLAN_FALTANTE.md` (§0, §1, §4, §6), `GUION_DEFENSA.md`, los `package.json`, `render.yaml`, los títulos y los
> bloques "NO verificado" de `PROJECT_ANALYSIS.md` (desde §161) y las tablas de hallazgos de `REVISION.md`.

## 0. Decisiones (2026-10-17)

| Pregunta | Respuesta |
|---|---|
| Nivel a declarar | **Nivel 3** (yo recomendaba el 2; ver §7, riesgos R1 y R2) |
| Registro de defectos | **GitHub Issues** (no hay `gh` instalado: los cargás en la web o lo instalás vos) |
| CI | **GitHub Actions** — `github.com/SantiagoPlanasM/voluntariar-PF` es **público** (API de GitHub, `visibility: public`); `main` = `origin/main` = `950e558` |
| Integración externa | **Mercado Pago** (modo prueba) |
| Herramientas impuestas | Ninguna |
| Informe PDF | **Aparte** del documento del IPI |

**Ajustes del usuario al aprobar el plan (2026-10-17):** (1) T3 arranca hoy, con T1 en paralelo; (2) D5 la decide el
usuario: acá queda solo el borrador de la matriz (§5), sin elegir; (3) la métrica de proyecto sale del pipeline o de
git, no del avance del plan (T11); (4) **el run fallido real no se borra ni se reescribe**: se corrige en un commit
posterior y los dos runs quedan en el historial.

**Decisiones abiertas (te las pregunto en la etapa correspondiente):**
- **D1 — E2E de Mercado Pago en cada deploy** (lo exige el nivel 3). Propuesta: una cuenta voluntaria dedicada
  (`ci-e2e@…`, creada una sola vez a mano) hace login → `POST /api/donaciones` de $100 → verifica que vuelve el link
  de checkout de Mercado Pago y que responde → `GET /api/donaciones/:id` (conciliación, consulta a MP) da `pendiente`.
  **No paga** (pagar exige loguearse con el comprador de prueba en la página de MP; automatizar eso no es confiable).
  Deja **una donación `pendiente` por deploy** en la base de prod (no suma a `recaudado`, §170). Es distinto del
  smoke y el stress, que **no** tocan MP. Necesita tu OK.
- **D2 — Instalar devDependencies** (regla 18): cobertura del frontend, lint, duplicación, stress. Una por una, con OK.
- **D3 — Mejora medida antes/después** (eje 4): candidato real, la función de plata duplicada (`safeMoney` en
  `ProjectDetails` y copias en `ProjectCard`, `FeedPostCard`, `PublicFeed`; deuda vista en §172). Regla 16: necesita OK.
- **D4 — `/health` con el commit desplegado** (para que el pipeline sepa cuándo terminó el deploy). Cambio chico de
  backend con test (lee `RENDER_GIT_COMMIT`, que Render define; **NO verificado** en este servicio).
- **D5 — La herramienta nueva** (eje 8): la elegís vos con la matriz de §5. **Decidido (2026-10-17): SonarCloud.**
  Como el plan gratis solo tiene el gate "Sonar way" (no permite gates propios), el gate del TP (bugs críticos,
  duplicación > 5 %, cobertura de código nuevo < 80 %) lo evalúa un paso del workflow con las métricas del análisis.
  k6 se usa para el stress, dentro del mapa de herramientas.

## 1. Línea base real (corrida hoy, 2026-10-17, sobre `950e558`, Node v24.21.0, Windows)

| Chequeo | Comando | Resultado |
|---|---|---|
| Backend SQLite | `node --test --experimental-test-coverage` (en `backend/`) | **782 tests, 782 pass**, 0 fail, 0 cancelled, 0 skipped, 170 suites, salida 0 |
| Cobertura backend (`src/` + `scripts/`, sin tests) | ídem (reporter de Node) | **líneas 92,94 % · ramas 84,20 % · funciones 90,54 %** |
| Frontend | `vitest run` | **694 tests, 694 pass**, 75 archivos, salida 0 |

**Ojo: 782 incluye `test/integration/helpers.js`**, que `node --test` ejecuta por el patrón por defecto
`**/test/**/*.js` y cuenta como un test que pasa sin definir ninguno (TAP: `ok 25 - test\integration\helpers.js`).
Pasando solo los `*.test.js` (y desde un directorio sin `.env`, como en el CI) dan **781/781**. Los tests reales son 781.

Flag verificado en esta versión con `node --help`: `--experimental-test-coverage`, con umbrales
`--test-coverage-lines/branches/functions` e `--test-coverage-include/exclude`. Para Sonar u otros, el reporter
`lcov` del test runner (a confirmar en Node 22 del CI).

Puntos bajos de cobertura (para el informe): `src/db/index.js` **64,29 %** de líneas (la rama Postgres no corre en
SQLite: se cubre con `test:pg`), `routes/empresas.js` 82,27 % (ramas 59,68 %), `routes/follows.js` 84,38 %
(ramas 64,63 %), `routes/ngos.js` ramas 62,5 %, `scripts/migrate.js` ramas 56,52 %.

**No corrido hoy:** `npm run test:pg` (Docker está prendido pero no hay contenedor de Postgres y en este paso no
levanto nada), la suite con `TZ=America/Argentina/Cordoba`, `npm run typecheck`, `npm audit`. Los 784 de Postgres
son el número de `CLAUDE.md`, no una corrida mía.

**Herramientas propuestas (no instaladas):**
- Cobertura frontend: `@vitest/coverage-v8` en la **misma versión exacta que `vitest` 5.0.x** (no hay ningún
  proveedor en `node_modules/@vitest`: solo `mocker` y `spy`).
- Lint: ESLint 9 (config plana) — backend con `@eslint/js`; frontend con `typescript-eslint` y
  `eslint-plugin-react-hooks`. Alternativa de un solo binario: Biome.
- Duplicación: `jscpd` (`--threshold 5` hace fallar el comando arriba del 5 %), o SonarCloud.
- Stress: k6 (binario; en CI con la acción oficial) o `autocannon` (npm).

## 2. Brecha: requisito del TP → qué hay → qué falta

| Eje / requisito | Existe (visto en el repo) | Falta |
|---|---|---|
| 1. Objetivos de calidad medibles | Números de tests en `CLAUDE.md`; `PLAN_FALTANTE.md §1` | Objetivos con métrica, meta y fuente (el pipeline) |
| 1. Contingencia ante caída de dependencia | Comportamiento degradado en código: sin `MP_ACCESS_TOKEN` donar da 503, sin Cloudinary publicar da 503, sin `RESEND_API_KEY` no se mandan mails (comentarios de `render.yaml`); Plan B en `GUION_DEFENSA.md §6` | Documento formal: dependencia, detección, impacto, respuesta, vuelta atrás (MP, Cloudinary, Resend, Render/Postgres) |
| 2. Unitarias AAA | 14 archivos en `backend/test/unit/`, 75 de frontend | Marcar/escribir los casos de §4 explícitamente en AAA |
| 2. Criterio de aceptación previo | Implícito en las secciones de `PROJECT_ANALYSIS` | Escribir el criterio **antes** del test en los casos nuevos |
| 2. Defecto real rojo/verde | Fix de A6 `5ae86d6`, fix de B7 `da8ac95` (ver §6) | Reproducir el rojo con el test sobre el commit padre y documentarlo |
| 2. 7 principios del testing | — | Cada principio con un ejemplo del proyecto |
| 3. Matriz ISO 25010 (8) + top 3 + mapa de niveles | Evidencia dispersa (accesibilidad §79–§81, seguridad §86/§94/§103, fiabilidad §39/§77/§85, compatibilidad SQLite/PG) | La matriz, el top 3 justificado y el mapa unitario/integración/sistema/aceptación |
| 4. Análisis estático | `npm run typecheck` (TS 7, 0 errores según docs). **No hay linter** (`PROJECT_CONTEXT.md §4`) | Linter + duplicación en el pipeline |
| 4. Métricas interpretadas, de proceso y de proyecto, mejora antes/después | Cobertura de hoy (§1); historial de commits (161) | Tabla de métricas desde el pipeline; mejora D3 |
| 5. Clases de equivalencia, límites, tablas de decisión | Casos reales ya probados: monto de donación $100–$500.000 enteros (`donaciones.test.js:154-172`), contraseña ≤ 72 bytes (§141), acceso al CV (C1) | Documento de diseño de casos + cobertura de sentencia y decisión de las funciones elegidas |
| 6. Plan de pruebas versionado, riesgos P×I, QA vs QC, plantillas | — | `docs/calidad/PLAN_PRUEBAS.md` con criterios de entrada/salida y plantillas |
| 6. Trazabilidad requisito → caso → defecto | Tests que citan su defecto (`faqs.test.js` → B1, `habilidades.test.js` → B6, `sponsorship-proposal.test.js` → A6, `cv.test.js:291` → §168…) | Matriz explícita con ids de Issues |
| 7. Pirámide de automatización | Unit + integración HTTP (supertest-like con `node:test`), sin E2E de UI | Documentar la pirámide con los números reales |
| 7. Pruebas de API | 60 archivos en `backend/test/integration/` | — (mapear) |
| 7. Integración externa (nivel 3: E2E en cada deploy) | Contrato + dobles: `test/unit/payments.test.js`, `donaciones*.test.js`; 3 verificaciones manuales en prod (§173–§176) | Job E2E post-deploy (D1) + doc de la integración |
| 7. Smoke en cada despliegue (por pipeline) | `/health` (`backend/src/index.js:36`); despertar a mano en `GUION_DEFENSA.md §2` | Script de smoke de solo lectura + workflow con deploy hook |
| 7. CI/CD | **No existe `.github/`** | `ci.yml` y `deploy.yml` |
| 7. Regresión por cada defecto corregido | Mayoría ya existe (ver §6) | Verificar 1 a 1 en la matriz |
| 8. Mapa de herramientas | `node:test`, vitest, Testing Library, TypeScript, Docker para PG, mutación casera | Documento del mapa |
| 8. Herramienta nueva con 5 pasos | — | Elegirla (D5) y documentarla |
| 8. Registro de defectos | Defectos documentados en `REVISION.md` y `PROJECT_ANALYSIS.md` | Cargarlos como Issues con plantilla |
| 8. Stress y esfuerzo sostenido | Limitadores en memoria: registro/login (`routes/auth.js:20-26`), foto, borrar cuenta, donaciones (`donaciones.js:53`), posts, CV | Scripts, umbrales previos y reporte |
| Gate: bugs críticos, duplicación > 5 %, cobertura de código nuevo < 80 % | — | Gate en el pipeline |
| Cobertura del existente ≥ 80 % (nivel 3) | Backend 92,94 % líneas | **Frontend sin medir** (R1) |
| Informe PDF, demo con despliegue nuevo | Guion de defensa (otro propósito) | Informe con los números del pipeline |

## 3. Plan día por día (hasta el 26/10)

Esfuerzo: **S** ≤ media sesión · **M** una sesión · **L** varias. "Yo" = lo hago en el repo; "vos" = cuentas,
paneles, secretos, Issues en la web.

| Día | Tarea | Esf. | Riesgo | Depende de | Cómo se verifica |
|---|---|---|---|---|---|
| **Sáb 17/10** | T0. Este plan + línea base | S | — | — | §1 con salidas reales |
| **Dom 18/10** | T1. `docs/calidad/PLAN_PRUEBAS.md`: objetivos medibles, contingencia (eje 1), riesgos P×I, QA vs QC, criterios de entrada/salida, plantillas de caso y defecto, matriz ISO 25010 con evidencia, top 3, mapa de niveles, pirámide, 7 principios | M | bajo | T0 | Cada fila de la matriz cita archivo/test/§; versionado en git |
| Dom 18/10 | T2 (vos). Crear labels y plantillas de Issue; decidir D2 y D5 | S | bajo | T1 (plantilla) | Issue de prueba creado con la plantilla |
| **Lun 19/10** | T3. `ci.yml`: backend SQLite + Postgres (service container) + `TZ=America/Argentina/Cordoba`, cobertura con umbral y `lcov`, frontend tests + typecheck + build, `npm audit`, artefactos de reporte. Node 22 (el de Render) | M | medio (primer run en Linux; `better-sqlite3` con `ignore-scripts`) | T0 | Run completo en verde en GitHub; los números coinciden con local |
| Lun 19/10 | T4. Cobertura del frontend (D2) y su número real | S | **alto** (R1) | T3, D2 | Reporte del pipeline; si < 80 %, se suma T4b |
| **Mar 20/10** | T5. Lint + duplicación + quality gate (bugs críticos, dup > 5 %, cobertura de código nuevo < 80 %) en el pipeline | M | medio (R3: hallazgos reales en el primer run) | T3, D2/D5 | El primer run del gate se documenta tal cual: si falla por hallazgos genuinos, ese es el **run fallido real** |
| Mar 20/10 | T4b (si hace falta). Tests de frontend para llegar al 80 % | L | alto | T4 | Cobertura del pipeline ≥ 80 % |
| **Mié 21/10** | T6. Diseño de casos (eje 5): clases de equivalencia y valores límite (monto de donación, contraseña 72 bytes, `limit` con `clampInt`, cupos), tabla de decisión (acceso al CV, C1), unitarias AAA con criterio previo, cobertura de sentencia y decisión de esas funciones | M | bajo | T3 | Tests nuevos verdes; cobertura por función desde el reporte |
| Mié 21/10 | T7. Rojo/verde de un defecto real (§6) | S | bajo | — | Salida del test en el commit padre (rojo) y en el fix (verde), en un worktree aparte |
| **Jue 22/10** | T8 (vos). Deploy hooks de los dos servicios + secretos en GitHub (`RENDER_DEPLOY_HOOK_API`, `RENDER_DEPLOY_HOOK_WEB`, credenciales de la cuenta E2E) | S | bajo | D1 | Los secretos aparecen en Settings → Secrets |
| Jue 22/10 | T9. `/health` con el commit (D4, test primero), smoke de solo lectura (`/health` con reintentos para despertar, `/api/projects?limit=5`, `/api/stats`, la portada del sitio), `deploy.yml` (deploy hook → esperar el commit nuevo en `/health` → smoke → E2E de MP) | M | **medio-alto** (R4, R5) | T3, T8 | Run de deploy en verde con el smoke y el E2E; auto-deploy sigue apagado |
| **Vie 23/10** | T10. Stress y esfuerzo sostenido: umbrales escritos **antes** (p95, % de errores), corrida en el runner contra un backend local efímero y una corrida acotada contra Render, solo `GET` (sin login, registro, donaciones ni subidas), reporte como artefacto | M | medio (R6) | T3, D2/D5 | Reporte generado por el pipeline con los umbrales y el veredicto |
| Vie 23/10 | T11. Métricas: tabla interpretada (cobertura, duplicación, complejidad/lint, tests), métrica de proceso (**tasa de defectos escapados**: Issues con `encontrado:prod` / total de defectos; §168 y §173 los encontró el usuario en prod) y de proyecto (**densidad de pruebas**: tests por KLOC de código productivo, calculada por el pipeline con el conteo del TAP/junit y `git ls-files`; ver §5.1); mejora antes/después (D3) | M | bajo | T5, D3 | Antes y después salen de dos runs del pipeline |
| **Sáb 24/10** | T12. Registro de defectos: cargar en Issues los de §6 + el del run fallido; matriz requisito → caso → defecto con los números de Issue | M | bajo | T2, T7, T5 | Cada Issue enlaza su test de regresión y su commit |
| Sáb 24/10 | T13. Documento de la herramienta nueva (5 pasos + matriz) y de la integración con MP; informe PDF con los números del último run | M | medio | D5, T3–T12 | Cada número del PDF tiene el link al run de donde sale |
| **Dom 25/10** | **Colchón + ensayo de la demo**: despliegue nuevo por el pipeline con smoke, E2E y una carga; repetir lo que haya fallado | — | — | todo | Run completo en verde ese día |
| **Lun 26/10** | Presentación | | | | |

Cada tarea de código sigue `CLAUDE.md`: tests primero, SQLite + Postgres + TZ, sección nueva en
`PROJECT_ANALYSIS.md` con errores propios y "NO verificado", un commit por tarea, sin `Co-Authored-By`.

## 4. Casos para el eje 5 (reales, ya en el código)

| Caso | Técnica | Dónde está hoy |
|---|---|---|
| Monto de donación: enteros de 100 a 500.000 | Clases (no entero, < 100, en rango, > 500.000) y límites 99/100/500.000/500.001 | `donaciones.test.js:154-172` |
| Contraseña hasta 72 bytes (bcrypt) | Límites 72/73 bytes, multibyte | §141, `register-password-max.test.js` |
| `limit` de listados (`clampInt`) | Clases: ausente, negativo, 0, en rango, sobre el tope, texto | §96, §149 |
| Acceso al CV de un voluntario | Tabla de decisión: rol × dueño del proyecto × estado de la inscripción (`pending`/`approved`/otra) × hay CV | C1 (§165), `cv.test.js` |
| Cupos (`cupos_ocupados <= cupos`) | Límites cupo − 1 / cupo / cupo + 1 y concurrencia | §39–§40, `enrollments-capacity.test.js`, `enrollments-concurrency.test.js` |

## 5. Herramienta nueva: borrador de la matriz de decisión (D5, la decidís vos)

Los 5 pasos: **requisitos** → **mercado** (≥ 3 alternativas por eje) → **prueba de concepto** en una rama →
**matriz de decisión** → **despliegue incremental** (primero informativo, después bloqueante).

**Requisitos (paso 1, borrador):** corre en GitHub Actions; deja un reporte automático por run; es gratis para un repo
público; no agrega dependencias de producción (regla 18: binario, servicio externo o devDependency); se puede
explicar en la defensa; se puede usar en 9 días.

**Mercado (paso 2).** Los datos de "Hecho" los saqué de lo que sé, **no los verifiqué hoy en las páginas oficiales**:
se confirman en el paso 2 antes de puntuar.

*Eje A — análisis estático, duplicación, cobertura de código nuevo y quality gate*

| Candidato | Qué cubre | Cómo corre | Costo / licencia | A verificar en el paso 2 |
|---|---|---|---|---|
| **SonarCloud** (SonarQube Cloud) | Bugs, code smells, duplicación, cobertura de código nuevo, gate, reporte web | Servicio externo + acción de GitHub; lee el `lcov` | Gratis en repos públicos (servicio, no OSS) | Si el plan gratis permite un gate propio (dup > 5 %, en vez del "Sonar way"); cómo define "código nuevo" |
| **ESLint + jscpd + gate propio en el workflow** | Lint (bugs), duplicación con `--threshold`; cobertura de código nuevo con un script sobre el `lcov` y el `git diff` | Todo dentro del runner, devDependencies | MIT, gratis | Cuánto script propio hace falta para la cobertura de código nuevo (es lo más caro de armar) |
| **Codacy** | Análisis estático, duplicación, cobertura, gate | Servicio externo | Gratis para open source (según lo que sé) | Límites del plan gratis; soporte de TS 7 |
| **Qlty / DeepSource** (otra alternativa) | Análisis estático y métricas; gate | Servicio externo / CLI | Plan gratis para OSS (según lo que sé) | Si miden duplicación y cobertura de código nuevo |

*Eje B — stress y esfuerzo sostenido*

| Candidato | Qué cubre | Cómo corre | Costo / licencia | A verificar en el paso 2 |
|---|---|---|---|---|
| **k6** | Escenarios en JS, rampas, umbrales (`thresholds`) que hacen fallar el run, resumen exportable | Binario; acción oficial en GitHub Actions | AGPL-3.0, gratis | La versión y la acción vigentes; el formato del reporte para el artefacto |
| **Artillery** | Escenarios en YAML, fases, reporte | npm (devDependency) o `npx` (no: memoria "nunca npx") | MPL-2.0, gratis | Peso de la instalación; umbrales que fallen el run |
| **autocannon** | Carga HTTP simple, muy liviano | npm (devDependency) | MIT, gratis | Que permita un esfuerzo sostenido largo y umbrales (seguramente con script propio) |
| **Apache JMeter** | Planes de prueba completos, reporte HTML | Java en el runner | Apache-2.0, gratis | Tiempo de armado del plan `.jmx` en 9 días |

**Criterios de la matriz (paso 4)**: pesos y puntajes en blanco, los ponés vos. Escala sugerida 1–5.

| Criterio | Peso | SonarCloud | ESLint+jscpd+gate | Codacy | Qlty/DeepSource |
|---|---|---|---|---|---|
| Cubre los 3 umbrales del gate del TP | | | | | |
| Reporte automático por run | | | | | |
| Integración con GitHub Actions | | | | | |
| Costo | | | | | |
| Impacto en dependencias (regla 18) | | | | | |
| Curva de aprendizaje en 9 días | | | | | |
| Madurez / comunidad | | | | | |
| Qué tan fácil se explica en la defensa | | | | | |
| **Total ponderado** | | | | | |

La misma tabla, con las columnas k6 / Artillery / autocannon / JMeter, para el eje B; criterio extra: "umbrales que
hacen fallar el run sin código propio".

**Restricción para los dos ejes:** "la herramienta nueva" es **una** con el proceso de 5 pasos; las demás herramientas
que se usen igual entran en el mapa de herramientas (eje 8), sin el proceso completo.

### 5.1 Métrica de proyecto propuesta: densidad de pruebas

**Tests por KLOC de código productivo**, calculada por el pipeline en cada run: tests del TAP (backend) y del junit
(frontend) dividido las líneas de `git ls-files` del código productivo. Se ve su evolución run a run y se interpreta
junto con la cobertura (más tests sin más cobertura = tests redundantes).

Valor de hoy, para referencia (líneas físicas, con comentarios y líneas en blanco; **no** lo calculó el pipeline):
backend `src/` + `scripts/` = 7.355 líneas → 781 / 7,355 ≈ **106 tests/KLOC**; frontend `src/` sin tests = 12.525
líneas → 694 / 12,525 ≈ **55 tests/KLOC**.

Alternativa si preferís otra: **churn** (líneas agregadas + borradas por semana, de `git log --numstat`), que mide la
estabilidad del código y se cruza con dónde aparecen los defectos.

## 6. Defectos ya documentados que se reutilizan

| Id | Defecto | Sección | Test de regresión | Rojo/verde |
|---|---|---|---|---|
| B1 | FAQs: 500 siempre en Postgres (`activo=1` sobre BOOLEAN) | §51 | `faqs.test.js` | Solo en Postgres |
| B2 | Listado sin roles ni requisitos en Postgres | §52 | `projects-list-shape.test.js` | Solo en Postgres |
| B6 | Habilidades repetidas borran las del voluntario | §58 | `habilidades.test.js` | SQLite |
| **B7** | Filtro de palabras por subcadena rechaza "computadora" | §93 | `unit/badWords.test.js`, `comments-badwords.test.js` | **Candidato principal** (fix `da8ac95`; reproducible en SQLite, unitario) |
| **A6** | Dos propuestas de patrocinio simultáneas → 500 en Postgres | §140 | `sponsorship-proposal.test.js` | Alternativa (fix `5ae86d6`; necesita Postgres y concurrencia) |
| F2 | Fechas de KPI un día antes (zona horaria) | §63 | `NGOKPIs.test.tsx` | Frontend |
| §168 | "Ver CV" sin CV (**encontrado por el usuario en prod**) | §167–§168 | `cv.test.js:291`, `NGOProjectDetailCv.test.tsx` | Defecto escapado (métrica de proceso) |
| §150 | Tests de transacción flaky bajo carga en Postgres | §150 | `db-transaction.test.js` | Defecto del propio test |

**Ojo con los ids:** `api.test.js:132-151` usa "BUG B1/B2" para defectos **viejos** (mensaje de inscripción,
categoría de la ONG) que no son los B1/B2 de `REVISION.md`. En la trazabilidad se renombran con el id del Issue.
No encontré con `git log --grep` los commits de §51 y §58: se buscan por archivo al cargar el Issue.

## 7. ⚠️ No verificado y riesgos

| # | Riesgo | P × I | Respuesta |
|---|---|---|---|
| R1 | **Cobertura del frontend < 80 %** (nivel 3): no está medida | media × alta | Medir el 19/10; si no llega, T4b (L) o declarar ese criterio en nivel 2 con el número real |
| R2 | **E2E de MP en cada deploy** (nivel 3) choca con el modo prueba: no se puede pagar sin el login del comprador | alta × media | E2E hasta la preferencia y la conciliación (D1); el pago completo queda verificado a mano (§173–§174) |
| R3 | El primer run del gate falla por hallazgos reales del lint/duplicación | alta × baja | Es lo esperado: se documenta como el run fallido, no se arma uno a propósito |
| R4 | Render gratis duerme (15 min) y tarda ~1 min en despertar | alta × media | Smoke y stress empiezan con `/health` con reintentos y tiempo máximo |
| R5 | Deploy hook sin forma de saber cuándo terminó | media × media | `/health` con el commit (D4); `RENDER_GIT_COMMIT` **NO verificado** |
| R6 | Stress contra Render gratis (0,1 CPU) degrada o tira el servicio cerca de la defensa | media × alta | Solo `GET`, carga acotada, nunca después del 25/10; el stress fuerte va contra el backend local del runner |
| R7 | Limitadores devuelven 429 | baja (solo `GET`) × media | Ningún script de carga usa login, registro, donaciones ni subidas |
| R8 | La base de Render vence el **14/11/2026** | — | Fuera del plazo del TP; no crear datos de más |
| R9 | `test:pg` en CI con Postgres 16 como servicio: no probado | media × media | Primer run del 19/10 |
| R10 | Sin `gh`: cargar Issues y ver runs es manual | alta × baja | Lo hacés en la web o instalás `gh` vos |
| R11 | Versiones: Node 24 local vs 22 en Render/CI | baja × media | CI en Node 22 |

**No verificado hoy:** `test:pg` (784), la suite con TZ de Córdoba, `typecheck` y `npm audit`; si el plan gratis de
SonarCloud permite gates propios; que Render exponga `RENDER_GIT_COMMIT`; que el reporter `lcov` del test runner
esté en Node 22.


## 8. Resumen y por dónde empezar

1. Backend: 782/782 tests (SQLite), cobertura 92,94 % líneas / 84,20 % ramas / 90,54 % funciones, medida hoy.
2. Frontend: 694/694 tests; cobertura sin medir (no hay proveedor instalado).
3. No existe `.github/`, ni linter, ni duplicación medida, ni smoke, ni stress, ni plan de pruebas.
4. El repo es público en GitHub: Actions y SonarCloud son gratis.
5. Nivel 3 elegido: lo más incierto es el 80 % del frontend y el E2E de MP en cada deploy.
6. El E2E de MP llega hasta la preferencia y la conciliación (sin pagar), con una cuenta dedicada (D1).
7. Smoke y stress: solo `GET`, despiertan la API primero, nunca llaman a MP ni a Cloudinary.
8. Defectos reales reutilizados: B1, B2, B6, B7, A6, F2, §168, §150; rojo/verde con B7.
9. El run fallido del CI será el que salga genuinamente del primer gate.
10. Colchón y ensayo: domingo 25/10.

**Etapa recomendada para empezar: T3 (`ci.yml`)** — el pipeline es la fuente de todos los números del informe, y
medir la cobertura del frontend (R1) el lunes define si el nivel 3 es viable a tiempo. T1 (plan de pruebas) puede ir
en paralelo porque es solo documentación.
