import { useParams, useNavigate, useLocation, Link } from 'react-router';
import { useEffect, useId, useState } from 'react';
import { ArrowLeft, Check, FileText, MessageCircle, Pencil, X } from 'lucide-react';
import { api, ApiError, Project, EnrollmentWithVolunteer } from '../../lib/api';
import { openCv } from '../../lib/cv';
import { userMessage } from '../../lib/format';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { MomentsFeed } from './MomentsFeed';
import { InterviewPanel } from './InterviewPanel';
import { LoadError, describeLoadError } from './LoadError';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { DualGoal } from '../ui/Meter';
import { TYPE_STYLE } from '../ui/TypeBadge';
import { useConfirm, useToast } from '../ui/UiProvider';
import { PROJECT_STATUS_LABEL } from '../volunteering/status';
import { EnrollmentPhone } from './EnrollmentPhone';

// Finalizar y cancelar sacan el voluntariado de circulación: se confirman. Volver a activarlo, no (§256).
const STATUS_CONFIRM = {
  completed: {
    title: '¿Finalizar este voluntariado?',
    body: 'Deja de recibir inscripciones y donaciones y queda como finalizado. Lo podés volver a activar.',
    confirmLabel: 'Finalizar voluntariado',
  },
  cancelled: {
    title: '¿Cancelar este voluntariado?',
    body: 'Deja de aparecer en Explorar y de recibir inscripciones y donaciones. Lo podés volver a activar.',
    confirmLabel: 'Cancelar voluntariado',
    danger: true,
  },
} as const;

type Filter = 'all' | 'pending' | 'approved' | 'rejected';
const FILTERS: [Filter, string][] = [['all', 'Todos'], ['pending', 'Pendientes'], ['approved', 'Aprobados'], ['rejected', 'Rechazados']];

const BLOCK = 'rounded-xl bg-surface border border-hairline';
const SECTION_TITLE = 'text-lg font-bold tracking-[-0.2px]';
const ICON_BUTTON = 'w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center hover:bg-surface-soft transition-colors';
const NETWORK_ERROR = 'Revisá tu conexión y probá de nuevo.';

/** `team` (§296): abierto por un coordinador del equipo en /equipo/:ngoId/project/:projectId. Gestiona las
 *  postulaciones como el dueño, pero no ve lo que es solo del dueño (editar, KPIs, cambiar el estado). */
