import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Search, SlidersHorizontal, MapPin, X, Laptop } from 'lucide-react';
import { api, Project } from '../../lib/api';
import { ProjectMap } from './ProjectMap';
import { FilterModal, FilterState, DEFAULT_FILTERS, filterProjects } from './FilterModal';

export function ExploreScreen() {
  const navigate = useNavigate();

  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [showAllFeatured, setShowAllFeatured] = useState(false);

  // Cantidad de filtros activos
  const activeFiltersCount = useMemo(() => {
    return (
      filters.categories.length +
      (filters.type !== 'all' ? 1 : 0) +
      (filters.modality !== 'all' ? 1 : 0) +
      (filters.cost !== 'all' ? 1 : 0)
    );
  }, [filters]);

  const hasActiveFilters = searchQuery.trim() !== '' || activeFiltersCount > 0;

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

  // Filtrado de proyectos en memoria
  const filteredProjects = useMemo(() => {
    return filterProjects(allProjects, searchQuery, filters);
  }, [allProjects, searchQuery, filters]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilters(DEFAULT_FILTERS);
  };

  const removeCategory = (cat: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c !== cat),
    }));
  };

  return (
    <div className="min-h-screen bg-white md:bg-gray-50 md:ml-60 pb-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-6">

        {/* ── 1. Header: Título ────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Explorar
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Descubre oportunidades de voluntariado en Córdoba
          </p>
        </div>

        {/* ── 2. Search Bar + Filter Button ────────────────────────────── */}
        <div>
          <div className="flex gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por título, ONG, ubicación..."
                className="w-full pl-11 pr-10 py-3 bg-gray-100 hover:bg-gray-150 focus:bg-white rounded-2xl text-sm text-gray-900 placeholder-gray-400 border border-transparent focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setIsFilterModalOpen(true)}
              className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-sm flex-shrink-0 active:scale-95 cursor-pointer ${
                activeFiltersCount > 0
                  ? 'bg-[#1E3A2F] text-emerald-300 ring-2 ring-emerald-600/30'
                  : 'bg-[#1E3A2F] hover:bg-[#152921] text-white'
              }`}
              title="Abrir filtros de búsqueda"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-xs">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Pastillas de Filtros Activos (solo si hay filtros aplicados) */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-2 mt-1">
              {filters.categories.map(cat => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0 animate-in fade-in duration-150"
                >
                  <span>{cat}</span>
                  <button
                    onClick={() => removeCategory(cat)}
                    className="hover:bg-emerald-200/60 rounded-full p-0.5 cursor-pointer"
                    title={`Quitar filtro ${cat}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {filters.type !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0 animate-in fade-in duration-150">
                  <span>{filters.type === 'fugaz' ? 'Fugaz' : 'Sostenido'}</span>
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, type: 'all' }))}
                    className="hover:bg-emerald-200/60 rounded-full p-0.5 cursor-pointer"
                    title="Quitar filtro de tipo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filters.modality !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0 animate-in fade-in duration-150">
                  <span>{filters.modality === 'remoto' ? 'Remoto' : 'Presencial'}</span>
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, modality: 'all' }))}
                    className="hover:bg-emerald-200/60 rounded-full p-0.5 cursor-pointer"
                    title="Quitar filtro de modalidad"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filters.cost !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0 animate-in fade-in duration-150">
                  <span>{filters.cost === 'gratis' ? 'Gratis' : 'Con aporte'}</span>
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, cost: 'all' }))}
                    className="hover:bg-emerald-200/60 rounded-full p-0.5 cursor-pointer"
                    title="Quitar filtro de costo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                onClick={handleResetFilters}
                className="text-xs font-bold text-gray-500 hover:text-gray-800 underline px-1.5 shrink-0 cursor-pointer"
              >
                Limpiar todo
              </button>
            </div>
          )}
        </div>

        {/* ── 3. Mapa Interactivo de Voluntariados ────────────── */}
        <ProjectMap projects={filteredProjects} />

        {/* ── 4. Proyectos Destacados / Encontrados ─────────────── */}
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
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                Limpiar filtros
              </button>
            ) : (
              <button
                onClick={() => setShowAllFeatured(!showAllFeatured)}
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 cursor-pointer"
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
                className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
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
                      {p.modality === 'remoto' ? (
                        <>
                          <Laptop className="w-3 h-3 text-violet-500 flex-shrink-0" />
                          <span className="truncate text-violet-600 font-medium">
                            {p.location && p.location.toLowerCase() !== 'remoto' ? `Remoto (${p.location})` : 'Remoto'}
                          </span>
                        </>
                      ) : (
                        <>
                          <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{p.location || 'Córdoba, Argentina'}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Modal de Filtros estilo Airbnb ─────────────────────────── */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        allProjects={allProjects}
        searchQuery={searchQuery}
        currentFilters={filters}
        onApply={newFilters => setFilters(newFilters)}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />
    </div>
  );
}
