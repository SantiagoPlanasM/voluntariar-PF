// test/integration/posts.test.js
//
// Publicaciones ("Momentos"): fotos de los voluntariados en los que se participó, estilo Instagram
// (PROJECT_ANALYSIS.md §43). El almacenamiento (Cloudinary) se reemplaza por un doble: estos tests NO
// suben nada a ningún lado; verifican las reglas del servidor (quién puede publicar, validaciones,
// atomicidad, limpieza ante fallas, likes, moderación).
//
// Datos del seed usados (calculados a mano de las inscripciones del seed):
//   maria  (vol-1): aprobada en proj-1 y proj-7 · pendiente en proj-9
//   juan   (vol-2): aprobado en proj-3 y proj-8  · pendiente en proj-1
//   lucia  (vol-3): aprobada en proj-4
//   ngo-1 (admin@sustentando.org): dueña de proj-1, proj-5, proj-7
//   ngo-2 (admin@greencba.org) · ngo-3 (admin@bancoalimentos.org) · ngo-4 (admin@techsocial.org, dueña de proj-4)
//   techcorp (admin@techcorp.com): empresa
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const jpg = (n = 1) => ({ data: Buffer.concat([JPEG_HEAD, Buffer.alloc(200, n)]), type: 'image/jpeg', name: `foto-${n}.jpg` });
const png = () => ({ data: Buffer.concat([PNG_HEAD, Buffer.alloc(200, 7)]), type: 'image/png', name: 'foto.png' });

const POST_KEYS = ['author', 'can_delete', 'caption', 'created_at', 'id', 'liked_by_me', 'likes_count', 'photos', 'project'];
const PHOTO_KEYS = ['height', 'id', 'thumb_url', 'url', 'width'];

