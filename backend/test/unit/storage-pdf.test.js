// test/unit/storage-pdf.test.js
//
// CV en PDF en Cloudinary (PLAN_FALTANTE.md, Etapa 3): se sube como recurso `raw` con delivery type `private`
// (no tiene URL pública) y se entrega con un link de descarga FIRMADO que vence (`expires_at`).
//
// De dónde sale cada cosa (verificado el 2026-10-16):
//   - `POST /:resource_type/upload` con `resource_type` raw y `type` private: documentación oficial del Upload API
//     (https://cloudinary.com/documentation/image_upload_api_reference_upload), que para private/authenticated
//     remite a private_download_url.
//   - El link de descarga: código fuente del SDK oficial de Node (cloudinary@2.5.1, lib/utils/index.js,
//     `private_download_url`): GET `https://api.cloudinary.com/v1_1/<cloud>/<resource_type>/download` con
//     `timestamp`, `public_id`, `format`, `type`, `attachment` y `expires_at` firmados (sin vacíos) y después
//     `api_key` y `signature`. La firma es la misma de signParams (anclada al vector oficial en storage.test.js).
// `fetch` se reemplaza por un doble: NO se habla con Cloudinary de verdad.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const ENV_KEYS = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_FOLDER'];
const freshStorage = () => {
  delete require.cache[require.resolve('../../src/lib/storage')];
  return require('../../src/lib/storage');
};
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n');
const T = 1315060510;   // Date.now() fijo (segundos)

describe('detectPdf() — cabecera real, no el tipo que declara el cliente', () => {
  const { detectPdf } = freshStorage();
  test('un PDF empieza con "%PDF-"', () => assert.equal(detectPdf(PDF), true));
  test('lo demás no es PDF (y nunca lanza)', () => {
    assert.equal(detectPdf(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), false);   // JPEG
    assert.equal(detectPdf(Buffer.from('PDF-1.7 sin el %')), false);
    assert.equal(detectPdf(Buffer.from('  %PDF-1.7')), false);                // tiene que estar al principio
    assert.equal(detectPdf(Buffer.from('%PDF')), false);                      // cabecera incompleta
    assert.equal(detectPdf(Buffer.from('%PDFX1.7')), false);                  // sin el guion
    assert.equal(detectPdf('%PDF-'), false);                                  // la cabecera exacta, pero como string
    assert.equal(detectPdf(Buffer.alloc(0)), false);
    assert.equal(detectPdf('%PDF-1.7'), false);                               // un string no es un Buffer
    assert.equal(detectPdf(undefined), false);
  });
});

