// Panel de la ONG (DESIGN.md → Paneles de gestión): pantalla de trabajo, no de red social. Los números
// importantes son texto grande en una sola franja (no tarjetas de colores), las listas son tablas simples y la
// acción más común (aprobar postulaciones, crear un voluntariado) está a un toque desde la primera pantalla.
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Bell, Plus, Search, Check, X, CalendarClock } from 'lucide-react';
import { interviewWhen } from './InterviewPanel';
import { api, ApiError, Project, PendingEnrollment, NGO, NGOStats, type NGOFunnelCounts } from '../../lib/api';
import { NGOFunnel } from './NGOFunnel';
import { userMessage } from '../../lib/format';
import { InlineError } from './LoadError';
import { MercadoPagoBanner } from './MercadoPagoAccount';
import { NGOShortcuts } from './NGOShortcuts';
import { Avatar } from '../ui/Avatar';
import { TypeBadge } from '../ui/TypeBadge';
import { Button, ButtonLink } from '../ui/Button';
import { Meter, formatMoney, pct } from '../ui/Meter';
import { useToast } from '../ui/UiProvider';
import { PROJECT_STATUS_LABEL } from '../volunteering/status';
import { EnrollmentPhone } from './EnrollmentPhone';
import { useMediaQuery } from '../../lib/useMediaQuery';

const safeNum = (v: any, f = 0) => { const n = Number.parseFloat(v); return Number.isNaN(n) ? f : n; };

