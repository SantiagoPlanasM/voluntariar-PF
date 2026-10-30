// Las invitaciones y equipos de ONG del voluntario (GET /equipo/mias), con aceptar y salir/rechazar. Lo comparten
// "Equipos" (TeamSection: perfil y Configuración) y el aviso de invitación del Inicio (TeamInvites). Si la carga
// falla, la lista queda vacía: las dos pantallas se ocultan sin datos.
import { useEffect, useState } from 'react';
import { api, TeamMembership } from '../../lib/api';
import { userMessage } from '../../lib/format';
import { useConfirm } from '../ui/UiProvider';

export function useTeamMemberships() {
  const [items, setItems] = useState<TeamMembership[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const confirm = useConfirm();

  useEffect(() => {
    let alive = true;
    api.team.mine()
      .then(({ memberships }) => { if (alive) setItems(memberships); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  /** Devuelve true si se aceptó. */
  const accept = async (m: TeamMembership): Promise<boolean> => {
    setBusy(m.ngo_id); setError('');
    try {
      const { membership } = await api.team.accept(m.ngo_id);
      setItems((xs) => xs.map((x) => (x.ngo_id === m.ngo_id ? membership : x)));
      return true;
    } catch (e) { setError(userMessage(e, 'No pudimos aceptar la invitación.')); return false; }
    finally { setBusy(null); }
  };

  /** Rechaza una invitación o sale de un equipo activo (esto último, con confirmación). */
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

  return { items, busy, error, accept, leave };
}
