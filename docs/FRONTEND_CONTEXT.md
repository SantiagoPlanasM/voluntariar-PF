# FRONTEND_CONTEXT.md — Frontend (React + Vite)

> Estructura, rutas, pantallas y convenciones. El diseño visual está en `DESIGN.md`; el contrato con el backend, en
> `API_CONTEXT.md`. Estado al 30/10/2026; la versión larga con historia está en `archivo/contexto-2026-10-30/`.

## 1. Arquitectura

SPA de React 18 con React Router 7 (`createBrowserRouter`, **sin** `loader`/`action`): cada pantalla carga en `useEffect` con su propio estado. No hay code-splitting ni estado global aparte de los contextos.

```
main.tsx: StrictMode > AuthProvider > ChatProvider > UiProvider > RouterProvider (app/routes.tsx)
  Root (/)  ·  NGOLayout (/ngo/*, RequireRole ngo)  ·  CompanyLayout (/company/*, RequireRole company)
     └─ los tres renderizan app/layout/AppShell.tsx: barra inferior (celular), lateral (escritorio:
        solo íconos de 768 a 1023 px, con nombres desde 1024), barra superior corta, AuthModal y ScrollToTop
```

- **Navegación:** los ítems de cada rol salen de una sola lista, `app/layout/navConfig.ts` (`NAV[rol].tabs` y `.side`).
  `.side` admite grupos (`NavGroup`, con `children`; `isGroup`, `flatSide` da todos los destinos): hoy solo la ONG los
  tiene (Panel, Comunidad, Mi ONG). En `AppShell`, `SideGroup` los dibuja como acordeón con nombres (de a uno abierto)
  y como panel flotante (`role="group"`) con solo íconos; `useWide` lee `(min-width: 1024px)` con `matchMedia` y, sin
  él, asume nombres. `isActive(item, pathname, hash)`: un destino con `#ancla` (Mercado Pago) solo se marca con su
  ancla, y el mismo destino sin ancla (Perfil) deja de marcarse cuando hay una.
- **Contadores (`useBadges` en `AppShell`):** Mensajes (no leídos del chat), Notificaciones (`GET /notifications`) y, solo para el voluntario, **Perfil** con las invitaciones a equipos sin responder (`GET /equipo/mias`). Los dos pedidos se repiten al cambiar de pantalla; si fallan, no hay contador.
- **`ScrollToTop`:** una navegación nueva vuelve arriba; "atrás" y los `#ancla`, no.
- **`RequireRole`:** muestra "cargando" mientras verifica. Sin sesión, va al inicio con el login abierto; con otro rol, al inicio de ese rol (`homeFor`). Es solo experiencia de uso: la autorización está en el backend.

```
frontend/src/
├── main.tsx
├── app/
│   ├── routes.tsx       # todas las rutas
│   ├── components/      # pantallas y widgets, planos (con sus *.test.tsx)
│   ├── layout/          # AppShell, navConfig
│   ├── ui/              # kit: Button, PasswordInput, Avatar, Meter, Sheet, UiProvider, ProfileHeader, TypeBadge, Logo, fieldStyles
│   ├── volunteering/    # lógica pura: cardActions, status, isRemote, imagePosition, projectForm, projectFacts; VolunteeringTile
│   └── team/            # teamRoles (nombres de los roles), useTeamMemberships (invitaciones y equipos del voluntario)
├── lib/                 # api.ts, AuthContext, ChatContext, format, useLatestRequest, useTheme, badWords, calendar,
│                        # cv, donations, imageCompress, mapTiles, sponsorship
└── styles/              # theme.css (tokens), fonts.css, globals.css
```

## 2. Rutas