export function NGODashboard() {
  const navigate  = useNavigate();
  const toast     = useToast();
  const [ngo, setNgo]         = useState<NGO | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats]     = useState<NGOStats | null>(null);
  const [pending, setPending] = useState<PendingEnrollment[]>([]);
  const [funnel, setFunnel]   = useState<NGOFunnelCounts | undefined>(undefined);   // §284
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const xl = useMediaQuery('(min-width: 1280px)', false);   // §321: dos columnas

  useEffect(() => { void load(); }, []);
  // No leídas, para la campanita del encabezado (§173). Si falla, la campanita queda sin número.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    api.notifications.list().then((r) => setUnread(Number(r.unread) || 0)).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { ngo: n, projects: p, stats: s, pending_enrollments, funnel: f } = await api.ngos.me();
      setNgo(n); setProjects(p); setStats(s);
      setPending(pending_enrollments);
      setFunnel(f);
    } catch (e) {
      // Sesión vencida → al inicio (antes se buscaba "Token" en el texto del mensaje). Cualquier otro error
      // se muestra: antes se tragaba y el panel parecía el de una ONG sin proyectos (REVISION F9).
      if (e instanceof ApiError && e.status === 401) navigate('/');
      else setLoadError(userMessage(e, 'No pudimos cargar tu panel. Revisá tu conexión.'));
    } finally { setLoading(false); }
  };

  const handleEnrollment = async (e: PendingEnrollment, status: 'approved' | 'rejected') => {
    setProcessing(e.id);
    try {
      await api.enrollments.updateStatus(e.id, status);
      toast(status === 'approved' ? `Aceptaste a ${e.volunteer_name}` : `Rechazaste a ${e.volunteer_name}`);
      void load();
    } catch (err) {
      toast(userMessage(err, 'No pudimos guardar la respuesta. Probá de nuevo.'), { kind: 'error' });
    } finally { setProcessing(null); }
  };

  const filtered = projects.filter(p => (p.title ?? '').toLowerCase().includes(search.toLowerCase().trim()));

  if (loading) return (
    <div role="status" aria-label="Cargando el panel" className="w-full p-6 md:p-10 max-w-[1400px] mx-auto flex flex-col gap-5">
      <div className="h-8 w-48 rounded skeleton" /><div className="h-24 rounded-xl skeleton" /><div className="h-64 rounded-xl skeleton" />
    </div>
  );
  if (loadError) return <div className="w-full p-4 md:p-8 max-w-3xl mx-auto"><InlineError message={loadError} onRetry={load} /></div>;

  const th = 'text-left text-xs font-semibold text-ink-muted px-4 py-2.5 border-b border-hairline';
  const td = 'px-4 py-3 border-b border-hairline align-middle';

  const pendingSection = pending.length > 0 && (
    <section aria-labelledby="pend" className="rounded-xl bg-surface border border-hairline overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-baseline justify-between gap-2">
        <h2 id="pend" className="text-lg font-bold tracking-[-0.2px]">Postulaciones sin responder ({pending.length})</h2>
        {/* §319: todas, con filtros y decisión en lote */}
        <Link to="/ngo/postulaciones" className="text-[13px] font-semibold text-ink hover:underline flex-shrink-0">Ver todas las postulaciones</Link>
      </div>
      <ul className="max-h-[28rem] overflow-y-auto">
        {pending.map(e => (
          // flex-wrap: si no entran al lado del nombre (columna angosta, celular), los botones bajan a otra línea.
          <li key={e.id} className="px-4 py-3 border-t border-hairline flex flex-wrap items-center gap-x-3 gap-y-2">
            <Avatar src={undefined} name={e.volunteer_name} size={36} />
            <div className="flex-1 min-w-[9rem]">
              <p className="text-[15px] font-semibold truncate">{e.volunteer_name}</p>
              <p className="text-[13px] text-ink-soft truncate">{e.project_title}</p>
              <p className="text-xs text-ink-muted truncate">{e.volunteer_email}</p>
              <EnrollmentPhone phone={e.phone} name={e.volunteer_name} />
              {e.interview?.status === 'scheduled' && (
                <p className="text-xs font-semibold text-ink-soft truncate">Entrevista: {interviewWhen(e.interview)}</p>
              )}
            </div>
            <div className="flex gap-1.5 flex-shrink-0 ml-auto">
              <Button variant="primary" onClick={() => handleEnrollment(e, 'approved')} disabled={processing === e.id}
                aria-label={`Aprobar a ${e.volunteer_name} en ${e.project_title}`} className="!h-9 !px-3 !text-[13px]">
                <Check size={16} strokeWidth={2.25} aria-hidden="true" />Aceptar
              </Button>
              <Button variant="text" onClick={() => handleEnrollment(e, 'rejected')} disabled={processing === e.id}
                aria-label={`Rechazar a ${e.volunteer_name} en ${e.project_title}`} className="!h-11 !w-11 !px-0 sm:!h-9 sm:!w-auto sm:!px-2 !text-[13px]">
                <X size={16} strokeWidth={2} aria-hidden="true" /><span className="hidden sm:inline">Rechazar</span>
              </Button>
              {/* §279: a la postulación en el detalle del voluntariado, con la entrevista a mano. */}
              <ButtonLink variant="text" to={`/ngo/dashboard/project/${e.project_id}?postulacion=${e.id}`}
                aria-label={`Entrevista con ${e.volunteer_name} en ${e.project_title}`} className="!h-11 !w-11 !px-0 sm:!h-9 sm:!w-auto sm:!px-2 !text-[13px]">
                <CalendarClock size={16} strokeWidth={2} aria-hidden="true" /><span className="hidden sm:inline">Entrevista</span>
              </ButtonLink>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );

  const projectsSection = (
    <section aria-labelledby="vols" className="rounded-xl bg-surface border border-hairline overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
        <h2 id="vols" className="text-lg font-bold tracking-[-0.2px]">Voluntariados ({filtered.length}{search ? ` de ${projects.length}` : ''})</h2>
        <label className="h-9 w-44 sm:w-56 px-3 rounded-[10px] bg-surface-soft flex items-center gap-2 text-ink-muted focus-within:bg-surface focus-within:ring-[1.5px] focus-within:ring-ink">
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <input type="search" aria-label="Buscar proyectos" placeholder="Buscar" value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-muted" />
        </label>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-10 flex flex-col items-center gap-1">
          <p className="text-[15px] font-semibold">{search ? `Sin resultados para "${search}"` : 'Todavía no creaste voluntariados'}</p>
          {!search && <Link to="/ngo/create" className="text-[15px] font-semibold">Crear el primero →</Link>}
        </div>
      ) : (
        // table-fixed (§321): un título largo estiraba la tabla y en el celular "Recaudado" quedaba cortado; así se trunca.
        <table className="w-full text-[15px] table-fixed">
          <thead>
            <tr><th className={th}>Voluntariado</th><th className={`${th} w-40 hidden sm:table-cell`}>Voluntarios</th><th className={`${th} w-32 text-right`}>Recaudado</th></tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-surface-soft transition-colors">
                <td className={td}>
                  <Link to={`/ngo/dashboard/project/${p.id}`} className="flex items-center gap-3 min-w-0">
                    {p.image
                      ? <img src={p.image} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0 bg-surface-soft" />
                      : <span className="w-10 h-10 rounded-md bg-surface-soft flex-shrink-0" aria-hidden="true" />}
                    <span className="min-w-0 flex flex-col">
                      <span className="font-semibold truncate">{p.title}</span>
                      <span className="text-[13px] text-ink-muted truncate">
                        {p.category ? `${p.category} · ` : ''}<TypeBadge type={p.type} variant="text" className="!text-[13px]" />{PROJECT_STATUS_LABEL[p.status] ? ` · ${PROJECT_STATUS_LABEL[p.status]}` : ''}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className={`${td} hidden sm:table-cell`}>
                  <span className="flex flex-col gap-1 w-28">
                    <span className="text-[13px]"><b>{safeNum(p.current_volunteers)}</b> de {safeNum(p.volunteers_needed)}</span>
                    <Meter value={pct(p.current_volunteers, p.volunteers_needed)} tone="people" thin label="Voluntarios" />
                  </span>
                </td>
                <td className={`${td} text-right font-bold`}>{formatMoney(safeNum(p.current_funding))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );

  return (
    <div className="min-h-screen">
      <div className="max-w-[1400px] mx-auto px-4 md:px-10 py-6 md:py-8 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {ngo && <Avatar src={ngo.logo} name={ngo.name} kind="org" size={44} />}
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold tracking-[-0.3px] truncate">{ngo?.name ?? 'Panel'}</h1>
              <p className="text-[13px] text-ink-muted">Panel de la ONG</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
          <Link to="/ngo/notifications" aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'}
            className="md:hidden relative w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-surface-soft">
            <Bell size={22} strokeWidth={1.75} aria-hidden="true" />
            {unread > 0 && (
              <span aria-hidden="true" className="absolute top-1.5 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-critical text-on-ink text-xs font-bold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
          <ButtonLink to="/ngo/create" variant="primary" className="flex-shrink-0">
            <Plus size={18} strokeWidth={2} aria-hidden="true" /><span className="hidden sm:inline">Crear voluntariado</span><span className="sm:hidden">Crear</span>
          </ButtonLink>
          </div>
        </div>

        {/* §218: sin cuenta de Mercado Pago la ONG no recibe donaciones; el aviso solo aparece si falta vincularla. */}
        <MercadoPagoBanner />

        {stats && (
          <dl className="grid grid-cols-2 md:grid-cols-4 rounded-xl bg-surface border border-hairline overflow-hidden">
            {[
              { label: 'Voluntariados activos', val: String(safeNum(stats.active_projects)) },
              { label: 'Voluntarios', val: String(safeNum(stats.total_volunteers)) },
              { label: 'Postulaciones sin responder', val: String(safeNum(stats.pending_enrollments)) },
              { label: 'Recaudado', val: formatMoney(safeNum(stats.total_funding)) },
            ].map(({ label, val }, i) => (
              <div key={label} className={`px-5 py-4 flex flex-col gap-1 border-hairline ${i % 2 === 0 ? 'border-r' : ''} ${i < 2 ? 'border-b md:border-b-0' : ''} md:border-r md:last:border-r-0`}>
                <dt className="text-xs font-semibold text-ink-soft order-2">{label}</dt>
                <dd className="text-[28px] font-extrabold tracking-[-0.5px] leading-tight order-1">{val}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* §321: desde 1280 px, a la izquierda el trabajo (voluntariados y embudo) y a la derecha lo pendiente y los
            accesos. Más angosto, una columna: en el celular Patrocinios, Publicaciones y Equipo no están en la barra
            y los accesos van arriba. Cada pieza se dibuja una sola vez. */}
        {xl ? (
          <div className="grid gap-5 grid-cols-[minmax(0,1fr)_380px] items-start">
            <div className="flex flex-col gap-5 min-w-0">
              {projectsSection}
              <NGOFunnel funnel={funnel} />
            </div>
            <aside aria-label="Pendientes y accesos" className="flex flex-col gap-5 min-w-0">
              {pendingSection}
              <NGOShortcuts stacked />
            </aside>
          </div>
        ) : (
          <>
            <NGOShortcuts />
            <NGOFunnel funnel={funnel} />
            <div className="flex flex-col gap-5">
              {pendingSection}
              {projectsSection}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
