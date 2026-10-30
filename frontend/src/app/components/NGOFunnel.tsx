// src/app/components/NGOFunnel.tsx — el embudo de postulaciones del panel de la ONG (§284).
//
// Pedido en la entrevista a FONBEC: "ver dónde invertimos nuestro tiempo". Cada etapa con su cantidad y el porcentaje
// sobre el total de postulaciones; la barra hace visible dónde se cae la gente. Las rechazadas van aparte (no son una
// etapa del recorrido). Sin postulaciones no se muestra.
import type { NGOFunnelCounts } from '../../lib/api';
import { Meter, pct } from '../ui/Meter';

export function NGOFunnel({ funnel }: { funnel?: NGOFunnelCounts }) {
  if (!funnel || !(funnel.applications > 0)) return null;
  const stages = [
    { label: 'Postulaciones', n: funnel.applications },
    { label: 'Con entrevista', n: funnel.interviewed },
    { label: 'Aprobadas', n: funnel.approved },
    { label: 'Con horas certificadas', n: funnel.with_hours },
    { label: 'Rechazadas', n: funnel.rejected },
  ];
  return (
    <section aria-labelledby="embudo" className="rounded-xl bg-surface border border-hairline p-4">
      <h2 id="embudo" className="text-lg font-bold tracking-[-0.2px]">Embudo de postulaciones</h2>
      <p className="text-[13px] text-ink-soft mb-3">De todos tus voluntariados: dónde avanza y dónde se queda cada postulación.</p>
      <ul className="flex flex-col gap-2.5">
        {stages.map(({ label, n }, i) => {
          const share = pct(n, funnel.applications);
          return (
            <li key={label} className={`flex flex-col gap-1 ${i === stages.length - 1 ? 'pt-2 border-t border-hairline' : ''}`}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="font-semibold">{label}</span>
                <span className="text-ink-soft"><strong className="text-ink">{n}</strong> {share} %</span>
              </div>
              <Meter value={share} tone="people" thin label={`${label}: ${share} %`} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
