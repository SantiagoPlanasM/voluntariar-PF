# PROJECT_ANALYSIS.md — Análisis crítico de VoluntariAR

> Diagnóstico consolidado. Para contexto arquitectónico neutral, ver `PROJECT_CONTEXT.md`, `BACKEND_CONTEXT.md`, `FRONTEND_CONTEXT.md`, `DATABASE_CONTEXT.md`, `API_CONTEXT.md`. Este documento no modifica nada — solo analiza y prioriza.

## 1. Fortalezas

- **Esquema de datos bien normalizado:** requisitos y roles de proyecto viven en tablas propias (no JSON embebido), hay tablas intermedias N:M correctas para categorías/habilidades/seguidores, y las FKs tienen políticas de borrado (`CASCADE`/`SET NULL`) pensadas caso por caso, no aplicadas ciegamente.
- **Compatibilidad dual SQLite/Postgres bien resuelta en el caso general:** el adaptador (`src/db/index.js`) permite desarrollar localmente sin instalar Postgres y desplegar en producción sin cambiar código de rutas, para la gran mayoría de queries.
- **Separación clara de responsabilidades por rol** en el modelo de datos (`voluntarios`/`ngos`/`empresas` como perfiles 1:1 sobre `users`), lo que deja margen para crecer sin reescribir el modelo de auth.
- **Validaciones consistentes del lado del servidor** (`validateProject`, `hasBadWord`, checks de cupos/estado) — el backend no confía ciegamente en el frontend, incluso donde hay duplicación.
- **README con credenciales de demo y guía de deploy clara**, lo cual facilita mucho la evaluación/onboarding de un proyecto académico.
- **`optionalAuth` bien pensado** para el feed público — permite SEO/descubrimiento sin login y personaliza la respuesta si hay sesión, sin duplicar endpoints.

## 2. Debilidades generales

- Ausencia total de tests automatizados (unitarios, de integración, e2e) en ambos paquetes.
- Ausencia de linter/formatter configurado (no hay `.eslintrc`, `.prettierrc` en ninguno de los dos `package.json`).
- Sincronización backend↔frontend 100% manual (nombres de campo, validaciones, tipos) — sin contrato compartido (OpenAPI, tRPC, paquete de tipos común).
- Sin CI/CD visible más allá del auto-deploy de Render vía `render.yaml` — no hay pipeline que corra tests o linter antes de desplegar.
- Sin manejo de errores centralizado en el frontend (sin error boundary, sin sistema de toasts) — cada pantalla reinventa su propio `useState<error>`.

## 3. Bugs encontrados

| # | Bug | Ubicación | Severidad | Estado |
|---|---|---|---|---|
| B1 | El mensaje del voluntario al inscribirse nunca se guarda: frontend envía `{ project_id, message }`, backend lee `{ project_id, mensaje }` | `frontend/src/lib/api.ts` (`enrollments.enroll`) vs `backend/src/routes/enrollments.js` línea 11 | **Alta** — funcionalidad visible al usuario que no funciona, sin ningún error reportado | ✅ **Corregido** (ver §13) |
| B2 | La categoría de una ONG nunca se refleja en el perfil propio ni se persiste al editar: `GET /ngos/:id` y `GET /ngos/me` no hacen JOIN con `ngo_categorias`, y `fmtNgo()` nunca mapea `categoria_nombre → category`; `PUT /ngos/me` tampoco escribe en `ngo_categorias` | `backend/src/routes/ngos.js` | **Media-Alta** — el selector de categoría en `NGOOwnProfile.tsx` parece "no guardar" | ✅ **Corregido** (ver §13) |
| B3 | `OnboardingScreen.tsx` no está registrado en `routes.tsx` — código inalcanzable | `frontend/src/app/routes.tsx` | **Baja** (no rompe nada, pero es ambiguo: ¿falta cablear la ruta o es código muerto a borrar?) | Sin corregir (pendiente de decisión del equipo) |
| B4 | Dependencias `multer` y `uuid` declaradas y nunca importadas en el backend | `backend/package.json` | **Baja** (peso extra de `node_modules`, confusión para quien lea el `package.json` esperando upload de archivos) | Sin corregir |
| B5 | Crear/editar un proyecto siempre falla con "Los cupos deben ser un número positivo": el frontend envía `volunteers_needed` (igual que el resto de los campos de este endpoint, todos en inglés), pero el backend destructuraba `cupos` de `req.body` en `POST /api/projects` y `PUT /api/projects/:id` | `backend/src/routes/projects.js` (`validateProject`, `POST /`, `PUT /:id`) | **Crítica** — bloquea por completo la creación y edición de proyectos, la funcionalidad central de una ONG | ✅ **Corregido** (ver §13) |
| B6 | `GET /api/ngos/:id` (perfil público de ONG) devolvía `500 Internal Server Error` siempre: la subquery de proyectos hace `SELECT id, ...` con un `JOIN` a `categorias` (que también tiene columna `id`) sin calificar la columna, lo que SQLite rechaza como "ambiguous column name: id" | `backend/src/routes/ngos.js` (`GET /:id`) | **Alta** — rompe el perfil público de cualquier ONG (`/ngo/:id`) y, en cascada, el logo/nombre de ONG clickeable dentro de `ProjectCard` en el feed principal | ✅ **Corregido** (ver §16) |
| B7 | `VolunteerProfile.tsx` llamaba a `api.auth.updateMe(...)`, un método que **no existía** en `api.ts` (solo estaban `register`, `login`, `me`) — guardar el perfil de un voluntario (nombre/bio/ubicación) tiraba un `TypeError` en el navegador siempre, sin llegar a pegarle al backend | `frontend/src/lib/api.ts` | **Alta** — bloquea por completo la edición de perfil del rol voluntario | ✅ **Corregido** (ver §17) |
| B8 | `PUT /api/auth/me` devolvía `500` cada vez que se omitía algún campo opcional (p. ej. `avatar`): el valor `undefined` se pasaba directo como parámetro bindeado a SQLite, que lo rechaza (`Provided value cannot be bound to SQLite parameter`) | `backend/src/routes/auth.js` (`PUT /me`) | **Alta** — combinado con B7, hacía imposible guardar el perfil de un voluntario incluso después de arreglar el método faltante del cliente | ✅ **Corregido** (ver §17) |
| B9 | El adaptador de SQLite traducía `$1, $2, ...` a `?` con una regex simple (`\$\d+ → ?`), sin tener en cuenta que Postgres permite reusar el mismo `$N` más de una vez en una misma query. Cualquier query que reutilizara un placeholder (ej. `WHERE (a=$1 AND b=$2) OR (a=$2 AND b=$1)`) quedaba con más `?` que parámetros bindeados, y devolvía **cero filas en silencio** (sin error) contra SQLite en vez del resultado esperado — funcionando bien solo contra Postgres | `backend/src/db/index.js` (rama SQLite, `translatePg`) | **Alta** — bug transversal en el adaptador compartido por todas las rutas; se manifestó primero en la query del historial de chat (`GET /messages/thread/:userId`), pero podía afectar a cualquier query futura (o ya existente) que reusara un placeholder | ✅ **Corregido** (ver §18) |

## 4. Código duplicado

- **Regex de validación de email/nombre/password**: implementadas de forma idéntica en `backend/src/routes/auth.js` y `frontend/src/app/components/AuthModal.tsx`. Cualquier cambio de política de contraseñas (p. ej. exigir un carácter especial) debe hacerse en dos lugares o quedan desincronizados sin que nada lo detecte.
- **Blacklist de palabras prohibidas** (`BLACKLIST`, `hasBadWord`): copiada literalmente entre `backend/src/routes/projects.js` y `frontend/src/app/components/ProjectDetails.tsx`. Agregar una palabra nueva a la lista requiere editar dos archivos.
- **Validaciones de formulario de proyecto** (duración obligatoria si `fugaz`, horas semanales obligatorias si `sostenido`, cupos > 0): reimplementadas en `CreateVoluntariado.tsx` además de en `validateProject()` del backend — funcionalmente correcto (defensa en profundidad), pero es lógica de negocio que vive en dos lugares con dos redacciones de mensaje de error distintas.
- **Patrón fetch + headers de auth manual**: `NGOKPIs.tsx` y `NGOEmpleados.tsx` reimplementan lo que ya hace `lib/api.ts`.

