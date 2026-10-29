// test/integration/quiet-stdout.test.js — en los tests, el arranque no escribe por stdout (§273).
//
// El runner de `node --test` lee los resultados de cada archivo por el stdout del proceso hijo. Los mensajes de
// arranque del servidor y del adaptador ("🚀 Voluntariar API…", "Conectado a SQLite/PostgreSQL", con emojis) iban
// por ahí; la hipótesis de §273 es que con carga se intercalaban con un mensaje del runner y lo corrompían
// ("Unable to deserialize cloned data", 3 veces en el CI). Criterio: con NODE_ENV=test, levantar el servidor no
// escribe esos mensajes por stdout. (Lo que escribe el runner pasa igual: solo se mira, no se tapa.)
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

let server;
after(async () => { if (server) await server.close(); });

test('levantar el servidor de prueba no escribe los mensajes de arranque por stdout', async () => {
  const seen = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...rest) => { seen.push(String(chunk)); return original(chunk, ...rest); };
  try {
    server = await setupTestServer();
  } finally {
    process.stdout.write = original;
  }
  const startup = seen.filter((s) => /Voluntariar API|Conectado a (SQLite|PostgreSQL)|WebSocket \(chat\)/.test(s));
  assert.deepEqual(startup, []);
});
