// test/integration/seed-production.test.js
//
// REVISION S9: `scripts/seed.js` crea 9 cuentas con la contraseña `Password1`. Correrlo contra la base de
// producción (`npm run db:seed` con el .env de Render) dejaría esas cuentas abiertas. Con
// NODE_ENV=production tiene que negarse: salir con error y un mensaje claro, SIN tocar la base.
// Se corre el script de verdad, como proceso hijo, contra la base temporal de los tests (SQLite o el schema
// propio de Postgres: setupTestDb configura las variables y el hijo las hereda).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync, execFileSync } = require('node:child_process');
const { setupTestDb } = require('./helpers');

const SCRIPTS = path.join(__dirname, '../../scripts');
const SEED = path.join(SCRIPTS, 'seed.js');

describe('scripts/seed.js', () => {
  let db, close, emptyDir;

  // Corre el seed con el entorno de los tests más `extra`. `cwd` importa: dotenv lee el .env de ahí.
  const runSeed = ({ extra = {}, drop = [], cwd = emptyDir } = {}) => {
    const env = { ...process.env, ...extra };
    for (const k of drop) delete env[k];
    const r = spawnSync('node', [SEED], { env, cwd, encoding: 'utf8' });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  const count = async (table) => Number((await db.get(`SELECT COUNT(*) AS n FROM ${table}`)).n) || 0;

  before(async () => {
    ({ db, close } = await setupTestDb());
    execFileSync('node', [path.join(SCRIPTS, 'migrate.js')], { env: process.env, stdio: 'pipe' });
    // Una carpeta sin .env: así el .env de backend/ (el de desarrollo) no se mete en la prueba.
    emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'voluntariar-seed-'));
  });
  after(async () => {
    fs.rmSync(emptyDir, { recursive: true, force: true });
    await close();
  });

  describe('con NODE_ENV=production se niega (antes de tocar la base)', () => {
    test('sale con error, explica por qué y no crea ninguna cuenta', async () => {
      const r = runSeed({ extra: { NODE_ENV: 'production' } });
      assert.notEqual(r.code, 0, 'tiene que salir con error');
      assert.match(r.err, /producci[oó]n/i);
      assert.match(r.err, /NODE_ENV/);
      assert.doesNotMatch(r.out, /Usuarios de prueba|Seed completado/);
      for (const t of ['users', 'ngos', 'empresas', 'voluntarios', 'projects', 'enrollments']) {
        assert.equal(await count(t), 0, `${t} quedó con filas`);
      }
    });

    test('también si NODE_ENV=production viene del .env (como en un servidor configurado así)', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voluntariar-seed-env-'));
      try {
        fs.writeFileSync(path.join(dir, '.env'), 'NODE_ENV=production\n');
        const r = runSeed({ drop: ['NODE_ENV'], cwd: dir });
        assert.notEqual(r.code, 0);
        assert.match(r.err, /producci[oó]n/i);
        assert.equal(await count('users'), 0);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('fuera de producción siembra como siempre', () => {
    let r;
    before(() => { r = runSeed({ extra: { NODE_ENV: 'development' } }); });

    test('sale con 0 y crea las 9 cuentas de prueba', async () => {
      assert.equal(r.code, 0, r.err);
      assert.equal(await count('users'), 9);
    });

    test('el resumen final lista TODAS las cuentas que creó, la empresa incluida (admin@techcorp.com)', async () => {
      const summary = r.out.slice(r.out.indexOf('Usuarios de prueba'));
      const listed = [...summary.matchAll(/^\s+(\S+@\S+)\s+\/ Password1/gm)].map((m) => m[1]).sort();
      const created = (await db.all('SELECT email FROM users')).map((u) => u.email).sort();
      assert.deepEqual(listed, created);
      assert.match(summary, /admin@techcorp\.com\s+\/ Password1\s+\(empresa\)/);
    });
  });
});
