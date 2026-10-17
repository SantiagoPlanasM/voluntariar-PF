// .github/scripts/sonar-gate.js — quality gate del TP de Calidad, evaluado con las métricas de SonarCloud.
//
// Por qué existe: el plan gratis de SonarCloud solo tiene el gate "Sonar way" (no permite gates propios), y el TP
// pide umbrales concretos (docs/PLAN_CALIDAD_TP.md §0, D5). Este script espera a que SonarCloud termine de procesar
// el análisis del run, lee sus métricas y sale con código 1 si alguna condición falla:
//   - bugs críticos: issues de tipo BUG con severidad BLOCKER o CRITICAL, abiertos → tiene que haber 0;
//   - vulnerabilidades críticas: ídem con tipo VULNERABILITY → 0 (agregado tras el run #7, PROJECT_ANALYSIS §191);
//   - duplicación: `duplicated_lines_density` de todo el proyecto → hasta 5 %;
//   - cobertura del código nuevo: `new_coverage` → al menos 80 % (si no hay código nuevo, no aplica).
// Sin dependencias (fetch de Node ≥ 18). Uso en el CI: `node .github/scripts/sonar-gate.js` con SONAR_TOKEN en el
// entorno, después de sonarqube-scan-action (que deja .scannerwork/report-task.txt).
const fs = require('node:fs');

const THRESHOLDS = { maxDuplication: 5, minNewCoverage: 80, maxCriticalBugs: 0, maxCriticalVulnerabilities: 0 };

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

function evaluateGate({ duplication, newCoverage, criticalBugs, criticalVulnerabilities }, t = THRESHOLDS) {
  const conditions = [
    duplication === null
      ? { name: 'duplicacion', value: null, limit: `<= ${t.maxDuplication} %`, ok: false, note: 'sin dato: no se aprueba sin medir' }
      : { name: 'duplicacion', value: duplication, limit: `<= ${t.maxDuplication} %`, ok: duplication <= t.maxDuplication },
    newCoverage === null
      ? { name: 'cobertura_codigo_nuevo', value: null, limit: `>= ${t.minNewCoverage} %`, ok: true, note: 'sin código nuevo: no aplica' }
      : { name: 'cobertura_codigo_nuevo', value: newCoverage, limit: `>= ${t.minNewCoverage} %`, ok: newCoverage >= t.minNewCoverage },
    criticalBugs === null
      ? { name: 'bugs_criticos', value: null, limit: `<= ${t.maxCriticalBugs}`, ok: false, note: 'sin dato: no se aprueba sin medir' }
      : { name: 'bugs_criticos', value: criticalBugs, limit: `<= ${t.maxCriticalBugs}`, ok: criticalBugs <= t.maxCriticalBugs },
    criticalVulnerabilities === null
      ? { name: 'vulnerabilidades_criticas', value: null, limit: `<= ${t.maxCriticalVulnerabilities}`, ok: false, note: 'sin dato: no se aprueba sin medir' }
      : { name: 'vulnerabilidades_criticas', value: criticalVulnerabilities, limit: `<= ${t.maxCriticalVulnerabilities}`, ok: criticalVulnerabilities <= t.maxCriticalVulnerabilities },
  ];
  return { passed: conditions.every((c) => c.ok), conditions };
}

// api/measures/component: las métricas "new_*" traen el valor en `period` (o `periods`, la forma vieja).
function parseMeasures(json) {
  const measures = (json && json.component && json.component.measures) || [];
  const find = (metric) => measures.find((m) => m.metric === metric);
  const dup = find('duplicated_lines_density');
  const cov = find('new_coverage');
  const covValue = cov && (cov.period ? cov.period.value : cov.periods && cov.periods[0] && cov.periods[0].value);
  return { duplication: dup ? num(dup.value) : null, newCoverage: cov ? num(covValue) : null };
}

// .scannerwork/report-task.txt: líneas clave=valor (el valor puede tener "=").
function parseReportTask(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

async function getJson(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${res.status} en ${url.replace(/token=[^&]*/g, 'token=***')}`);
  return res.json();
}

async function main() {
  const token = process.env.SONAR_TOKEN;
  if (!token) throw new Error('Falta SONAR_TOKEN');
  const task = parseReportTask(fs.readFileSync(process.env.SONAR_REPORT_TASK || '.scannerwork/report-task.txt', 'utf8'));
  const base = task.serverUrl || 'https://sonarcloud.io';

  // Esperar a que SonarCloud procese ESTE análisis (hasta ~5 minutos).
  let ce;
  for (let i = 0; i < 60; i++) {
    ce = (await getJson(task.ceTaskUrl, token)).task;
    if (!['PENDING', 'IN_PROGRESS'].includes(ce.status)) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (ce.status !== 'SUCCESS') throw new Error(`El análisis de SonarCloud terminó en ${ce.status}`);

  const scope = new URLSearchParams();
  if (ce.pullRequest) scope.set('pullRequest', ce.pullRequest);
  else if (ce.branch) scope.set('branch', ce.branch);
  const q = (params) => `${new URLSearchParams({ ...params, ...Object.fromEntries(scope) })}`;

  const measures = parseMeasures(await getJson(
    `${base}/api/measures/component?${q({ component: task.projectKey, metricKeys: 'duplicated_lines_density,new_coverage' })}`, token));
  const criticalCount = async (type) => num((await getJson(
    `${base}/api/issues/search?${q({ componentKeys: task.projectKey, types: type, severities: 'BLOCKER,CRITICAL', resolved: 'false', ps: '1' })}`, token)).total);
  const result = evaluateGate({
    ...measures,
    criticalBugs: await criticalCount('BUG'),
    criticalVulnerabilities: await criticalCount('VULNERABILITY'),
  });

  const where = ce.pullRequest ? `PR ${ce.pullRequest}` : `rama ${ce.branch || '(principal)'}`;
  const rows = result.conditions.map((c) =>
    `| ${c.name} | ${c.value === null ? '—' : c.value} | ${c.limit} | ${c.ok ? '✅' : '❌'} ${c.note || ''} |`);
  const report = [
    `### Quality gate del TP (SonarCloud, ${where}): ${result.passed ? '✅ pasa' : '❌ bloquea'}`,
    '', '| Condición | Valor | Umbral | Resultado |', '|---|---|---|---|', ...rows,
    '', `Análisis: ${task.dashboardUrl || base}`, '',
  ].join('\n');
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  if (!result.passed) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => { console.error(`sonar-gate: ${err.message}`); process.exitCode = 1; });
}

module.exports = { evaluateGate, parseMeasures, parseReportTask, THRESHOLDS };
