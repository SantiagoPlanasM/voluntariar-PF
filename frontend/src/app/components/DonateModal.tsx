// src/app/components/DonateModal.tsx
//
// "Donar" a un voluntariado (PLAN_FALTANTE.md, Etapa 9, §172; DESIGN.md → Donación). Pide el monto (pesos enteros, mismos
// topes que el backend), crea la donación (POST /api/donaciones) y manda al checkout de Mercado Pago. El pago se confirma
// después, cuando Mercado Pago avisa o cuando la persona vuelve a /donaciones/vuelta: acá no se acredita nada.
// La donación mensual del diseño necesita suscripciones de Mercado Pago, que todavía no existen: no se muestra.
import { useRef, useState } from 'react';
import { api } from '../../lib/api';
import { checkDonationAmount } from '../../lib/donations';
import { userMessage } from '../../lib/format';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { formatMoney } from '../ui/Meter';

const NETWORK_ERROR = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';
const PRESETS = [1000, 2500, 5000, 10000];

interface Props {
  projectId: string;
  projectTitle: string;
  onClose: () => void;
  /** Cómo se va al checkout (inyectable para los tests: jsdom no navega). */
  go?: (url: string) => void;
}

export function DonateModal({ projectId, projectTitle, onClose, go = (url) => window.location.assign(url) }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('2500');
  const [other, setOther] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const titleId = 'donate-modal-title';

  const amount = Number(value.replace(/\D/g, ''));
  const label = Number.isFinite(amount) && amount > 0 ? `Donar ${formatMoney(amount)}` : 'Donar';

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

  const pick = (n: number) => { setValue(String(n)); setOther(false); setError(''); };

  return (
    <Sheet
      title={`Donar a ${projectTitle}`}
      titleId={titleId}
      onClose={onClose}
      footer={(
        <div className="flex flex-col gap-2">
          {error && <p role="alert" className="text-[13px] font-medium text-critical">{error}</p>}
          <Button variant="donate" onClick={() => submit()} busy={sending} busyLabel="Preparando el pago…" className="w-full">{label}</Button>
          <p className="text-center text-xs text-ink-muted">Pagás en Mercado Pago. Modo prueba: no se cobra dinero real.</p>
        </div>
      )}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold text-ink-soft mb-2">Monto</legend>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((n) => {
              const on = !other && Number(value) === n;
              return (
                <button key={n} type="button" onClick={() => pick(n)} aria-pressed={on}
                  className={`h-[52px] rounded-xl text-[15px] font-bold border-[1.5px] transition-colors ${on ? 'border-brand bg-brand-soft text-brand-text' : 'border-transparent bg-surface-soft hover:bg-surface-pressed'}`}>
                  {formatMoney(n)}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => { setOther(true); setValue(''); setError(''); setTimeout(() => input.current?.focus(), 0); }} aria-pressed={other}
            className={`h-[52px] rounded-xl text-[15px] font-bold border-[1.5px] transition-colors ${other ? 'border-brand bg-brand-soft text-brand-text' : 'border-transparent bg-surface-soft hover:bg-surface-pressed'}`}>
            Otro monto
          </button>
        </fieldset>

        {other && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="donate-amount" className="text-xs font-semibold text-ink-soft">Monto en pesos</label>
            <input id="donate-amount" ref={input} inputMode="numeric" autoComplete="off" placeholder="1500"
              value={value} onChange={(e) => setValue(e.target.value)}
              className="w-full h-12 px-3.5 rounded-[10px] bg-surface-soft text-[15px] border-[1.5px] border-transparent focus:bg-surface focus:border-ink outline-none" />
            <p className="text-[13px] text-ink-muted">Entre $100 y $500.000, sin centavos.</p>
          </div>
        )}

        <p className="text-[13px] leading-[1.5] text-ink-soft">
          Tu aporte va directo a la cuenta de Mercado Pago de la ONG que organiza este voluntariado.
        </p>
      </form>
    </Sheet>
  );
}
