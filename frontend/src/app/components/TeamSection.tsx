// "Equipos" en la Configuración del voluntario (§296): las invitaciones de ONG (aceptar o rechazar) y los equipos
// de los que forma parte (link a su panel y "Salir"). La mayoría no tiene ninguno: sin datos (o si falla la carga),
// no se muestra nada, para no ensuciar Configuración.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, TeamMembership } from '../../lib/api';
import { userMessage } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { useConfirm } from '../ui/UiProvider';
import { TEAM_ROLE_LABEL } from '../team/teamRoles';

export function TeamSection() {
  const [items, setItems] = useState<TeamMembership[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const confirm = useConfirm();

  useEffect(() => {
    let alive = true;
    api.team.mine().then(({ memberships }) => { if (alive) setItems(memberships); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const accept = async (m: TeamMembership) => {
    setBusy(m.ngo_id); setError('');
    try {
      const { membership } = await api.team.accept(m.ngo_id);
      setItems((xs) => xs.map((x) => (x.ngo_id === m.ngo_id ? membership : x)));
    } catch (e) { setError(userMessage(e, 'No pudimos aceptar la invitación.')); }
    finally { setBusy(null); }
  };

  const leave = async (m: TeamMembership) => {
    if (m.status === 'active') {
      const ok = await confirm({
        title: `¿Salir del equipo de ${m.ngo_name}?`, body: 'Dejás de ver su panel. Para volver, la ONG te tiene que invitar de nuevo.',
        confirmLabel: 'Salir', cancelLabel: 'Volver', danger: true,
      });
      if (!ok) return;
    }
    setBusy(m.ngo_id); setError('');
    try {
      await api.team.leave(m.ngo_id);
      setItems((xs) => xs.filter((x) => x.ngo_id !== m.ngo_id));
    } catch (e) { setError(userMessage(e, 'No pudimos hacerlo. Probá de nuevo.')); }
    finally { setBusy(null); }
  };

  if (items.length === 0) return null;
  return (
    <section aria-label="Equipos" className="flex flex-col gap-2">
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
