// Acceso al equipo desde el Panel de la ONG. En escritorio "Equipo" está en la barra lateral, pero en el celular
// no: se llegaba solo por Perfil → Configuración. La tarjeta lleva a /ngo/equipo y resume miembros e invitaciones;
// si la carga falla, el acceso queda igual, sin números.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Users } from 'lucide-react';
import { api, TeamMember } from '../../lib/api';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function summary(members: TeamMember[]): string {
  const active = members.filter((m) => m.status === 'active').length;
  const invited = members.length - active;
  if (members.length === 0) return 'Sumá voluntarios que te ayuden con las postulaciones o los Momentos.';
  return [
    active > 0 ? plural(active, 'miembro', 'miembros') : '',
    invited > 0 ? plural(invited, 'invitación pendiente', 'invitaciones pendientes') : '',
  ].filter(Boolean).join(' · ');
}

export function NGOTeamCard() {
  const [members, setMembers] = useState<TeamMember[] | null>(null);

  useEffect(() => {
    let alive = true;
    api.team.members().then(({ members }) => { if (alive) setMembers(members); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <Link to="/ngo/equipo" className="rounded-xl bg-surface border border-hairline min-h-[60px] px-4 py-3 flex items-center gap-3 hover:bg-surface-soft">
      <Users size={22} strokeWidth={1.75} className="flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="text-[15px] font-bold">Equipo</span>
        {members && <span className="text-[13px] text-ink-soft">{summary(members)}</span>}
      </span>
      <ChevronRight size={18} strokeWidth={1.75} className="text-ink-muted flex-shrink-0" aria-hidden="true" />
    </Link>
  );
}
