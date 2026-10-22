// Tipo de voluntariado con color (decisión del usuario, 2026-10-21): azul = Fugaz, verde = Sostenido.
// Usa los mismos tokens `brand` y `people` del resto del sistema, así que cambian solos en el modo oscuro.
// Variantes: `photo` (fondo sólido, sobre una foto), `soft` (fondo suave) y `text` (solo el texto de color).
import { CalendarDays, Zap } from 'lucide-react';

export type ProjectType = 'fugaz' | 'sostenido';

export const TYPE_STYLE: Record<ProjectType, { label: string; solid: string; soft: string; text: string; icon: typeof Zap }> = {
  fugaz:     { label: 'Fugaz',     solid: 'bg-brand text-white',  soft: 'bg-brand-soft text-brand-text',   text: 'text-brand-text',  icon: Zap },
  sostenido: { label: 'Sostenido', solid: 'bg-people text-white', soft: 'bg-people-soft text-people-text', text: 'text-people-text', icon: CalendarDays },
};

interface Props {
  type: string;
  variant?: 'photo' | 'soft' | 'text';
  className?: string;
}

export function TypeBadge({ type, variant = 'soft', className = '' }: Props) {
  const s = TYPE_STYLE[type === 'fugaz' ? 'fugaz' : 'sostenido'];
  const Icon = s.icon;
  if (variant === 'text') {
    return <span className={`inline-flex items-center gap-1 font-semibold ${s.text} ${className}`}><Icon size={14} strokeWidth={1.75} aria-hidden="true" />{s.label}</span>;
  }
  return (
    <span className={`h-7 px-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 flex-shrink-0 ${variant === 'photo' ? s.solid : s.soft} ${className}`}>
      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />{s.label}
    </span>
  );
}