| Ruta | Componente | Quién |
|---|---|---|
| `/` | `PublicFeed` | público; redirige si hay sesión |
| `/feed` | `MainFeed` (Inicio: voluntariados y publicaciones de lo que sigue) | volunteer |
| `/explore` | `ExploreScreen` | todos |
| `/project/:id` (alias `/projects/:id`) | `ProjectDetails` | público |
| `/participation` | `MyParticipation` | volunteer |
| `/certificado/:enrollmentId` | `CertificatePage` | volunteer (aprobada en un voluntariado `completed`) |
| `/notifications` (y `/ngo/notifications` con `inPanel`) | `NotificationsScreen` | con sesión |
| `/momentos` | `MomentsPage` (una ONG va a `/ngo/momentos`) | público |
| `/messages`, `/messages/:userId`, `/messages/asistente` (y los mismos en `/ngo/…`, `/company/…`) | `MessagesScreen`, `ChatThread`, `AssistantScreen` | con sesión |
| `/profile` | `VolunteerProfile` (con `TeamSection`, ancla `#equipos`) | volunteer |
| `/volunteer/:id`, `/ngo/:id`, `/company/:id` | perfiles públicos | público |
| `/settings` | `SettingsScreen`: CV, Mercado Pago (link), tema, contraseña, Equipos/Acceso del equipo, Validación de la ONG, el panel de admin (con `isAdmin`), privacidad, cerrar sesión y borrar la cuenta | con sesión |
| `/admin/validaciones` | `AdminValidations` (panel de administración) | con sesión; la API exige `ADMIN_EMAILS` (403 → "solo para el equipo de VoluntariAR") |
| `/equipo/:ngoId` | `TeamPanel` | miembro activo |
| `/equipo/:ngoId/project/:projectId` | `NGOProjectDetail team` (sin editar, KPIs ni estado) | coordinación |
| `/equipo/:ngoId/postulaciones` | `NGOApplications team` | coordinación |
| `/privacidad`, `/cuenta/borrar`, `/restablecer`, `/donaciones/vuelta` | `PrivacyPage`, `DeleteAccountPage`, `ResetPasswordPage`, `DonationReturn` | público; el código del link autoriza |
| `*` | `NotFoundPage` (con `LoadError`) | — |
| `/ngo`, `/ngo/dashboard` | `NGODashboard` | ngo |
| `/ngo/create`, `/ngo/dashboard/project/:projectId/editar` | `CreateVoluntariado` (alta y edición) | ngo (dueña) |
| `/ngo/dashboard/project/:projectId` | `NGOProjectDetail` | ngo |
| `/ngo/profile`, `/ngo/mercadopago/vuelta` | `NGOOwnProfile`, `MercadoPagoReturn` (= `MP_OAUTH_REDIRECT_URI`) | ngo |
| `/ngo/patrocinios`, `/ngo/patrocinios/:empresaId/:projectId`, `…/historial` | `NGOPatrocinios`, `SponsorshipAgreementScreen`, `SponsorshipHistoryScreen` | ngo |
| `/ngo/momentos`, `/ngo/equipo`, `/ngo/kpis/:projectId` | `NGOMoments`, `NGOTeam`, `NGOKPIs` | ngo |
| `/ngo/validacion` | `NGOValidationScreen` ("Validar la ONG") | ngo |
| `/ngo/postulaciones` | `NGOApplications` (todas las postulaciones) | ngo |
| `/ngo/empleados/:id` | `NGOEmpleados` (sin links; se saca después de la defensa) | ngo |
| `/company`, `/company/profile`, `/company/dashboard`, `/company/patrocinios/:empresaId/:projectId`, `…/historial` | `CompanyOwnProfile`, `CompanyDashboard`, `SponsorshipAgreementScreen`, `SponsorshipHistoryScreen` | company |

Al iniciar sesión, la ONG va a `/ngo/dashboard`, la empresa a `/company/profile` y el voluntario se queda donde estaba. No se recuerda "a dónde volver".

## 3. Pantallas y piezas (lo que no es obvio)

### Voluntario y público
- **`PublicFeed`:** las cifras salen de `api.stats()` con `compactNumber`; si todo da 0 o falla el pedido, la fila no se muestra.
- **`MainFeed`:** usa `/api/follows/feed`. Con un error muestra "Reintentar", nunca el estado vacío. Cada voluntariado es un `FeedPostCard` (like, comentar, inscribirse, reseñas). La barra de escritorio, `FeedSidebar`, solo presenta: el error de las sugerencias y el de seguir le llegan por props.
- **`ExploreScreen`:** pide `limit: 500` (`EXPLORE_LIMIT`) y filtra en el navegador. Si la respuesta viene llena, avisa.
  - "Para vos" muestra hasta 6, y la lista general saca solo esas.
  - Filtros: `FilterModal` / `filterProjects()` (categoría, tipo, modalidad, costo y carga horaria de 2 o 5 h por semana; los fugaces siempre pasan). Compara con `normalizeText`.
  - Con error, no dibuja el mapa.
