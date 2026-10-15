# BACKEND_ROADMAP_ANALYSIS.md — VoluntariAR

> Diseño técnico del backend (Express + SQL nativo + SQLite/Postgres) para las funcionalidades que **faltan**. Es un documento de *diseño*, no de estado: el registro cronológico de lo implementado está en `PROJECT_ANALYSIS.md` (§24 en adelante).
>
> **Historial de este archivo:** la primera versión (sept. 2026) era un análisis previo a construir Empresas/Patrocinio/Chatbot y describía todo como pendiente, con Pagos pensado para Mercado Pago. Esta versión (reescrita tras cerrar esos módulos y tomar las decisiones de producto de `PROJECT_ANALYSIS.md §30`) marca lo hecho como hecho, incorpora las decisiones, y **corrige los diseños pendientes contra el esquema y el adaptador reales** (ver "Hechos verificados" más abajo). La numeración de secciones se mantiene igual que la original para no romper referencias cruzadas.
>
> Convenciones: columnas de DB en español, contrato de API en inglés vía `fmt()`, IDs `TEXT`, SQL con placeholders `$N` (traducidos por `db/index.js`), cambios de esquema aditivos (tablas nuevas con `CREATE TABLE IF NOT EXISTS`; columnas nuevas con `addColumnIfNotExists` — ver `AI_RULES.md` reglas 12-13).

### Hechos verificados contra el código (no asumir otra cosa al implementar)

- **No se usa `RETURNING` en ningún lugar del proyecto.** El patrón es `db.run(INSERT …)` y después re-`SELECT`. Cuando hace falta conocer el `id` antes de insertar (ej. para atarlo a un checkout externo), generarlo en JS con `crypto.randomUUID()` (built-in de Node, sin dependencias) e insertarlo explícito — funciona igual en SQLite y Postgres porque los IDs son `TEXT`.
- **El adaptador (`db/index.js`) ahora tiene `db.transaction()`** (2026-09, `PROJECT_ANALYSIS.md §34`; antes no tenía). `db.run` devuelve `{ lastID, changes }` en ambos motores (`changes` = filas afectadas), útil para chequeos de idempotencia.
- **`donaciones.estado` tiene `DEFAULT 'completada'`.** Cualquier `INSERT` que no ponga `'pendiente'` explícito crea una donación "ya pagada". También tiene `ngo_id` (nullable) y **no** tiene `updated_at`.
- **`express.json()` está montado globalmente** en `index.js` (línea 25). Cualquier webhook que necesite el body crudo (Stripe) debe montarse **antes** de esa línea.
- Columnas confirmadas: `enrollments.horas_realizadas`, `enrollments.mensaje`, `enrollments.status ∈ {pending, approved, rejected, cancelled}`, `users.avatar/bio/location`, `voluntarios.cv_url` (existe, sin usar), `voluntarios.ubicacion` (duplicada de `users.location`, sin usar), `projects.recaudado/meta_financiera`.

---

## 0. Estado y orden de prioridad

> **Nota de compatibilidad:** `PROJECT_ANALYSIS.md §24` y `§26` citan "punto 1" y "punto 5" de este documento — eran filas de la tabla de prioridad plana (1 a 10) de la primera versión, no las secciones `§1.x`/`§2.x` de esta reescritura. Equivalencia: 1→§2.1, 2→§1.1, 3→§1.3, 4→§1.5, 5→§2.2, 6→§2.3, 7→§2.5, 8→§2.4, 9→§1.2, 10→§1.4.

| Módulo | Estado | Notas |
|---|---|---|
| Empresas: perfil + guardas de rol | ✅ Hecho | `PROJECT_ANALYSIS.md §24-25` |
| Patrocinio Empresa↔Proyecto | ✅ Hecho | `§26` |
| Chatbot FAQ (sin IA) | ✅ Hecho | `§27` — el diseño final difiere del original, ver §1.2 |
| Follows / feed / mapa / explorar | ✅ Hecho (por el usuario) | `§28`, bugs corregidos en `§29` |
| **Dashboard de Empresa (KPIs)** | ✅ Hecho | §2.3 — `PROJECT_ANALYSIS.md §33` |
| **Multimedia (Cloudinary)** | 🟡 En curso: **Momentos** (publicaciones con fotos) — backend ✅ (`PROJECT_ANALYSIS.md §43`), frontend ⏳. Pendiente: fotos de perfil y la base para el CV | §1.1 |
| **Gestión de CV** | ⏳ Depende de Multimedia; privacidad decidida | §1.3 |
| **"Empleados" de empresa (usuario real)** | ⏳ Decidido; queda una sub-decisión (consentimiento) | §2.4 |
| **Chat Empresa↔ONG/Voluntario** | ⏳ Sin bloqueos; queda una decisión menor | §2.5 |
| **Pagos (Stripe, modo test)** | ⏳ Decidido; transacciones ya disponibles (§1.5) | §1.4 |
| Chatbot con IA | ⏸ Sin decidir, no es prioridad | — |

