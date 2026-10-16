# PLAN_FALTANTE.md — Qué le falta a VoluntariAR y en qué orden (2026-10-16)

> Plan de cierre de la tesis. **No es un registro de lo hecho** (eso es `PROJECT_ANALYSIS.md`), ni reemplaza a
> `BACKEND_ROADMAP_ANALYSIS.md` (diseño de los módulos): lo resume, lo corrige donde quedó viejo y lo ordena
> según las respuestas del usuario. Se armó leyendo solo `CLAUDE.md`, `AI_RULES.md`, `PROJECT_CONTEXT.md`, las
> secciones §0, §1.1, §1.3, §1.4, §2.4 y §2.5 del roadmap, dos secciones de `REVISION.md`, los 115 bloques
> "NO verificado" de `PROJECT_ANALYSIS.md` y algunos archivos de código puntuales (citados en cada punto).

## 0. Respuestas del usuario (base de la prioridad)

| Pregunta | Respuesta |
|---|---|
| Fecha de entrega o defensa | **Menos de 1 mes** (antes de ~2026-11-15) |
| Horas por semana | "Lo que dé la IA, plan Pro": el límite real son las sesiones del plan y **tu tiempo** para lo que yo no puedo hacer (ver en el celular, cuentas externas, deploy manual) |
| Sitio en la defensa | **Público, en vivo en Render** |
| Imprescindible | **Pagos (modo prueba)** y **CV + fotos de perfil** |
| Pasarela de pagos | **Mercado Pago** (decisión del 2026-10-16; reemplaza a Stripe, que figuraba en el roadmap §1.4 y en `PROJECT_ANALYSIS.md §30`) |
| Vencimiento de la base de Render | **14 de noviembre de 2026** (lo miraste en el panel) |
| Qué exige la cátedra | **Sin respuesta: a confirmar.** Todo lo de §3.d queda como "a confirmar" hasta que lo sepas |

| **Fecha de la defensa** | **5 de noviembre de 2026**: la base (vence el 14/11) alcanza, con 9 días de margen |
| Backup de la base | **No se hace** (decisión del usuario) |
| Decisiones del 2026-10-16 (2.ª tanda) | **F2:** `users.avatar` es la única foto del voluntario; las pantallas dejan de preferir `voluntarios.foto_perfil`. **P2:** Mercado Pago sin dependencia (`fetch`). **P5:** `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` en `render.yaml` con `sync: false` (OK del usuario para tocar `render.yaml` en la Etapa 10). **C1:** la ONG ve el CV con inscripción `pending` o `approved` en un proyecto suyo |

## 1. Estado de partida (corrido hoy, 2026-10-16, sobre `bad6a36`)

| Chequeo | Resultado real |
|---|---|
| Backend `npm test` (SQLite) | **625/625**: 0 fail, 0 cancelled, salida 0 |
| Backend `npm run test:pg` (Postgres 16 en Docker) | **627/627**: 0 fail, 0 cancelled, salida 0 |
| Frontend `npm test` | **576/576** |
| Frontend `npm run typecheck` | **0 errores** (salida 0) |
| `npm audit` (backend y frontend) | **0** vulnerabilidades en los dos |

- **Los números del pedido (487/489/515) eran viejos.** `CLAUDE.md` ya decía 625/627/576 y coinciden.
- No corrí las suites con `TZ=America/Argentina/Cordoba` (no cambié código: no hacía falta).
- **El deploy existe.** El pedido decía "según los docs no hay deploy", pero eso es de §50/§94 y quedó viejo.
  La app está en Render desde el 2026-10-15 (sitio `voluntariar-g0u6`, API `voluntariar-api-lxq7`), con
  verificación en producción en **§156 y §161**: Node, build, rutas que dan 200, registro, fotos y calificaciones.
  **Auto-deploy apagado:** después de cada push hacés "Manual Deploy" en el panel.

## 2. Decisiones abiertas (preguntas para vos)

Las marcadas con ⭐ bloquean una etapa imprescindible: hay que contestarlas **antes** de esa etapa.

**Pagos (Mercado Pago, Checkout Pro en modo prueba)**
- ✅ **P1. Cuenta:** resuelto con Mercado Pago (funciona en Argentina). En la Etapa 0 hace falta: tu cuenta de
  desarrollador, una **aplicación** con credenciales de prueba y **dos usuarios de prueba** (vendedor y comprador).
  Con tu cuenta real no podés pagarte a vos mismo, y en el modo prueba vendedor y comprador tienen que ser usuarios de
  prueba distintos. Esto lo sé de antes; **a confirmar** contra la documentación actual de Mercado Pago.
