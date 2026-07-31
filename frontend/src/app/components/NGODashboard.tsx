import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Plus, Search, Users, Sprout, ChevronRight, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { api, Project, EnrollmentWithVolunteer, NGO, NGOStats } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';

const safeNum = (v: any, f=0) => { const n=parseFloat(v); return isNaN(n)?f:n; };
const safeMoney = (v: any) => { const n=safeNum(v); return '$'+(n>=1000?(n/1000).toFixed(1)+'k':n.toLocaleString('es-AR')); };

export function NGODashboard() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [ngo, setNgo]         = useState<NGO | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats]     = useState<NGOStats | null>(null);
  const [pending, setPending] = useState<EnrollmentWithVolunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [processing, setProcessing] = useState<string|null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { ngo: n, projects: p, stats: s } = await api.ngos.me();
      setNgo(n); setProjects(p); setStats(s);
      const all: EnrollmentWithVolunteer[] = [];
      for (const proj of p) {
        try { const { enrollments } = await api.enrollments.byProject(proj.id);
          all.push(...enrollments.filter(e=>e.status==='pending')); } catch {}
      }
      setPending(all);
    } catch (e: any) {
      if (e.message?.includes('Token')||e.message?.includes('autenticado')) navigate('/');
    } finally { setLoading(false); }
  };

  const handleEnrollment = async (id: string, status: 'approved'|'rejected') => {
    setProcessing(id);
    try { await api.enrollments.updateStatus(id, status); load(); }
    catch (e: any) { alert(e.message); }
    finally { setProcessing(null); }
  };

  const filtered = projects.filter(p => p.title.toLowerCase().includes(search.toLowerCase().trim()));

  if (loading) return <div className="flex items-center justify-center h-screen md:ml-60"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-gray-50 md:ml-60">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              {ngo?.logo && <img src={ngo.logo} alt={ngo.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100 flex-shrink-0"/>}
              <div>
                <h1 className="text-base sm:text-lg font-bold text-gray-900">{ngo?.name}</h1>
                <p className="text-xs text-gray-400">Panel de gestión</p>
              </div>
            </div>
            <button onClick={() => navigate('/ngo/create')}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-emerald-700 transition-colors flex-shrink-0">
              <Plus className="w-4 h-4"/><span className="hidden sm:inline">Nuevo proyecto</span><span className="sm:hidden">Nuevo</span>
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input type="text" placeholder="Buscar proyectos..."
              className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Stats grid: 2 col mobile → 4 col desktop */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Proyectos activos', val: safeNum(stats.active_projects),    color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Voluntarios',       val: safeNum(stats.total_volunteers),    color: 'text-blue-600',    bg: 'bg-blue-50'    },
              { label: 'Pendientes',        val: safeNum(stats.pending_enrollments), color: 'text-amber-500',   bg: 'bg-amber-50'   },
              { label: 'Recaudado',         val: safeMoney(stats.total_funding),     color: 'text-violet-600',  bg: 'bg-violet-50', str: true },
            ].map(({ label, val, color, bg }) => (
              <div key={label} className={`${bg} rounded-2xl p-4`}>
                <p className={`text-2xl sm:text-3xl font-bold ${color}`}>{val}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Two-col layout on desktop */}
        <div className="md:grid md:grid-cols-2 md:gap-5 space-y-5 md:space-y-0">
          {/* Pending */}
          {pending.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500"/>
                <h2 className="font-bold text-sm text-gray-900">Solicitudes pendientes ({pending.length})</h2>
              </div>
              <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {pending.map(e => (
                  <div key={e.id} className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">{e.volunteer_name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{e.volunteer_name}</p>
                      <p className="text-xs text-gray-400 truncate">{e.volunteer_email}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => handleEnrollment(e.id,'approved')} disabled={processing===e.id}
                        className="w-9 h-9 bg-green-50 text-green-600 rounded-xl flex items-center justify-center hover:bg-green-100 disabled:opacity-50">
                        {processing===e.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4"/>}
                      </button>
                      <button onClick={() => handleEnrollment(e.id,'rejected')} disabled={processing===e.id}
                        className="w-9 h-9 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 disabled:opacity-50">
                        <XCircle className="w-4 h-4"/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${pending.length === 0 ? 'md:col-span-2' : ''}`}>
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Sprout className="w-4 h-4 text-emerald-600"/>
              <h2 className="font-bold text-sm text-gray-900">Mis Voluntariados ({filtered.length}{search?` de ${projects.length}`:''})</h2>
            </div>
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">{search ? `Sin resultados para "${search}"` : 'No hay proyectos aún'}</p>
                {!search && <button onClick={() => navigate('/ngo/create')} className="text-xs text-blue-600 font-semibold mt-2 block mx-auto">Crear el primero →</button>}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map(p => (
                  <Link key={p.id} to={`/ngo/dashboard/project/${p.id}`}>
                    <div className="p-4 flex gap-3 hover:bg-gray-50 transition-colors">
                      {p.image
                        ? <img src={p.image} alt={p.title} className="w-14 h-14 rounded-xl object-cover flex-shrink-0"/>
                        : <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0"><Sprout className="w-6 h-6 text-emerald-400"/></div>
                      }
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-gray-900 truncate">{p.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{p.category} · {p.type==='fugaz'?'Fugaz':'Sostenido'}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-gray-400 flex items-center gap-1"><Users className="w-3 h-3"/>{safeNum(p.current_volunteers)}/{safeNum(p.volunteers_needed)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status==='active'?'bg-green-50 text-green-600':'bg-gray-100 text-gray-500'}`}>
                            {p.status==='active'?'Activo':'Completado'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 self-center flex-shrink-0"/>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
