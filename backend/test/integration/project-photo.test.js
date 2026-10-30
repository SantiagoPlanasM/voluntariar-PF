// test/integration/project-photo.test.js — la foto del voluntariado (§282, pedido del usuario: "no sé dónde se le
// pondría foto al voluntariado").
//
// PUT /api/projects/:id/photo (multipart, campo `photo`), solo la ONG dueña. Orden de la regla 24 de AI_RULES: sesión
// y rol → límite → Cloudinary configurado → validar todo (la cabecera real del archivo) → subir fuera de la
// transacción → guardar → si falla, borrar lo subido. Se guarda la versión ancha (feedUrl) en projects.foto_perfil y
// el id de Cloudinary en foto_provider_id (nunca sale en la API); al reemplazarla, la anterior se borra de Cloudinary.
// Cloudinary es un doble: los tests nunca suben nada.
// Seed: proj-1 es de Sustentando (ngo-1, admin@sustentando.org); TechSocial (admin@techsocial.org) es otra ONG.
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const jpg = () => ({ data: Buffer.concat([JPEG_HEAD, Buffer.alloc(200, 1)]), type: 'image/jpeg', name: 'foto.jpg' });
const fakeJpg = () => ({ data: Buffer.from('%PDF-1.4 no soy una foto'), type: 'image/jpeg', name: 'foto.jpg' });

describe('PUT /api/projects/:id/photo: foto del voluntariado', () => {
  let server, baseUrl, db, storage, owner, otherNgo, volunteer;
  let uploaded, deleted, failUpload, configured, n = 0;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    storage = require('../../src/lib/storage');
    mock.method(storage, 'isConfigured', () => configured);
    mock.method(storage, 'uploadImage', async (buf) => {
      if (failUpload) throw new storage.StorageError('Cloudinary respondió 500: boom', { status: 500 });
      n += 1;
      uploaded.push({ bytes: buf.length, publicId: `test/proyecto-${n}` });
      return { url: `https://res.cloudinary.com/demo/image/upload/v1/test/proyecto-${n}.jpg`, publicId: `test/proyecto-${n}`, width: 1200, height: 800, bytes: buf.length };
    });
    mock.method(storage, 'deleteImage', async (publicId) => { deleted.push(publicId); return true; });
    const login = async (email) => {
      const body = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password1' }),
      }).then((r) => r.json());
      return { token: body.token };
    };
    owner = await login('admin@sustentando.org');
    otherNgo = await login('admin@techsocial.org');
    volunteer = await login('maria@example.com');
  });
  after(async () => { mock.restoreAll(); if (server) await server.close(); });
  beforeEach(() => { uploaded = []; deleted = []; failUpload = false; configured = true; });

  const upload = (who, { project = 'proj-1', file = jpg() } = {}) => {
    const form = new FormData();
    if (file) form.append('photo', new Blob([file.data], { type: file.type }), file.name);
    return fetch(`${baseUrl}/api/projects/${project}/photo`, {
      method: 'PUT', headers: who ? { Authorization: `Bearer ${who.token}` } : {}, body: form,
    }).then(async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => ({})) }));
  };
  const row = (id = 'proj-1') => db.get('SELECT foto_perfil, foto_provider_id FROM projects WHERE id=$1', [id]);

  test('la ONG dueña la sube: se guarda la versión ancha y responde el proyecto con image', async () => {
    const r = await upload(owner);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(uploaded.length, 1);
    const url = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_1080,c_limit/v1/test/proyecto-' + n + '.jpg';
    assert.equal(r.body.project.image, url);
    assert.equal(r.body.project.id, 'proj-1');
    assert.equal(r.body.project.foto_provider_id, undefined, 'el id de Cloudinary no sale en la API');
    assert.deepEqual(await row(), { foto_perfil: url, foto_provider_id: `test/proyecto-${n}` });
  });

  test('reemplazarla borra la anterior de Cloudinary (después de guardar la nueva)', async () => {
    const before_ = await row();
    const r = await upload(owner);
    assert.equal(r.status, 200);
    assert.deepEqual(deleted, [before_.foto_provider_id]);
    assert.equal((await row()).foto_provider_id, `test/proyecto-${n}`);
  });

  test('una foto que no se subió acá (URL externa) no se intenta borrar', async () => {
    await db.run('UPDATE projects SET foto_perfil=$1, foto_provider_id=NULL WHERE id=$2', ['https://example.com/x.jpg', 'proj-1']);
    assert.equal((await upload(owner)).status, 200);
    assert.deepEqual(deleted, []);
  });

  test('otra ONG: 404, sin subir nada y sin cambiar el proyecto', async () => {
    const before_ = await row();
    const r = await upload(otherNgo);
    assert.equal(r.status, 404);
    assert.equal(uploaded.length, 0);
    assert.deepEqual(await row(), before_);
  });

  test('un voluntario: 403; sin sesión: 401', async () => {
    assert.equal((await upload(volunteer)).status, 403);
    assert.equal((await upload(null)).status, 401);
    assert.equal(uploaded.length, 0);
  });

  test('voluntariado inexistente: 404', async () => {
    assert.equal((await upload(owner, { project: 'no-existe' })).status, 404);
    assert.equal(uploaded.length, 0);
  });

  test('sin Cloudinary configurado: 503, sin subir', async () => {
    configured = false;
    const r = await upload(owner);
    assert.equal(r.status, 503);
    assert.equal(uploaded.length, 0);
  });

  test('un archivo que dice ser JPEG y no lo es: 400, sin subir', async () => {
    const r = await upload(owner, { file: fakeJpg() });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /no es una imagen válida/);
    assert.equal(uploaded.length, 0);
  });

  test('sin archivo: 400', async () => {
    const r = await upload(owner, { file: null });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'Elegí una foto');
  });

  test('si Cloudinary falla: 502 y el proyecto no cambia', async () => {
    const before_ = await row();
    failUpload = true;
    const r = await upload(owner);
    assert.equal(r.status, 502);
    assert.deepEqual(await row(), before_);
  });

  test('límite: 20 subidas por hora por ONG; la 21.ª es 429 sin subir', async () => {
    // Ya van algunas de los tests anteriores; se sube hasta que aparezca el 429.
    let last;
    for (let i = 0; i < 25; i++) { last = await upload(owner); if (last.status === 429) break; }
    assert.equal(last.status, 429);
    assert.ok(Number(last.headers.get('retry-after')) > 0);
    const count = uploaded.length;
    assert.equal((await upload(owner)).status, 429);
    assert.equal(uploaded.length, count);
  });
});
