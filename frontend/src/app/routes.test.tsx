// src/app/routes.test.tsx
// Comprueba a qué pantalla resuelve cada ruta de Momentos, sin navegador: `matchRoutes` usa el mismo
// algoritmo de ranking que el router real. Lo que importa: /ngo/momentos NO tiene que caer en /ngo/:id
// (perfil público de una ONG) y /ngo/<id real> tiene que seguir funcionando.
import { describe, test, expect } from 'vitest';
import type { ReactElement } from 'react';
import { matchRoutes } from 'react-router';
import { router } from './routes';
import { MomentsPage } from './components/MomentsPage';
import { NGOMoments } from './components/NGOMoments';
import { NGOPublicProfile } from './components/NGOPublicProfile';
import { NGOLayout } from './components/NGOLayout';
import { Root } from './components/Root';

// createBrowserRouter normaliza `Component: X` a `element: <X />`: se compara el tipo del elemento.
const componentOf = (route?: { element?: unknown }) => (route?.element as ReactElement | undefined)?.type;
const leaf = (path: string) => {
  const m = matchRoutes(router.routes, path);
  return componentOf(m?.[m.length - 1].route);
};
const layout = (path: string) => componentOf(matchRoutes(router.routes, path)?.[0].route);

describe('rutas de Momentos', () => {
  test('/momentos es la pantalla pública, dentro del layout de Root', () => {
    expect(leaf('/momentos')).toBe(MomentsPage);
    expect(layout('/momentos')).toBe(Root);
  });

  test('/ngo/momentos es la pantalla de la ONG, dentro del layout de la ONG', () => {
    expect(leaf('/ngo/momentos')).toBe(NGOMoments);
    expect(layout('/ngo/momentos')).toBe(NGOLayout);
  });

  test('/ngo/:id sigue siendo el perfil público de una ONG', () => {
    expect(leaf('/ngo/ngo-1')).toBe(NGOPublicProfile);
  });
});
