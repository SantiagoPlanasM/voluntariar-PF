// src/app/components/ModalsMigrated.test.tsx
//
// FilterModal, ReviewsModal y el mapa ampliado de ProjectMap pasan a usar <Modal> (REVISION F12, segunda
// parte). Antes: sin role="dialog", Escape escuchado en window (cerraba TODOS los modales abiertos a la vez,
// p. ej. el login abierto encima de las reseñas) y el foco quedaba detrás del fondo.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const { auth, project } = vi.hoisted(() => ({
  auth: {
    user: { id: 'u-vol', name: 'María', email: 'm@x.com', role: 'volunteer' } as Record<string, unknown> | null,
    showAuthModal: false, authModalIntent: '', authModalTab: 'login' as 'login' | 'register',
    openAuthModal: vi.fn(), closeAuthModal: vi.fn(), setAuthModalTab: vi.fn(),
    login: vi.fn(), register: vi.fn(), logout: vi.fn(), loading: false, initializing: false,
  },
  project: {
    id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación', description: 'd', category: 'Medio Ambiente',
    location: 'Córdoba', latitude: -31.42, longitude: -64.18, type: 'fugaz', status: 'active', modality: 'presencial',
    volunteers_needed: 10, current_volunteers: 1, cost_per_person: 0, ngo_name: 'Sustentando', image: '',
  },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, projects: { ...actual.api.projects, get: vi.fn().mockResolvedValue({ project: { ratings: [] } }), rate: vi.fn() } } };
});

import { FilterModal, DEFAULT_FILTERS } from './FilterModal';
import { ReviewsModal } from './ReviewsModal';
import { AuthModal } from './AuthModal';
import { ProjectMap } from './ProjectMap';

// jsdom no tiene ResizeObserver (lo usa ProjectMap para reacomodar Leaflet).
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as never;

beforeEach(() => {
  auth.showAuthModal = false;
  auth.closeAuthModal.mockReset();
  document.body.style.overflow = '';
});

describe('FilterModal', () => {
  const open = (onClose = vi.fn()) => {
    render(<FilterModal isOpen onClose={onClose} allProjects={[project as never]} searchQuery=""
      currentFilters={DEFAULT_FILTERS} onApply={vi.fn()} onReset={vi.fn()} />);
    return onClose;
  };

  test('diálogo "Filtros", el foco entra y Tab queda adentro', () => {
    open();
    const d = screen.getByRole('dialog', { name: 'Filtros' });
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(d.contains(document.activeElement)).toBe(true);
    const last = within(d).getByRole('button', { name: /^Mostrar/ });
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(d.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(last);
  });

  test('Escape cierra una sola vez y el scroll se libera al desmontar', () => {
    const onClose = vi.fn();
    const { unmount } = render(<FilterModal isOpen onClose={onClose} allProjects={[]} searchQuery=""
      currentFilters={DEFAULT_FILTERS} onApply={vi.fn()} onReset={vi.fn()} />);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('ReviewsModal', () => {
  const reviews = (onClose = vi.fn()) => (
    <ReviewsModal isOpen onClose={onClose} projectId="proj-1" projectTitle="Reforestación" avgRating={0}
      initialRatings={[]} canRate onReviewAdded={() => {}} />
  );

  test('diálogo "Reseñas y Calificaciones", el foco entra y Escape cierra', async () => {
    const onClose = vi.fn();
    render(<MemoryRouter>{reviews(onClose)}</MemoryRouter>);
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(d.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('con el login abierto ENCIMA (sin sesión, "calificar" lo abre), Escape cierra solo el login', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<MemoryRouter>{reviews(onClose)}<AuthModal /></MemoryRouter>);
    await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    auth.showAuthModal = true;
    rerender(<MemoryRouter>{reviews(onClose)}<AuthModal /></MemoryRouter>);
    expect(screen.getByRole('dialog', { name: 'Iniciar sesión' })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(auth.closeAuthModal).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ProjectMap: mapa ampliado', () => {
  test('diálogo "Mapa de Voluntariados", el foco entra, Escape cierra y vuelve al botón que lo abrió', async () => {
    render(<MemoryRouter><ProjectMap projects={[project as never]} /></MemoryRouter>);
    const opener = screen.getByTitle('Abrir mapa ampliado (Pop-up)');
    opener.focus();
    fireEvent.click(opener);
    const d = await screen.findByRole('dialog', { name: 'Mapa de Voluntariados' });
    expect(d.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(opener);
  });

  test('el detalle de un proyecto elegido se cierra con "Cerrar detalle" (mapa chico y ampliado)', async () => {
    const { container } = render(<MemoryRouter><ProjectMap projects={[project as never]} /></MemoryRouter>);
    // El mapa recrea los marcadores después del primer render: el pin se busca de nuevo en cada intento.
    const selectByPin = () => waitFor(() => {
      fireEvent.click(container.querySelector('.leaflet-marker-icon')!);
      expect(screen.getByRole('button', { name: 'Cerrar detalle' })).toBeInTheDocument();
    });
    await selectByPin();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
    expect(screen.queryByRole('button', { name: 'Cerrar detalle' })).not.toBeInTheDocument();

    await selectByPin();
    fireEvent.click(screen.getByTitle('Abrir mapa ampliado (Pop-up)'));
    const d = await screen.findByRole('dialog', { name: 'Mapa de Voluntariados' });
    expect(within(d).getByRole('button', { name: 'Cerrar detalle' })).toBeInTheDocument();
  });
});
