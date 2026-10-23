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
- **Siguen abiertos:** D25 (H9), D26 (H7), D27 (H1), D28 (H3) y D29 (H10). Las observaciones H4, H5, H6 y H12 no se registraron como defectos: son decisiones de diseño.
