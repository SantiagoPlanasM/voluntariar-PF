import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Search, SlidersHorizontal, MapPin, X, Laptop, Sparkles, ChevronRight, ChevronLeft, Star, Users, Heart } from 'lucide-react';
import { api, Project } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { ProjectMap } from './ProjectMap';
import { FilterModal, FilterState, DEFAULT_FILTERS, filterProjects } from './FilterModal';

interface RecommendedProject extends Project {
  recommendation_score?: number;
  recommendation_reasons?: string[];
  recommendation_tags?: string[];
}

export function ExploreScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isVolunteer = user?.role === 'volunteer';

  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Recomendaciones
  const [recommendations, setRecommendations] = useState<RecommendedProject[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [recsExpanded, setRecsExpanded] = useState(false);

  // Scroll horizontal para recomendaciones
  const recsScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollRecsLeft, setCanScrollRecsLeft] = useState(false);
  const [canScrollRecsRight, setCanScrollRecsRight] = useState(false);

  const checkRecsScroll = useCallback(() => {
    const el = recsScrollRef.current;
    if (!el) return;
    setCanScrollRecsLeft(el.scrollLeft > 6);
    setCanScrollRecsRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
  }, []);

  const scrollRecs = (direction: 'left' | 'right') => {
    const el = recsScrollRef.current;
    if (!el) return;
    const scrollAmount = Math.max(260, Math.floor(el.clientWidth * 0.75));
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    setTimeout(checkRecsScroll, 350);
  };

  useEffect(() => {
    if (!loadingRecs && recommendations.length > 0 && !recsExpanded) {
      const timer = setTimeout(checkRecsScroll, 150);
      window.addEventListener('resize', checkRecsScroll);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', checkRecsScroll);
      };
    }
  }, [loadingRecs, recommendations, recsExpanded, checkRecsScroll]);

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

  // Scroll horizontal para proyectos destacados
  const featuredScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollFeaturedLeft, setCanScrollFeaturedLeft] = useState(false);
  const [canScrollFeaturedRight, setCanScrollFeaturedRight] = useState(false);

  const checkFeaturedScroll = useCallback(() => {
    const el = featuredScrollRef.current;
    if (!el) return;
    setCanScrollFeaturedLeft(el.scrollLeft > 6);
    setCanScrollFeaturedRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
  }, []);

  const scrollFeatured = (direction: 'left' | 'right') => {
    const el = featuredScrollRef.current;
    if (!el) return;
    const scrollAmount = Math.max(260, Math.floor(el.clientWidth * 0.75));
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    setTimeout(checkFeaturedScroll, 350);
  };

  useEffect(() => {
    if (!loading && allProjects.length > 0 && !showAllFeatured && !hasActiveFilters) {
      const timer = setTimeout(checkFeaturedScroll, 150);
      window.addEventListener('resize', checkFeaturedScroll);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', checkFeaturedScroll);
      };
    }
  }, [loading, allProjects, showAllFeatured, hasActiveFilters, checkFeaturedScroll]);

  // Cargar proyectos al montar
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await api.projects.list({ sort: 'featured' });
        setAllProjects(res.projects || []);
      } catch (err) {
        console.error('Error loading projects in ExploreScreen:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Cargar recomendaciones si el usuario es voluntario
  useEffect(() => {
    if (!isVolunteer) return;
    const loadRecs = async () => {
      setLoadingRecs(true);
      try {
        const res = await api.projects.recommended(8);
        setRecommendations(res.recommendations || []);
      } catch (err) {
        console.error('Error loading recommendations:', err);
      } finally {
        setLoadingRecs(false);
      }
    };
    loadRecs();
  }, [isVolunteer]);

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

  // IDs de recomendaciones para evitar duplicados en listado genérico
  const recIds = useMemo(() => new Set(recommendations.map(r => r.id)), [recommendations]);
  const genericProjects = useMemo(() => {
    if (!isVolunteer || recommendations.length === 0) return filteredProjects;
    return filteredProjects.filter(p => !recIds.has(p.id));
  }, [filteredProjects, recIds, isVolunteer, recommendations]);

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

        {/* ── 3b. Sección "Para vos" — Recomendaciones personalizadas ─── */}
        {isVolunteer && !hasActiveFilters && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="text-base font-black text-gray-900 tracking-tight">
                  Para vos
                </h2>
              </div>
              {recommendations.length > 4 && (
                <button
                  onClick={() => setRecsExpanded(!recsExpanded)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer flex items-center gap-0.5"
                >
                  {recsExpanded ? 'Ver menos' : 'Ver todos'}
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${recsExpanded ? 'rotate-90' : ''}`} />
                </button>
              )}
            </div>

            {loadingRecs ? (
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                {[1, 2, 3].map(i => (
                  <div key={i} className="min-w-[260px] max-w-[280px] bg-white rounded-2xl border border-gray-100 p-3 animate-pulse flex-shrink-0">
                    <div className="w-full h-28 bg-gray-200 rounded-xl mb-2.5" />
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-1.5" />
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                    <div className="flex gap-1.5">
                      <div className="h-5 bg-gray-100 rounded-full w-16" />
                      <div className="h-5 bg-gray-100 rounded-full w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recommendations.length > 0 ? (
              recsExpanded ? (
                /* Vista expandida: grid vertical */
                <div className="space-y-3">
                  {recommendations.map(p => (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/project/${p.id}`)}
                      className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm hover:shadow-md hover:border-emerald-200/80 transition-all cursor-pointer flex items-center gap-3.5 group"
                    >
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
                      <div className="min-w-0 flex-1">
                        <h3 className="font-black text-sm text-gray-900 group-hover:text-emerald-700 transition-colors truncate">
                          {p.title}
                        </h3>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {p.ngo_name || 'Organización comunitaria'}
                        </p>
                        {/* Tags */}
                        {p.recommendation_tags && p.recommendation_tags.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5 overflow-x-auto scrollbar-hide">
                            {p.recommendation_tags.slice(0, 3).map((tag, i) => (
                              <span
                                key={i}
                                className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 whitespace-nowrap flex-shrink-0"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* First reason */}
                        {p.recommendation_reasons && p.recommendation_reasons[0] && (
                          <p className="text-[11px] text-emerald-600/80 mt-1 truncate italic">
                            {p.recommendation_reasons[0]}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Vista compacta: scroll horizontal */
                <div className="relative group/recs -mx-4 px-4 sm:-mx-6 sm:px-6">
                  {/* Flecha flotante izquierda */}
                  {canScrollRecsLeft && (
                    <button
                      type="button"
                      onClick={() => scrollRecs('left')}
                      aria-label="Anterior"
                      title="Anterior"
                      className="hidden sm:flex absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 backdrop-blur-xs shadow-md border border-gray-200/90 items-center justify-center text-gray-700 hover:text-emerald-700 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}

                  <div
                    ref={recsScrollRef}
                    onScroll={checkRecsScroll}
                    className="flex gap-3 overflow-x-auto scroll-smooth scrollbar-hide pb-2 pt-0.5"
                  >
                    {recommendations.map(p => (
                      <div
                        key={p.id}
                        onClick={() => navigate(`/project/${p.id}`)}
                        className="min-w-[240px] max-w-[260px] bg-white rounded-2xl border border-gray-100 p-2.5 shadow-sm hover:shadow-md hover:border-emerald-200/80 transition-all cursor-pointer flex-shrink-0 group select-none"
                      >
                        {/* Imagen */}
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.title}
                            className="w-full h-28 rounded-xl object-cover mb-2 group-hover:scale-[1.02] transition-transform"
                          />
                        ) : (
                          <div className="w-full h-28 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-bold mb-2">
                            🌿
                          </div>
                        )}

                        {/* Info */}
                        <h3 className="font-extrabold text-[13px] text-gray-900 group-hover:text-emerald-700 transition-colors line-clamp-1 leading-tight">
                          {p.title}
                        </h3>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {p.ngo_name}
                        </p>

                        {/* Tags */}
                        {p.recommendation_tags && p.recommendation_tags.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5 overflow-hidden">
                            {p.recommendation_tags.slice(0, 2).map((tag, i) => (
                              <span
                                key={i}
                                className="inline-flex px-1.5 py-[1px] rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 whitespace-nowrap"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* First reason */}
                        {p.recommendation_reasons && p.recommendation_reasons[0] && (
                          <p className="text-[10px] text-emerald-600/70 mt-1 line-clamp-1 italic">
                            {p.recommendation_reasons[0]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Flecha flotante derecha */}
                  {canScrollRecsRight && (
                    <button
                      type="button"
                      onClick={() => scrollRecs('right')}
                      aria-label="Siguiente"
                      title="Siguiente"
                      className="hidden sm:flex absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 backdrop-blur-xs shadow-md border border-gray-200/90 items-center justify-center text-gray-700 hover:text-emerald-700 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            ) : null}
          </div>
        )}

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
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 cursor-pointer flex items-center gap-1"
              >
                {showAllFeatured ? 'Ver carrusel' : 'Ver todos'}
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showAllFeatured ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
              {[1, 2, 3].map(i => (
                <div key={i} className="min-w-[260px] max-w-[280px] bg-white rounded-2xl border border-gray-100 p-3 animate-pulse flex-shrink-0">
                  <div className="w-full h-32 bg-gray-200 rounded-xl mb-2.5" />
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-1.5" />
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="flex gap-1.5">
                    <div className="h-5 bg-gray-100 rounded-full w-16" />
                    <div className="h-5 bg-gray-100 rounded-full w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : (hasActiveFilters ? filteredProjects : genericProjects).length === 0 ? (
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
          ) : !hasActiveFilters && !showAllFeatured ? (
            /* Scroll horizontal para Proyectos Destacados */
            <div className="relative group/featured -mx-4 px-4 sm:-mx-6 sm:px-6">
              {/* Flecha flotante izquierda */}
              {canScrollFeaturedLeft && (
                <button
                  type="button"
                  onClick={() => scrollFeatured('left')}
                  aria-label="Anterior"
                  title="Anterior"
                  className="hidden sm:flex absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 backdrop-blur-xs shadow-md border border-gray-200/90 items-center justify-center text-gray-700 hover:text-emerald-700 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              <div
                ref={featuredScrollRef}
                onScroll={checkFeaturedScroll}
                className="flex gap-3.5 overflow-x-auto scroll-smooth scrollbar-hide pb-2 pt-0.5"
              >
                {genericProjects.map(p => (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/project/${p.id}`)}
                    className="min-w-[250px] max-w-[270px] bg-white rounded-2xl border border-gray-100 p-2.5 shadow-sm hover:shadow-md hover:border-emerald-200/80 transition-all cursor-pointer flex-shrink-0 group select-none flex flex-col justify-between"
                  >
                    <div>
                      {/* Imagen con badge de categoría */}
                      <div className="relative w-full h-32 rounded-xl overflow-hidden mb-2">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.title}
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-bold">
                            🌿
                          </div>
                        )}
                        {p.category && (
                          <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                            {p.category}
                          </span>
                        )}
                      </div>

                      {/* Título & ONG */}
                      <h3 className="font-extrabold text-[13px] text-gray-900 group-hover:text-emerald-700 transition-colors line-clamp-1 leading-tight">
                        {p.title}
                      </h3>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {p.ngo_name || 'Organización comunitaria'}
                      </p>
                    </div>

                    {/* Métricas y Prueba Social (Rating, Participantes, Seguidores) */}
                    <div className="mt-2.5 pt-2 border-t border-gray-50 flex items-center gap-1.5 flex-wrap">
                      {p.avg_rating ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-full">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                          <span>{p.avg_rating}</span>
                        </span>
                      ) : null}

                      {p.current_volunteers > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.5 rounded-full">
                          <Users className="w-3 h-3 text-emerald-600" />
                          <span>{p.current_volunteers} part.</span>
                        </span>
                      ) : null}

                      {p.followers > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200/70 px-1.5 py-0.5 rounded-full">
                          <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                          <span>{p.followers} seg.</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {/* Flecha flotante derecha */}
              {canScrollFeaturedRight && (
                <button
                  type="button"
                  onClick={() => scrollFeatured('right')}
                  aria-label="Siguiente"
                  title="Siguiente"
                  className="hidden sm:flex absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 backdrop-blur-xs shadow-md border border-gray-200/90 items-center justify-center text-gray-700 hover:text-emerald-700 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            /* Vista lista vertical: cuando está expandido o con filtros activos */
            <div className="space-y-3">
              {(hasActiveFilters ? filteredProjects : genericProjects).map(p => (
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

                    {/* Prueba social: Calificación, Participantes y Seguidores */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {p.avg_rating ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                          <span>{p.avg_rating}</span>
                          {p.ratings_count ? (
                            <span className="text-amber-600/70 font-normal text-[10px]">
                              ({p.ratings_count})
                            </span>
                          ) : null}
                        </span>
                      ) : null}

                      {p.current_volunteers > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full">
                          <Users className="w-3 h-3 text-emerald-600" />
                          <span>{p.current_volunteers} participantes</span>
                        </span>
                      ) : null}

                      {p.followers > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200/70 px-2 py-0.5 rounded-full">
                          <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                          <span>{p.followers} seguidores</span>
                        </span>
                      ) : null}

                      <div className="flex items-center gap-1 text-[11px] text-gray-400">
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

