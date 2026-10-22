// Botón único (DESIGN.md → Botones). Verde = inscribirse, azul = donar; todo lo demás es negro o gris.
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Link, LinkProps } from 'react-router';

export type ButtonVariant = 'join' | 'donate' | 'primary' | 'secondary' | 'text' | 'danger' | 'photo';

const BASE =
  'inline-flex items-center justify-center gap-1.5 font-bold text-[15px] leading-none whitespace-nowrap ' +
  'transition-[transform,background-color,opacity] duration-[120ms] active:scale-[.97] disabled:opacity-40 disabled:active:scale-100 disabled:cursor-not-allowed';

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  join: 'h-12 px-5 rounded-[12px] bg-people text-white hover:bg-people-pressed',
  donate: 'h-12 px-5 rounded-[12px] bg-brand text-white hover:bg-brand-pressed',
  primary: 'h-10 px-4 rounded-[10px] bg-ink text-on-ink hover:opacity-90',
  secondary: 'h-10 px-4 rounded-[10px] bg-surface-soft text-ink hover:bg-surface-pressed',
  text: 'h-10 px-2 text-ink font-semibold',
  danger: 'h-10 px-2 text-critical font-semibold',
  // Pastilla blanca sobre una foto: el texto no cambia con el tema.
  photo: 'h-8 px-3 rounded-full bg-[var(--photo-chip)] text-[var(--on-photo)] text-xs font-semibold',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Mientras la acción está en curso: conserva el ancho y dice qué pasa. */
  busy?: boolean;
  busyLabel?: string;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', busy, busyLabel, block, className = '', children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className={`${BASE} ${BUTTON_VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
});

/** Un `<Link>` con el aspecto de un botón (navega; no es una acción). */
export function ButtonLink({ variant = 'secondary', block, className = '', ...rest }:
  LinkProps & { variant?: ButtonVariant; block?: boolean }) {
  return <Link className={`${BASE} ${BUTTON_VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`} {...rest} />;
}

/** Botón de solo ícono, con el área táctil de 44 px. `label` es obligatorio (nombre accesible). */
export function IconButton({ label, className = '', children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`w-11 h-11 inline-flex items-center justify-center rounded-full text-ink hover:bg-surface-soft transition-colors active:scale-95 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