**Orden recomendado para lo pendiente, y por qué:**

1. ~~**Dashboard de Empresa**~~ ✅ hecho (`PROJECT_ANALYSIS.md §33`).
2. **Multimedia** — servicio genérico de upload; conviene hacerlo una sola vez porque CV (y cualquier imagen futura) cuelga de él.
3. **CV** — casi gratis una vez que existe el upload (la columna ya está).
4. **Empleados de empresa** — es prerrequisito de la parte "voluntarios propios" del chat (§2.5) y de un KPI extra del dashboard.
5. **Chat de Empresa** — reusa la infraestructura existente; es solo autorización.
6. **Pagos** — último a propósito: es el de mayor superficie de riesgo y sus transacciones ya están disponibles en el adaptador (§1.5, `db.transaction()`).

---

## 1. Módulos generales

### 1.1 Sistema de Multimedia — Cloudinary *(en curso: Momentos ✅ backend)*

> **Actualización (`PROJECT_ANALYSIS.md §43`):** apareció el caso de uso que este diseño dejaba pendiente — **publicaciones con fotos de los voluntariados, estilo Instagram ("Momentos")** — y se implementó el backend. Se apartó del diseño de abajo en tres puntos, cada uno por un motivo:
> 1. **Tablas propias con FK reales** (`posts`, `post_media`, `post_likes`) en vez de la tabla `media` polimórfica: al borrar un post, un proyecto o un usuario no quedan fotos ni likes huérfanos. La tabla genérica sigue siendo la opción para fotos de perfil/logos cuando se hagan.
> 2. **API REST con `fetch` en vez del SDK de Cloudinary** (sin dependencia nueva), con la firma verificada contra el vector oficial de su documentación.
> 3. **Subida por el servidor con `multer` (`memoryStorage`)**, como en el diseño, pero validando la **cabecera real** del archivo y todo lo demás **antes** de subir, y limpiando lo subido si algo falla.
>
> **Sigue pendiente de este diseño:** fotos de perfil/logos y la base para el **CV (§1.3)**, que además necesita URLs firmadas y acceso restringido. Lo que sigue de abajo es el diseño original, vigente para eso.

Free tier permanente de Cloudinary, con resize/transformación on-the-fly (no hay que generar thumbnails a mano). Ver el porqué de la decisión en `PROJECT_ANALYSIS.md §30`.

**Alcance recomendado (no sobre-construir):** empezar solo con `owner_type ∈ ('project','ngo','empresa','user')`. El diseño original incluía `'comment'`, pero en la app no existe ningún flujo de "post con imágenes" ni comentarios con adjuntos — agregarlo cuando exista el caso de uso, no antes.

**Tabla nueva** (en `migrate.js`, dentro del array de tablas; usar las constantes del script, no SQL literal):

```js
`CREATE TABLE IF NOT EXISTS media (
  id           ${UUID_PK},
  owner_type   TEXT NOT NULL CHECK(owner_type IN ('project','ngo','empresa','user')),
  owner_id     TEXT NOT NULL,          -- FK polimórfica: sin constraint de DB, se valida en el controlador
  url          TEXT NOT NULL,
  provider_id  TEXT NOT NULL,          -- public_id de Cloudinary, para poder borrar después
  tipo         TEXT NOT NULL DEFAULT 'image' CHECK(tipo IN ('image','video')),
  orden        INTEGER DEFAULT 0,
  ancho        INTEGER,
  alto         INTEGER,
  created_by   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   ${NOW}
)`,
// índice: CREATE INDEX IF NOT EXISTS idx_media_owner ON media(owner_type, owner_id)
```

Tabla polimórfica porque evita `project_media`/`ngo_media`/… por separado. El costo: no hay `FOREIGN KEY` real, así que **el controlador debe validar `owner_id` y la propiedad antes de insertar**, o quedan huérfanos y cualquiera podría colgar imágenes de recursos ajenos.

**Helper de propiedad** (nuevo, reusable — reemplaza los `WHERE id=$1 AND ngo_id=$2` que hoy están repetidos en varios routers):

```js
// src/lib/ownership.js
async function verifyOwnership(ownerType, ownerId, user) {
  const q = {
    project: ['SELECT 1 FROM projects p JOIN ngos n ON n.id=p.ngo_id WHERE p.id=$1 AND n.user_id=$2'],
    ngo:     ['SELECT 1 FROM ngos WHERE id=$1 AND user_id=$2'],
    empresa: ['SELECT 1 FROM empresas WHERE id=$1 AND user_id=$2'],
  }[ownerType];
  if (ownerType === 'user') return ownerId === user.id;
  if (!q) return false;
  return !!(await db.get(q[0], [ownerId, user.id]));
}
```

