// Hoja inferior en el celular y diálogo centrado de 480 px en escritorio: un solo componente con dos
// presentaciones (DESIGN.md → Hojas, diálogos y avisos). Se apoya en `Modal` (foco atrapado, Escape, scroll).
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Modal } from '../components/Modal';

interface SheetProps {
  title: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  /** Zona fija abajo (el botón principal). */
  footer?: ReactNode;
  /** false: el clic en el fondo no cierra (un clic de más perdería lo cargado). */
  closeOnOverlay?: boolean;
  /** La X queda deshabilitada (por ejemplo, mientras se publica). */
  closeDisabled?: boolean;
}

export function Sheet({ title, titleId, onClose, children, footer, closeOnOverlay = true, closeDisabled = false }: SheetProps) {
  return (
    <Modal
      labelledBy={titleId}
      onClose={onClose}
      closeOnOverlay={closeOnOverlay}
      overlayClassName="fixed inset-0 z-50 bg-[var(--scrim)] flex items-end md:items-center justify-center md:p-4 animate-fadeIn"
      className="bg-surface text-ink w-full md:max-w-[480px] max-h-[88dvh] md:max-h-[90dvh] flex flex-col rounded-t-[24px] md:rounded-2xl shadow-[var(--elev-sheet)] md:shadow-[var(--elev-popover)] animate-sheetUp md:animate-riseIn"
    >
      <div className="md:hidden h-5 flex items-center justify-center flex-shrink-0" aria-hidden="true">
        <span className="w-9 h-1 rounded-full bg-hairline" />
      </div>
      <div className="flex items-center justify-between gap-2 pl-4 pr-1 md:pt-3 flex-shrink-0">
        <h2 id={titleId} className="text-lg font-bold tracking-[-0.2px] truncate">{title}</h2>
        <button type="button" onClick={onClose} disabled={closeDisabled} aria-label="Cerrar" className="w-11 h-11 inline-flex items-center justify-center rounded-full hover:bg-surface-soft disabled:opacity-40">
          <X size={22} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4">{children}</div>
      {footer && <div className="px-4 pt-3 pb-4 border-t border-hairline flex-shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>{footer}</div>}
    </Modal>
  );
}
