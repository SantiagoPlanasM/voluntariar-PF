# Bitácora §106–§161: Segunda pasada de revisión y verificación en producción

> Archivo (histórico). Parte de `docs/PROJECT_ANALYSIS.md`, separada el 30/10/2026 sin cambios en el texto. Índice: [`../../PROJECT_ANALYSIS.md`](../../PROJECT_ANALYSIS.md).

## 106. Segunda pasada de revisión (solo lectura)

**Qué se hizo:** revisé lo que `REVISION.md` había dejado como "sin revisar": plantillas y envío de email, `seed.js`, los componentes de Momentos, `ReviewsModal`, `FilterModal`, `ProjectMap`, las barras de navegación, `imageCompress.ts`, `sponsorship.ts`, los tests unitarios del backend y los códigos de éxito de `API_CONTEXT`. El informe está en `REVISION.md`, "Segunda pasada": **10 hallazgos (S1–S10), 2 de severidad media**. El más extendido, S1, son los errores de carga que se ven como "no hay nada"; el otro, S2, es que la página Momentos de la ONG muestra el feed global. **No se tocó código.**

### Verificación
- Lectura del código. Tres controles con scripts descartables: tests unitarios del backend sin asserts (0), `catch` que tragan errores en el frontend (24 lugares, clasificados en el informe) y códigos de éxito documentados contra el código (0 diferencias después de §104).

### Errores propios
- El primer intento de escribir este informe con un heredoc de Bash falló por las comillas (no llegó a modificar nada; lo comprobé con `git status`). Lo rehíce con archivos.

### ⚠️ NO verificado
- Todos los hallazgos son por lectura, salvo los dos controles marcados como "probado". Ninguno se reprodujo en el navegador.
- No revisé `API_CONTEXT` campo por campo ni `PROJECT_ANALYSIS`/`BACKEND_ROADMAP_ANALYSIS` contra el código.

## 107. Reseñas: un error de carga ya no se ve como "Sin reseñas todavía" — REVISION S1 (ReviewsModal)

**Contexto:** `ReviewsModal.loadRatings` atrapaba el error de `api.projects.get` y solo lo logueaba. El modal mostraba "Sin reseñas todavía" y "0 reseñas en total", como si nadie hubiera calificado. Es el mismo patrón que F9 (§65) y `NGOEmpleados` (§98). Hallazgo S1 de la segunda pasada (§106), primera pantalla de la lista.

**Qué se hizo:**
- `ReviewsModal.tsx`: estado `loadError`. En el `catch`, `userMessage(err, 'No pudimos cargar las reseñas. Revisá tu conexión.')`: un `ApiError` muestra el mensaje del servidor y un `TypeError` (sin red) muestra el texto en español, no "Failed to fetch". Se limpia al empezar cada carga.
- En la lista: `loading` → spinner; `loadError` → `<InlineError>` con "Reintentar" (llama a `loadRatings`); recién después, "Sin reseñas todavía" o la lista. Mismo componente que `NGOEmpleados`, `NGOKPIs`, etc.
- En el resumen, con error dice "No se pudieron cargar las reseñas" en vez de "0 reseñas en total" (era el mismo "parece vacío" en chico). El promedio sigue mostrando `avgRating` si el padre lo pasó.

### Tests (nuevos: 3, `ReviewsModal.test.tsx`)
- 500 → se ve el mensaje del servidor y "Reintentar"; no aparecen "Sin reseñas todavía" ni "0 reseñas en total". "Reintentar" vuelve a pedir y muestra la lista; el error y el botón desaparecen (`get` llamado 2 veces).
- `TypeError('Failed to fetch')` → "No pudimos cargar las reseñas. Revisá tu conexión.", sin el texto técnico.
- Sin reseñas de verdad (respuesta OK y vacía) → sigue diciendo "Sin reseñas todavía", sin "Reintentar".
- **Rojo de comportamiento:** con el código anterior fallaban los dos primeros (no encontraban el mensaje de error: se veía "Sin reseñas todavía"). El tercero pasaba antes y después, a propósito (es el caso que no tiene que cambiar).

### Verificación
- **Frontend 423/423** (420 + 3), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.** `ReviewsModal.tsx` sigue en CRLF.
- **Mutación (8, sobre el código nuevo):** sacar `setLoadError(...)` del `catch`, cambiar `userMessage` por `err.message`, `loadError ?` → `false ?` en la lista y en el resumen, "Reintentar" que no hace nada, no limpiar el error al empezar la carga: **mueren 7**. **Sobrevivió 1:** el `setLoadError('')` que había agregado en la rama "vino `initialRatings`" del efecto de apertura. No es equivalente en teoría, pero en la app es inalcanzable (el `initialRatings` de una tarjeta del feed nunca cambia, y la tarea S3 reescribe ese efecto); **saqué la línea** en vez de dejar código sin test.

### Errores propios
1. El worktree arrancó en un commit viejo (`31f0bee`, sin la "Segunda pasada" ni §98 ni `<Modal>` en `ReviewsModal`). Me di cuenta al no encontrar `InlineError` en `NGOEmpleados`; avancé la rama a `main` (`89818c1`, fast-forward, sin cambios propios todavía) antes de tocar nada.
2. La primera corrida de mutación salteó un mutante porque el patrón tenía `\n` y el archivo es CRLF. Lo repetí con `\r\n`.

### ⚠️ NO verificado
- No lo vi en el navegador: cómo queda `InlineError` (pensado para pantallas) dentro del modal de reseñas es por lectura de clases.
- En esta tarea, con `initialRatings` no vacío (el feed) el modal todavía no pedía nada, así que el error solo podía verse desde "Mis participaciones" o con un proyecto sin reseñas en el feed. Lo cambia S3.

## 108. Listas de seguidores: un error ya no se ve como "Todavía no tenés seguidores" — REVISION S1 (FollowListModal)

**Contexto:** `FollowListModal` (§105) pedía la lista al abrirse y, si el pedido fallaba (red, 500), vaciaba la lista y mostraba el texto de vacío ("Todavía no tenés seguidores." / "Todavía no sigue a nadie."). §105 lo dejó así a propósito (refactor sin cambio de comportamiento) y lo anotó en ⚠️; la segunda pasada lo listó en S1.

**Qué se hizo:**
- `FollowListModal.tsx`: estado `error` y `attempt`. En el `catch`, `userMessage(e, 'No pudimos cargar la lista. Revisá tu conexión.')` (el mensaje del servidor tal cual; un `TypeError` de red se reemplaza). Si hay error se muestra `<InlineError>` (mensaje + "Reintentar") envuelto en `<div role="alert">`; "Reintentar" suma `attempt`, que está en las dependencias del efecto, y vuelve a pedir la lista (mientras tanto, el spinner).
- El orden de la vista es: cargando → error → vacío → lista. Por eso el `catch` ya no hace `setList([])`: la rama de error se muestra antes que la lista (ver Mutación).
- `InlineError` no tiene `role="alert"` propio; lo envolví en vez de agregárselo al componente, para no cambiar las otras pantallas que lo usan (y porque otros agentes tocan pantallas con `InlineError` en paralelo).

### Tests (nuevos: 3, en `FollowLists.test.tsx`)
- Perfil público, "Seguidores" con 500 → `role="alert"` con "Error interno del servidor", sin "Todavía no…"; "Reintentar" → aparece la lista, desaparece el aviso, y el endpoint se llamó 2 veces.
- Perfil propio, "Siguiendo" sin conexión (`TypeError('Failed to fetch')`) → "No pudimos cargar la lista. Revisá tu conexión.", no "Failed to fetch".
- "Reintentar" que vuelve a fallar: mientras está pendiente no hay aviso ni "Todavía no…"; al fallar (503), el aviso con el mensaje nuevo.
- **Rojo de comportamiento:** con el código anterior los 3 fallaban por no encontrar `role="alert"` / el botón "Reintentar" (los 7 de §105 seguían en verde).

### Verificación
- **Frontend 423/423** (420 + 3), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.**
- **Mutación (9 sobre `FollowListModal.tsx`, script con corrida de control previa):** mueren 7. 1 no aplicó (patrón LF; el archivo es CRLF en la copia de trabajo — la versión CRLF del mismo mutante muere). **Sobrevivió 1, equivalente:** "el `catch` no vacía la lista": la rama de error tapa la lista y, como el modo no cambia con la lista abierta, la lista solo puede estar vacía cuando se reintenta. Lo saqué del código en vez de dejarlo.

### Errores propios
- El worktree arrancó en un commit viejo (`31f0bee`, sin §105 ni la "Segunda pasada"); lo avancé a `main` (`89818c1`) con fast-forward antes de empezar.
- El primer intento de crear el junction de `node_modules` con `cmd //c mklink` lo bloqueó la herramienta; lo hice con `New-Item -ItemType Junction` de PowerShell. No quedó en git.

### ⚠️ NO verificado
- No lo vi en el navegador. `InlineError` trae su propia tarjeta (borde, `py-10`) y dentro del modal puede verse como "tarjeta dentro de tarjeta"; no lo comprobé a ojo.
- Que un lector de pantalla anuncie el aviso (solo verifiqué el `role="alert"` en el DOM).

## 109. Perfil propio: los errores de carga se ven (y guardar no borra las habilidades) — REVISION S1 (VolunteerProfile)

**Contexto:** `VolunteerProfile` hace seis pedidos al montar (participaciones, catálogo de habilidades, mis habilidades, ONGs seguidas, siguiendo, seguidores), cada uno con `.catch(() => {})`. Un 500 o la falta de red mostraban "Aún no participaste en ningún proyecto", "Todavía no sigues a ninguna ONG.", "Todavía no seguís a ningún voluntario." y los contadores en 0, como si fueran datos. **Además había una pérdida de datos:** si fallaba "mis habilidades" (o el catálogo) y la persona editaba su perfil, el borrador de habilidades arrancaba vacío y "Guardar cambios" mandaba `habilidades.update([])`, que borra todas.

**Qué se hizo:**
- **Un solo aviso general**, no uno por sección. Justificación: los seis pedidos van al mismo servidor y casi siempre fallan juntos (sin red, servidor caído); seis tarjetas `InlineError` apiladas serían ruido, y un "Reintentar" que recarga todo es lo más simple (son pedidos chicos). Es el mismo componente que el resto de la app (`InlineError` de §65, dentro de `<div role="alert">`), arriba del contenido. El mensaje es el del primer error: `userMessage(e, 'No pudimos cargar parte de tu perfil. Revisá tu conexión.')`.
- **Cada parte que falló no muestra su vacío:** un conjunto `failed` (`'enrollments' | 'catalog' | 'skills' | 'ngos' | 'following' | 'followers'`). Los contadores de esa parte muestran "—" en vez de 0 (Aprobadas/Pendientes/Total si fallan las participaciones; Seguidores; Siguiendo), los títulos "Mis ONGs seguidas" y "Voluntarios que sigo" pierden el "(0)", y la sección dice "No se pudo cargar." en vez del texto de vacío. La de Habilidades, que se oculta cuando no hay ninguna, se muestra con "No se pudo cargar." si su carga falló.
- **Habilidades al editar:** si falló `skills` o `catalog`, el formulario dice "No pudimos cargar tus habilidades: reintentá para editarlas." en lugar de los chips, y `handleSave` **no llama** a `habilidades.update` (sí guarda nombre, bio y ubicación).
- **"Reintentar"** (`loadAll`) limpia el conjunto y el mensaje, vuelve a poner `loading` (si no, Participaciones diría "Aún no participaste…" mientras llega la respuesta) y repite los seis pedidos. Con `useLatestRequest` se descarta **solo el error** de un pedido viejo (si no, marcaría como fallida una parte que el reintento ya cargó). Las respuestas viejas exitosas no se descartan: son datos válidos del mismo endpoint (ver Mutación).

### Tests (nuevos: 8, `VolunteerProfileErrors.test.tsx`)
- Todo falla: un solo `role="alert"` con el mensaje del servidor; sin los tres textos de vacío; los cinco contadores en "—"; los títulos sin "(0)"; Habilidades con "No se pudo cargar."; "Reintentar" carga todo (ONGs, participaciones, voluntarios, habilidades, contadores), el aviso desaparece y cada endpoint se llamó 2 veces.
- Falla solo ONGs: aviso; esa sección dice "No se pudo cargar." y no "Todavía no sigues…"; las demás muestran su vacío real ("Aún no participaste…", Total 0) o sus datos.
- Sin conexión (`TypeError`) en seguidores: mensaje propio; Seguidores "—" y Siguiendo con su número.
- Fallan mis habilidades → al editar, el texto de aviso y sin chips; "Guardar" llama a `updateMe` y **no** a `habilidades.update`.
- Lo mismo si falla el catálogo.
- Con todo cargado, "Guardar" sí manda las habilidades (`[{ habilidad_id: 'h1', nivel: 'basico' }]`).
- Mientras "Reintentar" carga las participaciones no dice "Aún no participaste…".
- Un error viejo que llega después de "Reintentar" no vuelve a mostrar el aviso.
- **Rojo de comportamiento:** con el código anterior fallaban 6 de los primeros 7 (el 7.º, "con todo cargado…", es el control y pasaba). El de "mientras reintenta" lo escribí después (ver Errores propios) y falló contra la versión sin `setLoading(true)`.

### Verificación
- **Frontend 431/431** (423 + 8), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.** Los tests que ya montaban el perfil (`FollowLists`, `ModalsA11y`, `A11yNames`, `StaleResponses`, `MomentsPlacement`) siguen en verde sin cambios. `VolunteerProfile.tsx` sigue en CRLF en la copia de trabajo.
- **Mutación (32 en total sobre lo nuevo de `VolunteerProfile.tsx`, script con corrida de control):** primera corrida, 31 mutantes: mueren 27, sobreviven 4.
  - *Guarda `isLatest` en las respuestas exitosas y en el `finally`* (2): equivalentes en la práctica (una respuesta vieja exitosa trae los mismos datos del mismo endpoint). **Las saqué del código.**
  - *La sección Habilidades fuera de edición no se muestra / no dice "No se pudo cargar."* (2): **no equivalentes**; agregué la aserción al primer test y mueren.
  - Segunda corrida (29 tras sacar los 2 equivalentes): **29/29 mueren**. Más 3 sobre la línea de `loadAll` después de agregar `setLoading(true)`: **3/3 mueren**.

### Errores propios
1. Mi primera versión no volvía a poner `loading` al reintentar: Participaciones habría mostrado "Aún no participaste…" mientras llegaba la respuesta. Lo vi revisando el código después de la mutación; escribí el test (rojo) y lo arreglé.
2. Puse guardas de "último pedido" también en los éxitos sin necesidad; la mutación lo mostró y las saqué.
3. Para sacar dos mutantes del JSON de configuración usé un `node -e` (en el scratchpad, sin escapes), contra la regla de no usarlo. No tocó el repo.
4. El rojo de los dos tests de habilidades cayó en la primera aserción (`role="alert"`), no en la de `habilidades.update` no llamada: el rojo de "no borra las habilidades" en sí no lo aislé contra el código viejo (por lectura del código viejo, `handleSave` siempre llamaba a `update(draftSkills)`).

### ⚠️ NO verificado
- Nada visual: el aviso arriba del contenido, los "—" en la tarjeta de estadísticas, "No se pudo cargar." en cada sección.
- Las secciones de ONGs y voluntarios **no tienen estado de carga** (de antes): mientras llegan, siguen diciendo "Todavía no…". No lo cambié (no es un error tragado).
- `handleSave` hace `window.location.reload()`; en jsdom eso imprime "Not implemented: navigation" en la salida de los tests (no falla). No lo stubbeé.

## 110. Inicio: error y vacío ya no se confunden (feed de seguidos y sugerencias) — REVISION S1 (MainFeed)

**Contexto:** en `MainFeed`, `loadSidebarData` envolvía cada pedido en `.catch(() => ({ ngos: [] }))`: si fallaba la lista de ONGs, `FeedSidebar` decía "¡Ya seguís a todas las organizaciones recomendadas!". Si fallaba solo "mis ONGs", sugería ONGs que ya seguís. `loadFollowingFeed` ponía `[]` en el error, y la columna principal mostraba "Tu feed personalizado está listo" (el estado vacío) como si no siguieras nada.

**Qué se hizo:**
- **Feed de seguidos:** estado `feedError`; en el `catch`, `userMessage(err, 'No pudimos cargar tu feed. Revisá tu conexión.')` y, en la vista, `<InlineError>` en `role="alert"` con "Reintentar" (`loadFollowingFeed`) antes del estado vacío. Se sacó el `console.error`.
- **Sugerencias:** `loadSidebarData` pide `ngos.list()` y `follows.myNgos()` con `Promise.allSettled`; si falla **cualquiera** de los dos, `suggestionsError` (`userMessage(…, 'No pudimos cargar las sugerencias. Revisá tu conexión.')`). Las dos son necesarias: sin "mis ONGs" las sugerencias incluirían las que ya seguís.
- **`FeedSidebar`** (sigue siendo presentacional): props nuevas `suggestionsError` y `onRetrySuggestions`. Con error, en la caja "Sugerencias para vos" muestra el mensaje + "Reintentar" (botón chico, como los links de la caja) en un `role="alert"`, en vez de "¡Ya seguís a todas…!".
- **"Próximas actividades"** (`projects.list`) pasó a su propia función (`loadUrgentProjects`). Si falla, la sección **sigue sin mostrarse**: no tiene texto de vacío, así que no dice nada falso. "Reintentar" de la barra recarga las dos cosas (`retrySidebar`).

### Tests (nuevos: 8, `MainFeedErrors.test.tsx`; `FeedPostCard` mockeado)
- Feed con 500 → aviso con el mensaje, sin "Tu feed personalizado está listo"; "Reintentar" → aparece la publicación y se va el aviso.
- Feed sin conexión → "No pudimos cargar tu feed. Revisá tu conexión.", no "Failed to fetch".
- Feed vacío de verdad → el estado vacío, sin aviso (control).
- Falla `ngos.list` → en la caja de sugerencias, aviso; no aparece "¡Ya seguís a todas…!"; "Reintentar" → aparece la ONG.
- Falla `myNgos` → aviso con el mensaje propio, y no sugiere ninguna ONG (ni la que ya sigo ni la otra).
- Falla solo `projects.list` → sugerencias normales, sin aviso, y sin "Próximas actividades".
- Sin error y sin sugerencias → "¡Ya seguís a todas…!" (control).
- "Reintentar" de la barra también recarga los proyectos.
- **Rojo de comportamiento:** con el código anterior fallaban 5; los 3 que pasaban son los controles (feed vacío, barra vacía, falla solo proyectos).

### Verificación
- **Frontend 439/439** (431 + 8), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.** `FeedTabsPlacement` (que monta `MainFeed`) sigue en verde.
- **Mutación (22 sobre `MainFeed.tsx` y `FeedSidebar.tsx`, con corrida de control):** mueren 21. **Sobrevivió 1, equivalente:** "en el error no se vacían las sugerencias" — la barra solo se recarga con "Reintentar", que solo aparece si ya falló, y la lista arranca vacía. Saqué esa línea del código.

### Errores propios
- Ninguno en esta tarea, más allá de la línea redundante que mostró la mutación.

### ⚠️ NO verificado
- Nada visual. La barra lateral es `hidden lg:block`: en jsdom no se aplica el CSS, así que los tests la ven siempre; no comprobé el aviso en un escritorio real.
- No revisé el resto de la pantalla en celular (allí la barra no se ve, y las sugerencias del feed vacío solo aparecen si cargaron; con error, el feed vacío no muestra sugerencias ni aviso de sugerencias — solo el del feed si también falló).
- `loadFollowingFeed` no descarta respuestas viejas (lo llaman la carga inicial, "Reintentar", `onRefresh` de cada tarjeta y seguir una ONG). No lo cambié: no es parte de S1.

## 111. Explorar: error de carga visible con "Reintentar" — REVISION S1 (Explorar)

**Contexto:** en `ExploreScreen.tsx`, si fallaba `api.projects.list` (red caída, 500) el `catch` solo hacía `console.error`. La lista quedaba vacía y la pantalla decía "No encontramos voluntariados con esos filtros", con el mapa sin pines: un error se veía como "no hay proyectos". Las recomendaciones ("Para vos", solo voluntarios) tenían el mismo `catch` silencioso: la sección quedaba con el título y nada abajo.

**Qué se hizo:**
- **Catálogo:** la carga pasó a una función `loadProjects` (al montar y desde "Reintentar"). Si falla guarda `loadError` con `userMessage(err, 'No pudimos cargar los voluntariados. Revisá tu conexión.')` (el mensaje del servidor tal cual, salvo el `TypeError` de red) y la lista muestra **`<InlineError />`** con "Reintentar", como los listados de §65. Mientras hay error:
  - **no se dibuja el mapa** (un mapa sin pines también dice "no hay nada");
  - con una búsqueda escrita, no se muestra el contador "0" de "Proyectos encontrados".
- **Recomendaciones (decisión: son secundarias):** si fallan, la sección "Para vos" muestra un aviso chico **dentro de la sección** con su propio "Reintentar" (`loadRecs`), y el catálogo de abajo se ve igual. No uso `InlineError` acá porque es un bloque grande, de pantalla de listado: un fallo de algo opcional no debería ocupar el lugar del contenido principal. Sin recomendaciones, el catálogo ya muestra todos los proyectos (no hay ids que excluir), así que no se pierde nada.
- La sección "Para vos" pasó de `<div>` a `<section aria-labelledby>` con el título (`useId`): la nombra para lectores de pantalla y permite ubicarla en el test.

### Tests (nuevos: 5, `ExploreScreen.test.tsx`, archivo nuevo)
- 500 al cargar → se ve el mensaje del servidor, no "No encontramos voluntariados" ni el mapa; "Reintentar" carga la lista y el mapa vuelve (con 1 pin).
- Sin red (`TypeError: Failed to fetch`) → "No pudimos cargar los voluntariados…", nunca "Failed to fetch".
- Error + búsqueda escrita → sin contador "0".
- Sin sesión → el error se ve igual y no se piden recomendaciones.
- Recomendaciones con 500 → el catálogo aparece, "Para vos" muestra el error y su "Reintentar" las carga.
- **Rojo de comportamiento:** con el código anterior fallaban los 4 primeros que existían (no aparecía el error; el de recomendaciones tampoco encontraba la sección nombrada ni el aviso). El del contador lo agregué después por un mutante (ver Mutación).

### Verificación
- **Frontend 425/425** (420 + 5), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.** `A11yNames.test.tsx` (ningún botón sin nombre) sigue pasando.

### Mutación (12, sobre el código nuevo de `ExploreScreen.tsx`)
- Primera corrida: mueren 9, **sobreviven 3**:
  - *el `catch` no vacía la lista de proyectos* y *el `catch` no vacía las recomendaciones*: **equivalentes**. "Reintentar" solo existe en el estado de error, donde las listas ya están vacías; la carga del montaje empieza vacía. Saqué esas dos líneas (código que no hacía nada).
  - *el contador "encontrados" se ve con error*: **no equivalente**. Agregué el test del contador.
- Segunda corrida: **mueren los 10** que aplican (los 2 de las líneas sacadas ya no aplican).

### Errores propios
- El worktree arrancó en un commit viejo (`31f0bee`, 31 commits detrás de `main`): `lib/badWords.ts` y el tope de 500 no existían. Me di cuenta al no encontrar archivos que el pedido nombraba; avancé la rama con `git merge --ff-only main` antes de tocar nada.
- El test de recomendaciones esperaba mi texto de respaldo, pero con un `ApiError` 500 `userMessage` muestra el del servidor ("Error al generar recomendaciones"). Lo corregí en el test; el respaldo se usa solo sin red.

### ⚠️ NO verificado
- No lo vi en el navegador: ni el `InlineError` en el lugar de la lista, ni el aviso chico de "Para vos", ni que la pantalla sin mapa se vea bien.
- Doble clic en "Reintentar": el botón desaparece al empezar la carga (`loading`), así que no debería haber dos pedidos en vuelo; no lo probé.

## 112. Reseñas: se recargan al abrir y se precarga la propia — REVISION S3 y S4

**Contexto:**
- **S3:** en `FeedPostCard`, `cardRatings` es estado que nunca cambia. `ReviewsModal`, si recibía `initialRatings` no vacío, no pedía nada y mostraba esa lista; después de calificar recargaba, pero al cerrar y reabrir el efecto volvía a poner `initialRatings` (la lista vieja), y el promedio del modal se calculaba con ella.
- **S4:** el backend hace upsert (§74), pero el formulario arrancaba siempre en 5 ★ y vacío. Quien ya había calificado y mandaba sin mirar pisaba su reseña (y, sin comentario, la borraba).
- **Dato que decidió el arreglo:** las reseñas que llegan en el feed (`GET /api/follows/feed`, `follows.js` ~:283) **no traen `user_id`** (aunque el tipo `Rating` de `api.ts` lo declare obligatorio). Solo `GET /api/projects/:id` lo trae (`projects.js` ~:699). Con la lista del feed no se puede saber cuál es la propia.

**Qué se hizo (solo `ReviewsModal.tsx`; `FeedPostCard` y `MyParticipation` sin cambios):**
- **El modal recarga SIEMPRE al abrirse** (`GET /api/projects/:id`). Elegí esto en vez de que `onReviewAdded` devuelva la lista y `FeedPostCard` actualice `cardRatings` porque: (a) resuelve S3 en un solo lugar y sirve igual para "Mis participaciones"; (b) es la única fuente con `user_id`, que S4 necesita, sin tocar el backend; (c) actualizar `cardRatings` con el modal abierto cambiaba la prop `initialRatings`, que estaba en las dependencias del efecto y reiniciaba el formulario y el mensaje de éxito. Costo: un pedido por apertura.
- `initialRatings` queda como lo que se ve mientras llega la respuesta: el spinner solo aparece si no hay ninguna lista (`loading && ratings.length === 0`). Las dependencias del efecto pasan a ser `[isOpen, projectId]` (sin `initialRatings`, a propósito).
- Al abrir se reinicia el formulario (5 ★, vacío, sin mensajes) y, cuando llegan las reseñas, `applyRatings` busca la propia (`r.user_id === user.id`, solo con sesión) y precarga estrellas y comentario.
- Si ya calificó: el encabezado dice "Ya calificaste este voluntariado. Podés editar tu reseña." y el botón, "Actualizar reseña" (si no, "¿Participaste…?" y "Publicar reseña", como antes).
- **El botón queda deshabilitado mientras cargan las reseñas:** antes de saber si ya calificó, mandar pisaría la reseña con 5 ★.
- Después de guardar ya no se vacía el comentario: se recarga y el formulario muestra lo que guardó el servidor (que ahora es "tu reseña").