**Endpoints** (`src/routes/media.js`, montado en `/api/media`):

```js
const crypto = require('crypto');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');           // única dependencia nueva real
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                    api_key: process.env.CLOUDINARY_API_KEY,
                    api_secret: process.env.CLOUDINARY_API_SECRET });

// memoryStorage OBLIGATORIO: el filesystem de Render es efímero, nunca escribir a disco
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => /^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Solo imágenes')) });

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME) return res.status(503).json({ error: 'Multimedia no configurada' });
  if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });
  const { owner_type, owner_id } = req.body;
  if (!(await verifyOwnership(owner_type, owner_id, req.user)))
    return res.status(403).json({ error: 'No podés subir imágenes a este recurso' });

  const result = await new Promise((resolve, reject) =>
    cloudinary.uploader.upload_stream({ folder: `voluntariar/${owner_type}` },
      (err, r) => err ? reject(err) : resolve(r)).end(req.file.buffer));

  const id = crypto.randomUUID();                             // sin RETURNING: ver "Hechos verificados"
  await db.run(
    `INSERT INTO media (id, owner_type, owner_id, url, provider_id, tipo, ancho, alto, created_by)
     VALUES ($1,$2,$3,$4,$5,'image',$6,$7,$8)`,
    [id, owner_type, owner_id, result.secure_url, result.public_id, result.width, result.height, req.user.id]);
  res.status(201).json(fmtMedia(await db.get('SELECT * FROM media WHERE id=$1', [id])));
});

router.delete('/:id', requireAuth, async (req, res) => {       // solo quien la subió
  const row = await db.get('SELECT * FROM media WHERE id=$1 AND created_by=$2', [req.params.id, req.user.id]);
  if (!row) return res.status(404).json({ error: 'No encontrado' });
  await cloudinary.uploader.destroy(row.provider_id).catch(() => {});   // fire-and-forget, como los emails
  await db.run('DELETE FROM media WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

router.get('/', optionalAuth, async (req, res) => {            // ?owner_type=&owner_id=
  const rows = await db.all('SELECT * FROM media WHERE owner_type=$1 AND owner_id=$2 ORDER BY orden, created_at',
                            [req.query.owner_type, req.query.owner_id]);
  res.json({ media: rows.map(fmtMedia) });                     // fmtMedia: whitelist explícita de columnas (AI_RULES regla 8)
});
```

Notas: (1) `multer` y `uuid` ya están en `package.json` sin usar — `multer` se usa acá; `uuid` sigue sobrando (`crypto.randomUUID()` alcanza). (2) Variables nuevas: `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`; sin ellas el endpoint responde `503` (a diferencia de los emails, un upload no puede "omitirse en silencio"). (3) Rate limiting de este endpoint pasa a ser prioridad real (§3): un upload sin límite agota la cuota gratuita.

### 1.2 Chatbot FAQ — ✅ implementado (el diseño final difiere del original)

Ver `PROJECT_ANALYSIS.md §27` y `API_CONTEXT.md` ("Chatbot FAQ"). **No usar el diseño de la primera versión de este documento**: proponía pre-filtrar con `LIKE` en SQL y después puntuar en JS, y eso resultó ser justamente la fuente de dos bugs de matching. Lo que quedó: se trae todo el pool activo de FAQs (tabla chica por diseño) y se puntúa 100% en JS por substring bidireccional contra keywords con variantes conjugadas explícitas. La decisión de agregar IA (embeddings locales vs. Groq) sigue abierta y sin prioridad.

### 1.3 Gestión de CV *(depende de §1.1; privacidad decidida: restringida)*

`voluntarios.cv_url` **ya existe** (verificado) y ningún endpoint lo usa. Las habilidades (`voluntario_habilidades`) son datos estructurados aparte; el CV es un documento adjunto — no mezclarlos en una tabla, pero sí devolverlos juntos en una "ficha de voluntario".

**Regla de privacidad (decidida, `PROJECT_ANALYSIS.md §30`):** una ONG solo puede ver el CV de un voluntario si existe una inscripción `approved` de ese voluntario en algún proyecto **de esa ONG**. El propio voluntario siempre ve el suyo.

