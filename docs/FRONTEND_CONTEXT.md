# FRONTEND_CONTEXT.md — VoluntariAR Web

> Detalle completo del frontend React/Vite. Leer junto con `PROJECT_CONTEXT.md §6-7` (navegación general y contrato con backend).

## 1. Arquitectura React

SPA de React 18 + React Router 7 (`createBrowserRouter`, data router API pero **sin usar `loader`/`action`** — toda la carga de datos ocurre en `useEffect` dentro de cada componente, al estilo "clásico"). No hay code-splitting (`lazy`) ni Suspense boundaries de datos. No hay gestor de estado global aparte de `AuthContext`; cada pantalla mantiene su propio estado con `useState`.

```
main.tsx
 └─ <StrictMode>
     └─ <AuthProvider>            (AuthContext.tsx)
         └─ <RouterProvider>       (routes.tsx)
             ├─ <Root/>            layout para "/", "/feed", "/explore", "/project/:id",
             │                     "/participation", "/notifications", "/profile", "/ngo/:id"
             │                     → <BottomNav/> + <AuthModal/>
             └─ <NGOLayout/>       layout para "/ngo/*" (dashboard, create, empleados, kpis, profile)
                                   → <NGOSidebarNav/> + <NGOBottomNav/> + <AuthModal/>
```

## 2. Organización de carpetas

```
frontend/src/
├── main.tsx                  # bootstrap: StrictMode + AuthProvider + RouterProvider
├── app/
│   ├── routes.tsx             # todas las rutas (createBrowserRouter)
│   └── components/            # 47 archivos .tsx (sin tests) — screens + layouts + widgets
├── lib/
│   ├── api.ts                 # cliente HTTP centralizado + TODOS los tipos TS de dominio (incluye api.posts y el helper de subida multipart)
│   ├── AuthContext.tsx        # sesión global (Context + Provider + hook useAuth)
│   ├── ChatContext.tsx        # chat en tiempo real (WebSocket)
│   ├── format.ts              # timeAgo/formatTime/parseBackendDate (aceptan ISO 8601 y el formato viejo sin zona), truncateText ("ver más"), userMessage (errores para el usuario) y otros formatos
│   ├── sponsorship.ts         # etiquetas y colores de los estados de un patrocinio
│   └── imageCompress.ts       # compresión de fotos en el navegador antes de subirlas (Momentos)
└── styles/
    ├── globals.css             # Tailwind + tema custom (design tokens) + fuentes
    └── (assets, fonts)
```

No existen carpetas `hooks/`, `services/`, `types/`, `utils/` separadas — todo vive en `lib/` (6 archivos) y `app/components/` (plano, sin subcarpetas por dominio).

## 3. Todas las páginas (rutas)

