// test/integration/migrate-schemas.test.js
//
// migrate.js en Postgres con VARIOS schemas en la misma base (solo `npm run test:pg`).
//
// Bug (PROJECT_ANALYSIS.md §50): columnExists() buscaba la columna en
// information_schema.columns sin filtrar por schema. Si OTRO schema ya tenía la
// columna (p. ej. el de otro archivo de test corriendo en paralelo, o uno que quedó
// de una corrida anterior), addColumnIfNotExists() se salteaba el ALTER TABLE en el
// schema propio y la migración fallaba más adelante ("column "estado" does not exist").
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');
const { pgConfig, USE_PG_TESTS } = require('./helpers');

const MIGRATE = path.join(__dirname, '../../scripts/migrate.js');

describe('migrate.js con varios schemas en la misma base (Postgres)', { skip: !USE_PG_TESTS && 'solo en test:pg' }, () => {
  const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const schemaA = `test_${suffix}_a`;
  const schemaB = `test_${suffix}_b`;
  let admin;

  // Corre migrate.js en un proceso aparte apuntando SOLO al schema indicado.
  const migrateInto = (schema) => {
    const cfg = pgConfig();
    const env = {
      ...process.env,
      USE_POSTGRES: 'true',
      DB_HOST: cfg.host, DB_PORT: String(cfg.port), DB_NAME: cfg.database,
      DB_USER: cfg.user, DB_PASSWORD: cfg.password,
      PGOPTIONS: `-c search_path=${schema}`,
    };
    delete env.DATABASE_URL; // nunca apuntar a otra base (ver helpers.js)
    execFileSync('node', [MIGRATE], { env, stdio: 'pipe' });
  };

  const columnsOf = async (schema) => (await admin.query(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = $1 ORDER BY table_name, column_name`,
    [schema]
  )).rows.map((r) => `${r.table_name}.${r.column_name}`);

  before(async () => {
    const { Pool } = require('pg');
    admin = new Pool(pgConfig());
    await admin.query(`CREATE SCHEMA ${schemaA}`);
    await admin.query(`CREATE SCHEMA ${schemaB}`);
  });
  after(async () => {
    await admin.query(`DROP SCHEMA IF EXISTS ${schemaA} CASCADE`);
    await admin.query(`DROP SCHEMA IF EXISTS ${schemaB} CASCADE`);
    await admin.end();
  });

  test('migrar un schema nuevo cuando OTRO ya está migrado funciona y crea las mismas columnas', async () => {
    migrateInto(schemaA);
    assert.doesNotThrow(() => migrateInto(schemaB), 'la migración del segundo schema no debe fallar');

    const cols = await columnsOf(schemaB);
    for (const c of ['estado', 'mensaje', 'updated_at']) {
      assert.ok(cols.includes(`empresa_voluntariados.${c}`), `falta empresa_voluntariados.${c} en el schema nuevo`);
    }
    assert.deepEqual(cols, await columnsOf(schemaA), 'los dos schemas deben quedar con las mismas columnas');
  });

  test('volver a migrar el mismo schema sigue siendo idempotente', async () => {
    const before = await columnsOf(schemaB);
    assert.doesNotThrow(() => migrateInto(schemaB));
    assert.deepEqual(await columnsOf(schemaB), before);
  });
});