- **`ProjectMap`** (Leaflet + OpenStreetMap, `lib/mapTiles.ts`):
  - Un proyecto sin coordenadas va a un punto de respaldo estable, que sale del hash de su id. Los remotos no van al mapa (`isRemote`).
  - Los dos mapas encuadran todos los pines (`fitToProjects`, zoom hasta 13) y vuelven a encuadrar al filtrar.
- **`LocationPicker`:** busca con `geocodeAddress` (Nominatim; una búsqueda por segundo, sin autocompletar), toca el mapa o arrastra el pin. Guarda 6 decimales.
- **`ProjectDetails`:** los datos y la validación del comentario están en `volunteering/projectFacts.ts`.
  - Con fecha (§315), muestra cuándo es (`scheduleLabel`) y "Agregar a Google Calendar" / "Descargar .ics" (`projectEvent`). Con hora, evento con hora; sin hora, o varios días sin hora de fin, día completo.
  - **Reseña:** formulario propio, solo con la postulación aprobada. Se precarga con la reseña propia ("Actualizar reseña") en un `useLayoutEffect`, una vez por proyecto y sin pisar lo que se está escribiendo.
  - **Postularse:** teléfono opcional (`type="tel"`, ≤ 25). El campo es una función que devuelve JSX, para que no pierda el foco.
  - **Donar:** solo si el proyecto está `active`, quien mira no es una ONG y `accepts_donations` es verdadero. Si no, "Esta ONG todavía no recibe donaciones". Un visitante ve "Iniciá sesión para donar".
  - **Además:** "Patrocinado por" (`sponsors`), "Recaudado en donaciones" y `MomentsGrid`.
- **`cardActions()`** (`volunteering/`): decide los botones de una tarjeta (Inscribirme, Postulado, Vas a ir, No seleccionado, Cupos completos, Ver cómo salió, Cancelado; Donar, Meta cumplida). Un cancelado no ofrece inscribirse ni donar. Los nombres de estado están en `volunteering/status.ts`.
- **`MyParticipation`:** pestañas Próximos, Postulaciones, Seguidos y Realizados.
  - Postulaciones tiene "Cancelar postulación" en el menú "···".
  - Una postulación con entrevista programada muestra el chip "Entrevista", con fecha, lugar, link y "Agregar a Google Calendar" / "Descargar .ics" (`lib/calendar.ts`, RFC 5545).
  - Un voluntariado aprobado con fecha (§315) muestra cuándo es y los mismos dos links.
  - En Realizados: "Dejá tu reseña" y "Certificado", solo si el voluntariado está `completed`.
- **`CertificatePage`:** "Imprimir o guardar como PDF" con `window.print()`. Muestra las horas verificadas por la ONG.
- **Perfiles públicos:**
  - `VolunteerPublicProfile` y `NGOPublicProfile` tienen Seguir/Siguiendo. Si falla el "¿ya lo sigo?", muestran un aviso con "Reintentar", no un "Seguir" falso.
  - `FollowListModal` muestra las listas de seguidores y seguidos, también para el perfil propio.
  - `VolunteerPublicProfile` muestra las horas verificadas y `MomentsGrid` (por id de usuario).