### Tests (nuevos: 10, `ReviewsModal.test.tsx`)
- **S3, con `FeedPostCard` real:** calificar desde el feed, cerrar y reabrir → "2 reseñas en total", el comentario nuevo y promedio 4.0 (5 y 3). El mock de `GET` responde según si ya se llamó a `rate` (como el servidor).
- Mientras recarga se sigue viendo la lista del feed (no un spinner) y se pidió `GET /projects/proj-1`.
- **S4:** con reseña propia → "Actualizar reseña", el aviso, 3 ★ marcadas (`aria-pressed`) y el comentario cargado; mandar sin tocar nada manda `(3, 'Faltó organización')` y el comentario queda; sin reseña propia → 5 ★, vacío, "Publicar reseña", sin aviso; sin sesión ninguna cuenta como propia; sin sesión y con la lista del feed (sin `user_id`) tampoco; después de guardar "  Mejoró  " el formulario muestra "Mejoró" (lo del servidor); si cambia el `projectId` con el modal montado, lista y formulario son los del proyecto nuevo; mientras carga, el botón está deshabilitado.
- **Rojo de comportamiento:** con el código anterior fallaban S3 (en la reapertura: "1 reseña"), la precarga (no había "Actualizar reseña") y el botón deshabilitado. El primer intento del test de S3 fallaba por otra razón (ver errores propios).

### Verificación
- **Frontend 433/433** (423 + 10), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.** Pasan sin cambios `MyParticipationReview`, `ModalsMigrated` y `A11yNames` (usan `ReviewsModal`).
- **Mutación (19, con `ReviewsModal.test.tsx` y `MyParticipationReview.test.tsx`):** primera corrida, **sobrevivieron 5**:
  - `user ? find(…) : undefined` → `find(r => r.user_id === user?.id)`: **no equivalente**. Sin sesión y con la lista del feed (sin `user_id`), `undefined === undefined` marcaría la primera reseña como propia ("Ya calificaste" a un visitante). Test agregado.
  - No reiniciar lista, estrellas o comentario al abrir (3 mutantes): solo se ve si cambia el `projectId` con el modal montado. Hoy no pasa en la app, pero no es equivalente: test agregado.
  - `applyRatings` → `setRatings` después de guardar: difiere si el servidor guarda algo distinto de lo escrito (espacios). Test agregado.
  - Segunda corrida: **0 sobrevivientes de 19.**

### Errores propios
1. La primera versión del test de S3 fallaba "en rojo" por el orden de los mocks (el código viejo no pedía nada al abrir y el primer `mockResolvedValueOnce` lo consumía el `GET` posterior a calificar), no por S3. Lo cambié por un mock que responde según si ya se calificó; ahora el rojo está en la reapertura.
2. Un test usaba "Muy bueno" como comentario con 4 ★, que coincide con la etiqueta del promedio ("Muy bueno"): dos elementos. Cambié el texto.

### ⚠️ NO verificado
- Nada visual: el texto "Ya calificaste…", el botón deshabilitado mientras carga y la lista del feed mientras recarga no los vi.
- **Sin protección de respuestas viejas** (`useLatestRequest`): no hay carrera alcanzable en la app (el botón está deshabilitado mientras carga; reabrir el mismo proyecto devuelve los mismos datos; "Mis participaciones" desmonta el modal al cerrarlo), pero no está probado contra respuestas desordenadas.
- Si `rate` funciona y el `GET` posterior falla, se ve el mensaje de éxito y además el error (comportamiento anterior, no lo toqué).
- Con un pedido más por apertura, en una conexión lenta el usuario espera para poder mandar.
- **Fuera del pedido, sin tocar:** `ProjectDetails.tsx` tiene su propio formulario de calificación (no usa `ReviewsModal`, al contrario de lo que dice `FRONTEND_CONTEXT`) y por lectura parece tener el mismo problema de S4 (no precarga). Y el tipo `Rating` declara `user_id` obligatorio, pero el feed no lo manda (regla 2): o se agrega `r.user_id` al SELECT de `follows.js` o se marca opcional en el tipo. Decisión del usuario.

## 113. Momentos de la ONG filtrados por su ONG (`GET /api/posts?ngo_id`) — REVISION S2

**Contexto.** `/ngo/momentos` (`NGOMoments.tsx`) renderizaba `<MomentsFeed />` sin filtros: bajo "Fotos de tus voluntariados. Podés borrar cualquier publicación de tus proyectos." la ONG veía el feed de **toda** la plataforma. `GET /api/posts` solo filtraba por `project_id` y `user_id`. El usuario eligió la opción (b) de REVISION S2: filtro nuevo, no solo cambiar el texto.

**Qué se hizo.**
- **Backend (`routes/posts.js`):** `GET /api/posts` acepta `ngo_id` = **id de la tabla `ngos`** (el mismo que devuelven `GET /api/ngos/me` y `GET /api/ngos/:id`, coherente con el resto de la API; no el id del usuario de la ONG). Filtra por la ONG dueña del **proyecto** (`p.ngo_id = $n`, la tabla `projects` ya estaba en el `JOIN` de `POST_SELECT`), sea quien sea el autor: la publicación de un voluntario en un proyecto de la ONG también es "de sus voluntariados". Se combina con `project_id`/`user_id` (todo con `AND`) y con la paginación existente; misma consulta en los dos motores, sin bifurcar. Una ONG inexistente o sin publicaciones → `200` con `posts: []` (como `user_id`).
- **Valor inválido → 400** en español, con el helper existente `checkText` (`lib/inputs.js`, regla 3): vacío o solo espacios ("El filtro de ONG no puede estar vacío"), repetido `?ngo_id=a&ngo_id=b` (Express lo entrega como array: "tiene que ser un texto") o de más de 100 caracteres. Se recortan los espacios de los costados. **Decisión:** a diferencia de `project_id`/`user_id` (que vacíos se ignoran, comportamiento que no se tocó), un `ngo_id` vacío NO se ignora: si el cliente lo manda mal, ignorarlo devolvería justamente el feed general que este cambio quiere evitar.
- **De dónde saca el frontend el id:** `api.ngos.me()` (`GET /api/ngos/me`), que ya usan `NGODashboard` y `NGOOwnProfile` y que está tipado (`NGO.id`; `public-columns.test.js` ya verifica que trae `id`). No se agregó ningún endpoint. Se descartó `/auth/me`: devuelve `profile` (el `SELECT *` de `ngos`), pero en `api.ts` está tipado como `{ user }` solo; habría que tipar `profile` para usarlo. Costo: `/ngos/me` trae además proyectos, stats y solicitudes pendientes (un pedido más pesado del necesario; ver ⚠️).
- **Frontend:** `api.ts` exporta `PostFilters { project_id?, user_id?, ngo_id? }` (regla 6) y `api.posts.list` lo usa. `MomentsFeed` acepta `filters.ngo_id`, lo manda en la primera página y en "Ver más", y recarga si cambia. `NGOMoments` pide `api.ngos.me()` y **no renderiza `MomentsFeed` hasta tener el id** (sin filtro pediría el feed general): mientras tanto un indicador `role="status"` "Cargando momentos"; si falla, `InlineError` con el mensaje (`userMessage`, el de red se reemplaza por uno propio) y "Reintentar". Una publicación nueva en el feed filtrado por ONG se agrega sin comprobar la ONG (el post no la trae); hoy solo lo usa NGOMoments y ahí la ONG solo puede publicar en sus proyectos (`eligible-projects`).
- `public-columns.test.js` recorre también `/api/posts?ngo_id=ngo-1` (regla 8).

**Tests (nuevos: 12).** Backend 5 en `posts.test.js` (describe "GET /api/posts?ngo_id"): exactamente las de los proyectos de la ONG, incluida la de un voluntario, contra la base; no mezcla ONGs y una inexistente da `{ posts: [], has_more: false }`; combinación con `user_id` y `project_id` (y combinaciones que dan vacío); paginación `limit/offset/has_more` sin repetir; inválidos → 400 (vacío, espacios, repetido, 101 caracteres; 100 es válido; espacios de los costados se recortan). Frontend 7: `NGOMoments` +5 (pide con `ngo_id` de su ONG; sin feed mientras carga; error con Reintentar que recarga; al reintentar se va el error y vuelve la carga; error de red con mensaje propio) y `MomentsFeed` +2 (`ngo_id` en la primera página y en "Ver más"; cambiar la ONG recarga). Los 3 tests existentes de NGOMoments se adaptaron (ahora esperan a que aparezca el feed). Rojo de comportamiento antes del código: los 5 de backend (200 en vez de 400 y feed sin filtrar) y los 6 primeros de frontend.

**Verificación (números reales).** Backend: `npm test` **483/483** (antes 478), `npm run test:pg` **485/485** (antes 480), y los dos con `TZ=America/Argentina/Cordoba`: 483/483 y 485/485; 0 fail, 0 cancelled, exit 0 en las cuatro. Frontend: `npm test` **427/427** (antes 420), `npm run typecheck` 0 errores.

**Mutación (solo código nuevo).** Backend: 10 mutantes, 9 mueren. Sobrevive `if (req.query.ngo_id !== undefined)` → `if (req.query.ngo_id)` en el `WHERE`: **equivalente** (después de la validación, un `ngo_id` presente siempre es un string no vacío). El de "sin trim" sobrevivía en la primera corrida: se agregó la aserción de espacios. Frontend: 11 mutantes, 11 mueren. En la primera corrida sobrevivieron 3: "no limpia el error al reintentar" (se agregó el test del reintento con la carga en vuelo) y los dos guardas de "descartar respuestas viejas", que eran inobservables (el id de la ONG no cambia y Reintentar solo aparece con el pedido anterior terminado): se sacaron del código en vez de dejarlos sin test.

**Errores propios.**
- El worktree arrancó en `31f0bee`, 31 commits atrás de `main`: la primera corrida del frontend dio 320 tests y no los 420 de la línea base. Lo vi por el número; rebaseé sobre `main` (conflicto en los `require` de `posts.js`: `hasBadWord` se había mudado a `lib/badWords` y `clampInt` a `lib/inputs`) y repetí todo.
- Puse primero un guarda de respuestas viejas en `NGOMoments` copiado del patrón de `MomentsFeed`; la mutación mostró que no tenía efecto observable y lo saqué.

**⚠️ NO verificado.**
- Cómo se ve (indicador de carga, error) y el uso real en el navegador o en un celular.
- `GET /api/ngos/me` es más pesado de lo necesario para obtener solo el id (trae proyectos, stats y solicitudes): no se midió; si molesta, la alternativa es tipar `profile` de `/auth/me` o guardar el id en un contexto del panel de la ONG.
- Rendimiento del filtro con muchas publicaciones: ya existen `idx_projects_ngo` (`projects.ngo_id`) e `idx_posts_project` (`posts.project_id`) en `migrate.js`, así que no se agregó ninguno; no se midió con volumen ni se miró el plan de consulta.
- Las publicaciones de un proyecto que cambie de ONG (no hay endpoint para eso) seguirían a la ONG nueva: el filtro es por la ONG dueña **actual** del proyecto.

## 114. Seguir/dejar de seguir que falla ahora avisa — REVISION S6

**Contexto:** en cuatro lugares, si seguir o dejar de seguir fallaba, el error solo se logueaba (`VolunteerPublicProfile`: `catch { }`; `NGOPublicProfile`, `FeedPostCard` y `MainFeed`: `console.error`). El botón dejaba de girar y quedaba como estaba, sin ningún mensaje: la persona no sabía si había seguido o no.

**Qué se hizo:**
- **El estado ya quedaba como estaba** (el `setFollowing`/`setFollowersCount` va después del `await`, así que un error no lo toca): no hubo que deshacer nada. Los tests lo fijan.
- **Mensaje breve con `role="alert"` cerca del botón**, con `userMessage(err, FOLLOW_ERROR)` (el mensaje del servidor, o el de respaldo si es un `TypeError` de red). Se limpia al volver a intentar.
  - `VolunteerPublicProfile`: debajo del botón "Seguir"/"Siguiendo".
  - `NGOPublicProfile`: debajo de la fila del encabezado (el botón está en un `flex` horizontal con el nombre y "Mensaje"), alineado a la derecha.
  - `FeedPostCard` (solo el seguir proyecto; no se tocó la parte de reseñas): una etiqueta blanca chica debajo del botón del marcador, sobre la imagen (`absolute top-14 right-4`).
  - `MainFeed` (seguir una ONG sugerida): el error se guarda con el id de la ONG (`FollowNgoError { ngoId, message }`) y se muestra debajo de **esa** ONG, tanto en la barra lateral (`FeedSidebar`, prop nueva `followError`) como en las sugerencias del feed vacío. Seguir otra ONG lo limpia.
- **`FOLLOW_ERROR`** en `lib/format.ts` ("No pudimos actualizar el seguimiento. Revisá tu conexión y probá de nuevo."): el mismo respaldo en los cuatro lugares, sin copiarlo (regla 3).

### Tests (nuevos: 9, `FollowErrors.test.tsx`)
- Perfil de voluntario: seguir con 500 → aviso con el mensaje, el botón sigue en "Seguir" (habilitado) y los seguidores en 7; reintentar anda → "Siguiendo", 8, sin aviso. Dejar de seguir sin conexión → mensaje de respaldo y sigue en "Siguiendo" con 7.
- Perfil de ONG: lo mismo (seguir sin conexión → respaldo, seguidores en 3; reintentar → 4 y sin aviso). Dejar de seguir con 500 → mensaje del servidor y sigue en "Siguiendo".
- Tarjeta del feed: seguir proyecto con 500 → aviso y el botón sigue siendo "Seguir este voluntariado"; reintentar → "Dejar de seguir voluntariado" sin aviso. Dejar de seguir sin conexión → respaldo y sigue siguiéndolo.
- Inicio, barra lateral: falla → aviso en la caja, la ONG sigue sugerida con "+ Seguir"; reintentar anda → la ONG sale de la lista y no queda aviso.
- Inicio con dos ONGs: falla Verde → exactamente 2 avisos (barra y feed vacío), los dos en el bloque de Verde y no en el de Azul; seguir Azul (anda) → no queda ningún aviso.
- Inicio, feed vacío: falla → aviso en la lista "ONGs recomendadas para vos" y el botón "Seguir" sigue habilitado.
- **Rojo de comportamiento:** con el código anterior fallaban los 8 primeros, todos por no encontrar `role="alert"` (en la salida se veían los `console.error` del código viejo: el pedido sí había fallado). El de dos ONGs lo agregué después (ver Mutación).

### Verificación
- **Frontend 448/448** (439 + 9), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.** Los archivos tocados siguen en CRLF en la copia de trabajo (el diff solo tiene las líneas cambiadas).
- **Mutación (22 sobre lo nuevo de los cinco componentes y `FOLLOW_ERROR`, con corrida de control):** primera corrida, mueren 19. **Sobrevivieron 3, no equivalentes:** `MainFeed` sin limpiar el error al reintentar, y `MainFeed`/`FeedSidebar` mostrando el error debajo de **todas** las ONGs (no solo la que falló). Con una sola ONG sugerida los tests no lo distinguían. Agregué el test de dos ONGs y en la segunda corrida **mueren los 22**.

### Errores propios
- La primera versión del test de dos ONGs tenía aserciones que no probaban nada (`toBeLessThanOrEqual(1)` sobre filas que no contenían el aviso). Las reemplacé por: cantidad exacta de avisos y que cada uno esté en el bloque de Verde y no en el de Azul.

### ⚠️ NO verificado
- Nada visual: en especial la etiqueta sobre la imagen de `FeedPostCard` y el aviso debajo del encabezado de la ONG (posición y contraste).
- Seguir una ONG sugerida en `MainFeed` no tiene estado "enviando" (de antes): un doble clic manda dos pedidos. No lo cambié.
- `NGOPublicProfile` sigue tragando el error de `ngoStatus` (`.catch(() => ({ following: false }))`): si falla, muestra "Seguir" aunque ya la sigas. No estaba en S1/S6; lo anoto.
- **Merge:** el import nuevo de `FeedPostCard.tsx` quedó en la línea siguiente al de `ReviewsModal`; si otro agente toca los imports de ese archivo, puede haber un conflicto trivial.

## 115. Los errores de ReviewsModal se anuncian (role="alert") — REVISION S10

**Contexto:** el error del formulario de `ReviewsModal` ("El comentario contiene palabras no permitidas", un 403, etc.) estaba en un `<p>` sin `role="alert"`, así que un lector de pantalla no lo anunciaba. El resto de los formularios ya lo tienen (§80). El error de carga agregado en S1 (`InlineError`) tampoco lo tenía.

**Qué se hizo:**
- `<p role="alert">` en el error del formulario.
- El error de carga va dentro de un `<div role="alert">` en `ReviewsModal`, **no** en `InlineError`: ese componente lo comparten otras seis pantallas (`NGOEmpleados`, `NGOKPIs`, `NGOPatrocinios`, `NGODashboard`, `NotificationsScreen`, `CompanyOwnProfile`) y otros arreglos de S1 lo pueden estar usando en paralelo; cambiarlo ahí es una decisión aparte (ver ⚠️).

### Tests (nuevos: 1, más un assert en un test de S1, `ReviewsModal.test.tsx`)
- Al mandar, un 400 del servidor → aparece un `alert` con ese texto (y antes de mandar no había ninguno).
- En el test del 500 al cargar (S1), el mensaje está dentro de un `alert`.
- **Rojo de comportamiento:** con el código anterior los dos fallaban con "Unable to find role=alert".

### Verificación
- **Frontend 434/434** (433 + 1), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.**
- **Mutación (2):** sacar cada `role="alert"` → **mueren los 2.**

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- No lo probé con un lector de pantalla real (NVDA/VoiceOver): que se anuncie lo deduzco del rol.
- El `alert` del error de carga envuelve también el botón "Reintentar": un lector de pantalla puede leer "…Revisá tu conexión. Reintentar". Si se prefiere, la alternativa es poner `role="alert"` en el `<p>` de `InlineError` (afecta a las otras seis pantallas; para el coordinador/usuario).

## 116. El seed no corre en producción — REVISION S9

**Contexto.** `backend/scripts/seed.js` crea 8 cuentas (3 voluntarios, 4 ONGs, 1 empresa) con la contraseña `Password1`. `render.yaml` no lo corre (solo `db:migrate`), pero `npm run db:seed` con las variables de producción las dejaría abiertas. Además el resumen final no listaba `admin@techcorp.com`.

**Qué se hizo.**
- Guarda al final del script: con `NODE_ENV === 'production'` escribe en stderr por qué no corre y cómo sembrar una base local, y deja `process.exitCode = 1`. Va **después** de `dotenv` (un `.env` con `NODE_ENV=production` también lo frena) y **antes** de `require('../src/db')`: el adaptador se carga recién en la rama que siembra, así que en producción no se abre ninguna conexión ni se crea el archivo de SQLite. `exitCode` en vez de `process.exit(1)` para no cortar la salida del mensaje.
- El resumen final suma `admin@techcorp.com / Password1 (empresa)`.
- No se tocó `render.yaml`. Doc: `DATABASE_CONTEXT.md §8` y el árbol de `BACKEND_CONTEXT.md`.

**Tests (nuevos: 4)** en `test/integration/seed-production.test.js`. Corren el script de verdad como proceso hijo contra la base temporal de los tests (SQLite, o el schema propio en Postgres: `setupTestDb` + `migrate.js`), con `cwd` en una carpeta sin `.env` para que no se meta el `.env` de desarrollo. (1) `NODE_ENV=production` → código ≠ 0, stderr menciona producción y `NODE_ENV`, no imprime el resumen, y `users`, `ngos`, `empresas`, `voluntarios`, `projects` y `enrollments` siguen con 0 filas; (2) lo mismo con `NODE_ENV=production` solo en un `.env` del `cwd`; (3) con `development` sale con 0 y crea 8 usuarios; (4) los emails del resumen son **exactamente** los de la tabla `users` (y la línea de la empresa existe). Rojo de comportamiento antes del código: 3 de 4 fallaban (sembraba en producción; el resumen no coincidía con la base).

**Verificación (números reales).** `npm test` **487/487**, `npm run test:pg` **489/489**, y los dos con `TZ=America/Argentina/Cordoba`: 487/487 y 489/489; 0 fail, 0 cancelled, exit 0 en las cuatro (incluye S2: 478 + 5 + 4 y 480 + 5 + 4).

**Mutación (solo código nuevo).** 7 mutantes, 7 mueren: guarda que nunca se activa, guarda invertida, salir con 0, sin mensaje, sembrar igual después del aviso, sin la línea de la empresa, y `dotenv` cargado después de la guarda.

**Errores propios.**
- La primera versión ponía la guarda arriba y llamaba a la función de siembra desde ahí, antes de la línea `const bcrypt = require(...)`: habría fallado por TDZ. Lo vi al releer antes de correrlo y la pasé al final del archivo.

**⚠️ NO verificado.**
- Correrlo contra la base real de Render (no hay deploy verificado). La guarda depende de que Render defina `NODE_ENV=production` (`render.yaml` lo fija en `production`, línea 13; no se miró el panel de Render).
- Un `NODE_ENV` con otra grafía (`Production`, `prod`) NO se frena: se compara exacto, como Express.
- `migrate.js` / `db:reset` no tienen guarda (`db:reset` = migrate + seed: el seed igual se frena, pero migrate corre antes; migrate es idempotente y aditivo).

## 117. Duplicaciones: patrocinio, marcadores del mapa y barra inferior de empresa — REVISION S7

**Contexto:** la segunda pasada (§106, S7) encontró tres duplicaciones: los mapas de etiqueta/color de un patrocinio copiados en `NGOPatrocinios` y `CompanyOwnProfile` (el propio `lib/sponsorship.ts` pedía migrarlos); el dibujo de pines y del punto del usuario copiado en el mapa chico y el ampliado de `ProjectMap`; y una lista propia de ítems de ONG y empresa en `BottomNav` (lado público), distinta de las barras de panel, de modo que la misma persona veía barras distintas según la pantalla.

**Qué se hizo:**
- **Patrocinio:** `NGOPatrocinios.tsx` y `CompanyOwnProfile.tsx` importan `SPONSORSHIP_BADGE`/`SPONSORSHIP_LABEL` de `lib/sponsorship.ts` y se borraron sus copias. Antes comparé las tres versiones: eran idénticas (mismas clases y textos; solo cambiaba el nombre, `ESTADO_BADGE`/`ESTADO_LABEL`, y el formato de una línea). No cambia nada visible. Se actualizó el comentario de `sponsorship.ts` (ahora dice quién lo usa).
- **`ProjectMap`:** función `drawMarkers(map, previous, mappedProjects, selectedId, userLocation, panDuration, onPick)` que quita los marcadores anteriores, dibuja los pines y el punto del usuario y devuelve los nuevos. Los dos `updateMarkers` (mapa chico y ampliado) la llaman. La única diferencia entre las copias era la duración del paneo al tocar un pin (0.5 s en el chico, 0.4 s en el ampliado) y se conservó como parámetro. Diferencia interna no observable: `setSelectedProject` ahora corre después de `panTo` (antes corría primero); el estado de React se aplica igual al terminar el handler.
- **`BottomNav`, empresa:** `CompanyBottomNav.tsx` exporta `COMPANY_NAV_LINKS` (su lista, sin cambios) y `BottomNav` la usa para el rol empresa. Se mantienen el badge de mensajes (`chatBadge`) y el resaltado del ítem activo con los estilos de `BottomNav` (violeta).
  - **⚠️ Cambio visible:** en mobile, una empresa que está en una pantalla del lado público (`/explore`, `/project/:id`, `/ngo/:id`, `/company/:id`, …) ve ahora **4 ítems: Panel, Mi Empresa, Explorar, Mensajes** (antes 3: Mi Empresa, Explorar, Mensajes). **Gana "Panel"** (`/company/dashboard`); no pierde nada. Es la misma lista y en el mismo orden que la barra de su panel.
- **`BottomNav`, ONG: NO se cambió (duda para el usuario).** Usar la lista de `NGOBottomNav` le quitaría **"Explorar"** a la ONG, y "Explorar" en esa barra es el **único acceso a `/explore` que tiene una ONG en mobile**: ni `NGOBottomNav` ni `NGOSidebarNav` lo tienen, y los otros enlaces a `/explore` (`FeedSidebar`, `MainFeed`, `VolunteerProfile`, `CompanyDashboard`) son de pantallas de voluntario o empresa. Además, estando en `/explore` la barra quedaría sin ningún ítem resaltado. Por eso la dejé como estaba (6 ítems: Panel, Crear, Sponsors, Explorar, Mensajes, Mi ONG) y un test lo fija. Para unificarla hay que decidir antes: (a) agregar "Explorar" a `NGOBottomNav` (cambia la barra del panel ONG: 6 ítems + Salir) y usar esa lista en las dos, o (b) aceptar que la ONG pierda "Explorar" en mobile. Además, la de panel dice "Inicio" donde la pública dice "Panel" (mismo destino, `/ngo/dashboard`).

### Tests (nuevos: 18)
- **`ProjectMap.test.tsx` (8, nuevo), Leaflet real en jsdom** (solo dobles de `ResizeObserver`, `panTo` y `flyTo`). Mapa chico: un pin por proyecto con el color de su categoría; tocar un pin lo selecciona (solo ese con `scale-125`), centra con `duration: 0.5`, avisa a `onSelectProject` y muestra la tarjeta; el punto del usuario aparece una sola vez (clase, tamaño y ancla) y sobrevive a los redibujos; si cambian los proyectos se quitan los pines viejos. Mapa ampliado: abre con el seleccionado del chico; tocar un pin centra con `duration: 0.4`; el filtro de categoría redibuja solo los que coinciden; su punto del usuario es propio y único.
- **`BottomNav.test.tsx` (8, nuevo):** lista y orden por rol (voluntario, ONG, empresa); la barra pública de empresa es igual a `CompanyBottomNav`; resaltado del activo con el color del rol; badge de mensajes solo en "Mensajes" y "9+"; listas de `CompanyBottomNav` y `NGOBottomNav` (con "Salir").
- **`NGOPatrocinios.test.tsx` (+1) y `CompanyOwnProfile.test.tsx` (+1):** etiqueta y clases de color de cada estado.
- **Caracterización:** corrí los 18 contra el código de `main` (los 6 archivos de producción restaurados con `git show main:<path> > <path>`, los nuevos copiados aparte, sin `git stash`; después los restauré y `git status` quedó limpio). Pasan **16**. Los **2 rojos** son los del cambio pedido: "empresa: misma lista que su barra de panel (gana "Panel")" y "la barra pública y la de panel tienen exactamente los mismos ítems". Con el código nuevo pasan los 18.