```js
// PATCH /api/voluntarios/me/cv  — multipart, solo PDF, reusa cloudinary/multer de §1.1
const uploadCv = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('Solo PDF')) });

router.patch('/me/cv', requireAuth, requireRole('volunteer'), uploadCv.single('cv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Falta el archivo PDF' });
  const result = await new Promise((resolve, reject) =>
    cloudinary.uploader.upload_stream(
      { folder: 'voluntariar/cv', resource_type: 'raw', type: 'authenticated' },   // ver nota de privacidad
      (e, r) => e ? reject(e) : resolve(r)).end(req.file.buffer));
  await db.run('UPDATE voluntarios SET cv_url=$1, updated_at=CURRENT_TIMESTAMP WHERE user_id=$2',
               [result.public_id, req.user.id]);      // se guarda el public_id, no una URL pública
  res.json({ ok: true });
});

// GET /api/voluntarios/:userId/perfil-completo — ficha con CV + habilidades, sin N+1
router.get('/:userId/perfil-completo', requireAuth, async (req, res) => {
  const target = req.params.userId;
  let canSeeCv = req.user.id === target;
  if (!canSeeCv && req.user.role === 'ngo') {
    const ngo = await db.get('SELECT id FROM ngos WHERE user_id=$1', [req.user.id]);
    canSeeCv = !!(ngo && await db.get(
      `SELECT 1 FROM enrollments e JOIN projects p ON p.id=e.project_id
       WHERE e.user_id=$1 AND p.ngo_id=$2 AND e.status='approved'`, [target, ngo.id]));
  }
  const vol = await db.get(
    `SELECT u.id, u.name, u.avatar, u.bio, u.location, v.descripcion, v.cv_url
     FROM users u JOIN voluntarios v ON v.user_id=u.id WHERE u.id=$1`, [target]);
  if (!vol) return res.status(404).json({ error: 'Voluntario no encontrado' });
  const habilidades = await db.all(
    `SELECT h.nombre, vh.nivel FROM voluntario_habilidades vh
     JOIN habilidades h ON h.id=vh.habilidad_id WHERE vh.user_id=$1`, [target]);
  res.json({ ...vol, cv_url: canSeeCv && vol.cv_url ? signedCvUrl(vol.cv_url) : null, habilidades });
});
```

- **Ojo con la privacidad real, no solo la de la API:** si el CV se sube como asset público, la restricción "solo ONG con inscripción aprobada" protege únicamente que la API no *entregue* la URL — cualquiera que consiga el link igual podría abrirlo. Por eso el diseño sube el PDF como asset `authenticated` y entrega una URL **firmada** (`cloudinary.url(publicId, { resource_type:'raw', type:'authenticated', sign_url:true, secure:true })`, envuelta en `signedCvUrl`). Verificar los detalles de URLs firmadas en la doc de Cloudinary al implementarlo.
- **Gotcha conocido de Cloudinary a chequear:** las cuentas nuevas suelen traer desactivada la entrega de PDF/ZIP (Settings → Security). Si los PDF devuelven 401, es eso.
- **No filtrar el CV por otra vía:** el `GET /api/voluntarios/:userId` público (perfil público de voluntario) **no debe incluir `cv_url`** — verificar al implementar. Tampoco agregarlo a `fmt` de ningún router.
- Para `users.location` vs `voluntarios.ubicacion`: la columna viva es `users.location` (ver §3).
- Nota de rutas: `/:userId/perfil-completo` (dos segmentos) no colisiona con el `GET /:userId` existente.

### 1.4 Sistema de Pagos — Stripe, modo test *(decidido)*

Decisión (`PROJECT_ANALYSIS.md §30`): **Stripe en modo test**, sin intención de producción. Se usa **Stripe Checkout** (redirección a una página alojada por Stripe): el backend nunca toca datos de tarjeta. La verdad sobre si un pago se completó viene **solo del webhook**, nunca de la URL de éxito que visita el navegador.

**Esquema:** la tabla `donaciones` ya existe (ver "Hechos verificados" — ojo con el `DEFAULT 'completada'`). Migración aditiva:

```js
await addColumnIfNotExists('donaciones', 'external_id', 'TEXT');        // id de la Checkout Session
await addColumnIfNotExists('donaciones', 'external_status', 'TEXT');
await addColumnIfNotExists('donaciones', 'moneda', "TEXT DEFAULT 'usd'");
// índice: CREATE INDEX IF NOT EXISTS idx_donaciones_external ON donaciones(external_id)
```

**Endpoints** (`src/routes/donaciones.js`; dependencia nueva: `stripe`; variables: `STRIPE_SECRET_KEY` (`sk_test_…`), `STRIPE_WEBHOOK_SECRET`, `APP_URL`):