| Ruta | Componente | Layout | Rol requerido (solo backend) |
|---|---|---|---|
| `/` | `PublicFeed` | `Root` | Público (redirige si ya hay sesión) |
| `/feed` | `MainFeed` | `Root` | volunteer (feed de lo que sigue, vía `/api/follows/feed`) |
| `/explore` | `ExploreScreen` | `Root` | cualquiera logueado (búsqueda, filtros, mapa) |
| `/project/:id` (alias `/projects/:id`) | `ProjectDetails` | `Root` | público (con `optionalAuth`) |
| `/participation` | `MyParticipation` | `Root` | volunteer |
| `/notifications` | `NotificationsScreen` | `Root` | cualquiera logueado |
| `/momentos` | `MomentsPage` | `Root` | público (una ONG logueada es redirigida a `/ngo/momentos`) |
| `/messages` | `MessagesScreen` | `Root` | cualquiera logueado |
| `/messages/:userId` | `ChatThread` | `Root` | cualquiera logueado |
| `/profile` | `VolunteerProfile` | `Root` | volunteer |
| `/volunteer/:id` | `VolunteerPublicProfile` | `Root` | público |
| `/ngo/:id` | `NGOPublicProfile` | `Root` | público |
| `/company/:id` | `CompanyPublicProfile` | `Root` | público |
| `/ngo/dashboard` | `NGODashboard` | `NGOLayout` | ngo |
| `/ngo/create` | `CreateVoluntariado` | `NGOLayout` | ngo (sin guarda en frontend) |
| `/ngo/dashboard/project/:id` | `NGOProjectDetail` | `NGOLayout` | ngo |
| `/ngo/profile` | `NGOOwnProfile` | `NGOLayout` | ngo |
| `/ngo/patrocinios` | `NGOPatrocinios` | `NGOLayout` | ngo |
| `/ngo/momentos` | `NGOMoments` | `NGOLayout` | ngo (sin guarda en frontend) |
| `/ngo/empleados/:id` | `NGOEmpleados` | `NGOLayout` | ngo |
| `/ngo/kpis/:projectId` | `NGOKPIs` | `NGOLayout` | ngo |
| `/ngo/messages` | `MessagesScreen` | `NGOLayout` | ngo |
| `/ngo/messages/:userId` | `ChatThread` | `NGOLayout` | ngo |
| `/company/dashboard` | `CompanyDashboard` | `CompanyLayout` | company |
| `/company/profile` | `CompanyOwnProfile` | `CompanyLayout` | company |
| `/company/messages` | `MessagesScreen` | `CompanyLayout` | company |
| `/company/messages/:userId` | `ChatThread` | `CompanyLayout` | company |

`OnboardingScreen.tsx` existe como archivo pero **no está registrado en `routes.tsx`** — código muerto/no alcanzable.

## 4. Todos los componentes (47, sin contar `*.test.tsx`)

### Layouts / navegación
- `Root.tsx` — layout del lado "voluntario/público": `<Outlet/>` + `<BottomNav/>` + `<AuthModal/>` + `<ChatbotWidget/>`.
- `NGOLayout.tsx` — layout del lado "ONG": `<NGOSidebarNav/>` (desktop) + `<NGOBottomNav/>` (mobile) + `<Outlet/>` + `<AuthModal/>` + `<ChatbotWidget/>`.
- `CompanyLayout.tsx` — layout del lado "Empresa", mismo patrón que `NGOLayout` (`CompanySidebarNav`/`CompanyBottomNav`).
- `BottomNav.tsx` — navegación inferior mobile del lado voluntario.
- `NGOBottomNav.tsx` / `NGOSidebarNav.tsx` — navegación del lado ONG (mobile y desktop respectivamente).
- `CompanyBottomNav.tsx` / `CompanySidebarNav.tsx` — navegación del lado Empresa.
- `AuthModal.tsx` — modal de login/registro, controlado por estado global de `AuthContext` (`isAuthModalOpen`, `openAuthModal(mode)`). Único punto de entrada de autenticación en toda la app (no hay páginas `/login` o `/register` dedicadas). Redirige según rol al loguearse: `ngo`→`/ngo/dashboard`, `company`→`/company/profile`, `volunteer`→ se queda donde está.
- `ChatbotWidget.tsx` — botón flotante + panel del Chatbot FAQ, montado en los tres layouts.

