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

## 22. Decisión: horas verificadas por la ONG (no auto-reporte del voluntario)

Siguiendo el hallazgo de §21, se decidió que `PATCH /api/enrollments/:id/horas` sea cargado por la **ONG dueña del proyecto**, no por el propio voluntario — es el patrón estándar en plataformas de voluntariado reales (las horas quedan *verificadas* por quien puede confirmar que la participación fue real, en vez de ser un auto-reporte sin control).

### Cambios
- **Backend** (`enrollments.js`): la ruta pasó de `requireAuth` + `WHERE user_id=req.user.id` a `requireAuth, requireRole('ngo')` + `WHERE p.ngo_id=<ngo del usuario>` (mismo patrón de autorización que el resto de los endpoints de gestión de inscripciones, como aprobar/rechazar). Las dos queries de lectura (`GET /my`, `GET /project/:projectId`) ahora exponen el campo como `hours_logged` (inglés, consistente con el resto del contrato) en vez de `horas_realizadas` crudo.
- **Frontend:**
  - `api.ts`: nuevo `api.enrollments.logHours(id, horas)`, y `hours_logged` agregado al tipo `Enrollment`.
  - `NGOProjectDetail.tsx`: cada inscripto aprobado ahora tiene un input + botón "Guardar" para cargar/editar sus horas.
  - `MyParticipation.tsx`: el voluntario ve sus horas ya verificadas ("X horas verificadas por la ONG") en modo solo lectura — no tiene forma de auto-cargarlas.

### Verificación (servidor real)
Se probaron los 4 casos relevantes de autorización: el voluntario ya no puede auto-reportar sus horas (`403`), la ONG dueña del proyecto sí puede (`200`), una ONG que no es dueña del proyecto no puede (`404`, mismo criterio de "no filtrar existencia" que el resto de la app), y el voluntario ve el valor cargado reflejado en su propio historial.

## 23. Tests automatizados

A pedido del usuario, se armó una suite de tests para todo lo construido en esta conversación — sin depender de frameworks pesados: `node:test` (incluido en Node desde la v18, cero dependencias nuevas) para el backend, y Vitest (la pareja natural de Vite, integración casi sin configuración) para el frontend.

### Backend — `node:test`

**Refactors previos, necesarios para poder testear (sin cambiar comportamiento):**
- `src/db/sqlTranslate.js` (nuevo): se extrajeron `translatePg`, `remapParams` e `isReadQuery` de adentro de `db/index.js` a su propio módulo puro, sin efectos secundarios — antes eran funciones privadas dentro del closure que abre la conexión a SQLite, imposibles de importar de forma aislada.
- `db/index.js` ahora soporta la variable de entorno `SQLITE_PATH` para apuntar a un archivo de base de datos distinto al de desarrollo (usada únicamente por los tests de integración).
- `src/routes/auth.js` y `src/routes/projects.js`: se exportaron `validateEmail`/`validateName`/`validatePassword` y `validateProject`/`hasBadWord` además del router (mismo patrón que ya existía en `messages.js` con `insertMessage`), para poder testear las validaciones sin tener que levantar todo el servidor.
- `src/index.js`: ahora exporta también `server` (además de `app`), y usa `process.env.PORT` tal como ya hacía — los tests lo fuerzan a `0` para levantar en un puerto libre asignado por el sistema operativo.

**Tests unitarios** (`test/unit/`, sin base de datos, milisegundos):
- `sqlTranslate.test.js` — 15 tests. El más importante: regresión explícita del bug B9 (placeholders `$N` reusados), con un test que arma la query exacta del historial de chat y confirma que genera la cantidad correcta de `?` y el array de parámetros correctamente alineado.
- `validators.test.js` — 22 tests. Regresión del bug B5 (`validateProject` rechazando por `volunteers_needed` faltante/inválido, aceptando el string numérico tal como llega desde un `<input>`), más cobertura de `validateEmail`/`validateName`/`validatePassword` y `hasBadWord`.
- `emailTemplates.test.js` — 7 tests. Regresión del fix de HTML sin escapar (§21): confirma que un nombre de voluntario, título de proyecto o nombre de ONG con `<script>`/`<img onerror=...>`/`<svg onload=...>` nunca aparece sin escapar en el HTML final.

**Tests de integración** (`test/integration/`, servidor real + SQLite temporal descartable):
- `helpers.js` — levanta el servidor Express real (con su WebSocket) contra un archivo SQLite temporal (`os.tmpdir()`), migrado desde cero para cada test file, nunca toca `backend/data/`. Se borra al terminar.
- `api.test.js` — 26 tests, HTTP real de punta a punta: registro/login (incluida la regla de que un email duplicado da `409`, no `400` — algo que corrigió mis propias expectativas de test, no el código), creación de proyecto (regresión B5), categoría de ONG persistiendo entre requests (regresión B2), mensaje de inscripción (regresión B1), aprobación con `cupos_ocupados` incrementando, el flujo nuevo de horas verificadas por la ONG (§22), recomendaciones con y sin historial, envío/lectura de mensajes de chat.

**Bug real encontrado por los tests, no por prueba manual:** al escribir el test de la categoría de ONG (regresión B2), un test que solo mandaba `{name, category}` (sin describir el resto de los campos del perfil) hizo explotar `PUT /api/ngos/me` con `500` — mismo bug de "parámetro `undefined` sin manejar" que B8 (`PUT /auth/me`), pero en un archivo distinto (`ngos.js`) que no se había tocado al arreglar B8. Se confirmó que **también afecta al formulario real de la app**: `NGOOwnProfile.tsx` nunca incluye `logo`/`cover_image`/`alias`/`founded` en su estado, así que esos campos siempre llegan `undefined` al backend — cualquier edición de perfil de ONG desde la UI real disparaba este mismo `500`. Se corrigió con el mismo patrón que B8 (leer la fila actual, conservar los campos no enviados en vez de pisarlos con `null`). Este hallazgo es la mejor demostración de por qué vale la pena tener tests: correr la app a mano con datos de seed no lo iba a mostrar porque el perfil de demo ya tenía todos los campos poblados de antes.

**Resultado:** 71/71 tests pasan (15 + 22 + 7 unitarios, 26 de integración + 1 health check).

**Cómo correrlos:** `cd backend && npm test` (usa `node --test`, que descubre automáticamente todo bajo `test/`).

**Limitación conocida de este entorno de análisis, no del proyecto:** todos los tests se verificaron corriendo de verdad, pero usando el mismo shim de `node:sqlite` de toda esta conversación (por la falta de un build de `better-sqlite3` disponible para la versión de Node de este sandbox). En tu máquina, con `npm install` normal, van a correr contra el `better-sqlite3` real — el comportamiento de SQLite que están verificando (bind de parámetros, placeholders repetidos, etc.) es idéntico en ambos, así que no hay razón para esperar resultados distintos.

### Frontend — Vitest + Testing Library

**Setup nuevo:**
- `vite.config.ts`: bloque `test` agregado (reutiliza los mismos alias y plugins que ya tenía la config de Vite — no hay archivo de configuración duplicado).
- `src/test/setup.ts`: habilita los matchers de `@testing-library/jest-dom` (`toBeInTheDocument()`, etc.) en todos los tests.
- Nuevas dependencias de desarrollo: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. Ninguna se agrega al bundle de producción (son todas `devDependencies`).

**Refactor previo, necesario para poder testear:** `timeAgo` (antes definida inline y duplicada de hecho entre `MessagesScreen.tsx`) y `formatTime` (`ChatThread.tsx`) se extrajeron a `src/lib/format.ts` — mismo patrón que las extracciones del backend. Los dos componentes ahora importan desde ahí en vez de tener su propia copia.

**Tests:**
- `src/lib/format.test.ts` — 7 tests para `timeAgo`/`formatTime`, con el reloj del sistema fijado (`vi.useFakeTimers`) para que sean deterministas sin importar cuándo se corran.
- `src/app/components/ProjectCard.test.tsx` — 3 tests de humo sobre el componente más reutilizado de la app: se renderiza con datos mínimos envuelto en `<AuthProvider>` + `<MemoryRouter>` (las dos dependencias de contexto que necesita), confirma que muestra el título/ubicación/progreso de voluntarios, y que no explota si faltan campos opcionales.

**Resultado:** 10/10 tests pasan. `npm run build` (Vite) sigue compilando sin errores después de la extracción de utilidades.

**Cómo correrlos:** `cd frontend && npm test` (usa `vitest run`, sin modo watch).

### Alcance y qué falta (para que quede claro qué cubre esto y qué no)

Esto es un punto de partida sólido, no cobertura exhaustiva. Cubre las áreas de mayor riesgo (todo lo que tuvo un bug real en esta conversación) más los flujos centrales (auth, proyectos, inscripciones, mensajes, recomendaciones). **No** cubre: componentes de UI más allá de `ProjectCard` (KPIs, Habilidades, NGODashboard, etc. no tienen tests todavía), el WebSocket en sí (los tests de mensajes usan el REST, no abren una conexión WS real — igual que la verificación manual de la sección §18), ni los templates de email más allá del escape de HTML (no se verifica el subject/wording de cada variante exhaustivamente). Agregar tests para una nueva feature de acá en más: seguir el mismo patrón (unitarios para lógica pura, un test de integración por flujo nuevo que agregue un endpoint).

## 24. Feature: Materialización del rol Empresa — perfil real (primera entrega del módulo Empresas)

**Contexto:** a pedido del usuario, se prioriza `BACKEND_ROADMAP_ANALYSIS.md` punto 1 (modelo de Empresas + JWT), por ser la pieza de la que dependen el resto de los módulos de empresa (patrocinio, dashboard, chat). Alcance de esta entrega: solo el **perfil propio de empresa** (equivalente a lo que ya existía para ONG en `ngos.js`). Patrocinio, dashboard con KPIs y "empleados"/voluntarios propios quedan fuera de esta entrega — son las siguientes del roadmap de empresas.

### Qué ya existía (sin tocar)
- `users.role CHECK(...,'company')` y la tabla `empresas` (1:1 con `users`) ya estaban en el esquema desde el análisis inicial.
- `POST /api/auth/register` ya crea la fila en `empresas` cuando `role='company'`.
- El JWT ya lleva `role` embebido — no hizo falta ningún cambio de forma del token.

### Qué faltaba y se agregó
- **Tabla nueva** `empresa_categorias` (N:M Empresa↔Categoría, mismo shape que `ngo_categorias`) — aditiva, no toca ninguna tabla existente. Agregada en `scripts/migrate.js`.
- **Archivo nuevo** `backend/src/routes/empresas.js`, montado en `src/index.js` como `/api/empresas` — mismo patrón exacto que `ngos.js`:
  - `GET /api/empresas` (público, listado).
  - `GET /api/empresas/me` (auth, `requireRole('company')`).
  - `GET /api/empresas/:id` (público, columnas explícitas, sin `SELECT *`).
  - `PUT /api/empresas/me` (auth, `requireRole('company')`, actualización parcial real — mismo patrón anti-B8 que `PUT /api/ngos/me`: leer la fila actual y no pisar con `null` los campos no enviados).