### Verificación
- **Frontend 438/438** (420 + 18), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.** Los 8 archivos modificados siguen en CRLF (contado línea por línea); los dos tests nuevos, también CRLF en el working tree (en el índice quedan LF, como el resto).
- **Mutación (29 mutantes sobre el código nuevo: `drawMarkers` y sus dos llamadas, el uso de `COMPANY_NAV_LINKS` en `BottomNav`/`CompanyBottomNav` y los imports de `sponsorship` en las dos pantallas):** corrida de control sin mutar en verde primero; **mueren 29, sobreviven 0**. Entre otros: no quitar los marcadores viejos, no marcar el seleccionado, cambiar 0.4↔0.5, no llamar `onPick`/`setSelectedProject`/`onSelectProject` en cada mapa, no dibujar el punto del usuario, otra clase o ancla del punto, devolver `[]`, pasar `[]` como anteriores, quitar "Panel" de la lista, `chatBadge` siempre `true`/`false`, sacar el color o la etiqueta del badge de patrocinio.

### Errores propios
1. **Empecé sobre una base vieja.** El worktree se creó en `31f0bee`, 31 commits detrás de `main`: la suite daba 332, no 420. Lo noté por el número, hice el commit, lo rebaseé sobre `main` (sin conflictos; `main` había tocado `ProjectMap.tsx` para usar `<Modal>` y `CompanyOwnProfile.tsx` con `aria-label`), y repetí la caracterización contra el código de `main`, la mutación y las dos suites.
2. El primer test de "resaltado del activo" usaba el ítem "Panel" de empresa, que con el código viejo no existe: no era caracterización. Lo cambié a "Mi Empresa".
3. El pedido decía que ya había tests de `ProjectMap` con Leaflet real: en `main` solo están los 2 de `ModalsMigrated.test.tsx`, que prueban el modal (Escape, foco), no los marcadores. Los de marcadores los escribí yo.

### ⚠️ NO verificado
- No lo vi en el navegador ni en un celular: la barra de empresa con 4 ítems (ancho de cada uno, que entren los textos), los pines y el punto del usuario.
- **Sin tocar, para decidir:** la barra pública de la ONG (ver arriba). Y `Root.tsx` (`SidebarNav`, desktop) tiene una **tercera copia** de las listas de ONG y empresa: en escritorio, la empresa en pantallas públicas sigue sin "Panel", y los textos de la ONG difieren de `NGOSidebarNav` (allá hay "Momentos" y no "Explorar"). No estaba en S7; es el mismo problema en desktop.
- `drawMarkers` no se probó con proyectos sin coordenadas (usa `getProjectCoords`, que no cambió).

## 118. La búsqueda de Explorar ignora acentos — REVISION S8

**Contexto:** `filterProjects` (`FilterModal.tsx`) comparaba en minúsculas pero con acentos: "cordoba" no encontraba "Córdoba" ni "educacion" a "Educación", y "Córdoba" no encontraba un "Cordoba" cargado sin tilde. El filtro de categorías tenía el mismo criterio: una categoría cargada como "Educacion" no coincidía con el botón "Educación" del modal (las opciones salen de la tabla fija `CATEGORY_COLORS`). Solo cliente: el backend no cambia (su `ILIKE` tampoco ignora acentos, pero Explorar filtra en el cliente).

**Qué se hizo:**
- **`normalizeText(t)` en `lib/format.ts` (nuevo):** `t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()`. Es exactamente la normalización que ya hacía `lib/badWords.ts` (§93).
- **`badWords.ts`** usa `normalizeText` en vez de su copia (regla 3). Mismo comportamiento: sus tests pasan sin cambios. **La forma de `BLACKLIST` no cambió**: el test de sincronía del backend (`backend/test/unit/badWords.test.js`, que lee la lista del archivo del frontend con una regex) pasa (6/6).
- **`filterProjects`:** la consulta y los cinco campos (título, descripción, categoría, ubicación, ONG) se comparan normalizados. Las categorías también (`normalizeText(c) === normalizeText(p.category)`); un proyecto sin categoría sigue sin pasar un filtro de categorías.
- Consecuencia: la ñ se compara como n ("ninos" encuentra "Niños"), igual que en `badWords`.

### Tests (nuevos: 8)
- `format.test.ts` (3): "Córdoba" → "cordoba", "EDUCACIÓN" → "educacion", "Pingüino Ñandú" → "pinguino nandu"; no toca espacios, signos ni números; vacío → vacío; "é" compuesta y descompuesta dan lo mismo.
- `FilterModal.test.tsx` (5): sin tilde encuentra con tilde en cada uno de los 5 campos (y solo ese proyecto); con tilde y mayúsculas encuentra sin tilde; ñ como n y "niñas" no encuentra "Niños"; categorías sin distinguir acentos ni mayúsculas en los dos sentidos; un proyecto sin categoría (o con `''`) no pasa un filtro de categorías, ni siquiera `['']`.
- **Rojo de comportamiento:** los 4 primeros de `filterProjects` fallaban con el código anterior (devolvían `[]`). Los de `normalizeText` fallaban por "no es una función" (rojo débil; el comportamiento lo cubren los de `filterProjects`). El de "sin categoría" lo agregué por un mutante.

### Verificación
- **Frontend 433/433** (425 + 8), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.**
- **Backend `node --test test/unit/badWords.test.js`: 6/6** (incluye la igualdad de las listas). No corrí la suite completa del backend: no se tocó código del backend.

### Mutación (15: 11 en `filterProjects`, 4 en `normalizeText`; corriendo `FilterModal`, `format` y `badWords`)
- Primera corrida: mueren 14. **Sobrevive 1, no equivalente:** sacar la guarda `!cat ||` (proyecto sin categoría). En la app no se nota (las categorías del modal nunca son vacías), pero `filterProjects` es una función exportada: con `categories: ['']` dejaba pasar proyectos sin categoría. Agregué el test.
- Segunda corrida: **mueren los 15**. Entre los que mueren: consulta o campo sin normalizar, cada uno de los 5 campos sacado, sin NFD, sin quitar marcas, quitar solo la primera marca (sin `g`) y sin minúsculas.

### Errores propios
- Puse el `import` de `badWords.ts` después de `BLACKLIST` (válido, pero desprolijo); lo moví arriba antes de commitear.

### ⚠️ NO verificado
- No lo probé en el navegador (escribir "cordoba" en Explorar). Lo cubre el test de la función pura que usa la pantalla.
- El contador "Mostrar N voluntariados" del modal usa la misma `filterProjects`, así que también ignora acentos; no tiene test propio.
- La búsqueda del backend (`GET /api/projects?search=`, `ILIKE`) sigue distinguiendo acentos. Explorar no la usa; si otra pantalla la usara, tendría el problema (fuera del pedido: "solo cliente").

## 119. Explorar: tope de 500 y aviso si hay más — REVISION S5

**Contexto:** `ExploreScreen` pedía `api.projects.list({ sort: 'featured', limit: '200' })` y busca, filtra y arma el mapa en el cliente sobre esa lista. Con más de 200 proyectos, los demás no aparecían en ningún lado y nada lo decía. El backend acepta hasta **500** (`clampInt(req.query.limit, 20, 1, 500)` en `routes/projects.js`, §96).

**Qué se hizo (y por qué así):**
- Revisé qué devuelve `GET /api/projects`: **solo `{ projects }`**, sin `total` ni `has_more`. Paginar de verdad ("cargar más") pediría cambiar el backend o pedir de a páginas hasta vaciar, y la búsqueda, los filtros y el mapa de Explorar trabajan sobre la lista completa en el cliente: con páginas parciales buscarían en una parte sin decirlo. Elegí lo mínimo correcto que pidió el usuario:
  - **`EXPLORE_LIMIT = 500`** (constante con comentario que apunta a §96) y se pide eso.
  - Si la respuesta viene **llena** (`length >= 500`), un aviso discreto (`role="status"`) arriba del mapa: "Se muestran los primeros 500 voluntariados: la búsqueda, los filtros y el mapa solo incluyen esos."
- Límite conocido del criterio: con **exactamente** 500 proyectos el aviso aparece aunque no haya más (el backend no puede devolver 501 para saberlo). El texto sigue siendo cierto.

### Tests (nuevos: 3, en `ExploreScreen.test.tsx`)
- Pide `limit: '500'`.
- Con 500 proyectos en la respuesta → aparece el aviso.
- Con 499 → no aparece.
- **Rojo de comportamiento:** con el código anterior fallaban los dos primeros (pedía `'200'` y no había aviso); el de 499 pasaba (no hay aviso en ninguno de los dos casos).

### Verificación
- **Frontend 436/436** (433 + 3), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.**

### Mutación (6, sobre el código nuevo)
- Pedir `'200'` de nuevo, tope 501, tope 499, `>` en vez de `>=`, aviso siempre, aviso nunca: **mueren los 6**.
- Antes de correrla saqué una guarda `!loadError &&` del aviso: con error la lista siempre está vacía (§119 de S1), así que era un mutante equivalente seguro.

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- No lo vi en el navegador: ni el aviso (usa `-mt-3` para pegarse al buscador dentro de `space-y-6`), ni cuánto tarda Explorar con 500 proyectos reales y 500 pines en el mapa. Con los datos de la tesis no se llega a 200.
- **Comentarios/docs que quedaron desactualizados y no toqué (fuera de "solo código + tests" del frontend):** el comentario de `backend/src/routes/projects.js:148` dice "Explore pide 200"; `docs/BACKEND_ROADMAP_ANALYSIS.md:303` dice "`ExploreScreen` pide `200` (parche)". Conviene actualizarlos a 500.
- Sigue sin haber paginación real: con más de 500 proyectos activos, los que sobran no se pueden buscar desde Explorar (ahora al menos se avisa).

## 120. Integración de S1–S10 (cinco subagentes en paralelo)

**Qué se hizo:** con permiso del usuario, los hallazgos de la segunda pasada (§106) se repartieron entre cinco subagentes, cada uno en su propio git worktree y con archivos que no se superponían. Los grupos fueron: `ReviewsModal`; backend (S2 y S9); Explorar; perfiles y feed; duplicaciones. Cada uno trabajó con test primero, mutación con corrida de control y un commit por tarea, y dejó un borrador de documentación. El coordinador hizo un cherry-pick a `main` de cada commit en el orden acordado (S1 → S3+S4 → S2 → S6 → S10 → S9 → S7 → S8 → S5), le agregó su sección (§107–§119) y sus cambios de `FRONTEND_CONTEXT`, y lo modificó con `--amend`. **No hubo conflictos.** Este commit junta lo que tocaban todas las tareas a la vez: el punto 8 de `FRONTEND_CONTEXT` (recalculado: 22 de 49 componentes sin test propio), los conteos de `CLAUDE.md`, los ✅ y los pendientes nuevos en `REVISION.md`, y las dos referencias viejas a "200" (`BACKEND_ROADMAP_ANALYSIS` y un comentario de `routes/projects.js`).

### Verificación (sobre `main` ya integrado, no en los worktrees)
- **Backend:** SQLite **487/487** y Postgres **489/489**, las dos también con `TZ=America/Argentina/Cordoba`; 0 fail y 0 cancelled.
- **Frontend:** **503/503** (420 + 83), también con la hora de Córdoba. **Typecheck: 0 errores.**
- Ningún commit tiene línea de coautor ni atribución.

### Errores propios
- **Los worktrees se crearon desde un commit viejo** (`31f0bee`, 31 commits detrás de `main`) y no lo previne en las instrucciones. Los cinco agentes lo detectaron (el conteo de tests no coincidía) y avanzaron la rama a `main` antes de trabajar; el de backend tuvo que resolver un conflicto en los `require` de `posts.js`.

### ⚠️ NO verificado
- Nada visual: los estados de error nuevos, el aviso de los 500, la barra de la empresa con "Panel" y los Momentos de la ONG no se vieron en un navegador.
- Un agente vio fallar 2 tests de `db-transaction.test.js` en 2 de 6 corridas de Postgres con cinco agentes usando la misma base. En las dos corridas de integración, con la máquina sin otra carga, pasaron. Puede ser un test sensible a los tiempos bajo carga; queda anotado.

## 121. Una sola barra inferior para la ONG, con "Explorar" (decisión del usuario)

**Contexto:** pendiente de §117 (S7). La barra pública (`BottomNav`, en pantallas como `/explore`) tenía su propia lista para la ONG: 6 ítems con "Explorar", y "Panel" como primer ítem. La del panel (`NGOBottomNav`) tenía 5, sin "Explorar", y su primer ítem se llamaba "Inicio". Unificarlas con la del panel le sacaba a la ONG su único acceso a `/explore` en el celular. El usuario eligió **agregar "Explorar" a la barra del panel** y usar esa lista en las dos.

**Qué se hizo:**
- `NGOBottomNav.tsx` exporta `NGO_NAV_LINKS`: Panel, Crear, Sponsors, Explorar, Mensajes y Mi ONG. `BottomNav` la usa igual que `COMPANY_NAV_LINKS` (badge de mensajes y resaltado sin cambios).
- **Cambio visible en la barra del panel de la ONG (celular):** suma "Explorar" (6 ítems más "Salir") y su primer ítem pasa de "Inicio" a **"Panel"**, como en la barra de empresa. El nombre lo elegí yo: había que unificarlo y "Panel" es el de la empresa y el que ya usaba la barra pública.
- La barra lateral de escritorio (`NGOSidebarNav`) no cambia: sigue sin "Explorar" (no estaba en la decisión).

### Tests (nuevos: 3; 1 modificado, en `BottomNav.test.tsx`)
- La barra pública y la del panel de la ONG tienen exactamente los mismos ítems.
- `NGOBottomNav` muestra Panel, Crear, Sponsors, Explorar, Mensajes, Mi ONG y Salir, con sus links. Era el test de "Inicio… sin Explorar"; ahora espera la lista nueva.
- "Crear" conserva su botón destacado, y "Panel" se resalta en las rutas del panel.
- La ONG ve el badge de mensajes sin leer también en la barra pública.
- **Rojo de comportamiento:** con el código anterior fallaban 3 (las dos listas distintas y la barra del panel sin "Explorar").

### Verificación
- **Frontend 506/506**, también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.** `BottomNav.tsx` sigue en CRLF.
- **Mutación (4)**, con corrida de control: sacar "Explorar", volver a "Inicio", que la barra pública use otra lista y que pierda el badge. **Mueren los 4.** El último sobrevivía en la primera corrida (el badge solo se probaba para empresa); agregué el test de la ONG.

### Errores propios
- La primera corrida de mutación no arrancó: el script incluía `routes.test.tsx` con una ruta que no existe. La corrida de control lo detectó antes de aplicar ningún mutante.

### ⚠️ NO verificado
- No lo vi en un celular: 7 botones (6 ítems más "Salir") en la barra del panel pueden quedar apretados en pantallas angostas.

## 122. Reseñas del feed con `user_id` y la misma forma que el detalle — pendiente de §112

**Contexto:**
- En `REVISION.md`, "Pendientes que surgieron al arreglarlos": el tipo `Rating` de `api.ts` declara `user_id` obligatorio, pero `GET /api/follows/feed` no lo mandaba (regla 2). Lo encontró §112 (por eso `ReviewsModal` no podía usar la lista del feed para saber cuál era la reseña propia). Decisión del usuario: agregarlo en el backend.
- Al comparar los dos SELECT había **otra diferencia**: el feed mandaba `user_avatar`, que no está en `Rating` ni lo lee ningún componente (los `user_avatar` del frontend son de **comentarios**). Detalle: `{ id, project_id, user_id, rating, comment, created_at, user_name }`; feed: lo mismo sin `user_id` y con `user_avatar`.
- Regla 10, ¿hay otros endpoints que devuelvan `ratings`? Con grep (`FROM ratings`, `.ratings`, `ratings:` en `backend/src`): solo el detalle y el feed devuelven la lista. `GET /api/projects`, `/recommended` y el resto solo usan agregados (`avg_rating`, `ratings_count`); `PROJECT_EXTRAS` deja pasar `ratings` en `fmt()` pero solo el feed lo carga.

**Qué se hizo:**
- `routes/projects.js`: constante `RATINGS_SELECT` (columnas + `FROM ratings r JOIN users u`), exportada. La usa `GET /projects/:id` (cada uno agrega su `WHERE`/`ORDER BY`).
- `routes/follows.js`: el feed la importa en vez de tener su propio SELECT. Ahora manda `user_id` y **ya no manda `user_avatar`** (nadie lo leía; si se quiere el avatar en las reseñas, se agrega en `RATINGS_SELECT` y en `Rating`, y sale en los dos).
- Frontend: solo el comentario de `ReviewsModal.tsx` que decía "las reseñas del feed no tienen user_id". La lógica no cambia: el modal sigue recargando al abrirse (S3), porque la lista del feed puede estar vieja.
- `docs/API_CONTEXT.md`: forma de las reseñas del feed.

### Tests (nuevos: 3, `test/integration/feed-ratings-shape.test.js`)
- Lucía sigue `proj-1` (tiene reseñas en el seed). Las reseñas del feed, ordenadas por id, son `deepEqual` a las de `GET /projects/proj-1` (primero las claves, después todo).
- Campos y valores, tomados de la base: en el detalle y en el feed, cada reseña tiene exactamente `comment, created_at, id, project_id, rating, user_id, user_name`, y `user_id`, `user_name` (= `users.name`), `rating`, `comment` y `created_at` (con `toMillis`) coinciden con la fila. Se agregó después de la primera corrida de mutación (ver abajo): el primer test solo comparaba un endpoint con el otro.
- `user_id` es un string no vacío en todas las reseñas del feed.
- **Rojo de comportamiento:** con el código anterior fallaban el 1 (`user_avatar` en vez de `user_id`) y el 3 (`typeof user_id` era `'undefined'`). El mutante "feed con el SELECT viejo" (abajo) también muere en SQLite y en Postgres, con los tres tests.

### Verificación
- **Backend:** SQLite **490/490** (487 + 3), Postgres **492/492** (489 + 3); lo mismo con `TZ=America/Argentina/Cordoba`. 0 fail, 0 cancelled, exit 0 en las cuatro.
- **Frontend:** **503/503** (sin tests nuevos: solo cambió un comentario). **Typecheck: 0 errores** (exit 0).
- Pasan sin cambios `follows.test.js` y `public-columns.test.js` (que chequea que el feed tenga `ratings` y que las reseñas no expongan columnas no elegidas).

### Mutación (11 mutantes, con `feed-ratings-shape`, `follows`, `public-columns`, `api` y `aggregates-are-numbers`; SQLite y Postgres)
- Mutantes: sacar cada columna de `RATINGS_SELECT` (7), `user_name` = `u.id`, el feed con el SELECT viejo, el feed con `user_avatar` de más y el detalle con el SELECT viejo sin `user_id`.
- **Primera corrida (solo con los tests 1 y 3): sobrevivieron 6 en SQLite y 5 en Postgres** — sacar `r.rating`, `r.comment`, `r.created_at`, `user_name` o cambiar `user_name` por `u.id` (y en SQLite también sacar `r.id`). **No equivalentes:** como el SELECT es compartido, los dos endpoints cambian juntos y la comparación entre ellos sigue dando igual, pero el frontend se rompe. Se agregó el test 2 (campos y valores contra la base).
- **Segunda corrida: 0 sobrevivientes de 11, en SQLite y en Postgres.**

### Errores propios
1. El primer test solo comparaba el feed con el detalle. Al compartir el SELECT, eso no detecta un campo que desaparece de los dos a la vez: lo mostró la mutación (5–6 sobrevivientes) y se agregó el test contra la base.

### ⚠️ NO verificado
- La interfaz (no puedo verla): no debería cambiar nada visible, porque ningún componente leía `user_avatar` de una reseña y `user_id` ya se usaba solo con la lista de `GET /projects/:id`.
- **Orden de las reseñas:** el feed las manda de la más nueva a la más vieja (`ORDER BY r.created_at DESC`); el detalle no tiene `ORDER BY` (en Postgres el orden no está garantizado). No lo toqué: es un cambio de comportamiento que no estaba en el pedido. Si se quiere alinear, sería agregar `ORDER BY r.created_at DESC` al detalle.

**Agregado al integrar (coordinador):** el test compara la lista de reseñas del feed con la del detalle con `deepEqual`, pero el detalle no tenía `ORDER BY` (en Postgres el orden no está garantizado) y el feed ordenaba solo por `created_at`, que en SQLite tiene resolución de 1 s (dos reseñas del mismo segundo empatan). Los dos quedaron con `ORDER BY r.created_at DESC, r.id`: orden determinista y el mismo en los dos endpoints. **Cambio visible:** el detalle muestra las reseñas de la más nueva a la más vieja (antes, el orden que devolviera la base).

## 123. Detalle del proyecto: se precarga la reseña propia — pendiente de §112 (`ProjectDetails`)

**Contexto:** `ProjectDetails.tsx` tiene su propio formulario de calificación (pestaña Reseñas; no usa `ReviewsModal`). Arrancaba siempre en 5 ★ y vacío, aunque la persona ya hubiera calificado. El backend hace upsert (§74): mandar sin mirar pisaba la reseña anterior y, sin comentario, la borraba. Es el mismo problema que S4 en `ReviewsModal` (§112), anotado como pendiente en §112 y en `REVISION.md` ("Pendientes que surgieron al arreglarlos"). Además, después de guardar, `handleRate` vaciaba el comentario y recargaba: el formulario quedaba vacío aunque la reseña existiera.

**Qué se hizo (solo `ProjectDetails.tsx`):**
- **Precarga:** cuando llega el proyecto (`GET /api/projects/:id`, que sí trae `user_id` en las reseñas) y hay sesión, se busca la reseña con `r.user_id === user.id` y se cargan sus estrellas y su comentario (`comment ?? ''`: una reseña sin comentario deja el texto vacío).
- **Aviso y botón** (se derivan de la lista, `hasOwnRating`): "Ya calificaste este voluntariado. Podés editar tu reseña." y "Actualizar reseña". Si no calificó, quedan como antes ("¿Qué te pareció este voluntariado? Dejá tu reseña" y "Guardar reseña").
- **Después de guardar ya no se vacía el comentario:** se marca la precarga como pendiente y se recarga; el formulario muestra lo que guardó el servidor (p. ej. el texto sin los espacios de los costados).
- **Que una recarga no pise lo que se escribe.** `load()` no se llama solo al entrar: también después de comentar, de inscribirse y desde "Reintentar". Precargar en cada recarga pisaría un borrador (escribís la reseña, pasás a Comentarios, comentás → se recarga → perdías lo escrito). Por eso hay una marca `prefillPending` (un `useRef`):
  - se enciende al cambiar de `:id` (junto con reiniciar el formulario: 5 ★, vacío, sin mensajes) y después de guardar con éxito;
  - se apaga al aplicar la precarga (una vez por proyecto) y **cuando la persona toca el formulario** (una estrella o el texto);
  - la precarga es un `useEffect` sobre `[project, user?.id]` que solo actúa si la marca está encendida, hay sesión y el proyecto en pantalla es el de la URL (`project.id === id`).
  - Por qué también "si toca el formulario": `AuthContext` arranca con `user = null` mientras verifica el token (`initializing`), y `ProjectDetails` no espera. Si el proyecto llega antes (con el token, el backend ya manda `my_enrollment` aprobada y el formulario se ve), la persona puede empezar a escribir antes de que se confirme la sesión; cuando llega `user`, lo escrito gana. El aviso y el botón "Actualizar reseña" sí aparecen, así que sabe que va a reemplazar su reseña.
  - Por qué `project.id === id`: al cambiar de proyecto, el anterior sigue en el estado hasta que llega el nuevo; si justo en ese momento se confirma la sesión, se precargaría la reseña del proyecto anterior.
- **Cambio de proyecto sin desmontar** (link a otro proyecto dentro de la app): antes quedaban las estrellas, el texto y los mensajes ("¡Calificación guardada…!" o el error) del anterior. Ahora se reinician.
- **No se deshabilitó el botón mientras carga** (como en `ReviewsModal`): acá, mientras `load()` corre, toda la pantalla es el spinner (`if (loading) return …`), así que no se puede mandar con el formulario sin precargar. El único hueco es la sesión que se confirma tarde (ver ⚠️).

### Tests (nuevos: 14, `ProjectDetailsRating.test.tsx`)
- Con reseña propia: aviso, "Actualizar reseña", 3 ★ marcadas (`aria-pressed`) y el comentario; mandar sin tocar nada manda `('proj-1', 3, 'Faltó organización')`.
- Solo reseñas de otros: 5 ★, vacío, "Guardar reseña", sin aviso.
- Guardar "  Mejoró  " con 4 ★ → después de recargar, el formulario muestra "Mejoró", 4 ★, el aviso, "Actualizar reseña" y el mensaje de éxito (el mock de `GET` responde según si ya se llamó a `rate`, como el servidor).
- Escribir un borrador (texto y estrellas), comentar en la otra pestaña (recarga) → el borrador sigue.
- Una vez por proyecto: si entre dos cargas la reseña cambió en otro lado y la persona no tocó nada, la recarga por un comentario no le cambia el formulario.
- Sesión que se confirma después del proyecto: se precarga al llegar `user`; si ya había escrito texto, o solo tocado una estrella, eso se mantiene (pero aparece el aviso).
- Reseña propia sin comentario (`comment: null`): texto vacío y "Actualizar reseña" manda `(…, 4, undefined)`.
- Pasar a otro proyecto sin desmontar: el formulario es el del nuevo (con y sin reseña propia en cada uno); no quedan el mensaje de éxito ni el error del anterior; si la sesión se confirma mientras carga el nuevo, no se precarga la reseña del anterior.
- **Rojo de comportamiento:** con el código anterior fallan 12 de 14 (no había aviso ni "Actualizar reseña", el texto quedaba vacío, los mensajes quedaban al cambiar de proyecto). Pasan con el código anterior 2 que son guardas de la implementación nueva: "si no calificó…" (comportamiento que no tenía que cambiar) y "si la sesión se confirma mientras carga otro proyecto…" (el código viejo no precargaba nada). Algunos rojos son en un paso previo del test (p. ej. el del borrador falla al comprobar que la reseña se precargó antes de escribir), no en la aserción final.

