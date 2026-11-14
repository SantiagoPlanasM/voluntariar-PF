import { useEffect, useId, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Zap, Calendar, Laptop, MapPin, Check, Globe } from 'lucide-react';
import { Project } from '../../lib/api';
import { normalizeText } from '../../lib/format';
import { CATEGORY_COLORS } from './ProjectMap';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';

export interface FilterState {
  categories: string[];
  type: 'all' | 'fugaz' | 'sostenido';
  modality: 'all' | 'presencial' | 'remoto' | 'hibrido';
  cost: 'all' | 'gratis' | 'pago';
  /** §283: carga horaria por semana (solo los sostenidos tienen; los fugaces siempre pasan). */
  hours: 'all' | 'hasta2' | 'hasta5';
}

export const DEFAULT_FILTERS: FilterState = {
  categories: [],
  type: 'all',
  modality: 'all',
  cost: 'all',
  hours: 'all',
};

const MAX_HOURS = { hasta2: 2, hasta5: 5 } as const;

const TYPE_OPTIONS: { id: FilterState['type']; label: string; desc: string; icon: typeof Zap }[] = [
  { id: 'all', label: 'Todos', desc: 'Cualquier tipo', icon: Sparkles },
  { id: 'fugaz', label: 'Fugaz', desc: '1 a 2 días', icon: Zap },
  { id: 'sostenido', label: 'Sostenido', desc: 'Todas las semanas', icon: Calendar },
];
const MODALITY_OPTIONS: { id: FilterState['modality']; label: string; icon: typeof Zap }[] = [
  { id: 'all', label: 'Cualquiera', icon: Sparkles },
  { id: 'presencial', label: 'Presencial', icon: MapPin },
  { id: 'remoto', label: 'Remoto', icon: Laptop },
  { id: 'hibrido', label: 'Híbrido', icon: Globe },
];
const COST_OPTIONS: { id: FilterState['cost']; label: string; desc: string }[] = [
  { id: 'all', label: 'Cualquiera', desc: 'Con o sin costo' },
  { id: 'gratis', label: 'Sin costo', desc: 'No hay que pagar nada' },
];
const HOURS_OPTIONS: { id: FilterState['hours']; label: string; desc: string }[] = [
  { id: 'all', label: 'Cualquiera', desc: 'Sin límite' },
  { id: 'hasta2', label: 'Hasta 2 h por semana', desc: 'Poco tiempo' },
  { id: 'hasta5', label: 'Hasta 5 h por semana', desc: 'Algo más' },
];

const SECTION_TITLE = 'text-[15px] font-bold';
const HINT = 'text-[13px] leading-snug text-ink-muted';
const OPTION = 'p-3 rounded-xl border-[1.5px] text-left transition-colors';
const OPTION_CHOSEN = 'border-ink bg-surface-soft';
const OPTION_IDLE = 'border-hairline bg-surface hover:border-border-strong';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  allProjects: Project[];
  searchQuery: string;
  currentFilters: FilterState;
  onApply: (filters: FilterState) => void;
  onReset: () => void;
}