- Documentado en `API_CONTEXT.md` (nueva sección "Empresas") y `DATABASE_CONTEXT.md` (tabla #26).

### Sobre "resolver la deuda de guardas cosméticas del frontend"
Se confirmó que el problema real era la ausencia de endpoints `requireRole('company')`, no la guarda de frontend en sí (que sigue siendo, correctamente, solo UX — regla 15 de `AI_RULES.md`). Con `empresas.js` ya protegido server-side, cualquier guarda de frontend que se agregue después es cosmética por diseño, no la única línea de defensa.

### Verificación (servidor real, mismo shim de `node:sqlite` de siempre por la limitación de este entorno para compilar `better-sqlite3`)
- `migrate.js` corrido dos veces seguidas (idempotencia) — sin errores, `empresa_categorias` se crea una sola vez.
- Login con la empresa de seed (`admin@techcorp.com`) → `200`.
- `GET /api/empresas/me` recién logueado → devuelve el perfil con `industria` del seed.
- `PUT /api/empresas/me` enviando solo `{ description, category }` (sin `logo`/`banner`/`industry`) → `200`, y se confirmó que `industria` **no se pierde** (mismo chequeo que ya se hizo para B8/B2).
- `GET /api/empresas/me` posterior → la descripción y la categoría persisten.
- `GET /api/empresas` (listado público) y `GET /api/empresas/:id` (perfil público) → `200`, con `category` resuelta.
- `GET /api/empresas/:id` con un id inexistente → `404`.
- Guarda de rol: un `volunteer` logueado pidiendo `GET /api/empresas/me` → `403 "Requiere rol: company"`; sin token → `401`.
- Regresión: `GET /api/ngos`, `GET /health` → siguen respondiendo igual que antes del cambio (el `index.js` solo ganó una línea de `app.use`).
- Se descartó el shim y los `node_modules` de prueba al terminar.

**Próximo paso sugerido:** Sistema de Patrocinio (Empresa↔Proyecto) — punto 5 de `BACKEND_ROADMAP_ANALYSIS.md`, ahora desbloqueado porque ya existe un perfil de empresa real con guarda de rol para colgar los endpoints de propuesta/aceptación.

## 25. Frontend básico para el módulo Empresas (interacciones sobre lo que ya tiene API)

**Contexto:** a pedido del usuario ("quería también agregarle front básico con las interacciones"), se construye la UI mínima que consume los endpoints de `routes/empresas.js` (§24). Mismo patrón visual/estructural que ya existe para ONG, con color violeta para diferenciar el rol a simple vista.

### Archivos nuevos (frontend)
- `CompanyLayout.tsx`, `CompanySidebarNav.tsx`, `CompanyBottomNav.tsx` — mismo patrón exacto que sus equivalentes `NGO*`.
- `CompanyOwnProfile.tsx` — perfil propio editable (`GET/PUT /api/empresas/me`). Sin sección de "proyectos patrocinados" real todavía (placeholder explícito) — el patrocinio (roadmap punto 5) no tiene API.
- `CompanyPublicProfile.tsx` — perfil público (`GET /api/empresas/:id`), con botón de mensaje (reutiliza el chat genérico ya existente).
- `CompanyOwnProfile.test.tsx`, `CompanyPublicProfile.test.tsx` — tests de integración con React Testing Library, mismo patrón que `ProjectCard.test.tsx` (`api` mockeado, sin red real).

### Archivos modificados
- `lib/api.ts` — interfaz `Empresa` + namespace `api.empresas` (`me`, `get`, `update`), mismo shape que `api.ngos`.
- `app/routes.tsx` — nuevo grupo `/company` (`CompanyLayout` con `profile` y `messages`) + ruta pública `company/:id` bajo `Root`.
- `AuthModal.tsx` — al loguear/registrar, si `user.role === 'company'` ahora redirige a `/company/profile` (antes solo existía el caso `ngo`, `company` quedaba sin redirección).
- `MessagesScreen.tsx` y `ChatThread.tsx` — el cálculo de la ruta base del chat (`base`/`backTo`) solo contemplaba `ngo` vs. genérico; se agregó el caso `company` para que sus conversaciones abran dentro de `/company/messages/...` y no en `/messages/...` (que renderiza el layout de voluntario).

### Fuera de alcance (a propósito)
- No hay página de "explorar empresas" — tampoco existe una equivalente para ONG hoy (`ExploreScreen.tsx` es solo de proyectos), así que no se inventó una funcionalidad nueva de navegación.
- No hay upload de logo/banner — depende del módulo de Multimedia (roadmap punto 2), todavía no implementado; los campos `logo`/`cover_image` se pueden completar por URL igual que en ONG.
- No hay dashboard ni KPIs de empresa (roadmap punto 6) — no hay API todavía.

### Verificación
- `npx tsc --noEmit` sobre el proyecto real (se instalaron `@types/react`, `@types/react-dom`, `@types/node`, ausentes en este sandbox, para que el chequeo fuera real y no solo el paso de esbuild de `vite build`) — **cero errores en los archivos tocados**; los errores restantes (`BottomNav.tsx`, `NGODashboard.tsx`, `NGOEmpleados.tsx`, `ProjectDetails.tsx`, `ImportMeta.env`) son preexistentes y no relacionados.
- `vite build` — compila sin errores.
- Suite de tests existente (`ProjectCard.test.tsx`, `format.test.ts`, 10 tests) — sigue en verde.
- Tests nuevos (`CompanyOwnProfile.test.tsx`, `CompanyPublicProfile.test.tsx`, 6 tests) — verifican: que el perfil se pinta con los datos de `api.empresas.me()/get()`, que el `PUT` desde la UI viaja con el payload correcto (incluyendo campos no tocados, como `industry`, para no repetir en el frontend el mismo bug de pisado que B8 en el backend), que el `GET` público pide el `:id` correcto de la URL, y que no explota si faltan campos opcionales.
- **Verificación end-to-end manual** con el backend real corriendo (mismo shim de `node:sqlite` de siempre) y el frontend con `vite` en modo dev apuntando a él: login/perfil de empresa ya se habían probado por `curl` en §24; en esta entrega se confirmó además que el bundle de producción incluye las rutas nuevas (`company/profile`) y que el dev server sirve `/company/profile` con `200` (fallback de SPA). **No se pudo hacer un click-through visual real** — este sandbox no tiene un navegador headless disponible ni acceso de red para instalar uno —, así que la verificación de la UI se apoya en los tests de RTL (que sí montan los componentes reales en jsdom) en vez de una captura de pantalla. Recomendado: probarlo una vez en un entorno con browser antes de darlo por cerrado del todo.
- Todos los procesos y bases de datos de prueba (incluido el shim de `better-sqlite3`, exclusivo de este sandbox) se descartaron al terminar; no forman parte de la entrega.

**Próximo paso sugerido:** igual que en §24 — Sistema de Patrocinio (Empresa↔Proyecto), que ahora también podría traer su propia pantalla básica (lista de propuestas + aceptar/rechazar del lado ONG) siguiendo este mismo patrón.

## 26. Sistema de Patrocinio (Empresa ↔ Proyecto) — backend + frontend básico

**Contexto:** roadmap punto 5 de `BACKEND_ROADMAP_ANALYSIS.md`, ahora desbloqueado por §24/§25. Usa `empresa_voluntariados`, que existía sin API.

### Backend
- `scripts/migrate.js`: se agregó un helper `columnExists()`/`addColumnIfNotExists()` (primera migración aditiva de columnas del proyecto — hasta ahora todo se creaba con `CREATE TABLE IF NOT EXISTS` desde cero) para agregar `estado` (CHECK `propuesto`/`aceptado`/`rechazado`, default `propuesto`), `mensaje` y `updated_at` a `empresa_voluntariados` sin romper si `migrate.js` ya se corrió antes. Índice nuevo `idx_empresa_vol_estado`.
- `routes/empresas.js`: `POST /me/patrocinios` (proponer — re-propone sobre una fila `rechazada` en vez de duplicar, por la PK compuesta), `DELETE /me/patrocinios/:projectId` (retirar, solo si sigue `propuesto`), `GET /me/patrocinios` (listar las propias).
- `routes/ngos.js`: `GET /me/patrocinios` (listar las que le proponen a la ONG), `PATCH /me/patrocinios/:empresaId/:projectId` (aceptar/rechazar — autorización por `JOIN` a `projects.ngo_id`, `409` si ya estaba decidida).
- `lib/emailTemplates.js`: `sponsorProposalEmail` (a la ONG) y `sponsorDecisionEmail` (a la empresa), mismo patrón `wrapper()`/`esc()` que los templates de inscripción.
- Notificaciones in-app en ambas direcciones (propuesta nueva → ONG; decisión → empresa), mismo patrón fire-and-forget que `enrollments.js`.

### Frontend
- `lib/api.ts`: interfaz `Patrocinio` + `api.empresas.patrocinios.{list,propose,withdraw}` + `api.ngos.patrocinios.{list,decide}`.
- `CompanyOwnProfile.tsx`: la sección "Proyectos patrocinados" pasó de placeholder a real — lista los patrocinios propios con badge de estado, un botón "Proponer" que despliega un selector de proyectos activos (excluye los que ya tienen una propuesta vigente) + mensaje opcional, y un botón de retirar por cada propuesta pendiente.
- `NGOPatrocinios.tsx` (nuevo): pantalla para la ONG, separada en "Pendientes" (con botones Aceptar/Rechazar) e "Historial" (decididas). Agregada a `NGOSidebarNav.tsx`/`NGOBottomNav.tsx` como "Patrocinios"/"Sponsors" y a `routes.tsx` como `/ngo/patrocinios`.

### Verificación
- **Backend, servidor real** (mismo shim de siempre): se probó el flujo completo por `curl` — proponer, doble-propuesta (`409`), listar desde ambos lados, aceptar, decidir dos veces la misma (`409`), estado inválido (`400`), autorización cruzada (otra ONG intentando decidir → `404`), notificación in-app resultante, retirar una propuesta pendiente, y re-proponer después de retirar y después de un rechazo (ambos casos **no** dan `409`, a diferencia de re-proponer sobre una ya vigente).
- Suite de tests del backend (71/71) — sigue en verde tras los cambios en `ngos.js`, `empresas.js`, `emailTemplates.js` y `migrate.js`.
- **Frontend:** `tsc --noEmit` sin errores nuevos, `vite build` limpio.
- Tests nuevos con RTL: `CompanyOwnProfile.test.tsx` ampliado (6 tests: perfil, update parcial, patrocinios sin explotar, listar patrocinios con estado, proponer con `project_id`+`mensaje` correctos y refresco posterior, retirar con el `project_id` correcto) y `NGOPatrocinios.test.tsx` (4 tests: lista con mensaje de la empresa, aceptar, rechazar, estado vacío). Total suite frontend: 23/23 en verde.
- Se descartaron las bases de datos y procesos de prueba al terminar.

**Próximo paso sugerido:** Dashboard de Empresa con KPIs (roadmap punto 6) — ahora hay datos reales de patrocinio para agregar (proyectos patrocinados, aporte total, impacto), o Chatbot FAQ (roadmap punto 9, aislado y de bajo riesgo si se prefiere una tarea más chica.

## 27. Chatbot FAQ (sin IA)

**Contexto:** roadmap punto 9. Aislado, sin dependencias de otros módulos.

### Backend
- `scripts/migrate.js`: tabla `faqs` nueva (`categoria`, `pregunta`, `respuesta`, `keywords`, `orden`, `activo`) + 2 índices + 8 FAQs semilla (3 voluntario, 3 ONG, 2 generales), insertadas de forma idempotente.
- `routes/faqs.js` nuevo: `GET /` (catálogo, filtrable por categoría) y `POST /ask` (matching).

**Dos bugs de matching reales encontrados y corregidos durante la verificación** (no solo "quedó lindo", se probaron las 8 preguntas semilla parafraseadas/conjugadas contra el servidor real hasta que las 8 matchearon):
1. El pre-filtro SQL con `LIKE` sobre la palabra completa descartaba candidatos antes de que el scoring en JS pudiera evaluarlos (ej. "inscribo" no aparece literal en la keyword "inscripción" aunque comparten sentido).
2. El primer intento de arreglo (comparar por prefijo de 4 caracteres) generó el problema inverso: falsos positivos entre palabras con la misma raíz corta pero distinto significado ("inscribir" vs "inscripción" comparten "insc"). Se descartó la idea de "stemming" por prefijo de largo fijo.

**Solución final:** dado que la tabla de FAQs es chica por diseño (catálogo curado a mano, nunca miles de filas), se eliminó el pre-filtro SQL — se trae todo el pool activo (opcionalmente filtrado por categoría) y se puntúa 100% en JS por substring bidireccional (`keyword.includes(palabra) || palabra.includes(keyword)`), sin heurísticas de prefijo. Las keywords de cada FAQ incluyen variantes conjugadas explícitas cuando hace falta (ej. `aprobar,apruebo`, verbo irregular) en vez de depender de que el algoritmo adivine la raíz. Esto es más simple, más predecible, y más fácil de extender a futuro (agregar una palabra al CSV de `keywords` en vez of tocar código).

### Frontend
- `lib/api.ts`: `Faq`, `AskFaqResponse`, `api.faqs.{list, ask}`.
- `ChatbotWidget.tsx` (nuevo): botón flotante + panel de chat, disponible en los tres layouts (`Root.tsx`, `NGOLayout.tsx`, `CompanyLayout.tsx`). Categoría automática según `user.role` (`ngo`→`ngo`, `volunteer`→`voluntario`, sin filtro para `company`/anónimo). Muestra sugerencias iniciales al abrir: si no hay match, siempre devuelve alternativas en vez de un callejón sin salida.

### Verificación
- Backend: las 8 preguntas semilla probadas parafraseadas/conjugadas contra el servidor real (curl), más casos límite (sin match, pregunta corta → `400`, filtro por categoría, catálogo). Suite de tests del backend: 71/71 en verde.
- Frontend: `tsc --noEmit` y `vite build` sin errores nuevos.
- **Otro bug real encontrado por los tests** (no de lógica de negocio esta vez, de compatibilidad): `bottomRef.current.scrollIntoView(...)` explotaba en jsdom (no implementa ese método) al montar `ChatbotWidget` en el test. Se corrigió con `scrollIntoView?.(...)`, defensivo también en producción por si algún entorno no lo soporta.
- 5 tests nuevos con RTL (`ChatbotWidget.test.tsx`): arranca cerrado sin pedir nada a la API, carga sugerencias al abrir, tocar una sugerencia pregunta y muestra la respuesta con match, pregunta sin match muestra sugerencias de respaldo, no envía preguntas vacías. Suite frontend completa: 28/28 en verde.
- Se descartaron las bases de datos y procesos de prueba al terminar.

**Próximo paso sugerido:** Dashboard de Empresa con KPIs (roadmap punto 6), o Sistema de Multimedia (roadmap punto 2), que es prerrequisito de Gestión de CV.

## 28. Feature (agregada por el usuario, documentada retroactivamente): Sistema de Seguimiento, Feed vertical, Mapa y Explorar

**Contexto:** entre las entregas de este documento (hasta §27) y la siguiente, el usuario trabajó directamente sobre el código (fuera de esta conversación) y agregó un conjunto grande de funcionalidad nueva, en 3 commits: *"implementacion de usuario empresas, Patrocinio y chat bot basico"* (el trabajo de §24-27 ya incorporado), *"Cambios: sistema de seguimineto, feed vertical, post de voluntariados, explorar"* y *"Mapa funcionando"*. Esta sección documenta esa entrega — nunca se había escrito en `docs/` hasta ahora.

### Qué se agregó — Backend
- **Tabla nueva** `volunteer_follows` (voluntario ↔ voluntario, CHECK anti-auto-seguimiento) — además, `ngo_follows`/`project_follows` (que ya existían en el esquema sin API) pasaron a tener API completa.
- **`routes/follows.js` (nuevo, ~620 líneas):** todos los endpoints de seguir/dejar de seguir (ONG, proyecto, voluntario) + `GET /api/follows/feed`, el feed personalizado de proyectos de lo que el usuario sigue. Ver el detalle completo de endpoints en `API_CONTEXT.md`.
- **`projects.js` — 3 columnas nuevas** (`latitud`, `longitud`, `modalidad`) agregadas vía `ALTER TABLE` con el mismo patrón `addColumnIfNotExists` que ya se había enseñado en este documento — el usuario replicó bien la convención.
- **Motor de recomendaciones reescrito** de 4 señales a 9 (ver `API_CONTEXT.md` para el detalle) — mucho más rico, incluye señal social (contactos que participan) y popularidad.
- **Filtro `modality`/`sort` nuevo** en `GET /api/projects`.
- **Restricción nueva:** solo puede calificar (`ratings`) quien tenga una inscripción `approved` en el proyecto.
- **`comments` ahora incluye `is_participant`** para que el frontend distinga comentarios de gente que participó vs. curiosos.
- **`voluntarios.js`:** nuevo `GET /:userId`, perfil público de voluntario.

### Qué se agregó — Frontend
- **`ExploreScreen.tsx` reescrita** (793 líneas): búsqueda, filtros y mapa en una sola pantalla.
- **`ProjectMap.tsx` (nuevo, 852 líneas):** mapa con Leaflet (gratis, sin API key), pines custom con `L.divIcon` (evita el bug clásico de íconos rotos de Leaflet con bundlers).
- **`FilterModal.tsx` (nuevo):** modal de filtros + función pura `filterProjects()` exportada (ahora con tests, ver §29).
- **`FeedPostCard.tsx` (nuevo, 520 líneas):** tarjeta de post para el feed vertical (like, comentar, inscribirse, calificar).
- **`FeedSidebar.tsx` (nuevo):** sidebar de escritorio del feed, puramente presentacional.
- **`ReviewsModal.tsx` (nuevo):** modal de calificaciones.
- **`VolunteerPublicProfile.tsx` (nuevo):** perfil público de voluntario, con follow/unfollow.
- **`CreateVoluntariado.tsx`:** ahora pide modalidad (presencial/remoto/híbrido) y, según la modalidad, ubicación física y/o "plataforma o medio digital".
- **`MainFeed.tsx`:** ahora arma el feed a partir de `/api/follows/feed` en vez de listar todos los proyectos.

### Cómo se validó
No había verificación en `docs/` de este trabajo (por eso esta sección es retroactiva). En la revisión de §29 se corrió la suite completa (backend y frontend) contra este código y se probó en vivo cada endpoint nuevo — ver el detalle ahí.

---

## 29. Revisión de código del usuario (§28) — 5 bugs encontrados y arreglados + limpieza de deuda menor

**Contexto:** a pedido del usuario ("hice cambios front y back, que te parecen?"), se hizo una revisión completa y manual de todo el diff de §28 — no solo lectura de código: se corrió el backend y el frontend reales (con el mismo shim de `node:sqlite` de siempre, por la limitación de este entorno para compilar `better-sqlite3`), se corrieron ambas suites de tests, se corrió `tsc --noEmit` real (con `@types/react` instalados, no vienen por defecto en este sandbox) y se reprodujeron los bugs con datos reales antes de arreglar nada.

### Los 5 bugs encontrados (todos arreglados)

1. **`follows.js`, `GET /feed` — estado de inscripción mal calculado para el último proyecto seguido.** La query de `my_enrollment_status` reusaba una variable `ph` (placeholders `$1..$N`) pensada para un array de solo `ids`, pero le anteponía `req.user.id` sin correr la numeración — el resultado real era que el primer placeholder de la cláusula `IN` terminaba bindeado dos veces a `user.id` y el último id de la lista quedaba sin bindear (`remapParams` en `db/sqlTranslate.js` reusa el valor de un placeholder repetido, no lo detecta como error). **Reproducido con datos reales:** María (seed) aprobada en `proj-1` y `proj-7` (ambos de la misma ONG) — el feed mostraba `approved` solo para `proj-1`. **Fix:** placeholders con offset propio (`$i+2`) para la query que antepone `user.id`.

2. **`follows.js` — `fmtProject` copiado y desincronizado de `projects.js`.** El router tenía su propia copia de la función de formateo, sin los mapeos de `latitude`/`longitude`/`modality` que sí tiene la de `projects.js`. **Reproducido:** mismo proyecto, `latitude: -31.42` por `/api/projects/:id`, `latitude: null` por `/api/follows/feed`. **Fix de fondo, no parche:** se exportó `fmt` desde `projects.js` (`module.exports.fmt = fmt`) y `follows.js` ahora lo importa (`const { fmt: fmtProject } = require('./projects')`) en vez de mantener una copia. Mismo patrón se usó después para arreglar el bug de `ngos.js` (ítem "deuda menor" más abajo) — cualquier router nuevo que devuelva proyectos debe hacer lo mismo.

3. **`api.ts` — tipo `Comment` en vez de `AppComment`.** `comment: (id, comment) => req<{ comment: Comment }>(...)` usaba el tipo global del DOM (`Comment`, de `lib.dom.d.ts`) por no importar el propio. No rompía en runtime (JS no valida tipos) pero anulaba el chequeo de tipos ahí y causaba un error real de `tsc`. **Fix:** `AppComment`.

4. **`ExploreScreen.tsx` + `projects.js` — búsqueda/mapa truncados a 20 proyectos.** `ExploreScreen.tsx` pedía `api.projects.list({ sort: 'featured' })` sin `limit`, y el backend por defecto usa `limit=20`. Como el filtrado es 100% client-side sobre esa lista ya fija, cualquier proyecto más allá del #20 nunca aparecía. **Reproducido:** se sembraron 15 proyectos extra (27 en total) y se confirmó que la llamada exacta de la pantalla devolvía 20. **Fix pragmático:** `limit: '200'` explícito, documentado en el código como interino — lo prolijo a mediano plazo es paginar de verdad.

5. **`FilterModal.tsx` — el filtro de modalidad ignoraba el campo `modality` real.** Reinventaba la detección de "remoto" buscando texto (`"remoto"`/`"virtual"`/`"online"`) en `location`, en vez de usar `p.modality` (que el backend ya manda). Un proyecto remoto con ubicación "Zoom" o "Google Meet" — **justo lo que el placeholder de `CreateVoluntariado.tsx` invita a poner** ("Ej: Google Meet, Zoom, Slack") — quedaba invisible al filtrar por "Remoto". Tampoco existía "Híbrido" como opción de filtro, pese a que `CreateVoluntariado.tsx` sí lo permite crear. **Fix:** `filterProjects()` ahora compara `p.modality` directo (con el heurístico de texto viejo solo como fallback si `modality` viniera vacío, no debería pasar nunca). Se agregó "Híbrido" como cuarta opción en el modal, y se corrigió también el chip de filtro activo en `ExploreScreen.tsx` (mostraba "Presencial" para un filtro "Híbrido" recién agregado — bug de un paso, causado por el propio fix, encontrado y corregido en el momento).

### Verificación de los fixes
- Cada bug se reprodujo primero con datos reales (curl contra servidor real, no solo lectura de código) y se re-verificó después del fix con el mismo escenario exacto.
- **Test de regresión agregado en `follows.test.js`** para el bug 1+2 — y se probó que el test realmente detecta el bug: se revirtió el fix a propósito, se corrió la suite y el test falló con el mismo síntoma reproducido a mano (`proj-7... null !== 'approved'`); se restauró el fix y volvió a pasar.
- **4 tests nuevos en `FilterModal.test.tsx`** (no existía cobertura) para el bug 5: caso "Zoom" sin la palabra remoto, caso presencial, caso híbrido, caso sin filtro.
- Suite de backend: 79 → **80/80** tests. Suite de frontend: 30 → **34/34** tests. `tsc --noEmit` y `vite build` limpios en ambos.

### Deuda menor encontrada durante la revisión, arreglada después a pedido del usuario
1. **`GET /api/ngos/me` devolvía proyectos crudos** (`SELECT * FROM projects`, sin pasar por `fmt()`) — el frontend lo parchaba con `p.title ?? p.titulo` en `NGODashboard.tsx` en vez de arreglarse en el origen. **Fix de fondo:** `ngos.js` ahora también importa `fmt` de `projects.js` (mismo patrón que el bug 2) y formatea `projects` antes de responder. Se sacó el parche `?? p.titulo` del frontend, ya innecesario.
2. **Badge de modalidad en las tarjetas de `ExploreScreen.tsx`** no distinguía "Híbrido" de "Presencial" (cosmético, no rompía nada). Se agregó el tercer caso.
3. **`project.requirements?.length > 0` y `project.roles_needed?.length > 0`** en `ProjectDetails.tsx` generaban un warning real de `tsc` por narrowing (`undefined > 0` es válido en runtime pero TS no lo entiende) — cambiado a `project.requirements && project.requirements.length > 0` (mismo comportamiento, sin el warning).

### Lo que quedó fuera, a propósito
- No se tocó la paginación real de `GET /api/projects` — el `limit: '200'` en `ExploreScreen.tsx` es un parche que funciona hoy pero no escala indefinidamente; si el catálogo de proyectos crece mucho, esto va a volver a aparecer.
- `voluntarios.js` `GET /:userId` sigue devolviendo una mezcla de campos en inglés y en español (ver nota en `API_CONTEXT.md`) — no es un bug, pero es candidato a normalizar si se vuelve a tocar ese endpoint.
- El chatbot con IA (embeddings locales vs. Groq) quedó como decisión pendiente, sin implementar.

## 30. Decisiones de producto que destrababan features del roadmap

Cuatro decisiones que estaban bloqueando explícitamente el arranque de features del roadmap (`BACKEND_ROADMAP_ANALYSIS.md`) quedaron resueltas:

1. **Multimedia (Feed, CV, banners de proyecto): Cloudinary**, no S3. Motivo: el free tier de Cloudinary es permanente (no un trial de 12 meses como el de AWS), incluye transformación/resize de imágenes sin infraestructura extra (Sharp/Lambda), y la integración es más simple para el volumen de este proyecto. Ver detalle técnico completo (schema de `media`, endpoints, `multer`) en `BACKEND_ROADMAP_ANALYSIS.md §1.1`.

2. **"Empleados" de empresa: usuario real vinculado**, no un registro administrativo aparte. Un "voluntario de empresa" es un usuario `role=volunteer` común, asociado a una empresa vía una tabla `empresa_voluntarios (empresa_id, user_id, cargo)` — reusa todo lo que ya existe (`users`, `voluntarios`, `enrollments`) en vez de duplicar el concepto de "empleado" que ya existe para ONG. Ver diseño completo en `BACKEND_ROADMAP_ANALYSIS.md §2.4`.

3. **Privacidad del CV: restringida.** Una ONG solo puede ver el CV de un voluntario si existe una `enrollment` con `status='approved'` entre ambos — no cualquier ONG logueada. Aplica al endpoint `GET /voluntarios/:userId/perfil-completo` diseñado en `BACKEND_ROADMAP_ANALYSIS.md §1.3` (agregar el filtro `EXISTS (...)` que ahí queda solo señalado como pendiente de decisión).

4. **Pagos: Stripe, en modo test — no Mercado Pago.** Decisión tomada explícitamente sabiendo que **no va a salir del caso de prueba** (no hay intención de procesar pagos reales ni de producción). Se prefirió Stripe sobre Mercado Pago por: SDK y documentación en inglés más pulidos y con más comunidad, verificación de firma de webhook resuelta con un helper directo (`stripe.webhooks.constructEvent`, más turnkey que lo que requiere MP), y por ser la referencia más reconocible como "estándar de industria" para una presentación de tesis. **Importante:** el diseño de Sistema de Pagos que quedó escrito en `BACKEND_ROADMAP_ANALYSIS.md §1.4` está armado para Mercado Pago (Checkout Pro, `preferences.create`, `external_reference`) — sirve como referencia conceptual (flujo de `donaciones` con `external_id`/`external_status`, la advertencia de transacciones atómicas antes de tocar `recaudado`), pero **la implementación concreta de endpoints y SDK debe rehacerse para Stripe** (Stripe Checkout Session en vez de `preferences.create`, `stripe.webhooks.constructEvent` en vez de validar el `topic`/`id` a mano). Como queda en modo test, la moneda de la demo va a ser la que se configure en el Checkout de Stripe (típicamente USD), no ARS — es una decisión narrativa para la demo, no técnica.

## 31. Limpieza y consistencia de la documentación (`docs/`)

**Contexto:** a pedido del usuario, se revisaron los 7 archivos de `docs/` en busca de inconsistencias, contradicciones y contenido desactualizado antes de un handoff a un chat nuevo (los 3 docs "vivos" — `API_CONTEXT.md`, `DATABASE_CONTEXT.md`, `PROJECT_ANALYSIS.md` — se venían manteniendo al día en esta conversación, pero `PROJECT_CONTEXT.md`, `BACKEND_CONTEXT.md`, `FRONTEND_CONTEXT.md` y `AI_RULES.md` no se habían tocado desde el análisis inicial de agosto).

### Contradicciones directas encontradas (el mismo hecho descripto de dos formas distintas en el mismo o distinto archivo)
- `BACKEND_CONTEXT.md §6` decía que `categoria_nombre` "nunca se mapea a `category`", mientras que `§10` del mismo archivo decía que **eso ya estaba corregido**.
- `BACKEND_CONTEXT.md §8` listaba el bug `message`/`mensaje` como vigente, cuando `§10` (mismo archivo) ya lo marcaba corregido.
- `FRONTEND_CONTEXT.md` describía el rol `company` como "sin pantallas, redirige a `/feed`" — falso desde que se construyó el módulo de Empresas (§24-25).
- `FRONTEND_CONTEXT.md` describía un patrón N+1 en `NGODashboard.tsx` como vigente — ya resuelto (§21, "Optimización 3").
- `FRONTEND_CONTEXT.md` describía `NGOKPIs.tsx` como uno de los componentes que "evitan `api.ts`" — ya corregido (§13); solo `NGOEmpleados.tsx` sigue así.

### Contenido faltante (nunca documentado, no por error sino por no haberse escrito nunca)
- `API_CONTEXT.md`: el índice de endpoints no tenía ninguna fila de `empresas.js`, `follows.js` ni `faqs.js` — un tercio de los endpoints reales del backend no aparecían ahí.
- `DATABASE_CONTEXT.md`: faltaban las tablas `faqs` y `volunteer_follows` en la lista numerada y en el diagrama ER.
- `FRONTEND_CONTEXT.md`: faltaban por completo las rutas y componentes de Empresa, Explorar, Mapa, Filtros, Feed vertical y Perfil público de voluntario en la tabla de rutas y el diagrama de navegación.
- `PROJECT_CONTEXT.md`: el diagrama de arquitectura y el árbol de archivos tenían conteos viejos (24 tablas/18 índices, 22 componentes) y no mencionaban ninguno de los routers/componentes nuevos.

### Hallazgo nuevo durante esta limpieza (no un bug de código, una duplicación de componentes)
Existen **dos componentes de reseña que hacen lo mismo**: `ReviewModal.tsx` (105 líneas, más viejo, usado por `MyParticipation.tsx`) y `ReviewsModal.tsx` (310 líneas, más completo, usado por `FeedPostCard.tsx` y `ProjectDetails.tsx`). Ninguno reemplazó al otro — quedaron los dos. No se tocó el código (esto fue una revisión de documentación, no de código), pero queda anotado como candidato a consolidar en `FRONTEND_CONTEXT.md §15`.

### Qué se hizo
- Se reescribieron las partes desactualizadas de `PROJECT_CONTEXT.md`, `BACKEND_CONTEXT.md` y `FRONTEND_CONTEXT.md` (diagramas, tablas de rutas, árboles de archivo, conteos) para reflejar el estado real del código, verificado contra el código fuente en cada caso (no se asumió nada de memoria de la conversación).
- Se actualizaron 3 reglas de `AI_RULES.md` que usaban bugs ya corregidos como ejemplo vigente (reglas 4, 10, 16) y una que quedó obsoleta porque ya existe una solución mejor a lo que pedía hacer a mano (regla 12, sobre `ALTER TABLE` — ahora referencia el helper `addColumnIfNotExists`).
- Se completó el índice de `API_CONTEXT.md` con las ~30 filas que faltaban.
- Se agregaron las tablas y relaciones faltantes al diagrama ER de `DATABASE_CONTEXT.md`.
- Se verificó el conteo real de tablas contando `CREATE TABLE IF NOT EXISTS` en `migrate.js` (28, no una cifra de memoria) y se confirmó que coincide exactamente con la lista numerada del documento.
- Se validó que ninguno de los 7 archivos quedó con Markdown roto (bloques de código sin cerrar) tras las ediciones.

### Qué no se tocó (a propósito)
No se modificó ningún archivo de código en esta tarea — es exclusivamente una limpieza de documentación. La duplicación de `ReviewModal.tsx`/`ReviewsModal.tsx` y los demás ítems de deuda técnica mencionados quedan para una tarea aparte si el usuario decide abordarlos.

## 32. `BACKEND_ROADMAP_ANALYSIS.md` — agregado a `docs/` (nunca había estado ahí) y reescrito

**Contexto:** el usuario notó que no tenía ese archivo — se había generado como entregable suelto al principio de la conversación, se citó desde `PROJECT_ANALYSIS.md §24/§26/§30` como si viviera en `docs/`, pero **nunca se copió a la carpeta real**. Se agrega ahora, y de paso se reescribe: la versión original describía Empresas/Patrocinio/Chatbot como pendientes (ya se hicieron, §24-27) y diseñaba Pagos para Mercado Pago (la decisión final fue Stripe, `§30`).

**Qué cambió respecto a la versión original**, además de marcar lo hecho como hecho:
- **Se verificaron contra el código real** varios supuestos con los que se había escrito de memoria: el proyecto **no usa `RETURNING`** en ningún lado (patrón real: `INSERT` + re-`SELECT`, o generar el id con `crypto.randomUUID()` antes de insertar); el adaptador **no tiene transacciones**; `donaciones.estado` tiene **`DEFAULT 'completada'`** (un `INSERT` sin `'pendiente'` explícito crea una donación "ya pagada"); `express.json()` está montado globalmente, lo cual importa para el webhook de Stripe (necesita el body crudo, tiene que montarse antes de esa línea).
- **Pagos rediseñado para Stripe Checkout** en modo test (antes era Mercado Pago Checkout Pro) — sesión de checkout, webhook con `stripe.webhooks.constructEvent`, y la advertencia de transacciones atómicas se mantuvo pero ahora apunta al caso concreto de Stripe.
- **CV:** se agregó el diseño concreto de la regla de privacidad ya decidida (`§30`) que la versión original solo dejaba señalada como pendiente, más una advertencia sobre URLs firmadas de Cloudinary (la restricción de la API no alcanza si el asset es público).
- **Multimedia:** se acotó el alcance inicial (sacar `'comment'` de los `owner_type`, no hay ningún flujo de comentarios con adjuntos todavía) y se agregó el helper `verifyOwnership()` completo que antes solo se mencionaba de nombre.
- **Dashboard de Empresa:** se corrigió un error de diseño real en el borrador original — el conteo de `proyectos_patrocinados` y el `aporte_total` sumaban también propuestas `pendientes`, inflando los KPIs con patrocinios que la ONG todavía no aceptó. Ahora solo cuentan `aceptado`.
- **Empleados de empresa:** se agregó una sub-decisión que el original no contemplaba — consentimiento del voluntario (flujo de invitación en vez de que la empresa pueda "declarar" empleados sin que se enteren).
- Se agregó una tabla de equivalencia en `§0` para que las referencias históricas de `§24`/`§26` ("punto 1", "punto 5" de la numeración plana original) sigan siendo ubicables en la nueva numeración por secciones.

No se implementó ningún código de estos módulos en esta tarea — es un documento de diseño para retomar en el próximo chat.


## 33. Dashboard de Empresa (`BACKEND_ROADMAP_ANALYSIS.md §2.3`) — implementado y verificado

**Contexto:** primera feature del roadmap tras la reescritura de §32. Se eligió por no tener bloqueos y por servir de prueba del entorno de tests antes de Multimedia/Pagos.

### Qué se construyó
- **Backend:** `GET /api/empresas/me/dashboard` en `routes/empresas.js` (4 queries fijas, 3 en paralelo, sin N+1). Contrato en `API_CONTEXT.md`.
- **Frontend:** `CompanyDashboard.tsx` (4 KPIs + lista de proyectos con badge, estados de vacío y de error con "Reintentar"), ruta `/company/dashboard`, ítem "Panel" en `CompanySidebarNav` y `CompanyBottomNav`, tipos `CompanyDashboard`/`CompanyDashboardProject` y `api.empresas.dashboard()` en `api.ts`, y `lib/sponsorship.ts` (mapas de etiqueta/color de estado, para no sumar una tercera copia; las dos existentes en `NGOPatrocinios.tsx` y `CompanyOwnProfile.tsx` siguen sin tocar y pueden migrarse).
- **Tests:** 11 de integración (`test/integration/empresa-dashboard.test.js`) y 9 de componente (`CompanyDashboard.test.tsx`). Los valores esperados salen de cuentas a mano sobre el seed (10 h + 5 h = 15 h, 1 voluntario distinto en 2 proyectos), no de lo que devuelve el endpoint.

### Hallazgos: el diseño de §2.3 tenía tres problemas que el código real desmintió
1. **`aporte_total` habría sido un cero permanente:** nadie escribe `empresa_voluntariados.aporte`. Se omitió del dashboard.
2. **En Postgres `SUM`/`COUNT` llegan como string.** El adaptador no configura parsers de tipos de `pg`. Se demostró levantando un Postgres 16 real y quitando `Number()`: la suite falla en Postgres y pasa en SQLite. Sin la guarda, dev habría mostrado `3` y Render `"3"`. Quedó como regla 13 en `AI_RULES.md`. **Ninguna suite existente lo habría detectado (todas SQLite).**
3. **`fmt()` no sirve con filas parciales** (`...p` filtra columnas en español y fabrica ceros como `current_funding: 0`). La respuesta se arma a mano con claves en inglés.

### Verificación
- Backend: 80 → **91** tests en verde. La suite del dashboard también pasa 11/11 contra **Postgres 16 real**.
- Frontend: 34 → **43** tests en verde; `vite build` OK; `tsc` real: 0 errores propios (quedan 3 preexistentes de `ImportMeta.env`).
- **Mutation testing** (romper el código a propósito): quitar el filtro `aceptado` del impacto (4 tests fallan), `COUNT(DISTINCT)` → `COUNT` (2 fallan), quitar `Number()` (falla en Postgres, no en SQLite), mostrar horas en pendientes (1 falla), formatear decimales sin locale (1 falla). 5 de 5 detectadas.

### Notas de entorno para futuras sesiones
- El `node_modules` del zip trae binarios de **Windows** (better-sqlite3, rollup, esbuild, oxide, lightningcss): hay que reinstalar los de Linux con `npm install --no-save` (incluyendo todos en un mismo comando: un `--no-save` posterior poda los anteriores). `.bin/vitest` pierde el bit de ejecución: correr `node node_modules/vitest/vitest.mjs run`.
- `typescript` **no es dependencia** del frontend; para correr `tsc` hay que instalarlo aparte junto con `@types/react`, `@types/react-dom` y `@types/node`. Un `tsc` que "no imprime errores" puede ser un `tsc` que no existe: mirar la salida cruda.
- ~~Discrepancia de doc: `PROJECT_CONTEXT.md` dice `better-sqlite3` 9.6 pero `package.json` pide `^13.0.3`.~~ Corregida en `§36` (y el problema de fondo era más serio).

### Pendiente / decisiones abiertas
- ¿Aterrizar el login de empresa en `/company/dashboard`? Hoy sigue en `/company/profile` (una línea en `AuthModal.tsx`).
- `aporte`: ¿lo carga la ONG al aceptar, o lo deriva Pagos de una donación completada?
- ~~Dejar fijo un `npm run test:pg`~~ ✅ hecho en `§34`.
- KPI de horas de empleados: depende de `§2.4`.


## 34. `db.transaction()` + `npm run test:pg` + arreglo de la carrera de `cupos_ocupados`

**Contexto:** era el prerrequisito de Pagos (`BACKEND_ROADMAP_ANALYSIS.md §1.5`) y resolvía una condición de carrera existente. Se hizo primero el harness de Postgres y los tests que **reproducen el bug con el código viejo**, y recién después el arreglo.

### Qué se construyó
- **`db.transaction(async (tx) => ...)` en `src/db/index.js`, ambos motores.** Diseño y reglas en `BACKEND_CONTEXT.md §2`. Se refactorizaron `run/get/all` de Postgres a un `bind(exec)` compartido por el pool y por el cliente de la transacción (mismo código, sin duplicar); el comportamiento de los métodos existentes no cambió.
- **`npm run test:pg`** (`scripts/run-tests-pg.js` —se llamó `test-pg.js` hasta `§38`—, funciona en Windows): corre **la misma suite** contra un Postgres real. `test/integration/helpers.js` ganó `TEST_DB=postgres`, `setupTestDb()` (para tests del adaptador sin servidor HTTP) y quedó dividido en `configureTestDb`/`cleanupTestDb`. Cada archivo usa su propio schema y no toca `public`; ignora `DATABASE_URL`.
- **`routes/enrollments.js`:** `PATCH /:id` y `DELETE /:id` ahora hacen estado + cupo en una transacción, con compare-and-swap sobre el estado leído. Notificaciones y emails quedaron **después** del COMMIT. `RELEASE_SLOT_SQL` reemplaza la query de decremento que estaba duplicada.
- **Tests nuevos:** `db-transaction.test.js` (12, ambos motores) y `enrollments-concurrency.test.js` (6, invariantes bajo carga: 8 aprobaciones/rechazos simultáneos, tormentas mezcladas, 6 cancelaciones simultáneas).

### Hallazgos
1. **La carrera de `cupos_ocupados` es de Postgres y SQLite no puede reproducirla** (cada handler corre entero sin ceder el event loop). Con el código viejo, en Postgres: 8 rechazos simultáneos bajaban el cupo en 5 (23 → 18), una tormenta aprobar/rechazar dejaba el contador en 24 con la inscripción rechazada, y 6 cancelaciones simultáneas daban 6 éxitos y restaban 6 cupos. Se reprodujo antes de arreglar y quedó estable 8/8 corridas después.
2. **La sugerencia del roadmap para SQLite no servía:** `better-sqlite3.transaction(fn)` es síncrono; con un callback `async` haría commit antes de terminar. Además, SQLite tiene **una sola conexión**: una query de otra request durante una transacción abierta caería adentro y se perdería con un ROLLBACK. Se resolvió con `BEGIN/COMMIT` a mano, cola de transacciones y compuerta para las queries ajenas. Detectado por mutation testing: sin la compuerta fallan los tests de aislamiento.
3. **Trampa de divergencia entre motores:** `db.*` dentro del callback quedaría *dentro* de la transacción en SQLite pero *fuera* en Postgres (otra conexión). Pasaba tests en SQLite y rompía la atomicidad en producción, así que el adaptador lo rechaza con un error en ambos motores (`AsyncLocalStorage`). También rechaza transacciones anidadas (en SQLite se colgarían esperando su propio turno) y el uso de `tx` después de terminar.
4. **Cambio de comportamiento (intencional):** re-aprobar o re-rechazar algo que ya tiene ese estado ahora es un no-op (200), **sin notificación ni email duplicados**. Antes cada repetición mandaba otro email al voluntario.
5. **`API_CONTEXT.md` estaba desactualizado:** decía que aprobar "verifica que no exceda `cupos`" y respondía `{ enrollment }` / `{ success: true }`; el código nunca validó capacidad y responde `{ message }`. Corregido.

### ⚠️ Bugs preexistentes encontrados por `test:pg` (NO arreglados en esta tarea)
> **Actualización:** el de `/recommended` se arregló en `§35` (junto con un segundo bug del mismo tipo). El de capacidad sigue abierto.
- **`GET /api/projects/recommended` devuelve 500 en Postgres.** `projects.js:419` hace `p.created_at?.replace(' ', 'T')`; en Postgres `created_at` es `TIMESTAMPTZ` y el driver lo devuelve como `Date`, que no tiene `.replace`. En SQLite es un string y anda. **Afecta a todos los voluntarios en producción (Render).** Son los 2 tests que fallan bajo `test:pg` ("cold start" y "señal social" de recomendaciones).
- ~~**Aprobar no valida capacidad:** una ONG puede aprobar por encima de `cupos` (`cupos_ocupados > cupos`). `AI_RULES.md` regla 20 pide verificar la invariante `cupos_ocupados <= cupos`, pero el código no la impone. Decisión de producto abierta.~~ ✅ **Resuelto en `§39`.**

### Verificación
- SQLite (`npm test`): 91 → **110/110**. Postgres (`npm run test:pg`): **108/110** — las 2 excepciones son las de arriba (recomendaciones), preexistentes. Frontend sin cambios.
- **Mutation testing** sobre el adaptador (3 de 3 detectadas): quitar la compuerta de SQLite, desactivar la guarda de `db.*` en transacción, omitir el ROLLBACK en Postgres. Sobre las rutas: los 3 tests de concurrencia fallaban con el código viejo en Postgres y pasan con el nuevo.
- Sin schemas huérfanos en Postgres tras la suite completa.

### Para correr `test:pg` en tu máquina
Crear la base (`createdb voluntariar_test`) y setear `TEST_PG_USER` / `TEST_PG_PASSWORD` (y `TEST_PG_HOST`/`TEST_PG_PORT` si no es localhost:5432). En PowerShell: `$env:TEST_PG_USER="postgres"; $env:TEST_PG_PASSWORD="..."; npm run test:pg`.

### Pendiente / decisiones abiertas
- ~~**Arreglar `GET /projects/recommended` en Postgres**~~ ✅ hecho en `§35`.
- ~~¿Validar capacidad al aprobar (409 si `cupos_ocupados >= cupos`)?~~ ✅ hecho en `§39`.
- Pagos ya puede apoyarse en `db.transaction()`; recordar `Number()` en `SUM(monto)`.

## 35. Arreglo de los bugs de fechas en Postgres (`/recommended` y `/messages/conversations`)

**Contexto:** `§34` dejó anotado que `GET /api/projects/recommended` devolvía 500 en Postgres. Al arreglarlo se buscó la causa raíz y apareció un segundo caso.

### Causa raíz
Los timestamps llegan distinto según el motor: **SQLite → string** `'YYYY-MM-DD HH:MM:SS'` (UTC, sin zona); **Postgres → objeto `Date`** (todas las columnas de fecha son `TIMESTAMPTZ`). El código los trataba como string, lo cual anda en SQLite y lanza `TypeError` en Postgres.

### Los dos bugs (ambos producían 500 solo en producción)
1. **`GET /api/projects/recommended`** (`projects.js`): `p.created_at?.replace(' ', 'T')` — `Date` no tiene `.replace`. Afectaba a **todo voluntario** con al menos un candidato a recomendar.
2. **`GET /api/messages/conversations`** (`messages.js`): `last_at.localeCompare(...)` — `Date` no tiene `.localeCompare`. **Solo fallaba con 2 o más conversaciones**, porque con 0 o 1 el comparador de `.sort()` nunca se ejecuta: una demo con un solo chat nunca lo habría mostrado. No tenía ningún test.

### Qué se hizo
- **`src/lib/time.js` → `toMillis(value)`:** acepta string de SQLite (lo interpreta como UTC), `Date`, ISO con `Z` u offset; devuelve `null` (nunca lanza ni NaN) para null/vacío/basura. Reemplaza los tres usos: el scoring de recomendaciones (sin fecha válida → no recibe el bonus de "reciente" en vez de romper), el desempate de `/recommended`, y el orden de conversaciones.
- **Tests:** `test/unit/time.test.js` (8) y `test/integration/messages-conversations.test.js` (5, incluye el caso de 2 conversaciones y el reordenamiento por actividad reciente). Los de `/recommended` ya existían: eran justamente los 2 que fallaban en `test:pg`.

### Verificación
- **Rojo → verde:** con el código viejo, el test de 2 conversaciones fallaba en Postgres con `localeCompare is not a function` (y pasaba en SQLite); ahora pasa.
- **Por primera vez la suite completa pasa en los dos motores:** SQLite **123/123** y Postgres **123/123**. Frontend 43/43.
- **Zona horaria:** las suites y los tests de `toMillis` se corrieron también con `TZ=America/Argentina/Cordoba` (UTC−3). Necesario: una mutación de `toMillis` (no forzar UTC) **no** se detecta si se prueba solo en UTC. Mutaciones detectadas: sin forzar UTC (3 tests fallan), solo reconocer `Z` sin offsets (1 falla).
- **Inventario:** todas las columnas de fecha del esquema son `TIMESTAMPTZ`; no queda otro código que las trate como string. No hay un tercer caso escondido de esta familia.

### Observación no verificada (no se tocó)
El JSON de una fecha difiere por motor: SQLite manda `'2026-09-29 12:30:45'` (sin zona, en UTC) y Postgres manda ISO con `Z`. Si el frontend hace `new Date(...)` sobre el formato de SQLite, JS lo interpreta como hora local, y en desarrollo (SQLite) las horas podrían verse corridas (3 h en Argentina) mientras que en producción se ven bien. Es una diferencia solo de visualización en dev, no un crash; **no se verificó en el frontend**.

### Pendiente / decisiones abiertas
- ~~¿Validar capacidad al aprobar una inscripción (409 si `cupos_ocupados >= cupos`)? (`§34`)~~ ✅ hecho en `§39`.
- Verificar en Render (Postgres real) que ambos endpoints responden 200.


## 36. Entorno: `better-sqlite3@13` exige Node ≥ 22, y `npm install` intenta compilarlo

**Contexto:** al probar en Windows con Node 20.17.0, `npm install` falló y `node_modules` quedó incompleto, con lo que casi todos los tests fallaban. Eran dos problemas independientes.

### Causas (ambas reproducidas)
1. **Node 20 no puede usar `better-sqlite3@13.0.3`.** Declara `engines: node >=22` y con Node 20.17.0 real su binario termina en `Segmentation fault` (probado en Linux con Node 20.17.0 obtenido del paquete npm `node@20.17.0`). No es un formalismo.
2. **Instalar desde el lockfile ejecuta `node-gyp rebuild` para ese paquete, incluso en Node 22.** El paquete trae sus binarios ya compilados (`prebuilds/<plataforma>.node`) y declara `gypfile: false`, pero los lockfiles no guardan `gypfile`: npm ve un `binding.gyp` y lo trata como script de instalación (por eso el lockfile ganaba `"hasInstallScript": true` tras instalar). Sin Python + herramientas de C++ de Visual Studio falla y **aborta toda la instalación**. Reproducido con `npm ci` en una carpeta limpia.
3. **Contradicción del repo:** `package.json` y README decían "Node ≥ 18" y `PROJECT_CONTEXT.md` "better-sqlite3 9.6", mientras la dependencia real exigía Node ≥ 22.

### Solución adoptada
> **Actualización (`§38`):** el flag `--ignore-scripts` se reemplazó por un `backend/.npmrc` para que `npm install` funcione a secas. Lo de abajo queda como historial.

**Node ≥ 22 + `npm install --ignore-scripts`** en el backend. Mantiene `better-sqlite3@13.0.3` (la versión declarada, sin tocar dependencias). Es seguro para este proyecto: en el lockfile solo `fsevents` (opcional de macOS) tiene scripts de instalación.
- `backend/package.json` y raíz del lockfile: `engines.node` `>=18.0.0` → `>=22.0.0`. Con Node 20 ahora npm avisa `EBADENGINE ... voluntariar-backend requiere >=22` en vez de fallar de forma críptica.
- Lockfile: se adoptó `"hasInstallScript": true` (lo que npm escribe igual), para que una instalación limpia no lo deje "modificado" en git. Verificado estable: `npm install` ya no lo cambia.
- README (requisitos + comando de instalación con su explicación) y `PROJECT_CONTEXT.md` (Node ≥ 22, better-sqlite3 13.0.3).

### Alternativas evaluadas y descartadas
- *Solo actualizar Node:* **insuficiente** (era mi primera recomendación): con Node 22 igual intenta compilar.
- *Quedarse en Node 20 con `better-sqlite3@^12.4.1`:* npm resuelve a la 12.11.1, que **no publica binarios para Node 20** → vuelve a compilar. Fijar la versión exacta `12.4.1` sí funciona (suite 123/123 bajo Node 20.17.0 en Linux), pero cambia una dependencia que usa Render y Node 20 ya salió de soporte (abril 2026).

### Render (producción)
Render resuelve la versión de Node en este orden: `NODE_VERSION` → `.node-version` → `.nvmrc` → `engines` de `package.json`; y un rango sin tope "resuelve siempre a la última release". Como `engines` estaba en `>=18.0.0`, **Render probablemente usa un Node reciente**, lo que explica que el deploy funcionara con `better-sqlite3@13` (**no verificado en el servicio real**: se ve en el log de build).
- Cambiar `engines` a `>=22.0.0` no cambia nada en Render (sigue sin tope).
- **No** se agregó `.nvmrc` ni `.node-version`: tienen precedencia sobre `engines` y cambiarían la versión de producción sin poder probarlo.
- Riesgos conocidos, no resueltos: (a) sin tope, una futura major de Node podría romper el build (Render recomienda poner tope); (b) por el mismo mecanismo del punto 2, el `npm install` del `buildCommand` probablemente compila `better-sqlite3` desde el código fuente en cada deploy (inferido, no verificado). Agregar `--ignore-scripts` al `buildCommand` lo evitaría, pero no se hizo por no poder probarlo contra Render.

### Verificación
Desempaquetado limpio bajo **Node 22.22.2**: `npm install --ignore-scripts` (148 paquetes) y `npm ci --ignore-scripts` OK, **123/123** tests, lockfile estable. Bajo Node 20.17.0 aparece la advertencia `EBADENGINE`. **No se ejecutó en Windows** (todo se probó en Linux; el binario de Windows `prebuilds/win32-x64.node` viene en el mismo paquete).

### Pendiente / decisiones abiertas
- Confirmar en Windows: `npm install --ignore-scripts` + `npm test` con Node 22.
- Mirar el log de build de Render (¿qué Node usa?, ¿compila `better-sqlite3`?) y decidir si conviene un tope de Node y/o `--ignore-scripts` en el `buildCommand`.

## 37. Vulnerabilidades de dependencias (`npm audit`): de 11 a 0, y por qué cada decisión

**Contexto:** la instalación en Windows mostró "6 vulnerabilities (3 moderate, 2 high, 1 critical)" en el frontend y un aviso de `multer` deprecada en el backend. Se auditaron ambos lockfiles.

### Antes / después
| | Antes | Después |
|---|---|---|
| Backend | 5 (4 moderate, 1 high) | **0** |
| Frontend | 6 (3 moderate, 2 high, 1 critical) | **0** |

### Qué era cada cosa (importa más que el número)
- **Frontend: las 6 eran de herramientas de desarrollo**, ninguna llega al sitio publicado. La "crítica" (`vitest`) aplica solo *"cuando el servidor de Vitest UI está escuchando"* (es decir, con `vitest --ui`); `vite`/`esbuild`: servidor de desarrollo; `nanoid`: entra por `postcss` dentro de `vite`, en el build.
- **Backend: `express` → `qs` / `body-parser`** (denegación de servicio al parsear query strings) **sí es código de producción**. `brace-expansion` venía de `nodemon` (solo desarrollo). `uuid` no se usaba.

### Qué se hizo
- **Backend:** `npm audit fix` (sin `--force`) → `express` 4.22.2→4.22.3, `body-parser` 1.20.6→1.20.8, `qs` 6.15.3→6.16.0, `brace-expansion` 5.0.9→5.0.12 (solo lockfile, dentro de los rangos ya declarados). **`uuid` eliminado** (no se importaba en `src`, `scripts` ni `test`; `gen_random_uuid()`/IDs legibles cubren todo). **`multer` `^1.4.5-lts.1` → `^2.4.0`** (la 1.x estaba deprecada con vulnerabilidades; sigue sin usarse, así que no hay cambio de comportamiento, y se evita construir Multimedia sobre una versión vulnerable).
- **Frontend:** `npm audit fix` (→ `nanoid`) y **`vitest` `^2.1.8` → `^5.0.3`**, que era el único arreglo para las otras 5. `vite` **sigue en 6.4.3** (Vitest 5 acepta `^6.4`), así que el build de producción no cambió de herramienta.

### Decisiones descartadas
- `npm audit fix --force` (lo que sugiere npm): habría subido `uuid` a la 14, que es **solo ESM** y este backend es CommonJS. Como no se usa, se eliminó.
- No se agregó `engines` al `package.json` del frontend, aunque Vitest 5 exige Node `^22.12 || ^24 || >=26`: Render lo leería para elegir el Node del sitio estático (sin tope → "última versión") y cambiaría producción sin poder probarlo. El requisito queda solo en el README (Node ≥ 22.12).

### Verificación (Node 22.22.2, Linux)
- Backend: **123/123 en SQLite y 123/123 en Postgres**; `multer` 2.4.0 carga e instancia; `npm audit`: 0.
- Frontend: **43/43**; `vite build` OK (1657 módulos); `npm audit`: 0.
- Formato: CRLF preservado en todos los `package*.json`; cambios de `package.json`: backend (`multer` y `uuid`), frontend (solo `vitest`).

### Riesgos conocidos / no verificado
- **Render (frontend estático):** Vitest 5 pide Node ≥ 22.12. Si el servicio de Render del frontend usa un Node más viejo (los servicios creados antes del 2026-01-14 tienen otro default), `npm install` solo **avisa** (`EBADENGINE`, no falla) y el build usa `vite`, que no cambió. **No se verificó contra Render**: mirar el log del próximo build.
- **Requisito local más estricto:** para correr los tests del frontend hace falta Node ≥ 22.12 (el backend exige ≥ 22). Node 20, 23 y 25 quedan excluidos por Vitest 5.
- `multer` 2.x no se probó subiendo archivos (no hay rutas que lo usen): verificar cuando se implemente Multimedia.


## 38. `npm install` a secas: `backend/.npmrc`, Node 24 y el test que no era un test

**Contexto:** tras entregar `§36`/`§37`, en Windows el backend volvió a fallar. El log mostraba **Node 24.21.0** (ya cumplía el requisito) y `npm install` **sin** `--ignore-scripts`: `node-gyp` buscaba Python, abortaba, y `node_modules` quedaba incompleto (`Cannot find module 'express'`/`'dotenv'` en casi todos los tests). No eran tests rotos: los que no necesitan esos módulos pasaban. Era la **tercera** vez que se tropezaba con el flag, así que se dejó de depender de recordarlo. El frontend funcionó completo en Windows (43/43, `vite` levantó, 0 vulnerabilidades).

### Entorno reproducido
Node **24.21.0** + npm **11.21.0** (trae `node-gyp@12.4.0`, idéntico al log del usuario), obtenidos del registro de npm (paquetes `node` y `npm`). Con `npm install` plano reproduce el `node-gyp rebuild` de `better-sqlite3`.

### Solución: `backend/.npmrc` con `ignore-scripts=true`
Se evaluaron dos opciones, ambas probadas en el entorno reproducido:
- **`allowScripts: {"better-sqlite3": false}` en `package.json`** (mecanismo nuevo de npm): funciona en npm 11.21 y 12, pero **un npm 10 (el que trae Node 22) lo ignora** y vuelve a compilar. Descartada: un evaluador o colaborador con Node 22 volvería a fallar.
- **`.npmrc` `ignore-scripts=true`** (adoptada): lo entienden todas las versiones de npm. Es seguro acá porque el backend **no tiene hooks `pre`/`post`/`postinstall`** (verificado) y `npm run`/`npm start`/`npm test` siguen corriendo su script. Atajo para el caso contrario: `npm install --ignore-scripts=false`. Contra: apaga los scripts de instalación de *cualquier* dependencia futura que los necesite (documentado en el propio `.npmrc`).

### Render (producción)
- **Todos los runtimes nativos de Render corren Debian 12** (glibc 2.36, libstdc++ 3.4.30). El binario precompilado de Linux de `better-sqlite3` exige glibc ≥ 2.34 y libstdc++ ≥ 3.4.29 → cumple. Las herramientas `gcc`/`g++`/`make` figuran en la lista de Render, confirmando que hoy compila desde fuente.
- Con el `.npmrc`, el `buildCommand: npm install` del backend deja de compilar y usa el precompilado (build más rápido).
- **Producción no carga `better-sqlite3`**: `require('better-sqlite3')` está solo en la rama SQLite de `src/db/index.js`; con `DATABASE_URL` (Postgres) nunca se ejecuta. Verificado borrando por completo el binario: la suite contra Postgres pasó 101/102 (el único fallo es `validators.test.js`, un artefacto del arnés que importa las rutas sin configurar Postgres y por eso carga el adaptador SQLite). En la práctica es una dependencia solo de desarrollo.
- El `.npmrc` está en `backend/`, no en `frontend/`: el sitio estático de Render no cambia.

### El test que no era un test
El runner de Node 22+ toma por defecto cualquier archivo `**/test-*.js` como test. `scripts/test-pg.js` se ejecutaba dentro de `npm test` (frenado por el aviso "run() is being called recursively") y **contaba como 1 test sin probar nada**. Renombrado a **`scripts/run-tests-pg.js`** (con nota en el archivo). Por eso el total pasó de **123 a 122**: los números de `§35`/`§37` incluían ese test fantasma. `test/integration/helpers.js` también se cuenta como "test" por el patrón `**/test/**/*.js` (preexistente, inofensivo, no se tocó).

### Verificación (matriz; cada celda con copia limpia y `npm install` plano)
| Entorno | Resultado |
|---|---|
| Node 24.21.0 + npm 11.21.0 (el del usuario) | instala sin `node-gyp`, `better-sqlite3` carga, **122/122** |
| Node 22.22.2 + npm 10.9.7 | instala, **122/122** |
| Node 24.21.0 + npm 12.2.0 | instala |
| `npm ci` (Node 24.21 + npm 11.21) | OK |
| `npm install --ignore-scripts=false` | vuelve a intentar `node-gyp` (atajo de escape funciona) |
| `npm run test:pg` (Postgres real, Node 24.21) | **122/122**, sin schemas huérfanos |

### No verificado
- ~~**Windows:** todo se probó en Linux.~~ **Verificado por el usuario en Windows (2026-10-01):** `npm install` a secas (134 paquetes, 0 vulnerabilidades) y `npm test` **122/122**, usando el zip entregado. La terminal venía usando Node 24.21.0 en el intento anterior (este log no imprime la versión). Queda sin probar `npm run test:pg` en Windows (requiere Postgres local).
- **Render:** no se desplegó. Mirar el log del próximo build: ya no debería compilar `better-sqlite3`.
- **`EBUSY`/`EPERM` al instalar** (visto en los logs del usuario): el proyecto está en `Desktop`, que en Windows suele sincronizarse con OneDrive; es la causa típica, **no verificada**. Si reaparece, pausar OneDrive o mover el proyecto fuera de `Desktop`.


## 39. Capacidad al aprobar inscripciones (+ bug de `POST /api/projects` encontrado al verificarlo)

**Contexto:** cierra la decisión abierta de `§34`/`§35`. Se trató como corrección y no como decisión de producto: `AI_RULES.md` regla 20 exige `cupos_ocupados <= cupos`, y el alta de inscripción (`POST /api/enrollments`) ya devolvía 409 "El proyecto no tiene cupos disponibles" con el proyecto lleno. Pero `cupos_ocupados` cuenta solo **aprobadas**, así que podían acumularse pendientes sin tope y la ONG las aprobaba por encima de `cupos` (el control se evadía en el paso de aprobar).

### Qué se hizo (`routes/enrollments.js`)
- Dentro de la transacción de `PATCH /:id`, el `UPDATE` que suma el cupo pasó a ser **condicional y atómico**: `UPDATE projects SET cupos_ocupados = cupos_ocupados + 1 WHERE id=$1 AND cupos_ocupados < cupos`. Si no afecta filas se lanza `NoCapacityError`, que fuerza el **ROLLBACK de toda la transacción** (la inscripción conserva su estado anterior; un simple `return` habría hecho COMMIT del cambio de estado) y se responde **409** con el mismo mensaje que el alta.
- Sin leer-y-después-escribir: en Postgres, dos aprobaciones simultáneas con un solo cupo libre se serializan sobre la fila del proyecto y la segunda ve 0 filas afectadas.
- Cubre `pending→approved` y `rejected→approved`. **No** bloquea re-aprobar algo ya aprobado (sigue siendo el no-op de `§34`).
- **Frontend sin cambios:** `NGODashboard.tsx` y `NGOProjectDetail.tsx` ya hacen `catch (e) { alert(e.message) }`, así que la ONG ve el mensaje del servidor.
- El esquema tiene `cupos NOT NULL CHECK(cupos >= 0)`, por lo que la comparación nunca es contra NULL.

### Tests (`test/integration/enrollments-capacity.test.js`, 8)
Con 1 cupo: aprobar la primera funciona; la segunda da 409 **y queda `pending`** (verifica el rollback); re-aprobar la ya aprobada con el proyecto lleno es no-op 200; rechazar libera el cupo y la otra se puede aprobar; una `rejected` no se puede re-aprobar si otra ocupó el cupo. Con 2 cupos y 3 pendientes, 9 aprobaciones simultáneas: quedan exactamente 2 aprobadas, 1 pendiente, contador = 2.

### Verificación
- **Rojo → verde:** con el código viejo fallan 6 de 8 (en Postgres el 409 esperado llegaba como 200 y el contador pasaba de 1 a 2); con el nuevo pasan 8/8 en SQLite y Postgres.
- **Mutación** (`return` en vez de `throw`, o sea COMMIT del cambio de estado): detectada (`expected 'pending', actual 'approved'`).
- Suite completa: **130/130** en SQLite y Postgres (Node 22) y en SQLite con **Node 24.21.0**, con `TZ=America/Argentina/Cordoba`.

### ⚠️ Bug preexistente encontrado (NO arreglado, fuera de alcance)
**`POST /api/projects` puede devolver un proyecto equivocado.** Tras el `INSERT` hace `SELECT * FROM projects WHERE ngo_id=$1 ORDER BY created_at DESC LIMIT 1` y usa el resultado para la respuesta y para insertar `requisitos`, `project_roles` y `project_categorias`. En SQLite `created_at` tiene resolución de **1 segundo**: dos proyectos de la misma ONG creados dentro del mismo segundo empatan y la consulta devuelve el de menor `rowid` (el más viejo). Verificado: tras esperar a que pase el segundo del seed, A→A (bien), B inmediatamente después→**A (mal)**, C 1,1 s después→C (bien). La fila insertada queda correcta; **se confunden la respuesta y las asociaciones** (categoría/roles/requisitos podrían engancharse al proyecto equivocado). En Postgres (microsegundos) el riesgo es mucho menor pero el patrón sigue siendo frágil (concurrencia). *Mi primera hipótesis (un problema de formato ISO vs. espacio en el seed) era errónea y se descartó mirando los datos.* Arreglo posible: generar el id en JS (`crypto.randomUUID()`) y usarlo en el `INSERT` y en las asociaciones, o `RETURNING`. Los tests nuevos no dependen de esto: localizan el proyecto por título.

### Otra grieta de la misma invariante (anotada, sin tocar)
`PUT /api/projects/:id` guarda `cupos = parseInt(volunteers_needed) || 0` sin compararlo con `cupos_ocupados`: se puede bajar la capacidad por debajo de los ya aprobados. Con `cupos_ocupados >= cupos` las aprobaciones nuevas quedan bloqueadas (degradación segura), pero la invariante queda rota.

### Pendiente / decisiones abiertas
- ~~¿Arreglo `POST /api/projects` (id propio en vez de "el último por `created_at`")? Es el único cambio que sigue pendiente de este hallazgo.~~ ✅ hecho en `§40` (y en otros 4 lugares con el mismo bug).
- ~~¿`PUT /api/projects/:id` debe rechazar `volunteers_needed < cupos_ocupados` (400)?~~ ✅ hecho en `§40`.


## 40. Id propio en las altas (5 instancias del mismo bug) y capacidad en `PUT /api/projects/:id`

**Contexto:** cierra los dos pendientes de `§39`. Al arreglar el primero resultó que el bug no era uno solo sino un patrón repetido en el código.

### El patrón
Después de un `INSERT` sin id, se releía "la última fila" con `ORDER BY created_at DESC LIMIT 1`. En SQLite `created_at` tiene resolución de **1 segundo**: dos altas dentro del mismo segundo empatan y la consulta devuelve la **más vieja**. La fila insertada en la base queda siempre bien; lo que se confunde es lo que se **devuelve** (y, en proyectos, las asociaciones que se hacen sobre eso). Verificado en los 5 casos con tests que fallaban antes del arreglo.

| Dónde | Efecto del bug (SQLite) |
|---|---|
| `POST /api/projects` | respuesta con el proyecto equivocado; categoría/roles/requisitos enganchados al proyecto equivocado |
| `POST /api/ngos/:id/empleados` | respuesta con el empleado equivocado |
| `insertMessage` (`POST /api/messages` **y** WebSocket) | el remitente recibe el mensaje anterior; **el destinatario lo recibe en tiempo real repetido** y nunca el nuevo |
| `POST /api/projects/:id/comments` | respuesta con el comentario equivocado |
| `POST /api/projects/:id/kpis` | respuesta con el KPI equivocado |

(Son **5 lugares en el código**; `insertMessage` lo comparten el endpoint REST y el WebSocket, así que los caminos que ve el usuario son 6.) Los dos primeros se detectaron por mi propio test; los otros tres, al barrer el código buscando el mismo patrón. **No queda ningún `INSERT` seguido de "el último por `created_at`"** (verificado con `grep`).

### Arreglo
Generar el id en el código (`crypto.randomUUID()`: UUID v4, **el mismo formato** que el default de la base en ambos motores; las cinco tablas usan el mismo `UUID_PK`), insertarlo explícitamente y releer **por id**. Regla 23 en `AI_RULES.md`; advertencia en `DATABASE_CONTEXT.md`; convención en `API_CONTEXT.md`.

### `PUT /api/projects/:id`: capacidad
- No se puede bajar `volunteers_needed` por debajo de las inscripciones aprobadas (**400**). La condición va **dentro del `UPDATE`** (`WHERE id=$16 AND cupos_ocupados <= $9`), no en una lectura previa: así una aprobación concurrente se serializa sobre la misma fila en Postgres y no queda `cupos_ocupados > cupos`.
- `volunteers_needed` omitido o `null` **conserva** la capacidad (antes `parseInt(undefined) || 0` la pisaba con 0). Un valor explícito debe ser un entero ≥ 1 (mismo mensaje que al crear); antes un negativo violaba `CHECK(cupos >= 0)` y devolvía 500.
- **No** se corrigió que el `PUT` no sea una actualización parcial real para el resto de los campos (p. ej. `status` omitido vuelve a `'active'`): fuera de alcance, queda documentado. Ninguna pantalla del frontend usa este endpoint hoy.

### Tests (nuevos: 20)
`creation-and-capacity-edit.test.js` (12) e `insert-returns-own-row.test.js` (8, incluyendo **dos tests de WebSocket de punta a punta con sockets reales**: recepción de mensajes enviados por REST y enviados por el propio socket, con eco al remitente).

### Verificación
- **Rojo → verde:** con el código viejo en SQLite fallan las altas (proyectos ×2, empleados, mensajes ×2, comentarios, KPIs, WebSocket ×2) y, en Postgres, el `PUT` (3 tests, por sí solo). Con el nuevo pasan todos.
- **Mutación** sobre el `PUT`: quitar la condición atómica del `UPDATE` (falla el test de bajada de capacidad **y** el de carrera) y volver a pisar con 0 al omitir el campo (falla). Detectadas.
- Suite completa: **150/150** en SQLite y Postgres (Node 22) y en SQLite con **Node 24.21.0**, con `TZ=America/Argentina/Cordoba`. Frontend 43/43. Los tests de WebSocket (con temporización) se repitieron 6 veces seguidas: estables.

### Hallazgos honestos
- **En Postgres el bug de las altas casi no se manifiesta** (microsegundos): los tests nuevos de altas pasaban ahí incluso con el código viejo, con 6 altas simultáneas. El valor del arreglo es sobre todo para **SQLite** (desarrollo y tests) y para quitar un patrón frágil. Por eso estos tests de altas tienen que correr también en SQLite (regla 23).
- Una versión inicial de mi test de mensajes tenía un `if (r.status === 404) return` porque yo había **adivinado** la ruta de la conversación; un test que pasa en silencio si la ruta no existe no prueba nada. Se corrigió usando la ruta real (`/api/messages/thread/:userId`) con aserciones firmes.
- Mis números de línea quedaron desfasados por mis propias ediciones y por un momento miré el lugar equivocado; se resolvió buscando por texto en vez de por número.

### Pendiente / decisiones abiertas
- `PUT /api/projects/:id` no es una actualización parcial real (ver arriba). ¿Se quiere que lo sea?

## 41. `nodemon` → `node --watch` (el backend queda sin devDependencies)

**Contexto:** al verificar `§40`, la instalación limpia pasó de 0 a **3 vulnerabilidades altas** sin que se tocara ninguna dependencia: apareció un aviso nuevo (`braces` ≤ 3.0.3, denegación de servicio por patrones anidados en extremo) que llega por `chokidar` hasta `nodemon`, la única devDependency.

### Por qué no había otra salida
- **No existe una versión corregida de `braces`:** la última publicada (3.0.3) es justamente la afectada.
- El `nodemon` más nuevo (3.1.14) sigue dependiendo de `chokidar ^3.5.2`, que usa `braces ~3.0.2`. Ninguna actualización de `nodemon` lo resuelve.
- El "arreglo" que propone `npm audit` (`nodemon@1.14.10`, marcado MAJOR) es un **retroceso de años**: se descartó. Tampoco se usó `npm audit fix --force`.
- Era solo de desarrollo (en Render corre `npm start`, o sea `node src/index.js`) y el vector (patrones de glob controlados por un atacante en el watcher) no se expone; el cambio se hizo para dejar `npm audit` en 0 y quitar una dependencia, no por un riesgo explotable.

### Qué se hizo
- `"dev": "nodemon src/index.js"` → **`"dev": "node --watch src/index.js"`**. `node --watch` viene con Node (el proyecto ya exige ≥ 22) y no tenía configuración propia de `nodemon` que migrar (`nodemon.json`/`nodemonConfig`: no existían).
- `nodemon` fuera de `package.json`. El lockfile lo regeneró `npm uninstall` (no a mano): salieron **28 entradas** (la cadena `nodemon`, `chokidar`, `braces`, `brace-expansion`, `minimatch`, etc.), **no se agregó ni cambió la versión de ninguna otra dependencia**, y se conservó `hasInstallScript` de `better-sqlite3`. El bloque `devDependencies` desaparece entero.
- **Producción:** `startCommand` de Render es `npm run db:migrate && npm start` (no usa `dev`), así que no cambia. Render instala 27 paquetes menos.

### Diferencias de comportamiento a conocer
- `node --watch` reinicia al cambiar los archivos **del grafo de módulos importados**; `nodemon` miraba todos los `.js`/`.json` del directorio. En la práctica no cambia nada para este proyecto, pero un archivo suelto que nadie importe (p. ej. un script) ya no dispara reinicios.
- Un cambio en `.env` no reinicia (tampoco lo hacía `nodemon`).
- El mensaje al reiniciar es `Restarting 'src/index.js'` (antes `[nodemon] restarting due to changes...`).

### Verificación
- **`npm audit`: 0** (backend), también desde un `npm install` plano en copia limpia con **Node 24.21.0 + npm 11.21.0**.
- **`npm run dev` real** (por npm, no solo `node --watch` a mano): arranca (`/health` → 200), reinicia al tocar un módulo y responde 200 después; probado en Node 22.22.2 y en Node 24.21.0.
- Suite completa: **150/150** en SQLite y Postgres (Node 22) y en SQLite con **Node 24.21.0**, con `TZ=America/Argentina/Cordoba`.

### No verificado
- **Windows:** todo se probó en Linux. `node --watch` usa el observador de archivos del sistema (soporte nativo de Windows en Node ≥ 22), pero no se ejecutó allí.
- Un detalle de mi propia verificación: dos veces maté sin querer mi propio shell con un `kill` por patrón de texto que coincidía con mi comando; los resultados que importaban ya estaban impresos y se repitió la limpieza usando el PID.

## 42. Emails: `EMAIL_REDIRECT_TO` (modo prueba) y diagnóstico del error 403 de Resend

**Contexto:** al usar la app con el remitente de pruebas, los mails fallaban con `403 Testing domain restriction: The resend.dev domain is for testing and can only send to your own email address`, p. ej. al mandar a `admin@bancoalimentos.org`.

### Diagnóstico
**No era un bug del código sino una restricción de Resend:** con `onboarding@resend.dev` solo entrega al email con el que se registró la cuenta. Los usuarios del seed tienen direcciones inventadas, así que Resend las rechaza. El comentario original de `email.js` ya lo anticipaba, pero no había forma de trabajar con eso en desarrollo.

### Qué se hizo
- **`EMAIL_REDIRECT_TO`** (opcional, `lib/email.js`): redirige **todos** los emails a esa casilla. El destinatario original queda visible en el asunto (`[para: x@y.com] ...`) y en un aviso al principio del cuerpo (HTML escapado con la función `esc` de `emailTemplates.js`, que ahora se exporta). Con varios destinatarios se manda **un** solo email.
- **Falla cerrado:** si `EMAIL_REDIRECT_TO` está definido pero no parece un email, **no se manda nada** (`invalid_redirect`) y se explica en el log. Es preferible a que un error de tipeo termine mandándoles mails de prueba a usuarios reales.
- **Diagnóstico del 403:** se reconoce el error (las dos redacciones conocidas de Resend) y se loguea **qué hacer**, una vez por proceso; el fallo de cada email se sigue registrando. Si ya hay redirección activa pero Resend igual rechaza, el mensaje dice que `EMAIL_REDIRECT_TO` debe ser **exactamente** el email de la cuenta de Resend.
- **Línea `Email:` en el log de arranque** (`describeEmailConfig()`, nunca incluye la key): desactivado / remitente de pruebas (con su limitación) / modo prueba / valor inválido / dominio propio. Advierte si la redirección está activa con `NODE_ENV=production`.
- **La configuración se lee en cada envío** y no al cargar el módulo (antes eran constantes de módulo): la hace visible y testeable.
- `.env.example` y `BACKEND_CONTEXT.md` ("Emails (Resend) y modo prueba") documentados.

### Cómo se usa
- **Local:** en `backend/.env`, `EMAIL_REDIRECT_TO=<el email con el que te registraste en Resend>` y reiniciar. Debe verse en el arranque `Email:   Resend → MODO PRUEBA: todo redirigido a ...`.
- **Render:** definir `RESEND_API_KEY` y `EMAIL_REDIRECT_TO` en *Environment* del servicio del backend y redeployar (`render.yaml` no declara variables de email). Con la redirección activa en producción **ningún usuario real recibe sus emails**: sirve para una demo, no para uso real.
- **Solución definitiva:** verificar un dominio propio en https://resend.com/domains, definir `EMAIL_FROM` con una dirección de ese dominio y dejar `EMAIL_REDIRECT_TO` vacío.

### Tests (nuevos: 29)
`test/unit/email.test.js` (25, con `fetch` reemplazado: destinatario, asunto, cuerpo, escape, varios destinatarios, falla cerrado, espacios, vacío, los dos textos del 403, un 403 por otra causa que no se confunde, 500, error de red, y `describeEmailConfig` en cada modo incluida la ausencia de la key) y `test/integration/email-redirect-flow.test.js` (4, **de punta a punta con los handlers reales**: inscripción → mail a la ONG, aprobación → mail a la voluntaria, propuesta de patrocinio → mail a la ONG, respuesta → mail a la empresa; los 4 salen a la casilla de prueba y ninguno a usuarios del seed).

### Verificación
- **Rojo → verde:** los 16 tests nuevos de `email.test.js` fallaban con el `email.js` anterior (pasaban los 8 comportamientos que ya existían); el de punta a punta también falla con el código viejo.
- **Mutación (4 de 4 detectadas):** que la redirección inválida deje de fallar cerrado, que la redirección no cambie el destinatario, que el aviso no escape el HTML, y que la explicación del 403 salga en cada email.
- Suite completa: **179/179** en SQLite y Postgres (Node 22) y en SQLite con **Node 24.21.0**, con `TZ=America/Argentina/Cordoba`.
- El arranque real se probó en los 6 modos y se comprobó que una API key reconocible **no aparece** en el log.

### Hallazgo en el camino
`test/integration/helpers.js` fija `RESEND_API_KEY = ''` dentro de `setupTestServer()` **a propósito** (ningún test debe mandar mails reales aunque el `.env` de quien lo corra tenga una key). Mi primer test de punta a punta definía la key antes y el helper la pisaba: pasaba "0 emails capturados" y lo habría leído como fallo del código. Se resolvió definiéndola **después** de levantar el servidor (posible porque ahora la configuración se lee en cada envío) y se dejó comentado en el test. Además el test fija `EMAIL_FROM` para no depender del `.env` de cada máquina.

### No verificado
- **La entrega real con Resend.** El sandbox no tiene acceso a `api.resend.com` ni una API key: lo verificado es que el request sale bien armado (a quién, asunto, cuerpo) contra un doble de `fetch`. Si Resend cambiara el formato del error 403, el diagnóstico caería al mensaje genérico `resend_403` (el email igual falla igual que antes).
- Que el email de `EMAIL_REDIRECT_TO` coincida con el de tu cuenta de Resend: no hay forma de comprobarlo desde acá; si no coincide, Resend lo rechaza con el mismo 403 y el log lo explica.

### Pendiente / decisiones abiertas
- Verificar un dominio propio para que cada usuario reciba su email (hoy el modo prueba es un paliativo).

## 43. Momentos (publicaciones con fotos) — Etapa 1: backend

**Pedido:** que los voluntarios suban fotos vinculadas a los voluntariados en los que participaron, y verlas como publicaciones tipo Instagram. Se acordó el diseño con estos valores: pueden publicar los voluntarios con inscripción **aprobada** y también la ONG dueña; solo likes (sin comentarios en v1); el autor borra lo suyo y la ONG dueña del proyecto modera; visibilidad pública; hasta 5 fotos por post, sin videos; se ve en una pestaña del feed, en el proyecto y en el perfil. **Esta entrega es la Etapa 1 (backend).** El frontend (feed estilo Instagram, compositor con compresión en el navegador, galerías) es la Etapa 2 y todavía no existe.

### Qué se construyó
- **Tablas** `posts`, `post_media`, `post_likes` (+5 índices) con **FK reales y `ON DELETE CASCADE`** (se apartó de la tabla `media` polimórfica del roadmap: no deja fotos ni likes huérfanos). Total: **31 tablas**.
- **`lib/storage.js`**: Cloudinary por **REST con `fetch`**, sin SDK (misma lógica que `email.js`). Subida y borrado firmados, detección del tipo **real** de imagen por cabecera (JPEG/PNG/WebP), URLs optimizadas (`f_auto,q_auto,w_1080` para el feed y miniatura cuadrada `w_480,h_480,c_fill`).
- **`routes/posts.js`** (7 endpoints, ver `API_CONTEXT.md`): proyectos elegibles, crear, feed paginado (filtros por proyecto y autor), detalle, like/unlike idempotentes, borrar/moderar.
- `lib/storage` se muestra en el arranque (`Fotos: Cloudinary (nube)` / `sin configurar`) sin filtrar credenciales; `.env.example` documentado.

### Decisiones de diseño que importan
- **Todo se valida antes de subir nada** (sesión/rol → configuración → formulario → campos → permiso → límite → cabecera real de cada archivo → recién ahí se sube): una foto inválida entre varias válidas rechaza todo el post sin gastar cuota.
- **Si la subida falla a mitad se borran las fotos que sí se subieron** (no quedan huérfanas) y se responde 502 sin detalles internos. Post + fotos se guardan en **una transacción después** de las llamadas externas (que no van adentro; regla 21/24).
- **No se confía en el `mimetype` que declara el cliente**: se verifica la cabecera real. Un HTML renombrado `.jpg` o un WAV (`RIFF` sin `WEBP`) se rechazan.
- **Límite de frecuencia**: 10 publicaciones por usuario por hora, calculado con `toMillis()` sobre las últimas 10 (sin aritmética de fechas por motor); persiste entre reinicios. No es estricto bajo concurrencia.
- **Respuesta con claves exactas**, `created_at` siempre ISO UTC (SQLite devolvía un string sin zona y Postgres un `Date`), `likes_count` normalizado con `Number()`, y `provider_id` nunca expuesto.
- **Paginación `limit/offset`** con desempate por id (se descartó keyset por `created_at`: en Postgres el driver trunca los microsegundos a milisegundos y se perderían filas).

### Tests (nuevos: 70)
`test/unit/storage.test.js` (23) y `test/integration/posts.test.js` (45), más 2 en `sqlTranslate.test.js`. La firma se ancla al **vector de prueba oficial** de Cloudinary (`bfd09f95…`, con `api_secret abcd`): se calculó con la implementación y **coincide**. Cobertura de las rutas: elegibilidad (pendiente no cuenta), quién puede/no puede publicar y que en ningún caso se sube nada, validaciones, falla a mitad de la subida con limpieza, feed público, orden, filtros, paginación, likes (idempotencia y 8 simultáneos), borrado con cascada y moderación, y el límite de frecuencia.

### Verificación
- **Rojo → verde** en las rutas (38 de 45 fallaban sin implementación). Suite completa: **249/249** en SQLite y Postgres (Node 22) y en SQLite con **Node 24.21.0**, `TZ=America/Argentina/Cordoba`; sin schemas huérfanos.
- **Mutación de las rutas (8 de 8 detectadas):** que una inscripción pendiente alcance, no verificar la cabecera, no limpiar ante una falla, que cualquier ONG pueda moderar, like sin `ON CONFLICT`, sin límite de frecuencia, orden invertido, y exponer `provider_id`. **Mutación del módulo de storage (4 de 4):** firma con `api_key`, firma sin ordenar, aceptar cualquier `RIFF`, y mandar el secreto en el formulario.

### Hallazgos honestos
1. **Bug latente del adaptador, corregido:** `translatePg` reescribía `ON CONFLICT DO NOTHING` como el texto `OR IGNORE` **en el mismo lugar**, lo que produce `INSERT ... VALUES (...) OR IGNORE`, SQL inválido en SQLite. Ninguna ruta lo usaba y su test solo comparaba el texto de la sustitución. Los likes lo hicieron aparecer (500 en SQLite). SQLite ≥ 3.24 entiende la cláusula de forma nativa (verificado en la 3.53, con y sin objetivo de conflicto), así que **se quitó la traducción**; el test ahora **ejecuta** el SQL contra una SQLite real. Regla 13 actualizada.
2. **Un error mío en los tests:** silencié `console.error` de forma global y eso **escondió el error real del servidor** (el 500 de arriba). Un mock demasiado amplio oculta justo lo que hay que ver; se acotó a los dos tests que provocan fallos a propósito.
3. **Otro error mío:** una aserción decía que el `public_id` no debía aparecer en la respuesta, pero la URL pública de Cloudinary lo contiene por construcción. Lo que no se expone es el **campo** `provider_id` (lo cubre la comprobación de claves exactas).
4. **Mutante equivalente:** mi primera mutación de "exponer `provider_id`" no cambiaba nada observable (la consulta ni seleccionaba la columna); se rehízo seleccionando y exponiendo, y entonces fue detectada. No era un hueco del test.
5. **Una guarda mal pensada en `detectImageType`:** un mínimo global de 12 bytes (pensado para WebP) rechazaba un JPEG válido de 11 bytes; ahora cada formato exige el largo que necesita (JPEG 3, PNG 8, WebP 12).
6. Mi `grep` de conteo de tablas sobrecontaba por coincidir con texto de comentarios; el número real (31) se verificó contra el esquema.

### ⚠️ NO verificado
- **La subida real a Cloudinary.** El sandbox no tiene acceso a su API ni una cuenta: `fetch` y las funciones de storage se reemplazan por dobles. Lo anclado a la fuente oficial es el **algoritmo de firma** (vector de la documentación); lo no verificado es todo el intercambio real (el formato exacto de la respuesta, el comportamiento de la cuenta). Se asume SHA-1 (el algoritmo documentado por defecto); si una cuenta estuviera configurada para exigir otro, Cloudinary respondería "Invalid Signature" y el log lo orienta (`CLOUDINARY_API_SECRET`...). **Se verifica con una subida real en cuanto haya credenciales.**
- **Que `multer` 2.x lea bien un multipart real desde un navegador**: los tests mandan `FormData` de Node con `fetch`, no un navegador. Se cubre en la Etapa 2.
- Windows (todo se probó en Linux).

### Límites conocidos (decisiones, no olvidos)
- Borrar un **usuario o proyecto** elimina sus posts por cascada en la base, pero **no** los archivos en Cloudinary (solo se borran al borrar el post por la API).
- El límite de 10/hora no es estricto si llegan pedidos simultáneos del mismo usuario.
- `GET /api/posts` no filtra por "seguidos" (solo `project_id` y `user_id`); se deja para cuando el frontend lo pida.
- No hay denuncia de publicaciones (solo moderación por la ONG dueña y borrado por el autor).

### Pendiente — Etapa 2 y 3 *(resuelto: Etapa 2 en §47, Etapa 3 en §48)*
- **Etapa 2 (frontend):** pestaña "Momentos" con feed estilo Instagram (tarjeta con carrusel, corazón, texto), compositor (selector de proyecto, vista previa, **compresión a ~1600 px en el navegador antes de subir**, aviso de subir solo fotos propias o con permiso), y sus tests.
- **Etapa 3:** galería en el detalle del proyecto, grilla en el perfil público del voluntario, y acciones de moderación en la pantalla de la ONG.

## 44. Aviso crítico en `proxy-addr` (dependencia transitiva de `express`)

**Contexto:** al verificar `§43` desde un zip limpio, `npm install` pasó a reportar **1 vulnerabilidad crítica** cuando antes daba 0, sin que se hubiera tocado ninguna dependencia (`package.json` y el lockfile no habían cambiado): apareció un aviso nuevo, igual que había pasado con `braces` (`§41`).

### Qué era
`proxy-addr` 2.0.7, **dependencia transitiva de `express`** (producción), con el aviso *"vulnerable to IP spoofing via IPv4-mapped IPv6 trust subnet"* (GHSA-jqcg-44mw-7w3h, CVSS 9.1, afecta `>=1.1.0 <2.0.8`). Es el mecanismo con el que `express` decide en qué proxies confiar cuando se configura `trust proxy`.

### Exposición real
**Prácticamente nula hoy:** el código no usa `trust proxy`, `req.ip`, `req.ips` ni `X-Forwarded-For` (verificado con `grep` en `src/`), así que ese camino no se ejecuta. Importa hacia adelante: un rate limiting **por IP** (que está en el roadmap) sí dependería de ese mecanismo, y detrás del proxy de Render habría que configurar `trust proxy`.

### Arreglo
A diferencia de `braces`, **tiene arreglo compatible** (`fix: true`, sin salto de versión mayor): `npm audit fix` (sin `--force`) en una copia descartable. Único cambio del lockfile: **`proxy-addr` 2.0.7 → 2.0.8** (nada agregado ni quitado; `package.json` intacto; `express` pide `~2.0.7`, que admite la 2.0.8; CRLF preservado). `npm audit`: **0**.

### Verificación
Instalación limpia desde el lockfile nuevo (instala la 2.0.8) y suite completa: **249/249** en SQLite y en Postgres (Node 22).

### Un error mío de proceso
El zip de `§43` se había armado **antes** de encontrar este aviso y, al arreglar el lockfile, **no lo regeneré**: durante un rato el archivo entregado todavía traía la versión vulnerable. Se reconstruyó y se verificó desde cero que `audit` da 0. Lección: después de cualquier cambio posterior al empaquetado, volver a empaquetar y volver a verificar **el zip**, no solo el árbol de trabajo.

## 45. Aviso en `source-map-js` (frontend): otro aviso nuevo sin que se tocara nada

**Contexto:** al instalar el frontend en Windows, `npm install` reportó **1 vulnerabilidad alta** que en `§37` estaba en 0. No se había modificado ninguna dependencia del frontend desde entonces: apareció un aviso nuevo (como `braces` en `§41` y `proxy-addr` en `§44`). Es un patrón a esperar: **`npm audit` depende de una base de avisos que cambia**, así que un proyecto con 0 hoy puede mostrar 1 mañana sin un solo cambio de código.

### Qué era
`source-map-js` 1.2.1, dependencia **transitiva** (`vite` → `postcss` → `source-map-js`): *"allows event-loop denial of service through indexed source-map section offsets"* (GHSA-68fv-2mgg-jv7q, CVSS 7.5, afecta `>=1.0.0 <1.2.2`). La usa el compilador para leer source maps **mientras se construye** el sitio; **no forma parte de lo que se publica** ni corre en el navegador. Para explotarlo habría que darle al propio build un archivo hostil: exposición real prácticamente nula.

### Arreglo
Tiene arreglo compatible (`fix: true`): `npm audit fix` (sin `--force`) en una copia descartable. Único cambio del lockfile: **`source-map-js` 1.2.1 → 1.2.2** (nada agregado ni quitado, `package.json` intacto, CRLF preservado). `npm audit`: **0**. **43/43** tests y `vite build` OK (1657 módulos).

### Sobre el aviso de `esbuild` ("install scripts not yet covered by allowScripts")
Es de la política de scripts de instalación de los npm nuevos y **es inofensivo**: el postinstall de `esbuild` solo verifica su binario y el paquete usa el binario de su dependencia opcional de la plataforma; los tests y el build funcionan igual sin ejecutarlo (verificado en Windows por el usuario y en Linux). No se hizo nada.

### Proceso
Esta vez se regeneró el zip **después** del cambio y se verificó el zip mismo (corrección del error de `§44`).

## 46. Momentos — Etapa 2 (frontend), primera parte: piezas de base y `can_delete` (se completó en §47)

> **Estado honesto:** esta entrega **no incluye todavía ninguna pantalla** de Momentos. Está el backend completo (`§43`) y, del frontend, las piezas de base. Para un usuario, lo único que cambia es el arreglo de `timeAgo`.

### Hecho en esta entrega
- **`can_delete` en la API (backend).** Cada publicación trae un booleano calculado por el servidor según quién mira, con la misma regla que `DELETE /api/posts/:id` (autor, o ONG dueña del proyecto). Hace falta porque el cliente conoce el id del usuario autor pero **no** quién es la ONG dueña del proyecto, así que no puede decidir solo si mostrar el botón de borrar. Se verificó contra el `DELETE` real (si el flag es `false`, borrar da 403; si es `true`, funciona).
- **`api.posts` + helper de subida multipart (frontend).** El helper **no fija `Content-Type`**: `req()` fuerza `application/json`, y con eso el servidor nunca recibiría los archivos.
- **`lib/imageCompress.ts`**: compresión de fotos en el navegador (1600 px, JPEG 0,82, fondo blanco para PNG transparentes, sin tocar fotos chicas y livianas, mensajes de error para el usuario). Sus dependencias del navegador se inyectan, para probar la lógica real sin `canvas`.
- **Arreglo de `timeAgo`** (afecta a toda la app).

### Hallazgo importante: `timeAgo` mostraría "NaN min"
`timeAgo` le pegaba una `Z` a **todo** timestamp, pensado para el formato viejo sin zona (`"2026-08-10 11:55:00"`). La API de Momentos devuelve ISO 8601 completo (`"...T12:30:45.000Z"`), con lo que quedaba `"...000ZZ"`: fecha inválida. Se detectó **al diseñar la tarjeta, antes de escribirla**, leyendo la utilidad que iba a reutilizar. Ahora acepta ambos formatos (el ISO con `Z` u offset se respeta; sin zona se asume UTC) y devuelve `''` ante un valor que no es una fecha, con la misma lógica de zona que `toMillis` del backend.

### Tests (nuevos: 35 en total en esta entrega)
- **Backend:** 6 de `can_delete` (255 en total).
- **Frontend:** 5 de `timeAgo`, 9 del cliente `api.posts`, 14 de `imageCompress` (71 en total).

### Verificación
- Backend **255/255** en SQLite y Postgres (Node 22); frontend **71/71**; `vite build` OK (1657 módulos); `tsc`: los mismos 3 errores preexistentes de `ImportMeta.env`, ninguno propio.
- **Mutación (10 de 10 detectadas):** `can_delete` ignorando a la ONG dueña; en el cliente, forzar `Content-Type: application/json` en la subida y descartar un `offset=0`; en la compresión, sin fondo blanco, agrandar fotos chicas, no liberar el bitmap y recomprimir siempre.

### Errores míos en esta etapa
1. En mis primeros tests de `can_delete` dejé una condición **absurda** en el test del listado (`|| p.project.id === 'proj-0'`) y otra comprobación que comparaba el flag contra mi propia expectativa en vez de contra el `DELETE` real. Se reescribieron.
2. Esos tests creaban publicaciones de María y **consumían el límite de 10 por hora** que los tests de este archivo comparten, haciendo fallar tests de borrado que antes pasaban. Se rehicieron con Juan como autor (en un proyecto de otra ONG). Lección: en un archivo con límite de frecuencia, el presupuesto de publicaciones es un recurso compartido.
3. Mi regex sobre el formato de fecha corta asumía `"01 jul"`; este entorno devuelve `"01-jul"`. Se cambió por una comparación independiente del formato (ISO vs. formato viejo dan lo mismo para el mismo instante).
4. `npm run build` parecía no imprimir nada: era el problema de siempre de mi sandbox (`vite` sin permiso de ejecución por venir de un zip, código 127), no del proyecto; se verificó con `node node_modules/vite/bin/vite.js build`.

### Pendiente (Etapa 2) *(resuelto en §47)*
`PhotoCarousel`, `PostCard` (like optimista, borrar según `can_delete`), `PostComposer`, `FeedTabs`, `MomentsFeed`, las rutas `/momentos` y `/ngo/momentos`, la pestaña en `MainFeed`/`PublicFeed`, y sus tests. Luego la Etapa 3 (galería del proyecto y grilla del perfil).

## 47. Momentos — Etapa 2 (frontend) completa: pantallas, rutas y pestañas

**Pedido:** las pantallas de Momentos sobre las piezas de base de §46, con las decisiones ya acordadas (publican voluntarios con inscripción aprobada y la ONG dueña; solo likes; el autor borra lo suyo y la ONG dueña modera según `can_delete` del servidor; visibilidad pública; hasta 5 fotos; pestaña dentro del feed). **No se tocó el backend.**

### Qué se construyó
`PhotoCarousel`, `PostCard`, `PostComposer`, `FeedTabs`, `MomentsFeed`, `MomentsPage` (`/momentos`) y `NGOMoments` (`/ngo/momentos`); `truncateText` y `userMessage` en `lib/format.ts`; pestañas en `MainFeed` y `PublicFeed`; acceso de la ONG por su barra lateral y por un botón en el header de `NGODashboard`. Detalle y reglas de comportamiento en `FRONTEND_CONTEXT.md` (sección "Momentos").

### Decisiones que tomé (revisables)
1. **Las pestañas son enlaces** (`/feed` ↔ `/momentos`), no estado local: funcionan el botón "atrás" y los links directos, y no se cargan los dos feeds a la vez.
2. **`PublicFeed` redirige a todo usuario logueado**, así que su pestaña solo la ve el visitante (ahí Momentos es de lectura y el like abre el modal de ingreso).
3. **No hay ítem nuevo en ninguna barra inferior** (la del voluntario y la de la ONG ya tienen 5). La ONG entra por la barra lateral (escritorio) y por un botón en el header de `NGODashboard` (celular).
4. **Una ONG que abre `/momentos` es redirigida a `/ngo/momentos`** (tiene su propio menú). Una empresa ve `/momentos` y su pestaña "Proyectos" va a `/explore` (el `/feed` es el feed personalizado de un voluntario).
5. **El feed recarga cuando cambia el id del usuario**: `liked_by_me` y `can_delete` los calcula el servidor según quién mira, y un visitante puede iniciar sesión desde el modal sin salir de la pantalla (si no, quedaban calculados para un anónimo).
6. **Paginación**: el `offset` avanza por lo que el servidor devolvió (no por lo mostrado), se deduplica por id y el offset se corrige al borrar/publicar. Una publicación nueva que no corresponde al filtro de la vista no se agrega.
7. Confirmaciones con `window.confirm` (igual que el cierre de sesión de `NGOBottomNav`).

### Tests (nuevos: 158)
Frontend **71 → 229**: `PhotoCarousel` 17, `FeedTabs` 5, `PostCard` 34, `PostComposer` 36, `MomentsFeed` 36, `MomentsPage` 6, `NGOMoments` 3, ruteo 3, `NGOSidebarNav` 2, pestañas en `MainFeed`/`PublicFeed` 2, y 14 de `format.ts` (`truncateText` y `userMessage`). `useAuth` se simula con `vi.mock`; `PostCard` y `PostComposer` se reemplazan por dobles al probar `MomentsFeed`.

### Verificación
- **Rojo → verde** en cada pieza (los tests se escribieron antes que la implementación y fallaron primero). Ojo: en varios casos el rojo fue "el módulo no existe", que es un rojo débil; por eso se sumó la mutación.
- **Mutación: 75 mutantes, 73 detectados.** Los 2 que sobreviven son **equivalentes**: quitar `if (deleting) return` en `PostCard` (el botón ya está `disabled`; es defensa en profundidad) y quitar la bandera `cancelled` del compositor (en React 18, `setState` tras desmontar no tiene efecto observable). Hubo **11 sobrevivientes en la primera pasada** (9 reales + 2 equivalentes); los 9 reales eran huecos de mis tests y se cerraron con tests nuevos que ahora los matan (ver errores).
- `vite build` OK. `tsc` (instalado fuera del proyecto): **0 errores en los archivos nuevos**; quedan 5 en archivos que no toqué (`ImportMeta.env` en `api.ts` y `NGOEmpleados.tsx`, y `global`/`.at` en `setup.ts` y `api.posts.test.ts`, por no tener `@types/node` ni los tipos de Vite en ese chequeo).
- Backend sin cambios: ver el resumen de la entrega para los números del zip.

### Errores míos en esta etapa
1. **Inicial del avatar en el nombre accesible**: sin avatar, la letra ("M") entraba en el nombre del enlace ("M María García"). Lo detectó un test; se marcó `aria-hidden`.
2. **Mi primer helper del test de rutas estaba mal** (comparaba `route.Component`, pero `createBrowserRouter` lo normaliza a `element`): dio un falso rojo incluso para `/ngo/:id`, que ya existía. Se vio porque falló algo que no debía fallar, y se corrigió antes de implementar. Ese test, de paso, confirmó el riesgo real: sin la ruta nueva, `/ngo/momentos` caía en el perfil público de una ONG.
3. **Huecos en mis tests (9 mutantes reales sobrevivieron)**: el corte a mitad de palabra y el umbral de `truncateText`; el `Escape` mientras se sube (el `window.confirm` de jsdom devuelve `undefined`, lo que tapaba la falla); el reset del `input` de archivos; el bloqueo del botón tras publicar; el doble toque en la misma pasada; el aviso de borrado de un id que ya no está; la respuesta vieja de "Ver más" tras cambiar de filtro; y que la pantalla de la ONG no oculte el compositor. Los tests del compositor pasaron todos al primer intento, y eso fue justamente lo que me hizo desconfiar y mutar.
4. **El arnés de mutación murió a mitad de camino** (el proceso en segundo plano no sobrevivió al fin de la llamada) y dejó `PostCard.tsx` con un mutante aplicado. Lo detecté comparando checksums, lo restauré y verifiqué que todos los archivos coinciden con los originales antes de seguir.
5. **Entorno**: `apt-get install postgresql` falló con 404 hasta hacer `apt-get update`. Y el sandbox tiene Node 22.22.2 / npm 10.9.7, no Node 24.21 / npm 11.

### ⚠️ NO verificado
- **Cómo se ve nada** (no hay navegador): maquetación, Tailwind, proporciones del carrusel, el modal en celular.
- **El deslizar con el dedo** en un dispositivo real (los tests simulan los eventos `touch`).
- **Foco y teclado del modal**: no hay *focus trap* ni se devuelve el foco al cerrar. Solo se probó Escape.
- **`compressImage` con un `canvas` real** (los tests usan dobles) y **que `multer` lea un multipart que mande un navegador real** (los tests del backend usan `FormData` de Node). Sigue pendiente lo de §43: **la subida real a Cloudinary**.
- **El botón "Momentos" de `NGODashboard`** no tiene test propio (esa pantalla no tiene tests); el de la barra lateral sí.
- Windows, Render, Resend.

### Límites conocidos
- En `/momentos` ningún ítem de la barra del voluntario queda resaltado ("Inicio" solo se marca en `/feed`).
- Un visitante en `/momentos` ve la barra del voluntario (mismo comportamiento que ya tenía en `/explore`).
- No hay denuncia de publicaciones ni comentarios (decisión de producto de §43).

### Pendiente — Etapa 3 *(resuelto en §48)*
Galería en `ProjectDetails`, grilla de miniaturas en `VolunteerPublicProfile` y moderación en pantallas de la ONG. `MomentsFeed` ya acepta `filters` (`project_id`/`user_id`).

## 48. Momentos — Etapa 3 (galerías y moderación)

**Origen (importante):** el código base de esta etapa (`MomentsGrid` + su test, `MomentsPlacement.test.tsx` y las secciones "Momentos" de `ProjectDetails`, `VolunteerPublicProfile` y `NGOProjectDetail`) **no lo escribí en el turno donde lo revisé**: apareció en el árbol de trabajo después de entregar el zip de §47. El autor aclaró después que un turno se había trabado, que lo interrumpió con Escape y reenvió el mensaje, así que ese turno interrumpido llegó a escribir esos archivos. Se decidió **adoptarla**; lo que sigue es la revisión y el endurecimiento, no el diseño original.

**Qué hay:** `MomentsGrid` en la galería del proyecto (`project_id`) y en el perfil público del voluntario (`user_id`, id de *usuario*); `MomentsFeed` filtrado por proyecto y sin compositor en `NGOProjectDetail` (moderación: el borrado lo decide `can_delete` del servidor).

**Revisión:** se leyó el código completo. La lógica de paginación/recarga replica la de `MomentsFeed` (offset por lo devuelto, deduplicar, recarga por id de usuario, descartar respuestas viejas) y los ids de ruta son los correctos (`/project/:id`, `/volunteer/:id` = id de usuario).

**Mutación: 22 mutantes.** Con los tests heredados **sobrevivieron 11** (offset en la 3.ª página, doble toque, borrar y corrimiento del offset, aviso de un id inexistente, respuestas viejas de la carga inicial y de "Ver más", indicador de fotos, cierre del modal al recargar, error de "Ver más", filtro `user_id`). Se agregaron 9 tests y **los 22 quedan detectados**. Los tests de integración (`MomentsPlacement`) ya mataban los 4 mutantes de ubicación/filtros.

**Tests:** frontend **249** (los 229 de §47 + 11 heredados: 8 de `MomentsGrid` y 3 de ubicación + 9 nuevos de `MomentsGrid`).

**No verificado:** lo mismo de §47 (nada visual, sin navegador, Cloudinary, compresión con canvas real) y el límite del modal (me gusta dentro del modal queda desactualizado al reabrir; solo por lectura).

## 49. Verificación local de Cloudinary y Resend (hecha por Matías, no por Claude)

**Qué pasó:** al probar la primera subida real, `POST /posts` respondió un error de Cloudinary: `403 … Request forbidden due to missing permissions (actions=["create"])`. Era un problema de **configuración de la cuenta/API key de Cloudinary**, no de código (el error llegó bien armado hasta la pantalla). Las causas probables que se le indicaron: cuenta creada para otro producto (Media Optimizer en vez de Programmable Media), API key con permisos restringidos, o credenciales mezcladas. **Matías no dijo cuál era**; solo que después funcionó, así que la causa concreta queda sin documentar.

**Resultado informado por Matías:** *en local, Cloudinary y Resend funcionan.* Esto lo verificó él en su máquina; yo no pude (sin navegador ni acceso a esos servicios).

**Lo que eso implica (inferencia, no comprobación mía):** como el 403 se produjo dentro de `POST /posts`, antes de eso el navegador ya había comprimido las fotos y mandado el multipart, y `multer` lo había leído; los dos puntos "no verificados" de §47 sobre eso quedan razonablemente cubiertos, aunque no se hizo una prueba específica de cada uno.

### Sigue sin verificar
- **Producción (Render):** `render.yaml` **no declara** `CLOUDINARY_*`, `RESEND_API_KEY`, `EMAIL_FROM` ni `APP_URL`; hay que cargarlas a mano en el panel de Render (o agregarlas a `render.yaml` con `sync: false`, decisión pendiente de Matías). Sin ellas, publicar responde 503 y los emails se omiten. Tampoco se verificó la versión de Node de Render ni el log de build. *(Declaradas en `render.yaml` en §50; los valores secretos se siguen cargando en el panel.)*
- **Resend con dominio propio / usuarios reales:** con `onboarding@resend.dev` solo se entrega al email registrado en Resend (ver `EMAIL_REDIRECT_TO` en `BACKEND_CONTEXT.md`).
- Lo visual y táctil de §47 (Tailwind, deslizar en celular real, foco del modal) y Windows.


## 50. `test:pg` fallaba en paralelo: `columnExists()` no filtraba por schema · variables de Resend/Cloudinary en `render.yaml`

**Contexto:** al armar el `CLAUDE.md` se corrieron todas las verificaciones en Windows (12 núcleos, Node 24.21.0, Postgres 16.15 en Docker). SQLite daba 255/255, pero `npm run test:pg` fallaba: entre 2 y 140 tests cancelados, **distinto en cada corrida**, con `❌ Error en migraciones: column "estado" does not exist`.

### Causa
`columnExists()` en `scripts/migrate.js` consultaba `information_schema.columns` filtrando solo por tabla y columna, **sin filtrar por schema**. En `test:pg` cada archivo de test migra su propio schema (`test_<pid>_<rand>`) en la misma base y los archivos corren en paralelo. Si otro schema ya tenía `empresa_voluntariados.estado`, `addColumnIfNotExists()` se salteaba el `ALTER TABLE` en el schema propio y después fallaba el índice sobre esa columna. Por eso el resultado dependía del orden y de cuántos archivos corrían a la vez. Además, los schemas de las corridas fallidas **quedaban sin borrar** (la limpieza no llegaba a correr) y rompían también las corridas siguientes.

Con los archivos de a uno (`-- --test-concurrency=1`) y la base limpia pasaba 255/255, lo que confirmó la causa antes de tocar código.

**Arreglo:** `AND table_schema = current_schema()`: el schema donde `CREATE TABLE` crea las tablas (el primero del `search_path` que existe), así que la consulta mira el mismo lugar que la migración. En producción (solo `public`) el comportamiento no cambia.

### Tests (nuevos: 2, solo en `test:pg`)
`test/integration/migrate-schemas.test.js`: migra un schema, después otro en la misma base, y exige que el segundo no falle, que tenga `estado`/`mensaje`/`updated_at` y las **mismas columnas** que el primero; y que volver a migrar sea idempotente. No depende del paralelismo: reproduce el bug de forma determinística. En SQLite se saltea (ahí no hay schemas). `helpers.js` ahora exporta `pgConfig` y `USE_PG_TESTS`.

### Verificación
- **Rojo → verde:** sin el arreglo, los 2 tests fallaban con el mismo error que la suite (`column "estado" does not exist`); con el arreglo, pasan.
- **Mutación (2 de 2 detectadas):** sacar el filtro de schema (el bug original) y fijarlo a `'public'` (falla con `column "latitud" of relation "projects" already exists`).
- **Suites completas:** SQLite **255/255** (normal y con `TZ=America/Argentina/Cordoba`); Postgres **257/257** **en paralelo** (sin `--test-concurrency`), tres corridas (una con la TZ de Córdoba), 0 schemas sobrantes antes y después.

### `render.yaml`: variables de Resend y Cloudinary (pedido del usuario)
Se declararon en el servicio `voluntariar-api`: `APP_URL` (`https://voluntariar.onrender.com`; sin ella los links de los emails apuntaban a `http://localhost:5173`), `EMAIL_FROM` (el mismo remitente de pruebas que el default del código), y `RESEND_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` con `sync: false` (el valor no va en el repo). Las opcionales (`EMAIL_REDIRECT_TO`, `CLOUDINARY_FOLDER`) no se declararon. El YAML se validó con `js-yaml`. README actualizado.

### Errores míos
1. **Convertí `migrate.js` de CRLF a LF** al editarlo con `sed -i` desde Git Bash (convierte el archivo entero). Lo vi con `git ls-files --eol`, lo restauré a CRLF y rehíce el comentario con Node; el diff final son 3 líneas. Lección: en este repo, editar archivos CRLF con `Edit`/Node, no con `sed`.
2. Al principio supuse que `test:pg` solo necesitaba un Postgres levantado; la primera corrida con Docker ya mostró que había un bug.

### ⚠️ NO verificado
- **Render:** no se desplegó. No verifiqué si, en un Blueprint **ya creado**, Render pide los valores de las variables `sync: false` nuevas al sincronizar o si hay que cargarlas a mano en el panel (no consulté la documentación de Render). Tampoco que `APP_URL` sea la URL real del frontend desplegado: se tomó de `CORS_ORIGINS`.
- Por qué la verificación anterior en Postgres (Linux) no lo detectó: probablemente corría menos archivos en paralelo, pero no lo comprobé.

## 51. Chatbot de FAQs: 500 siempre en Postgres (`activo=1` sobre BOOLEAN) — REVISION B1

**Contexto:** primer ítem del orden de arreglo de `docs/REVISION.md` (revisión del 2026-10-13). Las 6 consultas de `routes/faqs.js` filtraban `WHERE activo=1`; en Postgres la columna se crea `BOOLEAN` (`migrate.js`) y `boolean = integer` es un error de tipos. Resultado: `GET /api/faqs` y `POST /api/faqs/ask` respondían 500 siempre en Postgres (producción). Ningún test tocaba `/api/faqs`, por eso `test:pg` no lo veía.

**Arreglo:** `activo=true` en las 6 consultas, el mismo literal que ya usan `messages.js` y `notifications.js`; SQLite lo toma como 1. Comentario en el código con el porqué. La regla se sumó a `AI_RULES.md` regla 13 y a las trampas de `CLAUDE.md`.

### Tests (nuevos: 5, en los dos motores)
`test/integration/faqs.test.js`: catálogo completo (8 FAQs de `migrate.js`, forma de cada una), filtro por categoría con orden, `ask` con coincidencia, `ask` sin coincidencia con sugerencias de la categoría, y una FAQ desactivada (`UPDATE faqs SET activo=false`) que no aparece en el catálogo (con y sin categoría), ni como respuesta, ni en las sugerencias (con y sin categoría).

### Verificación
- **Rojo → verde:** en Postgres, los 5 fallaban con `operator does not exist: boolean = integer` (el mismo 500 que la revisión vio con el seed); con el arreglo, pasan. En SQLite pasaban antes y después (el bug es solo de Postgres).
- **Mutación (14 mutantes, script descartable fuera del repo):** por cada aparición de `activo=true`, volver a `activo=1` y sacar el filtro (`1=1`). En Postgres murieron 12; los 2 sobrevivientes son la aparición dentro del **comentario** (equivalentes). En SQLite sobreviven además los 6 `activo=1` (equivalentes ahí por diseño: `1` ≡ `true`; mueren en Postgres) y mueren los 6 "sin filtro". **Ningún sobreviviente no equivalente.** Un primer pase dejó vivo "sin filtro" en las sugerencias sin categoría; se agregó ese assert antes de la corrida final.
- **Suites completas:** SQLite **260/260** y Postgres **262/262** (Postgres 16 en Docker), las dos también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome), contra Postgres:** backend en un schema descartable (`verif_b1`, migrado y sembrado, borrado al terminar) y frontend con Vite, sin tocar los `.env`. Sin sesión, el widget `ChatbotWidget` mostró las 4 sugerencias y respondió "como cancelo mi inscripcion?" con la FAQ correcta. Sin errores en la consola durante la pregunta; la consola se empezó a leer después de cargar la página, así que la carga inicial no quedó registrada. Con sesión (categoría por rol) no se probó.

### Errores míos
1. El primer test de "FAQ desactivada" no miraba las sugerencias de `ask` **sin** categoría: lo vi al planear la mutación y lo agregué antes de correrla.

### ⚠️ NO verificado
- El widget con sesión iniciada (filtra por la categoría del rol): solo lo cubren los tests de la API con `categoria`. Tampoco se vio en el celular.
- Producción: no hay deploy (ver §50).

## 52. Listado de proyectos sin roles ni requisitos en Postgres — REVISION B2

**Contexto:** segundo ítem de `docs/REVISION.md`. `GET /api/projects` tiene dos ramas (`BACKEND_CONTEXT.md §2`). En la de Postgres, roles y requisitos salen de `json_agg`, y `pg` ya entrega esas columnas como arrays de JS. `parseJson` (de `fmt`) les hacía `JSON.parse(array)`, que lanza, y el `catch` devolvía `[]`. Además, los roles se agregaban como objetos (`jsonb_build_object('nombre', …)`) en lugar de strings. Con el seed, en Postgres 0 de 12 proyectos traían roles o requisitos; en SQLite, 12 de 12.

**Arreglo** (`routes/projects.js`): `parseJson` devuelve tal cual lo que ya es array; en la rama Postgres, `json_agg(DISTINCT ro.nombre)`, así la forma es `string[]`, como en SQLite, en `GET /:id` y en `api.ts` (`roles_needed: string[]`). Los `DISTINCT` ya estaban y siguen siendo necesarios: los JOIN con roles × requisitos multiplican filas.

### Tests (nuevos: 3, en los dos motores)
`test/integration/projects-list-shape.test.js`, con el seed: (1) cada proyecto del listado (`limit=100`) trae los mismos roles y requisitos que su `GET /:id`, sin importar el orden (ninguna de las dos consultas tiene `ORDER BY`); (2) el seed tiene proyectos con roles y con requisitos, para que (1) no pase sin comparar nada; (3) todos los roles y requisitos del listado son strings.

### Verificación
- **Rojo → verde:** en Postgres fallaban (1) y (2) (`actual: []`, `expected: ['Conductor', 'Voluntario general']`); (3) pasaba solo porque las listas venían vacías, y es el que detecta los roles como objetos (lo confirmó la mutación). En SQLite los 3 pasaban antes y después.
- **Mutación (5 mutantes, en Postgres, script descartable):** sacar el `Array.isArray`, que devuelva `[]`, volver a `jsonb_build_object`, sacar el `DISTINCT` de roles y el de requisitos: **5 de 5 detectados**. En SQLite esa rama no se ejecuta.
- **Suites completas:** SQLite **263/263** y Postgres **265/265**, las dos también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_b2`, borrado al terminar): por la API, 12 de 12 proyectos con roles y requisitos. Explorar, la portada y el feed con sesión (voluntaria del seed) cargan, todas las llamadas a `/api/projects` dan 200 y no hay errores en la consola.

### Corrección a la revisión
`REVISION.md` decía que "feed y explorar muestran todos los proyectos sin roles ni requisitos". **No es así:** ninguna pantalla que consume `GET /api/projects` (Explorar, `PublicFeed`, la barra lateral de `MainFeed`, `CompanyOwnProfile`) muestra roles ni requisitos. El único componente que los dibuja es `FeedPostCard`, y sus datos vienen de `/api/follows/feed`, que tiene su propia consulta (no afectada). El bug era real en el contrato de la API, pero hoy no tenía efecto visible. Si alguien hubiera mostrado los roles del listado, los objetos `{nombre}` habrían roto el render de React.

### Errores míos
1. La severidad "alta" de B2 en la revisión se apoyó en un impacto visual que no comprobé (ver arriba). Lo vi recién al buscar en el navegador dónde se mostraban los roles.

### ⚠️ NO verificado / visto y no tocado
- **Otras diferencias entre las dos ramas, fuera de este cambio:** la de Postgres busca también por nombre de categoría (`c.nombre LIKE`) y la de SQLite no. Además, con un `LEFT JOIN` a `project_categorias` y `c.nombre` en el `GROUP BY`, un proyecto con dos categorías saldría **dos veces** en Postgres (el seed no tiene ninguno así; no lo probé). Quedan para decidir con el usuario.
- Requisitos repetidos dentro de un mismo proyecto: el `DISTINCT` los junta en el listado y el detalle no. No pasa con el seed.

## 53. Hora del chat: "Invalid Date" con timestamps de Postgres — REVISION F1

**Contexto:** tercer ítem de `docs/REVISION.md`. `formatTime` (`frontend/src/lib/format.ts`), que pone la hora en cada burbuja de `ChatThread.tsx`, hacía `new Date(iso.replace(' ', 'T') + 'Z')`. En Postgres `created_at` es `Date` y la API lo manda como `"2026-10-14T01:46:36.887Z"`; con la segunda `Z` queda una fecha inválida. Es el mismo error que §46 arregló en `timeAgo`; `formatTime` había quedado afuera y su único test usaba el formato de SQLite.

**Arreglo:** `formatTime` usa `parseBackendDate` (la misma de `timeAgo`) y devuelve `""` si el valor no es una fecha, en vez de mostrar "Invalid Date". Se documentó en `FRONTEND_CONTEXT.md` y en las trampas de `CLAUDE.md`: toda fecha del backend pasa por `parseBackendDate`.

### Tests (nuevos: 4, `src/lib/format.test.ts`)
ISO con `Z` y milisegundos (lo que manda Postgres), formato viejo sin zona (SQLite, se toma como UTC), offset explícito (`-03:00`) y valor inválido → `""`. La hora esperada se arma con el mismo formateador sobre `Date.UTC(...)`, así el test no depende de la zona horaria de la máquina.

### Verificación
- **Rojo → verde:** 3 fallaban (`Received: "Invalid Date"`); con el arreglo pasan los 4.
- **Mutación (5 mutantes, script descartable, cada uno en dos zonas horarias):** sacar el chequeo de `NaN`, devolver otro texto, volver al parseo viejo (`+ 'Z'`), interpretar la hora sin zona como local y cambiar el formato de la hora. **5 de 5 detectados.**
- **Suite del frontend:** **253/253**, también con `TZ=America/Argentina/Cordoba`; `format.test.ts` además con `TZ=Asia/Tokyo`.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_f1`, borrado al terminar): con la voluntaria del seed mandé un mensaje a la ONG y recargué la conversación. La API devolvió `created_at: "2026-10-14T01:46:36.887Z"` y la burbuja mostró **"10:46 p. m."** (22:46 en Córdoba = 01:46 UTC, correcto). **Contraprueba:** con el `format.ts` anterior, la misma burbuja mostró **"Invalid Date"**. Sin errores en la consola.

