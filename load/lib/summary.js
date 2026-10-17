// load/lib/summary.js — reporte en Markdown de una corrida de k6 (TP de Calidad, T10; PROJECT_ANALYSIS.md §197).
// Lo usa handleSummary() de cada escenario. Corre DENTRO de k6 (no en Node): solo JavaScript estándar, sin APIs de
// Node ni librerías remotas. Los tests (summary.test.js) lo corren con Node.

const ms = (v) => (typeof v === 'number' && isFinite(v) ? `${v.toFixed(2)} ms` : 'sin dato');

// El valor medido de un umbral: lo que está antes del comparador ("p(95)<500" → values['p(95)']; "rate<0.01" →
// values.rate). Las duraciones con 2 decimales; las tasas (0 a 1) con 4.
function measured(m, expr) {
  const stat = expr.split(/[<>=!]/)[0].trim();
  const v = m && m.values ? m.values[stat] : undefined;
  if (typeof v !== 'number' || !isFinite(v)) return 'sin dato';
  return stat === 'rate' ? v.toFixed(4) : `${v.toFixed(2)} ms`;
}

function thresholdRows(data) {
  const rows = [];
  for (const [metric, m] of Object.entries((data && data.metrics) || {})) {
    for (const [expr, t] of Object.entries((m && m.thresholds) || {})) {
      rows.push({ metric, expr, ok: Boolean(t && t.ok), value: measured(m, expr) });
    }
  }
  return rows;
}

// Pasa solo si hay al menos un umbral y todos dieron ok: una prueba sin criterio no aprueba.
export function verdict(data) {
  const rows = thresholdRows(data);
  return rows.length > 0 && rows.every((r) => r.ok);
}

export function toMarkdown(title, data) {
  const metrics = (data && data.metrics) || {};
  const dur = (metrics.http_req_duration && metrics.http_req_duration.values) || {};
  const failed = metrics.http_req_failed && metrics.http_req_failed.values;
  const reqs = metrics.http_reqs && metrics.http_reqs.values;
  const seconds = data && data.state && typeof data.state.testRunDurationMs === 'number'
    ? `${Math.round(data.state.testRunDurationMs / 1000)} s` : 'sin dato';
  const errors = failed && typeof failed.rate === 'number' ? `${(failed.rate * 100).toFixed(2)} %` : 'sin dato';
  const volume = reqs && typeof reqs.count === 'number'
    ? `${reqs.count} pedidos (${typeof reqs.rate === 'number' ? reqs.rate.toFixed(2) : 'sin dato'}/s)` : 'pedidos sin dato';

  const lines = [
    `### ${title}: ${verdict(data) ? '✅ pasa' : '❌ falla'}`,
    '',
    `- Duración (todos los pedidos): p95 ${ms(dur['p(95)'])} · p99 ${ms(dur['p(99)'])} · mediana ${ms(dur.med)} · máximo ${ms(dur.max)}`,
    `- errores ${errors} · ${volume} · duración ${seconds}`,
    '',
    '**Umbrales (fijados antes de correr):**',
    '',
    ...thresholdRows(data).map((r) => `- ${r.ok ? '✅' : '❌'} \`${r.metric}\` \`${r.expr}\` → medido: ${r.value}`),
    '',
    '',
  ];
  return lines.join('\n');
}