- ⭐ **P2. ¿SDK `mercadopago` o `fetch`?** Recomiendo **`fetch` sin dependencia**, como Cloudinary en §43. Son dos
  llamadas REST: crear la preferencia y consultar un pago. La firma del webhook se valida con `crypto`. Así no suma
  nada a `npm audit`.
- ✅ **P3. Moneda:** **ARS**, la misma unidad que `recaudado`/`meta_financiera` y el seed. Desaparece el problema de
  unidades que tenía Stripe con USD.
- **P4. ¿Quién puede donar?** Propuesta: voluntario y empresa sí, ONG no. Y ¿se muestra quién donó? Propuesta: no
  (solo el total en `current_funding`).
- ⭐ **P5. Variables `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` en Render.** Hay dos opciones: sumarlas a `render.yaml`
  como `sync: false`, que **toca `render.yaml` y necesita tu OK**, o cargarlas solo en el panel. **A confirmar:** si
  un sync del Blueprint borra las variables que no están en el archivo.
- **P6. Confirmar el pago también al volver del checkout:** con Mercado Pago es lo natural. El aviso del webhook
  solo trae el **id del pago**, y la verdad se obtiene consultando `GET /v1/payments/:id` con el access token
  (servidor a servidor). Propuesta: el webhook dispara esa consulta y, además, `GET /api/donaciones/:id` la hace
  si la donación sigue `pendiente` (por si el aviso llegó con la API dormida). Nunca se confía en los parámetros
  `status=approved` de la URL de vuelta: solo se usa el `payment_id` para preguntarle a Mercado Pago.

**CV**
- ⭐ **C1. ¿Qué ONG ve el CV?** Lo decidido (§30) es "solo con una inscripción `approved` en un proyecto de esa ONG".
  El uso natural de un CV es **evaluar a quien se postula**, o sea, con la inscripción `pending`. Propuesta:
  `pending` o `approved`. Es tu decisión.
- **C2. ¿Cómo se entrega el PDF?** Propuesta: guardarlo en Cloudinary como asset privado (no público) y que la API
  devuelva un **link de descarga que vence** (minutos). La alternativa es que el backend sirva el archivo, que
  es más simple de razonar pero pasa los bytes por la API gratuita.
- ✅ **C3 (CV, decisión del usuario del 2026-10-16): al reemplazar o borrar el CV, se borra el anterior de Cloudinary.** Para las fotos sigue abierto.
- *(texto original)* **C3. Al reemplazar una foto o un CV, ¿se borra el archivo viejo de Cloudinary?** Hace falta guardar el
  `public_id` (columnas nuevas). Hoy borrar usuarios o proyectos tampoco borra archivos (pendiente conocido).
  Propuesta: sí para el CV (es un dato personal), opcional para las fotos.

**Fotos de perfil**
- **F1. ¿La subida reemplaza el campo de URL o conviven?** Propuesta: botón "Subir foto" y el campo de URL se
  saca de la interfaz (el backend lo sigue aceptando).
- ⭐ **F2. Hay dos columnas de foto del voluntario:** `users.avatar` (la usa `VolunteerProfile.tsx:151`, por medio de
  `user.avatar`) y `voluntarios.foto_perfil` (la leen `follows.js:463` y `:484`). Antes de escribir hay que fijar
  cuál es la viva y si la subida escribe las dos. No lo resolví: **a confirmar** leyendo todos los usos.

**Cierre**
- **K1. Datos de demo en producción:** `seed.js` está bloqueado en producción a propósito (§116). Las opciones son
  cargarlos a mano por la interfaz (lento, pero real) o un script aparte con un flag explícito, que cambia la
  guarda de §116 y necesita tu decisión.
- **K2. Qué exige la cátedra** (informe, manual, casos de uso, pruebas, términos y condiciones, etc.).
- ✅ **K3. Fecha de la defensa:** 5 de noviembre (la base alcanza). En el panel de Mercado Pago se eligió **Checkout Pro**.

**Roadmap que queda para "trabajo futuro"** (las preguntas siguen abiertas, no bloquean nada)
- **E1. Empleados de empresa (§2.4):** ¿con invitación y aceptación (lo recomendado) o la empresa los declara?
- **E2. Chat de empresa (§2.5):** ¿la empresa le escribe a la ONG con propuesta `propuesto` o `aceptado`, o solo con `aceptado`?
- **E3. Chatbot con IA:** ¿se hace? Recomiendo que no, por el plazo.

## 3. Inventario de lo que falta

### 3.a Roadmap sin hacer

