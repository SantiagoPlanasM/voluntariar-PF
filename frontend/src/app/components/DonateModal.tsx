// src/app/components/DonateModal.tsx
//
// "Donar" a un proyecto (PLAN_FALTANTE.md, Etapa 9, §172). Pide el monto (pesos enteros, mismos topes que el
// backend), crea la donación (POST /api/donaciones) y manda al checkout de Mercado Pago. El pago se confirma después,
// cuando Mercado Pago avisa o cuando la persona vuelve a /donaciones/vuelta: acá no se acredita nada.
import { useRef, useState } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { DONATION_PRESETS, checkDonationAmount, formatPesos } from '../../lib/donations';
import { userMessage } from '../../lib/format';
import { Modal } from './Modal';

const NETWORK_ERROR = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';

interface Props {
  projectId: string;
  projectTitle: string;
  onClose: () => void;
  /** Cómo se va al checkout (inyectable para los tests: jsdom no navega). */
  go?: (url: string) => void;
}

export function DonateModal({ projectId, projectTitle, onClose, go = (url) => window.location.assign(url) }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const titleId = 'donate-modal-title';

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    const checked = checkDonationAmount(value);
    if ('error' in checked) { setError(checked.error); return; }
    setSending(true);
    try {
      const { checkout_url } = await api.donaciones.create({ project_id: projectId, amount: checked.amount });
      go(checkout_url);
    } catch (err) {
      setError(userMessage(err, NETWORK_ERROR));
      setSending(false);
    }
  };

  return (
    <Modal onClose={onClose} labelledBy={titleId} initialFocusRef={input}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500" aria-hidden="true" />
          <h2 id={titleId} className="font-bold text-gray-900">Donar a {projectTitle}</h2>
        </div>
        <p className="text-xs text-gray-500">
          Vas a pagar en Mercado Pago. Es una demo en <strong>modo prueba</strong>: no se cobra dinero real.
        </p>
        <div className="flex gap-2">
          {DONATION_PRESETS.map((n) => (
            <button key={n} type="button" onClick={() => { setValue(String(n)); setError(''); }}
              className="flex-1 py-2 rounded-xl text-sm font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors">
              {formatPesos(n)}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="donate-amount" className="text-xs font-semibold text-gray-500 mb-1.5 block">Monto en pesos</label>
          <input id="donate-amount" ref={input} inputMode="numeric" autoComplete="off" placeholder="1500"
            value={value} onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
          <p className="text-xs text-gray-400 mt-1">Entre $100 y $500.000, sin centavos.</p>
        </div>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={sending}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5">
            {sending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {sending ? 'Preparando el pago…' : 'Ir a pagar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
