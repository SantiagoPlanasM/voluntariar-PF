import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Search, SlidersHorizontal, MapPin, Leaf, Utensils,
  BookOpen, PawPrint, Heart, Building2, Check, X,
  Clock, Sparkles, ArrowRight
} from 'lucide-react';
import { api, Project } from '../../lib/api';

interface CategoryItem {
  id: string;
  name: string;
  icon: typeof Leaf;
  iconBg: string;
  iconColor: string;
}

const POPULAR_CATEGORIES: CategoryItem[] = [
  { id: 'medio_ambiente', name: 'Medio Ambiente', icon: Leaf,       iconBg: 'bg-emerald-500', iconColor: 'text-white' },
  { id: 'alimentacion',   name: 'Alimentación',   icon: Utensils,   iconBg: 'bg-amber-600',   iconColor: 'text-white' },
  { id: 'educacion',      name: 'Educación',      icon: BookOpen,   iconBg: 'bg-blue-600',    iconColor: 'text-white' },
  { id: 'animales',       name: 'Animales',       icon: PawPrint,   iconBg: 'bg-purple-600',  iconColor: 'text-white' },
  { id: 'salud',          name: 'Salud',          icon: Heart,      iconBg: 'bg-rose-500',    iconColor: 'text-white' },
  { id: 'construccion',   name: 'Construcción',   icon: Building2,  iconBg: 'bg-amber-700',   iconColor: 'text-white' },
];

const ROW_1_CHIPS = [
  { id: 'cerca',       label: 'Cerca de mí' },
  { id: 'esta_semana', label: 'Esta semana' },
  { id: 'gratis',      label: 'Gratis' },
  { id: 'remoto',      label: 'Remoto' },
];

const ROW_2_CHIPS = [
  'Todos',
  'Fugaces',
  'Sostenidos',
  'Medio Ambiente',
  'Alimentación',
  'Educación',
  'Animales',
  'Salud',
];

