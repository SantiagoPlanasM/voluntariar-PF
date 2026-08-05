import { useState, useEffect } from 'react';
import { Search, Leaf, Utensils, GraduationCap, PawPrint, HeartPulse, Laptop } from 'lucide-react';
import { api, Project } from '../../lib/api';
import { ProjectCard } from './ProjectCard';
import { ExploreMap } from './ExploreMap';

const CATEGORIES = [
  { 
    name: 'Medio Ambiente', 
    desc: 'Cuidá el planeta, plantá árboles y limpiá espacios.',
    icon: Leaf, 
    color: 'text-emerald-600', 
    bg: 'bg-emerald-50', 
    border: 'hover:border-emerald-200', 
    gradient: 'from-emerald-500/10 to-teal-500/5' 
  },
  { 
    name: 'Alimentación', 
    desc: 'Ayudá en comedores y combatí el hambre.',
    icon: Utensils, 
    color: 'text-orange-600', 
    bg: 'bg-orange-50', 
    border: 'hover:border-orange-200', 
    gradient: 'from-orange-500/10 to-amber-500/5' 
  },
  { 
    name: 'Educación', 
    desc: 'Compartí tus conocimientos con quienes lo necesitan.',
    icon: GraduationCap, 
    color: 'text-indigo-600', 
    bg: 'bg-indigo-50', 
    border: 'hover:border-indigo-200', 
    gradient: 'from-indigo-500/10 to-purple-500/5' 
  },
  { 
    name: 'Animales', 
    desc: 'Colaborá en refugios y protegé a las mascotas.',
    icon: PawPrint, 
    color: 'text-pink-600', 
    bg: 'bg-pink-50', 
    border: 'hover:border-pink-200', 
    gradient: 'from-pink-500/10 to-rose-500/5' 
  },
  { 
    name: 'Salud', 
    desc: 'Brindá apoyo emocional, médico o deportivo.',
    icon: HeartPulse, 
    color: 'text-red-600', 
    bg: 'bg-red-50', 
    border: 'hover:border-red-200', 
    gradient: 'from-red-500/10 to-rose-500/5' 
  },
  { 
    name: 'Tecnología', 
    desc: 'Proyectos digitales, diseño y desarrollo web social.',
    icon: Laptop, 
    color: 'text-blue-600', 
    bg: 'bg-blue-50', 
    border: 'hover:border-blue-200', 
    gradient: 'from-blue-500/10 to-cyan-500/5' 
  },
];