### Pantallas — lado voluntario
- `PublicFeed.tsx` — feed público sin login, con CTA a registro; redirige automáticamente si detecta sesión activa.
- `MainFeed.tsx` — feed autenticado, arma la lista desde `/api/follows/feed` (lo que el voluntario sigue), no desde el catálogo completo.
- `ExploreScreen.tsx` — búsqueda, filtros (`FilterModal.tsx`) y mapa (`ProjectMap.tsx`) del catálogo completo de proyectos.
- `ProjectMap.tsx` — mapa con Leaflet (gratis, sin API key), pines custom con `L.divIcon`.
- `FilterModal.tsx` — modal de filtros (categoría, tipo, modalidad, costo) + función pura `filterProjects()` exportada, con tests.
- `ProjectDetails.tsx` — detalle de un proyecto: info completa, botón de inscripción, comentarios (distinguen si el autor participó, `is_participant`), calificación (solo si `my_enrollment_status === 'approved'`, vía `ReviewsModal.tsx`). Reimplementa la blacklist de palabras del backend para validar comentarios en el cliente antes de enviarlos.
- `ProjectCard.tsx` — tarjeta reutilizada en feeds; incluye el modal de inscripción rápida.
- `FeedPostCard.tsx` — tarjeta de post para el feed vertical (like, comentar, inscribirse, calificar vía `ReviewsModal.tsx`).
- `FeedSidebar.tsx` — sidebar de escritorio del feed, puramente presentacional (recibe todo por props).
- `MyParticipation.tsx` — historial de inscripciones del voluntario logueado, con estado (pendiente/aprobada/rechazada) y horas acumuladas. Usa el modal de reseña viejo (`ReviewModal.tsx`, ver nota más abajo).
- `VolunteerProfile.tsx` — perfil propio editable, incluyendo selección de habilidades (chips desde el catálogo `api.catalog.habilidades()` + nivel por habilidad, guardado vía `api.voluntarios.habilidades.update`).
- `VolunteerPublicProfile.tsx` — perfil público de otro voluntario, con follow/unfollow.
- `NotificationsScreen.tsx` — lista de notificaciones, marcar como leídas.
- `OnboardingScreen.tsx` — **no enrutado**, código muerto.

**Nota — dos componentes de reseña que hacen lo mismo:** `ReviewModal.tsx` (105 líneas, usado por `MyParticipation.tsx`) y `ReviewsModal.tsx` (310 líneas, más completo, usado por `FeedPostCard.tsx` y `ProjectDetails.tsx`) califican un proyecto de forma casi idéntica pero son dos archivos independientes — probablemente `ReviewsModal.tsx` es la versión más nueva y debería reemplazar a la otra, pero nadie migró `MyParticipation.tsx` todavía. Candidato a consolidar.

### Pantallas — lado ONG
- `NGODashboard.tsx` — lista de proyectos propios + resumen de inscripciones pendientes por proyecto (una sola llamada agregada a `GET /api/ngos/me`, el N+1 que tenía antes ya se resolvió).
- `CreateVoluntariado.tsx` — formulario de alta/edición de proyecto (mismo componente sirve para crear y editar, diferenciado por `projectId` en query string). Pide modalidad (presencial/remoto/híbrido) y, según la modalidad, ubicación física y/o plataforma digital. Reimplementa validaciones de fecha/cupos/duración ya presentes en el backend.
- `NGOProjectDetail.tsx` — detalle de proyecto desde la óptica de la ONG: lista de inscriptos, aprobar/rechazar, cargar horas.
- `NGOOwnProfile.tsx` — perfil de la ONG editable (nombre, descripción, misión, ubicación, categoría).
- `NGOPublicProfile.tsx` — vista pública del perfil de una ONG (accesible sin login desde `/ngo/:id`), lista sus proyectos activos.
- `NGOPatrocinios.tsx` — propuestas de patrocinio de empresas sobre los proyectos propios: pendientes (aceptar/rechazar) e historial.
- `NGOEmpleados.tsx` — gestión de empleados/miembros del equipo de la ONG. **No usa `api.ts`** — `fetch` directo con token manual desde `localStorage` (`api.ts` no tiene un namespace `empleados` todavía).
- `NGOKPIs.tsx` — CRUD completo (alta/edición/borrado) de indicadores de impacto por proyecto, con resumen visual. Usa `api.projects.kpis.*`.