```js
const crypto = require('crypto');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

// POST /api/donaciones { project_id, monto } → { donacion_id, checkout_url }
router.post('/', requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Pagos no configurados' });   // un pago no se "omite en silencio"
  const monto = Number(req.body.monto);
  if (!(monto > 0) || monto > 10000) return res.status(400).json({ error: 'Monto inválido' });
  const project = await db.get(`SELECT id, ngo_id, titulo FROM projects WHERE id=$1 AND status='active'`, [req.body.project_id]);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado o inactivo' });

  const id = crypto.randomUUID();
  await db.run(   // 'pendiente' EXPLÍCITO — el DEFAULT de la tabla es 'completada'
    `INSERT INTO donaciones (id, user_id, project_id, ngo_id, monto, estado) VALUES ($1,$2,$3,$4,$5,'pendiente')`,
    [id, req.user.id, project.id, project.ngo_id, monto]);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(monto * 100),
                   product_data: { name: `Donación: ${project.titulo}` } } }],
    client_reference_id: id,
    success_url: `${APP_URL}/donaciones/ok?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${APP_URL}/project/${project.id}`,
  });
  await db.run('UPDATE donaciones SET external_id=$1 WHERE id=$2', [session.id, id]);
  res.status(201).json({ donacion_id: id, checkout_url: session.url });
});

// Webhook: recibe el body CRUDO (Buffer) — ver montaje abajo
async function stripeWebhook(req, res) {
  if (!stripe) return res.sendStatus(503);
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch { return res.status(400).send('Firma inválida'); }

  try {
    const s = event.data.object;
    if (event.type === 'checkout.session.completed' && s.payment_status === 'paid') {
      // Idempotente: solo transiciona desde 'pendiente'. Un evento duplicado da changes=0 y no hace nada.
      const upd = await db.run(
        `UPDATE donaciones SET estado='completada', external_status='paid' WHERE id=$1 AND estado='pendiente'`,
        [s.client_reference_id]);
      if (upd.changes > 0) {
        const d = await db.get('SELECT project_id, monto FROM donaciones WHERE id=$1', [s.client_reference_id]);
        if (d?.project_id) await db.run('UPDATE projects SET recaudado = recaudado + $1 WHERE id=$2', [d.monto, d.project_id]);
      }
    } else if (event.type === 'checkout.session.expired') {
      await db.run(`UPDATE donaciones SET estado='fallida', external_status='expired' WHERE id=$1 AND estado='pendiente'`,
                   [s.client_reference_id]);
    }
  } catch (err) { console.error('Webhook Stripe:', err); return res.sendStatus(500); }  // 5xx → Stripe reintenta
  res.json({ received: true });
}
module.exports = router;
module.exports.stripeWebhook = stripeWebhook;   // mismo patrón de exports que projects.js
```

**Montaje en `index.js` — el orden importa.** Stripe firma el body exacto; si `express.json()` lo parsea antes, la verificación de firma falla siempre. El webhook va **antes** del `app.use(express.json(...))` global:

```js
app.post('/api/donaciones/webhook', express.raw({ type: 'application/json' }), require('./routes/donaciones').stripeWebhook);
app.use(express.json({ limit: '5mb' }));            // recién después
// …y más abajo, como el resto: app.use('/api/donaciones', require('./routes/donaciones'));
```

**Prerrequisito duro: transacciones — ✅ ya satisfecho (`db.transaction()`, §1.5).** El webhook **debe** usarlas. Fíjese por qué: si el primer `UPDATE` (`estado='completada'`) tiene éxito y el proceso cae antes del segundo (`recaudado + monto`), el reintento de Stripe encuentra `estado != 'pendiente'`, hace `changes=0` y **`recaudado` queda para siempre sin sumar esa donación**. La idempotencia por sí sola no cubre esto: hace falta que ambos `UPDATE` sean atómicos. Ambos `UPDATE` van en un mismo `db.transaction()`, y la llamada a Stripe / cualquier email va después del COMMIT. Además, `SUM(monto)` en Postgres llega como string: normalizar con `Number()` (§1.6).

**Otros puntos:**
- **Probar local:** `stripe listen --forward-to localhost:3001/api/donaciones/webhook` (Stripe CLI) imprime el `whsec_…` a poner en `STRIPE_WEBHOOK_SECRET`. Tarjeta de prueba: `4242 4242 4242 4242`, cualquier fecha futura y CVC.
- **Moneda:** Checkout va en USD; `projects.recaudado`/`meta_financiera` (y los datos semilla) están pensados en pesos. Una donación de prueba de "20" suma 20 a un `recaudado` en otra unidad. Para una demo es tolerable, pero conviene no mostrar símbolo de moneda ahí, o aclararlo en la defensa. La columna `moneda` agregada arriba deja el dato explícito por donación.
- **Nunca** marcar una donación como completada por visitar `success_url`; solo por el webhook.
- Rate limiting sobre `POST /api/donaciones` (§3): sin límite, cualquiera puede llenar `donaciones` de filas `pendiente`.
- Tests mínimos antes de darlo por cerrado: webhook duplicado (idempotencia), firma inválida (`400`), sesión expirada, y donación a proyecto inexistente/inactivo.

