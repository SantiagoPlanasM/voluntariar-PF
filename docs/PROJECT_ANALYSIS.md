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
