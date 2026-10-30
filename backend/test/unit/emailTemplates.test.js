// test/unit/emailTemplates.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  newEnrollmentEmail, enrollmentApprovedEmail, enrollmentRejectedEmail, passwordResetEmail, passwordChangedEmail,
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

// §275: "¿Olvidaste tu contraseña?". El link va tal cual (lo arma el backend) y el nombre del usuario, escapado.
describe('passwordResetEmail', () => {
  const link = 'http://localhost:5173/restablecer?token=abc_DEF-123';

  test('asunto sobre la contraseña, el botón con el link, el vencimiento y qué hacer si no lo pediste', () => {
    const { subject, html } = passwordResetEmail({ name: 'Ana', link });
    assert.match(subject, /contraseña/i);
    assert.ok(html.includes(`href="${link}"`), 'el botón lleva el link');
    assert.match(html, /1 hora/);
    assert.match(html, /si no lo pediste/i);
    assert.match(html, /Hola Ana/);
  });

  test('SEGURIDAD — escapa HTML malicioso en el nombre', () => {
    const { html } = passwordResetEmail({ name: '<img src=x onerror=alert(1)>', link });
    assert.equal(html.includes('<img src=x'), false);
    assert.match(html, /&lt;img/);
  });
});

// §278: aviso de que la contraseña cambió. El botón va a la aplicación y el nombre, escapado.
describe('passwordChangedEmail', () => {
  test('asunto, qué hacer si no fuiste vos y el botón a la aplicación', () => {
    const { subject, html } = passwordChangedEmail({ name: 'Ana', appUrl: 'http://localhost:5173' });
    assert.match(subject, /tu contraseña .*cambió/i);
    assert.match(html, /si no fuiste vos/i);
    assert.match(html, /¿Olvidaste tu contraseña\?/);
    assert.ok(html.includes('href="http://localhost:5173"'));
    assert.match(html, /Hola Ana/);
  });

  test('SEGURIDAD — escapa HTML malicioso en el nombre', () => {
    const { html } = passwordChangedEmail({ name: '<script>x</script>', appUrl: 'http://localhost:5173' });
    assert.equal(html.includes('<script>x</script>'), false);
  });
});
