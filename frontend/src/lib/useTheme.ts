// Tema claro / oscuro / "como el teléfono". El valor se guarda en el navegador (`v_theme`); sin valor, manda
// la preferencia del sistema. `index.html` lo aplica antes de pintar para que no parpadee.
import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'v_theme';

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch { return 'system'; }
}

export function applyTheme(choice: ThemeChoice) {
  const resolved = choice === 'system'
    ? (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : choice;
  document.documentElement.setAttribute('data-theme', resolved);
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read);

  useEffect(() => { applyTheme(choice); }, [choice]);

  const set = useCallback((next: ThemeChoice) => {
    try {
      if (next === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, next);
    } catch { /* sin almacenamiento: el cambio vale para esta visita */ }
    setChoice(next);
  }, []);

  return { choice, setChoice: set };
}