| Módulo | Estado real | Nota |
|---|---|---|
| Pagos (Mercado Pago, prueba) — §1.4 (el diseño de ahí es para Stripe: hay que reescribirlo en la Etapa 6) | Sin código: no hay ruta `donaciones` (miré `backend/src/routes/`). Existe la tabla `donaciones` con `DEFAULT 'completada'` (`migrate.js:191-201`) | Imprescindible |
| CV — §1.3 | `voluntarios.cv_url` existe y **solo** aparece en la lista blanca de `/auth/me` (`auth.js:191`). `GET /api/voluntarios/:userId` no la devuelve | Imprescindible |
| Fotos de perfil — §1.1 | `storage.js` solo sube **imágenes** (`uploadImage`, `/image/upload`); hoy los perfiles guardan una URL de texto | Imprescindible |
| Empleados de empresa — §2.4 | Sin hacer; falta E1 | Trabajo futuro |
| Chat de empresa — §2.5 | Sin hacer; falta E2 | Trabajo futuro |
| Chatbot con IA | Sin decidir (E3) | Descartable |

**El roadmap quedó viejo en dos puntos (es solo documentación):** §0 dice "Momentos: frontend ⏳", pero se hizo en
§46–§48. §3 lista el fallback de `JWT_SECRET` como riesgo y se resolvió en §94.

### 3.b Lo que quedó abierto de la revisión

Filtré los 115 bloques "NO verificado" contra las secciones posteriores y contra el código. **No incluyo**
lo que ya figura resuelto, por ejemplo B18 (KPI ajeno: hoy da 404, `projects.js:1196`), `PUT /ngos/me` con la fila
cruda (hoy `fmtNgo`, `ngos.js:250`), §125/§132 (iniciar sesión desde el perfil de una ONG), los errores del
WebSocket (§92/§100), el tipo `Rating` (§122) y el `typecheck` (§68–§69).

**Siguen abiertos:**

| # | Qué | Fuente | Tipo |
|---|---|---|---|
| R1 | `NGOMoments` pide `GET /api/ngos/me` (proyectos, stats, solicitudes) solo para sacar el id | §113 | rendimiento, chico |
| R2 | `API_CONTEXT.md` campo por campo y los docs contra el código, sin revisar. Hay omisiones listadas (errores 403/404/409, `limit/offset/total` del feed, `unread`, etc.) | REVISION "Qué sigue sin revisar", "Omisiones" | docs |
| R3 | Docs viejos que vi hoy: `PROJECT_CONTEXT.md §7` dice que `NGOEmpleados` usa `fetch` directo (resuelto en §98); `README.md:297` dice que la base gratuita "expira a los 90 días" (**a confirmar**: según lo que sé, Render la bajó a 30); y lo del roadmap de §3.a | lectura | docs |
| R4 | `alert()`/`confirm()` nativos en `NGODashboard.tsx:44`, `NGOProjectDetail.tsx:43-54`, `NGOKPIs.tsx:101-103`, `MyParticipation.tsx:42-44`. Son feos en una demo y bloquean la verificación con Chrome | §65, §88, grep de hoy | UX |
| R5 | El chat carga solo los últimos 300 mensajes: no hay "cargar anteriores" | §61 | mejora |
| R6 | `POST /api/messages` sin límite de frecuencia (el limitador de `lib/rateLimit.js` solo se usa en `auth.js`) | §87, grep | seguridad, baja |
| R7 | Una ONG puede crear categorías nuevas con cualquier texto (catálogo abierto) | §59 | decisión |
| R8 | `PATCH /enrollments/:id` permite pasar de `rejected` a `approved` | §70 | decisión de producto |
| R9 | La búsqueda del backend (`?search=`) distingue acentos (Explorar no, porque filtra en el cliente) | §54, §118 | mejora |
| R10 | `image` de proyecto sin validar como URL | §137, §143 | validación |
| R11 | El registro no manda `apellido` desde la interfaz (`AuthModal.tsx`) | §138 | mejora |
| R12 | Tres copias del bloque roles/requisitos/categoría (`projects.js`, `follows.js` ×2) | §134 | deuda |

