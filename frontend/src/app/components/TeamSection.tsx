// "Equipos" del voluntario (§296): las invitaciones de ONG (aceptar o rechazar) y los equipos de los que forma
// parte (link a su panel y "Salir"). Está en su perfil y en Configuración. La mayoría no tiene ninguno: sin datos
// (o si falla la carga), no se muestra nada. El aviso de invitación lleva a /profile#equipos: el scroll al ancla se
// hace acá, una vez cargada la lista (react-router no lo hace y la sección aparece después).
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { Avatar } from '../ui/Avatar';
import { TEAM_ROLE_LABEL } from '../team/teamRoles';
import { useTeamMemberships } from '../team/useTeamMemberships';

export function TeamSection({ className = '' }: { className?: string }) {
  const { items, busy, error, accept, leave } = useTeamMemberships();

  const { hash } = useLocation();
  const section = useRef<HTMLElement>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (hash !== '#equipos' || items.length === 0 || scrolled.current) return;
    scrolled.current = true;
    section.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [hash, items]);

  if (items.length === 0) return null;
  return (
    <section ref={section} id="equipos" aria-label="Equipos" className={`flex flex-col gap-2 scroll-mt-4 ${className}`}>
      <h2 className="px-1 text-xs font-semibold text-ink-soft">Equipos</h2>
      {error && <p role="alert" className="px-1 text-[13px] text-critical">{error}</p>}
      <ul className="rounded-xl bg-surface border border-hairline overflow-hidden">
        {items.map((m) => (
          <li key={m.ngo_id} className="px-4 py-3 border-t first:border-t-0 border-hairline flex items-center gap-3">
            <Avatar src={m.ngo_logo ?? undefined} name={m.ngo_name} kind="org" size={36} />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold truncate">{m.ngo_name}</p>
              <p className="text-xs text-ink-soft">
                {m.status === 'invited' ? `Te invitó a su equipo: ${TEAM_ROLE_LABEL[m.role]}` : TEAM_ROLE_LABEL[m.role]}
              </p>
            </div>
            {m.status === 'invited' ? (
              <div className="flex gap-1.5 flex-shrink-0">
                <button type="button" disabled={busy === m.ngo_id} onClick={() => void accept(m)} aria-label={`Aceptar invitación de ${m.ngo_name}`}
                  className="h-9 px-3 rounded-[10px] bg-ink text-on-ink text-[13px] font-bold disabled:opacity-50">Aceptar</button>
                <button type="button" disabled={busy === m.ngo_id} onClick={() => void leave(m)} aria-label={`Rechazar invitación de ${m.ngo_name}`}
                  className="h-9 px-3 rounded-[10px] bg-surface-soft text-ink text-[13px] font-bold disabled:opacity-50">Rechazar</button>
              </div>
            ) : (
              <div className="flex gap-1.5 flex-shrink-0">
                <Link to={`/equipo/${m.ngo_id}`} aria-label={`Abrir el panel de ${m.ngo_name}`}
                  className="h-9 px-3 rounded-[10px] bg-ink text-on-ink text-[13px] font-bold inline-flex items-center">Panel</Link>
                <button type="button" disabled={busy === m.ngo_id} onClick={() => void leave(m)} aria-label={`Salir del equipo de ${m.ngo_name}`}
                  className="h-9 px-3 rounded-[10px] text-critical text-[13px] font-bold hover:bg-surface-soft disabled:opacity-50">Salir</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