export function NGOProjectDetail({ team = false }: { team?: boolean } = {}) {
  const { projectId, ngoId } = useParams();
  const navigate = useNavigate();
  // §279: el link "Entrevista" del panel marca una postulación: se la deja a la vista y con su entrevista a mano.
  const marked = new URLSearchParams(useLocation().search).get('postulacion');
  const [project, setProject] = useState<Project | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentWithVolunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; retry: boolean } | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [processing, setProcessing] = useState<string | null>(null);
  const [hoursDraft, setHoursDraft] = useState<Record<string, string>>({});
  const [savingHours, setSavingHours] = useState<string | null>(null);
  // "Ver CV" (§166): el aviso es por inscripción, debajo de su fila (sin alert).
  const [cvError, setCvError] = useState<Record<string, string>>({});
  const confirm = useConfirm();
  const toast = useToast();
  const statusTitleId = useId();
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState('');

  // Solo vale la respuesta del último pedido (al cambiar de proyecto, reintentar o recargar tras aprobar): F15, §89.
  const latest = useLatestRequest();
  useEffect(() => { if (projectId) void load(); }, [projectId]);
  // Cuando llegan las postulaciones, la marcada queda a la vista (una vez por postulación marcada).
  const markedLoaded = enrollments.some(e => e.id === marked);
  useEffect(() => {
    if (markedLoaded) document.getElementById(`postulacion-${marked}`)?.scrollIntoView({ block: 'center' });
  }, [markedLoaded, marked]);

  const load = async () => {
    const req = latest.start();
    setLoading(true);
    setLoadError(null);
    try {
      const [{ project: p }, { enrollments: e }] = await Promise.all([
        api.projects.get(projectId!),
        api.enrollments.byProject(projectId!),
      ]);
      if (!latest.isLatest(req)) return;
      setProject(p); setEnrollments(e);
    } catch (e) { if (latest.isLatest(req)) setLoadError(describeLoadError(e, 'No encontramos este voluntariado')); }
    finally { if (latest.isLatest(req)) setLoading(false); }
  };

  const handle = async (id: string, status: 'approved' | 'rejected') => {
    setProcessing(id);
    try { await api.enrollments.updateStatus(id, status); void load(); }
    catch (e) { toast(userMessage(e, `No pudimos guardar tu decisión. ${NETWORK_ERROR}`), { kind: 'error' }); }
    finally { setProcessing(null); }
  };

  const changeStatus = async (status: Project['status']) => {
    if (status !== 'active' && !(await confirm(STATUS_CONFIRM[status]))) return;
    setStatusBusy(true);
    setStatusError('');
    try {
      const { project: p } = await api.projects.update(projectId!, { status });
      setProject(prev => (prev ? { ...prev, status: p.status } : prev));
    } catch (e) {
      setStatusError(userMessage(e, 'No pudimos guardar el cambio. Revisá tu conexión y probá de nuevo.'));
    } finally {
      setStatusBusy(false);
    }
  };

  const handleSaveHours = async (id: string) => {
    const val = Number.parseFloat(hoursDraft[id]);
    if (Number.isNaN(val) || val < 0) { toast('Ingresá un número de horas válido', { kind: 'error' }); return; }
    setSavingHours(id);
    try {
      await api.enrollments.logHours(id, val);
      setEnrollments(prev => prev.map(e => e.id === id ? { ...e, hours_logged: val } : e));
    } catch (e) { toast(userMessage(e, `No pudimos guardar las horas. ${NETWORK_ERROR}`), { kind: 'error' }); }
    finally { setSavingHours(null); }
  };

  const viewCv = async (e: EnrollmentWithVolunteer) => {
    setCvError(m => { const { [e.id]: _, ...rest } = m; return rest; });
    try { await openCv(e.user_id); }
    catch (err) {
      const msg = err instanceof ApiError && err.status === 404
        ? `${e.volunteer_name} no cargó su CV.`
        : userMessage(err, 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.');
      setCvError(m => ({ ...m, [e.id]: msg }));
    }
  };

  const filtered = filter === 'all' ? enrollments : enrollments.filter(e => e.status === filter);

  // Esqueleto con la forma de la pantalla: la barra con el título, las dos cifras y los bloques de abajo (§335).
  if (loading) return (
    <div role="status" aria-label="Cargando voluntariado" className="min-h-screen bg-canvas-soft">
      <div aria-hidden="true">
        <div className="bg-surface border-b border-hairline p-4 flex items-center gap-3">
          <div className="w-11 h-11 flex-shrink-0 rounded-full skeleton" />
          <div className="flex-1 flex flex-col gap-2"><div className="h-4 w-1/2 rounded skeleton" /><div className="h-3 w-1/3 rounded skeleton" /></div>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3"><div className="h-20 rounded-xl skeleton" /><div className="h-20 rounded-xl skeleton" /></div>
          <div className="h-24 rounded-2xl skeleton" /><div className="h-64 rounded-2xl skeleton" />
        </div>
      </div>
    </div>
  );
  if (loadError || !project) return (
    <LoadError message={loadError?.message ?? 'No encontramos este voluntariado'}
      onRetry={loadError?.retry ? load : undefined} home={team ? `/equipo/${ngoId}` : '/ngo/dashboard'} />
  );

  const typeLabel = TYPE_STYLE[project.type as keyof typeof TYPE_STYLE]?.label ?? project.type;
  const countOf = (f: Filter) => (f === 'all' ? enrollments.length : enrollments.filter(e => e.status === f).length);

  return (
    <div className="min-h-screen bg-canvas-soft pb-28">
      <div className="w-full max-w-[880px] mx-auto px-4 pt-2 md:pt-8 flex flex-col gap-4">
        <header className="flex flex-wrap items-center gap-x-1 gap-y-2 -ml-3">
          <button type="button" onClick={() => navigate(-1)} aria-label="Volver" className={ICON_BUTTON}>
            <ArrowLeft size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold tracking-[-0.3px] leading-tight break-words">{project.title}</h1>
            <p className="text-[13px] text-ink-muted truncate">{project.category} · {typeLabel}</p>
          </div>
          {!team && (
            <div className="flex gap-2 ml-3">
              <Button variant="secondary" onClick={() => navigate(`/ngo/dashboard/project/${projectId}/editar`)}>
                <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />Editar
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/ngo/kpis/${projectId}`)}>Impacto</Button>
            </div>
          )}
        </header>

        {/* La doble meta, como en el feed y en la página del voluntariado. */}
        <div className={`${BLOCK} p-4`}>
          <DualGoal fundingGoal={Number(project.funding_goal) || 0} currentFunding={Number(project.current_funding) || 0}
            volunteersNeeded={project.volunteers_needed} currentVolunteers={project.current_volunteers} />
        </div>

        {/* Estado: finalizar, cancelar o volver a activar (§256). Solo el dueño (§296). */}
        {!team && <section aria-labelledby={statusTitleId} className={`${BLOCK} p-4 flex flex-col gap-3`}>
          <div className="flex items-center justify-between gap-3">
            <h2 id={statusTitleId} className={SECTION_TITLE}>Estado del voluntariado</h2>
            <span className="h-7 px-2.5 rounded-full text-xs font-semibold inline-flex items-center bg-surface-soft text-ink">
              {PROJECT_STATUS_LABEL[project.status] ?? 'Activo'}
            </span>
          </div>
          {statusError && <p role="alert" className="text-[13px] text-critical">{statusError}</p>}
          <div className="flex flex-wrap gap-2">
            {project.status === 'active' ? (
              <>
                <Button variant="secondary" disabled={statusBusy} onClick={() => void changeStatus('completed')}>Finalizar</Button>
                <Button variant="danger" disabled={statusBusy} onClick={() => void changeStatus('cancelled')}>Cancelar voluntariado</Button>
              </>
            ) : (
              <Button variant="secondary" disabled={statusBusy} onClick={() => void changeStatus('active')}>Volver a activar</Button>
            )}
          </div>
        </section>}

        <section className={BLOCK}>
          <div className="p-4 border-b border-hairline flex flex-col gap-3">
            <h2 className={SECTION_TITLE}>Inscriptos ({enrollments.length})</h2>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {FILTERS.map(([f, label]) => (
                <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
                  className={`h-8 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${
                    filter === f ? 'bg-ink text-on-ink' : 'bg-surface-soft text-ink-soft hover:bg-surface-pressed'
                  }`}>
                  {label} ({countOf(f)})
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center py-8 px-4 text-[15px] text-ink-soft">Sin inscripciones en esta categoría</p>
          ) : (
            <div className="divide-y divide-hairline">
              {filtered.map(e => (
                <div key={e.id} id={`postulacion-${e.id}`} className={`p-4 ${e.id === marked ? 'bg-surface-soft' : ''}`}>
                  <div className="flex items-start gap-3">
                    <Avatar src={e.volunteer_avatar} name={e.volunteer_name} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[15px] font-semibold min-w-0 break-words">{e.volunteer_name}</p>
                        <div className="flex items-center flex-shrink-0">
                          <span className={`h-7 px-2.5 mr-1 rounded-full text-xs font-semibold inline-flex items-center ${
                            // Tokens del rediseño: con la paleta vieja "Aprobado" daba 2,71:1 en oscuro (D25, §247).
                            e.status === 'approved' ? 'bg-people-soft text-people-text' : 'bg-surface-soft text-ink-soft'}`}>
                            {e.status === 'approved' ? 'Aprobado' : e.status === 'pending' ? 'Pendiente' : 'Rechazado'}
                          </span>
                          {e.has_cv && (
                            <button type="button" onClick={() => viewCv(e)} aria-label={`Ver CV de ${e.volunteer_name}`}
                              title={`CV de ${e.volunteer_name}`} className={ICON_BUTTON}>
                              <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                          )}
                          <button type="button" onClick={() => navigate(`${team ? '' : '/ngo'}/messages/${e.user_id}`)}
                            aria-label={`Mensaje a ${e.volunteer_name}`} title={`Mensaje a ${e.volunteer_name}`} className={ICON_BUTTON}>
                            <MessageCircle size={18} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[13px] text-ink-muted break-all">{e.volunteer_email}</p>
                      <EnrollmentPhone phone={e.phone} name={e.volunteer_name} />
                      {e.message && <p className="text-[13px] text-ink-soft mt-1 break-words">"{e.message}"</p>}
                      {cvError[e.id] && <p role="alert" className="text-[13px] text-critical mt-1">{cvError[e.id]}</p>}
                    </div>
                  </div>
                  {e.status === 'pending' && (
                    <div className="flex gap-2 mt-3 ml-13">
                      <Button variant="primary" className="flex-1" busy={processing === e.id} onClick={() => handle(e.id, 'approved')}>
                        <Check size={16} strokeWidth={2.25} aria-hidden="true" />Aprobar
                      </Button>
                      <Button variant="secondary" className="flex-1" disabled={processing === e.id} onClick={() => handle(e.id, 'rejected')}>
                        <X size={16} strokeWidth={2} aria-hidden="true" />Rechazar
                      </Button>
                    </div>
                  )}
                  <InterviewPanel enrollment={e} startOpen={e.id === marked}
                    onChange={iv => setEnrollments(prev => prev.map(x => (x.id === e.id ? { ...x, interview: iv } : x)))} />
                  {e.status === 'approved' && (
                    <div className="flex items-center gap-2 mt-3 ml-13">
                      <input
                        type="number" min="0" step="0.5"
                        aria-label={`Horas de ${e.volunteer_name}`}
                        placeholder={e.hours_logged ? undefined : '0'}
                        defaultValue={e.hours_logged || ''}
                        onChange={ev => setHoursDraft(d => ({ ...d, [e.id]: ev.target.value }))}
                        className="w-20 h-10 px-3 rounded-[10px] bg-surface-soft text-[15px] border-[1.5px] border-hairline focus:bg-surface focus:border-ink outline-none"
                      />
                      <span className="text-[13px] text-ink-soft">horas cumplidas</span>
                      <Button variant="secondary" className="ml-auto" busy={savingHours === e.id} disabled={hoursDraft[e.id] === undefined}
                        onClick={() => handleSaveHours(e.id)}>
                        Guardar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Momentos del proyecto: la ONG dueña puede borrar cualquiera (el servidor manda `can_delete`) */}
        {projectId && (
          <section aria-label="Momentos del proyecto" className="flex flex-col gap-3">
            <h2 className={SECTION_TITLE}>Momentos del proyecto</h2>
            <MomentsFeed filters={{ project_id: projectId }} showComposer={false} />
          </section>
        )}
      </div>
    </div>
  );
}