- **`VolunteerProfile`:** habilidades con nivel. Si falla una carga, muestra "—" y no pisa las habilidades al guardar. La foto de una persona es siempre `avatar`, nunca `foto_perfil`.
- **`ProfilePhotoPicker`:** comprime (`compressImage`), sube con `api.auth.uploadPhoto` y actualiza la sesión (`updateUser`).
- **`NotificationsScreen`:** usa `unread` del backend. `notificationHref(n, role)` lleva a la pantalla de cada aviso: entrevistas a `/participation`, donaciones recibidas o revertidas (`donation_reversed`) al voluntariado en el panel de la ONG acuerdos a su pantalla según el rol y la validación de la ONG (`ngo_validation_approved`/`_rejected`) a `/ngo/validacion`.
- **`ReviewsModal`:** reseñas y formulario. Cada vez que se abre pide `GET /api/projects/:id`.
- **`DonateModal`:** monto inicial $ 2.500, con atajos de $ 1.000 a $ 10.000 y "Otro monto". Valida con `checkDonationAmount` y redirige a `checkout_url`.
- **`DonationReturn`:** lo que muestra lo decide el backend, que concilia el pago. Si está pendiente, vuelve a preguntar hasta 5 veces cada 3 s.
- **Cuenta:**
  - `AuthModal` (pestañas `role="tab"`, con "¿Olvidaste tu contraseña?" → `ForgotPasswordForm`) y `ResetPasswordPage` (no inicia sesión sola).
  - "Continuar con Google" (§314) en las dos pestañas, solo con `VITE_GOOGLE_CLIENT_ID`: el botón lo dibuja Google (`lib/googleSignIn.ts`). Sin cuenta → `GoogleSignupForm` (rol con `RolePicker`, compartido con el registro, y nombre con el de Google).
  - `PasswordSection`: tres campos con su `<label>` visible.
  - `CvSection`: valida con `checkCvFile` y abre el CV con `openCv`, porque el link vence. `openCv` usa `openSignedLink(getLink)` (`lib/cv.ts`), que también abre los PDF de la validación de la ONG.
  - `DeleteAccountSection` y `DeleteAccountPage`.

### ONG
- **`NGODashboard`:** tiene estas partes:
  - el aviso `MercadoPagoBanner`;
  - el embudo (`NGOFunnel`, con `Meter`);
  - "Postulaciones sin responder": Aceptar, Rechazar, "Entrevista" (lleva a `…/project/<id>?postulacion=<enrollmentId>`) y el teléfono (`EnrollmentPhone`, link `tel:`);
  - la campanita en el celular;
  - la tabla de voluntariados, con `table-fixed` (un título largo se trunca y "Recaudado" no se corta en el celular).

  Hasta 1400 px de ancho. Desde 1280 px (`useMediaQuery`, `lib/useMediaQuery.ts`) va en dos columnas: a la izquierda los
  voluntariados y el embudo; a la derecha (`<aside aria-label="Pendientes y accesos">`, 380 px) las postulaciones sin
  responder y `NGOShortcuts stacked`. Más angosto o sin `matchMedia`, una columna: accesos, embudo, postulaciones y
  voluntariados. Cada pieza se dibuja una sola vez. En las postulaciones, los botones bajan de línea si no entran.
  Con un 401 vuelve al inicio.
- **`CreateVoluntariado`:** la lógica del formulario está en `volunteering/projectForm.ts`. El paso 2 tiene "¿Cuándo es? (opcional)": fecha y hora de inicio y de fin (§315), con las reglas del backend. En edición:
  - el tipo queda fijo;
  - manda solo lo que cambió (`changedFields`), con `null` para borrar;
  - sin `can_manage`, muestra `LoadError`.
  - **Lugar:** en un presencial, el pin es **obligatorio** (solo lo exige el formulario).
  - **Topes:** iguales a los del backend (80, 1000 y 5000).
  - **Foto (`ProjectPhotoField`):** vista previa en 4:5 y "Encuadre en las tarjetas" (Arriba, Centro, Abajo → `image_position`, que aplica `imagePositionClass`). Se sube **después** de guardar. Si falla, el voluntariado ya quedó guardado y aparece un aviso.
- **`NGOProjectDetail`:** lista de postulantes.
  - Acciones: aprobar o rechazar, cargar horas, "Ver CV" (solo con `has_cv`) e `InterviewPanel`.
  - Botón "Editar" y "Estado del voluntariado": Finalizar y Cancelar con `useConfirm`; "Volver a activar" sin confirmación.
  - Con `?postulacion=<id>`, resalta esa fila, la lleva a la vista y abre el formulario de la entrevista.
