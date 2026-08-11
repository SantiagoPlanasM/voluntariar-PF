// src/db/index.js
require('dotenv').config();

const USE_POSTGRES = process.env.USE_POSTGRES === 'true' || !!process.env.DATABASE_URL;

let db;

if (USE_POSTGRES) {
  // ── PostgreSQL ─────────────────────────────────────────────────────────────
  const { Pool } = require('pg');

  const pool = new Pool(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
      : {
          host:     process.env.DB_HOST     || 'localhost',
          port:     parseInt(process.env.DB_PORT || '5432'),
          database: process.env.DB_NAME     || 'voluntariar',
          user:     process.env.DB_USER     || 'postgres',
          password: process.env.DB_PASSWORD,
        }
  );

  // Test de conexión al arrancar
  pool.query('SELECT 1').then(() => {
    console.log('🐘 Conectado a PostgreSQL');
  }).catch(err => {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
  });

  db = {
    type: 'postgres',

    query: (sql, params = []) => pool.query(sql, params),

    run: async (sql, params = []) => {
      const res = await pool.query(sql, params);
      return { lastID: res.rows[0]?.id ?? null, changes: res.rowCount };
    },

    // get(): SELECT que devuelve una sola fila
    // Agrega LIMIT 1 solo si la query no lo tiene ya
    get: async (sql, params = []) => {
      const lower = sql.toLowerCase();
      const hasLimit = lower.includes('limit');
      const finalSql = hasLimit ? sql : `SELECT * FROM (${sql}) __sub LIMIT 1`;
      const res = await pool.query(finalSql, params);
      return res.rows[0];
    },

    all: async (sql, params = []) => {
      const res = await pool.query(sql, params);
      return res.rows;
    },

    pool,
  };

} else {
  // ── SQLite (local) ─────────────────────────────────────────────────────────
  const Database = require('better-sqlite3');
  const path     = require('path');
  const fs       = require('fs');

  const DATA_DIR = path.join(__dirname, '../../data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // SQLITE_PATH permite apuntar a un archivo distinto (usado por los tests
  // de integración, para no tocar la base de datos de desarrollo). Sin esta
  // variable, el comportamiento es exactamente el de siempre.
  const sqlitePath = process.env.SQLITE_PATH || path.join(DATA_DIR, 'voluntariar.sqlite');
  const sqlite = new Database(sqlitePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  console.log('🗄️  Conectado a SQLite (local)');

  const { isReadQuery, translatePg, remapParams } = require('./sqlTranslate');

  db = {
    type: 'sqlite',

    // query(): para DDL (CREATE TABLE, CREATE INDEX) y SELECT general
    query: async (sql, params = []) => {
      const { translated, remapped } = remapParams(translatePg(sql), params);
      const stmt = sqlite.prepare(translated);
      if (isReadQuery(translated)) {
        return { rows: stmt.all(...remapped) };
      } else {
        const info = stmt.run(...remapped);
        return { rows: [], changes: info.changes, lastID: info.lastInsertRowid };
      }
    },

    // run(): INSERT, UPDATE, DELETE — siempre sin filas de retorno
    run: async (sql, params = []) => {
      const { translated, remapped } = remapParams(translatePg(sql), params);
      const stmt = sqlite.prepare(translated);
      const info = stmt.run(...remapped);
      return { lastID: info.lastInsertRowid, changes: info.changes };
    },

    // get(): SELECT que devuelve una sola fila
    get: async (sql, params = []) => {
      const { translated, remapped } = remapParams(translatePg(sql), params);
      const stmt = sqlite.prepare(translated);
      return stmt.get(...remapped);
    },

    // all(): SELECT que devuelve múltiples filas
    all: async (sql, params = []) => {
      const { translated, remapped } = remapParams(translatePg(sql), params);
      const stmt = sqlite.prepare(translated);
      return stmt.all(...remapped);
    },

    sqlite,
  };
}

module.exports = db;
