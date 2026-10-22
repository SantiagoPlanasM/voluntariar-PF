// src/app/components/PrivacyPage.tsx
//
// /privacidad: privacidad y términos de uso (PLAN_FALTANTE.md, Etapa 11, §179). Pública. Responsable: "VoluntariAR,
// proyecto final de la UCC", sin nombres ni email (decisión del usuario). Todo lo que dice está verificado en el código
// (ver PROJECT_ANALYSIS.md §179): si cambia el comportamiento de la app, hay que cambiar este texto.
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
      <h2 id={id} className="font-bold text-gray-900">{title}</h2>
      <div className="text-sm text-gray-600 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-emerald-700 font-semibold">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />Volver al inicio
        </Link>
        <header className="space-y-1">
          <h1 className="text-2xl font-black text-gray-900">Privacidad y términos de uso</h1>
          <p className="text-xs text-gray-400">Última actualización: 16 de octubre de 2026</p>
        </header>

        <Section id="priv-responsable" title="Quién es responsable">
          <p>VoluntariAR es un <strong>proyecto final</strong> de carrera de la <strong>Universidad Católica de Córdoba (UCC)</strong>.
             Es una <strong>demo académica</strong>: no es un servicio comercial y puede dejar de funcionar o reiniciarse en cualquier momento.</p>
        </Section>

        <Section id="priv-datos" title="Qué datos guardamos">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Tu cuenta:</strong> nombre, email y contraseña. La contraseña no se guarda tal cual: se guarda cifrada (bcrypt).</li>
            <li><strong>Tu perfil:</strong> lo que cargues (descripción, ubicación, foto). Los voluntarios, además, sus habilidades y, si lo suben, su CV.
                Las ONG y empresas, los datos de su organización.</li>
            <li><strong>Lo que hacés en la app:</strong> inscripciones y horas, proyectos que publicás, comentarios, reseñas, Momentos (fotos),
                mensajes, a quién seguís y notificaciones.</li>
            <li><strong>Donaciones:</strong> el monto, el proyecto y el estado del pago. Los datos de pago los maneja Mercado Pago.</li>
          </ul>
          <p>No usamos cookies de seguimiento ni herramientas de analítica. Para mantener tu sesión, guardamos un código de
             acceso en tu navegador, que se borra cuando cerrás sesión.</p>
        </Section>

        <Section id="priv-quien" title="Quién ve qué">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Público:</strong> los perfiles, los proyectos, los comentarios, las reseñas y los Momentos se ven sin iniciar sesión.</li>
            <li><strong>Privado:</strong> tus mensajes los ven solo vos y la otra persona. Tus donaciones las ves solo vos; la ONG recibe un aviso con el monto.</li>
            <li>Tu <strong>CV</strong> es privado: lo ves vos y lo puede abrir solo una ONG en cuyos voluntariados te postulaste (inscripción pendiente o aprobada),
                con un link que vence a los 10 minutos.</li>
          </ul>
        </Section>

        <Section id="priv-terceros" title="Con quién compartimos datos">
          <p>No vendemos ni cedemos tus datos. Para funcionar, la app usa estos servicios:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Render:</strong> donde corren la app y la base de datos.</li>
            <li><strong>Cloudinary:</strong> guarda las fotos y los CV (los CV como archivos privados).</li>
            <li><strong>Mercado Pago:</strong> procesa las donaciones. VoluntariAR nunca ve los datos de tu tarjeta: el pago se hace en la página de Mercado Pago.</li>
            <li><strong>Resend:</strong> envía los emails automáticos (avisos de inscripción, de patrocinio y la confirmación para borrar la cuenta).</li>
          </ul>
        </Section>

        <Section id="priv-tiempo" title="Cuánto tiempo los guardamos">
          <p>Mientras tengas la cuenta. Cuando la borrás, se borran tu cuenta y todo lo que cuelga de ella. Como es una demo, la base de datos
             también puede borrarse entera cuando termine el proyecto.</p>
        </Section>

        <Section id="priv-derechos" title="Tus derechos">
          <p>La Ley 25.326 de Protección de Datos Personales te da derecho a acceder a tus datos, corregirlos y pedir que se borren.
             En VoluntariAR:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Ves y corregís tus datos desde tu perfil.</li>
            <li>Borrás tu cuenta desde tu perfil, con <strong>"Borrar mi cuenta"</strong>: te llega un email con un link que vence en una hora y,
                al confirmarlo, se borra todo. Si sos una ONG, se borran también tus proyectos y sus inscripciones.</li>
          </ul>
        </Section>

        <Section id="priv-reglas" title="Reglas de uso">
          <ul className="list-disc pl-5 space-y-1">
            <li>Usá datos reales y no publiques contenido ofensivo, discriminatorio o que no sea tuyo. La app filtra algunas palabras, pero cada persona
                es responsable de lo que publica.</li>
            <li>Las ONG son responsables de la información de sus proyectos y de cómo tratan los datos de quienes se inscriben.</li>
            <li>El equipo del proyecto puede borrar contenido o cuentas que no respeten estas reglas.</li>
          </ul>
        </Section>

        <Section id="priv-limites" title="Limitaciones de esta demo">
          <ul className="list-disc pl-5 space-y-1">
            <li>Las donaciones funcionan en <strong>modo prueba</strong> de Mercado Pago: no se cobra dinero real.</li>
            <li>Los emails automáticos se envían <strong>al equipo del proyecto</strong> y no a cada persona: la cuenta de envío es de prueba.
                Por eso, para borrar tu cuenta puede hacer falta pedírselo al equipo.</li>
            <li>Al cambiar la foto de perfil, las fotos de perfil anteriores pueden quedar guardadas en Cloudinary.</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