### Pantallas — lado Empresa
- `CompanyDashboard.tsx` — panel de impacto: 4 KPIs (proyectos patrocinados, propuestas pendientes con contador de rechazadas, horas de voluntariado, voluntarios alcanzados) + lista de proyectos con badge de estado. Horas/voluntarios/cupos solo se muestran en patrocinios `aceptado`. Estado de error con "Reintentar". Usa `api.empresas.dashboard()` y los mapas de `lib/sponsorship.ts`. **No** es la ruta de aterrizaje tras el login (eso sigue siendo `/company/profile`, ver `AuthModal.tsx`).
- `CompanyOwnProfile.tsx` — perfil propio editable + lista de patrocinios propios (proponer, ver estado, retirar uno pendiente).
- `CompanyPublicProfile.tsx` — vista pública del perfil de una Empresa, accesible sin login desde `/company/:id`.

### Momentos (publicaciones con fotos) — ver la sección "Momentos" al final
- `MomentsPage.tsx` — `/momentos`: título + `FeedTabs` + `MomentsFeed`. Pública; al visitante le ofrece ingresar; a una ONG la redirige a `/ngo/momentos`; espera a que termine la verificación de sesión (`initializing`) para no parpadear.
- `NGOMoments.tsx` — `/ngo/momentos`, dentro del panel de la ONG (sin pestañas).
- `MomentsFeed.tsx` — lista paginada (carga, vacío, error, "Ver más"), botón "Compartir un momento" y alta/borrado en la lista. Acepta `filters` (`project_id`/`user_id`) para las galerías de la Etapa 3.
- `PostCard.tsx` — una publicación: autor, proyecto, carrusel, me gusta optimista con rollback, borrar según `can_delete`, texto con "ver más".
- `PhotoCarousel.tsx` — carrusel (botones, flechas del teclado, deslizar con el dedo).
- `PostComposer.tsx` — modal para publicar (proyecto, hasta 5 fotos con vista previa, texto de hasta 500, compresión, aviso de fotos propias).
- `FeedTabs.tsx` — pestañas "Proyectos | Momentos" (son enlaces, no estado).
- `MomentsGrid.tsx` — grilla de miniaturas (`thumb_url`, 3 columnas, 9 por página) filtrada por `project_id` o `user_id`; al tocar una se abre la publicación completa (`PostCard`) en un modal. Misma paginación y recarga que `MomentsFeed`. Se usa en `ProjectDetails` (galería del proyecto) y `VolunteerPublicProfile` (por id de *usuario*).

### Chat
- `MessagesScreen.tsx` — lista de conversaciones (compartido entre voluntario, ONG y empresa).
- `ChatThread.tsx` — hilo de una conversación puntual: historial, envío (WS con fallback a REST), marcado automático de leído al abrir.

### Otros
- `ReviewModal.tsx` / `ReviewsModal.tsx` — ver nota de duplicación arriba.

## 5. Hooks

No hay hooks custom (no existe `useX.ts` fuera de `useAuth` exportado por `AuthContext.tsx` y `useChat` exportado por `ChatContext.tsx`). Todo el "data fetching" se hace con `useEffect` + `useState` local, repetido componente a componente (patrón: `loading`, `error`, `data` como tres `useState` separados en casi cada pantalla).

## 6. Contexts

Dos contexts: `AuthContext` (`lib/AuthContext.tsx`) y `ChatContext` (`lib/ChatContext.tsx`).

```ts
interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;               // true mientras se revalida sesión al montar
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  login(email, password): Promise<void>;
  register(data): Promise<void>;
  logout(): void;
  openAuthModal(mode?): void;
  closeAuthModal(): void;
  updateUser(partial: Partial<User>): void;
}
```

- Al montar, si hay `v_token` en `localStorage` pero no `v_user`, llama a `GET /api/auth/me` para hidratar; si el token es inválido, limpia ambas claves.
- `login`/`register` llaman a `api.auth.login`/`api.auth.register`, guardan en `localStorage` (`v_token`, `v_user`) y actualizan el estado.
- `logout` es puramente client-side: borra `localStorage` y el estado en memoria. **No invalida el token en el servidor** (no existe endpoint de logout/blacklist).

