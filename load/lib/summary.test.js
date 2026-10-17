// load/lib/summary.test.js — el reporte de las pruebas de carga (TP de Calidad, T10; §197).
// Correr con: node --test "load/lib/*.test.js"   (con un patrón: una carpeta suelta no anda, §189)
// Criterio de aceptación (antes del código): a partir del `data` que k6 le pasa a handleSummary, el reporte dice
// para cada umbral si pasó (✅) o no (❌) con su expresión, muestra p95, p99, mediana y máximo de la duración, la
// tasa de errores en %, los pedidos totales y por segundo, y el veredicto global (falla si cualquier umbral falla).
// Si una métrica no vino (por ejemplo, un escenario que no llegó a correr), lo dice en vez de inventar un número.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { toMarkdown, verdict } from './summary.js';

const data = {
  state: { testRunDurationMs: 120000 },
  metrics: {
    http_req_duration: { values: { 'p(95)': 123.456, 'p(99)': 250.1, med: 45.2, max: 900.9, avg: 60 } },
    http_req_failed: { values: { rate: 0.0042 } },
    http_reqs: { values: { count: 2400, rate: 20.01 } },
    'http_req_duration{scenario:hasta50}': {
      values: { 'p(95)': 110 }, thresholds: { 'p(95)<500': { ok: true } },
    },
    'http_req_failed{scenario:hasta50}': {
      values: { rate: 0 }, thresholds: { 'rate<0.01': { ok: true } },
    },
  },
};

describe('verdict', () => {
  test('todos los umbrales ok: pasa', () => {
    assert.equal(verdict(data), true);
  });
  test('un umbral que falla: falla', () => {
    const bad = structuredClone(data);
    bad.metrics['http_req_failed{scenario:hasta50}'].thresholds['rate<0.01'].ok = false;
    assert.equal(verdict(bad), false);
  });
  test('sin umbrales definidos: no pasa (una prueba sin criterio no aprueba)', () => {
    assert.equal(verdict({ metrics: { http_reqs: { values: { count: 1 } } } }), false);
  });
});

describe('toMarkdown', () => {
  const md = toMarkdown('Stress (runner)', data);

  test('título con el veredicto', () => {
    assert.match(md, /^### Stress \(runner\): ✅ pasa/);
  });
  test('cada umbral con su métrica, expresión, resultado y el VALOR MEDIDO', () => {
    // El informe necesita el número, no solo ✅: "p95 110 ms contra el límite de 500".
    assert.match(md, /✅ `http_req_duration\{scenario:hasta50\}` `p\(95\)<500` → medido: 110\.00 ms/);
    assert.match(md, /✅ `http_req_failed\{scenario:hasta50\}` `rate<0\.01` → medido: 0\.0000/);
  });
  test('si el valor medido no vino, lo dice', () => {
    const noVal = structuredClone(data);
    delete noVal.metrics['http_req_failed{scenario:hasta50}'].values.rate;
    assert.match(toMarkdown('X', noVal), /`rate<0\.01` → medido: sin dato/);
  });
  test('duraciones en ms con dos decimales, errores en %, pedidos y pedidos por segundo', () => {
    assert.match(md, /p95 123\.46 ms/);
    assert.match(md, /p99 250\.10 ms/);
    assert.match(md, /mediana 45\.20 ms/);
    assert.match(md, /máximo 900\.90 ms/);
    assert.match(md, /errores 0\.42 %/);
    assert.match(md, /2400 pedidos \(20\.01\/s\)/);
    assert.match(md, /duración 120 s/);
  });
  test('si falla un umbral, el título dice que falla y la línea lleva ❌', () => {
    const bad = structuredClone(data);
    bad.metrics['http_req_duration{scenario:hasta50}'].thresholds['p(95)<500'].ok = false;
    const out = toMarkdown('X', bad);
    assert.match(out, /^### X: ❌ falla/);
    assert.match(out, /❌ `http_req_duration\{scenario:hasta50\}` `p\(95\)<500`/);
  });
  test('métricas que no vinieron: "sin dato", no un número inventado', () => {
    const out = toMarkdown('Vacío', { metrics: {} });
    assert.match(out, /p95 sin dato/);
    assert.match(out, /errores sin dato/);
    assert.doesNotMatch(out, /NaN|undefined/);
  });
});