describe('Publicaciones (Momentos)', () => {
  let server, baseUrl, db, storage;
  let maria, juan, lucia, ngo1, ngo2, ngo4, company;
  let uploaded, deleted, uploadCounter, failUploadAt, failDelete, configured;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    storage = require('../../src/lib/storage');

    uploadCounter = 0;
    mock.method(storage, 'isConfigured', () => configured);
    mock.method(storage, 'uploadImage', async (buf) => {
      const n = ++uploadCounter;
      if (failUploadAt === n) throw new storage.StorageError('Cloudinary respondió 500: boom', { status: 500 });
      uploaded.push({ n, bytes: buf.length, publicId: `test/photo-${n}` });
      return { url: `https://res.cloudinary.com/demo/image/upload/v1/test/photo-${n}.jpg`, publicId: `test/photo-${n}`, width: 1600, height: 1200, bytes: buf.length };
    });
    mock.method(storage, 'deleteImage', async (publicId) => {
      if (failDelete) throw new storage.StorageError('Cloudinary respondió 500: boom', { status: 500 });
      deleted.push(publicId);
      return true;
    });
  });

  after(async () => { mock.restoreAll(); if (server) await server.close(); });

  beforeEach(() => { uploaded = []; deleted = []; failUploadAt = null; failDelete = false; configured = true; });

  // ── helpers ──────────────────────────────────────────────────────────────
  const call = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const login = async (email) => {
    const r = await call('/api/auth/login', { method: 'POST', body: { email, password: 'Password1' } });
    assert.equal(r.status, 200, `login ${email}`);
    return { token: r.body.token, id: r.body.user.id };
  };

  const createPost = (who, { project_id, caption, files = [jpg()] } = {}) => {
    const form = new FormData();
    if (project_id !== undefined) form.append('project_id', project_id);
    if (caption !== undefined) form.append('caption', caption);
    for (const f of files) form.append('photos', new Blob([f.data], { type: f.type }), f.name);
    return fetch(`${baseUrl}/api/posts`, { method: 'POST', headers: who ? { Authorization: `Bearer ${who.token}` } : {}, body: form })
      .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  };

  const list = (query = '', who) => call(`/api/posts${query}`, { token: who?.token });
  const until = async (cond, ms = 3000) => {
    const t0 = Date.now();
    while (!cond()) { if (Date.now() - t0 > ms) assert.fail('timeout'); await new Promise((r) => setTimeout(r, 25)); }
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  test('setup: logins', async () => {
    maria = await login('maria@example.com');
    juan = await login('juan@example.com');
    lucia = await login('lucia@example.com');
    ngo1 = await login('admin@sustentando.org');
    ngo2 = await login('admin@greencba.org');
    ngo4 = await login('admin@techsocial.org');
    company = await login('admin@techcorp.com');
  });

  describe('GET /api/posts/eligible-projects: dónde puede publicar cada uno', () => {
    const ids = async (who) => (await call('/api/posts/eligible-projects', { token: who.token })).body.projects.map((p) => p.id).sort();

    test('un voluntario: solo donde tiene inscripción APROBADA (la pendiente no cuenta)', async () => {
      assert.deepEqual(await ids(maria), ['proj-1', 'proj-7']);   // proj-9 está pendiente
      assert.deepEqual(await ids(juan), ['proj-3', 'proj-8']);    // proj-1 está pendiente
      assert.deepEqual(await ids(lucia), ['proj-4']);
    });

    test('una ONG: sus propios proyectos', async () => {
      assert.deepEqual(await ids(ngo1), ['proj-1', 'proj-5', 'proj-7']);
    });

    test('cada elemento trae id y title', async () => {
      const r = await call('/api/posts/eligible-projects', { token: lucia.token });
      assert.deepEqual(Object.keys(r.body.projects[0]).sort(), ['id', 'title']);
      assert.equal(typeof r.body.projects[0].title, 'string');
    });

    test('una empresa → 403; sin token → 401', async () => {
      assert.equal((await call('/api/posts/eligible-projects', { token: company.token })).status, 403);
      assert.equal((await call('/api/posts/eligible-projects')).status, 401);
    });
  });

  describe('POST /api/posts: crear', () => {
    test('un voluntario participante publica 2 fotos: 201, forma exacta y sin datos internos', async () => {
      const r = await createPost(maria, { project_id: 'proj-1', caption: 'Un día increíble plantando', files: [jpg(1), png()] });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      const p = r.body.post;

      assert.deepEqual(Object.keys(p).sort(), POST_KEYS);
      assert.equal(p.caption, 'Un día increíble plantando');
      assert.equal(p.author.id, maria.id);
      assert.equal(p.author.role, 'volunteer');
      assert.deepEqual(Object.keys(p.author).sort(), ['avatar', 'id', 'name', 'role']);
      assert.equal(p.project.id, 'proj-1');
      assert.equal(typeof p.project.title, 'string');
      assert.equal(p.likes_count, 0);
      assert.equal(p.liked_by_me, false);

      assert.equal(p.photos.length, 2);
      for (const ph of p.photos) {
        assert.deepEqual(Object.keys(ph).sort(), PHOTO_KEYS);
        assert.match(ph.url, /\/image\/upload\/f_auto,q_auto,w_1080,c_limit\//, 'url optimizada para el feed');
        assert.match(ph.thumb_url, /\/image\/upload\/f_auto,q_auto,w_480,h_480,c_fill,g_auto\//, 'miniatura cuadrada');
      }
      assert.equal(uploaded.length, 2);
      // (La URL pública de Cloudinary CONTIENE el public_id por construcción; lo que no se expone es el
      //  campo `provider_id`, y eso lo garantiza la comprobación de claves exactas de arriba.)
    });

    test('quedan guardadas en orden, con su public_id para poder borrarlas después', async () => {
      const r = await createPost(maria, { project_id: 'proj-1', files: [jpg(1), jpg(2), jpg(3)] });
      assert.equal(r.status, 201);
      const rows = await db.all('SELECT provider_id, position FROM post_media WHERE post_id=$1 ORDER BY position', [r.body.post.id]);
      assert.deepEqual(rows.map((x) => Number(x.position)), [0, 1, 2]);
      assert.deepEqual(rows.map((x) => x.provider_id), uploaded.map((u) => u.publicId));
    });

    test('el texto es opcional', async () => {
      const r = await createPost(maria, { project_id: 'proj-7' });
      assert.equal(r.status, 201);
      assert.ok([null, ''].includes(r.body.post.caption));
    });

    test('la ONG dueña del proyecto también puede publicar (con su rol en el autor)', async () => {
      const r = await createPost(ngo1, { project_id: 'proj-1', caption: 'Foto oficial' });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(r.body.post.author.role, 'ngo');
    });

    describe('quién NO puede publicar (y en ningún caso se sube nada a Cloudinary)', () => {
      const denied = async (who, project_id, status, label) => {
        const r = await createPost(who, { project_id });
        assert.equal(r.status, status, `${label}: ${JSON.stringify(r.body)}`);
        assert.equal(uploaded.length, 0, `${label}: no debía subir ninguna foto`);
      };

      test('un voluntario con inscripción PENDIENTE', () => denied(juan, 'proj-1', 403, 'pendiente'));
      test('un voluntario que no participó', () => denied(lucia, 'proj-1', 403, 'sin inscripción'));
      test('una ONG que no es la dueña del proyecto', () => denied(ngo2, 'proj-1', 403, 'ONG ajena'));
      test('una empresa', () => denied(company, 'proj-1', 403, 'empresa'));
      test('sin sesión', async () => {
        const r = await createPost(null, { project_id: 'proj-1' });
        assert.equal(r.status, 401);
        assert.equal(uploaded.length, 0);
      });
      test('un proyecto que no existe', () => denied(maria, 'no-existe', 404, 'proyecto inexistente'));
    });

    describe('validaciones (todo se valida ANTES de subir, para no gastar cuota de Cloudinary)', () => {
      const rejected = async (who, opts, label, expectedStatus = 400) => {
        const r = await createPost(who, opts);
        assert.equal(r.status, expectedStatus, `${label}: ${JSON.stringify(r.body)}`);
        assert.ok(r.body.error, `${label}: debe explicar el motivo`);
        assert.equal(uploaded.length, 0, `${label}: no debía subir nada`);
        return r;
      };

      test('falta project_id', () => rejected(maria, { files: [jpg()] }, 'sin project_id'));
      test('sin fotos', () => rejected(maria, { project_id: 'proj-1', files: [] }, 'sin fotos'));
      test('más de 5 fotos', () => rejected(maria, { project_id: 'proj-1', files: [1, 2, 3, 4, 5, 6].map(jpg) }, '6 fotos'));
      test('texto de más de 500 caracteres', () => rejected(maria, { project_id: 'proj-1', caption: 'a'.repeat(501) }, 'texto largo'));

      test('exactamente 500 caracteres y exactamente 5 fotos son válidos', async () => {
        const r = await createPost(maria, { project_id: 'proj-1', caption: 'a'.repeat(500), files: [1, 2, 3, 4, 5].map(jpg) });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        assert.equal(r.body.post.photos.length, 5);
      });

      test('lenguaje inapropiado en el texto', () => rejected(maria, { project_id: 'proj-1', caption: 'sos un boludo' }, 'mala palabra'));

      test('un archivo que dice ser imagen pero no lo es (HTML con extensión .jpg)', async () => {
        const fake = { data: Buffer.from('<html><script>alert(1)</script></html>'), type: 'image/jpeg', name: 'inocente.jpg' };
        await rejected(maria, { project_id: 'proj-1', files: [fake] }, 'HTML disfrazado');
      });

      test('un tipo no permitido (GIF y PDF) se rechaza por el tipo declarado', async () => {
        await rejected(maria, { project_id: 'proj-1', files: [{ data: Buffer.from('GIF89a......'), type: 'image/gif', name: 'a.gif' }] }, 'gif');
        await rejected(maria, { project_id: 'proj-1', files: [{ data: Buffer.from('%PDF-1.7'), type: 'application/pdf', name: 'a.pdf' }] }, 'pdf');
      });

      test('una sola foto inválida entre varias válidas rechaza TODO el post y no sube ninguna', async () => {
        const bad = { data: Buffer.from('no soy una imagen real'), type: 'image/jpeg', name: 'rota.jpg' };
        await rejected(maria, { project_id: 'proj-1', files: [jpg(1), bad, jpg(3)] }, 'mezcla');
      });

      test('una foto de más de 8 MB → 413', async () => {
        const huge = { data: Buffer.concat([JPEG_HEAD, Buffer.alloc(8 * 1024 * 1024)]), type: 'image/jpeg', name: 'enorme.jpg' };
        await rejected(maria, { project_id: 'proj-1', files: [huge] }, 'más de 8 MB', 413);
      });

      test('si Cloudinary no está configurado → 503 y no se intenta nada', async () => {
        configured = false;
        await rejected(maria, { project_id: 'proj-1' }, 'sin configurar', 503);
      });
    });

    test('FALLA a mitad de la subida: se borran las fotos que sí se subieron y NO queda el post', async () => {
      mock.method(console, 'error', () => {});             // este test provoca el fallo (y el log) a propósito
      const before = (await list('?limit=30')).body.posts.length;
      failUploadAt = uploadCounter + 2;                    // la 2ª foto de este post falla
      const r = await createPost(maria, { project_id: 'proj-1', caption: 'va a fallar', files: [jpg(1), jpg(2), jpg(3)] });
      assert.equal(r.status, 502, JSON.stringify(r.body));
      assert.ok(r.body.error);
      await until(() => deleted.length >= uploaded.length);
      assert.deepEqual(deleted.sort(), uploaded.map((u) => u.publicId).sort(),
        'cada foto que alcanzó a subirse debe borrarse (si no, quedaría huérfana en Cloudinary)');
      assert.equal((await list('?limit=30')).body.posts.length, before, 'no debe quedar el post');
      assert.ok(!JSON.stringify(r.body).includes('boom'), 'el detalle interno de Cloudinary no se le muestra al usuario');
      console.error.mock.restore();
    });
  });

  describe('GET /api/posts: el feed (público)', () => {
    test('sin sesión se puede ver; la forma es exacta y los números son números', async () => {
      const r = await list('?limit=5');
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.body.posts) && r.body.posts.length > 0);
      assert.equal(typeof r.body.has_more, 'boolean');
      for (const p of r.body.posts) {
        assert.deepEqual(Object.keys(p).sort(), POST_KEYS);
        assert.equal(typeof p.likes_count, 'number', 'en Postgres COUNT llega como string: debe normalizarse');
        assert.equal(p.liked_by_me, false);
        for (const ph of p.photos) assert.deepEqual(Object.keys(ph).sort(), PHOTO_KEYS);
      }
    });

    test('lo más nuevo primero', async () => {
      const a = await createPost(maria, { project_id: 'proj-7', caption: 'orden A' });
      await sleep(1100);                                   // SQLite guarda created_at con resolución de 1 s
      const b = await createPost(maria, { project_id: 'proj-7', caption: 'orden B' });
      const ids = (await list('?limit=30')).body.posts.map((p) => p.id);
      assert.ok(ids.indexOf(b.body.post.id) < ids.indexOf(a.body.post.id), 'B (más nuevo) debe ir antes que A');
    });

    test('filtro por proyecto y por autor', async () => {
      const byProject = (await list('?project_id=proj-7&limit=30')).body.posts;
      assert.ok(byProject.length >= 2);
      assert.ok(byProject.every((p) => p.project.id === 'proj-7'));

      const byUser = (await list(`?user_id=${maria.id}&limit=30`)).body.posts;
      assert.ok(byUser.length >= 2);
      assert.ok(byUser.every((p) => p.author.id === maria.id));
      assert.equal((await list('?user_id=no-existe')).body.posts.length, 0);
    });

    test('paginación: limit/offset, has_more, y sin repetir ni salteos entre páginas', async () => {
      const all = (await list('?limit=30')).body.posts.map((p) => p.id);
      assert.ok(all.length >= 5, `se necesitan al menos 5 posts, hay ${all.length}`);

      const p1 = (await list('?limit=2&offset=0')).body;
      const p2 = (await list('?limit=2&offset=2')).body;
      assert.equal(p1.posts.length, 2);
      assert.equal(p1.has_more, true);
      assert.deepEqual([...p1.posts, ...p2.posts].map((p) => p.id), all.slice(0, 4));

      const last = (await list(`?limit=2&offset=${all.length - 1}`)).body;
      assert.equal(last.posts.length, 1);
      assert.equal(last.has_more, false);
    });

    test('limit se acota a 30 y los valores inválidos no rompen nada', async () => {
      assert.ok((await list('?limit=1000')).body.posts.length <= 30);
      for (const q of ['?limit=abc', '?limit=-5', '?offset=-3', '?offset=xyz', '?limit=0']) {
        const r = await list(q);
        assert.equal(r.status, 200, q);
        assert.ok(Array.isArray(r.body.posts), q);
      }
    });

    test('GET /api/posts/:id devuelve el post; uno inexistente da 404', async () => {
      const one = (await list('?limit=1')).body.posts[0];
      const r = await call(`/api/posts/${one.id}`);
      assert.equal(r.status, 200);
      assert.deepEqual(Object.keys(r.body.post).sort(), POST_KEYS);
      assert.equal(r.body.post.id, one.id);
      assert.equal((await call('/api/posts/no-existe')).status, 404);
    });
  });

  describe('can_delete: el servidor dice quién puede borrar (el frontend no lo adivina)', () => {
    // Autor: juan (aprobado en proj-8, cuya ONG dueña es ngo-2). Se usa a juan y no a maria para no gastar
    // el límite de 10 publicaciones por hora que comparten los demás tests de este archivo.
    let postId;
    before(async () => { postId = (await createPost(juan, { project_id: 'proj-8', caption: 'para can_delete' })).body.post.id; });
    const canDelete = async (who) => (await call(`/api/posts/${postId}`, { token: who?.token })).body.post.can_delete;

    test('el autor puede', async () => assert.strictEqual(await canDelete(juan), true));
    test('la ONG dueña del proyecto puede (moderación)', async () => assert.strictEqual(await canDelete(ngo2), true));
    test('otro voluntario, una ONG ajena y una empresa NO pueden', async () => {
      assert.strictEqual(await canDelete(maria), false);
      assert.strictEqual(await canDelete(ngo1), false);
      assert.strictEqual(await canDelete(company), false);
    });
    test('sin sesión no puede (y es un booleano, no undefined)', async () => {
      assert.strictEqual(await canDelete(null), false);
    });

    test('el flag coincide con lo que el DELETE realmente permite', async () => {
      const post = (await createPost(juan, { project_id: 'proj-8' })).body.post;
      const flagFor = async (who) => (await call(`/api/posts/${post.id}`, { token: who.token })).body.post.can_delete;
      const del = (who) => call(`/api/posts/${post.id}`, { token: who.token, method: 'DELETE' });

      for (const who of [maria, ngo1, company]) {
        assert.strictEqual(await flagFor(who), false);
        assert.equal((await del(who)).status, 403, 'si el flag es false, borrar debe dar 403');
      }
      assert.strictEqual(await flagFor(ngo2), true);
      assert.equal((await del(ngo2)).status, 200, 'si el flag es true, borrar debe funcionar');
    });

    test('el listado lo calcula por cada publicación, según quién mira', async () => {
      const posts = (await list('?limit=30', maria)).body.posts;
      assert.ok(posts.length > 0);
      for (const p of posts) {
        assert.strictEqual(p.can_delete, p.author.id === maria.id, `post de ${p.author.name} en ${p.project.id}`);
      }
    });
  });

  describe('Likes', () => {
    let postId;
    before(async () => { postId = (await createPost(maria, { project_id: 'proj-1', caption: 'para likes' })).body.post.id; });

    const like = (who, id = postId) => call(`/api/posts/${id}/like`, { token: who?.token, method: 'POST' });
    const unlike = (who, id = postId) => call(`/api/posts/${id}/like`, { token: who?.token, method: 'DELETE' });

    test('dar like: cuenta 1, y solo quien lo dio lo ve como "liked_by_me"', async () => {
      const r = await like(juan);
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { liked: true, likes_count: 1 });
      assert.equal((await call(`/api/posts/${postId}`, { token: juan.token })).body.post.liked_by_me, true);
      assert.equal((await call(`/api/posts/${postId}`, { token: lucia.token })).body.post.liked_by_me, false);
      assert.equal((await call(`/api/posts/${postId}`)).body.post.liked_by_me, false);
    });

    test('es idempotente: repetir el like no suma', async () => {
      const r = await like(juan);
      assert.deepEqual(r.body, { liked: true, likes_count: 1 });
    });

    test('8 likes simultáneos del MISMO usuario cuentan 1; de 3 usuarios distintos cuentan 3', async () => {
      await Promise.all(Array.from({ length: 8 }, () => like(maria)));
      assert.equal((await call(`/api/posts/${postId}`)).body.post.likes_count, 2, 'juan + maria');

      await Promise.all([lucia, ngo1, company].map((u) => like(u)));
      assert.equal((await call(`/api/posts/${postId}`)).body.post.likes_count, 5, 'cualquier rol autenticado puede dar like');
    });

    test('quitar el like resta; quitarlo de nuevo no deja el contador en negativo', async () => {
      const before = (await call(`/api/posts/${postId}`)).body.post.likes_count;
      assert.deepEqual((await unlike(maria)).body, { liked: false, likes_count: before - 1 });
      assert.deepEqual((await unlike(maria)).body, { liked: false, likes_count: before - 1 });
    });

    test('post inexistente → 404; sin sesión → 401', async () => {
      assert.equal((await like(maria, 'no-existe')).status, 404);
      assert.equal((await unlike(maria, 'no-existe')).status, 404);
      assert.equal((await like(null)).status, 401);
      assert.equal((await unlike(null)).status, 401);
    });
  });

  describe('DELETE /api/posts/:id: borrado y moderación', () => {
    const del = (who, id) => call(`/api/posts/${id}`, { token: who?.token, method: 'DELETE' });
    const mkPost = async (who, project_id, files = [jpg(1), jpg(2)]) => (await createPost(who, { project_id, files })).body.post;

    test('el autor borra el suyo: desaparecen post, fotos y likes, y se borran las fotos de Cloudinary', async () => {
      const post = await mkPost(maria, 'proj-1');
      await call(`/api/posts/${post.id}/like`, { token: juan.token, method: 'POST' });
      const providerIds = (await db.all('SELECT provider_id FROM post_media WHERE post_id=$1', [post.id])).map((r) => r.provider_id);
      assert.equal(providerIds.length, 2);

      const r = await del(maria, post.id);
      assert.equal(r.status, 200, JSON.stringify(r.body));

      assert.equal((await call(`/api/posts/${post.id}`)).status, 404);
      assert.equal((await db.all('SELECT 1 AS x FROM post_media WHERE post_id=$1', [post.id])).length, 0, 'sin fotos huérfanas');
      assert.equal((await db.all('SELECT 1 AS x FROM post_likes WHERE post_id=$1', [post.id])).length, 0, 'sin likes huérfanos');
      await until(() => deleted.length >= 2);
      assert.deepEqual(deleted.sort(), providerIds.sort());
    });

    test('otro voluntario NO puede borrarlo (403) y el post sigue ahí', async () => {
      const post = await mkPost(maria, 'proj-1', [jpg()]);
      assert.equal((await del(juan, post.id)).status, 403);
      assert.equal((await call(`/api/posts/${post.id}`)).status, 200);
      assert.equal(deleted.length, 0);
    });

    test('la ONG dueña del proyecto puede moderar (borrar el de un voluntario); una ONG ajena no', async () => {
      const post = await mkPost(maria, 'proj-1', [jpg()]);
      assert.equal((await del(ngo2, post.id)).status, 403, 'ONG ajena');
      assert.equal((await del(company, post.id)).status, 403, 'empresa');
      assert.equal((await del(ngo1, post.id)).status, 200, 'ONG dueña de proj-1');
      assert.equal((await call(`/api/posts/${post.id}`)).status, 404);
    });

    test('si Cloudinary falla al borrar, el post se borra igual (el archivo es "mejor esfuerzo")', async () => {
      const post = await mkPost(maria, 'proj-1', [jpg()]);
      failDelete = true;
      mock.method(console, 'error', () => {});             // el fallo simulado se loguea a propósito
      assert.equal((await del(maria, post.id)).status, 200);
      assert.equal((await call(`/api/posts/${post.id}`)).status, 404);
      await sleep(100);                                    // el borrado del archivo corre después de responder
      console.error.mock.restore();
    });

    test('inexistente → 404; sin sesión → 401', async () => {
      assert.equal((await del(maria, 'no-existe')).status, 404);
      assert.equal((await del(null, 'cualquiera')).status, 401);
    });
  });

  describe('límite de frecuencia (va al final: consume el cupo de una ONG de prueba)', () => {
    test('después de 10 publicaciones en una hora → 429, sin subir nada', async () => {
      for (let i = 1; i <= 10; i++) {
        const r = await createPost(ngo4, { project_id: 'proj-4', caption: `post ${i}` });
        assert.equal(r.status, 201, `post ${i}: ${JSON.stringify(r.body)}`);
      }
      uploaded = [];
      const r = await createPost(ngo4, { project_id: 'proj-4', caption: 'el 11' });
      assert.equal(r.status, 429, JSON.stringify(r.body));
      assert.match(r.body.error, /demasiad|límite|esper/i);
      assert.equal(uploaded.length, 0, 'no debe subir fotos si ya superó el límite');
    });

    test('el límite es por usuario: otro usuario sigue pudiendo publicar', async () => {
      const r = await createPost(lucia, { project_id: 'proj-4' });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    });
  });
});
