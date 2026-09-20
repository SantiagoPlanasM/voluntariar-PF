import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Zap, Calendar, Laptop, MapPin, DollarSign, Check } from 'lucide-react';
import { Project } from '../../lib/api';
import { CATEGORY_COLORS } from './ProjectMap';

export interface FilterState {
  categories: string[];
  type: 'all' | 'fugaz' | 'sostenido';
  modality: 'all' | 'presencial' | 'remoto';
  cost: 'all' | 'gratis' | 'pago';
}

export const DEFAULT_FILTERS: FilterState = {
  categories: [],
  type: 'all',
  modality: 'all',
  cost: 'all',
};

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
    // 1. Búsqueda de texto
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matches =
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q) ||
        p.ngo_name?.toLowerCase().includes(q);
      if (!matches) return false;
    }

    // 2. Categorías (multiselección)
    if (filters.categories.length > 0) {
      if (!p.category || !filters.categories.some(c => c.toLowerCase() === p.category?.toLowerCase())) {
        return false;
      }
    }

    // 3. Tipo
    if (filters.type === 'fugaz' && p.type !== 'fugaz') return false;
    if (filters.type === 'sostenido' && p.type !== 'sostenido') return false;

    // 4. Modalidad
    if (filters.modality === 'remoto') {
      const loc = (p.location || '').toLowerCase();
      const isRemoto = loc.includes('remoto') || loc.includes('virtual') || loc.includes('online');
      if (!isRemoto) return false;
    } else if (filters.modality === 'presencial') {
      const loc = (p.location || '').toLowerCase();
      const isStrictRemoto = loc.includes('remoto') && !loc.includes('córdoba') && !loc.includes('cordoba');
      if (isStrictRemoto) return false;
    }

    // 5. Costo
    if (filters.cost === 'gratis') {
      if (p.cost_per_person && p.cost_per_person > 0) return false;
    } else if (filters.cost === 'pago') {
      if (!p.cost_per_person || p.cost_per_person === 0) return false;
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

  // Sincronizar con currentFilters al abrir
  useEffect(() => {
    if (isOpen) {
      setDraft(currentFilters);
    }
  }, [isOpen, currentFilters]);

  // Manejar Escape y bloquear scroll del fondo
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

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

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Cabecera ────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-gray-900 leading-tight">
              Filtros
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Personaliza tu búsqueda de voluntariados
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Cuerpo con Scroll ───────────────────────────────── */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-sm">
          {/* 1. Categorías de Impacto */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="font-bold text-gray-900 text-sm">
                Categorías de Impacto
              </label>
              {draft.categories.length > 0 && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {draft.categories.length} seleccionadas
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CATEGORY_COLORS).map(([name, col]) => {
                const isSelected = draft.categories.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleCategory(name)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer select-none active:scale-95 ${
                      isSelected
                        ? 'shadow-sm text-white'
                        : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                    style={
                      isSelected
                        ? { backgroundColor: col.bg, borderColor: col.border }
                        : undefined
                    }
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 transition-transform ${
                        isSelected ? 'bg-white scale-125' : ''
                      }`}
                      style={!isSelected ? { backgroundColor: col.bg } : undefined}
                    />
                    <span>{name}</span>
                    {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* 2. Tipo de Voluntariado */}
          <div>
            <label className="font-bold text-gray-900 text-sm block mb-1">
              Tipo de Compromiso
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Elige según el tiempo y dedicación que desees aportar
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'all', label: 'Todos', desc: 'Cualquier tipo', icon: Sparkles },
                { id: 'fugaz', label: 'Fugaz', desc: '1 a 2 días', icon: Zap },
                { id: 'sostenido', label: 'Sostenido', desc: 'Continuo semanal', icon: Calendar },
              ].map(opt => {
                const isSelected = draft.type === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDraft(prev => ({ ...prev, type: opt.id as any }))}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#1E3A2F] bg-emerald-50/40 ring-1 ring-[#1E3A2F]'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-[#1E3A2F]' : 'text-gray-500'}`} />
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#1E3A2F]" />}
                    </div>
                    <div>
                      <div className={`font-bold text-xs ${isSelected ? 'text-[#1E3A2F]' : 'text-gray-900'}`}>
                        {opt.label}
                      </div>
                      <div className="text-[11px] text-gray-400 leading-tight mt-0.5">
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* 3. Modalidad */}
          <div>
            <label className="font-bold text-gray-900 text-sm block mb-1">
              Modalidad de Participación
            </label>
            <div className="grid grid-cols-3 gap-2.5 mt-2">
              {[
                { id: 'all', label: 'Cualquiera', icon: Sparkles },
                { id: 'presencial', label: 'Presencial', icon: MapPin },
                { id: 'remoto', label: 'Remoto', icon: Laptop },
              ].map(opt => {
                const isSelected = draft.modality === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDraft(prev => ({ ...prev, modality: opt.id as any }))}
                    className={`p-2.5 rounded-xl border text-center flex items-center justify-center gap-1.5 transition-all cursor-pointer font-semibold text-xs ${
                      isSelected
                        ? 'border-[#1E3A2F] bg-emerald-50/40 text-[#1E3A2F] ring-1 ring-[#1E3A2F]'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* 4. Costo */}
          <div>
            <label className="font-bold text-gray-900 text-sm block mb-1">
              Costo para el Voluntario
            </label>
            <div className="grid grid-cols-2 gap-2.5 mt-2">
              {[
                { id: 'all', label: 'Cualquiera', desc: 'Con o sin aporte' },
                { id: 'gratis', label: '100% Gratis', desc: 'Sin arancel ni costo' },
              ].map(opt => {
                const isSelected = draft.cost === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDraft(prev => ({ ...prev, cost: opt.id as any }))}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#1E3A2F] bg-emerald-50/40 text-[#1E3A2F] ring-1 ring-[#1E3A2F]'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                    }`}
                  >
                    <div className="font-bold text-xs">{opt.label}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Pie de Acción Fijo ──────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/80 shrink-0 gap-3">
          <button
            type="button"
            onClick={handleResetDraft}
            className="text-xs font-bold text-gray-600 hover:text-gray-900 underline cursor-pointer px-2 py-1"
          >
            Limpiar filtros
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="bg-[#1E3A2F] hover:bg-[#152921] text-white font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <span>Mostrar {previewCount} voluntariados</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
