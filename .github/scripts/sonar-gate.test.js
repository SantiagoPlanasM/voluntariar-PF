// .github/scripts/sonar-gate.test.js — el quality gate del TP (docs/PLAN_CALIDAD_TP.md §0, D5).
// Criterio de aceptación (escrito antes del código): el gate BLOQUEA si hay al menos un bug crítico
// (BLOCKER o CRITICAL) abierto, si la duplicación supera el 5 % o si la cobertura del código nuevo es menor al
// 80 %. En los bordes exactos (5 % y 80 %) pasa. Si falta un dato obligatorio (duplicación, bugs), bloquea: un
// gate que no puede medir no aprueba. Si no hay código nuevo (Sonar no informa new_coverage), esa condición no
// aplica y se dice.
// Agregado (§191, decisión del usuario tras el run #7): también BLOQUEA si hay al menos una vulnerabilidad
// BLOCKER o CRITICAL abierta; si falta ese dato, bloquea.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateGate, parseMeasures, parseReportTask } = require('./sonar-gate');

const ok = { duplication: 1.2, newCoverage: 92.5, criticalBugs: 0, criticalVulnerabilities: 0 };
const failed = (r) => r.conditions.filter((c) => !c.ok).map((c) => c.name);

describe('evaluateGate', () => {
  test('todo dentro de los umbrales: pasa', () => {
    // Arrange: métricas sanas. Act:
    const r = evaluateGate(ok);
    // Assert:
    assert.equal(r.passed, true);
    assert.deepEqual(failed(r), []);
  });

  test('duplicación: 5 % exacto pasa, 5,1 % bloquea (valores límite)', () => {
    assert.equal(evaluateGate({ ...ok, duplication: 5 }).passed, true);
    const r = evaluateGate({ ...ok, duplication: 5.1 });
    assert.equal(r.passed, false);
    assert.deepEqual(failed(r), ['duplicacion']);
  });

  test('cobertura de código nuevo: 80 % exacto pasa, 79,9 % bloquea (valores límite)', () => {
    assert.equal(evaluateGate({ ...ok, newCoverage: 80 }).passed, true);
    const r = evaluateGate({ ...ok, newCoverage: 79.9 });
    assert.equal(r.passed, false);
    assert.deepEqual(failed(r), ['cobertura_codigo_nuevo']);
  });

  test('un bug crítico bloquea; cero pasa', () => {
    const r = evaluateGate({ ...ok, criticalBugs: 1 });
    assert.equal(r.passed, false);
    assert.deepEqual(failed(r), ['bugs_criticos']);
  });

  test('sin código nuevo (newCoverage null): la condición no aplica y lo dice', () => {
    const r = evaluateGate({ ...ok, newCoverage: null });
    assert.equal(r.passed, true);
    const c = r.conditions.find((x) => x.name === 'cobertura_codigo_nuevo');
    assert.equal(c.ok, true);
    assert.match(c.note, /sin código nuevo/);
  });

  test('una vulnerabilidad crítica bloquea; cero pasa', () => {
    // Arrange / Act
    const r = evaluateGate({ ...ok, criticalVulnerabilities: 1 });
    // Assert
    assert.equal(r.passed, false);
    assert.deepEqual(failed(r), ['vulnerabilidades_criticas']);
    assert.equal(evaluateGate({ ...ok, criticalVulnerabilities: 0 }).passed, true);
  });

  test('falta la duplicación, los bugs o las vulnerabilidades: bloquea (no se aprueba sin medir)', () => {
    assert.deepEqual(failed(evaluateGate({ ...ok, duplication: null })), ['duplicacion']);
    assert.deepEqual(failed(evaluateGate({ ...ok, criticalBugs: null })), ['bugs_criticos']);
    assert.deepEqual(failed(evaluateGate({ ...ok, criticalVulnerabilities: null })), ['vulnerabilidades_criticas']);
  });

  test('varias fallas a la vez se informan todas', () => {
    const r = evaluateGate({ duplication: 9, newCoverage: 10, criticalBugs: 3, criticalVulnerabilities: 2 });
    assert.equal(r.passed, false);
    assert.deepEqual(failed(r).sort(),
      ['bugs_criticos', 'cobertura_codigo_nuevo', 'duplicacion', 'vulnerabilidades_criticas']);
  });
});

describe('parseMeasures (respuesta de api/measures/component)', () => {
  test('lee la duplicación del valor y la cobertura nueva del período', () => {
    const r = parseMeasures({ component: { measures: [
      { metric: 'duplicated_lines_density', value: '3.4' },
      { metric: 'new_coverage', period: { index: 1, value: '81.25' } },
    ] } });
    assert.deepEqual(r, { duplication: 3.4, newCoverage: 81.25 });
  });

  test('también acepta la forma vieja con `periods`', () => {
    const r = parseMeasures({ component: { measures: [
      { metric: 'duplicated_lines_density', value: '0.0' },
      { metric: 'new_coverage', periods: [{ index: 1, value: '75.0' }] },
    ] } });
    assert.deepEqual(r, { duplication: 0, newCoverage: 75 });
  });

  test('si una métrica no viene, queda null (no 0)', () => {
    assert.deepEqual(parseMeasures({ component: { measures: [] } }), { duplication: null, newCoverage: null });
  });
});

describe('parseReportTask (.scannerwork/report-task.txt)', () => {
  test('lee clave=valor, con "=" dentro del valor', () => {
    const r = parseReportTask('projectKey=a_b\nceTaskUrl=https://sonarcloud.io/api/ce/task?id=AX1=\n\n');
    assert.equal(r.projectKey, 'a_b');
    assert.equal(r.ceTaskUrl, 'https://sonarcloud.io/api/ce/task?id=AX1=');
  });
});
