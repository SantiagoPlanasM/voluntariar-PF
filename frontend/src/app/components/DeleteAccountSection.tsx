// src/app/components/DeleteAccountSection.tsx
//
// "Borrar mi cuenta" en los tres perfiles propios (§178; backend en §177). No borra nada: pide confirmar en la
// pantalla (sin window.confirm) y manda un email con un link que vence en 1 hora. El borrado se confirma en
// /cuenta/borrar (DeleteAccountPage). A una ONG le advierte que se borran sus proyectos y las inscripciones de otros.
import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { userMessage } from '../../lib/format';

const NETWORK_ERROR = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';

export function DeleteAccountSection() {
  const { user } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const send = async () => {
    setError('');
    setSending(true);
    try {
      await api.auth.requestDeletion();
      setSentTo(user?.email ?? 'tu casilla');
      setConfirming(false);
    } catch (err) {
      setError(userMessage(err, NETWORK_ERROR));
    } finally {
      setSending(false);
    }
  };

  const btn = 'px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50';
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-4">
      <p className="text-xs font-bold text-red-400 uppercase tracking-wide mb-2">Zona peligrosa</p>
      {!confirming ? (
        <button type="button" onClick={() => { setError(''); setSentTo(''); setConfirming(true); }}
          className={`${btn} text-red-600 hover:bg-red-50`}>
          Borrar mi cuenta
        </button>
      ) : (
        <div role="group" aria-label="¿Querés borrar tu cuenta?" className="space-y-2">
          <p className="text-sm text-gray-700">
            Te vamos a mandar un email con un link para confirmar. Al confirmar se borran tu cuenta y todo lo tuyo
            (perfil, inscripciones, mensajes, Momentos{user?.role === 'volunteer' ? ', CV' : ''})
            {user?.role === 'ngo' ? <>, <strong>tus proyectos y, con ellos, las inscripciones de los voluntarios</strong></> : null}.
            No se puede deshacer.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={send} disabled={sending} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>
              {sending ? 'Mandando…' : 'Mandarme el email'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={sending} className={`${btn} bg-gray-100 text-gray-700`}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}
      {sentTo && !error && (
        <p role="status" className="text-xs text-emerald-700 mt-2">
          Te mandamos un email a {sentTo} con el link para confirmar. Vence en 1 hora.
        </p>
      )}
    </div>
  );
}
