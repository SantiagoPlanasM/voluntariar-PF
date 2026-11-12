// src/app/components/SponsorshipPointForm.tsx — el formulario de un punto del acuerdo de patrocinio.
//
// Uno solo para las dos pantallas que arman puntos: el acuerdo (SponsorshipAgreementScreen, §327) y "Proponer" en el
// perfil de la empresa (CompanyOwnProfile, §329). No guarda nada: quien lo usa lleva el valor y decide qué hacer con
// "Listo" (los puntos van a un borrador, lib/sponsorshipDraft.ts). El valor y sus helpers están en lib/sponsorship.ts.
import { POINT_TYPE_LABEL, PointFormValue } from '../../lib/sponsorship';

const field = 'w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const btn = 'h-10 px-4 rounded-[10px] text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40';

interface Props {
  value: PointFormValue;
  onChange: (value: PointFormValue) => void;
  onDone: () => void;
  onCancel: () => void;
}

export function SponsorshipPointForm({ value, onChange, onDone, onCancel }: Props) {
  return (
    <div className="p-3 rounded-xl bg-surface-soft flex flex-col gap-2">
      <select aria-label="Tipo de punto" value={value.type} className={field}
        onChange={ev => onChange({ ...value, type: ev.target.value as PointFormValue['type'] })}>
        {Object.entries(POINT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input aria-label="Detalle del punto" maxLength={300} value={value.detail} className={field}
        placeholder="Ej: 10 empleados una jornada" onChange={ev => onChange({ ...value, detail: ev.target.value })} />
      {value.type === 'money' && (
        <input aria-label="Monto en pesos" type="number" min="1" value={value.amount} className={field}
          onChange={ev => onChange({ ...value, amount: ev.target.value })} />
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className={`${btn} flex-1 bg-ink text-on-ink`}>Listo</button>
        <button type="button" onClick={onCancel} className={`${btn} bg-surface text-ink`}>Cancelar</button>
      </div>
    </div>
  );
}