- **`InterviewPanel`:** agendar, reprogramar, cancelar o marcar realizada (`interviewPassed`, en UTC-3). Los mensajes del backend se muestran tal cual.
- **`NGOOwnProfile`:** edita el perfil, con CUIT y "Link a balances y documentos". Incluye `MercadoPagoAccountSection` (ancla `#mercadopago`; vincular, volver a vincular o desvincular, con confirmación en la página).
- **`NGOTransparency`:** muestra los datos con "Los carga la organización; VoluntariAR no los verifica".
- **`MercadoPagoReturn`:** manda `code` y `state` **una sola vez** (un ref la protege de StrictMode).
- **`NGOTeam`:** invita, cambia el rol o saca. Se llega por "Equipo" en la barra lateral (escritorio), por el acceso del Panel y por Configuración.
- **`NGOShortcuts`:** los accesos del Panel de la ONG (`ShortcutCard`, uno por pantalla) a Postulaciones (primero y a lo ancho), Patrocinios, Publicaciones, Equipo (`NGOTeamCard`, con miembros e invitaciones pendientes; sin números si falla la carga) y Validación (`NGOValidationCard`, con el estado; sin él si falla la carga). En el celular son el único camino a esas pantallas: la barra inferior tiene cinco ítems como máximo. Desde `md` van en una grilla de dos; con `stacked` (columna derecha del Panel), de a uno.
- **`NGOApplications`** (§319; lógica en `lib/applications.ts`): todas las postulaciones de la ONG (`enrollments.manage`), para cientos.
  - Pestañas por estado con su cantidad ("Pendientes" por defecto; "Todas" incluye canceladas) y filtros: voluntariado (con sus cupos), entrevista, "Solo con CV", búsqueda (nombre, mail o voluntariado, sin tildes) y orden. Se ven de a 50 ("Mostrar más").
  - Cambiar un filtro vacía la selección. La barra "Elegidas" aprueba o rechaza con `useConfirm`: manda de la más vieja a la más nueva (`bulkOrder`), en tandas de 500, recarga y muestra el resumen (`summaryText`).
  - Por fila: Aprobar/Rechazar sin preguntar, CV, Entrevista (al detalle del voluntariado, con `?postulacion=`) y teléfono.
  - Accesos: el primero de `NGOShortcuts`, "Ver todas las postulaciones" en el Panel y, para la coordinación, en `TeamPanel`.
- **Validación de la ONG (`NGOValidation.tsx`, `lib/ngoValidation.ts`):** `NGOValidationScreen` muestra el estado como chip (`ValidationChip`: "Sin validar", "En revisión", "Validada" en azul con la insignia, "Rechazada").
  - Sin pedido o rechazada: los tres pasos (datos, documentación, revisión) y el formulario multipart (`cuit`, `legal_type`, `statute`, `registration`). Antes de mandar chequea lo mismo que el backend con sus mensajes (`checkValidationDoc`; el dígito verificador del CUIT lo controla solo el backend). Rechazada: el motivo, y el CUIT y la personería de antes.
  - En revisión o validada: los datos enviados y "Ver estatuto"/"Ver constancia" (`openSignedLink`).
  - Aclara que sin validar se puede publicar y recibir postulaciones, y que las donaciones dependen de Mercado Pago.
