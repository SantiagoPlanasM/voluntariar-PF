// test/unit/storage.test.js
//
// lib/storage.js: subida de fotos a Cloudinary por su API REST (sin el SDK), firma, detección del tipo
// real de imagen y URLs optimizadas (PROJECT_ANALYSIS.md §43).
//
// IMPORTANTE sobre qué se verifica y qué no: `fetch` se reemplaza por un doble, así que NO se habla con
// Cloudinary de verdad. Lo que sí queda anclado a la fuente oficial es el algoritmo de firma, contra el
// vector de prueba publicado en https://cloudinary.com/documentation/authentication_signatures.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const ENV_KEYS = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_FOLDER'];

const freshStorage = () => {
  delete require.cache[require.resolve('../../src/lib/storage')];
  return require('../../src/lib/storage');
};

// Cabeceras reales mínimas de cada formato.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const PNG  = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

describe('signParams() — algoritmo de firma', () => {
  const { signParams } = freshStorage();

  test('coincide con el vector de prueba OFICIAL de Cloudinary', () => {
    // Del curl de su documentación: api_secret "abcd", timestamp 1315060510, y estos campos.
    const sig = signParams({
      eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
      public_id: 'sample_image',
      timestamp: 1315060510,
      // Estos cuatro se mandan en el POST pero NO se firman:
      file: 'https://www.example.com/sample.jpg', api_key: '1234', resource_type: 'image', cloud_name: 'demo',
    }, 'abcd');
    assert.equal(sig, 'bfd09f95f331f558cbd1320e67aa8d488770583e');
  });

  test('el orden en que se pasan los parámetros no cambia la firma (se ordenan alfabéticamente)', () => {
    const a = signParams({ timestamp: 1, public_id: 'x', folder: 'f' }, 's');
    const b = signParams({ folder: 'f', timestamp: 1, public_id: 'x' }, 's');
    assert.equal(a, b);
  });

  test('ordena por código de carácter, como Cloudinary, NO por idioma (localeCompare cambiaría la firma)', () => {
    // Arrange: claves donde los dos órdenes difieren (mayúscula y "_" contra letras). SonarCloud (S2871) sugería
    // localeCompare: con él, "Z_key" iría última y la firma no coincidiría con la de Cloudinary (§191).
    const params = { ab: 3, timestamp: 4, Z_key: 1, a_b: 2 };
    // Act
    const sig = signParams(params, 's');
    // Assert
    assert.equal(sig, crypto.createHash('sha1').update('Z_key=1&a_b=2&ab=3&timestamp=4' + 's').digest('hex'));
  });

  test('los valores vacíos, null y undefined no se firman (porque tampoco se mandan)', () => {
    const base = signParams({ timestamp: 1 }, 's');
    assert.equal(signParams({ timestamp: 1, folder: '', tags: null, context: undefined }, 's'), base);
  });

  test('es SHA-1 hexadecimal de "k=v&k=v" + secreto, sin separador', () => {
    const expected = crypto.createHash('sha1').update('folder=a&timestamp=2' + 'secreto').digest('hex');
    assert.equal(signParams({ timestamp: 2, folder: 'a' }, 'secreto'), expected);
  });
});

describe('detectImageType() — tipo REAL por la cabecera, no por lo que declara el cliente', () => {
  const { detectImageType } = freshStorage();

  test('reconoce JPEG, PNG y WebP', () => {
    assert.equal(detectImageType(JPEG), 'jpeg');
    assert.equal(detectImageType(PNG), 'png');
    assert.equal(detectImageType(WEBP), 'webp');
  });

  test('rechaza lo que no es una imagen soportada', () => {
    const notImages = {
      'texto': Buffer.from('hola, esto no es una imagen'),
      'GIF': Buffer.from('GIF89a......'),
      'PDF': Buffer.from('%PDF-1.7 ...'),
      'ejecutable de Windows': Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]),
      'HTML': Buffer.from('<html><script>alert(1)</script>'),
      'RIFF que no es WebP (un WAV)': Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 0, 0, 0]), Buffer.from('WAVEfmt ')]),
    };
    for (const [name, buf] of Object.entries(notImages)) assert.equal(detectImageType(buf), null, name);
  });

  test('buffers vacíos, muy cortos o inválidos devuelven null (nunca lanzan)', () => {
    for (const bad of [Buffer.alloc(0), Buffer.from([0xff]), Buffer.from([0xff, 0xd8]), null, undefined, 'texto']) {
      assert.equal(detectImageType(bad), null, String(bad));
    }
  });
});

