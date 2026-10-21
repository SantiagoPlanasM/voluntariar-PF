# Rediseño del frontend: análisis y plan de implementación

> **Estado:** plan, sin código cambiado (2026-10-20, `PROJECT_ANALYSIS.md` §239).
> **Fuente del diseño:** `docs/DESIGN.md` v1.1 (el borrador `DESIGN2.md` corregido y completado).
> **Mockups, antes y después:** lienzo "VoluntariAR · Rediseño antes y después",
> https://claude.ai/artifact/VhiPSJzFLGNvEeBxgiYRCm (privado: hay que compartirlo desde su menú para
> que lo vea otra persona). Las versiones "antes" son **capturas reales** de la app corriendo en local
> con los datos de `seed.js`. Las "después" son HTML dibujado con los tokens del DESIGN.

## 1. Cómo está hoy

### 1.1 En números

| | Hoy |
|---|---|
| Componentes (`app/components`, sin tests) | 57 archivos, 11.503 líneas |
| Archivos de test (frontend) | 82; 904 tests, cobertura 90 % de líneas |
| Los más grandes | `ProjectMap` 834, `ExploreScreen` 786, `ProjectDetails` 652, `CreateVoluntariado` 575, `FeedPostCard` 531 |
| Componentes de UI compartidos (`Button`, `Card`, `Input`…) | ninguno: cada pantalla copia sus clases (`FRONTEND_CONTEXT.md` §14) |
| Colores escritos a mano (`#xxxxxx`) en componentes | 61 (el más usado, `#1E3A2F`, 14 veces) |
| Usos de familias de color de Tailwind | `emerald` 460, `red` 152, `blue` 132, `violet` 76, `amber` 65, `green` 28, `rose` 22, `teal` 8, `indigo` 6 |
| `shadow-*` / `bg-gradient-*` | 176 / 20 |
| Textos de 10–11 px (`text-[10px]`, `text-[11px]`) | 76 |
| `font-black` (peso 900) | 39 |
| Clases `dark:` | 0 (hay un bloque `.dark` en `theme.css` que nadie usa) |
| `alert()` / `window.confirm()` | 8 / 5 (ver 1.4) |
| Fuente | ninguna: `fonts.css` y `globals.css` están vacíos, se ve la del sistema operativo |

Los conteos salen de `grep` sobre `frontend/src/app/components/*.tsx` sin los tests.

### 1.2 Lo que está bien y se queda

- **`lib/api.ts`** como único cliente HTTP y fuente de los tipos (reglas 2, 4 y 6). El rediseño no
  toca contratos salvo donde la parte 4 lo dice.
- **Accesibilidad:** nombres accesibles en botones de ícono, `aria-pressed`, etiquetas asociadas,
  tarjetas que son `<Link>`, `role="alert"` en errores, controlado por `A11yNames.test.tsx` (§80,
  §203).
- **`Modal.tsx`**: foco atrapado, Escape, scroll bloqueado. La hoja inferior nueva se construye
  encima de él, no al lado.
- **Manejo de errores:** `LoadError` / `InlineError` / `describeLoadError` y `useLatestRequest`
  (§64–§65, §83, §89). Cambia su aspecto, no su lógica.
- **Lógica ya probada:** `filterProjects`, `checkDonationAmount`, `formatPesos`, `timeAgo`,
  `formatDateOnly`, la paginación de `MomentsFeed`, el me gusta optimista de `PostCard`.
- **Stack:** React 18, Router 7, Tailwind 4, `lucide-react`, Leaflet. No hace falta ninguna
  dependencia nueva (regla 18).

### 1.3 Problemas visuales (se ven en las capturas del lienzo)

1. **Un color por rol.** Voluntario esmeralda, ONG azul, empresa violeta (`BottomNav.tsx`,
   `Root.tsx`). Además, azul es "Fugaz" y verde "Sostenido". El color no significa nada.
2. **Cuatro verdes distintos para lo mismo:** `#2f4f2f` ("Inscribirse" en `FeedPostCard`),
   `emerald-600` ("Unirme como voluntario" en `ProjectDetails`), `#1E3A2F` y `#3d6139` (barras).