**Componentes y módulos sin archivo de test propio** (lo calculé hoy: 58 módulos `.ts/.tsx` en `app/` y `lib/`;
busqué un `<Nombre>.test.*` en todo `src`): `ChatThread`, `CompanyBottomNav`, `CompanyLayout`, `CompanySidebarNav`,
`CreateVoluntariado`, `FeedPostCard`, `FeedSidebar`, `FollowListModal`, `MainFeed`, `MessagesScreen`,
`MyParticipation`, `NGOBottomNav`, `NGOLayout`, `NGOOwnProfile`, `NGOProjectDetail`, `NGOPublicProfile`,
`NotificationsScreen`, `ProjectDetails`, `PublicFeed`, `Root`, `VolunteerProfile`, `VolunteerPublicProfile`, `api`,
`sponsorship`, `useLatestRequest`.
Muchos tienen tests con otro nombre o se prueban dentro de la pantalla que los usa (por ejemplo, §107–§132
nombran tests de `MainFeed`, `ProjectDetails` y `NotificationsScreen`). Con un segundo criterio (que ningún
archivo de test los **importe**) quedan solo **`CompanySidebarNav`, `FeedSidebar`, `FollowListModal`,
`MessagesScreen`, `RequireRole`, `sponsorship`, `useLatestRequest`**. Esa lista puede tener falsos positivos si
algún test importa con otra forma de ruta: **a confirmar** uno por uno. En el backend no calculé la cobertura
endpoint por endpoint (hay 55 archivos de integración y 12 unitarios).

### 3.c Pendientes de verificación

| Qué | Estado |
|---|---|
| Deploy en Render: versión de Node, build, `/projects/recommended` y `/messages/conversations` en 200 | ✅ Hecho (§156, §161). No lo repito |
| Si Render pide los valores `sync: false` al sincronizar | Se cargaron en el panel (memoria del 2026-10-15). Volvés a necesitarlo con Mercado Pago (P5) |
| `APP_URL` real | `render.yaml` la fija en `https://voluntariar-g0u6.onrender.com`, igual que `CORS_ORIGINS`. **No verifiqué** un link real de un email |
| Resend con dominio propio | No está: el remitente es `onboarding@resend.dev`. **A confirmar** si cargaste `EMAIL_REDIRECT_TO` en el panel. Para la defensa alcanza con el modo prueba |
| Vencimiento de la base gratuita de Render | **14 de noviembre de 2026** (confirmado por vos en el panel). No es problema si la defensa es antes (K3). El backup se hace igual: es la única copia de los datos de demo |
| La API dormida (~1 min de arranque) | Hay que "despertarla" antes de la defensa. También afecta al webhook de Mercado Pago (P6) |
| Visual y táctil en un celular real | **Nada verificado** (yo no veo pantallas). Lo tenés que hacer vos: lista en la Etapa 12 |
| Lector de pantalla real (NVDA/TalkBack) | Nunca se probó (§79–§81) |

### 3.d Lo que suele esperarse de una tesis

| Qué | Lo que vi | Estado |
|---|---|---|
| Datos de demo | `seed.js` (8 usuarios, `Password1`), **bloqueado en producción** (§116). Producción tiene tus cuentas y una reseña de prueba (§161) | Falta en prod (K1) |
| Manual de uso | No hay. `README.md` es técnico (instalación y deploy) | Falta, a confirmar si se exige |
| Privacidad y términos | No hay ninguna pantalla (busqué "privacidad"/"términos" en `frontend/src`). **Con el CV se vuelve más importante:** se suben datos personales | Falta, a confirmar si se exige |
| Backups | No hay script ni procedimiento. La base gratuita vence | Falta |
| Guion de la defensa | No hay | Falta |
| Diagramas | Hay en `PROJECT_CONTEXT.md` (flujo en mermaid) y en `BACKEND_CONTEXT.md` (sin abrir hoy) | A confirmar si alcanzan |

## 4. Tabla de tareas y prioridad

Esfuerzo: **S** = media sesión o menos · **M** = una sesión · **L** = varias sesiones.

