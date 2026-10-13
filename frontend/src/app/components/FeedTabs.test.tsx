// src/app/components/FeedTabs.test.tsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { FeedTabs } from './FeedTabs';

const renderTabs = (active: 'projects' | 'moments', projectsHref = '/feed') =>
  render(
    <MemoryRouter>
      <FeedTabs active={active} projectsHref={projectsHref} momentsHref="/momentos" />
    </MemoryRouter>,
  );

describe('<FeedTabs />', () => {
  test('muestra las pestañas "Proyectos" y "Momentos" como enlaces a sus rutas', () => {
    renderTabs('projects');
    expect(screen.getByRole('link', { name: 'Proyectos' })).toHaveAttribute('href', '/feed');
    expect(screen.getByRole('link', { name: 'Momentos' })).toHaveAttribute('href', '/momentos');
  });

  test('usa la ruta de proyectos que le pasan (el visitante vuelve a "/", el logueado a "/feed")', () => {
    renderTabs('moments', '/');
    expect(screen.getByRole('link', { name: 'Proyectos' })).toHaveAttribute('href', '/');
  });

  test('marca como actual (aria-current) solo la pestaña activa: proyectos', () => {
    renderTabs('projects');
    expect(screen.getByRole('link', { name: 'Proyectos' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Momentos' })).not.toHaveAttribute('aria-current');
  });

  test('marca como actual solo la pestaña activa: momentos', () => {
    renderTabs('moments');
    expect(screen.getByRole('link', { name: 'Momentos' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Proyectos' })).not.toHaveAttribute('aria-current');
  });

  test('es una navegación con nombre accesible', () => {
    renderTabs('projects');
    expect(screen.getByRole('navigation', { name: 'Secciones del feed' })).toBeInTheDocument();
  });
});