describe('URLs optimizadas', () => {
  const { feedUrl, thumbUrl } = freshStorage();
  const base = 'https://res.cloudinary.com/mi-nube/image/upload/v1700000000/voluntariar/abc123.jpg';

  test('insertan la transformación justo después de /image/upload/', () => {
    assert.equal(feedUrl(base),
      'https://res.cloudinary.com/mi-nube/image/upload/f_auto,q_auto,w_1080,c_limit/v1700000000/voluntariar/abc123.jpg');
    assert.equal(thumbUrl(base),
      'https://res.cloudinary.com/mi-nube/image/upload/f_auto,q_auto,w_480,h_480,c_fill,g_auto/v1700000000/voluntariar/abc123.jpg');
  });

  test('una URL que no es de Cloudinary (o un valor inválido) se devuelve sin tocar', () => {
    assert.equal(feedUrl('https://ejemplo.com/foto.jpg'), 'https://ejemplo.com/foto.jpg');
    assert.equal(thumbUrl('https://ejemplo.com/image/upload/foto.jpg'), 'https://ejemplo.com/image/upload/foto.jpg');
    assert.equal(feedUrl(null), null);
    assert.equal(feedUrl(undefined), undefined);
  });
});

describe('uploadImage() / deleteImage() / configuración', () => {
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
    mock.method(Date, 'now', () => 1315060510000);          // timestamp fijo = 1315060510
    mock.method(console, 'error', () => {});
  });

  afterEach(() => {
    mock.restoreAll();
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });

  describe('isConfigured()', () => {
    test('true con las tres variables', () => assert.equal(freshStorage().isConfigured(), true));
    test('false si falta cualquiera de las tres, o si es solo espacios', () => {
      for (const k of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
        const prev = process.env[k];
        delete process.env[k];
        assert.equal(freshStorage().isConfigured(), false, `sin ${k}`);
        process.env[k] = '   ';
        assert.equal(freshStorage().isConfigured(), false, `${k} en blanco`);
        process.env[k] = prev;
      }
    });
  });

  describe('uploadImage()', () => {
    const okResponse = {
      secure_url: 'https://res.cloudinary.com/mi-nube/image/upload/v1/abc.jpg',
      public_id: 'abc', width: 1600, height: 1200, bytes: 12345,
    };

    test('arma el POST firmado a la API de Cloudinary y devuelve los datos de la foto', async () => {
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => okResponse });
      const out = await freshStorage().uploadImage(JPEG, {});

      assert.deepEqual(out, { url: okResponse.secure_url, publicId: 'abc', width: 1600, height: 1200, bytes: 12345 });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, 'https://api.cloudinary.com/v1_1/mi-nube/image/upload');
      assert.equal(calls[0].opts.method, 'POST');

      const form = calls[0].opts.body;
      assert.ok(form instanceof FormData);
      assert.equal(form.get('api_key'), '123456');
      assert.equal(form.get('timestamp'), '1315060510');
      // Subida mínima documentada: solo `timestamp` se firma. El secreto NUNCA viaja.
      assert.equal(form.get('signature'), crypto.createHash('sha1').update('timestamp=1315060510abcd').digest('hex'));
      assert.equal(form.get('api_secret'), null, 'el secreto no debe mandarse');
      const file = form.get('file');
      assert.equal(file.size, JPEG.length, 'se sube el contenido del buffer');
    });

    test('con CLOUDINARY_FOLDER, la carpeta se manda Y se firma', async () => {
      process.env.CLOUDINARY_FOLDER = 'voluntariar/posts';
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => okResponse });
      await freshStorage().uploadImage(PNG, {});
      const form = calls[0].opts.body;
      assert.equal(form.get('folder'), 'voluntariar/posts');
      assert.equal(form.get('signature'),
        crypto.createHash('sha1').update('folder=voluntariar/posts&timestamp=1315060510abcd').digest('hex'));
    });

    test('un error de Cloudinary lanza StorageError con el estado y el mensaje, SIN filtrar el secreto', async () => {
      fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'Invalid Signature abc. String to sign - timestamp=1.' } }) });
      const { uploadImage, StorageError } = freshStorage();
      await assert.rejects(uploadImage(JPEG, {}), (err) => {
        assert.ok(err instanceof StorageError);
        assert.equal(err.status, 401);
        assert.match(err.message, /Invalid Signature/);
        assert.ok(!err.message.includes('abcd'), 'el secreto no debe aparecer en el error');
        return true;
      });
      assert.ok(console.error.mock.calls.some((c) => /CLOUDINARY_API_SECRET/.test(c.arguments.join(' '))),
        'ante un 401 el log debe orientar sobre qué revisar');
    });

    test('una respuesta que no es JSON también falla de forma controlada', async () => {
      fetchImpl = async () => ({ ok: false, status: 502, json: async () => { throw new Error('no json'); } });
      const { uploadImage, StorageError } = freshStorage();
      await assert.rejects(uploadImage(JPEG, {}), (err) => err instanceof StorageError && err.status === 502);
    });

    test('un error de red se convierte en StorageError', async () => {
      fetchImpl = async () => { throw new Error('ECONNRESET'); };
      const { uploadImage, StorageError } = freshStorage();
      await assert.rejects(uploadImage(JPEG, {}), (err) => err instanceof StorageError && /ECONNRESET/.test(err.message));
    });

    test('si faltan credenciales no intenta nada', async () => {
      delete process.env.CLOUDINARY_API_SECRET;
      const { uploadImage, StorageError } = freshStorage();
      await assert.rejects(uploadImage(JPEG, {}), (err) => err instanceof StorageError && err.code === 'not_configured');
      assert.equal(calls.length, 0);
    });

    test('una respuesta "ok" sin URL o sin public_id se trata como error (no se guarda una foto rota)', async () => {
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ width: 10 }) });
      await assert.rejects(freshStorage().uploadImage(JPEG, {}), /respuesta inesperada/i);
    });
  });

  describe('deleteImage()', () => {
    test('arma el POST firmado a /image/destroy', async () => {
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ result: 'ok' }) });
      assert.equal(await freshStorage().deleteImage('abc'), true);
      assert.equal(calls[0].url, 'https://api.cloudinary.com/v1_1/mi-nube/image/destroy');
      const form = calls[0].opts.body;
      assert.equal(form.get('public_id'), 'abc');
      assert.equal(form.get('api_key'), '123456');
      assert.equal(form.get('signature'),
        crypto.createHash('sha1').update('public_id=abc&timestamp=1315060510abcd').digest('hex'));
    });

    test('borrar algo que ya no existe es éxito (idempotente)', async () => {
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ result: 'not found' }) });
      assert.equal(await freshStorage().deleteImage('abc'), true);
    });

    test('cualquier otro resultado o error HTTP lanza', async () => {
      const { deleteImage, StorageError } = freshStorage();
      fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ result: 'error' }) });
      await assert.rejects(deleteImage('abc'), StorageError);
      fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
      await assert.rejects(deleteImage('abc'), StorageError);
    });
  });

  describe('describeStorageConfig() (línea del log de arranque)', () => {
    test('sin configurar: dice cómo se afecta', () => {
      delete process.env.CLOUDINARY_API_KEY;
      assert.match(freshStorage().describeStorageConfig(), /sin configurar.*no se pueden subir fotos/i);
    });

    test('configurado: muestra la nube, NUNCA la key ni el secreto', () => {
      process.env.CLOUDINARY_API_KEY = 'KEY_RECONOCIBLE_9876';
      process.env.CLOUDINARY_API_SECRET = 'SECRETO_RECONOCIBLE_5432';
      const d = freshStorage().describeStorageConfig();
      assert.match(d, /mi-nube/);
      assert.ok(!d.includes('KEY_RECONOCIBLE') && !d.includes('SECRETO_RECONOCIBLE'));
    });
  });
});