| # | Tarea | Por qué importa | Esf. | Riesgo | Depende de | Prioridad |
|---|---|---|---|---|---|---|
| T0 | Backup (`pg_dump`) de prod; aplicación de Mercado Pago con credenciales de prueba y dos usuarios de prueba; fecha exacta de la defensa (K3) | Sin credenciales no hay Pagos; sin backup, perder la base es perder la demo | S | medio | — (lo hacés vos) | **Imprescindible** (deriva de "público en vivo") |
| T1 | Fotos de perfil (voluntario, ONG, empresa) | Imprescindible para vos; reusa `storage.js` y `multer` | M | bajo | F1, F2 | **Imprescindible** |
| T2 | CV: subir PDF, ficha con acceso restringido, descarga | Imprescindible para vos | M–L | **medio-alto** (asset privado y PDF en Cloudinary) | C1, C2, C3; T1 (patrón de subida) | **Imprescindible** |
| T3 | Pagos Mercado Pago: donación, Checkout Pro, webhook, conciliación, pantalla de vuelta, progreso | Imprescindible para vos | L | **medio-alto** (usuarios de prueba, firma del aviso, webhook con la API dormida) | P2, P4–P6; T0 | **Imprescindible** |
| T4 | Datos de demo en producción | Sin datos, la defensa en vivo se ve vacía | S–M | bajo | K1, T1–T3 hechos | Conviene (muy) |
| T5 | Guion de la defensa + checklist del día | Evita sorpresas (API dormida, sesión, usuario de prueba de MP) | S | — | T1–T4 | Conviene (muy) |
| T6 | Página de privacidad y términos (simple, estática) | El CV sube datos personales | S | bajo | K2 | Conviene |
| T7 | Manual de uso por rol | Suele pedirse | S–M | — | K2 | Conviene (a confirmar) |
| T8 | Docs viejos (R3) + omisiones de `API_CONTEXT` (R2) | Coherencia de lo que se entrega | S–M | — | — | Conviene |
| T9 | Verificación en el celular real (Etapa 12) | Nada visual está verificado | S (tuyo) | medio | T1–T3 desplegados | Conviene (muy) |
| T10 | Cambiar `alert`/`confirm` por avisos en pantalla (R4) | Se ve mejor en la demo | M | bajo | — | Conviene si sobra tiempo |
| T11 | R1 (`NGOMoments`) | Chico, sin impacto visible | S | bajo | — | Descartable ahora |
| T12 | Tests de los componentes sin test (§3.b) | Hoy hay 576 tests en verde | M | — | — | Trabajo futuro |
| T13 | R5–R12 | Mejoras y decisiones de producto, ninguna rompe la demo | S–M c/u | — | — | Trabajo futuro |
| T14 | Empleados (§2.4) + chat de empresa (§2.5) | No entran en el plazo junto con los tres imprescindibles; el chat depende de empleados | L | medio | E1, E2 | Trabajo futuro |
| T15 | Chatbot con IA | Sin decidir, costo de API, plazo | L | medio | E3 | Descartable |
| T16 | Resend con dominio propio | Hace falta un dominio; el modo prueba alcanza para la defensa | S (+dominio) | bajo | — | Descartable |

**Por qué el orden es T1 → T2 → T3:** T1 deja el patrón de subida de perfiles que T2 reusa. T3 es independiente y
el más largo, pero si el plazo se acorta conviene llegar con dos módulos completos y no con tres a medias.
**Excepción:** si en la Etapa 0 los usuarios de prueba de Mercado Pago no funcionan, se sabe antes de escribir
código y se replanea.

## 5. Diseño breve de los imprescindibles

Reglas comunes (de `AI_RULES.md` y `CLAUDE.md`): tests primero (rojo → verde, nunca "el módulo no existe"); cada
etapa de backend corre en SQLite, Postgres y con `TZ=America/Argentina/Cordoba`; mutación solo sobre el código
nuevo; regla 24 en toda subida (sesión y rol → validar la **cabecera real** → subir fuera de la transacción →
guardar → borrar lo subido si falla); `storage.*` por propiedad; ids con `crypto.randomUUID()` y releer por id;
lista blanca en toda respuesta; casos de dueño en `ownership.test.js`; endpoint público nuevo en
`public-columns.test.js`; docs `*_CONTEXT.md` y una sección de `PROJECT_ANALYSIS.md` en el mismo commit. Los tests
nunca llaman a Cloudinary ni a Mercado Pago de verdad (dobles).

### 5.1 Fotos de perfil (T1)

- **Esquema:** sin tablas nuevas. Opcional (C3): `addColumnIfNotExists` de `*_public_id` en `users`/`ngos`/`empresas`
  para poder borrar la foto anterior. Antes, resolver **F2**.
- **Endpoints** (multipart, campo `photo`, misma configuración de `multer` que `posts.js`):
  - `PUT /api/auth/me/avatar` → voluntario (columna según F2);
  - `PUT /api/ngos/me/logo` → `ngos.foto_perfil`;
  - `PUT /api/empresas/me/logo` → `empresas.foto_perfil` (se mapea a `logo`, `empresas.js:31`).
  - Responden con el formateador de siempre (`/auth/me`, `fmtNgo`, `fmtEmpresa`) y 503 si Cloudinary no está
    configurado. Las rutas `/me/...` van **antes** de `/:id`.
- **Frontend:** `api.ts` con un método multipart que **no fija `Content-Type`** (trampa conocida); reusar
  `compressImage` de Momentos; botón "Cambiar foto" en `VolunteerProfile`, `NGOOwnProfile` y `CompanyOwnProfile`; y
  refrescar el `user` del `AuthContext` para que la barra muestre la foto nueva.
