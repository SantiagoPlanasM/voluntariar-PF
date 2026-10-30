# Bitácora §162–§182: Plan de cierre (PLAN_FALTANTE)

> Archivo (histórico). Parte de `docs/PROJECT_ANALYSIS.md`, separada el 30/10/2026 sin cambios en el texto. Índice: [`../../PROJECT_ANALYSIS.md`](../../PROJECT_ANALYSIS.md).

## 162. Foto de perfil subida como archivo: `PUT /api/auth/me/photo` (PLAN_FALTANTE.md, Etapa 1)

**Qué se hizo:** un endpoint nuevo en `routes/auth.js` para subir la foto de perfil a Cloudinary (multipart, campo `photo`, JPEG/PNG/WebP, hasta 8 MB). Es **uno solo para los tres roles**, así no hay tres copias del manejo de la subida:
- la miniatura cuadrada (`storage.thumbUrl`, 480 px) va siempre a `users.avatar`, que es la foto que leen el chat, Momentos, comentarios, reseñas e inscripciones;
- si es ONG o empresa, en la **misma transacción** va también a `ngos.foto_perfil` / `empresas.foto_perfil` (el `logo` de su perfil);
- `voluntarios.foto_perfil` no se toca (decisión F2 del usuario: `users.avatar` es la única foto del voluntario).

Sigue la regla 24 en orden: sesión → límite de **10 subidas por hora** por usuario (`lib/rateLimit.js`) → 503 sin Cloudinary → `multer` (tipo declarado, tamaño, un solo archivo) → **cabecera real** (`storage.detectImageType`) → existencia del perfil → subida fuera de la transacción → transacción → si la base falla, se borra lo subido. Detalle en `API_CONTEXT.md`.

**Hallazgo al resolver F2 (no arreglado acá, va en la Etapa 2):** `voluntarios.foto_perfil` se escribe solo en el registro (el avatar de iniciales) y nada la actualiza, pero `VolunteerPublicProfile.tsx:99`, `FollowListModal.tsx:77` y `VolunteerProfile.tsx:375` muestran `foto_perfil || avatar`. Por eso, si un voluntario cambia su foto, en el perfil público y en las listas de seguidores sigue viéndose la de iniciales.

### Verificación
- Test nuevo `test/integration/profile-photo.test.js` (15): camino feliz de los tres roles (incluidos `GET /auth/me` y los perfiles públicos de ONG y empresa), sin sesión, sin archivo, GIF, JPEG falso (cabecera de PDF), más de 8 MB, otro nombre de campo, sin Cloudinary, Cloudinary caído, ONG sin fila de perfil, falla de la base en la segunda escritura (se borra lo subido y no cambia ni `users` ni `ngos`) y el límite de 10 por hora.
- Rojo antes de implementar: los 15 fallaban con 404 porque la ruta no existía, que es un rojo débil. Los rojos fuertes los dio la mutación.
- Backend SQLite **640/640** y con `TZ=America/Argentina/Cordoba` 640/640; Postgres **642/642** y con TZ 642/642. 0 fail, 0 cancelled, salida 0 en las cuatro.
- **Mutación** (script en el scratchpad; la corrida de control sin mutar pasó): **16 mutantes, 0 sobrevivientes**. Se mutaron el filtro de tipo, el 413, el tope de tamaño, el chequeo y el registro del límite, el valor del límite, el 503, la falta de archivo, la cabecera real, el chequeo de perfil, la tabla de empresa, la miniatura, la escritura del logo, la limpieza, el 502 y la transacción.
- `auth.js` sigue en CRLF (352/352 líneas, contado con Node).

### Errores propios
- El primer borrador del test "ONG sin fila de perfil" borraba la fila de `ngo-1` del seed. Como `projects.ngo_id` es `ON DELETE CASCADE`, eso se llevaba sus proyectos. Lo cambié antes de correrlo, por una ONG registrada en el test y sin proyectos.
- Un `grep -c $'\r$'` de Git Bash dio 0 CR en `auth.js` y pensé que la edición lo había pasado a LF. Era el `grep`: con `od` y Node el archivo está entero en CRLF.

### ⚠️ NO verificado
- **La subida real a Cloudinary y un multipart mandado por un navegador:** los tests usan dobles y `FormData` de Node. No hay pantalla todavía (Etapa 2).
- **El mutante "sin transacción" muere por otra razón:** sin `db.transaction`, el doble que inyecta la falla no se activa y el test ve 200 en vez de 500. Que el rollback deshaga `users.avatar` lo prueba el test (la foto vuelve a la anterior), no ese mutante.
- **Las fotos anteriores quedan en Cloudinary** (no se borran al reemplazarlas: decisión C3 abierta, igual que el pendiente conocido de borrar usuarios o proyectos).
- El límite de frecuencia es en memoria y por proceso: se reinicia con el servidor, igual que el del login (§103).
- Producción (Render): no se desplegó.

## 163. "Cambiar foto" en los tres perfiles propios + la foto del voluntario sale solo de `users.avatar` (PLAN_FALTANTE.md, Etapa 2)

**Qué se hizo:**
- **`ProfilePhotoPicker.tsx`** (nuevo), un solo componente para `VolunteerProfile`, `NGOOwnProfile` y `CompanyOwnProfile`. Botón "Cambiar foto" debajo de la foto del encabezado (aparece también mientras se edita el perfil) y un `<input type="file">` oculto que acepta JPEG, PNG y WebP. Al elegir un archivo:
  1. lo comprime con `compressImage`, igual que Momentos;
  2. lo sube con `api.auth.uploadPhoto`, en el campo `photo` (§162);
  3. actualiza la sesión con `updateUser`;
  4. le avisa a la pantalla con `onUploaded(url)`: la ONG y la empresa cambian su `logo` local, y el voluntario ya la ve porque su encabezado lee `user.avatar`.
  
  Mientras sube, el botón dice "Subiendo foto…" y queda deshabilitado. Un error se muestra con `role="alert"` (el mensaje del servidor, o uno de conexión si falla la red) y se limpia al intentar de nuevo.
- **`api.ts`:** `upload()` acepta el método (`POST` por defecto, como antes en Momentos) y `api.auth.uploadPhoto(form)` usa `PUT`, sin `Content-Type`.
- **`AuthContext`:** `updateUser(u)` reemplaza el usuario en memoria y en `v_user`. `FRONTEND_CONTEXT.md` ya listaba un `updateUser(partial)` que el código no tenía: el doc quedó corregido a lo real.
- **F2 (decisión del usuario):** `VolunteerPublicProfile`, `FollowListModal` y "Voluntarios que sigo" de `VolunteerProfile` muestran `avatar` y ya no `foto_perfil || avatar`. Esa columna es la copia del registro, que nada actualiza (hallazgo de §162): con el código anterior, una foto nueva no se veía en el perfil público ni en las listas.

### Verificación
- Tests nuevos: `ProfilePhotoPicker.test.tsx` (11; incluye `uploadPhoto` y que Momentos siga con `POST`) y `ProfilePhotoScreens.test.tsx` (4: la foto del encabezado cambia sin recargar en las tres pantallas, y el botón está también mientras se edita). En `FollowLists.test.tsx`, los datos pasan a traer las dos columnas y hay 3 tests nuevos de F2.
- Rojo antes de implementar:
  - F2: los 4 tests fallaban porque se veía la foto vieja (rojo fuerte);
  - las pantallas: no encontraban "Cambiar foto";
  - el componente: el módulo no existía (rojo débil; los rojos fuertes los dio la mutación).
- Frontend **594/594** (antes 576, +18), también con `TZ=America/Argentina/Cordoba`; `npm run typecheck` 0 errores; `npm audit` 0.
- **Mutación** (control sin mutar en verde): **20 mutantes, 0 sobrevivientes**. Se mutaron, en el componente, la compresión, el nombre del campo, `updateUser`, `onUploaded`, la limpieza del error, el estado "subiendo", la rehabilitación, la guarda sin archivo, el `accept` y el mensaje sin conexión. Además: `PUT` → `POST`, `upload()` ignorando el método, `updateUser` sin persistir o sin estado, ONG y empresa sin actualizar el logo, el voluntario sin el botón y las tres vueltas a `foto_perfil`.
- Finales de línea conservados (contados con Node): los CRLF siguen CRLF y `NGOOwnProfile.tsx` sigue LF, como antes.
- Backend: no se tocó en este cambio.

### Errores propios
- La primera versión de los tests del componente simulaba la sesión solo con `v_user`. Sin token, `AuthProvider` no carga el usuario, y un test fallaba por eso (el error era mío, no del componente). Pasó a una sesión real: token más `GET /auth/me` simulado.
- Un `vi.fn()` sin tipo rompió el `typecheck` (TS2348); lo tipé con `Mock<…>`.

### ⚠️ NO verificado
- **Nada visual ni táctil:** el botón en el encabezado (contraste blanco sobre el degradé), el aviso de error, y elegir una foto desde la galería o la cámara de un celular.
- **La subida real:** `compressImage` con un `canvas` de verdad, el multipart de un navegador real y Cloudinary. Lo tenés que probar vos en Render: subir una foto en los tres roles y ver que aparece en el perfil público, el chat y Momentos.
- **La FAQ del chatbot** dice "tocá el ícono de lápiz para editar tu foto" (datos de `migrate.js`). La foto se cambia con "Cambiar foto", no con el lápiz, y la FAQ no la cambié.
- Otras pantallas que muestran fotos de voluntarios con otra fuente: no las revisé todas, solo las tres que leían `foto_perfil`.
- Producción: no se desplegó.

## 164. CV: PDF privados en Cloudinary con link de descarga que vence (`lib/storage.js`, PLAN_FALTANTE.md, Etapa 3)

