# PROJECT_ANALYSIS.md — Bitácora de VoluntariAR

> Una sección por cambio, en orden: **qué se hizo**, **verificación**, **errores propios** y **⚠️ NO verificado**. Las
> secciones se citan como "§N" en todo el repo. Las §1–§299 están archivadas sin cambios en
> [`archivo/bitacora/`](archivo/bitacora/); acá van las nuevas, desde la **§300**. Para encontrar una vieja:
> `grep -n "^## 123[.–]" docs/archivo/bitacora/*.md`. Índice de toda la documentación: [`README.md`](README.md).

## Índice de lo archivado

| Secciones | Archivo | Etapa |
|---|---|---|
| §1–§33 | [`001-033-analisis-y-roadmap`](archivo/bitacora/001-033-analisis-y-roadmap.md) | Análisis inicial (§1–§12: fortalezas, bugs, prioridades) y funcionalidades del roadmap: KPIs, habilidades, chat, emails, recomendaciones, empresas, patrocinio, chatbot, seguimiento |
| §34–§50 | [`034-050-infraestructura-y-momentos`](archivo/bitacora/034-050-infraestructura-y-momentos.md) | Transacciones, `test:pg`, fechas en Postgres, Node 22, `npm audit`, Momentos con fotos |
| §51–§105 | [`051-105-revision-1`](archivo/bitacora/051-105-revision-1.md) | Arreglos de la revisión de código (`archivo/REVISION.md`: B, F, T, D) y decisiones del usuario |
| §106–§161 | [`106-161-revision-2`](archivo/bitacora/106-161-revision-2.md) | Segunda pasada (S1–S10, A1–A7) y verificación en producción |
| §162–§182 | [`162-182-plan-de-cierre`](archivo/bitacora/162-182-plan-de-cierre.md) | Plan de cierre (`archivo/PLAN_FALTANTE.md`): foto, CV, donaciones con Mercado Pago, borrar la cuenta, privacidad |
| §183–§214 | [`183-214-tp-calidad`](archivo/bitacora/183-214-tp-calidad.md) | TP de Calidad: CI, SonarCloud, deploy con smoke y E2E, k6, defectos, métricas, informe |
| §215–§238 | [`215-238-marketplace-y-sonar`](archivo/bitacora/215-238-marketplace-y-sonar.md) | Marketplace de Mercado Pago (cada ONG cobra en su cuenta), SonarCloud en 0, validaciones |
| §239–§260 | [`239-260-rediseno-y-mapas`](archivo/bitacora/239-260-rediseno-y-mapas.md) | Rediseño (DESIGN 1.1), sesión exploratoria y contraste, mapas, administrar un voluntariado, puesta al día |
| §261–§299 | [`261-299-cierre`](archivo/bitacora/261-299-cierre.md) | Entrevistas (§261–§262), patrocinio como acuerdo (§263–§267), calendario y certificado (§268–§271), contraseñas (§272–§278), recomendaciones (§280), foto, carga horaria, embudo y transparencia (§282–§286), Sonar y recomendador (§287–§288), Cloudinary (§289), teléfono (§291), equipo de la ONG (§293–§296), encuadre (§297), refactors del frontend (§298–§299) |

## 300. Documentación compactada y archivada

### Qué se hizo
- La bitácora (962 KB) se partió en `archivo/bitacora/` por etapa, sin cambios en el texto. Este archivo quedó con el índice y las secciones nuevas.
- Los planes cumplidos pasaron a `docs/archivo/`.
- Los `*_CONTEXT.md`, `AI_RULES.md` y `CLAUDE.md` se reescribieron compactos: solo el estado actual, sin la historia. La versión completa del 30/10 quedó en `archivo/contexto-2026-10-30/`.
- `DESIGN.md` no se tocó: es la especificación del diseño, no una bitácora (tiene 9 menciones de §), y compactarlo sería cambiar decisiones de diseño.
- Rutas a los planes movidos: se actualizaron las 24 rutas explícitas `docs/X.md`, en comentarios del código, el CI, Sonar y los docs. Las menciones por nombre (`REVISION.md B3`) quedaron, porque el nombre sigue siendo único. El informe del TP no se tocó.
- Se corrigió lo que estaba desactualizado:
  - `PROJECT_CONTEXT` decía 33 tablas y tres layouts con barras propias;
  - `DATABASE_CONTEXT` decía "22 de 31 índices" (son 38) y que los archivos de Cloudinary no se borraban;
  - `API_CONTEXT` decía que Explorar pide 200 (pide 500), que borrar un voluntariado no borraba su foto (lo hace desde §289) y que solo la ONG gestiona entrevistas (también la coordinación);
  - `BACKEND_CONTEXT` decía que `translatePg` reescribe `ON CONFLICT` y que `JWT_SECRET` tiene un fallback.

| Documento | Antes (bytes) | Ahora |
|---|---|---|
| `CLAUDE.md` | 7.996 | 6.552 |
| `AI_RULES.md` | 12.587 | 5.905 |
| `PROJECT_CONTEXT.md` | 21.641 | 5.810 |
| `BACKEND_CONTEXT.md` | 33.614 | 14.662 |
| `DATABASE_CONTEXT.md` | 33.512 | 12.886 |
| `API_CONTEXT.md` | 114.939 | 41.727 |
| `FRONTEND_CONTEXT.md` | 72.112 | 20.217 |
| `PROJECT_ANALYSIS.md` | 953.667 | ~5.000 |

Lo que se lee siempre (`CLAUDE.md` + `AI_RULES.md` + `PROJECT_CONTEXT.md`) pasó de 42 KB a 18 KB. Lo que se lee para tocar un endpoint (más API, DATABASE y FRONTEND) pasó de 263 KB a 93 KB.

### Verificación
- **Partición:** el texto de las 9 partes, unido, es igual al original (8390 líneas; solo cambian líneas en blanco entre partes).
- **`API_CONTEXT`:** los 114 endpoints que registran las rutas (`router.<método>('…')` y `app.get` de `index.js`) figuran todos. Se verificó en el código que las 4 rutas de postulación de la ONG usan `managedNgoOfEnrollment` y que `posts` cuenta a los miembros activos.
- **`DATABASE_CONTEXT`:** las 38 tablas y las 278 columnas de `migrate.js` (incluidas las 25 de `addColumnIfNotExists`) figuran todas; `voluntarios.followers` faltaba y se agregó. Los 38 índices salen del propio `migrate.js`.
- **`FRONTEND_CONTEXT`:** todas las rutas de `routes.tsx`, los 66 componentes de `app/components/` y los namespaces de `api.ts` figuran. Faltaban 5 componentes y `messages`, que se agregaron.
- **Referencias:** las únicas dos citas a una sección numerada de un contexto (`PROJECT_CONTEXT.md §13` y `§4`) apuntan ahora a la copia archivada.
- No cambió código: no se corrieron las suites.

### Errores propios
- El primer script de columnas usó `'\\b'` dentro de un heredoc de Bash y quedó `\b` (retroceso): marcó como faltantes todas las columnas. Se reescribió con `Write`.
- En la primera lectura de `METRICAS.md §8` (esta misma sesión) atribuí la falla nueva del CI al runner. Era la de `81fb24a` (§292); se corrigió antes de commitear.
- El mensaje del commit de `FRONTEND_CONTEXT` dice 23 KB; quedó en 20 KB después de completar los componentes.

### ⚠️ NO verificado
- Que los contextos compactos no hayan perdido una regla que importe: los chequeos son de presencia (endpoints, tablas, columnas, rutas, componentes), no de que cada detalle esté bien. Ante una duda, la versión completa está en `archivo/contexto-2026-10-30/`.
- Que una IA trabaje igual de bien con los contextos compactos: se verá en las próximas tareas.

## 301. Acceso al equipo de la ONG sin pasar por Configuración

### Qué se hizo
Antes, en el celular, la ONG llegaba a su equipo (`/ngo/equipo`) solo por Perfil → Configuración, porque "Equipo" estaba únicamente en la barra lateral, que en el celular no aparece. El voluntario veía sus invitaciones y equipos solo en Configuración → Equipos. El aviso `team_invite` lo mandaba arriba de Configuración, donde la invitación quedaba debajo del CV. El usuario eligió las opciones N1, V1, V2 y V3:
- **N1. `NGOTeamCard` en el Panel de la ONG**, debajo de los números: lleva a `/ngo/equipo` y dice "2 miembros · 1 invitación pendiente" (en singular o plural, sin "0 …"). Si no hay equipo, invita a sumar gente; si la carga falla, el acceso queda, pero sin números.
- **V1. `TeamInvites` arriba del Inicio del voluntario:** muestra solo las invitaciones pendientes, con el rol y qué puede hacer, y los botones "Aceptar" y "Rechazar". Al aceptar, queda "Ya sos parte del equipo de X" con "Abrir el panel". Se oculta si no hay invitaciones o si falla la carga.
- **V2. "Equipos" (`TeamSection`) en el propio perfil**, además de Configuración, con un `className` para el margen.
- **V3. Aviso y vuelta:** `team_invite` lleva a `/profile#equipos`. `TeamSection` hace el scroll al ancla una sola vez, cuando ya cargó (con el mismo patrón que `#mercadopago`). "Volver" del panel del miembro (`TeamPanel`) y su pantalla de error también llevan a `/profile#equipos` (antes, a `/settings`).
- La lógica de cargar, aceptar, rechazar y salir pasó de `TeamSection` a `app/team/useTeamMemberships.ts`, que comparten las dos pantallas del voluntario.
- No se tocaron el backend, la API ni la base. No hay consultas nuevas en el backend. El Inicio del voluntario suma un `GET /equipo/mias` y el Panel de la ONG, un `GET /equipo/miembros`.

### Verificación
- Tests primero: con componentes vacíos (no "el módulo no existe"), 16 rojos más 1 de `TeamPanel`; después, verdes.
- Frontend: **1207** tests (antes 1187; +20), `npm run typecheck` sin errores. Cobertura: sentencias 90,6 %, ramas 87,13 %, funciones 86,95 %, líneas 93,38 %. El contraste de la paleta pasa (solo se usan tokens existentes).
- Mutación del código nuevo (28 mutantes, con una corrida de control sin mutar que pasó): sobrevivieron 5. Tres eran huecos de los tests y se agregaron casos: solo miembros sin "0 invitaciones", el scroll no se repite al aceptar y el `className` del perfil. Volvieron a correr y murieron. Los otros 2 son **equivalentes**:
  - que `accept` devuelva `true` cuando falla: la invitación sigue `invited`, y `TeamInvites` la dibuja según su estado, así que se ve igual;
  - sacar el `alive` al desmontar: en React 18, un `setState` sobre un componente desmontado no hace nada.
- Los fuentes quedaron iguales a la copia previa (`diff -r`).
- No se corrieron las suites del backend: no cambió.

### Errores propios
- `A11yNames.test.tsx` responde `{}` a las llamadas que no simula. `api.team.mine()` devolvió `memberships` indefinido y `TeamSection` se rompió en el perfil. Se le sumó `team` a la simulación del test. La API real siempre devuelve el arreglo.
- El primer respaldo antes de mutar usó `tar` con una ruta `C:/…` y falló ("Cannot connect to C:"). La cadena se cortó antes de mutar nada, y se rehízo con `cp -r`.

### ⚠️ NO verificado
- Cómo se ve en un teléfono angosto de verdad: en Chrome se vio con 756 px de ancho, ya con el diseño de celular (§302).
- No se probó en producción.

## 302. El aviso de invitación al equipo, al día; §301 vista en Chrome

### Qué se hizo
- El texto del aviso `team_invite` (`routes/ngoTeam.js`) decía "Rol: coordinador. Aceptá o rechazá la invitación desde Configuración → Equipos.": el rol con el nombre de la base y un camino que ya no es el principal. Ahora dice "Rol: Coordinación. Aceptala o rechazala desde tu Inicio o desde Equipos en tu perfil." (`ROLE_LABEL`, el mismo nombre que `TEAM_ROLE_LABEL` del frontend). Los avisos ya creados conservan el texto viejo.
- `GUION_DEFENSA.md`: la voluntaria acepta desde el aviso del Inicio.
- §301 vista en Chrome, con backend y Vite locales, una base SQLite de prueba en el scratchpad y sin mails (sin `RESEND_API_KEY`).
  - **Escritorio, tema claro:** el aviso del Inicio; "Aceptar" deja "Ya sos parte" con "Abrir el panel"; la notificación lleva a `/profile#equipos` y baja hasta la sección; "Volver" del panel del miembro vuelve ahí; la tarjeta "Equipo · 2 miembros" en el Panel.
  - **Celular (756 px, barra inferior) y tema oscuro:** el aviso del Inicio, "Equipos" en el perfil y la tarjeta "Equipo · 2 miembros · 1 invitación pendiente", que abre "Acceso del equipo". Sin scroll horizontal.

### Verificación
- Test primero: `ngo-team.test.js` exige el texto nuevo (Coordinación) y "Rol: Comunicación."; rojo con el texto viejo y verde después.
- Backend: **1088** en SQLite, **1090** en Postgres y **1088** con `TZ=America/Argentina/Cordoba`, 0 fallas y 0 canceladas (los mismos conteos: se agregaron aserciones, no tests). Frontend: no cambió.

### Errores propios
- Al agregar la aserción de Comunicación usé `notif`, que ya existía en ese test: el archivo no cargó (SyntaxError) y se renombró a `invitation`.

### ⚠️ NO verificado
- Un teléfono físico (lo táctil). El ancho de 390 px sí se vio después, en un `iframe` (§304).

## 303. Equipo de demo: en el seed y en DEMO_DATOS

### Qué se hizo
- **Seed:** una voluntaria nueva, **Sofía Romero** (`user-vol-4`, `sofia@example.com`), coordinadora activa de Sustentando, y **Lucía** invitada a Comunicación. Es idempotente (`ON CONFLICT DO NOTHING` sobre `UNIQUE(ngo_id, user_id)`). Así, en local, el Panel muestra "1 miembro · 1 invitación pendiente" y el Inicio de Lucía, el aviso. Se agregó una cuenta nueva porque los tests usan a María, Juan y Lucía como voluntarios sin acceso.
- **Producción:** el seed no corre ahí (a propósito). `DEMO_DATOS.md` suma el paso 2.5: la ONG 1 invita a Sofía (Coordinación), Sofía acepta desde su Inicio y Martín queda invitado (Comunicación) para aceptar en vivo. También suma tres puntos al chequeo final.
- `README.md`, `backend/README.md` y `DATABASE_CONTEXT.md`: la cuenta nueva y el equipo.

### Verificación
- Test primero: `seed-team.test.js` (4 tests: miembros de la ONG, panel de Sofía, invitación de Lucía sin panel (403) y seed repetido sin duplicar). Rojo sin el cambio y verde con él.
- Backend: **1092** en SQLite, **1094** en Postgres y **1092** con `TZ=America/Argentina/Cordoba`, 0 fallas y 0 canceladas (antes 1088/1090: +4 de `seed-team.test.js`).

### Errores propios
- Dije que ningún test chocaba con la invitación de Lucía, pero solo había revisado los tests del equipo. `ownership.test.js` la insertaba como miembro de `ngo-1` y chocó con el `UNIQUE`. Se cambió a María (`user-vol-1`), que el seed no pone en ningún equipo.
- `seed-production.test.js` contaba 8 cuentas; ahora son 9.

### ⚠️ NO verificado
- Que la carga del paso 2.5 en producción salga como dice la guía: la hace el usuario por la interfaz.

## 304. Patrocinios y Publicaciones también desde el Panel (celular)

