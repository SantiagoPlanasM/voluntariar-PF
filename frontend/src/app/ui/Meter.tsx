// Barras de progreso y la "doble meta" (DESIGN.md → Doble meta): transparencia de cuánto falta y para qué.
// Azul = dinero, verde = personas. El valor siempre va escrito: el color nunca es la única señal.
import { useEffect, useState } from 'react';

const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
export const formatMoney = (n: number) => `$ ${nf.format(Number.isFinite(n) ? n : 0)}`;

export function pct(value: number | string | null | undefined, goal: number | string | null | undefined): number {
  const v = Number(value), g = Number(goal);
  if (!g || !Number.isFinite(v) || !Number.isFinite(g)) return 0;
  return Math.max(0, Math.min(100, Math.round((v / g) * 100)));
}

/** Barra de 6 px que se llena en 600 ms al aparecer. `thin` = 3 px (el vínculo). */
export function Meter({ value, tone, thin, label }: { value: number; tone: 'money' | 'people'; thin?: boolean; label?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`w-full rounded-full bg-hairline overflow-hidden ${thin ? 'h-[3px]' : 'h-1.5'}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-[600ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${tone === 'money' ? 'bg-brand' : 'bg-people'}`}
        style={{ width: `${shown}%` }}
      />
    </div>
  );
}

interface DualGoalProps {
  fundingGoal: number;
  currentFunding: number;
  volunteersNeeded: number;
  currentVolunteers: number;
  /** Página de detalle: números más grandes. */
  large?: boolean;
}

export function DualGoal({ fundingGoal, currentFunding, volunteersNeeded, currentVolunteers, large }: DualGoalProps) {
  const hasMoney = fundingGoal > 0;
  const hasPeople = volunteersNeeded > 0;
  const raised = Number(currentFunding) || 0;
  return (
    <div className="flex flex-col gap-3">
      {hasMoney ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold text-ink-soft">Financiamiento</span>
            <span className={large ? 'text-[22px] font-extrabold tracking-[-0.3px]' : 'text-[15px] font-bold'}>
              <span className="text-brand-text">{formatMoney(raised)}</span>{' '}
              <span className="text-ink-muted font-semibold text-[15px]">de {formatMoney(fundingGoal)}</span>
            </span>
          </div>
          <Meter value={pct(raised, fundingGoal)} tone="money" label="Financiamiento" />
        </div>
      ) : raised > 0 ? (
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-semibold text-ink-soft">Recaudado en donaciones</span>
          <span className="text-[15px] font-bold text-brand-text">{formatMoney(raised)}</span>
        </div>
      ) : null}
      {hasPeople && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold text-ink-soft">Voluntarios</span>
            <span className={large ? 'text-[22px] font-extrabold tracking-[-0.3px]' : 'text-[15px] font-bold'}>
              <span className="text-people-text">{currentVolunteers}</span>{' '}
              <span className="text-ink-muted font-semibold text-[15px]">de {volunteersNeeded} lugares</span>
            </span>
          </div>
          <Meter value={pct(currentVolunteers, volunteersNeeded)} tone="people" label="Voluntarios" />
        </div>
      )}
    </div>
  );
}
