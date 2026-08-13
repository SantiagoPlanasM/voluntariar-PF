import { useParams, useNavigate, Link } from 'react-router';
import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Clock, Users, DollarSign, Calendar, Star, Briefcase, Loader2, Send, Zap, BarChart3 } from 'lucide-react';
import { api, ProjectDetail } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';

type Tab = 'details' | 'ratings' | 'comments';
const BLACKLIST = ['pelotudo','boludo','idiota','imbecil','mierda','puto','puta','hdp','concha','forro','tarado'];
const hasBadWord = (t: string) => BLACKLIST.some(w => t.toLowerCase().includes(w));
const safePct = (a: any, b: any) => { const na=parseFloat(a),nb=parseFloat(b); if(!nb||isNaN(na)||isNaN(nb)) return 0; return Math.min(100,Math.round((na/nb)*100)); };
const safeMoney = (val: any) => { const n=parseFloat(val); return isNaN(n)?'$0':'$'+n.toLocaleString('es-AR'); };

export function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();
  const [project, setProject]     = useState<ProjectDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<Tab>('details');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState('');
  const [comment, setComment]     = useState('');
  const [commenting, setCommenting] = useState(false);
  const [commentErr, setCommentErr] = useState('');

  useEffect(() => { if (id) load(id); }, [id]);

  const load = async (pid: string) => {
    setLoading(true);
    try { setProject((await api.projects.get(pid)).project); }
    catch { navigate(-1); }
    finally { setLoading(false); }
  };

  const handleEnroll = async () => {
    if (!user) { openAuthModal('Iniciá sesión para inscribirte'); return; }
    setEnrolling(true); setEnrollMsg('');
    try { await api.enrollments.enroll(id!); setEnrollMsg('Inscripción enviada.'); load(id!); }
    catch (e: any) { setEnrollMsg(e.message); }
    finally { setEnrolling(false); }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { openAuthModal('Iniciá sesión para comentar'); return; }
    const c = comment.trim();
    if (!c || c.length < 3) { setCommentErr('Muy corto'); return; }
    if (hasBadWord(c)) { setCommentErr('Contiene palabras no permitidas'); return; }
    setCommenting(true); setCommentErr('');
    try { await api.projects.comment(id!, c); setComment(''); load(id!); }
    catch (e: any) { setCommentErr(e.message); }
    finally { setCommenting(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  );
  if (!project) return null;

  const fundPct = safePct(project.current_funding, project.funding_goal);
  const volPct  = safePct(project.current_volunteers, project.volunteers_needed);
  const hasFunding = (project.funding_goal || 0) > 0;
  const alreadyEnrolled = !!project.my_enrollment;
  const hoursLabel = project.type === 'fugaz'
    ? (project.duration || 'Sin especificar')
    : (project.hours_per_week ? `${project.hours_per_week}h/semana` : 'No especificado');

  const EnrollButton = ({ className = '' }: { className?: string }) => (
    <button
      onClick={handleEnroll}
      disabled={enrolling || alreadyEnrolled}
      className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
        ${alreadyEnrolled ? 'bg-gray-100 text-gray-500' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200'}
        disabled:opacity-60 ${className}`}>
      {enrolling && <Loader2 className="w-4 h-4 animate-spin" />}
      {alreadyEnrolled
        ? `Inscripto · ${project.my_enrollment?.status === 'approved' ? 'Aprobado' : 'Pendiente'}`
        : 'Unirme como voluntario'}
    </button>
  );

  return (
    // pb-32 en mobile para que el botón fijo no tape el contenido
    // md:pb-8 en desktop donde no hay botón fijo
    <div className="min-h-screen bg-gray-50 md:ml-60 pb-32 md:pb-8">

      {/* Hero */}
      <div className="relative h-56 sm:h-72">
        {project.image
          ? <img src={project.image} alt={project.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-emerald-200 to-teal-300" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <button onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
          <ArrowLeft className="w-5 h-5 text-gray-800" />
        </button>
        <div className="absolute bottom-4 left-4 flex gap-2">
          <span className="px-3 py-1 bg-white/95 rounded-full text-xs font-bold text-gray-800">{project.category}</span>
          {project.type === 'fugaz'
            ? <span className="px-3 py-1 bg-blue-600/90 rounded-full text-xs font-bold text-white flex items-center gap-1"><Zap className="w-3 h-3" />Fugaz</span>
            : <span className="px-3 py-1 bg-emerald-600/90 rounded-full text-xs font-bold text-white flex items-center gap-1"><Calendar className="w-3 h-3" />Sostenido</span>
          }
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">

        {/* ── DESKTOP: 3-col grid ─────────────────────────────── */}
        <div className="md:grid md:grid-cols-3 md:gap-6">

          {/* Main column — visible on ALL screen sizes */}
          <div className="md:col-span-2 space-y-4">

            {/* Header card */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                {project.ngo_logo
                  ? <img src={project.ngo_logo} alt={project.ngo_name} className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-100" />
                  : <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">{project.ngo_name?.[0]}</div>
                }
                <div>
                  <Link to={project.ngo_id ? `/ngo/${project.ngo_id}` : '#'}
                className="text-sm font-semibold text-gray-800 hover:text-emerald-600 transition-colors">
                {project.ngo_name}
              </Link>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs text-gray-400">{(project.avg_rating || 0).toFixed(1)} · {project.ratings.length} reseñas</span>
                  </div>
                </div>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900">{project.title}</h1>
            </div>

            {/* Info grid — visible on ALL sizes */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: MapPin,     label: 'Ubicación',   val: project.location },
                { icon: Clock,      label: project.type === 'fugaz' ? 'Duración' : 'Horas/sem', val: hoursLabel },
                { icon: DollarSign, label: 'Costo',       val: (project.cost_per_person || 0) === 0 ? 'Gratis' : safeMoney(project.cost_per_person) },
                { icon: Users,      label: 'Voluntarios', val: `${project.current_volunteers || 0}/${project.volunteers_needed || 0}` },
              ].map(({ icon: Icon, label, val }) => (
                <div key={label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                    <Icon className="w-3.5 h-3.5" /><span className="text-xs">{label}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{val}</p>
                </div>
              ))}
            </div>

            {/* Progress — visible on ALL sizes */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
              <h3 className="font-bold text-sm text-gray-900">Progreso del proyecto</h3>
              {hasFunding && (
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-500">Financiamiento</span>
                    <span className="font-bold text-blue-600">{fundPct}% · {safeMoney(project.current_funding)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all" style={{ width: `${fundPct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Meta: {safeMoney(project.funding_goal)}</p>
                </div>
              )}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" />Voluntarios</span>
                  <span className="font-bold text-emerald-600">{volPct}% · {project.current_volunteers || 0}/{project.volunteers_needed || 0}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all" style={{ width: `${volPct}%` }} />
                </div>
              </div>
            </div>

            {/* Roles */}
            {project.roles_needed?.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-sm text-gray-900">Roles buscados</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {project.roles_needed.map((r, i) => (
                    <span key={i} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">{r}</span>
                  ))}
                </div>
              </div>
            )}

            {/* KPIs públicos */}
        {project.kpis && project.kpis.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-violet-600" />
              <h3 className="font-bold text-sm text-gray-900">Impacto del proyecto</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {project.kpis.map((k: any) => (
                <div key={k.id} className="bg-violet-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-violet-700">
                    {k.valor !== null && k.valor !== undefined
                      ? k.tipo_valor === 'porcentaje' ? `${k.valor}%`
                        : k.tipo_valor === 'booleano' ? (k.valor ? 'Sí' : 'No')
                        : `${k.valor}${k.unidad ? ' ' + k.unidad : ''}`
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5 font-medium">{k.nombre}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex border-b border-gray-100">
                {(['details', 'ratings', 'comments'] as Tab[]).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-3 text-xs sm:text-sm font-bold transition-colors ${tab === t ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
                    {t === 'details' ? 'Detalles' : t === 'ratings' ? `Reseñas (${project.ratings.length})` : `Comentarios (${project.comments.length})`}
                  </button>
                ))}
              </div>
              <div className="p-4 sm:p-5">
                {tab === 'details' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 leading-relaxed">{project.full_description || project.description}</p>
                    {project.requirements?.length > 0 && (
                      <>
                        <h4 className="font-bold text-sm text-gray-900">Requisitos</h4>
                        <ul className="space-y-1.5">
                          {project.requirements.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />{r}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
                {tab === 'ratings' && (
                  project.ratings.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-6">Sin reseñas aún</p>
                    : <div className="space-y-4">
                        {project.ratings.map(r => (
                          <div key={r.id} className="flex gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 flex-shrink-0">{r.user_name[0]}</div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{r.user_name}</p>
                              <div className="flex my-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                                ))}
                              </div>
                              {r.comment && <p className="text-xs text-gray-500">{r.comment}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                )}
                {tab === 'comments' && (
                  <div className="space-y-3">
                    {project.comments.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">Sin comentarios aún. ¡Sé el primero!</p>
                    )}
                    {project.comments.map(c => (
                      <div key={c.id} className="flex gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">{c.user_name[0]}</div>
                        <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-3 py-2 flex-1">
                          <p className="text-xs font-bold text-gray-700">{c.user_name}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{c.comment}</p>
                        </div>
                      </div>
                    ))}
                    <form onSubmit={handleComment} className="pt-2 border-t border-gray-100 space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          value={comment}
                          onChange={e => { setComment(e.target.value); setCommentErr(''); }}
                          placeholder={user ? 'Escribí un comentario...' : 'Iniciá sesión para comentar'}
                          readOnly={!user}
                          onClick={() => !user && openAuthModal('Iniciá sesión para comentar')}
                          className={`flex-1 px-3 py-2 bg-gray-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 ${!user ? 'cursor-pointer' : ''}`}
                        />
                        {user && (
                          <button type="submit" disabled={commenting}
                            className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center disabled:opacity-60 flex-shrink-0">
                            {commenting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                      {commentErr && <p className="text-xs text-red-500 ml-1">{commentErr}</p>}
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── SIDEBAR: solo desktop ─────────────────────────── */}
          <div className="hidden md:flex flex-col gap-4 mt-0">
            {enrollMsg && (
              <p className={`text-sm text-center font-semibold px-3 py-2 rounded-xl ${enrollMsg === 'Inscripción enviada.' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                {enrollMsg}
              </p>
            )}
            <EnrollButton />
          </div>
        </div>
      </div>

      {/* ── BOTÓN FIJO MOBILE/TABLET (oculto en desktop) ─── */}
      {/* z-[60] para estar sobre el BottomNav que tiene z-50   */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 pt-3 pb-4 z-[60] shadow-lg">
        {enrollMsg && (
          <p className={`text-xs text-center mb-2 font-semibold ${enrollMsg === 'Inscripción enviada.' ? 'text-emerald-600' : 'text-red-500'}`}>
            {enrollMsg}
          </p>
        )}
        <EnrollButton />
      </div>
    </div>
  );
}
