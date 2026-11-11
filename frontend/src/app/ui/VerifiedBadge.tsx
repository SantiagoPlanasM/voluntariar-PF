// La insignia azul de ONG validada (§317; DESIGN.md → Validación de ONGs): va junto al nombre de la ONG cuando la API
// dice que está validada (`verified` / `ngo_verified`). Azul de texto (`text-brand-text`), que pasa el contraste en
// claro y en oscuro (paletteContrast.test.ts).
import { BadgeCheck } from 'lucide-react';

export function VerifiedBadge({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <span role="img" aria-label="ONG validada" title="ONG validada"
      className={`inline-flex flex-shrink-0 text-brand-text ${className}`}>
      <BadgeCheck size={size} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}