```ts
interface ChatContextValue {
  conversations: Conversation[];
  unreadTotal: number;
  connected: boolean;             // estado de la conexión de WebSocket
  refreshConversations(): void;
  onMessage(cb): () => void;      // suscripción a mensajes entrantes por WS
  sendViaSocket(to, body): boolean; // intenta mandar por WS; false si no hay conexión
}
```

- Montado en `main.tsx` **dentro** de `AuthProvider` (necesita `useAuth()` para saber cuándo abrir/cerrar el socket).
- Abre la conexión de WebSocket (`new WebSocket(...)`) cuando hay `user`+`token`, la cierra cuando no. La URL se deriva de `BASE` (la misma constante que usa el cliente REST) reemplazando `/api` por `/ws` y `http` por `ws`.
- Mantiene `conversations` refrescándose vía `GET /api/messages/conversations` cada vez que llega un mensaje nuevo por WS, y expone `unreadTotal` (suma de no leídos) para los badges de navegación.
- `onMessage(cb)` permite que `ChatThread.tsx` se suscriba a mensajes entrantes sin que `ChatContext` necesite saber en qué hilo está parado el usuario — el componente filtra por `sender_id`/`receiver_id` él mismo.

## 7. Servicios / API (`lib/api.ts`)

Cliente HTTP centralizado, sin dependencias externas (fetch nativo). Estructura:

```ts
const API_URL = import.meta.env.VITE_API_URL;

async function request(path, options) {
  const token = localStorage.getItem('v_token');
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json',
               ...(token && { Authorization: `Bearer ${token}` }) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

export const api = {
  auth: { register, login, me, updateMe },
  projects: { list, get, create, update, remove, comment, rate, kpis, recommended... },
  enrollments: { enroll, byProject, byVolunteer, approve, reject, logHours },
  ngos: { list, get, me, updateMe, employees, patrocinios: { list, decide }... },
  empresas: { me, get, update, dashboard, patrocinios: { list, propose, withdraw } },
  follows: { ngo, project, volunteer, feed... },
  faqs: { list, ask },
  notifications: { list, markRead },
};
```

Todos los tipos de dominio (`User`, `Project`, `NGO`, `Empresa`, `Enrollment`, `Notification`, `Faq`, `Patrocinio`, etc.) están definidos como `interface` en este mismo archivo — no hay un módulo `types/` separado.

**Componentes que rompen este patrón** (fetch directo, no vía `api.ts`): `NGOEmpleados.tsx`.

## 8. Modelos TypeScript (resumen — ver `api.ts` para el detalle campo por campo)

| Interface | Corresponde a |
|---|---|
| `User` | fila de `users` (id, name, email, role, created_at) |
| `Project` | proyecto formateado por `fmt()` del backend — incluye `roles: string[]`, `requirements: string[]`, `category?: string`, `latitude?/longitude?`, `modality?`, `my_enrollment?: Enrollment` |
| `NGO` | ONG formateada por `fmtNgo()` — incluye `category?: string` |
| `Empresa` | Empresa formateada por `fmtEmpresa()` — incluye `category?/industry?` |
| `Enrollment` | inscripción: `id, project_id, volunteer_id, status, message?, hours_logged, created_at` |
| `Notification` | `id, user_id, type, content, read, created_at` |
| `Faq` | `id, categoria?, pregunta, respuesta` |
| `Patrocinio` | propuesta de patrocinio Empresa↔Proyecto: `empresa_id, project_id, estado, mensaje?, aporte, ...` |
| `CompanyDashboard` | respuesta de `GET /api/empresas/me/dashboard`: `stats`, `impact`, `projects: CompanyDashboardProject[]` (claves en inglés; `sponsorship_status` reusa los valores de `Patrocinio['estado']`) |

## 9. Flujo de navegación (detalle por rol)

