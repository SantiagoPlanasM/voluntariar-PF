// "Acceso del equipo" (/ngo/equipo, §296): el dueño de la ONG suma voluntarios que lo ayudan, con un rol cada uno.
// No es el directorio de NGOEmpleados (fichas sin cuenta): acá cada persona tiene su cuenta y entra con ella.
// La persona invitada acepta desde el aviso del Inicio o desde "Equipos" en su perfil; hasta entonces no ve nada.
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { api, TeamMember, TeamRole } from '../../lib/api';
import { userMessage } from '../../lib/format';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { InlineError } from './LoadError';
import { Avatar } from '../ui/Avatar';
import { PROFILE_FIELD } from '../ui/fieldStyles';
import { useConfirm } from '../ui/UiProvider';
import { TEAM_ROLE_HINT, TEAM_ROLE_LABEL, TEAM_ROLES } from '../team/teamRoles';

export function NGOTeam() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('coordinator');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const confirm = useConfirm();
  const latest = useLatestRequest();
  const emailId = useId();
  const roleId = useId();

  const load = async () => {
    const req = latest.start();
    setLoading(true); setLoadError('');
    try {
      const { members } = await api.team.members();
      if (latest.isLatest(req)) setMembers(members);
    } catch (e) {
      if (latest.isLatest(req)) setLoadError(userMessage(e, 'No pudimos cargar tu equipo. Revisá tu conexión.'));
    } finally { if (latest.isLatest(req)) setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const invite = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setInviting(true); setError('');
    try {
      const { member } = await api.team.invite(email.trim(), role);
      setMembers((ms) => [...ms, member]);
      setEmail('');
    } catch (e) { setError(userMessage(e, 'No pudimos mandar la invitación.')); }
    finally { setInviting(false); }
  };

  const changeRole = async (m: TeamMember, next: TeamRole) => {
    setError('');
    try {
      const { member } = await api.team.setRole(m.user_id, next);
      setMembers((ms) => ms.map((x) => (x.user_id === m.user_id ? member : x)));
    } catch (e) { setError(userMessage(e, 'No pudimos cambiar el rol.')); }
  };

  const remove = async (m: TeamMember) => {
    const ok = await confirm({
      title: `¿Sacar a ${m.name} del equipo?`,
      body: 'Deja de ver las postulaciones y de poder publicar en nombre de la ONG. Podés volver a invitarla.',
      confirmLabel: 'Sacar', cancelLabel: 'Volver', danger: true,
    });
    if (!ok) return;
    setError('');
    try {
      await api.team.remove(m.user_id);
      setMembers((ms) => ms.filter((x) => x.user_id !== m.user_id));
    } catch (e) { setError(userMessage(e, 'No pudimos sacarla del equipo.')); }
  };

  return (
    <div className="min-h-screen bg-canvas-soft pb-8">
      <div className="max-w-[640px] mx-auto px-4 pt-2 md:pt-8 flex flex-col gap-5">
        <header className="flex items-center gap-1 -ml-3">
          <Link to="/ngo/dashboard" aria-label="Volver" className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-soft">
            <ArrowLeft size={22} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.3px]">Acceso del equipo</h1>
            <p className="text-[13px] text-ink-soft">Voluntarios que te ayudan a gestionar la ONG, cada uno con su cuenta.</p>
          </div>
        </header>

        <form onSubmit={invite} className="rounded-xl bg-surface border border-hairline p-4 flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">Invitar a alguien</h2>
          <div className="flex flex-col gap-1">
            <label htmlFor={emailId} className="text-xs font-semibold text-ink-soft">Email de la persona</label>
            <input id={emailId} type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Tiene que tener una cuenta de voluntario" className={PROFILE_FIELD} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={roleId} className="text-xs font-semibold text-ink-soft">Rol</label>
            <select id={roleId} value={role} onChange={(e) => setRole(e.target.value as TeamRole)} className={PROFILE_FIELD}>
              {TEAM_ROLES.map((r) => <option key={r} value={r}>{TEAM_ROLE_LABEL[r]}</option>)}
            </select>
            <p className="text-[12px] text-ink-muted">{TEAM_ROLE_HINT[role]}</p>
          </div>
          {error && <p role="alert" className="text-[13px] text-critical">{error}</p>}
          <button type="submit" disabled={inviting || !email.trim()}
            className="h-11 rounded-[10px] bg-ink text-on-ink text-[15px] font-bold disabled:opacity-50">
            {inviting ? 'Invitando…' : 'Invitar'}
          </button>
        </form>

        <section aria-label="Tu equipo" className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold text-ink-soft">Tu equipo</h2>
          {loading ? (
            <div role="status" aria-label="Cargando equipo" className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-ink-muted" /></div>
          ) : loadError ? (
            <InlineError message={loadError} onRetry={load} />
          ) : members.length === 0 ? (
            <p className="rounded-xl bg-surface border border-hairline p-4 text-[13px] text-ink-soft">
              Todavía no sumaste a nadie. Invitá a voluntarios de confianza para que te ayuden con las postulaciones o con los Momentos.
            </p>
          ) : (
            <ul className="rounded-xl bg-surface border border-hairline overflow-hidden">
              {members.map((m) => (
                <li key={m.user_id} className="px-4 py-3 border-t first:border-t-0 border-hairline flex items-center gap-3">
                  <Avatar src={m.avatar ?? undefined} name={m.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold truncate">{m.name}</p>
                    <p className="text-xs text-ink-muted truncate">{m.email}</p>
                    {m.status === 'invited' && <p className="text-xs font-semibold text-ink-soft">Invitación enviada</p>}
                  </div>
                  <select aria-label={`Rol de ${m.name}`} value={m.role} onChange={(e) => void changeRole(m, e.target.value as TeamRole)}
                    className="h-9 px-2 rounded-lg bg-surface-soft border border-hairline text-[13px]">
                    {TEAM_ROLES.map((r) => <option key={r} value={r}>{TEAM_ROLE_LABEL[r]}</option>)}
                  </select>
                  <button type="button" onClick={() => void remove(m)} aria-label={`Sacar a ${m.name} del equipo`}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-critical hover:bg-surface-soft">
                    <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
