// El acceso a Equipo de los accesos del Panel (NGOShortcuts): lleva a /ngo/equipo y resume miembros e invitaciones;
// si la carga falla, el acceso queda igual, sin números.
import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { api, TeamMember } from '../../lib/api';
import { ShortcutCard } from './ShortcutCard';

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

  return <ShortcutCard to="/ngo/equipo" icon={Users} title="Equipo" detail={members ? summary(members) : undefined} />;
}