3. **La misma cosa se dibuja de tres maneras:** la tarjeta de voluntariado de la portada
   (`PublicFeed`, con "Inscribirme" visible), la del Inicio (`FeedPostCard`, con "Inscribirse"
   escondido en el acordeón) y las de Explorar (carruseles). La acción principal de la app no se ve
   en el Inicio de quien ya tiene sesión.
4. **Logo = corazón**, el mismo ícono que se usaría para "me gusta". "Seguir" es un marcador sin
   texto.
5. **Avatares:** personas y ONGs son círculos iguales, con iniciales de DiceBear en colores al azar
   (rojo, amarillo, violeta). Nada distingue a una ONG ni dice si es confiable.
6. **Tipografía:** sin fuente propia, títulos en peso 900, etiquetas en mayúsculas espaciadas,
   76 textos de 10–11 px.
7. **Perfil propio:** portada con degradé verde, cinco estadísticas con íconos de colores y la
   "Zona peligrosa" (borrar cuenta) **en el medio**, antes de las ONGs seguidas.
8. **Panel de la ONG:** cuatro tarjetas de colores (verde, azul, amarillo, violeta) y un aviso
   amarillo de Mercado Pago.
9. **Botón flotante del asistente** en todas las pantallas: tapa contenido y obliga a dejar un
   espacio al final (`ChatbotSpacer`, §128).
10. **"Momentos"** es una pestaña aparte del feed: las publicaciones de la gente no conviven con
    los voluntariados.
11. **Detalle del voluntariado:** cada dato en su caja, una tarjeta dentro de otra, y el botón fijo
    de abajo en gris ("Inscripto · Pendiente") sin el de donar.
12. **Errores de forma:** `index.html` con `lang="en"`; el nombre aparece como "Voluntariar" y
    "VoluntariAR"; `animate-fadeIn` se usa en `FeedPostCard` y `ReviewsModal` pero no está definida
    (no anima nada).

### 1.4 Problemas de estructura

1. **Sin kit de UI:** 196 `rounded-xl`, 121 `rounded-2xl` y 16 `rounded-3xl` repartidos sin regla.
   Cambiar el aspecto de "un botón" es tocar decenas de archivos.
2. **Navegación triplicada:** `Root.tsx` tiene su propia lista de enlaces por rol (con "Dashboard",
   "Nuevo Voluntariado"…) distinta de `NGO_NAV_LINKS`/`COMPANY_NAV_LINKS`, que comparten
   `BottomNav`, `NGOBottomNav` y `CompanyBottomNav`; las barras laterales de ONG y empresa son
   otros dos componentes. Son tres layouts (`Root`, `NGOLayout`, `CompanyLayout`) con la misma
   forma.
3. **Tema heredado de shadcn** (`theme.css`): 38 variables en `:root` (`--chart-1`, `--sidebar-ring`…) que casi
   no se usan, y `main.tsx` importa `tailwind.css` y `theme.css` otra vez, aunque `index.css` ya los
   importa.
4. **`alert()` y `window.confirm()`** en `NGODashboard`, `NGOProjectDetail` (3), `NGOKPIs`,
   `MyParticipation`, `ProjectMap` (2), `PostCard`, `PostComposer`, `CompanyOwnProfile`,
   `NGOBottomNav` y `CompanyBottomNav`. Rompen el estilo y no se pueden probar bien.
5. **Componentes enormes** que mezclan carga de datos, reglas y dibujo (`ExploreScreen`,
   `ProjectDetails`, `FeedPostCard`). Las reglas de qué botón mostrar en cada estado están
   escritas dentro del JSX, en cada tarjeta por separado.

### 1.5 Lo que el DESIGN pide y el backend no tiene

Revisado contra `migrate.js` y las rutas (no solo contra los documentos):

