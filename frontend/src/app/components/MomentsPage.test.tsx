// src/app/components/MomentsPage.test.tsx
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { MomentsPage } from './MomentsPage';
import type { User } from '../../lib/api';

vi.mock('../../lib/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('./MomentsFeed', async () => {
  const React = await import('react');
  return { MomentsFeed: () => React.createElement('div', { 'data-testid': 'moments-feed' }) };
});

import { useAuth } from '../../lib/AuthContext';

const openAuthModal = vi.fn();
const mk = (role: User['role']): User => ({ id: `id-${role}`, name: role, email: `${role}@x.com`, role });
function asViewer(user: User | null, initializing = false) {
  vi.mocked(useAuth).mockReturnValue({ user, initializing, openAuthModal } as unknown as ReturnType<typeof useAuth>);
}
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/momentos']}>
      <Routes>
        <Route path="/momentos" element={<MomentsPage />} />
        <Route path="/ngo/momentos" element={<div>pantalla de la ONG</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => { openAuthModal.mockReset(); }); // con llaves: ver PublicFeedStats.test.tsx

describe('<MomentsPage />', () => {
  test('muestra el título, las pestañas (con "Momentos" activa) y el feed', () => {
    asViewer(mk('volunteer'));
    renderPage();
    expect(screen.getByRole('heading', { name: 'Momentos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Momentos' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('moments-feed')).toBeInTheDocument();
  });

  test('voluntario: la pestaña "Proyectos" lleva a /feed y no se ofrece ingresar', () => {
    asViewer(mk('volunteer'));
    renderPage();
    expect(screen.getByRole('link', { name: 'Proyectos' })).toHaveAttribute('href', '/feed');
    expect(screen.queryByRole('button', { name: 'Ingresar' })).not.toBeInTheDocument();
  });

  test('empresa: "Proyectos" lleva a /explore (su pantalla de proyectos; /feed es el feed de un voluntario)', () => {
    asViewer(mk('company'));
    renderPage();
    expect(screen.getByRole('link', { name: 'Proyectos' })).toHaveAttribute('href', '/explore');
  });

  test('visitante: "Proyectos" lleva a "/" y ofrece ingresar para dar me gusta y compartir', () => {
    asViewer(null);
    renderPage();
    expect(screen.getByRole('link', { name: 'Proyectos' })).toHaveAttribute('href', '/');
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(openAuthModal).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('moments-feed')).toBeInTheDocument();     // el feed es público
  });

  test('una ONG es redirigida a su pantalla (/ngo/momentos), que tiene su propio menú', () => {
    asViewer(mk('ngo'));
    renderPage();
    expect(screen.getByText('pantalla de la ONG')).toBeInTheDocument();
    expect(screen.queryByTestId('moments-feed')).not.toBeInTheDocument();
  });

  test('mientras se verifica la sesión no muestra el feed ni redirige ni ofrece ingresar', () => {
    asViewer(null, true);
    renderPage();
    expect(screen.queryByTestId('moments-feed')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ingresar' })).not.toBeInTheDocument();
  });
});
