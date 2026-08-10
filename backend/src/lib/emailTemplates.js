// src/lib/emailTemplates.js
//
// Plantillas HTML mínimas para los emails transaccionales. Deliberadamente
// simples (sin tabla de layout tipo Outlook, sin imágenes embebidas) — son
// legibles en cualquier cliente de correo, que es lo que importa para un
// MVP. Cada función devuelve { subject, html }.

const BRAND_COLOR = '#059669'; // emerald-600, el mismo verde que usa la UI

// Los valores que arman estos templates (nombre de usuario, título de
// proyecto, nombre de ONG) los escribe el propio usuario al registrarse o
// crear un proyecto — hay que escaparlos antes de insertarlos en el HTML del
// email. No es tanto un riesgo de ejecución (los clientes de correo no
// corren <script>), pero sin este escape alguien podría romper el layout
// del email o inyectar un link/imagen engañosa poniendo HTML crudo como
// "nombre". Costo mínimo, sin razón para no hacerlo.
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function wrapper(title, bodyHtml, ctaText, ctaUrl) {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="color: ${BRAND_COLOR}; font-size: 20px; margin-bottom: 16px;">${esc(title)}</h1>
      <div style="color: #374151; font-size: 14px; line-height: 1.6;">${bodyHtml}</div>
      ${ctaUrl ? `
        <a href="${ctaUrl}" style="display: inline-block; margin-top: 20px; padding: 10px 20px;
           background: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; border-radius: 10px;
           font-size: 14px; font-weight: 600;">${esc(ctaText)}</a>
      ` : ''}
      <p style="color: #9ca3af; font-size: 11px; margin-top: 32px;">
        VoluntariAR — este es un email automático, no hace falta responderlo.
      </p>
    </div>
  `;
}

/** Se manda a la ONG cuando un voluntario se inscribe a uno de sus proyectos. */
function newEnrollmentEmail({ ngoName, volunteerName, projectTitle, projectId, appUrl }) {
  return {
    subject: `Nueva solicitud de inscripción en "${projectTitle}"`, // el subject no es HTML, no necesita escape
    html: wrapper(
      '¡Tenés una nueva solicitud!',
      `<p>Hola ${esc(ngoName) || ''},</p>
       <p><strong>${esc(volunteerName)}</strong> quiere sumarse a tu proyecto <strong>"${esc(projectTitle)}"</strong>.</p>
       <p>Podés revisar la solicitud y aprobarla o rechazarla desde tu panel.</p>`,
      'Ver solicitud',
      appUrl ? `${appUrl}/ngo/dashboard/project/${projectId}` : undefined
    ),
  };
}

/** Se manda al voluntario cuando su inscripción es aprobada. */
function enrollmentApprovedEmail({ volunteerName, projectTitle, ngoName, appUrl }) {
  return {
    subject: `¡Tu inscripción en "${projectTitle}" fue aprobada!`,
    html: wrapper(
      '¡Buenas noticias!',
      `<p>Hola ${esc(volunteerName) || ''},</p>
       <p><strong>${esc(ngoName)}</strong> aprobó tu inscripción a <strong>"${esc(projectTitle)}"</strong>.</p>
       <p>Ya podés ver los detalles y coordinar con la ONG desde "Mis participaciones".</p>`,
      'Ver mis participaciones',
      appUrl ? `${appUrl}/participation` : undefined
    ),
  };
}

/** Se manda al voluntario cuando su inscripción es rechazada. */
function enrollmentRejectedEmail({ volunteerName, projectTitle, ngoName, appUrl }) {
  return {
    subject: `Novedades sobre tu inscripción en "${projectTitle}"`,
    html: wrapper(
      'Novedades sobre tu inscripción',
      `<p>Hola ${esc(volunteerName) || ''},</p>
       <p>Esta vez <strong>${esc(ngoName)}</strong> no pudo sumarte a <strong>"${esc(projectTitle)}"</strong>.
       Puede ser por cupos limitados o por el perfil buscado — no te desanimes.</p>
       <p>Hay muchos otros proyectos esperando tu ayuda.</p>`,
      'Explorar otros proyectos',
      appUrl ? `${appUrl}/explore` : undefined
    ),
  };
}

module.exports = { newEnrollmentEmail, enrollmentApprovedEmail, enrollmentRejectedEmail };