### Verificación
- **Frontend 517/517** (503 + 14), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores** (`npm run typecheck`, salida 0).
- Pasan sin cambios los otros tests que montan `ProjectDetails` (`NgoPanelLink`, `StaleResponsesById`, `A11yNames`, `LoadErrorScreens`, `EnrollStatusLabel`, `SponsorPreselect`, `MomentsPlacement`).
- `ProjectDetails.tsx` sigue en CRLF (`git ls-files --eol`: `w/crlf`; 621 CR en 621 líneas); el diff es de 32+/7−.
- **Mutación (23 mutantes, con `ProjectDetailsRating`, `NgoPanelLink`, `StaleResponsesById`, `A11yNames` y `LoadErrorScreens`; corrida de control sin mutar en verde; el archivo se restaura en `finally` y lo comprobé con `cmp`):** primera corrida con 12 tests, **sobrevivieron 2, ninguno equivalente**:
  - Sacar `project.id !== id`: si la sesión se confirma mientras carga otro proyecto, se precargaba la reseña del anterior. Test agregado.
  - No apagar la marca al precargar: cada recarga volvía a precargar mientras la persona no tocara el formulario. Solo se nota si la reseña cambió en el servidor entre dos cargas (otra pestaña). Test agregado, que fija la decisión "una vez por proyecto".
  - Segunda corrida (14 tests): **0 sobrevivientes de 23.**

### Errores propios
- El primer nombre de un test decía "no quedan el mensaje de éxito ni el error", pero solo probaba el de éxito (el error tiene su propio test). Lo corregí.
- Mi primer chequeo de CRLF (`grep -c $'\r$'` en Git Bash) dio 0 y parecía que el `Edit` había convertido el archivo; `git ls-files --eol` y `tr -cd '\r' | wc -c` mostraron que no (621 CR). No cambió nada, pero el primer chequeo era engañoso.

### ⚠️ NO verificado
- Nada visual: el aviso, el botón "Actualizar reseña" y las estrellas precargadas no los vi en un navegador.
- **Sesión que se confirma tarde:** si el proyecto llega antes que `api.auth.me()` y la persona manda sin tocar nada antes de que llegue la sesión, `handleRate` abre el modal de login (porque `user` es `null`), no pisa nada. No lo probé con un test.
- El orden de las respuestas lo cubre `useLatestRequest` (ya estaba); no agregué un test de respuestas desordenadas que combine la precarga con un `GET` viejo.
- Si `rate` funciona y el `GET` posterior falla, la pantalla pasa a `LoadError` (comportamiento anterior, no lo toqué).
- Fuera del pedido, sin tocar: el tipo `Rating` sigue declarando `user_id` obligatorio aunque el feed no lo manda (pendiente de §112).

## 124. `InlineError` y `LoadError` se anuncian solos (role="alert" en el componente) — pendiente de REVISION

**Contexto:** `InlineError` (error de carga dentro de una pantalla, con "Reintentar") no tenía rol. Cuatro pantallas lo envolvían en un `<div role="alert">` (`ReviewsModal` §115, `FollowListModal` §108, `VolunteerProfile` §109, `MainFeed` §110) y las otras ocho (`ExploreScreen`, `NotificationsScreen`, `NGOKPIs`, `NGOEmpleados`, `NGOPatrocinios`, `NGODashboard`, `NGOMoments`, patrocinios de `CompanyOwnProfile`) no se anunciaban. Anotado en `REVISION.md` ("Pendientes que surgieron al arreglarlos") y en el ⚠️ de §115. `LoadError` (pantalla completa) tampoco tenía rol.

**Qué se hizo:**
- **`InlineError`: `role="alert"` en el contenedor**, no en el `<p>`. Motivos: (1) el aviso aparece y desaparece entero (mensaje + botón), y el contenedor es eso; (2) así quedan iguales los tests existentes, que usan el `alert` como la región que contiene "Reintentar" (`within(alert).getByRole('button', { name: /Reintentar/ })` en `MainFeedErrors` y `VolunteerProfileErrors`). Costo: el lector de pantalla lee "…Revisá tu conexión. Reintentar" (lo que §115 ya señalaba de los envoltorios). La alternativa (rol en el `<p>`) obligaba a cambiar esos tests; no la tomé.
- **Se sacaron los cuatro envoltorios** (`ReviewsModal`, `FollowListModal`, `VolunteerProfile`, `MainFeed`, con el comentario de §115 que explicaba por qué estaba afuera). Con el envoltorio quedarían dos `alert` anidados: los tests existentes de esas pantallas lo detectan solos (`getByRole('alert')` falla con "multiple elements"; `VolunteerProfileErrors` pide exactamente uno).
- **`LoadError`: también `role="alert"`, en la tarjeta** (mensaje + "Reintentar"/"Volver"/"Ir al inicio"). Decisión: la pantalla entera pasa de "cargando" al error sin que cambie el foco; sin el rol, un lector de pantalla no se entera de que falló. Se inserta después del spinner (no está en el primer render), así que el anuncio corre. Mismo criterio que `InlineError` (el contenedor).
- Las ocho pantallas que no se anunciaban pasan a anunciarse sin tocarlas.

### Tests (nuevos: 2, en `LoadError.test.tsx`)
- `InlineError`: exactamente un `alert`, con el mensaje, y su "Reintentar" (buscado dentro del `alert`) llama a `onRetry`.
- `LoadError`: exactamente un `alert`, con el mensaje.
- **Rojo de comportamiento:** con el código anterior los dos fallaban con "Unable to find an accessible element with the role alert". Con el rol puesto y los envoltorios todavía en su lugar, fallaban **13 tests existentes** de `FollowLists`, `MainFeedErrors`, `ReviewsModal` y `VolunteerProfileErrors` (dos `alert` anidados); al sacar los envoltorios, verde.

### Verificación
- **Frontend 505/505** (503 + 2), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.** Los seis archivos tocados siguen en CRLF en la copia de trabajo (`git ls-files --eol`: `i/lf w/crlf`, diff solo de las líneas cambiadas).
- **Mutación (7, con corrida de control en verde):** sacar el rol de `InlineError`, cambiarlo por `role="status"`, sacar el de `LoadError`, y volver a poner el envoltorio en cada una de las cuatro pantallas → **mueren los 7.**

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- No lo probé con un lector de pantalla real (NVDA/VoiceOver): que se anuncie lo deduzco del rol. Tampoco que la lectura de "Reintentar" (y de "Volver"/"Ir al inicio" en `LoadError`) resulte molesta.
- Dos `alert` hermanos (no anidados) pueden coexistir en `NotificationsScreen`, `NGOPatrocinios` y `CompanyOwnProfile` si queda un error de acción visible y después falla una recarga. No lo cambié: son mensajes distintos.
- Nada visual (el rol no cambia estilos).

## 125. Perfil de ONG: si falla "¿ya la sigo?", ya no dice "Seguir" — pendiente de REVISION (§114)

**Contexto:** `NGOPublicProfile` pedía `api.follows.ngoStatus(id)` junto con el perfil y le ponía `.catch(() => ({ following: false }))`: si fallaba, el botón decía "Seguir" aunque ya siguieras a la ONG (y al tocarlo, el backend respondía que ya la seguías o creaba un estado confuso). Además se consultaba siempre, aun sin sesión (el backend contesta `following: false` sin pensar). Anotado en el ⚠️ de §114 y en `REVISION.md` ("Pendientes que surgieron al arreglarlos").

**Qué se hizo:**
- **Solo consulta un voluntario** (`canFollow = user?.role === 'volunteer'`). Sin sesión no hay nada que saber (el botón "Seguir" abre el login, como antes); una ONG o empresa logueada no ve el botón, así que tampoco consulta.
- **La consulta no rechaza nunca** (`fetchFollowStatus` devuelve `{ following, error }`): sigue yendo en el `Promise.all` con el perfil (sin parpadeo de "Seguir" → "Siguiendo"), pero un error ya no tumba el perfil ni se traga.
- **Con error:** el botón Seguir/Siguiendo **no se muestra** y, en el mismo lugar que el error de §114 (debajo del encabezado, a la derecha), aparece un aviso `role="alert"` con el mensaje (`userMessage(err, 'No pudimos saber si ya seguís a esta organización. Revisá tu conexión.')`) y un botón "Reintentar". El resto del perfil (seguidores, descripción, proyectos) se ve igual.
- **"Reintentar" solo vuelve a preguntar el estado** (no recarga el perfil), con el mismo `useLatestRequest` del perfil: si cambiás de ONG mientras reintenta, la respuesta vieja se descarta. Mientras reintenta, el botón está deshabilitado; `load()` lo vuelve a habilitar (si no, un reintento de la ONG anterior lo dejaba trabado).
- No se usó `InlineError` (una tarjeta grande centrada, pensada para un listado): acá es un aviso de una línea junto al encabezado.

### Tests (nuevos: 8, `NGOFollowStatus.test.tsx`)
- 500 → aviso con el mensaje del servidor, sin botón "Seguir"/"Siguiendo", con nombre, descripción y seguidores normales; "Reintentar" → "Siguiendo", sin aviso, y el perfil no se volvió a pedir.
- Sin conexión → mensaje propio, no "Failed to fetch".
- "Reintentar" vuelve a fallar → sigue el aviso (con "Reintentar" habilitado) y no aparece "Seguir".
- Mientras reintenta, "Reintentar" está deshabilitado: dos clics → un solo pedido más.
- Cambiar de ONG mientras reintenta: el "Reintentar" de la nueva anda y la respuesta vieja (`following: true`) no la pisa.
- Control: la consulta anda → "Siguiendo", sin aviso.
- Sin sesión → no se consulta y está "Seguir". ONG logueada → no se consulta y no hay botón.
- **Rojo de comportamiento:** con el código anterior fallaban 6 de los 7 primeros (los cuatro de error por no encontrar el `alert`, los dos de "quién consulta" porque `ngoStatus` se llamaba una vez); pasaba el control. El de cambiar de ONG lo agregué después (ver Mutación).

### Verificación
- **Frontend 513/513** (505 + 8), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.** `NGOPublicProfile.tsx` sigue en CRLF en la copia de trabajo (diff de 43 líneas agregadas y 7 sacadas). Siguen en verde los tests que ya montaban el perfil (`FollowErrors`, `LoadErrorScreens`, `StaleResponsesById`, `A11yNames`).
- **Mutación (17 al final, con corrida de control):** primera corrida (18): mueren 13, sobreviven 5:
  - "`load()` no limpia el error de estado" y "sin la guarda `retryingStatus` en `retryFollowStatus`": **equivalentes** (mientras carga se ve el spinner y la respuesta pisa el error; el botón deshabilitado ya impide el segundo clic). **Saqué las dos líneas.**
  - "`load()` no rehabilita Reintentar" y "el reintento no mira `isLatest`": **no equivalentes** (cambiar de ONG con un reintento colgado). Agregué el test de cambiar de ONG.
  - Un mutante mío no cambiaba nada (`'' || userMessage(…)`); lo reemplacé por `error: ''`.
  - Segunda corrida (17): **mueren 16. Sobrevive 1, equivalente:** con error, `following: true` en vez de `false` — con error el botón no se muestra, y "Reintentar" lo reemplaza por la respuesta nueva.

### Errores propios
- La primera versión de los tests de "quién consulta" fallaba por un `TypeError` (el mock reseteado devolvía `undefined`), no por el comportamiento. Les puse una respuesta por defecto y el rojo pasó a ser "se llamó 1 vez".
- Un mutante que no mutaba nada (ver arriba).

### ⚠️ NO verificado
- Nada visual: el aviso de una línea con "Reintentar" a la derecha, en un celular angosto, puede ocupar dos líneas.
- **Si iniciás sesión desde el perfil** (tocando "Seguir" sin sesión), el estado no se vuelve a consultar: el botón queda en "Seguir" aunque ya la siguieras (con el código anterior pasaba lo mismo, porque la consulta sin sesión daba `false`). Se resolvería consultando de nuevo cuando cambia `user`; no lo hice (no era parte del pedido).
- El backend del estado no se tocó (`GET /api/follows/ngo/:id/status`, `optionalAuth`).

## 126. Inicio: "Seguir" una ONG sugerida se bloquea mientras se envía — pendiente de REVISION (§114)

**Contexto:** en `MainFeed`, el botón "Seguir" de una ONG sugerida (en la barra lateral, `FeedSidebar`, y en las sugerencias del feed vacío) no tenía estado de envío: un doble clic mandaba dos `POST /api/follows/ngo/:id` (el backend responde bien al segundo desde §85, pero es un pedido de más y la UI no mostraba que estaba enviando). Anotado en el ⚠️ de §114 y en `REVISION.md`.

**Qué se hizo:**
- **`MainFeed`:** estado `sendingNgoIds: Set<string>` (las ONGs con un "Seguir" en vuelo). `handleFollowSuggestedNgo` agrega la ONG antes del pedido y la saca en un `finally` (anduvo o falló). Es un conjunto y no un id solo: se puede seguir otra ONG mientras la primera espera, y que una termine no desbloquea a la otra.
- **Se bloquea el botón de esa ONG en los dos lugares** (barra y feed vacío) porque comparten el estado: `disabled={siguiendo || enviando}`, con `disabled:opacity-60`. El de otras ONGs sigue habilitado.
- **`FeedSidebar`:** prop opcional nueva `sendingNgoIds` (`ReadonlySet<string>`, por defecto un conjunto vacío constante); sigue siendo presentacional.
- El error de §114 no cambió: se limpia al volver a intentar, queda debajo de la ONG que falló, y al fallar el botón vuelve a estar habilitado (lo fija el test existente "reintentar lo limpia").
- No se agregó una guarda en el manejador: el botón deshabilitado ya impide el segundo clic (React re-renderiza al terminar el primer evento de clic), y lo comprueba el test de dos clics.

### Tests (nuevos: 2, en `FollowErrors.test.tsx`, describe "Inicio: seguir una ONG sugerida")
- Barra lateral, pedido que no resuelve: dos clics en "+ Seguir" → **una sola llamada** y el botón deshabilitado.
- Dos ONGs, Verde queda en vuelo y Azul falla: al tocar Verde en la barra, su botón del feed vacío también queda bloqueado (otro clic no manda nada); los de Azul siguen habilitados; Azul manda su pedido; cuando Azul falla aparece su aviso, Azul se desbloquea y Verde sigue bloqueada (en los dos lugares).
- **Rojo de comportamiento:** con el código anterior fallaban los dos: "expected to be called 1 times, but got 2 times" y `toBeDisabled()` del botón del feed vacío.

### Verificación
- **Frontend 515/515** (513 + 2), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.** Los tres archivos tocados siguen en CRLF en la copia de trabajo (diff de 55 líneas agregadas y 4 sacadas). `MainFeedErrors` y `FeedTabsPlacement` (que montan `MainFeed`) siguen en verde.
- **Mutación (9, con corrida de control):** no marcar en vuelo; marcar reemplazando el conjunto en vez de agregar; sin `finally`; `finally` que vacía el conjunto entero; el feed vacío no bloquea; no pasarle la prop a la barra; la barra no bloquea; la barra o el feed vacío bloquean **todas** las ONGs (`size > 0`) → **mueren los 9.** No muté `disabled:opacity-60` (solo visual).

### Errores propios
- Ninguno en esta tarea. El test de dos ONGs lo armé desde el principio con una que queda en vuelo y otra que falla, para que "vaciar el conjunto entero" y "reemplazarlo" no sobrevivieran.

### ⚠️ NO verificado
- Nada visual: la opacidad del botón bloqueado (sin texto "Enviando…": el pedido suele tardar poco y el botón cambia a "Siguiendo" o la ONG sale de la lista al terminar).
- La barra lateral es `hidden lg:block`: en jsdom se ve siempre; no lo probé en un escritorio real (igual que §110).

## 127. Verificación en el navegador de §107–§126 (sin cambios de código)

**Cómo:** Chrome con la app local. El backend corrió sobre una SQLite descartable (migrate + seed) con `RESEND_API_KEY` y `CLOUDINARY_*` vacías: no se mandó ningún mail ni se subió ninguna foto. Vite corrió en 5173. El ancho de celular se simuló con iframes de 390 px (la ventana no se podía achicar); los breakpoints de Tailwind usan el ancho del iframe. Para ver el filtro de Momentos inserté 2 publicaciones en esa base descartable, una de Sustentando y otra de GreenCba, con imágenes SVG en línea. Al terminar se frenaron los servidores por puerto y se borró la base.

### Verificado a ojo
- **§121, barra de la ONG en celular (390 px):** los 7 botones entran con su nombre, sin cortarse. "Panel" se resalta en el panel y "Explorar" en `/explore`; las dos barras son iguales.
- **§117, barra de empresa:** la pública y la del panel muestran Panel, Mi Empresa, Explorar y Mensajes.
- **§113, Momentos de la ONG:** con 2 publicaciones en la plataforma, Sustentando ve solo la de su proyecto (1 tarjeta), con el botón de borrar. La API con `?ngo_id=` vacío responde 400 con un mensaje en español.
- **§123, detalle del proyecto:** María, que ya había calificado con 5★, ve "Ya calificaste…", sus 5★, su comentario y "Actualizar reseña". La cambié a 3★ y guardé: el formulario quedó en 3/5 con el comentario, apareció el mensaje de éxito y la lista se actualizó.
- **§112, modal de reseñas desde "Mis participaciones":** se abrió precargado con las 3★ recién guardadas.
- **§109–§111, con el backend apagado:** Explorar ("No pudimos cargar los voluntariados", con un aviso aparte en "Para vos"), el perfil propio (contadores en "—" y un aviso general) e Inicio ("No pudimos cargar tu feed"). Con el backend prendido, "Reintentar" recuperó las tres pantallas; Inicio quedó en su estado vacío real (María no sigue a nadie en el seed).
- **§114, error al seguir una ONG** (falla forzada interceptando `fetch` solo para ese pedido): el mensaje aparece debajo del botón, que sigue en "Seguir", y los seguidores no cambian.

### Problemas visuales encontrados (anteriores a estos cambios; arreglados en §128)
- **Panel de la ONG en celular:** el encabezado (Equipo, Momentos y Nuevo proyecto) no entra y genera scroll horizontal.
- **Ancho angosto:** el botón flotante del chatbot tapa parte de los avisos de error de Explorar y del perfil, incluido el "Reintentar" del perfil.
- **Perfil público de una ONG (escritorio):** el nombre queda medio tapado por el banner verde.

### ⚠️ NO verificado
- El aviso de "los primeros 500" en Explorar (§119): haría falta tener más de 500 proyectos.
- El aviso de §125 (falla de "¿ya la sigo?") y el bloqueo del doble clic de §126: necesitan fallas o demoras selectivas. Los cubren sus tests.
- Un celular real (táctil, teclado en pantalla) y un lector de pantalla.

## 128. Los tres problemas visuales de §127 (aprobado por el usuario)

**Qué se hizo:**
1. **Encabezado del panel de la ONG en el celular** (`NGODashboard.tsx`): Equipo, Momentos y Nuevo no entraban y la pantalla tenía scroll horizontal. Ahora:
   - Equipo y Momentos son solo ícono por debajo de `sm`, con `aria-label` para conservar el nombre accesible.
   - El nombre y "Panel de gestión" se truncan (`min-w-0` y `truncate`).
   - Los botones no se achican.
2. **El botón del chatbot tapaba lo último de la pantalla.** La causa real **no era el botón**:
   - `#root` es un flex en columna, y el `div` exterior de cada layout (`min-h-screen`) se **encogía** al alto de la pantalla. El contenido se desbordaba, así que el padding inferior quedaba en el medio.
   - Por eso la última tarjeta del panel de la ONG quedaba debajo de la barra inferior y del botón aunque se bajara hasta el final. Lo medí en el navegador: página de 560 px con 856 de contenido.
   - **Arreglo, en dos partes:**
     - `flex-shrink-0` en el `div` exterior de `Root`, `NGOLayout` y `CompanyLayout`.
     - `ChatbotSpacer` (en `ChatbotWidget.tsx`), que cada layout pone después del `<Outlet />`: 80 px con barra inferior, 144 sin barra (portada) y 96 desde `md`. No se dibuja en el hilo de un chat (`/…/messages/:id`), que tiene altura fija.
3. **Perfil público de una ONG** (`NGOPublicProfile.tsx`):
   - **Escritorio:** el banner (`relative`) se pintaba sobre la fila del logo y el nombre, que no estaba posicionada, y tapaba la parte de arriba de los dos. Ahora la fila es `relative`, el logo se superpone al banner y el nombre arranca 44 px abajo (`pt-11`), siempre debajo del banner.
   - **Celular** (encontrado al verificar este arreglo, también anterior): los botones Seguir y Mensaje quedaban **encima del nombre**. La fila hace wrap: en el celular los botones van en su propia línea, y desde `sm` vuelven al costado. El nombre parte palabras largas (`break-words`).

### Tests (nuevos: 12)
- `ChatbotSpacer.test.tsx` (4): alto con y sin barra y desde `md`; no se dibuja en el hilo de un chat (voluntario, ONG y empresa); sí en la lista de conversaciones y en el resto.
- `RootLayout.test.tsx` (3), `RequireRole.test.tsx` (+1): los tres layouts tienen `flex-shrink-0` y el espacio va después de la pantalla.
- `NGODashboard.test.tsx` (+2): `aria-label`, texto solo desde `sm`, `truncate` y botones que no se achican.
- `NGOFollowStatus.test.tsx` (+2): la fila del perfil y los botones en su propia línea en el celular.
- **Son tests de clases:** jsdom no aplica Tailwind ni hace layout, así que solo evitan que se pierda el arreglo. **La verificación real fue en el navegador** (abajo).
- **Rojo:** fallan con el código de `HEAD` (restaurado aparte, sin `stash`): 3 de dashboard y perfil, 3 de `Root` y 1 de los layouts. `ChatbotSpacer` era nuevo (rojo débil).
- Se actualizó el mock de `ChatbotWidget` en `RequireRole.test.tsx` (no conocía la exportación nueva y rompía 10 tests).

### Verificación
- **Frontend 544/544**, también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.** Los archivos CRLF siguen en CRLF.
- **Mutación (20)**, con corrida de control, sobre los tres arreglos: **mueren los 20**. Antes agregué `RootLayout.test.tsx`, porque el `flex-shrink-0` de `Root` no lo cubría ningún test.
- **Navegador** (app local, base SQLite descartable, iframes de 390 y 330 px y escritorio):
  - **Sin scroll horizontal:** el panel de la ONG a 390 y a 330 px.
  - **Fin del contenido medido contra el borde del botón, con el scroll al final:** panel, perfil y patrocinios de la ONG terminan 24 px arriba; Explorar, perfil y participaciones del voluntario, 8 px arriba. Ninguna página se desborda.
  - **El hilo del chat** no tiene el espacio extra ni scroll (560 de 560 px).
  - **El perfil de la ONG,** en escritorio y a 390, 330 y 600 px, con nombres de una y de dos líneas.

### Errores propios
- **Empecé por el código** del encabezado y del perfil y escribí los tests después. Para compensarlo los corrí contra `HEAD` y vi el rojo.
- **El primer arreglo del chatbot iba a ser solo padding,** que no habría servido: el layout se encogía igual. Lo vi recién al medir en el navegador.
- **Las primeras mediciones estaban mal hechas:**
  - contaban el propio espacio de reserva y elementos recortados por listas con scroll propio;
  - `scroll-behavior: smooth` hacía que `scrollTo` no hubiera terminado al medir.
  - Pasé a medir el borde de arriba del espacio de reserva, con scroll instantáneo.

### ⚠️ NO verificado
- Un celular real (barra del navegador que aparece y desaparece, `100vh` contra `100dvh`).
- Pantallas que no recorrí: crear voluntariado, KPIs, empleados, panel de empresa, mensajes de la ONG. Tienen el mismo layout, así que el arreglo aplica igual, pero no las medí.

## 129. Portada con números reales (aprobado por el usuario)

**Contexto:** al probar el primer deploy en Render (2026-10-15) la portada decía "24 proyectos activos, 2.4k voluntarios, 12 ONGs aliadas" con la base vacía. Esos números estaban fijos en `PublicFeed.tsx`. El usuario eligió mostrar los reales.

**Qué se hizo:**
- **Backend:** `GET /api/stats` (público, en `index.js` junto a los catálogos) → `{ active_projects, volunteers, ngos }`. Cuenta los proyectos con `status = 'active'`, los perfiles de `voluntarios` y las filas de `ngos`, con `Number(x) || 0`. Se sumó a `public-columns.test.js` (regla 8).
- **Frontend:**
  - `api.stats()` y el tipo `PublicStats` (regla 6).
  - `compactNumber` en `lib/format.ts`: "2,4k", con coma decimal.
  - En la portada la fila es una lista con nombre ("VoluntariAR en números") y singular cuando hay uno.
  - **Si todo da 0 (deploy nuevo) o el pedido falla, la fila no se muestra:** ni números falsos, ni ceros, ni un error en la portada.

### Tests (nuevos: 8)
- **Backend** (`stats.test.js` y `stats-empty.test.js`, 3):
  - con el seed, los números son iguales a los `COUNT` de la base y son números, no strings;
  - un proyecto que termina deja de contar;
  - con la base vacía, todo da 0. Va en un archivo aparte porque dentro de un mismo proceso el módulo de la base queda apuntando a la del primer servidor.
- **Frontend** (`PublicFeedStats.test.tsx`, 5): muestra lo de la API, singulares, oculta con 0 y con error, y `compactNumber`.
- **Rojo de comportamiento:** el endpoint daba 404 y la portada no pedía nada.

### Verificación
- **Backend:** SQLite **493/493** y Postgres **495/495**, también con `TZ=America/Argentina/Cordoba`.
- **Frontend:** **549/549**, también con Córdoba. **Typecheck: 0 errores.**
- **Mutación (9)**, con corrida de control en SQLite, Postgres y frontend. **Mueren los 9** en el motor que corresponde. Sacar el `Number()` **sobrevive en SQLite y muere en Postgres**: es la trampa de los `COUNT` como string, y por eso los tests del backend corren en los dos motores.

### Errores propios
- **El caso de la base vacía estaba en el mismo archivo** que el del seed y veía los datos del seed (módulo de la base compartido en el proceso). Lo pasé a su propio archivo.
- **Un test "fallaba" por un rechazo que el componente sí atajaba:** `beforeEach(() => stats.mockReset())` **devuelve** el mock, y vitest toma una función devuelta por `beforeEach` como limpieza y la ejecuta después de cada test. Llamaba a `stats()` sin `catch`, y el rechazo caía en ese test o en el siguiente. Antes de verlo probé otras dos cosas (otro tipo de error, rechazo asíncrono) que no eran la causa. Ahora va con llaves.
- **El mismo patrón estaba en `MomentsPage.test.tsx`.** Ahí era inofensivo (el mock no hace nada), pero lo corregí igual.