export function filterProjects(projects: Project[], searchQuery: string, filters: FilterState): Project[] {
  return projects.filter(p => {
    // 1. Búsqueda de texto, sin distinguir mayúsculas ni acentos: "cordoba" encuentra "Córdoba" (REVISION S8)
    if (searchQuery.trim()) {
      const q = normalizeText(searchQuery.trim());
      const has = (field: string | null | undefined) => !!field && normalizeText(field).includes(q);
      const matches =
        has(p.title) ||
        has(p.description) ||
        has(p.category) ||
        has(p.location) ||
        has(p.ngo_name);
      if (!matches) return false;
    }

    // 2. Categorías (multiselección), con el mismo criterio: "Educacion" coincide con "Educación"
    if (filters.categories.length > 0) {
      const cat = normalizeText(p.category || '');
      if (!cat || !filters.categories.some(c => normalizeText(c) === cat)) {
        return false;
      }
    }

    // 3. Tipo
    if (filters.type === 'fugaz' && p.type !== 'fugaz') return false;
    if (filters.type === 'sostenido' && p.type !== 'sostenido') return false;

    // 4. Modalidad — usa el campo real (`modality`) que ya manda el backend
    // en vez de re-adivinar por texto en la ubicación. El heurístico viejo
    // fallaba con ubicaciones remotas del tipo "Zoom"/"Google Meet" (sin la
    // palabra "remoto") y no contemplaba "híbrido" como opción de filtro.
    // El fallback por texto queda solo por si algún proyecto viejo llegara
    // sin `modality` seteado (no debería pasar, el backend siempre lo completa).
    if (filters.modality !== 'all') {
      const loc = (p.location || '').toLowerCase();
      const modality = p.modality || (loc.includes('remoto') || loc.includes('virtual') || loc.includes('online') ? 'remoto' : 'presencial');
      if (modality !== filters.modality) return false;
    }

    // 5. Costo
    if (filters.cost === 'gratis') {
      if (p.cost_per_person && p.cost_per_person > 0) return false;
    } else if (filters.cost === 'pago') {
      if (!p.cost_per_person || p.cost_per_person === 0) return false;
    }

    // 6. Carga horaria (§283): un fugaz es de una sola vez y no tiene horas semanales, así que siempre pasa; un
    // sostenido sin horas cargadas no pasa (no se puede asegurar que entre).
    if (filters.hours !== 'all' && p.type === 'sostenido') {
      const h = Number(p.hours_per_week);
      if (!(h > 0) || h > MAX_HOURS[filters.hours]) return false;
    }

    return true;
  });
}

