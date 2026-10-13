// src/app/components/FeedTabsPlacement.test.tsx
// MainFeed (voluntario) y PublicFeed (visitante) tienen que mostrar las pestañas con "Proyectos" activa y
// "Momentos" enlazando a /momentos.
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { MainFeed } from './MainFeed';
import { PublicFeed } from './PublicFeed';

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth.value }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  const empty = () => Promise.resolve({ projects: [], ngos: [], recommendations: [], unread: 0, notifications: [] });
  return {
    ...actual,
    api: {
      ...actual.api,
      projects: { ...actual.api.projects, list: vi.fn(empty) },
      ngos: { ...actual.api.ngos, list: vi.fn(empty) },
      notifications: { ...actual.api.notifications, list: vi.fn(empty) },
      follows: { ...actual.api.follows, feed: vi.fn(empty), myNgos: vi.fn(empty) },
    },
  };
});

const tabs = () => screen.getByRole('navigation', { name: 'Secciones del feed' });

describe('pestañas del feed', () => {
  test('MainFeed (voluntario): "Proyectos" activa y "Momentos" lleva a /momentos', async () => {
    auth.value = { user: { id: 'u1', name: 'María', email: 'm@x.com', role: 'volunteer' }, logout: vi.fn(), openAuthModal: vi.fn(), initializing: false };
    render(<MemoryRouter><MainFeed /></MemoryRouter>);
    const nav = tabs();
    expect(nav.querySelector('a[aria-current="page"]')?.textContent).toBe('Proyectos');
    expect(nav.querySelector('a[href="/momentos"]')?.textContent).toBe('Momentos');
    expect(nav.querySelector('a[href="/feed"]')).not.toBeNull();
  });

  test('PublicFeed (visitante): "Proyectos" activa (enlaza a "/") y "Momentos" lleva a /momentos', async () => {
    auth.value = { user: null, initializing: false, openAuthModal: vi.fn() };
    render(<MemoryRouter><PublicFeed /></MemoryRouter>);
    const nav = tabs();
    expect(nav.querySelector('a[aria-current="page"]')?.textContent).toBe('Proyectos');
    expect(nav.querySelector('a[href="/"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/momentos"]')?.textContent).toBe('Momentos');
  });
});