```mermaid
flowchart TD
    Start["Visitante anónimo"] --> PF["/ (PublicFeed)"]
    PF -->|Registrarse/Entrar| Modal["AuthModal"]
    Modal -->|role=volunteer| MF["/feed"]
    Modal -->|role=ngo| ND["/ngo/dashboard"]
    Modal -->|role=company| CP["/company/profile"]

    MF --> PD["/project/:id"]
    MF --> EX["/explore (buscar/filtrar/mapa)"]
    PD -->|Inscribirse| EnrollModal["Modal de inscripción"]
    PD -->|ver ONG| NPP["/ngo/:id (público)"]
    PD -->|ver Empresa| CPP["/company/:id (público)"]
    PD -->|ver voluntario| VPP["/volunteer/:id (público)"]

    ND --> CV["/ngo/create"]
    ND --> NPD["/ngo/dashboard/project/:id"]
    NPD -->|aprobar/rechazar inscriptos| NPD
    NPD -->|cargar horas| NPD
    ND --> NKPI["/ngo/kpis/:projectId"]
    ND --> NEmp["/ngo/empleados/:id"]
    ND --> NPat["/ngo/patrocinios"]

    CP -->|proponer patrocinio| ND
```

## 10. Flujo de autenticación (frontend)

1. Usuario abre `AuthModal` (login o registro) desde cualquier pantalla.
2. Al submit, `AuthContext.login()`/`register()` llama a `api.auth.*`.
3. Éxito → `localStorage.setItem('v_token', ...)`, `setUser(...)`, `closeAuthModal()`.
4. Componentes como `AuthModal` observan `user` vía `useAuth()` y redirigen automáticamente con `navigate()` en un `useEffect` cuando detectan sesión: `ngo`→`/ngo/dashboard`, `company`→`/company/profile`, `volunteer` se queda donde está (normalmente `/`, que ya muestra el feed público).
5. Error → el modal muestra `err.message` (el string ya viene en español desde el backend).

No hay persistencia de "a dónde volver" tras el login — siempre redirige a la home del rol, perdiendo el contexto de si el usuario estaba intentando inscribirse a un proyecto específico.

## 11. Estado global

Limitado a `AuthContext`. No hay estado global de UI (temas, filtros persistentes, carrito, etc.) — cada pantalla resetea sus filtros al desmontar/montar.

## 12. Manejo de errores

- Sin *error boundary* de React en ningún nivel — un throw no capturado en render rompe la pantalla completa (pantalla en blanco), no solo un componente.
- Cada componente atrapa errores de `fetch`/`api.*` con `try/catch` local y los muestra con un `useState<string|null>` propio, normalmente renderizado como texto rojo inline — no hay un componente `<ErrorBanner/>` reutilizable ni un sistema de toasts/notificaciones de error.
- No hay reintento automático ni manejo específico de 401 (expiración de sesión) salvo en `NGODashboard`, que inspecciona el string del mensaje de error buscando "Token"/"autenticado" para decidir redirigir a `/`.

## 13. Convenciones de componentes

- Cada componente es un archivo `.tsx` con export nombrado (no default), nombrado igual que el archivo.
- Sin `React.memo`, sin `useCallback`/`useMemo` — no hay optimizaciones de re-render (razonable dado el tamaño de la app).
- Sin PropTypes ni `interface Props` compartida — cada componente define su propio `Props` inline si recibe alguna (la mayoría son "screen-level" y no reciben props, solo leen `useParams()`/`useAuth()`).

## 14. Convenciones de estilos

- Tailwind CSS 4 utilitario, clases inline en el JSX (no hay CSS Modules ni styled-components).
- `styles/globals.css` define variables de tema (colores, radios, fuentes) como custom properties CSS, consumidas por las clases de Tailwind vía `@theme` (Tailwind 4).
- Iconografía consistente con `lucide-react`.
- No hay un sistema de componentes UI compartido (no hay `Button.tsx`, `Card.tsx`, `Input.tsx` genéricos) — cada pantalla reescribe sus propios `<button className="...">` con las mismas clases repetidas copy-pasteadas. Esto es consistente con el origen "Figma-to-code" del proyecto (ver `PROJECT_CONTEXT.md §11`).

## 15. Problemas detectados

