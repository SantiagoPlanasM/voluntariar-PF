import { useState, useEffect } from 'react';
import { Search, Heart, Users, MapPin, Zap, Calendar, Clock, DollarSign, Sparkles, ArrowRight, Compass, Leaf, Apple, BookOpen, PawPrint, HeartPulse } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { api, Project } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';

const CATEGORIES = [
  { name: 'Todos',           icon: Compass,    color: 'text-sky-500 hover:text-sky-600' },
  { name: 'Medio Ambiente',  icon: Leaf,       color: 'text-emerald-500 hover:text-emerald-600' },
  { name: 'Alimentación',    icon: Apple,      color: 'text-rose-500 hover:text-rose-600' },
  { name: 'Educación',       icon: BookOpen,   color: 'text-indigo-500 hover:text-indigo-600' },
  { name: 'Animales',        icon: PawPrint,   color: 'text-amber-500 hover:text-amber-600' },
  { name: 'Salud',           icon: HeartPulse, color: 'text-red-500 hover:text-red-600' },
];

function safeMoney(val: any): string {
  const n = parseFloat(val);
  if (isNaN(n) || !isFinite(n)) return '$0';
  return '$' + n.toLocaleString('es-AR');
}
function safePct(a: any, b: any): number {
  const na = parseFloat(a), nb = parseFloat(b);
  if (!nb || isNaN(na) || isNaN(nb)) return 0;
  return Math.min(100, Math.round((na / nb) * 100));
}