export function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'fugaz' | 'sostenido'>('all');
  const [results, setResults] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [recommended, setRecommended] = useState<Project[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  useEffect(() => {
    loadRecommended();
  }, []);

  const loadRecommended = async () => {
    setRecLoading(true);
    try {
      const data = await api.projects.list({});
      setRecommended(data.projects.slice(0, 4));
      setAllProjects(data.projects);
    } catch {
      setRecommended([]);
      setAllProjects([]);
    } finally {
      setRecLoading(false);
    }
  };

  const executeSearch = async (q: string, category: string | null, type: 'all' | 'fugaz' | 'sostenido') => {
    setLoading(true);
    setSearched(true);
    try {
      const params: Record<string, string> = {};
      if (q.trim()) params.search = q.trim();
      if (category) params.category = category;
      if (type !== 'all') params.type = type;
      setResults((await api.projects.list(params)).projects);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveCategory(null);
    executeSearch(query, null, typeFilter);
  };

  const handleCategoryClick = (catName: string) => {
    setQuery('');
    setActiveCategory(catName);
    executeSearch('', catName, typeFilter);
  };

  const handleTypeFilterChange = (type: 'all' | 'fugaz' | 'sostenido') => {
    setTypeFilter(type);
    if (searched) {
      executeSearch(activeCategory ? '' : query, activeCategory, type);
    }
  };

  const handleClearSearch = () => {
    setSearched(false);
    setQuery('');
    setActiveCategory(null);
    setTypeFilter('all');
    setResults([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 md:ml-60">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-6 sticky top-0 z-20 shadow-xs bg-white/95 backdrop-blur-md">
        <div className="max-w-4xl mx-auto space-y-4">
          <div>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Búsqueda Solidaria</p>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mt-0.5">Descubrí tu próxima causa</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Encontrá proyectos sociales en Córdoba que coincidan con tus ganas de ayudar.</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="flex-1">
              <div className="relative shadow-xs rounded-xl">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text"
                  placeholder="Buscar por nombre, palabra clave, lugar..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  value={query} 
                  onChange={e => setQuery(e.target.value)} 
                />
              </div>
            </form>

            <div className="flex flex-wrap gap-2 self-start sm:self-center">
              {/* Type filters */}
              <div className="flex bg-gray-100 p-1 rounded-xl shadow-xs">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'fugaz', label: 'Fugaces' },
                  { id: 'sostenido', label: 'Sostenidos' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleTypeFilterChange(id as any)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      typeFilter === id 
                        ? 'bg-white text-emerald-600 shadow-xs' 
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto px-6 py-6 pb-24">
        {!searched ? (
          <div className="space-y-8">
            
            {/* Mapa Section */}
            <div className="space-y-4">
              <div className="border-b border-gray-100 pb-2">
                <h2 className="font-bold text-sm sm:text-base text-gray-900 uppercase tracking-wider">Voluntariados cercanos</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">Explorá visualmente los proyectos activos según tu ubicación en Córdoba.</p>
              </div>
              <ExploreMap projects={typeFilter === 'all' ? allProjects : allProjects.filter(p => p.type === typeFilter)} />
            </div>

            {/* Categorías Section */}
            <div className="space-y-4">
              <h2 className="font-bold text-sm sm:text-base text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">Categorías de interés</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CATEGORIES.map(({ name, desc, icon: IconComponent, color, bg, border, gradient }) => (
                  <button key={name} onClick={() => handleCategoryClick(name)}
                    className={`bg-white rounded-2xl p-5 shadow-xs border border-gray-100 flex items-start gap-4 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all text-left bg-gradient-to-br ${gradient} ${border} group cursor-pointer`}>
                    <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center ${color} flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform duration-300`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-base text-gray-800 leading-tight block group-hover:text-emerald-700 transition-colors">{name}</span>
                      <span className="text-xs text-gray-500 mt-1 block leading-relaxed">{desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Proyectos Recomendados Section */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h2 className="font-bold text-sm sm:text-base text-gray-900 uppercase tracking-wider">Proyectos destacados</h2>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide">Recientes</span>
              </div>

              {recLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {[1, 2].map(i => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                      <div className="h-40 bg-gray-200" />
                      <div className="p-4 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recommended.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No hay proyectos recomendados disponibles en este momento.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {recommended.map(p => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          /* Search results view */
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <p className="text-xs text-gray-400">
                  {activeCategory ? `Categoría: ${activeCategory}` : `Búsqueda: "${query}"`}
                  {typeFilter !== 'all' && ` · Tipo: ${typeFilter === 'fugaz' ? 'Fugaz' : 'Sostenido'}`}
                </p>
                <p className="text-base font-bold text-gray-800 mt-0.5">
                  {results.length} voluntariado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={handleClearSearch}
                className="px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 hover:text-emerald-700 text-gray-600 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer">
                ← Volver a categorías
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[1, 2].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                    <div className="h-40 bg-gray-200" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-xs flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <Search className="w-8 h-8" />
                </div>
                <p className="text-gray-800 font-bold text-lg">Sin resultados encontrados</p>
                <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">Probá buscando con otros términos o removiendo el filtro por tipo de proyecto.</p>
                <button onClick={handleClearSearch}
                  className="text-sm text-emerald-600 font-bold mt-4 hover:underline">
                  Ver todas las categorías
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {results.map(p => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
