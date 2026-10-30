// El panel de un miembro del equipo de una ONG (/equipo/:ngoId, §296). Lo abre un voluntario desde "Equipos" (en su
// perfil y en Configuración) o desde el aviso de invitación del Inicio. Coordinación: las postulaciones sin responder
// y la gestión de cada voluntariado (NGOProjectDetail en modo equipo). Comunicación: los voluntariados y "Publicar un
// Momento". Qué ve cada uno lo decide el backend.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ChevronRight, Loader2, SquarePlus } from 'lucide-react';
import { api, TeamPanel as Panel } from '../../lib/api';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { LoadError, describeLoadError } from './LoadError';
import { EnrollmentPhone } from './EnrollmentPhone';
import { Avatar } from '../ui/Avatar';
import { TEAM_ROLE_HINT, TEAM_ROLE_LABEL } from '../team/teamRoles';
import { PROJECT_STATUS_LABEL } from '../volunteering/status';

export function TeamPanel() {
  const { ngoId } = useParams();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [loadError, setLoadError] = useState<{ message: string; retry: boolean } | null>(null);
  const latest = useLatestRequest();

  const load = async () => {
    const req = latest.start();
    setLoadError(null);
    try {
      const p = await api.team.panel(ngoId!);
      if (latest.isLatest(req)) setPanel(p);
    } catch (e) { if (latest.isLatest(req)) setLoadError(describeLoadError(e, 'No encontramos esta ONG')); }
  };
  useEffect(() => { if (ngoId) void load(); }, [ngoId]);

  if (loadError) return <LoadError message={loadError.message} onRetry={loadError.retry ? load : undefined} home="/profile#equipos" />;
  if (!panel) return <div role="status" aria-label="Cargando panel" className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-ink-muted" /></div>;

  const coordinator = panel.role === 'coordinator';
  const base = `/equipo/${panel.ngo.id}`;
  return (
    <div className="min-h-screen bg-canvas-soft pb-8">
      <div className="max-w-[640px] mx-auto px-4 pt-2 md:pt-8 flex flex-col gap-5">
        <header className="flex items-center gap-2 -ml-3">
          <Link to="/profile#equipos" aria-label="Volver" className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-soft">
            <ArrowLeft size={22} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <Avatar src={panel.ngo.logo ?? undefined} name={panel.ngo.name} kind="org" size={40} />
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold tracking-[-0.3px] truncate">{panel.ngo.name}</h1>
            <p className="text-[13px] text-ink-soft">{TEAM_ROLE_LABEL[panel.role]}</p>
          </div>
        </header>
        <p className="text-[13px] text-ink-soft -mt-2">{TEAM_ROLE_HINT[panel.role]}</p>

        <Link to="/momentos?crear=1" className="h-11 rounded-[10px] bg-ink text-on-ink text-[15px] font-bold inline-flex items-center justify-center gap-1.5">
          <SquarePlus size={18} strokeWidth={1.75} aria-hidden="true" />Publicar un Momento
        </Link>

        {coordinator && (
          <section aria-label="Postulaciones sin responder" className="flex flex-col gap-2">
            <h2 className="px-1 text-xs font-semibold text-ink-soft">Postulaciones sin responder</h2>
            {(panel.pending_enrollments ?? []).length === 0 ? (
              <p className="rounded-xl bg-surface border border-hairline p-4 text-[13px] text-ink-soft">No hay postulaciones sin responder.</p>
            ) : (
              <ul className="rounded-xl bg-surface border border-hairline overflow-hidden">
                {panel.pending_enrollments!.map((e) => (
                  <li key={e.id} className="px-4 py-3 border-t first:border-t-0 border-hairline flex flex-col gap-1">
                    <Link to={`${base}/project/${e.project_id}?postulacion=${e.id}`} className="flex items-center gap-3 hover:opacity-80">
                      <Avatar src={e.volunteer_avatar} name={e.volunteer_name} size={32} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-semibold truncate">{e.volunteer_name}</span>
                        <span className="block text-[13px] text-ink-soft truncate">{e.project_title}</span>
                      </span>
                      <ChevronRight size={18} strokeWidth={1.75} className="text-ink-muted" aria-hidden="true" />
                    </Link>
                    <EnrollmentPhone phone={e.phone} name={e.volunteer_name} className="ml-11" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section aria-label="Voluntariados" className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold text-ink-soft">Voluntariados</h2>
          {panel.projects.length === 0 ? (
            <p className="rounded-xl bg-surface border border-hairline p-4 text-[13px] text-ink-soft">La ONG todavía no publicó voluntariados.</p>
          ) : (
            <ul className="rounded-xl bg-surface border border-hairline overflow-hidden">
              {panel.projects.map((p) => (
                <li key={p.id} className="border-t first:border-t-0 border-hairline">
                  <Link to={coordinator ? `${base}/project/${p.id}` : `/project/${p.id}`}
                    className="px-4 py-3 flex items-center gap-3 hover:bg-surface-soft">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold truncate">{p.title}</span>
                      <span className="block text-[13px] text-ink-soft">
                        {PROJECT_STATUS_LABEL[p.status] ?? 'Activo'} · {p.current_volunteers}/{p.volunteers_needed} lugares
                      </span>
                    </span>
                    {coordinator && p.pending > 0 && (
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-surface-soft text-ink">{p.pending} sin responder</span>
                    )}
                    <ChevronRight size={18} strokeWidth={1.75} className="text-ink-muted" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
