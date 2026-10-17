# REGISTRO_DEFECTOS.md — Registro de defectos y trazabilidad requisito → caso → defecto

> TP de Calidad, ejes 6 y 8 (T12). Fuente: los defectos ya documentados en `REVISION.md` y `PROJECT_ANALYSIS.md`
> (nada inventado). Cada uno tiene su Issue en GitHub con la plantilla de `PLAN_PRUEBAS.md §10`
> (`.github/ISSUE_TEMPLATE/defecto.md`), el commit del arreglo y su prueba de regresión.
> Generado desde un único archivo de datos para que el registro y los Issues digan lo mismo.

## Resumen

- **18 defectos.** Severidad: alta 2 · media 8 · baja 8.
- **Dónde se encontraron:** revisión de código 6 · pipeline/CI 4 · SonarCloud 3 · mutation testing 1 · **producción 4**.
- **Tasa de defectos escapados a producción** (métrica de proceso, T11): 4 de 18 = **22.2 %** **de este registro**. Ojo: el registro es una **selección** (abajo); con todos los hallazgos de `REVISION.md`, que se encontraron antes de producción, el denominador sería mucho mayor y la tasa, menor. Para el informe vale como "sobre los defectos registrados", no como tasa del proceso completo.
- Todos corregidos, y todos con prueba de regresión que corre en el CI (salvo D08, que era un defecto del propio test, y D09/D10, que se verifican en el run siguiente).
- **No se registran como defectos** (son mejoras o decisiones): el hallazgo 4 de §173 (los avisos que salían bien no dejaban línea en los logs: observabilidad) y las issues de SonarCloud que resultaron falsos positivos (`TRIAGE_SONAR.md`). Los defectos de REVISION.md que no figuran acá también están corregidos (ver su tabla); se eligieron los de mayor severidad o con prueba de regresión propia.

## Registro

