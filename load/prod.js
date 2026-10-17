// load/prod.js — carga CORTA contra producción (Render, plan gratuito) (TP de Calidad, T10; PROJECT_ANALYSIS.md §197).
// Solo a mano (workflow "Carga", opción produccion) y nunca después del 25/10/2026, para no afectar el servicio cerca
// de la defensa. Umbrales fijados ANTES de correr (decisión del usuario, 2026-10-17): 10 usuarios durante 2 minutos,
// p95 < 2 s y errores < 1 %. El setup despierta la API primero (no cuenta en los umbrales).
//   k6 run -e BASE_URL=https://voluntariar-api-lxq7.onrender.com load/prod.js
import { wakeAndPickProjects, browse, writeSummary } from './common.js';

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],   // k6 no calcula p99 si no se le pide
  scenarios: {
    produccion: { executor: 'constant-vus', vus: 10, duration: '2m' },
  },
  thresholds: {
    'http_req_duration{scenario:produccion}': ['p(95)<2000'],
    'http_req_failed{scenario:produccion}': ['rate<0.01'],
  },
};

export const setup = wakeAndPickProjects;
export default (data) => browse(data, 1);
export const handleSummary = (data) => writeSummary('Carga en producción (Render, 10 usuarios, 2 min)', 'prod', data);