- **`AdminValidations`** (`/admin/validaciones`): "En revisión" o "Todas" (`?status=all`); por fila, la ONG (link al perfil), CUIT, personería, los dos PDF, "Aprobar" (con `useConfirm`) y "Rechazar" (motivo de 10 a 500, `checkRejectReason`). Un error (p. ej. el 409 si otro admin ya decidió) queda en la fila.
- **Insignia (`ui/VerifiedBadge.tsx`):** ícono azul (`text-brand-text`) con nombre "ONG validada". Va junto al nombre de la ONG en `ProfileHeader` (`verified`, perfil público), en `ProjectDetails` y en `FeedPostCard`, solo con `verified`/`ngo_verified` de la API.
- **Equipo, lado del voluntario:** `useTeamMemberships` (`app/team/`) carga `GET /equipo/mias` y acepta, rechaza o sale (salir pide confirmación). Lo usan `TeamSection` ("Equipos", en el perfil y en Configuración; ancla `#equipos`, a la que llevan el aviso `team_invite` y "Volver" de `TeamPanel`) y `TeamInvites` (arriba del Inicio, solo las invitaciones; al aceptar, link al panel). Los dos se ocultan sin datos o si falla la carga. `TeamPanel` es el panel del miembro.
- **`NGOPatrocinios` y `SponsorshipAgreementScreen`:**
  - **Puntos (§325):** una sola lista con filtros por parte (con la cantidad) y el total de dinero; cada punto dice de qué parte es ("Aporta …" / "Ofrece …"), quién lo agregó y quién lo editó. Los propios tienen editar y borrar, y hay "Agregar punto", mientras el acuerdo está abierto.
  - **Cambios desde tu aceptación (§325):** si acepté una versión anterior a la vigente y el acuerdo está abierto, pide el historial y `changesSince` (`lib/sponsorship.ts`) marca los puntos nuevos o editados (con "Antes:") y avisa los quitados. Uno agregado y quitado después no cuenta. Si el historial falla, sin marcas.
  - **Disposición:** desde `lg`, la lista a la izquierda y la aceptación y la charla en una columna de 360 px.
  - **Historial (§326):** "Historial de versiones" (encabezado) y "Ver qué cambió" (aviso) llevan a la misma URL + `/historial`.
- **`SponsorshipHistoryScreen` (§326):** pide el acuerdo y `GET …/historial` juntos. A la izquierda las versiones (de la más nueva a la más vieja: quién, qué hizo y quién la aceptó); a la derecha el detalle de la elegida, que arranca en la más nueva ("Vigente"): quién la aceptó y cada cambio con Agregó/Editó/Quitó en texto, antes y ahora, con el monto. La versión 1 sin cambios muestra el mensaje al proponer. Si el historial empieza después de la versión 1, lo avisa. Angosto (< 1024 px), elegir una versión baja hasta el detalle. "Volver al acuerdo" es la URL sin `/historial`.
  - **Aceptación:** quién aceptó la vigente (y cuándo) y qué versión había aceptado quien no; "Estoy de acuerdo" manda `version`, y "Rechazar acuerdo".
  - **Charla:** el mensaje de la propuesta y los mensajes.
  - Un 409 recarga el acuerdo.
- **`NGOKPIs`:** el CRUD de indicadores. **`NGOMoments`:** `MomentsFeed` con `ngo_id`; hasta tener el id no muestra nada.

### Empresa
- **`CompanyDashboard`:** 4 KPIs y los proyectos. Las horas y los voluntarios se muestran solo en patrocinios aceptados.
- **`CompanyOwnProfile`:** perfil y patrocinios (proponer, retirar, "Ver acuerdo"). Con `?proponer=<projectId>`, abre "Proponer" con ese proyecto elegido. El listado pide `limit: 500`.
- **`CompanyPublicProfile`:** la pestaña Patrocinios usa `sponsored_projects`.
- **`lib/sponsorship.ts`:** etiquetas y colores de los estados de un patrocinio.

### Momentos
- **`MomentsPage`**, **`MomentsFeed`** (paginado, con "Compartir un momento"), **`PostCard`**, **`PhotoCarousel`** (botones, teclado, deslizar), **`PostComposer`** y **`MomentsGrid`** (miniaturas de 3 × 3, que abren la publicación en un modal).
- **`can_delete` lo decide el servidor:** el cliente solo lo usa para elegir el texto de la confirmación.
- **Me gusta optimista:** se revierte si falla, ignora los toques mientras hay un pedido en curso y, sin sesión, abre el login.
- **Paginación:** el `offset` es lo que *devolvió* el servidor. Se deduplica por id, se ajusta al publicar o borrar, y una respuesta vieja se descarta.
- **Recarga:** el feed recarga cuando cambia el **id** del usuario.
- **Compositor:**
  - hasta 5 fotos y 500 caracteres;
  - comprime al publicar: si una foto falla, no sube nada;
  - queda bloqueado después de publicar y pregunta antes de descartar.
- **`NGOProjectDetail`:** muestra el `MomentsFeed` del proyecto sin compositor.