| Id | Issue | Defecto | Sev. | Encontrado en | Requisito | Caso / prueba de regresión | Arreglo |
|---|---|---|---|---|---|---|---|
| D01 | [#2](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/2) | FAQs: el chatbot responde 500 siempre en Postgres | alta | revisión de código | RF-9 | CP-FAQ-01 (test/integration/faqs.test.js) | `ec843bb` |
| D02 | [#3](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/3) | GET /api/projects en Postgres devuelve roles y requisitos vacíos | media | revisión de código | RF-3 | CP-PROY-02 (test/integration/projects-list-shape.test.js) | `3fb0c84` |
| D03 | [#4](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/4) | Habilidades: un pedido con ids repetidos da 500 y borra todas las del voluntario | media | revisión de código | RF-10 | CP-HAB-01 (test/integration/habilidades.test.js) | `d3e0f72` |
| D04 | [#5](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/5) | Filtro de palabras por subcadena: rechaza "computadora" y deja pasar "imbécil" | media | revisión de código | RF-11 | CP-COM-01 (test/integration/comments-badwords.test.js) | `da8ac95` |
| D05 | [#6](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/6) | KPIs: las fechas se muestran un día antes | media | revisión de código | RF-13 | CP-KPI-01 (frontend NGOKPIs.test.tsx) | `073ffed` |
| D06 | [#7](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/7) | Patrocinio: dos propuestas simultáneas dan 500 en Postgres | baja | revisión de código | RF-12 | CP-PAT-01 (test/integration/sponsorship-proposal.test.js) | `5ae86d6` |
| D07 | [#8](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/8) | "Ver CV" aparece en inscripciones sin CV (abría y cerraba una pestaña vacía) | baja | producción (usuario) | RF-7 | CP-CV-04 (test/integration/cv.test.js, has_cv) | `5484c2c` |
| D08 | [#9](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/9) | Tests de db.transaction() inestables bajo carga en Postgres | baja | pipeline / CI | — | test/integration/db-transaction.test.js | `11b80a0` |
| D09 | [#10](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/10) | CI: la cobertura del backend informaba 96,51 % (inflada) en vez de 92,9 % | media | pipeline / CI | — | Comparación pipeline ↔ local | `aca9058` |
| D10 | [#11](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/11) | CI: `node --test <carpeta>` no corre los tests del gate (run #4 en rojo) | media | pipeline / CI | — | Job sonar, paso "Tests del script del gate" | `71295d4` |
| D11 | [#12](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/12) | Seguridad: un email gigante bloquea toda la API (regex con backtracking cuadrático) | alta | SonarCloud | RF-1 | CP-AUTH-05 (test/integration/email-redos.test.js) | `80be45c` |
| D12 | [#13](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/13) | Seguridad: inyección en logs desde el webhook de Mercado Pago (data.id con %0A) | baja | SonarCloud | RF-6 | CP-DON-08 (donaciones-webhook.test.js, "log injection") | `2a53138` |
| D13 | [#14](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/14) | Accesibilidad: las tarjetas de Explorar no se pueden abrir con el teclado | media | SonarCloud | RF-3 | CP-EXP-04 (frontend ExploreScreen.test.tsx) | `b9013e2` |
| D14 | [#15](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/15) | Tests: el mínimo de 8 caracteres de la contraseña no tenía prueba de borde | baja | mutation testing | RF-1 | CP-AUTH-03 (unit/validators.test.js, valores límite) | `ef46daf` |
| D15 | [#16](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/16) | E2E post-deploy: el chequeo del checkout de Mercado Pago no podía pasar ni probaba nada | baja | pipeline / CI | RF-6 | E2E post-deploy (.github/scripts/post-deploy.js e2e) | `6ecb6a6` |
| D16 | [#17](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/17) | Mercado Pago: se suponía que las credenciales de prueba empiezan con TEST- (las nuevas son APP_USR-) | baja | producción (usuario) | RF-6 | CP-DON-09 (unit/payments.test.js: con APP_USR- no afirma el modo) | `8bd863a` |
| D17 | [#18](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/18) | La ONG no tenía dónde ver sus notificaciones (la de una donación se creaba pero no se veía) | media | producción (usuario) | RF-14 | CP-NOT-02 (frontend NGONotifications.test.tsx) | `8bd863a` |
| D18 | [#19](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/19) | Lo recaudado en donaciones no se ve si el proyecto no tiene meta de financiamiento | baja | producción (usuario) | RF-6 | CP-DON-10 (frontend ProjectDetailsDonate.test.tsx) | `8bd863a` |

## Trazabilidad por requisito

| Requisito | Defectos |
|---|---|
| RF-1 Registro e inicio de sesión | D11 ([#12](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/12)), D14 ([#15](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/15)) |
| RF-10 Habilidades del voluntario | D03 ([#4](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/4)) |
| RF-11 Comentarios con filtro de palabras | D04 ([#5](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/5)) |
| RF-12 Patrocinios | D06 ([#7](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/7)) |
| RF-13 KPIs del proyecto | D05 ([#6](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/6)) |
| RF-14 Notificaciones | D17 ([#18](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/18)) |
| RF-3 Listar y buscar proyectos | D02 ([#3](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/3)), D13 ([#14](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/14)) |
| RF-6 Donar con Mercado Pago | D12 ([#13](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/13)), D15 ([#16](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/16)), D16 ([#17](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/17)), D18 ([#19](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/19)) |
| RF-7 CV privado | D07 ([#8](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/8)) |
| RF-9 Chatbot de preguntas frecuentes | D01 ([#2](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/2)) |
| — (proceso: confiabilidad de la suite) | D08 ([#9](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/9)) |
| — (proceso: los números del informe tienen que coincidir con el pipeline) | D09 ([#10](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/10)) |
| — (proceso: quality gate) | D10 ([#11](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/11)) |

## Detalle

### D01 — FAQs: el chatbot responde 500 siempre en Postgres

- **Issue:** [#2](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/2) · **Severidad:** alta · **Encontrado en:** revisión de código · **Área:** backend
- **Requisito:** RF-9 Chatbot de preguntas frecuentes · **Caso:** CP-FAQ-01 (test/integration/faqs.test.js)
- **Origen:** REVISION.md B1 · PROJECT_ANALYSIS.md §51 · **Entorno:** Postgres 16 (en SQLite no se ve)
- **Pasos:** (1) Levantar la API contra Postgres (2) POST /api/faqs/ask con cualquier pregunta
- **Esperado:** 200 con la respuesta o sugerencias
- **Obtenido:** 500: la consulta comparaba `activo = 1` sobre una columna BOOLEAN (en Postgres, boolean = integer es un error de tipos)
- **Arreglo:** `ec843bb` · **Regresión:** backend/test/integration/faqs.test.js (corre en SQLite y en Postgres en el CI)

### D02 — GET /api/projects en Postgres devuelve roles y requisitos vacíos

- **Issue:** [#3](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/3) · **Severidad:** media · **Encontrado en:** revisión de código · **Área:** backend
- **Requisito:** RF-3 Listar y buscar proyectos · **Caso:** CP-PROY-02 (test/integration/projects-list-shape.test.js)
- **Origen:** REVISION.md B2 · PROJECT_ANALYSIS.md §52 · **Entorno:** Postgres 16
- **Pasos:** (1) Crear un proyecto con roles y requisitos (2) GET /api/projects
- **Esperado:** roles y requisitos del proyecto, igual que en el detalle
- **Obtenido:** listas vacías en Postgres (en SQLite, bien)
- **Arreglo:** `3fb0c84` · **Regresión:** backend/test/integration/projects-list-shape.test.js (listado vs. detalle)

### D03 — Habilidades: un pedido con ids repetidos da 500 y borra todas las del voluntario

- **Issue:** [#4](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/4) · **Severidad:** media · **Encontrado en:** revisión de código · **Área:** backend
- **Requisito:** RF-10 Habilidades del voluntario · **Caso:** CP-HAB-01 (test/integration/habilidades.test.js)
- **Origen:** REVISION.md B6 · PROJECT_ANALYSIS.md §58 · **Entorno:** SQLite y Postgres
- **Pasos:** (1) Voluntario con habilidades cargadas (2) PUT /api/voluntarios/me/habilidades con el mismo id dos veces
- **Esperado:** se guardan sin duplicar (gana la última)
- **Obtenido:** 500 y el voluntario se queda sin ninguna habilidad (borrado sin transacción)
- **Arreglo:** `d3e0f72` · **Regresión:** backend/test/integration/habilidades.test.js

### D04 — Filtro de palabras por subcadena: rechaza "computadora" y deja pasar "imbécil"

- **Issue:** [#5](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/5) · **Severidad:** media · **Encontrado en:** revisión de código · **Área:** backend
- **Requisito:** RF-11 Comentarios con filtro de palabras · **Caso:** CP-COM-01 (test/integration/comments-badwords.test.js)
- **Origen:** REVISION.md B7 · PROJECT_ANALYSIS.md §93 · contraste rojo/verde §199 · **Entorno:** SQLite y Postgres
- **Pasos:** (1) Iniciar sesión como voluntaria (2) POST /api/projects/proj-1/comments con "Traigan la computadora para el registro" (3) POST con "Qué imbécil el que tiró basura"
- **Esperado:** el primero 201; el segundo 400 "El comentario contiene palabras no permitidas"
- **Obtenido:** el primero 400 (contiene "puta"); el segundo 201 (el filtro no normalizaba acentos)
- **Arreglo:** `da8ac95` · **Regresión:** backend/test/integration/comments-badwords.test.js y unit/badWords.test.js. Evidencia rojo/verde: docs/calidad/evidencia/b7-antes.txt y b7-despues.txt

### D05 — KPIs: las fechas se muestran un día antes

- **Issue:** [#6](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/6) · **Severidad:** media · **Encontrado en:** revisión de código · **Área:** frontend
- **Requisito:** RF-13 KPIs del proyecto · **Caso:** CP-KPI-01 (frontend NGOKPIs.test.tsx)
- **Origen:** REVISION.md F2 · PROJECT_ANALYSIS.md §63 · **Entorno:** Navegador con zona horaria de Córdoba (UTC-3)
- **Pasos:** (1) Cargar un KPI con fecha 2026-10-01 (2) Ver la lista de KPIs con la zona horaria de Córdoba
- **Esperado:** 1 de oct de 2026
- **Obtenido:** "30 de sept de 2026": `new Date(kpi.fecha)` con "YYYY-MM-DD" es medianoche UTC, que en Córdoba es el día anterior (probado, REVISION.md F2)
- **Arreglo:** `073ffed` · **Regresión:** frontend/src/app/components/NGOKPIs.test.tsx (y la suite del frontend corre en UTC y Córdoba en el CI)

### D06 — Patrocinio: dos propuestas simultáneas dan 500 en Postgres

- **Issue:** [#7](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/7) · **Severidad:** baja · **Encontrado en:** revisión de código · **Área:** backend
- **Requisito:** RF-12 Patrocinios · **Caso:** CP-PAT-01 (test/integration/sponsorship-proposal.test.js)
- **Origen:** REVISION.md A6 · PROJECT_ANALYSIS.md §140 · **Entorno:** Postgres 16, dos pedidos en paralelo
- **Pasos:** (1) La misma empresa propone patrocinar el mismo proyecto dos veces a la vez
- **Esperado:** uno 201 y el otro 409
- **Obtenido:** uno 201 y el otro 500 (choque con el UNIQUE sin isUniqueViolation)
- **Arreglo:** `5ae86d6` · **Regresión:** backend/test/integration/sponsorship-proposal.test.js (concurrencia real en Postgres)

### D07 — "Ver CV" aparece en inscripciones sin CV (abría y cerraba una pestaña vacía)

- **Issue:** [#8](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/8) · **Severidad:** baja · **Encontrado en:** producción (usuario) · **Área:** backend
- **Requisito:** RF-7 CV privado · **Caso:** CP-CV-04 (test/integration/cv.test.js, has_cv)
- **Origen:** PROJECT_ANALYSIS.md §167–§168 (encontrado por el usuario en producción) · **Entorno:** Producción (Render)
- **Pasos:** (1) ONG con una inscripción de un voluntario sin CV (2) Abrir el detalle del proyecto en el panel
- **Esperado:** el botón "Ver CV" solo cuando hay CV
- **Obtenido:** el botón aparecía siempre
- **Arreglo:** `5484c2c` · **Regresión:** backend/test/integration/cv.test.js (has_cv) y frontend NGOProjectDetailCv.test.tsx

### D08 — Tests de db.transaction() inestables bajo carga en Postgres

- **Issue:** [#9](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/9) · **Severidad:** baja · **Encontrado en:** pipeline / CI · **Área:** tests
- **Requisito:** — (proceso: confiabilidad de la suite) · **Caso:** test/integration/db-transaction.test.js
- **Origen:** PROJECT_ANALYSIS.md §150 · **Entorno:** Postgres 16 con la máquina cargada
- **Pasos:** (1) Correr npm run test:pg con la máquina ocupada
- **Esperado:** verde siempre
- **Obtenido:** a veces rojo: los tests esperaban con sleep en vez de esperar el hecho
- **Arreglo:** `11b80a0` · **Regresión:** el mismo test, ahora con señales (no hay un test aparte: el defecto era del test)

### D09 — CI: la cobertura del backend informaba 96,51 % (inflada) en vez de 92,9 %

- **Issue:** [#10](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/10) · **Severidad:** media · **Encontrado en:** pipeline / CI · **Área:** ci
- **Requisito:** — (proceso: los números del informe tienen que coincidir con el pipeline) · **Caso:** Comparación pipeline ↔ local
- **Origen:** PROJECT_ANALYSIS.md §187 · **Entorno:** GitHub Actions, Node 22 (en Node 24 local, bien)
- **Pasos:** (1) Ver el resumen del run #2, job Backend · SQLite · UTC, fila all files
- **Esperado:** ≈ 92,9 % de líneas (lo mismo que local)
- **Obtenido:** 96,51 %: Node 22 medía otros archivos además del código productivo
- **Arreglo:** `aca9058` · **Regresión:** run #3: 92,94 % (con --test-coverage-include de src/ y scripts/)

### D10 — CI: `node --test <carpeta>` no corre los tests del gate (run #4 en rojo)

- **Issue:** [#11](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/11) · **Severidad:** media · **Encontrado en:** pipeline / CI · **Área:** ci
- **Requisito:** — (proceso: quality gate) · **Caso:** Job sonar, paso "Tests del script del gate"
- **Origen:** PROJECT_ANALYSIS.md §189 (primer run fallido real) · **Entorno:** GitHub Actions (y local)
- **Pasos:** (1) node --test .github/scripts/
- **Esperado:** correr los tests de la carpeta
- **Obtenido:** Node toma la carpeta como un módulo: "Cannot find module", 1 test fallido
- **Arreglo:** `71295d4` · **Regresión:** run #5 en verde con node --test ".github/scripts/*.test.js"

### D11 — Seguridad: un email gigante bloquea toda la API (regex con backtracking cuadrático)

- **Issue:** [#12](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/12) · **Severidad:** alta · **Encontrado en:** SonarCloud · **Área:** backend
- **Requisito:** RF-1 Registro e inicio de sesión · **Caso:** CP-AUTH-05 (test/integration/email-redos.test.js)
- **Origen:** SonarCloud javascript:S8786 · PROJECT_ANALYSIS.md §201 · **Entorno:** API local (SQLite + seed); no se atacó producción
- **Pasos:** (1) POST /api/auth/login con email = 'a@' + 'a.'×40000 + '@' (2) Mandar un GET /health 30 ms después
- **Esperado:** 400 "Email inválido" en milisegundos; /health responde enseguida
- **Obtenido:** 400 a los 3.427 ms y /health esperó 3.357 ms (Node tiene un solo hilo: un pedido bloquea a todos)
- **Arreglo:** `80be45c` · **Regresión:** backend/test/integration/email-redos.test.js y unit/validators.test.js (tope de 254 antes del regex)

### D12 — Seguridad: inyección en logs desde el webhook de Mercado Pago (data.id con %0A)

- **Issue:** [#13](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/13) · **Severidad:** baja · **Encontrado en:** SonarCloud · **Área:** backend
- **Requisito:** RF-6 Donar con Mercado Pago · **Caso:** CP-DON-08 (donaciones-webhook.test.js, "log injection")
- **Origen:** SonarCloud jssecurity:S5145 · PROJECT_ANALYSIS.md §202 · **Entorno:** SQLite y Postgres
- **Pasos:** (1) POST /api/donaciones/webhook?type=payment&data.id=150%0A[donaciones] aviso del pago 999: approved con firma inválida
- **Esperado:** una sola línea en el log
- **Obtenido:** dos líneas: la segunda, inventada, parecía un pago aprobado
- **Arreglo:** `2a53138` · **Regresión:** backend/test/integration/donaciones-webhook.test.js y unit/logSafe.test.js (forLog)

### D13 — Accesibilidad: las tarjetas de Explorar no se pueden abrir con el teclado

- **Issue:** [#14](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/14) · **Severidad:** media · **Encontrado en:** SonarCloud · **Área:** frontend
- **Requisito:** RF-3 Listar y buscar proyectos · **Caso:** CP-EXP-04 (frontend ExploreScreen.test.tsx)
- **Origen:** SonarCloud typescript:S6848 · PROJECT_ANALYSIS.md §203 · **Entorno:** Navegador, solo teclado
- **Pasos:** (1) Ir a /explore (2) Navegar con Tab hasta una tarjeta de proyecto
- **Esperado:** la tarjeta recibe el foco y Enter abre el proyecto
- **Obtenido:** la tarjeta era un div con onClick: no recibía el foco
- **Arreglo:** `b9013e2` · **Regresión:** frontend ExploreScreen.test.tsx ("las tarjetas de proyecto son links"); verificado en Chrome

### D14 — Tests: el mínimo de 8 caracteres de la contraseña no tenía prueba de borde

- **Issue:** [#15](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/15) · **Severidad:** baja · **Encontrado en:** mutation testing · **Área:** tests
- **Requisito:** RF-1 Registro e inicio de sesión · **Caso:** CP-AUTH-03 (unit/validators.test.js, valores límite)
- **Origen:** PROJECT_ANALYSIS.md §199 (mutation testing) · **Entorno:** Suite del backend
- **Pasos:** (1) Cambiar `v.length < 8` por `< 7` en validatePassword (2) Correr los tests
- **Esperado:** algún test falla
- **Obtenido:** todos en verde: solo se probaba con "Ab1" (3 caracteres)
- **Arreglo:** `ef46daf` · **Regresión:** backend/test/unit/validators.test.js ("mínimo: 7 caracteres no, 8 sí")

### D15 — E2E post-deploy: el chequeo del checkout de Mercado Pago no podía pasar ni probaba nada

- **Issue:** [#16](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/16) · **Severidad:** baja · **Encontrado en:** pipeline / CI · **Área:** tests
- **Requisito:** RF-6 Donar con Mercado Pago · **Caso:** E2E post-deploy (.github/scripts/post-deploy.js e2e)
- **Origen:** PROJECT_ANALYSIS.md §194 · **Entorno:** GitHub Actions y local
- **Pasos:** (1) GET al checkout_url de Mercado Pago desde un script
- **Esperado:** que el chequeo distinga una preferencia válida
- **Obtenido:** 403 de CloudFront sin navegador, y 200 con cualquier pref_id inventado si se simula un navegador
- **Arreglo:** `6ecb6a6` · **Regresión:** .github/scripts/post-deploy.test.js (link https de MP con pref_id); E2E en verde desde el Deploy #4

### D16 — Mercado Pago: se suponía que las credenciales de prueba empiezan con TEST- (las nuevas son APP_USR-)

- **Issue:** [#17](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/17) · **Severidad:** baja · **Encontrado en:** producción (usuario) · **Área:** backend
- **Requisito:** RF-6 Donar con Mercado Pago · **Caso:** CP-DON-09 (unit/payments.test.js: con APP_USR- no afirma el modo)
- **Origen:** PROJECT_ANALYSIS.md §173, hallazgo 1 (primera donación real en producción) · **Entorno:** Producción (Render), credenciales de prueba del panel actual de Mercado Pago
- **Pasos:** (1) Configurar MP_ACCESS_TOKEN con las credenciales de la pestaña "Prueba" del panel de Mercado Pago (2) Ver la línea de arranque de la API
- **Esperado:** que la API no afirme un modo que no puede saber desde el token
- **Obtenido:** payments.js suponía el formato viejo TEST- para prueba: el comentario y la línea de arranque afirmaban el modo a partir del prefijo. El checkout igual funcionó (usaba init_point, que era lo correcto)
- **Arreglo:** `8bd863a` · **Regresión:** backend/test/unit/payments.test.js (+1: con APP_USR- no afirma el modo; con TEST- dice "sandbox")

### D17 — La ONG no tenía dónde ver sus notificaciones (la de una donación se creaba pero no se veía)

- **Issue:** [#18](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/18) · **Severidad:** media · **Encontrado en:** producción (usuario) · **Área:** frontend
- **Requisito:** RF-14 Notificaciones · **Caso:** CP-NOT-02 (frontend NGONotifications.test.tsx)
- **Origen:** PROJECT_ANALYSIS.md §173, hallazgo 2 · **Entorno:** Producción (Render)
- **Pasos:** (1) Hacer una donación a un proyecto (2) Entrar como la ONG dueña del proyecto y buscar la notificación
- **Esperado:** la ONG ve la notificación en su panel
- **Obtenido:** la notificación existía, pero solo había /notifications bajo el layout del voluntario: el panel de la ONG no tenía pantalla, ni link, ni contador
- **Arreglo:** `8bd863a` · **Regresión:** frontend NGONotifications.test.tsx (7 tests: link, contador, campanita, error)

### D18 — Lo recaudado en donaciones no se ve si el proyecto no tiene meta de financiamiento

- **Issue:** [#19](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/19) · **Severidad:** baja · **Encontrado en:** producción (usuario) · **Área:** frontend
- **Requisito:** RF-6 Donar con Mercado Pago · **Caso:** CP-DON-10 (frontend ProjectDetailsDonate.test.tsx)
- **Origen:** PROJECT_ANALYSIS.md §173, hallazgo 3 · **Entorno:** Producción (Render)
- **Pasos:** (1) Donar a un proyecto sin meta (funding_goal = 0) (2) Abrir el detalle del proyecto
- **Esperado:** se ve "Recaudado en donaciones: $X"
- **Obtenido:** ProjectDetails mostraba el financiamiento solo con meta: la donación no se veía
- **Arreglo:** `8bd863a` · **Regresión:** frontend ProjectDetailsDonate.test.tsx (+3)