### 1.5 Optimización de backend (transversal)

| Ítem | Estado |
|---|---|
| `fmt` compartido entre routers (exportado desde `projects.js`) | ✅ Hecho (`PROJECT_ANALYSIS.md §29`) |
| `addColumnIfNotExists` para migraciones aditivas | ✅ Hecho |
| Patrón anti-N+1 con `IN (...)` + `Promise.all` | ✅ Es la convención vigente — mantenerla en todo endpoint de listado nuevo (dashboard de empresa, ficha de voluntario) |
| **`db.transaction()` en el adaptador** | ✅ Hecho (`PROJECT_ANALYSIS.md §34`). Desbloquea Pagos y resolvió la carrera de `cupos_ocupados` en aprobar/rechazar/cancelar inscripciones |
| `verifyOwnership()` reutilizable (§1.1) | ⏳ Pendiente (va con Multimedia) |
| Paginación real en `GET /api/projects` | ⏳ Pendiente — hoy `limit` default 20, tope 500 (§96) y `ExploreScreen` pide `500` y avisa si la respuesta viene llena (§119) |
| Mover helpers de formateo a `src/lib/formatters.js` | ⏳ Pendiente — hoy están exportados desde `projects.js` |
| Rate limiting (auth, uploads, checkout) | ⏳ Pendiente — pasa a prioridad media-alta al sumar Multimedia y Pagos |

Sobre `db.transaction()` (implementado — diseño y reglas en `BACKEND_CONTEXT.md §2`): la sugerencia original de usar `better-sqlite3.transaction(fn)` en SQLite **no servía** (es síncrono; con un callback `async` haría commit antes de terminar), y ese enfoque tampoco contemplaba que SQLite tiene una sola conexión, donde las queries de otras requests caerían dentro de la transacción abierta. La versión implementada usa `BEGIN`/`COMMIT` a mano, hace cola de transacciones y frena las queries ajenas mientras hay una abierta; en Postgres toma un cliente del pool. Ver también que las transacciones de Postgres no se serializan entre sí: hace falta `UPDATE` atómico o compare-and-swap (patrón de `enrollments.js`).

### 1.6 Contrato JSON para el frontend (reglas para endpoints nuevos)

- Arrays ya parseados, nunca JSON-dentro-de-JSON (el patrón híbrido de `roles_json`/`requisitos_json` es deuda existente, no imitarlo).
- Whitelist explícita de columnas (`fmtX`), nunca `SELECT *` devuelto tal cual (`AI_RULES.md` regla 8) — y nada de campos crudos en español mezclados con los traducidos.
- Claves siempre presentes (`cv_url: null` explícito, `matched: boolean` explícito), no omitidas.
- Agregaciones (sumas, promedios, conteos) se calculan en el backend, no se mandan filas crudas para sumar en React.
- **Todo agregado pasa por `Number()`**: en Postgres `SUM`/`COUNT` llegan como string y en SQLite como número, así que sin normalizar el frontend recibe `"3"` en producción y `3` en local. Aplica sobre todo a Pagos (`SUM(monto)`). Ver `AI_RULES.md` regla 13.

---

## 2. Módulos para Empresas

### 2.1 Modelo de datos + JWT — ✅ implementado

Ver `PROJECT_ANALYSIS.md §24-25`. El JWT **no cambió de forma** (ya llevaba `role`); lo que faltaba eran endpoints reales protegidos con `requireRole('company')`, que ahora existen (`routes/empresas.js`). La guarda de rol del frontend sigue siendo solo UX — la defensa real es el backend (`AI_RULES.md` regla 15).

### 2.2 Sistema de Patrocinio — ✅ implementado

Ver `PROJECT_ANALYSIS.md §26` y `API_CONTEXT.md` ("Patrocinio"). Diferencias con el diseño original, para que nadie las "re-implemente": hay **3 estados** (`propuesto`/`aceptado`/`rechazado`, no 4 — `finalizado` no se implementó), y re-proponer sobre una fila `rechazada` la reutiliza (resetea a `propuesto`) por la PK compuesta `(empresa_id, project_id)`. `aporte` sigue siendo un número libre sin verificación; si algún día se vincula con pagos, debería poblarse desde una donación completada, no tipearse a mano.

### 2.3 Dashboard de Empresa + KPIs — ✅ implementado