**Qué se hizo:** cuatro funciones nuevas en `lib/storage.js`, sin dependencias (`fetch` y `crypto`, como §43). **Ningún endpoint las usa todavía** (Etapa 4).
- `detectPdf(buf)`: la cabecera real tiene que empezar con `%PDF-`, y tiene que ser un `Buffer`.
- `uploadPdf(buf)` → `{ publicId }`: `POST /raw/upload` con `type=private` (firmado junto con `timestamp` y `folder` si hay). Un asset privado **no tiene URL pública**: aunque alguien consiga el `public_id`, no puede abrirlo.
- `pdfDownloadUrl(publicId, { ttlSeconds = 600 })` → `{ url, expiresAt }`: link `GET /raw/download` con `timestamp`, `public_id`, `type` y `expires_at` firmados más `api_key` y `signature`. Se arma sin llamar a la red y vence a los 10 minutos.
- `deletePdf(publicId)`: `POST /raw/destroy` con `type=private`. "not found" cuenta como éxito; es para cumplir la decisión C3 del usuario (al reemplazar o borrar el CV se borra el anterior).

**De dónde salen las rutas (verificado el 2026-10-16):** la documentación oficial del Upload API confirma `POST /:resource_type/upload` con `raw` y `type` ∈ `upload | private | authenticated`, y remite a `private_download_url` para entregar los privados. La documentación **no** detalla el endpoint REST de descarga, así que lo saqué del **código fuente del SDK oficial de Node** (`cloudinary@2.5.1`, `lib/utils/index.js`): `api_url("download", { resource_type })` más los parámetros firmados con el mismo algoritmo que `signParams`, ya anclado al vector oficial en `storage.test.js`.

### Verificación
- `test/unit/storage-pdf.test.js` (16): cabecera real (incluidos `%PDFX…`, el string `'%PDF-'` y buffers cortos), subida (URL, `type`, firma con y sin carpeta, MIME y nombre del archivo, respuesta sin `public_id`, error HTTP, sin credenciales), link (ruta, claves exactas, firma, vencimiento por defecto y con TTL, `public_id` con carpeta y espacios, que el secreto no aparezca, sin credenciales) y borrado (ruta, `type`, firma, "not found", errores).
- Rojo antes de implementar: "detectPdf is not a function". Es un rojo débil; los rojos fuertes los dio la mutación.
- Backend SQLite **654/654** y con `TZ=America/Argentina/Cordoba` 654/654; Postgres **656/656** y con TZ 656/656. 0 fail, 0 cancelled, salida 0. `npm audit` 0.
- **Mutación** (control en verde): **23 mutantes, sobrevive 1, equivalente**. Es "`detectPdf` sin largo mínimo": sobre un buffer corto, `toString('latin1', 0, 5)` devuelve menos de 5 caracteres y la comparación da falso igual. En la primera tanda sobrevivieron dos más que **no** eran equivalentes, y sumé los tests que los matan: "compara 4 bytes" (aceptaría `%PDFX`) y "acepta strings" (aceptaría el string `'%PDF-'` exacto).

### Errores propios
- Los dos casos de `detectPdf` que faltaban: el test original tenía un caso por cada rechazo, pero ninguno distinguía "sin guion" de "corto", ni un string con la cabecera exacta. Los encontró la mutación.

### ⚠️ NO verificado
- **Nada contra la cuenta real de Cloudinary:**
  - que `raw` + `private` suba bien;
  - qué `public_id` devuelve para un raw (los tests suponen que trae la extensión, `….pdf`, y el link lo usa tal cual: si no la trajera, puede hacer falta mandar `format=pdf`);
  - que el link firmado descargue;
  - que vence a los 10 minutos.
  
  En un foro de Cloudinary hay reportes inconsistentes con `format` en los raw. Se prueba en Render en la Etapa 5.
- **La restricción de entrega de PDF de las cuentas nuevas** (Settings → Security, del roadmap §1.3): no sé si afecta a un raw privado servido por `/download`. Si en producción da 401, ver eso primero.
- Si el navegador abre el PDF o lo descarga: no se manda `attachment`, así que lo decide Cloudinary (el SDK lo deja opcional).

## 165. CV: subir, reemplazar, borrar y ver con link que vence (`routes/voluntarios.js`, PLAN_FALTANTE.md, Etapa 4)

**Qué se hizo:** tres endpoints en `routes/voluntarios.js`, sobre las funciones de §164. Detalle de cada uno en `API_CONTEXT.md`.
- **`PUT /api/voluntarios/me/cv`** (voluntario; multipart `cv`, PDF de hasta 5 MB; 10 subidas por hora):
  - sigue el orden de la regla 24 (sesión → límite → 503 → `multer` → cabecera real `%PDF-` → fila de perfil → subida → guardado);
  - el `UPDATE` es **compare-and-swap** sobre el `cv_url` leído antes de subir. Si cambió mientras se subía, da **409** y borra lo recién subido;
  - si guarda, **borra el anterior de Cloudinary** (decisión C3 del usuario). Si ese borrado falla, solo se loguea: el viejo es privado y ya nadie tiene su id;
  - si falla la base, borra lo subido y responde 500.
- **`DELETE /api/voluntarios/me/cv`**: pone `cv_url` en `NULL` con CAS y después borra en Cloudinary. Es idempotente: sin CV responde `{ has_cv: false }` sin llamar a Cloudinary.
- **`GET /api/voluntarios/:userId/cv`** → `{ url, expires_at }`, un link firmado que vence a los 10 minutos.
  - Lo ve el propio voluntario, o una ONG con una inscripción **`pending` o `approved`** de ese voluntario en un proyecto suyo (decisión C1 del usuario, que cambia lo de §30, que era solo `approved`).
  - A cualquier otro le responde **404 "CV no disponible"**: es el mismo mensaje que si no tuviera CV o si el id no fuera de un voluntario. Primero se chequea el permiso y después la existencia, así no se puede averiguar quién cargó uno.
- **`GET /api/auth/me`:** en el `profile` del voluntario, **`cv_url` pasa a `has_cv` (boolean)**: el public_id del proveedor no se expone (regla 24e). El frontend no lee `profile` (`api.auth.me` tipa `{ user }`), así que no cambia nada visible.
- `ownership.test.js` suma el caso "ONG ajena no ve el CV, la dueña sí, con los mismos ids" (regla 15).

### Verificación
- Test nuevo `test/integration/cv.test.js` (28):
  - subida: primera vez, reemplazo con borrado del anterior, falla al borrar el anterior, carrera (409), falla de la base, y todos los rechazos (401/403, sin archivo o con otro campo, tipo declarado, cabecera, 5 MB, 503, 502);
  - borrado: con y sin CV, y con falla de Cloudinary;
  - permisos: la dueña, ONG con inscripción aprobada, ONG con inscripción pendiente, ONG sin relación, inscripción rechazada o cancelada, otro voluntario, empresa, sin sesión, sin CV, un id que no es de voluntario, y el 503 solo para quien tiene permiso;
  - `/auth/me` con `has_cv`, el perfil público sin el public_id, y el límite de 10 por hora.
- Además: `auth-me-profile.test.js` (la clave `has_cv` en vez de `cv_url`) y `ownership.test.js` (+1).
- Rojo: 27 de 28 fallaban (las rutas no existían); el que pasaba era "el perfil público no trae `cv_url`", que ya se cumplía.
- Backend SQLite **683/683** y con `TZ=America/Argentina/Cordoba` 683/683; Postgres **685/685** y con TZ 685/685. 0 fail, 0 cancelled, salida 0. `npm audit` 0. Los CRLF se conservaron (contados con Node).
- **Mutación** (control en verde): **32 mutantes, sobreviven 2, los dos equivalentes**:
  - "el dueño, de cualquier rol": una ONG o empresa que pide su propio id no tiene fila de voluntario con `role='volunteer'`, así que da 404 igual;
  - "la empresa pasa por el chequeo de ONG": busca `ngos.user_id = <id de la empresa>`, que no existe porque `ngos` solo tiene filas de usuarios `ngo`.

### Errores propios
- Ninguno en el código.

### ⚠️ NO verificado
- **La carrera real:** el 409 se probó cambiando la fila *mientras* el doble de Cloudinary "sube", no con dos pedidos simultáneos en Postgres. El CAS es un único `UPDATE` condicional, igual que en §39 y §77.
- **Nada contra Cloudinary real**, igual que en §164: el formato del `public_id` raw, que el link descargue y que venza. Va en la Etapa 5, en Render.
- El límite de 10 por hora es en memoria y por proceso.
- No hay pantalla todavía (Etapa 5).

## 166. CV en el frontend: "Mi CV" del voluntario y "Ver CV" en el panel de la ONG (PLAN_FALTANTE.md, Etapa 5)

**Qué se hizo:**
- **`lib/cv.ts`** (nuevo):
  - `checkCvFile(file)` usa los mismos topes y mensajes que el backend (PDF, 5 MB) y chequea antes de subir.
  - `openCv(userId)` abre el link que vence. **Primero abre la pestaña y después hace el pedido**: abierta después de un `await`, el navegador la bloquea como ventana emergente. Si el pedido falla, cierra la pestaña vacía y relanza el error. Si el navegador no dejó abrirla, va al link en la misma pestaña.
- **`api.ts`:** `api.voluntarios.cv.{ upload (PUT multipart, campo cv), remove (DELETE), link (GET, id codificado) }`. `api.auth.me` tipa también `profile?.has_cv` (regla 6).
- **`CvSection.tsx`** (nuevo), en `VolunteerProfile` debajo de "Habilidades" (se oculta mientras se edita el perfil):
  - dice si hay CV (`has_cv` de `/auth/me`) y aclara quién lo ve;
  - permite subir, reemplazar y ver;
  - para borrar pide confirmación **en la pantalla**, no con `window.confirm` (que además bloquea la verificación con Chrome);
  - los avisos van con `role="alert"`, el éxito con `role="status"` y, mientras sube, el botón dice "Subiendo…";
  - si no se puede saber si hay CV, dice "No se pudo cargar." y no muestra botones engañosos.
- **`NGOProjectDetail.tsx`:** botón "Ver CV de <nombre>" en las inscripciones **pendientes y aprobadas**, las mismas que deja el backend (C1). Si responde 404, la fila dice "<nombre> no cargó su CV."; con otro error muestra su mensaje o uno de conexión. Todo en la fila, sin `alert()`.