### Errores míos
Ninguno detectado en este cambio.

### ⚠️ NO verificado
- La hora del mensaje **recién enviado**, antes de recargar (viene de la respuesta del POST o del WebSocket): la miré solo después de recargar. Tiene el mismo formato ISO, así que debería verse igual.
- En el celular.

## 54. Búsqueda y filtro de modalidad distinguían mayúsculas en Postgres — REVISION B8

**Contexto:** cuarto ítem de `docs/REVISION.md`. `GET /api/projects` filtraba con `LIKE`, que en Postgres distingue mayúsculas (en SQLite no, para ASCII). Buscar "maratón" no encontraba "Maratón Solidaria" en Postgres, y el filtro `modality` no reconocía "Remoto"/"Virtual" con mayúscula en la ubicación: un proyecto así no salía en remotos y sí en presenciales.

**Arreglo** (`routes/projects.js`): `ILIKE` en las 6 líneas de búsqueda y modalidad, en **las dos ramas** para que sigan iguales (`translatePg` ya convierte `ILIKE` → `LIKE` en SQLite, incluido `NOT ILIKE`). Comentario en el código. Se sumó a las trampas de `CLAUDE.md`.

### Tests (nuevos: 4, en los dos motores)
`test/integration/projects-search.test.js`, con el seed: el título en minúsculas y en mayúsculas ASCII ("maratón", "MARAT"); la descripción ("HERRAMIENTAS DIGITALES"), el nombre de la ONG ("techsocial") y la ubicación ("galpón central", que no aparece en el título); "Remoto + visitas…" y "Virtual (Zoom)" con `modalidad='presencial'` (se cambia la columna en el test y se restaura) tienen que salir en `modality=remoto` y no en `presencial`.

