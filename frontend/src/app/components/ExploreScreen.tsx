import { useState } from 'react';
import { Search, Leaf, Apple, BookOpen, PawPrint, HeartPulse, Laptop } from 'lucide-react';
import { api, Project } from '../../lib/api';
import { ProjectCard } from './ProjectCard';

const CATEGORIES = [
  { name: 'Medio Ambiente', icon: Leaf,       color: 'text-emerald-500 bg-emerald-55/10 border-emerald-100' },
  { name: 'Alimentación',   icon: Apple,      color: 'text-rose-500 bg-rose-55/10 border-rose-100' },
  { name: 'Educación',      icon: BookOpen,   color: 'text-indigo-500 bg-indigo-55/10 border-indigo-100' },
  { name: 'Animales',       icon: PawPrint,   color: 'text-amber-500 bg-amber-55/10 border-amber-100' },
  { name: 'Salud',          icon: HeartPulse, color: 'text-red-500 bg-red-55/10 border-red-100' },
  { name: 'Tecnología',     icon: Laptop,     color: 'text-blue-500 bg-blue-55/10 border-blue-100' },
];

export function ExploreScreen() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true); setSearched(true);
    try { setResults((await api.projects.list({ search: trimmed })).projects); }
    catch { setResults([]); }
    finally { setLoading(false); }
  };

  const searchCategory = async (cat: string) => {
    setQuery(cat); setLoading(true); setSearched(true);
    try { setResults((await api.projects.list({ category: cat })).projects); }
    catch { setResults([]); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 md:ml-60">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-900 mb-3">Explorar</h1>
        <form onSubmit={e => { e.preventDefault(); doSearch(query); }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text"
              placeholder="Buscar por nombre, categoría, lugar..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={query} onChange={e => { setQuery(e.target.value); if (!e.target.value.trim()) setSearched(false); }} />
          </div>
        </form>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
        {!searched ? (
          <>
            <h2 className="font-bold text-sm text-gray-700 mb-3">Categorías</h2>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map(({ name, icon: Icon, color }) => (
                <button key={name} onClick={() => searchCategory(name)}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 hover:border-emerald-200 hover:shadow-md transition-all text-left active:scale-[0.98] group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${color} group-hover:scale-105 duration-200`}>
                    <Icon className="w-5 h-5" strokeWidth={2.2} />
                  </div>
                  <span className="font-bold text-sm text-gray-800 group-hover:text-emerald-700 transition-colors">{name}</span>
                </button>
              ))}
            </div>
          </>
        ) : loading ? (
          <div className="space-y-4">
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
          <div className="text-center py-12 flex flex-col items-center justify-center">
            <Search className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-400 font-medium">Sin resultados para "{query}"</p>
            <button onClick={() => { setSearched(false); setQuery(''); }}
              className="text-sm text-emerald-600 font-semibold mt-2">
              Ver categorías
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{results.length} resultado{results.length !== 1 ? 's' : ''}</p>
              <button onClick={() => { setSearched(false); setQuery(''); }}
                className="text-xs text-emerald-600 font-semibold">← Categorías</button>
            </div>
            {results.map(p => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