- **Tests:** archivo no imagen (cabecera falsa con `mimetype` de imagen) → 400 sin llamar a `storage`; otro rol →
  403; sin Cloudinary → 503; si falla la base después de subir → se llama a `deleteImage`; la respuesta trae la
  URL nueva; el perfil público muestra la foto. En el frontend: elegir archivo → llama a la API → se ve la imagen.
- **Trampas:** F2; un `fmt` copiado en vez de reusado; el `AuthContext` desactualizado.

### 5.2 CV (T2)

- **Esquema:** `voluntarios.cv_url` ya existe: guardar ahí el **`public_id`**, nunca una URL pública. Hay que
  documentar que el nombre engaña. Opcional: `cv_nombre` y `cv_subido` (`addColumnIfNotExists`).
- **Storage (✅ §164):** `detectPdf`, `uploadPdf` (recurso `raw`, `type=private`), `pdfDownloadUrl` (link firmado que
  vence a los 10 min) y `deletePdf`. Las rutas y los parámetros salen de la doc oficial del Upload API y del código del
  SDK oficial (`private_download_url`). Falta probarlo con la cuenta real (Etapa 5).
- **Endpoints:**
  - `PUT /api/voluntarios/me/cv` (voluntario; multipart `cv`; tope de 5 MB) → `{ has_cv: true }`;
  - `DELETE /api/voluntarios/me/cv`;
  - `GET /api/voluntarios/:userId/cv` (con sesión) → `{ url, expires_at }` si sos el dueño o una ONG con
    inscripción `pending`/`approved` (según C1) en un proyecto **suyo**. Si no, **404, no 403**, para no revelar si
    tiene CV.
  - `GET /api/voluntarios/:userId` (público) sigue **sin** `cv_url`; a lo sumo `has_cv: boolean`, y eso se decide.
- **Frontend:** subir, reemplazar y borrar en `VolunteerProfile`; botón "Ver CV" en `NGOProjectDetail`, en cada
  solicitud.
- **Tests:** PDF con cabecera falsa → 400 sin subir; ONG sin inscripción → 404; ONG con inscripción `rejected` → 404;
  ONG con inscripción en un proyecto **de otra ONG** → 404 (va a `ownership.test.js`); la dueña → 200; el perfil público
  no trae `cv_url` (`public-columns.test.js`); reemplazar borra el anterior (C3); `/auth/me` no expone el
  `public_id` (hoy está en la lista blanca de `auth.js:191`: devolver `has_cv` en su lugar).
- **Trampas:** la cuenta de Cloudinary puede tener bloqueada la entrega de PDF (Settings → Security) → 401 en prod;
  `users.location` vs `voluntarios.ubicacion` (la viva es `users.location`); fechas de vencimiento con `toMillis`.

### 5.3 Pagos con Mercado Pago, Checkout Pro (T3)

> Los detalles de la API de Mercado Pago que siguen (rutas, campos, formato de la firma) los sé de antes. **Se
> verifican contra la documentación oficial al empezar la Etapa 6**, como se hizo con Cloudinary en §43. Lo que no
> depende de eso (estados, transacción, idempotencia) vale igual.

- **Flujo:** el backend crea una **preferencia** con el monto y `external_reference = id de la donación` → el
  navegador va a la página de Mercado Pago → el comprador paga → Mercado Pago (1) avisa al webhook con el id del
  pago y (2) devuelve al navegador a `back_urls` con `payment_id`. En los dos casos el backend **consulta el pago**
  a Mercado Pago y recién ahí cambia el estado.
- **Esquema** (aditivo, `migrate.js`): `donaciones.external_id` (id de la preferencia), `external_payment_id`,
  `external_status` y `moneda` (`DEFAULT 'ARS'`), más el índice `idx_donaciones_external`. **Todo `INSERT` pone
  `estado='pendiente'` explícito** (el `DEFAULT` es `'completada'`).
- **Módulo `src/lib/payments.js`** (se llama por propiedad, como `storage`, para reemplazarlo en los tests):
  `createPreference({ id, title, amount })` → `{ preferenceId, checkoutUrl }`, `getPayment(paymentId)` →
  `{ status, external_reference, transaction_amount, currency_id }` y `verifyWebhookSignature(headers, dataId)`.
  En modo prueba se usa la URL de checkout de sandbox.