### Chat y asistente
- **`MessagesScreen`:** buscador, el asistente fijado arriba y un punto de no leídos.
- **`ChatThread`:** el historial, el envío por REST y marcar como leído al abrir.
- **`AssistantScreen`:** usa `api.faqs`.

## 4. Contextos y cliente HTTP

- **`AuthContext`** (`useAuth`): `user`, `token`, `initializing`, `isAdmin`, `login`, `register`, `googleLogin`, `googleRegister`, `logout`, `updateUser`, `openAuthModal(mode)`, `closeAuthModal`.
  - `isAdmin` sale de `is_admin` de `GET /auth/me`: al montar y, después de entrar (el login no lo trae), con un pedido aparte que no se espera. Una respuesta que llega después de `logout` no cuenta. Es cosmético: solo muestra el link al panel.
  - Al montar, revalida con `GET /auth/me`. Cierra la sesión **solo** ante un 401 o 404; con otros errores (por ejemplo, un 502 de Render dormido) conserva `v_user`.
  - `logout` solo borra `v_token` y `v_user`: el token no se invalida en el servidor.
- **`ChatContext`** (`useChat`): `conversations`, `unreadTotal`, `connected`, `refreshConversations`, `onMessage(cb)`.
  - Abre el WebSocket (`BASE` con `/api` → `/ws`) cuando hay sesión.
  - Reconecta con backoff (1, 2, 4, 8 s, tope 10 s), salvo ante un `4001`.
  - Cada mensaje entrante refresca las conversaciones.
- **`UiProvider`:** `useConfirm()` (asíncrono: en los tests se espera con `waitFor`) y `useToast()`. Sin el proveedor, usa `window.confirm` y `console.warn`.
- **`lib/api.ts`:** único cliente HTTP, con todos los tipos del dominio.
  - `req()` fuerza JSON.
  - `upload(form, método)` **no fija `Content-Type`** (multipart).
  - `readJson`: si `!res.ok`, lanza `ApiError(data.error || fallback, status)`: "El servidor no está disponible…" para 502/503/504 y "Error del servidor" para el resto. Si la respuesta es OK pero no JSON, "Respuesta inesperada del servidor". Un fallo de red queda como `TypeError` (lo traduce `userMessage`).
  - Namespaces: `auth`, `projects`, `enrollments`, `ngos` (con `mercadopago`, `empleados`, `patrocinios`, `validation`), `admin` (`validations`), `empresas`, `sponsorships`, `team`, `follows`, `messages`, `posts`, `donaciones`, `voluntarios` (`cv`, `habilidades`), `faqs`, `notifications`, `catalog`, `stats`; además `geocodeAddress`.
  - `lib/api.contract.test.ts` controla las URLs y los cuerpos.
- **`lib/format.ts`:**
  - `parseBackendDate`: toda fecha del backend pasa por acá; la usan `timeAgo` y `formatTime`.
  - `formatDateOnly`: fechas sin hora, nunca `new Date("YYYY-MM-DD")`.
  - `normalizeText`, `compactNumber`, `truncateText`, `userMessage(err, respaldo)` y `FOLLOW_ERROR`.
- **Otros de `lib/`:**
  - `imageCompress.ts`: 1600 px, JPEG 0,82; `MAX_UPLOAD_BYTES` = 8.000.000, igual que el backend.
  - `cv.ts`: PDF de hasta 5 MB.
  - `donations.ts`: de 100 a 500.000 pesos enteros.
  - `useTheme.ts`: tema en `v_theme`, que `index.html` aplica antes de pintar.

## 5. Convenciones

- **Componentes:** export nombrado, igual al archivo. Sin `memo` ni `useCallback`. Las pantallas leen `useParams()` y `useAuth()`.
- **Errores de carga:**
  - Una pantalla de un recurso por id usa **`<LoadError />`** (`describeLoadError`):
    - 404 → "no existe";
    - 403 → el mensaje del servidor;
    - 5xx o sin red → "Reintentar".

    "Volver" aparece solo si hay historial; si no, "Ir al inicio". Nunca `navigate(-1)` + `return null`.
  - Un listado o sección usa **`<InlineError />`** con "Reintentar". **Nunca** muestra el estado vacío ante un error.
  - Los dos ya tienen `role="alert"`: no envolverlos en otro.
  - Una acción que falla muestra su mensaje con `role="alert"`; el estado queda como estaba.
  - No hay error boundary.
