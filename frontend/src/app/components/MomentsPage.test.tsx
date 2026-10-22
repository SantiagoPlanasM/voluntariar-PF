// src/app/components/MomentsPage.test.tsx
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { MomentsPage } from './MomentsPage';
import type { User } from '../../lib/api';

vi.mock('../../lib/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('./MomentsFeed', async () => {
  const React = await import('react');
  return {
    MomentsFeed: ({ autoCompose }: { autoCompose?: boolean }) =>
      React.createElement('div', { 'data-testid': 'moments-feed', 'data-auto-compose': String(!!autoCompose) }),
  };
});

import { useAuth } from '../../lib/AuthContext';

const openAuthModal = vi.fn();
const mk = (role: User['role']): User => ({ id: `id-${role}`, name: role, email: `${role}@x.com`, role });
function asViewer(user: User | null, initializing = false) {
  vi.mocked(useAuth).mockReturnValue({ user, initializing, openAuthModal } as unknown as ReturnType<typeof useAuth>);
}
const renderPage = (path = '/momentos') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/momentos" element={<MomentsPage />} />
        <Route path="/ngo/momentos" element={<div>pantalla de la ONG</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => { openAuthModal.mockReset(); }); // con llaves: ver PublicFeedStats.test.tsx

describe('<MomentsPage />', () => {
  test('título "Publicaciones" (para lectores de pantalla) y el feed; sin las pestañas viejas Proyectos/Momentos', () => {
    asViewer(mk('volunteer'));
    renderPage();
    expect(screen.getByRole('heading', { name: 'Publicaciones' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Proyectos' })).not.toBeInTheDocument();
    expect(screen.getByTestId('moments-feed')).toBeInTheDocument();
  });

  test('voluntario: no se ofrece ingresar', () => {
    asViewer(mk('volunteer'));
    renderPage();
    expect(screen.queryByRole('button', { name: 'Ingresar' })).not.toBeInTheDocument();
  });

  test('visitante: ofrece ingresar para dar me gusta y publicar, y el feed se ve igual (es público)', () => {
    asViewer(null);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(openAuthModal).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('moments-feed')).toBeInTheDocument();
  });

  test('"Crear" de la barra (/momentos?crear=1) le pide al feed que abra el compositor; sin el parámetro, no', () => {
    asViewer(mk('volunteer'));
    const { unmount } = renderPage('/momentos?crear=1');
    expect(screen.getByTestId('moments-feed')).toHaveAttribute('data-auto-compose', 'true');
    unmount();
    renderPage();
    expect(screen.getByTestId('moments-feed')).toHaveAttribute('data-auto-compose', 'false');
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
