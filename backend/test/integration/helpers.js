// test/integration/helpers.js
//
// Levanta el servidor Express REAL (con su WebSocket y todo) contra una
// base de datos SQLite temporal y aislada — nunca toca backend/data/, que
// es donde vive la base de desarrollo. Cada test file que use esto termina
// con su propia base descartable.
//
// Requiere que SQLITE_PATH (agregado en src/db/index.js específicamente
// para esto) sea respetado por el adaptador de base de datos.
//
// MODO POSTGRES (TEST_DB=postgres, o `npm run test:pg`): corre EXACTAMENTE los
// mismos tests contra un Postgres real. Existe porque hay bugs que SQLite no
// puede reproducir (agregados que llegan como string, carreras entre
// conexiones — ver PROJECT_ANALYSIS.md §33/§34). Seguridad:
//   - Cada archivo de test crea su PROPIO schema (test_<pid>_<rand>) y lo
//     borra al terminar. Nunca se toca `public` ni ningún otro dato.
//   - Se ignora DATABASE_URL a propósito: un test jamás debe poder apuntar a
//     la base de producción que tengas en tu .env.
//   - La conexión sale de TEST_PG_HOST / TEST_PG_PORT / TEST_PG_DB /
//     TEST_PG_USER / TEST_PG_PASSWORD (defaults: localhost, 5432,
//     voluntariar_test, postgres, ''), no de las DB_* de desarrollo.

const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');

const USE_PG_TESTS = process.env.TEST_DB === 'postgres';

const pgConfig = () => ({
  host:     process.env.TEST_PG_HOST     || 'localhost',
  port:     parseInt(process.env.TEST_PG_PORT || '5432'),
  database: process.env.TEST_PG_DB       || 'voluntariar_test',
  user:     process.env.TEST_PG_USER     || 'postgres',
  password: process.env.TEST_PG_PASSWORD || '',
});

// Configura las variables de entorno para que el adaptador (src/db) apunte a una base
// descartable del motor elegido. Devuelve lo necesario para limpiarla después.
async function configureTestDb() {
  const dbPath = path.join(
    os.tmpdir(),
    `voluntariar-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`
  );
  const schema = `test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

  if (USE_PG_TESTS) {
    const cfg = pgConfig();
    delete process.env.DATABASE_URL;               // ver nota de seguridad arriba
    process.env.USE_POSTGRES = 'true';
    process.env.DB_HOST = cfg.host;   process.env.DB_PORT = String(cfg.port);
    process.env.DB_NAME = cfg.database; process.env.DB_USER = cfg.user;
    process.env.DB_PASSWORD = cfg.password;
    const { Pool } = require('pg');
    const admin = new Pool(cfg);
    try { await admin.query(`CREATE SCHEMA ${schema}`); } finally { await admin.end(); }
    process.env.PGOPTIONS = `-c search_path=${schema}`; // lo heredan migrate/seed y el server
  } else {
    process.env.SQLITE_PATH  = dbPath;
    process.env.USE_POSTGRES = 'false';
  }
  return { dbPath, schema };
}

// Cierra el pool (Postgres), borra el schema propio / el archivo SQLite.
async function cleanupTestDb({ dbPath, schema }) {
  if (USE_PG_TESTS) {
    try {
      const { Pool } = require('pg');
      await require('../../src/db').pool.end();
      const admin = new Pool(pgConfig());
      try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.end(); }
    } catch (e) { console.error('cleanup PG falló:', e.message); }
  } else {
    try { fs.unlinkSync(dbPath); } catch {}
  }
}

// Solo el adaptador, sin servidor HTTP: para tests unitarios de src/db.
async function setupTestDb() {
  const handle = await configureTestDb();
  const db = require('../../src/db');
  return { db, engine: USE_PG_TESTS ? 'postgres' : 'sqlite', close: () => cleanupTestDb(handle) };
}

async function setupTestServer({ seed = false } = {}) {
  const handle = await configureTestDb();

  process.env.JWT_SECRET    = 'test_secret_no_usar_en_produccion';
  process.env.PORT          = '0'; // puerto libre asignado por el SO
  process.env.NODE_ENV      = 'test';
  process.env.CORS_ORIGINS  = 'http://localhost:5173';
  process.env.RESEND_API_KEY = ''; // sin key en tests — sendEmail() debe omitir sin romper nada

  const scriptsDir = path.join(__dirname, '../../scripts');
  const env = { ...process.env };

  // Migrar (y opcionalmente sembrar) la base temporal ANTES de levantar el
  // server, en un proceso aparte — así el server arranca con las tablas ya
  // creadas, igual que en un deploy real.
  execFileSync('node', [path.join(scriptsDir, 'migrate.js')], { env, stdio: 'pipe' });
  if (seed) execFileSync('node', [path.join(scriptsDir, 'seed.js')], { env, stdio: 'pipe' });

  delete require.cache[require.resolve('../../src/index')];
  const mod = require('../../src/index');
  const server = mod.server;

  await new Promise(resolve => {
    if (server.listening) return resolve();
    server.on('listening', resolve);
  });

  const { port } = server.address();

  return {
    baseUrl: `http://localhost:${port}`,
    engine: USE_PG_TESTS ? 'postgres' : 'sqlite',
    close: () => new Promise(resolve => {
      server.close(async () => { await cleanupTestDb(handle); resolve(); });
    }),
  };
}

module.exports = { setupTestServer, setupTestDb, pgConfig, USE_PG_TESTS };