- **Respuestas viejas:**
  - Si un efecto depende de un parámetro que cambia sin desmontar la pantalla: `let cancelled = false` y `if (!cancelled)` antes de cada `set…`.
  - Si la carga se dispara desde varios lugares: `useLatestRequest()` (`start()` / `isLatest(req)`).
- **Modales:** siempre `<Modal>` (`role="dialog"`, Escape, foco atrapado y devuelto), nunca un `div fixed` propio. Va con `labelledBy` o `label`.
  - Si cerrar puede perder datos: `closeOnOverlay={false}` y confirmar.
  - `FilterModal` y el mapa ampliado usan `createPortal`, por encima de Leaflet.
  - No agregar listeners de Escape en `window`.
  - Las hojas usan `Sheet` (abajo en el celular, diálogo en escritorio).
- **Accesibilidad:**
  - Un botón con solo un ícono lleva `aria-label`, que dice sobre qué actúa (`Aprobar a ${nombre}`). Los botones que alternan un estado usan `aria-pressed` con un nombre fijo.
  - Un campo con etiqueta visible usa `<label htmlFor>` + `id` y un `aria-label` con el mismo texto. El `placeholder` no cuenta como etiqueta.
  - Una tarjeta que navega es un `<Link>`, no un `div` con `onClick`.
  - Los indicadores de carga usan `role="status"`.
  - `A11yNames.test.tsx` revisa pantalla por pantalla: una pantalla nueva se suma ahí.
- **`PasswordInput`:** el botón del ojo es `type="button"`, siempre "Mostrar…", con `aria-pressed`.
- **`Avatar`:** redondo para personas y cuadrado para organizaciones. Sin foto (o con una de DiceBear) muestra iniciales.
- **`formatMoney`:** usa un espacio duro (`$ X`).

## 6. Estilos y tokens

- **Base:** Tailwind 4 con clases en el JSX, íconos de `lucide-react` y la fuente Plus Jakarta Sans (`public/fonts`).
- **Tokens** (`styles/theme.css`, claro y oscuro): `ink`, `surface`, `canvas`, `hairline`, `brand` (azul, solo para dinero), `people` (verde, para personas), `critical`, `like` y `star`.
- **Paleta vieja:** la de Tailwind (`blue`, `sky`, `indigo`…) está remapeada a la escala neutra.
- **Contraste** (`styles/paletteContrast.test.ts`):
  - exige 4,5:1 a todo `text-white` sobre `bg-<color>-<tono>`, a los textos de color y a los tokens usados como texto, en los dos modos;
  - las listas de conocidos están vacías: cualquier caso nuevo hace fallar el test.
- **Combinaciones correctas:**
  - Botones llenos: `bg-ink text-on-ink`, `bg-people text-white`, `bg-critical text-on-ink`.
  - Texto de color: `text-people-text` y `text-brand-text`, **no** `text-people` ni `text-brand`.
  - Fondo suave: `bg-brand-soft`, no `bg-brand/20`, que el test no puede medir.
  - Pastillas: `bg-people-soft text-people-text` (aprobado), `bg-surface-soft text-ink-soft` (pendiente), `bg-surface-soft text-critical` (rechazado).
- **`TypeBadge`:** azul para Fugaz, verde para Sostenido.

## 7. Problemas conocidos

- **Sin paginación real** en Explorar (500) ni en el chat (300).
- **Validaciones duplicadas** con el backend: auth, palabras prohibidas (un test controla que sean iguales) y los topes de los formularios.
- **Un 401 a mitad de la navegación** no lleva al login de manera uniforme.
- **No hay error boundary:** un throw en el render deja la pantalla en blanco.
- **Pantallas con más riesgo y menos tests de lógica:** `NGOProjectDetail`, `MyParticipation` y el JSX de `CreateVoluntariado` (su lógica sí está probada).
- **Sin verificar con personas reales:** el aspecto visual, el deslizar en un celular real y el lector de pantalla.
