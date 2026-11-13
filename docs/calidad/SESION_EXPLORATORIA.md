# SESION_EXPLORATORIA.md — Sesión de prueba exploratoria #1 (frontend rediseñado)

> TP de Calidad. Primera sesión **exploratoria planificada**, con el formato de *session-based test management*
> (SBTM): un charter, un tiempo fijo, notas, hallazgos y lo que quedó sin cubrir. Antes había uso manual en
> producción, pero no sesiones con objetivo y tiempo fijo (el informe lo declaraba "a medias"). Detalle técnico en
> `PROJECT_ANALYSIS.md §245`.

## 1. Charter

| | |
|---|---|
| **Misión** | Explorar el **frontend rediseñado** (§240) con los **tres roles** (voluntaria, ONG, empresa), en **ancho de celular** y en **escritorio**, en **modo oscuro y claro**, para descubrir regresiones y problemas que la suite (Vitest + jsdom) no puede ver: navegación, estados vacíos y de error, contraste y textos. |
| **Fuera de alcance** | Pagos reales, subida de fotos, mails (los servicios externos se apagaron a propósito), el chat en tiempo real. |
| **Tiempo fijo** | 60 minutos planeados. Usados: **12 minutos de reloj** (18:49 a 19:01 del 22/10/2026), porque los recorridos se hicieron con scripts en el navegador y terminaron antes. |
| **Quién** | El asistente de IA (Claude, en Claude Code), manejando Chrome. **Sesgo:** es el mismo asistente que escribió buena parte del código; una persona del equipo o un usuario real verían otras cosas (ver §6). |
| **Versión** | `d0a5ed4` (el frontend es el de `7b05f02`, CI #36). |
| **Entorno** | Local: backend con una base SQLite descartable y los datos de prueba (`npm run db:reset` sobre un archivo del scratchpad); `RESEND_API_KEY` y `CLOUDINARY_*` vacías (no sale ningún mail ni se sube nada); sin Mercado Pago. Vite en `localhost:5173`. Chrome de escritorio; el celular se simuló con un **iframe de 390 px** del mismo origen (la ventana estaba maximizada y no se podía achicar). |

## 2. Heurísticas y recorridos usados

- **Recorrido por rol** (*tour* por cada usuario): visitante → voluntaria (María) → ONG (Sustentando) → empresa (TechCorp).
- **Estados vacíos y de error:** URLs que no existen, ids inexistentes, formularios vacíos o con espacios, contraseña equivocada.
- **Flujo cruzado entre roles:** la empresa propone un patrocinio → la ONG recibe la notificación → la notificación lleva a la pantalla correcta. La voluntaria se inscribe y cancela; la ONG acepta una postulación y se miran los contadores.
- **Comparar contra la fuente de verdad:** lo que muestra la pantalla contra lo que devuelve la API (`/api/projects`, `/api/projects/recommended`) y contra `DESIGN.md`.
- **Barrido de contraste automatizado** (herramienta dentro de la exploración): un script recorre cada pantalla de cada rol en modo oscuro y claro y calcula la relación de contraste WCAG de cada texto visible contra su fondo; lista lo que da menos de 3:1. Cubrió 30 rutas.

## 3. Hallazgos

| # | Hallazgo | Tipo | Sev. | ¿Del rediseño? | Evidencia |
|---|---|---|---|---|---|
| **H2** | **Explorar esconde 2 voluntariados a la voluntaria.** "Para vos" muestra 6 recomendaciones (`slice(0, 6)`), pero la lista "Todos los voluntariados" excluye las **8** que devuelve la API. "Digitalización de ONGs" y "Reciclaje Educativo en Escuelas" no aparecen en ningún lado sin filtros (12 activos: 6 + 4 visibles). Con una búsqueda sí aparecen. | Defecto | media | **Sí** (antes se mostraban todas las recomendaciones) | `ExploreScreen.tsx` (`recommendations.slice(0, 6)` y `genericProjects`); API: 8 recomendaciones, pantalla: 6 + 4 |
| **H8** | **"Enviar propuesta" (empresa) ilegible en modo oscuro:** texto blanco sobre `rgb(242,244,247)`, **contraste 1,10:1**. En claro está bien. `bg-violet-600` se remapeó a un color claro en oscuro y `text-white` quedó fijo. | Defecto (accesibilidad) | media | **Sí** (el modo oscuro es nuevo) | Barrido de contraste en `/company/profile` |
| **H11** | **El asistente da instrucciones de la interfaz vieja:** 3 de las 8 respuestas nombran cosas que ya no existen: "Mi Participación" (ahora "Mis voluntariados"), "el ícono de lápiz" (ahora "Editar perfil") y "Nuevo Voluntariado" en el panel (ahora "Crear"). Las respuestas viven en el backend (`scripts/migrate.js`) y el rediseño tocó solo el frontend. | Defecto (contenido) | baja | **Sí** | Pregunta "¿Cómo cancelo mi inscripción?" en `/messages/asistente` |
| **H9** | Pastilla "Aprobado" en el detalle del proyecto de la ONG: **2,71:1** en modo oscuro (`bg-green-50` + `text-green-600`). | Defecto (accesibilidad) | baja | Aparece con el modo oscuro (las clases son anteriores) | Barrido en `/ngo/dashboard/project/proj-1` |
| **H7** | Notificaciones vacías de la ONG: "Cuando **una ONG responda** o alguien te siga, aparece acá". Es el texto del voluntario; además, seguir a una ONG no genera notificación. | Defecto (texto) | baja | **Sí** | `/ngo/notifications` sin notificaciones |
| **H1** | Al cambiar de pantalla no se vuelve arriba: Explorar abrió con `scrollY = 1111` porque el Inicio estaba scrolleado. | Defecto | baja | No (no había restauración del scroll antes) | `window.scrollY` después de navegar |
| **H3** | Una URL que no existe muestra la pantalla de desarrollador de React Router ("Unexpected Application Error! 404 … Hey developer 👋"): no hay ruta `*` ni `errorElement`. Los ids inexistentes de proyecto, ONG y voluntario sí tienen su pantalla. | Defecto | baja | No | `/my-participation` |
| **H10** | KPIs sin indicadores: el texto de ayuda en `text-gray-300` da **1,57:1** en claro y 1,73:1 en oscuro. | Defecto (accesibilidad) | baja | No | Barrido en `/ngo/kpis/proj-1` |
| H4 | En el celular, la barra superior (campana y mensajes) aparece **solo en Inicio**. `DESIGN.md` dice "logo a la izquierda (solo en Inicio)", lo que sugiere que la barra sí iría en las otras pantallas. | Observación (a decidir) | — | Sí | `AppShell.tsx`, `TOP_BAR_PATHS` |
| H5 | Dos pantallas no rehechas siguen con `window.confirm` nativo (retirar un patrocinio en el perfil de la empresa y borrar un KPI); el resto usa los diálogos propios del rediseño. | Inconsistencia | — | Pantallas no rehechas | `CompanyOwnProfile.tsx:95`, `NGOKPIs.tsx:101` |
| H6 | "Cerrar sesión" en la barra lateral sale sin preguntar; en Configuración pide confirmación. | Inconsistencia | — | Sí | `AppShell.tsx:130` contra `SettingsScreen.tsx:35` |
| H12 | En "Nuevo voluntariado", en modo oscuro, el paso activo del indicador se distingue poco de los demás (pantalla no rehecha; el azul se remapeó a neutro a propósito). | Observación visual | — | Pantalla no rehecha | Captura del paso 1 |

**Resumen:** 8 defectos (2 de severidad media, 6 baja) y 4 observaciones. **6 de los 8 defectos llegaron con el rediseño** y la suite no los podía ver: dos son de contraste (jsdom no pinta), uno es de datos en otra capa (las respuestas del asistente) y uno depende de que la API devuelva más recomendaciones de las que se muestran (los tests usan menos de 6).

## 4. Lo que funcionó bien (también es resultado)

- Ingreso: campos vacíos y contraseña equivocada con su mensaje; ingreso correcto lleva a la pantalla de cada rol.
- Inscribirse y cancelar la postulación (con el diálogo propio, no el nativo); el contador de la pestaña se actualiza.
- La ONG acepta una postulación: "Voluntarios" del panel pasa de 43 a 44 y el cupo del proyecto de 23 a 24 (comparado con la API).
- Flujo cruzado empresa → ONG: la propuesta aparece en "Patrocinios" de la ONG, con su notificación, y la notificación lleva a `/ngo/patrocinios`.
- Ids inexistentes de proyecto, ONG y voluntario: pantalla propia, sin romper.
- Validaciones: nombre de perfil con solo espacios, paso 1 de "Nuevo voluntariado" vacío (marca los dos campos y baja hasta el error).
- El asistente responde las preguntas sugeridas y, ante una pregunta sin respuesta, ofrece las sugeridas.
- Barrido de contraste: 28 de las 30 rutas sin textos por debajo de 3:1 en ninguno de los dos modos. H8 no salió en el barrido de rutas sino al medir con el formulario de propuesta abierto: el barrido mira cada pantalla en su estado inicial.

## 5. Sin cubrir en esta sesión (⚠️ no verificado)

- **Teclado real:** la herramienta no mueve el foco con Tab (el foco quedaba en `body`). Solo se comprobó que los elementos tienen un estilo de foco definido.
- **Un teléfono real:** el iframe de 390 px no es táctil, no tiene zona segura ni teclado en pantalla.
- Mapa, donación con Mercado Pago, subida de fotos y CV, mensajes en tiempo real, borrar la cuenta.
- La pantalla de escritorio de la ONG y de la empresa se miró poco: casi todo fue en ancho de celular.

## 6. Lectura

- La sesión encontró en 12 minutos **defectos que la suite de 939 tests no podía encontrar**, sobre todo visuales y de contenido. Es la brecha "sin E2E de interfaz" del informe, ahora medida.
- **H2 es el más interesante:** pasa con los datos reales de la semilla (8 recomendaciones) y no con los de los tests (menos de 6). Es el principio de **dependencia del contexto**: los datos de prueba eran demasiado chicos.
- **H11 cruza capas:** el contenido del asistente está en el backend y el cambio de nombres fue en el frontend. Ningún test relaciona los dos.
- El sesgo del explorador es real: buscó con las mismas herramientas con las que se construyó. Una segunda sesión con una persona y otro charter (por ejemplo, "una ONG nueva publica su primer voluntariado") daría otra mirada.

## 7. Qué se hizo con los hallazgos

Ninguno se corrigió en la sesión (la exploración informa, no arregla). Después, a pedido del usuario:

- **Los 8 defectos se abrieron como Issues antes de arreglarse** (D22–D29 = #23–#30, label `encontrado:exploratoria`): es el primer ciclo de vida completo del registro (reportado → triage → corregido con su test → verificado en el CI → cerrado). Los tres corregidos se cierran cuando su test pase en el CI.
- **Corregidos con un test que primero falló (§246):**
  - H2 → D22 (`358789a`);
  - H8 → D23 (`3d9a2ba`): el test estático de contraste encontró **otras 5 combinaciones** del mismo defecto, y se corrigieron las 7;
  - H11 → D24 (`c538022`): además, `migrate.js` no actualizaba las FAQs ya cargadas, así que el arreglo del texto no habría llegado a producción.
- **Después, los otros cinco (§247):** D25 (H9) y D29 (H10) con el test de contraste ampliado a textos de color, como **trinquete** (22 casos conocidos de pantallas sin rehacer quedaron listados: no podían aparecer nuevos y la lista solo podía bajar; en §248 se bajó a 0); D26 (H7), D27 (H1) y D28 (H3) con su test. **Los 8 defectos están corregidos.** Las observaciones H4, H5, H6 y H12 no se registraron como defectos: son decisiones de diseño.

---

# Sesión de prueba exploratoria #2 (todo el frontend contra `DESIGN.md`)

> Hecha el 12/11/2026 a pedido del usuario. El detalle de cada tanda, con archivo y línea, está en
> `docs/PLAN_FEBRERO.md` → "Para retomar" → 2a, 2b y 2c. Detalle técnico en `PROJECT_ANALYSIS.md §330`.

## 1. Charter

| | |
|---|---|
| **Misión** | Comparar **todo el frontend** con `docs/DESIGN.md` 1.1 para encontrar lo que no lo cumple, con prioridad en las pantallas que el rediseño (§240) dejó solo con la paleta remapeada y en las que se hicieron después del diseño (equipo, entrevistas, patrocinio, validación, postulaciones). |
| **Fuera de alcance** | Arreglar (regla 16: el usuario elige las tandas). Pagos, subida de fotos y mails (servicios externos apagados). |
| **Tiempo fijo** | No se fijó. Fueron tres tandas en una misma sesión de trabajo; no se midió el reloj de cada una. |
| **Quién** | El asistente de IA (Claude, en Claude Code). **Sesgo:** el mismo de la sesión #1, es quien escribió buena parte del código. |
| **Versión** | `1088775` (la de producción el 12/11). |
| **Entorno** | Local: backend con una base SQLite descartable (seed, más un patrocinio con puntos y dos versiones, tres KPIs y una entrevista cargados por la API); `RESEND_API_KEY` y `CLOUDINARY_*` vacías; Vite en `localhost:5173`; Chrome de escritorio. El ancho de celular es un marco de 375 px dentro de la página. |

## 2. Heurísticas y recorridos usados

- **Barrido por código (2a):** una lista de reglas sacada de "Hacer y no hacer", "Accesibilidad", "Paneles de gestión" y "Comportamiento responsive", buscada con Grep en los 117 archivos fuente de `frontend/src`, más un script que lee cada etiqueta tocable y su alto.
- **Inventario de pantallas (2b):** cada pantalla contra su sección de `DESIGN.md` (o contra las reglas de los paneles si no tiene sección), con *igual / distinto / falta / sobra*, leyendo el código.
- **Recorrido por rol en Chrome (2c):** visitante, voluntaria (María), miembro de equipo (Sofía), ONG (Sustentando) y empresa (TechCorp).
- **Medición automática dentro de la exploración:** un script cargó 56 pantallas a 375 y 1440 px, en claro y oscuro (224 corridas), y 7 más a 768 y 1024 px. En cada una midió scroll horizontal, contraste WCAG de cada texto contra su fondo (4,5:1, o 3:1 en texto grande), botones de ícono de menos de 44 px, texto de menos de 12 px y qué elementos usan el azul y el verde. No mide textos sobre fotos ni elementos con opacidad.
- **Capturas** de las pantallas dudosas (unas 15 vistas), incluidos el mapa y la hoja de filtros abiertos en oscuro.

## 3. Hallazgos

### Defectos (algo se rompe o no se puede leer)

| # | Hallazgo | Tipo | Sev. | Evidencia |
|---|---|---|---|---|
| **C1a** → D33 | **Panel de impacto de la empresa con scroll horizontal a 375 px:** 76 px de más. Se cortan las cifras ("Propuestas pendien…") y el estado de cada proyecto queda fuera de la pantalla. | Defecto (responsive) | media | Medición (`scrollWidth` 451 en un marco de 375) y captura de `/company/dashboard` |
| **C1b** → D34 | **Propuestas de patrocinio de la ONG con scroll horizontal a 375 px:** 48 px de más. Se corta el botón "Rechazar" y el texto de la propuesta. | Defecto (responsive) | media | Medición (423 en 375) y captura de `/ngo/patrocinios` |
| **C3** → D35 | **Hoja de filtros de Explorar en oscuro: "Mostrar 12 voluntariados" no se lee.** El botón es `bg-ink text-white`: en oscuro `ink` es casi blanco. | Defecto (accesibilidad) | media | Captura; `FilterModal.tsx:380`. Por cuenta, 1,10:1 |
| **C2** → D36 | Globito de no leídos: blanco sobre `like`, **3,91:1** en claro y **3,02:1** en oscuro, con texto de 11 px. | Defecto (accesibilidad) | baja | Medición en el Panel de la ONG; `AppShell.tsx:39`, `NGODashboard.tsx:195` |
| **B2/C5** → D37 | El detalle del voluntariado de la ONG muestra lo recaudado como **`$8,500`**: `toLocaleString()` sin `es-AR` y el `$` pegado. | Defecto (formato) | baja | Captura de `/ngo/dashboard/project/proj-1`; `NGOProjectDetail.tsx:170` |
| **C4** → D38 | Pie fijo de "Nuevo voluntariado": entre 768 y 1023 px queda corrido respecto del formulario (arranca a 240 px con la barra lateral de 72); a 375 px deja una rendija de 8 px sobre la barra inferior por la que se ve el formulario. | Defecto (visual) | baja | Capturas a 900 y 375 px; `CreateVoluntariado.tsx:622` (`md:left-60`, `bottom-16`) |
| **C6** → D39 | Contraste **4,32:1** en claro: "Última actualización" de Privacidad y el título "Pendientes (2)" de las propuestas de patrocinio (`text-gray-400` sobre `bg-gray-50`). | Defecto (accesibilidad) | baja | Medición en `/privacidad` y `/ngo/patrocinios` |
| **C3b** → D40 | Dos textos de la hoja de filtros en tuteo: "Personaliza tu búsqueda de voluntariados" y "Elige según el tiempo y dedicación que desees aportar". El resto de la app usa voseo. | Defecto (texto) | baja | Captura; `FilterModal.tsx:159` |

### Deuda contra `DESIGN.md` (funciona, pero no es lo que dice el diseño)

| # | Qué | Dónde |
|---|---|---|
| I1 | **Pantallas que siguen con la forma vieja** (colores nuevos por el remapeo; botones, campos y diálogos propios; títulos de 16 px). | `NGOProjectDetail`, `NGOKPIs`, `NGOPatrocinios`, `CreateVoluntariado` (3 pasos, el diseño pide 5), `ReviewsModal`, `FilterModal`, `ProjectMap`, `CompanyOwnProfile` (edición y lista), `MercadoPagoAccount` (sección del perfil), `MercadoPagoReturn`, `DonationReturn`, `DeleteAccountPage`, `PrivacyPage`, `FollowListModal`, `NGOMoments`, `MomentsGrid`, `LocationPicker`, media `CompanyDashboard` |
| B3/C11 | **Verde que no es personas.** | Botones de `DonationReturn`, `MercadoPagoReturn`, `NGOPatrocinios` ("Aceptar"), `CreateVoluntariado` ("Publicar"), `ReviewsModal`, `ProjectMap`; enlaces de `PrivacyPage` y `MomentsGrid`; spinners; iniciales; chips por rol y por tipo; valores de los KPIs |
| B4/C11 | **Azul que no es dinero.** | 13 enlaces azules subrayados (entrevistas, calendario, "Ver acuerdo") y el chip de filtro elegido de `NGOProjectDetail` |
| B8/C7 | **Botones de ícono de menos de 44 px** (decisión del 12/11: 44 solo para íconos). | Medidos entre 28 y 40 px: "Volver" y "Compartir" del voluntariado, estrellas para puntuar, "Volver" de KPIs, crear y detalle, editar y borrar KPI, mensaje al inscripto, retirar propuesta, sacar del equipo, controles del mapa, "Cerrar" de cuatro diálogos |
| B1 | Queda un `window.confirm` (era H5 en la sesión #1). | `CompanyOwnProfile.tsx:125` |
| B9 | Spinner a pantalla completa donde el diseño pide esqueletos. | `CreateVoluntariado`, `CompanyOwnProfile`, `NGOProjectDetail`, `TeamPanel`, `RequireRole` |
| B5/B7 | Clases que ya no dibujan lo que dicen: unas 597 de la paleta vieja en 29 archivos y 48 sombras. | Sobre todo `ProjectMap` (95), `CreateVoluntariado` (79), `NGOKPIs` (53) |
| B6/C10 | Colores fijos que no cambian en oscuro. | Chip "Participó" de `ReviewsModal`; fondo del mapa |
| C8/B10 | Texto de menos de 12 px. | Iniciales de los avatares de 32 px (11 px); los dos globitos de no leídos |
| C9 | El avatar de la cuenta en la barra muestra a la persona (iniciales en círculo), no el logo cuadrado de la ONG o la empresa. El logo de una empresa sin foto sale con color (DiceBear) donde no pasa por `Avatar`. | `AppShell`; `NGOPatrocinios` |
| I3 | **Insignia de verificada**: el dato solo llega en voluntariados y en el perfil de la ONG. Falta, y necesita backend, en "ONGs para seguir", mensajes, notificaciones, listas de seguidos y Mis voluntariados. | `FeedSidebar`, `MessagesScreen`, `ChatThread`, `NotificationsScreen`, `FollowListModal`, `MyParticipation`, `PostCard` |
| I2 | Las pantallas hechas después del diseño siguen las reglas de los paneles, pero **no tienen sección en `DESIGN.md`**; el mismo botón está copiado en cuatro archivos en vez de usar `ui/Button`. | Acuerdo e historial de patrocinio, postulaciones, validación, admin, equipo, entrevistas, restablecer contraseña, transparencia, certificado |
| B10 | Chicos: corazón como ícono de Mercado Pago y del rol ONG; emojis en el resumen de "Nuevo voluntariado"; "Ver Proyecto", "KPIs de Impacto", "Reseñas y Calificaciones" con mayúsculas de título; el tipo en minúscula ("fugaz") en el detalle de la ONG. | `navConfig`, `AuthModal`, `CreateVoluntariado`, `ProjectMap`, `NGOKPIs`, `ReviewsModal`, `NGOProjectDetail` |

**Resumen:** 8 defectos (3 de severidad media, 5 baja) y 13 grupos de deuda de diseño. Los tres de severidad media están en pantallas que no se rehicieron en §240 o se rehicieron a medias.

## 4. Lo que funcionó bien (también es resultado)

- Las 15 pantallas de la voluntaria y las 9 del visitante: sin fallas de contraste ni scroll horizontal en ninguno de los cuatro modos (salvo la línea de Privacidad, C6).
- El acuerdo y el historial de patrocinio, postulaciones, validación, equipo, mensajes y notificaciones: sin hallazgos en la medición.
- A 768 y 1024 px, sin scroll horizontal en las 7 pantallas medidas.
- Por código: 0 degradés, 0 `alert()`, 0 imágenes sin `alt`, 0 `fetch` fuera de `api.ts`, `lang="es"`, y ningún botón sin texto ni nombre accesible (con una heurística que deja pasar casos).

## 5. Sin cubrir en esta sesión (⚠️ no verificado)

- Las hojas de donar, inscribirse y reseñas, y el compositor de publicaciones.
- Publicaciones y Momentos con fotos (el seed no trae y no se subió nada).
- Notificaciones de rechazo: los globitos `bg-ink-muted text-white` darían 2,96:1 en oscuro **por cuenta**; no se vieron.
- Validación y admin con un pedido cargado; el certificado.
- El mapa de Explorar en oscuro: el fondo queda claro y en esta corrida no cargaron las imágenes del mapa; no se sabe si es del entorno de prueba.
- La navegación a 768 y 1024 px más allá del scroll horizontal, y el modo oscuro en esos anchos.
- Foco con teclado, texto al 200 %, lector de pantalla y un celular real.
- No se guardaron las capturas en disco: la evidencia que queda son las mediciones y las líneas de código.

## 6. Lectura

- **La medición automática encontró lo que el código no mostraba:** los dos scroll horizontales (C1) no salen de ninguna búsqueda; salen de cargar la pantalla con datos a 375 px. La sesión #1 había anotado que el escritorio de la ONG y la empresa "se miró poco"; esta vez lo que faltaba era el celular de la empresa.
- **El trinquete de contraste tiene un hueco:** `paletteContrast.test.ts` exige 4,5:1 al `text-white` sobre la paleta, pero no mira `bg-ink`, `bg-ink-muted` ni `bg-like`. D35 es el mismo defecto que D23 (1,10:1 en oscuro) en una combinación que el test no conoce.
- **El remapeo de la paleta tapa la deuda:** las pantallas viejas se ven "del rediseño" de lejos, y por eso nunca se revisaron. La deuda está concentrada: nueve archivos tienen el 76 % de las clases viejas.
- `DESIGN.md` se contradecía (44 px para todo lo tocable, y botones de 40 y chips de 32). El usuario decidió el 12/11: 44 solo para los botones de ícono.

## 7. Qué se hizo con los hallazgos

Ninguno se corrigió en la sesión. Los 8 defectos quedaron en `REGISTRO_DEFECTOS.md` como D33–D40 (Issues #34–#41). **Después de la sesión:** D33–D36 y D39 se corrigieron el 12/11 (§331); D37, D38 y D40 siguen abiertos. La deuda de diseño no se registra como defecto: se arregla por tandas que elige el usuario (`PLAN_FEBRERO.md`, paso 2e).
