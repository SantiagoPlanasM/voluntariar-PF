// scripts/run-tests-pg.js
//
// `npm run test:pg` — corre toda la suite contra un Postgres real.
//
// OJO con el nombre: NO llamarlo test-*.js. El runner de Node (`node --test`) toma por
// defecto cualquier archivo `**/test-*.js` como un test y lo ejecutaría dentro de `npm test`.
// Es un script de Node (y no `TEST_DB=postgres node --test` en el package.json)
// para que funcione igual en Windows, donde esa sintaxis de variable de entorno
// no existe, y sin sumar una dependencia tipo cross-env.
//
// Requisitos: un Postgres accesible (ver TEST_PG_* en test/integration/helpers.js)
// con la base indicada ya creada, p. ej.:  createdb voluntariar_test
const { spawnSync } = require('child_process');

const r = spawnSync(process.execPath, ['--test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, TEST_DB: 'postgres' },
});
process.exit(r.status ?? 1);
