// src/app/components/NGOMoments.test.tsx
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NGOMoments } from './NGOMoments';

vi.mock('./MomentsFeed', async () => {
  const React = await import('react');
  return {
    MomentsFeed: (props: { showComposer?: boolean }) =>
      React.createElement('div', { 'data-testid': 'moments-feed', 'data-show-composer': String(props.showComposer ?? true) }),
  };
});

describe('<NGOMoments />', () => {
  test('muestra el título y el feed de momentos (con el botón para publicar, que es de MomentsFeed)', () => {
    render(<NGOMoments />);
    expect(screen.getByRole('heading', { name: 'Momentos' })).toBeInTheDocument();
    expect(screen.getByTestId('moments-feed')).toBeInTheDocument();
  });

  test('el feed de la ONG sí permite publicar (el compositor no se oculta)', () => {
    render(<NGOMoments />);
    expect(screen.getByTestId('moments-feed')).toHaveAttribute('data-show-composer', 'true');
  });

  test('no muestra las pestañas Proyectos | Momentos (la ONG tiene su propio menú)', () => {
    render(<NGOMoments />);
    expect(screen.queryByRole('navigation', { name: 'Secciones del feed' })).not.toBeInTheDocument();
  });
});
