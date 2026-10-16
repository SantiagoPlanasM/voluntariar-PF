// test/integration/projects-strict-inputs.test.js
//
// Pendientes que dejó §137 (decisión del usuario, B3), en el alta (POST) y en la edición (PUT) de proyectos:
//   - cupos y horas con `parseInt` laxo: `3.7` → 3, `"5 personas"` → 5, `[5]` → 5, `"1e21"` → 1. Ahora enteros
//     estrictos (número entero o texto de dígitos, como las reseñas, §74) → si no, 400;
//   - latitud/longitud: `"abc"` quedaba null sin aviso y `500` se guardaba. Ahora número finito en rango → si no, 400;
//   - sin largo máximo en título, descripción, ubicación, duración, imagen y descripción completa;
//   - el PUT no validaba `modality` (un objeto daba 500 en SQLite).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Proyectos: enteros, coordenadas, largos y modalidad estrictos (alta y edición)', () => {
  let server, db, ngo, projectId;

  const call = (path, { method = 'GET', body } = {}) => fetch(`${server.baseUrl}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ngo}` },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  let n = 0;
  const projectBody = (over = {}) => ({
    title: `Estricto ${++n}`, description: 'Descripción suficientemente larga para validar',
    location: 'Córdoba', type: 'fugaz', duration: '1 día', volunteers_needed: 3, ...over,
  });
  const create = (over) => call('/api/projects', { method: 'POST', body: projectBody(over) });
  const put = (body) => call(`/api/projects/${projectId}`, { method: 'PUT', body });
  const total = async () => Number((await db.get('SELECT COUNT(*) AS n FROM projects')).n);
  const row = () => db.get(`SELECT titulo, descripcion, descripcion_full, foto_perfil, ubicacion, tipo, duracion, cupos,
    horas_semanales, latitud, longitud, modalidad FROM projects WHERE id=$1`, [projectId]);

  // Alta rechazada: 400 con el mensaje esperado y sin crear nada.
  const createRejected = async (over, re, why) => {
    const antes = await total();
    const r = await create(over);
    assert.equal(r.status, 400, `${why}: status (${JSON.stringify(r.body)})`);
    assert.match(r.body.error, re, `${why}: mensaje`);
    assert.equal(await total(), antes, `${why}: no se creó ningún proyecto`);
  };
  // Edición rechazada: 400 con el mensaje esperado y la fila tal cual estaba.
  const putRejected = async (body, re, why) => {
    const antes = await row();
    const r = await put(body);
    assert.equal(r.status, 400, `${why}: status (${JSON.stringify(r.body)})`);
    assert.match(r.body.error, re, `${why}: mensaje`);
    assert.deepEqual(await row(), antes, `${why}: no cambió nada`);
  };

  const CUPOS_INT = /^Los cupos tienen que ser un número entero$/;
  const HORAS_INT = /^Las horas semanales tienen que ser un número entero$/;
  const LAT = /^La latitud tiene que ser un número entre -90 y 90$/;
  const LNG = /^La longitud tiene que ser un número entre -180 y 180$/;
  const MOD = /^Modalidad inválida: tiene que ser presencial, remoto o hibrido$/;

  const NOT_INT = [3.7, '3.7', '5 personas', [5], '1e21', true, {}, ' 5', '0x10'];
  const BAD_COORDS = ['abc', {}, [], true, '1e400', 'Infinity', '-Infinity', '   '];
  // [campo, etiqueta, máximo]
  const LIMITS = [
    ['title', 'El título', 80], ['description', 'La descripción', 1000], ['full_description', 'La descripción completa', 5000],
    ['location', 'La ubicación', 150], ['duration', 'La duración', 100], ['image', 'La imagen', 1000],
  ];

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
    const l = await fetch(`${server.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sustentando.org', password: 'Password1' }) });
    ngo = (await l.json()).token;
    const c = await create({ title: 'Proyecto a editar', type: 'sostenido', hours_per_week: 4, duration: undefined,
      volunteers_needed: 12, latitude: -31.42, longitude: -64.18, modality: 'presencial' });
    assert.equal(c.status, 201, JSON.stringify(c.body));
    projectId = c.body.project.id;
  });
  after(async () => { if (server) await server.close(); });

  describe('POST: 400 sin crear nada', () => {
    test('cupos que no son un entero (antes parseInt: 3.7 → 3, "5 personas" → 5, [5] → 5, "1e21" → 1)', async () => {
      for (const v of NOT_INT) await createRejected({ volunteers_needed: v }, CUPOS_INT, `cupos ${JSON.stringify(v)}`);
    });

    test('horas semanales que no son un entero', async () => {
      for (const h of NOT_INT)
        await createRejected({ type: 'sostenido', duration: undefined, hours_per_week: h }, HORAS_INT, `horas ${JSON.stringify(h)}`);
    });

    test('1e21 como número entra por el tope, no se lee como 1', async () => {
      await createRejected({ volunteers_needed: 1e21 }, /^Los cupos pueden ser hasta 100000$/, 'cupos 1e21');
    });

    test('un entero negativo en texto es "no positivo", no "no entero"', async () => {
      await createRejected({ volunteers_needed: '-3' }, /^Los cupos deben ser un número positivo$/, 'cupos "-3"');
      await createRejected({ type: 'sostenido', duration: undefined, hours_per_week: '-2' },
        /^Las horas semanales deben ser un número positivo$/, 'horas "-2"');
      // Y si faltan, el mensaje de siempre.
      await createRejected({ volunteers_needed: undefined }, /^Los cupos deben ser un número positivo$/, 'sin cupos');
      await createRejected({ type: 'sostenido', duration: undefined, hours_per_week: undefined },
        /^Las horas semanales deben ser un número positivo$/, 'sin horas');
    });

    test('latitud/longitud que no son un número finito o están fuera de rango (antes null sin aviso o 500 guardado)', async () => {
      for (const v of [...BAD_COORDS, 500, -90.0001, 91, '-91']) {
        await createRejected({ latitude: v, longitude: -64 }, LAT, `latitude ${JSON.stringify(v)}`);
        await createRejected({ latitud: v, longitud: -64 }, LAT, `latitud ${JSON.stringify(v)}`);
      }
      for (const v of [...BAD_COORDS, 181, -180.5, '200']) {
        await createRejected({ latitude: -31, longitude: v }, LNG, `longitude ${JSON.stringify(v)}`);
        await createRejected({ latitud: -31, longitud: v }, LNG, `longitud ${JSON.stringify(v)}`);
      }
    });

    test('textos más largos que el máximo', async () => {
      for (const [k, label, max] of LIMITS)
        await createRejected({ [k]: 'x'.repeat(max + 1) }, new RegExp(`^${label} puede tener hasta ${max} caracteres$`), `${k} de ${max + 1}`);
    });
  });

  describe('POST: lo válido se sigue aceptando', () => {
    test('cupos y horas como número entero o texto de dígitos (así llegan de un <input>)', async () => {
      const r = await create({ type: 'sostenido', duration: undefined, hours_per_week: '10', volunteers_needed: '15' });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(r.body.project.hours_per_week, 10);
      assert.equal(r.body.project.volunteers_needed, 15);
      const r2 = await create({ volunteers_needed: 7.0 });
      assert.equal(r2.status, 201);
      assert.equal(r2.body.project.volunteers_needed, 7);
    });

    test('coordenadas en rango (número o texto, extremos incluidos); null, vacías o ausentes = sin coordenadas', async () => {
      const r = await create({ latitude: -31.42, longitude: '-64.18' });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.deepEqual([r.body.project.latitude, r.body.project.longitude], [-31.42, -64.18]);
      const ext = await create({ latitud: '90', longitud: -180 });
      assert.equal(ext.status, 201, JSON.stringify(ext.body));
      assert.deepEqual([ext.body.project.latitude, ext.body.project.longitude], [90, -180]);
      const ext2 = await create({ latitude: -90, longitude: 180 });
      assert.deepEqual([ext2.body.project.latitude, ext2.body.project.longitude], [-90, 180]);
      for (const over of [{ latitude: null, longitude: null }, { latitude: '', longitude: '' }, {}]) {
        const s = await create(over);
        assert.equal(s.status, 201, JSON.stringify(over));
        assert.deepEqual([s.body.project.latitude, s.body.project.longitude], [null, null], JSON.stringify(over));
      }
    });

    test('textos justo en el máximo', async () => {
      const over = Object.fromEntries(LIMITS.map(([k, , max]) => [k, 'x'.repeat(max)]));
      const r = await create(over);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(r.body.project.title.length, 80);
      assert.equal(r.body.project.image.length, 1000);
    });
  });

  describe('PUT: 400 sin cambiar nada', () => {
    test('cupos y horas que no son un entero', async () => {
      for (const v of NOT_INT) await putRejected({ volunteers_needed: v }, CUPOS_INT, `cupos ${JSON.stringify(v)}`);
      for (const h of NOT_INT) await putRejected({ hours_per_week: h }, HORAS_INT, `horas ${JSON.stringify(h)}`);
    });

    test('modalidad fuera de la lista (antes un objeto daba 500 en SQLite y "otra" se guardaba)', async () => {
      for (const over of [{ modality: { a: 1 } }, { modality: 5 }, { modality: 'otra' }, { modality: ['remoto'] }, { modalidad: 'virtual' }])
        await putRejected(over, MOD, JSON.stringify(over));
    });

    test('latitud/longitud inválidas', async () => {
      for (const v of [...BAD_COORDS, 500, -91]) {
        await putRejected({ latitude: v }, LAT, `latitude ${JSON.stringify(v)}`);
        await putRejected({ latitud: v }, LAT, `latitud ${JSON.stringify(v)}`);
      }
      for (const v of [...BAD_COORDS, 181, -181]) {
        await putRejected({ longitude: v }, LNG, `longitude ${JSON.stringify(v)}`);
        await putRejected({ longitud: v }, LNG, `longitud ${JSON.stringify(v)}`);
      }
    });

    test('textos más largos que el máximo', async () => {
      for (const [k, label, max] of LIMITS)
        await putRejected({ [k]: 'x'.repeat(max + 1) }, new RegExp(`^${label} puede tener hasta ${max} caracteres$`), `${k} de ${max + 1}`);
    });
  });

  describe('PUT: lo válido se guarda', () => {
    test('cupos y horas en texto de dígitos', async () => {
      const r = await put({ volunteers_needed: '20', hours_per_week: '6' });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const x = await row();
      assert.deepEqual([Number(x.cupos), Number(x.horas_semanales)], [20, 6]);
    });

    test('modalidad válida (modality o modalidad); vacía conserva la actual', async () => {
      assert.equal((await put({ modality: 'hibrido' })).status, 200);
      assert.equal((await row()).modalidad, 'hibrido');
      assert.equal((await put({ modalidad: 'remoto' })).status, 200);
      assert.equal((await row()).modalidad, 'remoto');
      assert.equal((await put({ modality: '' })).status, 200);
      assert.equal((await row()).modalidad, 'remoto');
    });

    test('coordenadas: en rango se guardan, null o vacías las borran, ausentes se conservan', async () => {
      assert.equal((await put({ latitude: '-31.5', longitude: -64.2 })).status, 200);
      let x = await row();
      assert.deepEqual([Number(x.latitud), Number(x.longitud)], [-31.5, -64.2]);
      assert.equal((await put({ title: 'Proyecto editado' })).status, 200);
      x = await row();
      assert.deepEqual([Number(x.latitud), Number(x.longitud)], [-31.5, -64.2]);
      assert.equal((await put({ latitud: 90, longitud: '180' })).status, 200);
      x = await row();
      assert.deepEqual([Number(x.latitud), Number(x.longitud)], [90, 180]);
      assert.equal((await put({ latitude: null, longitude: '' })).status, 200);
      x = await row();
      assert.deepEqual([x.latitud, x.longitud], [null, null]);
    });

    test('textos justo en el máximo', async () => {
      const over = Object.fromEntries(LIMITS.filter(([k]) => k !== 'duration').map(([k, , max]) => [k, 'y'.repeat(max)]));
      const r = await put(over);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal((await row()).titulo.length, 80);
    });
  });
});