### Verificación
- Tests nuevos:
  - `lib/cv.test.ts` (12): los tres métodos de la API, `checkCvFile` con el borde exacto de 5 MB, y `openCv` (que abra antes de pedir, el cierre si falla, el fallback sin pestaña);
  - `CvSection.test.tsx` (13);
  - `NGOProjectDetailCv.test.tsx` (5).
  
  Además, `VolunteerProfileErrors.test.tsx` simula `api.auth.me`, la dependencia nueva de la pantalla (ver Errores propios).
- Rojo: los tres archivos fallaban porque los módulos no existían, que es un rojo débil. Los rojos fuertes los dio la mutación.
- Frontend **621/621** (antes 594, +27), también con `TZ=America/Argentina/Cordoba`; `npm run typecheck` 0; `npm audit` 0. Finales de línea conservados (contados con Node).
- **Mutación** (control en verde): **28 mutantes; en la primera tanda sobrevivió 1, no equivalente**: "no se limpia el aviso de la fila antes de reintentar" (un intento exitoso dejaba el error viejo). Sumé ese test y quedó en **0 de 28**.

### Errores propios
- Al sumar `CvSection` a `VolunteerProfile` fallaron 2 tests de `VolunteerProfileErrors`: la sección pide `/auth/me`, que ahí no estaba simulado, y su "No se pudo cargar." chocaba con lo que esos tests verifican. Lo simulé en el test (es una dependencia nueva legítima, no un cambio del comportamiento probado).
- El primer fixture de proyecto de `NGOProjectDetailCv.test.tsx` no tenía los campos numéricos que la pantalla formatea (`toLocaleString` sobre `undefined`).
- La mutación encontró el test que faltaba del aviso por fila.

### ⚠️ NO verificado
- **Nada contra Cloudinary real ni en un navegador:** subir un PDF de verdad, que el link descargue o muestre el PDF, que venza, y que el truco de la pestaña previa no lo bloquee algún navegador (Safari en iPhone en particular). **Lo tenés que probar vos en Render** (ver la respuesta de esta sesión).
- Nada visual: la tarjeta "Mi CV", la confirmación de borrado y el ícono en las filas de la ONG.
- `NGODashboard` (las solicitudes pendientes del panel principal) no tiene "Ver CV": solo el detalle de cada proyecto.
- El recuadro "Mi CV" no se recarga con el "Reintentar" general de la pantalla (tiene su propia carga).

## 167. Verificación en producción de §162–§166 (2026-10-16, hecha por el usuario en Render)

**Primero falló el deploy, no el código:** el primer intento dio `404` en `PUT /api/voluntarios/me/cv`. Lo comprobé con pedidos sin sesión a la API de producción: `PUT /api/voluntarios/me/cv`, `PUT /api/auth/me/photo` y `GET /api/voluntarios/x/cv` respondían **"Ruta no encontrada"** (con el código nuevo tendrían que dar 401). La API seguía con código anterior a §162, mientras el frontend ya estaba actualizado. El usuario redesplegó el servicio `voluntariar-api` con "Deploy latest commit" y anduvo. **Para la próxima:** después de pushear hay que desplegar **los dos servicios**; un pedido sin sesión a una ruta nueva muestra enseguida si la API está al día.

**Lo que probó el usuario (con sus cuentas):**
- **CV:**
  - el voluntario lo sube y lo ve;
  - la ONG lo abre desde la inscripción;
  - reemplazar y borrar funcionan, también en Cloudinary (el archivo anterior no queda).
  
  Esto resuelve las dudas de §164: Cloudinary acepta `raw` + `private`, y el link firmado de `/raw/download` funciona **sin** `format`.
- **Sin CV:** la fila de la ONG lo dice. En la consola del navegador aparece el `GET …/cv 404`, que es el comportamiento elegido: el 404 es uniforme para no revelar quién cargó un CV, y el navegador siempre registra en la consola los pedidos fallidos. La alternativa, que la lista de inscriptos traiga `has_cv` para mostrar el botón solo si hay CV, quedó propuesta y sin hacer.
- **Foto de perfil:** la subió con la ONG y con el voluntario.

### ⚠️ NO verificado
- "Cambiar foto" con la empresa.
- Que el link venza a los 10 minutos, y cualquier prueba en un celular.
- Lo de la foto en el perfil público, el chat y Momentos: el usuario no lo detalló.

## 168. "Ver CV" solo si hay CV: `has_cv` en la lista de inscriptos (hallazgo del usuario en prod, §167)

**Qué pasaba:** en producción, el botón "Ver CV" aparecía en todas las inscripciones pendientes y aprobadas. Si el voluntario no tenía CV, `openCv` abría una pestaña vacía (lo hace **antes** del pedido para que el navegador no la bloquee, §166), el pedido daba 404 y la pestaña se cerraba: el usuario veía "se abre otra página y vuelvo". Además, el 404 quedaba en la consola.

**Qué se hizo (aprobado por el usuario):**
- `GET /api/enrollments/project/:projectId` (ya era solo para la ONG dueña) suma `has_cv` a cada inscripción con un `LEFT JOIN voluntarios`. Es `true` solo si la inscripción es `pending` o `approved` **y** hay CV, que es la misma condición con la que `GET /api/voluntarios/:userId/cv` lo entrega (§165). El public_id se saca de la fila en JS: no sale.
- `NGOProjectDetail` muestra el botón solo con `has_cv`. El aviso del 404 queda para el caso en que el CV se borre después de cargar la lista. `api.ts`: `has_cv?: boolean` en `EnrollmentWithVolunteer` (opcional, porque `/ngos/me` arma el mismo tipo y no lo trae).
- **Privacidad:** revela que hay un CV solo a una ONG que igual lo puede abrir. Para una inscripción rechazada o cancelada da `false`, aunque haya CV.

### Verificación
- `cv.test.js` (+5):
  - aprobada y pendiente con CV → `true`;
  - sin CV → `false` (estricto: boolean, ni `null` ni `0`);
  - rechazada o cancelada con CV → `false`;
  - todas las filas con boolean y ninguna con `cv_url` ni el public_id;
  - también con `?status=`.
  
  Rojo: los 5 fallaban (no venía la clave).
- `NGOProjectDetailCv.test.tsx`: los datos traen `has_cv`, hay una pendiente sin CV sin botón y una aprobada con `has_cv: false` sin botón. Rojo antes del cambio: los 2 tests fallaban (el botón salía igual).
- Backend SQLite **688/688** y con TZ 688/688; Postgres **690/690** y con TZ 690/690. Frontend **622/622** y con TZ 622/622; `typecheck` 0.
- **Mutación** (control en verde): **7 mutantes, 0 sobrevivientes**. En el backend: sin chequeo de estado, solo aprobadas, sin chequeo de CV, `cv_url` expuesto y `has_cv` no booleano. En el frontend: el botón por estado y el botón siempre.

### Errores propios
- El diseño de §166 (el botón en todas las pendientes y aprobadas, más la pestaña previa) causaba ese parpadeo cuando no había CV. Los tests no podían verlo: solo se ve en un navegador.

### ⚠️ NO verificado
- ~~En producción~~ **Verificado por el usuario el 2026-10-16** (desplegó los dos servicios): el botón aparece en la inscripción con CV y no en la que no tiene. Nada más de esta sección queda sin verificar, salvo lo visual en un celular.

## 169. Mercado Pago: `lib/payments.js` (preferencia, consulta de pago y firma del webhook) — PLAN_FALTANTE.md, Etapa 6

**Qué se hizo:** un módulo nuevo `src/lib/payments.js`, sin dependencias: `fetch` y `crypto`, decisión P2 del usuario. **Ningún endpoint lo usa todavía** (Etapas 7–10).
- `createPreference({ donationId, title, amount, successUrl, notificationUrl })` → `{ preferenceId, checkoutUrl }`:
  - `POST /checkout/preferences` con un ítem en ARS;
  - `external_reference` y `X-Idempotency-Key` iguales al id de la donación;
  - las tres `back_urls` a la misma vuelta, `auto_return: 'approved'` y `notification_url`;
  - con un token `TEST-` usa `sandbox_init_point` (y si no viene, `init_point`).
- `getPayment(id)` → `{ id, status, externalReference, amount, currency }` vía `GET /v1/payments/:id`, con el id codificado y validado. Los campos ausentes vuelven como `null` y el monto como número; un 404 da `code: 'not_found'`.
- `verifyWebhookSignature({ xSignature, xRequestId, dataId })` → boolean, nunca lanza. Sin `MP_WEBHOOK_SECRET`, siempre `false`.
- `describePaymentsConfig()` arma una línea para el log sin el token ni el secreto. Los errores son `PaymentError`, y el token no se loguea.
- `BACKEND_ROADMAP_ANALYSIS.md §1.4` quedó **reescrito para Mercado Pago** (antes era el diseño de Stripe), igual que las migraciones pendientes (`external_payment_id`, `moneda DEFAULT 'ARS'`) y la nota de "Hechos verificados" sobre el body crudo: el webhook de MP firma la query y los headers, no el body.

**De dónde salen la API y la firma (verificado el 2026-10-16):** la documentación oficial de webhooks confirma el header `x-signature` (`ts=…,v1=…`), la respuesta 200/201 en 22 s y los reintentos cada 15 minutos. **No** muestra el manifiesto: lo carga con JavaScript, en la pestaña "Sin SDKs". Por eso el resto salió del **código del SDK oficial `mercadopago@3.6.1`** (unpkg):
- `utils/config`: base `https://api.mercadopago.com`;
- `clients/preference/create`: `/checkout/preferences/` con `POST` y `Bearer`;
- `clients/payment/get`: `/v1/payments/${encodePathParam(id)}`;
- los tipos de preferencia y de pago, para los nombres de campo;
- `utils/webhook`: `parts.push(\`id:${dataId}\`)`, `request-id`, `ts`; `parts.join(';') + ';'`; `createHmac('sha256', secret)…digest('hex')`; `timingSafeEqual` con chequeo de largo previo; `toLowerCase()` **solo** en las claves del header; sin tolerancia por defecto.

