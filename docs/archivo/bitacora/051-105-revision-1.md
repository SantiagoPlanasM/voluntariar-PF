# Bitácora §51–§105: Arreglos de la revisión de código (B, F, T, D)

> Archivo (histórico). Parte de `docs/PROJECT_ANALYSIS.md`, separada el 30/10/2026 sin cambios en el texto. Índice: [`../../PROJECT_ANALYSIS.md`](../../PROJECT_ANALYSIS.md).

## 51. Chatbot de FAQs: 500 siempre en Postgres (`activo=1` sobre BOOLEAN) — REVISION B1

**Contexto:** primer ítem del orden de arreglo de `docs/REVISION.md` (revisión del 2026-10-13). Las 6 consultas de `routes/faqs.js` filtraban `WHERE activo=1`; en Postgres la columna se crea `BOOLEAN` (`migrate.js`) y `boolean = integer` es un error de tipos. Resultado: `GET /api/faqs` y `POST /api/faqs/ask` respondían 500 siempre en Postgres (producción). Ningún test tocaba `/api/faqs`, por eso `test:pg` no lo veía.

**Arreglo:** `activo=true` en las 6 consultas, el mismo literal que ya usan `messages.js` y `notifications.js`; SQLite lo toma como 1. Comentario en el código con el porqué. La regla se sumó a `AI_RULES.md` regla 13 y a las trampas de `CLAUDE.md`.

### Tests (nuevos: 5, en los dos motores)
`test/integration/faqs.test.js`: catálogo completo (8 FAQs de `migrate.js`, forma de cada una), filtro por categoría con orden, `ask` con coincidencia, `ask` sin coincidencia con sugerencias de la categoría, y una FAQ desactivada (`UPDATE faqs SET activo=false`) que no aparece en el catálogo (con y sin categoría), ni como respuesta, ni en las sugerencias (con y sin categoría).

### Verificación
- **Rojo → verde:** en Postgres, los 5 fallaban con `operator does not exist: boolean = integer` (el mismo 500 que la revisión vio con el seed); con el arreglo, pasan. En SQLite pasaban antes y después (el bug es solo de Postgres).
- **Mutación (14 mutantes, script descartable fuera del repo):** por cada aparición de `activo=true`, volver a `activo=1` y sacar el filtro (`1=1`). En Postgres murieron 12; los 2 sobrevivientes son la aparición dentro del **comentario** (equivalentes). En SQLite sobreviven además los 6 `activo=1` (equivalentes ahí por diseño: `1` ≡ `true`; mueren en Postgres) y mueren los 6 "sin filtro". **Ningún sobreviviente no equivalente.** Un primer pase dejó vivo "sin filtro" en las sugerencias sin categoría; se agregó ese assert antes de la corrida final.
- **Suites completas:** SQLite **260/260** y Postgres **262/262** (Postgres 16 en Docker), las dos también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome), contra Postgres:** backend en un schema descartable (`verif_b1`, migrado y sembrado, borrado al terminar) y frontend con Vite, sin tocar los `.env`. Sin sesión, el widget `ChatbotWidget` mostró las 4 sugerencias y respondió "como cancelo mi inscripcion?" con la FAQ correcta. Sin errores en la consola durante la pregunta; la consola se empezó a leer después de cargar la página, así que la carga inicial no quedó registrada. Con sesión (categoría por rol) no se probó.

### Errores míos
1. El primer test de "FAQ desactivada" no miraba las sugerencias de `ask` **sin** categoría: lo vi al planear la mutación y lo agregué antes de correrla.

### ⚠️ NO verificado
- El widget con sesión iniciada (filtra por la categoría del rol): solo lo cubren los tests de la API con `categoria`. Tampoco se vio en el celular.
- Producción: no hay deploy (ver §50).

## 52. Listado de proyectos sin roles ni requisitos en Postgres — REVISION B2

**Contexto:** segundo ítem de `docs/REVISION.md`. `GET /api/projects` tiene dos ramas (`BACKEND_CONTEXT.md §2`). En la de Postgres, roles y requisitos salen de `json_agg`, y `pg` ya entrega esas columnas como arrays de JS. `parseJson` (de `fmt`) les hacía `JSON.parse(array)`, que lanza, y el `catch` devolvía `[]`. Además, los roles se agregaban como objetos (`jsonb_build_object('nombre', …)`) en lugar de strings. Con el seed, en Postgres 0 de 12 proyectos traían roles o requisitos; en SQLite, 12 de 12.

**Arreglo** (`routes/projects.js`): `parseJson` devuelve tal cual lo que ya es array; en la rama Postgres, `json_agg(DISTINCT ro.nombre)`, así la forma es `string[]`, como en SQLite, en `GET /:id` y en `api.ts` (`roles_needed: string[]`). Los `DISTINCT` ya estaban y siguen siendo necesarios: los JOIN con roles × requisitos multiplican filas.

### Tests (nuevos: 3, en los dos motores)
`test/integration/projects-list-shape.test.js`, con el seed: (1) cada proyecto del listado (`limit=100`) trae los mismos roles y requisitos que su `GET /:id`, sin importar el orden (ninguna de las dos consultas tiene `ORDER BY`); (2) el seed tiene proyectos con roles y con requisitos, para que (1) no pase sin comparar nada; (3) todos los roles y requisitos del listado son strings.

### Verificación
- **Rojo → verde:** en Postgres fallaban (1) y (2) (`actual: []`, `expected: ['Conductor', 'Voluntario general']`); (3) pasaba solo porque las listas venían vacías, y es el que detecta los roles como objetos (lo confirmó la mutación). En SQLite los 3 pasaban antes y después.
- **Mutación (5 mutantes, en Postgres, script descartable):** sacar el `Array.isArray`, que devuelva `[]`, volver a `jsonb_build_object`, sacar el `DISTINCT` de roles y el de requisitos: **5 de 5 detectados**. En SQLite esa rama no se ejecuta.
- **Suites completas:** SQLite **263/263** y Postgres **265/265**, las dos también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_b2`, borrado al terminar): por la API, 12 de 12 proyectos con roles y requisitos. Explorar, la portada y el feed con sesión (voluntaria del seed) cargan, todas las llamadas a `/api/projects` dan 200 y no hay errores en la consola.

### Corrección a la revisión
`REVISION.md` decía que "feed y explorar muestran todos los proyectos sin roles ni requisitos". **No es así:** ninguna pantalla que consume `GET /api/projects` (Explorar, `PublicFeed`, la barra lateral de `MainFeed`, `CompanyOwnProfile`) muestra roles ni requisitos. El único componente que los dibuja es `FeedPostCard`, y sus datos vienen de `/api/follows/feed`, que tiene su propia consulta (no afectada). El bug era real en el contrato de la API, pero hoy no tenía efecto visible. Si alguien hubiera mostrado los roles del listado, los objetos `{nombre}` habrían roto el render de React.

### Errores míos
1. La severidad "alta" de B2 en la revisión se apoyó en un impacto visual que no comprobé (ver arriba). Lo vi recién al buscar en el navegador dónde se mostraban los roles.

### ⚠️ NO verificado / visto y no tocado
- **Otras diferencias entre las dos ramas, fuera de este cambio:** la de Postgres busca también por nombre de categoría (`c.nombre LIKE`) y la de SQLite no. Además, con un `LEFT JOIN` a `project_categorias` y `c.nombre` en el `GROUP BY`, un proyecto con dos categorías saldría **dos veces** en Postgres (el seed no tiene ninguno así; no lo probé). Quedan para decidir con el usuario.
- Requisitos repetidos dentro de un mismo proyecto: el `DISTINCT` los junta en el listado y el detalle no. No pasa con el seed.

## 53. Hora del chat: "Invalid Date" con timestamps de Postgres — REVISION F1

**Contexto:** tercer ítem de `docs/REVISION.md`. `formatTime` (`frontend/src/lib/format.ts`), que pone la hora en cada burbuja de `ChatThread.tsx`, hacía `new Date(iso.replace(' ', 'T') + 'Z')`. En Postgres `created_at` es `Date` y la API lo manda como `"2026-10-14T01:46:36.887Z"`; con la segunda `Z` queda una fecha inválida. Es el mismo error que §46 arregló en `timeAgo`; `formatTime` había quedado afuera y su único test usaba el formato de SQLite.

**Arreglo:** `formatTime` usa `parseBackendDate` (la misma de `timeAgo`) y devuelve `""` si el valor no es una fecha, en vez de mostrar "Invalid Date". Se documentó en `FRONTEND_CONTEXT.md` y en las trampas de `CLAUDE.md`: toda fecha del backend pasa por `parseBackendDate`.

### Tests (nuevos: 4, `src/lib/format.test.ts`)
ISO con `Z` y milisegundos (lo que manda Postgres), formato viejo sin zona (SQLite, se toma como UTC), offset explícito (`-03:00`) y valor inválido → `""`. La hora esperada se arma con el mismo formateador sobre `Date.UTC(...)`, así el test no depende de la zona horaria de la máquina.

### Verificación
- **Rojo → verde:** 3 fallaban (`Received: "Invalid Date"`); con el arreglo pasan los 4.
- **Mutación (5 mutantes, script descartable, cada uno en dos zonas horarias):** sacar el chequeo de `NaN`, devolver otro texto, volver al parseo viejo (`+ 'Z'`), interpretar la hora sin zona como local y cambiar el formato de la hora. **5 de 5 detectados.**
- **Suite del frontend:** **253/253**, también con `TZ=America/Argentina/Cordoba`; `format.test.ts` además con `TZ=Asia/Tokyo`.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_f1`, borrado al terminar): con la voluntaria del seed mandé un mensaje a la ONG y recargué la conversación. La API devolvió `created_at: "2026-10-14T01:46:36.887Z"` y la burbuja mostró **"10:46 p. m."** (22:46 en Córdoba = 01:46 UTC, correcto). **Contraprueba:** con el `format.ts` anterior, la misma burbuja mostró **"Invalid Date"**. Sin errores en la consola.

### Errores míos
Ninguno detectado en este cambio.

### ⚠️ NO verificado
- La hora del mensaje **recién enviado**, antes de recargar (viene de la respuesta del POST o del WebSocket): la miré solo después de recargar. Tiene el mismo formato ISO, así que debería verse igual.
- En el celular.

## 54. Búsqueda y filtro de modalidad distinguían mayúsculas en Postgres — REVISION B8

**Contexto:** cuarto ítem de `docs/REVISION.md`. `GET /api/projects` filtraba con `LIKE`, que en Postgres distingue mayúsculas (en SQLite no, para ASCII). Buscar "maratón" no encontraba "Maratón Solidaria" en Postgres, y el filtro `modality` no reconocía "Remoto"/"Virtual" con mayúscula en la ubicación: un proyecto así no salía en remotos y sí en presenciales.

**Arreglo** (`routes/projects.js`): `ILIKE` en las 6 líneas de búsqueda y modalidad, en **las dos ramas** para que sigan iguales (`translatePg` ya convierte `ILIKE` → `LIKE` en SQLite, incluido `NOT ILIKE`). Comentario en el código. Se sumó a las trampas de `CLAUDE.md`.

### Tests (nuevos: 4, en los dos motores)
`test/integration/projects-search.test.js`, con el seed: el título en minúsculas y en mayúsculas ASCII ("maratón", "MARAT"); la descripción ("HERRAMIENTAS DIGITALES"), el nombre de la ONG ("techsocial") y la ubicación ("galpón central", que no aparece en el título); "Remoto + visitas…" y "Virtual (Zoom)" con `modalidad='presencial'` (se cambia la columna en el test y se restaura) tienen que salir en `modality=remoto` y no en `presencial`.