### Verificación
- **Rojo → verde:** en Postgres fallaban los 3 primeros tests (`actual: []`); con el arreglo, pasan. En SQLite pasaban antes y después. El cuarto test (Virtual) se agregó después, al revisar la cobertura ocurrencia por ocurrencia: no lo vi en rojo, pero la mutación de esa línea lo pone rojo.
- **Mutación (9 mutantes, en Postgres, script descartable):** volver a `LIKE` cada `ILIKE` de la rama Postgres, de a uno. **8 detectados; sobrevive 1, no equivalente: `c.nombre ILIKE`** (buscar por nombre de categoría). Queda sin test porque solo la rama Postgres busca por categoría (la de SQLite no), y un test de eso fallaría en SQLite. Es la diferencia entre ramas ya anotada en §52, pendiente de decisión. Los `ILIKE` de la rama SQLite son equivalentes a `LIKE` por construcción (`translatePg`).
- **Suites completas:** SQLite **267/267** y Postgres **269/269**, las dos también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_b8`, borrado al terminar): en la portada, sin sesión, buscar "maratón" (con Enter: el formulario no busca mientras se escribe) mandó `GET /api/projects?search=marat%C3%B3n` → 200 y quedó una sola tarjeta, "Maratón Solidaria de Donaciones". No repetí en el navegador la prueba con el código viejo: el rojo del test en Postgres ya lo muestra.

### Corrección a la revisión
Igual que en B2, el impacto visible es menor que lo que decía `REVISION.md`: Explorar filtra en el navegador (no manda `search` ni `modality`). La búsqueda del servidor solo la usa la portada, y el filtro `modality` del servidor no lo usa ninguna pantalla.

### Errores míos
1. En B2 (§52) actualicé el "N+1" de `BACKEND_CONTEXT.md` pero no el mismo texto en `API_CONTEXT.md`; lo corregí acá.
2. El primer test de ubicación buscaba "barrio güemes", que también está en el **título** del proyecto: no probaba la búsqueda por ubicación. Lo cambié a "galpón central" antes de la mutación.

### ⚠️ NO verificado / visto y no tocado
- **Tildes (probado en los dos motores):** ningún motor las ignora ("maraton" no encuentra "Maratón"). Arreglarlo pide `unaccent` (extensión de Postgres) o normalizar en una columna aparte: es una decisión, no la tomé.
- **SQLite y mayúsculas no ASCII (probado):** "MARATÓN" no encuentra "Maratón" en SQLite (dev), sí en Postgres. No afecta a producción.
- La búsqueda por categoría solo existe en Postgres (ver §52).

## 55. Tests de autorización por dueño entre ONGs — REVISION T1

**Contexto:** quinto ítem de `docs/REVISION.md`. Los controles de dueño existen en el código (`WHERE ... AND p.ngo_id = $n`) y la revisión no encontró IDOR, pero solo `posts.test.js` probaba una "ONG ajena": si alguien sacaba un filtro, ningún test se ponía rojo. Cambio **solo de tests**, sin tocar código de rutas, para tener una red antes de modificar más rutas.

### Tests (nuevos: 13, en los dos motores)
`test/integration/ownership.test.js`, con el seed. Green Córdoba (ngo-2) intenta operar sobre recursos de Sustentando (ngo-1, dueña de `proj-1`). Los KPIs y la propuesta de patrocinio (de TechCorp) se crean en el `before`, por la API. Cada caso comprueba el código **y que la base no cambió**:
- ver las inscripciones de `proj-1` (403, sin emails); aprobar o rechazar (404, sin cambio de estado ni de cupo); cargar horas (404);
- editar y borrar `proj-1` (404, el proyecto queda igual);
- crear, editar y borrar KPIs de `proj-1` (403), y editar o borrar el KPI ajeno **pasando por la URL de un proyecto propio** (`/projects/proj-2/kpis/<kpi de proj-1>`: el KPI no cambia);
- ver o decidir el patrocinio propuesto a `proj-1` (no aparece en su lista; PATCH → 404, sigue "propuesto");
- ver en su propio panel (`GET /ngos/me` y `/ngos/ngo-2/dashboard`) la inscripción pendiente de `proj-1`, que trae el email del voluntario;
- ver el dashboard o los empleados de ngo-1, o agregarle empleados (403, no se crea nada).

Al final, **la ONG dueña hace lo mismo con los mismos ids y le funciona** (ver, cargar horas, aprobar, editar el KPI, aceptar el patrocinio, editar, borrar el KPI y el proyecto). Eso prueba que los rechazos no venían de un id mal armado.

### Verificación
- **No hay rojo → verde:** son tests de un comportamiento que ya era correcto. La prueba de que sirven es la mutación.
- **Mutación (script descartable, en SQLite y en Postgres):** cada filtro de dueño se rompió de a uno (`X = $n` → `(X = $n OR 1=1)`, conserva los parámetros): 3 en `enrollments.js`, 7 en `projects.js` (PUT/DELETE de proyecto, POST/PUT/DELETE de KPI y los dos `project_id` de las consultas de KPI) y 7 en `ngos.js` (`/me` y dashboard con pendientes, lista y PATCH de patrocinios, dashboard y empleados GET/POST). **17 de 17 detectados en los dos motores.** Un primer pase dejó vivos los filtros de pendientes de `GET /ngos/me` y del dashboard (líneas 93 y 276); agregué el test de "pendientes ajenas en su propio panel" y murieron.
- El mismo texto de búsqueda agarró 2 consultas más (`ngos.js:134` y `:228`, los proyectos **públicos** de una ONG en su perfil). Sobreviven. **No son equivalentes:** sin el filtro, el perfil mostraría proyectos de otras ONGs. Pero no son autorización (son datos públicos), así que quedan fuera de T1.
- **Suites completas:** SQLite **280/280** y Postgres **282/282**, las dos también con `TZ=America/Argentina/Cordoba`.
- `AI_RULES.md` regla 15: todo endpoint nuevo con control de dueño suma su caso a este archivo.

### Errores míos
Ninguno en el código. El primer pase de los tests no cubría las pendientes que muestran `/ngos/me` y el dashboard; lo detectó la mutación.

### ⚠️ NO verificado / fuera de alcance
- **REVISION B18 (sigue abierto; confirmado en SQLite y Postgres con un script descartable):** `PUT /projects/<propio>/kpis/<kpi ajeno>` no modifica nada, pero **responde 200 con el KPI ajeno** (nombre, valor y `project_id` de la otra ONG), porque relee por id sin filtrar por proyecto. El test comprueba que la base no cambia y no mira la respuesta, para no mezclar el arreglo con este cambio de solo tests.
- No se probaron empresas entre sí (el seed tiene una sola), ni voluntarios contra inscripciones ajenas (`DELETE /enrollments/:id` filtra por `user_id`; no se mutó).
- Las rutas `/ngo/*` del frontend siguen sin guarda (deuda conocida); el control real es el del backend, que es lo que se prueba acá.

## 56. KPIs: fuga de datos de otra ONG y 200 sin hacer nada · comentar un proyecto inexistente — REVISION B18

**Contexto:** el usuario pidió adelantar B18 después de que §55 lo confirmara. Había tres problemas en `routes/projects.js`:
1. `PUT /projects/:id/kpis/:kpiId` controlaba que `:id` fuera de la ONG, pero después releía el KPI **solo por id**. Con la URL de un proyecto propio y el id de un KPI ajeno (`/projects/proj-2/kpis/<KPI de proj-1>`), el UPDATE no tocaba nada (filtra por proyecto), pero la respuesta era **200 con el KPI de la otra ONG** (nombre, valor, `project_id`). Confirmado en los dos motores (§55).
2. PUT y DELETE de un KPI inexistente, o de otro proyecto, respondían 200 (`{}` o "KPI eliminado") sin hacer nada.
3. Comentar un proyecto inexistente daba **500** (la FK rechazaba el INSERT) en vez de 404.

**Arreglo:** PUT y DELETE de KPI miran `changes` del UPDATE/DELETE (que ya filtran por `id AND project_id`): si es 0 → **404** "KPI no encontrado en este proyecto". La relectura del PUT también filtra por proyecto (defensa extra). El POST de comentarios comprueba que el proyecto exista antes de insertar → **404**. `API_CONTEXT.md` actualizado. De paso corregí en esas mismas líneas dos errores de D6: el PUT de KPI **no es parcial** y el DELETE responde `{ message: "KPI eliminado" }`, no `{ success: true }`.

### Tests (nuevos: 8, en los dos motores)
`test/integration/project-subresources.test.js`: PUT y DELETE de un KPI ajeno por la URL de un proyecto propio (404, sin datos ajenos en la respuesta, el KPI no cambia ni se borra), PUT y DELETE de un KPI inexistente (404), la dueña edita (200 con el KPI) y borra (200, y el segundo intento da 404), comentario a un proyecto inexistente (404, no se guarda nada) y a uno existente (201). El comentario de `ownership.test.js` que decía "la respuesta no se prueba acá" ahora apunta a este archivo.

### Verificación
- **Rojo → verde:** en los dos motores fallaban los 6 casos de error (200 donde debía haber 404; 500 en el comentario) y pasaban los 2 de control. Con el arreglo pasan los 8.
- **Mutación (script descartable, los dos motores):** sacar el 404 del PUT, invertirlo, sacar el 404 del DELETE y sacar el chequeo de proyecto del comentario: **detectados**. Sobrevive "la relectura del PUT sin filtrar por proyecto". Es **equivalente**: el 404 de arriba ya garantiza que el KPI es de ese proyecto, y el filtro queda como defensa extra.
- **Suites completas:** SQLite **288/288** y Postgres **290/290**, las dos también con `TZ=America/Argentina/Cordoba`.

### Errores míos
1. El primer pase de mutación reportó como sobreviviente el chequeo del comentario. Era un error de mi script: la misma línea (`if (!project) return … 'Proyecto no encontrado'`) aparece también en `GET /:id`, y `replace` mutó la primera aparición. Repetido apuntando a la línea correcta (847), murió en los dos motores (`actual: 500`).

### ⚠️ NO verificado
- **En el navegador:** no lo probé. El camino feliz no cambió; los errores ya se muestran en `NGOKPIs.tsx` (el formulario muestra el mensaje y el borrado hace `alert`). Borrar exige un `confirm()`, que bloquea la extensión de Chrome. **Cambio de comportamiento:** borrar un KPI que ya no existe (p. ej. borrado desde otra pestaña) antes desaparecía en silencio y ahora muestra "KPI no encontrado en este proyecto".
- El PUT de KPI sigue sin ser parcial y, sin `nombre`, probablemente da 500 (D6, a confirmar). No lo toqué.
- `POST /projects/:id/ratings` sobre un proyecto inexistente: no lo revisé.

## 57. Agregados sin `Number()` en el perfil de voluntario y el feed de seguidos — REVISION B9

**Contexto:** en Postgres `COUNT`/`SUM` llegan como string (bigint/numeric) y en SQLite como número (§33, `AI_RULES` regla 13). Quedaban dos endpoints sin normalizar: `GET /api/voluntarios/:userId` (`stats.total_enrollments`, `stats.approved_enrollments`, `stats.total_horas` y `volunteer.following_count`) y `GET /api/follows/feed` (`total`). Usaban `x || 0`, que no arregla nada: `'3' || 0` es `'3'`, y **`'0' || 0` también es `'0'`** (un string no vacío es truthy).

**Barrido previo:** revisé todos los `COUNT`/`SUM`/`AVG` del backend. El resto ya se normaliza (`num()` en `empresas.js`; `parseInt`/`parseFloat` en las stats de `ngos.js`; `Number()` en `posts.js`, en `fmt` de proyectos y en el `ratingByProject` de recomendados). Solo quedaban estos dos.

**Arreglo:** `Number(x) || 0` en los 5 campos (como `num()` de `empresas.js`). `CLAUDE.md` ahora aclara por qué `x || 0` no alcanza.

### Tests (nuevos: 3, en los dos motores)
`test/integration/aggregates-are-numbers.test.js`, con el seed: perfil de María con valores exactos (`{ total_enrollments: 3, approved_enrollments: 2, total_horas: 2.5 }`, `following_count: 2`), perfil de Lucía sin inscripciones ni seguidos (los ceros tienen que ser `0`, no `'0'`) y `total` del feed después de seguir a ngo-1 (`3`, igual a la cantidad de proyectos devueltos).

### Verificación
- **Rojo → verde:** en Postgres fallaban los 3 (`'3'`, `'2'`, `'0'`); con el arreglo pasan. En SQLite pasaban antes y después.
- **Mutación (5 mutantes, Postgres, script descartable):** sacar cada `Number()` de a uno. **4 detectados.** Sobrevive `Number(total_horas)`, **equivalente hoy**: `horas_realizadas` es REAL, `SUM(real)` devuelve `real` y `pg` ya lo entrega como número (en el rojo llegaba `2.5` bien). Lo dejé por consistencia y por si la columna pasa a NUMERIC.
- **Suites completas:** SQLite **291/291** y Postgres **293/293**, las dos también con `TZ=America/Argentina/Cordoba`.
- **Sin navegador, a propósito:** `VolunteerPublicProfile.tsx` solo muestra estos valores (no hace cuentas con ellos) y `"3"` se ve igual que `3`. No había efecto visible: era el contrato de tipos de `api.ts` (`number`), que en Postgres no se cumplía.

### Errores míos
1. El primer test suponía que María no seguía a nadie y que Lucía no tenía seguidos. El seed tiene María → Juan y Lucía → María, así que el primer `following_count: 1` "pasaba" por el seed y no por mi follow. Lo corregí antes del arreglo: María sigue además a Lucía (espero 2) y el caso de ceros borra primero los seguidos e inscripciones de Lucía.

### ⚠️ NO verificado
Nada pendiente de este cambio.

## 58. Guardar habilidades con un id repetido las borraba todas — REVISION B6

**Contexto:** `PUT /api/voluntarios/me/habilidades` reemplaza el set completo: DELETE de todas las filas del voluntario y un INSERT por cada habilidad, **sin transacción**. El `Set` de ids servía solo para validar contra el catálogo; los INSERT recorrían el body tal cual. Con un `habilidad_id` repetido, el segundo INSERT violaba la PK `(user_id, habilidad_id)` **después** del DELETE: respondía 500 y el voluntario se quedaba sin ninguna habilidad. El endpoint no tenía tests.

**Arreglo** (`routes/voluntarios.js`):
- Se deduplica con un `Map` `habilidad_id → nivel`. **Gana la última aparición**, coherente con "el body es el estado final", como dice el comentario del endpoint. Decisión mía; la alternativa era responder 400 ante repetidos.
- DELETE + INSERT van en `db.transaction()` con `tx.*` (regla 21): si un INSERT falla, quedan las habilidades anteriores.

### Tests (nuevos: 5, en los dos motores)
`test/integration/habilidades.test.js`, con María del seed (sin habilidades):
- guardar el set completo;
- **id repetido** → 200, se guarda una vez con el nivel de la última aparición;
- un pedido inválido (habilidad inexistente → 400) no toca lo guardado;
- **falla inyectada en un INSERT después del DELETE** → 500 y se conservan las habilidades anteriores;
- un array vacío las borra todas.

La falla se inyecta en el adaptador (`db.run` y el `tx.run` de la transacción, para no depender de cómo esté escrita la ruta). Es la única forma de llegar a ese caso: con la validación y el dedup, ningún pedido válido falla ahí.

### Verificación
- **Rojo → verde:** en los dos motores fallaba el caso del id repetido (`actual: 500`). El test de la falla inyectada lo agregué después del arreglo, al ver que ningún test del API podía detectar que se sacara la transacción. La mutación confirma que la detecta.
- **Mutación (4 mutantes, los dos motores, script descartable):** que gane la primera aparición, sin dedup (recorrer el body), **sin transacción** (el callback se ejecuta con `db` en lugar de `tx`) y otro nivel por defecto. **4 de 4 detectados en SQLite y en Postgres.**
- **Suites completas:** SQLite **296/296** y Postgres **298/298**, las dos también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_b6`, borrado al terminar): con María, en "Mi Perfil" → editar, elegí Cocina e Idiomas y guardé. La página se recarga y muestra "Cocina · Básico" e "Idiomas · Básico". En la base quedaron esas dos filas con nivel `basico`.

### Errores míos
Ninguno detectado.

### ⚠️ NO verificado
- Desde la interfaz no se pueden mandar ids repetidos (cada habilidad es un botón que se marca o desmarca), así que el caso del repetido se probó solo por el API.
- Concurrencia: dos guardados simultáneos del mismo voluntario. Con la transacción, en Postgres el segundo DELETE espera al primero. No lo probé.

## 59. Alta de proyecto: roles/requisitos sin validar y alta a medias sin transacción — REVISION B5

**Contexto:** `POST /api/projects` hacía el INSERT del proyecto y después, en queries sueltas, categoría, roles y requisitos:
- `roles_needed: "Chef"` (string) se recorría **letra por letra** y creaba los roles "C", "h", "e", "f" en el catálogo global (que `/api/roles` lista a todos);
- un elemento no-string (`[123]`) fallaba en `.trim()` **después** del INSERT: 500 con el proyecto creado sin asociaciones (y un reintento lo duplicaba);
- la respuesta devolvía `roles_needed`/`requirements` tal como venían en el body (con espacios, repetidos y vacíos), no lo guardado;
- los `.catch(() => {})` para "ignorar duplicados" no servirían dentro de una transacción de Postgres, porque un error la aborta entera.

**Arreglo** (`routes/projects.js`):
- `cleanTextList()` valida **antes de crear nada**: ausente → `[]`; si no, array de strings, a lo sumo 20, rol 2–40 y requisito 3–100 caracteres (los límites de `CreateVoluntariado.tsx`). Recorta y saca repetidos. `category`, si viene, string de hasta 60. Si algo no cumple → 400.
- No copié la regex de letras de roles del frontend: los tests existentes usan roles como "Rol 1", y la regla 3 pide no duplicar más validaciones.
- Todo el alta en `db.transaction()` con `tx.*`. Categoría y roles se crean con `ON CONFLICT (nombre) DO NOTHING` (seguro ante otra alta concurrente que cree el mismo nombre) y se releen por nombre (UNIQUE). Sin `.catch` adentro.
- La respuesta usa las listas limpias.

**Cambio de comportamiento:** antes un rol o requisito vacío o demasiado corto se salteaba en silencio; ahora es 400. El frontend no los manda (valida lo mismo antes).

### Tests (nuevos: 11, en los dos motores)
`test/integration/projects-create-validation.test.js`. Cada rechazo comprueba 400, mensaje, **que no se creó el proyecto y que el catálogo de roles no cambió**:
- `roles_needed` y `requirements` como string; `roles_needed` como objeto; elementos número, objeto y `null`;
- largos fuera de rango (1, solo espacios, 41; requisito de 2 y de 101); 21 roles y 21 requisitos; `category` como array.

Además, los casos válidos:
- los extremos (2/40/3/100 y 20 de cada uno) se aceptan;
- recorte y repetidos: la respuesta coincide con `GET /:id`;
- sin listas en el body → `[]`;
- **falla inyectada en el INSERT de requisitos** (en `db.run` y en el `tx.run`, como en §58) → 500 y no queda ni el proyecto, ni el rol nuevo, ni la categoría nueva.

### Verificación
- **Rojo → verde:** en SQLite fallaban 8 de 10 (201 donde iba 400, 500 con el proyecto a medias, la respuesta con el body crudo, el proyecto que quedaba tras la falla); pasaban los 2 de control. Con el arreglo pasan todos, junto con `creation-and-capacity-edit.test.js`. El caso "objeto" lo agregué antes de la mutación: con un string, la falta de `Array.isArray` no se notaba (cada letra mide 1 < 2).
- **Mutación (13 mutantes, los dos motores, script descartable):** sin `Array.isArray`, los cuatro límites (`<`/`<=`, `>`/`>=`), sin tope de cantidad, sin dedup, sin recorte, sin chequeo de categoría, **sin transacción**, sin `ON CONFLICT` en roles y en categorías, y respuesta con el body crudo: **12 detectados en SQLite y Postgres.** Sobrevive "sin `typeof`" (`item?.trim?.() ?? null`), **equivalente** para JSON: número, `null` u objeto tampoco tienen `trim` y terminan en `null` → 400.
- **Suites completas:** SQLite **307/307** y Postgres **309/309**, las dos también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_b5`, borrado al terminar): como Sustentando, completé los 3 pasos de "Nuevo Voluntariado" (Salud, roles Coordinador y Fotógrafo, requisitos "Ropa cómoda" y "Mayor de 18 años") y publiqué. `POST /api/projects` → 201, el panel mostró el proyecto nuevo, sin errores en la consola. En la base quedaron la categoría, los 2 roles y los 2 requisitos.
- `API_CONTEXT.md`: además de lo nuevo, corregí dos errores que ya tenía esa sección: decía que `validateProject` pasa por `hasBadWord()` (no lo hace; solo comentarios y posts) y que sin perfil de ONG respondía 403 (es 404).

### Errores míos
1. En el primer borrador de tests, "roles como string" pasaba también sin el chequeo de array (por el largo mínimo). Lo detecté al planear la mutación y agregué el caso del objeto.

### ⚠️ NO verificado / para decidir
- **Catálogo abierto:** cualquier ONG sigue pudiendo crear categorías y roles nuevos en el catálogo global con cualquier texto válido. Para roles parece ser a propósito (el formulario permite roles personalizados). Para categorías, el frontend usa una lista fija pero el backend acepta cualquier texto. ¿Restringimos `category` a las existentes? No lo cambié (regla 16).
- Dos altas concurrentes que crean el mismo rol nuevo: el `ON CONFLICT` está pensado para eso, pero no lo probé con concurrencia real.
- `PUT /api/projects/:id` sigue sin guardar roles/requisitos/categoría y responde con los del body (deuda conocida, "PUT no parcial").

## 60. El manejador global de errores respondía 500 con el mensaje técnico — REVISION B3

**Contexto:** el último `app.use` de `src/index.js` respondía siempre `500 { error: err.message }`. Lo que llega ahí son, sobre todo, errores del cliente que levantan `express.json()` y CORS:
- JSON mal formado → `500 {"error":"Unexpected end of JSON input"}`;
- un cuerpo de más de 5 MB → 500;
- en producción, un origen no permitido → `500 {"error":"CORS: origen no permitido → <origen>"}`.

Códigos incorrectos (eran errores del cliente) y mensajes técnicos en inglés hacia el usuario, contra la regla 19.

**Arreglo:** el manejador pasó a `src/lib/errorHandler.js`, para poder testear también los casos que ninguna ruta dispara:
- `entity.parse.failed` → **400**, `entity.too.large` → **413** ("máximo 5 MB"), `charset/encoding.unsupported` → **415** ("usá UTF-8");
- el rechazo de CORS (marcado con `corsError()`, que ahora usa el callback de `index.js`) → **403** "Origen no permitido", sin repetir el origen;
- otro 4xx desconocido → su código con "El pedido no es válido";
- todo lo demás → **500** "Error interno del servidor".

`err.message` va siempre al log, nunca a la respuesta. Si la respuesta ya se empezó a mandar, se delega a Express (`next(err)`). Los errores de multer siguen manejándose en `posts.js` (no llegan acá).

### Tests (nuevos: 10)
- `test/integration/error-handler.test.js` (5, los dos motores): JSON roto → 400; 5 MB + 10 bytes → 413; `charset=latin9` → 415, cada uno con su mensaje específico y sin texto técnico. CORS en producción: origen ajeno → 403 sin el origen; `http://localhost:5173` → 200. El callback lee `NODE_ENV` en cada pedido, así que el test lo cambia solo mientras corre. Más un control: un JSON válido no da 500.
- `test/unit/errorHandler.test.js` (5): error inesperado → 500 genérico, con el detalle en el log; 4xx desconocido → su código; un 5xx con `status` explícito no se trata como error del cliente; `headersSent` → `next(err)`; `corsError()` → 403.

### Verificación
- **Rojo → verde:** los 4 casos de integración daban 500 antes del arreglo; el control pasaba. Los unitarios arrancaron con un **rojo débil** (el módulo no existía todavía); cubren caminos a los que no se llega por HTTP.
- **Mutación (12 mutantes, script descartable):** cambiar cada código, sacar cada rama (CORS, tabla de body-parser, 4xx genérico, `headersSent`), devolver `err.message` en el 500, sacar el log, ampliar el rango 4xx a `<= 503`, y volver al `new Error` en el callback de CORS. **12 de 12 detectados.** En el primer pase sobrevivió "sin la tabla de body-parser": los códigos coincidían por el 4xx genérico y solo cambiaba el mensaje, que el test no miraba. Agregué asserts del mensaje específico ("JSON válido", "5 MB", "UTF-8").
- **Suites completas:** SQLite **317/317** y Postgres **319/319**, las dos también con `TZ=America/Argentina/Cordoba`.
- Sin navegador: el frontend nunca manda JSON roto ni cuerpos de más de 5 MB.

### Errores míos
1. Dejé un comentario `eslint-disable` en el módulo; el backend no usa ESLint, así que lo cambié por un comentario común.
2. Los primeros asserts solo miraban que el mensaje no fuera técnico, no cuál era (ver mutación).

### ⚠️ NO verificado
- El 403 de CORS en el navegador real: el test lo prueba con `fetch` desde Node mandando el header `Origin`. En un navegador, el bloqueo lo hace también el propio navegador, y lo que muestre depende de él.
- `ws/index.js:86` sigue reenviando `err.message` interno por WebSocket (REVISION B19, aparte).

## 61. El chat cargaba los primeros 300 mensajes, no los últimos — REVISION B4

**Contexto:** `GET /api/messages/thread/:userId` hacía `ORDER BY created_at ASC LIMIT 300`, o sea, los 300 **más viejos**. El comentario de la ruta y `API_CONTEXT.md` prometían los últimos. En una conversación de más de 300 mensajes, al reabrirla nunca se veían los nuevos.

**Arreglo** (`routes/messages.js`): subconsulta con los 300 más nuevos (`ORDER BY created_at DESC, id DESC LIMIT 300`) y después orden cronológico (`ORDER BY created_at ASC, id ASC`). `id` desempata cuando `created_at` empata (en SQLite tiene resolución de 1 s). No es cronológico, pero hace que el corte y el orden sean siempre los mismos. Misma consulta en los dos motores.

### Tests (nuevos: 2, en los dos motores)
`test/integration/messages-thread-latest.test.js`: 301 mensajes María ↔ Juan insertados con un `created_at` distinto por segundo. Por la API empatarían casi todos en SQLite y el orden sería arbitrario. Tiene que devolver exactamente `m1…m300` en orden; `m0`, el más viejo, queda afuera. Más una conversación corta, insertada en desorden, que tiene que venir completa y ordenada (control).

### Verificación
- **Rojo → verde:** en los dos motores, el primer test daba `actual: 'm0'` (el más viejo primero); el control pasaba. Con el arreglo pasan los dos, junto con `messages-conversations.test.js`.
- **Mutación (6 mutantes, los dos motores, script descartable):** volver a ASC adentro, DESC afuera, `LIMIT 299` y `LIMIT 301`, sin orden externo: **5 detectados.** Sobrevive "sin desempate por `id`". **No es equivalente**, pero los datos del test no tienen empates. Con empates no existe un orden cronológico "correcto"; el desempate solo hace que la respuesta sea estable, y un test de eso sería frágil (sin el desempate, la base podría devolver por casualidad el mismo orden).
- **Suites completas:** SQLite **319/319** y Postgres **321/321**, las dos también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_b4` con 301 mensajes insertados con `generate_series`, borrado al terminar): como María, abrí el chat con Juan. Abajo, el último es "Mensaje número 300", con su hora bien (también confirma §53); arriba, el primero es "Mensaje número 1". El 0 quedó afuera.

### Errores míos
Ninguno detectado.

### ⚠️ NO verificado / fuera de alcance
- **No hay paginación:** los mensajes anteriores a los últimos 300 no se pueden ver desde la interfaz. Hace falta un "cargar anteriores" (cursor por `created_at`/`id`). Queda como mejora, no lo hice.
- Mensajes enviados en el mismo segundo en SQLite (dev): su orden relativo lo decide el `id` (aleatorio), no el orden real de envío. En Postgres (microsegundos) casi no pasa.

## 62. Recargar con el backend caído cerraba la sesión · `req()` reventaba con respuestas no-JSON — REVISION F4 + F5

**Contexto:**
- **F4:** al recargar, `AuthContext` verifica el token con `GET /auth/me` y hacía `.catch(() => { removeToken(); ... })` ante **cualquier** error. Con Render "dormido" (502), sin red o con un 500, el usuario perdía la sesión.
- **F5:** `req()` (`lib/api.ts`) hacía `await res.json()` sin protección. Un 502/503 en HTML de un proxy mostraba al usuario `Unexpected token '<' ...`. Además el error no llevaba el código HTTP, así que nadie podía distinguir "token inválido" de "servidor caído".

**Arreglo:**
- `lib/api.ts`: `ApiError extends Error` con `status`. `req()` y `upload()` usan un `readJson()` común: lee el cuerpo con `.catch()`. Si no es OK, `ApiError(data?.error || fallback, status)`, con fallback "El servidor no está disponible en este momento. Probá de nuevo en un rato." para 502/503/504 y "Error del servidor" para el resto. Si es OK pero no es JSON, `ApiError("Respuesta inesperada del servidor")`. Un fallo de red sigue siendo el `TypeError` de fetch, que ya traduce `userMessage()`.
- `lib/AuthContext.tsx`: cierra la sesión **solo** con 401 (token inválido o vencido, `middleware/auth.js`) o 404 (usuario borrado, `GET /auth/me`). En cualquier otro caso conserva el token y sigue con el usuario guardado en `v_user`.
- Como `ApiError` hereda de `Error`, los componentes que muestran `e.message` siguen igual.

### Tests (nuevos: 15; 1 actualizado)
- `src/lib/api.errors.test.ts` (8): 502 en HTML → `ApiError` 502 con el mensaje en español; 503/504 igual; 500 en HTML → "Error del servidor"; error con JSON → mensaje del backend + status; 200 no-JSON → `ApiError`; OK con JSON → tal cual; `upload()` con 502 en HTML; fallo de red → sigue siendo `TypeError`.
- `src/lib/AuthContext.test.tsx` (7): `/auth/me` OK → usuario del servidor; 401 y 404 → cierra la sesión (borra token y usuario); 502 en HTML, 500 y sin red → **no** la cierra (token y usuario guardado); sin token no llama a `/auth/me`.
- `src/lib/api.posts.test.ts`: el test de "respuesta no-JSON" esperaba "Error del servidor" para un 502. Lo actualicé al mensaje nuevo, porque el cambio es a propósito.

### Verificación
- **Rojo → verde:** fallaban los 3 casos de "no cerrar la sesión" (rojo fuerte: la cerraba) y los de `status`/mensaje; los `instanceof ApiError` eran rojo débil (la clase no existía). Pasaban los controles.
- **Mutación (11 mutantes, script descartable):** `json()` sin `catch`, `status` en 0, 502 o 504 fuera de la lista de "no disponible", ignorar el mensaje del backend, OK sin JSON que no falla, lanzar `Error` común, cerrar ante cualquier error (lo de antes), no cerrar con 404, no cerrar con 401, no usar el usuario guardado: **11 de 11 detectados**, sobre una línea base verde.
- **TypeScript: NO verificado** (corregido en §67: lo que reporté como "0 errores" fue un `npx tsc` que no era TypeScript).
- **Suite del frontend:** **268/268**, también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome):** con María logueada (backend contra un schema descartable de Postgres, `verif_f4`, borrado al terminar), **apagué el backend** y recargué "Mi Perfil": sigue logueada (nombre en la barra y en el encabezado). **Contraprueba:** con el `AuthContext.tsx` anterior, la misma recarga mostró "No estás logueado". Después restauré el arreglo y volví a correr sus tests.

### Errores míos
1. **La primera corrida de mutación no valía:** incluía `api.posts.test.ts`, que ya fallaba **sin** mutantes (esperaba el mensaje viejo del 502), así que "11 de 11 detectados" era falso. Lo vi recién al correr la suite completa. Actualicé ese test, confirmé la línea base en verde (24/24) y repetí la mutación. Lección: **correr la línea base antes de mutar**.
2. Primero escribí `ApiError` con un *parameter property* (`constructor(message, public status)`); lo cambié a un campo explícito para no depender de la configuración de TypeScript.

### ⚠️ NO verificado
- El mensaje de "servidor no disponible" ante un **502 en HTML real** de un proxy: lo cubren los tests con una respuesta simulada. No hay proxy local.
- Con el backend caído, las pantallas muestran datos vacíos en vez de un error (en la prueba, "Mi Perfil" mostró 0 en todo). Es F9 (errores tragados), aparte.
- La sesión se reintenta recién en la próxima recarga: no hay reintento automático de `/auth/me` cuando el backend vuelve.

## 63. Fechas de KPI un día antes — REVISION F2

**Contexto:** `NGOKPIs.tsx` mostraba la fecha con `new Date(kpi.fecha).toLocaleDateString(...)`. `kpis.fecha` es una columna TEXT con lo que manda el `<input type="date">` (`"YYYY-MM-DD"`), igual en los dos motores. `new Date("2026-10-01")` es **medianoche UTC**, y en Córdoba (UTC-3) eso todavía es el 30 de septiembre: se mostraba "30 sept 2026".

**Arreglo:** `formatDateOnly()` en `lib/format.ts`. Un `"YYYY-MM-DD"` se arma como fecha **local** (`new Date(año, mes - 1, día)`); un timestamp completo se toma por su instante (`parseBackendDate`); algo que no es fecha → `""`. `NGOKPIs.tsx` lo usa. Revisé el resto de los `.tsx`: ningún otro componente parsea fechas con `new Date(x)`. Se sumó a las trampas de `CLAUDE.md`.

### Tests (nuevos: 5)
- `src/lib/format.test.ts` (4): con `process.env.TZ` fijado a Córdoba dentro del test (Node lo aplica en el momento, así el test no depende de la máquina), `"2026-10-01"` → "01 …" y `"2026-01-01"` no cae en el año anterior; lo mismo en UTC+9; un timestamp completo; algo inválido → `""`.
- `src/app/components/NGOKPIs.test.tsx` (1): con el API simulado y TZ de Córdoba, un KPI con `fecha: "2026-10-01"` se ve como "01 de oct de 2026" y no como "30 sept".

### Verificación
- **Rojo → verde:** el test del componente fallaba con el bug real (no encontraba "01 de oct de 2026"). Los del helper fueron **rojo débil** (la función no existía).
- **Mutación (6 mutantes, script descartable, línea base en verde):** volver al parseo UTC, mes corrido, sin la rama de fecha sola, sin chequeo de `NaN`, timestamp completo → `""` y el componente que vuelve a `new Date()`: **6 de 6 detectados.**
- **TypeScript: NO verificado** (corregido en §67: lo que reporté como "0 errores" fue un `npx tsc` que no era TypeScript). **Suite del frontend:** **273/273**, también con `TZ=America/Argentina/Cordoba`.
- **En el navegador (Claude in Chrome), contra Postgres:** en un primer intento la extensión se desconectó antes de abrir la pantalla; lo hice después, junto con la verificación de §64 (schema descartable). Con Sustentando, en `/ngo/kpis/proj-1`, un KPI con `fecha: "2026-10-01"` se ve **"01 de oct de 2026"** y otro con `"2026-10-02"`, "02 de oct de 2026".
  - Al crear el primero con `curl` desde Git Bash, los acentos se guardaron rotos (`ef bf bd` en la base): `curl` mandó bytes que no son UTF-8. El segundo, creado con `fetch` desde Node, se ve bien ("Árboles en plantación"). **Fue la herramienta, no la app.**

### Errores míos
1. Agregué los tests del helper con un `node -e` entre comillas dobles que tenía backticks: bash los tomó como sustitución de comandos y el comentario quedó sin el fragmento `` `new Date('2026-10-01')` ``. Lo vi en el diff y lo corregí con `Edit`. Lección: texto con backticks, por `Edit`/archivo, no por `node -e "..."`.
2. El primer test del componente buscaba el nombre del KPI con `getByText`, pero aparece dos veces en pantalla: lo cambié a `getAllByText` antes de confiar en el rojo.

### ⚠️ NO verificado
- F3 (KPI de tipo "texto" que no se puede guardar) sigue abierto: necesita una decisión.

## 64. Recurso que no carga → página en blanco — REVISION F7

**Contexto:** `ProjectDetails`, `NGOPublicProfile`, `CompanyPublicProfile` y `NGOProjectDetail` hacían `catch { navigate(-1) }` y después `if (!x) return null`. Abiertas desde un link compartido (pestaña nueva, sin historial), `navigate(-1)` no tiene a dónde ir: la pantalla quedaba **en blanco, sin mensaje**, tanto si el recurso no existía como si el backend fallaba.

**Arreglo:**
- `components/LoadError.tsx` (nuevo, compartido, regla 3):
  - `describeLoadError(err, textoNoExiste)` usa el `status` de `ApiError` (§62): 404 → "No encontramos este voluntariado / esta organización / esta empresa", sin reintentar; 403 → el mensaje del servidor, sin reintentar; 5xx → el mensaje con "Reintentar"; sin red (`TypeError`) → "No pudimos conectarnos con el servidor. Revisá tu conexión.", con "Reintentar".
  - `<LoadError>` muestra el mensaje, "Reintentar" si corresponde, y "Volver" solo si hay página anterior (React Router guarda el índice en `history.state.idx`); si no, "Ir al inicio" (`/`, o `/ngo/dashboard` en `NGOProjectDetail`). Mismo estilo que el error de `CompanyDashboard`.
- Las 4 pantallas guardan el error en `loadError` y lo limpian al reintentar. `NGOPublicProfile` y `CompanyPublicProfile` cargaban dentro del `useEffect`: lo pasé a una función `load` para poder reintentar.

### Tests (nuevos: 16)
- `LoadError.test.tsx` (8): los cuatro casos de `describeLoadError`; "Reintentar" llama a `onRetry` y no aparece sin él; sin historial → "Ir al inicio" con el `href` correcto; con historial → "Volver".
- `LoadErrorScreens.test.tsx` (8): las 4 pantallas con el API simulado. 404 → mensaje de "no existe", sin "Reintentar" y **sin `navigate(-1)`**; 502 → mensaje y "Reintentar", que vuelve a pedir.

### Verificación
- **Rojo → verde:** los 8 tests de pantallas fallaban con el bug real (no aparecía nada en pantalla). Los de `LoadError` fueron rojo débil (el módulo no existía).
- **Mutación (12 mutantes, línea base en verde, script descartable):** 404 o 4xx reintentables, texto técnico sin red, "Volver" siempre o nunca, "Reintentar" que no llama, cada una de las 4 pantallas volviendo a `navigate(-1)`, y dos pantallas sin `onRetry`: **12 de 12 detectados.**
- **TypeScript: NO verificado** (corregido en §67: lo que reporté como "0 errores" fue un `npx tsc` que no era TypeScript). **Suite del frontend:** **289/289**.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_f7`, borrado al terminar):
  - `/project/no-existe` en una pestaña nueva → "No encontramos este voluntariado" con "Ir al inicio" (sin "Volver"; antes, en blanco).
  - Con el backend **apagado**, `/ngo/ngo-1` → "No pudimos conectarnos con el servidor. Revisá tu conexión." con "Reintentar". Levanté el backend, toqué "Reintentar" y cargó el perfil de Sustentando.

### Errores míos
Ninguno detectado en este cambio.

### ⚠️ NO verificado
- "Volver" con historial real en el navegador: lo cubre el test (con `history.state.idx`); en Chrome probé solo el caso sin historial.
- Que React Router siga guardando `idx` en `history.state` en futuras versiones: es un detalle interno suyo. Si cambia, se vería "Ir al inicio" siempre (no se rompe nada).
- F9 (errores tragados en listados y paneles) va en el próximo commit.

## 65. Errores tragados en silencio — REVISION F9

**Contexto:** seis lugares descartaban el error:
- **Cargas** que, si fallaban, mostraban el estado vacío como si no hubiera datos: `NGOPatrocinios` ("Todavía no recibiste propuestas"), `NGOKPIs` ("Sin KPIs todavía"), `NotificationsScreen` ("Sin notificaciones"), la sección de patrocinios de `CompanyOwnProfile` ("Todavía no hay patrocinios") y `NGODashboard` (un panel sin proyectos, salvo que el mensaje contuviera "Token").
- **Acciones** que fallaban sin decir nada: decidir un patrocinio, retirar una propuesta y marcar las notificaciones como leídas.

**Arreglo:**
- `InlineError` (nuevo, en `components/LoadError.tsx`): mensaje + "Reintentar". Cada carga guarda su error y lo muestra **en lugar** del estado vacío. El mensaje sale de `userMessage()` (el del backend en español, o un texto propio si no hay red).
- Las acciones muestran su error con `role="alert"`.
- `NGODashboard` va al inicio solo con un **401** (`ApiError.status`, §62); antes buscaba "Token"/"autenticado" en el texto del mensaje.

### Tests (nuevos: 9)
`SwallowedErrors.test.tsx`, con el API simulado. Para cada una de las 5 cargas: error 500 → se ve el mensaje y **no** el estado vacío, y "Reintentar" vuelve a pedir. Más: 401 en el panel → va a `/`; y las 3 acciones que fallan (409 o sin red) → aparece el `alert`.

### Verificación
- **Rojo → verde:** 8 de 9 fallaban con el bug real (no aparecía ningún error). El de 401 ya pasaba; es control de que el cambio no lo rompe.
- **Mutación (15 mutantes, línea base en verde, script descartable):** volver a tragar el error en cada carga y en cada acción, volver al estado vacío, "Reintentar" que no recarga (en 4 pantallas), 401 que no redirige y cualquier error que redirige: **15 de 15 detectados.** En el primer pase faltaba el de "Reintentar" en notificaciones: el test solo miraba que el botón existiera. Agregué el chequeo de que vuelve a pedir.
- **TypeScript: NO verificado** (corregido en §67: lo que reporté como "0 errores" fue un `npx tsc` que no era TypeScript). **Suite del frontend:** **298/298**, también con `TZ=America/Argentina/Cordoba`. Los tests previos de `NGOPatrocinios` y `CompanyOwnProfile` siguen pasando.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_f9`, borrado al terminar): como Sustentando, el panel cargó normal. Con el backend **apagado**:
  - `/ngo/dashboard` → "No pudimos cargar tu panel. Revisá tu conexión." con "Reintentar";
  - `/ngo/patrocinios` → "No pudimos cargar las propuestas…".
  
  Levanté el backend, toqué "Reintentar" y cargó: ahí sí "Todavía no recibiste propuestas", que ahora es el vacío real (el seed no tiene propuestas).

### Errores míos
1. El primer test de notificaciones no comprobaba que "Reintentar" recargara (ver mutación).

### ⚠️ NO verificado / fuera de alcance
- En el navegador probé solo el panel y patrocinios; KPIs, notificaciones y la sección de la empresa los cubren los tests.
- **Visto y no tocado:** `VolunteerProfile` ("Mi Perfil") con el backend caído muestra **0 en todas las estadísticas** (§62), y `NGOProjectDetail` usa `alert()` para errores de aprobar o cargar horas. Mismo problema de fondo, pero no estaban en F9. Quedan anotados.

## 66. Empresa: el selector de patrocinio solo listaba 20 proyectos — REVISION F6

**Contexto:** `CompanyOwnProfile` llenaba "Proponer patrocinio" con `api.projects.list({ status: 'active' })` sin `limit`: el backend devuelve 20 por defecto (`projects.js`, sin paginación, deuda conocida). El botón "Patrocinar este proyecto" de `ProjectDetails` llevaba a `/company/profile` sin decir cuál proyecto. **Reproducido contra Postgres:** con 37 proyectos activos, 17 no aparecían en el selector, y la empresa no tenía forma de patrocinarlos.

**Arreglo:**
- `ProjectDetails`: el botón lleva a `/company/profile?proponer=<id>`.
- `CompanyOwnProfile`: con `?proponer=` abre "Proponer" con ese proyecto ya elegido, una sola vez (`useRef`).
  - Si no vino en el listado, lo trae con `api.projects.get` y lo agrega.
  - Si ya hay una propuesta vigente para ese proyecto, o el proyecto no está activo, lo dice.
  - El listado pide `limit: '500'` (constante `MAX_PROPOSABLE` comentada).
  - El error del formulario se muestra también cuando no hay proyectos para elegir.

### Tests (nuevos: 7)
`SponsorPreselect.test.tsx`:
- el listado pide un `limit` > 20;
- un proyecto fuera de la lista se trae, queda elegido y se propone;
- uno que sí está en la lista queda elegido sin pedirlo aparte;
- propuesta vigente → aviso;
- proyecto no activo → aviso y no se ofrece;
- sin `?proponer=` el formulario arranca cerrado;
- el link de `ProjectDetails` (renderizado con una empresa) apunta a `?proponer=<id>`.

### Verificación
- **Rojo → verde:** fallaban los 5 casos de preselección y de `limit` (`limit` era `NaN`; nada se preelegía). Pasaba el de "arranca cerrado", que es control. El test del link lo agregué después, al ver que nada lo cubría; la mutación confirma que detecta el link viejo.
- **Mutación (8 mutantes, línea base en verde, script descartable):** sin `limit`, sin preselección, sin traer el proyecto faltante, sin aviso de propuesta vigente, ofrecer no activos, no agregarlo a la lista, pedirlo aparte aunque esté, y el link viejo: **8 de 8 detectados.**
- **Suite del frontend:** **305/305**, también con `TZ=America/Argentina/Cordoba`. Los tests anteriores de `CompanyOwnProfile` y de §65 siguen pasando.
- **TypeScript: NO verificado.** El frontend no tiene `typescript` instalado; ver §67.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_f6` con 25 proyectos extra creados por la API, borrado al terminar; frontend con la Vite **local** 6.4.3): como TechCorp, abrí "Jornada extra número 17" (uno de los 17 que el listado por defecto dejaba afuera) y toqué "Patrocinar este proyecto". Llevó a `/company/profile?proponer=…` con el formulario abierto y ese proyecto elegido. Envié la propuesta: quedó "Pendiente" en pantalla y `propuesto` en la base.

### Errores míos
1. **`npx vite` bajó y ejecutó un paquete del registry.** En el primer intento de verificación, `cd frontend && npx vite …` (lanzado en segundo plano) no resolvió la Vite local e instaló `vite@8.3.4` en el caché de npx (`npm warn exec The following package was not found and will be installed`). Esa Vite servía otro directorio (404) y así lo vi. Frené, avisé al usuario, borré esa carpeta del caché con su aprobación y rehíce la verificación con `./node_modules/.bin/vite`. No sé por qué esa vez npx no encontró la local *(causa encontrada en §70: el `cd` se pisó con otro comando lanzado en paralelo)*. Lección: nunca `npx` para binarios del proyecto.
2. Al revisar el caché encontré el error más grave, el de §67.

### ⚠️ NO verificado
- TypeScript (§67).
- Con más de 500 proyectos activos, el selector manual seguiría cortado. El camino por `?proponer=` no depende de ese tope. Hace falta paginación real (deuda conocida).

## 67. Corrección: el "tsc con 0 errores" de §62–§65 no fue un chequeo de tipos

**Qué pasó:** en §62 (F4+F5), §63 (F2), §64 (F7) y §65 (F9) reporté "TypeScript: `tsc --noEmit` con 0 errores". **Es falso.** El frontend **no tiene `typescript` instalado**: no está en `package.json` ni en `node_modules`, y ya lo advertía este mismo documento (§ de la línea "`typescript` **no es dependencia** del frontend… Un `tsc` que 'no imprime errores' puede ser un `tsc` que no existe"). Corrí `npx tsc --noEmit -p .` y conté las líneas con `error TS`. npx no encontró TypeScript, bajó del registry el paquete **`tsc@2.0.4`** ("A deprecated release of the TypeScript compiler", otro paquete que no es TypeScript), que solo imprime *"This is not the tsc command you are looking for"*. El conteo dio 0 y lo informé como "0 errores".

**Cómo lo detecté:** después del incidente de `npx vite` (§66) revisé el caché de npx (`npm-cache\_npx`) y encontré esa entrada, creada el 2026-10-14. Ejecutada a mano mostró el mensaje.

**Qué se corrigió:** las cuatro secciones ahora dicen "TypeScript: NO verificado" y remiten acá. Lo que sí vale de esas secciones (tests, mutación, navegador) no cambia: Vitest transpila sin chequear tipos, así que los tests no dependen de esto.

**Qué falta:** un chequeo de tipos real necesita `typescript` (y `@types/react`, `@types/react-dom`, `@types/node`), que hoy no son dependencias. Instalarlos es decisión del usuario (agrega dependencias y entra en `npm audit`). Hasta entonces, **ningún cambio de frontend está chequeado por tipos**.

### Errores míos
1. Afirmar "0 errores" mirando un conteo en vez de la salida cruda, sin comprobar antes que el comando era el que creía.
2. No leer la advertencia que ya estaba en este documento.
3. Usar `npx` para binarios del proyecto: puede bajar y ejecutar paquetes del registry sin preguntar (pasó con `vite` y con `tsc`). Ahora uso solo `node_modules/.bin/…`.

## 68. TypeScript instalado en el frontend: primer chequeo de tipos real

**Contexto:** §67. El usuario aprobó instalar TypeScript y borrar el paquete `tsc` que había bajado npx (borrado, igual que el `vite@8.3.4` de §66).

**Qué se hizo:**
- `devDependencies` del frontend: `typescript@^7.0.2`, `@types/react@^18.3.31`, `@types/react-dom@^18.3.7` (React 18) y `@types/node@^22.20.5` (Node ≥22).
- Antes de instalar revisé las fechas: TypeScript 7.0.2 es del 2026-07-08 (estable desde hace tres meses) y los `@types` tienen más de dos semanas.
- El lockfile sumó solo esos paquetes, sus dependencias (`csstype`, `undici-types`, `@types/prop-types`) y los binarios nativos de TypeScript 7, uno por plataforma (npm instala solo el de la máquina). **`npm audit`: 0 vulnerabilidades.**
- Script nuevo: **`npm run typecheck`** (`tsc --noEmit -p .`), para no depender de `npx`. El aviso de npm sobre el `postinstall` de `esbuild` ya existía (viene con Vite).

### Resultado del primer chequeo real: 18 errores, todos de configuración (ninguno de lógica)
- **7 — tipos de Vite no declarados** (falta el `src/vite-env.d.ts` estándar con `/// <reference types="vite/client" />`): `import.meta.env` en `api.ts` y en `NGOEmpleados.tsx` (×2), y los `import` de `.css` en `main.tsx` (×3) y `ProjectMap.tsx`.
- **10 — `process`/`global` en tests:** `format.test.ts` (×5) y `NGOKPIs.test.tsx` (×4), **los dos escritos por mí en §63**, y `test/setup.ts` (×1). `@types/node` está instalado, pero desde TypeScript 6 los `@types` ya no se incluyen solos: hay que nombrarlos en `types`.
- **1 — `Array.prototype.at`** en `api.posts.test.ts`: `tsconfig` tiene `lib: ES2020` y `.at()` es ES2022.

Los 305 tests siguen pasando: Vitest no chequea tipos.

### ⚠️ Pendiente (decisión del usuario)
Arreglarlos es configuración: el `vite-env.d.ts`, `types: ["vite/client", "node"]` y `lib` en ES2022. Sumar `node` a `types` deja ver `process` también en el código de la app; la alternativa es un `tsconfig` aparte para los tests. Corregido eso, podrían aparecer errores que hoy tapa la configuración: hay que volver a correr y mirar la salida.

## 69. Configuración de TypeScript: de 18 errores a 0

**Pedido del usuario:** la "versión simple" propuesta en §68.

**Cambio** (`frontend/tsconfig.json`):
- `"types": ["vite/client", "node"]`: declara los tipos de Vite (`import.meta.env`, `import` de `.css`) y los de Node (`process`, `global` en los tests).
- `lib` de ES2020 a **ES2022** (`Array.prototype.at`).

No hizo falta el `src/vite-env.d.ts` que había propuesto: `"vite/client"` en `types` hace lo mismo. `target` sigue en ES2020: el build lo maneja Vite y `tsc` solo chequea (`noEmit`).

**Contra de la versión simple (elegida a sabiendas):** con `node` en `types`, el código de la app también "ve" `process`, `Buffer`, etc. sin que TypeScript se queje, aunque en el navegador no existen. La alternativa era un `tsconfig` aparte para los tests.

### Verificación
- `npm run typecheck`: **exit 0, salida vacía.** Leí la salida cruda.
- **Prueba de que chequea de verdad** (por §67): un archivo temporal con `const n: number = 'texto'` y `api.projects.get(123)` dio los dos errores esperados (TS2322 y TS2345). Lo borré y volvió a 0.
- Los 18 errores de §68 eran de configuración: con esto no apareció ninguno nuevo de los que la configuración tapaba.
- Suite del frontend: **305/305**.

### ⚠️ NO verificado
- Que nadie use `process` en código de la app por error: TypeScript ya no lo marca (ver "contra").

## 70. Inscripción rechazada se veía "Inscripto · Pendiente" — REVISION F8

**Contexto:** en `ProjectDetails`, el botón de inscripción mostraba `Inscripto · ${status === 'approved' ? 'Aprobado' : 'Pendiente'}`. Cualquier estado que no fuera "aprobado" (incluido **rechazado**) se veía "Pendiente", para siempre. Como `enrollments` tiene `UNIQUE(user_id, project_id)`, un voluntario rechazado **no puede volver a postularse** a ese proyecto: el botón tiene que decirlo, no ofrecer otra inscripción.

**Arreglo** (`ProjectDetails.tsx`): estado `rejected` → **"Inscripción rechazada"**, deshabilitado y en rojo (`bg-red-50 text-red-600`). Pendiente y aprobado no cambian.

### Tests (nuevos: 3)
`EnrollStatusLabel.test.tsx`: rechazada → "Inscripción rechazada" deshabilitado y sin "Pendiente"; pendiente → "Inscripto · Pendiente"; aprobada → "Inscripto · Aprobado".

### Verificación
- **Rojo → verde:** fallaba el de rechazada (no encontraba el texto); pendiente y aprobada eran controles.
- **Mutación (3 mutantes):** sin la rama de rechazada y otro texto: **detectados**. **Sobrevive el estilo rojo**: los tests no miran clases. Lo verifiqué a ojo en el navegador.
- **TypeScript:** `npm run typecheck` → exit 0. **Suite del frontend:** **308/308**.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_f8`, con la inscripción de María en `proj-9` pasada a `rejected`; borrado al terminar): como María, en `/project/proj-9` el botón dice **"Inscripción rechazada"** en rojo y está deshabilitado.

### Errores míos — y la causa del incidente de `npx` (§66)
Al levantar el frontend, el comando con `cd …/frontend && ./node_modules/.bin/vite` falló con *No such file or directory* (exit 127): **se ejecutó en `backend/`**. Lo había lanzado en paralelo con el del backend (`cd …/backend && …`). El directorio de trabajo de la herramienta es compartido y los dos `cd` se pisaron. **Es la causa del incidente de §66:** ahí `npx vite` corrió en `backend/`, no encontró Vite y la bajó del registry. Esta vez, sin `npx`, falló sin consecuencias. Desde ahora el frontend se levanta con **ruta absoluta y la raíz como argumento** (`"$F/node_modules/.bin/vite" "$F" --port 5180`) y sin depender de un `cd`. Así funcionó.

### ⚠️ NO verificado
- Que la ONG no tenga forma de "reabrir" una inscripción rechazada: hoy `PATCH /enrollments/:id` permite pasar de `rejected` a `approved`. Si lo hace, el botón pasa a "Aprobado" (se lee del servidor en cada carga). No lo probé.

## 71. El chat reconectaba para siempre con el token vencido — REVISION F10

**Contexto:** `ChatContext` reconecta el WebSocket con backoff (tope 10 s) cuando se corta. Si el servidor lo cerraba con **4001** (token inválido o vencido, `ws/index.js:63`), lo intentaba igual cada 10 s, **para siempre**, aunque con ese token cada intento iba a fallar.

**Arreglo** (`lib/ChatContext.tsx`): `onclose` mira `ev.code`; con 4001 no reprograma la reconexión. Cualquier otro corte (reinicio del server, red, 1006) sigue reconectando. No agregué un cierre de sesión automático: sería un cambio de comportamiento mayor. El 401 del próximo pedido REST o la próxima recarga (§62) lo resuelven.

### Tests (nuevos: 2)
`src/lib/ChatContext.test.tsx`, con un `WebSocket` falso y timers falsos: un cierre 1006 reconecta a 1 s; un cierre 4001 no abre ninguna conexión nueva en 60 s.

### Verificación
- **Rojo → verde:** el de 4001 fallaba (abría otra conexión); el de 1006 era control.
- **Mutación (3 mutantes):** sin el chequeo, otro código, y no reconectar nunca: **3 de 3 detectados.**
- **TypeScript:** exit 0. **Suite del frontend:** **310/310**.

### Errores míos
1. El primer mock de `useAuth` devolvía un objeto nuevo en cada render. El efecto (que depende de `user`) reabría el socket en cada render y los dos tests fallaban por eso, no por el bug. Lo cambié a referencias estables, como en la app, antes de confiar en el rojo.

### ⚠️ NO verificado
- **En el navegador:** un 4001 solo pasa si el token vence con la sesión abierta. Al cargar con un token inválido, `AuthContext` cierra la sesión antes (401) y el socket no se abre. No lo reproduje en Chrome.

## 72. Notificaciones con 3 horas de desfase (copia propia de `timeAgo`) — REVISION F11

**Contexto:** `NotificationsScreen.tsx` tenía su propia copia de `timeAgo` con `new Date(fecha)`. El formato de SQLite (`"YYYY-MM-DD HH:MM:SS"`, UTC sin zona) se leía como hora **local**. Comprobado con la expresión vieja en la TZ de Córdoba: una notificación de hace 5 minutos daba **−175 minutos** (3 h "en el futuro") y se mostraba "ahora". Pasa solo con SQLite (dev): Postgres manda ISO con `Z`, que la copia sí leía bien.

**Arreglo:** la pantalla usa el `timeAgo` compartido de `lib/format.ts` (pasa por `parseBackendDate`, §46/§53); se borró la copia (regla 3). **Cambio visible chico:** el texto pasa de "hace 5m" / "hace 3h" / "hace 2d" al formato del resto de la app ("5 min" / "3 h" / "2 d", y la fecha después de una semana).

### Tests (nuevos: 2)
`NotificationsTime.test.tsx` (TZ de Córdoba y "ahora" fijos): formato SQLite de hace 5 minutos → "5 min"; ISO con `Z` de hace 3 horas → "3 h".

### Verificación
- **Rojo → verde:** fallaban los dos. El de SQLite por el bug ("ahora"). El de ISO, solo por el formato viejo ("hace 3h").
- **Mutación:** una copia local con **el mismo formato** que la compartida pero parseando con `new Date()` → **detectada**. El test agarra el error de parseo, no solo el cambio de texto.
- **TypeScript:** exit 0. **Suite del frontend:** **312/312**.

### ⚠️ NO verificado
- **En el navegador:** el bug es solo de SQLite (dev) y mis verificaciones corren contra Postgres. Lo cubre el test.

## 73. "Ver en panel ONG" se ofrecía a cualquier ONG — REVISION F16

**Contexto:** `ProjectDetails` le mostraba "Ver en panel ONG" a **cualquier** usuario con rol `ngo`, en cualquier proyecto (solo miraba `project.ngo_id`). En un proyecto ajeno el panel respondía 403 (desde §64, con un mensaje de error). El frontend no tenía cómo saber de quién era el proyecto: `User` no trae el id de la ONG y `GET /projects/:id` no lo decía.

**Arreglo:**
- **Backend** (`GET /projects/:id`): campo nuevo **`can_manage`**, `true` solo si quien pide es la ONG dueña. Se calcula con una consulta aparte (`ngos WHERE id AND user_id`) en vez de sumar `n.user_id` al SELECT, porque `fmt()` esparce todas las columnas y lo expondría.
- **Contrato** (`api.ts`, reglas 6/7): `ProjectDetail.can_manage?: boolean`.
- **Frontend:** `ProjectDetails` muestra el link solo con `project.can_manage`. La decisión es del backend (regla 15).

### Tests (nuevos: 5)
- `backend/test/integration/project-can-manage.test.js` (3, en los dos motores): dueña → `true`; otra ONG, voluntario, empresa y sin sesión → `false`; la respuesta no incluye el `user_id` de la ONG.
- `frontend/src/app/components/NgoPanelLink.test.tsx` (2): con `can_manage` el link apunta a `/ngo/dashboard/project/<id>`; sin él no aparece.

### Verificación
- **Rojo → verde:** backend, los dos primeros fallaban (`can_manage` no existía). Frontend: la otra ONG **veía** el link (dos, móvil y escritorio).
- **Mutación (4):** cualquier ONG puede, sin filtro de dueño, y el link para cualquier ONG (lo de antes): **detectados** (backend en los dos motores). Sobrevive "sin chequeo de rol": **equivalente**, porque solo los usuarios ONG tienen fila en `ngos`; el chequeo solo ahorra una consulta.
- **Suites completas:** backend **322/322** (SQLite) y **324/324** (Postgres), las dos también con `TZ=America/Argentina/Cordoba`; frontend **314/314**; `npm run typecheck` exit 0.
- **En el navegador (Claude in Chrome), contra Postgres** (schema descartable `verif_f16`, borrado al terminar; backend y Vite local levantados **de a uno y por ruta absoluta**, §70): como Sustentando, en `/project/proj-1` (propio) aparece "Ver en panel ONG"; en `/project/proj-2` (de Green Córdoba) ya no.

### Errores de documentación encontrados
- `API_CONTEXT.md` decía que `GET /projects/:id` responde 404 también para `status='cancelled'` si no es la dueña. **El código no lo hace** (solo 404 si no existe). Corregido.

### ⚠️ NO verificado / visto
- Para una ONG en un proyecto ajeno, la columna de acciones queda vacía (sin botón). Podría mostrar algo informativo; no lo cambié.

## 74. Calificación y estado de proyecto inválidos daban 500 — REVISION B10 y B11 (`status`)

**Contexto (`routes/projects.js`):**
- `POST /:id/ratings` validaba con `!rating || rating < 1 || rating > 5`. **`"abc" < 1` es `false`**, así que `"abc"`, un array o `"4.0x"` pasaban y reventaban en el `CHECK` de la base (**500**). Con `3.5`, SQLite lo guardaba y **Postgres (INTEGER) daba 500**. `comment` no se validaba.
- `PUT /:id`: un `status` fuera de `active`/`completed`/`cancelled` reventaba en el `CHECK` (500).

**Arreglo:**
- `rating` tiene que ser un **entero** de 1 a 5. Un string de solo dígitos (`"4"`) se convierte, por si viene de un form. Si no → 400 "La calificación tiene que ser un número entero del 1 al 5".
- `comment`, si viene, texto de hasta 1000 caracteres (400 si no).
- `status` en el PUT, si viene, tiene que estar en la lista (400 si no).

### Tests (nuevos: 13, en los dos motores)
`test/integration/projects-input-validation.test.js`:
- `rating` `"abc"`, `3.5`, `0`, `6`, `null`, `[4]` y `"4.0x"` → 400, sin cambiar la calificación existente;
- `comment` objeto → 400; 1001 caracteres → 400; exactamente 1000 → 200; `"4"` con comentario → 200 y se guarda `4`;
- `status: "borrado"` → 400 sin cambiar el proyecto; `status: "completed"` → 200.

### Verificación
- **Rojo → verde:** en los dos motores fallaban `"abc"`, `3.5`, el array, `"4.0x"` (500), los dos de `comment` y el de `status`. `0`, `6` y `null` ya daban 400: son control.
- **Mutación (7, los dos motores, script descartable):** sin `isInteger`, sin convertir `"4"`, rango hasta 6, sin chequeo de tipo del comentario, tope `>= 1000`, sin chequeo de `status` y lista sin `completed`: **7 de 7 detectados.** En el primer pase sobrevivió el tope del comentario: no había caso de exactamente 1000. Lo agregué.
- **Suites completas:** SQLite **335/335** y Postgres **337/337**, las dos también con `TZ=America/Argentina/Cordoba`.
- Sin navegador: el frontend manda siempre un entero de 1 a 5 (las estrellas) y nunca un `status` inválido.

### Errores míos
1. El primer test asumía que María no tenía calificación en `proj-1`, pero el seed ya tiene una (5). Los casos `0`/`6`/`null` fallaban por eso y no por el bug. Lo corregí a "no cambia la existente" antes de confiar en el rojo.
2. Al escribir la regex `/^\d+$/` con un `node -e` entre comillas, el escapado se comió la barra y quedó `/^d+$/` (rechazaba `"4"`). Lo agarró el test. Lo corregí con un script en archivo. Lección (como en §63): código con barras o backticks, por archivo, no por `node -e`.
3. Un `node -e` que actualizaba la documentación falló a mitad (no encontró la fila de `REVISION.md`, que ya había cambiado con B18). Como el `git add` estaba en otra línea, el commit salió sin esta sección. Lo vi en `git show --stat` y lo completé con `--amend`.

### ⚠️ NO verificado / fuera de alcance
- Los comentarios de una calificación no pasan por el filtro de palabras (`hasBadWord`), a diferencia de los comentarios del proyecto. No lo cambié (B7 está pendiente de decisión).

## 75. Horas cargadas como Infinity (o "12abc" como 12) — REVISION B14

**Contexto:** `PATCH /api/enrollments/:id/horas` validaba con `parseFloat` + `isNaN`.
- `"1e400"`, o el número `1e400` en el JSON (que `JSON.parse` convierte en `Infinity`), pasaba como **Infinity** y se guardaba: los totales de horas (panel de empresa, perfil del voluntario) quedaban rotos.
- `"12abc"` se guardaba como 12 en silencio; `[5]` como 5.
- No había tope.

**Arreglo** (`routes/enrollments.js`): `horas` tiene que ser un número (o un string numérico no vacío, `"7.5"`) **finito, entre 0 y `MAX_HORAS` (10000)**. Si no → 400 "Las horas tienen que ser un número entre 0 y 10000". El tope es holgado (unas 40 h semanales durante 5 años): solo corta valores absurdos o mal tipeados.

### Tests (nuevos: 12, en los dos motores)
`test/integration/enrollments-hours-validation.test.js`:
- `"1e400"`, `1e400` crudo en el JSON, `"12abc"`, `10001`, `-1`, `""`, `null` y `[5]` → 400, sin cambiar las horas;
- `7.5`, `"7.5"`, `0` y `10000` → 200 y se guardan.

### Verificación
- **Rojo → verde:** en los dos motores, `"1e400"`, `1e400`, `"12abc"`, `10001` y `[5]` daban 200. `-1`, `""` y `null` ya daban 400, pero en el rojo fallaban **en cascada**: el `10001` anterior se había guardado y cambiaba el punto de partida (`actual: 10001`).
- **Mutación (6, los dos motores, script descartable):** sin tope, tope `>=`, `parseFloat`, aceptar `""` y no aceptar strings: **detectados**. Sobrevive "sin `isFinite`": **equivalente**, porque el tope ya rechaza `Infinity` (`Infinity > 10000`) y `-Infinity` cae en `h < 0`. `isFinite` queda por claridad.
- **Suites completas:** SQLite **347/347** y Postgres **349/349**, las dos también con `TZ=America/Argentina/Cordoba`.
- Sin navegador: `NGOProjectDetail` ya valida `>= 0` antes de mandar. Un valor de más de 10000 ahora se ve con el `alert` de error de esa pantalla (que usa `alert()`, anotado en §65).

## 76. Auth y perfiles: tipos, nombres vacíos y textos sin tope — REVISION B11 (rol de empleado), B12, B13

**Contexto:**
- **B13:** los validadores de `auth.js` hacían `v.trim()` sin chequear el tipo. Un login con `email: [...]` o un registro con `name: 5` daban **500**. Lo mismo pasaba en el alta de empleados (`nombre?.trim()`) y en el `name` de los perfiles de ONG y empresa.
- **B12:** `PUT /auth/me`, `/ngos/me` y `/empresas/me` validaban el nombre con `if (name && …)`: `name: ""` se salteaba la validación y **dejaba el nombre vacío** (200).
- Los textos libres (bio, descripción, misión, URLs…) no tenían tipo ni largo máximo: un objeto o un texto enorme se guardaban.
- **B11:** un `rol` de empleado fuera de la lista reventaba en el `CHECK` (500).

**Arreglo:**
- **`src/lib/inputs.js`** (nuevo, regla 3): `checkText(valor, { label, max, min, required, nullable })` devuelve el error en español o `null`. `undefined` = no vino (no tocar, salvo obligatorio); `null` = borrar (salvo obligatorio); si viene tiene que ser string, no vacío si es obligatorio, y con largo entre `min` y `max`. Más `firstError(...)`.
- **`auth.js`:** `validateEmail`/`validateName`/`validatePassword` exigen string; el login exige `email` y `password` string. `PUT /me` valida `name` si **no es `undefined`** (también `""` y `null`), lo guarda recortado, y topea `bio` 500, `location` 150 y `avatar` 1000.
- **`ngos.js` / `empresas.js` (`PUT /me`):** `name` 2–100 (no se puede borrar), guardado recortado; `description` 2000, `mission` 1000, `location` 150, `logo`/`cover_image` 1000, `alias` 50, `founded` 20, `industry` 100, `category` 60.
- **Empleados:** `nombre`/`apellido` obligatorios (≤ 100), `email` con `validateEmail` (importado de `auth.js`, sin copiarlo), `rol` en la lista.
- **Topes elegidos por mí** (el frontend no tiene `maxLength`): holgados, solo para cortar abusos.

### Tests (nuevos: 22)
- `test/unit/inputs.test.js` (7): el contrato de `checkText` (`undefined`/`null`/tipo/vacío/mínimo/máximo inclusivo) y `firstError`.
- `test/integration/profiles-input-validation.test.js` (15, en los dos motores):
  - login con `email` array/número y `password` array → 400; registro con `name`/`email`/`password` de otro tipo → 400 y no crea el usuario;
  - `PUT /auth/me` con `name` `""`/espacios/`null` → 400 sin cambios; `bio` objeto o de 501 y `location` de 151 → 400; válido → nombre recortado y `bio: null` la borra;
  - ONG y empresa: `name` `""`/espacios/`null` → 400 sin cambios; `name` número, `description` array o de 2001, `mission` de 1001 → 400; válido → nombre recortado;
  - empleados: `rol: "jefe"`, `nombre` número o vacío, `email` array o inválido, sin `apellido` → 400 sin crear nada; válido sin `rol` → 201 con `coordinador`.

### Verificación
- **Rojo → verde:** en los dos motores fallaban todos menos el alta válida de empleado (control). Revisé los motivos antes de arreglar: 500 por `.trim()`, 200 con el nombre vacío, nombres sin recortar.
- **Mutación (16, los dos motores, script descartable):** 13 detectados en el primer pase. Sobrevivían 3 del helper (aceptar vacío, aceptar `null` siempre, `required` que no exige) porque ningún test usaba un `nombre` de empleado vacío, un `name: null` de ONG ni un empleado sin `apellido`. **No eran equivalentes**: dos terminaban en 500 y uno guardaba vacío. Agregué esos casos y el test unitario: **16 de 16.**
- **Regresión:** revisé lo que mandan los formularios (`VolunteerProfile`, `NGOOwnProfile`, `CompanyOwnProfile`, `NGOEmpleados`): todo es texto y los roles son los mismos 4. Ninguno queda afuera.
- **Suites completas:** SQLite **369/369** y Postgres **371/371**, las dos también con `TZ=America/Argentina/Cordoba`.

### ⚠️ NO verificado / fuera de alcance
- Sin navegador: los formularios ya mandaban texto válido; los casos nuevos solo se alcanzan llamando a la API directo.
- `PUT /ngos/me` todavía responde con la fila cruda de `ngos` (incluye `user_id`): es REVISION B21, aparte.
- El registro no topea el largo del email ni de la contraseña (más allá del mínimo).

## 77. Carreras en follows y en la decisión de patrocinio — REVISION B15 y B16

**Contexto:** la revisión los dejó "a confirmar con concurrencia". El plan era escribir primero el test en `test:pg` y arreglar solo si fallaba. **Falló, de forma reproducible (3 de 3 corridas en Postgres):**
- **B15 (follows, los 3 tipos: ONG, proyecto y voluntario):** el handler hacía `SELECT` "¿ya lo sigo?" → `INSERT` → `UPDATE followers + 1`, sueltos y fuera de transacción. Con 8 "seguir" simultáneos, varios pasaban el `SELECT`; uno insertaba y el resto chocaba con la PK → **500**. Con 8 "dejar de seguir" simultáneos, todos veían la fila y **todos descontaban**: el contador bajaba 8 en vez de 1 (`followers` de la ONG quedaba desfasado para siempre). En el de voluntarios, además, salía una notificación `new_follower` por cada request que pasaba el `SELECT`.
- **B16 (`PATCH /api/ngos/me/patrocinios/:empresaId/:projectId`):** chequeaba `estado !== 'propuesto'` y después hacía el `UPDATE` sin condición. Con aceptar y rechazar a la vez, **6 de 8 respondían 200** (cada una con su notificación y su email a la empresa, contradictorios); con la misma decisión 8 veces, **8 de 8** respondían 200.
- En SQLite no se ve: cada handler corre casi sin intercalarse con los demás (mismo caso que `enrollments-concurrency.test.js`, §34).

**Arreglo:**
- **`routes/follows.js`:** helper `toggleFollow(changeSql, params, counterSql, counterId)`: en una `db.transaction()` (regla 21) corre el `INSERT ... ON CONFLICT DO NOTHING` (o el `DELETE`) y mueve el contador **solo si `changes === 1`**; devuelve si hubo cambio real. Los 6 handlers (seguir/dejar de seguir × 3) lo usan y se borraron los `SELECT` previos. La notificación de nuevo seguidor queda **después del COMMIT** y solo si hubo follow real. La respuesta no cambió (`{ following, followers, message }`, 200 también si ya lo seguías).
- **`routes/ngos.js`:** compare-and-swap: `UPDATE ... WHERE empresa_id=$2 AND project_id=$3 AND estado='propuesto'`; si `changes !== 1` → **409** "Esta propuesta ya fue decidida" (el mismo mensaje que ya existía para una propuesta decidida antes), sin notificación ni email. El chequeo previo se mantiene para el caso secuencial y el 404.
- **Frontend:** sin cambios. `NGOPatrocinios` ya muestra el mensaje del servidor si la decisión falla (§65), y ese 409 ya existía.

### Tests (nuevos: 12, en los dos motores)
`test/integration/follows-sponsorship-concurrency.test.js`. Como en §34, verifica **invariantes**, no quién gana:
- por cada tipo de follow: 8 "seguir" a la vez → todos 200, una fila, contador +1 (y en voluntarios, una sola notificación); 8 "dejar de seguir" a la vez → todos 200, sin fila, contador vuelve al original; 5 rondas de 12 pedidos mezclados → solo 200 y `contador == original + filas`;
- patrocinio: 8 decisiones mezcladas aceptar/rechazar → exactamente un 200, el resto 409, el estado guardado es el del 200 y la empresa recibe una sola notificación (del tipo que corresponde); la misma decisión 8 veces → un 200 y siete 409.

### Verificación
- **Rojo → verde:** antes del arreglo, en Postgres fallaban 11 de 12 (solo pasaba `setup`), con `200,500,200,...` al seguir, "baja exactamente 1, no 8" al dejar de seguir y `6 !== 1` / `8 !== 1` en el patrocinio. En SQLite pasaban los 12 (esperable, ver arriba). Después: 12/12 en Postgres en 5 corridas seguidas.
- **Mutación (8, los dos motores, script descartable):** detectados: contador sin mirar `changes`, `toggleFollow` que devuelve siempre `true` / siempre `false`, sacar el `ON CONFLICT`, notificar siempre, sacar el `AND estado='propuesto'` y sacar el 409 por `changes` (los dos últimos solo en Postgres, como se esperaba). **Sobrevive 1: "sin transacción"** (los dos statements sueltos). **No es equivalente:** si el proceso o la conexión se cae entre el `INSERT`/`DELETE` y el `UPDATE` del contador, sin transacción queda desfasado; con ella no. Pero bajo concurrencia normal el comportamiento es el mismo (cada statement mira su propio `changes`), y probarlo exige inyectar una falla a mitad de camino: no lo hice.
- **Suites completas:** SQLite **381/381** y Postgres **383/383**, las dos también con `TZ=America/Argentina/Cordoba`.

### Errores propios
- En la primera versión del test propuse el patrocinio sobre `proj-4`, que es de otra ONG (ngo-4): habría dado 404 y no probaba nada. Lo vi al revisar el seed, antes de correrlo; pasé a `proj-7` (de ngo-1).
- En el script de mutación, dos patrones no matchearon porque `follows.js` es CRLF y los escribí con `\n`, y en el reintento rompí el escapado. Los corrí de nuevo bien; ningún archivo del proyecto quedó modificado por el script (`git status` limpio salvo los cambios de esta tarea).

### ⚠️ NO verificado
- Sin navegador: no vi el 409 del patrocinio en `NGOPatrocinios`. Por lectura, el `catch` de `decide` muestra `userMessage(e, ...)` (§65), pero **no hay test de frontend de ese error** (`NGOPatrocinios.test.tsx` solo cubre listar, aceptar, rechazar y vacío).
- Los contadores de producción que ya se hayan desfasado por este bug **no se corrigen** (no hay datos reales todavía, la app no está desplegada; si los hubiera, se recalculan con un `UPDATE ... SET followers = (SELECT COUNT(*) ...)`).
- La caída a mitad de transacción (el mutante sobreviviente) no está probada.

## 78. Docs que contradecían el código — REVISION D1–D7

**Contexto:** commit de solo documentación (ítem 18 del orden de REVISION.md). Cada corrección se cotejó contra el código actual, no contra lo que decía la revisión (algunas ya estaban resueltas a medias).

**Qué se corrigió:**
- **D1** `PROJECT_CONTEXT.md`: la tabla de dependencias y §11 decían que `multer` no se usaba y que no había subida de archivos. Ahora: lo usa `routes/posts.js` para las fotos de Momentos (Cloudinary, §43).
- **D2** `PROJECT_CONTEXT.md`: "No usa: testing framework / tests". Ahora figuran Vitest + Testing Library (frontend) y `node:test` (backend, `npm test` y `npm run test:pg`). De paso, la fila de TypeScript decía "vía Vite": ahora dice TypeScript 7 con `npm run typecheck` (§68–§69). No puse cantidades de tests en ese doc (envejecen; las cuenta `CLAUDE.md`).
- **D3** `BACKEND_CONTEXT.md`: "28 tablas" → 31 (contadas en `migrate.js`; `DATABASE_CONTEXT.md` ya decía 31).
- **D4** `DATABASE_CONTEXT.md` §4: los rangos "1–17 / 18–24" ya no coincidían con la numeración de §1. Ahora: 21 tablas con `id` propio y 10 N:M con PK compuesta (con la lista). El "id generado por default de base" era cierto para el esquema (hay un `DEFAULT` de UUID) pero contradecía la regla 23: se aclaró que las altas que devuelven la fila generan el id con `crypto.randomUUID()`. A la tabla de N:M de §2 le faltaban `empresa_categorias` y `post_likes`.
- **D5** `API_CONTEXT.md`: `GET /api/follows/volunteer/following` y `/followers` figuraban para "cualquiera"; el código exige `requireRole('volunteer')`.
- **D6** `API_CONTEXT.md`, `PUT` de KPI: el DELETE ya estaba bien (`{ message: "KPI eliminado" }`, corregido en §56). Lo "a confirmar" del PUT **lo probé en SQLite** con un test descartable (fuera del repo): sin `nombre` responde **500** `Error al actualizar KPI`; con solo `nombre`, 200 y el resto de los campos en `null`, incluido `tipo_valor`. El doc ahora lo dice. El frontend (`NGOKPIs.tsx`) siempre manda `nombre` (lo exige el formulario), así que desde la interfaz no se llega al 500.
- **D7** `FRONTEND_CONTEXT.md`: "47 archivos .tsx (sin tests)" → 48 componentes (faltaba `LoadError.tsx` en la lista de §4). La lista de "sin tests" de §15 tenía 7; ahora son los 29 sin `<Componente>.test.tsx`, con los archivos de test que cubren un aspecto puntual de algunos.

### Verificación
- Conteos hechos con comandos, no a ojo: 31 `CREATE TABLE` distintos en `migrate.js`, 21 usos de `UUID_PK`, 10 `PRIMARY KEY (...)` compuestas; 48 `.tsx` en `components/` sin contar tests; para cada test "cruzado", los `import` de componentes que hace.
- D6: SQLite sí (ver arriba). Sin cambios de código: no corrí las suites.

### Errores propios
- Al armar la lista de D7 me salteé al principio los tests de `routes.test.tsx`, `FeedTabsPlacement` y `MomentsPlacement` que importan `Root`, `NGOLayout`, `PublicFeed` y `VolunteerPublicProfile`; los agregué al revisar los `import` de cada test.

### ⚠️ NO verificado
- ~~**D6 en Postgres**~~ **Verificado después** (§84, con Docker): el mismo test descartable contra Postgres 16 da lo mismo que SQLite: sin `nombre` → **500** `Error al actualizar KPI`; con solo `nombre`, 200 y el resto en `null`.
- El 500 del PUT de KPI sin `nombre` **sigue** (es un bug de backend, no de docs): debería ser 400. No lo arreglé en este commit de solo docs; queda junto con el "PUT no parcial" (deuda conocida, regla 16).
- No revisé el resto de cada doc línea por línea; solo los puntos D1–D7.

## 79. Modales accesibles: `<Modal>` común — REVISION F12

**Contexto:** los modales eran un `<div className="fixed inset-0">` con overlay: sin `role="dialog"` ni nombre, sin Escape y con el foco detrás del fondo. Con teclado se seguía tabulando la página de atrás y un lector de pantalla no anunciaba nada.

**Qué se hizo:**
- **`components/Modal.tsx` (nuevo):** `role="dialog"` + `aria-modal` + nombre (`labelledBy` o `label`); Escape escuchado en `document` (anda aunque el foco no esté adentro) y con `stopPropagation` para que no llegue a los listeners de `window` de los modales viejos; al abrir, foco al panel (o a `initialFocusRef`); Tab/Shift+Tab atrapados; al cerrar, el foco vuelve a donde estaba; clic en el fondo cierra (`closeOnOverlay`); scroll de la página bloqueado y restaurado. Con modales apilados, solo el de arriba atiende el teclado (pila a nivel de módulo).
- **Migrados (los 4 modales que citaba la revisión):** `AuthModal` (nombre según la pestaña: "Iniciar sesión" / "Crear cuenta"), `ReviewModal` ("Dejar reseña"), y las listas "Seguidores"/"Siguiendo" de `VolunteerProfile` y `VolunteerPublicProfile`. Se mantuvieron las clases de cada uno: visualmente no cambian.
- **`ChatbotWidget`** (el 5.º citado) **no es un modal**: es un panel flotante que no tapa la página. Ponerle `aria-modal` y atrapar el foco sería incorrecto. Se le dio `role="dialog"` con nombre "Ayuda rápida" (sin `aria-modal`), foco al campo al abrir, Escape dentro del panel cierra y devuelve el foco al botón, y el botón tiene `aria-expanded`/`aria-controls`.

### Tests (nuevos: 18)
- `Modal.test.tsx` (12): nombre por `label`/`labelledBy`, Escape con el foco afuera, clic afuera/adentro, `closeOnOverlay={false}`, foco que entra y vuelve al que abrió, `initialFocusRef`, Tab y Shift+Tab en ciclo, Tab desde la página de atrás, dos modales apilados, scroll bloqueado/restaurado, panel sin nada enfocable, Escape que no llega a `window`.
- `ModalsA11y.test.tsx` (3): reseña y las dos listas de seguidores (diálogo con nombre, foco adentro, Escape).
- `AuthModal.test.tsx` (+1) y `ChatbotWidget.test.tsx` (+2).
- **Rojo → verde:** primero con un `Modal` "stub" con el patrón viejo (9 de 10 rojos por comportamiento, no por "módulo inexistente"); los de los componentes, rojos por "no hay role=dialog" / `aria-expanded`.

### Verificación
- **Frontend:** **332/332** (antes 314), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.**
- **Mutación (20 mutantes sobre `Modal.tsx` y `ChatbotWidget.tsx`, script descartable):** 19 muertos. **Sobrevive 1, equivalente:** poner `aria-label` también cuando hay `aria-labelledby` (por la spec de nombre accesible gana `aria-labelledby`). Dos más ("sin `stopPropagation`" y "panel sin nada enfocable") sobrevivían en la primera corrida válida; les agregué un test a cada uno y comprobé que ahora mueren.
- **En el navegador (Claude in Chrome)**, contra una base **SQLite descartable** en el scratchpad (Docker no estaba corriendo, así que no Postgres), con la Vite local:
  - Mi Perfil → "Siguiendo": se ve igual que antes; diálogo "Siguiendo", foco adentro, `body` con `overflow: hidden`. Con teclas reales: Tab → cerrar → "Juan Pérez" → cerrar (ciclo), Shift+Tab vuelve, Escape cierra, el foco vuelve al botón "Siguiendo" y el scroll se libera.
  - Chatbot: al abrir, foco en "Escribí tu pregunta..."; `aria-expanded` true/false; Escape cierra y deja el foco en el botón flotante.
  - Login (como visitante): diálogo "Iniciar sesión", Shift+Tab desde el panel va a "Registrate gratis" (último), Escape cierra y el foco vuelve a "Entrar".
  - Mis participaciones → "Reseña": diálogo "Dejar reseña", foco adentro, Escape cierra y el foco vuelve al botón "Reseña".

### Errores propios
1. **El primer script de mutación no servía:** en Windows `execSync` usa `cmd.exe`, que no entiende `./node_modules/.bin/vitest`; cada corrida fallaba al lanzar y el script marcaba los 20 mutantes como "muertos". Lo noté porque dos muertes no tenían sentido; al probarlas a mano sobrevivían. Lo rehice llamando a `node node_modules/vitest/vitest.mjs` y **chequeando primero que el código sin mutar pase**. Lección: todo arnés de mutación arranca con la corrida base.
2. **Un test colgado:** en `ModalsA11y.test.tsx` el mock de `useAuth` devolvía un `user` nuevo en cada render y `VolunteerProfile` tiene `useEffect([user])`: bucle infinito. Pasé a un objeto estable.
3. **Test de AuthModal mal armado al principio:** el `TestTrigger` existente reabre el modal en cada render (`openAuthModal` no está memoizado), así que "Escape cierra" fallaba por el test. Usé un disparador que abre una sola vez.
4. **En Chrome, una primera prueba de Tab dio mal** (el foco se fue a la página de atrás y el diálogo desapareció): la pestaña tenía módulos viejos de HMR de cuando el script de mutación modificaba `Modal.tsx`. Tras recargar, todo anduvo como se describe arriba. No es un bug de la app, pero lo anoto porque al principio parecía uno.
5. Escribí `/participations` en vez de `/participation` (404 de la app).

### ⚠️ NO verificado / pendiente
- **Lector de pantalla real** (NVDA, VoiceOver, TalkBack): no tengo. Verifiqué los atributos y el foco, no lo que se anuncia.
- **Táctil / móvil:** el cierre por clic afuera usa `e.target === e.currentTarget`; en pantallas chicas los modales son "bottom sheet". No lo probé en un dispositivo.
- La lista de seguidores del **perfil público** no la abrí en Chrome (mismo código que la del perfil propio; tiene test).
- **Quedan 5 modales sin migrar:** `FilterModal`, `ProjectMap`, `ReviewsModal`, `PostComposer`, `MomentsGrid` (tienen Escape propio, pero sin foco inicial, sin trap y sin devolver el foco; en `PostComposer` y `MomentsGrid` el Escape solo anda con el foco adentro). No estaban en F12; van aparte.
- **Duplicación vista y no tocada:** las listas de seguidores de `VolunteerProfile` y `VolunteerPublicProfile` son casi el mismo JSX; candidato a un `FollowListModal`. *(Hecho en §105.)*
- Botones solo-ícono sin nombre (cerrar, mostrar contraseña, etc.): es **F13**, el próximo commit.
- El backend de la prueba tomó Resend/Cloudinary del `.env`; no hice nada que mande mails ni suba fotos.

## 80. Botones solo-ícono y campos sin nombre accesible — REVISION F13

**Contexto:** la revisión listaba ~12 botones de solo ícono y algunos campos sin etiqueta. Con un lector de pantalla se anunciaban como "botón" o "campo de edición", sin decir para qué servían, y aprobar y rechazar una inscripción no se distinguían. Hice un relevamiento propio (script descartable que parsea los `.tsx`): **44 botones**, **1 link** (mensaje del perfil público, apareció con el test) y **~55 campos**. Muchos campos tienen texto visible arriba (`<p>` o `<label>` sin `htmlFor`) que no está asociado al campo. El `placeholder` no sirve de etiqueta porque desaparece al escribir.

**Qué se hizo** (solo atributos; nada visual):
- **Botones:** `aria-label` en cerrar, volver, enviar (mensaje, pregunta, comentario), editar/cancelar edición, cerrar sesión, agregar/quitar rol y requisito, limpiar búsqueda y cerrar formulario. Si el botón actúa sobre un ítem de una lista, el nombre dice cuál: "Aprobar a Juan Pérez" / "Rechazar a Juan Pérez", "Editar KPI Árboles" / "Borrar KPI Árboles", "Quitar rol Cocinero".
- **Toggles:** "Mostrar contraseña" con `aria-pressed`. Las estrellas de las tres calificaciones (`ReviewModal`, `ReviewsModal`, `ProjectDetails`) se llaman "1 estrella" … "5 estrellas" con `aria-pressed` en la elegida.
- **Campos:** `aria-label` con el mismo texto que la etiqueta visible (sin el "*"), así lo que se lee coincide con lo que se ve. Si no hay etiqueta visible, va un nombre según la función ("Mensaje", "Tu pregunta", "Buscar proyectos", "Horas de Ana", "Nivel de Primeros auxilios", "Proyecto a patrocinar"). En los dos casos donde la etiqueta visible cambia (el valor de un KPI según el tipo; ubicación o plataforma en el alta), el nombre cambia con ella.
- **No tocado:** `OnboardingScreen.tsx` (no está enrutado) y los "Cerrar detalle" de `ProjectMap` (van con la migración de ese modal, donde se monta el mapa en un test).
- **Por qué `aria-label` y no `<label htmlFor>`:** es un atributo por campo, sin tocar el layout de ~55 campos de 15 archivos. Lo que se pierde es que tocar el texto de arriba no enfoca el campo. Convertirlo en `<label>` es una mejora aparte.

### Tests
- **`A11yNames.test.tsx` (nuevo, 18 tests):** monta cada pantalla con sus formularios, pestañas y listas abiertos, y exige que **ningún** botón, link ni campo tenga nombre vacío (`queryAllByRole(rol, { name: '' })`, el mismo cálculo que usan los lectores de pantalla). Las pantallas son: login/registro, chatbot, chat, reseña (dos modales), KPIs, panel y perfil de ONG, perfil de empresa (edición y propuesta), perfil de voluntario (edición y lista), alta de proyecto (los 3 pasos, fugaz y sostenido), detalle de proyecto (las 3 pestañas), explorar, detalle de proyecto de la ONG, notificaciones, perfiles públicos (empresa, ONG, voluntario), empleados, feed público y tarjeta del feed. También comprueba nombres puntuales y `aria-pressed`.
- **Rojo → verde:** con los componentes anteriores fallan los 18 (lo comprobé volviendo los componentes al estado previo con el test ya terminado); después pasan los 18.

### Verificación
- **Frontend: 350/350** (antes 332). **Typecheck: 0 errores.**
- **Mutación (script descartable): sacar cada `aria-label`/`aria-pressed` agregado, de a uno.** Primera corrida: 97 mutantes, **13 sobrevivientes, ninguno equivalente**. Todos eran partes que el test no abría (pestañas de reseñas y comentarios, comentario del feed, tipo "sostenido", listas de seguidores, perfil público, el estado de las estrellas de `ReviewsModal`) más los 2 de `ProjectMap`. Amplié el test y recorrí los 11 que siguen en este commit más el link nuevo: **12 de 12 muertos**. Total del commit: **96 mutantes, 0 sobrevivientes.**
- **En Chrome** (backend contra SQLite descartable, Vite local), leyendo el árbol de accesibilidad del navegador:
  - Login: diálogo "Iniciar sesión" con "Cerrar", "Email", "Contraseña", "Mostrar contraseña" (al tocarlo, `aria-pressed="true"` y el campo pasa a texto).
  - Panel de ONG (Sustentando): "Aprobar a Juan Pérez" / "Rechazar a Juan Pérez", "Buscar proyectos".
  - KPIs: "Volver", "Cerrar formulario", "Nombre", "Descripción", "Valor", "Unidad", "Fecha de medición".

### Errores propios
1. **Mi relevamiento estático no veía los links de solo ícono:** buscaba solo `<button>`. El de "Enviar mensaje a …" lo encontró el test general. Después revisé los `<Link>`: era el único.
2. **La primera versión del test no abría secciones enteras** (pestañas, acordeones, el tipo "sostenido"): pasaba igual y la mutación mostró 11 nombres sin verificar. Lección: un test de "no hay nada sin nombre" vale lo que las pantallas que abre.
3. **`git stash` cambió finales de línea:** para comprobar el rojo guardé los componentes con `git stash` y los restauré con `pop`. Con `core.autocrlf=true`, 10 archivos que estaban en LF en el disco volvieron en CRLF. El contenido del commit no cambia (el índice queda en LF), pero CLAUDE.md pide no convertirlos: los devolví a LF y lo verifiqué con `git ls-files --eol`. Lección: en este repo, nada de `stash`; copiar los archivos aparte.
4. **El Vite de la verificación de §79 seguía corriendo:** `TaskStop` cortó el shell pero no el proceso de node, que quedó escuchando en 5173 durante ~25 min. Al lanzar uno nuevo falló por el puerto. Lo vi al revisar quién escuchaba, lo cerré y levanté otro. Antes, otro Vite lanzado **en paralelo** con el backend falló porque el `cd` se pisó (lo mismo de §70): lo relancé solo y con rutas absolutas.
5. En Chrome, un clic en el campo de contraseña lo tapó otra extensión del navegador (probablemente el gestor de contraseñas). Pasé al campo con Tab.

### ⚠️ NO verificado
- **Lector de pantalla real** (NVDA/VoiceOver/TalkBack): verifiqué los nombres que calculan jsdom y el árbol de Chrome, no lo que se escucha.
- **`read_page` de Chrome muestra vacíos** algunos botones y links cuyo nombre sale de texto anidado ("Nuevo proyecto", los links del menú lateral). Tienen texto visible y el test los da por nombrados; `computedName` no está disponible en este Chrome para confirmarlo desde el navegador.
- Avatares con link cuyo nombre es solo la inicial (en las reseñas de `ProjectDetails`): tienen nombre, pero pobre. No lo cambié.
- Contraste de colores, tamaño de los objetivos táctiles y orden de foco: fuera de F13.

## 81. Los 5 modales que faltaban pasan a `<Modal>` — REVISION F12 (segunda parte)

**Contexto:** §79 migró los modales que citaba la revisión. Quedaban 5 con un patrón propio: `FilterModal`, `ReviewsModal` y el mapa ampliado de `ProjectMap` escuchaban Escape en **`window`**, sin `role="dialog"`, sin foco ni trap. `PostComposer` y el visor de `MomentsGrid` tenían `role="dialog"`, pero Escape solo andaba con el foco adentro, y al abrir el foco no entraba. **Bug de comportamiento real:** con el login abierto encima de las reseñas (sin sesión, "calificar" lo abre), un Escape cerraba los dos modales a la vez.

**Qué se hizo:**
- Los 5 usan `<Modal>` con el nombre de su título (`labelledBy`): "Filtros", "Reseñas y Calificaciones", "Mapa de Voluntariados", "Compartir un momento", "Momento". Se borraron los tres listeners propios de Escape y bloqueo de scroll. `FilterModal` y `ProjectMap` siguen dentro de `createPortal` (z-index sobre Leaflet). Clases y estilos sin cambios.
- **`PostComposer`:** Escape pasa por `requestClose`: pregunta si hay fotos y no cierra mientras publica. `closeOnOverlay={false}` (antes el fondo tampoco cerraba).
- **Visor de `MomentsGrid`:** `closeOnOverlay={false}` (igual que antes).
- **`ProjectMap`:** "Cerrar detalle" en los dos botones que cierran la ficha del proyecto elegido (mapa chico y ampliado). Quedó afuera de §80 para probarlo acá con el mapa montado.

### Tests (nuevos: 12)
- `ModalsMigrated.test.tsx` (6): `FilterModal` (nombre, foco, Tab adentro, Escape una vez, scroll liberado); `ReviewsModal` (nombre, foco, Escape) y **login encima de las reseñas: Escape cierra solo el login**; `ProjectMap` con **Leaflet real en jsdom** (solo hizo falta un `ResizeObserver` falso): mapa ampliado con nombre, foco y vuelta del foco al botón que lo abrió, y "Cerrar detalle" tras tocar un pin.
- `MomentsGrid.test.tsx` (+3) y `PostComposer.test.tsx` (+3): Escape con el foco afuera, foco que entra y vuelve, Tab adentro, el fondo no cierra, y Escape no cierra mientras publica.
- **Rojo → verde:** con los 5 componentes en su versión anterior fallan 8 de los nuevos. Los otros (Escape una vez y scroll de `FilterModal`, Escape mientras publica, el fondo de `MomentsGrid`) ya se cumplían: quedan como guarda. Para comprobarlo copié los archivos aparte y los restauré con chequeo de md5 (sin `git stash`, ver §80).

### Verificación
- **Frontend: 362/362**, también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.**
- **Mutación (13 mutantes):** sacar el nombre o el `id` del título en cada modal, cada "Cerrar detalle", que Escape del compositor saltee `requestClose`, y que el fondo cierre (compositor y visor). 12 muertos. **Sobrevivió 1:** "el fondo cierra el visor de `MomentsGrid`" (no equivalente). Agregué el test y comprobé que ahora muere.
- **En Chrome** (SQLite descartable; página recargada después de la mutación para no ver estado de HMR): Explorar → filtros: diálogo "Filtros" con el aspecto de siempre, foco adentro, scroll bloqueado; Shift+Tab desde el panel va a "Mostrar 12 voluntariados" (el último); Escape cierra, libera el scroll y el foco vuelve al botón de filtros.

### Errores propios
1. En el test de `ProjectMap` guardaba la referencia al primer pin; el mapa recrea los marcadores después del primer render y el clic caía en uno desmontado. Lo encontré con un test de debug descartable (lo borré). Ahora se busca el pin en cada intento.
2. Un `sed` mío rompió ese archivo de debug (reemplazó todos los `);`); lo reescribí entero. No tocó archivos del proyecto.
3. En Chrome creí que el foco no volvía al botón de filtros: mi chequeo miraba `aria-label` y ese botón se nombra con `title`. Volvía bien.

### ⚠️ NO verificado
- En Chrome probé solo `FilterModal`. Reseñas, mapa ampliado, compositor y visor los cubren los tests.
- **Leaflet con el teclado dentro del mapa ampliado:** el trap de Tab incluye los controles enfocables del mapa. No probé que las flechas y +/- de Leaflet sigan andando con el foco en el mapa.
- Lector de pantalla real y uso táctil (igual que §79 y §80).

## 82. El panel de la ONG no decía a qué voluntariado es cada solicitud — REVISION F14

**Contexto:** `GET /ngos/me` ya mandaba `project_title` en cada solicitud pendiente (lo verifiqué en `routes/ngos.js`; `GET /ngos/:id/dashboard` también lo manda), pero el tipo `EnrollmentWithVolunteer` no lo declaraba y `NGODashboard` mostraba solo nombre y email. Con varios proyectos, la ONG no sabía a qué voluntariado se anotó cada persona. Además, si la misma persona se anotaba en dos, sus filas y los nombres de sus botones (§80) eran idénticos.

**Qué se hizo:**
- `api.ts`: `PendingEnrollment extends EnrollmentWithVolunteer { project_title: string }`, usado solo en `ngos.me()`. `GET /enrollments/project/:id` (el otro uso del tipo base) no trae el título y no lo necesita: es la pantalla de un único proyecto.
- `NGODashboard`: el título del proyecto en una línea entre el nombre y el email, y los botones pasan a "Aprobar a Juan Pérez en Reforestación Urbana" / "Rechazar a …".
- `API_CONTEXT.md`: la respuesta de `GET /api/ngos/me` documentada con `project_title`.
- Sin cambios de backend.

### Tests
- `NGODashboard.test.tsx` (nuevo, 2): cada solicitud muestra su proyecto, y la misma persona en dos proyectos tiene cuatro botones distintos. Rojo con el componente anterior (no encuentra el título ni esos nombres), verde después. En `A11yNames.test.tsx` cambié los dos nombres esperados.

### Verificación
- **Frontend: 364/364. Typecheck: 0 errores** (antes de este cambio, TypeScript no podía detectar el uso de `project_title` porque el tipo no lo tenía).
- **Mutación (2):** sacar la línea del título y sacar "en …" de los nombres: los dos mueren.
- **En Chrome** (SQLite descartable, Sustentando): la solicitud de Juan Pérez muestra "Reforestación Urbana" en verde bajo el nombre; los botones se llaman "Aprobar a Juan Pérez en Reforestación Urbana" / "Rechazar a …".

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- Solo lo vi en ancho de escritorio. En el celular la fila es más angosta: el título tiene `truncate`, así que se corta con "…" si es largo, pero no lo vi.
- El seed tiene una sola solicitud pendiente: el caso de "la misma persona en dos proyectos" está probado solo en el test.

## 83. Respuestas viejas que pisaban a las nuevas — REVISION F15

**Contexto:** la revisión lo dejó "a confirmar con latencia simulada" en tres pantallas. **Lo confirmé antes de tocar nada:** escribí los tests con promesas que resuelvo a mano en el orden que quiero (primero la respuesta nueva, después la vieja). Fallaron los 4:
- **Chat** (`ChatThread`, `[userId]`): al pasar de la conversación con Ana a la de Juan, si el hilo de Ana llegaba último, el hilo de Juan mostraba los mensajes de Ana con el encabezado "Ana". Un error del hilo de Ana también aparecía en el de Juan.
- **Feed público** (`PublicFeed`): al elegir Educación y enseguida Salud, si Educación llegaba última, con Salud seleccionada se veían los proyectos de Educación.
- **Perfil público** (`VolunteerPublicProfile`, `[id, user]`): al saltar de un perfil a otro desde la lista de seguidores, el perfil viejo pisaba al nuevo.

**Qué se hizo:**
- `ChatThread` y `VolunteerPublicProfile`: `let cancelled = false` en el effect, `if (!cancelled)` antes de cada `set…` (en `then`, `catch` y `finally`) y `cancelled = true` en el cleanup. Es el patrón que ya usaba `PostComposer`. El chat además limpia el error al cambiar de conversación (antes un error de la anterior podía quedar).
- `PublicFeed`: `load()` se llama desde dos effects y desde el formulario de búsqueda, así que el cleanup de un effect no alcanza. Uso un número de pedido en `useRef` y solo aplico la respuesta (o el error, o el fin de carga) del último.
- Los tres indicadores de carga ahora tienen `role="status"` con nombre ("Cargando mensajes", "Cargando perfil", "Cargando proyectos"). Lo necesitaba el test (ver errores propios) y además un lector de pantalla ahora los anuncia.

### Tests (nuevos: 10, `StaleResponses.test.tsx`)
- Orden "nueva primero, vieja después": chat (mensajes y encabezado), error del chat, feed y perfil.
- Orden "vieja primero mientras la nueva sigue en vuelo": se sigue viendo "cargando" y nada de lo viejo (chat, perfil, feed).
- La vieja **falla** al final: su error no aparece (perfil) y no borra lo que se está mostrando (feed). Y el error de la conversación anterior no queda en la nueva.

### Verificación
- **Frontend: 374/374**, también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.**
- **Mutación (13 mutantes:** cada guarda de `then`/`catch`/`finally`, cada cleanup, el reseteo del error y el incremento del número de pedido**):** en la primera corrida **sobrevivieron 6, ninguno equivalente**: el test cubría un solo orden de llegada. Agregué los otros órdenes y quedó 1. Ver errores propios. **Final: 0 sobrevivientes.**
- **En Chrome** (SQLite descartable), solo el camino normal (**la carrera no la pude reproducir:** no tengo forma de agregar latencia a la red desde la extensión):
  - Feed: Medio Ambiente y enseguida Alimentación → se ven los 3 de Alimentación (los mismos que devuelve la API) y ninguno de Medio Ambiente.
  - Perfil de María → lista de seguidores → Lucía: muestra a Lucía, sin restos de María. La lista se cerró y el scroll quedó liberado.
  - Chat de María con Juan: carga y muestra "Todavía no hay mensajes".

### Errores propios
1. **Un test que pasaba por la razón equivocada:** en el feed buscaba los esqueletos de carga por la clase `animate-pulse`, que también tiene un ícono del encabezado. El mutante "termina la carga con la respuesta vieja" sobrevivía. Pasé a `role="status"` con nombre y ahora muere. Lección: no afirmar por clases de estilo.
2. La primera versión del test cubría un solo orden de llegada (la mutación lo mostró: 6 sobrevivientes).

### ⚠️ NO verificado
- **La carrera en un navegador real**, con latencia de verdad.
- **El cambio de conversación dentro del chat en Chrome:** el seed no tiene conversaciones y no quise crear mensajes solo para esto. Hoy casi no se llega a ese caso desde la interfaz, porque al cambiar de conversación se vuelve a la lista (otra ruta, que desmonta el hilo).
- **No revisé el resto de las pantallas** con el mismo patrón (`ProjectDetails`, `NGOPublicProfile`, `CompanyPublicProfile`, `ExploreScreen`, `MainFeed`…). Las que cargan por `:id` tienen el mismo riesgo si se navega de un recurso a otro sin desmontar. Quedan para revisar con este mismo test.

## 84. Tests que prometían más de lo que verificaban, y `setup` como test — REVISION T2–T4

**Qué se hizo (solo tests; nada de código de la app):**
- **T2** `ProjectCard.test.tsx`: "muestra el título, la ubicación y la categoría" no miraba la categoría. Ahora la afirma. La tarjeta ya la mostraba (`ProjectCard.tsx`), así que no había bug.
- **T3** `api.test.js`, "recomendaciones influenciadas por categoría": solo miraba el status y `based_on_history`, que se calcula aparte del puntaje. Con el test viejo, la señal de categoría podía no hacer nada y el test pasaba igual. Ahora la ONG crea dos proyectos iguales salvo la categoría: uno de la categoría del historial de la voluntaria (Medio Ambiente) y otro de Educación, creado **después** (el desempate por fecha favorecería a ese). El test exige que el de su categoría aparezca antes, con más puntaje y con la razón `Coincide con tu interés en "Medio Ambiente"`, y que el otro no tenga esa razón.
- **T4**: la revisión listaba 5 `test('setup')` sin asserts. Buscando encontré **10** (los otros 5 tenían asserts de precondiciones; uno era mío, de §77). Los 10 pasaron a `before()`. Si una preparación falla, `node:test` **cancela** los tests de esa suite en vez de correrlos con datos `undefined` (fallas en cascada confusas). Además ya no cuentan como tests.

### Verificación
- **Backend SQLite: 371/371** (antes 381; −10 por T4), también con `TZ=America/Argentina/Cordoba`, `cancelled 0`, salida 0.
- **Que un `before()` roto no pase en silencio:** rompí a propósito el de `messages-conversations.test.js` y la corrida dio `pass 0 · fail 0 · **cancelled 4**`, mostró el error y salió con **código 1**. Restauré el archivo (comparado byte a byte). **Ojo:** el resumen dice `fail 0`, así que de ahora en más hay que mirar `cancelled` y el código de salida (lo agregué en `CLAUDE.md`).
- **Mutación:** T2: sin `{project.category}` en la tarjeta → muere. T3: apagar la señal 1 (`if (hasHistory)` → `if (false)`) → muere; sacar solo la razón → muere. Con el test viejo de T3 los dos habrían sobrevivido (por lectura: no miraba ni el orden ni las razones).
- **Frontend: 374/374. Typecheck: 0 errores.**

### Errores propios
- Mi primer intento de editar `api.test.js` fue un `node -e "…"` con backticks adentro: el shell los interpretó (`Bearer: command not found`) y el script no escribió nada (falló su propio chequeo). Lo pasé a un script en archivo.
- Un script de docs falló a mitad (buscaba una fila de `REVISION.md` que ya había cambiado en §78). Alcanzó a escribir `CLAUDE.md` y no `REVISION.md`; lo revisé y completé.

### ⚠️ NO verificado
- ~~`npm run test:pg`~~ **Verificado después del commit** (el usuario prendió Docker; Postgres 16 en contenedor): **373/373**, también con `TZ=America/Argentina/Cordoba`, `cancelled 0`, salida 0.

## 85. Registro sin transacción y email duplicado simultáneo → 500 — REVISION B17

**Contexto:** `POST /api/auth/register` hacía el `INSERT` en `users` y después, suelto, el del perfil (`voluntarios`/`ngos`/`empresas`). Lo confirmé con tests antes de tocar el código:
- **Falla a mitad (los 3 roles, los dos motores):** inyectando una falla en el `INSERT` del perfil (mismo mecanismo que §59: se intercepta `db.run` y el `tx.run`), quedaba **el usuario sin perfil**. Ese email ya no se podía volver a registrar ("Ya existe una cuenta").
- **Mismo email, 6 registros a la vez:** en **Postgres, 3 de 3 corridas** dieron `201, 500, 500, 409, 409, 409`: varios pasaban el `SELECT` previo y chocaban con el `UNIQUE` de `users.email`. En SQLite no se reproduce (dio un 201 y cinco 409).
- De paso, releía al usuario "por email" en vez de generar el id (regla 23).

**Qué se hizo:**
- `routes/auth.js`: el id sale de `randomUUID()`. Usuario y perfil van en **`db.transaction()` con `tx.*`** (regla 21). Si el `INSERT` choca con el `UNIQUE` → **409** con el mismo mensaje de siempre. El `SELECT` previo queda: evita calcular el hash y abrir una transacción para el caso común (secuencial). La respuesta no cambió.
- **`src/lib/dbErrors.js` (nuevo):** `isUniqueViolation(err)` (Postgres `23505`; SQLite `SQLITE_CONSTRAINT_UNIQUE`/`_PRIMARYKEY` o el mensaje). `routes/enrollments.js` ya tenía esa condición inline (`err.message?.includes('UNIQUE') || err.code === '23505'`); ahora usa el helper (regla 3).
- Docs: `API_CONTEXT.md` (registro: validación real, transacción, 409; **login**: el doc decía que el mensaje de error era genérico, **y no lo es**: ver B20 abajo), y `AI_RULES.md` regla 21 (cuándo usar el helper).

### Tests (nuevos: 9)
- `register-transaction.test.js` (5): falla en el perfil para cada rol (500, no queda el usuario y el mismo email después se registra bien); 6 registros simultáneos (un 201, cinco 409, un usuario, un perfil); la respuesta trae el usuario recién creado, releído por id.
- `test/unit/dbErrors.test.js` (3): los códigos de los dos motores, y que FK, NOT NULL y errores comunes **no** cuentan como UNIQUE (para no convertirlos en 409).
- `enrollments-concurrency.test.js` (+1): la misma persona se inscribe 6 veces a la vez al mismo proyecto → un 201 y cinco 409, una sola inscripción. Ese camino (el 409 de `enrollments.js`) **no tenía test**: lo encontró la mutación.

### Verificación
- **SQLite 380/380 y Postgres 382/382**, los dos también con `TZ=America/Argentina/Cordoba`, `cancelled 0`, salida 0.
- **Mutación (9 mutantes, cada uno contra SQLite y Postgres):** sin transacción, sin capturar el 409, el id sin insertar, cada rama del helper, "cualquier error es UNIQUE" y el 409 de inscripciones. Todos muertos menos:
  - **"Sin el `SELECT` previo" — equivalente:** con el 409 por `UNIQUE`, un duplicado responde igual con o sin el `SELECT`; solo cambia que se calcula el hash de más.
  - En la primera corrida también sobrevivió "inscripción sin 409": no era equivalente, faltaba el test (agregado arriba). Ahora muere.

### Errores propios
- La primera versión del test de inscripciones simultáneas tenía un `if (mine)` que podía saltarse la verificación de "una sola inscripción". Lo hice estricto antes de commitear.

### ⚠️ NO verificado / visto y no tocado
- **B20 (login que distingue "no hay cuenta" de "contraseña incorrecta")** sigue pendiente de tu decisión. Corregí el doc, que decía lo contrario, sin cambiar el comportamiento.
- La interfaz no cambia: el 409 ya se mostraba en `AuthModal` como "Ya existe una cuenta con ese email". No lo miré en Chrome.

## 86. Endpoints públicos devolvían columnas no elegidas — REVISION B21 (lista blanca, decisión del usuario)

**Contexto:** test centinela (`public-columns.test.js`): agrega una columna "secreta" a cada tabla con datos públicos y recorre los 22 endpoints públicos. **Rojo: 11 la devolvían.** La causa principal: `fmt`, `fmtNgo` y `fmtEmpresa` empezaban con `...fila` (salían todas las columnas, también en endpoints autenticados). Además: catálogos con `SELECT *`, subconsultas del detalle de proyecto (`c.*`, `r.*`, KPIs `*`, mi inscripción `*`), y `/ngos/:id/projects` y el dashboard de ONG devolvían filas crudas. El usuario eligió la lista blanca completa.

**Qué se hizo:** los tres formateadores son listas blancas (`fmt` deja pasar los extras que el feed agrega a la fila: `PROJECT_EXTRAS`). `fmtNgo` se exporta y `follows.js` lo importa (borrada su copia y un `parseJson` sin uso: deuda "fmt compartido", resuelta). Catálogos y subconsultas con columnas explícitas (`KPI_COLS`). `/ngos/:id/projects` y el dashboard pasan por `fmt` (ninguna pantalla los usa). Se mantienen `user_id` de ONG/empresa (botón "Enviar mensaje"). Salen de las respuestas: las columnas en español y `created_at` de ONG, empresa y catálogos (el frontend no los usa: auditado con grep).

**Método para no romper la API:** foto de las claves de 24 endpoints (públicos y con los 3 roles) antes y después, y cada clave que desapareció buscada en el frontend. **Así apareció un error mío:** la primera versión dejaba al feed sin `ratings` (follows.js lo agrega antes de formatear) y `FeedPostCard` se quedaba sin reseñas; ningún test lo veía. Lo agregué a los extras y sumé tests de contrato ("sale todo lo que espera el frontend") para proyectos, feed, ONGs y empresas.

### Verificación
- **SQLite 385/385 y Postgres 387/387**, también con `TZ=America/Argentina/Cordoba`. Frontend 374/374 (sin cambios).
- **Mutación (15, los dos motores):** volver a `...fila` en cada formateador, sacar `ratings`/los extras/`ngo_name`/`user_id`, `SELECT *` en catálogos, comentarios, calificaciones y KPIs, y `/ngos/:id/projects` crudo. Sobrevivió 1 ("comentarios `c.*`"): el test no tenía comentarios en `proj-1`; agregado, ahora muere. **0 sobrevivientes.**
- **Chrome** (SQLite descartable): feed (reseñas de "Reciclaje Educativo" desde la tarjeta: 5.0, Juan Pérez), detalle de proyecto, perfil público de ONG y de empresa ("Mensaje" lleva a `/messages/user-ngo-1` y `/messages/user-comp-1`), Explorar (12 pines, recomendaciones) y perfil propio de la ONG; sin "undefined" ni "NaN".

### Errores propios
1. El feed sin `ratings` (arriba): lo atrapó la comparación de claves, no los tests.
2. El test centinela decía insertar un comentario y no lo hacía (lo mostró la mutación).

### ⚠️ NO verificado
- Pantallas de empresa con sesión, panel de ONG con proyectos de otras ONGs, y móvil: no las recorrí en Chrome (tests de contrato + foto de claves).
- Los demás `SELECT *` del backend en endpoints autenticados que devuelven datos propios (`/auth/me`, empleados, notificaciones, inscripciones) no se tocaron: no son públicos.

## 87. WebSocket del chat: errores internos al cliente, sin tope de tamaño ni de frecuencia — REVISION B19 (salvo JWT_SECRET)

**Contexto (confirmado con tests antes de tocar nada, rojo en 6 de 7):** el listener de `ws/index.js` le mandaba al cliente el `err.message` de cualquier error:
- un error de disco simulado llegó tal cual, **con la ruta del archivo**;
- un JSON mal formado devolvía `Expected property name or '}' in JSON at position 1…` (inglés técnico, regla 19);
- un `to` que era un objeto llegaba a la consulta: por WebSocket devolvía `Too few parameter values were provided` y por REST, **500**.

Además no había `maxPayload` (el default de `ws` es **100 MiB**) y una ráfaga de 30 mensajes se guardaba entera.

**Qué se hizo:**
- `routes/messages.js`: `MessageInputError` para los errores del usuario (destinatario inválido o inexistente, vacío, largo, a uno mismo). Se valida que `to` sea un string. REST decide el 400 por tipo de error y no buscando palabras en el mensaje (`'vacío'`, `'largo'`…), que era frágil.
- `ws/index.js`: `maxPayload` 64 KB (más grande → la conexión se cierra con `1009`); hasta 20 envíos cada 10 s por usuario (`allowSend`, cuenta intentos; los rechazos no alargan el bloqueo); JSON mal formado → "Mensaje inválido"; error del usuario → su texto; cualquier otro → "Error al enviar el mensaje" + `console.error`.
- **No tocado:** la copia del fallback de `JWT_SECRET` en `ws/index.js:19` (regla 17, espera tu decisión).

### Tests (nuevos: 11)
- `ws-hardening.test.js` (7): error interno no se reenvía; JSON mal formado; `to` objeto (y que no se guarda nada); error del usuario sí se muestra; REST con 400 para esos casos; 200 KB → cierre `1009`; ráfaga de 30 → 20 guardados y 10 avisos. El test termina todos los sockets en `after()`: en la primera versión, cuando una aserción fallaba antes del `close`, el servidor no cerraba y la corrida se colgaba.
- `test/unit/wsRateLimit.test.js` (4): el tope, que la ventana se libera con el tiempo (reloj a mano), que los rechazos no cuentan y que el límite es por usuario.

### Verificación
- **SQLite 396/396 y Postgres 398/398**, los dos también con `TZ=America/Argentina/Cordoba`.
- **Mutación (12, los dos motores): 12 muertos**, entre ellos sin `maxPayload`, sin límite, `>` en vez de `>=`, ventana que nunca expira, rechazos que cuentan, límite global en vez de por usuario, reenviar `err.message` y REST todo 500.

### Errores propios
- La primera corrida del test se colgó: en rojo, el socket de 200 KB nunca se cerraba y el `after` esperaba al servidor. Corregido terminando los sockets.
- El test de frecuencia usaba a María, que ya había mandado mensajes en los tests anteriores (y cuentan para su límite). Pasé la ráfaga a Juan.

### ⚠️ NO verificado / pendiente
- **Encontrado y no arreglado — el frontend ignora los errores del socket:** `ChatContext` solo atiende `type: 'message'`. `ChatThread` borra el borrador al mandar por WebSocket, así que si el servidor rechaza el envío (ahora también por frecuencia) **el mensaje se pierde sin aviso**. Ya pasaba antes con cualquier error por socket. Arreglarlo bien pide un id de pedido en el protocolo (o mandar siempre por REST); queda para decidir.
- **No probado en Chrome:** no cambió nada visible; el envío normal por socket lo cubren los tests de punta a punta de `insert-returns-own-row.test.js`.
- `POST /api/messages` sigue sin límite de frecuencia (no hay rate limiting en REST; deuda conocida).
- El mapa de envíos recientes es en memoria y por proceso (igual que las conexiones, §18).

## 88. KPIs con datos inválidos: 500 o, peor, guardados — seguimiento de REVISION D6 (§78)

**Contexto:** §78 confirmó que el PUT de KPI sin `nombre` daba 500. Al escribir el test con todos los casos inválidos para POST y PUT (rojo en 17 de 19), apareció más:
- **500 en 9 casos:** PUT sin `nombre` (NOT NULL), `nombre` vacío o que no es texto (`.trim()`), descripción o unidad que no son texto, `tipo_valor` fuera de la lista (CHECK de la base).
- **7 casos inválidos se GUARDABAN** (201/200): un nombre de 121+ caracteres, `valor: 'mucho'` o `'1e400'` (con `parseFloat`), etc.

**Qué se hizo:** `validateKpi` compartido por POST y PUT, con `checkText` (§76) y topes de largo (nombre 120, descripción 500, unidad 40). `tipo_valor` debe estar en la lista. `valor` tiene que ser un número finito con `Number()` estricto (`'12abc'` ya no pasa como 12, igual que las horas en §75); `null`, `''` o ausente = sin valor. **No se tocó:** que el PUT no sea parcial (deuda conocida, regla 16): sigue exigiendo `nombre` y pisando los demás campos. Tampoco F3 (KPI de tipo "texto", pendiente de decisión): un `valor` no numérico de ese tipo sigue llegando como `null` desde el frontend.

### Tests (nuevos: 21, `kpis-input-validation.test.js`)
10 casos inválidos × POST y PUT (400 con el mensaje esperado, y la base sin cambios: no se crea nada / el KPI no cambia), más uno de casos válidos (texto recortado, tipo de la lista, `valor` null y `''` → `null`).

### Verificación
- **SQLite 417/417 y Postgres 419/419**, también con `TZ=America/Argentina/Cordoba`.
- **Mutación (10, los dos motores):** primera corrida, 8 muertos y **2 sobrevivientes no equivalentes** (`parseFloat` en vez de `Number`, y `''` guardado como 0). Agregué `'12abc'` y `valor: ''` al test: **los 10 mueren**.
- El formulario (`NGOKPIs.tsx`) manda tipos de la misma lista y `valor` como número o nada: el camino normal no cambia. No lo miré en Chrome (§63 ya lo había verificado y el formulario no cambió). Un nombre de más de 120 caracteres ahora muestra el error del servidor en el formulario (ya existía ese manejo).

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- `fecha` sigue sin validarse (texto libre en una columna TEXT; el formulario manda `YYYY-MM-DD`).

## 89. F15 en las demás pantallas que cargan por `:id` (pendiente de §83)

**Contexto:** §83 arregló el chat, el feed público y el perfil público de voluntario, y dejó anotadas las demás pantallas que cargan según un parámetro de la URL. Revisadas: **seis sin protección**: `ProjectDetails`, `NGOPublicProfile`, `CompanyPublicProfile`, `NGOProjectDetail` (inscriptos), `NGOKPIs` y `NGOEmpleados`. Todas cargan desde varios lugares (el effect del parámetro, "Reintentar" y recargas después de una acción: inscribirse, comentar, aprobar, guardar un KPI, agregar a alguien al equipo), así que el `cancelled` de un effect no alcanza. **Confirmado con tests antes de tocarlas (rojo 7 de 7):** al pasar de A a B en la misma ruta (otro link o atrás/adelante), si la respuesta de A llegaba última, se mostraba A bajo la URL de B.

**Qué se hizo:**
- **`lib/useLatestRequest.ts` (nuevo):** `start()` / `isLatest(req)`. Es el patrón de número de pedido de `PublicFeed` (§83), hecho hook para no repetirlo en siete lugares (regla 3). `PublicFeed` pasa a usarlo.
- En las seis pantallas, `isLatest` antes de cada `set…` del resultado, del error y del fin de carga. `NGOKPIs` además cancela en su effect el pedido del título del proyecto.
- Los indicadores de carga de las seis tienen `role="status"` con nombre ("Cargando voluntariado", "Cargando organización"…), igual que en §83: lo anuncia un lector de pantalla y el test lo busca por rol.
- `NGOEmpleados` sigue con su `fetch` directo (deuda conocida, regla 4): solo se le agregó la guarda.

### Tests (nuevos: 19, `StaleResponsesById.test.tsx`)
Para las seis pantallas, los tres órdenes de llegada: la nueva primero (más un caso de error en el detalle de proyecto), la vieja **falla** al final (no tapa ni vacía la pantalla nueva), y la vieja llega primero con la nueva en vuelo (sigue "cargando", sin datos viejos).

### Verificación
- **Frontend: 393/393**, también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.**
- **Mutación (20: el hook y cada guarda de cada pantalla):** la primera corrida, con solo el orden "la nueva primero", dejó **11 sobrevivientes no equivalentes** (todas las guardas de `catch` y `finally` salvo una). Agregué los otros dos órdenes: **0 sobrevivientes**.
- **En Chrome** (SQLite descartable, como Sustentando), el camino normal de las seis: detalle de proyecto, inscriptos, KPIs, equipo, perfil público de Green Córdoba y de TechCorp. Cargan, sin "undefined" y sin quedarse en "cargando".

### Errores propios
- Un heredoc de bash con comillas y backticks anidados no se pudo ejecutar (`unexpected EOF`); no llegó a escribir nada (lo comprobé con `git status`). Hice los cambios con la herramienta de edición.
- La primera versión del test cubría un solo orden de llegada: el mismo error que en §83 (lo mostró de nuevo la mutación).

### ⚠️ NO verificado
- La carrera en el navegador real (no hay forma de agregar latencia desde la extensión), y el cambio de `:id` sin desmontar en Chrome. Las navegaciones de la extensión recargan la página entera.

## 90. KPI de tipo "texto": se saca (decisión del usuario) — REVISION F3

**Contexto:** el formulario ofrecía el tipo "texto", pero `kpis.valor` es `REAL`: "Alta" llegaba como `NaN` → `null` y el KPI quedaba con "—". El usuario eligió **sacar el tipo** (en vez de agregar una columna de texto).

**Qué se hizo:**
- **Backend:** `KPI_TIPOS` (`validateKpi`, §88) ya no incluye `texto`: crear o editar con ese tipo da 400 "Tipo de KPI inválido". El `CHECK` de la base **no se tocó**: los KPIs de tipo texto que ya existan siguen siendo válidos.
- **Frontend (`NGOKPIs`):** el selector ofrece solo Número, Porcentaje y Sí/No (`TIPOS_EDITABLES`), y el valor es siempre numérico. Un KPI viejo de tipo texto **se sigue viendo** con su etiqueta. **Al editarlo, el formulario arranca en "Número"**: si no, se mandaría un tipo que el servidor ahora rechaza.

### Tests
- Backend: el caso `tipo texto` → 400 en POST y PUT (`kpis-input-validation.test.js`, +2).
- Frontend (`NGOKPIs.test.tsx`, +3): el selector no ofrece "Texto" y el valor es numérico; un KPI de texto existente se sigue mostrando; al editarlo y guardar, **lo que se envía** es `tipo_valor: 'numero'`.

### Verificación
- **Backend SQLite 419/419 y Postgres 421/421. Frontend 396/396. Typecheck: 0 errores.**
- **Mutación (4):** volver a aceptar `texto` en el back y en el front, y sacar el mapeo al editar, mueren. Sobrevive 1, **equivalente**: el `type` del campo según "texto". Con el selector sin esa opción y el mapeo al editar, el formulario ya no puede estar en ese tipo.

### Errores propios
1. **Un arnés de mutación inválido:** en bash usé `read` sin `-r` y se comió las barras invertidas de los patrones. Ningún mutante se aplicó ("no aplica") y los resultados no valían nada. Lo rehice con un script en archivo y reemplazo literal.
2. **Un test que no probaba lo importante:** "al editar arranca en Número" miraba el valor que **muestra** el `<select>`. Con el estado en "texto" y esa opción inexistente, el DOM igual muestra la primera, así que pasaba aunque se mandara `texto`. Lo vio la mutación; ahora el test guarda y revisa lo enviado.
3. Al editar `projects.js` (CRLF) metí 2 saltos `\n` sueltos en un comentario; lo detecté y normalicé a CRLF antes de commitear.

### ⚠️ NO verificado
- En Chrome no lo miré: es un selector con una opción menos (los tests cubren lo enviado).
- Si en producción hay KPIs de tipo texto, se ven con "—" (como antes). Para que tengan valor hay que editarlos (pasan a "Número").

## 91. Login: un solo mensaje de error (decisión del usuario) — REVISION B20

**Contexto:** el login respondía "No encontramos una cuenta con ese email" o "Contraseña incorrecta", así que se podía averiguar qué emails tienen cuenta. El usuario eligió el mensaje único. Al revisarlo apareció una segunda vía para lo mismo: con un email inexistente **no se calculaba el hash** (bcrypt, decenas de ms), y el **tiempo** de respuesta también lo delataba.

**Qué se hizo (`routes/auth.js`):** los dos casos responden `401 "Email o contraseña incorrectos"`. Si no hay cuenta, igual se hace `bcrypt.compare` contra `DUMMY_HASH` (un hash fijo que se calcula una vez al arrancar), así el trabajo es el mismo. El frontend no cambia (muestra el mensaje del servidor).

### Tests (nuevos: 3, `login-message.test.js`)
Misma respuesta (status y cuerpo) para email inexistente y para contraseña incorrecta; con un email inexistente `bcrypt.compare` se llama una vez (mock sobre el mismo módulo); el login correcto sigue andando. Rojo antes en los dos primeros.

### Verificación
- **SQLite 422/422 y Postgres 424/424**, también con `TZ=America/Argentina/Cordoba`.
- **Mutación (2):** volver al mensaje distinto y saltear el hash cuando no hay cuenta: los 2 mueren.

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado / límites
- **El tiempo no se midió:** el test verifica que se haga el mismo trabajo (una comparación de bcrypt), no que los tiempos sean iguales (dependen de la máquina y del ruido).
- **El registro sigue diciendo "Ya existe una cuenta con ese email"** (409, §85): también revela si un email está registrado. Es lo habitual (no hay forma de registrarse sin avisarlo, salvo con verificación por mail). Queda anotado.
- Sin límite de intentos en el login (no hay rate limiting en REST; deuda conocida).

## 92. El chat manda siempre por REST (decisión del usuario) — pendiente de §87

**Contexto:** §87 encontró que, con el WebSocket abierto, `ChatThread` mandaba por el socket y borraba el borrador. Si el servidor rechazaba el envío (error interno, destinatario inválido o el límite de frecuencia nuevo), la respuesta `{ type: 'error' }` no la escuchaba nadie y **el mensaje se perdía sin aviso**. Lo confirmé con un test antes de tocarlo (rojo en 2 de 2: con el socket "conectado" no se llamaba a REST, y un rechazo no se veía). El usuario eligió mandar siempre por REST (en vez de agregar un id de pedido al protocolo del socket).

**Qué se hizo:**
- `ChatThread`: el envío es siempre `POST /api/messages`. Si falla, se muestra el error y se restaura el borrador (eso ya lo hacía el camino REST). El mensaje guardado se agrega a la lista (sin duplicar por id).
- `ChatContext`: se quitó `sendViaSocket` (ya no tiene usos). El socket queda para recibir.
- **No tocado:** el listener `type: 'send'` del servidor. Ningún cliente lo usa, pero está reforzado (§87). Sacarlo sería una limpieza aparte.

### Tests (nuevos: 2, `ChatSend.test.tsx`)
Con un socket simulado "conectado": el envío va por REST y el mensaje guardado se ve; si el servidor lo rechaza (p. ej. con el texto del límite de frecuencia), el error se ve y el borrador vuelve.

### Verificación
- **Frontend: 398/398. Typecheck: 0 errores.** (Backend sin cambios.)
- **Mutación (4):** no agregar el mensaje guardado, no restaurar el borrador y no mostrar el error: mueren. Sobrevive 1, **equivalente**: sacar la deduplicación por id. Por REST, el servidor solo empuja el mensaje al destinatario, así que el propio no puede llegar dos veces a la pantalla; queda como defensa.
- **En Chrome** (SQLite descartable, María → Juan): el mensaje se envió, se ve **una sola vez**, quedó guardado una vez (`GET /messages/thread`) y el campo se vació.

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- El camino de error en Chrome (REST no tiene límite de frecuencia y no forcé un rechazo). Lo cubre el test.

## 93. Filtro de palabras por palabra completa (decisión del usuario) — REVISION B7

**Contexto:** `hasBadWord` comparaba por **subcadena**: "Traigan la computadora" daba 400 (contiene "puta"), igual que "disputa", "reputación" o "diputado". Además "imbécil" con acento pasaba. La lista estaba copiada en `routes/projects.js` y en `ProjectDetails.tsx`. El usuario eligió comparar palabras completas.

**Qué se hizo:**
- **`backend/src/lib/badWords.js` y `frontend/src/lib/badWords.ts` (nuevos):** el texto se normaliza (sin acentos: NFD y se sacan las marcas), se pasa a minúsculas, se parte en palabras (`\p{L}+`, letras Unicode) y se compara palabra por palabra con la lista (la misma de antes, 11 palabras). `projects.js` (comentarios) y `posts.js` (textos de publicaciones) usan el módulo; `ProjectDetails.tsx` usa la copia del frontend. Se borraron las dos definiciones viejas y el export `hasBadWord` de `projects.js`.
- **Sincronía:** `test/unit/badWords.test.js` lee la lista del frontend y exige que sea **igual** a la del backend.
- **Límites aceptados del criterio:** los plurales pasan ("boludos") y los homónimos no se distinguen ("forro polar", "concha" de mar se rechazan igual que antes).

### Tests (nuevos: 13)
- Backend unitario (`badWords.test.js`, 6): las palabras legítimas que contienen una de la lista pasan; la palabra sola, con mayúsculas, acentos o signos, se rechaza; textos vacíos; letras con tilde o de otros alfabetos no cortan la palabra; los límites (plural, homónimo); y la sincronía con el frontend.
- Backend integración (`comments-badwords.test.js`, 2): "Traigan la computadora…" → 201 (antes 400); "Qué imbécil…" y "sos un BOLUDO" → 400.
- Frontend (`lib/badWords.test.ts`, 3): el mismo criterio.
- **Rojo de comportamiento** (no "el módulo no existe"): primero moví la lógica vieja a los módulos nuevos y vi fallar los tests (3 en el backend, 2 en el frontend); después cambié el criterio.

### Verificación
- **Backend SQLite 430/430 y Postgres 432/432**, también con `TZ=America/Argentina/Cordoba`. **Frontend 401/401. Typecheck: 0 errores.**
- **Mutación (8):** volver a subcadena (back y front), no sacar acentos, no pasar a minúsculas, partir con `[a-z]+` y una lista distinta en el frontend. **Todos mueren** después de agregar un caso: "partir con `[a-z]+`" sobrevivía.

### Errores propios
1. **Un caso de test mal planteado:** puse "Ponete el forro polar" entre los textos que debían pasar, pero "forro" está en la lista: con palabra completa se rechaza (no hay forma de distinguir el homónimo). Lo pasé a "límites conocidos".
2. **Un test viejo roto por mi cambio:** `validators.test.js` importaba `hasBadWord` desde `routes/projects`, y yo había sacado ese export. Lo vio la suite completa; actualicé el `require`.
3. **Expliqué mal un sobreviviente:** creí que `[a-z]+` cortaría las palabras con ñ. No pasa, porque la normalización convierte la ñ en n antes de partir. Solo cambia con letras que no se descomponen (ø, ß…), y ese es el caso que agregué.

### ⚠️ NO verificado
- En Chrome no lo probé (el formulario y los mensajes no cambiaron; el criterio lo cubren los tests de los dos lados).
- Los comentarios de las **calificaciones** siguen sin pasar por el filtro (§74): no estaba en el alcance de B7. *(Resuelto en §104.)*

## 94. `JWT_SECRET` obligatorio en producción (decisión del usuario) — REVISION B19 / regla 17

**Contexto:** `middleware/auth.js` y `ws/index.js` tenían, cada uno, `process.env.JWT_SECRET || 'voluntariar_dev_secret'`. En producción sin la variable, cualquiera que leyera el repositorio podía firmar tokens válidos de cualquier usuario y rol. El usuario eligió exigirla en producción (no siempre).

**Qué se hizo:**
- **`src/lib/jwtSecret.js` (nuevo):** `resolveJwtSecret(env)`. En `NODE_ENV=production`, sin `JWT_SECRET` (o con el valor de desarrollo, que es público) lanza un error claro y el servidor no arranca. Fuera de producción devuelve la variable o `voluntariar_dev_secret`, como siempre.
- `middleware/auth.js` y `ws/index.js` toman el secreto de ahí (se borró la copia del WebSocket).
- **`render.yaml` no se tocó:** ya define `NODE_ENV=production` y `JWT_SECRET` con `generateValue: true`, así que el deploy cumple la regla nueva.
- Docs: `AI_RULES` regla 17, `CLAUDE.md` (pendiente resuelto, con una nota sobre el `.env` local) y `PROJECT_CONTEXT` §14.

### Tests (nuevos: 5, `test/unit/jwtSecret.test.js`)
Desarrollo/tests sin variable → valor de desarrollo; con variable → esa; producción sin variable o vacía → error; producción con el valor de desarrollo → error; y que ni el middleware ni el WebSocket tengan su propia copia (leen el código fuente). Rojo de comportamiento primero, con un stub que reproducía lo de antes.

### Verificación
- **SQLite 435/435 y Postgres 437/437**, también con `TZ=America/Argentina/Cordoba` (los tests fijan `JWT_SECRET` y `NODE_ENV=test`: no cambian).
- **Arranque real:** `NODE_ENV=production` sin `JWT_SECRET` → el proceso corta con "Falta JWT_SECRET: en producción es obligatoria…" y código de salida 1.
- **Mutación (5):** no exigir en producción, aceptar el de desarrollo, exigir también fuera de producción, ignorar la variable y el WebSocket con su copia: **los 5 mueren**.

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- **El deploy en Render** (no hay deploy). Por lectura de `render.yaml`, la variable se genera.
- **Tu `.env` local:** no lo abrí. Si tuviera `NODE_ENV=production` sin `JWT_SECRET`, el backend local no arrancaría (con el error de arriba).
- Los tokens emitidos con el secreto viejo dejan de valer si cambia el secreto (normal; en Render el valor generado es estable entre deploys).

## 95. `PUT /api/projects/:id` parcial (deuda conocida, aprobada por el usuario)

**Contexto (confirmado con tests, rojo 16 de 17):** el PUT pisaba todo lo que no venía. Mandando solo el título respondía **500** (descripción y ubicación a `NULL` contra el `NOT NULL`). Un `status` omitido volvía a `'active'` (**reactivaba un proyecto terminado**), y los montos, las horas y los textos opcionales quedaban en 0/`NULL`. Además respondía roles, requisitos y categoría **tomados del body, sin guardarlos**, y validaba mucho menos que el alta. Ninguna pantalla usa el endpoint (no hay edición de proyectos en la interfaz), así que el riesgo de cambiar el contrato era bajo.

**Qué se hizo (`routes/projects.js`):**
- Cada campo que no viene conserva su valor. El resultado combinado se valida con `validateProject` (como el alta), con chequeos de tipo (textos como string, `type` en `fugaz|sostenido`, montos finitos ≥ 0). `null`/`''` borra los opcionales.
- `roles_needed`, `requirements` y `category`, si vienen, se validan como en el alta (`cleanTextList`, B5) y **reemplazan** a los actuales. Proyecto y asociaciones van en **una transacción** (regla 21), con la condición de capacidad atómica de §40 en el `UPDATE`.
- La respuesta se relee de la base. El helper nuevo `loadAssoc(q, id)` (roles, requisitos y categoría) lo usan el PUT y `GET /:id`, que tenía la misma consulta.

### Tests
- `projects-partial-update.test.js` (nuevo, 17): cambiar solo el título no toca nada más; un proyecto terminado sigue terminado; roles/requisitos/categoría se guardan y la respuesta sale de la base; si no vienen quedan como estaban; listas vacías los borran; `null` borra un opcional y es inválido en uno obligatorio; 10 casos inválidos → 400 sin cambiar nada; y una falla inyectada a mitad no deja nada a medias.
- `ownership.test.js`: el test de la ONG **dueña** mandaba `description: 'x'`, que el PUT viejo aceptaba sin validar. Le puse una descripción válida (el test prueba la autorización, no la validación). El de la ONG ajena sigue dando 404 (se chequea el dueño antes de validar).

### Verificación
- **SQLite 452/452 y Postgres 454/454**, también con `TZ=America/Argentina/Cordoba`.
- **Mutación (12):** título siempre del body, status omitido → active, meta omitida → 0, no guardar roles/categoría, borrar requisitos aunque no vengan, responder sin releer, no validar el combinado, montos/tipo/textos sin chequear, `null` que no borra: **los 12 mueren**.

### Errores propios
- Ninguno en esta tarea (el test de `ownership` que cambié no era un error mío: el PUT viejo aceptaba datos que el alta rechaza).

### ⚠️ NO verificado
- En Chrome: no hay pantalla que lo use.
- `PUT` con `latitude`/`longitude` inválidos (texto): se guardan como `NaN`→`null` como antes. No lo cambié.

## 96. `GET /api/projects`: límite acotado y orden estable (deuda conocida, aprobada por el usuario)

**Contexto (confirmado con tests en los dos motores):** `limit` y `offset` iban con `parseInt` directo al SQL. `limit=abc`, `limit=-5` u `offset=abc` daban error (`LIMIT NaN`), y no había tope (`limit=100000`). El orden no tenía desempate: con proyectos empatados (mismo `created_at` y mismo puntaje), **en Postgres dos páginas repetían proyectos y salteaban otros** (los tres órdenes fallaron). En SQLite pasaba de casualidad, porque devuelve en orden de inserción.

**Qué se hizo:**
- `clampInt` pasó de `posts.js` a `lib/inputs.js` (lo usan `posts` y `projects`, regla 3). `limit`: default 20, entre 1 y **500** (lo máximo que pide hoy el frontend: el selector de patrocinio; Explorar pide 200). `offset` ≥ 0. Inválido → el default.
- Los tres órdenes (`featured`, `recent`, `rating`) terminan en `p.id`.
- `API_CONTEXT.md`: la paginación nueva, y la lista de query params corregida (listaba `tipo`, `categoria` "uno o varios ids", `ngo_id`, `page` y un default de `status` que el código nunca tuvo).

### Tests (nuevos: 11, `projects-pagination.test.js`, con 520 proyectos idénticos salvo el id)
6 combinaciones inválidas de `limit`/`offset` → 200 con defaults; sin `limit` → 20; `limit=100000` → 500; y para cada orden, cuatro páginas de 15 seguidas son exactamente los primeros 60 del listado completo, sin repetidos.

### Verificación
- **SQLite 463/463 y Postgres 465/465**, también con `TZ=America/Argentina/Cordoba`.
- **Mutación (6, los dos motores):** sacar el desempate de cada orden, sacar el tope y no acotar `limit`/`offset`: **los 6 mueren** (los de desempate, por Postgres).

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado / pendiente
- **No es paginación "de verdad" en la interfaz:** Explorar y el selector de patrocinio siguen pidiendo un bloque grande. Con más de 500 proyectos activos se cortarían. Haría falta "cargar más" en esas pantallas.
- En Chrome no lo miré: el camino normal (Explorar con `limit=200`) no cambia; lo cubren los tests.

## 97. Guardas de rol en el frontend (deuda conocida, aprobada por el usuario)

**Contexto:** `/ngo/*` y `/company/*` se abrían con cualquier rol o sin sesión. El backend rechazaba los datos, pero la interfaz mostraba un panel vacío (un voluntario en `/ngo/dashboard` veía "No hay proyectos"). Confirmado con tests antes de tocar (rojo en 7 de 9).

**Qué se hizo:**
- **`components/RequireRole.tsx` (nuevo):** mientras se verifica la sesión muestra "Verificando sesión" (`role="status"`). Sin sesión va al inicio y abre el login. Con otro rol va al inicio de ese rol (`homeFor`: ONG → `/ngo/dashboard`, empresa → `/company/profile`, voluntario → `/feed`; los mismos destinos que el login).
- `NGOLayout` y `CompanyLayout` envuelven todo en la guarda. Va **dentro del layout** y no en `routes.tsx`, así no cambia el árbol de rutas (lo usa `routes.test.tsx`) y los perfiles públicos `/ngo/:id` y `/company/:id` (bajo `Root`) siguen abiertos para todos.
- **Cerrar sesión desde el panel no abre el login:** todos los botones hacen `logout(); navigate('/')`. Si el layout llega a dibujarse sin sesión entre las dos cosas, la guarda lo interpretaría como "alguien sin sesión quiere entrar". Recuerda si en ese panel ya hubo sesión y en ese caso solo redirige. Lo encontré pensando el flujo, no por un error; el test que lo cubre dio rojo antes del arreglo.
- Es solo experiencia de uso: la autorización real sigue en el backend (AI_RULES regla 15).

### Tests (nuevos: 10, `RequireRole.test.tsx`, con los layouts reales)
ONG y empresa ven su panel; voluntario y la otra organización van a su inicio; sin sesión, al inicio con el login; durante la verificación, "cargando" sin redirigir ni abrir nada; y perder la sesión estando adentro no abre el login.

### Verificación
- **Frontend: 411/411. Typecheck: 0 errores.** (Backend sin cambios.)
- **Mutación (6):** sin chequear el rol, sin redirigir sin sesión, sin esperar la verificación, abrir el login aunque se haya cerrado sesión, no abrirlo nunca, y el destino de la empresa cambiado: **los 6 mueren**.
- **En Chrome** (SQLite descartable): visitante en `/ngo/dashboard` → `/` con el diálogo "Iniciar sesión"; María (voluntaria) en `/ngo/dashboard` y `/company/dashboard` → `/feed`; María en `/ngo/ngo-1` (perfil público) → lo ve; Sustentando en `/ngo/dashboard` → su panel; "Cerrar sesión" desde el menú lateral → `/`, **sin** diálogo, y la barra muestra "Entrar".

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- Los botones de cerrar sesión del menú inferior (móvil) usan `window.confirm`, que bloquea la extensión de Chrome: no los probé ahí. Hacen lo mismo que el lateral (`logout(); navigate('/')`).
- Un usuario de una empresa en el panel de ONG: lo cubre el test. En Chrome probé voluntaria y visitante.

## 98. `NGOEmpleados` pasa a `api.ts` (deuda conocida, aprobada por el usuario)

**Contexto:** `NGOEmpleados` era el único componente con `fetch` directo (AI_RULES regla 4). Problemas:
- usaba `import.meta.env.VITE_API_URL` **sin** el respaldo que tiene `api.ts` (`http://localhost:3001/api`): sin esa variable, la URL quedaba `undefined/ngos/…` (no lo verifiqué en la práctica: no abro el `.env` del frontend);
- al listar **no miraba `res.ok`**: un 403 "Sin acceso" o un 500 se veían como "Sin miembros en el equipo".

Confirmado con tests antes de tocarlo (rojo en 3 de 3).

**Qué se hizo:** `api.ngos.empleados.list(ngoId)` y `.create(ngoId, body)`, y el tipo `Empleado` en `api.ts` (regla 6). `NGOEmpleados` los usa; un error de carga se muestra con `InlineError` y "Reintentar" (patrón de F9, §65). El alta muestra el error del servidor como antes. Ya no queda ningún `fetch` directo fuera de `api.ts` (buscado con `grep`).

### Tests (nuevos: 3, `NGOEmpleados.test.tsx`; `fetch` global falla a propósito, para asegurar que no se use)
Lista con `api.ngos.empleados.list('ngo-1')`; un 403 se ve como error con "Reintentar" (no como "Sin miembros") y reintentar carga; agregar usa `create` con el formulario, muestra el error del servidor y recarga al guardar.

### Verificación
- **Frontend: 414/414. Typecheck: 0 errores.** Los tests anteriores que pasaban por esta pantalla (F15, nombres accesibles) siguen verdes: stubean `fetch`, que ahora usa `api.ts` por debajo.
- **Mutación (4):** mostrar el error como lista vacía, no guardar el error, no recargar tras agregar y mandar sin el id: **los 4 mueren**.
- En Chrome no lo miré esta vez: §89 ya había cargado la pantalla (equipo vacío del seed). El camino de error lo cubre el test.

### Errores propios
- Ninguno en esta tarea.

## 99. Se borra `OnboardingScreen.tsx` (decisión del usuario)

**Contexto:** componente de login/registro alternativo que nunca estuvo en `routes.tsx` (código muerto desde el análisis inicial). Tenía su propia copia de las validaciones del registro, que habría que mantener sincronizada. El usuario eligió borrarlo; queda en el historial de git si se quiere recuperar.

**Qué se hizo:** `git rm` del archivo (nada lo importaba: verificado con `grep`). Docs: `FRONTEND_CONTEXT` (lista de componentes, ahora 48, y los ítems de "problemas" y "mejoras"), `PROJECT_CONTEXT` y la tabla de deuda de `REVISION`.

### Verificación
**Frontend 414/414. Typecheck: 0 errores.** Sin tests propios que borrar (no tenía).

## 100. El WebSocket queda solo para recibir (decisión del usuario)

**Contexto:** desde §92 el chat manda siempre por `POST /api/messages`. El listener `type: 'send'` del servidor (reforzado en §87) quedó sin uso, pero seguía siendo una vía de escritura abierta. El usuario eligió sacarlo.

**Qué se hizo:**
- `ws/index.js`: sin listener de `message` (lo que mande el cliente se ignora). Se sacaron también el límite de frecuencia (`allowSend`, `SEND_LIMIT`), que solo tenía sentido para esa vía, y `sendError`. **Queda `maxPayload` 64 KB:** un frame enorme igual cierra la conexión (1009) sin procesarse.
- `MessageInputError` (§87) sigue: la usa `POST /api/messages` para responder 400.
- Tests: en `ws-hardening.test.js`, los 5 casos del envío por socket y el de frecuencia se reemplazaron por uno que exige que un `send` (o un JSON roto) **no se guarde, no se reenvíe y no se conteste**. Siguen el de `maxPayload` y el de REST. Se borró `test/unit/wsRateLimit.test.js` y el test de §40 que mandaba **por** el socket.
- Docs: la sección del WebSocket en `API_CONTEXT.md`.

### Verificación
- **Rojo → verde:** con el listener, el test nuevo falló (el `send` se guardaba y se reenviaba). Sin él, pasa.
- **SQLite 454/454 y Postgres 456/456** (−9 a propósito: los tests de la vía que se sacó), también con `TZ=America/Argentina/Cordoba`.
- `grep`: no quedan referencias a `allowSend`, `SEND_LIMIT` ni `sendViaSocket` en el código.

### Errores propios
- Al principio no vi que `insert-returns-own-row.test.js` (§40) tenía un test de envío **por** el socket. Falló y la corrida se colgó (quedó un socket abierto); lo saqué. Ese archivo no termina los sockets en `after()` si falla un test, como sí hace `ws-hardening` (§87); no lo cambié.

### ⚠️ NO verificado
- Que ningún cliente fuera del frontend use el envío por socket: no hay otros clientes conocidos.

## 101. Un solo modal de reseñas (decisión del usuario)

**Contexto:** había dos componentes que hacían lo mismo (deuda conocida): `ReviewModal` en "Mis participaciones" (estrellas + comentario) y `ReviewsModal` en el feed (reseñas de otros + el mismo formulario). Una corrección en uno no llegaba al otro. El usuario eligió unificar en `ReviewsModal`.

**Qué se hizo:** "Mis participaciones" abre `ReviewsModal` con `canRate` ("Reseña" solo aparece en inscripciones aprobadas). Se borró `ReviewModal.tsx` y sus casos en los tests de accesibilidad (`A11yNames`, `ModalsA11y`): `ReviewsModal` ya tiene los suyos (§80, §81). **Cambio visible:** desde "Mis participaciones" ahora también se ven las reseñas de los demás y el promedio.

### Tests
- `MyParticipationReview.test.tsx` (nuevo): "Reseña" abre el diálogo "Reseñas y Calificaciones", se ve la reseña de otro y dejar la propia llama a `api.projects.rate('proj-1', 4, …)`. Rojo antes (abría "Dejar reseña").

### Verificación
- **Frontend: 413/413** (−2 casos del modal borrado, +1 nuevo). **Typecheck: 0 errores.**
- **En Chrome** (SQLite descartable, María): Mis participaciones → "Reseña" de Reforestación Urbana → diálogo "Reseñas y Calificaciones" con el promedio (5.0, 2 reseñas), el formulario y la lista. Escape lo cierra.

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- No hice mutación aparte: el cambio es reemplazar un componente por otro ya probado; el test nuevo falla si "Mis participaciones" vuelve a abrir otra cosa o si no se puede calificar.

## 102. Fecha de los KPIs validada (aprobada por el usuario)

**Contexto:** §88 dejó anotado que `kpis.fecha` (columna `TEXT`) aceptaba cualquier texto ("ayer", "01/10/2026", "2026-02-30"…). `formatDateOnly` (§63) espera `AAAA-MM-DD`. Confirmado con tests (rojo en 10: 5 casos × POST y PUT).

**Qué se hizo:** `validateKpi` exige `AAAA-MM-DD` de una fecha que exista (`isIsoDate`: regex anclada + comparación contra `Date.UTC`, sin depender del huso horario), o vacía/ausente = sin fecha. Error: "La fecha tiene que tener el formato AAAA-MM-DD". El formulario (`<input type="date">`) ya manda ese formato: el camino normal no cambia.

### Tests (+14 en `kpis-input-validation.test.js`)
6 casos inválidos × POST y PUT (texto libre, otro formato, 30 de febrero, mes 13, número, un dígito de más), y en los válidos: 29 de febrero de un año bisiesto se acepta; fecha vacía queda `null`.

### Verificación
- **SQLite 466/466 y Postgres 468/468**, también con `TZ=America/Argentina/Cordoba`.
- **Mutación (4):** solo regex sin chequear que la fecha exista, sin chequeo, `''` como inválida y la regex sin anclar. Esta última sobrevivía: `'2026-10-012'` pasaba como 12 de octubre. Agregué ese caso y **los 4 mueren**.

### Errores propios
- Al insertar la regex con un `node -e` se perdieron las barras invertidas (`/^d{4}…/`). Lo mostró el test de los casos válidos; lo corregí con la herramienta de edición.

## 103. Límite de intentos en login y registro (aprobado por el usuario)

**Contexto:** no había ningún límite: se podían probar contraseñas sin tope (y con §91 los dos errores del login ya son iguales, así que el límite es la defensa que faltaba contra la fuerza bruta). Confirmado con tests contra un limitador que no limita (rojo en 7).

**Qué se hizo:**
- **`src/lib/rateLimit.js` (nuevo, sin dependencias, regla 18):** `createLimiter({ max, windowMs })` con ventana deslizante en memoria: `blocked(key)` (segundos hasta liberarse), `hit`, `reset`. Borra las claves vencidas.
- **Login (`routes/auth.js`):** solo cuentan los fallidos (401). Límite por email+IP (10 cada 15 min): por email solo, cualquiera podría bloquearle la cuenta a otra persona. Límite por IP (50 cada 15 min): muchos emails desde el mismo lugar. Un login correcto limpia el contador de email+IP. Los `400` de validación no cuentan. Bloqueado → **429** "Demasiados intentos. Probá de nuevo en unos minutos." con `Retry-After`, **sin consultar la base ni comparar la contraseña**.
- **Registro:** 20 por IP por hora (cuentan todos los intentos).
- **`src/index.js`:** `trust proxy` en producción, para que `req.ip` sea la IP del cliente detrás del proxy de Render (si no, todos compartirían la del proxy y el límite por IP bloquearía a todos juntos).
- El frontend no cambia: `AuthModal` muestra el mensaje del servidor.

### Tests (nuevos: 10)
- `test/unit/rateLimit.test.js` (3, reloj a mano): tope y segundos restantes, liberación al pasar la ventana, `reset` y claves independientes.
- `auth-rate-limit.test.js` (7): 10 contraseñas malas → la 11.ª es 429 aunque sea la correcta, con `Retry-After`; bloqueado no se llama a bcrypt; otra cuenta desde la misma IP entra; un login correcto limpia el contador; los 400 no cuentan; 50 fallidos por IP con emails distintos bloquean; el registro n.º 21 es 429.

### Verificación
- **SQLite 476/476 y Postgres 478/478**, también con `TZ=America/Argentina/Cordoba`. Ningún test existente llegó a los límites (cada archivo corre en su propio proceso, con el estado limpio).
- **Mutación (8):** 7 mueren: chequear después de comparar, no limpiar tras un login correcto, sin límite por IP, registro sin límite, sin `Retry-After`, ventana que nunca expira, segundos mal calculados. **1 no se aplicó:** el patrón de "los 400 también cuentan" aparecía dos veces en el archivo. Ese comportamiento lo cubre igual un test, pero ese mutante no lo corrí.

### Errores propios
- Ninguno en esta tarea (el mutante que no se aplicó es una limitación del script, anotada arriba).

### ⚠️ NO verificado
- **Detrás del proxy de Render** (`trust proxy` y `req.ip` reales): no hay deploy.
- **Que la clave sea por email+IP y no por email solo:** los tests salen todos de la misma IP (localhost), así que esa diferencia no se puede ver en ellos.
- Es en memoria y por proceso: si se reinicia el servidor, los contadores vuelven a cero; con varias instancias, cada una cuenta lo suyo.
- No hay CAPTCHA ni bloqueo de cuenta persistente (fuera de alcance).

## 104. Filtro de palabras en los comentarios de las calificaciones (aprobado por el usuario)

**Contexto:** el filtro de palabras (§93) se aplicaba a los comentarios de los proyectos y a los textos de las publicaciones, pero no al comentario de una calificación (`POST /api/projects/:id/ratings`). "Qué imbécil el coordinador" se guardaba y se veía en la pestaña Reseñas y en `ReviewsModal`. Pendiente anotado en §93.

**Qué se hizo:**
- `routes/projects.js`: después de validar tipo y largo, `hasBadWord(comment)` → **400** "El comentario contiene palabras no permitidas", el mismo mensaje que los comentarios. Mismo criterio de palabra completa ("computadora" pasa).
- **Frontend sin cambios:** `ProjectDetails.tsx` y `ReviewsModal.tsx` ya muestran el `error` del servidor. No se agregó el chequeo previo en el cliente (que sí tienen los comentarios): la defensa real es la del backend (regla 15) y una más sería otra duplicación.
- **Datos existentes:** las calificaciones ya guardadas no se tocan. Si una tiene una palabra de la lista, queda así hasta que su autor la edite (el upsert la pasaría por el filtro).
- Docs: `API_CONTEXT` (validación y **respuesta**: decía `201 { rating }` y el código responde `200 { message: 'Calificación guardada' }`, lo que esperan los tests desde antes), `BACKEND_CONTEXT`, el encabezado de `lib/badWords.js` y una nota en §93.

### Tests (nuevos: 2, en `comments-badwords.test.js`)
- Calificación con "Qué imbécil…" o "sos un BOLUDO" → 400 con ese mensaje, y la calificación anterior de María en `proj-1` no cambia.
- Con "Traigan la computadora…" → 200 y se guarda.
- **Rojo de comportamiento:** con el código anterior, el primero daba `200` en vez de `400`.

### Verificación
- **SQLite 478/478 y Postgres 480/480**, también con `TZ=America/Argentina/Cordoba`.
- **Mutación (5):** sacar el chequeo, negarlo, cambiar el mensaje y cambiar el status: **mueren los 4**. **Sobrevive 1, equivalente:** sacar la guarda `comment &&`, porque `hasBadWord(null/undefined)` revisa el texto "null"/"undefined", que no está en la lista.

### Errores propios
- El primer script de mutación no encontraba el patrón (no tuve en cuenta la línea en blanco), y al arreglarlo con `node -e` se perdieron los escapes. Lo reescribí como archivo. No tocó el código: el script restaura el archivo al terminar, y lo comprobé con `cmp`.

### ⚠️ NO verificado
- No lo vi en el navegador: que el mensaje aparezca en el formulario de reseñas lo deduzco del código (`setRatingErr(err.message)` / `setErrorMsg(err.message)`), que ya se usa con los otros 400.
- No revisé si la base local tiene calificaciones viejas con palabras de la lista.

## 105. Listas de seguidores en un solo componente (aprobado por el usuario)

**Contexto:** las listas "Seguidores"/"Siguiendo" de `VolunteerProfile` (perfil propio) y `VolunteerPublicProfile` eran el mismo modal copiado (~60 líneas de JSX más estado y carga en cada uno; anotado en §81). Solo cambiaban el endpoint (`myFollowers`/`myFollowing` contra `volunteerFollowers(id)`/`volunteerFollowing(id)`) y el texto de la lista vacía ("Todavía no tenés…" contra "Todavía no tiene…").

**Qué se hizo:**
- **`FollowListModal.tsx` (nuevo):** `mode`, `load(mode)`, `emptyText` por modo, `meId` y `onClose`. Pide la lista al montarse, que es cada vez que se abre, y tiene su propio estado de carga. El JSX es el de antes, con las mismas clases.
- **Los dos perfiles:** quedó solo `listMode` (sacamos `listData`, `listLoading`, `listTitleId` y las funciones `openMyList`/`openList`). Los botones solo ponen el modo. −157/+19 líneas en los dos archivos.
- **Diferencias con antes:**
  - Se sacaron `animate-in slide-in-from-bottom`, que solo tenía la copia del perfil público: no hay plugin de animaciones instalado y esas clases no generaban CSS (verificado: ni `package.json` ni `src/styles` las definen). No cambia nada visible.
  - Si la lista se cierra antes de que llegue la respuesta, la respuesta se descarta. Antes llegaba igual a un estado que ya no se mostraba.
- **Sin cambio de comportamiento** a propósito: un error al pedir la lista sigue viéndose como "Todavía no tenés seguidores." (ver ⚠️).

### Tests (nuevos: 7, `FollowLists.test.tsx`)
Contra los dos perfiles, no contra el componente: así sirven como red del refactor.
- Cada fila: link a `/volunteer/:id`, o a `/profile` con "Tú" si es el usuario logueado; foto (`foto_perfil` o `avatar`) o inicial; ubicación (`ubicacion`, `location` o "Argentina") y seguidores.
- Qué endpoint llama cada perfil (las mías en el propio; las del `:id` en el público).
- El texto de la lista vacía de cada perfil y de cada modo.
- Mientras carga no aparece "Todavía no…".
- Tocar una persona navega y cierra la lista; "Cerrar" también.
- Perfil público → otra persona de la lista: el perfil nuevo carga sin la lista abierta. Es el mismo componente con otro `:id`, y sin cerrar la lista ella volvería a abrirse sola.
- **Rojo:** no corresponde, porque es un refactor sin cambio de comportamiento. Lo que corresponde es que los tests pasen **con el código anterior**, y pasan los 7: los corrí contra los perfiles de `HEAD`, copiados aparte sin `git stash`, y después restauré los archivos nuevos.

### Verificación
- **Frontend 420/420** (413 + 7), también con `TZ=America/Argentina/Cordoba`. **Typecheck: 0 errores.** Finales de línea: los dos perfiles siguen en CRLF; el componente y el test nuevos, en LF, como `Modal.tsx`.
- **Mutación (15, sobre `FollowListModal.tsx`):** mueren 12. **Sobreviven 3:**
  - *`catch` que no vacía la lista:* equivalente. La lista ya empieza vacía en cada apertura.
  - *Sin la guarda `cancelled`:* equivalente en la práctica. El modo no cambia con la lista abierta, y React 18 ignora un `set…` después de desmontar.
  - *Estado de carga inicial en `false`:* **no equivalente.** Mostraría "Todavía no…" durante un cuadro, hasta que corre el efecto. No se puede observar con Testing Library, porque `render()` ya ejecuta los efectos.
  - El mutante "el link no cierra la lista" sobrevivía en la primera corrida: el test navegaba a otra ruta y se desmontaba el perfil entero. Por eso agregué el último test, y ahora muere.

### Errores propios
1. **La primera corrida de mutación fue falsa:** marcó los 15 como "muere" porque `execSync` usa cmd.exe en Windows y no encontraba `node_modules/.bin/vitest`. Fallaba **todo**, mutado o no. Me llamó la atención que murieran mutantes que esperaba que sobrevivieran. Pasé a `node node_modules/vitest/vitest.mjs` y agregué una corrida de control sin mutar al principio del script.
2. Al principio, el test de "pide mis listas" no probaba nada en el perfil propio: `myFollowers` también se llama al montar, para el contador. Ahora limpia el mock antes de abrir la lista.
3. Dejé un comentario `eslint-disable` en el componente, pero el proyecto no tiene ESLint. Lo saqué.
4. **Doc que ya estaba mal:** `FRONTEND_CONTEXT` §4 decía "47 componentes" y el punto 8, "48"; antes de este cambio eran 48. Ahora dice 49.

### ⚠️ NO verificado
- No lo vi en el navegador. El JSX y las clases son los de antes (salvo las dos clases que no generaban CSS), pero no lo comprobé a ojo.
- **Hallazgo, sin arreglar (no estaba en el pedido):** si falla el pedido de la lista (red, 500), el modal dice "Todavía no tenés seguidores." en vez de un error. Es el mismo patrón que se corrigió en `NGOEmpleados` (§98). Queda para la segunda pasada.

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