describe('uploadPdf() / pdfDownloadUrl() / deletePdf()', () => {
  let saved, calls, fetchImpl;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.CLOUDINARY_CLOUD_NAME = 'mi-nube';
    process.env.CLOUDINARY_API_KEY = '123456';
    process.env.CLOUDINARY_API_SECRET = 'abcd';
    calls = [];
    fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({}) });
    mock.method(globalThis, 'fetch', async (url, opts) => { calls.push({ url, opts }); return fetchImpl(); });
    mock.method(Date, 'now', () => T * 1000);
    mock.method(console, 'error', () => {});
  });
  afterEach(() => {
    mock.restoreAll();
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });

  describe('uploadPdf()', () => {
    test('POST firmado a /raw/upload con type=private; devuelve solo el public_id', async () => {
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ public_id: 'cv_abc.pdf', resource_type: 'raw', type: 'private', bytes: 40 }) });
      const out = await freshStorage().uploadPdf(PDF);
      assert.deepEqual(out, { publicId: 'cv_abc.pdf' });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, 'https://api.cloudinary.com/v1_1/mi-nube/raw/upload');
      assert.equal(calls[0].opts.method, 'POST');
      const form = calls[0].opts.body;
      assert.equal(form.get('type'), 'private');
      assert.equal(form.get('timestamp'), String(T));
      assert.equal(form.get('api_key'), '123456');
      assert.equal(form.get('signature'), sha1(`timestamp=${T}&type=privateabcd`));
      assert.equal(form.get('api_secret'), null, 'el secreto no viaja');
      const file = form.get('file');
      assert.equal(file.size, PDF.length);
      assert.equal(file.type, 'application/pdf');
      assert.equal(file.name, 'cv.pdf');
    });

    test('con CLOUDINARY_FOLDER, la carpeta se manda y se firma', async () => {
      process.env.CLOUDINARY_FOLDER = 'voluntariar';
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ public_id: 'voluntariar/cv.pdf' }) });
      await freshStorage().uploadPdf(PDF);
      const form = calls[0].opts.body;
      assert.equal(form.get('folder'), 'voluntariar');
      assert.equal(form.get('signature'), sha1(`folder=voluntariar&timestamp=${T}&type=privateabcd`));
    });

    test('respuesta sin public_id → StorageError (no se guarda un CV roto)', async () => {
      const { uploadPdf, StorageError } = freshStorage();
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ resource_type: 'raw' }) });
      await assert.rejects(uploadPdf(PDF), StorageError);
    });

    test('error HTTP → StorageError con el estado', async () => {
      const { uploadPdf, StorageError } = freshStorage();
      fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'Invalid file' } }) });
      await assert.rejects(uploadPdf(PDF), (e) => e instanceof StorageError && e.status === 400 && /Invalid file/.test(e.message));
    });

    test('sin credenciales no intenta nada', async () => {
      delete process.env.CLOUDINARY_API_SECRET;
      const { uploadPdf, StorageError } = freshStorage();
      await assert.rejects(uploadPdf(PDF), (e) => e instanceof StorageError && e.code === 'not_configured');
      assert.equal(calls.length, 0);
    });
  });

  describe('pdfDownloadUrl()', () => {
    test('link GET firmado a /raw/download que vence en `ttlSeconds` (sin pedir nada a la red)', () => {
      const { url, expiresAt } = freshStorage().pdfDownloadUrl('cv_abc.pdf', { ttlSeconds: 600 });
      assert.equal(calls.length, 0, 'armar el link no llama a Cloudinary');
      const u = new URL(url);
      assert.equal(u.origin + u.pathname, 'https://api.cloudinary.com/v1_1/mi-nube/raw/download');
      const p = Object.fromEntries(u.searchParams);
      assert.deepEqual(Object.keys(p).sort(), ['api_key', 'expires_at', 'public_id', 'signature', 'timestamp', 'type']);
      assert.equal(p.public_id, 'cv_abc.pdf');
      assert.equal(p.type, 'private');
      assert.equal(p.timestamp, String(T));
      assert.equal(p.expires_at, String(T + 600));
      assert.equal(p.api_key, '123456');
      assert.equal(p.signature, sha1(`expires_at=${T + 600}&public_id=cv_abc.pdf&timestamp=${T}&type=privateabcd`));
      assert.ok(!url.includes('abcd'), 'el secreto no aparece en el link');
      assert.equal(expiresAt, new Date((T + 600) * 1000).toISOString());
    });

    test('por defecto vence a los 10 minutos', () => {
      const { url } = freshStorage().pdfDownloadUrl('x.pdf');
      assert.equal(new URL(url).searchParams.get('expires_at'), String(T + 600));
    });

    test('un public_id con carpeta y caracteres especiales va codificado en el link (y firmado sin codificar)', () => {
      const { url } = freshStorage().pdfDownloadUrl('voluntariar/cv de maría.pdf');
      const u = new URL(url);
      assert.equal(u.searchParams.get('public_id'), 'voluntariar/cv de maría.pdf');
      assert.ok(!url.includes(' '));
      assert.equal(u.searchParams.get('signature'),
        sha1(`expires_at=${T + 600}&public_id=voluntariar/cv de maría.pdf&timestamp=${T}&type=privateabcd`));
    });

    test('sin credenciales lanza (no arma un link inválido)', () => {
      delete process.env.CLOUDINARY_CLOUD_NAME;
      const { pdfDownloadUrl, StorageError } = freshStorage();
      assert.throws(() => pdfDownloadUrl('x.pdf'), (e) => e instanceof StorageError && e.code === 'not_configured');
    });
  });

  describe('deletePdf()', () => {
    test('POST firmado a /raw/destroy con type=private', async () => {
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ result: 'ok' }) });
      assert.equal(await freshStorage().deletePdf('cv_abc.pdf'), true);
      assert.equal(calls[0].url, 'https://api.cloudinary.com/v1_1/mi-nube/raw/destroy');
      const form = calls[0].opts.body;
      assert.equal(form.get('public_id'), 'cv_abc.pdf');
      assert.equal(form.get('type'), 'private');
      assert.equal(form.get('api_key'), '123456');
      assert.equal(form.get('signature'), sha1(`public_id=cv_abc.pdf&timestamp=${T}&type=privateabcd`));
    });

    test('borrar algo que ya no existe es éxito (idempotente)', async () => {
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ result: 'not found' }) });
      assert.equal(await freshStorage().deletePdf('cv_abc.pdf'), true);
    });

    test('otro resultado o error HTTP lanza', async () => {
      const { deletePdf, StorageError } = freshStorage();
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ result: 'error' }) });
      await assert.rejects(deletePdf('x.pdf'), StorageError);
      fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
      await assert.rejects(deletePdf('x.pdf'), StorageError);
    });
  });
});
