import { useParams, useNavigate, Link } from 'react-router';
import { useEffect, useState } from 'react';
import { ArrowLeft, Users, CheckCircle, Clock, XCircle, Loader2, DollarSign, BarChart2, MessageCircle } from 'lucide-react';
import { api, Project, EnrollmentWithVolunteer } from '../../lib/api';

export function NGOProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentWithVolunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => { if (projectId) load(); }, [projectId]);

  const load = async () => {
    setLoading(true);
    try {
      const [{ project: p }, { enrollments: e }] = await Promise.all([
        api.projects.get(projectId!),
        api.enrollments.byProject(projectId!),
      ]);
      setProject(p); setEnrollments(e);
    } catch { navigate(-1); }
    finally { setLoading(false); }
  };

  const handle = async (id: string, status: 'approved' | 'rejected') => {
    setProcessing(id);
    try { await api.enrollments.updateStatus(id, status); load(); }
    catch (e: any) { alert(e.message); }
    finally { setProcessing(null); }
  };

  const filtered = filter === 'all' ? enrollments : enrollments.filter(e => e.status === filter);

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-[#0056B3]" /></div>;
  if (!project) return null;

  const fundPct = Math.min(100, (project.current_funding / project.funding_goal) * 100) || 0;
  const volPct  = Math.min(100, (project.current_volunteers / project.volunteers_needed) * 100) || 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-gray-700" />
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">{project.title}</h1>
            <p className="text-xs text-gray-500">{project.category} · {project.type}</p>
          </div>
          <button
            onClick={() => navigate(`/ngo/kpis/${projectId}`)}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-xl text-xs font-bold transition-colors">
            <BarChart2 className="w-3.5 h-3.5" />KPIs
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Users className="w-3.5 h-3.5" />Voluntarios</p>
            <p className="text-lg font-bold text-[#2D5A27]">{project.current_volunteers}/{project.volunteers_needed}</p>
            <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-[#2D5A27] rounded-full" style={{ width: `${volPct}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />Financiamiento</p>
            <p className="text-lg font-bold text-[#0056B3]">${project.current_funding.toLocaleString()}</p>
            <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-[#0056B3] rounded-full" style={{ width: `${fundPct}%` }} />
            </div>
          </div>
        </div>

        {/* Enrollments */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-sm text-gray-900 mb-3">Inscriptos ({enrollments.length})</h2>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {['all', 'pending', 'approved', 'rejected'].map(f => (
                <button key={f} onClick={() => setFilter(f as any)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    filter === f ? 'bg-[#0056B3] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                <div key={e.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#0056B3]/20 flex items-center justify-center text-sm font-bold text-[#0056B3] flex-shrink-0">
                      {e.volunteer_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">{e.volunteer_name}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            e.status === 'approved' ? 'bg-green-50 text-green-600'
                            : e.status === 'pending' ? 'bg-amber-50 text-amber-500'
                            : 'bg-red-50 text-red-500'}`}>
                            {e.status === 'approved' ? 'Aprobado' : e.status === 'pending' ? 'Pendiente' : 'Rechazado'}
                          </span>
                          <button onClick={() => navigate(`/ngo/messages/${e.user_id}`)}
                            className="w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors"
                            title={`Mensaje a ${e.volunteer_name}`}>
                            <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">{e.volunteer_email}</p>
                      {e.message && <p className="text-xs text-gray-500 italic mt-1">"{e.message}"</p>}
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
                        className="flex-1 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                        <XCircle className="w-3.5 h-3.5" />Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