### Verificación
- `test/unit/payments.test.js` (29):
  - la firma (válida, orden y espacios del header, claves en mayúsculas, partes omitidas, `data.id` sin pasar a minúsculas, cada dato cambiado, headers rotos, `ts` no numérico bien firmado, hash recortado, sin secreto, secreto del entorno);
  - la preferencia (URL, headers, cuerpo exacto, sandbox o `init_point` según el token, `TEST` en el medio, respuesta incompleta, error HTTP sin filtrar el token, no JSON, red, sin token);
  - el pago (ruta, id codificado contra `../`, tipos, monto ausente o inválido, no JSON, 404 y 500, ids inválidos sin llamar a la red, sin token);
  - el log.
- Rojo: el módulo no existía (rojo débil); los rojos fuertes los dio la mutación.
- Backend SQLite **717/717** y con TZ 717/717; Postgres **719/719** y con TZ 719/719. 0 fail, 0 cancelled. `npm audit` 0.
- **Mutación** (control en verde): **42 mutantes**. En la primera tanda sobrevivieron **5, ninguno equivalente**, y sumé el test que mata a cada uno:
  - `TEST` en el medio del token;
  - una respuesta no JSON en `getPayment`;
  - el monto ausente (`NaN`);
  - un `ts` no numérico bien firmado;
  - la comparación por prefijo.
  
  Quedó en **0 de 42**.

### Errores propios
- Los 5 huecos de tests de arriba.

### ⚠️ NO verificado
- **Nada contra Mercado Pago real** (no tengo tus credenciales; los tests usan dobles):
  - que la preferencia se cree con estos campos;
  - que en el modo prueba haya que usar `sandbox_init_point` (con usuarios de prueba, Mercado Pago a veces pide el `init_point` normal; si el checkout falla, es lo primero a revisar);
  - que un aviso real firme exactamente así.
  
  Se prueba en la Etapa 10, en Render.
- **`data.id` en minúsculas:** guías viejas de Mercado Pago decían pasarlo a minúsculas si es alfanumérico, y el SDK 3.6.1 no lo hace. Para pagos, el id es numérico, así que no debería importar.
- Los `ts` de los reintentos: no hay tolerancia de tiempo (como el SDK). Un aviso repetido no hace daño, porque la transición es idempotente (Etapa 7).

## 170. Donaciones: migración, `POST /api/donaciones` y `applyPayment` (PLAN_FALTANTE.md, Etapa 7)

**Qué se hizo:**
- **Migración aditiva** (`migrate.js`): `donaciones.external_id`, `external_payment_id`, `external_status` y `moneda` (`DEFAULT 'ARS'`), más el índice `idx_donaciones_external`. En producción corre sola al arrancar (`startCommand` de Render: `db:migrate`).
- **`routes/donaciones.js`** (nuevo, montado en `/api/donaciones`):
  - `POST /` (voluntario o empresa; 10 por hora) valida el proyecto `active` y el monto, inserta la donación **`pendiente` explícita** y crea la preferencia (`payments.createPreference`, §169).
    - La vuelta es `APP_URL/donaciones/vuelta`.
    - El aviso va a `API_PUBLIC_URL` o `RENDER_EXTERNAL_URL` + `/api/donaciones/webhook`. Render define `RENDER_EXTERNAL_URL` solo; en local no se manda aviso.
    - Responde `201 { donation_id, checkout_url }`. Si Mercado Pago falla, la donación queda `fallida` y la respuesta es 502.
  - `applyPayment(paymentId, { expectDonationId })` (exportada; la van a usar el aviso y la conciliación, Etapa 8):
    - consulta el pago a Mercado Pago;
    - acredita solo un `approved` cuyo monto y moneda coinciden, con un CAS `pendiente` → `completada` y `recaudado += monto` en **una transacción** (regla 21);
    - después del COMMIT avisa a la ONG (`donation_received`).
- La línea **"Pagos:"** en el log de arranque (`describePaymentsConfig`).

**Dos decisiones de diseño mías, que cambian lo del plan (§5.3):**
1. **Montos en pesos enteros, de $100 a $500.000.** `donaciones.monto` y `projects.recaudado` son `REAL`, que en Postgres es **`float4`** (unos 7 dígitos significativos): `999999.99` se guarda como `1000000` y "lo pagado coincide con lo donado" fallaría. Los enteros son exactos en `float4` hasta 16.777.216.
2. **Un pago rechazado NO marca la donación como `fallida`.** Mercado Pago permite reintentar el pago con la misma preferencia (por ejemplo, otra tarjeta). Si el primer rechazo la marcara fallida, el CAS `pendiente` → `completada` del segundo intento aprobado fallaría y **la plata no se acreditaría**. Solo `approved` cambia el estado; los demás estados solo se anotan en `external_status`, y nunca sobre una donación ya completada.

### Verificación
- Test nuevo `test/integration/donaciones.test.js` (24):
  - la migración;
  - el alta: el camino feliz con todos los campos de la fila y de la preferencia; sin URL pública; empresa sí, ONG no y sin sesión; 11 montos inválidos (string, booleano, array, `null`, decimal, 0, negativo, 99, 500.001, `1e21`) y los dos bordes; proyecto faltante, inexistente o inactivo; sin Mercado Pago (503); Mercado Pago caído (502 y `fallida`); el límite de 10 por hora;
  - `applyPayment`: acreditación con aviso a la ONG; el mismo pago dos veces; **cinco a la vez**; monto o moneda distintos (6 casos); rechazado o pendiente sin cambiar el estado; **un rechazo y después una aprobación con la misma preferencia**; un rechazo tardío que no pisa una completada; sin referencia o con una referencia inexistente; el pago de **otra** donación (`expectDonationId`); Mercado Pago caído (el error sube); **falla de la base a mitad de la transacción** (no queda nada a medias, y el reintento acredita); proyecto borrado (`project_id NULL`); y una falla de la notificación que no deshace nada.
- Rojo: los 24 cancelados, porque el módulo no existía (rojo débil). Los rojos fuertes los dio la mutación.
- Backend SQLite **741/741** y con TZ 741/741; Postgres **743/743** y con TZ 743/743. 0 fail, 0 cancelled, salida 0. En Postgres, el test de "cinco a la vez" corre con conexiones reales en paralelo. `npm audit` 0. CRLF conservados.
- **Mutación** (control en verde): **39 mutantes, sobrevive 1, equivalente**: "`p.amount === null` pasa". Sin ese chequeo, `Math.abs(null - monto)` da `monto` (≥ 100, porque `monto > 0` y el mínimo es $100), así que igual se detecta como monto distinto. Quedó por claridad.

### Errores propios
- La primera versión del test creaba todas las donaciones de `applyPayment` por `POST` con la misma usuaria y chocó con el límite de 10 por hora del mismo archivo (9 fallos que no eran del código). Pasé a insertarlas directo en la base, como las deja el alta.

### ⚠️ NO verificado
- **Mercado Pago real** (igual que §169).
- **El límite es por usuario y en memoria**: varias pestañas cuentan juntas, y se reinicia con el servidor.
- **`recaudado` como `float4`:** con más de 16.777.216 pesos acumulados en un proyecto, la suma deja de ser exacta. Para la tesis alcanza; para producción real habría que pasarla a `NUMERIC` (no es una migración aditiva: no lo hice).
- Las donaciones `pendiente` que nunca se pagan quedan así para siempre (no vencen). No molestan: no suman a nada.

## 171. Donaciones: aviso de Mercado Pago (`POST /webhook`) y conciliación (`GET /:id`) — PLAN_FALTANTE.md, Etapa 8

**Qué se hizo:** dos rutas más en `routes/donaciones.js`. Con estas, el backend de donaciones queda completo. Detalle en `API_CONTEXT.md`.
- **`POST /api/donaciones/webhook`** (público):
  - para el formato webhook (`?type=payment&data.id=…`), verifica la firma con el `data.id` de la **query**, que es lo que Mercado Pago firma (el del cuerpo podría venir cambiado), y llama a `applyPayment`;
  - responde 200 si se procesó o no hay nada que hacer, 401 si la firma no vale y **500 si falló Mercado Pago o la base**, para que Mercado Pago reintente (es idempotente);
  - **los avisos IPN (`?topic=…&id=…`) se responden 200 sin procesar.**
- **`GET /api/donaciones/:id`** (solo quien donó; si es de otra persona da 404, también para la ONG): devuelve el estado en inglés. Con `?payment_id=` (que Mercado Pago agrega a la URL de vuelta), concilia con `applyPayment(…, { expectDonationId })`.

**Por qué se ignoran los IPN:** la documentación oficial dice que los IPN "no permiten la validación mediante la clave secreta". Sobre cómo pedirle a Mercado Pago que mande solo webhooks a una `notification_url` (`source_news`), la documentación se contradice: una página dice que `source_news=ipn` hace recibir solo webhooks, y otra, que hace recibir solo IPN. Así que no agregué ese parámetro y diseñé para que funcione con cualquiera de los dos. Si solo llegaran IPN, la donación igual se acredita por la conciliación en cuanto el comprador vuelve a la app (`auto_return: 'approved'`).

### Verificación
- Test nuevo `test/integration/donaciones-webhook.test.js` (20). **La firma se verifica de verdad** (`MP_WEBHOOK_SECRET` de prueba); solo `getPayment` es un doble.
  - Aviso: firmado y aprobado; repetido 3 veces (una sola acreditación); firma inválida en cuatro variantes más sin secreto (401, sin consultar nada); el **id del cuerpo cambiado no hace consultar otro pago**; otro tipo; IPN; firmado sin `data.id` (400); pago inexistente en Mercado Pago (200); Mercado Pago caído (500) y el reintento que acredita; que no exponga nada.
  - Conciliación: sin `payment_id`; con uno aprobado de esta donación; **con uno de otra donación** (no acredita ninguna); ya completada (no vuelve a consultar); rechazado; `payment_id` no numérico, con `../` o con más de 30 dígitos (no se consulta); Mercado Pago caído o sin configurar; otra persona, la ONG o sin sesión (404/401, sin consultar); estados en inglés.
- `ownership.test.js` (+1): ni la ONG que recibe la donación, ni otra ONG, ni una empresa la ven; la dueña sí (regla 15).
- Rojo: los 20 fallaban (no existían las rutas).
- Backend SQLite **762/762** y con TZ 762/762; Postgres **764/764** y con TZ 764/764. 0 fail, 0 cancelled. `npm audit` 0.
- **Mutación** (control en verde): **19 mutantes, sobrevive 1, equivalente en los dos motores**: "el monto sin `Number()`". En SQLite `REAL` ya llega como número, y en Postgres `pg` convierte `float4` en número; lo corrí también contra Postgres con el mutante aplicado y pasa. Quedó por si la columna cambia a `NUMERIC`, que llegaría como string.

### Errores propios
- En el test "firmado pero sin `data.id`", la primera versión sacaba `id:;` de un header ya firmado (el `replace` no cambiaba nada). Lo armé a mano con el manifiesto sin la parte `id`.
- Un chequeo de la restauración del mutante con `md5sum | uniq` dio "2 hashes distintos": era la `\` que `md5sum` antepone a las rutas con barras invertidas. Los hashes eran iguales.
- Un `heredoc` de bash con comillas mezcladas falló al documentar (bash lo rechazó sin ejecutar nada). Pasé los textos a archivos.

### ⚠️ NO verificado
- **Qué avisos manda Mercado Pago de verdad** a la `notification_url` de una preferencia (webhook firmado, IPN o los dos), y si llegan firmados con la clave de la aplicación. Se ve en la Etapa 10, en los logs de Render.
- Que la URL de vuelta de Checkout Pro traiga `payment_id`: es lo que documentan las `back_urls`, pero no lo probé.

## 172. Donaciones en el frontend: "Donar", el modal y `/donaciones/vuelta` (PLAN_FALTANTE.md, Etapa 9)

**Qué se hizo:**
- **`lib/donations.ts`** (nuevo):
  - `checkDonationAmount` usa los mismos topes y mensajes que el backend: pesos enteros de 100 a 500.000 (§170);
  - `formatPesos` formatea en `es-AR`, sin decimales;
  - `readReturnParams` lee la URL de vuelta de Checkout Pro: `external_reference`, `payment_id` (o `collection_id`) y `status` (o `collection_status`), y toma `"null"` como ausente.
- **`api.ts`:** `api.donaciones.{ create, get(id, paymentId?) }`, con el id y el `payment_id` codificados, y el tipo `Donation` (regla 6).
- **`DonateModal.tsx`** (nuevo, con `<Modal>`): atajos y campo libre, validación previa, `create` y redirección a `checkout_url`. Avisa que es **modo prueba**.
- **`DonationReturn.tsx`** (nuevo, ruta `/donaciones/vuelta` bajo `Root`): le pregunta al backend, que concilia con Mercado Pago (§171).
  - **El estado lo decide el backend.** El `status` de la URL solo cambia el texto mientras el backend dice `pending`: con un rechazo o "sin pago" dice "El pago no se completó" en vez de "confirmando".
  - Mientras está pendiente vuelve a preguntar hasta 5 veces cada 3 segundos y después ofrece "Actualizar".
  - También tiene "No encontramos esta donación" (404), "Iniciá sesión…" y "Reintentar" ante un error de red.
- **`ProjectDetails.tsx`:** botón "Donar a este proyecto" en la tarjeta de progreso, solo para un proyecto `active` y si quien mira no es una ONG (lo mismo que acepta el backend). El visitante primero inicia sesión.

### Verificación
- Tests nuevos:
  - `lib/donations.test.ts` (12): la API (método, cuerpo, codificación, `payment_id` opcional), los topes, 8 entradas inválidas, los bordes, el formato y la URL de vuelta;
  - `DonateModal.test.tsx` (8);
  - `DonationReturn.test.tsx` (12): incluye **"la URL dice approved y el backend pending o failed: no dice ¡Gracias!"**, el reintento hasta 5 veces, que no vuelva a preguntar ante un rechazo, 404, red, sin sesión y la sesión verificándose;
  - `ProjectDetailsDonate.test.tsx` (6): voluntario, empresa, visitante, ONG, proyecto inactivo y sin meta.
- Rojo: los módulos no existían, y en `ProjectDetails` faltaba el botón (4 de 6 fallaban).
- Frontend **659/659** (antes 622, +37), también con `TZ=America/Argentina/Cordoba`; `typecheck` 0; `npm audit` 0. CRLF conservados.
- **Mutación** (control en verde): **34 mutantes; en la primera tanda sobrevivieron 2, no equivalentes**, y sumé el test que mata a cada uno:
  - "sigue preguntando aunque Mercado Pago avisó un rechazo" (4 pedidos de más);
  - "`failed` del backend tratado como pendiente", que se escondía porque el test de `failed` no traía `status` en la URL.
  
  Quedó en **0 de 34**.

### Errores propios
- Un test de 404 con dos montajes usaba `findAllByRole`, que vuelve apenas encuentra uno. Pasé a `waitFor(... toHaveLength(2))`.
- Los dos huecos de tests que encontró la mutación.

### ⚠️ NO verificado
- **Todo el flujo real con Mercado Pago:** que el checkout abra, que el comprador de prueba pueda pagar, que la vuelta traiga `external_reference` y `payment_id`, y que `auto_return` funcione. Va en la Etapa 10.
- Nada visual: el botón rosa en la tarjeta de progreso, el modal y las cuatro pantallas de la vuelta.
- `formatPesos` depende del `Intl` del navegador (`es-AR`): en jsdom da `$1.500`; en un navegador viejo podría variar.
- `ProjectDetails` sigue con su propio `safeMoney` (hay otras copias en `ProjectCard`, `FeedPostCard` y `PublicFeed`; deuda vista, no tocada).

## 173. Primera donación real en producción + lo que mostró: notificaciones de la ONG, recaudado sin meta, logs y el formato de las credenciales (PLAN_FALTANTE.md, Etapa 10)

**Prueba del usuario en Render (2026-10-16), con credenciales de prueba de Mercado Pago:**
- Antes de la prueba confirmé con pedidos sin sesión que la API de producción estaba al día: `POST /api/donaciones` y `GET /api/donaciones/x` daban 401 "Token requerido", y el aviso sin firma, 401 "Firma inválida".
- **El primer intento falló en el checkout** ("Usá un medio de pago distinto… No pudimos procesar tu pago"). El usuario cargaba la tarjeta de prueba **sin iniciar sesión** como comprador de prueba. **Iniciando sesión con el usuario comprador de prueba, anduvo.**
- **Donación de $500 a "Jornada de limpieza en el Lago": la vuelta mostró "¡Gracias por tu donación!"** (el backend la confirmó con Mercado Pago).
- Hallazgos de esa prueba:
  1. **Las credenciales de *prueba* del panel actual de Mercado Pago empiezan con `APP_USR-`** (captura del usuario: pestaña "Prueba", Public Key `APP_USR-f168…`). `payments.js` suponía `TEST-`, el formato viejo. Por eso usó `init_point`, que resultó ser lo correcto: con las credenciales de prueba nuevas se paga logueado como comprador de prueba. **Error mío:** la suposición no estaba verificada. Corregí el comentario y la línea de arranque, que ya no afirma "modo prueba" con `APP_USR-` porque desde el token no se puede saber. El comportamiento no cambió.
  2. **"La ONG no tiene la notificación"**: la notificación sí se creaba, pero **el panel de la ONG no tenía pantalla de notificaciones**. Solo existía `/notifications`, bajo el layout del voluntario, y ni la barra lateral ni la inferior de la ONG tenían un link. **Esto no es de las donaciones: las notificaciones "Nueva solicitud de inscripción" tampoco las vio nunca ninguna ONG.** En los logs de Render no apareció "no se pudo avisar", y eso descartaba que fallara al guardarse.
  3. **"Lo recaudado solo lo ve la ONG"**: `ProjectDetails` mostraba el financiamiento solo con meta (`funding_goal > 0`), y ese proyecto no tiene.
  4. **"No aparece nada en los logs"**: la API solo logueaba errores, así que un aviso que salía bien no dejaba rastro.

**Qué se hizo (aprobado por el usuario):**
- **Notificaciones de la ONG:**
  - ruta `/ngo/notifications`, con la misma `NotificationsScreen` y una prop nueva `inPanel` que saca el `md:ml-60`, porque en el panel la barra está en el flujo;
  - "Notificaciones" con contador de no leídas en `NGOSidebarNav`;
  - **campanita con contador en el encabezado de `NGODashboard`**, para el celular. No va en la barra inferior, que ya tiene 7 botones (§121); es decisión mía y se puede cambiar.
- **`ProjectDetails`:** sin meta, pero con donaciones, muestra "Recaudado en donaciones: $X", sin barra ni porcentaje. Con meta queda la barra de siempre.
- **`DonationReturn`:** "La ONG ya recibió el aviso" pasó a "Gracias por apoyar este proyecto". La pantalla no puede saber si la ONG lo vio.
- **Logs:** cada aviso deja **una línea** `[donaciones] …`: el pago y el resultado (`credited`, `already`, `not_approved`…), IPN ignorado, firma inválida (solo el `data.id`), otro tipo ignorado o "Mercado Pago no lo encuentra". La conciliación también deja una: el pago, la donación y el resultado. **Nunca la firma, los headers ni el secreto** (hay un test que lo verifica).

### Verificación
- Tests nuevos o cambiados:
  - `NGONotifications.test.tsx` (7): el link y el contador de la barra lateral; el resaltado; que si falla el pedido no rompa; la campanita con "Notificaciones (3 sin leer)", sin contador y que navegue; `inPanel` sin margen y sin `inPanel` con margen;
  - `ProjectDetailsDonate.test.tsx` (+3);
  - `DonationReturn.test.tsx` (+1);
  - `donaciones-webhook.test.js` (+2: los logs del aviso y de la conciliación, y que no se filtren la firma ni el secreto);
  - `payments.test.js` (+1: con `APP_USR-` no afirma el modo; con `TEST-` dice "sandbox").
- Rojo: 8 del frontend y 2 del backend fallaban antes del cambio.
- **Error propio:** `SwallowedErrors.test.tsx` simulaba `api.notifications.list` con un `vi.fn()` vacío (devuelve `undefined`), y la campanita nueva hace `.then()` sobre eso: fallaban 2 tests ajenos. Le di un valor por defecto (`{ notifications: [], unread: 0 }`); sus tests de Notificaciones lo siguen redefiniendo.
- Backend SQLite **765/765** y con TZ 765/765; Postgres **767/767** y con TZ 767/767. Frontend **670/670** y con TZ 670/670. `typecheck` 0. `npm audit` 0 en los dos. CRLF conservados.
- **Mutación** (control en verde): **19 mutantes, sobrevive 1, equivalente**: "contador sin `Number()`". El backend ya manda `unread` como número (§154) y, si faltara, `!!badge` lo oculta.

### ⚠️ NO verificado
- **Que el aviso de Mercado Pago llegue y con qué código:** sin los logs nuevos no había forma de verlo, y el usuario no encontró nada. Con este deploy, buscar `[donaciones]` en los logs de `voluntariar-api` después de una donación.
- **El rechazo con titular `OTHE` y el reintento con `APRO`**: el usuario no lo probó todavía.
- Nada visual: la campanita del panel en el celular, el renglón "Recaudado en donaciones" y la pantalla de notificaciones dentro del panel.
- `NotificationsScreen`, dentro del panel, sigue con su botón "Volver" (`navigate(-1)`): no lo cambié.

## 174. Verificación en producción de §173 (2026-10-16, hecha por el usuario en Render)

**Lo que probó el usuario, con los dos servicios desplegados:**
- **Donación** (logueado como comprador de prueba en el checkout) → la vuelta dice "¡Gracias!".
- **La ONG dueña del proyecto ve la notificación** "Recibiste una donación" (campanita / barra lateral, §173).
- **"Recaudado en donaciones"** aparece en el detalle del proyecto sin meta, **con el total correcto**.
- **Logs de `voluntariar-api`** (buscando `[donaciones]`):
  ```
  [donaciones] aviso IPN ignorado (topic=payment)
  [donaciones] aviso con firma inválida (data.id=183571855741)
  [donaciones] aviso IPN ignorado (topic=merchant_order)
  [donaciones] aviso con firma inválida (data.id=183571855741)
  [donaciones] conciliación del pago 183571855741 (donación 65368646-…): credited
  ```

**Qué muestran los logs:**
- Mercado Pago manda **las dos cosas**: avisos IPN (`topic=payment` y `topic=merchant_order`), que se ignoran como estaba previsto (§171), y **webhooks con el `data.id` correcto**, que **no pasaron la verificación de firma**.
- **La acreditación se hizo por la conciliación de la vuelta**, que es el respaldo diseñado en §171: una sola vez y con el pago correcto. El flujo funciona de punta a punta aunque el aviso no valide.

**Por qué puede fallar la firma (sin resolver todavía):**
1. `MP_WEBHOOK_SECRET` no está cargada en Render. Hoy el log dice "firma inválida" también en ese caso: no se distinguen.
2. La clave es de otra aplicación o de otra configuración de webhooks.
3. Los webhooks disparados por la `notification_url` de la preferencia podrían no firmarse con esa clave (la documentación no lo aclara).

Se le pidió al usuario mirar la línea `Pagos:` del arranque, volver a copiar la clave desde Webhooks → Configurar notificaciones y probar con "Simular notificación".

### ⚠️ NO verificado
- Que el webhook valide con la clave correcta: queda pendiente la prueba con "Simular notificación".
- El rechazo con titular `OTHE` y el reintento con `APRO`.
- Nada en un celular.

## 175. Sin `notification_url` en la preferencia + diagnóstico en "firma inválida" (pendiente de §174)

**Contexto (pruebas del usuario en producción, 2026-10-16):**
- **Simular notificación** desde el panel de Mercado Pago dio `[donaciones] aviso del pago 123456: Mercado Pago no lo encuentra` y 200. **La firma validó**, así que la clave cargada es la correcta y el algoritmo (sacado del SDK, §169) también.
- En una **donación real**, los dos webhooks del pago (`data.id=183574351421`, en el mismo segundo) dieron **firma inválida**. Llegaron además 3 IPN (ignorados). La donación se acreditó por la conciliación de la vuelta.
- El usuario confirmó que la clave **era la misma** antes y después. O sea: **los avisos simulados validan y los reales no.** Hipótesis, sin confirmar porque la documentación no lo dice: las credenciales de prueba nuevas (`APP_USR-`, §173) pertenecen a una cuenta vendedora de prueba que Mercado Pago crea por detrás, y los avisos reales podrían salir firmados con la clave de esa cuenta.

**Qué se hizo (aprobado por el usuario):**
- **`POST /api/donaciones` ya no manda `notification_url`.** Esos avisos no validaban y venían con IPN. Queda solo el webhook del panel (Tus integraciones → Webhooks), más la conciliación de la vuelta. Se sacó `apiPublicUrl()` (`API_PUBLIC_URL`/`RENDER_EXTERNAL_URL`), que ya no se usa.
- **La línea de "firma inválida"** suma datos de diagnóstico que no son secretos: si vino `x-request-id` (sí/no, nunca el valor), el `ts` del header (solo dígitos) y, del cuerpo, `live_mode` (solo si es booleano) y `user_id` (solo si es numérico). Con el `user_id` se puede ver si el aviso viene de la cuenta de la aplicación o de otra. Nunca se loguean el hash, el secreto, otros headers ni otros campos del cuerpo.

### Verificación
- Tests:
  - `donaciones.test.js`: la preferencia ya no lleva `notificationUrl`, ni con `API_PUBLIC_URL` ni con `RENDER_EXTERNAL_URL` (+1);
  - `donaciones-webhook.test.js` (+1): la línea de diagnóstico con los cuatro datos, y con valores que no tienen la forma esperada (`'x"; DROP'`, `'quizás'`, sin header) muestra `?`, sin copiarlos, y nunca el hash, el request-id ni un email del cuerpo.
- Rojo: 3 fallaban antes del cambio.
- Backend SQLite **767/767** y con TZ 767/767; Postgres **769/769** y con TZ 769/769. `npm audit` 0. Frontend sin cambios.
- **Mutación** (control en verde): **7 mutantes, 0 sobrevivientes**: que vuelva la `notification_url`, `live_mode` y `user_id` sin chequear, el request-id al revés o copiado, y el `ts` sin regex o siempre `?`.

### Errores propios
- El primer intento de aplicar el cambio con `node -e` falló por los escapes del regex dentro de las comillas de bash (la memoria del proyecto ya lo advertía). No escribió nada; lo pasé a un archivo de script.

### ⚠️ NO verificado
- **Que el webhook del panel llegue y valide en un pago real.** Hace falta una donación más después del deploy. Si llega con firma inválida, la línea nueva muestra el `user_id`, y con eso se confirma o se descarta la hipótesis de la cuenta vendedora de prueba.
- Si dejaran de llegar avisos del todo (porque el panel no los manda para estos pagos), la acreditación sigue por la vuelta. Esto se verificó dos veces, en §173 y §174.

## 176. Verificación en producción de §175: en modo prueba los avisos de pagos reales no llegan por el webhook del panel

**Prueba del usuario después del deploy de §175 (2026-10-16):** una donación nueva. Log:
```
[donaciones] aviso con firma inválida (data.id=183565653443)
[donaciones] conciliación del pago 183576940357 (donación 27c78402-…): credited
```

**Lectura:**
- La línea de "firma inválida" **no trae el diagnóstico de §175** y es de **otro pago** (`183565653443`, no el de esta donación). Es un **reintento** de un aviso de una donación anterior: Mercado Pago reintenta los que respondimos con 401. Lo atendió la versión anterior de la API, antes de que terminara el deploy.
- **Para el pago nuevo no llegó ningún aviso**: sin `notification_url` (§175), el webhook configurado en el panel no mandó nada para un pago de prueba real, aunque su "Simular notificación" sí llega y valida (§174).
- **La donación se acreditó por la conciliación de la vuelta**, igual que en §173 y §174.

**Conclusión:**
- Con las credenciales de prueba actuales, los avisos de pagos reales solo llegaban por la `notification_url` y **no validaban** con la clave de la aplicación. El webhook del panel no los manda.
- **La acreditación de las donaciones funciona y está verificada en producción tres veces, por la vuelta** (Checkout Pro redirige solo con `auto_return: 'approved'`).
- Hipótesis de la causa, sin confirmar porque la documentación no lo explica: las credenciales de prueba pertenecen a una cuenta vendedora de prueba creada por Mercado Pago, y sus avisos no se firman con la clave de la aplicación.

**Limitación conocida:** si el comprador cierra la pestaña de Mercado Pago antes de volver, la donación queda `pendiente`. Opciones planteadas al usuario:
- (A) documentarlo como limitación del modo prueba;
- (B) conciliar las pendientes buscando el pago por `external_reference` (`GET /v1/payments/search`), que sería una etapa nueva y habría que verificarla contra el SDK.

### ⚠️ NO verificado
- Cuánto tiempo sigue reintentando Mercado Pago los avisos viejos que respondimos con 401. Seguirán apareciendo líneas de "firma inválida" de pagos viejos; son inofensivas.
- Si con **credenciales productivas** los avisos sí validan: no se probó (no se van a usar para la tesis).

## 177. Borrar la propia cuenta, con confirmación por email (backend)

**Por qué:** para la página de privacidad (Etapa 11) hacía falta decir cómo se borra una cuenta, y no existía ningún endpoint. El usuario prefirió agregarlo antes que publicar un email de contacto.

**Qué se hizo:**
- **Tabla nueva** `account_deletion_tokens(token_hash PK, user_id → users ON DELETE CASCADE, expires_at TEXT, created_at)` e índice por `user_id`. Se guarda **solo el hash sha256** del código. `expires_at` es un ISO calculado en JS: no se usa la hora de la base, para no depender del motor ni de la zona horaria.
- **`POST /api/auth/me/delete-request`** (con sesión; 3 por hora):
  - genera un código de 256 bits (`randomBytes(32)` en base64url, 43 caracteres), borra los pedidos anteriores e inserta el nuevo en una transacción;
  - **después del COMMIT** manda el email (`accountDeletionEmail`) con el link `APP_URL/cuenta/borrar?token=…`;
  - si Resend no está configurado responde **503**, y si falla, **502**. En los dos casos **se descarta el link**: sin email no hay borrado.
- **`POST /api/auth/delete-account { token }`** (sin sesión, porque el link puede abrirse en otro dispositivo):
  - el código tiene que tener la forma exacta y existir; si no, 400 "El link no es válido o ya se usó…". Si venció, 400 "El link venció…" y se descarta;
  - si vale, en **una transacción** corrige los contadores que la cascada no toca y borra el usuario. Los contadores son los seguidores de ONG, proyectos y voluntarios, que nunca bajan de 0 por los CHECK, y los `cupos_ocupados` de sus inscripciones **aprobadas**. Lo demás cae por `ON DELETE CASCADE`, y todas las claves a `users` lo tienen (lo revisé en `migrate.js`): perfil, inscripciones, mensajes, notificaciones, Momentos, follows y, si es ONG, sus proyectos con las inscripciones de otros. Las donaciones de otros a esos proyectos quedan con `project_id`/`ngo_id` en NULL;
  - **después del COMMIT** borra, en lo posible, el CV y las fotos de Momentos en Cloudinary (las propias y, si es ONG, las de sus proyectos). Si Cloudinary falla, solo se loguea.
- El email se llama por propiedad (`email.sendEmail`) para poder reemplazarlo en los tests. Las rutas viejas lo desestructuran y no se tocaron.

### Verificación
- Test nuevo `test/integration/account-deletion.test.js` (15):
  - el pedido: el email, el link, el hash sin el código en claro, el vencimiento en ~1 hora; uno nuevo invalida el anterior; sin email (503) y con el email fallando (502) no queda link; 401; el límite de 3 por hora;
  - el borrado: 7 formas inválidas de código; vencido (se descarta y la cuenta sigue); **la voluntaria completa** (todo lo suyo borrado, los cuatro contadores corregidos, el cupo de la pendiente intacto, el CV y la foto borrados en Cloudinary, sin poder volver a iniciar sesión); un solo uso; un contador en 0 que no baja; **la ONG** (sus proyectos, las inscripciones y fotos de otros en ellos, las donaciones sin proyecto); la empresa; Cloudinary caído; **la base que falla a mitad** (no se borra nada, los contadores no bajan, Cloudinary no se toca y el mismo link sirve para reintentar).
- Rojo: los 15 fallaban (no existían las rutas).
- Backend SQLite **782/782** y con TZ 782/782; Postgres **784/784** y con TZ 784/784. 0 fail, 0 cancelled. `npm audit` 0. CRLF conservados.
- **Mutación** (control en verde): **27 mutantes, sobrevive 1, equivalente**: "aceptar cualquier forma de código". Un código mal formado igual no coincide con ningún hash y da el mismo 400; el chequeo solo ahorra una consulta.

### ⚠️ NO verificado
- **El email real:** con el remitente de prueba de Resend y `EMAIL_REDIRECT_TO`, el link le llega **al usuario del proyecto**, no a la cuenta que se borra. Para la demo alcanza; para un sitio real hace falta un dominio verificado. No lo probé en Render.
- **Las fotos de perfil y de proyectos** en Cloudinary no se borran: no guardamos su id (pendiente conocido).
- **El JWT de la cuenta borrada** sigue siendo válido hasta que vence, pero apunta a un usuario que no existe: `/auth/me` da 404 y el frontend cierra la sesión.
- Dos borrados simultáneos con el mismo link: el segundo no encuentra el usuario (`changes = 0`) y responde 400. No lo probé con concurrencia real.

## 178. Borrar la propia cuenta (frontend): "Zona peligrosa" en los perfiles y `/cuenta/borrar`

**Qué se hizo:**
- **`DeleteAccountSection.tsx`** (nuevo), en `VolunteerProfile` (fuera de la edición), `NGOOwnProfile` y `CompanyOwnProfile`:
  - "Borrar mi cuenta" pide confirmar **en la pantalla**, sin `window.confirm`: explica qué se borra y, **a una ONG, que se van sus proyectos y las inscripciones de los voluntarios**;
  - "Mandarme el email" llama a `api.auth.requestDeletion` y avisa "Te mandamos un email a <tu email>… Vence en 1 hora";
  - los errores van con `role="alert"` y, mientras manda, el botón dice "Mandando…".
- **`DeleteAccountPage.tsx`** (nuevo, ruta `/cuenta/borrar` bajo `Root`, sin sesión): explica qué se borra y que no se puede deshacer. Con "Sí, borrar mi cuenta" llama a `api.auth.deleteAccount(token)`, **cierra la sesión** y muestra "Tu cuenta se borró". Si el link venció o ya se usó, muestra el mensaje del servidor **sin cerrar la sesión**, y el botón se puede volver a tocar. Sin token, "Este link no es válido".
- **`api.ts`:** `api.auth.requestDeletion()` y `api.auth.deleteAccount(token)`.

### Verificación
- Test nuevo `DeleteAccount.test.tsx` (13): la API; la confirmación en pantalla (Cancelar no manda nada); el aviso de la ONG y que un voluntario no lo vea; el error del servidor y sin red; el estado "Mandando…"; la página (no borra hasta confirmar, borra con el token y cierra la sesión, link vencido, sin token, "Borrando…" y el botón habilitado tras un error). `ProfilePhotoScreens.test.tsx` (+1): la sección está en los tres perfiles.
- Rojo: los módulos no existían (rojo débil) y el test de los tres perfiles fallaba (rojo fuerte).
- Frontend **683/683** (antes 670, +13), también con TZ; `typecheck` 0; `npm audit` 0. Finales de línea conservados.
- **Mutación** (control en verde): **18 mutantes; en la primera tanda sobrevivieron 2, no equivalentes**: el mensaje sin red de la sección, y el botón de la página que no se rehabilitaba tras un error. Sumé los dos tests y quedó en **0 de 18**.

### Errores propios
- Los dos huecos de tests que encontró la mutación.

### ⚠️ NO verificado
- ~~El flujo real en Render~~ **Verificado por el usuario el 2026-10-16**: pedir el email, recibirlo y borrar la cuenta desde el link funciona en producción. Sigue sin verificarse lo visual en un celular.
- La pantalla de confirmación no sabe de qué rol es la cuenta (no hay sesión): por eso el aviso de la ONG va siempre, como "Si sos una ONG…".

## 179. Privacidad y términos (`/privacidad`) y la guía de datos de demo (PLAN_FALTANTE.md, Etapa 11)

**Qué se hizo:**
- **`PrivacyPage.tsx`** (nuevo, ruta pública `/privacidad`). Ocho secciones (`<section aria-labelledby>`): quién es responsable, qué datos se guardan, quién ve qué, con quién se comparten, cuánto tiempo, derechos (Ley 25.326), reglas de uso y **limitaciones de la demo**.
  - Responsable: **"proyecto final de la Universidad Católica de Córdoba (UCC)"**, sin nombres ni email (decisión del usuario). Aclara que es una demo académica.
  - Para borrar los datos remite a **"Borrar mi cuenta"** (§177–§178).
- **Links:** en el registro, "Al crear tu cuenta aceptás la política de privacidad y los términos de uso". Se abre en otra pestaña (`target="_blank" rel="noopener noreferrer"`) para no perder el formulario, y no aparece al iniciar sesión. También está en el pie de la barra del feed (`FeedSidebar`).
- **`docs/DEMO_DATOS.md`** (nuevo): qué cuentas crear, qué cargar y en qué orden para que la defensa muestre todos los módulos, más un checklist final. **Sin contraseñas**, porque el repo está en GitHub, y sin datos de personas reales. Los datos de demo se cargan por la interfaz (decisión del usuario; el seed sigue bloqueado en producción, §116).

**Cada afirmación de la página, verificada en el código el 2026-10-16:**
- **Sin cookies ni analítica:** no hay `gtag`, `analytics`, `plausible` ni `hotjar` en `frontend/src` ni en `index.html`, y no se usa `document.cookie` ni `res.cookie`. La sesión es `v_token` en `localStorage` (`api.ts`), que se borra al cerrar sesión.
- **La contraseña se guarda con bcrypt** (`auth.js`, `bcrypt.hash(password, 10)`).
- **El CV:** privado, solo para la ONG con inscripción pendiente o aprobada, con un link de 10 minutos (§165).
- **Los mensajes** los ven los dos participantes. **La donación** la ve solo quien donó (§171), y la ONG recibe un aviso con el monto (§170).
- **Mercado Pago no le pasa la tarjeta a la app:** Checkout Pro se paga en su página (§169).
- **Los emails "van al equipo del proyecto":** con el remitente de prueba de Resend, solo se entregan al dueño de la cuenta, y con `EMAIL_REDIRECT_TO` todos se redirigen a esa dirección.
- **Las fotos de perfil anteriores** pueden quedar en Cloudinary (§162: no se guarda su id).

### Verificación
- Tests: `PrivacyPage.test.tsx` (10: título y fecha, responsable, las 8 secciones, CV, proveedores y "no vendemos", derechos, limitaciones, cookies, **que no publique ningún email**, y el link del pie) y `AuthModal.test.tsx` (+1: el link solo en el registro, con `target` y `rel`).
- Rojo: el módulo no existía, y el test del registro fallaba.
- Frontend **694/694** (antes 683, +11), también con TZ; `typecheck` 0. Backend sin cambios.
- **Mutación** (control en verde): **16 mutantes, 0 sobrevivientes**: el aviso también en el login, el aviso ausente, la misma pestaña, sin `noopener`, sin el link del pie, y que la página pierda el responsable, "demo académica", el vencimiento del CV o su restricción, "no vendemos", Resend, la ley, "Borrar mi cuenta", el aviso de los emails, el de las cookies o la fecha.

### Errores propios
- Un test buscaba el `<strong>CV</strong>` en vez del renglón (`closest('li')`).

### ⚠️ NO verificado
- **No es asesoramiento legal.** La mención a la Ley 25.326 la escribí con lo que sé, no consulté la ley hoy. Para la tesis alcanza como aviso de una demo académica; para un servicio real habría que revisarlo con alguien que sepa.
- Nada visual: la página y el renglón del registro.
- `DEMO_DATOS.md` no lo seguí yo: lo vas a ejecutar vos en producción. Si algún paso no coincide con la interfaz, se corrige.

## 180. Guion de la defensa y docs viejos (PLAN_FALTANTE.md, Etapa 13)

**Qué se hizo:**
- **`docs/GUION_DEFENSA.md`** (nuevo):
  - el checklist de los días antes: datos cargados, último deploy, una donación de prueba, credenciales fuera del repo, un video de respaldo y el plan B local con el seed;
  - el checklist del día: despertar la API con `/health`, **un navegador o perfil por cuenta** (la sesión vive en el `localStorage` de cada navegador) y el checkout con el comprador de prueba;
  - un **recorrido de ~15 minutos** por los módulos con qué decir en cada uno, qué contar de lo técnico, **las limitaciones con respuesta corta** (el aviso de Mercado Pago en modo prueba, los emails de prueba, el plan gratuito, la paginación), el trabajo futuro y un plan B por cada falla probable.
  - **A confirmar con la cátedra:** la duración y el formato de la defensa.
- **Docs viejos que encontré al armar el plan (2026-10-16):**
  - `README.md`: decía que la base gratuita "expira a los 90 días". Pasó a "30 días de creada; la de este proyecto vence el 14 de noviembre de 2026", que es lo que vio el usuario en el panel. Además, la descripción suma fotos y CV, donaciones y privacidad.
  - `PROJECT_CONTEXT.md §7`: decía que `NGOEmpleados` hace `fetch()` directo; quedó tachado como resuelto en §98.
  - `BACKEND_ROADMAP_ANALYSIS.md §0`: Multimedia, CV y Pagos pasan a ✅ con sus secciones, y en §3 el riesgo del fallback de `JWT_SECRET` queda como resuelto (§94).

### Verificación
- Lo que afirma el guion, contra el código o esta sesión:
  - `/health` (`render.yaml`, `healthCheckPath`);
  - las líneas `Fotos:`, `Pagos:` y `Email:` del arranque (`index.js`);
  - `npm run db:reset` (§116);
  - los cupos atómicos (§39), las horas que carga la ONG (§22) y el tope de 500 en Explorar (§119);
  - los números de tests de la última corrida: backend 782/784 y frontend 694.
- Solo documentación: no se corrieron los tests de nuevo.

### ⚠️ NO verificado
- El formato y la duración de la defensa (a confirmar con la cátedra).
- Que el plan B local ande en la notebook del usuario el día de la defensa: hay que probarlo antes.

## 181. ¿Adónde llega la plata? Diseño Marketplace (OAuth por ONG): validado hasta la autorización; decisión C (2026-10-17)

**El hueco (lo planteó el usuario):** hoy todas las donaciones se cobran con **una sola cuenta de Mercado Pago**, la de la aplicación (`MP_ACCESS_TOKEN`). La ONG no puede indicar dónde recibir la plata. En modo prueba no se nota, pero en un sistema real la plataforma estaría recibiendo dinero de terceros.

**Diseño correcto para producción: Marketplace de Mercado Pago con OAuth por ONG.**
1. La ONG toca "Vincular Mercado Pago" y va a `https://auth.mercadopago.com/authorization?client_id=<app>&response_type=code&platform_id=mp&state=<aleatorio>&redirect_uri=<URL fija>`.
2. Autoriza con su cuenta y vuelve con un `code`, que vale 10 minutos.
3. El backend lo cambia en `POST /oauth/token` (`client_id`, `client_secret`, `code`, `grant_type=authorization_code`, `redirect_uri`; `test_token=true` en sandbox) por el access token de la ONG, que dura 180 días, y su refresh token. Los guarda cifrados.
4. Cada preferencia se crea **con el token de la ONG dueña del proyecto**, así que la plata se acredita en su cuenta, con `marketplace_fee` en 0.
5. La conciliación consulta el pago con ese mismo token.

