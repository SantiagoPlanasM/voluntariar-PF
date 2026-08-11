import { useState, useEffect } from 'react';
import { Search, LogOut } from 'lucide-react';
import { api, Project } from '../../lib/api';
import { ProjectCard } from './ProjectCard';
import { useAuth } from '../../lib/AuthContext';
import { useNavigate } from 'react-router';

const CATEGORIES = ['Todos','Fugaces','Sostenidos','Medio Ambiente','Alimentación','Educación','Animales','Salud'];

export function MainFeed() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [cat, setCat]           = useState('Todos');
  const [recommended, setRecommended] = useState<Project[]>([]);

  useEffect(() => { load(); }, [cat]);

  useEffect(() => {
    if (user?.role !== 'volunteer') return;
    api.projects.recommended(8).then(r => setRecommended(r.recommendations)).catch(() => {});
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (cat === 'Fugaces')    params.type = 'fugaz';
      else if (cat === 'Sostenidos') params.type = 'sostenido';
      else if (cat !== 'Todos') params.category = cat;
      if (search.trim()) params.search = search.trim();
      setProjects((await api.projects.list(params)).projects);
    } catch { setProjects([]); }
    finally { setLoading(false); }
  };

  return (
    /* md:ml-60 = deja espacio para el sidebar en desktop */
    <div className="min-h-screen bg-gray-50 md:ml-60">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="py-3 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-base sm:text-lg font-black text-gray-900">Inicio</h1>
              <p className="text-xs text-gray-400">Hola, {user?.name?.split(' ')[0]} 👋</p>
            </div>
            {/* Search en desktop inline */}
            <form onSubmit={e => { e.preventDefault(); load(); }}
              className="hidden sm:flex flex-1 max-w-sm">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Buscar..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </form>
            <button onClick={() => { logout(); navigate('/'); }}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0"
              title="Cerrar sesión">
              <LogOut className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Search mobile */}
          <form onSubmit={e => { e.preventDefault(); load(); }} className="sm:hidden pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Buscar voluntariados..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </form>

          {/* Categories */}
          <div className="flex gap-2 pb-3 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCat(c)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  c === cat ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {/* Recomendados para vos — solo en la vista sin filtros, para no competir con una búsqueda activa */}
        {recommended.length > 0 && cat === 'Todos' && !search.trim() && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-900 mb-3">✨ Recomendados para vos</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
              {recommended.map(p => (
                <div key={p.id} className="w-64 flex-shrink-0">
                  <ProjectCard project={p} onRefresh={load} />
                  {p.recommendation_reasons?.[0] && (
                    <p className="text-[11px] text-emerald-600 font-medium mt-1.5 px-1">{p.recommendation_reasons[0]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grid: 1 col mobile, 2 col tablet, 3 col desktop */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-44 bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded" />
                  <div className="h-2 bg-gray-200 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">🔍</p>
            <p className="font-medium text-gray-500">No hay proyectos</p>
            <p className="text-sm text-gray-400 mt-1">Probá con otros filtros</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {projects.map(p => <ProjectCard key={p.id} project={p} onRefresh={load} />)}
          </div>
        )}
      </div>
    </div>
  );
}
