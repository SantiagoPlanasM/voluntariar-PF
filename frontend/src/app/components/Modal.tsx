// src/app/components/Modal.tsx
//
// Modal común (REVISION F12). Antes cada modal era un <div> con overlay: sin role="dialog", sin Escape
// (o con su propio listener) y con el foco detrás del fondo, así que con teclado o lector de pantalla se
// seguía navegando la página de atrás. Este componente hace, para cualquier modal:
//   - role="dialog" + aria-modal y nombre accesible (`label` o `labelledBy`, uno de los dos);
//   - Escape cierra (escucha en document: anda aunque el foco no esté adentro);
//   - al abrir, el foco entra (a `initialFocusRef` o al panel); al cerrar, vuelve a donde estaba;
//   - Tab y Shift+Tab quedan atrapados adentro;
//   - clic en el fondo cierra (salvo `closeOnOverlay={false}`) y el scroll de la página queda bloqueado.
// Con varios abiertos (uno encima de otro), Escape y Tab los maneja solo el de arriba.
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  /** Nombre del diálogo si no hay un título visible; si lo hay, mejor `labelledBy` con su id. */
  label?: string;
  labelledBy?: string;
  /** Elemento que recibe el foco al abrir (p. ej. el primer campo). Si no, el panel. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnOverlay?: boolean;
  /** Clases del fondo (posición, color, z-index) y del panel; cada modal conserva su estilo. */
  overlayClassName?: string;
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Pila de modales abiertos: solo el último (el de arriba) reacciona al teclado.
const stack: object[] = [];

export function Modal({
  onClose, children, label, labelledBy, initialFocusRef, closeOnOverlay = true,
  overlayClassName = 'fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4',
  className = 'bg-white rounded-3xl shadow-2xl w-full max-w-md',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const token = {};
    stack.push(token);
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (initialFocusRef?.current ?? panelRef.current)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (stack[stack.length - 1] !== token) return;
      const panel = panelRef.current;
      if (!panel) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) { e.preventDefault(); panel.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && (active === first || active === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      stack.splice(stack.indexOf(token), 1);
      document.body.style.overflow = prevOverflow;
      if (previous && document.contains(previous)) previous.focus();
    };
    // Solo al montar/desmontar: re-enfocar en cada render le sacaría el foco a lo que se está escribiendo.
  }, []);

  return (
    <div
      data-testid="modal-overlay"
      className={overlayClassName}
      onClick={(e) => { if (closeOnOverlay && e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`${className} focus:outline-none`}
      >
        {children}
      </div>
    </div>
  );
}