Encaja con el modelo estándar de "1 marketplace + 1 vendedor por transacción": cada donación es a un proyecto de una ONG.

**Fuentes (verificadas el 2026-10-16 y el 2026-10-17):**
- el **código del SDK oficial** `mercadopago@3.6.1`: el cliente `OAuth` con `getAuthorizationURL` (`https://auth.mercadopago.com/authorization`, `response_type=code`, `platform_id=mp`), `create` (`POST /oauth/token`, `grant_type=authorization_code`) y `refresh` (`grant_type=refresh_token`), más los campos de la respuesta (`access_token`, `refresh_token`, `user_id`, `expires_in`, `public_key`, `live_mode`);
- la documentación oficial "Obtener Access Token" (el code dura 10 minutos y el token 180 días; `test_token`; PKCE opcional) y la del marketplace con Checkout Pro (`marketplace_fee`; el token de cada vendedor por OAuth);
- **la IA de soporte de Mercado Pago**, consultada por el usuario: "el dinero se acredita en la cuenta del vendedor cuyas credenciales usaste para crear la preferencia" y "el vendedor tiene que vincularse vía OAuth". Además: **en OAuth no existe un client_id/client_secret de prueba aparte: son los de la aplicación, y si no tiene las credenciales de producción activadas, hay que activarlas para completar el intercambio**.

**Lo que se validó en vivo (con el usuario):**
1. Se agregó `https://voluntariar-g0u6.onrender.com/` como URL de redireccionamiento de la aplicación, con PKCE en "No" y los permisos `read`, `offline_access` y `write`.
2. Un **segundo vendedor de prueba** (la "ONG", `user_id` 3772556008) abrió la URL de autorización y aceptó. **Mercado Pago devolvió el `code`** a la URL de vuelta (`?code=TG-…-3772556008&state=prueba123`): **la vinculación de la ONG funciona en modo prueba**.
3. **Bloqueo:** el intercambio del `code` necesita el `client_secret` de la aplicación, que **solo aparece al activar las credenciales de producción con la cuenta real del usuario** (industria, sitio web y la aceptación del uso de datos personales y de los términos). Las credenciales de prueba no lo traen: pertenecen a una **cuenta vendedora de prueba creada por Mercado Pago** (`user_id` 3771872304, aplicación 4252289510479096). Esto **confirma la hipótesis de §176**: los avisos reales venían de esa cuenta oculta.

**Decisión del usuario: opción C.** No activar las credenciales de producción de su cuenta real para una demo académica y dedicar el tiempo a preparar la defensa. **El diseño queda documentado como trabajo futuro**, con lo validado. No se escribió código. Para el que lo implemente:
- **Esquema:** una tabla de cuentas vinculadas por ONG (`mp_user_id`, tokens cifrados con AES-256-GCM y una clave de entorno, vencimiento) y una de `state` de un solo uso (hash, como en §177); en `donaciones`, a qué cuenta se cobró.
- **Endpoints:** vincular, la vuelta de Mercado Pago (valida el `state`, intercambia y redirige al panel) y desvincular. Las donaciones se crean con el token de la ONG (renovándolo si venció), y el detalle del proyecto indica si acepta donaciones (botón solo para ONGs vinculadas).
- **Variables:** `MP_CLIENT_ID`, `MP_CLIENT_SECRET` y la clave de cifrado.

