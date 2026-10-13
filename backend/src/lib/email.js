// src/lib/email.js
//
// Envío de emails transaccionales vía Resend (https://resend.com). Usa fetch
// nativo (Node 18+) en vez del SDK oficial, para no agregar una dependencia
// nueva solo para hacer un POST — la API de Resend es un REST simple.
//
// Configuración (variables de entorno, leídas en cada envío):
//   RESEND_API_KEY     — obligatoria para que se manden emails de verdad.
//                        Sin ella, sendEmail() no falla: loguea y sigue (no
//                        bloquea el flujo principal, mismo criterio que las
//                        notificaciones in-app existentes, que ya son
//                        fire-and-forget con .catch(() => {})).
//   EMAIL_FROM         — remitente. Si no se configura, usa el dominio de
//                        pruebas de Resend (onboarding@resend.dev), que
//                        funciona sin verificar un dominio propio pero Resend
//                        SOLO entrega con ese remitente al email con el que te
//                        registraste en Resend. Para mandarle a usuarios reales
//                        hace falta verificar un dominio propio en
//                        https://resend.com/domains y usar un EMAIL_FROM de él.
//   EMAIL_REDIRECT_TO  — MODO PRUEBA (opcional). Si está definida, TODOS los
//                        emails se mandan a esta casilla en vez de al
//                        destinatario real; el destinatario original queda
//                        visible en el asunto y en un aviso al principio del
//                        cuerpo. Sirve para desarrollo/demo con el remitente de
//                        pruebas (poné acá el email de tu cuenta de Resend).
//                        FALLA CERRADO: si el valor no parece un email, no se
//                        manda NADA (mejor eso que mandarle emails de prueba a
//                        usuarios reales por un error de tipeo).
//                        Con un dominio propio verificado, dejala vacía.

const { esc } = require('./emailTemplates');

const DEFAULT_FROM = 'VoluntariAR <onboarding@resend.dev>';
const looksLikeEmail = (s) => /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(s);

// Se lee en cada llamada (no al cargar el módulo): así la configuración es visible y testeable.
function getConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || DEFAULT_FROM,
    redirectTo: (process.env.EMAIL_REDIRECT_TO || '').trim() || null, // vacío = desactivado
  };
}

// Resend rechaza con 403 cuando se manda con el dominio de pruebas a alguien que no es el dueño de la
// cuenta. Dos redacciones conocidas del mismo error; ambas incluyen estas dos frases.
const isTestingDomainError = (status, body) =>
  status === 403 && /verify a domain/i.test(body) && /your own email address/i.test(body);

// La explicación (larga) se muestra una vez por proceso; el fallo de cada email se loguea igual.
let testingDomainHintShown = false;
function showTestingDomainHint(redirectTo) {
  if (testingDomainHintShown) return;
  testingDomainHintShown = true;
  console.error(
    '[email] Resend está en modo de pruebas: con el remitente onboarding@resend.dev solo se puede mandar '
    + 'al email con el que te registraste en Resend. Qué hacer:\n'
    + (redirectTo
      ? `  · EMAIL_REDIRECT_TO está activo (${redirectTo}) pero Resend igual lo rechazó: tiene que ser EXACTAMENTE `
        + 'el email de tu cuenta de Resend.\n'
      : '  · Desarrollo/demo: definí EMAIL_REDIRECT_TO=<el email de tu cuenta de Resend>; todos los emails te '
        + 'llegan a vos, con el destinatario original en el asunto.\n')
    + '  · Producción: verificá un dominio propio en https://resend.com/domains y definí EMAIL_FROM con una '
    + 'dirección de ese dominio (y dejá EMAIL_REDIRECT_TO vacío).'
  );
}

function applyRedirect({ to, subject, html }, redirectTo) {
  const originals = [].concat(to).join(', ');
  const banner = '<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #fef3c7; '
    + 'border: 1px solid #f59e0b; color: #92400e; padding: 10px 14px; border-radius: 8px; font-size: 12px; '
    + 'margin: 0 0 16px;"><strong>Modo prueba:</strong> este email estaba dirigido a '
    + `<strong>${esc(originals)}</strong> y se redirigió a esta casilla porque <code>EMAIL_REDIRECT_TO</code> `
    + 'está activo en el servidor.</div>';
  return { to: redirectTo, subject: `[para: ${originals}] ${subject}`, html: banner + html };
}

/**
 * Manda un email. Nunca lanza — devuelve { ok, skipped, error } para que el
 * caller pueda loguear si quiere, pero nunca debe usarse para bloquear una
 * respuesta HTTP (igual que las notificaciones in-app).
 */
async function sendEmail({ to, subject, html }) {
  if (!to || !subject || !html) {
    console.error('[email] faltan campos obligatorios (to/subject/html)');
    return { ok: false, error: 'missing_fields' };
  }

  const { apiKey, from, redirectTo } = getConfig();

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY no configurada — omitiendo envío a ${to}: "${subject}"`);
    return { ok: false, skipped: true };
  }

  let payload = { from, to, subject, html };
  if (redirectTo !== null) {
    if (!looksLikeEmail(redirectTo)) {
      console.error(`[email] EMAIL_REDIRECT_TO inválido ("${redirectTo}"): no se envía el email a ${to}. `
        + 'Corregí el valor o dejalo vacío.');
      return { ok: false, error: 'invalid_redirect' };
    }
    payload = { from, ...applyRedirect({ to, subject, html }, redirectTo) };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[email] Resend respondió ${res.status} al mandar a ${to}: ${body}`);
      if (isTestingDomainError(res.status, body)) {
        showTestingDomainHint(redirectTo);
        return { ok: false, error: 'resend_testing_domain' };
      }
      return { ok: false, error: `resend_${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    console.error(`[email] error de red al mandar a ${to}:`, err.message);
    return { ok: false, error: err.message };
  }
}

/** Una línea para el log de arranque. Nunca incluye la API key. */
function describeEmailConfig() {
  const { apiKey, from, redirectTo } = getConfig();
  if (!apiKey) return 'desactivado (sin RESEND_API_KEY: los emails se omiten)';
  if (redirectTo !== null && !looksLikeEmail(redirectTo)) {
    return `EMAIL_REDIRECT_TO inválido ("${redirectTo}"): NO se envía ningún email`;
  }
  if (redirectTo) {
    return `Resend → MODO PRUEBA: todo redirigido a ${redirectTo}`
      + (process.env.NODE_ENV === 'production' ? ' ⚠ ACTIVO EN PRODUCCIÓN: ningún usuario real recibe sus emails' : '');
  }
  if (/@resend\.dev>?$/i.test(from)) {
    return `Resend (${from}) — remitente de pruebas: solo entrega a tu propio email de Resend`;
  }
  return `Resend (${from})`;
}

module.exports = { sendEmail, describeEmailConfig };
