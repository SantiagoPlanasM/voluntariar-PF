// test/integration/db-transaction.test.js
//
// db.transaction() del adaptador (src/db/index.js), en AMBOS motores:
//   npm test        → SQLite
//   npm run test:pg → Postgres real
// (vive en integration/ porque usa el helper de base de datos descartable).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDb } = require('./helpers');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('db.transaction()', () => {
  let db, close, engine;

  before(async () => {
    ({ db, close, engine } = await setupTestDb());
    await db.query('CREATE TABLE tx_probe (id TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)');
  });
  after(async () => { await close(); });

  const ids = async () => (await db.all('SELECT id FROM tx_probe ORDER BY id')).map((r) => r.id);
  const reset = () => db.run('DELETE FROM tx_probe');

  test('COMMIT: persiste todo y devuelve lo que retorna el callback', async () => {
    await reset();
    const out = await db.transaction(async (tx) => {
      await tx.run('INSERT INTO tx_probe (id) VALUES ($1)', ['a']);
      await tx.run('INSERT INTO tx_probe (id) VALUES ($1)', ['b']);
      return 'listo';
    });
    assert.equal(out, 'listo');
    assert.deepEqual(await ids(), ['a', 'b']);
  });

  test('ROLLBACK: si el callback lanza no persiste nada y se relanza el MISMO error', async () => {
    await reset();
    const boom = new Error('boom');
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.run('INSERT INTO tx_probe (id) VALUES ($1)', ['a']);
        throw boom;
      }),
      (err) => err === boom
    );
    assert.deepEqual(await ids(), []);
  });

  test('atomicidad entre sentencias: si la 2ª falla por una constraint, la 1ª se deshace', async () => {
    await reset();
    await db.run('INSERT INTO tx_probe (id) VALUES ($1)', ['dup']);
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.run('INSERT INTO tx_probe (id) VALUES ($1)', ['nuevo']);
        await tx.run('INSERT INTO tx_probe (id) VALUES ($1)', ['dup']); // viola la PK
      })
    );
    assert.deepEqual(await ids(), ['dup'], '"nuevo" no debe haber quedado');
  });

  test('tx.run devuelve `changes` y tx.get/all ven las escrituras propias sin commitear', async () => {
    await reset();
    await db.transaction(async (tx) => {
      const ins = await tx.run('INSERT INTO tx_probe (id, n) VALUES ($1, $2)', ['x', 1]);
      assert.equal(ins.changes, 1);
      const upd = await tx.run('UPDATE tx_probe SET n = n + 1 WHERE id = $1', ['x']);
      assert.equal(upd.changes, 1);
      const miss = await tx.run('UPDATE tx_probe SET n = 0 WHERE id = $1', ['no-existe']);
      assert.equal(miss.changes, 0);
      assert.equal((await tx.get('SELECT n FROM tx_probe WHERE id = $1', ['x'])).n, 2);
      assert.equal((await tx.all('SELECT id FROM tx_probe')).length, 1);
    });
  });

  describe('errores de uso (idénticos en los dos motores)', () => {
    test('db.* dentro del callback lanza, y la transacción se deshace', async () => {
      await reset();
      await assert.rejects(
        db.transaction(async (tx) => {
          await tx.run('INSERT INTO tx_probe (id) VALUES ($1)', ['a']);
          await db.run('INSERT INTO tx_probe (id) VALUES ($1)', ['b']); // ← error de uso
        }),
        /dentro de db\.transaction\(\)/
      );
      assert.deepEqual(await ids(), []);
    });

    test('transacciones anidadas lanzan (en vez de colgarse esperando el turno)', async () => {
      await assert.rejects(
        db.transaction(async () => { await db.transaction(async () => {}); }),
        /dentro de db\.transaction\(\)/
      );
    });

    test('usar tx después de que terminó lanza', async () => {
      let leaked;
      await db.transaction(async (tx) => { leaked = tx; });
      await assert.rejects(leaked.run('SELECT 1'), /después de que la transacción terminó/);
    });

    test('una llamada db.* colgada de una promesa creada DENTRO de la tx, pero ejecutada después, sí funciona', async () => {
      // Caso real: `sendEmail().then(() => db.run(...))` iniciado dentro de la tx.
      // Cuando la tx ya terminó, el contexto quedó inactivo y no debe dar falso positivo.
      await reset();
      let later;
      await db.transaction(async (tx) => {
        await tx.run('INSERT INTO tx_probe (id) VALUES ($1)', ['in']);
        later = sleep(20).then(() => db.run('INSERT INTO tx_probe (id) VALUES ($1)', ['later']));
      });
      await later;
      assert.deepEqual(await ids(), ['in', 'later']);
    });
  });

  test('AISLAMIENTO: una escritura ajena durante una tx abierta NO se pierde si la tx hace ROLLBACK', async () => {
    // El riesgo propio de SQLite (una sola conexión): sin la compuerta, el INSERT de
    // "otra request" caería dentro de la transacción abierta y se descartaría con ella.
    await reset();
    const inFlight = db.transaction(async (tx) => {
      await tx.run('INSERT INTO tx_probe (id) VALUES ($1)', ['de-la-tx']);
      await sleep(60);                      // I/O de por medio: acá otras requests pueden entrar
      throw new Error('falla a mitad');
    });
    const inFlightResult = assert.rejects(inFlight, /falla a mitad/);

    await sleep(15);                        // la tx ya está abierta
    await db.run('INSERT INTO tx_probe (id) VALUES ($1)', ['ajena']);   // "otra request"

    await inFlightResult;
    assert.deepEqual(await ids(), ['ajena'], 'sobrevive la ajena; la de la tx se deshizo');
  });

  test('las lecturas ajenas nunca ven datos sin commitear', async () => {
    await reset();
    let seenDuring;
    const inFlight = db.transaction(async (tx) => {
      await tx.run('INSERT INTO tx_probe (id) VALUES ($1)', ['sin-commit']);
      await sleep(60);
      throw new Error('cancelar');
    });
    const done = assert.rejects(inFlight, /cancelar/);
    await sleep(15);
    seenDuring = await ids();               // SQLite: espera y ve el estado final; PG: ve lo commiteado
    await done;
    assert.deepEqual(seenDuring, [], 'jamás debe aparecer "sin-commit"');
  });

  test('UPDATE atómico concurrente: 25 transacciones simultáneas suman exactamente 25', async () => {
    await reset();
    await db.run('INSERT INTO tx_probe (id, n) VALUES ($1, 0)', ['counter']);
    await Promise.all(Array.from({ length: 25 }, () =>
      db.transaction(async (tx) => { await tx.run('UPDATE tx_probe SET n = n + 1 WHERE id = $1', ['counter']); })
    ));
    assert.equal((await db.get('SELECT n FROM tx_probe WHERE id = $1', ['counter'])).n, 25);
  });

  test('no se filtran conexiones: 30 transacciones fallidas y luego 30 simultáneas (más que el pool) terminan', async () => {
    await reset();
    for (let i = 0; i < 30; i++) {
      await assert.rejects(db.transaction(async (tx) => { await tx.run('SELECT 1'); throw new Error('x'); }));
    }
    const rs = await Promise.all(Array.from({ length: 30 }, (_, i) =>
      db.transaction(async (tx) => { await tx.run('SELECT 1'); return i; })
    ));
    assert.equal(rs.length, 30);
    if (engine === 'postgres') assert.equal(db.pool.waitingCount, 0);
  });
});
