// src/app/components/CertificatePage.tsx — certificado de participación (§269).
//
// /certificado/:enrollmentId: para una postulación propia aprobada en un voluntariado FINALIZADO, una página lista para
// imprimir o guardar como PDF (window.print, sin librería de PDF). Los datos salen de GET /enrollments/my: si la
// postulación no está ahí (no es propia), no está aprobada o el voluntariado no terminó, no hay certificado. Las horas
// son las que cargó la ONG (verificadas), no un auto-reporte.
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Loader2 } from 'lucide-react';
import { api, EnrollmentWithProject } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { userMessage } from '../../lib/format';
import { LogoMark } from '../ui/Logo';

export function CertificatePage() {
  const { enrollmentId } = useParams();
  const { user } = useAuth();
  const [item, setItem] = useState<EnrollmentWithProject | null | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api.enrollments.my()
      .then(({ enrollments }) => setItem(enrollments.find(e => e.id === enrollmentId
        && e.status === 'approved' && e.project_status === 'completed') ?? null))
      .catch(e => setError(userMessage(e, 'No pudimos cargar el certificado. Revisá tu conexión.')));
  }, [user, enrollmentId]);

  const notice = (text: string) => (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center bg-canvas">
      <p className="text-[15px] text-ink-soft">{text}</p>
      <Link to="/participation" className="text-[15px] font-semibold underline">Ir a Mis voluntariados</Link>
    </div>
  );
  if (!user) return notice('Iniciá sesión para ver tu certificado.');
  if (error) return notice(error);
  if (item === undefined) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-ink-muted" aria-label="Cargando" /></div>;
  if (!item) return notice('Este certificado no está disponible');

  const hours = Number(item.hours_logged) || 0;
  const issued = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-canvas-soft print:bg-white py-8 px-4 flex flex-col items-center gap-4">
      <article aria-label="Certificado de participación"
        className="w-full max-w-[720px] bg-white text-gray-900 rounded-2xl border-4 border-double border-gray-300 px-8 py-12 text-center flex flex-col items-center gap-4 print:border-gray-400">
        <LogoMark size={40} />
        <p className="text-sm tracking-[0.2em] uppercase text-gray-600">Certificado de participación</p>
        <p className="text-base text-gray-700">VoluntariAR certifica que</p>
        <p className="text-3xl font-bold">{user.name}</p>
        <p className="text-base text-gray-700">participó como voluntario/a en</p>
        <p className="text-2xl font-semibold">{item.title}</p>
        <p className="text-base text-gray-700">organizado por <strong>{item.ngo_name}</strong></p>
        {hours > 0 && <p className="text-base font-semibold">{`${hours} ${hours === 1 ? 'hora verificada' : 'horas verificadas'} por la ONG`}</p>}
        <p className="text-sm text-gray-600 mt-4">Emitido el {issued}</p>
      </article>
      <div className="flex gap-3 print:hidden">
        <button type="button" onClick={() => window.print()}
          className="h-10 px-4 rounded-[10px] bg-ink text-on-ink text-sm font-semibold">Imprimir o guardar como PDF</button>
        <Link to="/participation" className="h-10 px-4 rounded-[10px] bg-surface-soft text-ink text-sm font-semibold inline-flex items-center">Volver</Link>
      </div>
    </div>
  );
}
