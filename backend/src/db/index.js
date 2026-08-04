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
  const path = require('path');
  const fs   = require('fs');

  const DATA_DIR = path.join(__dirname, '../../data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const DB_PATH = path.join(DATA_DIR, 'voluntariar.sqlite');

  let sqlite;
  let initPromise;
  let useSqlJs = false;

  try {
    const Database = require('better-sqlite3');
    sqlite = new Database(DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    console.log('🗄️  Conectado a SQLite (local, nativo)');
  } catch (err) {
    console.warn('⚠️  No se pudo cargar better-sqlite3 (puede deberse a tu versión de Node.js). Usando fallback de WebAssembly (sql.js)...');
    useSqlJs = true;
  }

  // Si usamos sql.js, inicializamos de forma asíncrona pero perezosa
  async function getSqliteDb() {
    if (sqlite) return sqlite;
    if (!initPromise) {
      initPromise = (async () => {
        const initSqlJs = require('sql.js');
        const SQL = await initSqlJs();
        let dbInstance;
        if (fs.existsSync(DB_PATH)) {
          const fileBuffer = fs.readFileSync(DB_PATH);
          dbInstance = new SQL.Database(fileBuffer);
        } else {
          dbInstance = new SQL.Database();
          // Guardar base inicial vacía
          const data = dbInstance.export();
          fs.writeFileSync(DB_PATH, Buffer.from(data));
        }
        dbInstance.run('PRAGMA journal_mode = WAL');
        dbInstance.run('PRAGMA foreign_keys = ON');
        console.log('🗄️  Conectado a SQLite (local, WebAssembly)');
        return dbInstance;
      })();
    }
    sqlite = await initPromise;
    return sqlite;
  }

  function saveSqlJsDb() {
    if (!useSqlJs || !sqlite) return;
    const data = sqlite.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  class SqlJsStatement {
    constructor(sqlJsDb, sql) {
      this.db = sqlJsDb;
      this.sql = sql;
    }

    all(...params) {
      const stmt = this.db.prepare(this.sql);
      try {
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        return rows;
      } finally {
        stmt.free();
      }
    }

    get(...params) {
      const stmt = this.db.prepare(this.sql);
      try {
        stmt.bind(params);
        if (stmt.step()) {
          return stmt.getAsObject();
        }
        return undefined;
      } finally {
        stmt.free();
      }
    }

    run(...params) {
      const stmt = this.db.prepare(this.sql);
      try {
        stmt.run(params);
        const changes = this.db.getRowsModified();
        let lastInsertRowid = null;
        try {
          const res = this.db.exec("SELECT last_insert_rowid() AS id");
          if (res && res[0] && res[0].values && res[0].values[0]) {
            lastInsertRowid = res[0].values[0][0];
          }
        } catch (e) {}
        saveSqlJsDb();
        return { changes, lastInsertRowid };
      } finally {
        stmt.free();
      }
    }
  }

  // Detecta si la query devuelve filas (SELECT/WITH) o es DDL/DML
  function isReadQuery(sql) {
    const s = sql.trimStart().toUpperCase();
    return s.startsWith('SELECT') || s.startsWith('WITH');
  }

  // Traduce sintaxis PostgreSQL → SQLite
  function translatePg(sql) {
    return sql
      // Parámetros: $1, $2 → ?
      .replace(/\$\d+/g, '?')
      // Timestamps
      .replace(/CURRENT_TIMESTAMP/gi, "datetime('now')")
      // Funciones de string case-insensitive
      .replace(/\bILIKE\b/gi, 'LIKE')
      // Conflict handling
      .replace(/\bON CONFLICT\s+DO NOTHING\b/gi, 'OR IGNORE')
      .replace(/\bON CONFLICT\s*\([^)]+\)\s*DO NOTHING\b/gi, 'OR IGNORE')
      ;
  }

  db = {
    type: 'sqlite',

    // query(): para DDL (CREATE TABLE, CREATE INDEX) y SELECT general
    query: async (sql, params = []) => {
      const dbInstance = useSqlJs ? await getSqliteDb() : sqlite;
      const translated = translatePg(sql);
      const stmt = useSqlJs ? new SqlJsStatement(dbInstance, translated) : dbInstance.prepare(translated);
      if (isReadQuery(translated)) {
        return { rows: stmt.all(...params) };
      } else {
        const info = stmt.run(...params);
        return { rows: [], changes: info.changes, lastID: info.lastInsertRowid };
      }
    },

    // run(): INSERT, UPDATE, DELETE — siempre sin filas de retorno
    run: async (sql, params = []) => {
      const dbInstance = useSqlJs ? await getSqliteDb() : sqlite;
      const translated = translatePg(sql);
      const stmt = useSqlJs ? new SqlJsStatement(dbInstance, translated) : dbInstance.prepare(translated);
      const info = stmt.run(...params);
      return { lastID: info.lastInsertRowid, changes: info.changes };
    },

    // get(): SELECT que devuelve una sola fila
    get: async (sql, params = []) => {
      const dbInstance = useSqlJs ? await getSqliteDb() : sqlite;
      const translated = translatePg(sql);
      const stmt = useSqlJs ? new SqlJsStatement(dbInstance, translated) : dbInstance.prepare(translated);
      return stmt.get(...params);
    },

    // all(): SELECT que devuelve múltiples filas
    all: async (sql, params = []) => {
      const dbInstance = useSqlJs ? await getSqliteDb() : sqlite;
      const translated = translatePg(sql);
      const stmt = useSqlJs ? new SqlJsStatement(dbInstance, translated) : dbInstance.prepare(translated);
      return stmt.all(...params);
    },

    sqlite,
  };
}

module.exports = db;