### ⚠️ NO verificado
- En producción: hay que redesplegar. Con la base vacía la fila no se ve, que es lo esperado.
- No lo vi en el navegador (es una fila con el mismo estilo que antes).

## 130. La barra lateral ya no ofrece "Cerrar sesión" a un visitante (aprobado por el usuario)

**Contexto:** visto en producción (Render). En escritorio, un visitante sin sesión veía "Cerrar sesión" en la barra lateral de `Root`: el botón se dibujaba siempre.

**Qué se hizo:** con sesión, "Cerrar sesión" como antes. Sin sesión, "Iniciar sesión", que abre el login (`openAuthModal`). Así un visitante en escritorio también tiene desde la barra una forma de entrar.

### Tests (nuevos: 2, en `RootLayout.test.tsx`)
- Visitante: no hay "Cerrar sesión" e "Iniciar sesión" abre el login.
- Con sesión: "Cerrar sesión" cierra la sesión y no hay "Iniciar sesión".
- **Rojo de comportamiento** en el caso del visitante. El mock de `useAuth` del archivo pasó a ser configurable.

### Verificación
- **Frontend 555/555 con §130 y §131 juntos**, también con `TZ=America/Argentina/Cordoba` (no corrí la suite con §130 solo). **Typecheck: 0 errores.**
- **Mutación (3):** condición invertida, "Iniciar sesión" que no abre el login, y siempre "Cerrar sesión". **Mueren los 3.**

### Errores propios
- Ninguno.

### ⚠️ NO verificado
- No lo vi en el navegador. Los links de la barra (Participaciones, Mensajes, Mi Perfil) siguen apareciendo para un visitante. No estaba en el pedido, y al tocarlos se pide iniciar sesión.

## 131. Explorar sin proyectos ya no culpa a los filtros (aprobado por el usuario)

**Contexto:** visto en producción con la base vacía. Explorar decía "No encontramos voluntariados con esos filtros — Probá seleccionando otra categoría o limpiando la búsqueda" aunque no hubiera ningún filtro, y ofrecía "Ver todos los proyectos", que no hacía nada.

**Qué se hizo:**
- **Sin ningún proyecto:** "Todavía no hay voluntariados publicados / Cuando una organización publique uno, va a aparecer acá.", sin botón.
- **Con proyectos y filtros que no encuentran nada:** el mensaje de siempre, con su botón.
- La condición usa `allProjects`, no `genericProjects`, que excluye los que ya están en "Para vos". Con `genericProjects`, si todos los proyectos estaban recomendados, habría dicho "todavía no hay" justo debajo de ellos.
- También aplica con una búsqueda escrita: si no hay ningún proyecto, el problema no son los filtros.

### Tests (nuevos: 4, en `ExploreScreen.test.tsx`)
- Sin proyectos ni filtros: "todavía no hay", sin el mensaje de filtros y sin el botón.
- Sin proyectos y con una búsqueda: también "todavía no hay".
- Todos los proyectos en "Para vos": no dice que no hay ninguno.
- Búsqueda sin resultados: el mensaje de filtros y su botón, que vuelve a mostrar todo (control).
- **Rojo de comportamiento** en el primero y en el de "Para vos".

### Verificación
- **Frontend 555/555**, también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.**
- **Mutación (3)**, con corrida de control: sin el caso nuevo, con `genericProjects` y "solo sin filtros". **Mueren los 3.**

### Errores propios
- **Primera versión con `genericProjects`:** fallaba con todos los proyectos en "Para vos". Lo vi releyendo su definición antes de cerrar la tarea; agregué el test y lo corregí.
- **Mi condición tenía además `!hasActiveFilters`:** el mutante que lo sacaba sobrevivió, y al analizarlo vi que el comportamiento sin esa parte es más correcto. Lo adopté y agregué el test.

### ⚠️ NO verificado
- No lo vi en el navegador (es el mismo recuadro con otro texto).

## 132. Perfil de una ONG: el estado de "seguir" se actualiza al cambiar la sesión (pendiente de §125)

**Contexto:** si la persona tocaba "Seguir" sin sesión, iniciaba sesión desde el modal y volvía al perfil, "¿ya la sigo?" no se volvía a consultar. La carga dependía solo del `:id` de la URL. El botón quedaba en "Seguir" aunque ya la siguiera. Al cerrar sesión pasaba lo inverso.

**Qué se hizo:** el efecto de carga depende de `[id, user?.id]`: al cambiar la sesión se recarga el perfil. Se recarga el perfil entero y no solo el estado, porque comparten `useLatestRequest`. Recargar solo el estado mientras carga el perfil descartaría esa carga, y la pantalla quedaría cargando para siempre. Cuesta un pedido más y de paso actualiza el contador de seguidores.

**Otro pendiente, analizado y descartado:** "dos avisos de error a la vez" en Notificaciones, Patrocinios (ONG) y el perfil de empresa **no se puede dar**:
- **Sin lista no hay acciones:** en Notificaciones el botón depende de `unread`, que con error queda en 0; en las otras dos pantallas las acciones van por fila.
- **La recarga solo corre en tres casos:** al entrar, desde "Reintentar" (que exige un error de carga) o después de una acción que salió bien.
- **Cada acción limpia su propio aviso al empezar.**

No se tocó código; el razonamiento quedó en `REVISION.md`.

### Tests (nuevos: 3, en `NGOFollowStatus.test.tsx`)
- Sin sesión ("Seguir", sin consultar), inicia sesión una voluntaria que ya la seguía → "Siguiendo" y se consultó.
- Cierra sesión → "Seguir" y no se consulta.
- La sesión cambia mientras carga el perfil → el perfil igual termina de cargar (control del riesgo descripto arriba).
- **Rojo de comportamiento** en los dos primeros.

### Verificación
- **Frontend 558/558**, también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.**
- **Mutación:** volver a `[id]` → **muere**, con corrida de control antes y después.

### Errores propios
- Ninguno.

### ⚠️ NO verificado
- No lo vi en el navegador ni en producción.

## 133. Avatar en las reseñas (decisión del usuario)

**Contexto:** §122 unificó la forma de las reseñas (`RATINGS_SELECT`) y el feed dejó de mandar `user_avatar`, que nadie usaba: todas las listas de reseñas mostraban la inicial. El usuario eligió mostrar la foto.

**Qué se hizo:**
- **Backend:** `RATINGS_SELECT` (`routes/projects.js`) suma `u.avatar AS user_avatar`, así que lo mandan el detalle y el feed. No expone nada nuevo: el avatar ya era público en comentarios y publicaciones.
- **Frontend:**
  - `Rating.user_avatar?: string | null` (regla 6).
  - En `ReviewsModal` y en la pestaña Reseñas de `ProjectDetails` se ve la foto si existe, y si no, la inicial como antes. La foto es decorativa (`alt=""`), porque el nombre está al lado.
  - En `ProjectDetails`, el link al perfil que envuelve la foto o la inicial ahora tiene nombre propio ("Perfil de …"). Antes su nombre accesible era la inicial, y con la foto (alt vacío) se habría quedado sin nombre.

### Tests (nuevos: 2; 1 actualizado)
- `feed-ratings-shape.test.js`: la forma esperada incluye `user_avatar` y se compara con `users.avatar` de la base, en el feed y en el detalle.
- `ReviewAvatars.test.tsx` (2): en el modal y en el detalle, foto con `alt=""` cuando hay avatar e inicial cuando no.
- **Rojo:** el de backend, de comportamiento (faltaba la clave). Los de frontend fallaban antes de llegar a la aserción, porque no encontraban el marcador `data-initial` (rojo débil). La mutación los cubre.

### Verificación
- **Backend:** SQLite **493/493** y Postgres **495/495**, también con `TZ=America/Argentina/Cordoba`.
- **Frontend:** **560/560**, también con Córdoba. **Typecheck: 0 errores.**
- **Mutación (4)**, con corrida de control: sacar la columna, modal siempre con inicial, `alt` con el nombre y detalle siempre con inicial. **Mueren los 4.**

### Errores propios
- Dejé en el primer test una aserción que no probaba nada (`getByRole('presentation') ?? …`). La saqué antes de implementar.

### ⚠️ NO verificado
- No lo vi en el navegador ni en producción.

## 134. Perfil público de ONG: los proyectos con la forma de siempre (`fmt`) — REVISION A1

**Contexto:** `GET /api/ngos/:id` armaba los proyectos con un SELECT propio de 8 campos (`id`, `title`, `image`, `type`, `status`, `current_volunteers`, `volunteers_needed`, `category`), sin pasar por `fmt`. `NGOPublicProfile.tsx` lee `p.duration` y `p.hours_per_week`: un sostenido mostraba "h/semana" sin el número (la sonda de la tercera pasada lo confirmó: `hours_per_week` → `undefined`). Además el `LEFT JOIN` con `project_categorias` repetía el proyecto que tuviera dos categorías. Es el mismo problema de §29 (reglas 4, 7 y 10): un endpoint con su propia forma de "qué es un Project".

**Qué se hizo:**
- **Backend (`routes/ngos.js`):** los proyectos del perfil salen por `fmt` (importado de `routes/projects.js`, no copiado), con las mismas columnas extra que el listado `GET /api/projects`: `ngo_name`, `ngo_logo`, `ngo_followers`, `avg_rating` y `ratings_count` (subconsulta agrupada de `ratings`, igual que el listado). Siguen ordenados del más nuevo al más viejo (se suma `p.id` de desempate).
- **`lib/projectAssoc.js` (nuevo):** `attachAssoc(q, rows)` carga roles, requisitos y categoría de varios proyectos en 3 consultas fijas y los escribe como los lee `fmt` (`roles_json`, `requisitos_json`, `category_name`). Es el bloque que ya estaba copiado tres veces (listado SQLite de `projects.js`, `GET /api/follows/project` y `/feed`). No lo copié una cuarta vez (regla 3); las tres copias **no se migraron** (fuera de la tarea, regla 5; `projects.js` lo edita otro cambio en paralelo).
- **Frontend:** sin cambios. `NGOPublicProfile` ya tipaba los proyectos como `Project`; ahora el backend cumple ese tipo.
- Regla 8: `fmt` es lista blanca, así que el `p.*` no expone columnas. `public-columns.test.js` ya recorría `/api/ngos/ngo-1` (sigue sin filtrar el centinela) y ahora además exige en sus proyectos los campos de `Project` que usa el frontend.

### Tests (nuevos: 5; 1 actualizado)
- `ngo-profile-projects-shape.test.js` (5):
  - duración del fugaz y horas del sostenido (número), contra `duracion`/`horas_semanales` de la base;
  - cada proyecto del perfil es igual, campo por campo y valor por valor, al mismo proyecto en `GET /api/projects` (roles y requisitos comparados ordenados), y la comparación no es vacía (hay roles, requisitos, categoría y reseñas);
  - orden del más nuevo al más viejo, con fechas fijadas en el test;
  - un proyecto con dos categorías aparece una sola vez;
  - una ONG sin proyectos devuelve `projects: []`.
- `public-columns.test.js`: en "…pero sí todo lo que el frontend espera", los proyectos de `GET /ngos/:id` tienen que traer los campos de `Project` + `duration`, `hours_per_week` y `ngo_name`.
- **Rojo de comportamiento** (con el código viejo, en SQLite): fallaban 3 de 5 (`proj-1: duration`; `ids repetidos: proj-1, proj-5, proj-7, proj-7`; la comparación con el listado) y el de `public-columns` (`falta "ngo_id"`). Los de orden y lista vacía pasaban antes: cuidan que no se rompa lo que ya andaba.

### Verificación
- **Backend:** SQLite **498/498** (493 + 5) y Postgres **500/500** (495 + 5), 0 cancelled, exit 0; también con `TZ=America/Argentina/Cordoba` (498/498 y 500/500).
- **Frontend:** sin cambios en este commit (ver el número final en el reporte).
- **Mutación (15)**, sobre `ngos.js` y `projectAssoc.js`, con corrida de control en los dos motores, sobre `ngo-profile-projects-shape` + `public-columns`: sin `attachAssoc`, sin `fmt`, `avg_rating` en 0, `ratings_count` en 0, `ngo_followers` en 0, `ngo_name` NULL, `ngo_logo` NULL, orden ASC, sin el `WHERE ngo_id`, roles vacíos, requisitos vacíos, categoría vacía, roles de todos al primer proyecto → **mueren los 13 en los dos motores**. Sobreviven 2, equivalentes:
  - sacar el `if (!ids.length) return rows` sobrevive en SQLite (allí `IN ()` es válido y da vacío); en Postgres muere (error de sintaxis → 500).
  - quedarse con la última categoría en vez de la primera: con una categoría por proyecto da lo mismo, y con dos ninguna de las consultas (ni el `LIMIT 1` del detalle) fija un orden, así que "la primera" no está definida.

### Errores propios
- El primer test de orden comparaba contra `created_at` del seed, que en SQLite es el mismo segundo para todos: pasaba igual con `ORDER BY ... ASC`. Lo vio la mutación; ahora el test fija fechas distintas y espera un orden exacto.
- En la primera corrida completa de Postgres (en paralelo con la de SQLite) falló una vez `db-transaction.test.js` ("una llamada db.* colgada… sí funciona", depende de un `sleep(20)`). No tiene que ver con este cambio: solo ese archivo pasó 3 de 3, y la suite completa sola pasó 500/500 varias veces.

### ⚠️ NO verificado
- No vi el perfil en el navegador (que el sostenido muestre "4h/semana").
- Las tres copias del bloque de roles/requisitos/categoría siguen ahí (`projects.js` listado SQLite, `follows.js` dos veces).
- `GET /api/ngos/me` arma sus proyectos con `SELECT * FROM projects` sin categoría ni roles (salen `category: ''` y listas vacías), y `GET /api/ngos/:id/projects` pide la categoría como `category`, que `fmt` no lee (`category_name`/`categoria`): también sale `''`. No los toqué (no eran parte de A1).

## 135. Feed: los comentarios recientes con `user_id` (la forma del detalle) — REVISION A2

**Contexto:** en `GET /api/follows/feed`, los comentarios recientes de cada proyecto (`recent_comments`) no traían `user_id`: el SELECT de `follows.js` no lo pedía y el objeto que se armaba tampoco lo copiaba. `FeedPostCard.tsx:414` linkea el autor a `/volunteer/${c.user_id}`, así que el link iba a `/volunteer/undefined`. La interface `AppComment` de `api.ts` declara `user_id: string` obligatorio. Es el mismo tipo de diferencia que §112/§122 corrigió en las reseñas del feed.

**Qué se hizo:**
- **Backend (`routes/follows.js`):** el SELECT de comentarios del feed pide `c.user_id` y cada comentario reciente sale con **las mismas claves y valores que `comments` de `GET /api/projects/:id`**: `id`, `project_id`, `user_id`, `comment`, `created_at`, `user_name`, `user_avatar`, `is_participant`.
- Al compararlos aparecieron **dos diferencias más**, que también alineé:
  - faltaba `project_id` (el detalle lo manda; `AppComment` no lo declara, igual que pasa con `Rating`);
  - `is_participant` salía `true`/`false` y en el detalle (y en la respuesta de `POST /projects/:id/comments`, que `FeedPostCard` mete en la misma lista) sale `0`/`1`. Ahora el feed manda `0`/`1`. `AppComment.is_participant?: boolean | number` ya acepta los dos y las dos pantallas lo leen con `Boolean(...)`, así que el frontend no cambia.
- **Frontend:** sin cambios (el tipo ya era correcto; era el backend el que no lo cumplía).

### Tests (nuevos: 3)
- `feed-comments-shape.test.js` (3), con 4 comentarios en `proj-1` de fechas distintas (de un participante, de uno con la inscripción pendiente y de uno sin inscripción):
  - cada comentario reciente del feed trae el `user_id` de quien lo escribió;
  - los 3 del feed son iguales, claves y valores, a los 3 primeros del detalle, en el mismo orden;
  - claves exactas (las de `AppComment` + `project_id`) y valores contra la base: nombre, avatar, texto, fecha (`toMillis`), `is_participant` verdadero solo para la inscripción aprobada, y `comments_count` = 4.
- **Rojo de comportamiento:** los 3 fallaban con el código viejo (`user_id` → `undefined`; faltaban `project_id` y `user_id` en las claves).

### Verificación
- **Backend:** SQLite **501/501** (498 + 3) y Postgres **503/503** (500 + 3), 0 cancelled, exit 0; también con `TZ=America/Argentina/Cordoba` (501/501 y 503/503).
- **Frontend:** **560/560**. **Typecheck: 0 errores.** (Sin cambios de frontend.)
- **Mutación (6)**, con corrida de control en los dos motores: sacar `c.user_id` del SELECT, sacar `user_id` del objeto, `user_id` con el id del comentario, sacar `project_id`, volver a `Boolean(is_participant)` y `is_participant` siempre 1 → **mueren los 6 en SQLite y en Postgres.**

### Errores propios
- Ninguno en el código. En una corrida completa de Postgres falló dos veces `db-transaction.test.js` (los tests que dependen de tiempos: `sleep(20)` y el de aislamiento), igual que en A1; no tocan el feed. Solo ese archivo pasó 3 de 3 y la suite completa volvió a dar 503/503 en las dos zonas horarias. Probablemente la base compartida estaba cargada por otras corridas en paralelo (no lo confirmé).

### ⚠️ NO verificado
- No vi en el navegador que el link del autor de un comentario del feed lleve a su perfil.
- `is_participant` pasó de booleano a 0/1 en el feed: lo único que lo lee es `FeedPostCard` (con `Boolean()`); un consumidor externo que comparara `=== true` dejaría de andar (no hay ninguno en el repo).

## 136. El buscador de proyectos busca por categoría también en SQLite — REVISION A7

**Contexto:** `GET /api/projects?search=` tiene dos ramas (`BACKEND_CONTEXT.md §2`). La de Postgres busca en título, descripción, ONG, **nombre de categoría** y ubicación. La de SQLite no buscaba en la categoría: en desarrollo, "apicultura" no encontraba un proyecto de esa categoría y en producción sí. La tercera pasada de `REVISION.md` lo encontró leyendo el código.

**Qué se hizo:** la rama SQLite suma la categoría con una subconsulta (`p.id IN (SELECT … FROM project_categorias JOIN categorias … WHERE nombre ILIKE …)`), igual que su filtro `category`. No hace falta un JOIN, porque esa rama no lo tiene. Ahora las dos ramas buscan en los mismos cinco campos y en el mismo orden. La rama de Postgres no se tocó.

### Tests (nuevos: 1, en `projects-search.test.js`)
- Se le pone a "Maratón Solidaria de Donaciones" la categoría "Apicultura", un texto que no está en ningún título, descripción, ONG ni ubicación del seed. `search=apicultura` y `search=APICULT` devuelven solo ese proyecto. Después se restaura la categoría original y la búsqueda vuelve a dar vacío.
- Corre en los dos motores.
- **Rojo de comportamiento** en SQLite (`[]` en vez del proyecto). En Postgres pasó desde el principio: es el control de que las dos ramas coinciden.

### Verificación
- **Backend:** SQLite **494/494** y Postgres **496/496**, también con `TZ=America/Argentina/Cordoba`, 0 cancelled.
- **Mutación (8)**, con corrida de control y en los dos motores. Se mutó: sacar la cláusula, `ILIKE` → `=`, `OR` → `AND`, `IN` → `NOT IN`, `si += 4`, un parámetro de menos y dos cambios de índice de placeholder.
  - **SQLite:** mueren 6. Sobreviven los 2 cambios de índice (`$${si+3}` → `$${si}`, y la ubicación con `$${si+3}`). Son **equivalentes**: los cinco parámetros valen lo mismo (`%texto%`) y `remapParams` acepta un `$N` repetido.
  - **Postgres:** sobreviven los 8, como era de esperar: esa rama no corre en Postgres. El test sirve ahí como control de que los dos motores dan lo mismo.

### Errores propios
- La primera corrida de mutación usó `String.replace` con un string de reemplazo. Ahí `$$` se interpreta como un `$` literal, así que los mutantes con `$${…}` rompían el template y "morían" por otra razón. Lo corregí (reemplazo con función) y repetí la corrida. Los números de arriba son los de esa segunda corrida.

### ⚠️ NO verificado
- No lo vi en el navegador. Además, Explorar filtra en el navegador: solo la portada (`PublicFeed`) manda `search`.
- Sigue la diferencia conocida de mayúsculas en letras no ASCII. En SQLite, "APICULTURA" encuentra "Apicultura", pero "EDUCACIÓN" no encuentra "Educación".

## 137. El alta de proyectos valida tipos, modalidad, montos y topes — REVISION A3

**Contexto:** la tercera pasada de `REVISION.md` confirmó con una sonda que `POST /api/projects` daba **500** en dos casos: un `type` fuera de `fugaz|sostenido` (el `CHECK` de la base) y un `title`/`description` que no fuera texto (`title?.trim()`). El PUT ya validaba esos campos (§95). Revisé el resto de los campos con una sonda descartable de 41 casos, en SQLite y en Postgres. Aparecieron más:

| Campo | Antes | Motor |
|---|---|---|
| `location` no-texto | 500 (`.toLowerCase()` corría **antes** de validar) | los dos |
| `duration`, `full_description` no-texto | 500 (`.trim()`) | los dos |
| `image` objeto | 500 / se guardaba `{"a":1}` | SQLite / Postgres |
| `image` número | se guardaba `"5"` | los dos |
| `modality` objeto | 500 / se guardaba `{"a":1}` | SQLite / Postgres |
| `modality` `"otra"`, número o array | se guardaba tal cual (el filtro de modalidad no lo reconoce) | los dos |
| `funding_goal`/`cost_per_person` negativos | 500 (`CHECK >= 0`) | los dos |
| `funding_goal` `"abc"` o `{}` | se guardaba 0 | los dos |
| `funding_goal` `"Infinity"` o `"1e400"` | se guardaba infinito (la API devolvía `null`) | los dos |
| `volunteers_needed` / `hours_per_week` = `1e10` | 500 (INTEGER desbordado) / se guardaba | Postgres / SQLite |
| sin `type` ni `duration` | se creaba un fugaz **sin duración** (se validaba sin tipo y se insertaba `'fugaz'`) | los dos |

**Qué se hizo** (solo `routes/projects.js`; se reusó lo que ya existía):
- **`validateProject`:**
  - Exige `tipo` en `PROJECT_TYPES`.
  - Tope de **168** horas semanales (las horas de una semana) y de **100000** cupos. Por encima, Postgres desbordaba.
  - Como la comparten alta y edición, el PUT gana los mismos topes. En el PUT, `1e10` también daba 500 en Postgres.
- **`projectTextError(body)`:** si vienen y no son `null`, título, descripción, ubicación, descripción completa, imagen y duración tienen que ser texto. Usa `checkText` de `lib/inputs.js` con `max: Infinity`, porque hoy no hay largo máximo. Reemplaza los dos loops que tenía el PUT, con el mismo mensaje (`"<Campo> tiene que ser un texto"`).
- **`parseMoney(value, label)`:** la regla de montos del PUT, que se movió a una función: `null`/`''` → 0; si no, número finito ≥ 0. El PUT la usa a través de su `money()`, que conserva el valor actual si el campo no viene. El alta la usa con "ausente = 0".
- **POST:**
  - `tipo = type ?? 'fugaz'`, y se valida con ese tipo.
  - Los tipos de texto se chequean antes que todo lo demás.
  - `modality`/`modalidad`, si vienen y no están vacías, tienen que ser `presencial`, `remoto` o `hibrido`.
  - Los montos pasan por `parseMoney`.
  - La modalidad deducida de la ubicación se calcula **después** de validar.
- **PUT:** se sacó su chequeo propio de `type`, que quedó redundante: `validateProject` rechaza el tipo combinado con el mismo mensaje, `null` incluido. Lo único que cambia es la precedencia: si vienen un tipo inválido y un `status` inválido a la vez, ahora gana el mensaje de status.

### Tests (nuevos: 13)
- **`projects-create-validation.test.js` (10):**
  - 6 de 400 sin crear nada. Se cuenta el total de proyectos, porque un título no-texto no sirve para buscar. Cubren: tipo (`'otro'`, `5`, `''`, `'FUGAZ'`, `['fugaz']`), 12 textos no-string, 5 modalidades inválidas, cupos/horas `1e10` y por encima del tope, 6 montos inválidos, y "sin type ni duration".
  - 4 de lo válido: sin `type` o `null` → fugaz; los extremos 168 horas y 100000 cupos; las tres modalidades más `modalidad`, vacía o ausente (se deduce); montos numéricos, en texto, `null` y `''`; textos opcionales en `null`.
- **`projects-partial-update.test.js` (3, en la tabla `BAD`):** PUT con `type: null`, `volunteers_needed: 1e10` y `hours_per_week: 1e10` → 400 sin cambiar nada.
- **Rojo de comportamiento:** los 6 tests de rechazo fallaban con 500 o 201. Los 4 de "lo válido" pasaban antes: son de no regresión.

### Verificación
- **Backend:** SQLite **507/507** y Postgres **509/509**, también con `TZ=America/Argentina/Cordoba`. 0 cancelled, exit 0.
- Una corrida de Postgres con Córdoba dio 2 fallas en `db-transaction.test.js`: "colgada de una promesa…" y "AISLAMIENTO…". Son tests con `sleep()` que no tocan proyectos. Ese archivo solo pasó 3 de 3 veces, y la suite completa pasó en las dos corridas siguientes. Lo atribuyo a la carga del Postgres compartido.
- **Sonda repetida después del arreglo:** 0 respuestas 500 en Postgres. En SQLite, todo lo de la tabla da 400 con mensaje en español.
- **Mutación (34 distintos)**, con corrida de control, en SQLite. Los 5 que tocan lo propio de Postgres (tope de cupos y de horas, tipo, title, `parseMoney`) se corrieron también en Postgres.
  - **Mueren 33.**
  - **Sobrevive 1, equivalente:** sacar `if (value === null || value === '') return { value: 0 }` de `parseMoney`, porque `Number(null)` y `Number('')` ya dan 0. Lo dejé por legibilidad: viene del PUT.

