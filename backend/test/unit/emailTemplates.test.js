// test/unit/emailTemplates.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  newEnrollmentEmail, enrollmentApprovedEmail, enrollmentRejectedEmail,
} = require('../../src/lib/emailTemplates');

const ok = { ngoName: 'Sustentando', volunteerName: 'Juan Pérez', projectTitle: 'Reforestar el parque', projectId: 'proj-1', appUrl: 'http://localhost:5173' };

describe('newEnrollmentEmail', () => {
  test('arma un subject y html con los datos reales', () => {
    const { subject, html } = newEnrollmentEmail(ok);
    assert.match(subject, /Reforestar el parque/);
    assert.match(html, /Juan Pérez/);
    assert.match(html, /Sustentando/);
    assert.match(html, /http:\/\/localhost:5173\/ngo\/dashboard\/project\/proj-1/);
  });

  // ── Regresión del fix de HTML sin escapar (ver docs/PROJECT_ANALYSIS.md §21) ──
  test('SEGURIDAD — escapa HTML malicioso en el nombre del voluntario', () => {
    const { html } = newEnrollmentEmail({ ...ok, volunteerName: '<script>alert(1)</script>' });
    assert.equal(html.includes('<script>alert(1)</script>'), false, 'el <script> no debe pasar sin escapar');
    assert.match(html, /&lt;script&gt;/);
  });

  test('SEGURIDAD — escapa HTML malicioso en el título del proyecto', () => {
    const { html } = newEnrollmentEmail({ ...ok, projectTitle: '<img src=x onerror=alert(1)>' });
    assert.equal(html.includes('<img src=x onerror=alert(1)>'), false);
  });

  test('SEGURIDAD — escapa HTML malicioso en el nombre de la ONG', () => {
    const { html } = newEnrollmentEmail({ ...ok, ngoName: '"><svg onload=alert(1)>' });
    assert.equal(html.includes('"><svg onload=alert(1)>'), false);
  });
});

describe('enrollmentApprovedEmail / enrollmentRejectedEmail', () => {
  test('approved: subject positivo y link a participaciones', () => {
    const { subject, html } = enrollmentApprovedEmail(ok);
    assert.match(subject, /aprobada/i);
    assert.match(html, /\/participation/);
  });

  test('rejected: subject neutro y link a explorar', () => {
    const { subject, html } = enrollmentRejectedEmail(ok);
    assert.doesNotMatch(subject, /aprobada/i);
    assert.match(html, /\/explore/);
  });

  test('ambos escapan HTML malicioso también', () => {
    const malicious = { ...ok, volunteerName: '<script>x</script>' };
    assert.equal(enrollmentApprovedEmail(malicious).html.includes('<script>x</script>'), false);
    assert.equal(enrollmentRejectedEmail(malicious).html.includes('<script>x</script>'), false);
  });
});