- **Una sola función de transición**, `applyPayment(paymentId)`, que usan el webhook y la conciliación:
  1. `getPayment` (fuera de la transacción);
  2. se comprueba que `external_reference` sea una donación existente y que **el monto y la moneda coincidan** con la
     fila (que nadie pague $1 por una donación de $1000);
  3. con `approved`, **en `db.transaction()` con `tx.*`**: `UPDATE donaciones SET estado='completada',
     external_payment_id=$2 WHERE id=$1 AND estado='pendiente'` y, si `changes = 1`, `UPDATE projects SET
     recaudado = recaudado + $monto`;
  4. con cualquier estado que no sea `approved` **no se cambia el estado** (§170: MP deja reintentar con la misma preferencia); solo se anota `external_status`;
  5. la notificación a la ONG va **después** del COMMIT.
- **Endpoints:**
  - `POST /api/donaciones` `{ project_id, amount }` (rol según P4; limitador de `lib/rateLimit.js`) → valida el monto
    (número finito, mayor que 0, con tope) y el proyecto `active` → inserta `pendiente` → `createPreference` (fuera
    de toda transacción) → guarda `external_id` → `201 { donation_id, checkout_url }`. Si Mercado Pago falla, la fila
    pasa a `fallida` y se responde 502 con un mensaje en español.
  - `POST /api/donaciones/webhook` (público): verifica la firma (`x-signature` + `x-request-id`; HMAC-SHA256 con
    `MP_WEBHOOK_SECRET`, a confirmar en la doc). Si `type = payment`, llama a `applyPayment(data.id)` y responde 200
    rápido; si hay un error interno, responde 5xx para que Mercado Pago reintente. **Aunque la firma fallara, el
    estado nunca sale del cuerpo del aviso:** sale de `getPayment`. La firma evita que cualquiera nos haga consultar
    pagos a pedido.
  - `GET /api/donaciones/:id?payment_id=…` (solo quien donó): si sigue `pendiente` y viene `payment_id`, llama a
    `applyPayment` (que comprueba que ese pago sea de **esta** donación) → `{ id, status, amount, project_id }`.
- **Frontend:** botón "Donar" en `ProjectDetails` (modal con el monto en pesos) → redirige a `checkout_url`;
  ruta `/donaciones/vuelta` que lee `external_reference` y `payment_id` de la URL y consulta el estado ("Procesando…"
  → "¡Gracias!" / "El pago no se completó"); `current_funding` ya existe en `api.ts:234`.
- **Tests** (doble de `payments`; nada sale a la red):
  - firma inválida → 401/400, sin consultar el pago ni cambiar nada;
  - el **mismo aviso dos veces** → `recaudado` suma una sola vez;
  - aviso y conciliación **simultáneos** (`test:pg`) → una sola suma;
  - pago `approved` con **monto distinto** o con `external_reference` de otra donación → no se acredita;
  - `rejected` → `fallida`; `pending` → sigue `pendiente`;
  - proyecto inexistente o inactivo → 404;
  - monto `"12abc"`, `Infinity`, `-1`, `[]` → 400;
  - ver la donación de otro → 404 (`ownership.test.js`);
  - `recaudado` llega como número también en Postgres;
  - Mercado Pago caído al crear → `fallida` + 502.
- **Trampas:** `SUM` como string en Postgres; la API dormida (para eso está la conciliación); en el modo prueba,
  vendedor y comprador tienen que ser **usuarios de prueba distintos** (con tu cuenta real falla); el aviso del
  webhook necesita una URL pública HTTPS, así que en local no llega (se prueba con dobles, y de verdad solo en
  Render); el monto se compara con tolerancia de centavos (`REAL` en SQLite).

## 6. Orden en etapas (una sesión o un commit cada una)