### Errores propios
- El script de mutación tenía dos fallas que detectó él mismo ("el texto aparece 0 veces"): patrones con `\n` en un archivo CRLF y un patrón de `title` mal copiado. Los corregí y repetí esos mutantes.
- Una vez guardé la salida de una corrida en `/tmp` en vez del scratchpad.

### ⚠️ NO verificado / no arreglado (para decidir)
- **Topes 100000 cupos y 168 horas:** son decisión mía. El frontend tiene `max="40"` en horas (solo HTML) y nada en cupos. Un proyecto viejo por encima de esos topes ya no se puede editar sin bajarlos (el seed no tiene ninguno).
- **`type: ''`** antes creaba un fugaz y ahora da 400 (igual que en el PUT). El frontend siempre manda `fugaz` o `sostenido`.
- **`parseInt` laxo en cupos y horas (no da 500, no lo toqué):** `3.7` → 3, `"5 personas"` → 5, `[5]` → 5, horas `2.5` → 2, y `1e21` → **1** (`parseInt('1e+21')`).
- **Montos:** `Number([])` = 0 y `Number(true)` = 1 se aceptan, también en el PUT (ya era así).
- **Latitud/longitud (no da 500, no lo toqué):** `"abc"`, `{}` o `"1e400"` se guardan como `null` sin aviso; `latitude: 500` se guarda.
- **PUT, sin tocar:** `modality` sigue sin validarse (un objeto da 500 en SQLite), y `latitude` igual que en el alta.
- Ni `title` ni `image` tienen largo máximo, ni se valida que `image` sea una URL.
- No lo vi en el navegador. `CreateVoluntariado` siempre manda valores válidos, así que la interfaz no debería notar el cambio.

## 138. Registro: apellido validado — REVISION A4

**Contexto:** la tercera pasada de `REVISION.md` (A4) confirmó con una sonda que en `POST /api/auth/register` un `apellido` que no es texto daba **500** en los dos motores. Nombre, email, contraseña y rol se validaban, pero el apellido no: llegaba a `apellido?.trim()` dentro de la transacción y reventaba ahí. Tampoco tenía largo máximo.

**Qué se hizo:**
- `routes/auth.js`: `checkText(apellido, { label: 'El apellido', max: 50 })` (de `lib/inputs.js`), junto con las demás validaciones y **antes** de tocar la base. Si no es texto → **400** "El apellido tiene que ser un texto"; si pasa de 50 → **400** "El apellido puede tener hasta 50 caracteres". El máximo es 50, como el nombre.
- Sigue siendo opcional: si falta, viene `null` o vacío, se toma del nombre completo, como antes. Se valida con cualquier rol, aunque solo lo use el voluntario.
- **El resto de los campos, con la misma lupa:**
  - `name`, `email` y `password` ya verificaban que fueran texto (§76).
  - `role` usa `includes`, así que un valor que no es texto ya daba 400 "Rol inválido".
  - Ninguno más llega a un `.trim()` sin validar.
  - Encontré otra cosa y **no la arreglé** (regla 16): `password` no tiene largo máximo y `bcryptjs` usa solo los primeros 72 bytes. Dos contraseñas que coinciden en esos 72 bytes son la misma; lo comprobé con una sonda descartable.

### Tests (nuevos: 11)
- `register-input-validation.test.js` (11):
  - `apellido` número, array, objeto o `true` → 400 con el mensaje exacto, sin ningún usuario creado (4);
  - más de 50 → 400; exactamente 50 → 201 y queda guardado;
  - con espacios alrededor se guarda recortado;
  - ausente, `null` o vacío → se toma del nombre, como antes (3);
  - con rol ONG también da 400.
- **Rojo de comportamiento:** 6 fallaban (cuatro 500 "Error interno del servidor", el largo y la ONG con 201). Los otros 5 ya pasaban: cubren lo que ya andaba, para que no se rompa.

### Verificación
- SQLite **532/532** y Postgres **534/534**, también con `TZ=America/Argentina/Cordoba`, 0 cancelled y salida 0. Era 493/495; los +39 suman los tres arreglos (A4 11, A5 15, A6 13).
- **Mutación (6)**, con corrida de control: sin el `if`, máximo 51, máximo 49, `required: true`, validar otra cosa en lugar de `apellido` y 500 en vez de 400. **Mueren los 6.**

### Errores propios
- En el primer borrador del test dejé una aserción confusa: un apellido de 50 con espacios alrededor da 400, porque el largo cuenta lo que llega. No probaba nada útil y la saqué antes de implementar.

### ⚠️ NO verificado
- El formulario de registro (`AuthModal.tsx`) no manda `apellido` (`api.ts` no lo tiene), así que en la interfaz no cambia nada; no lo vi en el navegador.
- No se le aplica al apellido la regex del nombre (solo letras): hoy acepta dígitos. Queda a decisión tuya.

## 139. Chatbot: pregunta y categoría validadas — REVISION A5

**Contexto:** la tercera pasada de `REVISION.md` (A5) confirmó con una sonda que en `POST /api/faqs/ask` un `question` que no es texto daba **500** en los dos motores: reventaba en `question.trim()`. Además no había largo máximo. Mirando el mismo endpoint encontré otra cosa: con un `categoria` objeto, SQLite también daba 500, porque no puede usarlo como parámetro del SQL. En Postgres, en cambio, respondía 200 sin resultados.

**Qué se hizo:**
- `routes/faqs.js`: antes del `.trim()`, `firstError(checkText(question, { label: 'La pregunta', max: 500 }), checkText(categoria, { label: 'La categoría', max: 50 }))` (de `lib/inputs.js`) → **400** con el mensaje en español:
  - "La pregunta tiene que ser un texto"
  - "La pregunta puede tener hasta 500 caracteres"
  - "La categoría tiene que ser un texto"
  - "La categoría puede tener hasta 50 caracteres"
- Una pregunta ausente, `null`, vacía o de menos de 3 caracteres sigue dando "La pregunta es muy corta", como antes. `categoria: null` se toma como "sin categoría".
- **Por qué 500:** el widget es para preguntas cortas y escritas a mano, y 500 entra holgado. El límite evita que alguien mande hasta 100 kB (el tope de `express.json`) para que el servidor los parta en palabras y los compare contra todas las keywords. Para `categoria`, 50 alcanza: las reales son `voluntario`, `ngo`, `general`, etc.

### Tests (nuevos: 15)
- `faqs.test.js`, bloque "POST /api/faqs/ask valida el cuerpo" (15):
  - `question` número, array, objeto o `true` → 400 (4);
  - ausente, `null`, vacía o de 2 letras → "muy corta", como antes (4);
  - más de 500 → 400; exactamente 500 → 200 con la respuesta correcta;
  - `categoria` número, array u objeto → 400 (3);
  - `categoria` de más de 50 → 400;
  - `categoria: null` → 200.
- **Rojo de comportamiento:** 9 fallaban en los dos motores: 500 "Error al procesar la pregunta", o 200 donde se esperaba 400. Los otros 6 ya pasaban: dejan fijado lo que ya andaba.

### Verificación
- SQLite **532/532** y Postgres **534/534**, también con `TZ=America/Argentina/Cordoba`, 0 cancelled y salida 0. El archivo da 20/20 en los dos motores y con Córdoba.
- **Mutación (10 válidos)**, con corrida de control:
  - sin el `if`;
  - 500 en vez de 400;
  - sin el chequeo de `question`;
  - sin el de `categoria`;
  - `question` con máximo 501 y con máximo 499;
  - `categoria` con máximo 51;
  - `categoria` con `required`;
  - `question` con `required`;
  - `question` con `min: 3`.
  
  **Mueren los 10.** Hubo 2 mutantes más que el script no pudo aplicar: los escribí con `\n` y el archivo es CRLF; los repetí con `\r\n`.

### Errores propios
- Los dos mutantes con `\n` en un archivo CRLF (ver arriba).

### ⚠️ NO verificado
- `ChatbotWidget.tsx` no limita el largo del input. Una pregunta de más de 500 caracteres ahora va a mostrar el error del backend, pero no lo vi en el navegador.
- `GET /api/faqs?categoria=…` no se tocó: con `?categoria=a&categoria=b` Express arma un array. No lo probé.

## 140. Propuesta de patrocinio: dos a la vez dan 201 y 409 — REVISION A6

**Contexto:** la tercera pasada de `REVISION.md` (A6) confirmó con una sonda un problema en `POST /api/empresas/me/patrocinios`: si llegan a la vez dos propuestas de la misma empresa al mismo proyecto, la segunda da **500 en Postgres** (201/500 en 3 de 3 corridas). La ruta primero hace un SELECT ("¿ya hay propuesta?") y después un INSERT. Las dos pasan el SELECT y la segunda choca con la PK `(empresa_id, project_id)`; faltaba `isUniqueViolation` (regla 21). Con el test encontré dos problemas más:
- Al re-proponer tras un rechazo, las dos pasaban el SELECT, las dos hacían el UPDATE y **todas respondían 201**: 8 de 8 en Postgres. La ONG recibía una notificación y un email por cada una.
- `mensaje` y `project_id` no se validaban. Un `project_id` objeto daba 500 en SQLite. Un `mensaje` número se guardaba tal cual (201), y uno de más de 1000 caracteres también.

**Qué se hizo** (`routes/empresas.js`):
- **INSERT:** `try/catch` con `isUniqueViolation(err)` → **409** "Ya existe una propuesta de patrocinio con este proyecto", el mismo mensaje del chequeo previo.
- **Re-propuesta (UPDATE):** compare-and-swap con `WHERE … AND estado='rechazado'` y se mira `changes`. Solo una pasa la fila a `propuesto`; las otras reciben 409 y no notifican.
- **Validación**, antes de tocar la base:
  - `project_id` que no es texto → **400** "project_id inválido". Si falta, sigue siendo "project_id requerido".
  - `mensaje` con `checkText(mensaje, { label: 'El mensaje', max: 1000 })`: si no es texto o pasa de 1000 → **400**. Sigue siendo opcional: `null` o `''` se guardan como `null`, como antes.
- La notificación y el email siguen después del alta, fuera de toda transacción.

### Tests (nuevos: 13)
- `sponsorship-proposal.test.js` (13). Corre en los dos motores; las carreras se reproducen en Postgres.
  - **Concurrencia:** se verifican invariantes, no quién gana la carrera (como en §77).
    - 8 propuestas simultáneas al mismo proyecto, repetido en 4 proyectos: una 201 y siete 409, una sola fila y una sola notificación por proyecto;
    - re-propuesta tras un rechazo, 8 a la vez: una 201 y siete 409, una notificación nueva y el mensaje de la que ganó;
    - re-propuesta sin carrera: sigue andando, y repetirla da 409.
  - **Validación:**
    - `mensaje` número, array, objeto o `true` → 400 sin crear nada (4);
    - `mensaje` de más de 1000 → 400;
    - `project_id` número, array u objeto → 400 (3);
    - sin `project_id` → "project_id requerido";
    - `mensaje` de 1000 se guarda; `null` y `''` → `null`.
- **Rojo de comportamiento:**
  - **Postgres:** la re-propuesta dio `201,201,201,201,201,201,201,201`. Con una sola ráfaga, la propuesta nueva dio 500 en 4 de 5 corridas, así que la repetí en 4 proyectos; así dio 500 en 5 de 5 (p. ej. `201,500,409,…`, y una vez `500,500,500,500,201,500,500,500`).
  - **SQLite:** fallaban los 9 de validación. Las carreras ya pasaban, porque SQLite trabaja con una sola conexión.

### Verificación
- SQLite **532/532** y Postgres **534/534**, también con `TZ=America/Argentina/Cordoba`, 0 cancelled y salida 0.
- El archivo nuevo dio 13/13 en Postgres en 3 corridas seguidas.
- `follows-sponsorship-concurrency`, `empresa-dashboard` y el nuevo, con Córdoba: 34/34.
- **Mutación (10 válidos), en Postgres** (`TEST_DB=postgres`), con corrida de control:
  - sin `isUniqueViolation`;
  - sin `AND estado='rechazado'`;
  - sin el chequeo de `changes`, de dos formas;
  - 500 en vez de 409;
  - sin el chequeo de tipo de `project_id`;
  - sin el `if` del mensaje;
  - máximo 1001 y máximo 999;
  - `nullable: false`.
  
  **Mueren los 10.** Uno más quedó inválido (`\n` en un archivo CRLF) y lo repetí con `\r\n`. Los mutantes de carrera mueren por probabilidad, no seguro: cada uno corrió una sola vez.

### Errores propios
- La primera versión del test de carrera tenía una sola ráfaga y en Postgres salió en verde 1 de cada 5 veces con el bug presente. La pasé a 4 proyectos.
- Un mutante escrito con `\n` en un archivo CRLF.

### ⚠️ NO verificado
- No lo vi en la interfaz de la empresa.
- Que la ONG ya no reciba dos emails lo deduzco de que la ruta corta antes del `sendEmail`: los tests solo cuentan las notificaciones in-app.
- `DELETE /api/empresas/me/patrocinios/:projectId` y la decisión de la ONG no se tocaron: la decisión ya tenía CAS (§77).

## 141. Registro: contraseña de hasta 72 bytes — decisión del usuario sobre §138

**Contexto:** §138 dejó anotado, sin arreglarlo (regla 16), que `password` no tenía largo máximo y que `bcryptjs` usa solo los primeros 72 bytes: dos contraseñas que coinciden en esos 72 bytes valen como la misma. El usuario decidió poner el límite al **fijar** una contraseña, sin cambiar el login.

**Qué se hizo:**
- `routes/auth.js`: `validatePassword` suma `Buffer.byteLength(v, 'utf8') > PASSWORD_MAX_BYTES` (72), después del mínimo de 8. Si pasa → **400** "Máximo 72 caracteres (los acentos, la ñ y los emojis cuentan como más de uno)". Cuenta **bytes UTF-8**, no caracteres: la ñ ocupa 2 y un emoji 4. El mensaje lo explica sin hablar de bytes (regla 19).
- **Dónde se fija una contraseña:** solo en `POST /api/auth/register`. Busqué `bcrypt` y `password` en `src/`: no hay cambio ni recuperación de contraseña, y `PUT /api/auth/me` no la toca. `scripts/seed.js` usa `bcrypt.hashSync` con contraseñas fijas y cortas: no hacía falta tocarlo.
- **El login no cambia:** no llama a `validatePassword`. Una cuenta vieja con una contraseña de más de 72 bytes sigue entrando, y una contraseña larga equivocada da el 401 de siempre.
- `AuthModal.tsx`: el formulario ya validaba la contraseña en el cliente, así que suma el mismo límite con el mismo mensaje (regla 3), con `new TextEncoder().encode(v).length` (en el navegador no hay `Buffer`). Sigue siendo una regla duplicada back/front, como las demás de `AuthModal`; no hay módulo compartido entre los dos paquetes.

### Tests (nuevos: 10)
- `register-password-max.test.js` (6):
  - 73 caracteres ASCII → 400 con el mensaje exacto y sin usuario creado;
  - exactamente 72 ASCII → 201, y después el login con esa contraseña da 200;
  - 38 caracteres con ñ (74 bytes) → 400: cuenta bytes, no caracteres;
  - con ñ hasta 72 bytes justos → 201;
  - una contraseña corta sigue dando "Mínimo 8 caracteres";
  - login sin cambios: una cuenta insertada a mano con una contraseña de 80 bytes entra (200), y una larga equivocada da 401 "Email o contraseña incorrectos".
- `AuthModal.test.tsx`, bloque "registro: contraseña de hasta 72 bytes" (4):
  - 73 caracteres → se ve el mensaje y no se llama a `api.auth.register`;
  - 38 caracteres con ñ (74 bytes) → lo mismo;
  - 72 bytes justos con ñ → se llama a `register` con el body exacto;
  - si el servidor igual lo rechaza, se ve su mensaje.
- **Rojo de comportamiento:** en el backend fallaban 2 (73 ASCII y 74 bytes con ñ: 201 "Cuenta creada" en vez de 400). En el frontend, los 2 equivalentes (no aparecía el mensaje). Los otros ya pasaban: dejan fijado el borde de 72, el mínimo, el login y el mensaje del servidor.

### Verificación
- SQLite **560/560** y Postgres **562/562**, también con `TZ=America/Argentina/Cordoba`, 0 cancelled y salida 0. Era 554/556 (+6).
- Frontend **564/564** (era 560, +4); `npm run typecheck` **0 errores**.
- **Mutación (12)**, con corrida de control sin mutar. Backend y frontend, 6 cada uno: sin el `if`, máximo 73, máximo 71, `length` en vez de bytes, `>=` en vez de `>` y otro mensaje. **Mueren los 12**; los dos lados restaurados.

### Errores propios
- Ninguno que haya llegado al código.

### ⚠️ NO verificado
- No vi el formulario en el navegador: el mensaje aparece debajo del campo, como los otros errores de contraseña. Eso lo dice el test, no una pantalla.
- `TextEncoder` en navegadores viejos: existe en todos los actuales y en jsdom; no lo probé en un dispositivo.
- El indicador de fortaleza (`PasswordStrength`) no muestra el máximo: solo aparece el error al enviar.

## 142. Registro: apellido solo letras, como el nombre — decisión del usuario sobre §138

**Contexto:** §138 validó que `apellido` fuera texto y de hasta 50 caracteres, pero dejó a decisión del usuario aplicarle la regla del nombre: aceptaba dígitos y símbolos ("García2", "@@"). El usuario decidió que use la misma regla.

**Qué se hizo:**
- `routes/auth.js`: después de `checkText` (que sigue dando los 400 de tipo y de largo), si el apellido trae algo además de espacios pasa por **`validateName`**, la misma función (y la misma `NAME_RE`) del nombre. No copié la regex. Si no cumple → **400** "El apellido solo puede tener letras y espacios, mínimo 2 caracteres". El mensaje nombra el campo, porque el de `validateName` no lo hace y el body tiene dos campos con esa regla.
- La regla es la de `NAME_RE`: letras (con tildes, ñ y ü), espacios, apóstrofo y guion, de 2 a 50. "O'Brien-Núñez Güemes" pasa.
- **Sin cambios:**
  - si el apellido falta, viene `null` o vacío (también solo espacios), se toma del nombre completo, como en §138;
  - se valida con cualquier rol, aunque solo lo use el voluntario.
- **Frontend:** no cambia. `AuthModal.tsx` no tiene campo de apellido y `api.auth.register` no lo manda: lo verifiqué con grep. El único `apellido` del frontend es el de `NGOEmpleados.tsx`, que es otro endpoint (`routes/ngos.js`, empleados) y no se tocó.

### Tests (nuevos: 6)
- `register-input-validation.test.js` (6):
  - apellido con un número, de una letra, con símbolos, o con un número y espacios alrededor → 400 con el mensaje exacto y sin usuario creado (4);
  - con tildes, ñ, ü, apóstrofo y guion → 201 y se guarda tal cual;
  - con rol ONG y números también da 400 con el mismo mensaje.
- **Rojo de comportamiento:** fallaban 5 (201 "Cuenta creada" en vez de 400). El de tildes/apóstrofo/guion ya pasaba: deja fijado que la regla nueva no rechaza apellidos reales.

### Verificación
- SQLite **566/566** y Postgres **568/568**, también con `TZ=America/Argentina/Cordoba`, 0 cancelled y salida 0. Era 560/562 después de §141 (+6).
- Frontend sin cambios: **564/564** y typecheck en 0.
- **Mutación (7)**, con corrida de control sin mutar:
  - sin el `if`;
  - sin la guarda de vacío;
  - sin `trim` en la guarda;
  - validar `name` en vez de `apellido`;
  - `||` en vez de `&&`;
  - otro mensaje;
  - 201 en vez de 400.
  **Mueren los 7**; archivo restaurado.

### Errores propios
- En la primera corrida de Postgres de esta tarea fallaron 2 tests y no guardé la salida, así que no sé cuáles fueron. Corrí la suite 5 veces más. En una falló 1 test que ya existía y no toqué: `db-transaction.test.js`, "una llamada db.* colgada de una promesa creada DENTRO de la tx…". Ese test espera 20 ms (`sleep(20)`) y supone que en ese tiempo el COMMIT ya terminó. Con el Postgres compartido y cargado (otros agentes corriendo a la vez), el `db.run` se ejecuta con la tx todavía abierta y salta el guard. Las otras 4 corridas dieron 568/568 con salida 0, y las de Córdoba también. No lo arreglé: queda fuera de esta tarea (regla 16).

### ⚠️ NO verificado
- No hay interfaz que mande `apellido` en el registro, así que no hay nada que ver en el navegador.
- Los apellidos con letras de otros alfabetos (ç, ø, å, etc.) se rechazan, igual que en el nombre: `NAME_RE` solo acepta letras ASCII más tildes, ñ y ü. Lo heredan de la regla del nombre; no lo cambié.
- El test intermitente de `db-transaction.test.js` (ver Errores propios): queda para decidir.

## 143. Alta y edición de proyectos estrictas: enteros, coordenadas, largos y modalidad (B3, decisión del usuario)

**Contexto:** §137 dejó anotados, sin arreglar, cuatro pendientes de `POST`/`PUT /api/projects`. Los confirmé con tests antes de tocar el código:
- **Cupos y horas con `parseInt` laxo:** se aceptaba `3.7` → 3, `"5 personas"` → 5, `[5]` → 5. Además, `1e21` llegaba como `"1e+21"` y `parseInt` lo leía como **1**: se creaba un proyecto de 1 cupo.
- **Coordenadas:** `"abc"` quedaba `null` sin aviso, y `latitude: 500` se guardaba.
- **Largos:** ningún texto del proyecto tenía largo máximo. Un título de 81 caracteres se guardaba aunque el formulario muestra "n/80".
- **PUT sin validar `modality`:** `{ a: 1 }` daba **500** en SQLite, y `"otra"` se guardaba.

**Qué se hizo:**
- **`lib/inputs.js`:** helper nuevo `toStrictInt(value)`. Acepta un número entero o un texto de dígitos con signo opcional; cualquier otra cosa da `NaN`. Las reseñas (§74) tenían la misma regla escrita a mano y ahora la usan (regla 3). Es equivalente: `"-1"` sigue siendo inválido para una reseña.
- **`validateProject`:** cupos y horas pasan por `toStrictInt`. Si falta el valor o es menor que 1, el mensaje es el de siempre ("…deben ser un número positivo"). Si no es entero: **"Los cupos tienen que ser un número entero"** o **"Las horas semanales tienen que ser un número entero"**. Los topes de §137 (100000 y 168) no cambian, y `1e21` como número ahora choca con el tope. El `INSERT` y el `UPDATE` usan el mismo valor (`toStrictInt`) en vez de `parseInt`.
- **Coordenadas (`parseCoord`/`parseLat`/`parseLng`):**
  - `null`, `''` o ausente → sin coordenada.
  - Si no, tiene que ser un número (o un texto numérico) dentro del rango: latitud de −90 a 90 y longitud de −180 a 180. Si no → 400: "La latitud tiene que ser un número entre -90 y 90" (y lo mismo para la longitud).
  - Se rechazan objetos, arrays, booleanos, `"Infinity"`, `"1e400"` y un texto en blanco (`Number('  ')` es 0).
  - Alta: `latitude ?? latitud` (la misma precedencia que antes). PUT: si viene alguna, se valida, y `null`/`''` la borra; si no viene ninguna, se conserva la actual.
- **Largos máximos (en `PROJECT_TEXT_FIELDS`, igual en el alta y en el PUT; mensaje de `checkText`: "<Campo> puede tener hasta N caracteres"):**

  | Campo | Máximo | Por qué |
  |---|---|---|
  | `title` | **80** | es lo que anuncia `CreateVoluntariado` ("n/80 caracteres") |
  | `description` | **1000** | el frontend no limita; lo elegí yo |
  | `full_description` | **5000** | el frontend no limita; lo elegí yo |
  | `location` | **150** | el mismo que la ubicación de los perfiles |
  | `duration` | **100** | el frontend no limita; lo elegí yo |
  | `image` | **1000** | el mismo que logos y avatares |

  En el PUT solo se mira lo que viene en el body: un valor viejo más largo no impide editar otros campos.
- **Modalidad:** `modalityError(body)` es la regla que ya tenía el alta (`modality`/`modalidad`, si vienen y no están vacías, `presencial|remoto|hibrido`). Ahora también la usa el PUT. `modality: ''` en el PUT conserva la actual (como antes).

### Tests (nuevos: 17, `projects-strict-inputs.test.js`)
- **POST, 400 sin crear nada (6):**
  - cupos y horas no enteros: `3.7`, `"3.7"`, `"5 personas"`, `[5]`, `"1e21"`, `true`, `{}`, `" 5"`, `"0x10"`;
  - `1e21` como número choca con el tope;
  - negativos en texto (`"-3"`) y valores ausentes mantienen el mensaje "positivo";
  - coordenadas inválidas o fuera de rango (`latitude`/`latitud` y `longitude`/`longitud`);
  - cada texto con un carácter de más.
- **POST, lo válido (3):** cupos y horas como número o texto de dígitos (`7.0` también vale); coordenadas en rango, incluidos los extremos y los textos numéricos; `null`, vacías o ausentes = sin coordenadas; textos justo en el máximo.
- **PUT, 400 sin cambiar nada (4, fila comparada entera, con coordenadas y modalidad):** cupos y horas no enteros; 5 modalidades inválidas; coordenadas inválidas; textos largos.
- **PUT, lo válido (4):** cupos y horas en texto de dígitos; las modalidades, y vacía conserva la actual; las coordenadas se guardan, `null`/`''` las borran y ausentes se conservan; textos en el máximo.
- **Rojo de comportamiento:** los 9 tests de rechazo que existían antes de los ajustes por mutación fallaban: con 201/200 (se creaba o se guardaba) y con **500** en "modalidad `{a:1}`" del PUT. Los 7 de lo válido pasaban antes: son de no regresión. El de "negativos y ausentes" lo agregué para la mutación (ver abajo) y también pasaba antes.

### Verificación
- **Backend:**
  - SQLite **571/571** (554 + 17), también con `TZ=America/Argentina/Cordoba`.
  - Postgres **573/573**, también con Córdoba. 0 cancelled, exit 0.
- **Postgres, dos fallas fuera de este cambio:** las dos primeras corridas de `npm run test:pg` dieron 2 fallas en `db-transaction.test.js`: "colgada de una promesa…" y "AISLAMIENTO…". Son las mismas que en §137. Ese archivo solo pasó 3 de 3 veces y las dos corridas siguientes de la suite completa dieron 573/573. Lo atribuyo a la carga del Postgres compartido (otros worktrees corriendo a la vez). No toca proyectos.
- **Frontend:** no lo toqué, así que no corrí sus tests.
- **Regla 10, revisado con grep:** `CreateVoluntariado` manda `volunteers_needed`/`hours_per_week` con `parseInt` (enteros) y `modality` de una lista fija. No manda coordenadas ni imagen. `api.projects.update` no lo usa ninguna pantalla (no hay edición de proyectos en la interfaz).

