// test/integration/profile-photo.test.js
//
// Foto de perfil subida como archivo (PLAN_FALTANTE.md, Etapa 1): PUT /api/auth/me/photo, multipart con el campo
// `photo`. Un solo endpoint para los tres roles:
//   - siempre guarda la foto en users.avatar (la foto "viva" de la persona: chat, Momentos, comentarios, reseñas);
//   - si es ONG o empresa, además en ngos.foto_perfil / empresas.foto_perfil (el logo de su perfil).
// voluntarios.foto_perfil NO se toca (decisión F2: users.avatar es la única foto del voluntario).
// Cloudinary se reemplaza por un doble: estos tests no suben nada.
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const jpg = () => ({ data: Buffer.concat([JPEG_HEAD, Buffer.alloc(200, 1)]), type: 'image/jpeg', name: 'yo.jpg' });
// Dice ser JPEG pero la cabecera es de un PDF: la cabecera real manda, no el tipo declarado.
const fakeJpg = () => ({ data: Buffer.from('%PDF-1.4 no soy una foto'), type: 'image/jpeg', name: 'yo.jpg' });

const USER_KEYS = ['avatar', 'bio', 'email', 'id', 'location', 'name', 'role'];

describe('PUT /api/auth/me/photo: foto de perfil', () => {
  let server, baseUrl, db, storage;
  let maria, ngo1, company;
  let uploaded, deleted, failUpload, configured;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    storage = require('../../src/lib/storage');

    let n = 0;
    mock.method(storage, 'isConfigured', () => configured);
    mock.method(storage, 'uploadImage', async (buf) => {
      if (failUpload) throw new storage.StorageError('Cloudinary respondió 500: boom', { status: 500 });
      n += 1;
      uploaded.push({ bytes: buf.length, publicId: `test/avatar-${n}` });
      return { url: `https://res.cloudinary.com/demo/image/upload/v1/test/avatar-${n}.jpg`, publicId: `test/avatar-${n}`, width: 800, height: 800, bytes: buf.length };
    });
    mock.method(storage, 'deleteImage', async (publicId) => { deleted.push(publicId); return true; });
  });

  after(async () => { mock.restoreAll(); if (server) await server.close(); });

  beforeEach(() => { uploaded = []; deleted = []; failUpload = false; configured = true; });

  const login = async (email) => {
    const r = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password1' }),
    });
    const body = await r.json();
    assert.equal(r.status, 200, `login ${email}`);
    return { token: body.token, id: body.user.id };
  };

  const upload = (who, { file = jpg(), field = 'photo' } = {}) => {
    const form = new FormData();
    if (file) form.append(field, new Blob([file.data], { type: file.type }), file.name);
    return fetch(`${baseUrl}/api/auth/me/photo`, {
      method: 'PUT', headers: who ? { Authorization: `Bearer ${who.token}` } : {}, body: form,
    }).then(async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => ({})) }));
  };

  const avatarOf = async (userId) => (await db.get('SELECT avatar FROM users WHERE id=$1', [userId])).avatar;

  before(async () => {
    maria = await login('maria@example.com');
    ngo1 = await login('admin@sustentando.org');
    company = await login('admin@techcorp.com');
  });

  describe('camino feliz', () => {
    test('voluntario: guarda la foto en users.avatar (miniatura cuadrada de Cloudinary) y responde { user }', async () => {
      const volBefore = await db.get('SELECT foto_perfil FROM voluntarios WHERE user_id=$1', [maria.id]);
      const r = await upload(maria);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(Object.keys(r.body).sort(), ['user']);
      assert.deepEqual(Object.keys(r.body.user).sort(), USER_KEYS);
      assert.equal(uploaded.length, 1);
      const expected = storage.thumbUrl(`https://res.cloudinary.com/demo/image/upload/v1/${uploaded[0].publicId}.jpg`);
      assert.equal(r.body.user.avatar, expected);
      assert.match(r.body.user.avatar, /\/image\/upload\/f_auto,q_auto,w_480,h_480,c_fill,g_auto\//);
      assert.equal(await avatarOf(maria.id), r.body.user.avatar);
      // F2: la copia vieja no se toca.
      const volAfter = await db.get('SELECT foto_perfil FROM voluntarios WHERE user_id=$1', [maria.id]);
      assert.equal(volAfter.foto_perfil, volBefore.foto_perfil);
    });

    test('la foto nueva se ve en GET /api/auth/me', async () => {
      const r = await upload(maria);
      assert.equal(r.status, 200);
      const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${maria.token}` } }).then((x) => x.json());
      assert.equal(me.user.avatar, r.body.user.avatar);
    });

    test('ONG: además pasa a ser el logo (ngos.foto_perfil) y se ve en su perfil público', async () => {
      const r = await upload(ngo1);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const url = r.body.user.avatar;
      assert.equal(await avatarOf(ngo1.id), url);
      const ngo = await db.get('SELECT id, foto_perfil FROM ngos WHERE user_id=$1', [ngo1.id]);
      assert.equal(ngo.foto_perfil, url);
      const pub = await fetch(`${baseUrl}/api/ngos/${ngo.id}`).then((x) => x.json());
      assert.equal(pub.ngo.logo, url);
    });

    test('empresa: además pasa a ser el logo (empresas.foto_perfil) y se ve en su perfil público', async () => {
      const r = await upload(company);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const url = r.body.user.avatar;
      const emp = await db.get('SELECT id, foto_perfil FROM empresas WHERE user_id=$1', [company.id]);
      assert.equal(emp.foto_perfil, url);
      const pub = await fetch(`${baseUrl}/api/empresas/${emp.id}`).then((x) => x.json());
      assert.equal(pub.empresa.logo, url);
    });
  });

  describe('rechazos (sin subir nada a Cloudinary y sin cambiar la base)', () => {
    test('sin sesión → 401', async () => {
      const r = await upload(null);
      assert.equal(r.status, 401);
      assert.equal(uploaded.length, 0);
    });

    test('sin archivo → 400', async () => {
      const before = await avatarOf(maria.id);
      const r = await upload(maria, { file: null });
      assert.equal(r.status, 400);
      assert.equal(r.body.error, 'Elegí una foto');
      assert.equal(uploaded.length, 0);
      assert.equal(await avatarOf(maria.id), before);
    });

    test('tipo declarado no permitido (GIF) → 400', async () => {
      const r = await upload(maria, { file: { data: Buffer.from('GIF89a....'), type: 'image/gif', name: 'x.gif' } });
      assert.equal(r.status, 400);
      assert.equal(r.body.error, 'Solo se aceptan fotos JPEG, PNG o WebP');
      assert.equal(uploaded.length, 0);
    });

    test('dice ser JPEG pero la cabecera no es de imagen → 400', async () => {
      const before = await avatarOf(maria.id);
      const r = await upload(maria, { file: fakeJpg() });
      assert.equal(r.status, 400);
      assert.equal(r.body.error, 'El archivo no es una imagen válida (JPEG, PNG o WebP)');
      assert.equal(uploaded.length, 0);
      assert.equal(await avatarOf(maria.id), before);
    });

    test('más de 8 MB → 413', async () => {
      const big = { data: Buffer.concat([JPEG_HEAD, Buffer.alloc(8 * 1024 * 1024 + 10)]), type: 'image/jpeg', name: 'big.jpg' };
      const r = await upload(maria, { file: big });
      assert.equal(r.status, 413);
      assert.equal(r.body.error, 'La foto puede pesar hasta 8 MB');
      assert.equal(uploaded.length, 0);
    });

    // Borde: el tope es 8.000.000 bytes, no 8 MiB (8.388.608), que pasaba el máximo de SonarCloud S5693 (§232).
    test('8.000.001 bytes → 413; 8.000.000 justos se aceptan', async () => {
      const ofSize = (n) => ({ data: Buffer.concat([JPEG_HEAD, Buffer.alloc(n - JPEG_HEAD.length)]), type: 'image/jpeg', name: 'borde.jpg' });
      const over = await upload(maria, { file: ofSize(8_000_001) });
      assert.equal(over.status, 413);
      assert.equal(uploaded.length, 0);
      const exact = await upload(maria, { file: ofSize(8_000_000) });
      assert.equal(exact.status, 200, JSON.stringify(exact.body));
      assert.equal(uploaded.length, 1);
    });

    test('campo con otro nombre → 400 (no 500)', async () => {
      const r = await upload(maria, { field: 'avatar' });
      assert.equal(r.status, 400);
      assert.equal(uploaded.length, 0);
    });

    test('Cloudinary sin configurar → 503', async () => {
      configured = false;
      const r = await upload(maria);
      assert.equal(r.status, 503);
      assert.equal(r.body.error, 'La subida de fotos no está disponible por el momento');
      assert.equal(uploaded.length, 0);
    });

    test('Cloudinary falla → 502 y la foto anterior sigue', async () => {
      const before = await avatarOf(maria.id);
      failUpload = true;
      const r = await upload(maria);
      assert.equal(r.status, 502);
      assert.equal(r.body.error, 'No pudimos subir la foto. Probá de nuevo en un momento.');
      assert.equal(await avatarOf(maria.id), before);
    });

    test('ONG sin fila de perfil → 404, sin subir nada', async () => {
      // Una ONG nueva, sin proyectos: borrar su fila de `ngos` no arrastra nada en cascada.
      const reg = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ong Sin Perfil', email: 'sinperfil@example.org', password: 'Password1', role: 'ngo' }),
      });
      const { token, user } = await reg.json();
      assert.equal(reg.status, 201);
      await db.run('DELETE FROM ngos WHERE user_id=$1', [user.id]);
      const before = await avatarOf(user.id);
      const r = await upload({ token });
      assert.equal(r.status, 404);
      assert.equal(r.body.error, 'Perfil no encontrado');
      assert.equal(uploaded.length, 0);
      assert.equal(await avatarOf(user.id), before);
    });
  });

  describe('falla de la base después de subir', () => {
    test('se borra de Cloudinary lo que se subió y no cambia nada (ni users ni ngos)', async () => {
      const userBefore = await avatarOf(ngo1.id);
      const ngoBefore = (await db.get('SELECT foto_perfil FROM ngos WHERE user_id=$1', [ngo1.id])).foto_perfil;
      // La segunda escritura de la transacción (la del logo) falla: la primera (users) tiene que volver atrás.
      const realTx = db.transaction;
      mock.method(db, 'transaction', (fn) => realTx.call(db, async (tx) => {
        const wrapped = Object.create(tx);
        let calls = 0;
        wrapped.run = async (sql, params) => {
          calls += 1;
          if (calls === 2) throw new Error('falla simulada de la base');
          return tx.run(sql, params);
        };
        return fn(wrapped);
      }));
      try {
        const r = await upload(ngo1);
        assert.equal(r.status, 500);
        assert.equal(r.body.error, 'Error al guardar la foto');
      } finally {
        db.transaction.mock.restore();
      }
      assert.equal(uploaded.length, 1);
      assert.deepEqual(deleted, [uploaded[0].publicId]);
      assert.equal(await avatarOf(ngo1.id), userBefore);
      assert.equal((await db.get('SELECT foto_perfil FROM ngos WHERE user_id=$1', [ngo1.id])).foto_perfil, ngoBefore);
    });
  });

  describe('límite de frecuencia', () => {
    test('pasadas 10 subidas en una hora → 429, sin subir', async () => {
      const lucia = await login('lucia@example.com');
      for (let i = 0; i < 10; i++) assert.equal((await upload(lucia)).status, 200, `subida ${i + 1}`);
      uploaded = [];
      const r = await upload(lucia);
      assert.equal(r.status, 429);
      assert.ok(Number(r.headers.get('retry-after')) > 0);
      assert.equal(r.body.error, 'Cambiaste la foto muchas veces seguidas. Esperá un rato e intentá de nuevo.');
      assert.equal(uploaded.length, 0);
    });
  });
});
