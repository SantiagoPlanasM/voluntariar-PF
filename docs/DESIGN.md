---
version: 1.1
name: VoluntariAR-design-system
language: es-AR
description: |
  Sistema de diseño de VoluntariAR, la red social solidaria que une ONGs, voluntarios y empresas.
  La sensación es la de Instagram (feed limpio, fotos protagonistas, interfaz liviana), las tarjetas
  de voluntariado se leen como un aviso de Airbnb (foto, título, lugar, fecha, puntaje, costo) y la
  exploración toma la grilla visual de Pinterest. La interfaz es blanca y negra; el color tiene
  significado: azul = dinero y marca (Donar, financiamiento), verde = personas (Inscribirse,
  voluntarios). Cada publicación de un voluntario está atada a un voluntariado, y ese vínculo se ve
  siempre: es el elemento propio de la app.

colors:
  # ---- Tema claro (por defecto) ----
  canvas: "#FFFFFF"            # fondo del feed y de las pantallas
  canvas-soft: "#F4F6F9"       # fondo detrás de tarjetas en desktop, secciones agrupadas
  surface: "#FFFFFF"           # tarjetas, hojas inferiores (sheets), modales
  surface-soft: "#F1F3F6"      # inputs, botones secundarios, chips, vínculo, placeholders de foto
  surface-pressed: "#E6E9EE"
  hairline: "#E4E8ED"          # bordes de tarjeta, divisores, fondo de las barras de progreso
  border-strong: "#8A939E"     # borde de inputs (3:1)
  ink: "#0F1419"               # texto principal, íconos, botón primario neutro
  ink-soft: "#3D4652"          # texto secundario, descripciones
  ink-muted: "#646E7A"         # fechas, contadores, placeholders (mín. 4.5:1)
  on-ink: "#FFFFFF"

  brand: "#2457D6"             # azul VoluntariAR: Donar, financiamiento, verificación, marca
  brand-pressed: "#1B44AE"
  brand-soft: "#E8EFFD"        # fondo de avisos de marca, monto seleccionado
  on-brand: "#FFFFFF"

  people: "#2E6B3F"            # verde personas: Inscribirse, cupos de voluntarios, aceptado
  people-pressed: "#235431"
  people-soft: "#E7F3EA"       # fondo de estado "Aceptado", cupos reservados
  on-people: "#FFFFFF"

  like: "#E5484D"              # corazón de "me gusta" (solo forma, nunca texto) y contadores de no leídos
  star: "#E0A100"              # estrella de puntaje (siempre acompañada del número)
  critical: "#D12D21"
  scrim: "rgba(15, 20, 25, 0.56)"
  photo-chip: "rgba(255, 255, 255, 0.92)"   # chips sobre fotos
  photo-chip-dark: "rgba(15, 20, 25, 0.72)"
  on-photo: "#0F1419"          # texto de los chips blancos sobre fotos (no cambia con el tema)

  # ---- Tema oscuro ----
  dark-canvas: "#0B0D10"
  dark-canvas-soft: "#0B0D10"
  dark-surface: "#15181C"
  dark-surface-soft: "#1E2227"
  dark-surface-pressed: "#282D33"
  dark-hairline: "#2A2F36"
  dark-border-strong: "#5C646E"
  dark-ink: "#F2F4F7"
  dark-ink-soft: "#C2C8D0"
  dark-ink-muted: "#8E96A1"
  dark-on-ink: "#0B0D10"
  dark-brand: "#3366E6"        # fondo de botón Donar (texto blanco 5:1)
  dark-brand-text: "#7FA6FF"   # montos y textos en azul
  dark-brand-soft: "#16244A"
  dark-people: "#2F7A45"       # fondo de botón Inscribirse (texto blanco 5.3:1)
  dark-people-text: "#6CC287"
  dark-people-soft: "#14301D"
  dark-like: "#FF5C61"
  dark-star: "#F0B429"
  dark-critical: "#FF6B5E"

typography:
  # Una sola familia: Plus Jakarta Sans (Google Fonts, gratis). Pesos 400, 500, 600, 700, 800.
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: -0.6px
  title-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.3px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.2px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.45
  body-strong:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.45
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.3
  number:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: tnum
  number-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: -0.3px
    fontFeature: tnum
  button:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1

rounded:
  none: 0px
  xs: 6px
  sm: 10px
  md: 12px
  lg: 16px
  xl: 24px
  full: 9999px

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  section: 48px

sizes:
  avatar-xs: 20px
  avatar-sm: 32px
  avatar-md: 44px
  avatar-lg: 56px
  avatar-profile: 88px
  icon: 24px
  tap-target: 44px
  button-lg: 48px
  button-md: 40px
  button-sm: 32px
  tab-bar: 56px
  top-bar: 52px
  meter-height: 6px
  feed-column-max: 520px
  sidebar-icons: 72px
  sidebar-full: 244px
  right-column: 320px
  inbox-column: 360px
  dialog-max: 480px

breakpoints:
  tablet: 768px              # la barra inferior pasa a barra lateral de íconos
  right-column: 1160px       # aparece la columna derecha del feed
  wide: 1264px               # la barra lateral muestra los nombres

elevation:
  flat: "none"
  popover: "0 8px 24px rgba(15, 20, 25, 0.12), 0 1px 2px rgba(15, 20, 25, 0.08)"
  sheet: "0 -8px 32px rgba(15, 20, 25, 0.16)"

layers:
  content: 0
  sticky: 10                 # barras fijas de la página (botones del voluntariado)
  nav: 30                    # barra inferior y barra lateral
  map-controls: 40           # por encima de Leaflet
  overlay: 50                # fondo de hojas y diálogos
  toast: 60

motion:
  fast: 120ms
  base: 220ms
  slow: 320ms
  meter: 600ms
  ease-out: "cubic-bezier(0.2, 0.8, 0.2, 1)"
  spring-like: "cubic-bezier(0.34, 1.4, 0.64, 1)"

components:
  button-donate:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "{sizes.button-lg}"
  button-donate-pressed:
    backgroundColor: "{colors.brand-pressed}"
  button-join:
    backgroundColor: "{colors.people}"
    textColor: "{colors.on-people}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "{sizes.button-lg}"
  button-join-pressed:
    backgroundColor: "{colors.people-pressed}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    height: "{sizes.button-md}"
  button-secondary:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    height: "{sizes.button-md}"
  button-secondary-pressed:
    backgroundColor: "{colors.surface-pressed}"
  button-follow-photo:
    backgroundColor: "{colors.photo-chip}"
    textColor: "{colors.on-photo}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: "{sizes.button-sm}"
  input:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    placeholderColor: "{colors.ink-muted}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    height: 48px
  input-focused:
    backgroundColor: "{colors.surface}"
    border: "1.5px solid {colors.ink}"
  chip:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: "{sizes.button-sm}"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
  chip-on-photo:
    backgroundColor: "{colors.photo-chip}"
    textColor: "{colors.on-photo}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: 28px
  avatar-person:
    rounded: "{rounded.full}"
  avatar-org:
    rounded: "28%"
  verified-badge:
    color: "{colors.brand}"
    size: 16px
  meter:
    height: "{sizes.meter-height}"
    trackColor: "{colors.hairline}"
    rounded: "{rounded.full}"
    fillMoney: "{colors.brand}"
    fillPeople: "{colors.people}"
  volunteering-card:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.lg}"
    photoRounded: "{rounded.lg} {rounded.lg} 0 0"
    padding: "{spacing.lg}"
    shadow: "{elevation.flat}"
  link-strip:
    backgroundColor: "{colors.surface-soft}"
    rounded: "{rounded.md}"
    height: 60px
    thumbnailRounded: "{rounded.xs}"
  post-media:
    rounded: "{rounded.none}"
    rounded-desktop: "{rounded.md}"
  tab-bar:
    backgroundColor: "{colors.canvas}"
    borderTop: "1px solid {colors.hairline}"
    height: "{sizes.tab-bar}"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl} {rounded.xl} 0 0"
    shadow: "{elevation.sheet}"
  dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    shadow: "{elevation.popover}"
    maxWidth: "{sizes.dialog-max}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
  switch:
    width: 44px
    height: 26px
    onColor: "{colors.ink}"
    offColor: "#C2C8D0"
  grid-tile:
    aspectRatio: "4 / 5"
    gap: 2px
    rounded: "{rounded.none}"