### Qué se hizo
- En el celular, Patrocinios y Publicaciones de la ONG no tenían acceso: están en la barra lateral, que en el celular no aparece, y la barra inferior tiene cinco ítems como máximo. Era el mismo problema que Equipo (§301).
- `NGOShortcuts` reemplaza la tarjeta suelta de §301 con una fila de accesos (`nav` "Accesos del panel") a **Patrocinios** ("Propuestas y acuerdos con empresas"), **Publicaciones** ("Momentos de tus voluntariados") y **Equipo** (`NGOTeamCard`, con su resumen). En escritorio van en tres columnas.
- `ShortcutCard` es la tarjeta de cada acceso, en su propio archivo para que `NGOShortcuts` y `NGOTeamCard` no se importen entre sí.
- Además, la §301 vista a **390 px**: Chrome no deja achicar la ventana por debajo de ~756 px y la extensión no abre el modo dispositivo, así que se cargó la app en un `iframe` de 390 px (las media queries miran el iframe). El aviso del Inicio, "Equipos" en el perfil y la tarjeta del Panel entran, sin scroll horizontal.

### Verificación
- Test primero: `NGOShortcuts.test.tsx` y el del Panel (los tres accesos con su destino), rojos con un componente vacío.
- Frontend: **1209** tests (+2), `npm run typecheck` sin errores. Cobertura: sentencias 90,6 %, ramas 87,14 %, funciones 86,96 %, líneas 93,39 %.
- Mutación (11 mutantes, con la corrida de control): ningún sobreviviente. Los fuentes quedaron iguales a la copia previa.
- Backend: no cambió en este commit.

### Errores propios
- La primera versión dejaba `ShortcutCard` en `NGOShortcuts` y la importaba desde `NGOTeamCard`, que `NGOShortcuts` a su vez importa: un ciclo. Se separó antes de correr los tests.

### ⚠️ NO verificado
- No se probó en producción ni en un teléfono físico. Sí se vio en Chrome local (tema oscuro): a 390 px, en un iframe, los tres accesos uno debajo del otro y sin scroll horizontal; en escritorio, una fila de tres.

## 305. Contador de invitaciones a equipos en "Perfil"

### Qué se hizo
- El aviso de una invitación a un equipo se veía solo en el Inicio y en "Equipos" del perfil (§301). Ahora el ítem **Perfil** del voluntario (barra inferior y lateral) muestra cuántas invitaciones tiene sin responder, con el mismo globito que Mensajes y Notificaciones. No cuenta los equipos activos.
- `navConfig`: `badge: 'team'` en Perfil del voluntario. `useBadges`: pide `GET /equipo/mias` solo si la sesión es de un voluntario, y lo repite al cambiar de pantalla, como las notificaciones: aceptar o rechazar borra el contador en la navegación siguiente.

### Verificación
- Test primero (`AppShell.test.tsx`, +4): el contador en las dos barras, sin contador con solo equipos activos o si falla el pedido, otra consulta al cambiar de pantalla, y ONG y empresa sin consultar. Los tres primeros, rojos sin el cambio. El de ONG y empresa ya pasaba: es una guarda contra pedidos de más.
- Frontend: **1213** tests (+4), `npm run typecheck` sin errores. Cobertura: sentencias 90,62 %, ramas 87,14 %, funciones 87 %, líneas 93,39 %.
- Mutación (6 mutantes, con la corrida de control): ningún sobreviviente. Los fuentes quedaron iguales a la copia previa.
- Backend: no cambió.

### Errores propios
- El primer `tail` de la salida de la mutación dejó afuera la línea del control; se corrió el control aparte (24/24) antes de dar por muertos los mutantes.

### ⚠️ NO verificado
- En Chrome: el globito en Perfil (el mismo componente que Mensajes y Notificaciones).
- Al aceptar desde el aviso del Inicio, el contador sigue hasta la navegación siguiente (por ejemplo, "Abrir el panel"): no se actualiza en el momento.
- Un pedido más por navegación para los voluntarios; no se midió el costo.

## 306. Guion de la defensa con el equipo de la ONG

### Qué se hizo
- `GUION_DEFENSA.md`, recorrido: el equipo tiene su propio minuto (6–7). Muestra los accesos del Panel (§304); Martín con el globito en Perfil (§305) y el aviso del Inicio → Aceptar → Abrir el panel (§301); y Sofía, desde "Equipos" de su perfil, con las postulaciones sin responder. La ONG pasa de 4–7 a 4–6. Se sacó la mención al equipo que estaba metida en la fila de la ONG, en medio de la frase de la entrevista.
- Avisa que no se responda la postulación de Martín, porque aprobar o rechazar cancela su entrevista (que se muestra en otro minuto).
- Días antes: el equipo en los datos de demo (paso 2.5 de `DEMO_DATOS`), una captura más y el seed del plan B. El día: una sesión para Martín y Sofía.

### Verificación
- Solo documentación: no se corrieron las suites. Se revisó que los nombres de pantalla y de botón ("Aceptar", "Abrir el panel", "Equipos", "Panel", "Publicar un Momento") coincidan con los de las pantallas y con el paso 2.5 de `DEMO_DATOS`.

### Errores propios
- Ninguno en este cambio.

### ⚠️ NO verificado
- Que el minuto 6–7 alcance: depende de cuánto tarde cambiar de sesión entre Martín y Sofía.

## 307. Documentación al día para la defensa

### Qué se hizo
- **Comparación contra el código:** los 109 endpoints de `routes/`, las 38 tablas, las 36 rutas del frontend y las bibliotecas de `src/lib/` están documentados, y no hay links rotos en los docs vigentes. `API_CONTEXT`, `DATABASE_CONTEXT`, `BACKEND_CONTEXT` y `FRONTEND_CONTEXT` no necesitaron cambios.
- **`README.md`:** 38 tablas (decía 36); entrevistas, equipo y patrocinio por acuerdo en las funciones y los roles; `/api/patrocinios` y `/api/equipo` en las rutas; números de calidad del corte `f4e2995` (eran los del 23/10).
- **`GUION_DEFENSA.md`:** números, cobertura y complejidad al último corte (`routes/projects.js` está en 265, no en 257). Se sacó del trabajo futuro el chat empresa ↔ ONG, que ya existe.
- **`PLAN_CIERRE.md`:** reescrito con lo que falta al 4/11. Lo hecho se sacó, los datos de prueba de producción dejaron de figurar como pendiente, y se sumó Cloudinary por carpetas. La base de Render quedó primera después de la defensa.
- **`DEMO_DATOS.md`:** Martín y Sofía con su papel en el equipo en la tabla de cuentas, y la sección 2.5 después de la 2.4.
- **`METRICAS.md` §9:** corte final de `f4e2995`. Se sacó el "no verificado" de las calificaciones A/A, que ya salen de análisis del CI.
- `PLAN_EQUIPOS.md` (encabezado contradictorio), `PROJECT_CONTEXT.md` (fecha) y `docs/README.md` (índice).
- **Hallazgo:** `deploy.yml` no filtra por rutas, así que un push de solo documentación también despliega. Quedó escrito en `GUION_DEFENSA.md` y `PLAN_CIERRE.md`.

### Verificación
- Solo documentación: no se corrieron las suites, porque el código no cambió desde `f4e2995`.
- Cobertura: del `lcov.info` de los artefactos del CI 41149847508 (backend, `backend-sqlite-0`; frontend, `frontend-tests-0`). Sonar: API pública, análisis de `f4e2995`. Pipeline: `gh run list`. `/health` y `npm audit` (0 y 0), corridos el 4/11.
- La comparación con el código es por script (texto contra texto): dice que cada cosa está nombrada, no que su descripción sea exacta.

### Errores propios
- El `README.md` quedó atrás desde §293: los cambios de esas secciones actualizaron los `*_CONTEXT.md`, pero no el `README`.
- `GUION_DEFENSA.md` decía que `routes/projects.js` bajó a 257 sin aclarar que después subió a 265. El dato estaba en `METRICAS.md` §8.

### ⚠️ NO verificado
- Si el paso 2.5 de `DEMO_DATOS` ya está cargado en producción: no se ve desde afuera sin sesión.
- Los mensajes del log de arranque de Render (el punto sigue abierto en el guion).
- **Commit local, sin push:** va después de la defensa, para no desplegar. Hasta entonces, GitHub muestra los docs anteriores.

## 308. Plan B local probado de punta a punta

### Qué se hizo
- Se probó el plan B en la notebook: `db:reset`, la API y Vite, y el recorrido del guion en Chrome.
- `GUION_DEFENSA.md` §6 suma "Plan B local: cómo se usa": la API con `npm start`, cuentas del seed contra las del guion, lo que hay que hacer en vivo y cómo volver a cero. `PLAN_CIERRE.md`, al día.

### Verificación
Con una base temporal (`SQLITE_PATH`) y, desde la entrevista en adelante, sin claves de Resend ni Cloudinary, para no mandar mails ni subir archivos. Sin errores en la consola del navegador en las pantallas donde se la leyó.
- **Voluntaria:** portada, login por la interfaz, Inicio, Explorar con "Para vos", mapa (10 pines), detalle, Mis voluntariados, Configuración, Asistente y un mensaje a la ONG, que la ONG recibe.
- **ONG:** Panel con embudo, accesos, equipo y postulación sin responder.
- **Equipo:** el aviso y el globito de Lucía, Aceptar, panel de Comunicación; Sofía por "Equipos" y panel de Coordinación con la postulación de Juan.
- **Entrevista:** agendada por Sofía desde la pantalla; Juan ve el chip, Google Calendar y `.ics`.
- **Patrocinio:** las dos partes aceptan en la pantalla del acuerdo (puntos y mensaje cargados por API). "Acuerdo cerrado: Aceptado", "Patrocinado por TechCorp" sin montos y panel de la empresa.
- `db:reset` también anduvo sobre una copia de `backend/data/voluntariar.sqlite` (13/10): 38 tablas, 9 usuarios, 12 proyectos, 2 miembros. El original no cambió (mismo md5).

### Hallazgos
- **`npm run dev`:** `node --watch` reinició la API dos veces sin cambios en el código ("Change detected" en archivos de `node_modules`), e Inicio mostró "No pudimos cargar tu feed" después del login. Con `npm start`, el login completo por la interfaz cargó bien el Inicio. Producción usa `npm start`: no le pasa.
- **`db:reset` no vuelve a cero:** el seed es idempotente; las entrevistas, los acuerdos, los mensajes y la aceptación de Lucía quedan.
- **Seed:** no trae entrevistas, acuerdos, Momentos ni conversaciones.
- **`NGOProjectDetail.tsx:170`:** `toLocaleString()` sin idioma muestra `$8,500` en un Chrome en inglés; el resto de la app usa `es-AR`. Sin arreglar: no se despliega hasta después de la defensa.

### Errores propios
- Antes de esto, `GUION_DEFENSA.md` indicaba `npm run dev` para la API y no avisaba que el seed no vuelve a cero.
- En el recorrido usé una ruta inexistente de la pantalla (`/my-volunteering`) y otra de la API; clicks fuera del campo cuando cambió el tamaño de la ventana. Ninguno es un defecto de la app.

### ⚠️ NO verificado
- Que el watcher sea la causa del error del feed: coincide, y sin él no volvió a pasar, pero es **una** falla y **un** login limpio. No se reprodujo a propósito. Tampoco se sabe por qué `node --watch` ve cambios en `node_modules`.
- Sin internet: las imágenes de ejemplo, los avatares y el mapa dependen de servicios externos.
- Con Node 22, la versión del CI y de Render: acá corrió Node 24.
- Subir fotos o CV, y mails: se dejaron apagados a propósito. Donar: no está configurado en local.
- Chat en tiempo real entre dos sesiones: el mensaje llegó a la ONG por la API, no se vio en una segunda pantalla abierta.
- Celular: todo fue en escritorio, en tema oscuro.
- **Commit local, sin push**, igual que §307.

## 309. Plan hasta la presentación final

### Qué se hizo
- `PLAN_FEBRERO.md`: etapas hasta la presentación final, con la devolución de los directores del 5/11 y lo que le toca al usuario. `PLAN_CIERRE.md` y `docs/README.md` apuntan a ese plan.
- Informe de Mercado Pago, fuera del repo: Checkout Pro, Suscripciones, comisiones oficiales vigentes desde el 6/3/2026, requisitos y aspectos fiscales.

### Verificación
- Solo documentación: no se corrieron las suites. El informe cita páginas abiertas el 5/11. Las de costos y Mercado Libre Solidario rechazaron la lectura automática y se leyeron desde Chrome.

### Errores propios
- La comisión de referencia del IPI (6,29 %) es la de CABA, no la de Córdoba (6,60 %). Quedó anotado en el plan: el IPI está fuera de git.

### ⚠️ NO verificado
- Si Suscripciones funciona con el token de cada ONG por OAuth, los costos propios de Suscripciones y Link de pago, y si hay tarifa especial para ONG.
- Si una donación por Mercado Pago es deducible de Ganancias.
- El orden de las etapas 3 y 4 es una propuesta: el usuario no lo confirmó.
- **Commit local, sin push**, igual que §307 y §308.

## 310. Base de producción en Neon

### Qué se hizo
- La base gratuita de Render vencía el 14/11/2026. El usuario eligió Neon (plan gratis, no vence; se suspende sin uso y se despierta sola). Proyecto en Neon con Postgres 18, la misma versión que la de Render.
- Copia de los datos con `pg_dump -Fc --no-owner --no-acl | pg_restore` (imagen `postgres:18`), corrida por el usuario para que las cadenas no pasaran por el chat. Se conservan la vinculación de Mercado Pago de la ONG SANTI y el proyecto "Test" del E2E.
- `render.yaml`: `DATABASE_URL` pasa de `fromDatabase` a `sync: false` (cadena directa de Neon, sin pooling, cargada en el panel) y se quita el bloque `databases`. README, `PROJECT_CONTEXT.md` y `PLAN_FEBRERO.md` al día.
- El backend no cambia: con `DATABASE_URL` ya conecta por SSL (`src/db/index.js`).

### Verificación
- Conteo de filas de cada tabla en las dos bases (`query_to_xml` sobre `information_schema.tables`): 38 tablas, archivos idénticos byte a byte (13 usuarios, 65 donaciones, 1 cuenta de MP vinculada).
- No se corrieron las suites: no cambia código.

### Errores propios
- Primero propuse el comando con `postgres:16` sin saber la versión de Render; era 18 y se corrigió antes de correrlo.

### ⚠️ NO verificado
- Cómo toma Render el paso de `fromDatabase` a `sync: false` al sincronizar el blueprint, y si quitar la base del blueprint la borra antes del 14/11.
- Que la API funcione contra Neon: se verifica con el Deploy (smoke + E2E) de este commit.
- Prod corre en Postgres 18 y el CI prueba en 16 (ya era así con Render).

## 311. Devoluciones y contracargos de donaciones

### Qué se hizo
- `applyPayment` revierte una donación acreditada cuando Mercado Pago informa que **el pago que la acreditó** quedó `refunded` (devolución total) o `charged_back` perdido.
  - Un contracargo en disputa (`in_process`) o ganado por la ONG (`reimbursed`) no cambia nada; un `status_detail` desconocido se trata como perdido.
  - En una transacción: compare-and-swap `completada` → `reembolsada` (con `external_payment_id` igual al pago) y `recaudado` baja sin quedar negativo. Después del COMMIT, notificación `donation_reversed` a la ONG. Resultado `reversed` en el log.
  - Una donación revertida no se vuelve a acreditar. Una pendiente con el pago devuelto sigue pendiente (solo anota `external_status`).