| Lo que pide el diseño | Hoy | Qué haría falta |
|---|---|---|
| Fecha del voluntariado ("Sáb 8 de nov.") | `projects.fecha_inicio`/`fecha_fin` **existen** en la base pero `fmt()` no los devuelve; solo `duracion` como texto libre | Sumar `start_date`/`end_date` a `fmt()` y al `interface Project` (regla 7). Chico |
| Insignia de ONG validada | No hay columna ni flujo | `ngos.verificada`, tabla de solicitudes, rol administrador, revisión. Grande |
| Patrocinadores en la tarjeta | `empresa_voluntariados` con `estado='aceptado'`, pero el listado no los trae | Agregarlos (nombre, logo) al listado de proyectos, en una consulta por lote |
| "Seguido por Juan y Lucía" | `volunteer_follows` y `project_follows` existen | Cruce de los dos en el feed. Mediano |
| Rol elegido al inscribirse, cupos por rol | `project_roles.cantidad` existe; `enrollments` no guarda el rol | `enrollments.rol_id` + control de cupo por rol (regla 20). Mediano, toca la invariante de cupos |
| Lugares reservados por empresas | `empresa_voluntariados` solo tiene `aporte`, `estado`, `mensaje` | Columna de cupos reservados y reglas. Mediano |
| Comentarios, guardados y empresas en publicaciones | `posts` solo de voluntarios y ONGs, sin comentarios ni guardados | Tablas `post_comments`, `post_saves`; rol `company` en `posts`. Mediano |
| Dato de impacto en una publicación | Los KPIs existen por proyecto | `posts.kpi_id` o valor + texto. Chico |
| A qué se destina el dinero | No existe | Tabla `project_destinos`. Chico |
| Donación mensual | No existe | Suscripciones de Mercado Pago. Grande (fuera de alcance) |
| "Activo hace 5 min", "Visto" | El chat marca leída la conversación entera | Presencia y lectura por mensaje. Mediano |
| Preferencias de avisos | No existen | Tabla de preferencias. Chico |
| Intereses elegidos en el onboarding | Se deducen del historial | Tabla de intereses del voluntario. Chico |
| Feed mezclado (voluntariados + publicaciones) | Dos endpoints: `/follows/feed` y `/posts` | Mezclarlos en el cliente por fecha (fase 3). Un endpoint único, después |

**Nada de esta tabla se hace sin tu OK** (regla 9 y "no tocar sin avisarme" en la práctica). Todo el
rediseño visual funciona sin estos cambios: lo que no tiene datos no se dibuja (por ejemplo, sin
patrocinadores no hay círculos; sin fecha se muestra `duration` como hoy).

## 2. Decisiones

1. **Rediseño completo, una pantalla por vez.** Cada fase deja la app funcionando y desplegable.
   No hay "modo nuevo" con una bandera: cada componente que se rediseña reemplaza al viejo.
2. **Sin dependencias nuevas.** Kit de UI propio en `src/app/ui/` (unos 15 componentes chicos),
   arriba de Tailwind 4 y Lucide. Nada de shadcn/Radix/MUI (regla 18).
3. **Tokens en un solo lugar:** `styles/theme.css` se reescribe con los tokens del DESIGN como
   variables CSS, expuestas a Tailwind con `@theme`. Ningún componente usa un color de la paleta
   de Tailwind (`emerald-600`) ni un `#hex`: solo tokens (`bg-brand`, `text-ink-muted`). Un test lo
   controla (fase 0).
4. **Modo oscuro desde el principio:** como todo usa tokens, el tema oscuro es redefinir variables
   bajo `[data-theme="dark"]` y `prefers-color-scheme`. Se prueba pantalla por pantalla.
5. **Fuente servida por la app** (`public/fonts/PlusJakartaSans-*.woff2`, licencia OFL), no desde
   Google Fonts.
6. **Un solo layout** (`AppShell`) con la navegación por rol de `DESIGN.md` ("Navegación por rol");
   las listas de enlaces salen de un único archivo de configuración.
7. **"Momentos" pasa a llamarse "Publicaciones"** en la interfaz (la ruta `/momentos` redirige). En
   la API y la base sigue siendo `posts`.
8. **El asistente se muda a Mensajes** como conversación fijada; se borran el botón flotante y
   `ChatbotSpacer`.
9. **Se mantiene Leaflet** para los mapas y **Checkout Pro** para pagar (ver DESIGN 1.1).

## 3. Arquitectura nueva

