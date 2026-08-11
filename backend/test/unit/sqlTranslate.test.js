// test/unit/sqlTranslate.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { isReadQuery, translatePg, remapParams } = require('../../src/db/sqlTranslate');

describe('remapParams', () => {
  test('placeholder simple, sin repetir', () => {
    const { translated, remapped } = remapParams('SELECT * FROM users WHERE id=$1', ['u1']);
    assert.equal(translated, 'SELECT * FROM users WHERE id=?');
    assert.deepEqual(remapped, ['u1']);
  });

  test('varios placeholders en orden', () => {
    const { translated, remapped } = remapParams(
      'INSERT INTO x (a,b,c) VALUES ($1,$2,$3)', ['A', 'B', 'C']
    );
    assert.equal(translated, 'INSERT INTO x (a,b,c) VALUES (?,?,?)');
    assert.deepEqual(remapped, ['A', 'B', 'C']);
  });

  // ── Regresión del bug B9 (ver docs/PROJECT_ANALYSIS.md §18) ──────────────
  // Antes de este fix, una query que reusaba el mismo $N más de una vez
  // (válido en Postgres) quedaba con más "?" que parámetros bindeados en
  // SQLite, y devolvía 0 filas EN SILENCIO — sin lanzar ningún error. Este
  // test existe específicamente para que ese bug no pueda volver sin que
  // algún test se ponga rojo.
  test('BUG B9 — reusa $1 y $2 dos veces cada uno (como el WHERE de dos sentidos del chat)', () => {
    const sql = 'SELECT * FROM messages WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)';
    const { translated, remapped } = remapParams(sql, ['userA', 'userB']);

    // Tiene que haber exactamente 4 signos de pregunta (uno por cada
    // aparición de $1/$2 en el texto, no uno por cada número único)
    const qMarks = (translated.match(/\?/g) || []).length;
    assert.equal(qMarks, 4, 'debe generar un "?" por cada aparición de $N, no por cada número único');

    // Y el array de parámetros remapeado tiene que tener el mismo largo,
    // con los valores en el orden correcto: [userA, userB, userB, userA]
    assert.deepEqual(remapped, ['userA', 'userB', 'userB', 'userA']);
  });

  test('BUG B9 — reusa un mismo $N tres veces', () => {
    const sql = 'SELECT * FROM t WHERE a=$1 OR b=$1 OR c=$1';
    const { translated, remapped } = remapParams(sql, ['x']);
    assert.equal((translated.match(/\?/g) || []).length, 3);
    assert.deepEqual(remapped, ['x', 'x', 'x']);
  });

  test('placeholders con más de un dígito ($10, $11...)', () => {
    const params = Array.from({ length: 11 }, (_, i) => `v${i + 1}`);
    const sql = 'SELECT * FROM t WHERE a=$10 AND b=$11 AND c=$1';
    const { remapped } = remapParams(sql, params);
    assert.deepEqual(remapped, ['v10', 'v11', 'v1']);
  });
});

describe('translatePg', () => {
  test('traduce CURRENT_TIMESTAMP', () => {
    assert.match(translatePg('SELECT CURRENT_TIMESTAMP'), /datetime\('now'\)/);
  });

  test('traduce ILIKE a LIKE (case-insensitive)', () => {
    assert.equal(translatePg("WHERE nombre ILIKE '%x%'"), "WHERE nombre LIKE '%x%'");
  });

  test('traduce ON CONFLICT DO NOTHING', () => {
    const out = translatePg("INSERT INTO t VALUES (1) ON CONFLICT DO NOTHING");
    assert.match(out, /OR IGNORE/);
  });

  test('no toca los placeholders $N (eso lo hace remapParams)', () => {
    assert.equal(translatePg('WHERE id=$1'), 'WHERE id=$1');
  });

  test('no rompe SQL que no necesita traducción', () => {
    const sql = 'SELECT id, name FROM users WHERE role=$1';
    assert.equal(translatePg(sql), sql);
  });
});

describe('isReadQuery', () => {
  test('SELECT es de lectura', () => {
    assert.equal(isReadQuery('SELECT * FROM users'), true);
  });
  test('WITH (CTE) es de lectura', () => {
    assert.equal(isReadQuery('WITH x AS (SELECT 1) SELECT * FROM x'), true);
  });
  test('INSERT no es de lectura', () => {
    assert.equal(isReadQuery('INSERT INTO users (id) VALUES (1)'), false);
  });
  test('UPDATE no es de lectura', () => {
    assert.equal(isReadQuery('UPDATE users SET name=1'), false);
  });
  test('espacios/tabs iniciales no confunden la detección', () => {
    assert.equal(isReadQuery('   \n  select * from t'), true);
  });
});