## 5. Inconsistencias entre frontend y backend

- Nombre de campo `message`/`mensaje` (B1).
- Campo `category` de ONG expuesto en el tipo TypeScript `NGO` pero nunca poblado por ninguna respuesta real del backend (B2).
- `VolunteerProfile.tsx` llama a `fetch` directo a `/auth/me` en lugar de `api.auth.me()`, aunque ambos apuntan al mismo endpoint — no es un bug funcional, pero es una inconsistencia de patrón que aumenta el costo de mantenimiento (dos formas de hacer lo mismo, sin razón aparente).
- El backend modela `company` como rol de primera clase (tabla `empresas`, tabla `empresa_voluntariados`) pero el frontend no tiene ninguna pantalla para ese rol — un usuario `company` termina navegando el feed de voluntario, lo cual es semánticamente confuso (¿una empresa "se inscribe" a un proyecto como si fuera una persona voluntaria?).

## 6. Riesgos de mantenimiento

- **Sincronización manual de tipos y nombres de campo** (descrito en varios puntos arriba) es, a mediano plazo, la mayor fuente de riesgo: cada feature nueva tiene que tocar 3 lugares (esquema, `fmt()`, `interface` TS) sin ninguna verificación automática que falle si uno de los tres queda desactualizado.
- **`migrate.js` sin versionado incremental**: a medida que el esquema crezca, este único archivo se vuelve cada vez más difícil de auditar ("¿qué cambió entre la v1 y la v2 de la tabla X?") y no hay forma de aplicar solo el delta a una base ya poblada sin escribir SQL manual fuera del flujo normal.
- **Tablas de esquema sin funcionalidad (`donaciones`, `reuniones`)**: riesgo de que un desarrollador futuro (humano o IA) asuma que existe una feature de donaciones porque "la tabla está" y pierda tiempo buscando el endpoint que no existe, o peor, construya una funcionalidad duplicada con un esquema distinto.
- **Sin tests**: cualquier refactor (p. ej., arreglar B1 o B2) no tiene red de seguridad automática — hay que probar manualmente los flujos de registro, login, creación de proyecto, inscripción y aprobación cada vez.

## 7. Problemas de arquitectura

- Falta de capa de servicio/repositorio: la lógica de negocio, el acceso a datos y el formateo de respuesta viven todos en el mismo handler de ruta, lo que dificulta testear la lógica de negocio de forma aislada.
- Autorización de "recurso pertenece a esta ONG" repetida manualmente en cada handler en vez de un middleware/helper reutilizable — fácil de olvidar en un endpoint nuevo.
- Definición de rutas después de `module.exports` en `projects.js` — funciona pero es una organización de archivo confusa que puede inducir errores en refactors futuros (alguien podría mover código pensando que las líneas después del export "no se ejecutan").

## 8. Problemas de rendimiento

- **N+1 queries en `NGODashboard.tsx`** (frontend): una llamada a `GET /api/enrollments/project/:id` por cada proyecto listado de la ONG, en vez de un endpoint que devuelva el conteo agregado por proyecto en una sola llamada.
- **N+1 queries en la rama SQLite de `GET /api/projects`** (backend): por cada proyecto de la página de resultados, se disparan queries adicionales para roles/requisitos/categoría, mientras que la rama Postgres resuelve lo mismo con agregación en una sola query. En SQLite (el motor usado en desarrollo local) esto escala mal con el tamaño de la página.
- **Sin índices en columnas de búsqueda de texto libre** (`projects.titulo`, `projects.descripcion`, `ngos.nombre`) — las búsquedas con `LIKE`/`ILIKE` hacen table scan; aceptable con el volumen de datos de un proyecto académico, no escalaría a datos reales de producción.

## 9. Problemas de seguridad

- **`JWT_SECRET` con fallback hardcodeado** (`'voluntariar_dev_secret'`) si la variable de entorno no está seteada — si el proyecto se despliega alguna vez sin configurar esa env var, cualquiera puede forjar tokens válidos.
- **Sin rate limiting** en `POST /api/auth/login` ni `POST /api/auth/register` — expuesto a fuerza bruta de credenciales o registro masivo automatizado.
- **Sin invalidación de sesión del lado servidor** (logout puramente client-side, sin blacklist de tokens) — un token robado sigue siendo válido hasta su expiración natural (7 días) aunque el usuario "cierre sesión".
- **CORS configurable por `CORS_ORIGINS`** — correcto en diseño, pero conviene verificar en cada entorno que la lista de orígenes permitidos no incluya comodines amplios en producción.

## 10. Problemas de escalabilidad

- Plan gratuito de Render para la base de datos Postgres expira a los 90 días y el servicio backend "duerme" tras 15 minutos de inactividad — aceptable para demo académica, **no apto para producción real** sin upgrade de plan.
- Sin paginación real en los catálogos (`GET /api/categorias`, `/roles`, `/habilidades` devuelven todo sin límite) — no es un problema hoy por el tamaño reducido de estos catálogos, pero no escalaría si crecieran mucho.
- Arquitectura monolítica de un solo proceso Express sin cola de trabajos ni separación de lecturas/escrituras — suficiente para el volumen actual, a revisar si el proyecto pasa de demo a producto real con tráfico sostenido.

## 11. Prioridad de cada problema (para roadmap)

| Prioridad | Problema | Por qué |
|---|---|---|
| 🔴 Crítica | B1 — mensaje de inscripción no se guarda | Bug funcional silencioso, visible para el usuario final, fácil de corregir (renombrar un campo) |
| 🔴 Crítica | B2 — categoría de ONG no persiste/no se muestra | Bug funcional silencioso que afecta un flujo central del perfil de ONG |
| 🟠 Alta | JWT_SECRET con fallback inseguro | Riesgo de seguridad real si se olvida configurar la env var en un despliegue |
| 🟠 Alta | Falta de guardas de rol en rutas `/ngo/*` del frontend | UX pobre (usuarios ven pantallas que no deberían) aunque el backend esté protegido |
| 🟡 Media | N+1 en `NGODashboard` y en `GET /api/projects` (SQLite) | Afecta rendimiento pero no correctitud; se nota más con datos reales |
| 🟡 Media | Falta de tests | No bloquea funcionalidad actual, pero aumenta el riesgo de cada cambio futuro |
| 🟡 Media | Duplicación de validaciones/blacklist frontend-backend | Mantenimiento costoso a futuro, no rompe nada hoy |
| 🟢 Baja | `OnboardingScreen.tsx` no enrutado | Código muerto, sin impacto funcional |
| 🟢 Baja | Dependencias no usadas (`multer`, `uuid`) | Cosmético |
| 🟢 Baja | Falta de rate limiting en auth | Real pero de menor urgencia mientras el proyecto sea una demo académica sin tráfico público real |
| 🟢 Baja | Tablas `donaciones`/`reuniones` sin API | No es un bug, es funcionalidad no construida — priorizar solo si el roadmap las pide |

## 12. Recomendaciones concretas