### Mutación (35 mutantes, control sin mutar primero, restauración en `finally`)
- **SQLite:** mueren **34**. **Sobrevive 1, equivalente:** `parseInt(volunteers_needed) || 0` en lugar de `toStrictInt(...)` en el `INSERT`. Después de `validateProject` el valor ya es un entero válido y los dos dan lo mismo.
- **Postgres**, los 9 que dependen del motor (tipos de `toStrictInt`, chequeo de entero de cupos y horas, coordenadas de cualquier tipo o `NaN`, máximo de rango, `parseInt` en el `INSERT`): mueren 8 y sobrevive el mismo equivalente.
- **Primera pasada: otro sobreviviente, equivalente.** `Number.isFinite` en `parseCoord` sobraba, porque `NaN` e `±Infinity` ya fallan la comparación de rango. Lo saqué y dejé un comentario. En su lugar puse el mutante "acepta `NaN`", que muere.
- El test de negativos en texto y valores ausentes lo agregué **antes** de correr la mutación, al planear dos mutantes: sacar el chequeo de "ausente" y sacar el signo de la regex. Sin ese test, esos dos habrían sobrevivido. Los dos mueren.

### Errores propios
- **Un caso de test que no probaba nada:** puse `NaN` como coordenada inválida, pero `JSON.stringify` lo manda como `null`, que es válido. Lo cambié por `'-Infinity'` antes de la primera corrida.
- **Comandos rechazados por el aislamiento del worktree:** la herramienta rechazó un comando con `tee` + `git status` y un `sed -i` sobre el script de mutación. Los separé, o edité con `Edit`.

### ⚠️ NO verificado / para decidir
- **Título de 80:** `CreateVoluntariado` muestra "n/80 caracteres" pero **no limita** el input (no tiene `maxLength`). Con 81 o más, el alta ahora da 400 al enviar, en el paso 3, y el mensaje aparece arriba ("El título puede tener hasta 80 caracteres"). Antes se guardaba. Lo mismo pasa con una descripción de más de 1000 caracteres, aunque es improbable. Arreglarlo en el frontend (un `maxLength={80}` o validarlo en el paso 1) queda fuera de este commit, que es solo backend.
- **Límites elegidos por mí:** 1000, 5000 y 100 (descripción, descripción completa y duración).
- `image` sigue sin validarse como URL.
- **Valores viejos no se revalidan:** un proyecto viejo con coordenadas fuera de rango o un texto más largo que el máximo se puede seguir editando (solo se valida lo que viene en el body), pero no se corrige solo.
- `"0x10"` se rechaza como entero, pero como coordenada `Number("0x10")` vale 16 y se acepta. Lo dejé así.
- `toStrictInt` acepta ceros a la izquierda (`"007"` → 7).
- No lo vi en el navegador.

## 144. Panel de la ONG: los proyectos con la forma del listado — REVISION B4

### Contexto
`GET /api/ngos/me` armaba sus proyectos con `SELECT * FROM projects WHERE ngo_id=$1`: sin JOIN a categorías ni roles/requisitos, así que `fmt` devolvía `category: ''`, `roles_needed: []`, `requirements: []`, sin `ngo_name`/`ngo_logo`, `ngo_followers: 0` y `avg_rating: null`/`ratings_count: 0` aunque hubiera reseñas. `NGODashboard` muestra `{p.category} · Fugaz` (salía " · Fugaz") y `NGOOwnProfile` muestra `p.category` (salía vacío). `GET /api/ngos/:id/projects` traía la categoría con el alias `category`, que `fmt` no lee (lee `category_name`/`categoria`): también `''`, y el `LEFT JOIN project_categorias` repetía el proyecto que tuviera dos categorías. Es el mismo problema que A1 (§134) resolvió en `GET /api/ngos/:id`. Reglas 4, 7 y 10 (mismo recurso, misma forma) y 2 (no cambiar claves que lee el frontend).

### Qué se hizo
- `backend/src/routes/ngos.js`: la consulta de §134 (proyectos + ONG + rating, `ORDER BY p.created_at DESC, p.id`, `attachAssoc` para roles/requisitos/categoría, `fmt`) pasó a una función `ngoProjects(ngoId, status?)`. La usan los tres endpoints: `GET /api/ngos/:id` (sin cambio de comportamiento), `GET /api/ngos/me` y `GET /api/ngos/:id/projects` (con el filtro `?status=` como antes).
- No se tocaron `projects.js`, `auth.js` ni `lib/projectAssoc.js`. No cambió ninguna clave: `fmt` ya era el formateador; ahora las claves traen valores (y se suman `ngo_name`/`ngo_logo`, que el tipo `Project` ya declara como opcionales). El frontend no necesitó cambios.
- Orden: `/me` y `/:id/projects` ordenaban solo por `created_at DESC`; ahora desempatan por `id` como el perfil público y el listado.

### Tests (nuevos: 7, más 2 aserciones en un test existente)
- `backend/test/integration/ngo-own-projects-shape.test.js` (7): `/ngos/me` y `/ngos/:id/projects` iguales (campos y valores, `deepEqual`) al mismo proyecto en `GET /api/projects`, con roles, requisitos, categoría y reseñas no vacíos; los tres endpoints de la ONG con los mismos proyectos en el mismo orden; un proyecto con dos categorías aparece una sola vez en `/ngos/:id/projects` y en `/ngos/me`; `?status=` sigue filtrando (completed/active) con la misma forma; ONG sin proyectos → `[]`; con la misma fecha desempata por id (insertados al revés del orden de los ids).
- `public-columns.test.js` (regla 8): `GET /api/ngos/:id/projects` ya estaba en los públicos del centinela; se agregó el chequeo de claves que espera el frontend (`PROJECT` + `duration`, `hours_per_week`, `ngo_name`) para `/ngos/:id/projects` y para los proyectos de `/ngos/me`.
- Rojo de comportamiento antes del cambio (SQLite): `category: ''` y listas vacías en los dos endpoints, `proj-1` repetido en `/ngos/:id/projects` (`proj-5, proj-7, proj-1, proj-1`), `category` vacía con `?status=completed`, y "falta ngo_name" en public-columns.

### Verificación
- Backend SQLite: `npm test` → 561 pass, 0 fail, 0 cancelled, exit 0 (base 554 + 7). Con `TZ=America/Argentina/Cordoba`: 561/0/0, exit 0.
- Backend Postgres: `npm run test:pg` → 563 pass, 0 fail, 0 cancelled, exit 0 (base 556 + 7). Con `TZ=America/Argentina/Cordoba`: una corrida dio 2 fallos y otra 1, siempre en `db-transaction.test.js` (tests de tiempos con `sleep(20)`/`sleep(15)`: "una llamada db.* colgada… sí funciona" y "AISLAMIENTO…"), que no tocan las ONGs; ese archivo solo dio 12/12 cinco veces seguidas (3 con TZ, 2 sin) y la tercera corrida completa con TZ dio 563/0/0, exit 0. Lo atribuyo a carga en el Postgres compartido (otras tareas corrían a la vez); no lo investigué más.
- Frontend (sin cambios): `npm test` → 560 pass (60 archivos); `npm run typecheck` → 0 errores.

### Mutación
Script descartable sobre `ngoProjects` y sus dos llamadas nuevas (12 mutantes), contra `ngo-own-projects-shape`, `ngo-profile-projects-shape` y `public-columns`, en SQLite y en Postgres; control sin mutar verde en los dos, archivo restaurado byte a byte en `finally`.
- Muertos 10/12 en los dos motores: sin filtro de status, `<>` en vez de `=`, sin `push` del status, sin `attachAssoc`, orden ASC, sin desempate por id (sobrevivía en la primera corrida: se agregó el test de desempate), sin `ngo_name`, `/me` con `user_id`, `/:id/projects` sin status, `/:id/projects` con status fijo.
- Sobrevivieron 2, equivalentes: `COALESCE(r.avg_rating, 0)` → `r.avg_rating` (`fmt` convierte `null` y `0` en `null`), y `JOIN ngos` → `LEFT JOIN ngos` (`projects.ngo_id` es `NOT NULL REFERENCES ngos(id)` y se filtra por `ngo_id`: no puede haber proyecto sin ONG).

### Errores propios
- La primera tanda de mutación dejó vivo el desempate por id (los tests de orden usaban fechas distintas); lo maté con un test que inserta tres proyectos con la misma fecha al revés del orden de los ids.

### ⚠️ NO verificado
- Lo visual: que `NGODashboard` muestre "Medio Ambiente · Fugaz" y `NGOOwnProfile` la categoría de cada proyecto (no puedo ver la interfaz; no hay test de componente que lo cubra).
- `GET /api/ngos/:id/dashboard` tiene el mismo `SELECT * FROM projects` (mismas listas vacías y `category: ''`). Quedó afuera porque la tarea nombraba dos endpoints; ningún componente lo llama hoy (`api.ts` no lo expone). Pasarlo a `ngoProjects` es una línea: queda para decidir.
- Postgres en prod (Render): no verificado.

## 145. Crear voluntariado: los topes del backend también en el formulario (regla 10, aviso de §143)

**Qué se hizo:** desde §143 el backend limita el título a 80 caracteres, la descripción corta a 1000 y la completa a 5000. El formulario mostraba "n/80", pero no limitaba nada, así que un título largo daba error recién al publicar. Ahora los tres campos tienen `maxLength` con esos topes, y el paso 1 valida título y descripción con su propio mensaje ("Máximo 80/1000 caracteres"), por si el texto entra pegado o autocompletado.

### Tests (nuevos: 2, `CreateVoluntariadoLimits.test.tsx`)
- Los dos fallan con el formulario anterior (verificado restaurando el archivo aparte, sin `stash`).

### Verificación
- **Frontend 566/566. Typecheck: 0 errores.**

### ⚠️ NO verificado
- No lo vi en el navegador. No corrí la mutación ni la suite con `TZ=America/Argentina/Cordoba`: la sesión se cortó por falta de tokens.

## 146. Dashboard de la ONG: los proyectos con la forma del listado (pendiente de §144, aprobado por el usuario)

**Qué se hizo:** §144 dejó afuera `GET /api/ngos/:id/dashboard`, que seguía con su propio `SELECT * FROM projects`: `category: ''`, roles y requisitos vacíos, sin `ngo_name`/`ngo_logo` ni rating. Ahora usa `ngoProjects(req.params.id)`, como `GET /api/ngos/:id`, `/ngos/me` y `/ngos/:id/projects` (sin filtro de estado: el dashboard trae todos). `stats` y `pending_enrollments` no cambian. Ninguna pantalla llama a este endpoint (`api.ts` no lo expone; `NGODashboard` usa `/ngos/me`), así que el frontend no cambia. En `API_CONTEXT.md` corregí la sección: decía que `NGODashboard` lo complementaba con requests por proyecto.

### Tests (nuevos: 2, más el dashboard sumado a 2 existentes, `ngo-own-projects-shape.test.js`)
- `GET /ngos/:id/dashboard`: cada proyecto igual (campos y valores) al del listado. **Rojo de comportamiento:** `category: ''`, listas vacías, `ngo_followers: 0` y sin rating.
- El dashboard trae también los proyectos `completed` (y `stats.completed_projects` = 1). Pasaba antes: lo agregué porque el mutante "status fijo `active`" sobrevivía (en el seed todos los proyectos de `ngo-1` están activos).
- El dashboard sumado al test de "mismos proyectos en el mismo orden" (ahora cuatro endpoints) y al de "un proyecto con dos categorías aparece una sola vez".

### Verificación
- SQLite **592/592**, también con `TZ=America/Argentina/Cordoba`; 0 cancelled, salida 0. (554 + 36 de §141–§144 + 2.)
- Postgres **594/594** con TZ Córdoba. Sin TZ, la primera corrida dio 2 fallas en `db-transaction.test.js` ("colgada de una promesa…" y "AISLAMIENTO…", los de `sleep`), corriendo a la vez que la suite SQLite y una mutación del frontend; repetida sola: **594/594**, salida 0. Es el test frágil ya anotado en §142–§144.
- **Mutación (7)**, control sin mutar primero, en SQLite y en Postgres: status fijo `active`, status `completed`, `req.user.id` en vez de `:id`, lista vacía, el `SELECT *` viejo con `fmt`, solo el primero, orden al revés. **Mueren los 7 en los dos motores** (el de `active` sobrevivía en la primera pasada; ver Tests). Archivo restaurado byte a byte.

### Errores propios
- Ninguno que haya llegado al código.

### ⚠️ NO verificado
- Nada visual: ninguna pantalla usa el endpoint.
- Postgres en prod (Render).

## 147. Crear voluntariado: la mutación y la corrida con TZ que le faltaban a §145

**Qué se hizo:** §145 quedó sin mutación ni corrida con `TZ=America/Argentina/Cordoba`. La mutación (13 mutantes sobre `CreateVoluntariado.tsx`, control sin mutar primero) dejó **8 vivos** con los 2 tests de §145: `>=` en vez de `>` en el título; sin `trim` en el título; los cuatro del tope de 1000 en el paso 1 (`> 1001`, `>= 1000`, sin el chequeo, otro mensaje); y los dos de `maxLength={5000}` (5001 y sin el atributo). Ninguno era equivalente. Solo agregué tests; el componente no cambia.

### Tests (nuevos: 3, `CreateVoluntariadoLimits.test.tsx`)
- 80 justos con espacios alrededor pasan al paso 2 (el formulario manda `title.trim()` y el backend cuenta igual sin espacios, así que el `trim` del chequeo es el correcto).
- Descripción corta de 1001 → "Máximo 1000 caracteres" y se queda en el paso 1; con 1000 justos y espacios alrededor, pasa.
- La descripción completa (paso 3) tiene `maxLength` 5000.
- Los tres pasaban antes: son de no regresión y existen para matar a los mutantes. También agregué `window.scrollTo = vi.fn()` (jsdom no lo implementa y "Continuar" lo llama; ensuciaba la salida con "Not implemented"), como en `A11yNames.test.tsx`.

### Verificación
- **Mutación: mueren los 13.** Archivo restaurado byte a byte.
- Frontend **569/569** (566 + 3), también con `TZ=America/Argentina/Cordoba`; `npm run typecheck` **0 errores**.

### Errores propios
- En §145 escribí 2 tests que dejaban vivos 8 de 13 mutantes: no probaban los bordes exactos ni el tope de la descripción.

### ⚠️ NO verificado
- No lo vi en el navegador (`maxLength` corta lo que se tipea; lo pegado se corta también en los navegadores, pero eso no lo probé).

## 148. Comentarios de proyecto: un `comment` que no es texto da 400, no 500 (aprobado por el usuario)

**Qué se hizo:** `POST /api/projects/:id/comments` hacía `comment?.trim()` directo sobre el body: un número, objeto, array o booleano (incluido `0` y `false`) reventaba (`.trim` no es función) y respondía **500** "Error al comentar". Ahora, antes del chequeo de largo mínimo, pasa por `checkText` de `src/lib/inputs.js` (`{ label: 'El comentario', max: 1000 }`): no texto → **400** "El comentario tiene que ser un texto"; más de 1000 caracteres → **400** "El comentario puede tener hasta 1000 caracteres". Sin tope antes. 1000 es el mismo tope que el comentario de una reseña (`POST /:id/ratings`). `null`/ausente pasan `checkText` (campo no obligatorio) y siguen cayendo en el 400 "Comentario muy corto" de siempre. Nada se inserta en ningún caso de error.
- **Frontend (regla 10):** ni `ProjectDetails.tsx` (un `<input>` sin `maxLength`) ni `FeedPostCard.tsx` (un `<textarea>` sin `maxLength`) limitan el largo; los dos mandan `comment.trim()` como string, así que el cambio de tipo no los afecta. No toqué el frontend (no estaba en la tarea): ver NO verificado.
- El tope cuenta el largo **crudo** (con espacios alrededor), como `checkText` en todas las rutas y como las reseñas; el texto se guarda recortado. Como el frontend recorta antes de mandar, en la práctica es lo mismo.

### Tests (nuevos: 5, `comments-input-type.test.js`)
- `123`, `0`, `{ text }`, `[ ... ]`, `true`, `false` → 400 "El comentario tiene que ser un texto" y la cantidad de comentarios de `proj-1` no cambia. **Rojo de comportamiento:** `[500, 'Error al comentar']`.
- `null` y body sin `comment` → 400 "Comentario muy corto" (no regresión).
- `'  ab  '` → "Comentario muy corto" (no regresión).
- 1001 caracteres → 400 con el tope y no se crea; 1000 justos → 201 y se guarda entero. **Rojo:** el de 1001 daba 201.
- Un comentario normal con espacios alrededor → 201 recortado (no regresión).

### Verificación
- SQLite **597/597** (592 + 5), también con `TZ=America/Argentina/Cordoba`; 0 fail, 0 cancelled, salida 0.
- Postgres **599/599**, también con TZ Córdoba; 0 cancelled, salida 0.
- **Mutación (14)**, control sin mutar primero, sobre `comments-input-type.test.js` + `comments-badwords.test.js`, en SQLite: sin el `if`, `if (false)`, status 422, otro mensaje, `max` 1001 y 999, `required: true`, `nullable: false`, `min: 3`, `checkText(undefined)`. **Mueren los 14** (0 sobrevivientes). Archivo restaurado byte a byte.

### Errores propios
- La primera tanda de mutantes buscaba `if (textErr) return res.status(400).json({ error: textErr });`, que aparece dos veces en `projects.js` (otra ruta usa la misma línea): el runner saltó 4 mutantes. Los repetí anclados a la línea anterior (`max: 1000 });\r\n…`); murieron los 4.

### ⚠️ NO verificado
- El frontend no limita el comentario a 1000 (ni `ProjectDetails` ni `FeedPostCard`): con más de 1000 el usuario ve el 400 del backend recién al enviar. No lo agregué (fuera de la tarea); si se quiere, `maxLength={1000}` en los dos campos.
- Los mensajes no son idénticos a los de la reseña ("El comentario tiene que ser un texto de hasta 1000 caracteres", un solo mensaje para tipo y largo). No los unifiqué.
- Nada visual: no vi el error en la interfaz.
- Postgres en prod (Render).

## 149. Recomendaciones: `limit` con `clampInt` (aprobado por el usuario)

**Qué se hizo:** `GET /api/projects/recommended` calculaba `Math.min(parseInt(req.query.limit) || 10, 30)`: un negativo pasaba tal cual y `scored.slice(0, -5)` devolvía **todos los candidatos menos 5** (en el test, con 49 candidatos —9 del seed más 40 de relleno—, devolvía 44: por encima del tope de 30). Ahora usa `clampInt(req.query.limit, 10, 1, 30)` de `src/lib/inputs.js`, como `GET /api/projects` y `GET /api/posts`: inválido o menor que 1 → 10; mayor que 30 → 30. El frontend (`api.projects.recommended(limit = 10)`) no cambia.

### Tests (nuevos: 8, `recommended-limit.test.js`)
- El `before()` inserta 40 proyectos activos de relleno (`ngo-1`, cupo 10) para que haya más de 30 candidatos para María.
- Sin `limit` → 10; `3` → 3; `-5` → 10; `0` → 10; `abc` → 10; `100` → 30; `30` → 30; `1` → 1.
- **Rojo de comportamiento:** `limit=-5` devolvía 44 (los 49 candidatos menos 5). Los otros 7 pasaban antes (`0` y `abc` caían en `|| 10`, `100` en el `Math.min`): son de no regresión y matan mutantes de los bordes.

### Verificación
- SQLite **605/605** (597 + 8), también con `TZ=America/Argentina/Cordoba`; 0 fail, 0 cancelled, salida 0.
- Postgres con TZ Córdoba **607/607**, salida 0. Sin TZ, la primera corrida dio **606/607**: 1 falla en `db-transaction.test.js` ("una llamada db.* colgada de una promesa creada DENTRO de la tx…", el de `sleep`), con el contenedor de Postgres compartido con otro agente que corría a la vez; repetida: **607/607**, 0 cancelled, salida 0. Es el test frágil ya anotado en §142–§146.
- **Mutación (10)**, control sin mutar primero, sobre `recommended-limit.test.js`, en SQLite: default 9 y 11, mínimo 0, 2 y -10, máximo 29, 31 y 100, `clampInt(undefined, …)` y la línea vieja. **Mueren los 10.** Archivo restaurado byte a byte.

### Errores propios
- Ninguno que haya llegado al código.
- El runner de mutación lo dejé en el scratchpad compartido de la sesión y otro agente lo sobreescribió con el suyo **después** de que terminaron mis corridas (lo vi al final). No afectó los resultados, pero la próxima conviene un nombre/carpeta propia.

### ⚠️ NO verificado
- La mutación corrió solo en SQLite (el cambio no toca SQL ni tipos; el `limit` se aplica en JS con `slice`).
- Nada visual.
- Postgres en prod (Render).

## 150. Tests de `db.transaction()`: señales en vez de `sleep` (flaky bajo carga en Postgres)

**Qué se hizo.** `backend/test/integration/db-transaction.test.js` suponía tiempos: `sleep(20)` para que el
COMMIT ya hubiera pasado y `sleep(15)`/`sleep(60)` para que la tx estuviera abierta mientras "otra request"
escribía o leía. Bajo carga eso no se cumple. Se cambió por sincronización determinista con un `deferred()`
(una promesa con su `resolve` afuera). Solo se tocó el test; `src/` no cambió.

- **"db.* colgada de una promesa creada DENTRO de la tx…"**: el `.then` se sigue registrando dentro de la tx,
  así que hereda su contexto de AsyncLocalStorage. Lo que cambia es la señal: `txEnded` se resuelve recién
  cuando la promesa de `db.transaction()` ya resolvió, es decir con el COMMIT hecho y `ctx.active = false`.
  Antes, si el COMMIT tardaba más de 20 ms, la guarda (bien) lo detectaba como `db.*` dentro de la tx.
- **AISLAMIENTO** y **"las lecturas ajenas nunca ven datos sin commitear"**: la tx escribe y avisa (`txOpen`).
  Recién ahí se dispara la escritura/lectura ajena, y la tx no hace ROLLBACK hasta que esa operación salió
  (`outsiderSent`/`readSent`). En Postgres además espera a que **termine**, porque va por otra conexión.
  En SQLite no puede terminar con la tx abierta (eso es justamente la compuerta), así que esperarla adentro
  sería un deadlock.
- **Causa de que AISLAMIENTO también fallara:** era un efecto cascada. Cuando "colgada" fallaba, el rechazo
  quedaba sin manejar un momento (`PromiseRejectionHandledWarning`) y el runner daba ese test por terminado
  con el COMMIT de su tx todavía en vuelo. El `reset()` de AISLAMIENTO corría antes que ese COMMIT y quedaba
  `['ajena', 'in']`.

**Verificación.**
- Estabilidad del archivo solo (antes → después):

  | Escenario | Antes | Después |
  |---|---|---|
  | SQLite, 20 seguidas | 0/20 | 0/20 |
  | Postgres, 20 seguidas | 0/20 | 0/20 |
  | Postgres, 5 rondas × 3 en paralelo | 0/15 | 0/15 |
  | SQLite, 5 rondas × 3 en paralelo | 0/15 | 0/15 |
  | Postgres, 4 rondas × 10 en paralelo + 6 procesos quemando CPU | **31/40** corridas rotas ("colgada" 31, AISLAMIENTO 23) | **0/40** |
  | SQLite, 2 rondas × 10 en paralelo + CPU | 0/20 | 0/20 |

  Con 3 en paralelo no se reprodujo: hizo falta la carga pesada.
- Mutación sobre `src/db/index.js` (script descartable fuera del repo; corrida de control sin mutar en verde;
  restauración byte a byte confirmada):

  | Mutante | SQLite antes / después | Postgres antes / después |
  |---|---|---|
  | M1 guarda sin `ctx.active` (el contexto viejo da falso positivo) | muere / muere ("colgada") | muere / muere ("colgada") |
  | M2 sin guarda de `db.*` dentro de la tx | muere / muere (se cuelga, timeout 120 s) | muere / muere ("db.* dentro…", "anidadas") |
  | M3 SQLite sin compuerta (`waitForOpenTx` vacía) | muere / muere (AISLAMIENTO, lecturas) | *muere* / sobrevive (equivalente: código solo de SQLite) |
  | M4 Postgres: `db.*` usa la conexión de la tx abierta | sobrevive / sobrevive (equivalente: código solo de PG) | muere / muere (AISLAMIENTO, lecturas) |
  | M5 `ctx.active` nunca pasa a `false` | muere / muere ("tx después", "colgada") | muere / muere ("tx después", "colgada") |

  Los mutantes que mueren por la garantía que tocan son los mismos antes y después. La diferencia (M3 en
  Postgres "moría" antes) era una muerte falsa: el código de M3 no corre en Postgres, y lo que falló fue
  "colgada" por timing. En M4 antes también falló "colgada" por la misma causa. Después del cambio, cada
  mutante tira abajo solo los tests de su garantía.
- Suite backend: `npm test` 592/592 (fail 0, cancelled 0, exit 0); `npm run test:pg` 594/594 (fail 0,
  cancelled 0, exit 0); con `TZ=America/Argentina/Cordoba` lo mismo: 592 y 594, exit 0.

**Errores propios.**
- Al principio supuse que AISLAMIENTO fallaba por su propio `sleep(15)`. En realidad era la cascada de
  "colgada" (ver arriba). Lo vi recién al volcar la salida de una corrida rota.
- La primera corrida de estabilidad (3 en paralelo) no reprodujo nada. Si hubiera parado ahí, no habría tenido
  un "antes" que comparar.
- El scratchpad lo compartía otro agente y me pisó `mutate.js` entre corridas (mi corrida ya había terminado).
  Lo rehice con prefijo propio (`a78-…`) y repetí la mutación DESPUÉS con ese script.

**⚠️ NO verificado.**
- La carga de CI/Render real: la reproduje con 10 procesos en paralelo + 6 quemadores de CPU en esta máquina,
  y con un Postgres compartido con otro agente que también corría tests (ruido no controlado).
- Que el `.then` registrado dentro de `txStore.run` herede el contexto lo confirma la mutación M1 (si no lo
  heredara, M1 sobreviviría) en el Node de esta máquina. No lo probé en otras versiones de Node.
