import { useParams, useNavigate, useLocation, Link } from 'react-router';
import { useEffect, useId, useState } from 'react';
import { ArrowLeft, Users, CheckCircle, Clock, XCircle, Loader2, DollarSign, BarChart2, MessageCircle, Clock3, Save, FileText, Pencil } from 'lucide-react';
import { api, ApiError, Project, EnrollmentWithVolunteer } from '../../lib/api';
import { openCv } from '../../lib/cv';
import { userMessage } from '../../lib/format';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { MomentsFeed } from './MomentsFeed';
import { InterviewPanel } from './InterviewPanel';
import { LoadError, describeLoadError } from './LoadError';
import { useConfirm } from '../ui/UiProvider';
import { PROJECT_STATUS_LABEL } from '../volunteering/status';

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

export function NGOProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  // §279: el link "Entrevista" del panel marca una postulación: se la deja a la vista y con su entrevista a mano.
  const marked = new URLSearchParams(useLocation().search).get('postulacion');
  const [project, setProject] = useState<Project | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentWithVolunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; retry: boolean } | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [processing, setProcessing] = useState<string | null>(null);
  const [hoursDraft, setHoursDraft] = useState<Record<string, string>>({});
  const [savingHours, setSavingHours] = useState<string | null>(null);
  // "Ver CV" (§166): el aviso es por inscripción, debajo de su fila (sin alert).
  const [cvError, setCvError] = useState<Record<string, string>>({});
  const confirm = useConfirm();
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
    catch (e: any) { alert(e.message); }
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
    if (Number.isNaN(val) || val < 0) { alert('Ingresá un número de horas válido'); return; }
    setSavingHours(id);
    try {
      await api.enrollments.logHours(id, val);
      setEnrollments(prev => prev.map(e => e.id === id ? { ...e, hours_logged: val } : e));
    } catch (e: any) { alert(e.message); }
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

  if (loading) return <div role="status" aria-label="Cargando voluntariado" className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>;
  if (loadError || !project) return (
    <LoadError message={loadError?.message ?? 'No encontramos este voluntariado'}
      onRetry={loadError?.retry ? load : undefined} home="/ngo/dashboard" />
  );

  const fundPct = Math.min(100, (project.current_funding / project.funding_goal) * 100) || 0;
  const volPct  = Math.min(100, (project.current_volunteers / project.volunteers_needed) * 100) || 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate(-1)} aria-label="Volver" className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-gray-700" />
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">{project.title}</h1>
            <p className="text-xs text-gray-500">{project.category} · {project.type}</p>
          </div>
          <button
            onClick={() => navigate(`/ngo/dashboard/project/${projectId}/editar`)}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-surface-soft hover:bg-surface-pressed text-ink rounded-xl text-xs font-bold transition-colors">
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />Editar
          </button>
          <button
            onClick={() => navigate(`/ngo/kpis/${projectId}`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-xl text-xs font-bold transition-colors">
            <BarChart2 className="w-3.5 h-3.5" />KPIs
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Users className="w-3.5 h-3.5" />Voluntarios</p>
            <p className="text-lg font-bold text-people-text">{project.current_volunteers}/{project.volunteers_needed}</p>
            <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-people rounded-full" style={{ width: `${volPct}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />Financiamiento</p>
            <p className="text-lg font-bold text-brand-text">${project.current_funding.toLocaleString()}</p>
            <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-brand rounded-full" style={{ width: `${fundPct}%` }} />
            </div>
          </div>
        </div>

        {/* Estado: finalizar, cancelar o volver a activar (§256) */}
        <section aria-labelledby={statusTitleId} className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id={statusTitleId} className="font-bold text-sm text-gray-900">Estado del voluntariado</h2>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-surface-soft text-ink">
              {PROJECT_STATUS_LABEL[project.status] ?? 'Activo'}
            </span>
          </div>
          {statusError && <p role="alert" className="text-xs text-critical">{statusError}</p>}
          <div className="flex flex-wrap gap-2">
            {project.status === 'active' ? (
              <>
                <button type="button" disabled={statusBusy} onClick={() => void changeStatus('completed')}
                  className="px-3 py-2 rounded-xl bg-surface-soft hover:bg-surface-pressed text-ink text-xs font-bold disabled:opacity-50">
                  Finalizar
                </button>
                <button type="button" disabled={statusBusy} onClick={() => void changeStatus('cancelled')}
                  className="px-3 py-2 rounded-xl text-critical text-xs font-bold hover:bg-surface-soft disabled:opacity-50">
                  Cancelar voluntariado
                </button>
              </>
            ) : (
              <button type="button" disabled={statusBusy} onClick={() => void changeStatus('active')}
                className="px-3 py-2 rounded-xl bg-surface-soft hover:bg-surface-pressed text-ink text-xs font-bold disabled:opacity-50">
                Volver a activar
              </button>
            )}
          </div>
        </section>

        {/* Enrollments */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-sm text-gray-900 mb-3">Inscriptos ({enrollments.length})</h2>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {['all', 'pending', 'approved', 'rejected'].map(f => (
                <button key={f} onClick={() => setFilter(f as any)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    filter === f ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : f === 'approved' ? 'Aprobados' : 'Rechazados'}
                  {' '}({f === 'all' ? enrollments.length : enrollments.filter(e => e.status === f).length})
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">Sin inscripciones en esta categoría</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(e => (
                <div key={e.id} id={`postulacion-${e.id}`} className={`p-4 ${e.id === marked ? 'bg-surface-soft' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-soft flex items-center justify-center text-sm font-bold text-brand-text flex-shrink-0">
                      {e.volunteer_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">{e.volunteer_name}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            // Tokens del rediseño: con la paleta vieja "Aprobado" daba 2,71:1 en oscuro (D25, §247).
                            e.status === 'approved' ? 'bg-people-soft text-people-text'
                            : e.status === 'pending' ? 'bg-surface-soft text-ink-soft'
                            : 'bg-surface-soft text-critical'}`}>
                            {e.status === 'approved' ? 'Aprobado' : e.status === 'pending' ? 'Pendiente' : 'Rechazado'}
                          </span>
                          {e.has_cv && (
                            <button onClick={() => viewCv(e)} aria-label={`Ver CV de ${e.volunteer_name}`}
                              className="w-7 h-7 rounded-full bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition-colors"
                              title={`CV de ${e.volunteer_name}`}>
                              <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            </button>
                          )}
                          <button onClick={() => navigate(`/ngo/messages/${e.user_id}`)}
                            className="w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors"
                            title={`Mensaje a ${e.volunteer_name}`}>
                            <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">{e.volunteer_email}</p>
                      {e.message && <p className="text-xs text-gray-500 italic mt-1">"{e.message}"</p>}
                      {cvError[e.id] && <p role="alert" className="text-xs text-red-600 mt-1">{cvError[e.id]}</p>}
                    </div>
                  </div>
                  {e.status === 'pending' && (
                    <div className="flex gap-2 mt-3 ml-13">
                      <button onClick={() => handle(e.id, 'approved')} disabled={processing === e.id}
                        className="flex-1 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                        {processing === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Aprobar
                      </button>
                      <button onClick={() => handle(e.id, 'rejected')} disabled={processing === e.id}
                        className="flex-1 py-2 bg-surface-soft text-critical rounded-xl text-xs font-semibold hover:bg-surface-pressed transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                        <XCircle className="w-3.5 h-3.5" />Rechazar
                      </button>
                    </div>
                  )}
                  <InterviewPanel enrollment={e} startOpen={e.id === marked}
                    onChange={iv => setEnrollments(prev => prev.map(x => (x.id === e.id ? { ...x, interview: iv } : x)))} />
                  {e.status === 'approved' && (
                    <div className="flex items-center gap-2 mt-3 ml-13">
                      <Clock3 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <input
                        type="number" min="0" step="0.5"
                        aria-label={`Horas de ${e.volunteer_name}`}
                        placeholder={e.hours_logged ? undefined : '0'}
                        defaultValue={e.hours_logged || ''}
                        onChange={ev => setHoursDraft(d => ({ ...d, [e.id]: ev.target.value }))}
                        className="w-20 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-400">horas cumplidas</span>
                      <button onClick={() => handleSaveHours(e.id)} disabled={savingHours === e.id || hoursDraft[e.id] === undefined}
                        className="ml-auto flex items-center gap-1 px-2.5 py-1.5 bg-surface-soft hover:bg-surface-pressed text-ink-soft rounded-lg text-xs font-semibold disabled:opacity-40 transition-colors">
                        {savingHours === e.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Guardar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Momentos del proyecto: la ONG dueña puede borrar cualquiera (el servidor manda `can_delete`) */}
        {projectId && (
          <section aria-label="Momentos del proyecto" className="space-y-3">
            <h2 className="font-bold text-gray-900 text-sm">Momentos del proyecto</h2>
            <MomentsFeed filters={{ project_id: projectId }} showComposer={false} />
          </section>
        )}
      </div>
    </div>
  );
}