`GET /api/empresas/me/dashboard` + pantalla `/company/dashboard`. Contrato y semántica en `API_CONTEXT.md` (sección Empresas); historial en `PROJECT_ANALYSIS.md §33`. **El borrador de query/shape que estaba acá se eliminó a propósito**: la versión implementada difiere en cuatro puntos, cada uno verificado contra el código:

1. **Sin `aporte_total`.** `empresa_voluntariados.aporte` no lo escribe ningún endpoint ni pantalla (siempre `0`): el KPI sería un cero permanente. Sumarlo cuando exista una forma real de cargarlo, o cuando Pagos lo derive de una donación completada.
2. **Claves en inglés y respuesta armada a mano**, sin pasar por `fmt()` de `projects.js` (hace `...p`: con filas parciales filtra columnas en español y fabrica ceros engañosos).
3. **`Number()` en todo agregado** (ver §1.6): sin él, el dashboard falla en Postgres y pasa en SQLite.
4. **Horas y voluntarios por proyecto** vía `LEFT JOIN` a una subquery agrupada (sin N+1), además del impacto global con `COUNT(DISTINCT user_id)` (una persona en dos proyectos patrocinados cuenta una vez).

**Pendiente, depende de §2.4:** `impact` mide el impacto *del proyecto patrocinado*, no el de personas de la empresa. Cuando existan empleados, agregar el KPI que sí le importa a RR.HH.: horas de *sus* voluntarios —

```sql
SELECT COALESCE(SUM(e.horas_realizadas),0) AS horas_de_empleados
FROM enrollments e
JOIN empresa_voluntarios ev ON ev.user_id=e.user_id AND ev.empresa_id=$1 AND ev.estado='activo'
WHERE e.status='approved'
```

### 2.4 "Empleados" de empresa — usuario real vinculado *(decidido; queda una sub-decisión)*

Decidido (`PROJECT_ANALYSIS.md §30`): un "empleado" es un usuario `role=volunteer` común vinculado a la empresa — sin inventar un tercer concepto de "empleado" (ya existe `empleados` de ONG).

**Sub-decisión pendiente que el diseño original ignoraba: el consentimiento.** Si la empresa puede "declarar" a cualquier usuario como su empleado sin que el usuario lo sepa, aparecen dos problemas: privacidad (la empresa ve horas/actividad de alguien que no aceptó) y posible suplantación. Recomendación: **flujo de invitación** — la empresa invita, el voluntario acepta.

```js
`CREATE TABLE IF NOT EXISTS empresa_voluntarios (
  empresa_id  TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  cargo       TEXT,
  estado      TEXT NOT NULL DEFAULT 'invitado' CHECK(estado IN ('invitado','activo')),
  created_at  ${NOW},
  PRIMARY KEY (empresa_id, user_id)
)`,
```

| Endpoint | Quién | Qué hace |
|---|---|---|
| `POST /api/empresas/me/voluntarios` `{ email, cargo? }` | company | Busca un usuario `volunteer` por email, crea la fila `invitado`, le manda notificación in-app + email |
| `GET /api/empresas/me/voluntarios` | company | Lista `activo` e `invitado` (join a `users`, sin N+1) |
| `DELETE /api/empresas/me/voluntarios/:userId` | company | Quita la vinculación |
| `PATCH /api/voluntarios/me/empresas/:empresaId` `{ aceptar: true }` | volunteer | Pasa a `activo` |
| `DELETE /api/voluntarios/me/empresas/:empresaId` | volunteer | Rechaza la invitación o abandona la empresa |

Detalles: (a) **no filtrar si un email existe** — el endpoint de invitar responde igual exista o no el usuario ("si existe, se le envió la invitación"), para no convertirlo en un oráculo de emails registrados; (b) solo las filas `activo` cuentan para KPIs y para el chat (§2.5); (c) las rutas `/me/empresas/…` van en `voluntarios.js` **antes** de `/:userId` (regla de orden de rutas de Express, `API_CONTEXT.md`).

### 2.5 Chat Empresa↔ONG/Voluntario *(sin bloqueos; una decisión menor)*

La infraestructura ya es **agnóstica de rol**: `messages(sender_id, receiver_id)` son `user_id` genéricos y `ws/index.js` autentica por JWT sin mirar `role`. No hace falta tocar el esquema ni el servidor WebSocket — solo **autorización de negocio** en el punto donde ya se inserta el mensaje (`insertMessage()` en `routes/messages.js`, compartido por REST y WS, así una sola validación cubre los dos canales).