### Verificación
- **Rojo → verde:** en Postgres fallaban los 3 primeros tests (`actual: []`); con el arreglo, pasan. En SQLite pasaban antes y después. El cuarto test (Virtual) se agregó después, al revisar la cobertura ocurrencia por ocurrencia: no lo vi en rojo, pero la mutación de esa línea lo pone rojo.
- **Mutación (9 mutantes, en Postgres, script descartable):** volver a `LIKE` cada `ILIKE` de la rama Postgres, de a uno. **8 detectados; sobrevive 1, no equivalente: `c.nombre ILIKE`** (buscar por nombre de categoría). Queda sin test porque solo la rama Postgres busca por categoría (la de SQLite no), y un test de eso fallaría en SQLite. Es la diferencia entre ramas ya anotada en §52, pendiente de decisión. Los `ILIKE` de la rama SQLite son equivalentes a `LIKE` por construcción (`translatePg`).
- **Suites completas:** SQLite **267/267** y Postgres **269/269**, las dos también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_b8`, borrado al terminar): en la portada, sin sesión, buscar "maratón" (con Enter: el formulario no busca mientras se escribe) mandó `GET /api/projects?search=marat%C3%B3n` → 200 y quedó una sola tarjeta, "Maratón Solidaria de Donaciones". No repetí en el navegador la prueba con el código viejo: el rojo del test en Postgres ya lo muestra.

### Corrección a la revisión
Igual que en B2, el impacto visible es menor que lo que decía `REVISION.md`: Explorar filtra en el navegador (no manda `search` ni `modality`). La búsqueda del servidor solo la usa la portada, y el filtro `modality` del servidor no lo usa ninguna pantalla.

### Errores míos
1. En B2 (§52) actualicé el "N+1" de `BACKEND_CONTEXT.md` pero no el mismo texto en `API_CONTEXT.md`; lo corregí acá.
2. El primer test de ubicación buscaba "barrio güemes", que también está en el **título** del proyecto: no probaba la búsqueda por ubicación. Lo cambié a "galpón central" antes de la mutación.

### ⚠️ NO verificado / visto y no tocado
- **Tildes (probado en los dos motores):** ningún motor las ignora ("maraton" no encuentra "Maratón"). Arreglarlo pide `unaccent` (extensión de Postgres) o normalizar en una columna aparte: es una decisión, no la tomé.
- **SQLite y mayúsculas no ASCII (probado):** "MARATÓN" no encuentra "Maratón" en SQLite (dev), sí en Postgres. No afecta a producción.
- La búsqueda por categoría solo existe en Postgres (ver §52).

## 55. Tests de autorización por dueño entre ONGs — REVISION T1

**Contexto:** quinto ítem de `docs/REVISION.md`. Los controles de dueño existen en el código (`WHERE ... AND p.ngo_id = $n`) y la revisión no encontró IDOR, pero solo `posts.test.js` probaba una "ONG ajena": si alguien sacaba un filtro, ningún test se ponía rojo. Cambio **solo de tests**, sin tocar código de rutas, para tener una red antes de modificar más rutas.

### Tests (nuevos: 13, en los dos motores)
`test/integration/ownership.test.js`, con el seed. Green Córdoba (ngo-2) intenta operar sobre recursos de Sustentando (ngo-1, dueña de `proj-1`). Los KPIs y la propuesta de patrocinio (de TechCorp) se crean en el `before`, por la API. Cada caso comprueba el código **y que la base no cambió**:
- ver las inscripciones de `proj-1` (403, sin emails); aprobar o rechazar (404, sin cambio de estado ni de cupo); cargar horas (404);
- editar y borrar `proj-1` (404, el proyecto queda igual);
- crear, editar y borrar KPIs de `proj-1` (403), y editar o borrar el KPI ajeno **pasando por la URL de un proyecto propio** (`/projects/proj-2/kpis/<kpi de proj-1>`: el KPI no cambia);
- ver o decidir el patrocinio propuesto a `proj-1` (no aparece en su lista; PATCH → 404, sigue "propuesto");
- ver en su propio panel (`GET /ngos/me` y `/ngos/ngo-2/dashboard`) la inscripción pendiente de `proj-1`, que trae el email del voluntario;
- ver el dashboard o los empleados de ngo-1, o agregarle empleados (403, no se crea nada).

Al final, **la ONG dueña hace lo mismo con los mismos ids y le funciona** (ver, cargar horas, aprobar, editar el KPI, aceptar el patrocinio, editar, borrar el KPI y el proyecto). Eso prueba que los rechazos no venían de un id mal armado.

### Verificación
- **No hay rojo → verde:** son tests de un comportamiento que ya era correcto. La prueba de que sirven es la mutación.
- **Mutación (script descartable, en SQLite y en Postgres):** cada filtro de dueño se rompió de a uno (`X = $n` → `(X = $n OR 1=1)`, conserva los parámetros): 3 en `enrollments.js`, 7 en `projects.js` (PUT/DELETE de proyecto, POST/PUT/DELETE de KPI y los dos `project_id` de las consultas de KPI) y 7 en `ngos.js` (`/me` y dashboard con pendientes, lista y PATCH de patrocinios, dashboard y empleados GET/POST). **17 de 17 detectados en los dos motores.** Un primer pase dejó vivos los filtros de pendientes de `GET /ngos/me` y del dashboard (líneas 93 y 276); agregué el test de "pendientes ajenas en su propio panel" y murieron.
- El mismo texto de búsqueda agarró 2 consultas más (`ngos.js:134` y `:228`, los proyectos **públicos** de una ONG en su perfil). Sobreviven. **No son equivalentes:** sin el filtro, el perfil mostraría proyectos de otras ONGs. Pero no son autorización (son datos públicos), así que quedan fuera de T1.
- **Suites completas:** SQLite **280/280** y Postgres **282/282**, las dos también con `TZ=America/Argentina/Cordoba`.
- `AI_RULES.md` regla 15: todo endpoint nuevo con control de dueño suma su caso a este archivo.

### Errores míos
Ninguno en el código. El primer pase de los tests no cubría las pendientes que muestran `/ngos/me` y el dashboard; lo detectó la mutación.

### ⚠️ NO verificado / fuera de alcance
- **REVISION B18 (sigue abierto; confirmado en SQLite y Postgres con un script descartable):** `PUT /projects/<propio>/kpis/<kpi ajeno>` no modifica nada, pero **responde 200 con el KPI ajeno** (nombre, valor y `project_id` de la otra ONG), porque relee por id sin filtrar por proyecto. El test comprueba que la base no cambia y no mira la respuesta, para no mezclar el arreglo con este cambio de solo tests.
- No se probaron empresas entre sí (el seed tiene una sola), ni voluntarios contra inscripciones ajenas (`DELETE /enrollments/:id` filtra por `user_id`; no se mutó).
- Las rutas `/ngo/*` del frontend siguen sin guarda (deuda conocida); el control real es el del backend, que es lo que se prueba acá.

## 56. KPIs: fuga de datos de otra ONG y 200 sin hacer nada · comentar un proyecto inexistente — REVISION B18

**Contexto:** el usuario pidió adelantar B18 después de que §55 lo confirmara. Había tres problemas en `routes/projects.js`:
1. `PUT /projects/:id/kpis/:kpiId` controlaba que `:id` fuera de la ONG, pero después releía el KPI **solo por id**. Con la URL de un proyecto propio y el id de un KPI ajeno (`/projects/proj-2/kpis/<KPI de proj-1>`), el UPDATE no tocaba nada (filtra por proyecto), pero la respuesta era **200 con el KPI de la otra ONG** (nombre, valor, `project_id`). Confirmado en los dos motores (§55).
2. PUT y DELETE de un KPI inexistente, o de otro proyecto, respondían 200 (`{}` o "KPI eliminado") sin hacer nada.
3. Comentar un proyecto inexistente daba **500** (la FK rechazaba el INSERT) en vez de 404.

**Arreglo:** PUT y DELETE de KPI miran `changes` del UPDATE/DELETE (que ya filtran por `id AND project_id`): si es 0 → **404** "KPI no encontrado en este proyecto". La relectura del PUT también filtra por proyecto (defensa extra). El POST de comentarios comprueba que el proyecto exista antes de insertar → **404**. `API_CONTEXT.md` actualizado. De paso corregí en esas mismas líneas dos errores de D6: el PUT de KPI **no es parcial** y el DELETE responde `{ message: "KPI eliminado" }`, no `{ success: true }`.

### Tests (nuevos: 8, en los dos motores)
`test/integration/project-subresources.test.js`: PUT y DELETE de un KPI ajeno por la URL de un proyecto propio (404, sin datos ajenos en la respuesta, el KPI no cambia ni se borra), PUT y DELETE de un KPI inexistente (404), la dueña edita (200 con el KPI) y borra (200, y el segundo intento da 404), comentario a un proyecto inexistente (404, no se guarda nada) y a uno existente (201). El comentario de `ownership.test.js` que decía "la respuesta no se prueba acá" ahora apunta a este archivo.

### Verificación
- **Rojo → verde:** en los dos motores fallaban los 6 casos de error (200 donde debía haber 404; 500 en el comentario) y pasaban los 2 de control. Con el arreglo pasan los 8.
- **Mutación (script descartable, los dos motores):** sacar el 404 del PUT, invertirlo, sacar el 404 del DELETE y sacar el chequeo de proyecto del comentario: **detectados**. Sobrevive "la relectura del PUT sin filtrar por proyecto". Es **equivalente**: el 404 de arriba ya garantiza que el KPI es de ese proyecto, y el filtro queda como defensa extra.
- **Suites completas:** SQLite **288/288** y Postgres **290/290**, las dos también con `TZ=America/Argentina/Cordoba`.

### Errores míos
1. El primer pase de mutación reportó como sobreviviente el chequeo del comentario. Era un error de mi script: la misma línea (`if (!project) return … 'Proyecto no encontrado'`) aparece también en `GET /:id`, y `replace` mutó la primera aparición. Repetido apuntando a la línea correcta (847), murió en los dos motores (`actual: 500`).

### ⚠️ NO verificado
- **En el navegador:** no lo probé. El camino feliz no cambió; los errores ya se muestran en `NGOKPIs.tsx` (el formulario muestra el mensaje y el borrado hace `alert`). Borrar exige un `confirm()`, que bloquea la extensión de Chrome. **Cambio de comportamiento:** borrar un KPI que ya no existe (p. ej. borrado desde otra pestaña) antes desaparecía en silencio y ahora muestra "KPI no encontrado en este proyecto".
- El PUT de KPI sigue sin ser parcial y, sin `nombre`, probablemente da 500 (D6, a confirmar). No lo toqué.
- `POST /projects/:id/ratings` sobre un proyecto inexistente: no lo revisé.

## 57. Agregados sin `Number()` en el perfil de voluntario y el feed de seguidos — REVISION B9

**Contexto:** en Postgres `COUNT`/`SUM` llegan como string (bigint/numeric) y en SQLite como número (§33, `AI_RULES` regla 13). Quedaban dos endpoints sin normalizar: `GET /api/voluntarios/:userId` (`stats.total_enrollments`, `stats.approved_enrollments`, `stats.total_horas` y `volunteer.following_count`) y `GET /api/follows/feed` (`total`). Usaban `x || 0`, que no arregla nada: `'3' || 0` es `'3'`, y **`'0' || 0` también es `'0'`** (un string no vacío es truthy).

**Barrido previo:** revisé todos los `COUNT`/`SUM`/`AVG` del backend. El resto ya se normaliza (`num()` en `empresas.js`; `parseInt`/`parseFloat` en las stats de `ngos.js`; `Number()` en `posts.js`, en `fmt` de proyectos y en el `ratingByProject` de recomendados). Solo quedaban estos dos.

**Arreglo:** `Number(x) || 0` en los 5 campos (como `num()` de `empresas.js`). `CLAUDE.md` ahora aclara por qué `x || 0` no alcanza.

### Tests (nuevos: 3, en los dos motores)
`test/integration/aggregates-are-numbers.test.js`, con el seed: perfil de María con valores exactos (`{ total_enrollments: 3, approved_enrollments: 2, total_horas: 2.5 }`, `following_count: 2`), perfil de Lucía sin inscripciones ni seguidos (los ceros tienen que ser `0`, no `'0'`) y `total` del feed después de seguir a ngo-1 (`3`, igual a la cantidad de proyectos devueltos).

### Verificación
- **Rojo → verde:** en Postgres fallaban los 3 (`'3'`, `'2'`, `'0'`); con el arreglo pasan. En SQLite pasaban antes y después.
- **Mutación (5 mutantes, Postgres, script descartable):** sacar cada `Number()` de a uno. **4 detectados.** Sobrevive `Number(total_horas)`, **equivalente hoy**: `horas_realizadas` es REAL, `SUM(real)` devuelve `real` y `pg` ya lo entrega como número (en el rojo llegaba `2.5` bien). Lo dejé por consistencia y por si la columna pasa a NUMERIC.
- **Suites completas:** SQLite **291/291** y Postgres **293/293**, las dos también con `TZ=America/Argentina/Cordoba`.
- **Sin navegador, a propósito:** `VolunteerPublicProfile.tsx` solo muestra estos valores (no hace cuentas con ellos) y `"3"` se ve igual que `3`. No había efecto visible: era el contrato de tipos de `api.ts` (`number`), que en Postgres no se cumplía.

### Errores míos
1. El primer test suponía que María no seguía a nadie y que Lucía no tenía seguidos. El seed tiene María → Juan y Lucía → María, así que el primer `following_count: 1` "pasaba" por el seed y no por mi follow. Lo corregí antes del arreglo: María sigue además a Lucía (espero 2) y el caso de ceros borra primero los seguidos e inscripciones de Lucía.

### ⚠️ NO verificado
Nada pendiente de este cambio.

## 58. Guardar habilidades con un id repetido las borraba todas — REVISION B6

**Contexto:** `PUT /api/voluntarios/me/habilidades` reemplaza el set completo: DELETE de todas las filas del voluntario y un INSERT por cada habilidad, **sin transacción**. El `Set` de ids servía solo para validar contra el catálogo; los INSERT recorrían el body tal cual. Con un `habilidad_id` repetido, el segundo INSERT violaba la PK `(user_id, habilidad_id)` **después** del DELETE: respondía 500 y el voluntario se quedaba sin ninguna habilidad. El endpoint no tenía tests.

**Arreglo** (`routes/voluntarios.js`):
- Se deduplica con un `Map` `habilidad_id → nivel`. **Gana la última aparición**, coherente con "el body es el estado final", como dice el comentario del endpoint. Decisión mía; la alternativa era responder 400 ante repetidos.
- DELETE + INSERT van en `db.transaction()` con `tx.*` (regla 21): si un INSERT falla, quedan las habilidades anteriores.

### Tests (nuevos: 5, en los dos motores)
`test/integration/habilidades.test.js`, con María del seed (sin habilidades):
- guardar el set completo;
- **id repetido** → 200, se guarda una vez con el nivel de la última aparición;
- un pedido inválido (habilidad inexistente → 400) no toca lo guardado;
- **falla inyectada en un INSERT después del DELETE** → 500 y se conservan las habilidades anteriores;
- un array vacío las borra todas.

La falla se inyecta en el adaptador (`db.run` y el `tx.run` de la transacción, para no depender de cómo esté escrita la ruta). Es la única forma de llegar a ese caso: con la validación y el dedup, ningún pedido válido falla ahí.

### Verificación
- **Rojo → verde:** en los dos motores fallaba el caso del id repetido (`actual: 500`). El test de la falla inyectada lo agregué después del arreglo, al ver que ningún test del API podía detectar que se sacara la transacción. La mutación confirma que la detecta.
- **Mutación (4 mutantes, los dos motores, script descartable):** que gane la primera aparición, sin dedup (recorrer el body), **sin transacción** (el callback se ejecuta con `db` en lugar de `tx`) y otro nivel por defecto. **4 de 4 detectados en SQLite y en Postgres.**
- **Suites completas:** SQLite **296/296** y Postgres **298/298**, las dos también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_b6`, borrado al terminar): con María, en "Mi Perfil" → editar, elegí Cocina e Idiomas y guardé. La página se recarga y muestra "Cocina · Básico" e "Idiomas · Básico". En la base quedaron esas dos filas con nivel `basico`.

### Errores míos
Ninguno detectado.

### ⚠️ NO verificado
- Desde la interfaz no se pueden mandar ids repetidos (cada habilidad es un botón que se marca o desmarca), así que el caso del repetido se probó solo por el API.
- Concurrencia: dos guardados simultáneos del mismo voluntario. Con la transacción, en Postgres el segundo DELETE espera al primero. No lo probé.

## 59. Alta de proyecto: roles/requisitos sin validar y alta a medias sin transacción — REVISION B5

**Contexto:** `POST /api/projects` hacía el INSERT del proyecto y después, en queries sueltas, categoría, roles y requisitos:
- `roles_needed: "Chef"` (string) se recorría **letra por letra** y creaba los roles "C", "h", "e", "f" en el catálogo global (que `/api/roles` lista a todos);
- un elemento no-string (`[123]`) fallaba en `.trim()` **después** del INSERT: 500 con el proyecto creado sin asociaciones (y un reintento lo duplicaba);
- la respuesta devolvía `roles_needed`/`requirements` tal como venían en el body (con espacios, repetidos y vacíos), no lo guardado;
- los `.catch(() => {})` para "ignorar duplicados" no servirían dentro de una transacción de Postgres, porque un error la aborta entera.

**Arreglo** (`routes/projects.js`):
- `cleanTextList()` valida **antes de crear nada**: ausente → `[]`; si no, array de strings, a lo sumo 20, rol 2–40 y requisito 3–100 caracteres (los límites de `CreateVoluntariado.tsx`). Recorta y saca repetidos. `category`, si viene, string de hasta 60. Si algo no cumple → 400.
- No copié la regex de letras de roles del frontend: los tests existentes usan roles como "Rol 1", y la regla 3 pide no duplicar más validaciones.
- Todo el alta en `db.transaction()` con `tx.*`. Categoría y roles se crean con `ON CONFLICT (nombre) DO NOTHING` (seguro ante otra alta concurrente que cree el mismo nombre) y se releen por nombre (UNIQUE). Sin `.catch` adentro.
- La respuesta usa las listas limpias.

**Cambio de comportamiento:** antes un rol o requisito vacío o demasiado corto se salteaba en silencio; ahora es 400. El frontend no los manda (valida lo mismo antes).

### Tests (nuevos: 11, en los dos motores)
`test/integration/projects-create-validation.test.js`. Cada rechazo comprueba 400, mensaje, **que no se creó el proyecto y que el catálogo de roles no cambió**:
- `roles_needed` y `requirements` como string; `roles_needed` como objeto; elementos número, objeto y `null`;
- largos fuera de rango (1, solo espacios, 41; requisito de 2 y de 101); 21 roles y 21 requisitos; `category` como array.

Además, los casos válidos:
- los extremos (2/40/3/100 y 20 de cada uno) se aceptan;
- recorte y repetidos: la respuesta coincide con `GET /:id`;
- sin listas en el body → `[]`;
- **falla inyectada en el INSERT de requisitos** (en `db.run` y en el `tx.run`, como en §58) → 500 y no queda ni el proyecto, ni el rol nuevo, ni la categoría nueva.

### Verificación
- **Rojo → verde:** en SQLite fallaban 8 de 10 (201 donde iba 400, 500 con el proyecto a medias, la respuesta con el body crudo, el proyecto que quedaba tras la falla); pasaban los 2 de control. Con el arreglo pasan todos, junto con `creation-and-capacity-edit.test.js`. El caso "objeto" lo agregué antes de la mutación: con un string, la falta de `Array.isArray` no se notaba (cada letra mide 1 < 2).
- **Mutación (13 mutantes, los dos motores, script descartable):** sin `Array.isArray`, los cuatro límites (`<`/`<=`, `>`/`>=`), sin tope de cantidad, sin dedup, sin recorte, sin chequeo de categoría, **sin transacción**, sin `ON CONFLICT` en roles y en categorías, y respuesta con el body crudo: **12 detectados en SQLite y Postgres.** Sobrevive "sin `typeof`" (`item?.trim?.() ?? null`), **equivalente** para JSON: número, `null` u objeto tampoco tienen `trim` y terminan en `null` → 400.
- **Suites completas:** SQLite **307/307** y Postgres **309/309**, las dos también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_b5`, borrado al terminar): como Sustentando, completé los 3 pasos de "Nuevo Voluntariado" (Salud, roles Coordinador y Fotógrafo, requisitos "Ropa cómoda" y "Mayor de 18 años") y publiqué. `POST /api/projects` → 201, el panel mostró el proyecto nuevo, sin errores en la consola. En la base quedaron la categoría, los 2 roles y los 2 requisitos.
- `API_CONTEXT.md`: además de lo nuevo, corregí dos errores que ya tenía esa sección: decía que `validateProject` pasa por `hasBadWord()` (no lo hace; solo comentarios y posts) y que sin perfil de ONG respondía 403 (es 404).

### Errores míos
1. En el primer borrador de tests, "roles como string" pasaba también sin el chequeo de array (por el largo mínimo). Lo detecté al planear la mutación y agregué el caso del objeto.

### ⚠️ NO verificado / para decidir
- **Catálogo abierto:** cualquier ONG sigue pudiendo crear categorías y roles nuevos en el catálogo global con cualquier texto válido. Para roles parece ser a propósito (el formulario permite roles personalizados). Para categorías, el frontend usa una lista fija pero el backend acepta cualquier texto. ¿Restringimos `category` a las existentes? No lo cambié (regla 16).
- Dos altas concurrentes que crean el mismo rol nuevo: el `ON CONFLICT` está pensado para eso, pero no lo probé con concurrencia real.
- `PUT /api/projects/:id` sigue sin guardar roles/requisitos/categoría y responde con los del body (deuda conocida, "PUT no parcial").

## 60. El manejador global de errores respondía 500 con el mensaje técnico — REVISION B3

**Contexto:** el último `app.use` de `src/index.js` respondía siempre `500 { error: err.message }`. Lo que llega ahí son, sobre todo, errores del cliente que levantan `express.json()` y CORS:
- JSON mal formado → `500 {"error":"Unexpected end of JSON input"}`;
- un cuerpo de más de 5 MB → 500;
- en producción, un origen no permitido → `500 {"error":"CORS: origen no permitido → <origen>"}`.

Códigos incorrectos (eran errores del cliente) y mensajes técnicos en inglés hacia el usuario, contra la regla 19.

**Arreglo:** el manejador pasó a `src/lib/errorHandler.js`, para poder testear también los casos que ninguna ruta dispara:
- `entity.parse.failed` → **400**, `entity.too.large` → **413** ("máximo 5 MB"), `charset/encoding.unsupported` → **415** ("usá UTF-8");
- el rechazo de CORS (marcado con `corsError()`, que ahora usa el callback de `index.js`) → **403** "Origen no permitido", sin repetir el origen;
- otro 4xx desconocido → su código con "El pedido no es válido";
- todo lo demás → **500** "Error interno del servidor".

`err.message` va siempre al log, nunca a la respuesta. Si la respuesta ya se empezó a mandar, se delega a Express (`next(err)`). Los errores de multer siguen manejándose en `posts.js` (no llegan acá).

### Tests (nuevos: 10)
- `test/integration/error-handler.test.js` (5, los dos motores): JSON roto → 400; 5 MB + 10 bytes → 413; `charset=latin9` → 415, cada uno con su mensaje específico y sin texto técnico. CORS en producción: origen ajeno → 403 sin el origen; `http://localhost:5173` → 200. El callback lee `NODE_ENV` en cada pedido, así que el test lo cambia solo mientras corre. Más un control: un JSON válido no da 500.
- `test/unit/errorHandler.test.js` (5): error inesperado → 500 genérico, con el detalle en el log; 4xx desconocido → su código; un 5xx con `status` explícito no se trata como error del cliente; `headersSent` → `next(err)`; `corsError()` → 403.

### Verificación
- **Rojo → verde:** los 4 casos de integración daban 500 antes del arreglo; el control pasaba. Los unitarios arrancaron con un **rojo débil** (el módulo no existía todavía); cubren caminos a los que no se llega por HTTP.
- **Mutación (12 mutantes, script descartable):** cambiar cada código, sacar cada rama (CORS, tabla de body-parser, 4xx genérico, `headersSent`), devolver `err.message` en el 500, sacar el log, ampliar el rango 4xx a `<= 503`, y volver al `new Error` en el callback de CORS. **12 de 12 detectados.** En el primer pase sobrevivió "sin la tabla de body-parser": los códigos coincidían por el 4xx genérico y solo cambiaba el mensaje, que el test no miraba. Agregué asserts del mensaje específico ("JSON válido", "5 MB", "UTF-8").
- **Suites completas:** SQLite **317/317** y Postgres **319/319**, las dos también con `TZ=America/Argentina/Cordoba`.
- Sin navegador: el frontend nunca manda JSON roto ni cuerpos de más de 5 MB.

### Errores míos
1. Dejé un comentario `eslint-disable` en el módulo; el backend no usa ESLint, así que lo cambié por un comentario común.
2. Los primeros asserts solo miraban que el mensaje no fuera técnico, no cuál era (ver mutación).

### ⚠️ NO verificado
- El 403 de CORS en el navegador real: el test lo prueba con `fetch` desde Node mandando el header `Origin`. En un navegador, el bloqueo lo hace también el propio navegador, y lo que muestre depende de él.
- `ws/index.js:86` sigue reenviando `err.message` interno por WebSocket (REVISION B19, aparte).

## 61. El chat cargaba los primeros 300 mensajes, no los últimos — REVISION B4

**Contexto:** `GET /api/messages/thread/:userId` hacía `ORDER BY created_at ASC LIMIT 300`, o sea, los 300 **más viejos**. El comentario de la ruta y `API_CONTEXT.md` prometían los últimos. En una conversación de más de 300 mensajes, al reabrirla nunca se veían los nuevos.

**Arreglo** (`routes/messages.js`): subconsulta con los 300 más nuevos (`ORDER BY created_at DESC, id DESC LIMIT 300`) y después orden cronológico (`ORDER BY created_at ASC, id ASC`). `id` desempata cuando `created_at` empata (en SQLite tiene resolución de 1 s). No es cronológico, pero hace que el corte y el orden sean siempre los mismos. Misma consulta en los dos motores.

### Tests (nuevos: 2, en los dos motores)
`test/integration/messages-thread-latest.test.js`: 301 mensajes María ↔ Juan insertados con un `created_at` distinto por segundo. Por la API empatarían casi todos en SQLite y el orden sería arbitrario. Tiene que devolver exactamente `m1…m300` en orden; `m0`, el más viejo, queda afuera. Más una conversación corta, insertada en desorden, que tiene que venir completa y ordenada (control).

### Verificación
- **Rojo → verde:** en los dos motores, el primer test daba `actual: 'm0'` (el más viejo primero); el control pasaba. Con el arreglo pasan los dos, junto con `messages-conversations.test.js`.
- **Mutación (6 mutantes, los dos motores, script descartable):** volver a ASC adentro, DESC afuera, `LIMIT 299` y `LIMIT 301`, sin orden externo: **5 detectados.** Sobrevive "sin desempate por `id`". **No es equivalente**, pero los datos del test no tienen empates. Con empates no existe un orden cronológico "correcto"; el desempate solo hace que la respuesta sea estable, y un test de eso sería frágil (sin el desempate, la base podría devolver por casualidad el mismo orden).
- **Suites completas:** SQLite **319/319** y Postgres **321/321**, las dos también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_b4` con 301 mensajes insertados con `generate_series`, borrado al terminar): como María, abrí el chat con Juan. Abajo, el último es "Mensaje número 300", con su hora bien (también confirma §53); arriba, el primero es "Mensaje número 1". El 0 quedó afuera.

### Errores míos
Ninguno detectado.

### ⚠️ NO verificado / fuera de alcance
- **No hay paginación:** los mensajes anteriores a los últimos 300 no se pueden ver desde la interfaz. Hace falta un "cargar anteriores" (cursor por `created_at`/`id`). Queda como mejora, no lo hice.
- Mensajes enviados en el mismo segundo en SQLite (dev): su orden relativo lo decide el `id` (aleatorio), no el orden real de envío. En Postgres (microsegundos) casi no pasa.

## 62. Recargar con el backend caído cerraba la sesión · `req()` reventaba con respuestas no-JSON — REVISION F4 + F5

**Contexto:**
- **F4:** al recargar, `AuthContext` verifica el token con `GET /auth/me` y hacía `.catch(() => { removeToken(); ... })` ante **cualquier** error. Con Render "dormido" (502), sin red o con un 500, el usuario perdía la sesión.
- **F5:** `req()` (`lib/api.ts`) hacía `await res.json()` sin protección. Un 502/503 en HTML de un proxy mostraba al usuario `Unexpected token '<' ...`. Además el error no llevaba el código HTTP, así que nadie podía distinguir "token inválido" de "servidor caído".

**Arreglo:**
- `lib/api.ts`: `ApiError extends Error` con `status`. `req()` y `upload()` usan un `readJson()` común: lee el cuerpo con `.catch()`. Si no es OK, `ApiError(data?.error || fallback, status)`, con fallback "El servidor no está disponible en este momento. Probá de nuevo en un rato." para 502/503/504 y "Error del servidor" para el resto. Si es OK pero no es JSON, `ApiError("Respuesta inesperada del servidor")`. Un fallo de red sigue siendo el `TypeError` de fetch, que ya traduce `userMessage()`.
- `lib/AuthContext.tsx`: cierra la sesión **solo** con 401 (token inválido o vencido, `middleware/auth.js`) o 404 (usuario borrado, `GET /auth/me`). En cualquier otro caso conserva el token y sigue con el usuario guardado en `v_user`.
- Como `ApiError` hereda de `Error`, los componentes que muestran `e.message` siguen igual.

### Tests (nuevos: 15; 1 actualizado)
- `src/lib/api.errors.test.ts` (8): 502 en HTML → `ApiError` 502 con el mensaje en español; 503/504 igual; 500 en HTML → "Error del servidor"; error con JSON → mensaje del backend + status; 200 no-JSON → `ApiError`; OK con JSON → tal cual; `upload()` con 502 en HTML; fallo de red → sigue siendo `TypeError`.
- `src/lib/AuthContext.test.tsx` (7): `/auth/me` OK → usuario del servidor; 401 y 404 → cierra la sesión (borra token y usuario); 502 en HTML, 500 y sin red → **no** la cierra (token y usuario guardado); sin token no llama a `/auth/me`.
- `src/lib/api.posts.test.ts`: el test de "respuesta no-JSON" esperaba "Error del servidor" para un 502. Lo actualicé al mensaje nuevo, porque el cambio es a propósito.

### Verificación
- **Rojo → verde:** fallaban los 3 casos de "no cerrar la sesión" (rojo fuerte: la cerraba) y los de `status`/mensaje; los `instanceof ApiError` eran rojo débil (la clase no existía). Pasaban los controles.
- **Mutación (11 mutantes, script descartable):** `json()` sin `catch`, `status` en 0, 502 o 504 fuera de la lista de "no disponible", ignorar el mensaje del backend, OK sin JSON que no falla, lanzar `Error` común, cerrar ante cualquier error (lo de antes), no cerrar con 404, no cerrar con 401, no usar el usuario guardado: **11 de 11 detectados**, sobre una línea base verde.
- **TypeScript: NO verificado** (corregido en §67: lo que reporté como "0 errores" fue un `npx tsc` que no era TypeScript).
- **Suite del frontend:** **268/268**, también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome):** con María logueada (backend contra un schema descartable de Postgres, `verif_f4`, borrado al terminar), **apagué el backend** y recargué "Mi Perfil": sigue logueada (nombre en la barra y en el encabezado). **Contraprueba:** con el `AuthContext.tsx` anterior, la misma recarga mostró "No estás logueado". Después restauré el arreglo y volví a correr sus tests.

### Errores míos
1. **La primera corrida de mutación no valía:** incluía `api.posts.test.ts`, que ya fallaba **sin** mutantes (esperaba el mensaje viejo del 502), así que "11 de 11 detectados" era falso. Lo vi recién al correr la suite completa. Actualicé ese test, confirmé la línea base en verde (24/24) y repetí la mutación. Lección: **correr la línea base antes de mutar**.
2. Primero escribí `ApiError` con un *parameter property* (`constructor(message, public status)`); lo cambié a un campo explícito para no depender de la configuración de TypeScript.

### ⚠️ NO verificado
- El mensaje de "servidor no disponible" ante un **502 en HTML real** de un proxy: lo cubren los tests con una respuesta simulada. No hay proxy local.
- Con el backend caído, las pantallas muestran datos vacíos en vez de un error (en la prueba, "Mi Perfil" mostró 0 en todo). Es F9 (errores tragados), aparte.
- La sesión se reintenta recién en la próxima recarga: no hay reintento automático de `/auth/me` cuando el backend vuelve.

## 63. Fechas de KPI un día antes — REVISION F2

**Contexto:** `NGOKPIs.tsx` mostraba la fecha con `new Date(kpi.fecha).toLocaleDateString(...)`. `kpis.fecha` es una columna TEXT con lo que manda el `<input type="date">` (`"YYYY-MM-DD"`), igual en los dos motores. `new Date("2026-10-01")` es **medianoche UTC**, y en Córdoba (UTC-3) eso todavía es el 30 de septiembre: se mostraba "30 sept 2026".

**Arreglo:** `formatDateOnly()` en `lib/format.ts`. Un `"YYYY-MM-DD"` se arma como fecha **local** (`new Date(año, mes - 1, día)`); un timestamp completo se toma por su instante (`parseBackendDate`); algo que no es fecha → `""`. `NGOKPIs.tsx` lo usa. Revisé el resto de los `.tsx`: ningún otro componente parsea fechas con `new Date(x)`. Se sumó a las trampas de `CLAUDE.md`.

### Tests (nuevos: 5)
- `src/lib/format.test.ts` (4): con `process.env.TZ` fijado a Córdoba dentro del test (Node lo aplica en el momento, así el test no depende de la máquina), `"2026-10-01"` → "01 …" y `"2026-01-01"` no cae en el año anterior; lo mismo en UTC+9; un timestamp completo; algo inválido → `""`.
- `src/app/components/NGOKPIs.test.tsx` (1): con el API simulado y TZ de Córdoba, un KPI con `fecha: "2026-10-01"` se ve como "01 de oct de 2026" y no como "30 sept".

### Verificación
- **Rojo → verde:** el test del componente fallaba con el bug real (no encontraba "01 de oct de 2026"). Los del helper fueron **rojo débil** (la función no existía).
- **Mutación (6 mutantes, script descartable, línea base en verde):** volver al parseo UTC, mes corrido, sin la rama de fecha sola, sin chequeo de `NaN`, timestamp completo → `""` y el componente que vuelve a `new Date()`: **6 de 6 detectados.**
- **TypeScript: NO verificado** (corregido en §67: lo que reporté como "0 errores" fue un `npx tsc` que no era TypeScript). **Suite del frontend:** **273/273**, también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome), contra Postgres:** en un primer intento la extensión se desconectó antes de abrir la pantalla; lo hice después, junto con la verificación de §64 (schema descartable). Con Sustentando, en `/ngo/kpis/proj-1`, un KPI con `fecha: "2026-10-01"` se ve **"01 de oct de 2026"** y otro con `"2026-10-02"`, "02 de oct de 2026".
  - Al crear el primero con `curl` desde Git Bash, los acentos se guardaron rotos (`ef bf bd` en la base): `curl` mandó bytes que no son UTF-8. El segundo, creado con `fetch` desde Node, se ve bien ("Árboles en plantación"). **Fue la herramienta, no la app.**

### Errores míos
1. Agregué los tests del helper con un `node -e` entre comillas dobles que tenía backticks: bash los tomó como sustitución de comandos y el comentario quedó sin el fragmento `` `new Date('2026-10-01')` ``. Lo vi en el diff y lo corregí con `Edit`. Lección: texto con backticks, por `Edit`/archivo, no por `node -e "..."`.
2. El primer test del componente buscaba el nombre del KPI con `getByText`, pero aparece dos veces en pantalla: lo cambié a `getAllByText` antes de confiar en el rojo.

### ⚠️ NO verificado
- F3 (KPI de tipo "texto" que no se puede guardar) sigue abierto: necesita una decisión.

## 64. Recurso que no carga → página en blanco — REVISION F7

**Contexto:** `ProjectDetails`, `NGOPublicProfile`, `CompanyPublicProfile` y `NGOProjectDetail` hacían `catch { navigate(-1) }` y después `if (!x) return null`. Abiertas desde un link compartido (pestaña nueva, sin historial), `navigate(-1)` no tiene a dónde ir: la pantalla quedaba **en blanco, sin mensaje**, tanto si el recurso no existía como si el backend fallaba.

**Arreglo:**
- `components/LoadError.tsx` (nuevo, compartido, regla 3):
  - `describeLoadError(err, textoNoExiste)` usa el `status` de `ApiError` (§62): 404 → "No encontramos este voluntariado / esta organización / esta empresa", sin reintentar; 403 → el mensaje del servidor, sin reintentar; 5xx → el mensaje con "Reintentar"; sin red (`TypeError`) → "No pudimos conectarnos con el servidor. Revisá tu conexión.", con "Reintentar".
  - `<LoadError>` muestra el mensaje, "Reintentar" si corresponde, y "Volver" solo si hay página anterior (React Router guarda el índice en `history.state.idx`); si no, "Ir al inicio" (`/`, o `/ngo/dashboard` en `NGOProjectDetail`). Mismo estilo que el error de `CompanyDashboard`.
- Las 4 pantallas guardan el error en `loadError` y lo limpian al reintentar. `NGOPublicProfile` y `CompanyPublicProfile` cargaban dentro del `useEffect`: lo pasé a una función `load` para poder reintentar.

### Tests (nuevos: 16)
- `LoadError.test.tsx` (8): los cuatro casos de `describeLoadError`; "Reintentar" llama a `onRetry` y no aparece sin él; sin historial → "Ir al inicio" con el `href` correcto; con historial → "Volver".
- `LoadErrorScreens.test.tsx` (8): las 4 pantallas con el API simulado. 404 → mensaje de "no existe", sin "Reintentar" y **sin `navigate(-1)`**; 502 → mensaje y "Reintentar", que vuelve a pedir.

### Verificación
- **Rojo → verde:** los 8 tests de pantallas fallaban con el bug real (no aparecía nada en pantalla). Los de `LoadError` fueron rojo débil (el módulo no existía).
- **Mutación (12 mutantes, línea base en verde, script descartable):** 404 o 4xx reintentables, texto técnico sin red, "Volver" siempre o nunca, "Reintentar" que no llama, cada una de las 4 pantallas volviendo a `navigate(-1)`, y dos pantallas sin `onRetry`: **12 de 12 detectados.**
- **TypeScript: NO verificado** (corregido en §67: lo que reporté como "0 errores" fue un `npx tsc` que no era TypeScript). **Suite del frontend:** **289/289**.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_f7`, borrado al terminar):
  - `/project/no-existe` en una pestaña nueva → "No encontramos este voluntariado" con "Ir al inicio" (sin "Volver"; antes, en blanco).
  - Con el backend **apagado**, `/ngo/ngo-1` → "No pudimos conectarnos con el servidor. Revisá tu conexión." con "Reintentar". Levanté el backend, toqué "Reintentar" y cargó el perfil de Sustentando.

### Errores míos
Ninguno detectado en este cambio.

### ⚠️ NO verificado
- "Volver" con historial real en el navegador: lo cubre el test (con `history.state.idx`); en Chrome probé solo el caso sin historial.
- Que React Router siga guardando `idx` en `history.state` en futuras versiones: es un detalle interno suyo. Si cambia, se vería "Ir al inicio" siempre (no se rompe nada).
- F9 (errores tragados en listados y paneles) va en el próximo commit.

## 65. Errores tragados en silencio — REVISION F9

**Contexto:** seis lugares descartaban el error:
- **Cargas** que, si fallaban, mostraban el estado vacío como si no hubiera datos: `NGOPatrocinios` ("Todavía no recibiste propuestas"), `NGOKPIs` ("Sin KPIs todavía"), `NotificationsScreen` ("Sin notificaciones"), la sección de patrocinios de `CompanyOwnProfile` ("Todavía no hay patrocinios") y `NGODashboard` (un panel sin proyectos, salvo que el mensaje contuviera "Token").
- **Acciones** que fallaban sin decir nada: decidir un patrocinio, retirar una propuesta y marcar las notificaciones como leídas.

**Arreglo:**
- `InlineError` (nuevo, en `components/LoadError.tsx`): mensaje + "Reintentar". Cada carga guarda su error y lo muestra **en lugar** del estado vacío. El mensaje sale de `userMessage()` (el del backend en español, o un texto propio si no hay red).
- Las acciones muestran su error con `role="alert"`.
- `NGODashboard` va al inicio solo con un **401** (`ApiError.status`, §62); antes buscaba "Token"/"autenticado" en el texto del mensaje.

### Tests (nuevos: 9)
`SwallowedErrors.test.tsx`, con el API simulado. Para cada una de las 5 cargas: error 500 → se ve el mensaje y **no** el estado vacío, y "Reintentar" vuelve a pedir. Más: 401 en el panel → va a `/`; y las 3 acciones que fallan (409 o sin red) → aparece el `alert`.

### Verificación
- **Rojo → verde:** 8 de 9 fallaban con el bug real (no aparecía ningún error). El de 401 ya pasaba; es control de que el cambio no lo rompe.
- **Mutación (15 mutantes, línea base en verde, script descartable):** volver a tragar el error en cada carga y en cada acción, volver al estado vacío, "Reintentar" que no recarga (en 4 pantallas), 401 que no redirige y cualquier error que redirige: **15 de 15 detectados.** En el primer pase faltaba el de "Reintentar" en notificaciones: el test solo miraba que el botón existiera. Agregué el chequeo de que vuelve a pedir.
- **TypeScript: NO verificado** (corregido en §67: lo que reporté como "0 errores" fue un `npx tsc` que no era TypeScript). **Suite del frontend:** **298/298**, también con `TZ=America/Argentina/Cordoba`. Los tests previos de `NGOPatrocinios` y `CompanyOwnProfile` siguen pasando.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_f9`, borrado al terminar): como Sustentando, el panel cargó normal. Con el backend **apagado**:
  - `/ngo/dashboard` → "No pudimos cargar tu panel. Revisá tu conexión." con "Reintentar";
  - `/ngo/patrocinios` → "No pudimos cargar las propuestas…".
  
  Levanté el backend, toqué "Reintentar" y cargó: ahí sí "Todavía no recibiste propuestas", que ahora es el vacío real (el seed no tiene propuestas).

### Errores míos
1. El primer test de notificaciones no comprobaba que "Reintentar" recargara (ver mutación).

### ⚠️ NO verificado / fuera de alcance
- En el navegador probé solo el panel y patrocinios; KPIs, notificaciones y la sección de la empresa los cubren los tests.
- **Visto y no tocado:** `VolunteerProfile` ("Mi Perfil") con el backend caído muestra **0 en todas las estadísticas** (§62), y `NGOProjectDetail` usa `alert()` para errores de aprobar o cargar horas. Mismo problema de fondo, pero no estaban en F9. Quedan anotados.

## 66. Empresa: el selector de patrocinio solo listaba 20 proyectos — REVISION F6

**Contexto:** `CompanyOwnProfile` llenaba "Proponer patrocinio" con `api.projects.list({ status: 'active' })` sin `limit`: el backend devuelve 20 por defecto (`projects.js`, sin paginación, deuda conocida). El botón "Patrocinar este proyecto" de `ProjectDetails` llevaba a `/company/profile` sin decir cuál proyecto. **Reproducido contra Postgres:** con 37 proyectos activos, 17 no aparecían en el selector, y la empresa no tenía forma de patrocinarlos.

**Arreglo:**
- `ProjectDetails`: el botón lleva a `/company/profile?proponer=<id>`.
- `CompanyOwnProfile`: con `?proponer=` abre "Proponer" con ese proyecto ya elegido, una sola vez (`useRef`).
  - Si no vino en el listado, lo trae con `api.projects.get` y lo agrega.
  - Si ya hay una propuesta vigente para ese proyecto, o el proyecto no está activo, lo dice.
  - El listado pide `limit: '500'` (constante `MAX_PROPOSABLE` comentada).
  - El error del formulario se muestra también cuando no hay proyectos para elegir.

### Tests (nuevos: 7)
`SponsorPreselect.test.tsx`:
- el listado pide un `limit` > 20;
- un proyecto fuera de la lista se trae, queda elegido y se propone;
- uno que sí está en la lista queda elegido sin pedirlo aparte;
- propuesta vigente → aviso;
- proyecto no activo → aviso y no se ofrece;
- sin `?proponer=` el formulario arranca cerrado;
- el link de `ProjectDetails` (renderizado con una empresa) apunta a `?proponer=<id>`.

### Verificación
- **Rojo → verde:** fallaban los 5 casos de preselección y de `limit` (`limit` era `NaN`; nada se preelegía). Pasaba el de "arranca cerrado", que es control. El test del link lo agregué después, al ver que nada lo cubría; la mutación confirma que detecta el link viejo.
- **Mutación (8 mutantes, línea base en verde, script descartable):** sin `limit`, sin preselección, sin traer el proyecto faltante, sin aviso de propuesta vigente, ofrecer no activos, no agregarlo a la lista, pedirlo aparte aunque esté, y el link viejo: **8 de 8 detectados.**
- **Suite del frontend:** **305/305**, también con `TZ=America/Argentina/Cordoba`. Los tests anteriores de `CompanyOwnProfile` y de §65 siguen pasando.
- **TypeScript: NO verificado.** El frontend no tiene `typescript` instalado; ver §67.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_f6` con 25 proyectos extra creados por la API, borrado al terminar; frontend con la Vite **local** 6.4.3): como TechCorp, abrí "Jornada extra número 17" (uno de los 17 que el listado por defecto dejaba afuera) y toqué "Patrocinar este proyecto". Llevó a `/company/profile?proponer=…` con el formulario abierto y ese proyecto elegido. Envié la propuesta: quedó "Pendiente" en pantalla y `propuesto` en la base.

### Errores míos
1. **`npx vite` bajó y ejecutó un paquete del registry.** En el primer intento de verificación, `cd frontend && npx vite …` (lanzado en segundo plano) no resolvió la Vite local e instaló `vite@8.3.4` en el caché de npx (`npm warn exec The following package was not found and will be installed`). Esa Vite servía otro directorio (404) y así lo vi. Frené, avisé al usuario, borré esa carpeta del caché con su aprobación y rehíce la verificación con `./node_modules/.bin/vite`. No sé por qué esa vez npx no encontró la local *(causa encontrada en §70: el `cd` se pisó con otro comando lanzado en paralelo)*. Lección: nunca `npx` para binarios del proyecto.
2. Al revisar el caché encontré el error más grave, el de §67.

### ⚠️ NO verificado
- TypeScript (§67).
- Con más de 500 proyectos activos, el selector manual seguiría cortado. El camino por `?proponer=` no depende de ese tope. Hace falta paginación real (deuda conocida).

## 67. Corrección: el "tsc con 0 errores" de §62–§65 no fue un chequeo de tipos

**Qué pasó:** en §62 (F4+F5), §63 (F2), §64 (F7) y §65 (F9) reporté "TypeScript: `tsc --noEmit` con 0 errores". **Es falso.** El frontend **no tiene `typescript` instalado**: no está en `package.json` ni en `node_modules`, y ya lo advertía este mismo documento (§ de la línea "`typescript` **no es dependencia** del frontend… Un `tsc` que 'no imprime errores' puede ser un `tsc` que no existe"). Corrí `npx tsc --noEmit -p .` y conté las líneas con `error TS`. npx no encontró TypeScript, bajó del registry el paquete **`tsc@2.0.4`** ("A deprecated release of the TypeScript compiler", otro paquete que no es TypeScript), que solo imprime *"This is not the tsc command you are looking for"*. El conteo dio 0 y lo informé como "0 errores".

**Cómo lo detecté:** después del incidente de `npx vite` (§66) revisé el caché de npx (`npm-cache\_npx`) y encontré esa entrada, creada el 2026-10-14. Ejecutada a mano mostró el mensaje.

**Qué se corrigió:** las cuatro secciones ahora dicen "TypeScript: NO verificado" y remiten acá. Lo que sí vale de esas secciones (tests, mutación, navegador) no cambia: Vitest transpila sin chequear tipos, así que los tests no dependen de esto.

**Qué falta:** un chequeo de tipos real necesita `typescript` (y `@types/react`, `@types/react-dom`, `@types/node`), que hoy no son dependencias. Instalarlos es decisión del usuario (agrega dependencias y entra en `npm audit`). Hasta entonces, **ningún cambio de frontend está chequeado por tipos**.

### Errores míos
1. Afirmar "0 errores" mirando un conteo en vez de la salida cruda, sin comprobar antes que el comando era el que creía.
2. No leer la advertencia que ya estaba en este documento.
3. Usar `npx` para binarios del proyecto: puede bajar y ejecutar paquetes del registry sin preguntar (pasó con `vite` y con `tsc`). Ahora uso solo `node_modules/.bin/…`.

## 68. TypeScript instalado en el frontend: primer chequeo de tipos real

**Contexto:** §67. El usuario aprobó instalar TypeScript y borrar el paquete `tsc` que había bajado npx (borrado, igual que el `vite@8.3.4` de §66).

**Qué se hizo:**
- `devDependencies` del frontend: `typescript@^7.0.2`, `@types/react@^18.3.31`, `@types/react-dom@^18.3.7` (React 18) y `@types/node@^22.20.5` (Node ≥22).
- Antes de instalar revisé las fechas: TypeScript 7.0.2 es del 2026-07-08 (estable desde hace tres meses) y los `@types` tienen más de dos semanas.
- El lockfile sumó solo esos paquetes, sus dependencias (`csstype`, `undici-types`, `@types/prop-types`) y los binarios nativos de TypeScript 7, uno por plataforma (npm instala solo el de la máquina). **`npm audit`: 0 vulnerabilidades.**
- Script nuevo: **`npm run typecheck`** (`tsc --noEmit -p .`), para no depender de `npx`. El aviso de npm sobre el `postinstall` de `esbuild` ya existía (viene con Vite).

### Resultado del primer chequeo real: 18 errores, todos de configuración (ninguno de lógica)
- **7 — tipos de Vite no declarados** (falta el `src/vite-env.d.ts` estándar con `/// <reference types="vite/client" />`): `import.meta.env` en `api.ts` y en `NGOEmpleados.tsx` (×2), y los `import` de `.css` en `main.tsx` (×3) y `ProjectMap.tsx`.
- **10 — `process`/`global` en tests:** `format.test.ts` (×5) y `NGOKPIs.test.tsx` (×4), **los dos escritos por mí en §63**, y `test/setup.ts` (×1). `@types/node` está instalado, pero desde TypeScript 6 los `@types` ya no se incluyen solos: hay que nombrarlos en `types`.
- **1 — `Array.prototype.at`** en `api.posts.test.ts`: `tsconfig` tiene `lib: ES2020` y `.at()` es ES2022.

Los 305 tests siguen pasando: Vitest no chequea tipos.

### ⚠️ Pendiente (decisión del usuario)
Arreglarlos es configuración: el `vite-env.d.ts`, `types: ["vite/client", "node"]` y `lib` en ES2022. Sumar `node` a `types` deja ver `process` también en el código de la app; la alternativa es un `tsconfig` aparte para los tests. Corregido eso, podrían aparecer errores que hoy tapa la configuración: hay que volver a correr y mirar la salida.

## 69. Configuración de TypeScript: de 18 errores a 0

**Pedido del usuario:** la "versión simple" propuesta en §68.

**Cambio** (`frontend/tsconfig.json`):
- `"types": ["vite/client", "node"]`: declara los tipos de Vite (`import.meta.env`, `import` de `.css`) y los de Node (`process`, `global` en los tests).
- `lib` de ES2020 a **ES2022** (`Array.prototype.at`).

No hizo falta el `src/vite-env.d.ts` que había propuesto: `"vite/client"` en `types` hace lo mismo. `target` sigue en ES2020: el build lo maneja Vite y `tsc` solo chequea (`noEmit`).

**Contra de la versión simple (elegida a sabiendas):** con `node` en `types`, el código de la app también "ve" `process`, `Buffer`, etc. sin que TypeScript se queje, aunque en el navegador no existen. La alternativa era un `tsconfig` aparte para los tests.

### Verificación
- `npm run typecheck`: **exit 0, salida vacía.** Leí la salida cruda.
- **Prueba de que chequea de verdad** (por §67): un archivo temporal con `const n: number = 'texto'` y `api.projects.get(123)` dio los dos errores esperados (TS2322 y TS2345). Lo borré y volvió a 0.
- Los 18 errores de §68 eran de configuración: con esto no apareció ninguno nuevo de los que la configuración tapaba.
- Suite del frontend: **305/305**.

### ⚠️ NO verificado
- Que nadie use `process` en código de la app por error: TypeScript ya no lo marca (ver "contra").

## 70. Inscripción rechazada se veía "Inscripto · Pendiente" — REVISION F8

**Contexto:** en `ProjectDetails`, el botón de inscripción mostraba `Inscripto · ${status === 'approved' ? 'Aprobado' : 'Pendiente'}`. Cualquier estado que no fuera "aprobado" (incluido **rechazado**) se veía "Pendiente", para siempre. Como `enrollments` tiene `UNIQUE(user_id, project_id)`, un voluntario rechazado **no puede volver a postularse** a ese proyecto: el botón tiene que decirlo, no ofrecer otra inscripción.

**Arreglo** (`ProjectDetails.tsx`): estado `rejected` → **"Inscripción rechazada"**, deshabilitado y en rojo (`bg-red-50 text-red-600`). Pendiente y aprobado no cambian.

### Tests (nuevos: 3)
`EnrollStatusLabel.test.tsx`: rechazada → "Inscripción rechazada" deshabilitado y sin "Pendiente"; pendiente → "Inscripto · Pendiente"; aprobada → "Inscripto · Aprobado".

### Verificación
- **Rojo → verde:** fallaba el de rechazada (no encontraba el texto); pendiente y aprobada eran controles.
- **Mutación (3 mutantes):** sin la rama de rechazada y otro texto: **detectados**. **Sobrevive el estilo rojo**: los tests no miran clases. Lo verifiqué a ojo en el navegador.
- **TypeScript:** `npm run typecheck` → exit 0. **Suite del frontend:** **308/308**.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_f8`, con la inscripción de María en `proj-9` pasada a `rejected`; borrado al terminar): como María, en `/project/proj-9` el botón dice **"Inscripción rechazada"** en rojo y está deshabilitado.

### Errores míos — y la causa del incidente de `npx` (§66)
Al levantar el frontend, el comando con `cd …/frontend && ./node_modules/.bin/vite` falló con *No such file or directory* (exit 127): **se ejecutó en `backend/`**. Lo había lanzado en paralelo con el del backend (`cd …/backend && …`). El directorio de trabajo de la herramienta es compartido y los dos `cd` se pisaron. **Es la causa del incidente de §66:** ahí `npx vite` corrió en `backend/`, no encontró Vite y la bajó del registry. Esta vez, sin `npx`, falló sin consecuencias. Desde ahora el frontend se levanta con **ruta absoluta y la raíz como argumento** (`"$F/node_modules/.bin/vite" "$F" --port 5180`) y sin depender de un `cd`. Así funcionó.

### ⚠️ NO verificado
- Que la ONG no tenga forma de "reabrir" una inscripción rechazada: hoy `PATCH /enrollments/:id` permite pasar de `rejected` a `approved`. Si lo hace, el botón pasa a "Aprobado" (se lee del servidor en cada carga). No lo probé.

## 71. El chat reconectaba para siempre con el token vencido — REVISION F10

**Contexto:** `ChatContext` reconecta el WebSocket con backoff (tope 10 s) cuando se corta. Si el servidor lo cerraba con **4001** (token inválido o vencido, `ws/index.js:63`), lo intentaba igual cada 10 s, **para siempre**, aunque con ese token cada intento iba a fallar.

**Arreglo** (`lib/ChatContext.tsx`): `onclose` mira `ev.code`; con 4001 no reprograma la reconexión. Cualquier otro corte (reinicio del server, red, 1006) sigue reconectando. No agregué un cierre de sesión automático: sería un cambio de comportamiento mayor. El 401 del próximo pedido REST o la próxima recarga (§62) lo resuelven.

### Tests (nuevos: 2)
`src/lib/ChatContext.test.tsx`, con un `WebSocket` falso y timers falsos: un cierre 1006 reconecta a 1 s; un cierre 4001 no abre ninguna conexión nueva en 60 s.

### Verificación
- **Rojo → verde:** el de 4001 fallaba (abría otra conexión); el de 1006 era control.
- **Mutación (3 mutantes):** sin el chequeo, otro código, y no reconectar nunca: **3 de 3 detectados.**
- **TypeScript:** exit 0. **Suite del frontend:** **310/310**.

### Errores míos
1. El primer mock de `useAuth` devolvía un objeto nuevo en cada render. El efecto (que depende de `user`) reabría el socket en cada render y los dos tests fallaban por eso, no por el bug. Lo cambié a referencias estables, como en la app, antes de confiar en el rojo.

### ⚠️ NO verificado
- **En el navegador:** un 4001 solo pasa si el token vence con la sesión abierta. Al cargar con un token inválido, `AuthContext` cierra la sesión antes (401) y el socket no se abre. No lo reproduje en Chrome.

## 72. Notificaciones con 3 horas de desfase (copia propia de `timeAgo`) — REVISION F11

**Contexto:** `NotificationsScreen.tsx` tenía su propia copia de `timeAgo` con `new Date(fecha)`. El formato de SQLite (`"YYYY-MM-DD HH:MM:SS"`, UTC sin zona) se leía como hora **local**. Comprobado con la expresión vieja en la TZ de Córdoba: una notificación de hace 5 minutos daba **−175 minutos** (3 h "en el futuro") y se mostraba "ahora". Pasa solo con SQLite (dev): Postgres manda ISO con `Z`, que la copia sí leía bien.

**Arreglo:** la pantalla usa el `timeAgo` compartido de `lib/format.ts` (pasa por `parseBackendDate`, §46/§53); se borró la copia (regla 3). **Cambio visible chico:** el texto pasa de "hace 5m" / "hace 3h" / "hace 2d" al formato del resto de la app ("5 min" / "3 h" / "2 d", y la fecha después de una semana).

### Tests (nuevos: 2)
`NotificationsTime.test.tsx` (TZ de Córdoba y "ahora" fijos): formato SQLite de hace 5 minutos → "5 min"; ISO con `Z` de hace 3 horas → "3 h".

### Verificación
- **Rojo → verde:** fallaban los dos. El de SQLite por el bug ("ahora"). El de ISO, solo por el formato viejo ("hace 3h").
- **Mutación:** una copia local con **el mismo formato** que la compartida pero parseando con `new Date()` → **detectada**. El test agarra el error de parseo, no solo el cambio de texto.
- **TypeScript:** exit 0. **Suite del frontend:** **312/312**.

### ⚠️ NO verificado
- **En el navegador:** el bug es solo de SQLite (dev) y mis verificaciones corren contra Postgres. Lo cubre el test.

## 73. "Ver en panel ONG" se ofrecía a cualquier ONG — REVISION F16

**Contexto:** `ProjectDetails` le mostraba "Ver en panel ONG" a **cualquier** usuario con rol `ngo`, en cualquier proyecto (solo miraba `project.ngo_id`). En un proyecto ajeno el panel respondía 403 (desde §64, con un mensaje de error). El frontend no tenía cómo saber de quién era el proyecto: `User` no trae el id de la ONG y `GET /projects/:id` no lo decía.

**Arreglo:**
- **Backend** (`GET /projects/:id`): campo nuevo **`can_manage`**, `true` solo si quien pide es la ONG dueña. Se calcula con una consulta aparte (`ngos WHERE id AND user_id`) en vez de sumar `n.user_id` al SELECT, porque `fmt()` esparce todas las columnas y lo expondría.
- **Contrato** (`api.ts`, reglas 6/7): `ProjectDetail.can_manage?: boolean`.
- **Frontend:** `ProjectDetails` muestra el link solo con `project.can_manage`. La decisión es del backend (regla 15).

### Tests (nuevos: 5)
- `backend/test/integration/project-can-manage.test.js` (3, en los dos motores): dueña → `true`; otra ONG, voluntario, empresa y sin sesión → `false`; la respuesta no incluye el `user_id` de la ONG.
- `frontend/src/app/components/NgoPanelLink.test.tsx` (2): con `can_manage` el link apunta a `/ngo/dashboard/project/<id>`; sin él no aparece.

### Verificación
- **Rojo → verde:** backend, los dos primeros fallaban (`can_manage` no existía). Frontend: la otra ONG **veía** el link (dos, móvil y escritorio).
- **Mutación (4):** cualquier ONG puede, sin filtro de dueño, y el link para cualquier ONG (lo de antes): **detectados** (backend en los dos motores). Sobrevive "sin chequeo de rol": **equivalente**, porque solo los usuarios ONG tienen fila en `ngos`; el chequeo solo ahorra una consulta.
- **Suites completas:** backend **322/322** (SQLite) y **324/324** (Postgres), las dos también con `TZ=America/Argentina/Cordoba`; frontend **314/314**; `npm run typecheck` exit 0.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_f16`, borrado al terminar; backend y Vite local levantados **de a uno y por ruta absoluta**, §70): como Sustentando, en `/project/proj-1` (propio) aparece "Ver en panel ONG"; en `/project/proj-2` (de Green Córdoba) ya no.

### Errores de documentación encontrados
- `API_CONTEXT.md` decía que `GET /projects/:id` responde 404 también para `status='cancelled'` si no es la dueña. **El código no lo hace** (solo 404 si no existe). Corregido.

### ⚠️ NO verificado / visto
- Para una ONG en un proyecto ajeno, la columna de acciones queda vacía (sin botón). Podría mostrar algo informativo; no lo cambié.

## 74. Calificación y estado de proyecto inválidos daban 500 — REVISION B10 y B11 (`status`)

**Contexto (`routes/projects.js`):**
- `POST /:id/ratings` validaba con `!rating || rating < 1 || rating > 5`. **`"abc" < 1` es `false`**, así que `"abc"`, un array o `"4.0x"` pasaban y reventaban en el `CHECK` de la base (**500**). Con `3.5`, SQLite lo guardaba y **Postgres (INTEGER) daba 500**. `comment` no se validaba.
- `PUT /:id`: un `status` fuera de `active`/`completed`/`cancelled` reventaba en el `CHECK` (500).

**Arreglo:**
- `rating` tiene que ser un **entero** de 1 a 5. Un string de solo dígitos (`"4"`) se convierte, por si viene de un form. Si no → 400 "La calificación tiene que ser un número entero del 1 al 5".
- `comment`, si viene, texto de hasta 1000 caracteres (400 si no).
- `status` en el PUT, si viene, tiene que estar en la lista (400 si no).

### Tests (nuevos: 13, en los dos motores)
`test/integration/projects-input-validation.test.js`:
- `rating` `"abc"`, `3.5`, `0`, `6`, `null`, `[4]` y `"4.0x"` → 400, sin cambiar la calificación existente;
- `comment` objeto → 400; 1001 caracteres → 400; exactamente 1000 → 200; `"4"` con comentario → 200 y se guarda `4`;
- `status: "borrado"` → 400 sin cambiar el proyecto; `status: "completed"` → 200.

### Verificación
- **Rojo → verde:** en los dos motores fallaban `"abc"`, `3.5`, el array, `"4.0x"` (500), los dos de `comment` y el de `status`. `0`, `6` y `null` ya daban 400: son control.
- **Mutación (7, los dos motores, script descartable):** sin `isInteger`, sin convertir `"4"`, rango hasta 6, sin chequeo de tipo del comentario, tope `>= 1000`, sin chequeo de `status` y lista sin `completed`: **7 de 7 detectados.** En el primer pase sobrevivió el tope del comentario: no había caso de exactamente 1000. Lo agregué.
- **Suites completas:** SQLite **335/335** y Postgres **337/337**, las dos también con `TZ=America/Argentina/Cordoba`.
- Sin navegador: el frontend manda siempre un entero de 1 a 5 (las estrellas) y nunca un `status` inválido.

### Errores míos
1. El primer test asumía que María no tenía calificación en `proj-1`, pero el seed ya tiene una (5). Los casos `0`/`6`/`null` fallaban por eso y no por el bug. Lo corregí a "no cambia la existente" antes de confiar en el rojo.
2. Al escribir la regex `/^\d+$/` con un `node -e` entre comillas, el escapado se comió la barra y quedó `/^d+$/` (rechazaba `"4"`). Lo agarró el test. Lo corregí con un script en archivo. Lección (como en §63): código con barras o backticks, por archivo, no por `node -e`.
3. Un `node -e` que actualizaba la documentación falló a mitad (no encontró la fila de `REVISION.md`, que ya había cambiado con B18). Como el `git add` estaba en otra línea, el commit salió sin esta sección. Lo vi en `git show --stat` y lo completé con `--amend`.

### ⚠️ NO verificado / fuera de alcance
- Los comentarios de una calificación no pasan por el filtro de palabras (`hasBadWord`), a diferencia de los comentarios del proyecto. No lo cambié (B7 está pendiente de decisión).

## 75. Horas cargadas como Infinity (o "12abc" como 12) — REVISION B14

**Contexto:** `PATCH /api/enrollments/:id/horas` validaba con `parseFloat` + `isNaN`.
- `"1e400"`, o el número `1e400` en el JSON (que `JSON.parse` convierte en `Infinity`), pasaba como **Infinity** y se guardaba: los totales de horas (panel de empresa, perfil del voluntario) quedaban rotos.
- `"12abc"` se guardaba como 12 en silencio; `[5]` como 5.
- No había tope.

**Arreglo** (`routes/enrollments.js`): `horas` tiene que ser un número (o un string numérico no vacío, `"7.5"`) **finito, entre 0 y `MAX_HORAS` (10000)**. Si no → 400 "Las horas tienen que ser un número entre 0 y 10000". El tope es holgado (unas 40 h semanales durante 5 años): solo corta valores absurdos o mal tipeados.

### Tests (nuevos: 12, en los dos motores)
`test/integration/enrollments-hours-validation.test.js`:
- `"1e400"`, `1e400` crudo en el JSON, `"12abc"`, `10001`, `-1`, `""`, `null` y `[5]` → 400, sin cambiar las horas;
- `7.5`, `"7.5"`, `0` y `10000` → 200 y se guardan.

### Verificación
- **Rojo → verde:** en los dos motores, `"1e400"`, `1e400`, `"12abc"`, `10001` y `[5]` daban 200. `-1`, `""` y `null` ya daban 400, pero en el rojo fallaban **en cascada**: el `10001` anterior se había guardado y cambiaba el punto de partida (`actual: 10001`).
- **Mutación (6, los dos motores, script descartable):** sin tope, tope `>=`, `parseFloat`, aceptar `""` y no aceptar strings: **detectados**. Sobrevive "sin `isFinite`": **equivalente**, porque el tope ya rechaza `Infinity` (`Infinity > 10000`) y `-Infinity` cae en `h < 0`. `isFinite` queda por claridad.
- **Suites completas:** SQLite **347/347** y Postgres **349/349**, las dos también con `TZ=America/Argentina/Cordoba`.
- Sin navegador: `NGOProjectDetail` ya valida `>= 0` antes de mandar. Un valor de más de 10000 ahora se ve con el `alert` de error de esa pantalla (que usa `alert()`, anotado en §65).

## 76. Auth y perfiles: tipos, nombres vacíos y textos sin tope — REVISION B11 (rol de empleado), B12, B13

**Contexto:**
- **B13:** los validadores de `auth.js` hacían `v.trim()` sin chequear el tipo. Un login con `email: [...]` o un registro con `name: 5` daban **500**. Lo mismo pasaba en el alta de empleados (`nombre?.trim()`) y en el `name` de los perfiles de ONG y empresa.
- **B12:** `PUT /auth/me`, `/ngos/me` y `/empresas/me` validaban el nombre con `if (name && …)`: `name: ""` se salteaba la validación y **dejaba el nombre vacío** (200).
- Los textos libres (bio, descripción, misión, URLs…) no tenían tipo ni largo máximo: un objeto o un texto enorme se guardaban.
- **B11:** un `rol` de empleado fuera de la lista reventaba en el `CHECK` (500).

**Arreglo:**
- **`src/lib/inputs.js`** (nuevo, regla 3): `checkText(valor, { label, max, min, required, nullable })` devuelve el error en español o `null`. `undefined` = no vino (no tocar, salvo obligatorio); `null` = borrar (salvo obligatorio); si viene tiene que ser string, no vacío si es obligatorio, y con largo entre `min` y `max`. Más `firstError(...)`.
- **`auth.js`:** `validateEmail`/`validateName`/`validatePassword` exigen string; el login exige `email` y `password` string. `PUT /me` valida `name` si **no es `undefined`** (también `""` y `null`), lo guarda recortado, y topea `bio` 500, `location` 150 y `avatar` 1000.
- **`ngos.js` / `empresas.js` (`PUT /me`):** `name` 2–100 (no se puede borrar), guardado recortado; `description` 2000, `mission` 1000, `location` 150, `logo`/`cover_image` 1000, `alias` 50, `founded` 20, `industry` 100, `category` 60.
- **Empleados:** `nombre`/`apellido` obligatorios (≤ 100), `email` con `validateEmail` (importado de `auth.js`, sin copiarlo), `rol` en la lista.
- **Topes elegidos por mí** (el frontend no tiene `maxLength`): holgados, solo para cortar abusos.

### Tests (nuevos: 22)
- `test/unit/inputs.test.js` (7): el contrato de `checkText` (`undefined`/`null`/tipo/vacío/mínimo/máximo inclusivo) y `firstError`.
- `test/integration/profiles-input-validation.test.js` (15, en los dos motores):
  - login con `email` array/número y `password` array → 400; registro con `name`/`email`/`password` de otro tipo → 400 y no crea el usuario;
  - `PUT /auth/me` con `name` `""`/espacios/`null` → 400 sin cambios; `bio` objeto o de 501 y `location` de 151 → 400; válido → nombre recortado y `bio: null` la borra;
  - ONG y empresa: `name` `""`/espacios/`null` → 400 sin cambios; `name` número, `description` array o de 2001, `mission` de 1001 → 400; válido → nombre recortado;
  - empleados: `rol: "jefe"`, `nombre` número o vacío, `email` array o inválido, sin `apellido` → 400 sin crear nada; válido sin `rol` → 201 con `coordinador`.

### Verificación
- **Rojo → verde:** en los dos motores fallaban todos menos el alta válida de empleado (control). Revisé los motivos antes de arreglar: 500 por `.trim()`, 200 con el nombre vacío, nombres sin recortar.
- **Mutación (16, los dos motores, script descartable):** 13 detectados en el primer pase. Sobrevivían 3 del helper (aceptar vacío, aceptar `null` siempre, `required` que no exige) porque ningún test usaba un `nombre` de empleado vacío, un `name: null` de ONG ni un empleado sin `apellido`. **No eran equivalentes**: dos terminaban en 500 y uno guardaba vacío. Agregué esos casos y el test unitario: **16 de 16.**
- **Regresión:** revisé lo que mandan los formularios (`VolunteerProfile`, `NGOOwnProfile`, `CompanyOwnProfile`, `NGOEmpleados`): todo es texto y los roles son los mismos 4. Ninguno queda afuera.
- **Suites completas:** SQLite **369/369** y Postgres **371/371**, las dos también con `TZ=America/Argentina/Cordoba`.

### ⚠️ NO verificado / fuera de alcance
- Sin navegador: los formularios ya mandaban texto válido; los casos nuevos solo se alcanzan llamando a la API directo.
- `PUT /ngos/me` todavía responde con la fila cruda de `ngos` (incluye `user_id`): es REVISION B21, aparte.
- El registro no topea el largo del email ni de la contraseña (más allá del mínimo).

## 77. Carreras en follows y en la decisión de patrocinio — REVISION B15 y B16

**Contexto:** la revisión los dejó "a confirmar con concurrencia". El plan era escribir primero el test en `test:pg` y arreglar solo si fallaba. **Falló, de forma reproducible (3 de 3 corridas en Postgres):**
- **B15 (follows, los 3 tipos: ONG, proyecto y voluntario):** el handler hacía `SELECT` "¿ya lo sigo?" → `INSERT` → `UPDATE followers + 1`, sueltos y fuera de transacción. Con 8 "seguir" simultáneos, varios pasaban el `SELECT`; uno insertaba y el resto chocaba con la PK → **500**. Con 8 "dejar de seguir" simultáneos, todos veían la fila y **todos descontaban**: el contador bajaba 8 en vez de 1 (`followers` de la ONG quedaba desfasado para siempre). En el de voluntarios, además, salía una notificación `new_follower` por cada request que pasaba el `SELECT`.
- **B16 (`PATCH /api/ngos/me/patrocinios/:empresaId/:projectId`):** chequeaba `estado !== 'propuesto'` y después hacía el `UPDATE` sin condición. Con aceptar y rechazar a la vez, **6 de 8 respondían 200** (cada una con su notificación y su email a la empresa, contradictorios); con la misma decisión 8 veces, **8 de 8** respondían 200.
- En SQLite no se ve: cada handler corre casi sin intercalarse con los demás (mismo caso que `enrollments-concurrency.test.js`, §34).

**Arreglo:**
- **`routes/follows.js`:** helper `toggleFollow(changeSql, params, counterSql, counterId)`: en una `db.transaction()` (regla 21) corre el `INSERT ... ON CONFLICT DO NOTHING` (o el `DELETE`) y mueve el contador **solo si `changes === 1`**; devuelve si hubo cambio real. Los 6 handlers (seguir/dejar de seguir × 3) lo usan y se borraron los `SELECT` previos. La notificación de nuevo seguidor queda **después del COMMIT** y solo si hubo follow real. La respuesta no cambió (`{ following, followers, message }`, 200 también si ya lo seguías).
- **`routes/ngos.js`:** compare-and-swap: `UPDATE ... WHERE empresa_id=$2 AND project_id=$3 AND estado='propuesto'`; si `changes !== 1` → **409** "Esta propuesta ya fue decidida" (el mismo mensaje que ya existía para una propuesta decidida antes), sin notificación ni email. El chequeo previo se mantiene para el caso secuencial y el 404.
- **Frontend:** sin cambios. `NGOPatrocinios` ya muestra el mensaje del servidor si la decisión falla (§65), y ese 409 ya existía.

### Tests (nuevos: 12, en los dos motores)
`test/integration/follows-sponsorship-concurrency.test.js`. Como en §34, verifica **invariantes**, no quién gana:
- por cada tipo de follow: 8 "seguir" a la vez → todos 200, una fila, contador +1 (y en voluntarios, una sola notificación); 8 "dejar de seguir" a la vez → todos 200, sin fila, contador vuelve al original; 5 rondas de 12 pedidos mezclados → solo 200 y `contador == original + filas`;
- patrocinio: 8 decisiones mezcladas aceptar/rechazar → exactamente un 200, el resto 409, el estado guardado es el del 200 y la empresa recibe una sola notificación (del tipo que corresponde); la misma decisión 8 veces → un 200 y siete 409.

### Verificación
- **Rojo → verde:** antes del arreglo, en Postgres fallaban 11 de 12 (solo pasaba `setup`), con `200,500,200,...` al seguir, "baja exactamente 1, no 8" al dejar de seguir y `6 !== 1` / `8 !== 1` en el patrocinio. En SQLite pasaban los 12 (esperable, ver arriba). Después: 12/12 en Postgres en 5 corridas seguidas.
- **Mutación (8, los dos motores, script descartable):** detectados: contador sin mirar `changes`, `toggleFollow` que devuelve siempre `true` / siempre `false`, sacar el `ON CONFLICT`, notificar siempre, sacar el `AND estado='propuesto'` y sacar el 409 por `changes` (los dos últimos solo en Postgres, como se esperaba). **Sobrevive 1: "sin transacción"** (los dos statements sueltos). **No es equivalente:** si el proceso o la conexión se cae entre el `INSERT`/`DELETE` y el `UPDATE` del contador, sin transacción queda desfasado; con ella no. Pero bajo concurrencia normal el comportamiento es el mismo (cada statement mira su propio `changes`), y probarlo exige inyectar una falla a mitad de camino: no lo hice.
- **Suites completas:** SQLite **381/381** y Postgres **383/383**, las dos también con `TZ=America/Argentina/Cordoba`.

### Errores propios
- En la primera versión del test propuse el patrocinio sobre `proj-4`, que es de otra ONG (ngo-4): habría dado 404 y no probaba nada. Lo vi al revisar el seed, antes de correrlo; pasé a `proj-7` (de ngo-1).
- En el script de mutación, dos patrones no matchearon porque `follows.js` es CRLF y los escribí con `\n`, y en el reintento rompí el escapado. Los corrí de nuevo bien; ningún archivo del proyecto quedó modificado por el script (`git status` limpio salvo los cambios de esta tarea).

### ⚠️ NO verificado
- Sin navegador: no vi el 409 del patrocinio en `NGOPatrocinios`. Por lectura, el `catch` de `decide` muestra `userMessage(e, ...)` (§65), pero **no hay test de frontend de ese error** (`NGOPatrocinios.test.tsx` solo cubre listar, aceptar, rechazar y vacío).
- Los contadores de producción que ya se hayan desfasado por este bug **no se corrigen** (no hay datos reales todavía, la app no está desplegada; si los hubiera, se recalculan con un `UPDATE ... SET followers = (SELECT COUNT(*) ...)`).
- La caída a mitad de transacción (el mutante sobreviviente) no está probada.

## 78. Docs que contradecían el código — REVISION D1–D7

**Contexto:** commit de solo documentación (ítem 18 del orden de REVISION.md). Cada corrección se cotejó contra el código actual, no contra lo que decía la revisión (algunas ya estaban resueltas a medias).

**Qué se corrigió:**
- **D1** `PROJECT_CONTEXT.md`: la tabla de dependencias y §11 decían que `multer` no se usaba y que no había subida de archivos. Ahora: lo usa `routes/posts.js` para las fotos de Momentos (Cloudinary, §43).
- **D2** `PROJECT_CONTEXT.md`: "No usa: testing framework / tests". Ahora figuran Vitest + Testing Library (frontend) y `node:test` (backend, `npm test` y `npm run test:pg`). De paso, la fila de TypeScript decía "vía Vite": ahora dice TypeScript 7 con `npm run typecheck` (§68–§69). No puse cantidades de tests en ese doc (envejecen; las cuenta `CLAUDE.md`).
- **D3** `BACKEND_CONTEXT.md`: "28 tablas" → 31 (contadas en `migrate.js`; `DATABASE_CONTEXT.md` ya decía 31).
- **D4** `DATABASE_CONTEXT.md` §4: los rangos "1–17 / 18–24" ya no coincidían con la numeración de §1. Ahora: 21 tablas con `id` propio y 10 N:M con PK compuesta (con la lista). El "id generado por default de base" era cierto para el esquema (hay un `DEFAULT` de UUID) pero contradecía la regla 23: se aclaró que las altas que devuelven la fila generan el id con `crypto.randomUUID()`. A la tabla de N:M de §2 le faltaban `empresa_categorias` y `post_likes`.
- **D5** `API_CONTEXT.md`: `GET /api/follows/volunteer/following` y `/followers` figuraban para "cualquiera"; el código exige `requireRole('volunteer')`.
- **D6** `API_CONTEXT.md`, `PUT` de KPI: el DELETE ya estaba bien (`{ message: "KPI eliminado" }`, corregido en §56). Lo "a confirmar" del PUT **lo probé en SQLite** con un test descartable (fuera del repo): sin `nombre` responde **500** `Error al actualizar KPI`; con solo `nombre`, 200 y el resto de los campos en `null`, incluido `tipo_valor`. El doc ahora lo dice. El frontend (`NGOKPIs.tsx`) siempre manda `nombre` (lo exige el formulario), así que desde la interfaz no se llega al 500.
- **D7** `FRONTEND_CONTEXT.md`: "47 archivos .tsx (sin tests)" → 48 componentes (faltaba `LoadError.tsx` en la lista de §4). La lista de "sin tests" de §15 tenía 7; ahora son los 29 sin `<Componente>.test.tsx`, con los archivos de test que cubren un aspecto puntual de algunos.

### Verificación
- Conteos hechos con comandos, no a ojo: 31 `CREATE TABLE` distintos en `migrate.js`, 21 usos de `UUID_PK`, 10 `PRIMARY KEY (...)` compuestas; 48 `.tsx` en `components/` sin contar tests; para cada test "cruzado", los `import` de componentes que hace.
- D6: SQLite sí (ver arriba). Sin cambios de código: no corrí las suites.

### Errores propios
- Al armar la lista de D7 me salteé al principio los tests de `routes.test.tsx`, `FeedTabsPlacement` y `MomentsPlacement` que importan `Root`, `NGOLayout`, `PublicFeed` y `VolunteerPublicProfile`; los agregué al revisar los `import` de cada test.

### ⚠️ NO verificado
- ~~**D6 en Postgres**~~ **Verificado después** (§84, con Docker): el mismo test descartable contra Postgres 16 da lo mismo que SQLite: sin `nombre` → **500** `Error al actualizar KPI`; con solo `nombre`, 200 y el resto en `null`.
- El 500 del PUT de KPI sin `nombre` **sigue** (es un bug de backend, no de docs): debería ser 400. No lo arreglé en este commit de solo docs; queda junto con el "PUT no parcial" (deuda conocida, regla 16).
- No revisé el resto de cada doc línea por línea; solo los puntos D1–D7.

## 79. Modales accesibles: `<Modal>` común — REVISION F12

**Contexto:** los modales eran un `<div className="fixed inset-0">` con overlay: sin `role="dialog"` ni nombre, sin Escape y con el foco detrás del fondo. Con teclado se seguía tabulando la página de atrás y un lector de pantalla no anunciaba nada.

**Qué se hizo:**
- **`components/Modal.tsx` (nuevo):** `role="dialog"` + `aria-modal` + nombre (`labelledBy` o `label`); Escape escuchado en `document` (anda aunque el foco no esté adentro) y con `stopPropagation` para que no llegue a los listeners de `window` de los modales viejos; al abrir, foco al panel (o a `initialFocusRef`); Tab/Shift+Tab atrapados; al cerrar, el foco vuelve a donde estaba; clic en el fondo cierra (`closeOnOverlay`); scroll de la página bloqueado y restaurado. Con modales apilados, solo el de arriba atiende el teclado (pila a nivel de módulo).
- **Migrados (los 4 modales que citaba la revisión):** `AuthModal` (nombre según la pestaña: "Iniciar sesión" / "Crear cuenta"), `ReviewModal` ("Dejar reseña"), y las listas "Seguidores"/"Siguiendo" de `VolunteerProfile` y `VolunteerPublicProfile`. Se mantuvieron las clases de cada uno: visualmente no cambian.
- **`ChatbotWidget`** (el 5.º citado) **no es un modal**: es un panel flotante que no tapa la página. Ponerle `aria-modal` y atrapar el foco sería incorrecto. Se le dio `role="dialog"` con nombre "Ayuda rápida" (sin `aria-modal`), foco al campo al abrir, Escape dentro del panel cierra y devuelve el foco al botón, y el botón tiene `aria-expanded`/`aria-controls`.

### Tests (nuevos: 18)
- `Modal.test.tsx` (12): nombre por `label`/`labelledBy`, Escape con el foco afuera, clic afuera/adentro, `closeOnOverlay={false}`, foco que entra y vuelve al que abrió, `initialFocusRef`, Tab y Shift+Tab en ciclo, Tab desde la página de atrás, dos modales apilados, scroll bloqueado/restaurado, panel sin nada enfocable, Escape que no llega a `window`.
- `ModalsA11y.test.tsx` (3): reseña y las dos listas de seguidores (diálogo con nombre, foco adentro, Escape).
- `AuthModal.test.tsx` (+1) y `ChatbotWidget.test.tsx` (+2).
- **Rojo → verde:** primero con un `Modal` "stub" con el patrón viejo (9 de 10 rojos por comportamiento, no por "módulo inexistente"); los de los componentes, rojos por "no hay role=dialog" / `aria-expanded`.

### Verificación
- **Frontend:** **332/332** (antes 314), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.**
- **Mutación (20 mutantes sobre `Modal.tsx` y `ChatbotWidget.tsx`, script descartable):** 19 muertos. **Sobrevive 1, equivalente:** poner `aria-label` también cuando hay `aria-labelledby` (por la spec de nombre accesible gana `aria-labelledby`). Dos más ("sin `stopPropagation`" y "panel sin nada enfocable") sobrevivían en la primera corrida válida; les agregué un test a cada uno y comprobé que ahora mueren.
- **En el navegador (Claude in Chrome)**, contra una base **SQLite descartable** en el scratchpad (Docker no estaba corriendo, así que no Postgres), con la Vite local:
  - Mi Perfil → "Siguiendo": se ve igual que antes; diálogo "Siguiendo", foco adentro, `body` con `overflow: hidden`. Con teclas reales: Tab → cerrar → "Juan Pérez" → cerrar (ciclo), Shift+Tab vuelve, Escape cierra, el foco vuelve al botón "Siguiendo" y el scroll se libera.
  - Chatbot: al abrir, foco en "Escribí tu pregunta..."; `aria-expanded` true/false; Escape cierra y deja el foco en el botón flotante.
  - Login (como visitante): diálogo "Iniciar sesión", Shift+Tab desde el panel va a "Registrate gratis" (último), Escape cierra y el foco vuelve a "Entrar".
  - Mis participaciones → "Reseña": diálogo "Dejar reseña", foco adentro, Escape cierra y el foco vuelve al botón "Reseña".

### Errores propios
1. **El primer script de mutación no servía:** en Windows `execSync` usa `cmd.exe`, que no entiende `./node_modules/.bin/vitest`; cada corrida fallaba al lanzar y el script marcaba los 20 mutantes como "muertos". Lo noté porque dos muertes no tenían sentido; al probarlas a mano sobrevivían. Lo rehice llamando a `node node_modules/vitest/vitest.mjs` y **chequeando primero que el código sin mutar pase**. Lección: todo arnés de mutación arranca con la corrida base.
2. **Un test colgado:** en `ModalsA11y.test.tsx` el mock de `useAuth` devolvía un `user` nuevo en cada render y `VolunteerProfile` tiene `useEffect([user])`: bucle infinito. Pasé a un objeto estable.
3. **Test de AuthModal mal armado al principio:** el `TestTrigger` existente reabre el modal en cada render (`openAuthModal` no está memoizado), así que "Escape cierra" fallaba por el test. Usé un disparador que abre una sola vez.
4. **En Chrome, una primera prueba de Tab dio mal** (el foco se fue a la página de atrás y el diálogo desapareció): la pestaña tenía módulos viejos de HMR de cuando el script de mutación modificaba `Modal.tsx`. Tras recargar, todo anduvo como se describe arriba. No es un bug de la app, pero lo anoto porque al principio parecía uno.
5. Escribí `/participations` en vez de `/participation` (404 de la app).

### ⚠️ NO verificado / pendiente
- **Lector de pantalla real** (NVDA, VoiceOver, TalkBack): no tengo. Verifiqué los atributos y el foco, no lo que se anuncia.
- **Táctil / móvil:** el cierre por clic afuera usa `e.target === e.currentTarget`; en pantallas chicas los modales son "bottom sheet". No lo probé en un dispositivo.
- La lista de seguidores del **perfil público** no la abrí en Chrome (mismo código que la del perfil propio; tiene test).
- **Quedan 5 modales sin migrar:** `FilterModal`, `ProjectMap`, `ReviewsModal`, `PostComposer`, `MomentsGrid` (tienen Escape propio, pero sin foco inicial, sin trap y sin devolver el foco; en `PostComposer` y `MomentsGrid` el Escape solo anda con el foco adentro). No estaban en F12; van aparte.
- **Duplicación vista y no tocada:** las listas de seguidores de `VolunteerProfile` y `VolunteerPublicProfile` son casi el mismo JSX; candidato a un `FollowListModal`. *(Hecho en §105.)*
- Botones solo-ícono sin nombre (cerrar, mostrar contraseña, etc.): es **F13**, el próximo commit.
- El backend de la prueba tomó Resend/Cloudinary del `.env`; no hice nada que mande mails ni suba fotos.

## 80. Botones solo-ícono y campos sin nombre accesible — REVISION F13

**Contexto:** la revisión listaba ~12 botones de solo ícono y algunos campos sin etiqueta. Con un lector de pantalla se anunciaban como "botón" o "campo de edición", sin decir para qué servían, y aprobar y rechazar una inscripción no se distinguían. Hice un relevamiento propio (script descartable que parsea los `.tsx`): **44 botones**, **1 link** (mensaje del perfil público, apareció con el test) y **~55 campos**. Muchos campos tienen texto visible arriba (`<p>` o `<label>` sin `htmlFor`) que no está asociado al campo. El `placeholder` no sirve de etiqueta porque desaparece al escribir.

**Qué se hizo** (solo atributos; nada visual):
- **Botones:** `aria-label` en cerrar, volver, enviar (mensaje, pregunta, comentario), editar/cancelar edición, cerrar sesión, agregar/quitar rol y requisito, limpiar búsqueda y cerrar formulario. Si el botón actúa sobre un ítem de una lista, el nombre dice cuál: "Aprobar a Juan Pérez" / "Rechazar a Juan Pérez", "Editar KPI Árboles" / "Borrar KPI Árboles", "Quitar rol Cocinero".
- **Toggles:** "Mostrar contraseña" con `aria-pressed`. Las estrellas de las tres calificaciones (`ReviewModal`, `ReviewsModal`, `ProjectDetails`) se llaman "1 estrella" … "5 estrellas" con `aria-pressed` en la elegida.
- **Campos:** `aria-label` con el mismo texto que la etiqueta visible (sin el "*"), así lo que se lee coincide con lo que se ve. Si no hay etiqueta visible, va un nombre según la función ("Mensaje", "Tu pregunta", "Buscar proyectos", "Horas de Ana", "Nivel de Primeros auxilios", "Proyecto a patrocinar"). En los dos casos donde la etiqueta visible cambia (el valor de un KPI según el tipo; ubicación o plataforma en el alta), el nombre cambia con ella.
- **No tocado:** `OnboardingScreen.tsx` (no está enrutado) y los "Cerrar detalle" de `ProjectMap` (van con la migración de ese modal, donde se monta el mapa en un test).
- **Por qué `aria-label` y no `<label htmlFor>`:** es un atributo por campo, sin tocar el layout de ~55 campos de 15 archivos. Lo que se pierde es que tocar el texto de arriba no enfoca el campo. Convertirlo en `<label>` es una mejora aparte.

### Tests
- **`A11yNames.test.tsx` (nuevo, 18 tests):** monta cada pantalla con sus formularios, pestañas y listas abiertos, y exige que **ningún** botón, link ni campo tenga nombre vacío (`queryAllByRole(rol, { name: '' })`, el mismo cálculo que usan los lectores de pantalla). Las pantallas son: login/registro, chatbot, chat, reseña (dos modales), KPIs, panel y perfil de ONG, perfil de empresa (edición y propuesta), perfil de voluntario (edición y lista), alta de proyecto (los 3 pasos, fugaz y sostenido), detalle de proyecto (las 3 pestañas), explorar, detalle de proyecto de la ONG, notificaciones, perfiles públicos (empresa, ONG, voluntario), empleados, feed público y tarjeta del feed. También comprueba nombres puntuales y `aria-pressed`.
- **Rojo → verde:** con los componentes anteriores fallan los 18 (lo comprobé volviendo los componentes al estado previo con el test ya terminado); después pasan los 18.

### Verificación
- **Frontend: 350/350** (antes 332). **Typecheck: 0 errores.**
- **Mutación (script descartable): sacar cada `aria-label`/`aria-pressed` agregado, de a uno.** Primera corrida: 97 mutantes, **13 sobrevivientes, ninguno equivalente**. Todos eran partes que el test no abría (pestañas de reseñas y comentarios, comentario del feed, tipo "sostenido", listas de seguidores, perfil público, el estado de las estrellas de `ReviewsModal`) más los 2 de `ProjectMap`. Amplié el test y recorrí los 11 que siguen en este commit más el link nuevo: **12 de 12 muertos**. Total del commit: **96 mutantes, 0 sobrevivientes.**
- **En Chrome** (backend contra SQLite descartable, Vite local), leyendo el árbol de accesibilidad del navegador:
  - Login: diálogo "Iniciar sesión" con "Cerrar", "Email", "Contraseña", "Mostrar contraseña" (al tocarlo, `aria-pressed="true"` y el campo pasa a texto).
  - Panel de ONG (Sustentando): "Aprobar a Juan Pérez" / "Rechazar a Juan Pérez", "Buscar proyectos".
  - KPIs: "Volver", "Cerrar formulario", "Nombre", "Descripción", "Valor", "Unidad", "Fecha de medición".

### Errores propios
1. **Mi relevamiento estático no veía los links de solo ícono:** buscaba solo `<button>`. El de "Enviar mensaje a …" lo encontró el test general. Después revisé los `<Link>`: era el único.
2. **La primera versión del test no abría secciones enteras** (pestañas, acordeones, el tipo "sostenido"): pasaba igual y la mutación mostró 11 nombres sin verificar. Lección: un test de "no hay nada sin nombre" vale lo que las pantallas que abre.
3. **`git stash` cambió finales de línea:** para comprobar el rojo guardé los componentes con `git stash` y los restauré con `pop`. Con `core.autocrlf=true`, 10 archivos que estaban en LF en el disco volvieron en CRLF. El contenido del commit no cambia (el índice queda en LF), pero CLAUDE.md pide no convertirlos: los devolví a LF y lo verifiqué con `git ls-files --eol`. Lección: en este repo, nada de `stash`; copiar los archivos aparte.
4. **El Vite de la verificación de §79 seguía corriendo:** `TaskStop` cortó el shell pero no el proceso de node, que quedó escuchando en 5173 durante ~25 min. Al lanzar uno nuevo falló por el puerto. Lo vi al revisar quién escuchaba, lo cerré y levanté otro. Antes, otro Vite lanzado **en paralelo** con el backend falló porque el `cd` se pisó (lo mismo de §70): lo relancé solo y con rutas absolutas.
5. En Chrome, un clic en el campo de contraseña lo tapó otra extensión del navegador (probablemente el gestor de contraseñas). Pasé al campo con Tab.

### ⚠️ NO verificado
- **Lector de pantalla real** (NVDA/VoiceOver/TalkBack): verifiqué los nombres que calculan jsdom y el árbol de Chrome, no lo que se escucha.
- **`read_page` de Chrome muestra vacíos** algunos botones y links cuyo nombre sale de texto anidado ("Nuevo proyecto", los links del menú lateral). Tienen texto visible y el test los da por nombrados; `computedName` no está disponible en este Chrome para confirmarlo desde el navegador.
- Avatares con link cuyo nombre es solo la inicial (en las reseñas de `ProjectDetails`): tienen nombre, pero pobre. No lo cambié.
- Contraste de colores, tamaño de los objetivos táctiles y orden de foco: fuera de F13.

## 81. Los 5 modales que faltaban pasan a `<Modal>` — REVISION F12 (segunda parte)

**Contexto:** §79 migró los modales que citaba la revisión. Quedaban 5 con un patrón propio: `FilterModal`, `ReviewsModal` y el mapa ampliado de `ProjectMap` escuchaban Escape en **`window`**, sin `role="dialog"`, sin foco ni trap. `PostComposer` y el visor de `MomentsGrid` tenían `role="dialog"`, pero Escape solo andaba con el foco adentro, y al abrir el foco no entraba. **Bug de comportamiento real:** con el login abierto encima de las reseñas (sin sesión, "calificar" lo abre), un Escape cerraba los dos modales a la vez.

**Qué se hizo:**
- Los 5 usan `<Modal>` con el nombre de su título (`labelledBy`): "Filtros", "Reseñas y Calificaciones", "Mapa de Voluntariados", "Compartir un momento", "Momento". Se borraron los tres listeners propios de Escape y bloqueo de scroll. `FilterModal` y `ProjectMap` siguen dentro de `createPortal` (z-index sobre Leaflet). Clases y estilos sin cambios.
- **`PostComposer`:** Escape pasa por `requestClose`: pregunta si hay fotos y no cierra mientras publica. `closeOnOverlay={false}` (antes el fondo tampoco cerraba).
- **Visor de `MomentsGrid`:** `closeOnOverlay={false}` (igual que antes).
- **`ProjectMap`:** "Cerrar detalle" en los dos botones que cierran la ficha del proyecto elegido (mapa chico y ampliado). Quedó afuera de §80 para probarlo acá con el mapa montado.

### Tests (nuevos: 12)
- `ModalsMigrated.test.tsx` (6): `FilterModal` (nombre, foco, Tab adentro, Escape una vez, scroll liberado); `ReviewsModal` (nombre, foco, Escape) y **login encima de las reseñas: Escape cierra solo el login**; `ProjectMap` con **Leaflet real en jsdom** (solo hizo falta un `ResizeObserver` falso): mapa ampliado con nombre, foco y vuelta del foco al botón que lo abrió, y "Cerrar detalle" tras tocar un pin.
- `MomentsGrid.test.tsx` (+3) y `PostComposer.test.tsx` (+3): Escape con el foco afuera, foco que entra y vuelve, Tab adentro, el fondo no cierra, y Escape no cierra mientras publica.
- **Rojo → verde:** con los 5 componentes en su versión anterior fallan 8 de los nuevos. Los otros (Escape una vez y scroll de `FilterModal`, Escape mientras publica, el fondo de `MomentsGrid`) ya se cumplían: quedan como guarda. Para comprobarlo copié los archivos aparte y los restauré con chequeo de md5 (sin `git stash`, ver §80).

### Verificación
- **Frontend: 362/362**, también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.**
- **Mutación (13 mutantes):** sacar el nombre o el `id` del título en cada modal, cada "Cerrar detalle", que Escape del compositor saltee `requestClose`, y que el fondo cierre (compositor y visor). 12 muertos. **Sobrevivió 1:** "el fondo cierra el visor de `MomentsGrid`" (no equivalente). Agregué el test y comprobé que ahora muere.
- **En Chrome** (SQLite descartable; página recargada después de la mutación para no ver estado de HMR): Explorar → filtros: diálogo "Filtros" con el aspecto de siempre, foco adentro, scroll bloqueado; Shift+Tab desde el panel va a "Mostrar 12 voluntariados" (el último); Escape cierra, libera el scroll y el foco vuelve al botón de filtros.

### Errores propios
1. En el test de `ProjectMap` guardaba la referencia al primer pin; el mapa recrea los marcadores después del primer render y el clic caía en uno desmontado. Lo encontré con un test de debug descartable (lo borré). Ahora se busca el pin en cada intento.
2. Un `sed` mío rompió ese archivo de debug (reemplazó todos los `);`); lo reescribí entero. No tocó archivos del proyecto.
3. En Chrome creí que el foco no volvía al botón de filtros: mi chequeo miraba `aria-label` y ese botón se nombra con `title`. Volvía bien.

### ⚠️ NO verificado
- En Chrome probé solo `FilterModal`. Reseñas, mapa ampliado, compositor y visor los cubren los tests.
- **Leaflet con el teclado dentro del mapa ampliado:** el trap de Tab incluye los controles enfocables del mapa. No probé que las flechas y +/- de Leaflet sigan andando con el foco en el mapa.
- Lector de pantalla real y uso táctil (igual que §79 y §80).

## 82. El panel de la ONG no decía a qué voluntariado es cada solicitud — REVISION F14

**Contexto:** `GET /ngos/me` ya mandaba `project_title` en cada solicitud pendiente (lo verifiqué en `routes/ngos.js`; `GET /ngos/:id/dashboard` también lo manda), pero el tipo `EnrollmentWithVolunteer` no lo declaraba y `NGODashboard` mostraba solo nombre y email. Con varios proyectos, la ONG no sabía a qué voluntariado se anotó cada persona. Además, si la misma persona se anotaba en dos, sus filas y los nombres de sus botones (§80) eran idénticos.

**Qué se hizo:**
- `api.ts`: `PendingEnrollment extends EnrollmentWithVolunteer { project_title: string }`, usado solo en `ngos.me()`. `GET /enrollments/project/:id` (el otro uso del tipo base) no trae el título y no lo necesita: es la pantalla de un único proyecto.
- `NGODashboard`: el título del proyecto en una línea entre el nombre y el email, y los botones pasan a "Aprobar a Juan Pérez en Reforestación Urbana" / "Rechazar a …".
- `API_CONTEXT.md`: la respuesta de `GET /api/ngos/me` documentada con `project_title`.
- Sin cambios de backend.

### Tests
- `NGODashboard.test.tsx` (nuevo, 2): cada solicitud muestra su proyecto, y la misma persona en dos proyectos tiene cuatro botones distintos. Rojo con el componente anterior (no encuentra el título ni esos nombres), verde después. En `A11yNames.test.tsx` cambié los dos nombres esperados.

### Verificación
- **Frontend: 364/364. Typecheck: 0 errores** (antes de este cambio, TypeScript no podía detectar el uso de `project_title` porque el tipo no lo tenía).
- **Mutación (2):** sacar la línea del título y sacar "en …" de los nombres: los dos mueren.
- **En Chrome** (SQLite descartable, Sustentando): la solicitud de Juan Pérez muestra "Reforestación Urbana" en verde bajo el nombre; los botones se llaman "Aprobar a Juan Pérez en Reforestación Urbana" / "Rechazar a …".

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- Solo lo vi en ancho de escritorio. En el celular la fila es más angosta: el título tiene `truncate`, así que se corta con "…" si es largo, pero no lo vi.
- El seed tiene una sola solicitud pendiente: el caso de "la misma persona en dos proyectos" está probado solo en el test.

## 83. Respuestas viejas que pisaban a las nuevas — REVISION F15

**Contexto:** la revisión lo dejó "a confirmar con latencia simulada" en tres pantallas. **Lo confirmé antes de tocar nada:** escribí los tests con promesas que resuelvo a mano en el orden que quiero (primero la respuesta nueva, después la vieja). Fallaron los 4:
- **Chat** (`ChatThread`, `[userId]`): al pasar de la conversación con Ana a la de Juan, si el hilo de Ana llegaba último, el hilo de Juan mostraba los mensajes de Ana con el encabezado "Ana". Un error del hilo de Ana también aparecía en el de Juan.
- **Feed público** (`PublicFeed`): al elegir Educación y enseguida Salud, si Educación llegaba última, con Salud seleccionada se veían los proyectos de Educación.
- **Perfil público** (`VolunteerPublicProfile`, `[id, user]`): al saltar de un perfil a otro desde la lista de seguidores, el perfil viejo pisaba al nuevo.

**Qué se hizo:**
- `ChatThread` y `VolunteerPublicProfile`: `let cancelled = false` en el effect, `if (!cancelled)` antes de cada `set…` (en `then`, `catch` y `finally`) y `cancelled = true` en el cleanup. Es el patrón que ya usaba `PostComposer`. El chat además limpia el error al cambiar de conversación (antes un error de la anterior podía quedar).
- `PublicFeed`: `load()` se llama desde dos effects y desde el formulario de búsqueda, así que el cleanup de un effect no alcanza. Uso un número de pedido en `useRef` y solo aplico la respuesta (o el error, o el fin de carga) del último.
- Los tres indicadores de carga ahora tienen `role="status"` con nombre ("Cargando mensajes", "Cargando perfil", "Cargando proyectos"). Lo necesitaba el test (ver errores propios) y además un lector de pantalla ahora los anuncia.

### Tests (nuevos: 10, `StaleResponses.test.tsx`)
- Orden "nueva primero, vieja después": chat (mensajes y encabezado), error del chat, feed y perfil.
- Orden "vieja primero mientras la nueva sigue en vuelo": se sigue viendo "cargando" y nada de lo viejo (chat, perfil, feed).
- La vieja **falla** al final: su error no aparece (perfil) y no borra lo que se está mostrando (feed). Y el error de la conversación anterior no queda en la nueva.

### Verificación
- **Frontend: 374/374**, también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.**
- **Mutación (13 mutantes:** cada guarda de `then`/`catch`/`finally`, cada cleanup, el reseteo del error y el incremento del número de pedido**):** en la primera corrida **sobrevivieron 6, ninguno equivalente**: el test cubría un solo orden de llegada. Agregué los otros órdenes y quedó 1. Ver errores propios. **Final: 0 sobrevivientes.**
- **En Chrome** (SQLite descartable), solo el camino normal (**la carrera no la pude reproducir:** no tengo forma de agregar latencia a la red desde la extensión):
  - Feed: Medio Ambiente y enseguida Alimentación → se ven los 3 de Alimentación (los mismos que devuelve la API) y ninguno de Medio Ambiente.
  - Perfil de María → lista de seguidores → Lucía: muestra a Lucía, sin restos de María. La lista se cerró y el scroll quedó liberado.
  - Chat de María con Juan: carga y muestra "Todavía no hay mensajes".

### Errores propios
1. **Un test que pasaba por la razón equivocada:** en el feed buscaba los esqueletos de carga por la clase `animate-pulse`, que también tiene un ícono del encabezado. El mutante "termina la carga con la respuesta vieja" sobrevivía. Pasé a `role="status"` con nombre y ahora muere. Lección: no afirmar por clases de estilo.
2. La primera versión del test cubría un solo orden de llegada (la mutación lo mostró: 6 sobrevivientes).

### ⚠️ NO verificado
- **La carrera en un navegador real**, con latencia de verdad.
- **El cambio de conversación dentro del chat en Chrome:** el seed no tiene conversaciones y no quise crear mensajes solo para esto. Hoy casi no se llega a ese caso desde la interfaz, porque al cambiar de conversación se vuelve a la lista (otra ruta, que desmonta el hilo).
- **No revisé el resto de las pantallas** con el mismo patrón (`ProjectDetails`, `NGOPublicProfile`, `CompanyPublicProfile`, `ExploreScreen`, `MainFeed`…). Las que cargan por `:id` tienen el mismo riesgo si se navega de un recurso a otro sin desmontar. Quedan para revisar con este mismo test.

## 84. Tests que prometían más de lo que verificaban, y `setup` como test — REVISION T2–T4

**Qué se hizo (solo tests; nada de código de la app):**
- **T2** `ProjectCard.test.tsx`: "muestra el título, la ubicación y la categoría" no miraba la categoría. Ahora la afirma. La tarjeta ya la mostraba (`ProjectCard.tsx`), así que no había bug.
- **T3** `api.test.js`, "recomendaciones influenciadas por categoría": solo miraba el status y `based_on_history`, que se calcula aparte del puntaje. Con el test viejo, la señal de categoría podía no hacer nada y el test pasaba igual. Ahora la ONG crea dos proyectos iguales salvo la categoría: uno de la categoría del historial de la voluntaria (Medio Ambiente) y otro de Educación, creado **después** (el desempate por fecha favorecería a ese). El test exige que el de su categoría aparezca antes, con más puntaje y con la razón `Coincide con tu interés en "Medio Ambiente"`, y que el otro no tenga esa razón.
- **T4**: la revisión listaba 5 `test('setup')` sin asserts. Buscando encontré **10** (los otros 5 tenían asserts de precondiciones; uno era mío, de §77). Los 10 pasaron a `before()`. Si una preparación falla, `node:test` **cancela** los tests de esa suite en vez de correrlos con datos `undefined` (fallas en cascada confusas). Además ya no cuentan como tests.

### Verificación
- **Backend SQLite: 371/371** (antes 381; −10 por T4), también con `TZ=America/Argentina/Cordoba`, `cancelled 0`, salida 0.
- **Que un `before()` roto no pase en silencio:** rompí a propósito el de `messages-conversations.test.js` y la corrida dio `pass 0 · fail 0 · **cancelled 4**`, mostró el error y salió con **código 1**. Restauré el archivo (comparado byte a byte). **Ojo:** el resumen dice `fail 0`, así que de ahora en más hay que mirar `cancelled` y el código de salida (lo agregué en `CLAUDE.md`).
- **Mutación:** T2: sin `{project.category}` en la tarjeta → muere. T3: apagar la señal 1 (`if (hasHistory)` → `if (false)`) → muere; sacar solo la razón → muere. Con el test viejo de T3 los dos habrían sobrevivido (por lectura: no miraba ni el orden ni las razones).
- **Frontend: 374/374. Typecheck: 0 errores.**

### Errores propios
- Mi primer intento de editar `api.test.js` fue un `node -e "…"` con backticks adentro: el shell los interpretó (`Bearer: command not found`) y el script no escribió nada (falló su propio chequeo). Lo pasé a un script en archivo.
- Un script de docs falló a mitad (buscaba una fila de `REVISION.md` que ya había cambiado en §78). Alcanzó a escribir `CLAUDE.md` y no `REVISION.md`; lo revisé y completé.

### ⚠️ NO verificado
- ~~`npm run test:pg`~~ **Verificado después del commit** (el usuario prendió Docker; Postgres 16 en contenedor): **373/373**, también con `TZ=America/Argentina/Cordoba`, `cancelled 0`, salida 0.

## 85. Registro sin transacción y email duplicado simultáneo → 500 — REVISION B17

**Contexto:** `POST /api/auth/register` hacía el `INSERT` en `users` y después, suelto, el del perfil (`voluntarios`/`ngos`/`empresas`). Lo confirmé con tests antes de tocar el código:
- **Falla a mitad (los 3 roles, los dos motores):** inyectando una falla en el `INSERT` del perfil (mismo mecanismo que §59: se intercepta `db.run` y el `tx.run`), quedaba **el usuario sin perfil**. Ese email ya no se podía volver a registrar ("Ya existe una cuenta").
- **Mismo email, 6 registros a la vez:** en **Postgres, 3 de 3 corridas** dieron `201, 500, 500, 409, 409, 409`: varios pasaban el `SELECT` previo y chocaban con el `UNIQUE` de `users.email`. En SQLite no se reproduce (dio un 201 y cinco 409).
- De paso, releía al usuario "por email" en vez de generar el id (regla 23).

**Qué se hizo:**
- `routes/auth.js`: el id sale de `randomUUID()`. Usuario y perfil van en **`db.transaction()` con `tx.*`** (regla 21). Si el `INSERT` choca con el `UNIQUE` → **409** con el mismo mensaje de siempre. El `SELECT` previo queda: evita calcular el hash y abrir una transacción para el caso común (secuencial). La respuesta no cambió.
- **`src/lib/dbErrors.js` (nuevo):** `isUniqueViolation(err)` (Postgres `23505`; SQLite `SQLITE_CONSTRAINT_UNIQUE`/`_PRIMARYKEY` o el mensaje). `routes/enrollments.js` ya tenía esa condición inline (`err.message?.includes('UNIQUE') || err.code === '23505'`); ahora usa el helper (regla 3).
- Docs: `API_CONTEXT.md` (registro: validación real, transacción, 409; **login**: el doc decía que el mensaje de error era genérico, **y no lo es**: ver B20 abajo), y `AI_RULES.md` regla 21 (cuándo usar el helper).

### Tests (nuevos: 9)
- `register-transaction.test.js` (5): falla en el perfil para cada rol (500, no queda el usuario y el mismo email después se registra bien); 6 registros simultáneos (un 201, cinco 409, un usuario, un perfil); la respuesta trae el usuario recién creado, releído por id.
- `test/unit/dbErrors.test.js` (3): los códigos de los dos motores, y que FK, NOT NULL y errores comunes **no** cuentan como UNIQUE (para no convertirlos en 409).
- `enrollments-concurrency.test.js` (+1): la misma persona se inscribe 6 veces a la vez al mismo proyecto → un 201 y cinco 409, una sola inscripción. Ese camino (el 409 de `enrollments.js`) **no tenía test**: lo encontró la mutación.

### Verificación
- **SQLite 380/380 y Postgres 382/382**, los dos también con `TZ=America/Argentina/Cordoba`, `cancelled 0`, salida 0.
- **Mutación (9 mutantes, cada uno contra SQLite y Postgres):** sin transacción, sin capturar el 409, el id sin insertar, cada rama del helper, "cualquier error es UNIQUE" y el 409 de inscripciones. Todos muertos menos:
  - **"Sin el `SELECT` previo" — equivalente:** con el 409 por `UNIQUE`, un duplicado responde igual con o sin el `SELECT`; solo cambia que se calcula el hash de más.
  - En la primera corrida también sobrevivió "inscripción sin 409": no era equivalente, faltaba el test (agregado arriba). Ahora muere.

### Errores propios
- La primera versión del test de inscripciones simultáneas tenía un `if (mine)` que podía saltarse la verificación de "una sola inscripción". Lo hice estricto antes de commitear.

### ⚠️ NO verificado / visto y no tocado
- **B20 (login que distingue "no hay cuenta" de "contraseña incorrecta")** sigue pendiente de tu decisión. Corregí el doc, que decía lo contrario, sin cambiar el comportamiento.
- La interfaz no cambia: el 409 ya se mostraba en `AuthModal` como "Ya existe una cuenta con ese email". No lo miré en Chrome.

## 86. Endpoints públicos devolvían columnas no elegidas — REVISION B21 (lista blanca, decisión del usuario)

**Contexto:** test centinela (`public-columns.test.js`): agrega una columna "secreta" a cada tabla con datos públicos y recorre los 22 endpoints públicos. **Rojo: 11 la devolvían.** La causa principal: `fmt`, `fmtNgo` y `fmtEmpresa` empezaban con `...fila` (salían todas las columnas, también en endpoints autenticados). Además: catálogos con `SELECT *`, subconsultas del detalle de proyecto (`c.*`, `r.*`, KPIs `*`, mi inscripción `*`), y `/ngos/:id/projects` y el dashboard de ONG devolvían filas crudas. El usuario eligió la lista blanca completa.

**Qué se hizo:** los tres formateadores son listas blancas (`fmt` deja pasar los extras que el feed agrega a la fila: `PROJECT_EXTRAS`). `fmtNgo` se exporta y `follows.js` lo importa (borrada su copia y un `parseJson` sin uso: deuda "fmt compartido", resuelta). Catálogos y subconsultas con columnas explícitas (`KPI_COLS`). `/ngos/:id/projects` y el dashboard pasan por `fmt` (ninguna pantalla los usa). Se mantienen `user_id` de ONG/empresa (botón "Enviar mensaje"). Salen de las respuestas: las columnas en español y `created_at` de ONG, empresa y catálogos (el frontend no los usa: auditado con grep).

**Método para no romper la API:** foto de las claves de 24 endpoints (públicos y con los 3 roles) antes y después, y cada clave que desapareció buscada en el frontend. **Así apareció un error mío:** la primera versión dejaba al feed sin `ratings` (follows.js lo agrega antes de formatear) y `FeedPostCard` se quedaba sin reseñas; ningún test lo veía. Lo agregué a los extras y sumé tests de contrato ("sale todo lo que espera el frontend") para proyectos, feed, ONGs y empresas.

### Verificación
- **SQLite 385/385 y Postgres 387/387**, también con `TZ=America/Argentina/Cordoba`. Frontend 374/374 (sin cambios).
- **Mutación (15, los dos motores):** volver a `...fila` en cada formateador, sacar `ratings`/los extras/`ngo_name`/`user_id`, `SELECT *` en catálogos, comentarios, calificaciones y KPIs, y `/ngos/:id/projects` crudo. Sobrevivió 1 ("comentarios `c.*`"): el test no tenía comentarios en `proj-1`; agregado, ahora muere. **0 sobrevivientes.**
- **Chrome** (SQLite descartable): feed (reseñas de "Reciclaje Educativo" desde la tarjeta: 5.0, Juan Pérez), detalle de proyecto, perfil público de ONG y de empresa ("Mensaje" lleva a `/messages/user-ngo-1` y `/messages/user-comp-1`), Explorar (12 pines, recomendaciones) y perfil propio de la ONG; sin "undefined" ni "NaN".

### Errores propios
1. El feed sin `ratings` (arriba): lo atrapó la comparación de claves, no los tests.
2. El test centinela decía insertar un comentario y no lo hacía (lo mostró la mutación).

### ⚠️ NO verificado
- Pantallas de empresa con sesión, panel de ONG con proyectos de otras ONGs, y móvil: no las recorrí en Chrome (tests de contrato + foto de claves).
- Los demás `SELECT *` del backend en endpoints autenticados que devuelven datos propios (`/auth/me`, empleados, notificaciones, inscripciones) no se tocaron: no son públicos.

## 87. WebSocket del chat: errores internos al cliente, sin tope de tamaño ni de frecuencia — REVISION B19 (salvo JWT_SECRET)

**Contexto (confirmado con tests antes de tocar nada, rojo en 6 de 7):** el listener de `ws/index.js` le mandaba al cliente el `err.message` de cualquier error:
- un error de disco simulado llegó tal cual, **con la ruta del archivo**;
- un JSON mal formado devolvía `Expected property name or '}' in JSON at position 1…` (inglés técnico, regla 19);
- un `to` que era un objeto llegaba a la consulta: por WebSocket devolvía `Too few parameter values were provided` y por REST, **500**.

Además no había `maxPayload` (el default de `ws` es **100 MiB**) y una ráfaga de 30 mensajes se guardaba entera.

**Qué se hizo:**
- `routes/messages.js`: `MessageInputError` para los errores del usuario (destinatario inválido o inexistente, vacío, largo, a uno mismo). Se valida que `to` sea un string. REST decide el 400 por tipo de error y no buscando palabras en el mensaje (`'vacío'`, `'largo'`…), que era frágil.
- `ws/index.js`: `maxPayload` 64 KB (más grande → la conexión se cierra con `1009`); hasta 20 envíos cada 10 s por usuario (`allowSend`, cuenta intentos; los rechazos no alargan el bloqueo); JSON mal formado → "Mensaje inválido"; error del usuario → su texto; cualquier otro → "Error al enviar el mensaje" + `console.error`.
- **No tocado:** la copia del fallback de `JWT_SECRET` en `ws/index.js:19` (regla 17, espera tu decisión).

### Tests (nuevos: 11)
- `ws-hardening.test.js` (7): error interno no se reenvía; JSON mal formado; `to` objeto (y que no se guarda nada); error del usuario sí se muestra; REST con 400 para esos casos; 200 KB → cierre `1009`; ráfaga de 30 → 20 guardados y 10 avisos. El test termina todos los sockets en `after()`: en la primera versión, cuando una aserción fallaba antes del `close`, el servidor no cerraba y la corrida se colgaba.
- `test/unit/wsRateLimit.test.js` (4): el tope, que la ventana se libera con el tiempo (reloj a mano), que los rechazos no cuentan y que el límite es por usuario.

### Verificación
- **SQLite 396/396 y Postgres 398/398**, los dos también con `TZ=America/Argentina/Cordoba`.
- **Mutación (12, los dos motores): 12 muertos**, entre ellos sin `maxPayload`, sin límite, `>` en vez de `>=`, ventana que nunca expira, rechazos que cuentan, límite global en vez de por usuario, reenviar `err.message` y REST todo 500.

### Errores propios
- La primera corrida del test se colgó: en rojo, el socket de 200 KB nunca se cerraba y el `after` esperaba al servidor. Corregido terminando los sockets.
- El test de frecuencia usaba a María, que ya había mandado mensajes en los tests anteriores (y cuentan para su límite). Pasé la ráfaga a Juan.

### ⚠️ NO verificado / pendiente
- **Encontrado y no arreglado — el frontend ignora los errores del socket:** `ChatContext` solo atiende `type: 'message'`. `ChatThread` borra el borrador al mandar por WebSocket, así que si el servidor rechaza el envío (ahora también por frecuencia) **el mensaje se pierde sin aviso**. Ya pasaba antes con cualquier error por socket. Arreglarlo bien pide un id de pedido en el protocolo (o mandar siempre por REST); queda para decidir.
- **No probado en Chrome:** no cambió nada visible; el envío normal por socket lo cubren los tests de punta a punta de `insert-returns-own-row.test.js`.
- `POST /api/messages` sigue sin límite de frecuencia (no hay rate limiting en REST; deuda conocida).
- El mapa de envíos recientes es en memoria y por proceso (igual que las conexiones, §18).

## 88. KPIs con datos inválidos: 500 o, peor, guardados — seguimiento de REVISION D6 (§78)

**Contexto:** §78 confirmó que el PUT de KPI sin `nombre` daba 500. Al escribir el test con todos los casos inválidos para POST y PUT (rojo en 17 de 19), apareció más:
- **500 en 9 casos:** PUT sin `nombre` (NOT NULL), `nombre` vacío o que no es texto (`.trim()`), descripción o unidad que no son texto, `tipo_valor` fuera de la lista (CHECK de la base).
- **7 casos inválidos se GUARDABAN** (201/200): un nombre de 121+ caracteres, `valor: 'mucho'` o `'1e400'` (con `parseFloat`), etc.

**Qué se hizo:** `validateKpi` compartido por POST y PUT, con `checkText` (§76) y topes de largo (nombre 120, descripción 500, unidad 40). `tipo_valor` debe estar en la lista. `valor` tiene que ser un número finito con `Number()` estricto (`'12abc'` ya no pasa como 12, igual que las horas en §75); `null`, `''` o ausente = sin valor. **No se tocó:** que el PUT no sea parcial (deuda conocida, regla 16): sigue exigiendo `nombre` y pisando los demás campos. Tampoco F3 (KPI de tipo "texto", pendiente de decisión): un `valor` no numérico de ese tipo sigue llegando como `null` desde el frontend.

### Tests (nuevos: 21, `kpis-input-validation.test.js`)
10 casos inválidos × POST y PUT (400 con el mensaje esperado, y la base sin cambios: no se crea nada / el KPI no cambia), más uno de casos válidos (texto recortado, tipo de la lista, `valor` null y `''` → `null`).

### Verificación
- **SQLite 417/417 y Postgres 419/419**, también con `TZ=America/Argentina/Cordoba`.
- **Mutación (10, los dos motores):** primera corrida, 8 muertos y **2 sobrevivientes no equivalentes** (`parseFloat` en vez de `Number`, y `''` guardado como 0). Agregué `'12abc'` y `valor: ''` al test: **los 10 mueren**.
- El formulario (`NGOKPIs.tsx`) manda tipos de la misma lista y `valor` como número o nada: el camino normal no cambia. No lo miré en Chrome (§63 ya lo había verificado y el formulario no cambió). Un nombre de más de 120 caracteres ahora muestra el error del servidor en el formulario (ya existía ese manejo).

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- `fecha` sigue sin validarse (texto libre en una columna TEXT; el formulario manda `YYYY-MM-DD`).

## 89. F15 en las demás pantallas que cargan por `:id` (pendiente de §83)

**Contexto:** §83 arregló el chat, el feed público y el perfil público de voluntario, y dejó anotadas las demás pantallas que cargan según un parámetro de la URL. Revisadas: **seis sin protección**: `ProjectDetails`, `NGOPublicProfile`, `CompanyPublicProfile`, `NGOProjectDetail` (inscriptos), `NGOKPIs` y `NGOEmpleados`. Todas cargan desde varios lugares (el effect del parámetro, "Reintentar" y recargas después de una acción: inscribirse, comentar, aprobar, guardar un KPI, agregar a alguien al equipo), así que el `cancelled` de un effect no alcanza. **Confirmado con tests antes de tocarlas (rojo 7 de 7):** al pasar de A a B en la misma ruta (otro link o atrás/adelante), si la respuesta de A llegaba última, se mostraba A bajo la URL de B.

**Qué se hizo:**
- **`lib/useLatestRequest.ts` (nuevo):** `start()` / `isLatest(req)`. Es el patrón de número de pedido de `PublicFeed` (§83), hecho hook para no repetirlo en siete lugares (regla 3). `PublicFeed` pasa a usarlo.
- En las seis pantallas, `isLatest` antes de cada `set…` del resultado, del error y del fin de carga. `NGOKPIs` además cancela en su effect el pedido del título del proyecto.
- Los indicadores de carga de las seis tienen `role="status"` con nombre ("Cargando voluntariado", "Cargando organización"…), igual que en §83: lo anuncia un lector de pantalla y el test lo busca por rol.
- `NGOEmpleados` sigue con su `fetch` directo (deuda conocida, regla 4): solo se le agregó la guarda.

### Tests (nuevos: 19, `StaleResponsesById.test.tsx`)
Para las seis pantallas, los tres órdenes de llegada: la nueva primero (más un caso de error en el detalle de proyecto), la vieja **falla** al final (no tapa ni vacía la pantalla nueva), y la vieja llega primero con la nueva en vuelo (sigue "cargando", sin datos viejos).

### Verificación
- **Frontend: 393/393**, también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.**
- **Mutación (20: el hook y cada guarda de cada pantalla):** la primera corrida, con solo el orden "la nueva primero", dejó **11 sobrevivientes no equivalentes** (todas las guardas de `catch` y `finally` salvo una). Agregué los otros dos órdenes: **0 sobrevivientes**.
- **En Chrome** (SQLite descartable, como Sustentando), el camino normal de las seis: detalle de proyecto, inscriptos, KPIs, equipo, perfil público de Green Córdoba y de TechCorp. Cargan, sin "undefined" y sin quedarse en "cargando".

### Errores propios
- Un heredoc de bash con comillas y backticks anidados no se pudo ejecutar (`unexpected EOF`); no llegó a escribir nada (lo comprobé con `git status`). Hice los cambios con la herramienta de edición.
- La primera versión del test cubría un solo orden de llegada: el mismo error que en §83 (lo mostró de nuevo la mutación).

### ⚠️ NO verificado
- La carrera en el navegador real (no hay forma de agregar latencia desde la extensión), y el cambio de `:id` sin desmontar en Chrome. Las navegaciones de la extensión recargan la página entera.

## 90. KPI de tipo "texto": se saca (decisión del usuario) — REVISION F3

**Contexto:** el formulario ofrecía el tipo "texto", pero `kpis.valor` es `REAL`: "Alta" llegaba como `NaN` → `null` y el KPI quedaba con "—". El usuario eligió **sacar el tipo** (en vez de agregar una columna de texto).

**Qué se hizo:**
- **Backend:** `KPI_TIPOS` (`validateKpi`, §88) ya no incluye `texto`: crear o editar con ese tipo da 400 "Tipo de KPI inválido". El `CHECK` de la base **no se tocó**: los KPIs de tipo texto que ya existan siguen siendo válidos.
- **Frontend (`NGOKPIs`):** el selector ofrece solo Número, Porcentaje y Sí/No (`TIPOS_EDITABLES`), y el valor es siempre numérico. Un KPI viejo de tipo texto **se sigue viendo** con su etiqueta. **Al editarlo, el formulario arranca en "Número"**: si no, se mandaría un tipo que el servidor ahora rechaza.

### Tests
- Backend: el caso `tipo texto` → 400 en POST y PUT (`kpis-input-validation.test.js`, +2).
- Frontend (`NGOKPIs.test.tsx`, +3): el selector no ofrece "Texto" y el valor es numérico; un KPI de texto existente se sigue mostrando; al editarlo y guardar, **lo que se envía** es `tipo_valor: 'numero'`.

### Verificación
- **Backend SQLite 419/419 y Postgres 421/421. Frontend 396/396. Typecheck: 0 errores.**
- **Mutación (4):** volver a aceptar `texto` en el back y en el front, y sacar el mapeo al editar, mueren. Sobrevive 1, **equivalente**: el `type` del campo según "texto". Con el selector sin esa opción y el mapeo al editar, el formulario ya no puede estar en ese tipo.

### Errores propios
1. **Un arnés de mutación inválido:** en bash usé `read` sin `-r` y se comió las barras invertidas de los patrones. Ningún mutante se aplicó ("no aplica") y los resultados no valían nada. Lo rehice con un script en archivo y reemplazo literal.
2. **Un test que no probaba lo importante:** "al editar arranca en Número" miraba el valor que **muestra** el `<select>`. Con el estado en "texto" y esa opción inexistente, el DOM igual muestra la primera, así que pasaba aunque se mandara `texto`. Lo vio la mutación; ahora el test guarda y revisa lo enviado.
3. Al editar `projects.js` (CRLF) metí 2 saltos `\n` sueltos en un comentario; lo detecté y normalicé a CRLF antes de commitear.

### ⚠️ NO verificado
- En Chrome no lo miré: es un selector con una opción menos (los tests cubren lo enviado).
- Si en producción hay KPIs de tipo texto, se ven con "—" (como antes). Para que tengan valor hay que editarlos (pasan a "Número").

## 91. Login: un solo mensaje de error (decisión del usuario) — REVISION B20

**Contexto:** el login respondía "No encontramos una cuenta con ese email" o "Contraseña incorrecta", así que se podía averiguar qué emails tienen cuenta. El usuario eligió el mensaje único. Al revisarlo apareció una segunda vía para lo mismo: con un email inexistente **no se calculaba el hash** (bcrypt, decenas de ms), y el **tiempo** de respuesta también lo delataba.

**Qué se hizo (`routes/auth.js`):** los dos casos responden `401 "Email o contraseña incorrectos"`. Si no hay cuenta, igual se hace `bcrypt.compare` contra `DUMMY_HASH` (un hash fijo que se calcula una vez al arrancar), así el trabajo es el mismo. El frontend no cambia (muestra el mensaje del servidor).

### Tests (nuevos: 3, `login-message.test.js`)
Misma respuesta (status y cuerpo) para email inexistente y para contraseña incorrecta; con un email inexistente `bcrypt.compare` se llama una vez (mock sobre el mismo módulo); el login correcto sigue andando. Rojo antes en los dos primeros.

### Verificación
- **SQLite 422/422 y Postgres 424/424**, también con `TZ=America/Argentina/Cordoba`.
- **Mutación (2):** volver al mensaje distinto y saltear el hash cuando no hay cuenta: los 2 mueren.

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado / límites
- **El tiempo no se midió:** el test verifica que se haga el mismo trabajo (una comparación de bcrypt), no que los tiempos sean iguales (dependen de la máquina y del ruido).
- **El registro sigue diciendo "Ya existe una cuenta con ese email"** (409, §85): también revela si un email está registrado. Es lo habitual (no hay forma de registrarse sin avisarlo, salvo con verificación por mail). Queda anotado.
- Sin límite de intentos en el login (no hay rate limiting en REST; deuda conocida).

## 92. El chat manda siempre por REST (decisión del usuario) — pendiente de §87

**Contexto:** §87 encontró que, con el WebSocket abierto, `ChatThread` mandaba por el socket y borraba el borrador. Si el servidor rechazaba el envío (error interno, destinatario inválido o el límite de frecuencia nuevo), la respuesta `{ type: 'error' }` no la escuchaba nadie y **el mensaje se perdía sin aviso**. Lo confirmé con un test antes de tocarlo (rojo en 2 de 2: con el socket "conectado" no se llamaba a REST, y un rechazo no se veía). El usuario eligió mandar siempre por REST (en vez de agregar un id de pedido al protocolo del socket).

**Qué se hizo:**
- `ChatThread`: el envío es siempre `POST /api/messages`. Si falla, se muestra el error y se restaura el borrador (eso ya lo hacía el camino REST). El mensaje guardado se agrega a la lista (sin duplicar por id).
- `ChatContext`: se quitó `sendViaSocket` (ya no tiene usos). El socket queda para recibir.
- **No tocado:** el listener `type: 'send'` del servidor. Ningún cliente lo usa, pero está reforzado (§87). Sacarlo sería una limpieza aparte.

### Tests (nuevos: 2, `ChatSend.test.tsx`)
Con un socket simulado "conectado": el envío va por REST y el mensaje guardado se ve; si el servidor lo rechaza (p. ej. con el texto del límite de frecuencia), el error se ve y el borrador vuelve.

### Verificación
- **Frontend: 398/398. Typecheck: 0 errores.** (Backend sin cambios.)
- **Mutación (4):** no agregar el mensaje guardado, no restaurar el borrador y no mostrar el error: mueren. Sobrevive 1, **equivalente**: sacar la deduplicación por id. Por REST, el servidor solo empuja el mensaje al destinatario, así que el propio no puede llegar dos veces a la pantalla; queda como defensa.
- **En Chrome** (SQLite descartable, María → Juan): el mensaje se envió, se ve **una sola vez**, quedó guardado una vez (`GET /messages/thread`) y el campo se vació.

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- El camino de error en Chrome (REST no tiene límite de frecuencia y no forcé un rechazo). Lo cubre el test.

## 93. Filtro de palabras por palabra completa (decisión del usuario) — REVISION B7

**Contexto:** `hasBadWord` comparaba por **subcadena**: "Traigan la computadora" daba 400 (contiene "puta"), igual que "disputa", "reputación" o "diputado". Además "imbécil" con acento pasaba. La lista estaba copiada en `routes/projects.js` y en `ProjectDetails.tsx`. El usuario eligió comparar palabras completas.

**Qué se hizo:**
- **`backend/src/lib/badWords.js` y `frontend/src/lib/badWords.ts` (nuevos):** el texto se normaliza (sin acentos: NFD y se sacan las marcas), se pasa a minúsculas, se parte en palabras (`\p{L}+`, letras Unicode) y se compara palabra por palabra con la lista (la misma de antes, 11 palabras). `projects.js` (comentarios) y `posts.js` (textos de publicaciones) usan el módulo; `ProjectDetails.tsx` usa la copia del frontend. Se borraron las dos definiciones viejas y el export `hasBadWord` de `projects.js`.
- **Sincronía:** `test/unit/badWords.test.js` lee la lista del frontend y exige que sea **igual** a la del backend.
- **Límites aceptados del criterio:** los plurales pasan ("boludos") y los homónimos no se distinguen ("forro polar", "concha" de mar se rechazan igual que antes).

### Tests (nuevos: 13)
- Backend unitario (`badWords.test.js`, 6): las palabras legítimas que contienen una de la lista pasan; la palabra sola, con mayúsculas, acentos o signos, se rechaza; textos vacíos; letras con tilde o de otros alfabetos no cortan la palabra; los límites (plural, homónimo); y la sincronía con el frontend.
- Backend integración (`comments-badwords.test.js`, 2): "Traigan la computadora…" → 201 (antes 400); "Qué imbécil…" y "sos un BOLUDO" → 400.
- Frontend (`lib/badWords.test.ts`, 3): el mismo criterio.
- **Rojo de comportamiento** (no "el módulo no existe"): primero moví la lógica vieja a los módulos nuevos y vi fallar los tests (3 en el backend, 2 en el frontend); después cambié el criterio.

### Verificación
- **Backend SQLite 430/430 y Postgres 432/432**, también con `TZ=America/Argentina/Cordoba`. **Frontend 401/401. Typecheck: 0 errores.**
- **Mutación (8):** volver a subcadena (back y front), no sacar acentos, no pasar a minúsculas, partir con `[a-z]+` y una lista distinta en el frontend. **Todos mueren** después de agregar un caso: "partir con `[a-z]+`" sobrevivía.

### Errores propios
1. **Un caso de test mal planteado:** puse "Ponete el forro polar" entre los textos que debían pasar, pero "forro" está en la lista: con palabra completa se rechaza (no hay forma de distinguir el homónimo). Lo pasé a "límites conocidos".
2. **Un test viejo roto por mi cambio:** `validators.test.js` importaba `hasBadWord` desde `routes/projects`, y yo había sacado ese export. Lo vio la suite completa; actualicé el `require`.
3. **Expliqué mal un sobreviviente:** creí que `[a-z]+` cortaría las palabras con ñ. No pasa, porque la normalización convierte la ñ en n antes de partir. Solo cambia con letras que no se descomponen (ø, ß…), y ese es el caso que agregué.

### ⚠️ NO verificado
- En Chrome no lo probé (el formulario y los mensajes no cambiaron; el criterio lo cubren los tests de los dos lados).
- Los comentarios de las **calificaciones** siguen sin pasar por el filtro (§74): no estaba en el alcance de B7. *(Resuelto en §104.)*

## 94. `JWT_SECRET` obligatorio en producción (decisión del usuario) — REVISION B19 / regla 17

**Contexto:** `middleware/auth.js` y `ws/index.js` tenían, cada uno, `process.env.JWT_SECRET || 'voluntariar_dev_secret'`. En producción sin la variable, cualquiera que leyera el repositorio podía firmar tokens válidos de cualquier usuario y rol. El usuario eligió exigirla en producción (no siempre).

**Qué se hizo:**
- **`src/lib/jwtSecret.js` (nuevo):** `resolveJwtSecret(env)`. En `NODE_ENV=production`, sin `JWT_SECRET` (o con el valor de desarrollo, que es público) lanza un error claro y el servidor no arranca. Fuera de producción devuelve la variable o `voluntariar_dev_secret`, como siempre.
- `middleware/auth.js` y `ws/index.js` toman el secreto de ahí (se borró la copia del WebSocket).
- **`render.yaml` no se tocó:** ya define `NODE_ENV=production` y `JWT_SECRET` con `generateValue: true`, así que el deploy cumple la regla nueva.
- Docs: `AI_RULES` regla 17, `CLAUDE.md` (pendiente resuelto, con una nota sobre el `.env` local) y `PROJECT_CONTEXT` §14.

### Tests (nuevos: 5, `test/unit/jwtSecret.test.js`)
Desarrollo/tests sin variable → valor de desarrollo; con variable → esa; producción sin variable o vacía → error; producción con el valor de desarrollo → error; y que ni el middleware ni el WebSocket tengan su propia copia (leen el código fuente). Rojo de comportamiento primero, con un stub que reproducía lo de antes.

### Verificación
- **SQLite 435/435 y Postgres 437/437**, también con `TZ=America/Argentina/Cordoba` (los tests fijan `JWT_SECRET` y `NODE_ENV=test`: no cambian).
- **Arranque real:** `NODE_ENV=production` sin `JWT_SECRET` → el proceso corta con "Falta JWT_SECRET: en producción es obligatoria…" y código de salida 1.
- **Mutación (5):** no exigir en producción, aceptar el de desarrollo, exigir también fuera de producción, ignorar la variable y el WebSocket con su copia: **los 5 mueren**.

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- **El deploy en Render** (no hay deploy). Por lectura de `render.yaml`, la variable se genera.
- **Tu `.env` local:** no lo abrí. Si tuviera `NODE_ENV=production` sin `JWT_SECRET`, el backend local no arrancaría (con el error de arriba).
- Los tokens emitidos con el secreto viejo dejan de valer si cambia el secreto (normal; en Render el valor generado es estable entre deploys).

## 95. `PUT /api/projects/:id` parcial (deuda conocida, aprobada por el usuario)

**Contexto (confirmado con tests, rojo 16 de 17):** el PUT pisaba todo lo que no venía. Mandando solo el título respondía **500** (descripción y ubicación a `NULL` contra el `NOT NULL`). Un `status` omitido volvía a `'active'` (**reactivaba un proyecto terminado**), y los montos, las horas y los textos opcionales quedaban en 0/`NULL`. Además respondía roles, requisitos y categoría **tomados del body, sin guardarlos**, y validaba mucho menos que el alta. Ninguna pantalla usa el endpoint (no hay edición de proyectos en la interfaz), así que el riesgo de cambiar el contrato era bajo.

**Qué se hizo (`routes/projects.js`):**
- Cada campo que no viene conserva su valor. El resultado combinado se valida con `validateProject` (como el alta), con chequeos de tipo (textos como string, `type` en `fugaz|sostenido`, montos finitos ≥ 0). `null`/`''` borra los opcionales.
- `roles_needed`, `requirements` y `category`, si vienen, se validan como en el alta (`cleanTextList`, B5) y **reemplazan** a los actuales. Proyecto y asociaciones van en **una transacción** (regla 21), con la condición de capacidad atómica de §40 en el `UPDATE`.
- La respuesta se relee de la base. El helper nuevo `loadAssoc(q, id)` (roles, requisitos y categoría) lo usan el PUT y `GET /:id`, que tenía la misma consulta.

### Tests
- `projects-partial-update.test.js` (nuevo, 17): cambiar solo el título no toca nada más; un proyecto terminado sigue terminado; roles/requisitos/categoría se guardan y la respuesta sale de la base; si no vienen quedan como estaban; listas vacías los borran; `null` borra un opcional y es inválido en uno obligatorio; 10 casos inválidos → 400 sin cambiar nada; y una falla inyectada a mitad no deja nada a medias.
- `ownership.test.js`: el test de la ONG **dueña** mandaba `description: 'x'`, que el PUT viejo aceptaba sin validar. Le puse una descripción válida (el test prueba la autorización, no la validación). El de la ONG ajena sigue dando 404 (se chequea el dueño antes de validar).

### Verificación
- **SQLite 452/452 y Postgres 454/454**, también con `TZ=America/Argentina/Cordoba`.
- **Mutación (12):** título siempre del body, status omitido → active, meta omitida → 0, no guardar roles/categoría, borrar requisitos aunque no vengan, responder sin releer, no validar el combinado, montos/tipo/textos sin chequear, `null` que no borra: **los 12 mueren**.

### Errores propios
- Ninguno en esta tarea (el test de `ownership` que cambié no era un error mío: el PUT viejo aceptaba datos que el alta rechaza).

### ⚠️ NO verificado
- En Chrome: no hay pantalla que lo use.
- `PUT` con `latitude`/`longitude` inválidos (texto): se guardan como `NaN`→`null` como antes. No lo cambié.

## 96. `GET /api/projects`: límite acotado y orden estable (deuda conocida, aprobada por el usuario)

**Contexto (confirmado con tests en los dos motores):** `limit` y `offset` iban con `parseInt` directo al SQL. `limit=abc`, `limit=-5` u `offset=abc` daban error (`LIMIT NaN`), y no había tope (`limit=100000`). El orden no tenía desempate: con proyectos empatados (mismo `created_at` y mismo puntaje), **en Postgres dos páginas repetían proyectos y salteaban otros** (los tres órdenes fallaron). En SQLite pasaba de casualidad, porque devuelve en orden de inserción.

**Qué se hizo:**
- `clampInt` pasó de `posts.js` a `lib/inputs.js` (lo usan `posts` y `projects`, regla 3). `limit`: default 20, entre 1 y **500** (lo máximo que pide hoy el frontend: el selector de patrocinio; Explorar pide 200). `offset` ≥ 0. Inválido → el default.
- Los tres órdenes (`featured`, `recent`, `rating`) terminan en `p.id`.
- `API_CONTEXT.md`: la paginación nueva, y la lista de query params corregida (listaba `tipo`, `categoria` "uno o varios ids", `ngo_id`, `page` y un default de `status` que el código nunca tuvo).

### Tests (nuevos: 11, `projects-pagination.test.js`, con 520 proyectos idénticos salvo el id)
6 combinaciones inválidas de `limit`/`offset` → 200 con defaults; sin `limit` → 20; `limit=100000` → 500; y para cada orden, cuatro páginas de 15 seguidas son exactamente los primeros 60 del listado completo, sin repetidos.

### Verificación
- **SQLite 463/463 y Postgres 465/465**, también con `TZ=America/Argentina/Cordoba`.
- **Mutación (6, los dos motores):** sacar el desempate de cada orden, sacar el tope y no acotar `limit`/`offset`: **los 6 mueren** (los de desempate, por Postgres).

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado / pendiente
- **No es paginación "de verdad" en la interfaz:** Explorar y el selector de patrocinio siguen pidiendo un bloque grande. Con más de 500 proyectos activos se cortarían. Haría falta "cargar más" en esas pantallas.
- En Chrome no lo miré: el camino normal (Explorar con `limit=200`) no cambia; lo cubren los tests.

## 97. Guardas de rol en el frontend (deuda conocida, aprobada por el usuario)

**Contexto:** `/ngo/*` y `/company/*` se abrían con cualquier rol o sin sesión. El backend rechazaba los datos, pero la interfaz mostraba un panel vacío (un voluntario en `/ngo/dashboard` veía "No hay proyectos"). Confirmado con tests antes de tocar (rojo en 7 de 9).

**Qué se hizo:**
- **`components/RequireRole.tsx` (nuevo):** mientras se verifica la sesión muestra "Verificando sesión" (`role="status"`). Sin sesión va al inicio y abre el login. Con otro rol va al inicio de ese rol (`homeFor`: ONG → `/ngo/dashboard`, empresa → `/company/profile`, voluntario → `/feed`; los mismos destinos que el login).
- `NGOLayout` y `CompanyLayout` envuelven todo en la guarda. Va **dentro del layout** y no en `routes.tsx`, así no cambia el árbol de rutas (lo usa `routes.test.tsx`) y los perfiles públicos `/ngo/:id` y `/company/:id` (bajo `Root`) siguen abiertos para todos.
- **Cerrar sesión desde el panel no abre el login:** todos los botones hacen `logout(); navigate('/')`. Si el layout llega a dibujarse sin sesión entre las dos cosas, la guarda lo interpretaría como "alguien sin sesión quiere entrar". Recuerda si en ese panel ya hubo sesión y en ese caso solo redirige. Lo encontré pensando el flujo, no por un error; el test que lo cubre dio rojo antes del arreglo.
- Es solo experiencia de uso: la autorización real sigue en el backend (AI_RULES regla 15).

### Tests (nuevos: 10, `RequireRole.test.tsx`, con los layouts reales)
ONG y empresa ven su panel; voluntario y la otra organización van a su inicio; sin sesión, al inicio con el login; durante la verificación, "cargando" sin redirigir ni abrir nada; y perder la sesión estando adentro no abre el login.

### Verificación
- **Frontend: 411/411. Typecheck: 0 errores.** (Backend sin cambios.)
- **Mutación (6):** sin chequear el rol, sin redirigir sin sesión, sin esperar la verificación, abrir el login aunque se haya cerrado sesión, no abrirlo nunca, y el destino de la empresa cambiado: **los 6 mueren**.
- **En Chrome** (SQLite descartable): visitante en `/ngo/dashboard` → `/` con el diálogo "Iniciar sesión"; María (voluntaria) en `/ngo/dashboard` y `/company/dashboard` → `/feed`; María en `/ngo/ngo-1` (perfil público) → lo ve; Sustentando en `/ngo/dashboard` → su panel; "Cerrar sesión" desde el menú lateral → `/`, **sin** diálogo, y la barra muestra "Entrar".

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- Los botones de cerrar sesión del menú inferior (móvil) usan `window.confirm`, que bloquea la extensión de Chrome: no los probé ahí. Hacen lo mismo que el lateral (`logout(); navigate('/')`).
- Un usuario de una empresa en el panel de ONG: lo cubre el test. En Chrome probé voluntaria y visitante.

## 98. `NGOEmpleados` pasa a `api.ts` (deuda conocida, aprobada por el usuario)

**Contexto:** `NGOEmpleados` era el único componente con `fetch` directo (AI_RULES regla 4). Problemas:
- usaba `import.meta.env.VITE_API_URL` **sin** el respaldo que tiene `api.ts` (`http://localhost:3001/api`): sin esa variable, la URL quedaba `undefined/ngos/…` (no lo verifiqué en la práctica: no abro el `.env` del frontend);
- al listar **no miraba `res.ok`**: un 403 "Sin acceso" o un 500 se veían como "Sin miembros en el equipo".

Confirmado con tests antes de tocarlo (rojo en 3 de 3).

**Qué se hizo:** `api.ngos.empleados.list(ngoId)` y `.create(ngoId, body)`, y el tipo `Empleado` en `api.ts` (regla 6). `NGOEmpleados` los usa; un error de carga se muestra con `InlineError` y "Reintentar" (patrón de F9, §65). El alta muestra el error del servidor como antes. Ya no queda ningún `fetch` directo fuera de `api.ts` (buscado con `grep`).

### Tests (nuevos: 3, `NGOEmpleados.test.tsx`; `fetch` global falla a propósito, para asegurar que no se use)
Lista con `api.ngos.empleados.list('ngo-1')`; un 403 se ve como error con "Reintentar" (no como "Sin miembros") y reintentar carga; agregar usa `create` con el formulario, muestra el error del servidor y recarga al guardar.

### Verificación
- **Frontend: 414/414. Typecheck: 0 errores.** Los tests anteriores que pasaban por esta pantalla (F15, nombres accesibles) siguen verdes: stubean `fetch`, que ahora usa `api.ts` por debajo.
- **Mutación (4):** mostrar el error como lista vacía, no guardar el error, no recargar tras agregar y mandar sin el id: **los 4 mueren**.
- En Chrome no lo miré esta vez: §89 ya había cargado la pantalla (equipo vacío del seed). El camino de error lo cubre el test.

### Errores propios
- Ninguno en esta tarea.

## 99. Se borra `OnboardingScreen.tsx` (decisión del usuario)

**Contexto:** componente de login/registro alternativo que nunca estuvo en `routes.tsx` (código muerto desde el análisis inicial). Tenía su propia copia de las validaciones del registro, que habría que mantener sincronizada. El usuario eligió borrarlo; queda en el historial de git si se quiere recuperar.

**Qué se hizo:** `git rm` del archivo (nada lo importaba: verificado con `grep`). Docs: `FRONTEND_CONTEXT` (lista de componentes, ahora 48, y los ítems de "problemas" y "mejoras"), `PROJECT_CONTEXT` y la tabla de deuda de `REVISION`.

### Verificación
**Frontend 414/414. Typecheck: 0 errores.** Sin tests propios que borrar (no tenía).

## 100. El WebSocket queda solo para recibir (decisión del usuario)

**Contexto:** desde §92 el chat manda siempre por `POST /api/messages`. El listener `type: 'send'` del servidor (reforzado en §87) quedó sin uso, pero seguía siendo una vía de escritura abierta. El usuario eligió sacarlo.

**Qué se hizo:**
- `ws/index.js`: sin listener de `message` (lo que mande el cliente se ignora). Se sacaron también el límite de frecuencia (`allowSend`, `SEND_LIMIT`), que solo tenía sentido para esa vía, y `sendError`. **Queda `maxPayload` 64 KB:** un frame enorme igual cierra la conexión (1009) sin procesarse.
- `MessageInputError` (§87) sigue: la usa `POST /api/messages` para responder 400.
- Tests: en `ws-hardening.test.js`, los 5 casos del envío por socket y el de frecuencia se reemplazaron por uno que exige que un `send` (o un JSON roto) **no se guarde, no se reenvíe y no se conteste**. Siguen el de `maxPayload` y el de REST. Se borró `test/unit/wsRateLimit.test.js` y el test de §40 que mandaba **por** el socket.
- Docs: la sección del WebSocket en `API_CONTEXT.md`.

### Verificación
- **Rojo → verde:** con el listener, el test nuevo falló (el `send` se guardaba y se reenviaba). Sin él, pasa.
- **SQLite 454/454 y Postgres 456/456** (−9 a propósito: los tests de la vía que se sacó), también con `TZ=America/Argentina/Cordoba`.
- `grep`: no quedan referencias a `allowSend`, `SEND_LIMIT` ni `sendViaSocket` en el código.

### Errores propios
- Al principio no vi que `insert-returns-own-row.test.js` (§40) tenía un test de envío **por** el socket. Falló y la corrida se colgó (quedó un socket abierto); lo saqué. Ese archivo no termina los sockets en `after()` si falla un test, como sí hace `ws-hardening` (§87); no lo cambié.

### ⚠️ NO verificado
- Que ningún cliente fuera del frontend use el envío por socket: no hay otros clientes conocidos.

## 101. Un solo modal de reseñas (decisión del usuario)

**Contexto:** había dos componentes que hacían lo mismo (deuda conocida): `ReviewModal` en "Mis participaciones" (estrellas + comentario) y `ReviewsModal` en el feed (reseñas de otros + el mismo formulario). Una corrección en uno no llegaba al otro. El usuario eligió unificar en `ReviewsModal`.

**Qué se hizo:** "Mis participaciones" abre `ReviewsModal` con `canRate` ("Reseña" solo aparece en inscripciones aprobadas). Se borró `ReviewModal.tsx` y sus casos en los tests de accesibilidad (`A11yNames`, `ModalsA11y`): `ReviewsModal` ya tiene los suyos (§80, §81). **Cambio visible:** desde "Mis participaciones" ahora también se ven las reseñas de los demás y el promedio.

### Tests
- `MyParticipationReview.test.tsx` (nuevo): "Reseña" abre el diálogo "Reseñas y Calificaciones", se ve la reseña de otro y dejar la propia llama a `api.projects.rate('proj-1', 4, …)`. Rojo antes (abría "Dejar reseña").

### Verificación
- **Frontend: 413/413** (−2 casos del modal borrado, +1 nuevo). **Typecheck: 0 errores.**
- **En Chrome** (SQLite descartable, María): Mis participaciones → "Reseña" de Reforestación Urbana → diálogo "Reseñas y Calificaciones" con el promedio (5.0, 2 reseñas), el formulario y la lista. Escape lo cierra.

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- No hice mutación aparte: el cambio es reemplazar un componente por otro ya probado; el test nuevo falla si "Mis participaciones" vuelve a abrir otra cosa o si no se puede calificar.

## 102. Fecha de los KPIs validada (aprobada por el usuario)

**Contexto:** §88 dejó anotado que `kpis.fecha` (columna `TEXT`) aceptaba cualquier texto ("ayer", "01/10/2026", "2026-02-30"…). `formatDateOnly` (§63) espera `AAAA-MM-DD`. Confirmado con tests (rojo en 10: 5 casos × POST y PUT).

**Qué se hizo:** `validateKpi` exige `AAAA-MM-DD` de una fecha que exista (`isIsoDate`: regex anclada + comparación contra `Date.UTC`, sin depender del huso horario), o vacía/ausente = sin fecha. Error: "La fecha tiene que tener el formato AAAA-MM-DD". El formulario (`<input type="date">`) ya manda ese formato: el camino normal no cambia.

### Tests (+14 en `kpis-input-validation.test.js`)
6 casos inválidos × POST y PUT (texto libre, otro formato, 30 de febrero, mes 13, número, un dígito de más), y en los válidos: 29 de febrero de un año bisiesto se acepta; fecha vacía queda `null`.

### Verificación
- **SQLite 466/466 y Postgres 468/468**, también con `TZ=America/Argentina/Cordoba`.
- **Mutación (4):** solo regex sin chequear que la fecha exista, sin chequeo, `''` como inválida y la regex sin anclar. Esta última sobrevivía: `'2026-10-012'` pasaba como 12 de octubre. Agregué ese caso y **los 4 mueren**.

### Errores propios
- Al insertar la regex con un `node -e` se perdieron las barras invertidas (`/^d{4}…/`). Lo mostró el test de los casos válidos; lo corregí con la herramienta de edición.

## 103. Límite de intentos en login y registro (aprobado por el usuario)

**Contexto:** no había ningún límite: se podían probar contraseñas sin tope (y con §91 los dos errores del login ya son iguales, así que el límite es la defensa que faltaba contra la fuerza bruta). Confirmado con tests contra un limitador que no limita (rojo en 7).

**Qué se hizo:**
- **`src/lib/rateLimit.js` (nuevo, sin dependencias, regla 18):** `createLimiter({ max, windowMs })` con ventana deslizante en memoria: `blocked(key)` (segundos hasta liberarse), `hit`, `reset`. Borra las claves vencidas.
- **Login (`routes/auth.js`):** solo cuentan los fallidos (401). Límite por email+IP (10 cada 15 min): por email solo, cualquiera podría bloquearle la cuenta a otra persona. Límite por IP (50 cada 15 min): muchos emails desde el mismo lugar. Un login correcto limpia el contador de email+IP. Los `400` de validación no cuentan. Bloqueado → **429** "Demasiados intentos. Probá de nuevo en unos minutos." con `Retry-After`, **sin consultar la base ni comparar la contraseña**.
- **Registro:** 20 por IP por hora (cuentan todos los intentos).
- **`src/index.js`:** `trust proxy` en producción, para que `req.ip` sea la IP del cliente detrás del proxy de Render (si no, todos compartirían la del proxy y el límite por IP bloquearía a todos juntos).
- El frontend no cambia: `AuthModal` muestra el mensaje del servidor.

### Tests (nuevos: 10)
- `test/unit/rateLimit.test.js` (3, reloj a mano): tope y segundos restantes, liberación al pasar la ventana, `reset` y claves independientes.
- `auth-rate-limit.test.js` (7): 10 contraseñas malas → la 11.ª es 429 aunque sea la correcta, con `Retry-After`; bloqueado no se llama a bcrypt; otra cuenta desde la misma IP entra; un login correcto limpia el contador; los 400 no cuentan; 50 fallidos por IP con emails distintos bloquean; el registro n.º 21 es 429.

### Verificación
- **SQLite 476/476 y Postgres 478/478**, también con `TZ=America/Argentina/Cordoba`. Ningún test existente llegó a los límites (cada archivo corre en su propio proceso, con el estado limpio).
- **Mutación (8):** 7 mueren: chequear después de comparar, no limpiar tras un login correcto, sin límite por IP, registro sin límite, sin `Retry-After`, ventana que nunca expira, segundos mal calculados. **1 no se aplicó:** el patrón de "los 400 también cuentan" aparecía dos veces en el archivo. Ese comportamiento lo cubre igual un test, pero ese mutante no lo corrí.

### Errores propios
- Ninguno en esta tarea (el mutante que no se aplicó es una limitación del script, anotada arriba).

### ⚠️ NO verificado
- **Detrás del proxy de Render** (`trust proxy` y `req.ip` reales): no hay deploy.
- **Que la clave sea por email+IP y no por email solo:** los tests salen todos de la misma IP (localhost), así que esa diferencia no se puede ver en ellos.
- Es en memoria y por proceso: si se reinicia el servidor, los contadores vuelven a cero; con varias instancias, cada una cuenta lo suyo.
- No hay CAPTCHA ni bloqueo de cuenta persistente (fuera de alcance).

## 104. Filtro de palabras en los comentarios de las calificaciones (aprobado por el usuario)

**Contexto:** el filtro de palabras (§93) se aplicaba a los comentarios de los proyectos y a los textos de las publicaciones, pero no al comentario de una calificación (`POST /api/projects/:id/ratings`). "Qué imbécil el coordinador" se guardaba y se veía en la pestaña Reseñas y en `ReviewsModal`. Pendiente anotado en §93.

**Qué se hizo:**
- `routes/projects.js`: después de validar tipo y largo, `hasBadWord(comment)` → **400** "El comentario contiene palabras no permitidas", el mismo mensaje que los comentarios. Mismo criterio de palabra completa ("computadora" pasa).
- **Frontend sin cambios:** `ProjectDetails.tsx` y `ReviewsModal.tsx` ya muestran el `error` del servidor. No se agregó el chequeo previo en el cliente (que sí tienen los comentarios): la defensa real es la del backend (regla 15) y una más sería otra duplicación.
- **Datos existentes:** las calificaciones ya guardadas no se tocan. Si una tiene una palabra de la lista, queda así hasta que su autor la edite (el upsert la pasaría por el filtro).
- Docs: `API_CONTEXT` (validación y **respuesta**: decía `201 { rating }` y el código responde `200 { message: 'Calificación guardada' }`, lo que esperan los tests desde antes), `BACKEND_CONTEXT`, el encabezado de `lib/badWords.js` y una nota en §93.

### Tests (nuevos: 2, en `comments-badwords.test.js`)
- Calificación con "Qué imbécil…" o "sos un BOLUDO" → 400 con ese mensaje, y la calificación anterior de María en `proj-1` no cambia.
- Con "Traigan la computadora…" → 200 y se guarda.
- **Rojo de comportamiento:** con el código anterior, el primero daba `200` en vez de `400`.

### Verificación
- **SQLite 478/478 y Postgres 480/480**, también con `TZ=America/Argentina/Cordoba`.
- **Mutación (5):** sacar el chequeo, negarlo, cambiar el mensaje y cambiar el status: **mueren los 4**. **Sobrevive 1, equivalente:** sacar la guarda `comment &&`, porque `hasBadWord(null/undefined)` revisa el texto "null"/"undefined", que no está en la lista.

### Errores propios
- El primer script de mutación no encontraba el patrón (no tuve en cuenta la línea en blanco), y al arreglarlo con `node -e` se perdieron los escapes. Lo reescribí como archivo. No tocó el código: el script restaura el archivo al terminar, y lo comprobé con `cmp`.

### ⚠️ NO verificado
- No lo vi en el navegador: que el mensaje aparezca en el formulario de reseñas lo deduzco del código (`setRatingErr(err.message)` / `setErrorMsg(err.message)`), que ya se usa con los otros 400.
- No revisé si la base local tiene calificaciones viejas con palabras de la lista.

## 105. Listas de seguidores en un solo componente (aprobado por el usuario)

**Contexto:** las listas "Seguidores"/"Siguiendo" de `VolunteerProfile` (perfil propio) y `VolunteerPublicProfile` eran el mismo modal copiado (~60 líneas de JSX más estado y carga en cada uno; anotado en §81). Solo cambiaban el endpoint (`myFollowers`/`myFollowing` contra `volunteerFollowers(id)`/`volunteerFollowing(id)`) y el texto de la lista vacía ("Todavía no tenés…" contra "Todavía no tiene…").

**Qué se hizo:**
- **`FollowListModal.tsx` (nuevo):** `mode`, `load(mode)`, `emptyText` por modo, `meId` y `onClose`. Pide la lista al montarse, que es cada vez que se abre, y tiene su propio estado de carga. El JSX es el de antes, con las mismas clases.
- **Los dos perfiles:** quedó solo `listMode` (sacamos `listData`, `listLoading`, `listTitleId` y las funciones `openMyList`/`openList`). Los botones solo ponen el modo. −157/+19 líneas en los dos archivos.
- **Diferencias con antes:**
  - Se sacaron `animate-in slide-in-from-bottom`, que solo tenía la copia del perfil público: no hay plugin de animaciones instalado y esas clases no generaban CSS (verificado: ni `package.json` ni `src/styles` las definen). No cambia nada visible.
  - Si la lista se cierra antes de que llegue la respuesta, la respuesta se descarta. Antes llegaba igual a un estado que ya no se mostraba.
- **Sin cambio de comportamiento** a propósito: un error al pedir la lista sigue viéndose como "Todavía no tenés seguidores." (ver ⚠️).

### Tests (nuevos: 7, `FollowLists.test.tsx`)
Contra los dos perfiles, no contra el componente: así sirven como red del refactor.
- Cada fila: link a `/volunteer/:id`, o a `/profile` con "Tú" si es el usuario logueado; foto (`foto_perfil` o `avatar`) o inicial; ubicación (`ubicacion`, `location` o "Argentina") y seguidores.
- Qué endpoint llama cada perfil (las mías en el propio; las del `:id` en el público).
- El texto de la lista vacía de cada perfil y de cada modo.
- Mientras carga no aparece "Todavía no…".
- Tocar una persona navega y cierra la lista; "Cerrar" también.
- Perfil público → otra persona de la lista: el perfil nuevo carga sin la lista abierta. Es el mismo componente con otro `:id`, y sin cerrar la lista ella volvería a abrirse sola.
- **Rojo:** no corresponde, porque es un refactor sin cambio de comportamiento. Lo que corresponde es que los tests pasen **con el código anterior**, y pasan los 7: los corrí contra los perfiles de `HEAD`, copiados aparte sin `git stash`, y después restauré los archivos nuevos.

### Verificación
- **Frontend 420/420** (413 + 7), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.** Finales de línea: los dos perfiles siguen en CRLF; el componente y el test nuevos, en LF, como `Modal.tsx`.
- **Mutación (15, sobre `FollowListModal.tsx`):** mueren 12. **Sobreviven 3:**
  - *`catch` que no vacía la lista:* equivalente. La lista ya empieza vacía en cada apertura.
  - *Sin la guarda `cancelled`:* equivalente en la práctica. El modo no cambia con la lista abierta, y React 18 ignora un `set…` después de desmontar.
  - *Estado de carga inicial en `false`:* **no equivalente.** Mostraría "Todavía no…" durante un cuadro, hasta que corre el efecto. No se puede observar con Testing Library, porque `render()` ya ejecuta los efectos.
  - El mutante "el link no cierra la lista" sobrevivía en la primera corrida: el test navegaba a otra ruta y se desmontaba el perfil entero. Por eso agregué el último test, y ahora muere.

### Errores propios
1. **La primera corrida de mutación fue falsa:** marcó los 15 como "muere" porque `execSync` usa cmd.exe en Windows y no encontraba `node_modules/.bin/vitest`. Fallaba **todo**, mutado o no. Me llamó la atención que murieran mutantes que esperaba que sobrevivieran. Pasé a `node node_modules/vitest/vitest.mjs` y agregué una corrida de control sin mutar al principio del script.
2. Al principio, el test de "pide mis listas" no probaba nada en el perfil propio: `myFollowers` también se llama al montar, para el contador. Ahora limpia el mock antes de abrir la lista.
3. Dejé un comentario `eslint-disable` en el componente, pero el proyecto no tiene ESLint. Lo saqué.
4. **Doc que ya estaba mal:** `FRONTEND_CONTEXT` §4 decía "47 componentes" y el punto 8, "48"; antes de este cambio eran 48. Ahora dice 49.

### ⚠️ NO verificado
- No lo vi en el navegador. El JSX y las clases son los de antes (salvo las dos clases que no generaban CSS), pero no lo comprobé a ojo.
- **Hallazgo, sin arreglar (no estaba en el pedido):** si falla el pedido de la lista (red, 500), el modal dice "Todavía no tenés seguidores." en vez de un error. Es el mismo patrón que se corrigió en `NGOEmpleados` (§98). Queda para la segunda pasada.
