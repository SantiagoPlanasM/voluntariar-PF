// load/soak.js — prueba de ESFUERZO SOSTENIDO (TP de Calidad, T10; PROJECT_ANALYSIS.md §197).
// Carga normal y constante durante un rato largo, para ver si la API se degrada con el tiempo (memoria, conexiones).
// Umbrales fijados ANTES de correr (decisión del usuario, 2026-10-17): 20 usuarios durante 10 minutos,
// p95 < 300 ms y errores < 1 %. SOAK_DURATION permite una corrida corta de prueba (no es la oficial).
//   k6 run -e BASE_URL=http://localhost:3001 load/soak.js
import { wakeAndPickProjects, browse, writeSummary } from './common.js';

const duration = __ENV.SOAK_DURATION || '10m';

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],   // k6 no calcula p99 si no se le pide
  scenarios: {
    sostenido: { executor: 'constant-vus', vus: 20, duration },
  },
  thresholds: {
    'http_req_duration{scenario:sostenido}': ['p(95)<300'],
    'http_req_failed{scenario:sostenido}': ['rate<0.01'],
  },
};

export const setup = wakeAndPickProjects;
export default (data) => browse(data, 1);
export const handleSummary = (data) => writeSummary(`Esfuerzo sostenido (20 usuarios, ${duration})`, 'soak', data);
