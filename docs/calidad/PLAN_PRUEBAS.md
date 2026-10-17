# PLAN_PRUEBAS.md — Plan de pruebas de VoluntariAR

> TP Integrador de Calidad de Software (ejes 1, 3 y 6). Plan general del TP: `docs/PLAN_CALIDAD_TP.md`.
> Los números salen de corridas reales; cuando el pipeline exista (`.github/workflows/ci.yml`, T3), la fuente
> pasa a ser el run del pipeline y este documento cita su número.

## 0. Control de versiones

| Versión | Fecha | Cambio |
|---|---|---|
| 0.1 | 2026-10-17 | Primera versión: objetivos, contingencia, niveles, matriz ISO/IEC 25010, riesgos, criterios, principios, plantillas y trazabilidad inicial |
| 0.2 | 2026-10-17 | O1–O3 y O6–O7 con los números del primer run del CI (#1) y la cobertura del frontend medida (T4, §185) |

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
| O2 | El código existente está cubierto | Cobertura de líneas, ramas y funciones del backend | ≥ 80 % en las tres | `--experimental-test-coverage` en el pipeline (umbral bloqueante) | Run #1: umbral superado (job en verde). Local: 92,94 / 84,20 / 90,54 % |
| O3 | Ídem en el frontend | Cobertura del frontend (v8) | Líneas ≥ 80 % (bloqueante, decisión del usuario, §186); sentencias, ramas y funciones se informan | `npm run test:coverage` en el pipeline | Local: líneas **83,14 %**, sentencias **79,63 %**, ramas **73,97 %**, funciones **67,82 %** |
| O4 | El código nuevo viene con pruebas | Cobertura sobre código nuevo | ≥ 80 % (gate) | Quality gate (T5) | Sin gate |
| O5 | Poca duplicación | Líneas duplicadas | ≤ 5 % (gate) | Herramienta de duplicación (T5) | Sin medir |
| O6 | Sin bugs críticos del análisis estático | Hallazgos bloqueantes o críticos | 0 (gate) | Linter / análisis estático (T5) | Sin linter; `typecheck` en 0 errores en el run #1 |
| O7 | Dependencias sin vulnerabilidades conocidas | Avisos de `npm audit` | 0 en los dos paquetes | Pipeline | 0 en el run #1 (el job falla con cualquier aviso) |
| O8 | Cada despliegue queda probado | Smoke después del deploy | 100 % de los deploys | `deploy.yml` (T9) | Smoke a mano (`GUION_DEFENSA.md §2`) |
| O9 | La API aguanta la carga esperada de la demo | p95 de latencia y % de errores en `GET` | A definir **antes** de correr (T10) | Reporte de stress del pipeline | Sin medir |
| O10 | Cada defecto corregido tiene su prueba de regresión | Defectos cerrados con test enlazado / total cerrados | 100 % | GitHub Issues + matriz §10 | Ver §10 |

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
| Sistema (smoke) | El despliegue responde: API despierta, lecturas públicas, portada | Script de solo lectura (T9) | A definir en T9 | Después de cada deploy |
| Integración externa (E2E) | Donación hasta la preferencia y la conciliación en Mercado Pago (modo prueba) | Job post-deploy (T9, decisión D1) | A definir | Después de cada deploy |
| No funcional (stress y esfuerzo sostenido) | Latencia y errores con carga de lectura | Scripts (T10) | Herramienta a elegir (D5) | A pedido y antes de la demo |
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
| Técnica | Clase de equivalencia / valor límite / tabla de decisión / flujo |
| Precondición | Datos y sesión necesarios |
| Pasos | Pedido o acción, con los datos de entrada |
| Resultado esperado | Código HTTP, cuerpo y estado de la base |
| Automatización | Archivo y nombre del test |
| Defecto asociado | `#<n>` de GitHub Issues, si lo hubo |

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

### Trazabilidad requisito → caso → defecto (inicial; los números de Issue se completan en T12)

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
