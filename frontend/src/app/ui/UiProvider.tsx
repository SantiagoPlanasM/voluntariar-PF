// Confirmaciones y avisos propios (DESIGN.md → Hojas, diálogos y avisos). Reemplazan a `window.confirm()` y
// `alert()`: se ven como el resto de la app, se anuncian a los lectores de pantalla y se pueden probar.
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: '¿Cancelar tu postulación?', body: 'La ONG deja de verla.', confirmLabel: 'Cancelar postulación', danger: true }))) return;
//
//   const toast = useToast();
//   toast('Te postulaste a Censo de Árboles Urbanos');
//
// Sin proveedor (por ejemplo en un test de un componente suelto) caen en `window.confirm` y en la consola,
// así ningún componente se rompe por no estar dentro de <UiProvider>.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal } from '../components/Modal';
import { Button } from './Button';

interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acción destructiva: el botón va en texto `critical` y el foco inicial queda en "Volver". */
  danger?: boolean;
}
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
type ToastFn = (text: string, opts?: { kind?: 'ok' | 'error'; actionLabel?: string; onAction?: () => void }) => void;

const ConfirmCtx = createContext<ConfirmFn | null>(null);
const ToastCtx = createContext<ToastFn | null>(null);

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmCtx);
  return fn ?? ((o) => Promise.resolve(typeof window !== 'undefined' && window.confirm(o.body ? `${o.title}\n${o.body}` : o.title)));
}

export function useToast(): ToastFn {
  const fn = useContext(ToastCtx);
  return fn ?? ((text) => { console.warn('[aviso]', text); });
}

interface ToastItem { id: number; text: string; kind: 'ok' | 'error'; actionLabel?: string; onAction?: () => void }

export function UiProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>((o) => new Promise<boolean>((resolve) => setPending({ ...o, resolve })), []);
  const answer = (v: boolean) => { pending?.resolve(v); setPending(null); };

  const toast = useCallback<ToastFn>((text, opts) => {
    const id = ++seq.current;
    setToasts(t => [...t.slice(-2), { id, text, kind: opts?.kind ?? 'ok', actionLabel: opts?.actionLabel, onAction: opts?.onAction }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  // Si el proveedor se desmonta con una pregunta abierta, se responde "no".
  useEffect(() => () => { pending?.resolve(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmValue = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmCtx.Provider value={confirmValue}>
      <ToastCtx.Provider value={toast}>
        {children}

        {pending && (
          <Modal
            label={pending.title}
            onClose={() => answer(false)}
            initialFocusRef={pending.danger ? cancelRef : undefined}
            overlayClassName="fixed inset-0 z-[60] bg-[var(--scrim)] flex items-center justify-center p-4"
            className="bg-surface text-ink rounded-2xl shadow-xl w-full max-w-sm p-5 flex flex-col gap-2 animate-riseIn"
          >
            <h2 className="text-lg font-bold tracking-[-0.2px]">{pending.title}</h2>
            {pending.body && <p className="text-[15px] leading-[1.45] text-ink-soft">{pending.body}</p>}
            <div className="flex justify-end gap-2 mt-3">
              <Button ref={cancelRef} variant="text" onClick={() => answer(false)}>{pending.cancelLabel ?? 'Volver'}</Button>
              <Button variant={pending.danger ? 'danger' : 'primary'} onClick={() => answer(true)}>{pending.confirmLabel ?? 'Confirmar'}</Button>
            </div>
          </Modal>
        )}

        <div aria-live="polite" className="fixed z-[70] inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] md:bottom-6 flex flex-col items-center gap-2 px-4 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto max-w-md w-fit px-4 py-3 rounded-xl bg-ink text-on-ink text-[13px] leading-snug shadow-lg flex items-center gap-3 animate-riseIn">
              <span>{t.text}</span>
              {t.actionLabel && (
                <button type="button" onClick={() => { t.onAction?.(); setToasts(x => x.filter(y => y.id !== t.id)); }} className="font-bold underline underline-offset-2">
                  {t.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      </ToastCtx.Provider>
    </ConfirmCtx.Provider>
  );
}
