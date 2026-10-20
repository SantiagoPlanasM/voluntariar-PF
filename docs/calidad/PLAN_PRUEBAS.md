# PLAN_PRUEBAS.md — Plan de pruebas de VoluntariAR

> TP Integrador de Calidad de Software (ejes 1, 3 y 6). Plan general del TP: `docs/PLAN_CALIDAD_TP.md`.
> Los números salen de corridas reales; cuando el pipeline exista (`.github/workflows/ci.yml`, T3), la fuente
> pasa a ser el run del pipeline y este documento cita su número.

## 0. Control de versiones

| Versión | Fecha | Cambio |
|---|---|---|
| 0.1 | 2026-10-17 | Primera versión: objetivos, contingencia, niveles, matriz ISO/IEC 25010, riesgos, criterios, principios, plantillas y trazabilidad inicial |
| 0.2 | 2026-10-17 | O1–O3 y O6–O7 con los números del primer run del CI (#1) y la cobertura del frontend medida (T4, §185) |
| 0.3 | 2026-10-17 | O2 y O3 con los números del run #2; la cobertura del backend del run #2 estaba inflada (§187) |
| 0.4 | 2026-10-17 | O6: el gate (SonarCloud + `sonar-gate.js`) también bloquea ante vulnerabilidades críticas (§191) |
| 0.5 | 2026-10-17 | Niveles: smoke y E2E de Mercado Pago definidos y automatizados en `deploy.yml` (T9, §193) |
| 0.6 | 2026-10-17 | O9 y nivel no funcional: k6 con umbrales fijados antes de correr y workflow `Carga` (T10, §197) |
| 0.7 | 2026-10-17 | Diseño de casos, AAA y rojo/verde en `DISENO_CASOS.md` (T6 y T7, §199) |
| 0.8 | 2026-10-17 | Registro de defectos en GitHub Issues (#2–#19) y trazabilidad completa en `REGISTRO_DEFECTOS.md` (T12, §204) |
| 0.9 | 2026-10-17 | §2.1 objetivos por perspectiva (usuario, equipo y organización) con la práctica que los sostiene (eje 1, §207) |
| 1.0 | 2026-10-19 | §10: la plantilla de caso suma **datos de prueba** y **postcondiciones**, con un caso completo de ejemplo; ciclo de vida del defecto (reportado → triage → asignado → verificado → cerrado) contra lo que pasó de verdad (§237) |

El documento se versiona en git: cada cambio entra en un commit propio y suma una fila a esta tabla.

## 1. Alcance

**Bajo prueba:** la API REST (`backend/`, Express 4, SQLite en desarrollo y Postgres en producción), el SPA
(`frontend/`, React 18) y el despliegue en Render (API `voluntariar-api-lxq7`, sitio `voluntariar-g0u6`).
**Integración externa principal:** Mercado Pago en modo prueba (donaciones). Cloudinary y Resend se prueban con dobles.
**Fuera de alcance:** el cobro real (no se usan credenciales productivas), los lectores de pantalla y los
dispositivos táctiles (no hay forma de automatizarlos en este proyecto: quedan como verificación manual).

## 2. Objetivos de calidad medibles

| # | Objetivo | Métrica | Meta | Fuente | Hoy (2026-10-17) |
|---|---|---|---|---|---|
| O1 | Ninguna regresión llega a `main` | Tests fallidos o cancelados | 0 | Pipeline (`ci.yml`) | 0 en el **run #1** (2026-10-17): SQLite UTC 782/782, Postgres UTC y Córdoba 784/784, frontend UTC y Córdoba 694/694 (782 incluye `helpers.js`, ver §4) |
| O2 | El código existente está cubierto | Cobertura de líneas, ramas y funciones del backend | ≥ 80 % en las tres | `--experimental-test-coverage` en el pipeline (umbral bloqueante) | Run #2 informó 96,51 / 91,61 / 95,78 % (UTC), **inflado**: medía otros archivos (§187). Local con `include` explícito: 92,90 / 84,06 / 90,54 %. Número válido: el del run #3 |
| O3 | Ídem en el frontend | Cobertura del frontend (v8) | Sentencias, ramas, funciones y líneas ≥ 80 %, **las cuatro bloqueantes** (decisión del usuario, §212; hasta ahí solo líneas, §186) | `npm run test:coverage` en el pipeline | Run #2: líneas 83,14 %, sentencias 79,63 %, ramas 74 %, funciones 67,72 %. **CI #19** (UTC y Córdoba iguales): líneas **90,11 %**, sentencias **86,36 %**, ramas **81,18 %**, funciones **82,11 %** (local en Windows: ramas 81,14 % y funciones 82,21 %, una unidad de diferencia) |
| O4 | El código nuevo viene con pruebas | Cobertura sobre código nuevo | ≥ 80 % (gate) | Quality gate (T5) | Sin gate |
| O5 | Poca duplicación | Líneas duplicadas | ≤ 5 % (gate) | Herramienta de duplicación (T5) | Sin medir |
| O6 | Sin bugs ni vulnerabilidades críticas del análisis estático | Issues BUG y VULNERABILITY BLOCKER/CRITICAL abiertos en SonarCloud | 0 (gate) | Job `sonar` + `sonar-gate.js` | Run #7 (primer análisis de `main`): **2 bugs y 1 vulnerabilidad críticos** → gate en rojo; triage y corrección en §191. `typecheck` en 0 |
| O7 | Dependencias sin vulnerabilidades conocidas | Avisos de `npm audit` | 0 en los dos paquetes | Pipeline | 0 en el run #1 (el job falla con cualquier aviso) |
| O8 | Cada despliegue queda probado | Smoke después del deploy | 100 % de los deploys | `deploy.yml` (T9) | Smoke a mano (`GUION_DEFENSA.md §2`) |
| O9 | La API aguanta la carga esperada de la demo | p95 de latencia y % de errores en `GET` | Fijados antes de correr (§197): **stress** hasta 50 usuarios p95 < 500 ms; **sostenido** 20 usuarios 10 min p95 < 300 ms; **producción** 10 usuarios 2 min p95 < 2 s; errores < 1 % en los tres | Workflow `Carga` (k6) | Solo corridas locales de validación (§197); el número oficial sale del pipeline |
| O10 | Cada defecto corregido tiene su prueba de regresión | Defectos cerrados con test enlazado / total cerrados | 100 % | GitHub Issues + matriz §10 | Ver §10 |

### 2.1 Los objetivos por perspectiva, con la práctica que los sostiene (eje 1)

El enunciado pide objetivos medibles **desde el usuario, el equipo y la organización**, cada uno con las prácticas de
proceso que lo sostienen. Valores al 2026-10-17 (CI #15, SonarCloud, Carga #1, registro de defectos; `METRICAS.md`).

| Perspectiva | Objetivo medible | Métrica y meta | Práctica que lo sostiene | Medido |
|---|---|---|---|---|
| **Usuario** | La app responde rápido aun con carga | p95 < 2 s en producción con 10 usuarios; p95 < 500 ms hasta 50 usuarios en el runner | Pruebas de carga con umbrales fijados **antes** de correr (k6, workflow "Carga") | 418,90 ms ✅ / 3,06 ms ✅ |
| Usuario | Lo que se despliega funciona | 100 % de los deploys con smoke + E2E en verde antes de darlos por buenos | Deploy por el pipeline con smoke y E2E de Mercado Pago (`deploy.yml`) | Deploys #4 a #8: todos verdes ✅ (los posteriores, en el informe) |
| Usuario | Sus datos están protegidos | 0 vulnerabilidades críticas abiertas | Gate del TP (también bloquea vulnerabilidades) + triage de SonarCloud | 0 ✅ (2 reales corregidas: ReDoS y logs) |
| Usuario | Se puede usar con el teclado | 0 issues de accesibilidad abiertas en SonarCloud | Tests de nombres y roles accesibles + verificación en Chrome | 0 ✅ (2 aceptadas con justificación) |
| **Equipo** | Ninguna regresión llega a `main` | 0 tests fallidos o cancelados en SQLite y Postgres, UTC y Córdoba | Tests primero (rojo → verde), CI con matriz de motores y zonas horarias | 808/810/699 ✅ |
| Equipo | El código nuevo viene con pruebas | Cobertura del código nuevo ≥ 80 % | Quality gate bloqueante + mutation testing sobre el código nuevo | 89,9 % ✅ |
| Equipo | El código existente está cubierto | ≥ 80 % (nivel 3) | Umbral bloqueante: backend (líneas, ramas y funciones), frontend (líneas) | Backend ✅; frontend: líneas ✅, ramas 74,1 % ❌ |
| Equipo | Cada defecto corregido tiene su regresión | 100 % de los defectos cerrados con test enlazado | Plantilla de defecto con el campo "prueba de regresión" (GitHub Issues) | 18/18 (D08 era del propio test) ✅ |
| Equipo | Un rojo se arregla rápido | Tiempo hasta volver a verde < 1 h | Corrección en un commit posterior, sin reescribir el run (decisión del usuario) | 5,1 min y 30 min ✅ |
| **Organización** | Sin costo de infraestructura para la demo | $0 | Planes gratuitos: Render, GitHub Actions (repo público), SonarCloud, Mercado Pago en modo prueba | $0 ✅ |
| Organización | Dependencias sin vulnerabilidades conocidas | `npm audit` en 0 en los dos paquetes | Job `audit` del CI en cada push | 0 ✅ |
| Organización | Pocos defectos llegan a producción | Defectos escapados / registrados | Revisión de código, SonarCloud y E2E contra el servicio real | 4/18 = 22,2 % sobre el registro (selección) ⚠️ |
| Organización | La demo no depende de la suerte | Plan de contingencia por dependencia + plan B local | §3 de este plan, `GUION_DEFENSA.md §6` | Documentado ✅; la base de Render vence el 14/11/2026 ⚠️ |

## 3. Plan de contingencia ante la caída de una dependencia crítica

Comportamiento que **ya está en el código** (verificado leyendo los archivos citados; los tests lo cubren con dobles):

| Dependencia | Si no está configurada | Si falla o tarda | Impacto | Respuesta |
|---|---|---|---|---|
| **Mercado Pago** (`src/lib/payments.js`) | `POST /api/donaciones` responde **503** "Las donaciones no están disponibles por el momento" (`routes/donaciones.js:55`) | Corte a los **20 s** (`TIMEOUT_MS`, `payments.js:25`, `AbortSignal.timeout`); la donación se marca fallida y responde **502** "No pudimos iniciar el pago" (`donaciones.js:85-89`) | No se puede donar; el resto de la app sigue andando. Una donación ya pagada se concilia después por `GET /api/donaciones/:id` (consulta el pago a MP, `donaciones.js:228`) | Detección: smoke/E2E post-deploy (T9) y logs `[donaciones]`. En la demo: mostrar una donación ya hecha (`GUION_DEFENSA.md §6`) |
| **Cloudinary** (`src/lib/storage.js`) | Fotos, foto de perfil y CV responden **503** (`posts.js:70`, `auth.js:308`, `voluntarios.js:53`, `:224`) | Corte a los **20 s** (`storage.js:26`); si algo falla se borra lo ya subido (regla 24 de `AI_RULES.md`) | No se suben archivos ni se descargan CV; lo demás sigue | Capturas de respaldo; el CV queda inaccesible hasta que vuelva |
| **Resend** (`src/lib/email.js`) | Los emails se omiten (se loguea; envío "fire-and-forget"). Borrar la cuenta responde **503**, porque el borrado se confirma por email (`auth.js:395`) | El error se captura (`email.js:127`) y no rompe el pedido | No llegan avisos; no se puede borrar la cuenta | Explicar la limitación (`/privacidad`) |
| **Render + Postgres** | — | El plan gratuito duerme a los 15 min y tarda ~1 min en despertar. La base vence el **14/11/2026** | Todo el sitio | Despertar con `/health` antes del smoke, del stress y de la demo; **plan B local** con SQLite y `seed.js` (`GUION_DEFENSA.md §1`) |
| **GitHub Actions** | — | Sin pipeline no hay números nuevos | Solo el proceso, no el producto | Todo el pipeline también corre en local con los mismos comandos (`npm test`, `npm run test:pg`) |

**NO verificado:** que `/health` refleje la base (hoy responde `{status, timestamp}` sin consultar la base,
`src/index.js:36`); un `/health` en verde no garantiza que Postgres responda. El smoke consulta además un endpoint
que lee de la base.

## 4. Niveles de prueba y pirámide

| Nivel | Qué prueba | Dónde | Herramienta | Cuándo corre |
|---|---|---|---|---|
| Unitario | Funciones puras y módulos aislados (validadores, traducción SQL, firma de MP, tiempo, límites) | `backend/test/unit/` (14 archivos) | `node:test` | Pipeline, cada push |
| Integración (API) | Endpoints de punta a punta contra una base real temporal, con dobles para MP, Cloudinary y Resend | `backend/test/integration/` (60 archivos + `helpers.js`) | `node:test` + `fetch` contra el servidor en un puerto efímero | Pipeline: SQLite y Postgres 16, en UTC y en Córdoba |
| Componente (frontend) | Pantallas y componentes con la API simulada | `frontend/src/**/*.test.tsx` (75 archivos) | Vitest + Testing Library + jsdom | Pipeline |
| Sistema (smoke) | El despliegue responde: API despierta, `/api/projects`, `/api/stats`, portada y una ruta del SPA | `.github/scripts/post-deploy.js smoke` (solo lectura) | Node (`fetch`), sin dependencias | Después de cada deploy (`deploy.yml`) |
| Integración externa (E2E) | Login de una cuenta dedicada → `POST /api/donaciones` crea la preferencia en Mercado Pago (201 + link con `pref_id`; el checkout no se abre, §194) → la donación queda `pending` (no se paga) | `.github/scripts/post-deploy.js e2e` | Node (`fetch`) | Después de cada deploy (`deploy.yml`) |
| No funcional (stress y esfuerzo sostenido) | Latencia y errores con carga de solo lectura: rampa hasta 100 usuarios, 20 usuarios durante 10 min, y una corrida corta contra Render | `load/stress.js`, `load/soak.js`, `load/prod.js` | k6 2.3.0 | A mano: workflow `Carga` (producción opcional, nunca después del 25/10) |
| Aceptación | Recorrido de la demo por rol | `GUION_DEFENSA.md §3` | Manual | Antes de la defensa |

**Ojo con el conteo:** `node --test` toma por defecto todo `**/test/**/*.js`, así que también ejecuta
`test/integration/helpers.js` (no define tests) y lo cuenta como un test que pasa. Por eso `npm test` informa
**782** y los tests reales son **781** (verificado el 2026-10-17: TAP `ok 25 - test\integration\helpers.js`, y una
corrida pasando solo los `*.test.js` da 781). El informe usa 781 o explica la diferencia.

La pirámide se completa con los números por nivel del pipeline (T3); hoy la base es ancha en integración, que es
donde aparecieron casi todos los defectos (ver §5, compatibilidad).

## 5. Matriz ISO/IEC 25010 (modelo de calidad del producto, 8 características, versión 2011)

| Característica | Qué significa acá | Evidencia en el repo | Cómo se mide / prueba | Brecha |
|---|---|---|---|---|
| **Adecuación funcional** | Cada rol puede hacer lo que promete el sistema | `integration/api.test.js` (flujos), `enrollments-capacity.test.js`, `donaciones.test.js`, `cv.test.js`, `account-deletion.test.js`; 694 tests de componentes | Tests de integración por requisito (§10) | La trazabilidad requisito → test no estaba escrita (§10) |
| **Eficiencia de desempeño** | Tiempos de respuesta aceptables en el plan gratuito | Tope de `limit` en `GET /api/projects` (`projects-pagination.test.js`, §96); `recommended-limit.test.js` (§149) | Stress y esfuerzo sostenido con umbrales (T10) | **No hay ninguna medición de tiempos** |
| **Compatibilidad** | Igual comportamiento en SQLite y Postgres; frontend y backend con el mismo contrato | `npm run test:pg` (misma suite en Postgres), `aggregates-are-numbers.test.js`, `migrate-schemas.test.js`, `unit/sqlTranslate.test.js`, `public-columns.test.js` | Matriz SQLite × Postgres en el pipeline | Navegadores: solo Chrome de escritorio, a mano |
| **Usabilidad** (accesibilidad incluida) | Se entiende y se puede usar con teclado | `ModalsA11y.test.tsx`, `A11yNames.test.tsx`, `Modal.test.tsx` (REVISION F12, F13); mensajes de error en español (regla 19) | Tests de roles y nombres accesibles | Lector de pantalla real y celular: **no verificados** |
| **Fiabilidad** | Sin estados inconsistentes ante fallas o pedidos simultáneos | `enrollments-concurrency.test.js`, `ratings-concurrency.test.js`, `follows-sponsorship-concurrency.test.js`, `db-transaction.test.js`, `donaciones-webhook.test.js` (avisos repetidos acreditan una vez), `error-handler.test.js` | Concurrencia real contra Postgres en el pipeline | Disponibilidad del plan gratuito (duerme) |
| **Seguridad** | Cada uno ve y toca solo lo suyo; datos personales protegidos | `ownership.test.js` (regla 15), `public-columns.test.js` (regla 8), `auth-rate-limit.test.js`, `login-message.test.js`, `unit/jwtSecret.test.js`, `ws-hardening.test.js`, `cv.test.js` (CV privado con link que vence) | Tests de autorización y de columnas; `npm audit`; análisis estático (T5) | Sin pruebas de penetración |
| **Mantenibilidad** | Se puede cambiar sin romper | 781 + 694 tests, `typecheck` estricto, test de sincronía de `badWords` back/front (§93), mutation testing por cambio (`CLAUDE.md`) | Cobertura, duplicación y lint en el gate (T5) | Sin linter ni medición de duplicación hoy |
| **Portabilidad** | Corre en otro entorno sin cambios | SQLite o Postgres según `USE_POSTGRES` (`src/db/index.js`); `run-tests-pg.js` funciona igual en Windows; `render.yaml` como Blueprint | El pipeline corre en Linux lo que hoy se corre en Windows (T3) | Primera corrida en Linux pendiente |

### Top 3 (propuesta, con su porqué)

1. **Seguridad.** El sistema guarda datos personales (CV en PDF, email, ubicación) y la Ley 25.326 da derecho de
   borrado (`/privacidad`, §177–§179). Un error de autorización expone el CV de alguien. Es la única característica
   con reglas propias en `AI_RULES.md` (8, 15, 17, 24).
2. **Fiabilidad.** Hay plata (donaciones con conciliación y *compare-and-swap*) y cupos limitados
   (`cupos_ocupados <= cupos`, regla 20). Un doble aviso de Mercado Pago o dos aprobaciones a la vez no pueden
   acreditar dos veces ni pasar el cupo.
3. **Compatibilidad.** Es la fuente de defectos más frecuente medida en el propio proyecto: de las altas y medias de
   `REVISION.md`, **B1, B2 y B8** (y B9, F1, A6 de severidad baja o de concurrencia) fallaban **solo en Postgres**,
   donde los tests SQLite pasaban. Por eso la suite corre en los dos motores.

## 6. Riesgos (probabilidad × impacto, escala 1–3)

| # | Riesgo | P | I | P×I | Mitigación |
|---|---|---|---|---|---|
| RP1 | Una consulta anda en SQLite y falla en Postgres | 2 | 3 | **6** | `test:pg` en el pipeline (bloqueante) |
| RP2 | Autorización rota: una ONG ve o toca datos de otra | 1 | 3 | 3 | `ownership.test.js`; todo endpoint con dueño suma su caso |
| RP3 | Doble acreditación de una donación | 1 | 3 | 3 | CAS + transacción; tests de avisos repetidos y en paralelo |
| RP4 | Fechas corridas un día por la zona horaria | 2 | 2 | 4 | Suite en UTC y en `America/Argentina/Cordoba` |
| RP5 | Render dormido o caído en la demo | 3 | 3 | **9** | Despertar con `/health`; plan B local; capturas |
| RP6 | Mercado Pago de prueba no responde en la demo | 2 | 2 | 4 | Donación ya hecha para mostrar; contingencia §3 |
| RP7 | La prueba de carga tira el servicio gratuito | 2 | 3 | **6** | Solo `GET`, carga acotada, nunca después del 25/10 |
| RP8 | Cobertura del frontend bajo el 80 % | 2 | 2 | 4 | Medir primero (T4); tests nuevos o declarar el número real |
| RP9 | Un aviso nuevo de `npm audit` pone el pipeline en rojo sin cambio de código | 2 | 1 | 2 | Se documenta y se corrige en un commit aparte |
| RP10 | Un test inestable (flaky) da un rojo falso | 1 | 2 | 2 | Ya pasó (§150): señales en vez de `sleep`; un rojo se investiga, no se reintenta a ciegas |

## 7. QA vs QC en este proyecto

| | QA (aseguramiento: el proceso) | QC (control: el producto) |
|---|---|---|
| Qué es | Prevenir defectos con reglas y prácticas | Detectar defectos en lo construido |
| Acá | `AI_RULES.md` (24 reglas), tests primero (rojo → verde), un commit por tarea, revisiones de código (`REVISION.md`), este plan, el quality gate, la sección "NO verificado" en cada cambio | Las suites de tests, el `typecheck`, `npm audit`, el smoke post-deploy, el stress, la verificación manual en producción (§156, §161, §167, §174) |
| Cuándo | Antes y durante el desarrollo | Después de cada cambio y de cada deploy |

## 8. Criterios de entrada y de salida

**Entrada a pruebas (por cambio):** el cambio compila (`typecheck` sin errores); el criterio de aceptación está escrito
**antes** del test; existe el test en rojo que muestra el problema (o, para un requisito nuevo, el test que falla
porque falta la funcionalidad, no porque falta el módulo).

**Salida (para integrar a `main`):** pipeline en verde: 0 tests fallidos o cancelados en SQLite y Postgres, en UTC y
en Córdoba; cobertura ≥ 80 % (código existente y nuevo); duplicación ≤ 5 %; 0 hallazgos críticos; `npm audit` en 0;
documentación actualizada (`docs/*_CONTEXT.md` y sección en `PROJECT_ANALYSIS.md`).

**Salida (para un despliegue):** lo anterior + smoke post-deploy en verde + E2E de Mercado Pago en verde.

**Suspensión:** si el pipeline queda en rojo por un problema de infraestructura (no del código), se documenta y no se
reintenta hasta entender la causa.

## 9. Los siete principios del testing, aplicados

| Principio | En VoluntariAR |
|---|---|
| 1. Las pruebas muestran la presencia de defectos, no su ausencia | Con la suite completa en verde, el usuario encontró en producción el botón "Ver CV" en inscripciones sin CV (§167–§168) |
| 2. Probar todo es imposible | Las combinaciones de rol × estado de inscripción × dueño del proyecto × hay CV se eligen con tabla de decisión, no todas (T6) |
| 3. Probar temprano ahorra | Una sonda contra Postgres en la revisión (`REVISION.md`, tercera pasada) encontró A6 (dos propuestas simultáneas → 500) antes de que lo viera un usuario; se corrigió con su test (§140) |
| 4. Los defectos se agrupan | La mayoría de los defectos graves de `REVISION.md` están en la diferencia SQLite/Postgres (§5, top 3) |
| 5. Paradoja del pesticida | Repetir los mismos tests no encontraba los bugs de Postgres: hizo falta sumar el motor (`test:pg`) y el mutation testing |
| 6. Las pruebas dependen del contexto | Para la plata se prueba concurrencia y montos límite; para las pantallas, roles accesibles y estados de carga |
| 7. Falacia de la ausencia de errores | Un sistema sin bugs que no sirve igual falla: por eso el recorrido de aceptación por rol (`GUION_DEFENSA.md §3`) |

## 10. Plantillas y trazabilidad

### Plantilla de caso de prueba

| Campo | Contenido |
|---|---|
| Id | `CP-<área>-<n>` (p. ej. `CP-DON-03`) |
| Requisito | `RF-<n>` (§10, tabla de trazabilidad) |
| Técnica | Clase de equivalencia / valor límite / tabla de decisión / transición de estados / caso de uso / caminos básicos |
| Precondiciones | Estado del sistema y sesión necesarios antes de empezar |
| Datos de prueba | Los valores exactos de entrada |
| Pasos | Pedido o acción, en orden |
| Resultado esperado | Código HTTP y cuerpo de la respuesta |
| Postcondiciones | Cómo queda el sistema después (base, contadores, servicios externos llamados o no) |
| Automatización | Archivo y nombre del test |
| Defecto asociado | `#<n>` de GitHub Issues, si lo hubo |

**Ejemplo completo** (es uno de los tests de `enrollments-state-transitions.test.js`):

| Campo | Contenido |
|---|---|
| Id | `CP-INS-11` |
| Requisito | RF-4 Inscribirse sin pasar el cupo |
| Técnica | Transición de estados (transición inválida) |
| Precondiciones | Proyecto activo de la ONG "Sustentando" con 3 cupos; Juan aprobado (1 cupo ocupado); María inscripta y **aprobada** (2 ocupados); sesión de la ONG |
| Datos de prueba | `PATCH /api/enrollments/<id de María>` con `{ "status": "pending" }` |
| Pasos | 1. La ONG manda el pedido. 2. Se lee el estado de la inscripción y el cupo del proyecto |
| Resultado esperado | **400** `{ "error": "Status debe ser: approved o rejected" }` |
| Postcondiciones | María sigue **aprobada**; el cupo ocupado sigue en **2** (los dos, verificados por el test). No se notifica a nadie: el 400 sale antes de leer la base (por lectura del código, el test no lo mira) |
| Automatización | `enrollments-state-transitions.test.js` → "APROBADA --pedirPending--> APROBADA (400, cupo de María 1)" |
| Defecto asociado | — |

### Plantilla de defecto (GitHub Issues)

Título: `[DEF] <qué falla, en una línea>` · Labels: `defecto`, severidad (`sev:alta|media|baja`), dónde se encontró
(`encontrado:dev|ci|prod`), motor (`sqlite|postgres|ambos`).

| Campo | Contenido |
|---|---|
| Caso de prueba | `CP-…` que lo detecta (o que se crea para reproducirlo) |
| Requisito | `RF-…` |
| Entorno | Motor, zona horaria, commit, local / CI / producción |
| Pasos para reproducir | Numerados |
| Resultado esperado | |
| Resultado obtenido | Con el error exacto |
| Evidencia | Salida del test en rojo, run del pipeline, log |
| Corrección | Commit del fix y test de regresión (en verde) |

### Ciclo de vida del defecto

| Estado | Qué significa acá | Dónde queda |
|---|---|---|
| **Reportado** | Se describe con pasos, esperado y obtenido | Hallazgo en `REVISION.md`, run rojo del CI, issue de SonarCloud o aviso del usuario en producción; después, el Issue con la plantilla |
| **Triage** | Se clasifica y se decide si se arregla | Labels `sev:alta/media/baja`, `encontrado:…`, `area:…`; o se **acepta** con justificación (`TRIAGE_SONAR.md`) |
| **Asignado** | Alguien se hace cargo | **No se usó el campo "asignado"** de GitHub: el equipo es de dos personas y se repartió de palabra |
| **Verificado** | La prueba de regresión pasa de rojo a verde | El test citado en el Issue, en verde en el CI |
| **Cerrado** | Se cierra con el commit del arreglo | Issue cerrado, con el commit y el test |

**Honestidad:** los 18 Issues (#2–#19) se cargaron el 17/10, **después** de arreglar los defectos: cada uno se abrió y
se cerró a los pocos segundos. El ciclo real (reportado → triage → verificado → cerrado) pasó en `REVISION.md` y en
los commits; los Issues lo registran a posteriori. Para un defecto nuevo, el Issue se abre al reportarlo.

### Trazabilidad requisito → caso → defecto (inicial)

> **Desde T12 (§204), la trazabilidad completa con los Issues está en `REGISTRO_DEFECTOS.md`**: 18 defectos (#2–#19 en GitHub Issues), cada uno con su requisito, su caso de prueba, el commit del arreglo y la prueba de regresión. La tabla de abajo es la versión inicial (v0.1), por requisito.

| Requisito | Tests que lo cubren | Defectos documentados |
|---|---|---|
| RF-1 Registro e inicio de sesión | `register-input-validation`, `register-password-max`, `register-transaction`, `login-message`, `auth-rate-limit` | B17 (§85), B20 (§91), A4 (§138) |
| RF-2 Publicar y editar proyectos (ONG) | `projects-create-validation`, `projects-strict-inputs`, `projects-partial-update`, `creation-and-capacity-edit` | B5 (§59), A3 (§137) |
| RF-3 Listar y buscar proyectos | `projects-list-shape`, `projects-search`, `projects-pagination` | B2 (§52), B8 (§54), A7 (§136) |
| RF-4 Inscribirse sin pasar el cupo | `enrollments-capacity`, `enrollments-concurrency`, `api.test.js` | — |
| RF-5 Certificar horas (ONG) | `enrollments-hours-validation`, `ownership` | T1 (§55) |
| RF-6 Donar con Mercado Pago | `donaciones`, `donaciones-webhook`, `unit/payments` | §175 |
| RF-7 CV privado | `cv`, `unit/storage-pdf` | §168 |
| RF-8 Borrar la cuenta | `account-deletion` | — |
| RF-9 Chatbot de preguntas frecuentes | `faqs` | B1 (§51), A5 (§139) |
| RF-10 Habilidades del voluntario | `habilidades` | B6 (§58) |
| RF-11 Comentarios con filtro de palabras | `comments-badwords`, `unit/badWords` | B7 (§93) |
| RF-12 Patrocinios (empresa) | `sponsorship-proposal`, `follows-sponsorship-concurrency` | A6 (§140), B16 (§77) |

**Aviso:** `integration/api.test.js:132-151` usa los rótulos "BUG B1" y "BUG B2" para dos defectos **anteriores** a
`REVISION.md` (mensaje de inscripción y categoría de la ONG), que no son los B1/B2 de esa revisión. En el registro se
identifican por el número de Issue para evitar la ambigüedad.

## 11. ⚠️ NO verificado

- Nada de este plan corrió todavía en el pipeline (no existe). Las cifras de §2 son de corridas locales en Windows del
  2026-10-17 (backend con cobertura, frontend) o de `CLAUDE.md` (las marcadas "no corrido hoy").
- La tabla de trazabilidad se armó con los nombres de los archivos y los comentarios que citan cada defecto; no
  revisé test por test que cada uno cubra todo el requisito.
- Las probabilidades e impactos de §6 son una estimación cualitativa (la escala es del plan, no una medición).
- El top 3 es una propuesta para que la defiendas vos; la cuenta de defectos por motor sale de la tabla de
  `REVISION.md`.
