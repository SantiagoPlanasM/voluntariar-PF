// Aviso de invitación al equipo de una ONG, arriba del Inicio del voluntario. Antes la invitación solo se veía en
// Configuración → Equipos y se perdía. Muestra solo las invitaciones pendientes (los equipos activos están en el
// perfil); al aceptar, queda "Ya sos parte" con el link al panel hasta salir del Inicio.
import { useState } from 'react';
import { Link } from 'react-router';
import { Users } from 'lucide-react';
import { TeamMembership } from '../../lib/api';
import { Avatar } from '../ui/Avatar';
import { TEAM_ROLE_HINT, TEAM_ROLE_LABEL } from '../team/teamRoles';
import { useTeamMemberships } from '../team/useTeamMemberships';

export function TeamInvites() {
  const { items, busy, error, accept, leave } = useTeamMemberships();
  // Las aceptadas acá siguen a la vista (con el link al panel) aunque ya no sean invitaciones.
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const shown = items.filter((m) => m.status === 'invited' || accepted.has(m.ngo_id));
  if (shown.length === 0) return null;

  const onAccept = async (m: TeamMembership) => {
    if (await accept(m)) setAccepted((s) => new Set(s).add(m.ngo_id));
  };

  return (
    <section aria-label="Invitaciones a equipos" className="rounded-2xl bg-surface border border-hairline overflow-hidden">
      {error && <p role="alert" className="px-4 pt-3 text-[13px] text-critical">{error}</p>}
      <ul>
        {shown.map((m) => (
          <li key={m.ngo_id} className="p-4 border-t first:border-t-0 border-hairline flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Avatar src={m.ngo_logo ?? undefined} name={m.ngo_name} kind="org" size={40} />
              <div className="flex-1 min-w-0">
                {m.status === 'invited' ? (<>
                  <p className="text-[15px] font-semibold">{m.ngo_name} te invitó a su equipo</p>
                  <p className="text-[13px] text-ink-soft">{TEAM_ROLE_LABEL[m.role]}: {TEAM_ROLE_HINT[m.role]}</p>
                </>) : (
                  <p className="text-[15px] font-semibold">Ya sos parte del equipo de {m.ngo_name}.</p>
                )}
              </div>
            </div>
            {m.status === 'invited' ? (
              <div className="flex gap-2">
                <button type="button" disabled={busy === m.ngo_id} onClick={() => void onAccept(m)} aria-label={`Aceptar invitación de ${m.ngo_name}`}
                  className="flex-1 h-10 rounded-[10px] bg-ink text-on-ink text-[14px] font-bold disabled:opacity-50">Aceptar</button>
                <button type="button" disabled={busy === m.ngo_id} onClick={() => void leave(m)} aria-label={`Rechazar invitación de ${m.ngo_name}`}
                  className="flex-1 h-10 rounded-[10px] bg-surface-soft text-ink text-[14px] font-bold disabled:opacity-50">Rechazar</button>
              </div>
            ) : (
              <Link to={`/equipo/${m.ngo_id}`} aria-label={`Abrir el panel de ${m.ngo_name}`}
                className="h-10 rounded-[10px] bg-ink text-on-ink text-[14px] font-bold inline-flex items-center justify-center gap-2">
                <Users size={18} strokeWidth={1.75} aria-hidden="true" />Abrir el panel
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