export function PublicFeed() {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [cat, setCat]           = useState('Todos');

  useEffect(() => {
    if (user) { navigate(user.role === 'ngo' ? '/ngo/dashboard' : '/feed', { replace: true }); return; }
    load();
  }, [user]);

  useEffect(() => { if (!user) load(); }, [cat]);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (cat !== 'Todos') params.category = cat;
      if (search.trim())   params.search   = search.trim();
      setProjects((await api.projects.list(params)).projects);
    } catch { setProjects([]); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
              <Heart className="w-5 h-5 text-white fill-white" />
            </div>
            <span className="font-black text-xl text-gray-900 tracking-tight">Voluntariar</span>
            <span className="h-4 w-px bg-gray-200 mx-1 hidden sm:inline" />
            <a 
              href="https://www.ucc.edu.ar/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center transition-all duration-200 hover:opacity-85 hover:scale-105 active:scale-95 ml-1"
              title="Universidad Católica de Córdoba"
            >
              <img src="/ucc_logo.png" alt="UCC" className="h-6 w-auto object-contain" />
            </a>
          </div>

          {/* Search en desktop */}
          <form onSubmit={e => { e.preventDefault(); load(); }} className="hidden md:flex flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar proyectos..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" />
            </div>
          </form>

          <div className="flex items-center gap-2">
            <button onClick={() => openAuthModal()}
              className="hidden sm:inline text-sm font-semibold text-gray-700 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
              Entrar
            </button>
            <button onClick={() => openAuthModal('Creá tu cuenta gratis y empezá a ayudar hoy')}
              className="text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl transition-colors shadow-sm">
              <span className="hidden sm:inline">Unirme gratis</span>
              <span className="sm:hidden">Unirme</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-emerald-950 text-white">
        {/* Background Image & Effects */}
        <div className="absolute inset-0 select-none pointer-events-none">
          <img 
            src="/volunteers_hero_bg.png" 
            className="w-full h-full object-cover object-center scale-[1.02]" 
            alt="Voluntarios" 
          />
          {/* Linear gradient overlay from dark emerald on the left to transparent on the right */}
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-950/85 sm:via-emerald-950/70 to-emerald-900/10" />
          {/* Gaussian blur gradient (blurred on the left under text, clear on the right) */}
          <div className="absolute inset-0 backdrop-blur-[3px] [mask-image:linear-gradient(to_right,rgba(0,0,0,1)_30%,rgba(0,0,0,0))] hidden sm:block" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20 z-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-300 uppercase tracking-widest">Red Social Solidaria · UCC</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight mb-4 drop-shadow-md">
              Hacé la diferencia.<br />
              <span className="text-emerald-300">Hoy.</span>
            </h1>
            <p className="text-emerald-100 text-base sm:text-lg leading-relaxed mb-8 max-w-lg drop-shadow-sm">
              Conectamos voluntarios con proyectos sociales reales en Córdoba.
              Desde una jornada de un día hasta proyectos sostenidos.
            </p>
            
            {/* Metrics widgets */}
            <div className="flex gap-4 sm:gap-6 flex-wrap">
              {[
                { val: '24',    label: 'proyectos activos' },
                { val: '2.4k', label: 'voluntarios' },
                { val: '12',   label: 'ONGs aliadas' },
              ].map(({ val, label }) => (
                <div key={label} className="bg-emerald-900/25 backdrop-blur-sm px-3.5 py-2 rounded-xl border border-white/5">
                  <p className="text-2xl sm:text-3xl font-black text-white">{val}</p>
                  <p className="text-xs sm:text-sm text-emerald-300 font-medium">{label}</p>
                </div>
              ))}
            </div>

            {/* CTA buttons */}
            <div className="hidden md:flex gap-3 mt-8">
              <button onClick={() => openAuthModal('Creá tu cuenta gratis y empezá a ayudar hoy')}
                className="px-6 py-3 bg-white text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2">
                Crear cuenta gratis <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => openAuthModal()}
                className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 border border-white/10 backdrop-blur-sm">
                Iniciar sesión
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Category pills ──────────────────────────────────────────── */}
      <div className="sticky top-16 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-2 py-3 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map(({ name, icon: Icon, color }) => (
              <button key={name} onClick={() => setCat(name)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                  cat === name 
                    ? 'bg-emerald-600 text-white shadow-md hover:bg-emerald-700 hover:scale-102' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 hover:scale-102'
                }`}>
                <Icon className={`w-4 h-4 transition-colors ${cat === name ? 'text-white' : color}`} strokeWidth={2.2} />
                <span>{name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg sm:text-xl text-gray-900">
            {cat === 'Todos' ? 'Proyectos destacados' : cat}
          </h2>
          <span className="text-sm text-gray-400">{projects.length} proyectos</span>
        </div>

        {/* Grid: 1 col mobile → 2 col tablet → 3 col desktop */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded" />
                  <div className="h-2 bg-gray-200 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center justify-center">
            <Search className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-400 font-medium text-lg">Sin proyectos en esta categoría</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {projects.map(p => (
                <PublicCard key={p.id} project={p}
                  onAction={() => openAuthModal('Iniciá sesión para inscribirte como voluntario')} />
              ))}
            </div>

            {/* Footer CTA */}
            <div className="mt-10 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-3xl p-6 sm:p-10 text-center">
              <h3 className="font-black text-xl sm:text-2xl text-gray-900 mb-2">¿Querés participar?</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">Creá tu cuenta gratis en 30 segundos y empezá a hacer la diferencia hoy</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={() => openAuthModal('Creá tu cuenta gratis')}
                  className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors shadow-md shadow-emerald-200">
                  Crear cuenta gratis
                </button>
                <button onClick={() => openAuthModal()}
                  className="px-8 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors">
                  Ya tengo cuenta
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Card pública ──────────────────────────────────────────────────────────
function PublicCard({ project, onAction }: { project: Project; onAction: () => void }) {
  const fundPct   = safePct(project.current_funding, project.funding_goal);
  const volPct    = safePct(project.current_volunteers, project.volunteers_needed);
  const spotsLeft = (project.volunteers_needed || 0) - (project.current_volunteers || 0);
  const hasFunding = (project.funding_goal || 0) > 0;

  return (
    <Link to={`/project/${project.id}`}>
      <article className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-emerald-200 hover:shadow-xl transition-all h-full flex flex-col group">
        <div className="relative h-48 overflow-hidden bg-gray-100 flex-shrink-0">
          {project.image
            ? <img src={project.image} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
            : <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                <Heart className="w-12 h-12 text-emerald-300" />
              </div>
          }
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <div className="absolute top-3 left-3 flex gap-1.5">
            <span className="px-2.5 py-1 bg-white/95 rounded-full text-xs font-bold text-gray-800 shadow-sm">{project.category}</span>
          </div>
          <div className="absolute top-3 right-3">
            {project.type === 'fugaz'
              ? <span className="px-2.5 py-1 bg-blue-600/90 rounded-full text-xs font-bold text-white flex items-center gap-1"><Zap className="w-3 h-3" />Fugaz</span>
              : <span className="px-2.5 py-1 bg-emerald-600/90 rounded-full text-xs font-bold text-white flex items-center gap-1"><Calendar className="w-3 h-3" />Sostenido</span>
            }
          </div>
          {spotsLeft > 0 && spotsLeft <= 10 && (
            <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-amber-500 rounded-full text-[11px] font-bold text-white">
              ¡Solo {spotsLeft} lugares!
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-2.5">
            {project.ngo_logo
              ? <img src={project.ngo_logo} alt={project.ngo_name} className="w-6 h-6 rounded-full object-cover ring-1 ring-gray-200" />
              : <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">{project.ngo_name?.[0]}</div>
            }
            <span className="text-xs font-semibold text-gray-500">{project.ngo_name}</span>
          </div>

          <h3 className="font-bold text-base text-gray-900 leading-snug mb-1.5">{project.title}</h3>
          <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-1">{project.description}</p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 rounded-full text-xs text-gray-600">
              <MapPin className="w-3 h-3 text-gray-400" />{project.location}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 rounded-full text-xs text-gray-600">
              <Clock className="w-3 h-3 text-gray-400" />
              {project.type === 'fugaz' ? (project.duration || 'Sin especificar') : (project.hours_per_week ? `${project.hours_per_week}h/sem` : 'Sin especificar')}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${(project.cost_per_person || 0) === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-600'}`}>
              <DollarSign className="w-3 h-3" />
              {(project.cost_per_person || 0) === 0 ? 'Gratis' : safeMoney(project.cost_per_person)}
            </span>
          </div>

          <div className="space-y-2 mb-4">
            {hasFunding && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Financiamiento</span>
                  <span className="font-bold text-blue-600">{fundPct}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" style={{ width: `${fundPct}%` }} />
                </div>
              </div>
            )}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" />Voluntarios</span>
                <span className="font-bold text-emerald-600">{project.current_volunteers || 0}/{project.volunteers_needed || 0}</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full" style={{ width: `${volPct}%` }} />
              </div>
            </div>
          </div>

          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onAction(); }}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-2 mt-auto">
            <Users className="w-3.5 h-3.5" />Inscribirme
          </button>
        </div>
      </article>
    </Link>
  );
}