```
frontend/src/
├── styles/
│   ├── fonts.css          # @font-face de Plus Jakarta Sans (400–800)
│   ├── theme.css          # tokens del DESIGN (claro + oscuro) y @theme para Tailwind
│   └── index.css          # base: reset, foco visible, reduced-motion
├── app/
│   ├── ui/                # kit: Button, IconButton, Chip, Avatar, VerifiedBadge, Meter,
│   │                      #      DualGoal, Sheet, ConfirmDialog, Toast, Field, Switch,
│   │                      #      SegmentedControl, Tabs, Skeleton, EmptyState
│   ├── layout/            # AppShell, TopBar, BottomNav, SideNav, navConfig.ts
│   ├── volunteering/      # VolunteeringCard, VolunteeringTile, LinkStrip, cardActions.ts
│   ├── posts/             # PostCard, PostComposer, PhotoCarousel (movidos de components/)
│   └── components/        # pantallas; se van achicando a medida que usan el kit
└── lib/                   # sin cambios de estructura; se suman formatDateRange y useTheme
```

Las carpetas nuevas se crean en la fase que las necesita; los archivos que se mueven arrastran sus
tests en el mismo commit.

### Ejemplo 1: tokens (`styles/theme.css`)

```css
:root {
  --canvas: #FFFFFF;      --canvas-soft: #F4F6F9;
  --surface: #FFFFFF;     --surface-soft: #F1F3F6;   --surface-pressed: #E6E9EE;
  --hairline: #E4E8ED;    --border-strong: #8A939E;
  --ink: #0F1419;         --ink-soft: #3D4652;       --ink-muted: #646E7A;  --on-ink: #FFFFFF;
  --brand: #2457D6;       --brand-text: #2457D6;     --brand-soft: #E8EFFD; --brand-pressed: #1B44AE;
  --people: #2E6B3F;      --people-text: #2E6B3F;    --people-soft: #E7F3EA; --people-pressed: #235431;
  --like: #E5484D;        --star: #E0A100;           --critical: #D12D21;
}
[data-theme="dark"] {
  --canvas: #0B0D10;      --canvas-soft: #0B0D10;
  --surface: #15181C;     --surface-soft: #1E2227;   --surface-pressed: #282D33;
  --hairline: #2A2F36;    --border-strong: #5C646E;
  --ink: #F2F4F7;         --ink-soft: #C2C8D0;       --ink-muted: #8E96A1;  --on-ink: #0B0D10;
  --brand: #3366E6;       --brand-text: #7FA6FF;     --brand-soft: #16244A;
  --people: #2F7A45;      --people-text: #6CC287;    --people-soft: #14301D;
  --like: #FF5C61;        --star: #F0B429;           --critical: #FF6B5E;
}
@theme inline {
  --color-canvas: var(--canvas);   --color-surface: var(--surface);  --color-surface-soft: var(--surface-soft);
  --color-ink: var(--ink);         --color-ink-soft: var(--ink-soft); --color-ink-muted: var(--ink-muted);
  --color-brand: var(--brand);     --color-brand-text: var(--brand-text);
  --color-people: var(--people);   --color-people-text: var(--people-text);
  /* … el resto igual … */
  --font-sans: "Plus Jakarta Sans", system-ui, sans-serif;
  --radius-sm: 10px; --radius-md: 12px; --radius-lg: 16px; --radius-xl: 24px;
}
```

El tema "como el teléfono" se resuelve con un script de 5 líneas en `index.html` que pone
`data-theme` antes de pintar (sin parpadeo), y `useTheme()` en `lib/` para Configuración.

### Ejemplo 2: el botón, antes y después

Antes (`FeedPostCard.tsx`, una de las muchas copias):

```tsx
<button
  onClick={handleEnroll}
  disabled={enrolling || enrolled}
  className={`w-full py-3 rounded-2xl font-bold text-sm text-center transition-all shadow-sm flex items-center justify-center gap-2 ${
    enrolled
      ? 'bg-gray-100 text-gray-500 cursor-default'
      : 'bg-[#2f4f2f] hover:bg-[#253f25] text-white active:scale-[0.99] shadow-emerald-900/10 cursor-pointer'
  }`}
>
```

Después (`app/ui/Button.tsx` y su uso):

