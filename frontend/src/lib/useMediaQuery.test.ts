// src/lib/useMediaQuery.test.ts
//
// Media query leída en JS (§320–§321): la barra lateral (nombres desde 1024 px) y el Panel de la ONG (dos columnas
// desde 1280 px) cambian de comportamiento, no solo de estilo, según el ancho.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';

const real = window.matchMedia;
afterEach(() => { window.matchMedia = real; });

function fakeMq(matches: boolean) {
  const mq = {
    matches, media: '', listener: null as null | (() => void),
    addEventListener: vi.fn((_: string, l: () => void) => { mq.listener = l; }),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mq) as unknown as typeof window.matchMedia;
  return mq;
}

describe('useMediaQuery', () => {
  test('sin matchMedia devuelve el valor por defecto que le pasen', () => {
    // @ts-expect-error: navegador sin matchMedia
    window.matchMedia = undefined;
    expect(renderHook(() => useMediaQuery('(min-width: 1px)', true)).result.current).toBe(true);
    expect(renderHook(() => useMediaQuery('(min-width: 1px)', false)).result.current).toBe(false);
  });

  test('arranca con lo que dice la consulta, no con el valor por defecto', () => {
    fakeMq(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1280px)', false));
    expect(result.current).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1280px)');
  });

  test('sigue los cambios de ancho y deja de escuchar al desmontarse', () => {
    const mq = fakeMq(false);
    const { result, unmount } = renderHook(() => useMediaQuery('(min-width: 1280px)', false));
    expect(result.current).toBe(false);
    mq.matches = true;
    act(() => mq.listener!());
    expect(result.current).toBe(true);
    unmount();
    expect(mq.removeEventListener).toHaveBeenCalledWith('change', mq.listener);
  });
});
