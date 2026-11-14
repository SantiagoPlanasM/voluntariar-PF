# PLAN_FEBRERO.md — Lo que sigue hasta la presentación final

> Estado al 13/11/2026. El 5/11 fue la presentación de avances; la final es **después de febrero** (falta la fecha exacta).
> El proyecto es académico y no se lanza al mercado, pero se sigue mejorando. Las reglas de trabajo no cambian (`CLAUDE.md`).
> Producción está en `f1ebd2e` o posterior (CI, Deploy y SonarCloud en verde el 13/11, 0 issues abiertas). Investigación de pagos:
> [informe de Mercado Pago](https://claude.ai/artifact/WF4evt666tG7cXNkGWJGc2).

## Para retomar (próxima sesión)

En este orden:

1. [x] **Patrocinio, paso 5: proponer con puntos** (§329, 12/11). En producción (`1088775`): CI, Deploy (smoke y E2E)
   y SonarCloud en verde. Falta la prueba del usuario en la interfaz.
2. **Revisión de todo el frontend contra el diseño** (pedido del 12/11). **Lo próximo.** El diseño es `docs/DESIGN.md` (1.1, el
   rediseño de §239–§240). Va después del paso 5 para que cubra las pantallas del patrocinio ya terminadas. Son varias
   sesiones: se hace por tandas y **no se arregla nada sin que el usuario elija** (regla 16).
   - **a. Barrido por código** (barato, sin navegador). Lista de reglas sacada de "Hacer y no hacer", "Accesibilidad",
     "Paneles de gestión" y "Comportamiento responsive", buscada con Grep en `frontend/src`:
     colores fuera de los tokens (hex sueltos, `yellow`/`amber`/`orange`, colores por categoría o por rol);
     azul que no sea dinero o marca y verde que no sea personas; degradés; sombras en el feed y en los paneles;
     tarjetas dentro de tarjetas; `alert()`/`window.confirm()`; tocables de menos de 44 px (`h-8`, `w-8`, `p-1` en
     botones de ícono); íconos sin nombre accesible; fechas y números sin `es-AR` (`toLocaleString()` pelado, ya
     anotado en `NGOProjectDetail`); corazón usado para "seguir"; insignia de verificada que falte donde aparece una ONG.
     - [x] **Hecho el 12/11** sobre los 117 archivos fuente de `frontend/src` (sin tests). Solo Grep y un script que
       lee las etiquetas tocables: **nada se miró en un navegador** y nada se arregló. Hallazgos (B = barrido):
       - **B1. `window.confirm`**: queda uno, `CompanyOwnProfile:125` (retirar propuesta). `alert()`: 0.
       - **B2. Formato argentino**: `NGOProjectDetail:170` (`$` pegado y `toLocaleString()` sin `es-AR`);
         `ReviewsModal:158` (promedio con punto, "4.5"); `formatPesos` escribe `$32.000` sin espacio
         (`DonationReturn` y los mensajes de monto mínimo y máximo). Hay cuatro formas de escribir plata:
         `formatPesos`, `formatMoney`, el `nf` de `Meter` y un `money()` local.
       - **B3. Verde que no es personas** (se ve): botones verdes en `DonationReturn:66,78`, `MercadoPagoReturn:44`,
         `NGOPatrocinios:93`, `CreateVoluntariado:573,637`, `ReviewsModal:244`, `ProjectMap:571,810`; enlaces verdes
         en `PrivacyPage:22` y `MomentsGrid:103`; spinners verdes (`FollowListModal`, `ReviewsModal`, `RequireRole`,
         `NGOMoments`); iniciales sobre verde (`FollowListModal:81`, `ReviewsModal:287`); chips verdes por rol y por
         tipo (`NGOEmpleados:61`, `NGOKPIs:13`); bloque verde de la reseña (`ReviewsModal:186`).
       - **B4. Azul que no es dinero**: 13 enlaces `text-brand-text underline` (`MyParticipation` 5, `InterviewPanel` 3,
         `ProjectDetails` 2, `CompanyOwnProfile` 2, `NGOPatrocinios` 1; el diseño pide `ink` peso 600) y el chip de
         filtro elegido de `NGOProjectDetail:215` (`bg-brand`).
       - **B5. Paleta vieja** (no se ve, por el remapeo de `theme.css`; es deuda): unas 597 clases `gray/blue/emerald/…`
         en 29 archivos, 452 en nueve: `ProjectMap` 95, `CreateVoluntariado` 79, `NGOKPIs` 53, `ReviewsModal` 51,
         `FilterModal` 43, `NGOProjectDetail` 40, `NGOEmpleados` 37, `CompanyOwnProfile` 30, `NGOPatrocinios` 24.
       - **B6. Colores fijos que no cambian en oscuro**: `ReviewsModal:294` (`bg-[#e4f1e0] text-[#255f24]`),
         `ProjectMap:473,476,705,709` (fondo del mapa), `FeedPostCard:180` (`text-[#d12d21]` sobre chip blanco:
         puede ser a propósito). `CATEGORY_COLORS` de `ProjectMap` quedó con todas las categorías iguales (sobra).
       - **B7. Sombras**: 48 `shadow-sm/md/xs` que ya no dibujan nada (remapeadas). Visibles fuera de lo que flota:
         `CreateVoluntariado` (3, dos con color), `ProjectMap` (4) y el pin de `mapTiles`.
       - **B8. Tocables de menos de 44 px**: 69 con alto explícito (28 px: 5, 32 px: 23, 36 px: 17, 40 px: 24). Los
         de 40 y los chips de 32 siguen los tamaños del propio `DESIGN.md` (`button-md`, `chip`), que choca con
         "todo lo tocable mide 44". **Decidido el 12/11:** 40 y 32 quedan; 44 solo para los botones de ícono
         (`DESIGN.md` → Accesibilidad ya lo dice así). Los que hay que mirar son los botones de ícono de 28 a 40 px:
         `ProjectMap` 11, `NGOKPIs` 4, `NGOProjectDetail` 3, `CompanyOwnProfile:373` y los "Cerrar" de
         `FilterModal`, `FollowListModal`, `ReviewsModal` y `MomentsGrid`. El script no ve botones sin alto explícito.
       - **B9. Spinner a pantalla completa** (el diseño pide esqueletos): `CreateVoluntariado:192`,
         `CompanyOwnProfile:153`, `NGOProjectDetail:121`, `TeamPanel:33`, `RequireRole:33`. Hay esqueletos en 14 pantallas.
       - **B10. Chicos**: dos contadores a 11 px (`AppShell:39`, `NGODashboard:195`); mayúsculas en
         `CertificatePage:48`; corazón como ícono de Mercado Pago (`navConfig:97`) y del rol ONG (`AuthModal:128`);
         emojis en el paso "Revisar" de `CreateVoluntariado:602,604`; `rounded-3xl` en `ProjectMap`.
       - **B11. Insignia de verificada**: la muestran 6 componentes. Nombran una ONG sin ella, entre otros,
         `VolunteeringTile`, `FeedSidebar`, `PostCard`, `MainFeed`, `MyParticipation`, `CompanyPublicProfile`,
         `VolunteerProfile`, `VolunteerPublicProfile`, `ProjectMap` y `CertificatePage`. **Sin confirmar** en cuáles
         el endpoint manda el dato: se mira en 2b.
       - **Sin hallazgos**: degradés (0), `alert()` (0), `<img>` sin `alt` (0), botones sin texto ni `aria-label` (0,
         con una heurística que deja pasar casos), `fetch` fuera de `api.ts` (0), "Voluntariar" (0), `lang="es"`.
       - **No se puede ver por código**: tarjetas dentro de tarjetas, sombras en el feed, contraste real y todo lo
         visual. Queda para 2c.
   - **b. Inventario de pantallas**: cada sección de `DESIGN.md` (Componentes, 1.1 y Paneles) contra su componente, con
     *igual / distinto / falta / sobra*. Prioridad a las que **nunca se revisaron**:
     - las que §240 dejó solo con la paleta remapeada: `NGOProjectDetail`, `NGOKPIs`, `NGOPatrocinios`,
       `CreateVoluntariado`, `ReviewsModal`, `FilterModal` (`NGOEmpleados` se saca en la Etapa 4: no revisarla);
     - las que se hicieron **después** de `DESIGN.md` 1.1 y no tienen sección propia: equipo de la ONG (`NGOTeam`,
       `TeamPanel`, `TeamInvites`), entrevistas (`InterviewPanel`), patrocinio (acuerdo e historial; ahí sumar el
       [lienzo del 11/11](https://claude.ai/artifact/EvgwaAnYzYoiTzpAPSX6BZ)), validación de ONG y admin
       (`NGOValidation`, `AdminValidations`), postulaciones (`NGOApplications`), ingreso con Google, Mercado Pago
       (`MercadoPagoAccount`, retornos), certificado, restablecer contraseña, transparencia.
     - [x] **Hecho el 12/11**, leyendo el código de cada pantalla (no el navegador). Tres grupos (I = inventario):
       - **I1. Siguen con la interfaz vieja** (colores nuevos por el remapeo, forma vieja): no usan `ui/Button`, ni
         `fieldStyles`, ni `Sheet`; títulos de 16 px en vez de `title-lg`; "Volver" de 36 px; bloques `bg-white` con
         `rounded-2xl` y `shadow-sm` muerta.
         - `NGOProjectDetail`: **distinto**. Dos cajitas con barras propias en vez de `Meter`; chip de filtro azul;
           iniciales sobre azul en vez de `Avatar`; botones de ícono de 28 px (CV y mensaje, este sin `aria-label`,
           solo `title`); "Aprobar" verde suave; botón "KPIs" en vez de "Impacto".
         - `NGOKPIs`: **distinto** de "Reportes de impacto". **Falta** el gráfico por mes y "Publicar como dato de
           impacto"; **sobra** el ícono con fondo en cada fila y el chip de color por tipo; título "KPIs de Impacto".
         - `NGOPatrocinios`: **distinto**. "Aceptar" verde (aceptar un patrocinio no es inscribirse), enlace azul,
           iniciales de la empresa sobre gris con otra forma que `Avatar kind="org"`, spinner en vez de esqueleto.
         - `CreateVoluntariado`: **distinto**. Tiene 3 pasos y el diseño pide 5 (**falta** "Dinero" como paso y
           "Revisar" con la tarjeta tal como se ve en el feed; hoy es un resumen de texto con emojis); arriba hay
           barra **y** pastillas de pasos; "Continuar" con sombra de color y "Publicar Voluntariado" verde; no guarda
           borrador al salir; el pie fijo usa `md:left-60` (240 px) y la barra lateral mide 72 o 244: **mirar en 2c**.
         - `ReviewsModal`: **distinto**. Es un diálogo propio, no `Sheet`; el promedio va en una caja con chip
           "Excelente/Muy bueno"; formulario en caja verde; chip "Participó" con color fijo; **falta** "Participó en
           … · abril 2026" y "Reseñas de personas que participaron"; título "Reseñas y Calificaciones".
         - `FilterModal`: **distinto**. Diálogo propio; "Categorías de Impacto"; "Personaliza tu búsqueda" (tuteo);
           "Cerrar" de 32 px sin `aria-label`; el botón "Mostrar N voluntariados" es `bg-ink text-white`: en oscuro
           sería blanco sobre casi blanco (**mirar en 2c**).
         - También viejas, fuera de esa lista: `CompanyOwnProfile` (formulario de edición y lista de patrocinios; lo
           de §329 ya usa tokens), `MercadoPagoAccount` (la sección del perfil; el aviso del Panel está bien),
           `MercadoPagoReturn`, `DonationReturn`, `DeleteAccountPage`, `PrivacyPage`, `FollowListModal`,
           `NGOMoments`, `MomentsGrid`, `LocationPicker`, `ProjectMap` (la más grande: 95 clases viejas, botones de
           28 a 36 px, "Ver Proyecto") y media `CompanyDashboard` (la lista "Tus proyectos").
       - **I2. Hechas después del diseño, sin sección propia: siguen las reglas de los paneles.** `NGOApplications`,
         `SponsorshipAgreementScreen`, `SponsorshipHistoryScreen`, `SponsorshipPointForm`, `NGOValidation`,
         `AdminValidations`, `NGOTeam`, `TeamPanel`, `TeamInvites`, `TeamSection`, `InterviewPanel`,
         `ResetPasswordPage`, `NGOTransparency`, `CertificatePage` y el ingreso con Google en `AuthModal`:
         fondo `canvas-soft`, bloques `surface` con borde `hairline`, sin sombra, título de 22 px, "Volver" de 44 px.
         Diferencias chicas:
         - `InterviewPanel` y `MyParticipation`: enlaces azules (B4); "Marcar realizada" en verde.
         - `NGOTeam:133`: "Sacar del equipo" de 36 px (ícono). `NGOTeam` y `TeamPanel` cargan con spinner.
         - `NGOApplications`: el aviso de resultado va siempre en verde; casillas nativas de 16 px.
         - Tres copias del mismo botón (`btn` local en el acuerdo, el historial, el formulario de puntos y
           `ResetPasswordPage`) en vez de `ui/Button`; `money()` local en vez de `formatMoney`.
         - `NGOValidation`: coincide con "Validación de ONGs" salvo la línea de tiempo (son tres bloques sueltos).
         - `AdminValidations`: tarjetas en vez de la tabla que dice el diseño (en celular se lee mejor así).
         - `CertificatePage`: papel blanco fijo en los dos temas y un rótulo en mayúsculas; es para imprimir.
         - **Falta agregar a `DESIGN.md`** una sección para cada una (paso e).
       - **I3. Insignia de verificada (cierra B11).** El dato llega solo en las listas y el detalle de voluntariados
         (`ngo_verified`) y en el perfil de la ONG (`verified`). **Falta, y necesita backend**: "ONGs para seguir"
         (`FeedSidebar`), bandeja y conversación de mensajes, notificaciones, listas de seguidos
         (`FollowListModal`, perfiles), `MyParticipation` y el vínculo de `PostCard`. `VolunteeringTile` recibe el
         dato y no lo muestra (ahí el nombre va como texto secundario: decidir si lleva insignia).
       - **Para confirmar en 2c** (salen del código, falta verlos): el botón de `FilterModal` y los globitos
         `bg-ink-muted text-white` de `NotificationsScreen:17,24,28,34` en oscuro; el pie de `CreateVoluntariado`
         en 768–1023 px.
   - **c. En Chrome local** (memoria "Verificación local", datos de `npm run db:reset` en el backend): recorrido por
     rol (visitante, voluntario, ONG, empresa, admin), cada pantalla a **375 px y 1440 px**, **claro y oscuro**, más
     768 y 1024 px donde cambia la navegación. Es el punto 4 de "Guía para iterar" de `DESIGN.md`.
     - [x] **Hecho el 12/11** en Chrome local, con una base SQLite aparte (seed más un patrocinio con puntos y dos
       versiones, tres KPIs y una entrevista, cargados por la API). Dos partes:
       - **Medición automática** de 56 pantallas por rol (visitante 9, voluntario 15, miembro de equipo 6, ONG 17,
         empresa 9), cada una a 375 y 1440 px, en claro y oscuro (224 corridas), más 7 pantallas a 768 y 1024 px
         en claro. Un script dentro de la página midió: scroll horizontal, contraste de cada texto contra su fondo
         (4,5:1, o 3:1 en texto grande), botones de ícono de menos de 44 px, texto de menos de 12 px, y qué
         elementos usan el azul y el verde. No mide textos sobre fotos ni elementos con opacidad.
       - **Capturas** de las dudosas (unas 20 vistas). Hallazgos (C = Chrome); los que dicen "confirma" ya estaban
         en 2a o 2b:
       - **C1. Scroll horizontal a 375 px** (nuevo): `/company/dashboard` (76 px de más: se cortan las cifras, "Propuestas
         pendien…", y el estado de cada proyecto queda fuera de la pantalla) y `/ngo/patrocinios` (48 px: se corta
         "Rechazar" y el texto de la propuesta). A 768 y 1024 px no pasa. El resto de las pantallas, sin scroll.
       - **C2. Contraste del globito de no leídos** (nuevo): blanco sobre `like`, 3,91:1 en claro y 3,02:1 en
         oscuro, con texto de 11 px (barra lateral y Panel de la ONG). `paletteContrast.test.ts` no mira `bg-like`.
       - **C3. `FilterModal` en oscuro** (confirma 2b): "Mostrar 12 voluntariados" no se lee (blanco sobre casi
         blanco). Además: el punto de color de cada categoría no se ve, y "Elige según el tiempo y dedicación que
         desees aportar" (tuteo, se suma a "Personaliza").
       - **C4. Pie de `CreateVoluntariado`** (confirma 2b): a 900 px arranca a 240 px del borde con la barra lateral de
         72, así que queda corrido respecto del formulario. A 375 px queda 8 px por encima de la barra inferior y se
         ve el formulario por la rendija.
       - **C5. `NGOProjectDetail`** (confirma B2 y B8): en este Chrome el monto se ve `$8,500` (formato de EE. UU.);
         a 375 px "Volver" queda de 26×36 px; el tipo sale en minúscula ("fugaz").
       - **C6. Contraste 4,32:1** en claro: "Última actualización" de `/privacidad` y el título "Pendientes (2)" de
         `/ngo/patrocinios` (`gray-400` sobre `gray-50`).
       - **C7. Botones de ícono de menos de 44 px medidos** (confirma B8): "Volver" y "Compartir" de la página del
         voluntariado y las estrellas para puntuar (40); "Volver" de `NGOKPIs`, `CreateVoluntariado` y
         `NGOProjectDetail` (36); editar y borrar KPI (32); mensaje al inscripto y retirar propuesta (28); sacar del
         equipo (36); en el Panel a 375 px, rechazar y entrevista (32×36); "Volver" del asistente (37×44) y de
         `NGOTeam` (31×44) a 375 px.
       - **C8. Iniciales del avatar a 11 px** en los avatares chicos (32 px), en casi todas las pantallas.
       - **C9. Avatar de la cuenta en la barra**: para la ONG y la empresa muestra las iniciales de la persona
         ("AS", "AT") en un círculo, no el logo cuadrado de la organización. En `/ngo/patrocinios` el logo de la
         empresa sin foto sale con fondo rojo (imagen de DiceBear: no pasa por `Avatar`).
       - **C10. Mapa de Explorar en oscuro**: el fondo queda claro (B6) y en esta corrida no cargaron las imágenes
         del mapa (**sin confirmar** si es del entorno de prueba). El contador dice "10 proyectos".
       - **C11. Azul y verde medidos** (confirma B3 y B4): fuera de Donar, Inscribirme, montos, cupos y el tipo,
         aparecen en `NGOProjectDetail` (chip "Todos" azul, iniciales azules, enlaces de la entrevista),
         `NGOPatrocinios` ("Aceptar" verde, enlace azul), `NGOKPIs` (valores en verde), `CompanyOwnProfile` ("Ver
         acuerdo" azul) y `/privacidad` en oscuro ("Volver al inicio" verde).
       - **Sin hallazgos en la medición**: las 15 pantallas del voluntario y las del visitante no tienen fallas de
         contraste ni scroll horizontal (salvo C6); tampoco el acuerdo y el historial de patrocinio, postulaciones,
         validación, equipo, mensajes ni notificaciones.
       - **⚠️ No cubierto**: las hojas de donar, inscribirse y reseñas, y el compositor; publicaciones y Momentos
         con fotos (el seed no trae y no se sube nada); notificaciones de rechazo (los globitos `bg-ink-muted` de
         2b: por cuenta dan 2,96:1 en oscuro, **no se vieron**); validación y admin con un pedido cargado; el
         certificado; la navegación a 768 y 1024 px más allá del scroll; foco con teclado; texto al 200 %; lector
         de pantalla; un celular real.
   - **d. Resultado**: se anota como **sesión exploratoria nueva** en `docs/calidad/SESION_EXPLORATORIA.md` (charter,
     heurísticas, hallazgos, lo no cubierto) y cada hallazgo en `REGISTRO_DEFECTOS.md` con severidad: sirve para el
     informe del TP. Además una página (artifact) con la tabla y las capturas para que el usuario elija.
     - [x] **Hecho el 12/11** (§330): sesión exploratoria #2 en `SESION_EXPLORATORIA.md`; 8 defectos nuevos,
       **D33–D40** (3 de severidad media), abiertos en `REGISTRO_DEFECTOS.md` y **todavía sin Issue en GitHub** (falta
       que el usuario diga si se abren); el resto es deuda de diseño, no defecto.
       [Página para elegir las tandas](https://claude.ai/artifact/5FLvxTAFSd629UcB8X59x2), sin capturas (no se
       guardaron). Tandas propuestas, T1 a T13; sugeridas para empezar: **T1** (los tres defectos de severidad
       media), **T2** (contraste y el hueco de `paletteContrast.test.ts`) y **T4** (botones de ícono a 44 px).
       `METRICAS.md` y el informe del TP no se tocaron.
   - **e. Arreglos** por tandas que elige el usuario, un commit por tanda, con test rojo → verde cuando se puede
     (lo visual queda NO verificado en un celular real). Las pantallas nuevas se suman a `DESIGN.md` (estado actual).
     - [x] **T1 y T2** (§331, 12–13/11): D33–D36 y D39 corregidos y vistos en Chrome a 375 px, en claro y oscuro.
       El globito de no leídos pasó de `like` a `critical` (`DESIGN.md` actualizado).
     - [x] **T4** (§332, 13/11): los 33 botones de ícono de menos de 44 px pasaron a 44, todos los cuadrados
       llevan `shrink-0`, y "Rechazar" y "Entrevista" del Panel miden 44 en el celular. Medido en Chrome en 36
       pantallas.
     - [x] **D37, D38 y D40** (§333, 13/11): formato argentino en `NGOProjectDetail` y `ReviewsModal`, pie de
       `CreateVoluntariado` con las medidas de `AppShell`, voseo en la hoja de filtros.
     - **Los 8 defectos de la sesión #2 (D33–D40) están corregidos y en producción**, con sus Issues #34–#41
       cerrados (`f1ebd2e`, CI #91, Deploy #87, Sonar en OK). T3 quedó hecha con ellos, salvo unificar las
       cuatro funciones que escriben plata.
     - [x] **T6, primera parte** (§334, 13/11): iniciales del avatar a 12 px, el corazón solo para el "me gusta"
       (billetera en Mercado Pago, grupo de personas en el rol ONG), sin `uppercase`, sin emojis, y el aro del
       avatar de la cuenta con la forma del avatar.
     - [x] **T6, segunda parte** (§335, 13/11): el avatar de la cuenta de una ONG o una empresa muestra el logo
       (o las iniciales) de la organización, con `account` en `AuthContext`; y esqueletos en vez de spinner a
       pantalla completa en `CreateVoluntariado`, `CompanyOwnProfile`, `NGOProjectDetail`, `TeamPanel` y
       `RequireRole`. En producción (`263989e`, CI #93, Deploy #89, SonarCloud en OK con 0 issues).
     - **Lo próximo:** la tanda que elija el usuario (T5, T7–T13 de la
       [página de tandas](https://claude.ai/artifact/5FLvxTAFSd629UcB8X59x2)); es deuda de diseño, no defectos.
       Si no elige, el punto 3 (notificaciones instantáneas).
   - [x] De paso, la deuda chica del front de la Etapa 4: `es-AR` en `NGOProjectDetail` (§333).
   - Sumar al inventario lo nuevo de §329: los puntos en "Proponer" (`CompanyOwnProfile`, que sigue con el resto de
     la pantalla en los estilos viejos) y `SponsorshipPointForm`.
3. [x] **Notificaciones instantáneas** por el WebSocket (§336, 13/11): toda notificación avisa al instante a su
   destinatario, y la ONG tiene el contador de postulaciones sin responder en la barra lateral. **Commit local, sin
   push** (falta el OK del usuario); no se probó en producción.
4. **Lo próximo:** la tanda de diseño que elija el usuario (T5, T7–T13), o lo que siga de la Etapa 3: reputación
   (antes, que el usuario defina qué se mide) o empleados de empresa con cupos reservados.

## Devolución de los directores (5/11)

- Decir siempre cuántos encuestados hubo y la calidad de la muestra: 106 respuestas, del 20/03 al 07/04/2026, con sesgo (el 80,2 % ya había hecho voluntariado).
- Investigar a fondo donaciones, manejo de dinero y opciones de Mercado Pago (primer informe hecho).
- Repasar contenedores: SQLite y Postgres no tienen nada que ver con Docker.
- Practicar oratoria: grabarse y verse, velocidad y dicción.
- Iniciar sesión con Google u otro proveedor.
- Conectarse con Judith Analia Disderi por el trabajo de Bobadilla.

## Etapa 0. Antes del 14/11 (tiene fecha)

- [x] Base de Render (vencía el 14/11): copiada a Neon con `pg_dump`/`pg_restore`, mismos conteos en las 38 tablas (§310).
- [x] Pushear los commits locales y verificar CI y Deploy (2dd1de2, 8/11).

## Etapa 1. Mercado Pago

- [ ] **Prueba corta:** crear una suscripción con el token de un vendedor de prueba y confirmar a qué cuenta llega la plata. Decide el diseño de las donaciones mensuales. Pospuesta el 9/11: el script de prueba se arma de nuevo, quedó fuera del repo.
- [ ] Si funciona, plan y desarrollo de la donación mensual: alta, baja por el donante y aviso a la ONG.
- [ ] Mostrarle a la ONG cuánto recibe según el plazo, aclarando que depende de su provincia.
- [ ] Decidir si el patrocinio se paga por la pasarela (6,60 % al instante en Córdoba) o por transferencia.
- [x] Contracargos y devoluciones (§311): la donación pasa a `reembolsada` y deja de sumar. Falta activar el evento **Contracargos** en el panel de Webhooks.
- [x] Desvinculación (§313): el aviso `mp-connect` hace probar el token de la ONG; si Mercado Pago lo rechaza, se oculta el botón y se le avisa. Falta activar el evento **Vinculación de aplicaciones** en el panel de Webhooks.
- [ ] Si hay suscripciones, probar qué pasa con las activas al vencer o revocar el token.
- [ ] Confirmar en la documentación oficial lo que dijo el asistente de Mercado Pago antes de citarlo.

## Etapa 2. Patrocinio

Sin Figma: diseño propio del 11/11 ([lienzo](https://claude.ai/artifact/EvgwaAnYzYoiTzpAPSX6BZ)). Decidido: versión nueva **al guardar** (no por punto), la empresa **propone con puntos** y se avanza **paso a paso**.

1. [x] Backend: quién cambió qué, aceptaciones con fecha e historial (§324).
2. [x] Frontend: lista única con filtros, "agregado/editado por" y "cambió desde que aceptaste" (§325).
3. [x] Frontend: pantalla del historial de versiones (§326).
4. [x] Una versión por guardado: borrador en pantalla y "Guardar cambios" en una transacción (§327).
5. [x] Proponer con puntos, en la versión de la propuesta (§329).

Lo que pedía la etapa:

- [x] Una sola lista de puntos, marcando la parte de cada uno, en vez de las dos columnas (§325).
- [x] Mostrar quién editó y cuándo (§324, §325).
- [x] Historial de cambios por versión (§324, §326).

## Etapa 3. Lo que quedó sin cumplir

En este orden, salvo que el usuario diga otra cosa (orden propuesto, sin confirmar):

1. [x] **Validación de ONG con panel de administración** (§317 backend, §318 frontend): pantalla "Validar la ONG", panel de admin e insignia azul. Falta que el usuario cargue `ADMIN_EMAILS` en Render (con un mail que ya tenga cuenta) y la pruebe en la interfaz.
   - [ ] Opcional, ofrecido el 11/11 y sin decidir: exigirle al admin haber entrado con Google (mail verificado). Hoy el registro con contraseña no verifica el mail: un mail de `ADMIN_EMAILS` sin cuenta lo podría registrar cualquiera.
   - [x] **Pantalla de postulaciones** (§319; pedido del 11/11, fuera del orden): todas las de la ONG juntas, filtros, de a 50 y decisión en lote con tope de cupos, también para la coordinación. Falta la prueba del usuario en la interfaz.
2. [x] **Iniciar sesión con Google** (§314): pantalla de rol la primera vez; un mail con cuenta se vincula solo si Google lo da por verificado. Falta el Client ID de Google Cloud.
   - [x] **Fechas de los voluntariados y Calendar** (§315): inicio y fin opcionales, con hora opcional; Google Calendar y .ics en el detalle y en "Próximos". Las entrevistas ya lo tenían (§268).
3. [x] **Notificaciones instantáneas**, por el WebSocket que ya existía (§336), con el contador de postulaciones pendientes en la barra lateral de la ONG.
4. [ ] **Reputación de ONG y usuarios.** Antes, que el usuario defina qué se mide (reseñas, horas, postulaciones respondidas…).
5. [ ] **Empleados de empresa con cupos reservados** (`PLAN_EQUIPOS.md`, pasos 3 y 4). Toca la invariante de cupos: con cuidado.

6. [x] **Front de la ONG en escritorio** (pedido del 11/11): barra lateral por grupos y nombres desde 1024 px (§320), Panel en dos columnas desde 1280 px (§321), pestañas de Postulaciones (§322). Falta la prueba del usuario en su compu.

**Si sobra tiempo:** versión instalable en el celular (PWA) y paginación de los listados. **No hacer:** escalar a varias instancias.

## Etapa 4. Orden y deuda chica

- [ ] Sacar `NGOEmpleados`, con su pantalla y ruta; decidir qué pasa con la tabla `empleados` y su API.
- [ ] Cloudinary por carpetas: antes revisar `CLOUDINARY_FOLDER` en Render y probar una subida real.
- [ ] `NGOProjectDetail.tsx`: `toLocaleString()` sin idioma; usar `es-AR`.
- [ ] Ver por qué `node --watch` se reinicia solo en Windows (§308).
- [ ] Reescribir `GUION_DEFENSA.md` para la presentación final y sumar la línea de la muestra.
- [ ] Patrocinio: los endpoints de a un punto (`POST/PATCH/DELETE …/puntos`) quedaron sin uso en la pantalla desde §327; decidir si se sacan (cada uno sigue creando una versión).
- [x] Patrocinio: `POINT_TYPE_LABEL` pasó a `lib/sponsorship.ts` (§329; lo necesitaba el formulario compartido). No miré si el refresco en caliente de Vite volvió a andar en esa pantalla.
- [ ] Los dos tests con finales de línea mezclados (`FeedPostCard.test.tsx`, `NGOKPIs.test.tsx`, `w/mixed`): normalizarlos a CRLF.

## Te toca a vos

- [ ] Cargar `ADMIN_EMAILS` en el panel de Render (servicio del backend; varios, separados por coma) con el mail de una cuenta tuya que ya exista en prod.
- [ ] Probar en la interfaz la validación de ONG (pedirla con una ONG, aprobar o rechazar como admin) y la pantalla de postulaciones (filtros, lote, cupos).

- [ ] Probar en producción (§329, ya desplegado): proponer un patrocinio con puntos desde el perfil de la empresa y volver a proponer después de un rechazo.
- [ ] Probar en producción el acuerdo de patrocinio, como empresa y como ONG: varios cambios y "Guardar cambios" (una versión), "Descartar", el aviso "cambió desde que aceptaste" desde la otra cuenta y "Historial de versiones". Los acuerdos de antes no tienen historial previo (el aviso dice "al menos").
- [ ] Probar en tu compu la barra lateral nueva de la ONG (grupos Panel, Comunidad y Mi ONG) y el Panel en dos columnas; en una notebook, la barra con nombres desde 1024 px.
- [ ] Activar en el panel de Webhooks de Mercado Pago los eventos **Contracargos** y **Vinculación de aplicaciones** (§311, §313).
- [ ] Decidir si el admin tiene que entrar con Google (mail verificado) para validar ONG.
- [ ] Cerrar Docker Desktop si no lo usás (lo abrí para los tests de Postgres).
- [ ] Consultar a un contador si la donación por Mercado Pago es deducible de Ganancias.
- [ ] Preguntar a Mercado Libre Solidario por los requisitos y si hay tarifa para ONG. Lo hace la ONG, no la plataforma.
- [ ] Contactar a Judith Analia Disderi y contarme de qué trata el trabajo de Bobadilla.
- [ ] Practicar oratoria y repasar contenedores.
- [ ] IPI: pendientes de `PLAN_CIERRE.md` §1. Además, cambiar la comisión de referencia de 6,29 % (CABA) por 6,60 % (Córdoba), y decidir si sigue la prueba piloto como trabajo futuro.
- [ ] Fecha exacta de la presentación final.