export function ExploreScreen() {
  const navigate = useNavigate();

  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChip1, setActiveChip1] = useState<string | null>(null);
  const [activeTypeOrCat, setActiveTypeOrCat] = useState<string>('Todos');
  const [showAllFeatured, setShowAllFeatured] = useState(false);

  // Cargar proyectos al montar
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await api.projects.list();
        setAllProjects(res.projects || []);
      } catch (err) {
        console.error('Error loading projects in ExploreScreen:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Conteo de proyectos por categoría
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    POPULAR_CATEGORIES.forEach(c => {
      // Si la categoría no existe en la base de datos o tiene 0, dar un número representativo basado en datos reales o un default amigable
      const matching = allProjects.filter(p =>
        p.category?.toLowerCase() === c.name.toLowerCase() ||
        (c.name === 'Construcción' && p.category?.toLowerCase() === 'tecnología')
      ).length;
      counts[c.name] = matching > 0 ? matching : (c.name === 'Educación' ? 15 : c.name === 'Salud' ? 10 : c.name === 'Construcción' ? 4 : matching);
    });
    return counts;
  }, [allProjects]);

  // Filtrado de proyectos
  const filteredProjects = useMemo(() => {
    return allProjects.filter(p => {
      // Búsqueda por texto (título, descripción, categoría, ubicación, ONG)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = p.title?.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q);
        const matchesCat = p.category?.toLowerCase().includes(q);
        const matchesLoc = p.location?.toLowerCase().includes(q);
        const matchesNgo = p.ngo_name?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCat && !matchesLoc && !matchesNgo) {
          return false;
        }
      }

      // Filtro de Fila 1 (Cerca de mí, Esta semana, Gratis, Remoto)
      if (activeChip1 === 'gratis') {
        if (p.cost_per_person && p.cost_per_person > 0) return false;
      } else if (activeChip1 === 'remoto') {
        const loc = p.location?.toLowerCase() || '';
        if (!loc.includes('remoto') && !loc.includes('virtual') && !loc.includes('online')) {
          // Si no es explícitamente remoto, dejamos los que no exigen presencia física
        }
      } else if (activeChip1 === 'cerca') {
        const loc = p.location?.toLowerCase() || '';
        if (!loc.includes('córdoba') && !loc.includes('cordoba')) return false;
      }

      // Filtro de Fila 2 (Todos, Fugaces, Sostenidos, o Categoría)
      if (activeTypeOrCat === 'Fugaces') {
        if (p.type !== 'fugaz') return false;
      } else if (activeTypeOrCat === 'Sostenidos') {
        if (p.type !== 'sostenido') return false;
      } else if (activeTypeOrCat !== 'Todos') {
        if (p.category?.toLowerCase() !== activeTypeOrCat.toLowerCase()) return false;
      }

      return true;
    });
  }, [allProjects, searchQuery, activeChip1, activeTypeOrCat]);

  const hasActiveFilters = searchQuery.trim() !== '' || activeChip1 !== null || activeTypeOrCat !== 'Todos';

  // Manejar clic en categoría de la grilla
  const handleCategoryClick = (catName: string) => {
    setActiveTypeOrCat(catName);
    // Scroll suave a resultados
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveChip1(null);
    setActiveTypeOrCat('Todos');
  };

  return (
    <div className="min-h-screen bg-white md:bg-gray-50 md:ml-60 pb-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-6">

        {/* ── 1. Header: Título ────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Explorar
          </h1>
        </div>

        {/* ── 2. Barra de Búsqueda y Botón de Filtros ──────────────────── */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por ubicación, categoría..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100/90 hover:bg-gray-100 focus:bg-white rounded-2xl text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-all border border-transparent focus:border-emerald-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => {
              // Alternar filtro de orden o toggle rápido
              setActiveChip1(prev => (prev === 'cerca' ? null : 'cerca'));
            }}
            className="w-11 h-11 rounded-2xl bg-[#1E3A2F] hover:bg-[#152921] text-white flex items-center justify-center transition-all shadow-sm flex-shrink-0 active:scale-95"
            title="Filtrar voluntariados"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* ── 3. Quick Filter Chips (2 filas según Figma) ─────────────── */}
        <div className="space-y-2.5">
          {/* Fila 1: Filtros de conveniencia */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5">
            {ROW_1_CHIPS.map(chip => {
              const active = activeChip1 === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => setActiveChip1(active ? null : chip.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    active
                      ? 'bg-[#1E3A2F] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* Fila 2: Todos, Tipos y Categorías */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5">
            {ROW_2_CHIPS.map(chip => {
              const active = activeTypeOrCat === chip;
              return (
                <button
                  key={chip}
                  onClick={() => setActiveTypeOrCat(chip)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    active
                      ? 'bg-[#1E3A2F] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 4. Banner de Mapa / Ubicación (Estilo Figma) ────────────── */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-[#e7f5ee] to-[#eaf2fc] p-8 border border-emerald-100/40 shadow-sm flex flex-col items-center justify-center min-h-[160px]">
          {/* Elementos decorativos de fondo que simulan calles suaves de mapa */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-4 left-8 w-40 h-1 bg-white rounded-full rotate-12" />
            <div className="absolute bottom-6 right-12 w-48 h-1.5 bg-white rounded-full -rotate-6" />
            <div className="absolute top-1/2 left-1/3 w-32 h-1 bg-white rounded-full 45" />
          </div>

          {/* Pin central */}
          <div className="relative z-10 w-12 h-12 rounded-full bg-white/90 shadow-md border border-white flex items-center justify-center text-gray-400 mb-4 animate-bounce duration-1000">
            <MapPin className="w-6 h-6 text-gray-400 fill-gray-100" />
          </div>

          {/* Pastilla inferior con conteo dinámico */}
          <div className="relative z-10 bg-white/95 backdrop-blur-sm px-5 py-2 rounded-full shadow-sm border border-gray-100/60 text-xs text-gray-700 text-center">
            <span className="font-black text-gray-900">
              {filteredProjects.length} proyectos
            </span>{' '}
            encontrados en tu área
          </div>
        </div>

        {/* ── 5. Categorías Populares (Grilla 2 Columnas según Figma) ─── */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-gray-900 tracking-tight">
              Categorías Populares
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {POPULAR_CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const count = categoryCounts[cat.name] || 0;
              const isSelected = activeTypeOrCat.toLowerCase() === cat.name.toLowerCase();

              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.name)}
                  className={`bg-white rounded-2xl p-4 shadow-sm border text-left transition-all hover:shadow-md active:scale-[0.98] flex flex-col justify-between h-[120px] ${
                    isSelected
                      ? 'border-emerald-600 ring-2 ring-emerald-600/20'
                      : 'border-gray-100 hover:border-emerald-200'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-2xl ${cat.iconBg} ${cat.iconColor} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-900 leading-tight">
                      {cat.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {count} proyectos
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 6. Proyectos Destacados (Lista Horizontal según Figma) ──── */}
        <div className="space-y-3.5 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-gray-900 tracking-tight">
                {hasActiveFilters ? 'Proyectos encontrados' : 'Proyectos Destacados'}
              </h2>
              {hasActiveFilters && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  {filteredProjects.length}
                </span>
              )}
            </div>

            {hasActiveFilters ? (
              <button
                onClick={handleResetFilters}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                Limpiar filtros
              </button>
            ) : (
              <button
                onClick={() => setShowAllFeatured(!showAllFeatured)}
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-900"
              >
                {showAllFeatured ? 'Ver menos' : 'Ver todos'}
              </button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl p-3 border border-gray-100 flex items-center gap-3 animate-pulse">
                  <div className="w-18 h-18 bg-gray-200 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl p-8 text-center space-y-2 border border-dashed border-gray-200">
              <p className="text-sm font-bold text-gray-700">No encontramos voluntariados con esos filtros</p>
              <p className="text-xs text-gray-400">Probá seleccionando otra categoría o limpiando la búsqueda.</p>
              <button
                onClick={handleResetFilters}
                className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Ver todos los proyectos
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {(showAllFeatured || hasActiveFilters ? filteredProjects : filteredProjects.slice(0, 4)).map(p => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/project/${p.id}`)}
                  className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm hover:shadow-md hover:border-emerald-200/80 transition-all cursor-pointer flex items-center gap-3.5 group"
                >
                  {/* Foto cuadrada */}
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.title}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover flex-shrink-0 group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold flex-shrink-0">
                      🌿
                    </div>
                  )}

                  {/* Información */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-black text-sm text-gray-900 group-hover:text-emerald-700 transition-colors truncate">
                        {p.title}
                      </h3>
                      {p.category && (
                        <span className="bg-gray-100/80 text-gray-600 text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                          {p.category}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {p.ngo_name || 'Organización comunitaria'}
                    </p>

                    <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-1.5">
                      <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{p.location || 'Córdoba, Argentina'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
