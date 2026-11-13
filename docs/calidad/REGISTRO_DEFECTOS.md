# REGISTRO_DEFECTOS.md — Registro de defectos y trazabilidad requisito → caso → defecto

> TP de Calidad, ejes 6 y 8 (T12). Fuente: los defectos ya documentados en `REVISION.md` y `PROJECT_ANALYSIS.md`
> (nada inventado). Cada uno tiene su Issue en GitHub con la plantilla de `PLAN_PRUEBAS.md §10`
> (`.github/ISSUE_TEMPLATE/defecto.md`), el commit del arreglo y su prueba de regresión.
> Generado desde un único archivo de datos para que el registro y los Issues digan lo mismo (D01–D18). D19–D21 se
> agregaron a mano el 22/10 (§244), con el mismo formato y el texto de sus Issues (#20–#22).

## Resumen

- **40 defectos.** Severidad: alta 2 · media 17 · baja 21. **40 corregidos y 0 abiertos.** D33–D40 salieron de la sesión exploratoria #2 del 12/11 (§330) y tienen los Issues #34–#41; D33–D36 y D39 se corrigieron el 12/11 (§331) y D37, D38 y D40 el 13/11 (§333). D25–D29 se corrigieron el 22/10 (§247); D30–D32 el 23/10 (§253, §254 y §257).
- **Dónde se encontraron:** revisión de código 6 · pipeline/CI 5 · SonarCloud 3 · mutation testing 1 · suite de regresión 2 · sesión exploratoria 16 (8 en la #1, 8 en la #2) · prueba manual en Chrome sin guion 1 (D30, con el label `encontrado:exploratoria`) · **producción 6** (D31 y D32 los encontré yo, en pruebas manuales sobre producción).
- **Tasa de defectos escapados a producción** (métrica de proceso, T11): 6 de 40 = **15,0 %** **de este registro** (6 de 32 = 18,8 % antes de la sesión #2, §330; D33–D40 se encontraron en local, pero sobre el código que estaba en producción: nadie los había reportado) (5 de 31 = 16,1 % antes de D32) (4 de 18 = 22,2 % antes del rediseño del frontend, §240; 4 de 21 = 19,0 % antes de la sesión exploratoria, §245; 4 de 29 = 13,8 % en el corte del informe, §249; 4 de 30 = 13,3 % con D30). Ojo: el registro es una **selección** (abajo); con todos los hallazgos de `REVISION.md`, que se encontraron antes de producción, el denominador sería mucho mayor y la tasa, menor. Para el informe vale como "sobre los defectos registrados", no como tasa del proceso completo.
- **D22–D29 (sesión exploratoria, §245) son los primeros Issues abiertos antes del arreglo:** se reportaron el 22/10, D22–D24 se corrigieron con un test que primero falló (§246) y D25–D29 también (§247). Los D01–D21 están todos corregidos, y todos con prueba de regresión que corre en el CI (salvo D08, que era un defecto del propio test, y D09/D10, que se verifican en el run siguiente).
- **No se registran como defectos** (son mejoras o decisiones): el hallazgo 4 de §173 (los avisos que salían bien no dejaban línea en los logs: observabilidad) y las issues de SonarCloud que resultaron falsos positivos (`TRIAGE_SONAR.md`). Tampoco la promesa sin `void` de `MyParticipation` que SonarCloud marcó como bug en `7b05f02` (§243): `Promise.allSettled` no rechaza nunca, así que no había un fallo posible; es mantenibilidad. Ni el aviso de `vite` 6.4.3 que hizo fallar `npm audit` en el CI #34 (§242): es una vulnerabilidad de una dependencia, publicada después de instalarla, no un defecto del código. Los defectos de REVISION.md que no figuran acá también están corregidos (ver su tabla); se eligieron los de mayor severidad o con prueba de regresión propia.

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
| D19 | [#20](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/20) | Rediseño: la ONG y la empresa no tenían cómo llegar a las notificaciones en el celular | media | suite de regresión | RF-14 | CP-NOT-02 (frontend NGONotifications.test.tsx) y layout/AppShell.test.tsx | `37b13e8` |
| D20 | [#21](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/21) | Rediseño: un clic en el fondo cerraba el compositor y se perdían las fotos | media | suite de regresión | — | frontend PostComposer.test.tsx ("clic en el fondo NO cierra") | `37b13e8` |
| D21 | [#22](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/22) | La reseña propia se precargaba un render tarde (test intermitente en el CI #34) | baja | pipeline / CI | — | frontend ProjectDetailsRating.test.tsx | `d7d5a48` |
| D22 | [#23](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/23) | Explorar esconde 2 voluntariados a una voluntaria con 8 recomendaciones | media | sesión exploratoria | RF-3 | frontend ExploreScreen.test.tsx ("más recomendaciones de las que entran") | `358789a` |
| D23 | [#24](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/24) | Modo oscuro: "Enviar propuesta" ilegible (1,10:1) y otros 5 `text-white` sobre la paleta invertida | media | sesión exploratoria | — | frontend styles/paletteContrast.test.ts | `3d9a2ba` |
| D24 | [#25](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/25) | El asistente da instrucciones de la interfaz vieja (3 de 8 respuestas) | baja | sesión exploratoria | RF-9 | test/integration/faqs-ui-names.test.js | `c538022` |
| D25 | [#26](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/26) | Modo oscuro: pastilla "Aprobado" con 2,71:1 en el detalle del proyecto de la ONG | baja | sesión exploratoria | — | frontend styles/paletteContrast.test.ts (trinquete) | `aafbf43` |
| D26 | [#27](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/27) | Notificaciones vacías de la ONG con el texto del voluntario | baja | sesión exploratoria | RF-14 | frontend NotificationsEmpty.test.tsx | `a509301` |
| D27 | [#28](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/28) | Al cambiar de pantalla no se vuelve arriba | baja | sesión exploratoria | — | frontend layout/AppShell.test.tsx ("volver arriba") | `793fcbc` |
| D28 | [#29](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/29) | Sin página 404: una URL inexistente muestra la pantalla de desarrollador de React Router | baja | sesión exploratoria | — | frontend routes.test.tsx ("rutas que no existen") | `8612ac5` |
| D29 | [#30](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/30) | KPIs: el texto de ayuda vacío tiene contraste 1,57:1 | baja | sesión exploratoria | RF-13 | frontend styles/paletteContrast.test.ts (trinquete) | `aafbf43` |
| D30 | [#31](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/31) | Modo oscuro: la tarjeta del proyecto en el mapa queda blanca con el texto claro (1,10:1) | media | prueba manual en Chrome | RF-3 | frontend styles/paletteContrast.test.ts ("superficies blancas con opacidad") | `1053d1d` |
| D31 | [#32](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/32) | Mapa de Explorar: los voluntariados remotos tienen pin | baja | producción | RF-3 | frontend ProjectMap.test.tsx ("los remotos no van al mapa") | `e113674` |
| D32 | [#33](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/33) | Mapa de Explorar: no encuadra los pines (un voluntariado lejos de la ciudad no se ve) | media | producción | RF-3 | frontend ProjectMap.test.tsx ("encuadra los pines") | `e95f7ce` |
| D33 | [#34](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/34) | Panel de impacto de la empresa: scroll horizontal a 375 px (76 px de más) | media | sesión exploratoria | RF-12 | frontend pageWidth.test.ts ("toda raíz con mx-auto lleva w-full") | `335140c` |
| D34 | [#35](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/35) | Propuestas de patrocinio de la ONG: scroll horizontal a 375 px (48 px de más) | media | sesión exploratoria | RF-12 | frontend pageWidth.test.ts ("toda raíz con mx-auto lleva w-full") | `335140c` |
| D35 | [#36](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/36) | Modo oscuro: "Mostrar N voluntariados" de la hoja de filtros no se lee | media | sesión exploratoria | RF-3 | frontend paletteContrast.test.ts ("ningún componente pone text-white sobre un token que no llega a 4,5:1") | `335140c` |
| D36 | [#37](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/37) | Globito de no leídos con contraste 3,91:1 (claro) y 3,02:1 (oscuro) | baja | sesión exploratoria | RF-14 | frontend paletteContrast.test.ts ("ningún componente pone text-white sobre un token que no llega a 4,5:1") | `335140c` |
| D37 | [#38](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/38) | Detalle del voluntariado de la ONG: lo recaudado sin formato argentino (`$8,500`) | baja | sesión exploratoria | RF-6 | frontend NGOProjectDetailMoney.test.tsx y ReviewsModalAverage.test.tsx | `a5d2ec5` |
| D38 | [#39](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/39) | "Nuevo voluntariado": el pie fijo queda corrido entre 768 y 1023 px y deja una rendija a 375 px | baja | sesión exploratoria | RF-2 | frontend fixedFooter.test.ts ("arranca donde termina la barra lateral", "queda pegado a la barra inferior") | `a5d2ec5` |
| D39 | [#40](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/40) | Contraste 4,32:1 en "Última actualización" (Privacidad) y "Pendientes" (patrocinios) | baja | sesión exploratoria | — | frontend paletteContrast.test.ts ("gray de 400 en adelante llega a 4,5:1 sobre gray-50") | `335140c` |
| D40 | [#41](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/41) | Hoja de filtros: dos textos en tuteo ("Personaliza…", "Elige…") | baja | sesión exploratoria | RF-3 | frontend FilterModalCopy.test.tsx | `a5d2ec5` |

## Trazabilidad por requisito

| Requisito | Defectos |
|---|---|
| RF-1 Registro e inicio de sesión | D11 ([#12](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/12)), D14 ([#15](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/15)) |
| RF-10 Habilidades del voluntario | D03 ([#4](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/4)) |
| RF-11 Comentarios con filtro de palabras | D04 ([#5](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/5)) |
| RF-12 Patrocinios | D06 ([#7](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/7)) |
| RF-13 KPIs del proyecto | D05 ([#6](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/6)), D29 ([#30](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/30)) |
| RF-14 Notificaciones | D17 ([#18](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/18)), D19 ([#20](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/20)), D26 ([#27](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/27)) |
| RF-3 Listar y buscar proyectos | D02 ([#3](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/3)), D13 ([#14](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/14)), D22 ([#23](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/23)), D30 ([#31](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/31)), D31 ([#32](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/32)), D32 ([#33](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/33)) |
| RF-6 Donar con Mercado Pago | D12 ([#13](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/13)), D15 ([#16](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/16)), D16 ([#17](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/17)), D18 ([#19](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/19)) |
| RF-7 CV privado | D07 ([#8](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/8)) |
| RF-9 Chatbot de preguntas frecuentes | D01 ([#2](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/2)), D24 ([#25](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/25)) |
| — (proceso: confiabilidad de la suite) | D08 ([#9](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/9)) |
| — (proceso: los números del informe tienen que coincidir con el pipeline) | D09 ([#10](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/10)) |
| — (proceso: quality gate) | D10 ([#11](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/11)) |
| — (publicaciones y reseñas: sin RF propio en el plan) | D20 ([#21](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/21)), D21 ([#22](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/22)) |
| — (accesibilidad y navegación general) | D23 ([#24](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/24)), D25 ([#26](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/26)), D27 ([#28](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/28)), D28 ([#29](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/29)) |

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

### D19 — Rediseño: la ONG y la empresa no tenían cómo llegar a las notificaciones en el celular

- **Issue:** [#20](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/20) · **Severidad:** media · **Encontrado en:** suite de regresión (local, antes del commit) · **Área:** frontend
- **Requisito:** RF-14 Notificaciones · **Caso:** CP-NOT-02 (frontend NGONotifications.test.tsx) y layout/AppShell.test.tsx
- **Origen:** PROJECT_ANALYSIS.md §240 · **Entorno:** Local (Vitest + jsdom), sobre el rediseño sin commitear
- **Pasos:** (1) Entrar como ONG o como empresa en un ancho de celular (2) Buscar cómo llegar a las notificaciones
- **Esperado:** hay un acceso a las notificaciones también en el celular (el mismo requisito que corrigió D17)
- **Obtenido:** en el borrador del rediseño no había ningún acceso a las notificaciones en el celular para esos dos roles
- **Arreglo:** antes del commit; entra en `37b13e8` · **Regresión:** NGONotifications.test.tsx (campanita del encabezado) y AppShell.test.tsx ("empresa: Notificaciones también en la barra inferior")

### D20 — Rediseño: un clic en el fondo cerraba el compositor y se perdían las fotos

- **Issue:** [#21](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/21) · **Severidad:** media · **Encontrado en:** suite de regresión (local, antes del commit) · **Área:** frontend
- **Requisito:** — (publicaciones con fotos; sin RF propio en el plan) · **Caso:** frontend PostComposer.test.tsx
- **Origen:** PROJECT_ANALYSIS.md §240 · **Entorno:** Local (Vitest + jsdom), sobre el rediseño sin commitear
- **Pasos:** (1) Abrir el compositor y elegir fotos (2) Hacer clic en el fondo, fuera del diálogo
- **Esperado:** el compositor sigue abierto y conserva las fotos
- **Obtenido:** se cerraba y se perdían las fotos
- **Arreglo:** antes del commit; entra en `37b13e8` · **Regresión:** PostComposer.test.tsx ("clic en el fondo NO cierra (se perderían las fotos)")

### D21 — La reseña propia se precargaba un render tarde (test intermitente en el CI #34)

- **Issue:** [#22](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/22) · **Severidad:** baja · **Encontrado en:** pipeline / CI (CI #34) · **Área:** frontend
- **Requisito:** — (reseñas del proyecto; sin RF propio en el plan) · **Caso:** frontend ProjectDetailsRating.test.tsx
- **Origen:** PROJECT_ANALYSIS.md §241 · **Entorno:** CI (job "Frontend · tests · UTC" del CI #34); en local pasaba siempre
- **Pasos:** (1) Entrar como voluntario que ya calificó un proyecto (2) Abrir el detalle del proyecto
- **Esperado:** cuando aparece la sección "Reseñas", el formulario ya muestra la nota y el comentario propios
- **Obtenido:** la precarga corría en un `useEffect`: había un render con la sección visible y el formulario en 5 estrellas y vacío (en el navegador, un parpadeo de un frame). El test lo encontraba a veces
- **Arreglo:** `d7d5a48` (`useLayoutEffect`) · **Regresión:** ProjectDetailsRating.test.tsx, sin cambios

### D22 — Explorar esconde 2 voluntariados a una voluntaria con 8 recomendaciones

- **Issue:** [#23](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/23) · **Severidad:** media · **Encontrado en:** sesión exploratoria #1 · **Área:** frontend
- **Requisito:** RF-3 Listar y buscar proyectos · **Caso:** frontend ExploreScreen.test.tsx
- **Origen:** SESION_EXPLORATORIA.md, PROJECT_ANALYSIS.md §245 · **Entorno:** Local (`d0a5ed4`, datos de prueba), Chrome
- **Pasos:** (1) Entrar como maria@example.com (2) Explorar, sin búsqueda ni filtros
- **Esperado:** cada voluntariado activo aparece una vez (12)
- **Obtenido:** "Para vos" mostraba 6 y la lista general sacaba las 8 de la API: 10 de 12
- **Arreglo:** `358789a` (la lista saca solo las 6 que se ven) · **Regresión:** ExploreScreen.test.tsx, rojo → verde, 5/5 mutantes muertos

### D23 — Modo oscuro: "Enviar propuesta" ilegible (1,10:1) y otros 5 `text-white` sobre la paleta invertida

- **Issue:** [#24](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/24) · **Severidad:** media · **Encontrado en:** sesión exploratoria #1 · **Área:** frontend
- **Requisito:** — (accesibilidad) · **Caso:** frontend styles/paletteContrast.test.ts
- **Origen:** SESION_EXPLORATORIA.md, PROJECT_ANALYSIS.md §245 · **Entorno:** Local (`d0a5ed4`, datos de prueba), Chrome
- **Pasos:** (1) Empresa con el tema oscuro (2) Perfil → Proponer
- **Esperado:** el botón se lee (≥ 4,5:1)
- **Obtenido:** blanco sobre #f2f4f7 (1,10:1). El test estático encontró 7 combinaciones en 5 componentes (borrar cuenta y desvincular Mercado Pago 2,79:1, reseñas 2,16:1, paso hecho de "Nuevo voluntariado" 4,41:1)
- **Arreglo:** `3d9a2ba` (tokens `bg-ink text-on-ink`, `bg-critical text-on-ink`, `bg-people text-white`) · **Regresión:** paletteContrast.test.ts, rojo con 7 → 0

### D24 — El asistente da instrucciones de la interfaz vieja (3 de 8 respuestas)

- **Issue:** [#25](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/25) · **Severidad:** baja · **Encontrado en:** sesión exploratoria #1 · **Área:** backend
- **Requisito:** RF-9 Chatbot de preguntas frecuentes · **Caso:** test/integration/faqs-ui-names.test.js
- **Origen:** SESION_EXPLORATORIA.md, PROJECT_ANALYSIS.md §245 · **Entorno:** Local (`d0a5ed4`, datos de prueba), Chrome
- **Pasos:** (1) Mensajes → Asistente (2) "¿Cómo cancelo mi inscripción?"
- **Esperado:** nombra "Mis voluntariados"
- **Obtenido:** decía "Mi Participación"; también "el ícono de lápiz" y "Nuevo Voluntariado". Además migrate.js solo insertaba FAQs nuevas: producción se quedaba con el texto viejo
- **Arreglo:** `c538022` (textos nuevos y migrate.js actualiza la respuesta de las existentes) · **Regresión:** faqs-ui-names.test.js (SQLite, Postgres, Córdoba), 5/5 mutantes muertos

### D25 — Modo oscuro: pastilla "Aprobado" con 2,71:1 en el detalle del proyecto de la ONG

- **Issue:** [#26](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/26) · **Severidad:** baja · **Encontrado en:** sesión exploratoria #1 · **Área:** frontend
- **Requisito:** — (accesibilidad) · **Caso:** frontend styles/paletteContrast.test.ts (trinquete)
- **Origen:** SESION_EXPLORATORIA.md, PROJECT_ANALYSIS.md §245 · **Entorno:** Local (`d0a5ed4`, datos de prueba), Chrome
- **Pasos:** (1) ONG con el tema oscuro (2) Detalle de un voluntariado con aprobados
- **Esperado:** ≥ 4,5:1
- **Obtenido:** `bg-green-50` + `text-green-600`: 2,71:1
- **Arreglo:** `aafbf43` · **Regresión:** frontend styles/paletteContrast.test.ts (trinquete) (rojo → verde, §247)

### D26 — Notificaciones vacías de la ONG con el texto del voluntario

- **Issue:** [#27](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/27) · **Severidad:** baja · **Encontrado en:** sesión exploratoria #1 · **Área:** frontend
- **Requisito:** RF-14 Notificaciones · **Caso:** frontend NotificationsEmpty.test.tsx
- **Origen:** SESION_EXPLORATORIA.md, PROJECT_ANALYSIS.md §245 · **Entorno:** Local (`d0a5ed4`, datos de prueba), Chrome
- **Pasos:** (1) ONG sin notificaciones (2) Notificaciones
- **Esperado:** un texto para la ONG
- **Obtenido:** "Cuando una ONG responda o alguien te siga, aparece acá."
- **Arreglo:** `a509301` · **Regresión:** frontend NotificationsEmpty.test.tsx (rojo → verde, §247)

### D27 — Al cambiar de pantalla no se vuelve arriba

- **Issue:** [#28](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/28) · **Severidad:** baja · **Encontrado en:** sesión exploratoria #1 · **Área:** frontend
- **Requisito:** — · **Caso:** frontend layout/AppShell.test.tsx ("volver arriba")
- **Origen:** SESION_EXPLORATORIA.md, PROJECT_ANALYSIS.md §245 · **Entorno:** Local (`d0a5ed4`, datos de prueba), Chrome
- **Pasos:** (1) Bajar en Inicio (2) Tocar Explorar
- **Esperado:** Explorar abre arriba
- **Obtenido:** abre con el scroll anterior (scrollY = 1111). Anterior al rediseño
- **Arreglo:** `793fcbc` · **Regresión:** frontend layout/AppShell.test.tsx ("volver arriba") (rojo → verde, §247)

### D28 — Sin página 404: una URL inexistente muestra la pantalla de desarrollador de React Router

- **Issue:** [#29](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/29) · **Severidad:** baja · **Encontrado en:** sesión exploratoria #1 · **Área:** frontend
- **Requisito:** — · **Caso:** frontend routes.test.tsx ("rutas que no existen")
- **Origen:** SESION_EXPLORATORIA.md, PROJECT_ANALYSIS.md §245 · **Entorno:** Local (`d0a5ed4`, datos de prueba), Chrome
- **Pasos:** (1) Abrir una ruta que no existe
- **Esperado:** una pantalla propia con link al inicio
- **Obtenido:** "Unexpected Application Error! 404 … Hey developer". Anterior al rediseño
- **Arreglo:** `8612ac5` · **Regresión:** frontend routes.test.tsx ("rutas que no existen") (rojo → verde, §247)

### D29 — KPIs: el texto de ayuda vacío tiene contraste 1,57:1

- **Issue:** [#30](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/30) · **Severidad:** baja · **Encontrado en:** sesión exploratoria #1 · **Área:** frontend
- **Requisito:** RF-13 KPIs del proyecto · **Caso:** frontend styles/paletteContrast.test.ts (trinquete)
- **Origen:** SESION_EXPLORATORIA.md, PROJECT_ANALYSIS.md §245 · **Entorno:** Local (`d0a5ed4`, datos de prueba), Chrome
- **Pasos:** (1) ONG (2) KPIs de un proyecto sin indicadores
- **Esperado:** ≥ 4,5:1
- **Obtenido:** `text-gray-300`: 1,57:1 en claro y 1,73:1 en oscuro. Anterior al rediseño
- **Arreglo:** `aafbf43` · **Regresión:** frontend styles/paletteContrast.test.ts (trinquete) (rojo → verde, §247)

### D30 — Modo oscuro: la tarjeta del proyecto en el mapa queda blanca con el texto claro (1,10:1)

- **Issue:** [#31](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/31) · **Severidad:** media · **Encontrado en:** prueba manual en Chrome sin guion, al verificar los mapas (§252) · **Área:** frontend
- **Requisito:** RF-3 Listar y buscar proyectos · **Caso:** frontend styles/paletteContrast.test.ts ("superficies blancas con opacidad")
- **Origen:** PROJECT_ANALYSIS.md §252–§253 · **Entorno:** Local (`f0b5f92`, datos de la semilla), Chrome, tema oscuro
- **Pasos:** (1) Tema oscuro (2) Explorar → Mapa (3) Tocar un pin (también en el mapa ampliado)
- **Esperado:** la tarjeta se lee (≥ 4,5:1)
- **Obtenido:** fondo `bg-white/98` sin versión oscura en `theme.css` (solo estaban `bg-white`, `/95` y `/90`): título #f2f4f7 sobre blanco = 1,10:1; ONG y lugar 2,99:1. Anterior a §252
- **Arreglo:** `1053d1d` (`.bg-white\/98` en el bloque oscuro de `theme.css`) · **Regresión:** paletteContrast.test.ts, todo `bg-white/NN` de los componentes tiene su versión oscura (rojo con la tarjeta del mapa → verde, §253)

### D31 — Mapa de Explorar: los voluntariados remotos tienen pin

- **Issue:** [#32](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/32) · **Severidad:** baja · **Encontrado en:** producción (prueba manual en Chrome sin guion, §253) · **Área:** frontend
- **Requisito:** RF-3 Listar y buscar proyectos · **Caso:** frontend ProjectMap.test.tsx ("los remotos no van al mapa")
- **Origen:** PROJECT_ANALYSIS.md §253–§254 · **Entorno:** Producción (`6011584`, Deploy #38), Chrome
- **Pasos:** (1) Cualquier cuenta (2) Explorar → Mapa
- **Esperado:** solo tienen pin los voluntariados con lugar físico (presencial o híbrido)
- **Obtenido:** "Test" (remoto) tenía pin en el punto de respaldo y sumaba en "3 proyectos en tu área": `ProjectMap` no descartaba los remotos. Anterior a §252
- **Arreglo:** `e113674` (`isRemote` compartido en `app/volunteering/isRemote.ts`, lo usan el detalle y el mapa) · **Regresión:** ProjectMap.test.tsx, mapa chico y ampliado (rojo con 5 y 4 pines → verde con 2, §254)

### D32 — Mapa de Explorar: no encuadra los pines (un voluntariado lejos de la ciudad no se ve)

- **Issue:** [#33](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/33) · **Severidad:** media · **Encontrado en:** producción (prueba manual en Chrome sin guion, al verificar el lugar cargado desde "Editar", §257) · **Área:** frontend
- **Requisito:** RF-3 Listar y buscar proyectos · **Caso:** frontend ProjectMap.test.tsx ("encuadra los pines")
- **Origen:** PROJECT_ANALYSIS.md §257 · **Entorno:** Producción (`99d3b9d`, Deploy #39), Chrome
- **Pasos:** (1) Un voluntariado con lugar lejos de la ciudad de Córdoba ("Jornada de limpieza en el Lago", laguna Mar Chiquita) (2) Explorar → Mapa
- **Esperado:** el mapa abre mostrando todos los voluntariados que cuenta la pastilla
- **Obtenido:** "2 proyectos" y un solo pin visible: el mapa abría siempre en el centro de Córdoba con zoom 13; el de Mar Chiquita aparecía recién alejando 7 niveles. Igual en el mapa ampliado. Anterior a §252
- **Arreglo:** `e95f7ce` (`fitToProjects`: `fitBounds` con todos los pines, zoom 13 como máximo; reencuadra al cambiar la lista, no al tocar un pin; el ampliado abierto desde un pin elegido respeta ese centro) · **Regresión:** ProjectMap.test.tsx (rojo: `fitBounds` nunca se llamaba → verde, §257)

### D33 — Panel de impacto de la empresa: scroll horizontal a 375 px (76 px de más)

- **Issue:** [#34](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/34) · **Severidad:** media · **Encontrado en:** sesión exploratoria #2 (12/11, §330) · **Área:** frontend
- **Requisito:** RF-12 Patrocinios · **Caso:** frontend pageWidth.test.ts ("toda raíz con mx-auto lleva w-full")
- **Origen:** PROJECT_ANALYSIS.md §330, SESION_EXPLORATORIA.md (sesión #2) · **Entorno:** Local (`1088775`, datos de la semilla más un patrocinio), Chrome, marco de 375 px
- **Pasos:** (1) Empresa TechCorp (2) Panel de impacto, a 375 px de ancho
- **Esperado:** la pantalla entra en el ancho, sin scroll horizontal
- **Obtenido:** `scrollWidth` 451 en un marco de 375: se cortan las cifras ("Propuestas pendien…") y el estado de cada proyecto queda fuera de la pantalla. A 768 y 1024 px no pasa (`CompanyDashboard.tsx`)
- **Arreglo:** `335140c` (`w-full` en la raíz de la pantalla (y en las otras nueve raíces con `mx-auto`): toma el ancho disponible y `max-w-*` la limita. Medido en Chrome a 375 px, claro y oscuro: sin scroll (§331)) · **Regresión:** pageWidth.test.ts (rojo: 10 raíces sin `w-full` → verde, §331)

### D34 — Propuestas de patrocinio de la ONG: scroll horizontal a 375 px (48 px de más)

- **Issue:** [#35](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/35) · **Severidad:** media · **Encontrado en:** sesión exploratoria #2 (12/11, §330) · **Área:** frontend
- **Requisito:** RF-12 Patrocinios · **Caso:** frontend pageWidth.test.ts ("toda raíz con mx-auto lleva w-full")
- **Origen:** PROJECT_ANALYSIS.md §330, SESION_EXPLORATORIA.md (sesión #2) · **Entorno:** Local (`1088775`), Chrome, marco de 375 px
- **Pasos:** (1) ONG Sustentando con una propuesta pendiente (2) Patrocinios, a 375 px
- **Esperado:** la pantalla entra en el ancho
- **Obtenido:** `scrollWidth` 423 en 375: se corta el botón "Rechazar" y el texto de la propuesta (`NGOPatrocinios.tsx`)
- **Arreglo:** `335140c` (el mismo que D33: `w-full` en la raíz de `NGOPatrocinios`. Medido en Chrome a 375 px, claro y oscuro: sin scroll (§331)) · **Regresión:** pageWidth.test.ts (rojo → verde, §331)

### D35 — Modo oscuro: "Mostrar N voluntariados" de la hoja de filtros no se lee

- **Issue:** [#36](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/36) · **Severidad:** media · **Encontrado en:** sesión exploratoria #2 (12/11, §330) · **Área:** frontend
- **Requisito:** RF-3 Listar y buscar proyectos · **Caso:** frontend paletteContrast.test.ts ("ningún componente pone text-white sobre un token que no llega a 4,5:1")
- **Origen:** PROJECT_ANALYSIS.md §330, SESION_EXPLORATORIA.md (sesión #2) · **Entorno:** Local (`1088775`), Chrome, tema oscuro
- **Pasos:** (1) Tema oscuro (2) Explorar → Filtros
- **Esperado:** el botón se lee (≥ 4,5:1)
- **Obtenido:** `bg-ink text-white` (`FilterModal.tsx:380`): en oscuro `ink` es #f2f4f7 y el texto queda blanco, 1,10:1 por cuenta. Es el mismo defecto que D23 en una combinación que `paletteContrast.test.ts` no mira (`bg-ink`)
- **Arreglo:** `335140c` (`text-on-ink` en vez de `text-white` sobre `bg-ink` (el token cambia con el tema). En Chrome, oscuro: #0b0d10 sobre #f2f4f7. El punto de color de cada categoría sigue sin verse en oscuro: es deuda de diseño, no parte de este defecto (§331)) · **Regresión:** paletteContrast.test.ts (rojo: 8 usos de `text-white` sobre tokens → verde, §331)

### D36 — Globito de no leídos con contraste 3,91:1 (claro) y 3,02:1 (oscuro)

- **Issue:** [#37](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/37) · **Severidad:** baja · **Encontrado en:** sesión exploratoria #2 (12/11, §330) · **Área:** frontend
- **Requisito:** RF-14 Notificaciones · **Caso:** frontend paletteContrast.test.ts ("ningún componente pone text-white sobre un token que no llega a 4,5:1")
- **Origen:** PROJECT_ANALYSIS.md §330, SESION_EXPLORATORIA.md (sesión #2) · **Entorno:** Local (`1088775`), Chrome, los dos temas
- **Pasos:** (1) ONG con notificaciones sin leer (2) Mirar el contador de la barra lateral y el del Panel
- **Esperado:** el número se lee (≥ 4,5:1)
- **Obtenido:** blanco sobre `like` (#e5484d en claro, #ff5c61 en oscuro), con texto de 11 px (`AppShell.tsx:39`, `NGODashboard.tsx:195`). El test de contraste no mira `bg-like`
- **Arreglo:** `335140c` (el globito pasa a `bg-critical text-on-ink` con texto de 12 px (`AppShell` y `NGODashboard`): blanco sobre #d12d21 en claro y #0b0d10 sobre #ff6b5e en oscuro. `like` queda solo para el corazón (§331)) · **Regresión:** paletteContrast.test.ts (rojo → verde, §331)

### D37 — Detalle del voluntariado de la ONG: lo recaudado sin formato argentino (`$8,500`)

- **Issue:** [#38](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/38) · **Severidad:** baja · **Encontrado en:** sesión exploratoria #2 (12/11, §330) · **Área:** frontend
- **Requisito:** RF-6 Donaciones · **Caso:** frontend NGOProjectDetailMoney.test.tsx y ReviewsModalAverage.test.tsx
- **Origen:** PROJECT_ANALYSIS.md §330, SESION_EXPLORATORIA.md (sesión #2) · **Entorno:** Local (`1088775`), Chrome en inglés
- **Pasos:** (1) ONG (2) Panel → un voluntariado con donaciones
- **Esperado:** `$ 8.500`, como en el resto de la app
- **Obtenido:** `${project.current_funding.toLocaleString()}` sin `es-AR` y con el `$` pegado (`NGOProjectDetail.tsx:170`): el formato depende del idioma del navegador. Por código, `ReviewsModal.tsx:158` muestra el promedio con punto ("4.5"): **no se vio en Chrome**
- **Arreglo:** `a5d2ec5` (`formatMoney` (`$ 8.500`, es-AR) en `NGOProjectDetail` y el promedio de `ReviewsModal` con coma. En un Chrome en inglés se ve `$ 8.500` (§333)) · **Regresión:** NGOProjectDetailMoney.test.tsx y ReviewsModalAverage.test.tsx (rojo: 5 tests → verde, §333)

### D38 — "Nuevo voluntariado": el pie fijo queda corrido entre 768 y 1023 px y deja una rendija a 375 px

- **Issue:** [#39](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/39) · **Severidad:** baja · **Encontrado en:** sesión exploratoria #2 (12/11, §330) · **Área:** frontend
- **Requisito:** RF-2 Publicar proyectos · **Caso:** frontend fixedFooter.test.ts ("arranca donde termina la barra lateral", "queda pegado a la barra inferior")
- **Origen:** PROJECT_ANALYSIS.md §330, SESION_EXPLORATORIA.md (sesión #2) · **Entorno:** Local (`1088775`), Chrome, marcos de 900 y 375 px
- **Pasos:** (1) ONG (2) Crear voluntariado, a 900 px y a 375 px
- **Esperado:** el pie con "Continuar" alineado con el formulario y pegado a la barra inferior
- **Obtenido:** A 900 px arranca a 240 px del borde (`md:left-60`) con la barra lateral de 72 px: queda corrido a la derecha. A 375 px está a 64 px del borde (`bottom-16`) y la barra mide 56: se ve el formulario por 8 px (`CreateVoluntariado.tsx:622`)
- **Arreglo:** `a5d2ec5` (el pie usa las medidas de `AppShell`: `md:left-[72px] lg:left-[244px]` y `bottom-[calc(56px+env(safe-area-inset-bottom,0px))]`. Medido en Chrome a 375, 768, 883, 1007 y 1263 px (§333)) · **Regresión:** fixedFooter.test.ts (rojo: 2 tests → verde, §333)

### D39 — Contraste 4,32:1 en "Última actualización" (Privacidad) y "Pendientes" (patrocinios)

- **Issue:** [#40](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/40) · **Severidad:** baja · **Encontrado en:** sesión exploratoria #2 (12/11, §330) · **Área:** frontend
- **Requisito:** — · **Caso:** frontend paletteContrast.test.ts ("gray de 400 en adelante llega a 4,5:1 sobre gray-50")
- **Origen:** PROJECT_ANALYSIS.md §330, SESION_EXPLORATORIA.md (sesión #2) · **Entorno:** Local (`1088775`), Chrome, tema claro
- **Pasos:** (1) Tema claro (2) /privacidad, o Patrocinios de la ONG con una propuesta pendiente
- **Esperado:** ≥ 4,5:1
- **Obtenido:** `text-gray-400` (#6b7581) sobre `bg-gray-50` (#f4f6f9) = 4,32:1 (`PrivacyPage.tsx`, `NGOPatrocinios.tsx:71`)
- **Arreglo:** `335140c` (`gray-400` (y `slate-400`, `zinc-400`) en claro pasa de #6b7581 a #646e7a en `theme.css` (§331)) · **Regresión:** paletteContrast.test.ts (rojo: 4,32:1 → verde, §331)

### D40 — Hoja de filtros: dos textos en tuteo ("Personaliza…", "Elige…")

- **Issue:** [#41](https://github.com/SantiagoPlanasM/voluntariar-PF/issues/41) · **Severidad:** baja · **Encontrado en:** sesión exploratoria #2 (12/11, §330) · **Área:** frontend
- **Requisito:** RF-3 Listar y buscar proyectos · **Caso:** frontend FilterModalCopy.test.tsx
- **Origen:** PROJECT_ANALYSIS.md §330, SESION_EXPLORATORIA.md (sesión #2) · **Entorno:** Local (`1088775`), Chrome
- **Pasos:** (1) Explorar → Filtros
- **Esperado:** voseo, como en el resto de la app ("Personalizá", "Elegí")
- **Obtenido:** "Personaliza tu búsqueda de voluntariados" (`FilterModal.tsx:159`) y "Elige según el tiempo y dedicación que desees aportar"
- **Arreglo:** `a5d2ec5` ("Personalizá tu búsqueda de voluntariados" y "Elegí según el tiempo y la dedicación que quieras aportar" (§333)) · **Regresión:** FilterModalCopy.test.tsx (rojo: 2 tests → verde, §333)