```tsx
const VARIANTS = {
  join:      'h-12 rounded-md bg-people text-white active:bg-people-pressed',
  donate:    'h-12 rounded-md bg-brand  text-white active:bg-brand-pressed',
  primary:   'h-10 rounded-sm bg-ink text-on-ink',
  secondary: 'h-10 rounded-sm bg-surface-soft text-ink active:bg-surface-pressed',
  text:      'h-10 px-2 text-ink font-semibold',
  danger:    'h-10 px-2 text-critical font-semibold',
} as const;

export function Button({ variant = 'primary', busy, busyLabel, children, ...rest }: ButtonProps) {
  return (
    <button {...rest} aria-busy={busy || undefined} disabled={rest.disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 px-4 text-[15px] font-bold
        transition-transform duration-[120ms] active:scale-[.97] disabled:opacity-40 ${VARIANTS[variant]}`}>
      {busy ? busyLabel : children}
    </button>
  );
}

// En la tarjeta:
<Button variant="join" onClick={enroll} busy={enrolling} busyLabel="Enviando…">Inscribirme</Button>
```

### Ejemplo 3: las reglas de los botones, fuera del JSX

La tabla "Estados de los botones" del DESIGN pasa a una función pura, la usan la tarjeta, la página
del voluntariado y la barra fija, y se prueba sin dibujar nada:

```ts
// app/volunteering/cardActions.ts
export type JoinAction =
  | { kind: 'join' } | { kind: 'pending' } | { kind: 'accepted' } | { kind: 'rejected' }
  | { kind: 'full' } | { kind: 'past' } | { kind: 'hidden' };
export type DonateAction = { kind: 'donate' } | { kind: 'goal-met' } | { kind: 'hidden' };

