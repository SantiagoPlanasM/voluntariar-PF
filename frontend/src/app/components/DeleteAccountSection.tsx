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

  const btn = 'h-10 px-3.5 rounded-[10px] text-[13px] font-bold transition-colors disabled:opacity-50';
  return (
    <section aria-label="Borrar la cuenta" className="rounded-xl bg-surface border border-hairline p-4 flex flex-col gap-2">
      {!confirming ? (
        <button type="button" onClick={() => { setError(''); setSentTo(''); setConfirming(true); }}
          className={`${btn} self-start -ml-3.5 text-critical hover:bg-surface-soft`}>
          Borrar mi cuenta
        </button>
      ) : (
        <div role="group" aria-label="¿Querés borrar tu cuenta?" className="space-y-2">
          <p className="text-[15px] leading-[1.45] text-ink-soft">
            Te vamos a mandar un email con un link para confirmar. Al confirmar se borran tu cuenta y todo lo tuyo
            (perfil, inscripciones, mensajes, Momentos{user?.role === 'volunteer' ? ', CV' : ''})
            {user?.role === 'ngo' ? <>, <strong>tus proyectos y, con ellos, las inscripciones de los voluntarios</strong></> : null}.
            No se puede deshacer.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={send} disabled={sending} className={`${btn} bg-critical text-white hover:opacity-90`}>
              {sending ? 'Mandando…' : 'Mandarme el email'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={sending} className={`${btn} bg-surface-soft text-ink`}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-[13px] font-medium text-critical">{error}</p>}
      {sentTo && !error && (
        <p role="status" className="text-[13px] font-semibold text-people-text">
          Te mandamos un email a {sentTo} con el link para confirmar. Vence en 1 hora.
        </p>
      )}
    </section>
  );
}
