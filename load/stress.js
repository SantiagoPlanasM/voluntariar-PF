// load/stress.js — prueba de STRESS (TP de Calidad, T10; PROJECT_ANALYSIS.md §197).
// Rampa de usuarios virtuales por encima de lo normal para ver cuándo se degrada la API. Umbrales fijados ANTES de
// correr (decisión del usuario, 2026-10-17): hasta 50 usuarios, p95 < 500 ms y errores < 1 %. De 50 a 100 usuarios
// ("quiebre") se mide sin umbral. Pensado para el backend local efímero del runner (SQLite + seed).
//   k6 run -e BASE_URL=http://localhost:3001 load/stress.js
import { wakeAndPickProjects, browse, writeSummary } from './common.js';

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],   // k6 no calcula p99 si no se le pide
  scenarios: {
    hasta50: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [{ duration: '1m', target: 25 }, { duration: '1m', target: 50 }, { duration: '30s', target: 50 }],
      gracefulRampDown: '0s',
    },
    quiebre: {
      executor: 'ramping-vus',
      startTime: '2m30s',
      startVUs: 50,
      stages: [{ duration: '1m', target: 100 }, { duration: '30s', target: 100 }, { duration: '30s', target: 0 }],
      gracefulRampDown: '0s',
    },
  },
  thresholds: {
    'http_req_duration{scenario:hasta50}': ['p(95)<500'],
    'http_req_failed{scenario:hasta50}': ['rate<0.01'],
  },
};

export const setup = wakeAndPickProjects;
export default (data) => browse(data, 0.5);

export function handleSummary(data) {
  const d = data.metrics.quiebre_duracion && data.metrics.quiebre_duracion.values;
  const e = data.metrics.quiebre_errores && data.metrics.quiebre_errores.values;
  const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : 'sin dato');
  const extra = [
    '**Quiebre (50 → 100 usuarios, sin umbral: se mide para el informe):**',
    '',
    `- p95 ${d ? fmt(d['p(95)']) : 'sin dato'} ms · máximo ${d ? fmt(d.max) : 'sin dato'} ms · errores ${e ? fmt(e.rate * 100) : 'sin dato'} %`,
    '',
  ].join('\n');
  return writeSummary('Stress (rampa hasta 100 usuarios)', 'stress', data, extra);
}
