// src/lib/storage.js
//
// Almacenamiento de fotos en Cloudinary (https://cloudinary.com) usando su API REST con fetch nativo,
// sin el SDK oficial: mismo criterio que lib/email.js (no sumar una dependencia ni superficie de
// `npm audit` para hacer un POST firmado).
//
// Configuración (variables de entorno, leídas en cada llamada):
//   CLOUDINARY_CLOUD_NAME   — nombre de la nube (aparece en el Dashboard de Cloudinary).
//   CLOUDINARY_API_KEY      — API key.
//   CLOUDINARY_API_SECRET   — API secret. NUNCA se manda en un request ni se loguea; solo firma.
//   CLOUDINARY_FOLDER       — (opcional) carpeta donde se guardan las fotos. Vacío = sin carpeta, que es la
//                             subida mínima documentada y la más robusta frente a los modos de carpetas
//                             de Cloudinary.
//
// Firma: https://cloudinary.com/documentation/authentication_signatures — se ordenan alfabéticamente los
// parámetros que se mandan (excepto file, cloud_name, resource_type y api_key), se unen como k=v con "&",
// se les pega el api_secret SIN separador y se aplica SHA-256 en hexadecimal (era SHA-1 hasta §191; la doc dice
// que Cloudinary acepta los dos). test/unit/storage.test.js verifica cómo se arma el texto firmado contra el
// vector de prueba oficial de esa página (publicado en SHA-1).
//
// Los routes llaman a `storage.uploadImage(...)` / `storage.deleteImage(...)` accediendo a la propiedad
// en cada llamada (no desestructurado): así los tests pueden reemplazarlas sin tocar Cloudinary.

const crypto = require('node:crypto');

const API = 'https://api.cloudinary.com/v1_1';
const TIMEOUT_MS = 20000;
const UNSIGNED_FIELDS = new Set(['file', 'cloud_name', 'resource_type', 'api_key']);

class StorageError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.name = 'StorageError';
    this.status = status;
    this.code = code;
  }
}

function getConfig() {
  const clean = (v) => (v || '').trim();
  return {
    cloudName: clean(process.env.CLOUDINARY_CLOUD_NAME),
    apiKey: clean(process.env.CLOUDINARY_API_KEY),
    apiSecret: clean(process.env.CLOUDINARY_API_SECRET),
    folder: clean(process.env.CLOUDINARY_FOLDER),
  };
}

function isConfigured() {
  const c = getConfig();
  return Boolean(c.cloudName && c.apiKey && c.apiSecret);
}

// Orden por código de carácter (el de Cloudinary): explícito para que nadie lo "arregle" con localeCompare,
// que pone mayúsculas y signos en otro lugar y rompe la firma (SonarCloud S2871 lo sugería; §191).
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Firma de un request a la API de Cloudinary. Ver el encabezado del archivo.
 * SHA-256 por defecto (SonarCloud marcaba SHA-1 como vulnerabilidad, S4790; Cloudinary acepta los dos sin
 * configurar nada, §191). `algorithm` existe para el test del vector oficial, que la doc publica en SHA-1.
 */