1. **`OnboardingScreen.tsx` no está enrutado** — código muerto, o una ruta que falta agregar (ambigüedad a resolver con el dueño del proyecto antes de borrar el archivo).
2. **`NGOEmpleados.tsx` evita `api.ts`** — sigue pendiente (ver §4/§7).
3. **Dos componentes de reseña que hacen lo mismo** (`ReviewModal.tsx` vs `ReviewsModal.tsx`) — ver nota en §4. Candidato a consolidar antes de que alguien edite uno pensando que corrige los dos.
4. **Sin guardas de rol/ruta en el frontend**: cualquier usuario (incluso sin sesión) puede navegar a `/ngo/*` o `/company/*` y ver la UI (los `fetch` internos fallarán con 401/403 del backend y se mostrará un error, pero la experiencia no es una redirección limpia).
5. **Sin paginación real en `ExploreScreen.tsx`**: pide el catálogo completo con un `limit` alto fijo (`200`) en vez de "cargar más"/scroll infinito — funciona hoy, pero no escala indefinidamente si el catálogo de proyectos crece mucho. Ver `PROJECT_ANALYSIS.md §29` bug 4.
6. **Validaciones duplicadas** (regex de email/password/nombre en `AuthModal.tsx`, blacklist de palabras en `ProjectDetails.tsx`) que deben mantenerse manualmente sincronizadas con el backend.
7. **Sin manejo centralizado de expiración de sesión** — un 401 en medio de la navegación no redirige consistentemente al login en todas las pantallas.
8. **Sin tests automatizados** para varios de los componentes más grandes y recientes: `ProjectMap.tsx`, `FeedPostCard.tsx`, `ReviewsModal.tsx`, `VolunteerPublicProfile.tsx`, `FeedSidebar.tsx`, `ExploreScreen.tsx`, `CreateVoluntariado.tsx` — se revisaron a mano (ver `PROJECT_ANALYSIS.md §29`) pero no tienen red de seguridad automática.

## 16. Posibles mejoras

- Extraer un hook `useApi()`/`useFetch()` genérico (loading/error/data) para eliminar la repetición de los tres `useState` en cada pantalla.
- Agregar un componente `<ProtectedRoute role="ngo">` (y equivalente para `company`) que envuelva las rutas de `NGOLayout`/`CompanyLayout` y redirija limpiamente si el rol no coincide, en vez de depender solo del rechazo del backend.
- Crear una pequeña librería de componentes UI compartidos (`Button`, `Input`, `Card`, `Spinner`, `ErrorBanner`) para reducir la duplicación de clases Tailwind.
- Migrar `NGOEmpleados.tsx` a `api.ts` (agregar el namespace `empleados` que falta).
- Consolidar `ReviewModal.tsx` y `ReviewsModal.tsx` en un solo componente.
- Agregar un `ErrorBoundary` de React a nivel de cada layout (`Root`, `NGOLayout`, `CompanyLayout`) para evitar pantallas en blanco ante errores no capturados.
- Registrar o eliminar `OnboardingScreen.tsx` según la intención real del equipo.
- Sumar tests para los componentes grandes listados en el problema 8.

## Momentos (publicaciones con fotos) — estado del frontend
> **Etapas 2 y 3 completas** (`PROJECT_ANALYSIS.md §43`, `§46`, `§47` y `§48`). Queda verificar una subida real a Cloudinary.

**Cómo se llega:** voluntarios y visitantes, con la pestaña **Momentos** de `FeedTabs` (en `MainFeed` y en `PublicFeed`) → `/momentos`. La ONG **no** tiene pestañas: entra por "Momentos" en su barra lateral (escritorio) o por el botón "Momentos" del header de `NGODashboard` (celular) → `/ngo/momentos`. **No se agregó un ítem a las barras inferiores** (la del voluntario ya tiene 5, la de la ONG también). Hoy, en `/momentos`, ningún ítem de la barra del voluntario queda resaltado (el de "Inicio" solo se marca en `/feed`).