export function FilterModal({
  isOpen,
  onClose,
  allProjects,
  searchQuery,
  currentFilters,
  onApply,
  onReset,
}: FilterModalProps) {
  // Estado borrador mientras el modal está abierto
  const [draft, setDraft] = useState<FilterState>(currentFilters);
  const titleId = useId();

  // Sincronizar con currentFilters al abrir
  useEffect(() => {
    if (isOpen) {
      setDraft(currentFilters);
    }
  }, [isOpen, currentFilters]);

  // Escape, foco y bloqueo del scroll los maneja <Modal> (antes un listener propio en window).

  // Conteo dinámico en tiempo real de los proyectos que coinciden con el borrador
  const previewCount = useMemo(() => {
    return filterProjects(allProjects, searchQuery, draft).length;
  }, [allProjects, searchQuery, draft]);

  // Toggle de categoría en el borrador
  const toggleCategory = (catName: string) => {
    setDraft(prev => {
      const exists = prev.categories.includes(catName);
      return {
        ...prev,
        categories: exists
          ? prev.categories.filter(c => c !== catName)
          : [...prev.categories, catName],
      };
    });
  };

  const handleResetDraft = () => {
    setDraft(DEFAULT_FILTERS);
    onReset();
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  if (!isOpen) return null;

  const pick = <K extends keyof FilterState>(key: K, value: FilterState[K]) => setDraft(prev => ({ ...prev, [key]: value }));

  // El portal a <body> deja la hoja por encima de todo Explorar (el mapa incluido).
  return createPortal(
    <Sheet title="Filtros" titleId={titleId} onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button variant="text" onClick={handleResetDraft}>Limpiar filtros</Button>
          <Button variant="primary" onClick={handleApply}>
            Mostrar {previewCount} {previewCount === 1 ? 'voluntariado' : 'voluntariados'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-[13px] text-ink-muted -mt-1">Personalizá tu búsqueda de voluntariados</p>

        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className={SECTION_TITLE}>Categorías</h3>
            {draft.categories.length > 0 && (
              <span className="text-[13px] font-semibold text-ink-soft">
                {draft.categories.length} {draft.categories.length === 1 ? 'elegida' : 'elegidas'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(CATEGORY_COLORS).map(name => {
              const isSelected = draft.categories.includes(name);
              return (
                <button key={name} type="button" aria-pressed={isSelected} onClick={() => toggleCategory(name)}
                  className={`h-8 px-3 rounded-full text-[13px] font-semibold transition-colors active:scale-95 ${
                    isSelected ? 'bg-ink text-on-ink' : 'bg-surface-soft text-ink hover:bg-surface-pressed'
                  }`}>
                  {name}
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <div>
            <h3 className={SECTION_TITLE}>Tipo</h3>
            <p className={HINT}>Elegí según el tiempo y la dedicación que quieras aportar</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map(opt => {
              const isSelected = draft.type === opt.id;
              const Icon = opt.icon;
              // El tipo lleva color (la única excepción a "azul = dinero, verde = personas"): Fugaz azul, Sostenido verde.
              const tone = opt.id === 'fugaz' ? 'text-brand-text' : opt.id === 'sostenido' ? 'text-people-text' : 'text-ink';
              const chosen = opt.id === 'fugaz' ? 'border-brand bg-brand-soft' : opt.id === 'sostenido' ? 'border-people bg-people-soft' : 'border-ink bg-surface-soft';
              return (
                <button key={opt.id} type="button" aria-pressed={isSelected} onClick={() => pick('type', opt.id)}
                  className={`${OPTION} flex flex-col gap-1 ${isSelected ? chosen : OPTION_IDLE}`}>
                  <span className="flex items-center justify-between w-full">
                    <Icon size={18} strokeWidth={1.75} className={isSelected || opt.id !== 'all' ? tone : 'text-ink-muted'} aria-hidden="true" />
                    {isSelected && <Check size={16} strokeWidth={2.25} className={tone} aria-hidden="true" />}
                  </span>
                  <span className={`text-[13px] font-bold ${isSelected ? tone : ''}`}>{opt.label}</span>
                  <span className={HINT}>{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <h3 className={SECTION_TITLE}>Modalidad</h3>
          <div className="grid grid-cols-2 gap-2">
            {MODALITY_OPTIONS.map(opt => {
              const isSelected = draft.modality === opt.id;
              const Icon = opt.icon;
              return (
                <button key={opt.id} type="button" aria-pressed={isSelected} onClick={() => pick('modality', opt.id)}
                  className={`${OPTION} flex items-center justify-center gap-1.5 text-[13px] font-semibold ${isSelected ? OPTION_CHOSEN : OPTION_IDLE}`}>
                  <Icon size={16} strokeWidth={1.75} aria-hidden="true" />{opt.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <h3 className={SECTION_TITLE}>Costo</h3>
          <div className="grid grid-cols-2 gap-2">
            {COST_OPTIONS.map(opt => (
              <TextOption key={opt.id} label={opt.label} desc={opt.desc} selected={draft.cost === opt.id} onClick={() => pick('cost', opt.id)} />
            ))}
          </div>
        </section>

        {/* Carga horaria (§283) */}
        <section className="flex flex-col gap-2.5">
          <div>
            <h3 className={SECTION_TITLE}>Carga horaria</h3>
            <p className={HINT}>Horas por semana de los sostenidos. Los fugaces son de una sola vez: siempre aparecen.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {HOURS_OPTIONS.map(opt => (
              <TextOption key={opt.id} label={opt.label} desc={opt.desc} selected={draft.hours === opt.id} onClick={() => pick('hours', opt.id)} />
            ))}
          </div>
        </section>
      </div>
    </Sheet>,
    document.body
  );
}

function TextOption({ label, desc, selected, onClick }: { label: string; desc: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={`${OPTION} flex flex-col gap-0.5 ${selected ? OPTION_CHOSEN : OPTION_IDLE}`}>
      <span className="text-[13px] font-bold">{label}</span>
      <span className={HINT}>{desc}</span>
    </button>
  );
}
