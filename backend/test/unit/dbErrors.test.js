// test/unit/dbErrors.test.js — isUniqueViolation (REVISION B17): 409 en vez de 500 ante un UNIQUE.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isUniqueViolation } = require('../../src/lib/dbErrors');

test('Postgres: SQLSTATE 23505 es violación de UNIQUE', () => {
  assert.equal(isUniqueViolation({ code: '23505', message: 'duplicate key value violates unique constraint "users_email_key"' }), true);
});

test('SQLite: los códigos de UNIQUE y de PRIMARY KEY, y el mensaje solo', () => {
  assert.equal(isUniqueViolation({ code: 'SQLITE_CONSTRAINT_UNIQUE' }), true);
  assert.equal(isUniqueViolation({ code: 'SQLITE_CONSTRAINT_PRIMARYKEY' }), true);
  assert.equal(isUniqueViolation(new Error('UNIQUE constraint failed: users.email')), true);
});

test('otros errores NO lo son (no convertirlos en 409)', () => {
  assert.equal(isUniqueViolation(null), false);
  assert.equal(isUniqueViolation(undefined), false);
  assert.equal(isUniqueViolation(new Error('falla simulada')), false);
  assert.equal(isUniqueViolation({ code: '23503', message: 'violates foreign key constraint' }), false);  // FK
  assert.equal(isUniqueViolation({ code: '23502', message: 'null value in column "nombre"' }), false);     // NOT NULL
  assert.equal(isUniqueViolation({ code: 'SQLITE_CONSTRAINT_NOTNULL', message: 'NOT NULL constraint failed: kpis.nombre' }), false);
  assert.equal(isUniqueViolation({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY', message: 'FOREIGN KEY constraint failed' }), false);
});
