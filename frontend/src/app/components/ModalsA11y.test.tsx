// src/app/components/ModalsA11y.test.tsx
//
// REVISION F12: los modales de reseña y de seguidores/seguidos (perfil propio y público) eran <div>s sin
// role="dialog", sin Escape y sin foco. Ahora usan <Modal>. Acá se prueba cada uso: que sea un diálogo con
// nombre, que Escape lo cierre y que el foco entre (lo demás del comportamiento está en Modal.test.tsx).
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { ReviewModal } from './ReviewModal';
import { VolunteerPublicProfile } from './VolunteerPublicProfile';
import { VolunteerProfile } from './VolunteerProfile';

// Objeto estable: VolunteerProfile tiene useEffect([user]); uno nuevo en cada render lo deja en bucle.
vi.mock('../../lib/AuthContext', () => {
  const auth = {
    user: { id: 'u-me', name: 'María', email: 'm@x.com', role: 'volunteer' },
    openAuthModal: vi.fn(), logout: vi.fn(), login: vi.fn(), initializing: false,
  };
  return { useAuth: () => auth };
});
vi.mock('./MomentsGrid', () => ({ MomentsGrid: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  const vols = { volunteers: [{ user_id: 'u-2', name: 'Juan', followers: 3 }] };
  return {
    ...actual,
    api: {
      ...actual.api,
      projects: { ...actual.api.projects, rate: vi.fn() },
      enrollments: { ...actual.api.enrollments, my: vi.fn().mockResolvedValue({ enrollments: [] }) },
      catalog: { ...actual.api.catalog, habilidades: vi.fn().mockResolvedValue({ habilidades: [] }) },
      follows: {
        ...actual.api.follows,
        myNgos: vi.fn().mockResolvedValue({ ngos: [] }),
        myFollowing: vi.fn().mockResolvedValue(vols),
        myFollowers: vi.fn().mockResolvedValue(vols),
        volunteerFollowStatus: vi.fn().mockResolvedValue({ following: false }),
        volunteerFollowers: vi.fn().mockResolvedValue(vols),
        volunteerFollowing: vi.fn().mockResolvedValue(vols),
      },
      voluntarios: {
        ...actual.api.voluntarios,
        habilidades: { list: vi.fn().mockResolvedValue({ habilidades: [] }), update: vi.fn() },
        getProfile: vi.fn().mockResolvedValue({
          volunteer: { id: 'user-55', name: 'Ana', avatar: null, bio: '', location: '', followers: 1, following_count: 1 },
          habilidades: [], stats: { total_enrollments: 0, approved_enrollments: 0, total_horas: 0 }, participaciones: [],
        }),
      },
    },
  };
});

const at = (path: string, route: string, el: React.ReactElement) =>
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={el} /></Routes></MemoryRouter>);

describe('modales accesibles', () => {
  test('ReviewModal: diálogo "Dejar reseña", el foco entra y Escape cierra', () => {
    const onClose = vi.fn();
    render(<ReviewModal projectId="p" projectTitle="Plantación" onClose={onClose} onSaved={() => {}} />);
    const d = screen.getByRole('dialog', { name: 'Dejar reseña' });
    expect(d.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('perfil público: la lista de seguidores es un diálogo con nombre y Escape la cierra', async () => {
    at('/volunteer/user-55', '/volunteer/:id', <VolunteerPublicProfile />);
    fireEvent.click(await screen.findByRole('button', { name: /Seguidores/ }));
    const d = await screen.findByRole('dialog', { name: 'Seguidores' });
    expect(d.contains(document.activeElement)).toBe(true);
    expect(await screen.findByText('Juan')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('perfil propio: la lista de "Siguiendo" es un diálogo con nombre y Escape la cierra', async () => {
    at('/profile', '/profile', <VolunteerProfile />);
    fireEvent.click(await screen.findByRole('button', { name: /Siguiendo/ }));
    const d = await screen.findByRole('dialog', { name: 'Siguiendo' });
    expect(d.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