1. **Corregir B1**: renombrar `message` → `mensaje` en `frontend/src/lib/api.ts` (`enrollments.enroll`) o, mejor, renombrar el campo del lado del backend a `message` para ser consistente con el resto del contrato en inglés, actualizando `enrollments.js` y `DATABASE_CONTEXT.md`. Confirmar con el usuario cuál dirección prefiere antes de tocar código.
2. **Corregir B2**: hacer que `GET /ngos/:id` y `GET /ngos/me` hagan el mismo JOIN que `GET /ngos` para traer `categoria_nombre`, mapearlo a `category` en `fmtNgo()`, y hacer que `PUT /ngos/me` acepte `categoria_id` y escriba/actualice `ngo_categorias`.
3. **Exigir `JWT_SECRET` sin fallback**: hacer que el servidor falle al arrancar si la variable no está definida en producción (`NODE_ENV=production`), en vez de usar un secreto hardcodeado.
4. **Agregar un componente `<ProtectedRoute>`** en el frontend para las rutas de `/ngo/*`, redirigiendo limpiamente si el rol no coincide.
5. **Resolver el N+1 de `NGODashboard`** agregando (o reutilizando) un endpoint que devuelva el conteo de inscripciones pendientes por proyecto en una sola llamada agregada.
6. **Extraer validaciones y blacklist compartidas** a un módulo único, aunque sea duplicado por build (p. ej. un archivo JSON de la blacklist consumido por ambos lados, o un paquete `shared/` en el monorepo).
7. **Decidir el destino de `donaciones`/`reuniones`**: implementarlas o quitarlas del esquema activo, para que la documentación y el código no sugieran una funcionalidad inexistente.
8. **Agregar tests mínimos de humo** (al menos: registro, login, crear proyecto, inscribirse, aprobar) antes de emprender cualquier refactor grande, dado que hoy no hay red de seguridad automática.
9. **Registrar o eliminar `OnboardingScreen.tsx`** según la intención real del equipo — evitar que quede código ambiguo en el repositorio.
10. **Antes de escalar a producción real**, revisar el plan de Render (expiración de DB a 90 días, sleep del backend) y evaluar un plan pago o alternativa de hosting.

## 13. Correcciones aplicadas (registro de cambios)

Alcance de esta ronda: solo los bugs críticos **B1** y **B2**. No se tocó nada más (sin refactors, sin renombrados, sin cambios de esquema).

### B1 — mensaje de inscripción
- **Decisión de nomenclatura:** se mantuvo la columna de base de datos `enrollments.mensaje` sin cambios (convención española del esquema), y se corrigió el **backend** para que hable `message` (inglés) hacia afuera, igual que ya hace con el resto de los campos (`titulo AS title`, etc.). No se tocó el frontend.
- **Archivo modificado:** `backend/src/routes/enrollments.js`
  - `POST /api/enrollments`: ahora destructura `message` de `req.body` (antes `mensaje`) e inserta ese valor en la columna `mensaje`.
  - `POST /api/enrollments`: la fila devuelta tras el insert ahora hace `SELECT ... mensaje AS message ...` en vez de `SELECT *`.
  - `GET /api/enrollments/my`: ahora selecciona explícitamente `e.mensaje AS message` (antes `SELECT e.*`, que devolvía `mensaje` sin traducir).
  - `GET /api/enrollments/project/:projectId`: mismo cambio — ahora la ONG puede ver el mensaje que escribió el voluntario al inscribirse (`NGOProjectDetail.tsx` línea 115, que ya leía `e.message`, pasa a recibir el dato real).
- **Verificación:** simulado con una base SQLite en memoria replicando el flujo completo (insert → lectura en `/my` → lectura en `/project/:id`); el mensaje se guarda y se lee correctamente en los tres puntos.
- **No se tocó** `PATCH /:id/horas` ni `PATCH /:id` (no devuelven el objeto `enrollment` completo al cliente, no estaban afectados).

### B2 — categoría de ONG
- **Archivo modificado:** `backend/src/routes/ngos.js`
  - `fmtNgo()`: ahora mapea `categoria_nombre → category` cuando la query lo incluye (no rompe las queries que no lo traen).
  - `GET /api/ngos/me`: se agregó el mismo `LEFT JOIN ngo_categorias / categorias` que ya usaba `GET /api/ngos`.
  - `GET /api/ngos/:id`: idem — ahora el perfil público de ONG también expone `category`.
  - `PUT /api/ngos/me`: ahora acepta `category` (nombre de categoría, tal como lo envía `NGOOwnProfile.tsx`), busca su `id` en `categorias`, y reemplaza la fila de `ngo_categorias` de esa ONG (borra la anterior e inserta la nueva — una ONG tiene una única categoría principal en la UI actual). Si el nombre no matchea ninguna categoría existente, no falla: simplemente no actualiza la categoría (evita romper el guardado del resto del perfil por un typo).
  - La respuesta de `PUT /api/ngos/me` ahora vuelve a leer la ONG con el JOIN incluido, para que el frontend reciba la categoría actualizada sin necesidad de un segundo fetch.
- **Verificación:** simulado con SQLite en memoria — se confirmó que la categoría se persiste, se lee de vuelta en `GET /me`, `GET /:id` y en la respuesta del propio `PUT /me`, y que cambiar de categoría reemplaza (no acumula) la fila en `ngo_categorias`.
- **No se tocó** `GET /api/ngos/:id/dashboard` (usa `SELECT * FROM ngos WHERE id=...` sin JOIN) porque esa respuesta no se usa para mostrar/editar la categoría en ninguna pantalla actual (`NGODashboard.tsx` no la muestra) — se deja fuera de alcance para no tocar más de lo pedido, pero queda anotado por si en el futuro se necesita ahí también.

### Pendiente de decisión
- No se decidió (ni se tocó) si conviene además renombrar la columna `mensaje` a `message` en el propio esquema (`migrate.js`) para unificar del todo la convención — se optó por el cambio mínimo que no toca la base de datos ni el frontend.

### B5 — creación/edición de proyecto rechazada por "cupos"
- **Cómo se detectó:** reportado por el usuario al crear un voluntariado — `POST /api/projects` devolvía `400 {"error":"Los cupos deben ser un número positivo"}` con cualquier valor válido en el formulario.
- **Causa raíz:** `CreateVoluntariado.tsx` envía el campo como `volunteers_needed` (consistente con **todos** los demás campos de este endpoint, que ya viajan en inglés: `title`, `description`, `location`, `type`, `duration`, `hours_per_week`, `funding_goal`, `cost_per_person`...). Pero `validateProject()`, `POST /api/projects` y `PUT /api/projects/:id` en el backend seguían destructurando `cupos` (español) de `req.body` — a diferencia del resto del proyecto, donde la traducción español↔inglés ocurre en la *respuesta* (`fmt()`), no en el *body* de entrada de este endpoint en particular. `cupos` llegaba siempre `undefined`, la validación fallaba siempre, y **nunca se pudo crear ni editar un proyecto desde la UI**, sin importar los datos ingresados.
- **Archivo modificado:** `backend/src/routes/projects.js`
  - `validateProject()`: ahora recibe y valida `volunteers_needed` en vez de `cupos`.
  - `POST /api/projects`: ahora destructura `volunteers_needed` de `req.body` y lo usa tanto en la validación como en el `INSERT` (la columna de la base de datos sigue llamándose `cupos`, sin cambios de esquema).
  - `PUT /api/projects/:id`: mismo cambio — destructura `volunteers_needed` en vez de `cupos`.
  - No se tocó nada del lado del frontend (el campo que envía ya era el correcto) ni la base de datos.
- **Verificación:** simulado con SQLite en memoria replicando el payload exacto que arma `CreateVoluntariado.tsx` (incluyendo `volunteers_needed: 15`) a través de `validateProject`, el `INSERT` y un `UPDATE` posterior — la validación pasa, el proyecto se guarda con `cupos=15`, y la edición actualiza correctamente a `cupos=20`.
- **Severidad:** esta era la más grave de las tres corregidas hasta ahora — bloqueaba por completo la funcionalidad central del rol ONG (publicar proyectos), no solo un campo secundario.

## 14. Feature: KPIs de impacto (roadmap — primera entrega)

**Contexto:** se pidió como prioridad media del roadmap, con la nota "backend existe, falta UI". Al analizar el código, se encontró que **la UI de gestión ya estaba completamente construida** (`NGOKPIs.tsx`, CRUD completo con formulario) y el backend también (`GET/POST/PUT/DELETE /api/projects/:id/kpis`, ya documentados en `API_CONTEXT.md` desde el análisis inicial). Lo que realmente faltaba era **el punto de entrada de navegación**: no había ningún botón o link en la app que llevara a `/ngo/kpis/:projectId`. Señal reveladora: `NGOProjectDetail.tsx` ya importaba el ícono `BarChart2` de `lucide-react` pero nunca lo usaba — quedó a medio hacer.

