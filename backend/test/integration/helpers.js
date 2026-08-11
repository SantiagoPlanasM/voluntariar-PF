// test/integration/helpers.js
//
// Levanta el servidor Express REAL (con su WebSocket y todo) contra una
// base de datos SQLite temporal y aislada — nunca toca backend/data/, que
// es donde vive la base de desarrollo. Cada test file que use esto termina
// con su propia base descartable.
//
// Requiere que SQLITE_PATH (agregado en src/db/index.js específicamente
// para esto) sea respetado por el adaptador de base de datos.

const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');

async function setupTestServer({ seed = false } = {}) {
  const dbPath = path.join(
    os.tmpdir(),
    `voluntariar-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`
  );

  process.env.SQLITE_PATH   = dbPath;
  process.env.USE_POSTGRES  = 'false';
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
    close: () => new Promise(resolve => {
      server.close(() => { try { fs.unlinkSync(dbPath); } catch {} resolve(); });
    }),
  };
}

module.exports = { setupTestServer };
