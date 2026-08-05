import { useParams, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Clock, Users, DollarSign, Calendar, Star, Briefcase, Loader2, Send, Zap } from 'lucide-react';
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
    try { await api.enrollments.enroll(id!); setEnrollMsg('✓ Inscripción enviada.'); load(id!); }
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
        ? `Inscripto · ${project.my_enrollment?.status === 'approved' ? 'Aprobado ✓' : 'Pendiente'}`
        : 'Unirme como voluntario'}
    </button>
  );

  return (
    // pb-32 en mobile para que el botón fijo no tape el contenido
    // md:pb-8 en desktop donde no hay botón fijo
    <div className="min-h-screen bg-gray-50 md:ml-60 pb-32 lg:pb-12">

      {/* Hero */}
      <div className="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden bg-zinc-900">
        {project.image ? (
          <img src={project.image} alt={project.title} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 opacity-80" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        
        <button onClick={() => navigate(-1)}
          className="absolute top-6 left-6 w-11 h-11 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-md hover:bg-white hover:scale-105 active:scale-95 transition-all z-10 group"
          title="Volver">
          <ArrowLeft className="w-5 h-5 text-gray-800 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        
        <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-2">
          <div className="flex gap-2">
            <span className="px-3.5 py-1 bg-emerald-500 text-white rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">{project.category}</span>
            {project.type === 'fugaz' ? (
              <span className="px-3.5 py-1 bg-blue-600 text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm"><Zap className="w-3.5 h-3.5" />Fugaz</span>
            ) : (
              <span className="px-3.5 py-1 bg-teal-600 text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm"><Calendar className="w-3.5 h-3.5" />Sostenido</span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-sm mt-1">{project.title}</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Columna izquierda (2/3) - Contenido Principal */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* NGO Host Info (Elegant row above description) */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {project.ngo_logo ? (
                  <img src={project.ngo_logo} alt={project.ngo_name} className="w-12 h-12 rounded-xl object-cover ring-2 ring-gray-50 shadow-sm" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-lg font-bold text-emerald-700 shadow-sm">{project.ngo_name?.[0]}</div>
                )}
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Organizado por</p>
                  <p className="text-base font-bold text-gray-900 leading-tight">{project.ngo_name}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1.5 rounded-xl border border-yellow-100 shadow-sm">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-bold text-yellow-800">{(project.avg_rating || 0).toFixed(1)}</span>
                <span className="text-xs text-yellow-600/80">({project.ratings.length} reseñas)</span>
              </div>
            </div>

            {/* Info grid on MOBILE - hidden on Desktop since it will be in the sticky sidebar */}
            <div className="grid grid-cols-2 gap-3 lg:hidden">
              {[
                { icon: MapPin,     label: 'Ubicación',   val: project.location },
                { icon: Clock,      label: project.type === 'fugaz' ? 'Duración' : 'Horas/sem', val: hoursLabel },
                { icon: DollarSign, label: 'Costo',       val: (project.cost_per_person || 0) === 0 ? 'Gratis' : safeMoney(project.cost_per_person) },
                { icon: Users,      label: 'Voluntarios', val: `${project.current_volunteers || 0}/${project.volunteers_needed || 0}` },
              ].map(({ icon: Icon, label, val }) => (
                <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">{label}</p>
                    <p className="text-sm font-bold text-gray-800 leading-tight mt-0.5">{val}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabs container */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex border-b border-gray-100 bg-gray-50/50 p-1">
                {(['details', 'ratings', 'comments'] as Tab[]).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                      tab === t 
                        ? 'bg-white text-emerald-600 shadow-sm border border-gray-100' 
                        : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                    }`}>
                    {t === 'details' ? 'Detalles' : t === 'ratings' ? `Reseñas (${project.ratings.length})` : `Comentarios (${project.comments.length})`}
                  </button>
                ))}
              </div>
              
              <div className="p-5 sm:p-6">
                {tab === 'details' && (
                  <div className="space-y-6">
                    <div className="prose prose-emerald max-w-none">
                      <p className="text-sm sm:text-base text-gray-600 leading-relaxed whitespace-pre-line">{project.full_description || project.description}</p>
                    </div>
                    
                    {project.requirements?.length > 0 && (
                      <div className="pt-4 border-t border-gray-100">
                        <h4 className="font-bold text-sm text-gray-900 uppercase tracking-wider mb-3">Requisitos obligatorios</h4>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {project.requirements.map((r, i) => (
                            <li key={i} className="flex items-center gap-2.5 text-sm text-gray-600 bg-gray-50 px-3.5 py-2.5 rounded-xl border border-gray-100 animate-fade-in">
                              <span className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
                              <span className="leading-tight">{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Progress Indicators - visible in left column */}
                    <div className="bg-gray-50/60 rounded-2xl p-5 border border-gray-100 space-y-4 pt-4 mt-6">
                      <h4 className="font-bold text-sm text-gray-900 uppercase tracking-wider">Estado del proyecto</h4>
                      {hasFunding && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500 font-medium">Financiamiento recolectado</span>
                            <span className="font-bold text-blue-600">{fundPct}% · {safeMoney(project.current_funding)} / {safeMoney(project.funding_goal)}</span>
                          </div>
                          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500" style={{ width: `${fundPct}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 font-medium">Cupo de voluntarios</span>
                          <span className="font-bold text-emerald-600">{volPct}% · {project.current_volunteers || 0} / {project.volunteers_needed || 0}</span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500" style={{ width: `${volPct}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Roles sought - elegant style */}
                    {project.roles_needed?.length > 0 && (
                      <div className="pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 mb-3">
                          <Briefcase className="w-4 h-4 text-emerald-600" />
                          <h4 className="font-bold text-sm text-gray-900 uppercase tracking-wider">Perfiles requeridos</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {project.roles_needed.map((r, i) => (
                            <span key={i} className="px-3.5 py-2 bg-emerald-50/70 border border-emerald-100 text-emerald-800 text-xs font-bold rounded-xl shadow-xs">{r}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {tab === 'ratings' && (
                  project.ratings.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-8">Sin reseñas aún. ¡Sé el primero en calificar este proyecto!</p>
                    : <div className="space-y-4">
                        {project.ratings.map(r => (
                          <div key={r.id} className="flex gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center text-sm font-bold text-emerald-700 flex-shrink-0 shadow-sm">{r.user_name[0]}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start">
                                <p className="text-sm font-bold text-gray-800">{r.user_name}</p>
                                <div className="flex bg-yellow-50 px-2 py-0.5 rounded-lg border border-yellow-100">
                                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 mr-1 mt-0.5" />
                                  <span className="text-xs font-bold text-yellow-700">{r.rating}</span>
                                </div>
                              </div>
                              {r.comment && <p className="text-xs sm:text-sm text-gray-600 mt-1.5 leading-relaxed">{r.comment}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                )}
                
                {tab === 'comments' && (
                  <div className="space-y-4">
                    {project.comments.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-6">Sin comentarios aún. ¡Escribí una pregunta o saludo!</p>
                    )}
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {project.comments.map(c => (
                        <div key={c.id} className="flex gap-3 items-start">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-cyan-200 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0 shadow-xs">{c.user_name[0]}</div>
                          <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-none px-4 py-2.5 flex-1">
                            <p className="text-xs font-bold text-gray-800">{c.user_name}</p>
                            <p className="text-xs sm:text-sm text-gray-600 mt-1">{c.comment}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <form onSubmit={handleComment} className="pt-4 border-t border-gray-100 space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={comment}
                          onChange={e => { setComment(e.target.value); setCommentErr(''); }}
                          placeholder={user ? 'Escribí un comentario público...' : 'Iniciá sesión para realizar un comentario'}
                          readOnly={!user}
                          onClick={() => !user && openAuthModal('Iniciá sesión para comentar')}
                          className={`flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all ${!user ? 'cursor-pointer' : ''}`}
                        />
                        {user && (
                          <button type="submit" disabled={commenting}
                            className="px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center disabled:opacity-60 flex-shrink-0 transition-colors shadow-sm shadow-emerald-100">
                            {commenting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                      {commentErr && <p className="text-xs text-red-500 ml-1 font-semibold">{commentErr}</p>}
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Columna derecha (1/3) - Barra Lateral Sticky en Desktop */}
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24">
            
            {/* Principal Action & NGO organizadora */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
              <div>
                <h3 className="font-bold text-base text-gray-900 mb-1">¡Inscríbete hoy!</h3>
                <p className="text-xs text-gray-400">Sumate como voluntario en este proyecto social.</p>
              </div>

              {enrollMsg && (
                <div className={`text-sm text-center font-bold px-4 py-3 rounded-xl shadow-xs ${enrollMsg.startsWith('✓') ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-red-50 border border-red-100 text-red-600'}`}>
                  {enrollMsg}
                </div>
              )}

              <EnrollButton className="hover:scale-[1.02] active:scale-[0.98]" />
            </div>

            {/* Fact grid - solo visible en Desktop */}
            <div className="hidden lg:block bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
              <h3 className="font-bold text-sm text-gray-900 uppercase tracking-wider border-b border-gray-50 pb-2">Información general</h3>
              <div className="space-y-4">
                {[
                  { icon: MapPin,     label: 'Ubicación',   val: project.location, color: 'text-rose-500', bg: 'bg-rose-50' },
                  { icon: Clock,      label: project.type === 'fugaz' ? 'Duración' : 'Horas/semana', val: hoursLabel, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                  { icon: DollarSign, label: 'Costo',       val: (project.cost_per_person || 0) === 0 ? 'Gratis' : safeMoney(project.cost_per_person), color: 'text-amber-500', bg: 'bg-amber-50' },
                  { icon: Users,      label: 'Voluntarios inscritos', val: `${project.current_volunteers || 0} de ${project.volunteers_needed || 0}`, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                ].map(({ icon: Icon, label, val, color, bg }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl ${bg} ${color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider leading-tight">{label}</p>
                      <p className="text-sm font-bold text-gray-800 leading-snug mt-0.5 truncate">{val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* ── BOTÓN FIJO MOBILE/TABLET (oculto en desktop) ─── */}
      {/* z-[60] para estar sobre el BottomNav que tiene z-50   */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 px-4 pt-3 pb-4 z-[60] shadow-lg">
        {enrollMsg && (
          <p className={`text-xs text-center mb-2 font-semibold ${enrollMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>
            {enrollMsg}
          </p>
        )}
        <EnrollButton />
      </div>
    </div>
  );
}