```js
// Restringe a quién puede iniciarle un mensaje una EMPRESA (evita spam a usuarios sin relación)
async function canMessage(senderRole, senderUserId, receiverId) {
  if (senderRole !== 'company') return true;                 // volunteer/ngo: sin cambios respecto a hoy
  const receiver = await db.get('SELECT role FROM users WHERE id=$1', [receiverId]);
  if (!receiver) return false;
  const empresa = await db.get('SELECT id FROM empresas WHERE user_id=$1', [senderUserId]);
  if (!empresa) return false;

  if (receiver.role === 'ngo')          // una ONG con la que hay propuesta o patrocinio
    return !!(await db.get(
      `SELECT 1 FROM empresa_voluntariados ev
       JOIN projects p ON p.id=ev.project_id JOIN ngos n ON n.id=p.ngo_id
       WHERE n.user_id=$1 AND ev.empresa_id=$2 AND ev.estado IN ('propuesto','aceptado')`,
      [receiverId, empresa.id]));

  if (receiver.role === 'volunteer')    // solo voluntarios propios ACTIVOS (§2.4)
    return !!(await db.get(
      `SELECT 1 FROM empresa_voluntarios WHERE user_id=$1 AND empresa_id=$2 AND estado='activo'`,
      [receiverId, empresa.id]));
  return false;
}
```

**Decisión menor a confirmar:** el diseño original permitía a la empresa escribirle a una ONG *solo con patrocinio aceptado*; acá se relajó a `('propuesto','aceptado')` porque negociar antes de que la ONG acepte es el uso natural (la propuesta ya tiene un campo `mensaje`, pero no reemplaza a una conversación). Si se prefiere lo estricto, dejar solo `'aceptado'`. Nótese también que ONGs y voluntarios pueden escribirle a una empresa libremente (la restricción es solo para *iniciar* desde el lado empresa).

---

## 3. Riesgos y deuda que esto agrava

| Riesgo existente | Cómo lo agrava lo pendiente |
|---|---|
| **`JWT_SECRET` con fallback hardcodeado** (`middleware/auth.js`) | Con Pagos y CV de por medio, un token forjado deja de ser "ver el feed de otro" y pasa a ser iniciar checkouts o pedir fichas con CV a nombre de otro usuario. Exigir la variable de entorno sin fallback **antes** de sumar estos módulos. |
| ~~**Adaptador sin transacciones**~~ | ✅ **Resuelto** (`PROJECT_ANALYSIS.md §34`). Era el prerrequisito técnico más importante de esta lista; Pagos ya puede apoyarse en `db.transaction()`. |
| **`voluntarios.ubicacion` duplicada/no usada** | El endpoint de ficha de voluntario (§1.3) invita a leer la columna equivocada — es el mismo error que ya pasó con las recomendaciones. La columna viva es `users.location`; dejar un comentario en el código nuevo. |
| **Sin rate limiting** | Multimedia (agota la cuota gratuita de Cloudinary) y Pagos (llena `donaciones` de filas `pendiente`) crean dos superficies de abuso nuevas. |
| **`SELECT *` en endpoints públicos** | La ficha de voluntario y cualquier endpoint de media/empresa nuevo deben usar columnas explícitas desde el día uno (`AI_RULES.md` regla 8). |
| **Cobertura de tests** | Para cada módulo nuevo, un test de integración por flujo de plata o de autorización: webhook duplicado, CV pedido por una ONG sin inscripción aprobada (debe dar `cv_url: null`), `canMessage` denegado, invitación de empleado aceptada/rechazada. Son los flujos donde un bug silencioso sale más caro. |
| **Documentación** | Al implementar cada módulo, actualizar `API_CONTEXT.md` y `DATABASE_CONTEXT.md` en el mismo cambio (`AI_RULES.md` regla 9) — y agregar la entrada correspondiente en `PROJECT_ANALYSIS.md`. |

---

## 5. Migraciones aditivas pendientes (en orden)

Lo ya migrado (no repetir): `empresa_categorias`, columnas `estado/mensaje/updated_at` de `empresa_voluntariados`, `faqs`, `volunteer_follows`, columnas `latitud/longitud/modalidad` de `projects`.

```js
// 1. Multimedia (§1.1)
`CREATE TABLE IF NOT EXISTS media (...)`            + índice idx_media_owner
// 2. Empleados de empresa (§2.4)
`CREATE TABLE IF NOT EXISTS empresa_voluntarios (...)`
// 3. Pagos (§1.4) — solo columnas nuevas sobre una tabla existente
await addColumnIfNotExists('donaciones', 'external_id', 'TEXT');
await addColumnIfNotExists('donaciones', 'external_status', 'TEXT');
await addColumnIfNotExists('donaciones', 'moneda', "TEXT DEFAULT 'usd'");
// + índice idx_donaciones_external
```

El Dashboard (§2.3), el CV (§1.3) y el Chat de Empresa (§2.5) **no requieren cambios de esquema**.