- Webhook: acepta `type=topic_chargebacks_wh` (y `chargebacks`) con la misma firma. Consulta el contracargo (`payments.getChargeback`, nuevo) y repasa cada pago con `applyPayment`.
- `payments.getPayment` devuelve `statusDetail`. Frontend: `donation_reversed` lleva al voluntariado en el panel de la ONG.
- Prueba de Suscripciones (Etapa 1): el usuario la pospuso. El script quedó fuera del repo.

### Verificación
- Tests primero: 20 de integración (`donaciones-reversiones.test.js`, con avisos concurrentes), 5 unitarios de `getChargeback` y 2 ajustados de `getPayment`, 1 del frontend. Rojo antes del cambio (el de integración, primero *cancelled* porque `getChargeback` no existía; con la función, 15 fallas reales).
- Backend: 1117/1117 en SQLite, 1117/1117 con `TZ=America/Argentina/Cordoba`, 1119/1119 en Postgres **16 y 18**. Scripts del CI: 38/38. Frontend: 1214/1214, typecheck sin errores. `npm audit`: 0 en los dos paquetes.
- Mutation testing a mano sobre el código nuevo, con corrida de control: 27 mutantes, sobrevivieron 2. Uno no era equivalente (sacar `payment_id` del contracargo): se sumó un test. El otro sí lo era (`data.id ?? id` contra `id`): se simplificó el código. Final: 26 mutantes, 0 sobreviven.

### Errores propios
- Un `\d` se perdió al escapar el script de edición (quedó `/^d{1,30}$/`); lo detectó el test unitario.
- El test de la notificación hacía `JSON.parse` de `data`, que en Postgres es JSONB y llega como objeto: falló solo en `test:pg`.

### ⚠️ NO verificado
- La documentación oficial está incompleta: las páginas de referencia de `GET /v1/chargebacks/{id}` y `GET /v1/payments/{id}` dieron 404. Sin confirmar: que el aviso de contracargo venga con `type` y `data.id` en la query y firmado como el de pagos; los campos exactos del contracargo; y los `status_detail` de `charged_back` en la API de Payments (la tabla leída es de la API de Orders).
- Que una devolución dispare un aviso `payment` (si no llega, la donación sigue `completada`).
- Con credenciales de prueba, Mercado Pago puede no mandar avisos: no se probó en vivo. Falta activar el evento **Contracargos** en el panel de Webhooks.
- La devolución parcial no se trata. La interfaz de la notificación no se vio.

## 312. Tests de Postgres en la versión 18

### Qué se hizo
- Producción corre Postgres 18 en Neon (§310) y el CI probaba en 16. El servicio del CI pasa a `postgres:18`; `CLAUDE.md` y `calidad/COMO_CORRER_PRUEBAS.md` dan el `docker run` con 18. El contenedor y la imagen locales de 16 se borraron.
- Las métricas y registros del informe del TP (`calidad/METRICAS.md`, `REGISTRO_DEFECTOS.md`, `PLAN_PRUEBAS.md`, `HERRAMIENTA_NUEVA.md`) siguen diciendo 16: describen lo que se midió en ese momento.

### Verificación
- `npm run test:pg` local contra `postgres:18`: 1119/1119 en UTC (§311) y 1119/1119 con `TZ=America/Argentina/Cordoba`. El CI con 18 se verifica con este push.

### Errores propios
- Ninguno.

### ⚠️ NO verificado
- Nada más allá de lo que confirme el CI.

## 313. Desvinculación de Mercado Pago (aviso `mp-connect`)

### Qué se hizo
- El webhook procesa `type=mp-connect`, el aviso que manda Mercado Pago cuando una ONG vincula o desvincula la aplicación. La documentación confirma que el tópico existe y que revocar el acceso borra los tokens, pero no muestra el formato del aviso.
- Por eso el aviso solo dispara una verificación. Se juntan los ids de vendedor (`data.id` de la query, que está firmado, y `user_id` del cuerpo, que no), solo numéricos y sin repetir. Por cada uno que sea de una ONG vinculada, `sellerAccounts.checkRevoked` (nuevo) prueba su token con `GET /users/me`:
  - 401 → `markNeedsReconnect` (ya existía): la cuenta pasa a `requiere_reconexion`, se oculta el botón de donar y la ONG recibe `mp_reconnect_needed`;
  - el token anda (vinculación nueva o aviso falso) → no cambia nada;
  - ya requería reconexión → no consulta ni avisa de nuevo;
  - Mercado Pago caído o falta `MP_TOKEN_KEY` → 500, para que Mercado Pago reintente.
- Un aviso `mp-connect` firmado sin `data.id` no es un 400.

### Verificación
- Tests primero: 12 de integración (`mp-desvinculacion.test.js`). Rojo con 8 fallas reales antes del cambio.
- Backend: 1129/1129 en SQLite, 1131/1131 en Postgres 18, y lo mismo con `TZ=America/Argentina/Cordoba`. `npm audit` en 0. El frontend no cambió (`mp_reconnect_needed` ya tenía destino): no se corrió.
- Mutation testing a mano con corrida de control: 15 mutantes, sobrevivieron 3. Dos no eran equivalentes y se sumaron tests: el log con "ONG null" para un vendedor desconocido, y sin `MP_TOKEN_KEY` respondía 200 en vez de 500. El tercero es equivalente: sacar el filtro de ids numéricos no cambia nada, porque `mp_user_id` siempre es numérico. El filtro queda como defensa. Final: 1 sobreviviente, equivalente.

### Errores propios
- Otra vez se perdió un `\d` al escapar el script de edición (como en §311); lo agarraron los tests. Para regex, editar con `Edit`.

### ⚠️ NO verificado
- El formato real del aviso `mp-connect`: si trae el vendedor en `data.id`, en `user_id` o en otro campo, y si viene firmado como los de pagos. Si el vendedor viene en otro campo, el aviso no hace nada (la cuenta se marca igual en la próxima donación, cuando Mercado Pago rechace el token).
- Que `GET /users/me` responda 401 después de revocar. La guía dice que se borran los tokens, pero no se probó en vivo; el OAuth no se puede probar sin las credenciales productivas.
- Falta activar el evento **Vinculación de aplicaciones** en el panel de Webhooks.

## 314. Iniciar sesión con Google

### Qué se hizo
- Decisiones del usuario (9/11): pantalla de rol la primera vez; un mail que ya tiene cuenta se vincula solo si Google lo da por verificado; verificación con la librería oficial `google-auth-library`.
- Backend:
  - `lib/googleAuth.js` verifica el ID token (firma, emisor, vencimiento y audiencia igual a `GOOGLE_CLIENT_ID`).
  - `routes/authGoogle.js`: `POST /api/auth/google` y `/google/register`. El segundo paso vuelve a verificar la misma credencial, sin estado en el servidor.
  - `users.google_sub` (UNIQUE). Vinculación con compare-and-swap. Tope de 60 pedidos por IP en 15 minutos.
  - `lib/accounts.js`: validación y alta de usuario + perfil, sacadas de `/register` y compartidas (regla 3).
  - `google-auth-library` fijada en 11.3.1, la última con más de dos semanas: la 11.3.4 había salido ese mismo día.
- Frontend:
  - `lib/googleSignIn.ts` carga el script de Google Identity Services una sola vez y dibuja su botón.
  - `AuthModal`: "Continuar con Google" en las dos pestañas, solo con `VITE_GOOGLE_CLIENT_ID`, y `GoogleSignupForm` (rol y nombre). `RolePicker` y `useGoHome` reemplazan el bloque de rol y las tres navegaciones repetidas.
- `.env.example` de los dos paquetes, README, `API_CONTEXT`, `DATABASE_CONTEXT`, `FRONTEND_CONTEXT`, `PROJECT_CONTEXT` y `PLAN_FEBRERO`.

### Verificación
- Tests primero:
  - Backend: 8 unitarios y 19 de integración. El rojo empezó débil (el módulo no existía); con la librería escrita, las rutas fallaban 16 de 16.
  - Frontend: 6 de `googleSignIn`, 8 del modal y 2 del contrato de `api.ts`.
- Backend: 1156/1156 en SQLite y 1158/1158 en Postgres 18, también con `TZ=America/Argentina/Cordoba`. Frontend: 1230/1230, typecheck sin errores, build bien. `npm audit` en 0 en los dos paquetes.
- Mutation testing a mano con corrida de control: 37 mutantes, sobrevivieron 8. Se corrigieron así:
  - Dos ramas eran código muerto o redundante (`not_configured` después de `isConfigured()`, y el chequeo previo de `google_sub` antes del compare-and-swap): se sacaron.
  - Se sumaron tests: el mensaje del 409, la carrera de vinculación hecha determinística (se intercepta el `UPDATE`) y cerrar y reabrir el modal en la pantalla de rol.
  - Final: 35 mutantes, 0 sobreviven.

### Errores propios
- Dejé en un test del modal un `getByLabelText` mal escrito, que habría tirado error. Lo vi antes de correrlo.
- La primera corrida del frontend con cobertura falló por el test de contrato de `api.ts`: faltaban los dos métodos nuevos.

### ⚠️ NO verificado
- **El login real con Google**: falta el Client ID. Tampoco se probó el botón de Google en el navegador ni el popup en el celular.
- Falta cargar `GOOGLE_CLIENT_ID` (API) y `VITE_GOOGLE_CLIENT_ID` (sitio) en Render. Eso toca `render.yaml`, que necesita OK del usuario.
- Una corrida de `npm run test:coverage` dio 1 falla y no se pudo saber cuál: en 4 corridas más y 10 de los archivos nuevos no se repitió. Puede ser uno de los tests que pasan los 5 s en esa corrida.

## 315. Fechas de los voluntariados y Calendar

### Qué se hizo
- Los voluntariados no tenían fechas: `projects.fecha_inicio` y `fecha_fin` existían desde el principio, pero ninguna ruta las usaba. Decisión del usuario (9/11): fecha de inicio y de fin opcionales, con hora de inicio y de fin opcional.
- Backend:
  - Columnas nuevas `hora_inicio` y `hora_fin`.
  - `readSchedule`/`scheduleError` en `routes/projects.js`: las mismas reglas en el alta y en la edición parcial (lo que viene + lo que ya estaba).
  - `fmt` devuelve `start_date`, `end_date`, `start_time` y `end_time`; `GET /enrollments/my` también.
- Frontend:
  - "¿Cuándo es? (opcional)" en el paso 2 de `CreateVoluntariado`, con validación espejo en `projectForm.ts`.
  - `calendar.ts`: `projectEvent` y eventos de día completo (`VALUE=DATE`, fin exclusivo). La entrevista no cambia.
  - `scheduleLabel` en `projectFacts.ts`. El detalle del voluntariado y "Próximos" (solo aprobados) muestran cuándo es, con Google Calendar y el .ics.
  - Con hora de inicio: evento con hora si es un solo día o tiene hora de fin; sin hora de fin dura una hora, como la entrevista. Si no, es de día completo.

### Verificación
- Tests primero: backend 23 (`projects-schedule.test.js`; rojo con 21 fallas reales). Frontend: 9 de `calendar`, 4 de `projectForm`, 3 de `scheduleLabel` y 7 de pantallas (formulario, detalle y Mis voluntariados).
- Backend: 1179/1179 en SQLite y 1181/1181 en Postgres 18, también con `TZ=America/Argentina/Cordoba`. Frontend: 1253/1253, typecheck sin errores, build bien; 8 corridas seguidas con cobertura sin fallas. `npm audit` en 0 en los dos paquetes.
- Mutation testing a mano con corrida de control: 40 mutantes, sobrevivieron 4, ninguno equivalente. Se sumaron casos: "solo hora de fin" en el backend y en el formulario, `fromProject` con fecha de fin, y la pendiente en la pestaña Postulaciones. Final: 40 mutantes, 0 sobreviven.

### Errores propios
- Escribí `interface Project {…} & ProjectSchedule`, que no es TypeScript válido. Se cambió por `extends` antes de correr nada.
- Los tests de `scheduleLabel` se escribieron antes que la función, pero no se corrieron en rojo antes de implementarla.
- `MyParticipationSchedule` guardaba la fila antes de que la pantalla se terminara de redibujar. Primero lo atribuí mal a los espacios de la fecha y agregué una normalización que no hacía falta (la saqué). Después falló 1 de 4 corridas con cobertura; se arregló consultando la pantalla con `waitFor`.

### ⚠️ NO verificado
- Que Google Calendar, Outlook y Apple abran bien los eventos (con hora y de día completo): no se probó en un calendario real. Tampoco se vieron los campos de fecha y hora en el navegador ni en el celular.
- Las fechas no avisan si son pasadas. Los voluntariados existentes siguen sin fecha hasta que la ONG la cargue.

## 316. Client ID de Google en Render

### Qué se hizo
- `render.yaml`: `GOOGLE_CLIENT_ID` (API) y `VITE_GOOGLE_CLIENT_ID` (sitio) con el ID de cliente que creó el usuario en Google Cloud. No es secreto: va como valor, no `sync: false`. Con el OK del usuario (archivo de "no tocar sin avisar").
- Por si el blueprint no se sincroniza solo, el usuario carga las dos variables también en el panel de Render.

### Verificación
- Con el Deploy de este push, más la revisión en Chrome descrita en el informe al usuario.

### Errores propios
- Ninguno.

### ⚠️ NO verificado
- Si Render aplica solo los cambios de `render.yaml` (sincronización del blueprint).

## 317. Validación de ONG: backend (el frontend sigue en otra sección)

### Qué se hizo
- Decisiones del usuario (10/11): admins por `ADMIN_EMAILS` (sin rol nuevo: el CHECK de `users.role` no se puede cambiar en SQLite, regla 12); CUIT + tipo de personería + estatuto y constancia en PDF privados (como el CV); "validada" es solo la insignia.
- Tabla `ngo_validaciones` (una por ONG). `lib/ngoValidation.js`: estados, personerías, `requireAdmin`, `isAdmin` y `verifiedSql` (la insignia se calcula con EXISTS).
- `/api/ngos/me/validacion` (GET, POST multipart con regla 24, GET documento con link firmado) y `/api/admin/validaciones` (listar, documento, aprobar, rechazar con motivo de 10 a 500; compare-and-swap; aviso y mail después).
- `/auth/me` devuelve `is_admin`; `fmtNgo` trae `verified` y los proyectos `ngo_verified`; borrar la cuenta borra también estos PDF.

### Verificación
- 26 tests nuevos (`ngo-validacion.test.js`), primero en rojo (26 de 26). Backend: 1205/1205 en SQLite y 1207/1207 en Postgres 18, también en Córdoba. `npm audit` en 0.
- Mutation testing a mano: 31 mutantes, sobreviven 3. Dos son equivalentes: el atajo con `ADMIN_EMAILS` vacía, y pasar el mail de la base a minúsculas (el registro siempre lo guarda en minúsculas). El otro no: el `AND estado='rechazada'` del reenvío solo importa en una carrera y no tiene test.

### Errores propios
- En el test usé mails que no estaban en el seed y un token de borrado en hex (la app usa base64url). Además, el tope de envíos se gastaba entre tests. Lo corregí en el test.
- `ngo_verified` rompió dos tests de forma (regla 10) hasta agregarlo también en `ngoProjects`.

### ⚠️ NO verificado
- **Falta el frontend** (pantalla "Validar la ONG", panel de admin, insignia) y cargar `ADMIN_EMAILS` en Render. La API sola no se ve.
- El test de la carrera del reenvío. La subida real a Cloudinary (los tests usan dobles).

## 318. Validación de ONG: frontend