export function cardActions(p: Project & { my_enrollment_status?: EnrollmentStatus | null },
                            viewer: UserRole | null): { join: JoinAction; donate: DonateAction } {
  const past = p.status === 'completed';
  const join: JoinAction =
    viewer === 'ngo' || viewer === 'company' ? { kind: 'hidden' }
    : past ? { kind: 'past' }
    : p.my_enrollment_status === 'pending'  ? { kind: 'pending' }
    : p.my_enrollment_status === 'approved' ? { kind: 'accepted' }
    : p.my_enrollment_status === 'rejected' ? { kind: 'rejected' }
    : p.current_volunteers >= p.volunteers_needed && p.volunteers_needed > 0 ? { kind: 'full' }
    : { kind: 'join' };
  const donate: DonateAction =
    viewer === 'ngo' || past || !p.accepts_donations ? { kind: 'hidden' }
    : p.funding_goal > 0 && p.current_funding >= p.funding_goal ? { kind: 'goal-met' }
    : { kind: 'donate' };
  return { join, donate };
}
```

(`accepts_donations` hoy viene solo en el detalle, `ProjectDetail`; para la tarjeta del feed hay
que sumarlo al listado, que es una consulta más por lote. Va en la fase 2 con tu OK.)

### Ejemplo 4: una tarjeta para todo

```tsx
<VolunteeringCard project={p} variant="feed" />   // Inicio y portada (cerrada / abierta)
<VolunteeringTile project={p} />                  // Explorar, perfil de ONG, Seguidos (4:5)
<VolunteeringRow  project={p} trailing={<StatusChip status="pending" />} />  // listas
```

Reemplazan a `FeedPostCard`, la tarjeta de `PublicFeed`, las tarjetas de `ExploreScreen` y las
listas de `NGOPublicProfile`/`NGOOwnProfile`/`CompanyPublicProfile`.

## 4. Fases

Cada fase es uno o más commits chicos (un commit por tarea), con tests primero, documentación en el
mismo cambio y una sección en `PROJECT_ANALYSIS.md`. Tamaños: S (≤ 1 día), M (2–3 días), L (4+).

| Fase | Qué | Tamaño | Backend |
|---|---|---|---|
| **F0** | Cimientos: tokens, fuente, tema oscuro, `lang="es"`, limpieza de `theme.css` y de los imports dobles, kit de UI, `ConfirmDialog` y `Toast` (y se van los 13 `alert`/`confirm`), test "sin colores sueltos" | M | no |
| **F1** | `AppShell` + navegación por rol + barra superior + logo nuevo; el asistente se muda a Mensajes | M | no |
| **F2** | `VolunteeringCard`/`Tile`/`Row`, `DualGoal`, `cardActions`; Inicio y portada usan la tarjeta nueva | L | opcional: fechas (B1), `accepts_donations` en el listado |
| **F3** | Publicaciones: `PostCard` nuevo con el vínculo; el feed mezcla voluntariados y publicaciones por fecha; "Momentos" → "Publicaciones" | M | no (B5 opcional) |
| **F4** | Página del voluntariado (celular y dos columnas en escritorio), hojas de inscripción y de donación, comentarios en hoja | L | no |
| **F5** | Explorar (grilla 2 columnas, chips, filtros en hoja, botón Mapa, pines de Leaflet con tokens) | M | no |
| **F6** | Perfiles (voluntario, ONG, empresa, propio y ajeno) con la estructura común; Configuración (cuenta, CV, tema, cerrar sesión, borrar cuenta) | L | no (avisos: B9) |
| **F7** | Mis voluntariados (4 pestañas), Notificaciones agrupadas, Mensajes y conversación | M | no |
| **F8** | Paneles de ONG y empresa (backoffice), KPIs → Impacto, crear voluntariado en pasos | L | no |
| **F9** | Registro e ingreso en páginas propias con vuelta a la acción; onboarding de intereses | M | intereses: B10 |
| **F10** | Pasada final: movimiento y `prefers-reduced-motion`, texto al 200 %, capturas a 375 y 1440 en claro y oscuro, limpieza de lo que quedó sin usar | M | no |

### Cambios de backend, para decidir aparte

| Id | Cambio | Lo usa | Tamaño |
|---|---|---|---|
| B1 | `start_date`/`end_date` en `fmt()` (las columnas ya existen) | F2, F4 | S |
| B2 | Patrocinadores aceptados en el listado de proyectos | F2 | S |
| B3 | "Seguido por" (personas que sigo que siguen o se inscribieron) | F2 | M |
| B4 | ONG validada: columna, solicitud con PDF, rol administrador, pantalla de revisión | F6, F8 | L |
| B5 | Comentarios y guardados en publicaciones; publicaciones de empresas | F3 | M |
| B6 | Rol elegido al inscribirse y cupos por rol (toca la invariante de cupos, regla 20) | F4 | M |
| B7 | Lugares reservados por empresas | F2, F8 | M |
| B8 | A qué se destina el dinero (`project_destinos`) + dato de impacto en publicaciones | F4, F8 | S |
| B9 | Preferencias de avisos | F6 | S |
| B10 | Intereses del voluntario | F9 | S |
| — | Donación mensual, presencia en el chat, Bricks | — | fuera de alcance por ahora |

Cada uno sigue el procedimiento de siempre: `migrate.js` aditivo con `addColumnIfNotExists`, `fmt()`
+ `api.ts` + base a la vez (regla 7), SQLite, Postgres y Córdoba, y su test de columnas públicas si
el endpoint es público (regla 8).

### F0 en detalle (la que conviene hacer primero)

1. **Rojo:** `src/test/designTokens.test.ts` recorre `app/**/*.tsx` (sin tests) y falla si
   encuentra `#[0-9a-f]{6}`, `bg-gradient`, `text-[10px]`/`text-[11px]` o una familia de color de
   Tailwind (`emerald-`, `violet-`…). Al principio falla con las cuentas de 1.1; se usa como lista
   de pendientes y se activa como bloqueante archivo por archivo (una lista de excepciones que se
   achica en cada fase hasta quedar vacía en F10).
2. Tokens en `theme.css`, fuente en `fonts.css`, `lang="es"`, título "VoluntariAR", favicon nuevo.
3. Kit con tests por componente: variantes, `disabled`/`busy`, nombres accesibles, `Sheet` sobre
   `Modal` (foco, Escape), `ConfirmDialog` (Enter no confirma una acción destructiva por defecto),
   `Toast` con `role="status"`.
4. Reemplazo de `alert`/`confirm`: cada uno con su test (hoy 3 archivos de test mockean
   `window.confirm`; pasan a buscar el diálogo).
5. **Mutación** sobre `cardActions.ts`, `Button` y `ConfirmDialog` (código nuevo), con el reporte de
   sobrevivientes y equivalentes.

## 5. Pruebas

- **Tests primero** en todo componente del kit y en las funciones puras (`cardActions`,
  `formatDateRange`, mezcla del feed por fecha).
