// test/integration/projects-search.test.js
//
// Búsqueda y filtro de modalidad de GET /api/projects sin distinguir mayúsculas, en los dos motores.
// En Postgres `LIKE` distingue mayúsculas (en SQLite no, para ASCII): "maratón" no encontraba
// "Maratón Solidaria", y el filtro de modalidad no reconocía "Remoto" en la ubicación (REVISION.md B8).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('GET /api/projects: búsqueda y modalidad sin distinguir mayúsculas', () => {
  let server;
  let baseUrl;
  let db;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
  });

  after(async () => {
    if (server) await server.close();
  });

  const titles = async (query) => {
    const r = await fetch(`${baseUrl}/api/projects?limit=100&${query}`);
    assert.equal(r.status, 200);
    return (await r.json()).projects.map((p) => p.title);
  };

  test('el título se encuentra en minúsculas y en mayúsculas', async () => {
    assert.deepEqual(await titles('search=Maratón'), ['Maratón Solidaria de Donaciones']);
    assert.deepEqual(await titles(`search=${encodeURIComponent('maratón')}`), ['Maratón Solidaria de Donaciones']);
    assert.deepEqual(await titles('search=MARAT'), ['Maratón Solidaria de Donaciones']);
  });

  test('la descripción, el nombre de la ONG y la ubicación también', async () => {
    // descripción de "Digitalización de ONGs": "...incorporar herramientas digitales."
    assert.deepEqual(await titles('search=HERRAMIENTAS%20DIGITALES'), ['Digitalización de ONGs']);
    const porOng = await titles('search=techsocial');
    assert.ok(porOng.length > 0, 'proyectos de TechSocial buscando en minúsculas');
    // ubicación de la Maratón: 'Galpón Central, Córdoba' (no aparece en el título ni en la descripción)
    assert.deepEqual(await titles(`search=${encodeURIComponent('galpón central')}`), ['Maratón Solidaria de Donaciones']);
  });

  test('una ubicación con "Remoto" en mayúscula cuenta como remota en el filtro de modalidad', async () => {
    // El seed ya marca estos proyectos con modalidad 'remoto'; se la cambia para que el filtro dependa
    // solo de la ubicación ("Remoto + visitas en Córdoba", con R mayúscula).
    const titulo = 'Digitalización de ONGs';
    await db.run(`UPDATE projects SET modalidad='presencial' WHERE titulo=$1`, [titulo]);
    try {
      assert.ok((await titles('modality=remoto')).includes(titulo), 'debe aparecer entre los remotos');
      assert.ok(!(await titles('modality=presencial')).includes(titulo), 'no debe aparecer entre los presenciales');
    } finally {
      await db.run(`UPDATE projects SET modalidad='remoto' WHERE titulo=$1`, [titulo]);
    }
  });

  test('una ubicación con "Virtual" en mayúscula también cuenta como remota', async () => {
    const titulo = 'Censo de Árboles Urbanos';
    const { ubicacion, modalidad } = await db.get('SELECT ubicacion, modalidad FROM projects WHERE titulo=$1', [titulo]);
    await db.run(`UPDATE projects SET ubicacion='Virtual (Zoom)', modalidad='presencial' WHERE titulo=$1`, [titulo]);
    try {
      assert.ok((await titles('modality=remoto')).includes(titulo), 'debe aparecer entre los remotos');
      assert.ok(!(await titles('modality=presencial')).includes(titulo), 'no debe aparecer entre los presenciales');
    } finally {
      await db.run('UPDATE projects SET ubicacion=$1, modalidad=$2 WHERE titulo=$3', [ubicacion, modalidad, titulo]);
    }
  });

  // REVISION A7: la rama SQLite del listado no buscaba en el nombre de la categoría (la de Postgres sí).
  // Una categoría que no aparece en ningún título, descripción, ONG ni ubicación: solo se encuentra por categoría.
  test('el nombre de la categoría también se busca (en los dos motores)', async () => {
    const titulo = 'Maratón Solidaria de Donaciones';
    const { id: projectId } = await db.get('SELECT id FROM projects WHERE titulo=$1', [titulo]);
    const { categoria_id: original } = await db.get('SELECT categoria_id FROM project_categorias WHERE project_id=$1', [projectId]);
    await db.run(`INSERT INTO categorias (nombre) VALUES ('Apicultura') ON CONFLICT (nombre) DO NOTHING`);
    const { id: apicultura } = await db.get(`SELECT id FROM categorias WHERE nombre='Apicultura'`);
    await db.run('UPDATE project_categorias SET categoria_id=$1 WHERE project_id=$2', [apicultura, projectId]);
    try {
      assert.deepEqual(await titles('search=apicultura'), [titulo]);
      assert.deepEqual(await titles('search=APICULT'), [titulo]);
    } finally {
      await db.run('UPDATE project_categorias SET categoria_id=$1 WHERE project_id=$2', [original, projectId]);
    }
    assert.deepEqual(await titles('search=apicultura'), [], 'sin la categoría, ya no aparece');
  });
});