**Cambios realizados:**
- `frontend/src/lib/api.ts`: se agregó `api.projects.kpis.{list, create, update, delete}`, siguiendo el mismo patrón que el resto del cliente HTTP.
- `frontend/src/app/components/NGOKPIs.tsx`: migrado de `fetch()` directo (con headers y token armados a mano) a `api.projects.kpis.*` y `api.projects.get()`. De paso resuelve el ítem de deuda técnica "componentes que evitan `api.ts`" para este archivo (queda pendiente solo `NGOEmpleados.tsx`).
- `frontend/src/app/components/NGOProjectDetail.tsx`: se agregó un botón "KPIs" en el header (usando el `BarChart2` que ya estaba importado) que navega a `/ngo/kpis/${projectId}`. Es el único punto de entrada nuevo — no se agregó un segundo acceso desde `NGODashboard.tsx` para no duplicar navegación; el flujo queda Dashboard → Detalle de proyecto → KPIs (2 clics).

**No se tocó nada del backend** — los endpoints y el esquema (tabla `kpis`) ya estaban completos y correctos desde el análisis inicial.

**Verificación:**
- `npm run build` (Vite) corrido sobre el frontend real: los 1634 módulos, incluidos los 3 archivos tocados, transforman sin errores de TypeScript/JSX.
- Se comparó campo por campo el body que arma `NGOKPIs.tsx` (`{ nombre, descripcion, valor, tipo_valor, unidad, fecha }`) contra lo que destructura cada endpoint en `backend/src/routes/projects.js` — coinciden exactamente, sin necesidad de tocar el backend.
- No se pudo levantar el backend real end-to-end en este entorno porque el binario nativo de `better-sqlite3` no tiene un prebuilt disponible para la versión de Node de este sandbox y no hay acceso a `nodejs.org` para compilarlo desde código fuente (limitación del entorno de análisis, no del proyecto — en tu máquina o en Render esto no debería pasar, ya que ahí `npm install` sí puede bajar el binario correcto). Te recomiendo correr `npm run dev` en ambos paquetes localmente y probar el flujo (Dashboard → proyecto → botón KPIs → alta/edición/borrado → volver a `/project/:id` como voluntario para confirmar que los KPIs se ven en la sección "Impacto del proyecto") antes de dar por cerrada esta feature.

## 15. Estado del roadmap (seguimiento)

Roadmap acordado con el usuario. Se actualiza a medida que se completa cada ítem — no arrancar un ítem "Pendiente" sin confirmar antes con el usuario si sigue vigente el orden.

| Prioridad | Feature | Requiere | Estado |
|---|---|---|---|
| Alta | Sistema de donaciones | Mercado Pago o Stripe (proveedor sin definir aún) | Pendiente — bloqueado hasta elegir proveedor |
| Alta | Sistema de alertas push | Service worker o email (sin definir aún) | ✅ **Hecho** (email vía Resend — ver §19). Falta que configures tu `RESEND_API_KEY` |
| Media | Sistema de chat | WebSockets (sin dependencias externas) | ✅ **Hecho** (ver §18) |
| Media | KPIs de impacto | Backend ya existía; faltaba el punto de entrada en la UI | ✅ **Hecho** (ver §14) |
| Media | Habilidades de voluntario | Tablas ya existían (`habilidades`, `voluntario_habilidades`); faltaban endpoints y UI | ✅ **Hecho** (ver §17) |
| Fuera del MVP | Algoritmo de recomendación | — | No planificado |
| Fuera del MVP | Chat bot | — | No planificado |
| Fuera del MVP | Feed multimedia | — | No planificado |

**Próximo paso sugerido:** Sistema de chat (WebSockets) — no depende de proveedores externos, se puede resolver sin decisiones pendientes.

| Fuera del MVP | Algoritmo de recomendación | Ninguna — basado en reglas con datos ya existentes | ✅ **Hecho** (ver §20) |
| Fuera del MVP | Chat bot | Tipo simple confirmado (FAQ sin IA) | Siguiente sugerido |
| Fuera del MVP | Feed multimedia | Cloudinary o S3 (sin definir aún) | Bloqueado hasta elegir proveedor |

**Estado actual:** de los 8 ítems totales del roadmap (5 originales + 3 "fuera del MVP"), quedan **Donaciones**, **Chat bot** y **Feed multimedia**. Donaciones y Feed multimedia están bloqueados por decisión de proveedor externo (Mercado Pago/Stripe, y Cloudinary/S3 respectivamente). Chat bot ya tiene tipo confirmado (FAQ simple, sin IA) — es el próximo candidato lógico por no tener bloqueos.

## 16. B6 — 500 en perfil público de ONG + `<a>` anidado en el feed

**Cómo se detectó:** reportado por el usuario al navegar el feed principal — dos síntomas en la consola del navegador:
1. Warning de React: `<a> cannot appear as a descendant of <a>` en `ProjectCard.tsx`.
2. `GET /api/ngos/ngo-1` y `GET /api/ngos/ngo-2` devolviendo `500 Internal Server Error`.

### Causa raíz del 500 (`GET /api/ngos/:id`)
La subquery que trae los proyectos de la ONG hace `LEFT JOIN` con `categorias` (para mostrar la categoría de cada proyecto) y seleccionaba `id` sin calificar con el alias de tabla. Como tanto `projects` como `categorias` tienen columna `id`, SQLite la rechaza como ambigua (`ambiguous column name: id`) y la query nunca llegaba a ejecutarse — de ahí el 500. **Este bug ya estaba en el código original**, no fue introducido por ninguno de los cambios anteriores; recién se manifestó ahora porque es la primera vez que se probó el backend corriendo de verdad (antes solo se había verificado por simulación SQL, que no incluía esta ruta en particular).

- **Archivo modificado:** `backend/src/routes/ngos.js` — la subquery de proyectos dentro de `GET /:id` ahora califica todas las columnas de `projects` con el alias `p.` (`p.id`, `p.titulo`, etc.), igual que ya hacía el resto de la query. También se agregó `console.error` al catch de esta ruta (antes tragaba el error en silencio, lo que dificultó el diagnóstico).
- **Cómo se verificó esta vez:** se detectó que la simulación en SQLite en memoria (usada en las correcciones anteriores) no era suficiente porque requería levantar el servidor real para reproducir errores de este tipo. Se instalaron las dependencias reales de ambos paquetes (`npm install`), y — dado que el binario nativo de `better-sqlite3` no compila en este entorno de análisis (sin prebuilt para esta versión de Node ni acceso a `nodejs.org` para compilar desde headers) — se sustituyó `better-sqlite3` por un shim local basado en `node:sqlite` que implementa la misma API (`new Database()`, `.pragma()`, `.prepare().run/get/all()`). Con eso se corrieron `migrate.js` y `seed.js` reales, se levantó `src/index.js` real, y se reprodujo el 500 exacto contra `/api/ngos/ngo-1`. Tras el fix, se repitió la prueba y devuelve `200` con el perfil completo y sus proyectos. También se probaron con el servidor real `GET /api/ngos/me` (categoría — bug B2) y `POST /api/projects` (cupos — bug B5), ambos funcionando correctamente. El shim y los `node_modules` de prueba se descartaron al terminar — no forman parte de la entrega.

### Causa raíz del warning de `<a>` anidado
`ProjectCard.tsx` envolvía toda la tarjeta en un `<Link to="/project/:id">` (que renderiza `<a>`), y adentro tenía un segundo `<Link to="/ngo/:id">` para el logo/nombre de la ONG — un `<a>` dentro de otro `<a>`, HTML inválido (y con comportamiento de click inconsistente entre navegadores).

- **Archivo modificado:** `frontend/src/app/components/ProjectCard.tsx` — el contenedor externo pasó de `<Link>` a un `<div onClick={...} role="link" tabIndex={0} onKeyDown={...}>` que navega con `useNavigate()`, manteniendo accesibilidad por teclado (Enter/Espacio). El `Link` interno hacia el perfil de la ONG se dejó igual (ya tenía `stopPropagation` en su `onClick`, así que sigue sin disparar la navegación del contenedor).
- **Se revisó el resto del proyecto** buscando el mismo patrón (`Link` anidado dentro de otro `Link`) — no se encontró ningún otro caso; los demás archivos con múltiples `<Link>` los usan en ramas condicionales o listas separadas, no anidados.
- **Verificación:** `npm run build` (Vite) real sobre el frontend, con este archivo modificado — compila sin errores de TypeScript/JSX.

