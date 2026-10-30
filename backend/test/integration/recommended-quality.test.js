// test/integration/recommended-quality.test.js — mejoras de las recomendaciones (§280, pedido del usuario).
//
// Criterio:
//   1) Historial: una postulación APROBADA pesa el doble que una pendiente o rechazada (es un interés confirmado).
//   2) Seguir un voluntariado cuenta como interés en su categoría (sin cambiar `based_on_history`, que sigue diciendo
//      si hay postulaciones).
//   3) Diversidad: entre los resultados, a lo sumo 2 de la misma ONG mientras haya otras para mostrar.
//   4) El universo no es solo los 100 más nuevos: un voluntariado más viejo que encaja se recomienda igual.
//   5) Toda habilidad del catálogo apunta a algún rol (antes Contabilidad y Jardinería no sumaban nada).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setupTestServer } = require('./helpers');

describe('Recomendaciones: calidad', () => {
  let server, db, cats;

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
    cats = Object.fromEntries((await db.all('SELECT id, nombre FROM categorias')).map((c) => [c.nombre, c.id]));
  });
  after(async () => { if (server) await server.close(); });

  const post = (path, body, token) => fetch(`${server.baseUrl}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }).then((r) => r.json());
  let n = 0;
  const volunteer = async () => {
    n += 1;
    const r = await post('/api/auth/register', { name: 'Reco Prueba', email: `reco-${n}-${Date.now()}@example.com`, password: 'Password1', role: 'volunteer' });
    return { token: r.token, id: r.user.id };
  };
  const project = async ({ ngo = 'ngo-1', cat, titulo = `P ${randomUUID().slice(0, 6)}`, createdAt } = {}) => {
    const id = randomUUID();
    await db.run(`INSERT INTO projects (id, ngo_id, titulo, descripcion, ubicacion, cupos) VALUES ($1,$2,$3,'d','Córdoba',10)`, [id, ngo, titulo]);
    if (createdAt) await db.run('UPDATE projects SET created_at=$1 WHERE id=$2', [createdAt, id]);
    if (cat) await db.run('INSERT INTO project_categorias (project_id, categoria_id) VALUES ($1,$2)', [id, cats[cat]]);
    return id;
  };
  const enroll = (userId, projectId, status) => db.run(
    `INSERT INTO enrollments (id, user_id, project_id, status) VALUES ($1,$2,$3,$4)`, [randomUUID(), userId, projectId, status]);
  const recommended = (token, limit = 30) => fetch(`${server.baseUrl}/api/projects/recommended?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const scoreOf = (body, id) => body.recommendations.find((p) => p.id === id)?.recommendation_score;

  test('una postulación aprobada pesa más que una pendiente', async () => {
    const v = await volunteer();
    await enroll(v.id, await project({ cat: 'Educación' }), 'approved');
    await enroll(v.id, await project({ cat: 'Salud' }), 'pending');
    const edu = await project({ ngo: 'ngo-2', cat: 'Educación' });
    const salud = await project({ ngo: 'ngo-3', cat: 'Salud' });
    const body = await recommended(v.token);
    assert.equal(body.based_on_history, true);
    assert.ok(scoreOf(body, edu) > scoreOf(body, salud), `aprobada ${scoreOf(body, edu)} > pendiente ${scoreOf(body, salud)}`);
  });

  test('seguir un voluntariado cuenta como interés en su categoría (sin postulaciones)', async () => {
    const v = await volunteer();
    const seguido = await project({ ngo: 'ngo-2', cat: 'Deportes' });
    await db.run('INSERT INTO project_follows (user_id, project_id) VALUES ($1,$2)', [v.id, seguido]);
    const otro = await project({ ngo: 'ngo-4', cat: 'Deportes' });
    const body = await recommended(v.token);
    assert.equal(body.based_on_history, false, 'based_on_history sigue hablando de postulaciones');
    const p = body.recommendations.find((x) => x.id === otro);
    assert.ok(p, 'el de la misma categoría aparece');
    assert.ok(p.recommendation_reasons.some((r) => /Deportes/.test(r)), JSON.stringify(p.recommendation_reasons));
  });

  test('diversidad: a lo sumo 2 de la misma ONG entre los resultados mientras haya otras', async () => {
    const v = await volunteer();
    await db.run('INSERT INTO ngo_follows (user_id, ngo_id) VALUES ($1,$2)', [v.id, 'ngo-4']);
    for (let i = 0; i < 4; i++) await project({ ngo: 'ngo-4', cat: 'Tecnología' });
    const body = await recommended(v.token, 5);
    const deNgo4 = body.recommendations.filter((p) => p.ngo_id === 'ngo-4').length;
    assert.equal(body.recommendations.length, 5);
    assert.ok(deNgo4 <= 2, `hay ${deNgo4} de la misma ONG en los 5 primeros`);
  });

  test('un voluntariado más viejo que los 100 más nuevos se recomienda igual si encaja', async () => {
    const v = await volunteer();
    await enroll(v.id, await project({ cat: 'Animales' }), 'approved');
    await enroll(v.id, await project({ cat: 'Animales' }), 'approved');
    const viejo = await project({ ngo: 'ngo-3', cat: 'Animales', titulo: 'Refugio viejo', createdAt: '2020-01-01 10:00:00' });
    for (let i = 0; i < 110; i++) await project({ ngo: 'ngo-2', titulo: `Relleno ${i}` });
    const body = await recommended(v.token, 10);
    assert.ok(body.recommendations.some((p) => p.id === viejo), 'el que encaja aparece aunque sea viejo');
  });

  // §287: la consulta de roles no tenía ORDER BY y el motivo salía en el orden de la base (en SQLite, el de rol_id).
  // Se eligen dos roles cuyo orden por id es el inverso del alfabético y se insertan al revés: sin ORDER BY falla.
  test('el motivo "Busca tus habilidades" lista los roles en orden alfabético', async () => {
    const { SKILL_TO_ROLE } = require('../../src/routes/projects');
    const ascii = ['Programador', 'Educador', 'Cocinero', 'Conductor', 'Comunicador', 'Coordinador'];
    const roleRows = (await db.all('SELECT id, nombre FROM roles')).filter((r) => ascii.includes(r.nombre));
    let pair;
    for (const a of roleRows) for (const b of roleRows) if (a.nombre < b.nombre && a.id > b.id) pair ||= [a, b];
    assert.ok(pair, 'hay dos roles con el orden por id inverso al alfabético');
    const v = await volunteer();
    const skills = await db.all('SELECT id, nombre FROM habilidades');
    for (const rol of pair) {
      const skill = skills.find((h) => SKILL_TO_ROLE[h.nombre.toLowerCase()]?.includes(rol.nombre));
      await db.run('INSERT INTO voluntario_habilidades (user_id, habilidad_id) VALUES ($1,$2)', [v.id, skill.id]);
    }
    const id = await project({ ngo: 'ngo-2' });
    for (const rol of [...pair].reverse()) await db.run('INSERT INTO project_roles (project_id, rol_id) VALUES ($1,$2)', [id, rol.id]);
    const p = (await recommended(v.token)).recommendations.find((x) => x.id === id);
    assert.ok(p, 'el voluntariado aparece');
    assert.ok(p.recommendation_reasons.includes(`Busca tus habilidades: ${pair[0].nombre}, ${pair[1].nombre}`), JSON.stringify(p.recommendation_reasons));
  });

  test('toda habilidad del catálogo apunta a algún rol que existe', async () => {
    const { SKILL_TO_ROLE } = require('../../src/routes/projects');
    const roles = new Set((await db.all('SELECT nombre FROM roles')).map((r) => r.nombre));
    for (const { nombre } of await db.all('SELECT nombre FROM habilidades')) {
      const mapped = SKILL_TO_ROLE[nombre.toLowerCase()];
      assert.ok(mapped?.length, `"${nombre}" no tiene rol`);
      for (const r of mapped) assert.ok(roles.has(r), `"${nombre}" apunta a "${r}", que no es un rol`);
    }
  });
});