---

# VoluntariAR: sistema de diseño

> **Versión 1.1 (2026-10-20).** La 1.0 es el borrador que se recibió como `DESIGN2.md`. Esta versión
> corrige cinco contradicciones que aparecieron al dibujarlo (marcadas con **Corregido en 1.1**) y
> completa lo que figuraba como pendiente (sección **Lo que faltaba**, al final). Los mockups de
> todo el documento, con la versión vieja al lado, están en el lienzo "VoluntariAR · Rediseño antes
> y después" (link en `docs/archivo/PLAN_REDISENO_FRONTEND.md`). El plan para llevarlo al código está en ese
> mismo archivo.

## Resumen

VoluntariAR es una red social solidaria que une a tres actores:

- **ONGs**: crean voluntariados (acciones sociales) con metas de financiamiento y de voluntarios, y
  publican novedades.
- **Voluntarios**: se postulan, donan, siguen voluntariados y publican, **siempre vinculando la
  publicación a un voluntariado**.
- **Empresas**: patrocinan voluntariados, reservan lugares para sus empleados y publican.

La encuesta del proyecto deja claro qué tiene que transmitir el diseño: **confianza en las ONGs**
(73%), **transparencia en las donaciones** (66%), **información clara y completa** (60%) y
**facilidad de uso** (49%). Cada decisión de este archivo apunta a eso.

El diseño se apoya en cuatro decisiones:

1. **Las fotos ponen el color.** La interfaz es blanca (o negra en modo oscuro) con texto casi
   negro, íconos de línea finos y casi sin cajas. Igual que en Instagram, lo que más se ve son las
   fotos de las acciones.
2. **El color significa algo.** Hay solo dos colores de acción, y cada uno es una forma de ayudar:
   **azul = dinero** (Donar, meta de financiamiento) y **verde = personas** (Inscribirse, cupos de
   voluntarios). Todo lo demás (Seguir, Mensaje, Editar) es negro o gris.
3. **Dos tipos de contenido, dos formas.** Un **voluntariado** es un objeto con datos (una tarjeta
   con bordes, como un aviso de Airbnb). Una **publicación** es contenido social (de borde a borde,
   como un post de Instagram). Con solo mirar la forma se sabe qué es cada cosa.
4. **Siempre se ve a qué causa pertenece algo.** Cada publicación muestra su voluntariado en una
   franja tocable: el **vínculo**. Es el elemento propio de VoluntariAR.

## Qué tomamos de cada referencia

| Referencia | Qué tomamos | Dónde se usa |
|---|---|---|
| **Instagram** | Feed de una columna, fotos de borde a borde, íconos de línea, likes y comentarios, perfil con grilla de 3 columnas, mensajes con burbujas, barra inferior | Feed, publicaciones, perfiles, mensajes |
| **Airbnb** | Tarjeta con foto redondeada, título + puntaje en la misma línea, lugar y fecha en una línea, "costo por persona", página de detalle con un botón fijo abajo, reseñas que generan confianza | Tarjeta y detalle de voluntariado, reseñas |
| **Pinterest** | Exploración visual en grilla, chips de categorías, búsqueda grande arriba | Explorar |

Lo que **no** tomamos: el degradé de Instagram, sus íconos o su logo; el rosa de Airbnb; el rojo de
Pinterest. VoluntariAR tiene su propia identidad: el azul del logo, el verde de personas, avatares
según el rol y el vínculo.

## Colores

### Los dos colores de acción

| Token | Claro | Oscuro | Significa | Se usa en |
|---|---|---|---|---|
| `brand` | `#2457D6` | `#3366E6` / texto `#7FA6FF` | Dinero y marca | Botón Donar, barra de financiamiento, monto recaudado, insignia de verificada, logo |
| `people` | `#2E6B3F` | `#2F7A45` / texto `#6CC287` | Personas | Botón Inscribirse, barra de voluntarios, estado "Aceptado" |

Reglas:

- **Un botón azul o verde siempre es Donar o Inscribirse.** Nunca se usan para Seguir, Guardar,
  Enviar ni enlaces. Así el usuario aprende en un día qué hace cada color.
- Los enlaces ("Ver página completa") van en `ink` con peso 600, no en azul.
- `brand-soft` y `people-soft` son solo fondos suaves para estados (monto elegido, "Aceptado",
  cupos reservados).
- El único degradé permitido es el del **ícono de la app**. Dentro de la interfaz no hay degradés.
- **Los roles no tienen color propio** (agregado en 1.1). Hoy el voluntario es verde esmeralda, la
  ONG azul y la empresa violeta. Eso desaparece: los tres comparten la misma interfaz y el rol se
  reconoce por la forma del avatar y por la navegación.

### Neutros

- `canvas` `#FFFFFF`: fondo de todas las pantallas en el celular.
- `canvas-soft` `#F4F6F9`: fondo detrás de las tarjetas en desktop y secciones agrupadas
  (configuración, formularios largos).
- `surface-soft` `#F1F3F6`: inputs, botones secundarios, chips, el vínculo y la foto mientras carga.
- `hairline` `#E4E8ED`: bordes de tarjeta, divisores y el fondo de las barras de progreso.
- Texto: `ink` (principal), `ink-soft` (descripciones), `ink-muted` (fechas, contadores). Todos
  pasan WCAG AA (4.5:1) sobre `canvas` y `canvas-soft`, en los dos temas.

### Otros

- `like` `#E5484D`: el corazón lleno de "me gusta" y el globito con el número de no leídos (en la
  barra y en el menú lateral).
- `star` `#E0A100`: la estrella del puntaje. Tiene poco contraste, así que **siempre** va con el
  número al lado ("★ 4,5").
- `critical`: errores y acciones destructivas.

### Modo oscuro

Es un tema propio, no una inversión. El fondo es `#0B0D10` (casi negro, como Instagram) y las
superficies suben de a un tono (`#15181C`, `#1E2227`) en lugar de usar sombras. Azul y verde tienen
una versión para fondo de botón (con texto blanco) y otra más clara para texto. Por defecto sigue la
configuración del teléfono, con opción manual en Configuración.

**Sobre las fotos los colores no cambian con el tema** (agregado en 1.1): los chips blancos y el
botón "Seguir" de la foto llevan siempre texto `on-photo` (`#0F1419`). Si se usara `ink`, en modo
oscuro quedaría texto claro sobre una pastilla blanca.

## Tipografía

**Plus Jakarta Sans** (Google Fonts, gratis) para todo. Es amable y redondeada, combina con la "V"
del logo, y se lee bien en tamaños chicos y en español (tildes, ñ, ¿¡). Se sirve desde la propia app
(archivos `woff2` en `public/fonts/`), no desde Google: así no depende de un tercero ni le pasa la IP
del usuario.

| Token | Tamaño / peso | Uso |
|---|---|---|
| `display` | 32 / 800 | Onboarding, estados vacíos, número grande de impacto |
| `title-lg` | 22 / 700 | Títulos de pantalla, nombre en el perfil |
| `title-md` | 18 / 700 | Título del voluntariado en la tarjeta, títulos de hojas |
| `number-lg` | 22 / 800 | Monto recaudado en el detalle, estadísticas del perfil |
| `number` | 15 / 700 | Montos y cupos en las barras, costo por persona |
| `body-strong` | 15 / 600 | Nombres en publicaciones y comentarios |
| `body-md` | 15 / 400 | Descripciones, textos de publicaciones, mensajes |
| `body-sm` | 13 / 400 | Fechas, "Seguido por…", datos secundarios |
| `label` | 12 / 600 | Chips, etiquetas de barras, pestañas |
| `button` | 15 / 700 | Botones |

Principios:

- **Peso antes que tamaño.** El nombre se diferencia del texto por el peso, no por ser más grande.
- **Números tabulares** (`tabular-nums`) en montos, cupos y contadores, para que no "salten".
- **Formato argentino** en todos los números: `$ 32.000`, `4,5`, `1,2 mil`. Nunca `$32,000`.
- **Mayúscula solo al principio** ("Meta de financiamiento", no "Meta De Financiamiento"). Sin
  textos en mayúsculas completas.
- **Nada por debajo de 12px** (agregado en 1.1). Hoy hay 76 textos de 10 y 11px.

## Layout

### Espaciado

Base de 4px: `2, 4, 8, 12, 16, 24, 32, 48`. Margen lateral en el celular: **12px** para
publicaciones y tarjetas del feed, **16px** para pantallas de texto (detalle, formularios,
mensajes).

### Celular (360–430px, por defecto)

- **Barra superior** (52px): logo a la izquierda (solo en Inicio); a la derecha, notificaciones y
  mensajes, cada uno con un contador si hay algo nuevo.
- **Feed**: una columna. Las publicaciones van de borde a borde; las tarjetas de voluntariado, con
  12px de margen.
- **Barra inferior** (56px + zona segura), cinco destinos: **Inicio, Explorar, Crear, Mis
  voluntariados, Perfil**. En Perfil se usa el avatar del usuario a 26px. Esta es la barra del
  voluntario; la de la ONG y la de la empresa están en **Navegación por rol**.

### Tablet y desktop (≥ 768px)

- La barra inferior pasa a una **barra lateral**: 72px solo íconos (768–1263px) o 244px con
  nombres (≥ 1264px).
- **Columna del feed** de 520px máximo, centrada, sobre `canvas-soft`. Las publicaciones pasan a
  tener bordes redondeados (`rounded.md`) y fondo `surface`.
- A partir de 1160px, una **columna derecha** de 320px con "Cerca tuyo" (3 voluntariados chicos) y
  "ONGs para seguir".

### Separación

Entre elementos del feed hay **espacio, no líneas**: 12px en el celular, 24px en desktop. Las
líneas (`hairline`) solo aparecen donde se juntan dos listas o como borde de la tarjeta de
voluntariado.

## Formas y avatares según el rol

Con tres tipos de cuenta, el usuario tiene que saber de un vistazo si habla una persona o una
organización:

- **Personas (voluntarios): avatar redondo** (`avatar-person`).
- **Organizaciones (ONGs y empresas): avatar cuadrado con esquinas redondeadas** (`avatar-org`,
  radio 28%), para que entren bien los logos.
- **ONG validada:** insignia de verificada (círculo `brand` con tilde blanco, 16px) al lado del
  nombre, en todas partes. Reemplaza la etiqueta "ONG" de los diseños actuales: el cuadrado ya
  dice "organización", y la insignia dice "confiable", que es lo que más importa según la encuesta.
- **Empresa:** el cuadrado. No lleva insignia azul (no está validada como ONG). Excepción: en la
  tarjeta de voluntariado, los patrocinadores se muestran como círculos superpuestos en la fila
  de la ONG (ver Tarjeta de voluntariado).
- **Sin foto** (agregado en 1.1): las iniciales (dos letras, peso 800) sobre `surface-soft` con
  texto `ink`. Hoy se usan imágenes de DiceBear con colores al azar (rojo, amarillo, violeta), que
  compiten con el azul y el verde.

| Radio | Valor | Uso |
|---|---|---|
| `none` | 0 | Fotos de publicaciones en el celular, grilla del perfil |
| `xs` | 6px | Miniaturas (vínculo, listas) |
| `sm` | 10px | Botones neutros, inputs |
| `md` | 12px | Botones Donar e Inscribirse, vínculo, fotos de publicaciones en desktop |
| `lg` | 16px | Tarjeta de voluntariado |
| `xl` | 24px | Esquinas superiores de las hojas inferiores |
| `full` | — | Avatares de personas, chips, contadores |

## Componentes

### Tarjeta de voluntariado

Es el corazón del feed: tiene que contar en 3 segundos **qué es, quién lo hace, dónde y cuándo, y
cómo ayudar**. Fondo `surface`, borde 1px `hairline`, radio 16px, sin sombra, 12px de margen
lateral.

**Cerrada (lo que se ve en el feed), de arriba hacia abajo:**

1. **Foto** en proporción 16:10, con las esquinas de arriba redondeadas.
   - Arriba a la izquierda: chip de categoría ("Medio ambiente") en `chip-on-photo`, y el tipo
     ("⚡ Fugaz") en un chip oscuro (`photo-chip-dark`, texto blanco).
   - Arriba a la derecha: **botón "Seguir"** (`button-follow-photo`): pastilla blanca con un ícono
     de campana y la palabra "Seguir". Al tocarlo pasa a "Siguiendo" con la campana llena.
     *Cambio respecto al diseño actual:* el corazón se confundía con "me gusta". La campana y la
     palabra dicen exactamente qué pasa: vas a recibir las novedades.
2. **ONG y patrocinadores** (una sola fila de 32px):
   - Izquierda: logo de la ONG (cuadrado de 32px), nombre en `body-strong` e insignia de
     verificada. Si el nombre es largo, se corta con "…" antes de tocar a los patrocinadores.
   - Derecha, si hay patrocinadores: sus logos en **círculos de 28px superpuestos**, cada uno con
     un borde blanco de 2px (`surface`; en modo oscuro `dark-surface`) para que se separen entre
     sí, montados 8px uno sobre otro. Máximo 3; si hay más, un cuarto círculo `surface-soft` con
     "+2" en `label`.
   - Los logos de los patrocinadores son la **única excepción** a la regla de avatares cuadrados
     para organizaciones: el grupo de círculos superpuestos es el formato que identifica
     "patrocinan este voluntariado".
   - El grupo es tocable (área mínima de 44px) y abre una hoja "Patrocinadores" con cada empresa:
     logo de 44px, nombre y "Patrocina desde marzo 2026". Para lectores de pantalla, el grupo se
     lee "Patrocinado por Banco Sol, Grupo Andes y Ferretería Norte".
3. **Título + puntaje**: título en `title-md` (máximo 2 líneas). A la derecha, "★ 4,5 (12)" en
   `body-sm`. Sin reseñas: "Nuevo".
4. **Descripción** en `body-md` `ink-soft`, máximo 2 líneas.
5. **Lugar, fecha y duración** en una línea de `body-sm` `ink-muted`, con íconos de 16px:
   "📍 Córdoba · 📅 26 y 27 de abril · ⏱ 2 días". La duración siempre lleva la fecha de inicio al
   lado y el ícono de reloj, porque "2 días" solo podía leerse también como "falta poco".
   Formatos de duración: "3 horas", "1 día", "2 días", "4 semanas"; si es recurrente, "Todos los
   sábados" en lugar de una duración. Si la línea no entra, se parte en dos: lugar arriba, fecha y
   duración abajo.
6. **Doble meta** (ver componente abajo).
7. **Botones**: "Inscribirme" (`button-join`, verde) y "Donar" (`button-donate`, azul), lado a lado,
   48px de alto, 8px entre ellos. *Cambio:* en el diseño actual estaban escondidos dentro del
   acordeón. Son las dos acciones más importantes de la app; tienen que verse siempre.
8. **"Más información"**: un botón de texto con flecha (⌄) centrado debajo de los botones.

**Abierta (acordeón):** se agrega, entre la doble meta y los botones:

- "Seguido por **Laura** y **Diego**", con sus avatares de 20px (solo gente que el usuario sigue).
- **Roles que se necesitan**: chips (`chip`) con cada rol.
- **Costo por persona**: etiqueta a la izquierda y monto en `number` a la derecha. Si es gratis:
  "Sin costo".
- **Comunidad**: "120 seguidores · 8 comentarios" en `body-sm`.
- **"Ver página completa →"** en `ink` peso 600.

La tarjeta abre y cierra en 220ms (`motion.base`), animando altura y opacidad. Solo una tarjeta
puede estar abierta a la vez. Tocar la foto o el título lleva a la página del voluntariado.

**Estados de los botones** (después de que el usuario actúa):