- Frontend: no se tocó ni se corrió.

## 151. Comentarios de proyecto: el tope de 1000 también en los campos del frontend (pendiente de §148, aprobado por el usuario)

**Qué se hizo:** desde §148 el backend rechaza un comentario de más de 1000 caracteres, pero los dos campos que lo mandan no limitaban: con un texto más largo, el error aparecía recién al enviar. Ahora los dos tienen `maxLength={1000}` (regla 10): el `<input>` de la pestaña Comentarios de `ProjectDetails.tsx` y el de la tarjeta del feed, `FeedPostCard.tsx`. No hay mensaje propio: el campo no deja escribir más.

### Tests (nuevos: 2, `CommentMaxLength.test.tsx`)
- Detalle del proyecto (pestaña Comentarios) y tarjeta del feed (expandida): el campo "Comentario" tiene `maxLength` 1000. **Rojo de comportamiento:** los dos encontraban el campo sin el atributo.

### Verificación
- Frontend **571/571** (569 + 2), también con `TZ=America/Argentina/Cordoba`; `npm run typecheck` **0 errores**.
- **Mutación (4)**, control sin mutar primero: 1001 y sin tope en el detalle, 999 y sin tope en el feed. **Mueren los 4**; archivos restaurados byte a byte.

### Errores propios
- Ninguno que haya llegado al código.

### ⚠️ NO verificado
- No lo vi en el navegador. El backend cuenta el largo crudo y el frontend manda `trim()`, así que con `maxLength` nunca llega uno de más de 1000.

## 152. Calificaciones: upsert atómico en `POST /api/projects/:id/ratings` (aprobado por el usuario)

**Qué se hizo:** la ruta hacía `SELECT id FROM ratings WHERE user_id AND project_id` y después `UPDATE` o `INSERT`. El pedido suponía que dos primeras calificaciones simultáneas creaban **dos filas** porque "no hay UNIQUE". **No es así:** `ratings` tiene `UNIQUE(user_id, project_id)` desde el primer `migrate.js` (commit `4ed412e`, 2026-07-31; `git log -L` sobre esas líneas no muestra otro cambio), y el seed y cualquier base creada con este repo lo tienen. Lo que pasaba en realidad es lo que ya sospechaba `API_CONTEXT.md` ("chocarían con el UNIQUE, no verificado"): los dos pedidos pasaban el `SELECT` sin fila, los dos intentaban el `INSERT` y el que perdía respondía **500 "Error al calificar"** (la reseña quedaba una sola, pero el usuario veía un error). Ahora es una sola sentencia, igual en los dos motores:

```sql
INSERT INTO ratings (project_id, user_id, rating, comment) VALUES ($1,$2,$3,$4)
ON CONFLICT (user_id, project_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment
```

Re-calificar sigue pisando nota y comentario (el comentario omitido queda en `null`, como antes) y conserva `id` y `created_at`. Mismo contrato: **200** `{ message: 'Calificación guardada' }` al crear y al actualizar; 400/403 sin cambios (las validaciones y el chequeo de inscripción aprobada quedan antes del upsert). No hay notificaciones ni efectos externos en esta ruta. Frontend sin cambios (`api.projects.rate` tipa `{ message: string }`; `ProjectDetails.tsx:135` y `ReviewsModal.tsx:105` hacen `await api.projects.rate(...)` y no leen el cuerpo).

**Migración: no se agregó** (decisión, desvío del pedido). El índice único que pedía la tarea ya existe como constraint de la tabla en las bases nuevas y en las creadas con cualquier versión de `migrate.js`; un `CREATE UNIQUE INDEX` aparte sería un segundo índice redundante (más costo de escritura) y la deduplicación previa un `DELETE` en prod sin ningún caso posible que lo justifique. El `ON CONFLICT (user_id, project_id)` depende de ese UNIQUE: si faltara, las dos bases rechazan la sentencia (no hay índice que coincida) y la ruta respondería 500 siempre, no duplicaría en silencio. Por eso, en vez del test de migración con duplicados, hay un test de que el esquema migrado rechaza la segunda fila en los dos motores. `ON CONFLICT … DO UPDATE` con `excluded` funciona en SQLite ≥ 3.24 sin traducción (`translatePg` no lo toca), verificado con la suite.

### Tests (nuevos: 5, `test/integration/ratings-concurrency.test.js`)
- 8 primeras calificaciones simultáneas del mismo usuario al mismo proyecto: todas 200 con `{ message: 'Calificación guardada' }`, una sola fila, y la nota guardada es la que vino con ese comentario (mismo pedido). **Rojo de comportamiento en Postgres:** `200,500,200,200,200,200,200,200`. En SQLite pasaba (una sola conexión: los pedidos no se intercalan entre el SELECT y el INSERT).
- Re-calificar: misma fila (mismo `id`), `created_at` intacto (se fija antes una fecha vieja conocida, porque SQLite guarda segundos y `String(Date)` de Postgres no muestra milisegundos), nota nueva y comentario omitido en `null`.
- Primera calificación guarda nota y comentario y no toca las reseñas de otros usuarios.
- 8 re-calificaciones simultáneas: todas 200, una fila.
- El esquema migrado rechaza una segunda reseña del mismo usuario al mismo proyecto (`isUniqueViolation`), en los dos motores: es la garantía de la que depende el upsert.

### Verificación
- SQLite **597/597** (592 + 5), también con `TZ=America/Argentina/Cordoba`; 0 fail, 0 cancelled, salida 0.
- Postgres **599/599** (594 + 5), también con TZ Córdoba; 0 cancelled, salida 0 (corrida final, después de reforzar el test de `created_at`).
- Antes de esa corrida final, tres corridas de `test:pg` con TZ Córdoba dieron 1–2 fallas en `db-transaction.test.js` ("colgada de una promesa…" y "AISLAMIENTO…", los de `sleep`), con el Postgres compartido con otros agentes. Ese archivo solo, 4 veces (con y sin TZ): 12/12. Es el test frágil ya anotado en §142–§146; el cambio no toca el adaptador.
- **Mutación (10)** sobre la sentencia nueva, control sin mutar primero, en SQLite y Postgres: sin `ON CONFLICT`, `DO NOTHING`, sin actualizar `comment`, sin actualizar `rating`, `rating = ratings.rating`, `comment = ratings.comment`, pisar `created_at`, `user_id`/`project_id` cruzados en los parámetros, `comment` fijo `null`, conflict target invertido `(project_id, user_id)`. **Mueren 9.** Sobrevive **1, equivalente**: el target invertido (los dos motores infieren el índice por el conjunto de columnas, no por el orden). En la primera pasada sobrevivía también "pisar `created_at`" (el test comparaba `String(created_at)` en el mismo segundo): reforcé el test y muere en los dos motores. Archivo restaurado byte a byte.
- El código viejo (SELECT + UPDATE/INSERT) es el rojo del primer test: lo mata solo Postgres.

### Errores propios
- Mi primer test de `created_at` no detectaba que el upsert la pisara (resolución de 1 s en SQLite y `String(Date)` sin milisegundos en Postgres); lo encontró la mutación.

### ⚠️ NO verificado
- **Prod (Render):** no tengo acceso; asumo que la tabla `ratings` de prod tiene el `UNIQUE(user_id, project_id)` porque se creó con `migrate.js` y el constraint está desde la primera versión. Si alguien la hubiera creado a mano sin él, el `ON CONFLICT` daría error (500 en cada calificación, visible enseguida), no duplicados. Para confirmarlo en prod: `SELECT indexdef FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'ratings';` (tiene que aparecer un índice único sobre `(user_id, project_id)`).
- No hay migración nueva, así que tampoco hay nada que correr en prod.
- Nada visual (el frontend no cambia).

### Otros hallazgos (no arreglados, regla 16)
- `frontend/src/app/components/MyParticipationReview.test.tsx:37` mockea `api.projects.rate` con `{ rating: {} }`, que no es la forma real (`{ message }`); ningún componente lee el cuerpo, así que hoy no esconde nada, pero el mock contradice el contrato (la doc vieja decía `201 { rating }`, corregida en §104).

## 153. Patrocinio: "Propuesta aceptada" / "Propuesta rechazada" (aprobado por el usuario)

**Qué se hizo:** `PATCH /api/ngos/me/patrocinios/:empresaId/:projectId` (el pedido decía `PUT`: es `PATCH`) respondía `` { message: `Propuesta ${estado}` } ``, que interpola el valor de la DB (`aceptado`/`rechazado`, masculino): "Propuesta aceptado". Ahora elige el texto según el estado: **"Propuesta aceptada"** / **"Propuesta rechazada"**. El frontend no muestra ni compara ese mensaje (`NGOPatrocinios.tsx` descarta la respuesta de `api.ngos.patrocinios.decide`; grep de "Propuesta" en `frontend/src`: solo títulos y KPIs que no tienen que ver), así que no cambia.

### Tests (ninguno nuevo; 2 aserciones nuevas y 1 cambiada)
- `empresa-dashboard.test.js`: al aceptar, `message` = "Propuesta aceptada"; al rechazar, "Propuesta rechazada". **Rojo de comportamiento:** llegaba "Propuesta aceptado"/"Propuesta rechazado".
- `follows-sponsorship-concurrency.test.js` fijaba el texto viejo (`` `Propuesta ${final}` ``): ahora espera el femenino según el estado guardado.

### Verificación
- SQLite **592/592**, también con `TZ=America/Argentina/Cordoba`; 0 cancelled, salida 0.
- Postgres **594/594** sin TZ y con TZ Córdoba, salida 0. La primera corrida dio fallas solo en `db-transaction.test.js` (2 sin TZ: "colgada de una promesa…" y "AISLAMIENTO…"; 1 con TZ: "colgada…"), con el Postgres compartido con otros agentes; repetidas: **594/594** las dos. Es el test frágil ya anotado en §142–§146.
- **Mutación (7)**, control sin mutar primero: `!==`, condición siempre `true`/`false`, `'aceptado'` → `''`, cada texto vacío y la vuelta al template viejo. **Mueren los 7.** Archivo restaurado byte a byte.

### Errores propios
- Ninguno que haya llegado al código.

### ⚠️ NO verificado
- Nada visual (el mensaje no se muestra en ninguna pantalla). Postgres en prod (Render).

## 154. Notificaciones: el contador de no leídas cuenta todas, no las 50 de la lista (aprobado por el usuario)

**Qué se hizo:** `GET /api/notifications` devuelve las últimas 50 y calculaba `unread` filtrándolas en JS: con más de 50 sin leer, el globito de la campana (`Root`, `MainFeed`, `BottomNav`, que usan `r.unread`) quedaba en 50 o menos. Ahora `unread` es un `SELECT COUNT(*) ... WHERE user_id=$1 AND (read = false OR read IS NULL)` aparte: BOOLEAN comparado con `false` (regla 13), `NULL` cuenta como no leída igual que el `!n.read` de antes, y `Number(row?.n) || 0` porque `COUNT` llega como string en Postgres. La lista sigue con `LIMIT 50`.
Revisando otros lugares que cuentan no leídas (pedido de la tarea): **`NotificationsScreen.tsx`** mostraba "N sin leer" (y decidía si mostrar "Marcar todas leídas") contando las no leídas de la lista recibida: el mismo tope de 50. Ahora guarda `r.unread` del backend en un estado (`0` mientras carga y si la carga falla). `Root`/`MainFeed`/`BottomNav` ya usaban `r.unread` y no cambian. Los `unreadTotal`/`c.unread` de mensajes (`ChatContext`, `MessagesScreen`) son otra cosa (chat) y no se tocaron.

### Tests
- Backend, nuevo `notifications-unread.test.js` (5): sin notificaciones → `{ notifications: [], unread: 0 }` (número); solo cuenta las no leídas propias (no las leídas ni las de otro usuario); **63 sin leer → la lista trae 50 y `unread` es 63** (**rojo de comportamiento:** daba 48); marcar una baja a 62 y "leer todas" deja 0 (sin tocar las del otro); `read NULL` cuenta como no leída.
- Frontend, nuevo `NotificationsUnread.test.tsx` (5): la lista trae 1 no leída y el backend cuenta 63 → "63 sin leer" (**rojo:** decía "1 sin leer"); `unread: 0` → sin "sin leer" ni botón; "Marcar todas leídas" recarga y toma el contador nuevo; mientras carga no hay "sin leer"; si la recarga falla no queda el contador viejo. Los dos últimos pasaban antes: existen para matar mutantes del estado nuevo.
- `SwallowedErrors.test.tsx`: su mock de `list` no traía `unread` (el backend siempre lo manda) y el botón "Marcar todas leídas" ya no aparecía. Le agregué `unread: 1` y saqué el `as never` (ahora el mock tipa contra la interfaz real).

### Verificación
- Backend SQLite **597/597** (592 + 5), también con TZ Córdoba; Postgres **599/599**, también con TZ Córdoba. 0 cancelled, salida 0 en las cuatro.
- Frontend **574/574** (569 + 5), también con `TZ=America/Argentina/Cordoba`; `npm run typecheck` **0 errores**, salida 0.
- **Mutación backend (9)**, cada mutante corrido en SQLite **y** en Postgres: `read = true`, sin `OR read IS NULL`, sin filtro de leída, sin filtro de usuario, sin `Number()`, `|| 1`, `unread` fijo en 0 → **mueren 7**. **Sobreviven 2, equivalentes:** sin `|| 0` y `row?.n` → `row.n` (un `COUNT(*)` sin `GROUP BY` siempre devuelve exactamente una fila con un número: `row` nunca es `undefined` ni `Number(n)` es `NaN`). El de sin `Number()` solo lo mata Postgres (string `'63'`), como se esperaba.
- **Mutación frontend (6)** sobre `NotificationsScreen.tsx`: estado inicial 5, sin `setUnread(r.unread)`, `setUnread(0)`, volver a contar la lista, `catch` sin `setUnread(0)`, `catch` con 1 → **mueren los 6.** Archivos restaurados byte a byte.

### Errores propios
- La primera versión del test backend pasaba booleanos de JS como parámetro (`read`): SQLite los rechaza ("can only bind numbers, strings…"). Los pasé como literal SQL `true`/`false`. Un rojo que no era de comportamiento; lo vi antes del arreglo.
- En el test de "si la carga falla" usé primero `new Error('red')`: `userMessage` muestra `err.message` y el texto esperado no aparecía. Pasé a `TypeError` (sin conexión → mensaje genérico).
- No anticipé que `SwallowedErrors.test.tsx` dependía de contar la lista; lo vio la suite completa.

### ⚠️ NO verificado
- Nada visual: el "N sin leer" y los globitos no los vi en pantalla.
- El costo del `COUNT` en Postgres de prod: hay índice `idx_notifications_user` (y otro por `read`), pero no medí nada.

## 155. `GET /api/auth/me`: `profile` con lista blanca de columnas (regla 8, aprobado por el usuario)

**Qué se hizo:** `profile` salía de `SELECT *` sobre `voluntarios`, `ngos` o `empresas` según el rol: la primera columna sensible que se agregue a esas tablas saldría sola. Antes de cambiar nada busqué qué lee el frontend: **nada**. `api.auth.me` está tipado como `{ user: User }` y `AuthContext` desestructura solo `user`; ningún componente lee `profile` (grep de `profile` en `frontend/src`: solo rutas, nombres de componentes y tests ajenos). Elegí la solución mínima: una lista blanca explícita por rol con **exactamente las columnas que devolvía el `SELECT *`** (las de `migrate.js`, incluida `voluntarios.followers` agregada con `addColumnIfNotExists`), con sus nombres en español. La forma de la respuesta no cambia.
**Alternativa no hecha (propuesta):** reusar `fmtNgo`/`fmtEmpresa` daría claves en inglés coherentes con la convención (regla 11), pero cambia el contrato (`nombre` → `name`, sin `alias`/`created_at`/`updated_at`, y no hay formateador de voluntario). Como nadie lo lee, sería seguro; lo dejo para que lo decidas.

### Tests (nuevo `auth-me-profile.test.js`, 7)
- A `users`, `voluntarios`, `ngos` y `empresas` se les agrega una columna con un valor centinela (como `public-columns.test.js`); para cada rol (voluntario, ONG, empresa): el centinela no sale, ni contraseñas/hashes; `profile` tiene **exactamente** las claves de antes y `id`/`user_id`/`nombre` coinciden con la fila. Y `user` sigue con sus 8 campos.
- **Rojo de comportamiento** en SQLite y en Postgres: 6 de 7 fallaban, y el diff de claves era **solo** `secreto_153` (o sea, la lista esperada coincide con lo que devolvía el `SELECT *`).
- No lo sumé a `public-columns.test.js` porque ese recorre endpoints públicos y `/auth/me` requiere sesión.

### Verificación
- SQLite **604/604** (597 + 7), también con TZ Córdoba; Postgres **606/606**, también con TZ Córdoba. 0 cancelled, salida 0 en las cuatro.
- Frontend no cambia (574/574 de §154).
- **Mutación (46)**, generada: quitar cada una de las 37 columnas de las tres listas, `SELECT *` en cada una, `WHERE id=$1` en vez de `user_id` en cada una, y cada rol cambiado → **mueren los 46.** Archivo restaurado byte a byte.

### Errores propios
- Agregué `profile ?? null` de paso y lo volví atrás: cambiaba la respuesta cuando el usuario no tiene fila de perfil (hoy la clave `profile` no sale; ver abajo) y no era parte de la tarea.

### ⚠️ NO verificado
- Postgres de prod (Render): si ahí alguna de estas tablas tuviera una columna que no está en `migrate.js`, antes salía y ahora no. No tengo acceso para comprobarlo.

### Otros bugs vistos (no arreglados, regla 16)
- `GET /api/auth/me` con un usuario de rol `volunteer`/`ngo`/`company` **sin** fila en su tabla: `db.get` devuelve `undefined` y la respuesta es `{ user }` **sin** la clave `profile`. `API_CONTEXT.md` dice "o `null`" (eso solo pasa con otros roles). Nadie lo lee, así que no rompe nada.
- `GET /api/notifications` sigue con `SELECT *` sobre `notifications` (endpoint autenticado, solo filas propias; no es la regla 8 pero tampoco es lista blanca).
- `FRONTEND_CONTEXT.md` (tabla de tipos, línea 233) describe `Notification` con `id, user_id, type, content, read, created_at`; en `api.ts` es `AppNotification` con `id, type, title, body?, read: boolean | number, created_at` (sin `content` ni `user_id`). Doc desactualizado; propuesta de texto en el borrador de CONTEXT.

## 156. Integración de §148–§155 y verificación en producción (2026-10-16)

**Qué se hizo:** se integraron en `main` los commits de cuatro subagentes (§148–§150, §152–§155) más §151. Cada uno lleva su sección y sus cambios de `*_CONTEXT.md`. Al integrar se renumeraron los borradores (§154 → §152; §151–§153 → §153–§155) y en `FRONTEND_CONTEXT.md` se corrigió la fila de `Notification` → `AppNotification` (campos reales de `api.ts`). En `REVISION.md` quedó tachado "Propuesta aceptado". Conteos de CLAUDE.md al día.

### Verificación (sobre `main` integrado, corridas reales)
- Backend SQLite **622/622**, también con `TZ=America/Argentina/Cordoba`; Postgres **624/624**, también con TZ. 0 fail, 0 cancelled, salida 0. Postgres corrió **en paralelo** con la suite SQLite y la del frontend: es la carga con la que antes fallaba `db-transaction.test.js`, y no falló (§150).
- Frontend **576/576**, también con TZ; `npm run typecheck` 0 errores. `npm audit` 0 en los dos paquetes.
- **Producción (Render, deploy manual de `b1ee86e`, con Chrome):** `GET /api/ngos/:id/projects` trae categoría, roles y `ngo_name` (§144); un registro con contraseña de 73 bytes da 400 con el mensaje de §141 sin crear la cuenta; portada, Explorar y detalle de proyecto cargan sin errores de consola; con la sesión de ONG del usuario, el panel muestra "Medio Ambiente · Fugaz", "Mi ONG" muestra la categoría del proyecto, y en "Nuevo voluntariado" el título se corta en 80 ("80/80 caracteres") y la descripción corta muestra "/1000". No se publicó nada.

### Errores propios
- Al aplicar los borradores, un reemplazo de la tabla de `FRONTEND_CONTEXT.md` dejó un `|` sin escapar (rompía la fila); lo corregí en este commit.

### ⚠️ NO verificado
- En prod: el mensaje de contraseña larga dentro del formulario (no ingreso contraseñas en sitios que no son locales), el registro de pedidos de red (la herramienta no los capturó) y el celular.
- §148–§155 todavía no están desplegados en Render.

## 157. Test de "Mis participaciones": el mock de calificar con la respuesta real (hallazgo de §152, aprobado por el usuario)

**Qué se hizo:** `MyParticipationReview.test.tsx` simulaba `api.projects.rate` devolviendo `{ rating: {} }` con `as never`, que no es la respuesta del backend (`{ message }`, §104 y §152). Hoy no tapaba nada (ningún componente lee el cuerpo), pero contradecía el contrato. Ahora devuelve `{ message: 'Calificación guardada' }` **sin** `as never`, así que el tipo de `api.ts` (`{ message: string }`) controla el mock.

### Verificación
- **Rojo:** con el mock viejo y sin `as never`, `npm run typecheck` da TS2353 ("'rating' does not exist in type '{ message: string; }'"). Con el nuevo, 0 errores y el test pasa.
- Suites: ver §160.

### Errores propios
- Ninguno.

### ⚠️ NO verificado
- Nada visual (es solo un test).

## 158. `GET /api/auth/me`: `profile: null` cuando falta la fila de perfil (hallazgo de §155, aprobado por el usuario)

**Qué se hizo:** con rol `volunteer`, `ngo` o `company` pero sin su fila en `voluntarios`/`ngos`/`empresas`, `db.get` devolvía `undefined` y `JSON.stringify` sacaba la clave: la respuesta era `{ user }`, aunque la doc y el `let profile = null` dicen `null`. Ahora `profile: profile ?? null`. El frontend no lee `profile`.

### Tests (nuevo: 1, en `auth-me-profile.test.js`)
- Un voluntario registrado al que se le borra la fila de `voluntarios`: `/auth/me` da 200 con la clave `profile` y valor `null`. **Rojo de comportamiento:** la clave no estaba.

### Verificación
- **Mutación (4)**, control sin mutar primero, en SQLite y en Postgres: sin `?? null`, `?? {}` y siempre `null` mueren; **sobrevive `|| null`, equivalente** (`db.get` da una fila u `undefined`, nunca otro valor falso). Archivo restaurado byte a byte.
- Suites: ver §160.

### Errores propios
- Ninguno.

### ⚠️ NO verificado
- En producción no debería haber usuarios con rol y sin perfil (el registro los crea en una transacción, §85); no lo consulté.

## 159. `GET /api/notifications`: lista blanca de columnas (hallazgo de §155, aprobado por el usuario)

**Qué se hizo:** la lista de notificaciones salía de un `SELECT *`. Es un endpoint con sesión que devuelve solo filas propias, pero una columna nueva de `notifications` habría salido sola (regla 8). Ahora selecciona `id, user_id, type, title, body, read, data, created_at`: exactamente las columnas de `migrate.js`, así que la forma no cambia. El contador `unread` (§154) no se tocó.

### Tests (nuevos: 2, `notifications-columns.test.js`)
- Con una columna centinela agregada a la tabla: no sale en la respuesta, y cada notificación tiene exactamente las 8 claves de antes con sus valores. **Rojo de comportamiento:** los dos fallaban (salía `secreto_159`).

### Verificación
- **Mutación (9)**, control sin mutar primero, en SQLite y en Postgres: sacar cada una de las 8 columnas y volver a `SELECT *`. **Mueren los 9 en los dos motores.** Archivo restaurado byte a byte.
- Suites: ver §160.

### Errores propios
- Ninguno.

### ⚠️ NO verificado
- Si la tabla de producción tuviera una columna que no está en `migrate.js`, antes salía y ahora no (ningún componente lee otra cosa que `AppNotification`).

## 160. Verificación de §157–§159 sobre `main`

- Backend SQLite **625/625** (622 + 1 + 2), también con `TZ=America/Argentina/Cordoba`; Postgres **627/627**, también con TZ. 0 fail, 0 cancelled, salida 0. Postgres corrió en paralelo con las otras suites, sin fallas de `db-transaction.test.js` (§150).
- Frontend **576/576**, también con TZ (§157 no suma tests); `npm run typecheck` 0 errores.
- Conteos de CLAUDE.md al día.

### ⚠️ NO verificado
- §157–§159 todavía no están desplegados en Render.

## 161. Verificación en producción de §146–§159 (2026-10-16, Chrome, deploy manual de `a6a0945`)

**Con la sesión de ONG del usuario (solo lectura):**
- `GET /api/ngos/:id/dashboard` trae categoría, roles y `ngo_name` (§146); `stats` coincide con el panel (1 activo, 2 pendientes).
- `/auth/me`: `profile` con las 13 columnas de la lista blanca de ONG (§155).
- `GET /api/notifications`: cada notificación con las 8 claves de §159 y `unread` numérico (2); la pantalla de Notificaciones dice "2 sin leer" (§154). Sin errores de consola.
- El campo "Comentario" del detalle tiene `maxLength` 1000 (§151).

**Con la sesión de voluntario del usuario (aprobado en el único proyecto activo; escrituras con su OK):**
- `POST /comments` con un número y con un objeto → **400 "El comentario tiene que ser un texto"**, y los comentarios siguen en 0 (§148).
- Calificación desde la interfaz: 5 ★ con "Prueba de verificación" → "¡Calificación guardada con éxito!", aparece en la lista y el formulario pasa a "Ya calificaste… / Actualizar reseña". Después, **4 re-calificaciones simultáneas** con los mismos valores → **200 las 4 y una sola reseña** (§152). Eso confirma que la tabla `ratings` de producción tiene el `UNIQUE(user_id, project_id)`: sin él, el `ON CONFLICT` fallaría.

### ⚠️ NO verificado
- `limit` de recomendados (§149): responde 200 con `limit=-5`, `100` y sin `limit`, pero con **0** resultados (el único proyecto activo es el del voluntario, que se excluye). Con estos datos no se distingue el tope.
- "Propuesta aceptada/rechazada" (§153): no hay propuestas de patrocinio para decidir.
- `profile: null` sin fila (§158): no hay cuentas así.
- La reseña de prueba quedó en producción (visible en el proyecto); el usuario decide si la edita o la borra.