### Qué se hizo
- `api.ts`: `ngos.validation` (`get`, `submit` multipart, `document`) y `admin.validations` (`list`, `document`, `approve`, `reject` con `reason`); tipos `NgoValidation`, `AdminValidation`, `SignedLink`; `is_admin` en `/auth/me`, `NGO.verified` y `Project.ngo_verified`.
- `AuthContext`: `isAdmin`, de `/auth/me` al recargar y, después de entrar, con un pedido aparte (el login no lo trae). Una respuesta que llega después de cerrar la sesión no cuenta. Es cosmético: la API vuelve a controlar `ADMIN_EMAILS` en cada pedido.
- `/ngo/validacion` (`NGOValidationScreen`): chip de estado, los tres pasos de DESIGN.md, formulario con los chequeos y mensajes del backend (`lib/ngoValidation.ts`), motivo del rechazo y reenvío, y los PDF con link firmado. Acceso desde el Panel (`NGOValidationCard`; la grilla de accesos pasa a dos columnas) y desde Configuración.
- `/admin/validaciones` (`AdminValidations`, en Root: cualquier rol): "En revisión"/"Todas", PDF, "Aprobar" con confirmación y "Rechazar" con motivo; 403 → "solo para el equipo de VoluntariAR". El link en Configuración, solo con `isAdmin`.
- Insignia `VerifiedBadge` (`text-brand-text`) en el perfil público de la ONG, el detalle del voluntariado y la tarjeta del inicio. Las notificaciones `ngo_validation_*` llevan a `/ngo/validacion`.
- `openCv` pasa a usar `openSignedLink(getLink)` (`lib/cv.ts`), que también abre los PDF de la validación.
- Se documentan en `API_CONTEXT.md` y `DATABASE_CONTEXT.md` los endpoints y la tabla de §317, que habían quedado afuera.

### Verificación
- Frontend: 1319/1319 (antes 1253; +66), `npm run typecheck` sin errores, `npm audit` en 0. Cobertura: sentencias 91,27 %, ramas 87,93 %, funciones 87,87 %, líneas 93,87 %. Los archivos nuevos: `AdminValidations` 100 % de líneas (ramas 94,87 %), `NGOValidation` 100 % (ramas 94 %), `ngoValidation.ts` y `VerifiedBadge` 100 %.
- Tests primero: 8 fallas de comportamiento y 5 archivos que no cargaban porque el módulo no existía (rojo débil).
- Mutation testing (script con corrida de control y respaldo de `src`): 44 mutantes, sobreviven 3, los tres equivalentes en los flujos actuales:
  - `setIsAdmin(false)` al iniciar una sesión: siempre se entra sin sesión, y `logout` ya lo pone en false.
  - `if (sending) return;` en el envío: el botón está deshabilitado mientras manda, y con el botón deshabilitado el formulario no se envía con Enter.
  - `setRejecting(false)` después de rechazar: con la fila ya rechazada, el campo del motivo no se dibuja igual.
- Backend sin cambios en esta sección (sigue el de §317: 1205 en SQLite y 1207 en Postgres).

### Errores propios
- Escribí `api.ts` antes que sus casos del test de contrato: esos casos nunca estuvieron en rojo.
- Un test de `isAdmin` esperaba el usuario guardado, pero el montaje anterior ya lo había reemplazado en `localStorage`. Lo corregí en el test.
- El commit de §317 no documentó los endpoints ni la tabla en los `*_CONTEXT.md` (regla 9); quedó en este.

### ⚠️ NO verificado
- Todo lo visual: no veo la interfaz (chips, la grilla de dos columnas del Panel, la insignia en claro y oscuro más allá del token).
- La subida real a Cloudinary y la apertura real de los PDF firmados (los tests usan dobles).
- `ADMIN_EMAILS` en Render: la carga el usuario. **Riesgo:** el registro con contraseña no verifica el mail, así que un mail de la lista que todavía no tenga cuenta lo puede registrar cualquiera y quedaría como admin. Hay que usar el mail de una cuenta que ya exista y sea suya. Exigirle Google al admin queda ofrecido, sin hacer.
- El índice de `DATABASE_CONTEXT.md` (38 índices) no se revisó: el `UNIQUE` de `ngo_validaciones.ngo_id` crea uno implícito.

## 319. Pantalla de postulaciones: todas las de la ONG, con filtros y decisión en lote

### Qué se hizo
- Pedido del usuario (11/11): una pantalla aparte para manejar más de 200 postulaciones. Decidió **todas las de la ONG juntas** (con filtro por voluntariado) y **acciones en lote con tope de cupos**.
- Backend (`routes/enrollments.js`):
  - `GET /api/enrollments/ngo[?ngo_id=]`: las de todos los voluntariados, con `project_title`, más la lista de voluntariados con sus cupos. Dueña sin `ngo_id`; coordinación activa con él (`ngoAccess`). Tope de 2000 filas con `truncated`.
  - `POST /api/enrollments/bulk { ids, status }`: de 1 a 500, en el orden recibido; cada una con la misma transacción que `PATCH /:id`, que pasó a `applyDecision` (compare-and-swap y cupo atómico, regla 20). Resultado por id (`applied`, `unchanged`, `full`, `stale`, `not_found`) y resumen; 404 si ninguna es gestionable. Avisos después de cada COMMIT; mails después de responder, de a uno y cada 500 ms (`sendSpaced`).
  - `fmtManaged`, `notifyDecision` y `decisionEmail` salen de `PATCH /:id` y `/project/:projectId`, que siguen igual.
- Frontend: `NGOApplications` en `/ngo/postulaciones` y `/equipo/:ngoId/postulaciones` (lógica en `lib/applications.ts`): pestañas por estado con cantidades, filtros (voluntariado con cupos, entrevista, solo con CV, búsqueda sin tildes, orden), de a 50 con "Mostrar más", selección con barra "Elegidas" (confirmación; de la más vieja a la más nueva; tandas de 500; resumen) y acciones por fila. Accesos: primero en `NGOShortcuts`, "Ver todas las postulaciones" en el Panel y en `TeamPanel`.

### Verificación
- Backend: 23 tests nuevos (`enrollments-bulk.test.js`, más 2 en `ownership.test.js`, regla 15). Rojo antes del código: 19 fallas por 404 (endpoints inexistentes). Ahora 1228/1228 en SQLite y 1230/1230 en Postgres 18, en UTC y en `America/Argentina/Cordoba`. `npm audit` en 0.
- Frontend: 1360/1360 (antes 1319; +41), `typecheck` sin errores, `npm audit` en 0. Cobertura: sentencias 91,48 %, ramas 88,15 %, funciones 88,33 %, líneas 94,03 %; `NGOApplications` 100 % de líneas (ramas 95,58 %) y `lib/applications.ts` 100 % (ramas 96,42 %).
- Mutation testing (scripts con corrida de control y respaldo):
  - Backend: 26 mutantes. Sobrevivían 6; con 3 tests más mueren 3. Quedan: dos equivalentes (`req.user.role === 'ngo'`: un voluntario no es dueño de una ONG; `Number(p.cupos)`: INTEGER llega como número en los dos motores) y uno sin test, la relectura del `stale` en el lote, que solo importa en una carrera.
  - Frontend: 36 mutantes. Sobrevivían 4; con un test más muere 1. Quedan tres equivalentes: `sensitivity: 'base'` (el orden en castellano ya junta "Á" con "A"), `scope = ngoId` (la ruta de la dueña no tiene `:ngoId`) y `filtered.length > 0` en "Elegir todas" (sin resultados, el control no se dibuja).

### Errores propios
- La pantalla y `lib/applications.ts` solo estuvieron en rojo porque el módulo no existía (rojo débil); los accesos sí fallaron por comportamiento (4).
- En el test, dos postulaciones podían quedar con la misma fecha (sumaba dos contadores) y el orden empataba; y usé `LIKE` sobre `notifications.data`, que en Postgres es `jsonb` (pasó a `CAST(data AS TEXT)`). Los dos, en el test.
- El test de "Mostrar más" con 120 filas pasaba los 5 s bajo cobertura; lo bajé a 60.

### ⚠️ NO verificado
- Todo lo visual: no veo la interfaz (la barra fija de "Elegidas" sobre la barra inferior del celular, la grilla de filtros, 50 filas en un teléfono).
- El tope real de Resend con muchos mails seguidos: la separación de 500 ms es una precaución, sin dato del proveedor. Los tests no mandan mails.
- El rendimiento con miles de postulaciones reales (los tests llegan a 501 en el frontend y a 500 ids en el backend).
- La carrera del `stale` dentro de un lote (sin test, como el reenvío de §317).

## 320. Barra lateral de la ONG por grupos (escritorio)

### Qué se hizo
- Pedido del usuario (11/11): que en la compu entren mejor las cosas de la ONG y que los botones del costado abran más opciones. Aceptó la propuesta: grupos, nombres desde 1024 px y el Panel más ancho en un commit aparte.
- `navConfig.ts`: `.side` admite grupos (`NavGroup`, `isGroup`, `flatSide`). ONG: **Panel** ▸ Resumen, Postulaciones · Crear voluntariado · **Comunidad** ▸ Publicaciones, Equipo · Patrocinios · Mensajes · Notificaciones · **Mi ONG** ▸ Perfil, Mercado Pago (`/ngo/profile#mercadopago`), Validación, Configuración · Explorar. Postulaciones y Validación no estaban en la barra (solo en las tarjetas del Panel). La barra inferior del celular no cambia; voluntario y empresa siguen sin grupos.
- `isActive(item, pathname, hash)`: un destino con ancla se marca solo con su ancla; el mismo destino sin ancla deja de marcarse cuando hay una.
- `AppShell.tsx`: `SideGroup` es un acordeón con nombres (de a un grupo abierto: el de la pantalla actual, que se puede cerrar a mano) y un panel flotante (`role="group"`, `position: fixed`) con solo íconos, que se cierra con Escape (el foco vuelve al botón), con un clic afuera, al sacar el foco con Tab o al cambiar de pantalla. `useWide` lee `(min-width: 1024px)`.
- Los nombres de la barra aparecen desde **1024 px** (antes 1264) para todos los roles: en una notebook quedaba solo con íconos. Ítems de 44 px (antes 48), subítems de 36 px; la lista hace scroll si no entra (barra fina con nombres, oculta con solo íconos).
- Sin contador en Postulaciones: la única API que las cuenta devuelve hasta 2000 filas y pedirla en cada cambio de pantalla es caro. Encaja con las notificaciones instantáneas.

### Verificación
- Frontend: 1385/1385 (antes 1360; +25 en `SideNavGroups.test.tsx`, uno de `AppShell.test.tsx` adaptado a `flatSide`), `typecheck` sin errores, `npm audit` en 0. Cobertura: sentencias 91,63 %, ramas 88,34 %, funciones 88,54 %, líneas 94,15 %; `AppShell.tsx` 98,14 % de líneas (ramas 94,4 %).
- Rojo antes del código: 18 de 19 fallaban por comportamiento (pasaba el de la barra del celular, que no cambia).
- Mutation testing (script con corrida de control y el original en memoria): 23 mutantes. Sobrevivían 7; con 4 tests y 2 comprobaciones más mueren 6. Queda uno equivalente: el estado inicial del acordeón en `null` (el efecto lo corrige al montar).
- Chrome, en local con la base del seed (ONG Sustentando): acordeón a 1517 px, panel flotante a 900 px y a 1024 px sin scroll horizontal (iframe, porque `resize_window` no cambió el ancho), tema claro y oscuro, navegar desde el panel flotante.

### Errores propios
- La primera versión dejaba abrir varios grupos: en Chrome, con 633 px de alto, la barra desbordaba y los ítems se aplastaban. Pasó a un grupo abierto, ítems sin encogerse y scroll (con dos tests nuevos).
- Oculté la barra de scroll también con nombres y "Mi ONG" y "Explorar" quedaban fuera de vista sin ninguna pista; ahora se ve fina con nombres.
- `sed -i` pasó `AppShell.tsx` de CRLF a LF (trampa ya anotada); lo volví a CRLF con Node. Un `cat >` sin entrada colgó un comando y dejó un archivo vacío fuera del repo, que borré.

### ⚠️ NO verificado
- Una notebook real (los anchos se probaron con un iframe dentro de Chrome) y otros navegadores: `scrollbar-width` en Firefox y Safari, y el cierre por foco en Safari (los tests cubren el caso sin `relatedTarget`).
- Tablets táctiles entre 768 y 1023 px (el panel flotante se abre con un toque; no se probó con el dedo).
- El celular no cambia en el código; no lo miré en Chrome.

## 321. Panel de la ONG más ancho, en dos columnas desde 1280 px

### Qué se hizo
- Segunda parte del pedido de §320. El Panel llegaba a 1100 px: en una pantalla grande sobraba espacio y, en la grilla de abajo (postulaciones al lado de voluntariados), la tabla cortaba "Recaudado" y las postulaciones apretaban los nombres.
- `NGODashboard`: hasta 1400 px. Desde 1280 px, dos columnas: a la izquierda los voluntariados y el embudo; a la derecha (`aside` "Pendientes y accesos", 380 px) las postulaciones sin responder y los accesos de a uno (`NGOShortcuts stacked`). Más angosto, una columna con el orden de siempre (accesos, embudo, postulaciones, voluntariados), sin la grilla de dos que cortaba la tabla. La disposición se elige en JS para dibujar cada pieza una sola vez.
- `lib/useMediaQuery.ts`: el `useWide` de §320 pasó a ser un hook común (`useMediaQuery(query, fallback)`), que también usa la barra lateral.
- Postulaciones del Panel: los botones bajan de línea si no entran al lado del nombre (`flex-wrap`); antes el nombre se cortaba ("Juan…").
- Tabla de voluntariados con `table-fixed` y anchos para Voluntarios y Recaudado. **Defecto previo** encontrado en Chrome: en el celular la tabla medía 433 px en una caja de 339 y "Recaudado" quedaba cortado (un título largo la estiraba).

### Verificación
- Frontend: 1395/1395 (antes 1385; +10: 3 de `useMediaQuery.test.ts` y 7 de `NGODashboardLayout.test.tsx`), `typecheck` sin errores, `npm audit` en 0. Cobertura: sentencias 91,64 %, ramas 88,38 %, funciones 88,54 %, líneas 94,15 %.
- Rojo antes del código: 3 de 5 por comportamiento (los otros 2 protegen el orden en una columna y que nada se dibuje dos veces); el test de la tabla, por comportamiento. El del hook, rojo débil (el módulo no existía).
- Mutation testing (script con corrida de control): 18 mutantes. Sobrevivían 2, ninguno equivalente: el valor por defecto sin `matchMedia` y `md:col-span-2` en los accesos apilados (en una grilla de una columna crea otra implícita). Con un test y una comprobación más, mueren todos.
- Chrome, en local con la base del seed: dos columnas a 1517 px, una columna a 1100 px y el celular a 390 px (iframes), sin scroll horizontal; la tabla entra (339 de 339 px).

### Errores propios
- Lancé la suite completa en paralelo con el arreglo de la tabla y la corrida agarró el test nuevo antes del arreglo (1 falla). La volví a correr entera después: 1395/1395.
- Vite recargó la página al guardar y se perdieron los iframes de prueba; los armé de nuevo.

### ⚠️ NO verificado
- Una pantalla real de 1280 a 1400 px y monitores más anchos (solo la ventana de Chrome de 1517 px y los iframes).
- `NGODashboard.tsx` queda con 80 % de líneas: lo sin cubrir (aceptar o rechazar desde el Panel, la búsqueda) es código de antes que no cambió.

## 322. Postulaciones: sin barra de scroll vertical en las pestañas

### Qué se hizo
- Defecto de §319 visto en Chrome durante §320: las pestañas tienen `-mb-px` (para pisar la línea de abajo) dentro de un contenedor con `overflow-x-auto`, que también corta en vertical; ese píxel de más dibujaba una barra de scroll con flechas al lado de "Todas". Se agregó `overflow-y-hidden`.