### ⚠️ NO verificado
- El intercambio del `code` por los tokens y todo lo que sigue (la preferencia con el token de la ONG, la acreditación en su cuenta): bloqueado por la activación de producción.
- Lo de la IA de Mercado Pago es una respuesta de soporte, no documentación. Coincide con la doc oficial en lo que se pudo cotejar.
- Quedó configurada la URL de redireccionamiento en la aplicación y el vendedor de prueba 3772556008 autorizó la aplicación: no molesta, y se puede revocar desde esa cuenta de prueba.

## 182. Pasada final de documentación (2026-10-17, pedido del usuario antes de cerrar)

**Qué se corrigió (solo docs):**
- **Conteos:** "31 tablas / 20+ índices" pasó a **33 tablas y 33 índices** (contados en `migrate.js`: `CREATE TABLE` y `CREATE INDEX`) en `README.md`, `PROJECT_CONTEXT.md` y `BACKEND_CONTEXT.md`. Componentes: de "47" a **56** (sin tests).
- **`PROJECT_CONTEXT.md`:**
  - en el diagrama y el árbol de rutas faltaban `posts.js` y `donaciones.js`, y `auth.js` y `voluntarios.js` ahora mencionan la foto, el borrado de la cuenta y el CV;
  - `multer` se usa también para la foto de perfil y el CV;
  - Render: "expira a los 90 días" pasó a "vence a los 30 días; la de este proyecto, el 14/11/2026".
- **`BACKEND_CONTEXT.md`:** el ejemplo de transacción decía "Stripe"; ahora dice "llamadas externas (Cloudinary, Mercado Pago)".
- **`CLAUDE.md`, "Pendientes conocidos":**
  - el deploy figuraba "no verificado" y ahora está verificado, con el auto-deploy apagado y la fecha de vencimiento de la base;
  - lo de Cloudinary al borrar la cuenta;
  - las limitaciones de Mercado Pago en modo prueba (§173, §176, §181).
- **`GUION_DEFENSA.md`:** el usuario decidió **no grabar video**. El plan B pasa a ser el local más capturas de las pantallas clave.
- **`PLAN_FALTANTE.md`:** un bloque **"Estado al 2026-10-17"** arriba de todo, con lo hecho, lo decidido como trabajo futuro y lo que le queda al usuario. Así el próximo chat no tiene que reconstruirlo.

### Verificación
- `grep` sin restos de "31 tablas" ni "90 días" en `README`, `PROJECT_CONTEXT`, `BACKEND_CONTEXT` y `CLAUDE.md`. Las referencias históricas que quedan en `PROJECT_ANALYSIS.md` y `PLAN_FALTANTE.md` son registro de lo que se decía antes, y no se tocan.
- Sin cambios de código: los tests no se volvieron a correr. Los últimos conteos son de §177–§179.