| Etapa | Qué | Quién | Commit |
|---|---|---|---|
| **0** | En Mercado Pago Developers, crear la aplicación, sacar las credenciales de prueba y crear dos usuarios de prueba; contestar P2, P5, C1 y F2 | **Vos** (yo te paso los comandos) | — |
| 1 | ✅ Fotos: backend + tests (SQLite, PG, TZ) + docs. Quedó un solo endpoint para los tres roles, `PUT /api/auth/me/photo` (§162) | yo | 1 |
| 2 | ✅ Fotos: frontend (3 pantallas, `api.ts`, `AuthContext`) + F2 + tests + typecheck (§163) | yo | 1 |
| 3 | ✅ CV: `storage.detectPdf/uploadPdf/pdfDownloadUrl/deletePdf` contra la doc oficial y el SDK + tests unitarios (§164) | yo | 1 |
| 4 | ✅ CV: endpoints + autorización (C1) + borrado del anterior (C3) + `ownership`; `/auth/me` con `has_cv` (§165) | yo | 1 |
| 5 | ✅ CV: frontend (perfil del voluntario + "Ver CV" en la ONG, §166). ✅ probado en prod por el usuario (§167) | yo + vos | 1 |
| 6 | ✅ (§169) MP: verificar la API contra la doc oficial (y el código del SDK oficial); `lib/payments.js` + tests unitarios (firma); reescribir el roadmap §1.4 para Mercado Pago | yo | 1 |
| 7 | ✅ (§170) MP: migración + `POST /api/donaciones` + `applyPayment` (transacción, CAS, control de monto). Cambios de diseño: pesos enteros de $100 a $500.000 (`float4`) y un rechazo no marca `fallida` (MP deja reintentar) | yo | 1 |
| 8 | ✅ (§171) MP: webhook + `GET /donaciones/:id` con conciliación. Los avisos IPN (sin firma posible) se responden 200 sin procesar | yo | 1 |
| 9 | ✅ (§172) MP: frontend (botón, modal, `/donaciones/vuelta`) | yo | 1 |
| 10 | 🟡 (§173) Donación aprobada en prod ✅ (logueado como comprador de prueba). Faltan: ver el aviso en los logs y el rechazo `OTHE`. — MP en prod: variables (P5), URL del webhook en el panel de la aplicación, deploy, donación con el usuario comprador de prueba y una tarjeta de prueba | **vos** (yo guío y verifico por Chrome si me das la sesión) | docs |
| 11 | Datos de demo en prod (K1) + privacidad y términos (T6) | yo + vos | 1–2 |
| 12 | Celular real: login de los 3 roles, subir foto y CV desde la galería, donar, chat, mapa, barras inferiores | **vos** | — |
| 13 | Guion de la defensa + checklist del día (despertar la API, sesiones abiertas, usuario comprador de prueba y tarjeta a mano) + docs viejos (R3) | yo | 1 |

Con menos de un mes y sesiones limitadas por el plan, **si a mitad de camino falta tiempo**, se corta T3 en la
Etapa 9: queda sin probar en prod, se presenta como "funciona en modo test local" y la Etapa 10 se pasa a "trabajo
futuro". Las etapas 0, 11 y 13 no se cortan.

## 7. ⚠️ No verificado y riesgos (honesto)

- **No verifiqué nada en Render hoy:** ni las variables del panel ni `EMAIL_REDIRECT_TO`. Lo de producción sale de
  §156/§161 y de la memoria del 2026-10-15. **El vencimiento (14 de noviembre) lo confirmaste vos**; el README
  (90 días) quedó mal y se corrige en la Etapa 13.
- **Mercado Pago:** todo lo de §5.3 sobre su API (preferencias, `sandbox_init_point`, `x-signature`, usuarios de
  prueba, tarjetas de prueba) es de memoria y **no está verificado**. Es el riesgo más grande del plan, y por eso la
  Etapa 6 empieza por la documentación oficial. Un riesgo conocido del modo prueba: los usuarios de prueba a
  veces fallan por causas del lado de Mercado Pago, y conviene probarlos en la Etapa 0.
- **Sin backup (decisión tuya):** si algo borra o rompe los datos de prod antes del 5/11, no hay forma de
  recuperarlos y la demo se recarga a mano.
- **Cloudinary con PDF privados:** el diseño del link que vence no está verificado contra la documentación
  (lo hago en la Etapa 3, antes de escribir endpoints).
- **Componentes sin test:** el cálculo es por nombre de archivo y por import, y puede tener falsos positivos y
  negativos. No calculé la cobertura del backend por endpoint.
- **No leí** `BACKEND_CONTEXT.md`, `FRONTEND_CONTEXT.md`, `API_CONTEXT.md` ni `DATABASE_CONTEXT.md` (no estaban en la
  lista). Las etapas que tocan endpoints los van a leer antes, como pide la regla 1.
- **De los bloques "NO verificado"** descarté como resueltos los que encontré resueltos en una sección posterior o
  en el código. Puede quedar alguno resuelto que no detecté, o alguno abierto que leí como cerrado.
- **Lo visual y lo táctil:** nada. Ni las fotos subidas, ni el modal de donación, ni la página de éxito los voy a poder
  ver: quedan para la Etapa 12.
- **No corrí** las suites con `TZ=America/Argentina/Cordoba` hoy (no hubo cambios de código).
- **Riesgo de la defensa en vivo:** la API gratuita dormida (~1 min) y la base que vence. Mitigación: despertarla 5
  minutos antes, tener el backup de la Etapa 0 y un video corto de respaldo (a confirmar con la cátedra).