### Verificación
- Frontend: 1396/1396 (+1, en rojo antes del arreglo). Mutante único (sacar la clase): muere. Cobertura sin volver a medir (una clase; la última medición es la de §321).
- Chrome: el tablist queda con `overflow-y: hidden` y sin ancho de barra de scroll.

### Errores propios
- Se me escapó en §319: no veía la interfaz y el test no podía notarlo.

### ⚠️ NO verificado
- Otros navegadores.

## 323. Sonar en rojo: promesa sin manejar en el lote de postulaciones y manejadores en un div

### Qué se hizo
- El gate "Sonar way" de SonarCloud pasó a rojo en el análisis de §319 (*Reliability Rating on New Code* C) y el CI siguió verde: el CI no mira ese gate sino el del TP (`.github/scripts/sonar-gate.js`), que solo corta por bugs o vulnerabilidades BLOCKER/CRITICAL, duplicación y cobertura. Las dos issues eran MAJOR.
- `S9383` en `routes/enrollments.js` (§319): `POST /bulk` llamaba a `sendSpaced` sin esperarla ni manejar el rechazo. Un envío que tiraba un error sincrónico rechazaba la promesa, y en Node 22 un rechazo sin manejar tira abajo el proceso. Ahora `sendSpaced` nunca rechaza (`try/catch` por mail: uno que falla no corta a los demás) y la llamada va con `void`.
- `S6848` en `AppShell.tsx` (§320): Escape y la salida del foco del panel flotante estaban como `onKeyDown`/`onBlur` en un `<div>`. Pasaron a listeners en el efecto del panel (junto al del clic afuera), que se sacan al cerrarlo.

### Verificación
- Backend: 1229/1229 en SQLite, 1231/1231 en Postgres 18 y 1229/1229 con `TZ=America/Argentina/Cordoba` (+1: un mail con error sincrónico, otro con rechazo y el tercero sale; rojo antes con "Error: sincrónico"). `npm audit` en 0.
- Frontend: 1399/1399 (+3), `typecheck` sin errores, `npm audit` en 0.
- Mutation testing de los listeners: 6 mutantes; sobrevivían 2 (sacar el `focusout` al cerrar, que dejaba que un grupo ya cerrado cerrara el panel de otro, y no mirar la tecla); con 2 tests más mueren todos. En el backend, volver a `send(m).catch(...)` o sacar el `try` hace fallar el test nuevo; el `void` de la llamada no cambia nada en ejecución (equivalente: es para Sonar y para quien lee).

### Errores propios
- Las dos las metí yo (§319 y §320) y no miré SonarCloud después de pushear: el CI verde no lo dice.

### ⚠️ NO verificado
- Que SonarCloud vuelva a verde: se ve en el análisis del próximo push.

## 324. Acuerdo de patrocinio, paso 1: quién cambió qué, aceptaciones con fecha e historial (backend)

