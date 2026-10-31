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