| Situación | Botón verde | Botón azul |
|---|---|---|
| No hizo nada | Inscribirme | Donar |
| Se postuló | "Postulado" (secundario, con reloj) | Donar |
| Fue aceptado | "Vas a ir ✓" (fondo `people-soft`, texto `people`) | Donar |
| No fue seleccionado *(1.1)* | "No seleccionado" (secundario, desactivado) | Donar |
| Cupos llenos | "Cupos completos" (desactivado) + "Avisarme si se libera" | Donar |
| Meta cumplida | — | "Meta cumplida ✓" (fondo `brand-soft`) + sigue permitiendo donar |
| La ONG no recibe donaciones *(1.1)* | — | se oculta; el botón verde ocupa todo el ancho |
| Ya pasó | "Ver cómo salió" (secundario) | se oculta |
| Quien mira es una ONG o una empresa *(1.1)* | se oculta | Donar (empresa) / se oculta (ONG); la empresa ve además "Patrocinar" (secundario) |

> **Corregido en 1.1:** "No seleccionado", "La ONG no recibe donaciones" y "quien mira es una
> organización" no estaban y existen en la app: una inscripción puede quedar `rejected`, desde §218
> el botón Donar depende de `accepts_donations`, y una empresa puede patrocinar desde el detalle.

### Doble meta (financiamiento y voluntarios)

Las dos barras de progreso son la forma de mostrar **transparencia**: cuánto falta y para qué.

- Cada meta tiene una fila de texto y una barra debajo:
  - Izquierda: ícono de 16px + etiqueta en `label` `ink-soft` ("Financiamiento", "Voluntarios").
  - Derecha: valor en `number`. Dinero: "**$ 32.000** de $ 50.000" (el recaudado en `brand`, el
    total en `ink-muted`). Personas: "**32** de 50 lugares" (en `people`).
- Barra: 6px de alto, extremos redondeados, fondo `hairline`, relleno `brand` (dinero) o `people`
  (personas).
- **Cupos reservados por empresas:** la parte reservada se dibuja en `people` al 35% de opacidad a
  continuación de la parte ocupada, y abajo un `body-sm`: "10 lugares reservados para empleados de
  Banco Sol". (Hoy un patrocinio guarda el aporte y el estado, no lugares reservados: necesita
  backend.)
- Si el voluntariado no tiene meta de dinero (o de personas), se muestra solo la que tiene. Si no
  tiene meta de dinero pero recibió donaciones, se muestra "Recaudado: $ 3.200" sin barra.
- Cuando cambia un valor (alguien dona), la barra se llena en 600ms (`motion.meter`).

### Publicación

Es el contenido social del feed, como un post de Instagram, de borde a borde en el celular.

1. **Encabezado** (56px, 12px de margen): avatar de 32px (redondo o cuadrado según el rol), nombre en
   `body-strong` + insignia si corresponde, y debajo, en `body-sm` `ink-muted`: "en **Comedor
   Comunitario** · 20 abr". A la derecha, el botón "···". *Cambio:* el ícono de ubicación (📍)
   delante del nombre del voluntariado parecía una dirección. Ahora dice "en", como cuando uno
   cuenta dónde estuvo.
2. **Foto o video** a todo el ancho, entre 4:5 (más alta) y 1.91:1 (más ancha). Mientras carga,
   `surface-soft` con la proporción final, nunca un spinner. Carrusel: contador "1/4" arriba a la
   derecha y puntos debajo.
3. **Acciones** (48px): corazón con su número, comentario con su número, compartir; a la derecha,
   guardar. Íconos de 24px con línea de 1,75px. El corazón lleno es `like`.
4. **Texto**: nombre en `body-strong` y el texto en `body-md`, cortado a 3 líneas con "más" en
   `ink-muted`.
5. **Fecha** en `body-sm` `ink-muted` si no está en el encabezado.
6. **Vínculo** (ver abajo).

**Por qué este orden:** tomamos de Instagram que **el texto va debajo de la foto**, junto al nombre
de quien publicó. Así la foto engancha primero y el texto acompaña. En el diseño actual el texto va
arriba y la foto queda más abajo, lo que hace que la publicación se lea como un aviso y no como
algo social.

**Variantes según quién publica:**

- **Voluntario:** avatar redondo. Siempre tiene vínculo (es obligatorio).
- **ONG:** logo cuadrado + insignia. Puede tener vínculo (si es una novedad de un voluntariado) o no
  (si es institucional). Si cuenta un resultado, puede sumar un **dato de impacto**.
- **Empresa:** logo cuadrado. Si es sobre un voluntariado que patrocina, el encabezado dice
  "patrocina **Limpieza de Playas**".

> Hoy el backend solo acepta publicaciones de voluntarios y ONGs, siempre con proyecto
> (`posts.project_id` obligatorio); no hay comentarios ni "guardar" en publicaciones. Ver
> dependencias de backend en el plan.

### El vínculo (elemento propio de VoluntariAR)

Una franja tocable al pie de la publicación que muestra el voluntariado al que pertenece. Reemplaza
el enlace "Ver proyecto…" de los diseños actuales y le da a cada publicación una salida directa
para ayudar.

- Caja `surface-soft`, radio 12px, 60px de alto, 12px de margen lateral y 12px de separación con lo
  de arriba.
- Izquierda: miniatura de la foto del voluntariado (44px, radio 6px).
- Centro, dos líneas: nombre del voluntariado en `body-strong` (1 línea) y debajo, en `body-sm`
  `ink-muted`, "Verde Futuro · 32 de 50 voluntarios".
- Debajo del texto, una mini barra de 3px con el progreso de voluntarios (`people`).
- Derecha: flecha (›) en `ink-muted`.
- Toda la franja lleva a la página del voluntariado.
- Si el voluntariado sigue abierto, la flecha se cambia por un botón chico "Sumarme" (verde, 32px).

### Dato de impacto (publicaciones de ONGs)

