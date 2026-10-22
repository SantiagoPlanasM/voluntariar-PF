import { useState, useEffect, useMemo, useId } from 'react';
import { Map as MapIcon, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { api, Project } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { userMessage } from '../../lib/format';
import { InlineError } from './LoadError';
import { ProjectMap } from './ProjectMap';
import { FilterModal, FilterState, DEFAULT_FILTERS, filterProjects } from './FilterModal';
import { VolunteeringTile } from '../volunteering/VolunteeringTile';
import { Button } from '../ui/Button';

/** Cuántos proyectos pide Explorar: el tope de `GET /api/projects` (500, PROJECT_ANALYSIS §96). La búsqueda,
 *  los filtros y el mapa trabajan en el cliente sobre esa lista, y el backend no devuelve el total: si la
 *  respuesta viene llena se muestra un aviso, porque puede haber más que no aparecen (REVISION S5; antes
 *  pedía 200 y los demás desaparecían sin aviso). */
const EXPLORE_LIMIT = 500;

const TYPE_LABEL = { fugaz: 'Fugaz', sostenido: 'Sostenido' } as const;
const MODALITY_LABEL = { presencial: 'Presencial', remoto: 'Remoto', hibrido: 'Híbrido' } as const;
const COST_LABEL = { gratis: 'Gratis', pago: 'Con costo' } as const;

interface RecommendedProject extends Project {
  recommendation_score?: number;
  recommendation_reasons?: string[];
  recommendation_tags?: string[];
}

export function ExploreScreen() {
  const { user } = useAuth();
  const isVolunteer = user?.role === 'volunteer';

  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Recomendaciones
  const [recommendations, setRecommendations] = useState<RecommendedProject[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [recsError, setRecsError] = useState('');
  const recsTitleId = useId();

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [mapView, setMapView] = useState(false);

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

  // Cargar proyectos al montar (y con "Reintentar"). Si falla se muestra el error, nunca el catálogo vacío:
  // antes el error se tragaba y se veía "No encontramos voluntariados" (REVISION S1).
  const loadProjects = async () => {
    setLoading(true);
    setLoadError('');
    try {
      // limit explícito: sin esto, el backend usa su default (20) y el
      // buscador/mapa de Explorar queda mudo apenas la plataforma supera
      // los 20 proyectos activos (bug confirmado con 27 proyectos de prueba).
      // Se pide el tope del backend; si la respuesta viene llena se avisa (ver EXPLORE_LIMIT).
      const res = await api.projects.list({ sort: 'featured', limit: String(EXPLORE_LIMIT) });
      setAllProjects(res.projects || []);
    } catch (err) {
      setLoadError(userMessage(err, 'No pudimos cargar los voluntariados. Revisá tu conexión.'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void loadProjects(); }, []);

  // Cargar recomendaciones si el usuario es voluntario. Son secundarias: si fallan, la sección "Para vos"
  // avisa con su propio "Reintentar" y el catálogo se muestra igual (REVISION S1).
  const loadRecs = async () => {
    setLoadingRecs(true);
    setRecsError('');
    try {
      const res = await api.projects.recommended(8);
      setRecommendations(res.recommendations || []);
    } catch (err) {
      setRecsError(userMessage(err, 'No pudimos cargar tus recomendaciones. Revisá tu conexión.'));
    } finally {
      setLoadingRecs(false);
    }
  };
  useEffect(() => {
    if (!isVolunteer) return;
    void loadRecs();
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

  // Una pastilla por cada filtro del modal que no está en "todos" (las categorías van aparte, una por una).
  const otherPills: { key: 'type' | 'modality' | 'cost'; label: string; aria: string }[] = [];
  if (filters.type !== 'all') otherPills.push({ key: 'type', label: TYPE_LABEL[filters.type], aria: 'Quitar filtro de tipo' });
  if (filters.modality !== 'all') otherPills.push({ key: 'modality', label: MODALITY_LABEL[filters.modality], aria: 'Quitar filtro de modalidad' });
  if (filters.cost !== 'all') otherPills.push({ key: 'cost', label: COST_LABEL[filters.cost], aria: 'Quitar filtro de costo' });
  const removeFilter = (key: 'type' | 'modality' | 'cost') => setFilters(prev => ({ ...prev, [key]: 'all' }));

  // "Para vos" muestra hasta 6. La lista general saca solo las que se ven: si sacaba todas las que manda la API
  // (hasta 8), las que no entraban no aparecían en ningún lado (D22, §246).
  const shownRecs = useMemo(() => recommendations.slice(0, 6), [recommendations]);
  const recIds = useMemo(() => new Set(shownRecs.map(r => r.id)), [shownRecs]);
  const genericProjects = useMemo(() => {
    if (!isVolunteer || recommendations.length === 0) return filteredProjects;
    return filteredProjects.filter(p => !recIds.has(p.id));
  }, [filteredProjects, recIds, isVolunteer, recommendations]);

  // Categorías para los chips: las que existen en el catálogo, de más a menos voluntariados.
  const categories = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of allProjects) if (p.category) count.set(p.category, (count.get(p.category) || 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [allProjects]);
  const toggleCategory = (c: string) =>
    setFilters(prev => ({ ...prev, categories: prev.categories.includes(c) ? prev.categories.filter(x => x !== c) : [...prev.categories, c] }));

  const shown = isVolunteer && recommendations.length > 0 && !hasActiveFilters ? genericProjects : filteredProjects;

  return (
    <div className="min-h-screen bg-canvas md:bg-canvas-soft pb-24">
      <div className="max-w-[760px] mx-auto px-3 md:px-6 pt-4 md:pt-8 flex flex-col gap-4">
        <h1 className="text-[22px] font-bold tracking-[-0.3px] px-1">Explorar</h1>

        {/* Búsqueda grande + filtros */}
        <div className="flex gap-2">
          <label className="flex-1 min-w-0 h-12 px-4 rounded-full bg-surface-soft flex items-center gap-2.5 text-ink-muted focus-within:bg-surface focus-within:ring-[1.5px] focus-within:ring-ink">
            <Search size={20} strokeWidth={1.75} aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar voluntariados"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscá causas, ONGs o lugares"
              className="flex-1 min-w-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} aria-label="Limpiar búsqueda"
                className="-mr-2 w-9 h-9 rounded-full flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-pressed">
                <X size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            aria-label={activeFiltersCount > 0 ? `Filtros, ${activeFiltersCount} activos` : 'Filtros'}
            className="relative w-12 h-12 rounded-full bg-surface-soft hover:bg-surface-pressed flex items-center justify-center flex-shrink-0 transition-colors active:scale-95"
          >
            <SlidersHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />
            {activeFiltersCount > 0 && (
              <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-ink text-on-ink text-xs font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Categorías */}
        {categories.length > 0 && (
          <div className="-mx-3 md:mx-0 px-3 md:px-0 flex gap-2 overflow-x-auto scrollbar-hide" role="group" aria-label="Categorías">
            <button type="button" onClick={() => setFilters(prev => ({ ...prev, categories: [] }))} aria-pressed={filters.categories.length === 0}
              className={`h-8 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${filters.categories.length === 0 ? 'bg-ink text-on-ink' : 'bg-surface-soft hover:bg-surface-pressed'}`}>
              Todos
            </button>
            {categories.map(c => {
              const on = filters.categories.includes(c);
              return (
                <button key={c} type="button" onClick={() => toggleCategory(c)} aria-pressed={on}
                  className={`h-8 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${on ? 'bg-ink text-on-ink' : 'bg-surface-soft hover:bg-surface-pressed'}`}>
                  {c}
                </button>
              );
            })}
          </div>
        )}

        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap px-1">
            {filters.categories.map(cat => (
              <button key={cat} type="button" onClick={() => removeCategory(cat)} aria-label={`Quitar filtro ${cat}`}
                className="h-8 pl-3 pr-2 rounded-full bg-surface-soft text-xs font-semibold inline-flex items-center gap-1">
                {cat}<X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            ))}
            {otherPills.map(p => (
              <button key={p.key} type="button" onClick={() => removeFilter(p.key)} aria-label={p.aria}
                className="h-8 pl-3 pr-2 rounded-full bg-surface-soft text-xs font-semibold inline-flex items-center gap-1">
                {p.label}<X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            ))}
            <button type="button" onClick={handleResetFilters} className="h-8 text-[13px] font-semibold px-1">Limpiar filtros</button>
          </div>
        )}

        {/* Respuesta llena: puede haber más proyectos que los que se buscan y se ven (REVISION S5). */}
        {allProjects.length >= EXPLORE_LIMIT && (
          <p role="status" className="text-[13px] text-ink-muted px-1">
            Se muestran los primeros {EXPLORE_LIMIT} voluntariados: la búsqueda, los filtros y el mapa solo incluyen esos.
          </p>
        )}

        {loadError ? (
          <InlineError message={loadError} onRetry={loadProjects} />
        ) : mapView ? (
          // Con error de carga no se dibuja: un mapa sin pines también diría "no hay nada" (REVISION S1).
          <ProjectMap projects={filteredProjects} className="!h-[68vh] !rounded-2xl" />
        ) : loading ? (
          <div role="status" aria-label="Cargando voluntariados" className="grid grid-cols-2 gap-x-2 gap-y-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="flex flex-col gap-2"><div className="aspect-[4/5] rounded-xl skeleton" /><div className="h-4 w-3/4 rounded skeleton" /></div>
            ))}
          </div>
        ) : (
          <>
            {/* "Para vos": las recomendaciones, con la razón de cada una */}
            {isVolunteer && !hasActiveFilters && (loadingRecs || recsError || recommendations.length > 0) && (
              <section aria-labelledby={recsTitleId} className="flex flex-col gap-3">
                <h2 id={recsTitleId} className="text-lg font-bold tracking-[-0.2px] px-1">Para vos</h2>
                {recsError ? (
                  <InlineError message={recsError} onRetry={loadRecs} />
                ) : loadingRecs ? (
                  <div role="status" aria-label="Cargando recomendaciones" className="grid grid-cols-2 gap-x-2 gap-y-5">
                    {[1, 2].map(i => <div key={i} aria-hidden="true" className="aspect-[4/5] rounded-xl skeleton" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-5">
                    {shownRecs.map(p => (
                      <VolunteeringTile key={p.id} project={p} note={p.recommendation_reasons?.[0]} />
                    ))}
                  </div>
                )}
              </section>
            )}

            <section aria-labelledby="todos" className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between px-1">
                <h2 id="todos" className="text-lg font-bold tracking-[-0.2px]">{hasActiveFilters ? 'Resultados' : 'Todos los voluntariados'}</h2>
                <span className="text-[13px] text-ink-muted">{shown.length}</span>
              </div>
              {shown.length === 0 ? (
                <div className="py-14 text-center flex flex-col items-center gap-1">
                  <p className="text-[15px] font-semibold">
                    {allProjects.length === 0 ? 'Todavía no hay voluntariados publicados' : 'No encontramos voluntariados con esos filtros'}
                  </p>
                  {hasActiveFilters && <Button variant="text" onClick={handleResetFilters}>Limpiar filtros</Button>}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-5">
                  {shown.map(p => <VolunteeringTile key={p.id} project={p} />)}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Botón flotante: pasa de la grilla al mapa y vuelve */}
      {!loadError && !loading && (
        <button
          type="button"
          onClick={() => setMapView(v => !v)}
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] md:bottom-8 z-20 h-11 px-5 rounded-full bg-ink text-on-ink text-[15px] font-bold inline-flex items-center gap-2 shadow-[var(--elev-popover)] active:scale-95 transition-transform"
        >
          {mapView ? <><List size={18} strokeWidth={1.75} aria-hidden="true" />Lista</> : <><MapIcon size={18} strokeWidth={1.75} aria-hidden="true" />Mapa</>}
        </button>
      )}

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