function signParams(params, apiSecret, algorithm = 'sha256') {
  const toSign = Object.keys(params)
    .filter((k) => !UNSIGNED_FIELDS.has(k) && params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort(byCodeUnit)
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash(algorithm).update(toSign + apiSecret).digest('hex');
}

/**
 * Tipo REAL de la imagen según su cabecera ('jpeg' | 'png' | 'webp'), o null si no es una de ellas.
 * El `mimetype` que declara el cliente no sirve para decidir: lo escribe quien sube el archivo.
 */
function detectImageType(buf) {
  if (!Buffer.isBuffer(buf)) return null;
  // Cada formato necesita un largo mínimo distinto para poder leer su cabecera (JPEG 3, PNG 8, WebP 12).
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// URL optimizada: se inserta la transformación justo después de /image/upload/. Si la URL no es de
// Cloudinary (o no es un string) se devuelve tal cual.
const MARKER = '/image/upload/';
function transformUrl(url, transformation) {
  if (typeof url !== 'string' || !url.includes('res.cloudinary.com')) return url;
  const i = url.indexOf(MARKER);
  if (i === -1) return url;
  return url.slice(0, i + MARKER.length) + transformation + '/' + url.slice(i + MARKER.length);
}
const feedUrl = (url) => transformUrl(url, 'f_auto,q_auto,w_1080,c_limit');
const thumbUrl = (url) => transformUrl(url, 'f_auto,q_auto,w_480,h_480,c_fill,g_auto');

async function post(path, form, cfg) {
  let res;
  try {
    res = await fetch(`${API}/${cfg.cloudName}${path}`, { method: 'POST', body: form, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new StorageError(`error de red con Cloudinary: ${err.message}`, { code: 'network' });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    if (res.status === 401 || /signature/i.test(msg)) {
      console.error('[storage] Cloudinary rechazó las credenciales o la firma. Revisá CLOUDINARY_CLOUD_NAME, '
        + 'CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET (que sean los del mismo Dashboard, sin espacios ni comillas).');
    }
    throw new StorageError(`Cloudinary respondió ${res.status}: ${msg}`, { status: res.status, code: 'http' });
  }
  return data;
}

/** Sube una imagen. Devuelve { url, publicId, width, height, bytes } o lanza StorageError. */
async function uploadImage(buffer) {
  const cfg = getConfig();
  if (!isConfigured()) throw new StorageError('Cloudinary no está configurado', { code: 'not_configured' });

  const timestamp = Math.floor(Date.now() / 1000);
  const signed = { timestamp, folder: cfg.folder || undefined };
  const type = detectImageType(buffer);

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: type ? `image/${type}` : 'application/octet-stream' }), 'photo');
  form.append('api_key', cfg.apiKey);
  form.append('timestamp', String(timestamp));
  if (cfg.folder) form.append('folder', cfg.folder);
  form.append('signature', signParams(signed, cfg.apiSecret));

  const data = await post('/image/upload', form, cfg);
  if (!data?.secure_url || !data?.public_id) {
    throw new StorageError('Cloudinary devolvió una respuesta inesperada (sin url o public_id)', { code: 'bad_response' });
  }
  return { url: data.secure_url, publicId: data.public_id, width: data.width ?? null, height: data.height ?? null, bytes: data.bytes ?? null };
}

/** Borra una imagen por su public_id. Borrar algo que ya no existe cuenta como éxito. */
async function deleteImage(publicId) {
  const cfg = getConfig();
  if (!isConfigured()) throw new StorageError('Cloudinary no está configurado', { code: 'not_configured' });

  const timestamp = Math.floor(Date.now() / 1000);
  const form = new FormData();
  form.append('public_id', publicId);
  form.append('api_key', cfg.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signParams({ public_id: publicId, timestamp }, cfg.apiSecret));

  const data = await post('/image/destroy', form, cfg);
  if (data?.result === 'ok' || data?.result === 'not found') return true;
  throw new StorageError(`Cloudinary no pudo borrar la imagen (result: ${data?.result})`, { code: 'bad_response' });
}

// ── CV en PDF (PLAN_FALTANTE.md, Etapa 3) ─────────────────────────────────────────────────────────────────
// Recurso `raw` con delivery type `private`: no tiene URL pública. Se entrega con un link de descarga FIRMADO
// que vence. Fuentes (verificadas el 2026-10-16): el Upload API oficial (`POST /raw/upload`, `type` private) y
// el código de `private_download_url` del SDK oficial de Node (cloudinary@2.5.1, lib/utils/index.js): GET a
// `/v1_1/<cloud>/raw/download` con timestamp, public_id, type y expires_at firmados con signParams, más api_key
// y signature. Ver test/unit/storage-pdf.test.js.
const PDF_TYPE = 'private';
const PDF_LINK_TTL_SECONDS = 10 * 60;

/** ¿La cabecera real es de un PDF? ("%PDF-" al principio). El mimetype del cliente no sirve para decidir. */
function detectPdf(buf) {
  return Buffer.isBuffer(buf) && buf.length >= 5 && buf.toString('latin1', 0, 5) === '%PDF-';
}

/** Sube un PDF privado. Devuelve { publicId } (no hay URL pública) o lanza StorageError. */
async function uploadPdf(buffer) {
  const cfg = getConfig();
  if (!isConfigured()) throw new StorageError('Cloudinary no está configurado', { code: 'not_configured' });

  const timestamp = Math.floor(Date.now() / 1000);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), 'cv.pdf');
  form.append('api_key', cfg.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('type', PDF_TYPE);
  if (cfg.folder) form.append('folder', cfg.folder);
  form.append('signature', signParams({ timestamp, type: PDF_TYPE, folder: cfg.folder || undefined }, cfg.apiSecret));

  const data = await post('/raw/upload', form, cfg);
  if (!data?.public_id) {
    throw new StorageError('Cloudinary devolvió una respuesta inesperada (sin public_id)', { code: 'bad_response' });
  }
  return { publicId: data.public_id };
}

/** Link firmado para descargar un PDF privado, que vence en `ttlSeconds`. No llama a la red. */
function pdfDownloadUrl(publicId, { ttlSeconds = PDF_LINK_TTL_SECONDS } = {}) {
  const cfg = getConfig();
  if (!isConfigured()) throw new StorageError('Cloudinary no está configurado', { code: 'not_configured' });

  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = timestamp + ttlSeconds;
  const params = { timestamp, public_id: publicId, type: PDF_TYPE, expires_at: expiresAt };
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    signature: signParams(params, cfg.apiSecret),
    api_key: cfg.apiKey,
  });
  return { url: `${API}/${cfg.cloudName}/raw/download?${query}`, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

/** Borra un PDF privado por su public_id. Borrar algo que ya no existe cuenta como éxito. */
async function deletePdf(publicId) {
  const cfg = getConfig();
  if (!isConfigured()) throw new StorageError('Cloudinary no está configurado', { code: 'not_configured' });

  const timestamp = Math.floor(Date.now() / 1000);
  const form = new FormData();
  form.append('public_id', publicId);
  form.append('type', PDF_TYPE);
  form.append('api_key', cfg.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signParams({ public_id: publicId, timestamp, type: PDF_TYPE }, cfg.apiSecret));

  const data = await post('/raw/destroy', form, cfg);
  if (data?.result === 'ok' || data?.result === 'not found') return true;
  throw new StorageError(`Cloudinary no pudo borrar el PDF (result: ${data?.result})`, { code: 'bad_response' });
}

/** Una línea para el log de arranque. Nunca incluye la key ni el secreto. */
function describeStorageConfig() {
  const { cloudName } = getConfig();
  return isConfigured()
    ? `Cloudinary (${cloudName})`
    : 'sin configurar (faltan variables CLOUDINARY_*): no se pueden subir fotos';
}

module.exports = {
  StorageError, isConfigured, signParams, detectImageType,
  feedUrl, thumbUrl, uploadImage, deleteImage, describeStorageConfig,
  detectPdf, uploadPdf, pdfDownloadUrl, deletePdf,
};