## 17. Feature: Habilidades de voluntario (roadmap — segunda entrega)

**Contexto:** roadmap acordado con el usuario (ver §15). Las tablas `habilidades` (catálogo) y `voluntario_habilidades` (N:M con nivel) ya existían en el esquema desde el análisis inicial, y el catálogo de solo lectura (`GET /api/habilidades`) ya existía. Faltaba: (1) endpoints para que un voluntario gestione sus propias habilidades, y (2) la UI en el perfil del voluntario.

### Backend
- **Archivo nuevo:** `backend/src/routes/voluntarios.js`, montado en `src/index.js` como `/api/voluntarios` (mismo patrón que los demás archivos de ruta por entidad).
  - `GET /api/voluntarios/me/habilidades` — Auth, rol `volunteer` — devuelve las habilidades del usuario con su nivel, vía `JOIN` a `habilidades`.
  - `PUT /api/voluntarios/me/habilidades` — Auth, rol `volunteer` — reemplaza el conjunto completo (`{ habilidades: [{ habilidad_id, nivel }] }`), mismo patrón de "borrar e insertar de nuevo" que ya se usó para la categoría de ONG (bug B2). Valida que cada `habilidad_id` exista en el catálogo, que el `nivel` sea uno de `basico`/`intermedio`/`avanzado`, y limita a 20 habilidades por voluntario.
- Documentado en `API_CONTEXT.md` (nueva sección "Voluntarios") y `DATABASE_CONTEXT.md` (la tabla `voluntario_habilidades` ya no queda "sin API").

### Frontend
- `frontend/src/lib/api.ts`: se agregó `api.voluntarios.habilidades.{list, update}` y `api.catalog.habilidades()` (primer uso del catálogo de habilidades desde el frontend — antes solo existía el endpoint, sin cliente).
- `frontend/src/app/components/VolunteerProfile.tsx`: dentro del formulario de edición se agregó un selector de habilidades (chips toggle desde el catálogo) con un nivel editable por cada una seleccionada, y una vista de solo lectura fuera del modo edición. Se guarda junto con el resto del perfil al tocar "Guardar cambios".

### Bugs encontrados en el camino (no relacionados con habilidades, pero bloqueaban el flujo)

Al conectar el guardado de habilidades al botón "Guardar cambios" del perfil, se encontraron dos bugs preexistentes que impedían que ese botón funcionara en absoluto:

- **B7:** `VolunteerProfile.tsx` ya llamaba a `api.auth.updateMe(...)` antes de que yo tocara el archivo, pero ese método nunca existió en `api.ts` — solo estaban `register`, `login`, `me`. Guardar el perfil de un voluntario tiraba un `TypeError: api.auth.updateMe is not a function` en el navegador, sin llegar a pegarle al backend. Se agregó el método faltante en `api.ts`, mapeado a `PUT /api/auth/me` (que sí existe en el backend desde el análisis inicial).
- **B8:** una vez arreglado B7, `PUT /api/auth/me` devolvía `500` cada vez que se omitía un campo opcional (típicamente `avatar`, que `VolunteerProfile.tsx` nunca envía). La causa: el valor `undefined` se pasaba directo como parámetro bindeado a SQLite, que lo rechaza explícitamente (`Provided value cannot be bound to SQLite parameter`). El primer intento de fix (`campo ?? null`) se descartó porque hubiera *borrado* el avatar del usuario cada vez que guardara el perfil sin volver a enviarlo — en cambio, se reescribió el endpoint para hacer una actualización parcial real: lee la fila actual primero, y cualquier campo no enviado conserva su valor anterior en vez de pisarse con `null`.

### Verificación
- `npm run build` (Vite) real sobre el frontend con los 3 archivos tocados (`api.ts`, `VolunteerProfile.tsx`) — compila sin errores.
- Se instalaron las dependencias reales de ambos paquetes y se levantó el backend real (con el mismo shim de `node:sqlite` usado en la corrección de B6, por la misma limitación de entorno) contra una base migrada y sembrada de verdad. Se probó el flujo completo por HTTP:
  - `GET /api/habilidades` (catálogo) → `200`.
  - `GET /api/voluntarios/me/habilidades` recién logueado → `200` con `[]` (vacío, como se espera).
  - `PUT /api/voluntarios/me/habilidades` con 2 habilidades → `200`, guardadas con su nivel.
  - Repetir `PUT` con solo 1 habilidad → reemplaza correctamente, no acumula la anterior.
  - `PUT` con un `habilidad_id` inexistente → `400` con el mensaje esperado.
  - `PUT` con un `nivel` inválido (`"experto"`) → `400`.
  - Mismo `GET` con una sesión de rol `ngo` → `403 "Requiere rol: volunteer"` (guarda de rol funcionando).
  - `PUT /api/auth/me` sin mandar `avatar` → `200`, y se confirmó que el avatar original **no se pierde** (query directa mostrando el mismo valor antes y después).
- Se apagó el servidor y se descartaron el shim y los `node_modules` de prueba al terminar — no forman parte de la entrega.

**Próximo paso sugerido:** Sistema de chat (WebSockets) — es el siguiente ítem de prioridad media que no depende de un proveedor externo, y ya lo tenías anotado como no bloqueado.

## 18. Feature: Chat 1 a 1 con WebSockets (roadmap — tercera entrega)

**Contexto:** roadmap acordado con el usuario (ver §15), pedido explícitamente "1 a 1, básico". No requiere proveedor externo — se implementó con la librería `ws` (liviana, sin un segundo sistema de autenticación: reusa el mismo JWT que ya usa el resto de la API).

### Backend
- **Tabla nueva `messages`** en `migrate.js` (`id, sender_id, receiver_id, body, read, created_at`), con 3 índices (`sender_id`, `receiver_id`, `created_at`). Mismo patrón que `notifications`.
- **`backend/src/ws/index.js`** (nuevo) — servidor de WebSocket colgado del mismo servidor HTTP que Express, en el path `/ws` (no un puerto aparte). Autenticación: el cliente se conecta a `ws://host/ws?token=<jwt>`, el servidor verifica el JWT con `jsonwebtoken.verify` antes de aceptar la conexión — si el token es inválido, cierra con código `4001`. Mantiene un `Map<userId, Set<WebSocket>>` en memoria (un usuario puede tener varias pestañas/dispositivos conectados a la vez) y expone `sendToUser(userId, payload)` para empujar mensajes en tiempo real.
- **`backend/src/routes/messages.js`** (nuevo) — REST: `GET /conversations` (lista de conversaciones con último mensaje y contador de no leídos), `GET /thread/:userId` (historial, últimos 300 mensajes), `POST /` (enviar — persiste siempre en la base, y si el destinatario está conectado por WS se lo empuja en tiempo real), `PATCH /thread/:userId/read` (marcar como leídos). La función de inserción (`insertMessage`) está compartida entre el endpoint REST y el listener de WebSocket, para no duplicar la validación.
- `src/index.js`: pasó de `app.listen(...)` a `http.createServer(app)` + `initWebSocket(server)`, para que Express y el WebSocket compartan el mismo puerto.
- Se agregó `ws` a `package.json`.

