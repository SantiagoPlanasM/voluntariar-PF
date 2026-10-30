// test/integration/project-delete-files.test.js — borrar un voluntariado borra sus archivos de Cloudinary (§289).
//
// Antes, DELETE /api/projects/:id borraba la fila y, en cascada, sus posts (Momentos) y post_media, pero los archivos
// quedaban huérfanos en Cloudinary (pendiente conocido de CLAUDE.md, el usuario autorizó arreglarlo). Ahora, como en
// el borrado de cuenta: se leen los ids de Cloudinary ANTES de borrar (después ya no existen), se borra la fila y,
// después del borrado, se borran la foto del voluntariado y las fotos de sus Momentos. Si Cloudinary falla o no está
// configurado, el voluntariado se borra igual (no se puede deshacer por un archivo). Cloudinary es un doble.
// Seed: Sustentando (ngo-1, admin@sustentando.org); TechSocial (admin@techsocial.org) es otra ONG.
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setupTestServer } = require('./helpers');

describe('DELETE /api/projects/:id: borra los archivos de Cloudinary', () => {
  let server, baseUrl, db, storage, owner, otherNgo, authorId;
  let deleted, failDelete, configured;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    storage = require('../../src/lib/storage');
    mock.method(storage, 'isConfigured', () => configured);
    mock.method(storage, 'deleteImage', async (publicId) => {
      if (failDelete) throw new storage.StorageError('Cloudinary respondió 500: boom', { status: 500 });
      deleted.push(publicId);
      return true;
    });
    const login = async (email) => {
      const body = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password1' }),
      }).then((r) => r.json());
      return { token: body.token, id: body.user.id };
    };
    owner = await login('admin@sustentando.org');
    otherNgo = await login('admin@techsocial.org');
    authorId = (await login('maria@example.com')).id;
  });
  after(async () => { mock.restoreAll(); if (server) await server.close(); });
  beforeEach(() => { deleted = []; failDelete = false; configured = true; });

  // Un voluntariado de Sustentando con foto propia (o no) y dos Momentos: uno con dos fotos y otro con una.
  const project = async ({ photo = true } = {}) => {
    const id = randomUUID();
    await db.run(`INSERT INTO projects (id, ngo_id, titulo, descripcion, ubicacion, cupos, foto_perfil, foto_provider_id)
                  VALUES ($1,'ngo-1','Borrable','d','Córdoba',5,$2,$3)`,
    [id, photo ? 'https://res.cloudinary.com/demo/x.jpg' : null, photo ? `test/proyecto-${id}` : null]);
    const media = [];
    for (const fotos of [2, 1]) {
      const postId = randomUUID();
      await db.run('INSERT INTO posts (id, user_id, project_id, caption) VALUES ($1,$2,$3,$4)', [postId, authorId, id, 'momento']);
      for (let i = 0; i < fotos; i++) {
        const providerId = `test/momento-${postId}-${i}`;
        await db.run('INSERT INTO post_media (id, post_id, url, provider_id, position) VALUES ($1,$2,$3,$4,$5)',
          [randomUUID(), postId, `https://res.cloudinary.com/demo/${providerId}.jpg`, providerId, i]);
        media.push(providerId);
      }
    }
    return { id, photoId: photo ? `test/proyecto-${id}` : null, media };
  };
  const remove = (who, id) => fetch(`${baseUrl}/api/projects/${id}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${who.token}` },
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const exists = async (id) => Boolean(await db.get('SELECT id FROM projects WHERE id=$1', [id]));

  test('la ONG dueña lo borra: se borran la foto del voluntariado y las de sus Momentos', async () => {
    const p = await project();
    const r = await remove(owner, p.id);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(await exists(p.id), false);
    assert.deepEqual([...deleted].sort(), [p.photoId, ...p.media].sort());
    const left = await db.get(`SELECT COUNT(*) AS n FROM post_media WHERE provider_id IN ($1,$2,$3)`, p.media);
    assert.equal(Number(left.n) || 0, 0, 'los Momentos se borraron en cascada');
  });

  test('sin foto propia, solo se borran las de los Momentos', async () => {
    const p = await project({ photo: false });
    assert.equal((await remove(owner, p.id)).status, 200);
    assert.deepEqual([...deleted].sort(), [...p.media].sort());
  });

  test('si Cloudinary falla, el voluntariado se borra igual', async () => {
    failDelete = true;
    const p = await project();
    const errors = mock.method(console, 'error', () => {});
    let r;
    try { r = await remove(owner, p.id); } finally { errors.mock.restore(); }
    assert.equal(r.status, 200);
    assert.equal(await exists(p.id), false);
  });

  test('sin Cloudinary configurado, se borra sin intentar borrar archivos', async () => {
    configured = false;
    const p = await project();
    assert.equal((await remove(owner, p.id)).status, 200);
    assert.equal(await exists(p.id), false);
    assert.deepEqual(deleted, []);
  });

  test('otra ONG no lo borra y no se toca ningún archivo', async () => {
    const p = await project();
    assert.equal((await remove(otherNgo, p.id)).status, 404);
    assert.equal(await exists(p.id), true);
    assert.deepEqual(deleted, []);
  });
});