Cuando una ONG cuenta un resultado, puede destacar un número, como pide la encuesta ("mostrar el
impacto"). Va entre las acciones y el texto:

- Fila `surface-soft`, radio 12px, padding 12px 16px.
- Número en `number-lg` `ink` ("200 kg") + descripción en `body-sm` `ink-soft` ("de residuos
  recolectados").
- Máximo un dato por publicación. Sin íconos ni colores extra.

### Página del voluntariado

Como una página de Airbnb: la foto grande, toda la información ordenada, y los botones siempre a
mano.

1. Foto o carrusel a todo el ancho (proporción 4:3), con "atrás", "compartir" y "Seguir" flotando
   arriba en botones blancos.
2. Título en `title-lg`, ONG con insignia, "★ 4,5 · 12 reseñas" (tocable).
3. Fila de datos clave en tres columnas: **Fecha** (inicio y fin), **Duración** ("2 días") y
   **Costo por persona**. El **lugar** va en su propia fila debajo, porque las direcciones son
   largas.
4. **Doble meta**, más grande: monto recaudado en `number-lg`.
5. "Sobre el voluntariado" (descripción completa, 6 líneas + "Leer más").
6. **Roles que se necesitan**, cada uno con su descripción y cupos.
7. **Dónde**: mapa de 180px de alto, radio 12px, con la dirección. **Corregido en 1.1:** el borrador
   decía Google Maps; se mantiene **Leaflet con OpenStreetMap**, que ya está en la app, es gratis y
   no necesita clave. Los pines se redibujan con los tokens (`ink` con ícono blanco).
8. **Transparencia**: a qué se destina el dinero (lista simple con montos) y "Ver reporte mensual".
9. **Patrocinadores**: logos con nombre.
10. **Reseñas**: puntaje grande, 2 reseñas y "Ver las 12 reseñas". Solo pueden reseñar quienes
    participaron, y se aclara: "Reseñas de personas que participaron".
11. **Publicaciones de este voluntariado**: grilla de 3 columnas.
12. **Barra fija abajo** (con zona segura): "Inscribirme" y "Donar", como en la tarjeta, sobre
    `surface` con un borde `hairline` arriba.

Los **comentarios** del voluntariado (existen hoy, como pestaña) pasan a una fila "8 comentarios ›"
debajo de las reseñas, que abre la hoja de comentarios.

### Perfiles

Todos comparten la estructura de Instagram: arriba la identidad, abajo el contenido en pestañas.

**Estructura común:** avatar de 88px a la izquierda y tres estadísticas a la derecha (número en
`number` arriba, palabra en `label` abajo); nombre en `body-strong`; bio en `body-md` (máximo 4
líneas); una fila de botones; pestañas con íconos y texto; contenido.

| | Voluntario | ONG | Empresa |
|---|---|---|---|
| Avatar | Redondo | Cuadrado + insignia | Cuadrado |
| Estadísticas | Voluntariados · Publicaciones · Seguidores | Voluntariados · Voluntarios · Seguidores | Patrocinios · Voluntarios propios · Seguidores |
| Extra | Intereses y habilidades (chips) | **Transparencia**: "$ 1,2 M recaudados en 2026 · Ver reportes" | **Impacto**: "45 voluntariados apoyados · 320 empleados participaron" |
| Botones (perfil ajeno) | Seguir · Mensaje | Seguir · Mensaje · Donar | Seguir · Mensaje |
| Pestañas | Publicaciones · Voluntariados · Reseñas | Voluntariados · Publicaciones · Reseñas | Patrocinios · Publicaciones |

- **Botones:** "Seguir" es `button-primary` (negro), "Mensaje" es secundario. En el perfil de una ONG,
  "Donar" es el azul, el único botón de color. En el perfil propio: "Editar perfil" y "Compartir
  perfil" (secundarios).
- **Grilla de publicaciones:** 3 columnas, 2px de separación, mosaicos 4:5, sin bordes redondeados,
  la más nueva primero. Los carruseles llevan un ícono chico blanco arriba a la derecha.
- **Pestaña Voluntariados (ONG) o Patrocinios (empresa):** grilla de 2 columnas estilo Pinterest
  y Airbnb: foto 4:5 con radio 12px, título (2 líneas) y una mini barra de voluntarios. Arriba,
  chips para filtrar: "Activos", "Finalizados".
- **Pestaña Voluntariados (voluntario):** lista con "Próximos" y "Realizados".
- **Pestaña Reseñas:** puntaje promedio grande y la lista de reseñas.
- **Perfil propio** (agregado en 1.1): arriba a la derecha, un ícono de menú (☰) que abre
  **Configuración**. El CV, "Cerrar sesión" y "Borrar mi cuenta" se van del perfil a Configuración
  (hoy la "Zona peligrosa" queda en el medio del perfil). Las listas "ONGs que seguís" y
  "Voluntarios que sigo" se abren desde las estadísticas, y en el perfil propio queda una fila de
  logos de las ONGs seguidas.

### Explorar

Toma la búsqueda visual de Pinterest y el mapa de Airbnb.

- Arriba: campo de búsqueda grande (48px, `rounded.full`, "Buscá causas, ONGs o lugares").
- Debajo: chips de categoría que se deslizan (Medio ambiente, Educación, Salud, Animales,
  Alimentación, Comunidad…) y un botón "Filtros" (cercanía, fecha, tipo, rol, costo).
- Contenido: grilla de 2 columnas de voluntariados (como la pestaña de la ONG).
- Botón flotante "Mapa" (pastilla negra, abajo al centro) para pasar a la vista de mapa con los
  voluntariados cercanos como marcadores con su foto.
- **"Para vos"** (agregado en 1.1): las recomendaciones que ya existen (`/projects/recommended`)
  quedan como primera sección, dos mosaicos con la razón en `body-sm` ("Te interesa
  Alimentación", "Juan se sumó"), y debajo "Todos los voluntariados".

### Crear

Al tocar "Crear":

- **Voluntario:** solo "Nueva publicación". El primer paso es **elegir el voluntariado** (los suyos
  aparecen primero: inscripto, realizado o seguido). Sin voluntariado no se puede seguir, y se
  explica: "Cada publicación cuenta una acción. Elegí de cuál es."
- **ONG:** una hoja para elegir entre "Nuevo voluntariado" y "Nueva publicación".
- **Empresa:** "Nueva publicación" (vinculada a un voluntariado que patrocina o institucional).

Pasos de una publicación: Voluntariado → Fotos → Texto → Publicar. La edición de fotos es oscura
(`dark-canvas`) siempre, para ver bien la foto.

### Inscripción

Una hoja inferior al 85% de la pantalla:

1. Resumen: miniatura, título, fecha y lugar.
2. **Elegí un rol**: chips con los roles disponibles y sus cupos ("Arboricultor · 3 lugares").
3. **Costo por persona** (si tiene) y lo que incluye.
4. **Mensaje para la ONG** (opcional, 300 caracteres).
5. Botón verde fijo: "Postularme".

Después: un aviso "¡Listo! Te avisamos cuando **Verde Futuro** responda", y el voluntariado aparece
en Mis voluntariados → Postulaciones. La respuesta de la ONG llega como notificación y como
mensaje en el chat.

> Los cupos por rol ya se guardan (`project_roles.cantidad`), pero la inscripción no registra qué
> rol eligió la persona ni cuántos lugares de cada rol quedan. Hasta agregarlo en el backend, el paso
> 2 muestra los roles como información y la hoja sigue igual.

### Donación

Una hoja inferior:

1. Resumen del voluntariado y su barra de financiamiento.
2. **Montos rápidos**: chips grandes `$ 1.000`, `$ 2.500`, `$ 5.000`, `$ 10.000` y "Otro monto". El
   elegido queda con fondo `brand-soft` y borde 1,5px `brand`.
3. **Frecuencia**: "Una vez" o "Todos los meses" (control segmentado).
4. "Tu aporte se destina a: compra de plantines y herramientas", tomado de la transparencia del
   voluntariado.
5. **Pago con Mercado Pago (Bricks)**: configurá el tema del Brick con los tokens de este archivo
   (fuente, `brand`, radios de `sm`) para que no parezca otra app.
6. Botón azul fijo: "Donar $ 2.500".

Después: una pantalla de agradecimiento con el monto, el nuevo progreso de la meta (la barra se
llena con la animación) y "Ver comprobante".

> **Corregido en 1.1:**
> - **Pago:** en la primera etapa se mantiene **Checkout Pro** (la redirección de hoy, §172): el
>   botón azul lleva a Mercado Pago y la vuelta es `/donaciones/vuelta`. Bricks queda como mejora,
>   porque cambia el flujo de pago del backend y el marketplace de §215–§224.
> - **"Todos los meses"** necesita suscripciones de Mercado Pago, que hoy no existen. Hasta que se
>   construyan, el control segmentado **no se muestra** (no se dibuja un control que no hace nada).
> - Los montos rápidos respetan los límites del backend: entre $ 100 y $ 500.000
>   (`checkDonationAmount`).
> - Siempre que las credenciales sean de prueba, debajo del botón va "Modo prueba: no se cobra dinero
>   real" en `body-sm` (hoy lo avisa `DonateModal`).

### Mis voluntariados

La cuarta pestaña. Pestañas arriba: **Próximos · Postulaciones · Seguidos · Realizados**.

- **Próximos:** tarjetas grandes con la fecha destacada ("Sáb 26 · 9 h"), lugar y "Cómo llegar".
- **Postulaciones:** lista con el estado como chip: "Pendiente" (gris), "Entrevista" (gris con
  ícono), "Aceptado" (`people-soft`), "No seleccionado" (gris).
- **Seguidos:** grilla de 2 columnas como en Explorar.
- **Realizados:** lista con "Dejá tu reseña" si todavía no la dejó.

> **Desde §262 el chip "Entrevista" volvió:** ahora el backend tiene entrevistas (una postulación pendiente con una programada lo muestra). Lo que sigue es la nota de 1.1, cuando no existía:
> **Corregido en 1.1:** el estado "Entrevista" no existía en el backend (`enrollments.status` es
> `pending`, `approved`, `rejected` o `cancelled`); queda fuera hasta que se agregue. "Cancelar
> postulación" va en el menú "···" de cada fila, con confirmación, y no como botón rojo en cada
> tarjeta (hoy hay un "Cancelar" rojo por inscripción).

### Comentarios y reseñas

- **Comentarios** (en publicaciones y voluntariados): hoja inferior al 70%. Cada comentario: avatar
  32px, nombre + tiempo, texto, "Responder" en `ink-muted` y un corazón chico con su número. Campo
  fijo abajo con el avatar del usuario y "Publicar".
- **Reseñas** (de voluntariados y ONGs): estrellas de 1 a 5 + texto. Cada reseña muestra
  "Participó en **Reforestación Urbana** · abril 2026", para que se note que es real.

### Mensajes

**Bandeja:**

- Barra superior: "Mensajes" en `title-lg` y un ícono para escribir uno nuevo.
- Buscador debajo.
- **Asistente VoluntariAR** fijado arriba de todo: avatar con el logo, "Asistente" en
  `body-strong`, "Preguntame lo que quieras sobre voluntariados" en `ink-muted`. Es el chatbot para
  dudas generales.
- Filas de 72px sin divisores: avatar de 56px (redondo o cuadrado según el rol), nombre (con
  insignia si es ONG validada) y último mensaje + hora en `ink-muted`. No leídos: nombre y mensaje
  en peso 600 y un punto de 8px a la derecha.

> **Corregido en 1.1:** el borrador decía "un punto azul". El azul es solo dinero y marca: el punto
> de no leído es `ink`.

**Conversación:**

- Barra superior: atrás, avatar de 32px, nombre y debajo "Activo hace 5 min" o el rol ("ONG"). Tocar
  el nombre abre el perfil.
- Burbujas: las propias a la derecha en `ink` con texto blanco; las del otro a la izquierda en
  `surface-soft`. Radio 20px, máximo 75% del ancho. Mensajes seguidos del mismo autor van a 2px y
  aplanan las esquinas internas a 6px.
- **Tarjetas del sistema** dentro del chat, centradas, en `surface` con borde `hairline` y radio
  12px: "Verde Futuro aceptó tu postulación a **Reforestación Urbana**" con el botón "Ver detalles".
  Así la conversación con la ONG también es el historial de la inscripción.
- Voluntariados compartidos: tarjeta de 240px con foto, título y mini barra.
- Separadores de tiempo centrados ("Hoy 14:32") cuando pasa más de una hora.
- "Visto" debajo del último mensaje propio.
- Campo de texto fijo abajo: pastilla `surface-soft` de 44px con ícono de foto y "Mensaje…"; aparece
  "Enviar" (en `ink`, peso 700) cuando hay texto.

> "Activo hace 5 min" y "Visto" necesitan presencia y acuse de lectura por mensaje; hoy el chat solo
> marca leída la conversación entera. Hasta que exista, debajo del nombre va el rol.

**Desktop:** dos paneles, la bandeja (360px) y la conversación abierta.

### Botones

| Tipo | Aspecto | Uso |
|---|---|---|
| Donar | Azul `brand`, 48px, radio 12px | Solo para donar |
| Inscribirme | Verde `people`, 48px, radio 12px | Solo para postularse |
| Primario | Negro `ink`, 40px, radio 10px | Seguir, Publicar, Guardar, Continuar |
| Secundario | `surface-soft`, 40px | Mensaje, Editar perfil, Compartir |
| Texto | Sin fondo, `ink` peso 600 | Cancelar, Ver todo, Más información |
| Destructivo | Texto `critical` | Eliminar, cancelar postulación (siempre con confirmación) |

Desactivado: 40% de opacidad. Si falta algo, mejor dejarlo activo y explicar qué falta al tocarlo.
Mientras una acción está en curso, el botón conserva su ancho y muestra "Enviando…" (no un spinner
solo: el texto dice qué pasa).

### Inputs

Fondo `surface-soft`, sin borde en reposo, 48px de alto, radio 10px. Al enfocar: fondo `surface` y
borde 1,5px `ink`. Error: borde `critical` y mensaje en `body-sm` `critical` abajo. La etiqueta va
siempre arriba del campo, en `label`, nunca solo como placeholder.

### Chips

- Categoría y roles: `chip` (gris claro, texto negro). Seleccionado: `chip-selected` (negro).
- Sobre fotos: `chip-on-photo` (blanco 92%).
- **Sin colores por categoría.** Un arcoíris de categorías compite con las fotos y con el azul y el
  verde. Si querés diferenciarlas, usá un ícono de 14px dentro del chip.
- **El tipo de voluntariado lleva color** (decisión del usuario, 2026-10-21): **azul = Fugaz** (⚡) y **verde = Sostenido** (calendario). Es la única excepción a "azul = dinero, verde = personas": se usan los mismos tokens `brand` y `people`, así que cambian solos en el modo oscuro. Sobre una foto va como chip sólido con texto blanco; sobre fondo claro, con el fondo suave (`brand-soft`, `people-soft`). Siempre lleva el ícono y la palabra: el color nunca es la única señal. La modalidad ("Remoto", "Híbrido") va como chip `chip` en la página del voluntariado, no sobre la foto.

### Íconos

Un solo set, de línea, 24px, trazo de 1,75px, extremos redondeados (Lucide o Phosphor, gratis). La
versión rellena se usa solo para el estado activo (pestaña elegida, "me gusta", "Siguiendo").
La app ya usa **Lucide** (`lucide-react`): se queda, con `strokeWidth={1.75}` por defecto.

## Movimiento

- Toques: 120ms de cambio de opacidad o escala 0,97.
- Acordeón de la tarjeta: 220ms, altura + opacidad.
- Hojas inferiores: suben en 320ms (`ease-out`); el fondo oscuro aparece en 220ms.
- Barras de progreso: se llenan en 600ms cuando entran en pantalla por primera vez y cuando cambia
  el valor.
- "Me gusta": el corazón se llena y late (1 → 1,2 → 1) en 240ms. Doble toque en la foto: corazón
  grande en el centro.
- Inscripción confirmada: el botón verde se transforma en "Postulado" con un tilde que se dibuja
  en 320ms.
- **Respetar `prefers-reduced-motion`:** sin escalas ni deslizamientos, solo fundidos de 120ms; las
  barras se muestran llenas sin animar.

## Estados

- **Cargando:** esqueletos con la forma final (foto, líneas de texto, barras) en `surface-soft`, con
  un brillo suave de 1,6s. Nunca un spinner a pantalla completa.
- **Feed vacío** (usuario nuevo): título en `display` "Empezá por una causa", texto corto y chips de
  categorías para elegir intereses, con el botón "Ver voluntariados".
- **Sin resultados en Explorar:** "No encontramos voluntariados con esos filtros" + "Limpiar
  filtros".
- **Error:** en el lugar donde pasó ("No pudimos cargar los comentarios. Tocá para reintentar"),
  nunca un cartel que tape todo.
- **Sin conexión:** aviso negro arriba, "Sin conexión. Te mostramos lo último guardado".
- **Pago rechazado:** se queda en la hoja de donación, con el mensaje de Mercado Pago traducido en
  palabras simples y "Probar de nuevo".

> En la app, los estados de error ya tienen componentes con sus reglas (`LoadError` para una pantalla
> que carga un recurso por id, `InlineError` para una sección; ver `FRONTEND_CONTEXT.md` §12). El
> rediseño cambia cómo se ven, no cuándo aparecen.

## Accesibilidad

- Todo lo tocable mide al menos 44×44px.
- Toda foto lleva texto alternativo: en Crear hay un campo "Describí la foto" (opcional, con una
  sugerencia a partir del texto).
- El color nunca es la única señal: Donar e Inscribirme tienen texto, las barras tienen números, el
  "me gusta" se llena, los estados tienen palabras.
- Foco visible al navegar con teclado: borde de 2px `ink` (o `dark-ink`) con 2px de separación.
- Los montos y contadores se leen completos para lectores de pantalla ("32 mil pesos de 50 mil",
  no "$ 32.000 / $ 50.000").
- La app tiene que funcionar con el texto agrandado al 200% sin que se corten nombres ni botones.
- Se mantienen las reglas que la app ya cumple y que tienen tests: nombres accesibles en botones de
  ícono, `aria-pressed` en los que alternan, etiquetas asociadas, tarjetas que son `<Link>`
  (`FRONTEND_CONTEXT.md` §13, `A11yNames.test.tsx`).

## Voz y textos

Cercana, clara y en **voseo**, como habla la gente en Argentina.

- "Inscribirme", "Donar", "Seguir", "Postularme", "Sumarme".
- "No pudimos procesar tu donación. ¿Probás de nuevo?" en lugar de "Error en la transacción".
- Fechas y horas en formato local: "Sáb 26 de abril, 9 a 13 h".
- Nada de culpa ni presión ("¡Solo quedan 3 lugares, apurate!"). Se informa con datos: "Quedan 3
  lugares".
- Una sola exclamación por mensaje, y solo para celebrar ("¡Gracias por tu donación!").
- El nombre de la app es **VoluntariAR** en todos lados (hoy conviven "Voluntariar" y
  "VoluntariAR"), y el HTML va con `lang="es"` (hoy dice `en`).

## Hacer y no hacer

### Hacer

- Usar azul solo para dinero y verde solo para personas.
- Mostrar siempre los botones Inscribirme y Donar en la tarjeta.
- Mostrar el vínculo en cada publicación que tenga un voluntariado.
- Mostrar la insignia de verificada en todos los lugares donde aparece una ONG validada.
- Escribir fechas reales y números en formato argentino.
- Diseñar el modo oscuro pantalla por pantalla.

### No hacer

- No usar un corazón para "seguir". El corazón es solo "me gusta". **Tampoco en el logo** (1.1).
- No poner información importante solo sobre la foto (los patrocinadores van en la fila de la
  ONG, no sobre la imagen).
- No usar degradés en la interfaz. El degradé del logo queda solo en el ícono de la app.
- No sumar colores nuevos (ni por categoría, ni para una función nueva, ni por rol). Si algo
  necesita destacarse, usá peso, tamaño o un ícono.
- No meter tarjetas dentro de tarjetas ni sombras en el feed.
- No copiar el logo, los íconos ni el degradé de Instagram.
- No usar `alert()` ni `window.confirm()` (1.1): confirmaciones en un diálogo propio y avisos en un
  toast.

## Comportamiento responsive

| Ancho | Navegación | Feed | Extra |
|---|---|---|---|
| < 768px | Barra inferior | Publicaciones de borde a borde, tarjetas con 12px de margen | — |
| 768–1263px | Barra lateral de íconos (72px) | Columna de 520px centrada sobre `canvas-soft` | — |
| ≥ 1264px | Barra lateral con nombres (244px) | Columna de 520px | Columna derecha desde 1160px |

En desktop, la página del voluntariado usa dos columnas: contenido a la izquierda (máx. 640px) y
una caja fija a la derecha (360px) con la doble meta, el costo y los botones, como la caja de
reserva de Airbnb.

## Paneles de gestión (backoffice web)

Los paneles de ONG, empresa y administración son pantallas de trabajo, no de redes sociales. Usan
los mismos colores, fuente y componentes, pero con estas reglas:

- Fondo `canvas-soft`, contenido en bloques `surface` con borde `hairline`, sin sombras.
- Barra lateral con el logo, el nombre de la organización arriba, y los ítems en `ink-soft`; el
  activo con fondo `surface-soft` y texto `ink`.
- Los números importantes son texto grande (`number-lg`), no tarjetas con íconos de colores.
- En los gráficos, el azul es dinero y el verde es personas, igual que en la app.
- Tablas sin franjas de colores, con números alineados a la derecha.
- La acción más común de cada panel ("Ver postulantes", "Crear voluntariado") a un toque desde
  la primera pantalla.
- Avisos del panel (cuenta de Mercado Pago sin vincular, ONG sin validar): un bloque `surface` con
  el texto y un botón secundario. No amarillo: el amarillo no es un color del sistema.

## Guía para iterar

Al construir una pantalla con este archivo:

1. Usá contenido real: nombres argentinos, ONGs y lugares creíbles, montos en pesos, fotos reales
   (Unsplash).
2. Probá la tarjeta con un título largo, sin patrocinadores, sin meta de dinero y con cupos llenos.
3. Contá los colores: en una pantalla sin fotos, el azul y el verde deberían aparecer solo en
   botones de Donar/Inscribirme y en las barras.
4. Revisá la pantalla en modo claro y oscuro, a 375px y a 1440px.
5. Preguntate si alguien que nunca usó la app entiende en 3 segundos qué es y cómo ayudar.

## Lo que faltaba (agregado en 1.1)

### Logo

- **Ícono en la interfaz:** una "V" de trazo grueso (3px a 24px), blanca, centrada en un cuadrado
  `brand` con radio 28% (el mismo de los avatares de organización). 28px en la barra superior.
- **Palabra:** "VoluntariAR" en Plus Jakarta Sans 800, −0,4px de espaciado, color `ink`.
- **Ícono de la app** (favicon, pantalla de inicio del teléfono): el mismo cuadrado con la "V"; es el
  único lugar donde se permite el degradé del logo original.
- Reemplaza el corazón verde actual.

### Navegación por rol

| Rol | Barra inferior (celular) | Barra lateral (escritorio) |
|---|---|---|
| Voluntario | Inicio · Explorar · Crear · Mis voluntariados · Perfil | Lo mismo + Mensajes, Notificaciones y Configuración |
| ONG | Panel · Explorar · Crear · Mensajes · Perfil de la ONG | Resumen · Voluntariados · Postulaciones · Patrocinios · Publicaciones · Mensajes · Notificaciones · Equipo · Perfil de la ONG · Configuración |
| Empresa | Inicio · Explorar · Patrocinios · Mensajes · Perfil | Inicio · Explorar · Patrocinios · Mensajes · Notificaciones · Perfil · Configuración |
| Visitante | Inicio · Explorar · Ingresar | Inicio · Explorar · Ingresar · Crear cuenta |

- Cinco ítems como máximo en la barra inferior (hoy la ONG tiene seis o siete).
- El ítem activo usa el ícono relleno y el texto en `ink`; los demás, ícono de línea. Sin fondos de
  color detrás del ícono.
- En el celular, Notificaciones y Mensajes van en la barra superior para el voluntario. La ONG tiene
  Mensajes en la barra y Notificaciones en la barra superior del Panel.
- Los KPIs, el equipo y los momentos de la ONG se abren desde el Panel, no desde la barra.

### Visitante sin sesión (portada)

- La portada es **el mismo feed** (tarjetas de voluntariado reales), sin el bloque de bienvenida con
  foto de fondo y degradé que hay hoy.
- Arriba del feed, una franja `surface-soft` de 3 líneas: título en `title-md` ("Voluntariados en
  Córdoba, para sumarte o donar"), los tres números reales de `GET /api/stats` en `number` y un
  botón primario "Crear cuenta". Si los números son 0, no se muestran (como hoy, §129).
- Tocar "Inscribirme", "Donar", "Seguir" o "me gusta" abre el ingreso **y vuelve a esa acción** al
  terminar (hoy se pierde el contexto: `FRONTEND_CONTEXT.md` §10).

### Registro e ingreso (onboarding)

- **Páginas propias**, `/ingresar` y `/registro`, en lugar del modal actual. El modal queda solo
  como atajo cuando un visitante toca una acción; tiene el mismo contenido.
- **Registro en una pantalla:**
  1. "Creá tu cuenta" en `title-lg` y una línea que explica que el tipo de cuenta no se cambia.
  2. **Tipo de cuenta**: tres opciones de 64px como radio (`role="radiogroup"`): "Soy voluntario"
     (ícono en círculo), "Represento una ONG" y "Represento una empresa" (íconos en cuadrado). La
     elegida lleva borde 1,5px `ink` y un tilde negro.
  3. Campos: nombre y apellido, email, contraseña.
  4. Debajo de la contraseña, los requisitos del backend (8 caracteres, una mayúscula, un número)
     como lista que se va tildando en verde `people` mientras se escribe. El verde acá significa
     "cumplido", y va siempre con el tilde y el texto.
  5. Botón primario negro "Crear cuenta" y el link a privacidad y términos.
- **Después del registro:**
  - Voluntario: una pantalla "Empezá por una causa" (`display`) con chips de categorías para elegir
    intereses y "Ver voluntariados". Hoy los intereses se deducen del historial (las
    recomendaciones de `/projects/recommended`); guardarlos necesita una tabla nueva. Hasta que
    exista, los chips solo filtran Explorar.
  - ONG: va al Panel, con dos avisos arriba: "Validá tu ONG" y "Vinculá Mercado Pago".
  - Empresa: va a su perfil con un aviso "Completá tu perfil para patrocinar".
- **Ingreso:** email, contraseña, "Ingresar" (primario), "¿Olvidaste tu contraseña?" (texto) y
  "Crear cuenta" (texto).

### Notificaciones

- Pantalla propia (barra superior en el celular, ítem en la barra lateral en escritorio).
- Título "Notificaciones" y, a la derecha, "Marcar todo leído" (botón de texto).
- **Agrupadas por tiempo**: "Hoy", "Esta semana", "Antes", con el título del grupo en
  `body-strong`.
- **Fila** (mín. 64px, padding 10px 16px):
  - Avatar de 44px de quien la generó (redondo o cuadrado según el rol). Abajo a la derecha, un
    círculo de 20px con el tipo: tilde en `people` (te aceptaron), "$" en `brand` (donación
    acreditada), campana en `ink` (novedad de algo que seguís). Rechazos y avisos neutros, sin
    círculo.
  - Texto en `body-md` con los nombres en peso 600, y el tiempo en `ink-muted` al final.
  - A la derecha, según el tipo: miniatura de 44px de la publicación, o un botón "Seguir"
    (primario, 32px) si alguien empezó a seguirte.
  - No leída: fondo `canvas-soft` y punto `ink` de 8px.
- **Agrupar lo repetido:** "Lucía, Juan y 3 personas más pusieron me gusta a tu publicación" en una
  sola fila (con los dos últimos avatares superpuestos).
- Tocar una fila la marca leída y lleva al lugar (voluntariado, perfil, postulación).
- Vacío: "No tenés notificaciones. Cuando una ONG responda o alguien te siga, aparece acá."

### Configuración

- Pantalla sobre `canvas-soft`, con grupos `surface` de radio 12px y títulos de grupo en `label`.
- **Cuenta:** Datos personales, Contraseña, Mi CV (solo voluntario; con la explicación "Solo lo ven
  las ONG donde te postulás"), Cuenta de Mercado Pago (solo ONG), Validación (solo ONG).
- **Apariencia:** control segmentado "Como el teléfono / Claro / Oscuro" (se guarda en el
  navegador).
- **Avisos:** interruptores (`switch`, negro encendido) para Respuestas de las ONG, Novedades de lo
  que sigo, Me gusta y seguidores, y "También por email".
- **Más:** Privacidad y términos, "Cerrar sesión" (texto `ink`) y "Borrar mi cuenta" (texto
  `critical`, con la confirmación por email que ya existe, §178).
- Se llega desde el menú del perfil propio (celular) o desde la barra lateral (escritorio).

> Los interruptores de avisos necesitan una tabla de preferencias en el backend; mientras no
> exista, el grupo no se muestra.

### Validación de ONGs

- **Por qué:** la insignia azul es la forma de mostrar confianza (73% de la encuesta). Hoy ninguna
  ONG está validada porque no hay dónde guardarlo.
- **Pasos para la ONG** (pantalla "Validar la ONG", desde el Panel y Configuración), como una lista
  con línea de tiempo:
  1. Datos de la organización: CUIT y tipo de personería.
  2. Documentación: estatuto y constancia de inscripción (PDF, misma validación de cabecera que el
     CV).
  3. Revisión del equipo de VoluntariAR: "Tarda hasta 5 días hábiles. Te avisamos por notificación
     y por email."
- **Estados** como chip junto al nombre: "Sin validar" (no se muestra a otros), "En revisión"
  (gris), "Validada" (insignia azul), "Rechazada" (gris, con el motivo y "Volver a enviar").
- Mientras no está validada, la ONG puede publicar voluntariados y recibir postulaciones; las
  donaciones dependen de Mercado Pago, que es un paso aparte (se aclara en la pantalla).
- **Revisión:** un panel de administración mínimo (una tabla con las solicitudes, el PDF y
  "Aprobar"/"Rechazar"). Es el primer uso del rol administrador, que hoy no existe.

### Reportes de impacto

- **Para la ONG** (Panel → un voluntariado → "Impacto"): reemplaza la pantalla de KPIs actual con el
  mismo contenido (los KPIs ya existen en el backend).
  - Arriba, los números grandes en `number-lg`: voluntarios que participaron, horas verificadas,
    recaudado, y cada KPI propio de la ONG ("640 viandas entregadas").
  - Un gráfico de barras por mes: azul para lo recaudado y verde para las horas. Sin otros colores.
  - "Publicar como dato de impacto": arma una publicación con el número elegido.
- **Para el público** (página del voluntariado → "A qué se destina el dinero" y perfil de la ONG →
  "Ver reportes"): la lista de destinos con montos y, por mes, lo recaudado y lo gastado. Si la ONG
  no cargó destinos, la sección no aparece (no se dibuja vacía).
- **Para la empresa** (su panel): voluntariados apoyados, empleados que participaron y horas, con
  la misma regla de colores.

> Los destinos del dinero y lo gastado por mes no existen en el backend; los KPIs y las horas sí.

### Asistente (chatbot)

- Deja de ser un botón flotante (hoy tapa contenido en todas las pantallas y obliga a dejar un
  espacio al final de cada una).
- Vive como la primera conversación fijada de Mensajes, con el logo como avatar. Adentro usa las
  mismas burbujas que una conversación normal; las respuestas pueden traer un botón ("Ver
  voluntariados de Alimentación").
- En Configuración → Más hay un acceso directo "Ayuda".

### Hojas, diálogos y avisos

- **Celular:** hojas inferiores (`sheet`) con la manija de 36×4px arriba, título en `title-md` y el
  botón principal fijo abajo.
- **Escritorio (≥ 768px):** la misma hoja se muestra como diálogo centrado de 480px de ancho
  (`dialog`), con el mismo contenido. Un solo componente con dos presentaciones.
- **Confirmaciones** (cancelar postulación, borrar publicación, cerrar sesión, descartar un
  borrador): diálogo chico con título en pregunta ("¿Cancelar tu postulación?"), una línea de
  consecuencia y dos botones: el de la acción en texto `critical` o primario, y "Volver". Nunca
  `window.confirm`.
- **Toasts:** pastilla `ink` con texto blanco `body-sm`, abajo al centro, por encima de la barra
  inferior, 4 segundos. Para confirmar algo hecho ("Te postulaste a Censo de Árboles Urbanos") o un
  error que no tiene lugar propio. Pueden llevar una acción ("Deshacer"). Se anuncian con
  `role="status"`.

### Crear un voluntariado (ONG)

- El formulario actual (`CreateVoluntariado`) ya está en pasos; pasa a una pantalla con una barra
  de progreso fina arriba (`ink`) y el título del paso en `title-lg`:
  1. Lo básico: título, foto, categoría, tipo (fugaz/sostenido), modalidad.
  2. Cuándo y dónde: fecha de inicio y fin, horario, lugar con el mapa, o plataforma si es remoto.
  3. Personas: roles con cupos por rol, requisitos, costo por persona.
  4. Dinero: meta de financiamiento y a qué se destina (opcional).
  5. Revisar: la tarjeta tal como se va a ver en el feed, y "Publicar".
- Botón primario "Continuar" fijo abajo y "Atrás" como texto. Se guarda como borrador al salir.

### Pendientes que quedan

- Publicaciones de empresas, comentarios y guardados en publicaciones, "Seguido por…", patrocinadores
  en la tarjeta, lugares reservados por empresas, el rol elegido al inscribirse, intereses
  guardados, donación mensual, presencia en el chat y preferencias de avisos:
  están diseñados acá, pero **necesitan backend** (ver `docs/archivo/PLAN_REDISENO_FRONTEND.md`, parte 4).
- El reporte mensual descargable (PDF) de la ONG.
