// Media query leída en JS, para lo que cambia de comportamiento (no solo de estilo) según el ancho: la barra lateral
// (acordeón o panel flotante, §320) y el Panel de la ONG (una o dos columnas, §321). Sin matchMedia (jsdom, navegadores
// raros) devuelve `fallback`.
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string, fallback: boolean): boolean {
  const [matches, setMatches] = useState(() => (typeof matchMedia === 'function' ? matchMedia(query).matches : fallback));
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}
