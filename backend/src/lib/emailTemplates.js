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

/** Se manda a quien se postuló cuando la ONG le agenda una entrevista (§261). `date` es AAAA-MM-DD. */
function interviewScheduledEmail({ volunteerName, projectTitle, ngoName, date, time, link, place, appUrl }) {
  const [y, m, d] = date.split('-');
  const where = [place && `Lugar: ${esc(place)}`, link && `Link: <a href="${esc(link)}">${esc(link)}</a>`].filter(Boolean);
  return {
    subject: `Entrevista para "${projectTitle}"`,
    html: wrapper(
      'Te agendaron una entrevista',
      `<p>Hola ${esc(volunteerName) || ''},</p>
       <p><strong>${esc(ngoName)}</strong> te propone una entrevista por tu postulación a
       <strong>"${esc(projectTitle)}"</strong> el <strong>${d}/${m}/${y} a las ${esc(time)}</strong>.</p>
       <p>${where.join('<br>')}</p>`,
      'Ver mis voluntariados',
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

/** Se manda a la ONG cuando una empresa propone patrocinar uno de sus proyectos. */
function sponsorProposalEmail({ ngoName, empresaName, projectTitle, projectId, appUrl }) {
  return {
    subject: `${empresaName} quiere patrocinar "${projectTitle}"`,
    html: wrapper(
      '¡Nueva propuesta de patrocinio!',
      `<p>Hola ${esc(ngoName) || ''},</p>
       <p><strong>${esc(empresaName)}</strong> propuso patrocinar tu proyecto <strong>"${esc(projectTitle)}"</strong>.</p>
       <p>Podés aceptar o rechazar la propuesta desde tu panel.</p>`,
      'Ver propuesta',
      appUrl ? `${appUrl}/ngo/dashboard/project/${projectId}` : undefined
    ),
  };
}

/** Se manda a la empresa cuando la ONG acepta o rechaza su propuesta de patrocinio. */
function sponsorDecisionEmail({ empresaName, projectTitle, ngoName, accepted, appUrl }) {
  return {
    subject: accepted
      ? `¡${ngoName} aceptó tu patrocinio de "${projectTitle}"!`
      : `Novedades sobre tu propuesta de patrocinio a "${projectTitle}"`,
    html: wrapper(
      accepted ? '¡Buenas noticias!' : 'Novedades sobre tu propuesta',
      accepted
        ? `<p>Hola ${esc(empresaName) || ''},</p>
           <p><strong>${esc(ngoName)}</strong> aceptó tu propuesta de patrocinio para <strong>"${esc(projectTitle)}"</strong>.</p>`
        : `<p>Hola ${esc(empresaName) || ''},</p>
           <p>Esta vez <strong>${esc(ngoName)}</strong> no aceptó tu propuesta para <strong>"${esc(projectTitle)}"</strong>.</p>`,
      'Ver mi empresa',
      appUrl ? `${appUrl}/company/profile` : undefined
    ),
  };
}

/** Confirmación para borrar la propia cuenta (§177). El link vence en 1 hora y sirve una sola vez. */
function accountDeletionEmail({ name, link }) {
  return {
    subject: 'Confirmá si querés borrar tu cuenta de VoluntariAR',
    html: wrapper(
      'Pediste borrar tu cuenta',
      `<p>Hola ${esc(name) || ''},</p>
       <p>Recibimos un pedido para <strong>borrar tu cuenta</strong> de VoluntariAR. Si fuiste vos, tocá el botón: vas a
          tener que confirmar una vez más. El link vence en <strong>1 hora</strong> y sirve una sola vez.</p>
       <p>Si no lo pediste, ignorá este email: tu cuenta sigue igual.</p>`,
      'Borrar mi cuenta',
      link
    ),
  };
}

/** "¿Olvidaste tu contraseña?" (§275). El link vence en 1 hora y sirve una sola vez. */
function passwordResetEmail({ name, link }) {
  return {
    subject: 'Elegí una contraseña nueva para VoluntariAR',
    html: wrapper(
      'Restablecer tu contraseña',
      `<p>Hola ${esc(name) || ''},</p>
       <p>Recibimos un pedido para <strong>cambiar la contraseña</strong> de tu cuenta de VoluntariAR. Tocá el botón para
          elegir una nueva. El link vence en <strong>1 hora</strong> y sirve una sola vez.</p>
       <p>Si no lo pediste, ignorá este email: tu contraseña sigue siendo la misma.</p>`,
      'Elegir una contraseña nueva',
      link
    ),
  };
}

module.exports = {
  newEnrollmentEmail, enrollmentApprovedEmail, enrollmentRejectedEmail, interviewScheduledEmail,
  sponsorProposalEmail, sponsorDecisionEmail, accountDeletionEmail, passwordResetEmail,
  esc, // lo reusa lib/email.js para el aviso del modo prueba
};