### Frontend
- **`lib/ChatContext.tsx`** (nuevo) — Context montado en `main.tsx` (dentro de `AuthProvider`): abre la conexión WS al loguearse (se cierra al desloguearse), mantiene la lista de conversaciones y el contador total de no leídos, y expone `onMessage()` (suscripción a mensajes entrantes) y `sendViaSocket()` (intenta mandar por el socket abierto; si no hay conexión, el componente que llama cae a REST).
- **`MessagesScreen.tsx`** (nuevo) — lista de conversaciones, compartida entre voluntario y ONG (el mismo componente, dos rutas: `/messages` y `/ngo/messages`).
- **`ChatThread.tsx`** (nuevo) — el hilo de una conversación puntual (`/messages/:userId` y `/ngo/messages/:userId`), con historial, envío (WS con fallback a REST) y marcado automático de leído al abrir.
- **Navegación:** se agregó el ítem "Mensajes" con badge de no leídos en las 4 navegaciones existentes (`BottomNav`, sidebar de voluntario en `Root.tsx`, `NGOBottomNav`, `NGOSidebarNav`).
- **Puntos de entrada para iniciar una conversación** (antes no había ninguno, porque la feature no existía): botón "Mensaje" en `NGOPublicProfile.tsx` (un voluntario logueado le escribe a la ONG) y un botón por cada inscripto en `NGOProjectDetail.tsx` (la ONG le escribe a un voluntario puntual).

### Bug encontrado en el camino: B9 — placeholders `$N` repetidos en el adaptador SQLite

Al construir la query del historial (`GET /messages/thread/:userId`), que necesita matchear mensajes en cualquiera de los dos sentidos (`WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)`), se detectó que **la conversación aparecía vacía** aunque los mensajes sí se habían guardado bien en la base.

- **Causa raíz:** `backend/src/db/index.js`, en la rama SQLite, traducía cada aparición de `$N` a `?` con una regex simple (`sql.replace(/\$\d+/g, '?')`), sin agrupar por número de parámetro. Postgres permite reusar `$1` más de una vez en la misma query (siempre referencia el mismo valor bindeado); SQLite con `?` posicional, en cambio, necesita **un valor por cada aparición**, no uno por cada número único. Como la query de arriba usa `$1` dos veces y `$2` dos veces, terminaba con 4 signos `?` pero solo 2 parámetros en el array — y esto no explota con un error, simplemente no matchea ninguna fila. Esto es un bug **transversal**, no específico del chat: cualquier query futura (o alguna ya existente que no se haya notado todavía) que reutilice un `$N` tiene el mismo problema contra SQLite, aunque funcione perfecto contra Postgres (por eso nunca se había detectado: el desarrollo local usa SQLite, pero conceptualmente el bug también podría esconder diferencias de comportamiento entre ambos motores en producción vs. local).
- **Fix:** se separó la traducción en dos pasos. `translatePg()` ahora solo traduce sintaxis (timestamps, `ILIKE`, `ON CONFLICT`), y una función nueva, `remapParams(sql, params)`, reemplaza cada `$N` por `?` **registrando a qué índice de parámetro apunta cada aparición**, y devuelve un array de parámetros reordenado/duplicado según corresponda (`params[N-1]` por cada `?`, en el orden en que aparecen). Los 4 métodos del adaptador (`query`, `run`, `get`, `all`) se actualizaron para usar este remapeo antes de bindear.
- **Por qué se corrigió en el adaptador y no en la query:** se podría haber evitado reusando cada parámetro con un valor distinto por posición (escribir `$1,$2,$3,$4` en vez de reusar `$1,$2`), pero eso hubiera dejado el bug latente para la próxima query que reutilizara un placeholder — y Postgres soporta reuso de `$N` perfectamente bien, así que "no reusar placeholders" no es una regla real de SQL, es una limitación de esta traducción particular. Corregir el adaptador arregla el problema de raíz para todo el proyecto, no solo para el chat.
- **Verificación de que no rompió nada:** después del fix se re-ejecutó, contra el mismo servidor real, la batería completa de pruebas de las features anteriores (feed, perfil público de ONG con categoría — B6, creación de proyecto con cupos — B5, habilidades de voluntario, `PUT /auth/me` — B8) — todas siguen devolviendo los códigos y datos esperados.

### Verificación de la feature de chat
Con el servidor real corriendo (mismo shim de `node:sqlite` de las veces anteriores, por la limitación de este entorno de análisis para compilar `better-sqlite3`):
- Flujo REST completo: `POST /messages` (ida y vuelta entre dos usuarios) → `GET /conversations` (con el último mensaje, quién lo mandó, y el contador de no leídos correcto) → `GET /thread/:userId` (los dos mensajes en orden cronológico) → `PATCH /thread/:userId/read` → `GET /conversations` de nuevo (no leídos vuelve a 0).
- WebSocket real, con dos conexiones simultáneas autenticadas (una por cada usuario): un mensaje mandado por WS desde un cliente **llega en tiempo real** al otro cliente conectado, y además queda persistido en la base (confirmado con una consulta REST posterior).
- Conexión de WebSocket con un token inválido: se cierra inmediatamente con el código `4001`, sin quedar autenticada.
- `npm run build` (Vite) real sobre el frontend, con los 8 archivos nuevos/tocados — compila sin errores (1637 módulos).

**Nota de escala (no es un bug, es una limitación de diseño aceptable para "básico"):** el registro de conexiones de WebSocket es un `Map` en memoria de un solo proceso — si el backend corre en más de una instancia (por ejemplo, escalado horizontal en producción), dos usuarios conectados a instancias distintas no se verían los mensajes en tiempo real entre sí (aunque el mensaje igual quedaría guardado y aparecería al recargar). Para ese escenario haría falta un backplane compartido (ej. Redis pub/sub) — fuera de alcance para esta entrega "básica".

**Próximo paso sugerido:** de los ítems del roadmap, quedan Donaciones y Alertas, ambos bloqueados hasta que definas proveedor (Mercado Pago/Stripe) y canal (push/email) respectivamente.

## 19. Feature: Alertas por email con Resend (roadmap — cuarta entrega)

**Contexto:** roadmap acordado con el usuario (ver §15). De las dos opciones de canal (push o email), se recomendó email por ser sensiblemente más simple (sin service worker, sin flujo de permisos del navegador, sin claves VAPID) y se confirmó Resend como proveedor.

### Backend
- **`backend/src/lib/email.js`** (nuevo) — cliente mínimo de Resend usando `fetch` nativo (Node 18+), sin agregar el SDK oficial como dependencia (evita una librería extra para un solo POST). `sendEmail({to, subject, html})` nunca lanza excepción: si falta `RESEND_API_KEY`, loguea un warning y devuelve `{ok:false, skipped:true}` sin romper el flujo que lo llama — mismo criterio *fire-and-forget* que ya usan las notificaciones in-app (`.catch(() => {})`).
- **`backend/src/lib/emailTemplates.js`** (nuevo) — 3 plantillas HTML simples: `newEnrollmentEmail` (a la ONG, cuando un voluntario se inscribe), `enrollmentApprovedEmail` y `enrollmentRejectedEmail` (al voluntario, cuando la ONG resuelve la inscripción). Cada una devuelve `{subject, html}` con un link de vuelta a la app (`APP_URL` + la ruta correspondiente).
- **`backend/src/routes/enrollments.js`**: se agregó el envío de email en los dos puntos donde ya se creaba una notificación in-app (`POST /` y `PATCH /:id`), expandiendo las queries existentes para traer el email/nombre necesario (email de la ONG en el primer caso, email del voluntario en el segundo) — no se tocó la lógica de negocio de inscripciones/aprobación, solo se agregó el side-effect de email al lado del de notificación.
- **Variables de entorno nuevas** (documentadas en `.env.example`): `RESEND_API_KEY` (sin ella, el envío se omite — no rompe nada), `EMAIL_FROM` (default: el dominio de pruebas de Resend, que funciona sin verificar nada propio pero solo deja mandarle al email con el que te registraste en Resend), `APP_URL` (para armar los links de "Ver solicitud" / "Ver mis participaciones" dentro del email).

### Qué falta para que mande emails de verdad
Esto **no se puede activar ni probar desde este entorno de análisis** — no tengo acceso de red a `api.resend.com` (fuera de la lista de dominios permitidos del sandbox) ni puedo crear una cuenta en tu nombre. Para activarlo:
1. Crear una cuenta gratis en [resend.com](https://resend.com).
2. Generar una API key en su dashboard.
3. Pegarla en `RESEND_API_KEY` (backend, `.env` o las variables de entorno de Render).
4. Mientras uses el dominio de pruebas (`onboarding@resend.dev`), Resend **solo te deja mandar al email con el que te registraste** — para mandarle a cualquier voluntario/ONG real hace falta verificar un dominio propio en el panel de Resend y usar un `EMAIL_FROM` de ese dominio.

### Verificación
No pudiendo probar el envío real, se verificó todo lo que sí depende del código del proyecto:
- **Regresión con servidor real, sin `RESEND_API_KEY` configurada** (el estado por defecto tras clonar el repo): se corrió el flujo completo de inscripción + aprobación contra un backend real — ambos endpoints devuelven los códigos esperados (`201`, `200`) exactamente igual que antes de esta feature, y en el log del servidor aparecen los warnings de "omitiendo envío" en vez de cualquier error. **El envío de email nunca bloquea ni rompe el flujo principal**, con o sin la API key configurada.
- **Payload exacto hacia Resend:** se interceptó `fetch` (sin salir a la red) con una API key falsa para capturar el request que arma `sendEmail()` — se confirmó URL (`https://api.resend.com/emails`), método (`POST`), header `Authorization: Bearer <key>`, y que `from`/`to`/`subject`/`html` se arman correctamente con los datos reales de la inscripción (nombre del voluntario, título del proyecto, nombre de la ONG, y el link correcto según el template).
- **Manejo de errores:** se simuló una respuesta de Resend con `401` (API key inválida) y un fallo de red — en ambos casos `sendEmail()` devuelve `{ok:false, error:...}` sin lanzar excepción, así que nunca puede tumbar un endpoint que lo llama.

**Próximo paso sugerido:** Sistema de donaciones — el último ítem del roadmap, bloqueado hasta que elijas Mercado Pago o Stripe.

## 20. Feature: Algoritmo de recomendación (roadmap — quinta entrega, fuera del MVP original)

**Contexto:** el usuario pidió avanzar con los 3 ítems que originalmente estaban listados "fuera del MVP" (algoritmo de recomendación, chat bot, feed multimedia). De los tres, el algoritmo de recomendación es el único sin dependencias externas — se implementó primero.

### Diseño (basado en reglas, sin ML/IA)

Nuevo endpoint `GET /api/projects/recommended` (Auth, rol `volunteer`). Señales usadas, todas ya presentes en el esquema:

| Señal | Peso | Cuándo aplica |
|---|---|---|
| Afinidad de categoría (cuántos proyectos ya inscriptos comparten categoría con el candidato) | ×3 por cada coincidencia | Solo si el voluntario tiene historial de inscripciones |
| Ubicación (coincide con `users.location` del perfil) | +2 | Si el voluntario cargó una ubicación |
| Publicado hace menos de 7 días | +1 (con historial) / +2 (sin historial, cold start) | Siempre |
| Quedan ≤3 cupos | +1 | Siempre |

Cada recomendación devuelve además `recommendation_reasons: string[]` — motivos en texto plano ("Coincide con tu interés en...", "Cerca tuyo, en...") para que la razón sea transparente en la UI, no una caja negra.

**Por qué reglas y no un modelo:** con el volumen de datos de esta plataforma (decenas/cientos de proyectos, no millones), un scoring explicable determinístico da resultados igual de buenos que un modelo entrenado, sin necesitar dataset de entrenamiento, sin coste de inferencia, y siendo trivial de depurar/ajustar. Se deja como posible mejora futura si el volumen de datos creciera mucho.

**Por qué el ranking se calcula en JS y no en SQL:** expresar el scoring completo en una sola query SQL portable entre SQLite y Postgres hubiera sido frágil (mismo tipo de riesgo que ya causó el bug B9 con los placeholders repetidos). En cambio, se trae un pool acotado de candidatos (100 proyectos activos con cupo, más recientes primero) con una query simple, y el scoring/orden se hace en JavaScript — más fácil de leer, de testear, y funciona idéntico en ambos motores sin bifurcar código.

### Backend
- `backend/src/routes/projects.js`: nuevo handler `GET /recommended`, **registrado antes de `GET /:id`** (crítico: si estuviera después, Express interpretaría `recommended` como el parámetro `:id` y esta ruta nunca se alcanzaría — se dejó un comentario explícito en el código para que nadie mueva el orden sin darse cuenta).

### Frontend
- `lib/api.ts`: `api.projects.recommended(limit)`, y los campos opcionales `recommendation_score`/`recommendation_reasons` agregados al tipo `Project`.
- `MainFeed.tsx`: tira horizontal "✨ Recomendados para vos" arriba del grid principal, visible solo para rol `volunteer` y solo en la vista sin filtros activos (para no competir visualmente con una búsqueda o filtro de categoría que el usuario ya eligió). Reutiliza `ProjectCard` sin modificarlo, con el primer motivo de la recomendación como texto debajo de cada tarjeta.

### Bug encontrado en el camino: inconsistencia `users.location` vs `voluntarios.ubicacion`

Al implementar la señal de "ubicación", se detectó que el esquema tiene **dos columnas de ubicación de voluntario en tablas distintas**: `users.location` y `voluntarios.ubicacion`. Solo la primera está conectada a un endpoint que la actualiza (`PUT /api/auth/me`, que es lo que usa `VolunteerProfile.tsx`) — `voluntarios.ubicacion` no tiene ningún endpoint que la escriba desde la app (más allá de lo que haya puesto `seed.js` como dato de demo), así que en la práctica queda desactualizada/vacía para cualquier usuario real. El primer intento de esta feature leía la columna equivocada (`voluntarios.ubicacion`) y el match de ubicación nunca activaba aunque el usuario hubiera cargado su ubicación en el perfil — se corrigió para leer `users.location`. **No se tocó** el resto de la app ni se decidió qué hacer con la columna `voluntarios.ubicacion` (¿eliminarla? ¿usarla para algo distinto a la ubicación de contacto, como una segunda dirección?) — queda anotado como deuda técnica menor, fuera de alcance de esta tarea.

### Verificación (servidor real)
- **Orden de rutas:** confirmado que `GET /api/projects/recommended` no choca con `GET /api/projects/:id` — responde con las recomendaciones, no con un "proyecto no encontrado".
- **Guardas:** sin token → `401`; con rol `ngo` → `403 "Requiere rol: volunteer"`.
- **Cold start:** un voluntario recién registrado (sin ninguna inscripción) recibe `based_on_history: false` y recomendaciones basadas solo en novedad/urgencia, sin ninguna razón de "categoría" (coherente, porque no hay historial del cual inferir intereses).
- **Con historial:** un voluntario con inscripciones reales (datos de seed) recibe `based_on_history: true`, con las categorías de sus proyectos ya inscriptos pesando en el score de los candidatos.
- **Exclusión:** se confirmó explícitamente que ningún proyecto en el que el voluntario ya está inscripto (en cualquier estado) aparece en sus recomendaciones.
- **Ubicación:** tras corregir el bug de la columna, setear la ubicación del perfil y volver a pedir recomendaciones hizo subir el score del proyecto en esa misma ubicación (de 4 a 6) y agregó el motivo correspondiente.
- `npm run build` (Vite) real sobre el frontend — compila sin errores.

**Próximo paso sugerido:** Chat bot simple (preguntas frecuentes con respuestas fijas, sin IA) — el usuario ya confirmó este tipo. Feed multimedia sigue bloqueado hasta que elija Cloudinary o S3.

## 21. Auditoría de errores y optimización (a pedido del usuario)

Pasada completa buscando bugs no detectados hasta ahora y oportunidades de optimización, sin agregar features nuevas. Se corrigieron 4 problemas de rendimiento y 1 de seguridad menor; se documentó (sin corregir) 1 inconsistencia de diseño que requiere una decisión del usuario.

### Optimización 1 — N+1 en `GET /api/messages/conversations`

**Antes:** por cada conversación del usuario, 3 queries adicionales (datos del otro usuario, último mensaje, conteo de no leídos) → `1 + 3N` queries totales. Con 20 conversaciones, 61 queries en un solo request.

**Ahora:** 3 queries fijas sin importar cuántas conversaciones tenga el usuario — los ids de las contrapartes, sus datos de usuario en un solo `IN (...)`, y **todos** los mensajes de esas conversaciones en un solo `SELECT` (con `sender_id`/`receiver_id` reutilizados dos veces en el `WHERE`, aprovechando el fix del adaptador de la sección §18/B9). El "último mensaje por conversación" y el conteo de no leídos se calculan agregando en JS sobre esa única lista, en vez de con más queries.

**Archivo:** `backend/src/routes/messages.js`.

### Optimización 2 — N+1 en `GET /api/projects` (rama SQLite)

Este ya estaba documentado como deuda técnica desde el análisis inicial (`BACKEND_CONTEXT.md §10.6`), sin corregir hasta ahora. **Antes:** por cada proyecto de la página (hasta 20 con el límite default), 3 queries adicionales (roles, requisitos, categoría) → hasta 61 queries para cargar el feed principal, el endpoint más golpeado de toda la app.

**Ahora:** mismo patrón que la optimización 1 — 3 queries `IN (...)` fijas (roles, requisitos, categorías de *todos* los proyectos de la página a la vez) más la query principal, sin importar el tamaño de la página. La rama Postgres (que ya resolvía esto con `json_agg` en una sola query) no se tocó.

**Archivo:** `backend/src/routes/projects.js`, handler `GET /`.

### Optimización 3 — N+1 a nivel HTTP en `NGODashboard.tsx`

También documentado desde el análisis inicial. **Antes:** el frontend cargaba `api.ngos.me()` y después hacía **una llamada HTTP por cada proyecto** (`api.enrollments.byProject(proj.id)`) para armar la lista de solicitudes pendientes — N+1, pero a nivel de red, no de base de datos (más lento todavía que un N+1 de SQL).

**Ahora:** `GET /api/ngos/me` devuelve directamente `pending_enrollments` (con nombre, email, avatar del voluntario y título del proyecto ya resueltos vía JOIN) en la misma respuesta que ya traía `ngo`/`projects`/`stats`. El frontend pasó de `1 + N` llamadas HTTP a **1 sola**. De paso, esto también reemplaza el `pendingCount` (solo un número) que traía antes `GET /ngos/me` por la lista completa, evitando la duplicación con `GET /ngos/:id/dashboard` (que sí traía la lista completa, pero el frontend nunca la usaba).

**Archivos:** `backend/src/routes/ngos.js` (`GET /me`), `frontend/src/lib/api.ts` (tipo de retorno), `frontend/src/app/components/NGODashboard.tsx` (se borró el loop).

### Optimización 4 — Reconexión automática del WebSocket

**Antes:** si la conexión de WebSocket se cortaba por cualquier motivo (el server reinicia, un corte de red momentáneo, la laptop se suspende y despierta), `ChatContext` se quedaba con `connected: false` para siempre — el usuario dejaba de recibir mensajes en tiempo real hasta recargar la página a mano, sin ningún aviso.

**Ahora:** reconexión automática con backoff exponencial (1s, 2s, 4s, 8s, tope en 10s), reseteando el contador de intentos apenas la conexión vuelve a abrirse. Se distingue un cierre intencional (logout, desmontaje del componente) de uno inesperado con una bandera (`closedByEffect`), para no reconectar después de un logout real.

**Archivo:** `frontend/src/lib/ChatContext.tsx`.

### Corrección de seguridad menor — HTML sin escapar en los templates de email

Los templates de email (`newEnrollmentEmail`, `enrollmentApprovedEmail`, `enrollmentRejectedEmail`) insertaban `volunteerName`, `ngoName` y `projectTitle` directo en el HTML del email, sin escapar — y los tres son datos que carga el propio usuario (nombre al registrarse, título al crear un proyecto). El riesgo real es bajo (los clientes de correo no ejecutan `<script>`), pero alguien podía romper el layout del email o inyectar HTML/links arbitrarios poniendo, por ejemplo, `<img src=x onerror=...>` como nombre. Se agregó una función `esc()` mínima (reemplaza `& < > " '`) y se aplicó a los tres campos en los tres templates. Verificado con un nombre malicioso de prueba (`<script>alert(1)</script>Juan`) — el HTML resultante ya no contiene la etiqueta sin escapar.

**Archivo:** `backend/src/lib/emailTemplates.js`.

### Hallazgo documentado, NO corregido — `PATCH /api/enrollments/:id/horas`

Al auditar cada endpoint se encontró que este, a diferencia de lo que decía la documentación generada en el análisis inicial (`API_CONTEXT.md`, que afirmaba "role: ngo"), en realidad:
- No tiene `requireRole` — solo `requireAuth`.
- Filtra por `WHERE id=$1 AND user_id=$2` usando `req.user.id` — es decir, **solo el propio voluntario dueño de la inscripción puede llamarlo**, no la ONG.
- **Ningún componente del frontend lo usa** — ni del lado voluntario ni del lado ONG. Es funcionalidad de backend completa (validación incluida) pero completamente inalcanzable desde la app hoy.

Esto es una ambigüedad de diseño, no un bug con una corrección obvia — puede ser: (a) intencional, un auto-reporte de horas por parte del voluntario (como cuando una plataforma de voluntariado te deja cargar vos mismo cuánto ayudaste), al que solo le falta la UI; o (b) un bug real, donde la intención original era que la ONG cargue las horas (más común en este tipo de plataformas, porque es la ONG quien puede verificar que el voluntario efectivamente participó) y la autorización quedó mal escrita. **No se decidió ni se tocó** — se corrigió únicamente la documentación (`API_CONTEXT.md`) para que refleje lo que el código realmente hace, en vez de dejar una descripción incorrecta dando vueltas.

### Revisado y descartado (sin cambios)

- **Prepared statements sin cachear** en el adaptador SQLite (`db/index.js`): cada `db.query/run/get/all` llama a `sqlite.prepare()` de cero, sin cachear por texto de SQL. Es una optimización real pero de bajo impacto a esta escala (better-sqlite3 compila una sentencia en microsegundos), y cachear mal (sin límite de tamaño) podría generar una fuga de memoria nueva con las queries que arman su SQL dinámicamente (los `IN (...)` de esta misma auditoría, el listado de proyectos con filtros opcionales). Se decidió no tocarlo — más riesgo que beneficio para el volumen de datos de esta plataforma.
- **Índices en tablas intermedias N:M** (`project_categorias`, `project_roles`, `voluntario_habilidades`, etc.): no tienen un índice explícito además de la clave primaria compuesta, pero esa PK ya cubre eficientemente los lookups por la primera columna (`project_id`, `user_id`), que es como las consulta todo el código actual — no hace falta agregar nada.
- **XSS en el frontend:** se revisó que no exista ningún uso de `dangerouslySetInnerHTML` en toda la app — React escapa automáticamente todo el contenido de usuario (comentarios, mensajes de chat, nombres) en las interpolaciones `{}` normales. Sin riesgo.

### Verificación

Se repitió la regla de esta conversación: nada se da por probado sin correrlo. Con el servidor real (mismo shim de `node:sqlite`, misma limitación de entorno para compilar `better-sqlite3`):
- `GET /api/projects` con y sin filtro de categoría, en la rama SQLite — sigue devolviendo `roles_needed`/`requirements`/`category` poblados correctamente por proyecto, ahora con las queries batcheadas.
- `GET /api/ngos/me` — `pending_enrollments` viene con `volunteer_name`/`project_title` resueltos, y `stats.pending_enrollments` coincide con la longitud del array.
- `GET /api/messages/conversations` con 2 conversaciones simultáneas — cada una muestra su propio último mensaje correctamente (no se mezclan entre sí).
- Regresión completa de todo lo construido antes en esta conversación (recomendaciones, habilidades, creación de proyecto con cupos, categoría de ONG) — todo sigue funcionando, sin ningún error nuevo en el log del servidor.
- `npm run build` (Vite) real sobre el frontend — compila sin errores.
- Test unitario aislado de `emailTemplates.js` confirmando que el escape de HTML funciona contra un input malicioso.