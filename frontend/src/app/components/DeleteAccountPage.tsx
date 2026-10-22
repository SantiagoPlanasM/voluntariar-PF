// src/app/components/DeleteAccountPage.tsx
//
// /cuenta/borrar?token=…: adonde lleva el email de confirmación (§178; backend en §177). No hace falta sesión: el link
// puede abrirse en otro dispositivo, y el código del link es lo que autoriza. Explica qué se borra y recién con
// "Sí, borrar mi cuenta" lo hace; después cierra la sesión (si había una en este navegador).
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { userMessage } from '../../lib/format';

const NETWORK_ERROR = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';

export function DeleteAccountPage() {
  const { logout } = useAuth();
  const token = new URLSearchParams(useLocation().search).get('token') ?? '';
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setError('');
    setDeleting(true);
    try {
      await api.auth.deleteAccount(token);
      logout();
      setDone(true);
    } catch (err) {
      setError(userMessage(err, NETWORK_ERROR));
      setDeleting(false);
    }
  };

  const card = (icon: React.ReactNode, title: string, body: React.ReactNode) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
      <div className="flex justify-center">{icon}</div>
      <h1 className="text-lg font-bold text-gray-900 text-center">{title}</h1>
      <div className="text-sm text-gray-600 space-y-2">{body}</div>
    </div>
  );
  const home = <Link to="/" className="inline-block px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700">Ir al inicio</Link>;

  let content: React.ReactNode;
  if (done) {
    content = card(<CheckCircle className="w-10 h-10 text-emerald-500" />, 'Tu cuenta se borró',
      <><p className="text-center">Gracias por haber sido parte de VoluntariAR.</p><div className="text-center">{home}</div></>);
  } else if (!token) {
    content = card(<XCircle className="w-10 h-10 text-gray-300" />, 'Este link no es válido',
      <><p className="text-center">Pedí uno nuevo desde tu perfil, con "Borrar mi cuenta".</p><div className="text-center">{home}</div></>);
  } else {
    content = card(<AlertTriangle className="w-10 h-10 text-red-500" />, 'Borrar tu cuenta', <>
      <p>Al confirmar se borran tu cuenta y todo lo que cuelga de ella: tu perfil, inscripciones, mensajes, notificaciones,
         Momentos, seguimientos y, si sos voluntario, tu CV.</p>
      <p><strong>Si sos una ONG</strong>, se borran también tus proyectos y, con ellos, las inscripciones de los voluntarios.</p>
      <p>Las donaciones que hiciste dejan de verse, pero lo que ya recaudó cada proyecto queda. <strong>No se puede deshacer.</strong></p>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <button type="button" onClick={confirm} disabled={deleting}
          className="px-4 py-2 rounded-xl text-sm font-bold bg-critical text-on-ink hover:opacity-90 disabled:opacity-60">
          {deleting ? 'Borrando…' : 'Sí, borrar mi cuenta'}
        </button>
        {home}
      </div>
    </>);
  }
  return <div className="min-h-screen bg-gray-50 px-4 py-16 max-w-md mx-auto">{content}</div>;
}
