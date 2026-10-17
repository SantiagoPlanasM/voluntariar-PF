// load/common.js — lo compartido por los escenarios de carga de k6 (TP de Calidad, T10; PROJECT_ANALYSIS.md §197).
// SOLO LECTURA: GET /api/projects, /api/stats y el detalle de un proyecto. Nunca login, registro, donaciones ni
// subidas (los limitadores devolverían 429 y no se crean datos). BASE_URL: la API (por defecto, la local).
import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Trend, Rate } from 'k6/metrics';
import { toMarkdown } from './lib/summary.js';

export const BASE = (__ENV.BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

// Métricas propias del tramo "quiebre" del stress: se MIDEN sin umbral (para encontrar dónde se degrada).
export const quiebreDuracion = new Trend('quiebre_duracion', true);
export const quiebreErrores = new Rate('quiebre_errores');

// setup(): despierta la API (Render gratis tarda ~1 min) y elige proyectos para el detalle. No cuenta en los
// umbrales, que están acotados a cada escenario.
export function wakeAndPickProjects() {
  let up = false;
  for (let i = 0; i < 10 && !up; i++) {
    const r = http.get(`${BASE}/health`, { timeout: '60s', tags: { name: 'setup' } });
    up = r.status === 200;
    if (!up) sleep(15);
  }
  if (!up) exec.test.abort(`La API no respondió en ${BASE}/health`);
  const list = http.get(`${BASE}/api/projects?limit=20`, { tags: { name: 'setup' } });
  const projects = list.status === 200 ? list.json('projects') || [] : [];
  return { ids: projects.map((p) => p.id) };
}

// Una "visita": listado, números de la portada y el detalle de un proyecto al azar; después, tiempo de lectura.
export function browse(data, thinkSeconds) {
  const reads = [
    ['GET /api/projects', `${BASE}/api/projects?limit=20`],
    ['GET /api/stats', `${BASE}/api/stats`],
  ];
  if (data.ids.length) {
    reads.push(['GET /api/projects/:id', `${BASE}/api/projects/${data.ids[Math.floor(Math.random() * data.ids.length)]}`]);
  }
  for (const [name, url] of reads) {
    const r = http.get(url, { tags: { name } });
    check(r, { [`${name} → 200`]: (x) => x.status === 200 });
    if (exec.scenario.name === 'quiebre') {
      quiebreDuracion.add(r.timings.duration);
      quiebreErrores.add(r.status !== 200);
    }
  }
  sleep(thinkSeconds);
}

// handleSummary(): Markdown por pantalla y en load/reports/<archivo>.md, más el JSON completo de k6.
export function writeSummary(title, file, data, extra = '') {
  const md = toMarkdown(title, data) + extra;
  return {
    stdout: `\n${md}\n`,
    [`load/reports/${file}.md`]: md,
    [`load/reports/${file}.json`]: JSON.stringify(data, null, 2),
  };
}
