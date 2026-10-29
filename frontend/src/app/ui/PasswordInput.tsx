// Campo de contraseña con el botón del ojo para mostrar u ocultar lo escrito (§274). Lo usan el login/registro
// (AuthModal) y "Cambiar contraseña" (PasswordSection). El botón dice siempre "Mostrar…" y el estado va en
// aria-pressed (no cambia de nombre al apretarlo); `toggleLabel` lo distingue cuando hay varios campos en pantalla.
import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { toggleLabel?: string };

export function PasswordInput({ toggleLabel = 'Mostrar contraseña', className = '', ...input }: Props) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...input} type={shown ? 'text' : 'password'} className={`${className} pr-12`} />
      <button type="button" onClick={() => setShown(s => !s)} aria-label={toggleLabel} aria-pressed={shown}
        className="absolute right-0.5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-ink-muted hover:text-ink">
        {shown ? <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" /> : <Eye size={18} strokeWidth={1.75} aria-hidden="true" />}
      </button>
    </div>
  );
}
