// test/integration/entrevistas.test.js — entrevistas de la ONG con quienes se postulan (docs/PLAN_ENTREVISTAS.md).
//
// Una entrevista es una fila de `reuniones` atada a una postulación (`enrollment_id`). La tabla existía desde el
// primer esquema sin ningún endpoint; §261 le agrega la postulación, el lugar, la nota y `updated_at`.
// Criterio del esquema: (1) una sola entrevista PROGRAMADA por postulación (índice único parcial: las canceladas o
// realizadas no cuentan); (2) si la postulación se borra (cancelar la borra), sus entrevistas se borran con ella.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { setupTestServer } = require('./helpers');
const { isUniqueViolation } = require('../../src/lib/dbErrors');

describe('Entrevistas: esquema de reuniones', () => {
  let server, db, enrollment;

  before(async () => {
    server = await setupTestServer({ seed: true });
    db = require('../../src/db');
    enrollment = await db.get(`SELECT id, user_id, project_id FROM enrollments ORDER BY id LIMIT 1`);
    assert.ok(enrollment, 'el seed no trajo postulaciones');
  });
  after(async () => { if (server) await server.close(); });

  const insertar = (estado, e = enrollment) => db.run(
    `INSERT INTO reuniones (id, enrollment_id, user_id, project_id, fecha, horario, link, lugar, nota, estado)
     VALUES ($1,$2,$3,$4,'2030-01-15','10:30',NULL,'Sede de la ONG','Traé el DNI',$5)`,
    [crypto.randomUUID(), e.id, e.user_id, e.project_id, estado],
  );

  test('una entrevista guarda la postulación, el lugar y la nota', async () => {
    await db.run(`DELETE FROM reuniones WHERE enrollment_id=$1`, [enrollment.id]);
    await insertar('programada');
    const r = await db.get(`SELECT enrollment_id, lugar, nota, estado, updated_at FROM reuniones WHERE enrollment_id=$1`, [enrollment.id]);
    assert.deepEqual([r.enrollment_id, r.lugar, r.nota, r.estado], [enrollment.id, 'Sede de la ONG', 'Traé el DNI', 'programada']);
    assert.ok(r.updated_at, 'updated_at tiene que tener un valor por defecto');
  });

  test('una segunda entrevista programada de la misma postulación se rechaza; cancelada o realizada, no', async () => {
    await db.run(`DELETE FROM reuniones WHERE enrollment_id=$1`, [enrollment.id]);
    await insertar('programada');
    await assert.rejects(insertar('programada'), (err) => isUniqueViolation(err));
    await insertar('cancelada');
    await insertar('realizada');
    const n = await db.get(`SELECT COUNT(*) AS n FROM reuniones WHERE enrollment_id=$1`, [enrollment.id]);
    assert.equal(Number(n.n) || 0, 3);
  });

  test('borrar la postulación borra sus entrevistas', async () => {
    await db.run(`DELETE FROM reuniones WHERE enrollment_id=$1`, [enrollment.id]);
    await insertar('programada');
    await db.run(`DELETE FROM enrollments WHERE id=$1`, [enrollment.id]);
    const n = await db.get(`SELECT COUNT(*) AS n FROM reuniones WHERE enrollment_id=$1`, [enrollment.id]);
    assert.equal(Number(n.n) || 0, 0);
  });
});