### Qué se hizo
- Rediseño del acuerdo sin el Figma: diseño propio del 11/11 ([lienzo](https://claude.ai/artifact/EvgwaAnYzYoiTzpAPSX6BZ)). El usuario decidió versión nueva al guardar, propuesta con puntos y avanzar paso a paso (plan en `PLAN_FEBRERO.md`, Etapa 2). Este es el paso 1: no cambia cómo se negocia.
- Esquema (aditivo, regla 12): `patrocinio_puntos.editor_id`, y las tablas `patrocinio_cambios` (cada cambio de un punto con su versión, el punto antes y después, quién y cuándo) y `patrocinio_aceptaciones` (cada aceptación de una versión, una por lado y versión).
- `routes/patrocinios.js`: agregar, editar y quitar registran el cambio en la misma transacción que suben la versión (la versión se relee adentro; el `PATCH` y el `DELETE` releen el punto adentro también). `acceptVersion` registra la aceptación (lo usan `…/aceptar` y el `PATCH` de la ONG); proponer la registra en una transacción nueva con la propuesta (`routes/empresas.js`).
- El acuerdo suma `created_by_name`, `edited_by_name` y `edited_at` en cada punto, y `accepted_versions` y `accepted_at`. Endpoint nuevo `GET …/historial`: versiones de la más nueva a la más vieja, con sus cambios y quién las aceptó; solo las partes.
- Frontend: solo el contrato (`api.ts`: campos nuevos, `SponsorshipVersion` y `sponsorships.history`); las pantallas son los pasos 2 y 3.

### Verificación
- Backend: 1239/1239 en SQLite, 1241/1241 en Postgres 18 y 1239/1239 con `TZ=America/Argentina/Cordoba` (+10: 9 en `patrocinio-historial.test.js` y 1 en `ownership.test.js`, regla 15). Rojo antes del código: 8 de 8 por comportamiento. `npm audit` en 0.
- Frontend: 1400/1400 (+1, el contrato de `history`), `typecheck` sin errores, `npm audit` en 0.
- Mutation testing (script con corrida de control y los originales en memoria): 18 mutantes. Sobrevivían 5: dos equivalentes y tres sin test. Saqué el chequeo de versión de `accepted_at` (equivalente: las versiones no se repiten) y pasé las versiones aceptadas a un helper común; con un test y una comprobación más, mueren los otros. Queda uno equivalente: `Number(monto)` (REAL llega como número; corrido solo en SQLite).

### Errores propios
- Un script de edición escrito en una heredoc de bash con backticks escapados no corrió (error de sintaxis del shell, sin tocar nada); hice los cambios con Edit.

### ⚠️ NO verificado
- El efecto en producción de las tablas nuevas: la migración corre sola al desplegar (aditiva, como todo el esquema). No lo pusheé todavía.
- La interfaz: no hay pantallas nuevas en este paso.

## 325. Acuerdo de patrocinio, paso 2: lista única, quién agregó o editó y "cambió desde que aceptaste"

### Qué se hizo
- `SponsorshipAgreementScreen`, según el lienzo del 11/11: las dos columnas pasaron a una sola lista de puntos con filtros por parte (con la cantidad), el total de dinero comprometido y, en cada punto, de qué parte es, quién lo agregó y quién lo editó ("hace 2 h").
- "Cambió desde que aceptaste": si acepté una versión anterior a la vigente y el acuerdo está abierto, la pantalla pide `GET …/historial` (§324) y marca los puntos nuevos o editados desde mi aceptación (con "Antes:" tachado) y avisa los quitados. La lógica está en `changesSince` (`lib/sponsorship.ts`): un punto editado dos veces muestra cómo estaba cuando acepté; uno agregado y quitado después no cuenta. Si el historial falla, la pantalla sigue sin marcas (también borra las de una versión anterior).
- La aceptación dice cuándo aceptó cada parte la vigente y qué versión había aceptado quien no. Desde `lg`, la lista a la izquierda y la aceptación y la charla en una columna de 360 px.
- Todavía cada cambio de un punto es una versión (el borrador con "Guardar cambios" es el paso 4).

### Verificación
- Frontend: 1414/1414 (antes 1400; +14: 6 de `changesSince` y 8 de la pantalla, con los de dos columnas reescritos), `typecheck` sin errores, `npm audit` en 0. Cobertura: sentencias 91,75 %, ramas 88,44 %, funciones 88,66 %, líneas 94,22 %.
- Rojo antes del código: 10 de 19 de la pantalla por comportamiento (los otros 9 son los que no cambian). Los de `changesSince`, rojo débil (la función no existía).
- Mutation testing (script con corrida de control): 22 mutantes. Sobrevivían 3; con un test y una comprobación más mueren 2. Queda uno equivalente: sumar solo los puntos de dinero (el backend no deja monto en otro tipo).
- Chrome, en local con la base de prueba (ONG Sustentando, acuerdo armado por la API sin mails): el aviso con 3 cambios (editado con "Antes:", nuevo y quitado; uno agregado y quitado no aparece), los filtros, la aceptación con las versiones, tema oscuro y claro, y el celular a 390 px sin scroll horizontal.

### Errores propios
- Ninguno nuevo en este paso.

### ⚠️ NO verificado
- La pantalla de la empresa con datos reales (la misma pantalla; la miré como ONG).
- Producción: el paso 1 (§324) todavía no está pusheado, así que el historial no existe allá.

## 326. Acuerdo de patrocinio, paso 3: pantalla del historial de versiones

### Qué se hizo
- `SponsorshipHistoryScreen` en `/ngo/patrocinios/:empresaId/:projectId/historial` y lo mismo bajo `/company`, según el lienzo del 11/11. A la izquierda las versiones de la más nueva a la más vieja (quién la hizo, qué hizo, quién la aceptó); a la derecha el detalle de la elegida: si cada parte la aceptó y cuándo, y cada cambio con Agregó/Editó/Quitó en texto y en el borde (no solo el color), de qué parte es el punto, lo de antes (tachado) y lo de ahora, con el monto.
- La versión 1 sin cambios muestra el mensaje al proponer; si el historial empieza después de la 1 (acuerdos de antes de §324), lo avisa.
- Desde el acuerdo: "Historial de versiones" en el encabezado y "Ver qué cambió" en el aviso de cambios.
- En Chrome, a 390 px, el detalle quedaba debajo de una lista larga y tocar una versión no mostraba nada a la vista: angosto, elegir una versión baja hasta el detalle.

### Verificación
- Frontend: 1428/1428 (antes 1414; +14: 12 de la pantalla, 1 de las rutas y 1 de los links desde el acuerdo), `typecheck` sin errores, `npm audit` en 0. Cobertura: sentencias 91,77 %, ramas 88,48 %, funciones 88,81 %, líneas 94,25 %.
- Rojo antes del código: los links y la bajada al detalle, por comportamiento; la pantalla y las rutas, rojo débil (el módulo no existía).
- Mutation testing (script con corrida de control): 17 mutantes. Sobrevivían 4; con dos tests y una comprobación más mueren 3. Queda uno equivalente: el link al historial como "historial" relativo (el router lo resuelve igual).
- Chrome, en local con la base de prueba: la lista de versiones con el aviso "empieza en la versión 5", el detalle de una edición (antes y ahora) y de un punto quitado con su monto, y el celular a 390 px sin scroll horizontal y bajando al detalle (492 px).

### Errores propios
- En un test, el texto del botón juntaba "Versión 3" con la fecha ("11 nov") y la regex leía "Versión 311"; lo cambié para leer el título.

### ⚠️ NO verificado
- La pantalla desde el lado de la empresa (mismo componente).
- Producción: los pasos 1 a 3 no están pusheados.

## 327. Acuerdo de patrocinio, paso 4: borrador y "Guardar cambios" como una versión

### Qué se hizo
- Decisión del usuario (11/11): la versión nueva se crea al guardar, no por cada punto.
- Backend: `POST /api/patrocinios/:empresaId/:projectId/cambios` `{ version, changes[] }`. Todo en una transacción: compare-and-swap de la versión (si el acuerdo cambió mientras se armaba el borrador, 409 y nada; no se pisa lo de la otra parte), después cada cambio (agregar, editar, quitar) con su registro de §324. Una edición que no cambia nada no cuenta; el tope de 20 por lado se mira después del lote. `mergeEdit` salió del `PATCH` para usarse en los dos. Los endpoints de a un punto quedan (la pantalla ya no los usa).
- Frontend: `lib/sponsorshipDraft.ts` (funciones puras del borrador) y la pantalla del acuerdo: "Listo" pone el punto en el borrador ("Sin guardar"); quitar no pregunta y se puede deshacer ("Se va a quitar"); la barra "Cambios sin guardar" con "Guardar cambios" y "Descartar" (con confirmación). Con borrador no se puede aceptar y cerrar la pestaña pide confirmación. Un 409 recarga el acuerdo y deja el borrador para reintentar.
- Visto en Chrome y corregido en el mismo paso: (1) la barra no quedaba pegada abajo: el `overflow-hidden` de la sección rompía el `sticky`; (2) con un acuerdo de antes de §324 (aceptado en la v1, historial desde la v5), el aviso contaba solo lo registrado: ahora dice "al menos" (o "Hubo cambios") y que lo anterior no se guardaba.

### Verificación
- Backend: 1254/1254 en SQLite, 1256/1256 en Postgres 18 y 1254/1254 con `TZ=America/Argentina/Cordoba` (+15: 14 en `patrocinio-lote.test.js` y 1 en `ownership.test.js`, regla 15). Rojo antes del código: 11 de 11 por comportamiento. `npm audit` en 0.
- Frontend: 1448/1448 (antes 1428; +20), `typecheck` sin errores, `npm audit` en 0. Cobertura: sentencias 91,92 %, ramas 88,59 %, funciones 89,04 %, líneas 94,36 %. Rojo antes del código: 9 de la pantalla y los 2 del historial incompleto, por comportamiento.
- Mutation testing (scripts con corrida de control): backend 18 mutantes, sobrevivían 4 y con 3 tests más queda uno equivalente (el lote vacío da el mismo 400 un paso después). Frontend 21, sobrevivían 5: dos equivalentes que simplifiqué (el JSON descarta `undefined`; los ids `new:` nunca están en el mapa de cambios) y tres sin test, que ahora mueren con 4 tests más.
- Chrome, en local, del lado de la **empresa** (TechCorp): editar y quitar al borrador, la barra pegada abajo, "Estoy de acuerdo" desactivado, guardar (pasó a la versión 11 con un solo pedido) y el aviso "al menos". El `beforeunload` frenó una recarga real de la pestaña con cambios sin guardar.

### Errores propios
- El contrato de `saveChanges` y las funciones del borrador los escribí en el mismo paso que sus tests, sin correr el rojo antes.
- La barra "pegada abajo" no lo estaba (el `overflow-hidden` que yo mismo puse en §325); lo vi recién en Chrome.
- Para recargar la pestaña con cambios sin guardar tuve que descartarlos desde la app: el aviso del navegador frenaba la recarga.

### ⚠️ NO verificado
- El celular con la barra sobre la barra inferior de la app (`bottom` de 56 px más la zona segura): solo lo razoné, no lo miré en un teléfono.
- El diálogo de `beforeunload` en otros navegadores (cada uno muestra el suyo y algunos lo saltean sin interacción previa).
- Producción: los pasos 1 a 4 no están pusheados.

## 328. Historial del patrocinio: los cambios de un lote, en el orden en que se mandaron

### Qué se hizo
- El CI de 8015875 (§327) falló en Backend · SQLite · UTC: los cambios de un lote caen en el mismo milisegundo y el historial los desempataba por el id (al azar), así que a veces salían en otro orden. Columna aditiva `patrocinio_cambios.orden` (`addColumnIfNotExists`, por defecto 0) con la posición del cambio en su lote; el historial ordena por versión, orden, fecha e id.

### Verificación
- Test nuevo con 15 cambios en un lote: rojo 3 de 3 antes del arreglo, verde 3 de 3 después. Backend: 1255/1255 en SQLite, 1257/1257 en Postgres 18 y 1255/1255 en Córdoba.

### Errores propios
- El orden dentro de una versión dependía de la fecha con milisegundos; en mi máquina el test pasaba por suerte. Lo pushée sin verlo: el CI lo atajó y no se desplegó.

### ⚠️ NO verificado
- Los registros de antes de este arreglo (solo en las bases locales de prueba) quedan con orden 0: ordenan como antes.

## 329. Acuerdo de patrocinio, paso 5: proponer con puntos

### Qué se hizo
- Decisión del usuario (11/11): la empresa propone con puntos. Cierra la Etapa 2 de `PLAN_FEBRERO.md`.
- Backend: `POST /api/empresas/me/patrocinios` acepta `points[]` (`{ type, detail, amount? }`, hasta 20), validados con el mismo `pointError` de los cambios. Se guardan en la transacción de la propuesta: del lado de la empresa, en la versión de la propuesta (la 1), cada uno con su registro en `patrocinio_cambios` (en el orden en que llegaron, `orden` de §328) y antes de la aceptación de la empresa, que es de esa misma versión. Re-proponer tras un rechazo: una sola versión nueva con esos puntos; los de antes quedan y el tope de 20 cuenta todos los de la empresa (si se pasa, 409 y la transacción se deshace: sigue rechazado, en su versión y con su mensaje).
- En `routes/patrocinios.js`: `insertPoint` y `checkPointLimit` salieron de los dos lugares que daban de alta un punto (`POST …/puntos` y `POST …/cambios`) y los usa también la propuesta (`proposalPointsError`, `addProposalPoints`). En `POST …/puntos` el tope pasó de mirarse antes del alta (`>= 20`) a mirarse después (`> 20`), dentro de la misma transacción: mismo resultado.
- Frontend: en "Proponer" (`CompanyOwnProfile`), "Qué proponés aportar (opcional)": lista de puntos con editar y borrar (44 px), "Agregar punto" y el formulario del acuerdo, que pasó a un componente (`SponsorshipPointForm`) para las dos pantallas. Los puntos van a un borrador de `lib/sponsorshipDraft.ts` (`toPoints`) y viajan con la propuesta; sin puntos, el pedido de siempre. Con un punto a medio escribir no manda y lo dice. Con 20, deja de ofrecer "Agregar punto".
- Visto en Chrome y agregado en el mismo paso: al volver a proponer, los puntos del acuerdo rechazado siguen en el acuerdo pero el formulario no lo decía. Ahora avisa ("Los puntos de ese acuerdo se mantienen: lo que agregues acá se suma") con un link al acuerdo.
- De la Etapa 4: `POINT_TYPE_LABEL` pasó a `lib/sponsorship.ts` (lo necesitaba el formulario compartido), junto con `formatMoney` y el valor del formulario. El historial dejó de importar de la pantalla del acuerdo.

### Verificación
- Backend: 1282/1282 en SQLite, 1284/1284 en Postgres 18, y lo mismo con `TZ=America/Argentina/Cordoba` en los dos motores (+27, todos en `patrocinio-proponer-puntos.test.js`). Rojo antes del código, por comportamiento (los puntos no se guardaban). `npm audit` en 0.
- Frontend: 1461/1461 (antes 1448; +13: 11 en `ProposeWithPoints.test.tsx`, 1 de `toPoints` y 1 del contrato), `typecheck` sin errores, `npm audit` en 0. Cobertura: sentencias 91,95 %, ramas 88,73 %, funciones 89,13 %, líneas 94,38 %. Rojo antes del código en la pantalla: 8 de 9 (el noveno, "sin puntos sale como siempre", tenía que pasar) y el del aviso.
- Mutation testing (script con corrida de control): backend 37 mutantes, mueren 35; los 2 que sobreviven son equivalentes (el tope mirado antes de la transacción solo ahorra trabajo: adentro se corta igual con el mismo 409; con `[]` solo se evita un `COUNT`). Frontend 45: en la primera corrida sobrevivían 6 y 3 no se aplicaron (ver errores propios); con más aserciones en los tests mueren 42 y quedan 3 equivalentes (`toPoints` con la clave: `body` no la copia; el monto fuera de dinero: el borrador lo deja en null; el aviso con cualquier estado: un proyecto con propuesta vigente nunca queda elegido).
- Chrome, en local (base SQLite aparte, mails desactivados), en claro y oscuro:
  - **Empresa** (TechCorp): armar dos puntos (dinero y voluntarios), el aviso de punto a medio escribir, enviar; el acuerdo quedó en versión 1 con los dos puntos, "Agregado por Admin TechCorp", la empresa de acuerdo; el historial muestra la versión 1 con "agregó 2 puntos". Sin errores en la consola.
  - **ONG** (Banco de Alimentos): ve los puntos sin editar ni borrar (son de la empresa) y rechaza.
  - **Empresa** de nuevo: el aviso de la propuesta rechazada, re-proponer con un punto: versión 2 con ese punto.
  - En un marco de 390 px: sin scroll horizontal, botones de 44×44 y un detalle largo corta en varias líneas.

### Errores propios
- `toPoints` y el contrato de `propose` con `points` los escribí en el mismo paso que sus tests, sin correr el rojo antes (igual que en §327).
- El test de los 20 puntos pasaba solo y fallaba por tiempo (más de 5 s) con toda la suite: 20 altas con `getByRole`. Lo cambié a buscar por texto.
- Tres mutantes del frontend no se aplicaron en la primera corrida: los escribí con `\n` y `CompanyOwnProfile.tsx` es CRLF. El script lo avisó ("0 coincidencias") y los corrí de nuevo.
- Usé `sed -i` sobre el test nuevo del backend (es LF, no cambió) y un heredoc para un script de edición, que falló; seguí con `Edit`.

### ⚠️ NO verificado
- Un celular real: solo el marco de 390 px en Chrome de escritorio.
- El resto de "Proponer" y del perfil de la empresa sigue con los estilos viejos (violeta, grises): lo nuevo usa los tokens, y la mezcla queda para la revisión contra `DESIGN.md`.
- El aviso de propuesta rechazada lo vi solo en claro.
- Si el refresco en caliente de Vite volvió a andar en la pantalla del acuerdo al sacar `POINT_TYPE_LABEL`.
- Producción a mano: después del push (`1088775`) dieron verde el CI (9 jobs), el Deploy (smoke y E2E) y SonarCloud (gate OK, 0 issues abiertas), pero nadie propuso con puntos en la interfaz de producción.

## 330. Revisión de todo el frontend contra `DESIGN.md` (sesión exploratoria #2)

### Qué se hizo
- Pedido del usuario (12/11): revisar todo el frontend contra `docs/DESIGN.md` 1.1, sin arreglar nada (regla 16). Es el punto 2 de "Para retomar" de `PLAN_FEBRERO.md`, pasos a–d. **No se tocó código.**
- **2a, barrido por código:** reglas de "Hacer y no hacer", "Accesibilidad", "Paneles de gestión" y "Comportamiento responsive" buscadas con Grep en los 117 archivos fuente, más un script que lee el alto de cada etiqueta tocable. Hallazgos B1–B11.
- **2b, inventario de pantallas:** cada pantalla contra su sección del diseño, leyendo el código. Tres grupos (I1–I3): las que siguen con la forma vieja, las hechas después del diseño (cumplen las reglas de los paneles y no tienen sección propia) y dónde falta la insignia de verificada.
- **2c, Chrome local:** un script dentro de la página cargó 56 pantallas por rol a 375 y 1440 px, en claro y oscuro (224 corridas), y 7 a 768 y 1024 px; midió scroll horizontal, contraste, botones de ícono de menos de 44 px, texto de menos de 12 px y el uso del azul y el verde. Más unas 15 capturas. Hallazgos C1–C11.
- **2d, registro:** sesión exploratoria #2 en `calidad/SESION_EXPLORATORIA.md`; 8 defectos nuevos, **D33–D40** (3 de severidad media, 5 baja), abiertos en `calidad/REGISTRO_DEFECTOS.md`; el resto queda como deuda de diseño, no como defecto. Una página con la tabla para que el usuario elija las tandas de arreglo.
- Decisión del usuario (12/11): los botones de 40 px y los chips de 32 quedan; los 44 px valen solo para los botones de ícono. `DESIGN.md` → Accesibilidad lo dice así (antes se contradecía con sus propios tamaños).

### Verificación
- No se corrieron las suites: no cambió ningún archivo de código ni de tests.
- Los números de 2a salen de las búsquedas; los de 2c, del script de medición. Los hallazgos C1, C3, C4 y C5 se vieron además en captura.
- La API y Vite locales se cerraron por puerto al terminar; la base de prueba quedó en el scratchpad, fuera del repo.

### Errores propios
- En la primera versión del resumen de 2a conté 69 tocables "de menos de 44 px" sin separar los que siguen los tamaños del propio `DESIGN.md` (40 y 32); lo aclaré en el mismo mensaje y el usuario decidió la regla.
- El primer intento de cargar un cambio en el acuerdo de patrocinio dio 400: mandé el punto anidado (`{ action, point }`) y la API lo espera plano. Era un dato de prueba, no un defecto.
- No guardé las capturas en disco: la página para elegir no las tiene, aunque el plan las pedía.
- Edité `PLAN_FEBRERO.md` y `DESIGN.md` con `Edit`, que les cambia los saltos de línea en la copia de trabajo (`DESIGN.md` quedó `w/crlf`); en el repositorio siguen en LF.

### ⚠️ NO verificado
- Lo que la sesión no cubrió: las hojas de donar, inscribirse y reseñas, el compositor, publicaciones y Momentos con fotos, notificaciones de rechazo, validación y admin con un pedido cargado, el certificado, la navegación a 768 y 1024 px más allá del scroll, el modo oscuro en esos anchos, foco con teclado, texto al 200 %, lector de pantalla y un celular real.
- El contraste de los globitos `bg-ink-muted text-white` en oscuro (2,96:1) y el promedio "4.5" de `ReviewsModal` salen del código: no se vieron.
- Si el mapa de Explorar sin imágenes en oscuro es del entorno de prueba o un defecto.
- En qué otros endpoints haría falta mandar el dato de ONG verificada: se miró el frontend y los `SELECT` que ya lo traen, no cada ruta.
- Los defectos D33–D40 no tienen Issue en GitHub (los anteriores sí): falta que el usuario diga si se abren. `calidad/METRICAS.md` y el informe del TP no se actualizaron (tienen fecha de corte).

## 331. Defectos D33–D36 y D39: scroll horizontal a 375 px y contraste sobre tokens (tandas T1 y T2)

### Qué se hizo
- El usuario eligió las tandas T1 (los tres defectos de severidad media) y T2 (contraste) de la página de §330, y pidió abrir los Issues: **#34–#41** para D33–D40.
- **D33 y D34 (scroll horizontal a 375 px).** El contenido de `AppShell` es un flex en columna: una pantalla cuya raíz lleva `mx-auto` no se estira, toma el ancho de su contenido, y con un texto que no corta quedaba más ancha que la pantalla. Se agregó `w-full` a las 10 raíces con `mx-auto` que no lo tenían (`CompanyDashboard` 3, `NGODashboard` 2, `NGOPatrocinios`, `DeleteAccountPage`, `DonationReturn`, `MercadoPagoReturn`, `ResetPasswordPage`). Test nuevo: `app/layout/pageWidth.test.ts` (mira el código: jsdom no calcula anchos).
- **D35 (botón de la hoja de filtros en oscuro) y los globitos grises de las notificaciones.** `text-white` sobre `bg-ink`, `bg-ink-muted` y `bg-critical` pasó a `text-on-ink`, que cambia con el tema (`FilterModal`, `NotificationsScreen` 4, `CvSection`, `DeleteAccountSection`).
- **D36 (globito de no leídos).** Pasó de `bg-like text-white` a 11 px a `bg-critical text-on-ink` a 12 px (`AppShell` y `NGODashboard`). **Cambia el diseño:** `like` queda solo para el corazón; `DESIGN.md` actualizado.
- **D39.** `gray-400` en claro pasó de #6b7581 a #646e7a en `theme.css` (4,32:1 → 4,79:1 sobre `gray-50`); también `slate-400` y `zinc-400`, que ningún componente usa.
- `paletteContrast.test.ts` ahora mira `text-white` y `text-on-ink` sobre los tokens (antes solo la paleta), los grises contra el fondo de la página y que ningún número sobre `critical` o `like` mida menos de 12 px.
- `REGISTRO_DEFECTOS.md`: D33–D36 y D39 corregidos (37 corregidos, 3 abiertos: D37, D38 y D40).

### Verificación
- Rojo → verde: con el código anterior (`335140c~1`) y los tests nuevos, 3 fallan (10 raíces sin `w-full`, 8 usos de `text-white` sobre tokens, `gray-400` a 4,32:1); con el arreglo, verde.
- Frontend: 1468/1468, `typecheck` sin errores. El backend no se tocó: no se corrieron sus suites.
- Chrome local a 375 px, en claro y oscuro, con el mismo script de medición de §330: `/company/dashboard`, `/ngo/patrocinios`, `/ngo/dashboard`, `/ngo/notifications` y `/privacidad` sin scroll horizontal y sin textos por debajo de 4,5:1. El globito mide 12 px: blanco sobre #d12d21 en claro, #0b0d10 sobre #ff6b5e en oscuro. "Mostrar 12 voluntariados" en oscuro: #0b0d10 sobre #f2f4f7. Captura de las tres pantallas.
- Mutación (28 mutantes: cada línea cambiada vuelve a su versión anterior, más 6 finos sobre el globito y los grises): 25 muertos y 3 vivos, los tres equivalentes (`slate-400` y `zinc-400` no se usan; `gray-400` en #68727e da 4,51:1, que cumple).

### Errores propios
- **El commit `335140c` dejó `REGISTRO_DEFECTOS.md` duplicado** (925 líneas en vez de 483). El script que ponía los enlaces a los Issues usó `String.replace` con un texto que tenía un `$` seguido de un acento grave (en D37), y JavaScript lo tomó como "lo que está antes de la coincidencia": pegó el archivo adentro de sí mismo. Se rearmó desde la versión anterior aplicando solo los 16 enlaces. Los reemplazos de texto en scripts van con `split`/`join` o con una función.
- La sesión del 12/11 se cortó por el límite antes de verificar en Chrome, de correr la mutación y de escribir esta sección: se hizo el 13/11.
- La primera corrida de mutación dejó 3 vivos que no eran equivalentes: el test miraba solo `text-white`, así que `bg-like text-on-ink` en `AppShell` pasaba, y nada miraba los 11 px. Se amplió el test.

### ⚠️ NO verificado
- Un celular real, y los anchos intermedios (se midió a 375 px; a 768 y 1024 px no había scroll antes del arreglo y no se volvió a medir).
- El punto de color de cada categoría en la hoja de filtros sigue sin verse en oscuro (se ve en la captura): es deuda de diseño, quedó fuera de D35.
- Los globitos grises de las notificaciones de rechazo se arreglaron por código y los cubre el test; en Chrome no había ninguna de ese tipo para verlos.
- Los Issues #34–#37 y #40 siguen abiertos: se cierran cuando el CI del push dé verde. `calidad/METRICAS.md` y el informe del TP no se actualizaron (tienen fecha de corte).

## 332. Botones de ícono a 44 px (tanda T4)

### Qué se hizo
- Tanda T4 de la revisión contra `DESIGN.md` (§330, hallazgos B8 y C7): "los botones que son solo un ícono miden al menos 44×44px". No es un defecto del registro: es deuda de diseño.
- **33 botones cuadrados de 28 a 40 px pasaron a `w-11 h-11`** (el ícono de adentro no cambia de tamaño): los "Volver" de `CreateVoluntariado`, `NGOEmpleados`, `NGOKPIs`, `NGOProjectDetail` y `ProjectDetails`; los "Cerrar" de `FilterModal`, `FollowListModal`, `MomentsGrid`, `ReviewsModal`, el formulario de KPI y los dos del mapa; los 11 controles de `ProjectMap`; editar y borrar KPI; CV y mensaje al inscripto; sacar del equipo; retirar propuesta; las flechas de `PhotoCarousel`; quitar foto en `PostComposer`; limpiar búsqueda en Explorar; compartir y las cinco estrellas de `ProjectDetails`.
- **`flex-shrink-0` en los 25 botones cuadrados que no lo tenían.** Con `w-11 h-11` en el código, los "Volver" de `NGOTeam` y del asistente medían 31×44 y 37×44 a 375 px: dentro de una fila flex cedían ancho al texto de al lado.
- **Panel de la ONG:** "Rechazar" y "Entrevista" pierden el texto en el celular y medían 32×36. Ahora miden 44×44 por debajo de 640 px y siguen como estaban desde ahí.
- Test nuevo: `app/layout/iconButtonSize.test.ts` (mira el código: jsdom no calcula tamaños). Ningún botón o enlace cuadrado mide menos de 44 px, todos llevan `shrink-0`, y los dos del Panel tienen su caso aparte.

### Verificación
- Rojo → verde: el test listó los 33 botones antes del cambio.
- Frontend: 1473/1473 (antes 1468; +5), `typecheck` sin errores. El backend no se tocó: no se corrieron sus suites.
- Chrome local, con un script que mide cada botón o enlace sin texto: 36 pantallas (18 de la ONG, 3 de la empresa, 15 de la voluntaria) a 375 y 1440 px. Después del cambio de tamaño quedaban tres casos (los dos "Volver" y los dos botones del Panel); con el arreglo, ninguno, y esas tres pantallas se midieron también a 768 px. Ninguna pantalla con scroll horizontal.
- Capturas a 375 px: Panel de la ONG, detalle del voluntariado (mensaje al inscripto), KPIs (editar y borrar), página del voluntariado (volver, compartir, estrellas), Explorar con el mapa y sus controles, el mapa ampliado, la hoja de filtros, la lista de seguidores y el perfil de la empresa (retirar propuesta). No se vio nada roto ni encimado.
- Mutación (60 mutantes: cada línea cambiada vuelve a su versión anterior): 54 muertos, 0 vivos y 6 que no se pudieron aplicar (seis líneas de `ProjectMap` idénticas entre sí, el script no puede elegir una).

### Errores propios
- El script de T4 solo veía botones con tamaño cuadrado explícito. Los tres casos restantes salieron recién al medir en Chrome; ya estaban anotados en C7 de §330 y no los había pasado a la lista.
- En el barrido, las pantallas comparten la sesión del navegador: al entrar con otra cuenta para la tercera captura, la lista de seguidores de la primera mostró "Requiere rol: volunteer". Es del arnés, no de la app.

### ⚠️ NO verificado
- Un celular real: si los botones más grandes molestan al tocar o tapan algo.
- No se abrieron: la hoja de reseñas, el visor de Momentos, el carrusel de fotos y "Quitar foto" del compositor (la base de prueba no tiene fotos y no se sube nada), el formulario de KPI abierto ni "Limpiar búsqueda" con texto escrito. Sus botones cambiaron por código y los cubre el test.
- El pin del mapa mide 32×38: es un marcador de Leaflet, no un botón de la app; quedó fuera de la tanda.
- En el perfil de la empresa, el título del proyecto se corta antes ("Reforestaci…") porque el botón de retirar ocupa 16 px más.
- Botones de ícono sin tamaño explícito en pantallas que el barrido no abrió (admin, certificado, restablecer contraseña, hojas de donar e inscribirse).

## 333. Defectos D37, D38 y D40: formato argentino, pie de "Nuevo voluntariado" y voseo en los filtros

### Qué se hizo
- Los tres defectos que quedaban abiertos de la sesión exploratoria #2 (§330). El usuario dio el OK para pushear §331–§332 y para seguir.
- **Push de §331 y §332:** producción en `d963a56`, CI #90 y Deploy #86 en verde (smoke y E2E), SonarCloud en OK con 0 abiertas. Se cerraron los Issues #34–#37 y #40 (D33–D36 y D39).
- **D37 (formato argentino).** En `NGOProjectDetail` lo recaudado pasó de `${current_funding.toLocaleString()}` a `formatMoney` (`$ 8.500`, es-AR, como en el Panel). En `ReviewsModal` el promedio va con coma (`4,5`), igual que en el feed y en la página del voluntariado.
- **D38 (pie fijo de "Nuevo voluntariado").** El pie usa las medidas de `AppShell`: arranca a 72 px entre 768 y 1023 px y a 244 desde 1024 (antes, 240 siempre), y en el celular queda a `56px + área segura` del borde, pegado a la barra inferior (antes, 64).
- **D40 (voseo).** "Personalizá tu búsqueda de voluntariados" y "Elegí según el tiempo y la dedicación que quieras aportar".
- Tests nuevos: `NGOProjectDetailMoney.test.tsx`, `ReviewsModalAverage.test.tsx`, `FilterModalCopy.test.tsx` y `app/layout/fixedFooter.test.ts` (lee las medidas de `AppShell` y las compara con las clases del pie: jsdom no calcula posiciones).

### Verificación
- Rojo → verde: 9 de los 11 tests nuevos fallaban antes del arreglo (los otros 2 comprueban la lectura de `AppShell` y que haya un solo pie).
- Frontend: 1484/1484 (antes 1473; +11), `typecheck` sin errores. El backend no se tocó: no se corrieron sus suites.
- Chrome local (navegador en inglés, `en-GB`): el detalle del voluntariado muestra `$ 8.500` donde `toLocaleString()` sin idioma da `8,500`. El pie medido a 375, 768, 883, 1007 y 1263 px de ancho: empieza donde termina la barra lateral (72 y 244 px) y su contenido queda alineado con el formulario; a 375 px termina donde empieza la barra inferior. La hoja de filtros muestra los dos textos nuevos.
- Mutación (16 mutantes): 15 muertos y 1 vivo equivalente (`formatMoney(Number(x) || 0)` sin el `|| 0`: `formatMoney` ya pasa a 0 lo que no es un número). Se sacó el `|| 0` que sobraba.

### Errores propios
- Un test viejo de `ReviewsModal.test.tsx` esperaba el promedio "4.0", con el formato defectuoso: falló con el arreglo y lo pasé a "4,0". No lo busqué antes de cambiar el componente.

### ⚠️ NO verificado
- El promedio con coma en la hoja de reseñas no se abrió en Chrome: lo cubren los tests.
- El área segura del celular (`env(safe-area-inset-bottom)`): en Chrome de escritorio vale 0. Falta un celular real con barra de gestos.
- `NGOApplications` tiene una barra flotante con `bottom-16` (64 px): es una tarjeta separada del borde a propósito y no se tocó.
- Quedan cuatro formas de escribir plata (`formatPesos`, los dos `formatMoney`, el `money()` local): unificarlas es deuda, no parte de D37.
- `calidad/METRICAS.md` y el informe del TP no se actualizaron (tienen fecha de corte).

## 334. Chicos de la interfaz (tanda T6, primera parte)

### Qué se hizo
- El usuario dejó elegir la tanda ("la que quieras") con poca sesión por delante: fue T6, la chica de frontend. §333 quedó en producción antes de empezar (`f1ebd2e`, CI #91, Deploy #87, SonarCloud en OK); se cerraron los Issues #38, #39 y #41 y no queda ninguno abierto.
- **Iniciales del avatar a 12 px como mínimo** (antes 11 en los avatares de 26 y 32 px): "nada por debajo de 12px".
- **El corazón queda solo para el "me gusta".** En el menú de la ONG, Mercado Pago pasó al ícono de billetera; en el registro, el rol ONG pasó al de grupo de personas.
- **Sin mayúsculas completas:** el rótulo "Certificado de participación" ya no va con `uppercase`.
- **Sin emojis:** se sacaron los dos del paso "Revisar" de crear un voluntariado (Remoto e Híbrido).
- **Aro del avatar de la cuenta:** en el ítem activo seguía siendo redondo aunque el avatar de una ONG o de una empresa es cuadrado redondeado. Ahora sigue la forma del avatar.
- Tests nuevos: `app/layout/designRules.test.ts` (mira el código: corazón, `uppercase` y emojis en toda la app), `app/ui/Avatar.test.tsx`, y un caso en `AppShell.test.tsx` y otro en `SideNavGroups.test.tsx` para el aro.

### Verificación
- Rojo → verde: 6 tests de las reglas y del avatar fallaban antes del arreglo. Los dos casos del aro se escribieron junto con el cambio: no los vi en rojo, los cubre la mutación.
- Frontend: 1495/1495 (antes 1484; +11), `typecheck` sin errores. El backend no se tocó: no se corrieron sus suites en local.
- Mutación (10 mutantes): 10 muertos, 0 vivos.
- Chrome local, como ONG: en la barra lateral y en la barra inferior el avatar "AS" mide 12 px de letra y el aro del ítem activo es cuadrado redondeado (28 %); ningún avatar con letra de menos de 12 px en las dos pantallas que se abrieron.

### Errores propios
- El primer test de `designRules` pedía más de 100 archivos fuente y hay 98: lo bajé a 80.

### ⚠️ NO verificado
- **Lo que quedó de T6 sin hacer:** el avatar de la cuenta sigue mostrando las iniciales de la persona y no el logo de la organización (la sesión solo guarda al usuario; `/auth/me` ya manda el perfil, falta guardarlo en `AuthContext`), y los esqueletos en lugar del spinner a pantalla completa en cinco pantallas (B9).
- No se vieron en Chrome el ícono nuevo de Mercado Pago (el grupo "Mi ONG" estaba cerrado), el del rol ONG en el registro, el certificado ni el paso "Revisar". Los íconos elegidos (billetera, grupo de personas) son una decisión mía: si el usuario prefiere otros, se cambian.
- De paso se vio que el perfil de la ONG tiene scroll horizontal en un marco de 320 px (las tres cifras de arriba). El diseño se revisa a 375 px y ahí no pasa; queda anotado, sin tocar.
- Un celular real.

## 335. Logo de la organización en el avatar de la cuenta y esqueletos de carga (tanda T6, segunda parte)

### Qué se hizo
- El usuario pidió retomar por `PLAN_FEBRERO.md` → "Para retomar": lo próximo era terminar T6. Solo frontend; el backend no se tocó (`GET /auth/me` ya mandaba `profile` con `nombre` y `foto_perfil`).
- **Avatar de la cuenta (hallazgo C9).** En una ONG o una empresa, las barras mostraban las iniciales de la persona que se registró ("AS" por "Admin Sustentando"). `AuthContext` ahora expone `account` (`{ name, avatar }`), sacado de `profile` de `/auth/me` al recargar y después de entrar, en el mismo pedido que `isAdmin` y con la misma guarda de sesión. `AppShell` dibuja el avatar con `account` si la cuenta es una organización, y con `user` si no hay `account` (voluntario, `/auth/me` sin responder o con error, perfil sin nombre).
  - `updateUser` (cambio de foto) cambia también `account.avatar`: `PUT /auth/me/photo` guarda la misma URL en los dos lados.
  - `logout` y un ingreso nuevo borran `account`.
  - El tipo de `api.auth.me()` suma `nombre` y `foto_perfil` a `profile`.
- **Esqueletos en vez de spinner a pantalla completa (hallazgo B9)** en las cinco pantallas: `RequireRole`, `TeamPanel`, `CompanyOwnProfile`, `NGOProjectDetail` y `CreateVoluntariado` (al editar). Cada uno con la forma de su pantalla, `role="status"` con el mismo `aria-label` de antes (`CompanyOwnProfile` no tenía: ahora "Cargando perfil") y los bloques bajo `aria-hidden`. Fondo y bordes con tokens (`canvas-soft`, `surface`, `hairline`).
- Tests nuevos: `components/LoadingSkeletons.test.tsx` (monta las cinco pantallas con el pedido en vuelo y, aparte, mira el código de todos los componentes para que no vuelva un `Loader2` centrado a pantalla completa), 11 casos de `account` en `AuthContext.test.tsx` y 4 en `AppShell.test.tsx`.
- Docs: `FRONTEND_CONTEXT.md` (`account`, `RequireRole`, regla de carga) y `PLAN_FEBRERO.md`. `DESIGN.md` no cambia: la regla ya estaba.

### Verificación
- Rojo → verde: 12 de los 20 tests nuevos fallaban antes del código (los otros 8 describen lo que no tenía que cambiar: voluntario, sin perfil, error). El caso 21 ("entrar con otra cuenta sin cerrar la anterior") se agregó después, para matar un mutante.
- Frontend: 1516/1516 (antes 1495; +21), `typecheck` sin errores. Cobertura: sentencias 91,97 %, ramas 88,75 %, funciones 89,15 %, líneas 94,40 %.
- Mutación (20 mutantes sobre `AuthContext`, `AppShell` y `RequireRole`, con corrida de control en verde): 18 muertos. En la primera vuelta sobrevivían 3; uno ("un ingreso nuevo no limpia `account`") se mató con el test 21. Los 2 que quedan son **equivalentes**: sacar `?? null` deja `undefined` en vez de `null`, y `Avatar` trata igual los dos.
- Chrome local (base SQLite aparte con el seed, 1517 px de ancho, tema oscuro):
  - ONG Sustentando: el avatar de la cuenta dice "SU" (antes "AS"), cuadrado redondeado (28 %), 12 px de letra, en la barra lateral y en la inferior. Empresa TechCorp: "TE".
  - Con los pedidos demorados 6 s: esqueleto en la gestión de un voluntariado (7 bloques; captura vista), en editar un voluntariado (13) y en el perfil de la empresa (5); en los tres, 0 spinners, animación `shimmer`, sin scroll horizontal, y al responder el pedido aparece la pantalla.
- El backend no se tocó: no se corrieron sus suites en local.

### Errores propios
- Ninguno que haya llegado al código. La primera tanda de tests no cubría el ingreso con otra cuenta sin cerrar la anterior: lo mostró la mutación.

### ⚠️ NO verificado
- **Un logo real.** El seed solo trae imágenes de DiceBear, que `Avatar` trata como "sin foto": en Chrome se vieron las iniciales de la organización, no una imagen. Que el logo subido se dibuje lo cubren los tests (`AppShell.test.tsx`), no el navegador. No se subió ninguna foto.
- **Cambiar el nombre de la organización** desde su perfil no actualiza `account` hasta recargar (solo importa si no tiene logo: cambian las iniciales). Los perfiles propios se montan en varios tests sin `AuthProvider`; sumarles `useAuth` quedaba fuera de la tanda. Queda anotado, sin tocar.
- Entre que se entra y responde `/auth/me` se ven un instante las iniciales de la persona. No se midió cuánto dura en producción (con Render dormido puede ser más).
- No se vieron en Chrome los esqueletos de `RequireRole` (solo aparece al recargar, no se pudo demorar) ni de `TeamPanel` (no se entró como voluntaria del equipo); tampoco ninguno a 375 px ni en tema claro. Los cubren los tests.
- Quedan spinners de página que no son "a pantalla completa" y no entraban en B9: `NGOPatrocinios`, `CertificatePage`, el acuerdo y el historial de patrocinio, `NGOApplications`, `NGOValidation`, `AdminValidations`. Sin tocar (regla 16).
- Un celular real y un lector de pantalla.

## 336. Notificaciones instantáneas por el WebSocket y contador de postulaciones de la ONG

### Qué se hizo
- §335 quedó en producción antes de empezar (`263989e`, CI #93, Deploy #89, SonarCloud en OK con 0 issues). El usuario dio el OK para seguir con el punto 3 de `PLAN_FEBRERO.md`.
- **Problema:** el WebSocket solo empujaba mensajes del chat. Una notificación (postulación nueva, decisión, seguidor, patrocinio…) se veía recién al cambiar de pantalla, cuando la barra volvía a pedir `GET /notifications`.
- **Backend, un solo lugar para crear notificaciones:** `lib/notify.js` → `notify(userId, type, title, body, data)`. Guarda la fila y, ya guardada, manda `{ type: 'notification', kind: type }` a las conexiones abiertas del destinatario.
  - Las **14 altas** que había repartidas (`enrollments` ×4, `ngos` ×2, `donaciones` ×2, `empresas`, `follows`, `admin`, `patrocinios`, `ngoTeam`, `sellerAccounts`) pasaron a usarlo. Ninguna estaba dentro de una transacción: todas iban ya después del COMMIT (regla 21). Los textos, los tipos y los datos no cambiaron, ni el manejo de errores de cada una (`.catch(() => {})` o su `try`).
  - El aviso lleva **solo el tipo**: ni el texto ni los ids viajan por el socket. El cliente vuelve a pedir lo suyo con su sesión.
- **Backend, `GET /api/enrollments/pending-count`** (solo ONG) → `{ pending }`: las postulaciones `pending` de los voluntariados de la ONG de la sesión. Es el contador que quedó afuera en §320 porque la única forma de saberlo era `GET /ngos/me` (el panel entero). No recibe ids.
- **Frontend:**
  - `ChatContext` expone `notificationTick`, que sube con cada aviso.
  - `useBadges` (`AppShell`) lo usa como dependencia: notificaciones, invitaciones a equipos y postulaciones se piden de nuevo con cada aviso, además de al cambiar de pantalla.
  - Contador de **Postulaciones** en la barra lateral de la ONG: en el ítem cuando la lista del grupo "Panel" está a la vista; en el grupo cuando el acordeón está cerrado o la barra es de solo íconos.
  - `NotificationsScreen`: con la pantalla abierta, el aviso trae la lista de nuevo, sin esqueleto; si ese pedido falla, queda lo que se veía.
- Docs: `API_CONTEXT.md` (endpoint, WebSocket, notificaciones), `BACKEND_CONTEXT.md` (§6 y el árbol), `FRONTEND_CONTEXT.md` (contadores, `ChatContext`, `NotificationsScreen`), `PLAN_FEBRERO.md` y `CLAUDE.md` (conteos).

### Verificación
- Rojo → verde: backend, 9 de los 11 tests nuevos fallaban antes del código (los otros 2 describen lo que ya andaba: sin conexión abierta, y el del seguidor, que en su primera versión era débil y se reescribió). Frontend, 11 de 15.
- Backend: SQLite **1293**/1293 (antes 1282; +11), Postgres 18 **1295**/1295, y los dos con `TZ=America/Argentina/Cordoba` (1293 y 1295). 0 cancelados en las cuatro. Después de las cuatro corridas se endureció un test (`notify` con título nulo para un usuario conectado): se volvió a correr completo en SQLite, y en Postgres solo los dos archivos nuevos (la corrida de control de la mutación).
- Frontend: **1532**/1532 (antes 1516; +16), `typecheck` sin errores. Cobertura: sentencias 92,11 %, ramas 88,87 %, funciones 89,33 %, líneas 94,56 %.
- `npm audit`: 0 en los dos paquetes.
- Mutación, con corrida de control en verde:
  - Backend (11 mutantes, en SQLite y en Postgres): en cada motor sobrevive 1, y es distinto. "Sin `Number()`" sobrevive en SQLite y muere en Postgres (ahí `COUNT` llega como string); "`data` sin serializar" sobrevive en Postgres (acepta el objeto en la columna JSONB) y muere en SQLite. **Ninguno sobrevive en los dos.**
  - Frontend (21 mutantes): 21 muertos.
- Chrome local (base SQLite aparte, 1517 px, tema claro), como ONG Sustentando parada en Notificaciones, con una voluntaria nueva que se postula desde otra sesión (por la API): **sin cambiar de pantalla**, a los ~100 ms el contador del grupo "Panel" pasó de 1 a 2, apareció el 1 en Notificaciones, la lista mostró "Vera Prueba quiere unirse a «Reforestación Urbana»" y "1 sin leer". Al abrir el grupo, el 2 quedó en "Postulaciones" (captura vista).

### Errores propios
- En `ngos.js` importé el helper con otro nombre (`createNotification`) y lo llamé `notify`: lo vi al revisar los nombres antes de correr nada.
- La pantalla de notificaciones ahora usa `useChatOptional`, y dos tests viejos simulaban `ChatContext` sin exportarlo (`NGONotifications.test.tsx`, `A11yNames.test.tsx`): fallaron en la primera corrida completa y se les sumó.
- Un test nuevo (el del error que se limpia) usaba `new Error('red')`, que `userMessage` muestra tal cual y no como "No pudimos cargar": dejó en rojo la corrida de control de la mutación del frontend, que hubo que repetir.
- El primer test del seguidor pasaba con o sin el cambio (María ya seguía a Juan en el seed): se reescribió con una cuenta nueva.

### ⚠️ NO verificado
- **Producción.** En Render el WebSocket pasa por su proxy; el chat ya anda por ahí, pero este aviso no se probó desplegado.
- **Un solo proceso.** Las conexiones están en un `Map` en memoria: con más de una instancia, el aviso solo le llega a quien esté conectado a la misma. Hoy hay una (y "escalar a varias instancias" está en "No hacer").
- **Si el socket se corta**, los avisos de ese rato se pierden y al reconectar no se piden los contadores: se ponen al día al cambiar de pantalla, como antes. No se agregó un pedido al reconectar.
- **Cada aviso dispara 2 pedidos** (3 para el voluntario y para la ONG). Con muchas notificaciones seguidas no hay agrupado ni espera. No se midió.
- **La coordinación del equipo** (voluntarios coordinadores) no tiene contador de postulaciones: el endpoint es solo para la ONG dueña.
- En Chrome se probó solo la postulación nueva hacia la ONG, en escritorio ancho y tema claro. Los otros 13 tipos de aviso los cubren los tests de a tres (postulación, decisión, seguidor) y el test que mira que nadie más inserte; no se vio la barra de solo íconos, el celular ni el tema oscuro. El contador nuevo no se pasó por la medición de contraste (usa el mismo globito `critical` que los otros).
- El globito del contador va con `aria-hidden`, como los demás: un lector de pantalla no lo anuncia.
- Un celular real.

## 337. Una sola forma de escribir plata y sin `window.confirm` en el perfil de la empresa

### Qué se hizo
- Es el punto 4 de `PLAN_FEBRERO.md` (hallazgos B1 y B2 de la revisión de diseño; lo que quedaba de T3). Solo frontend.
- **Plata, una sola función:** `formatMoney` en `lib/format.ts` → `$ 32.000`, con espacio duro y formato `es-AR`. Reemplaza a las que había:
  - `formatPesos` (`lib/donations.ts`): escribía `$32.000`, sin espacio. La usaba la vuelta de la donación (`DonationReturn`), que ahora dice "Donaste **$ 1.500**".
  - `formatMoney` de `ui/Meter.tsx` (con su `nf`): redondeaba a enteros.
  - `formatMoney` de `lib/sponsorship.ts`: espacio común y hasta tres decimales; el acuerdo y el historial la importaban como `money()`.
  - Las diez pantallas que escriben plata importan la de `lib/format.ts`; `Meter` también.
- **Decimales:** hasta dos, y solo si los hay. Los montos de donaciones y lo recaudado son pesos enteros: se ven igual que antes. Cambia un caso: el costo por persona o un punto de dinero con centavos. Antes `Meter` lo redondeaba (`$ 100` por 99,5) y el acuerdo mostraba hasta tres decimales; ahora los dos muestran `$ 99,5`.
- **Retirar una propuesta** (`CompanyOwnProfile`): la pregunta es el diálogo propio (`useConfirm`), con el nombre del voluntariado en el título ("¿Retirar la propuesta para Banco de Alimentos?"), el texto "La ONG deja de verla. Podés volver a proponer después." y el foco inicial en "Volver" (acción destructiva). No queda ningún `window.confirm` en las pantallas; el único está en `UiProvider`, como respaldo cuando no hay proveedor.
- Docs: `FRONTEND_CONTEXT.md`, `PLAN_FEBRERO.md` y `CLAUDE.md` (conteos).

### Verificación
- Rojo → verde: los 6 tests nuevos o cambiados fallaban antes del código. Los 3 de `formatMoney` fallaban porque la función no existía en ese módulo (rojo débil); el de `DonationReturn` (leía `$1.500`) y los 2 del diálogo fallaban por el comportamiento.
- Frontend: **1536**/1536 (antes 1532; +4), `typecheck` sin errores. Cobertura: sentencias 92,12 %, ramas 88,89 %, funciones 89,32 %, líneas 94,55 %.
- `npm audit`: 0 en los dos paquetes.
- Mutación (17 mutantes, con corrida de control en verde): 17 muertos. En la primera pasada quedaron 2 vivos ("sin foco en Volver" y "retira siempre la primera propuesta") y se sumó un test con dos propuestas pendientes que los mata.
- Los saltos de línea de los 17 archivos tocados quedaron como estaban (`git ls-files --eol`).
- Backend: no se tocó y no se corrió.

### Errores propios
- El script que cambió los imports dejó dos pantallas con el import viejo además del nuevo y otras dos sin ninguno: lo marcó `grep` antes de correr nada y se corrigió a mano.
- El espacio duro quedó escrito como carácter invisible en vez del escape `\u00a0` (en el código y en dos tests): tres mutantes no encontraron su texto ("no aplica") y por eso se vio. Se pasó a escape y se repitió la mutación completa.
- La primera versión de los tests no cubría el foco inicial ni que se retire la propuesta tocada (los dos mutantes vivos).

### ⚠️ NO verificado
- **Nada se vio en un navegador:** ni el diálogo de retirar (claro, oscuro, 375 px) ni los montos en las diez pantallas. Los tests miran el texto, no cómo se pinta.
- **Los mensajes de monto mínimo y máximo** ("El monto mínimo es de $100", "…de $500.000") siguen sin espacio: son textos fijos copiados del backend (`routes/donaciones.js`) y cambiarlos toca los dos lados. Quedó sin hacer.
- **Montos con centavos:** se escriben `$ 99,5`, no `$ 99,50`. No se decidió con el usuario cuál va; hoy solo puede pasar en el costo por persona y en un punto de dinero del acuerdo.
- El botón de ícono "Retirar propuesta" sigue con `title` y sin `aria-label`, y con los colores viejos (`red-50`, `red-400`): es parte de la deuda de `CompanyOwnProfile` (I1), no de esta tanda.
- Producción: sin desplegar al escribir esto.

## 338. Azul solo dinero, verde solo personas (T5)

### Qué se hizo
- §337 quedó en producción antes de empezar (`c9813bd`, CI #95, Deploy #91 con smoke y E2E, SonarCloud en OK con 0 issues). El usuario dejó elegir la tanda: T5 de la revisión contra `DESIGN.md` (hallazgos B3 y B4). Solo frontend y solo colores: ninguna pantalla cambió de forma.
- **Botones verdes que no son "Inscribirme" → `bg-ink text-on-ink`:** "Volver al proyecto" e "Iniciar sesión" de la vuelta de la donación, "Ir a mi perfil" de la vuelta de Mercado Pago, "Aceptar" un patrocinio, "Publicar Voluntariado" y "Agregar requisito" (se fue también la sombra de color), "Publicar reseña" y los dos "Ver Proyecto" del mapa. El paso ya hecho del asistente de crear también pasó a `ink`.
- **Chip de filtro elegido** del detalle de la ONG: de azul a `ink`.
- **Enlaces → `text-ink font-semibold underline`:** los 13 azules (entrevista y calendario en `InterviewPanel`, `MyParticipation` y `ProjectDetails`; "Ver acuerdo" en `CompanyOwnProfile` y `NGOPatrocinios`) y los 2 verdes ("Volver al inicio" de Privacidad, "Reintentar" de Momentos).
- **A los grises** (`surface-soft`, `ink`, `ink-soft`, `ink-muted`): los indicadores de carga (`FollowListModal`, `ReviewsModal`, `NGOMoments`, "ubicarme" del mapa), las iniciales sobre verde o azul (`FollowListModal`, `ReviewsModal`, `NGOProjectDetail`), el chip verde del tipo de KPI, el bloque verde del formulario de reseña, los chips de requisitos y sugerencias de crear, el contador y las opciones elegidas de la hoja de filtros, y en el mapa el ícono del título, el punto que late, el ícono sin foto y el chip de categoría.
- **Tildes de éxito:** el de "¡Gracias por tu donación!" quedó azul (es dinero); los de cuenta borrada y Mercado Pago vinculado, en `ink`.
- **Siguen verdes, ahora con los tokens:** "Aprobar" una postulación (`people-soft`) y el estado "Aceptado" de un patrocinio (`SPONSORSHIP_BADGE`).
- De paso, en la lista de seguidos la fila propia decía "Tú": ahora "Vos" (voseo), en gris.
- **Regla nueva en `app/layout/designRules.test.ts`** (5 tests): ninguna clase `emerald`/`green`/`teal`/`lime` en la app; `bg-people` y `bg-brand` solo en una lista de archivos; ningún `text-brand-text` con `underline`; ningún indicador de carga con azul o verde.
- `paletteContrast.test.ts`: el piso del contador de combinaciones `text-white` bajó de "más de 20" a "más de 10" (quedan 20: los botones que salieron ahora son `text-on-ink`, que mira el test de los tokens).
- Docs: `FRONTEND_CONTEXT.md`, `PLAN_FEBRERO.md` y `CLAUDE.md` (conteos).

### Verificación
- Rojo → verde: 3 de las 5 reglas nuevas fallaban antes del cambio, y los 3 tests cambiados ("Vos" y el color de "Aceptado" en dos pantallas). Las otras 2 reglas (`bg-brand` y los indicadores de carga) nacieron en verde: las faltas que cubren ya las atrapaba la regla de los verdes viejos o comparten archivo con un uso válido.
- Frontend: **1541**/1541 (antes 1536; +5), `typecheck` sin errores. Cobertura: sentencias 92,12 %, ramas 88,91 %, funciones 89,32 %, líneas 94,55 %.
- Mutación (11 mutantes, con corrida de control en verde): se volvió a meter cada falta en una pantalla (verde viejo, `bg-people` y `bg-brand` fuera de lista, enlace azul en los dos órdenes, indicador verde y azul, "Tú", "Aceptado" sin verde). 11 muertos, incluidas las dos reglas que nacieron en verde.
- Saltos de línea sin cambios en los archivos tocados.
- Backend: no se tocó y no se corrió.

### Errores propios
- No preví que sacar `text-white` de los botones verdes bajaba el contador de `paletteContrast.test.ts`: la primera corrida completa dio 1 falla (20 combinaciones, pedía más de 20).

### ⚠️ NO verificado
- **Nada se vio en un navegador**, ni en claro ni en oscuro. Los pares usados (`ink`/`on-ink`, `surface-soft` con `ink`, `ink-soft` e `ink-muted`, `people-soft`/`people-text`) están entre los que mide `paletteContrast.test.ts`, salvo `surface-soft`/`ink-soft`, que no está en la lista (queda entre dos que sí).
- **Las reglas miran archivos, no elementos.** `bg-brand` y `bg-people` se controlan por archivo: un chip azul nuevo en `NGOProjectDetail` o `CreateVoluntariado`, que ya tienen un uso válido, pasaría. `people-soft`, `people-text`, `brand-soft` y `brand-text` no se controlan: se revisaron a mano.
- **Sin decidir con el usuario** (quedaron verdes): en Notificaciones, los globitos de "acuerdo cerrado", "te sumaste al equipo" y "ONG validada" usan el mismo verde que "te aceptaron"; y el estado "Aceptado" de un patrocinio.
- **Fuera de esta tanda:** `NGOEmpleados` (se saca en la Etapa 4), el chip "Participó" con color fijo de `ReviewsModal` (T9), los valores en verde de `NGOKPIs` (T7) y el fondo del mapa en oscuro (T10).
- Producción: sin desplegar al escribir esto.