**Piezas:**
- **`api.posts`** (`lib/api.ts`): `list`, `get`, `eligibleProjects`, `create`, `like`, `unlike`, `remove` y los tipos `Post`, `PostPhoto`, `PostsPage`, `EligibleProject`. `create` usa un helper aparte (`upload`) que **no fija `Content-Type`**: `req()` fuerza `application/json` y con eso el servidor nunca recibiría los archivos del multipart.
- **`lib/imageCompress.ts`**: `compressImage(file)` reduce a 1600 px, recodifica como JPEG (0,82), fondo blanco para PNG transparentes, no toca fotos chicas y livianas, y falla con mensajes para el usuario. Los límites (tipos y 8 MB) deben coincidir con `backend/src/routes/posts.js`.
- **`lib/format.ts`**: `timeAgo` y `formatTime` (hora del chat): las dos pasan por `parseBackendDate`, aceptan ISO (con o sin zona) y el formato viejo, y devuelven `""` si no es una fecha. Toda fecha del backend se parsea con `parseBackendDate`, nunca con `new Date(x + "Z")` (`PROJECT_ANALYSIS.md §46`, `§53`); `truncateText(texto, max, maxLines)` ("ver más": corta por caracteres y por líneas, en límite de palabra) y `userMessage(err, respaldo)` (muestra el mensaje del servidor, que viene en español, salvo un `TypeError` de red, que se reemplaza).
- **Componentes:** ver la lista en la sección 4.

**Reglas de comportamiento que importan (cada una tiene su test):**
- **`can_delete` manda el servidor.** `PostCard` muestra el botón de borrar solo si `post.can_delete`; el cliente no deduce nada (conoce el id del autor, no quién es la ONG dueña). Comparar `user.id === author.id` se usa **solo** para elegir el texto de la confirmación.
- **`post.author.id` es el id del *usuario*.** Solo los voluntarios tienen perfil público (`/volunteer/:id`); el nombre de una ONG no se enlaza.
- **Me gusta optimista:** cambia la pantalla al instante, se ajusta al número del servidor y, si falla, se revierte y avisa. Con un pedido en vuelo se ignoran los toques nuevos. Sin sesión abre el modal de ingreso y no llama a la API.
- **Paginación (`MomentsFeed`):** `offset` = lo que el servidor *devolvió* (no lo que se muestra); se deduplica por id; borrar una publicación del feed resta 1 al offset y publicar una suma 1; una publicación nueva que no corresponde al filtro (otro proyecto/autor) no se agrega; una respuesta vieja que llega tarde (cambio de filtro) se descarta.
- **El feed recarga cuando cambia el *id* del usuario** (no su objeto): `liked_by_me` y `can_delete` los calcula el servidor según quién mira, y un visitante puede iniciar sesión desde el modal sin salir de la pantalla.
- **Compositor:** tope de 5 fotos y de 500 caracteres; la compresión corre al publicar y, si una foto falla, no se sube nada y se conserva el formulario; tras publicar el botón queda bloqueado hasta que `MomentsFeed` cierra el modal (evita publicar dos veces); pregunta antes de descartar si hay fotos o texto.

**Etapa 3:** `ProjectDetails` y `VolunteerPublicProfile` muestran `MomentsGrid`; `NGOProjectDetail` muestra `MomentsFeed` del proyecto **sin compositor** (`showComposer={false}`), y el botón de borrar le aparece en cualquier publicación porque el servidor manda `can_delete`. Límite: el modal de `MomentsGrid` guarda una copia de la publicación; si se da me gusta dentro del modal y se cierra y reabre, la tarjeta muestra el estado anterior hasta recargar (por lectura del código; sin test).

**Verificado por Matías en local (`PROJECT_ANALYSIS.md §49`):** la subida real a Cloudinary. **Sin verificar:** cómo se ve todo (Tailwind), el deslizar con el dedo en un celular real, el foco/teclado del modal (no hay *focus trap*) y todo lo anterior en producción (Render).
