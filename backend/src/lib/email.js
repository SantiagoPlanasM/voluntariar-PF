// src/lib/email.js
//
// Envío de emails transaccionales vía Resend (https://resend.com). Usa fetch
// nativo (Node 18+) en vez del SDK oficial, para no agregar una dependencia
// nueva solo para hacer un POST — la API de Resend es un REST simple.
//
// Configuración (variables de entorno):
//   RESEND_API_KEY  — obligatoria para que se manden emails de verdad.
//                      Sin ella, sendEmail() no falla: loguea y sigue (no
//                      bloquea el flujo principal, mismo criterio que las
//                      notificaciones in-app existentes, que ya son
//                      fire-and-forget con .catch(() => {})).
//   EMAIL_FROM      — remitente. Si no se configura, usa el dominio de
//                      pruebas de Resend (onboarding@resend.dev), que
//                      funciona out-of-the-box sin verificar un dominio
//                      propio — perfecto para desarrollo/demo, pero Resend
//                      limita a quién le podés mandar con ese remitente
//                      (solo al email con el que te registraste en Resend).
//                      Para producción real hace falta verificar un dominio
//                      propio en el panel de Resend y usar un EMAIL_FROM de
//                      ese dominio.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'VoluntariAR <onboarding@resend.dev>';

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

  if (!RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY no configurada — omitiendo envío a ${to}: "${subject}"`);
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[email] Resend respondió ${res.status} al mandar a ${to}: ${body}`);
      return { ok: false, error: `resend_${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    console.error(`[email] error de red al mandar a ${to}:`, err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendEmail };
