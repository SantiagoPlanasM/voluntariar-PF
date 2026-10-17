// src/db/index.js
require('dotenv').config();
const { AsyncLocalStorage } = require('node:async_hooks');

// ── db.transaction(async (tx) => { ... }) ──────────────────────────────────
// Ejecuta el callback dentro de una transacción: si termina bien se hace COMMIT
// y devuelve lo que retorne el callback; si lanza (o rechaza), ROLLBACK y se
// relanza el error. `tx` tiene la misma interfaz que `db` (query/run/get/all).
//
// REGLAS (las dos primeras se hacen cumplir con un error, no son solo una guía):
//  1. Dentro del callback usar SIEMPRE `tx.*`, nunca `db.*`. En Postgres `db.*`
//     usa OTRA conexión del pool y quedaría fuera de la transacción; en SQLite
//     (una sola conexión) sí quedaría adentro. Esa divergencia pasaba tests en
//     SQLite y rompía la atomicidad en producción, así que en ambos motores
//     llamar a `db.*` (o anidar `db.transaction`) dentro del callback lanza error.
//  2. No usar `tx` después de que la transacción terminó (lanza error).
//  3. Nada de I/O externo (emails, fetch, Stripe) adentro: mantiene la transacción
//     abierta y, en SQLite, frena a todas las demás requests hasta que termine.
//     Hacerlo DESPUÉS del COMMIT.
//  4. Una query que falla dentro de una transacción de Postgres deja la
//     transacción abortada: no envolver `tx.*` en `.catch(() => {})` esperando
//     seguir. Las cosas "best effort" (p. ej. notificaciones) van fuera.
const txStore = new AsyncLocalStorage();

function assertNoActiveTx(method) {
  const ctx = txStore.getStore();
  if (ctx && ctx.active) {
    const err = new Error(
      `db.${method}() se llamó dentro de db.transaction(): usá el objeto "tx" que recibe el callback`
    );
    console.error(err.message); // por si el llamador lo traga con .catch(() => {})
    throw err;
  }
}

// Envuelve un método de `db` (fuera de transacción) con la guarda de arriba.
// Es async a propósito: el error llega como promesa rechazada, así que también
// se puede atrapar con `.catch()`, no solo con try/catch.
const outsideTx = (name, fn) => async (...args) => { assertNoActiveTx(name); return fn(...args); };

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

  // Las operaciones se definen una sola vez sobre un `exec(sql, params)` y se
  // reusan para el pool (db.*) y para el cliente de una transacción (tx.*).
  const bind = (exec) => ({
    query: (sql, params = []) => exec(sql, params),

    run: async (sql, params = []) => {
      const res = await exec(sql, params);
      return { lastID: res.rows[0]?.id ?? null, changes: res.rowCount };
    },

    // get(): SELECT que devuelve una sola fila
    // Agrega LIMIT 1 solo si la query no lo tiene ya
    get: async (sql, params = []) => {
      const lower = sql.toLowerCase();
      const hasLimit = lower.includes('limit');
      const finalSql = hasLimit ? sql : `SELECT * FROM (${sql}) __sub LIMIT 1`;
      const res = await exec(finalSql, params);
      return res.rows[0];
    },

    all: async (sql, params = []) => {
      const res = await exec(sql, params);
      return res.rows;
    },
  });

  const ops = bind((sql, params) => pool.query(sql, params));

  db = {
    type: 'postgres',

    query: outsideTx('query', ops.query),
    run:   outsideTx('run',   ops.run),
    get:   outsideTx('get',   ops.get),
    all:   outsideTx('all',   ops.all),

    // Toma UN cliente del pool y hace BEGIN/COMMIT/ROLLBACK sobre ese mismo cliente.
    transaction: async (fn) => {
      assertNoActiveTx('transaction'); // no hay transacciones anidadas
      const client = await pool.connect();
      const ctx = { active: true };
      let discardClient = false;
      try {
        await client.query('BEGIN');
        const tx = bind((sql, params) => {
          if (!ctx.active) throw new Error('tx usado después de que la transacción terminó');
          return client.query(sql, params);
        });
        const result = await txStore.run(ctx, () => fn(tx));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try { await client.query('ROLLBACK'); }
        catch (rbErr) {
          discardClient = true; // conexión en mal estado: que el pool la descarte
          console.error('ROLLBACK falló:', rbErr.message);
        }
        throw err;
      } finally {
        ctx.active = false;
        client.release(discardClient);
      }
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

  // Operaciones "crudas": son síncronas por dentro (better-sqlite3), envueltas en
  // async para exponer la misma interfaz que Postgres. Se usan tal cual dentro de
  // una transacción (tx.*) y, con la guarda de abajo, para db.*.
  const ops = {
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
  };

  // Hay UNA sola conexión: si una transacción está abierta y otra request hiciera
  // una query, caería DENTRO de esa transacción (y se perdería con un ROLLBACK).
  // Por eso las queries fuera de transacción esperan a que la abierta termine, y las
  // transacciones hacen cola (una a la vez).
  let turn = Promise.resolve(); // cola de transacciones
  let openTx = null;            // { done: Promise } mientras haya una abierta
  // Recursivo en vez de `while (openTx) await openTx.done`: hace lo mismo (esperar y volver a mirar, porque
  // la transacción pone openTx = null en su finally DURANTE el await), pero SonarCloud (regla S2189) no ve esa
  // escritura desde otra función y marcaba el while como loop infinito (BLOCKER, PROJECT_ANALYSIS.md §191).
  const waitForOpenTx = async () => {
    const tx = openTx;
    if (!tx) return;
    await tx.done;
    await waitForOpenTx();
  };
  const gated = (name) => outsideTx(name, async (sql, params) => {
    await waitForOpenTx();
    return ops[name](sql, params);
  });

  db = {
    type: 'sqlite',

    query: gated('query'),
    run:   gated('run'),
    get:   gated('get'),
    all:   gated('all'),

    transaction: async (fn) => {
      assertNoActiveTx('transaction'); // no hay transacciones anidadas
      const previous = turn;
      let releaseTurn;
      turn = new Promise((resolve) => { releaseTurn = resolve; });
      await previous; // esperar mi turno

      const ctx = { active: true };
      let finish;
      openTx = { done: new Promise((resolve) => { finish = resolve; }) };
      try {
        sqlite.exec('BEGIN');
        const guard = (name) => async (...args) => {
          if (!ctx.active) throw new Error('tx usado después de que la transacción terminó');
          return ops[name](...args);
        };
        const tx = { query: guard('query'), run: guard('run'), get: guard('get'), all: guard('all') };
        try {
          const result = await txStore.run(ctx, () => fn(tx));
          sqlite.exec('COMMIT');
          return result;
        } catch (err) {
          try { sqlite.exec('ROLLBACK'); } catch { /* si falló el COMMIT puede no haber transacción */ }
          throw err;
        }
      } finally {
        ctx.active = false;
        openTx = null;
        finish();
        releaseTurn();
      }
    },

    sqlite,
  };
}

module.exports = db;