- **Los 904 tests actuales se mantienen**, pero varios buscan textos que el diseño cambia. Medido con
  `grep` sobre los `*.test.tsx`: "Seguir" (42 apariciones en 3 archivos), "Dashboard" (35 en 6),
  "Siguiendo" (31 en 5), "Momentos" (28 en 10), "Iniciar sesión" (15 en 5), "Cerrar sesión" (11 en
  3), "Inscripto" (8 en 2), "Donar a este proyecto" (7 en 1), "Inscribirse" (5 en 1). Cada fase
  actualiza los suyos **en el mismo commit**, y la sección de `PROJECT_ANALYSIS.md` lista qué
  textos cambiaron. Un test que se borra se justifica uno por uno.
- **Accesibilidad:** `A11yNames.test.tsx` suma cada pantalla nueva; los componentes del kit traen
  sus propios casos.
- **Cobertura:** el umbral del 80 % del CI sigue bloqueante.
- **Visual:** con Chrome headless (el mismo script que sacó las capturas "antes" del lienzo, en el
  scratchpad) se pueden sacar capturas a 375 y 1440 px, en claro y oscuro, de cada pantalla al
  terminar una fase. Sirve para comparar, **no reemplaza probarla en un teléfono** (tacto, teclado
  real, lector de pantalla): eso queda como ⚠️ NO verificado en cada fase.

## 6. Riesgos

| Riesgo | Cómo se baja |
|---|---|
| Romper flujos que funcionan (inscribirse, donar, aprobar) mientras se cambia el aspecto | Las reglas salen del JSX a funciones con tests (`cardActions`) antes de redibujar; los tests de comportamiento no se tocan salvo el texto |
| El rediseño queda a medias para la defensa | Cada fase deja la app desplegable y coherente; F0–F4 ya cambian lo que más se ve (Inicio y voluntariado) |
| La base gratuita de Render vence el 14/11/2026 | No depende del rediseño, pero fija el calendario de despliegues: avisar antes de planificar F5 en adelante |
| Mezclar el feed en el cliente con dos paginaciones | Prueba propia de la mezcla (orden, duplicados, "ver más" con un lado vacío); el endpoint único queda para después |
| El modo oscuro sobre fotos | Regla `on-photo` del DESIGN; capturas en oscuro en cada fase |
| Dibujar datos que no existen (patrocinadores, fechas) | Regla: sin datos no se dibuja; nada inventado en la interfaz |

## 7. Qué necesito que decidas

1. **Orden de fases** (propuesta: F0 → F1 → F2 → F4 → F3 → resto) y si hay una fecha de entrega que
   lo condicione.
2. **Qué cambios de backend** de la tabla de la parte 4 se aprueban (propuesta mínima: B1 y B2, que
   son chicos y hacen que la tarjeta se vea completa).
3. **Registro e ingreso en páginas propias** (`/registro`, `/ingresar`) en lugar del modal.
4. **El asistente a Mensajes** y fuera el botón flotante.
5. **"Momentos" → "Publicaciones"** en la interfaz.
6. **Fuente servida por la app** (agrega unos 150 KB de `woff2` a `public/`).

## 8. Cómo se armó este documento

- **Verificado:** las cuentas de 1.1, 1.4 y 5 salen de `grep`/`wc` sobre el código del 2026-10-20.
  Lo de 1.5 se revisó en `migrate.js`, `routes/projects.js` (`fmt`), `routes/enrollments.js` y
  `routes/follows.js`. Las capturas "antes" se sacaron con Chrome headless contra la app en local
  (`npm run dev` en los dos paquetes) logueado como `maria@example.com` y como la ONG Banco de
  Alimentos, con los datos de `seed.js`.
- **Para sacarlas hubo que correr `npm run db:migrate` en la base SQLite local**: le faltaban las
  tablas `posts` y `ngo_cuentas_mp` y el detalle de un proyecto daba "Error al obtener proyecto".
  Es aditivo (regla 12) y no tocó Postgres ni producción.
- **No verificado:** los mockups "después" no son la app: son HTML con los tokens del DESIGN, y
  algunos datos son de muestra (fechas, montos destinados, "Seguido por", lugares reservados,
  comentarios, roles de cada voluntariado). No se midió el contraste de cada combinación del modo
  oscuro con una herramienta; los valores son los del DESIGN.
