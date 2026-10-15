// src/app/components/StaleResponses.test.tsx
//
// REVISION F15: respuestas viejas que pisan a las nuevas. Si el usuario cambia de conversación, de categoría o
// de perfil antes de que llegue la respuesta anterior, y esa respuesta llega ÚLTIMA, la pantalla mostraba los
// datos viejos bajo el título nuevo (p. ej. los mensajes con Ana en el hilo con Juan). Se simula la latencia
// con promesas que el test resuelve en el orden que quiere: primero la nueva, después la vieja.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router';
import { deferred } from '../../test/postFixtures';

const { auth } = vi.hoisted(() => ({
  auth: { user: null as Record<string, unknown> | null, initializing: false, openAuthModal: () => {} },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/ChatContext', () => ({
  useChat: () => ({ onMessage: () => () => {}, refreshConversations: () => {} }),
}));
vi.mock('./MomentsGrid', () => ({ MomentsGrid: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      messages: { ...actual.api.messages, thread: vi.fn(), markRead: vi.fn().mockResolvedValue({}) },
      projects: { ...actual.api.projects, list: vi.fn() },
      voluntarios: { ...actual.api.voluntarios, getProfile: vi.fn() },
      follows: { ...actual.api.follows, volunteerFollowStatus: vi.fn().mockResolvedValue({ following: false }) },
    },
  };
});

import { api } from '../../lib/api';
import { ChatThread } from './ChatThread';
import { PublicFeed } from './PublicFeed';
import { VolunteerPublicProfile } from './VolunteerPublicProfile';

/** Botón para navegar dentro del mismo router (como un link de la app). */
function Go({ to }: { to: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>ir a {to}</button>;
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as never;
  auth.user = null;
});

describe('F15: una respuesta vieja no pisa a la nueva', () => {
  test('chat: pasar de Ana a Juan; si el hilo de Ana llega último, se siguen viendo los mensajes de Juan', async () => {
    auth.user = { id: 'u-me', name: 'María', role: 'volunteer' };
    const ana = deferred<never>();
    const juan = deferred<never>();
    vi.mocked(api.messages.thread).mockImplementation(((id: string) => (id === 'ana' ? ana.promise : juan.promise)) as never);
    render(
      <MemoryRouter initialEntries={['/messages/ana']}>
        <Go to="/messages/juan" />
        <Routes><Route path="/messages/:userId" element={<ChatThread />} /></Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('ir a /messages/juan'));
    const msg = (id: string, body: string, from: string) =>
      ({ id, sender_id: from, receiver_id: 'u-me', body, created_at: '2026-10-14T12:00:00Z', read: true });
    await act(async () => { juan.resolve({ messages: [msg('m2', 'Hola, soy Juan', 'juan')], other: { id: 'juan', name: 'Juan' } } as never); });
    await act(async () => { ana.resolve({ messages: [msg('m1', 'Hola, soy Ana', 'ana')], other: { id: 'ana', name: 'Ana' } } as never); });

    expect(screen.getByText('Hola, soy Juan')).toBeInTheDocument();
    expect(screen.queryByText('Hola, soy Ana')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Juan' })).toBeInTheDocument();
  });

  test('chat: un error de la conversación vieja no aparece en la nueva', async () => {
    auth.user = { id: 'u-me', name: 'María', role: 'volunteer' };
    const ana = deferred<never>();
    const juan = deferred<never>();
    vi.mocked(api.messages.thread).mockImplementation(((id: string) => (id === 'ana' ? ana.promise : juan.promise)) as never);
    render(
      <MemoryRouter initialEntries={['/messages/ana']}>
        <Go to="/messages/juan" />
        <Routes><Route path="/messages/:userId" element={<ChatThread />} /></Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('ir a /messages/juan'));
    await act(async () => { juan.resolve({ messages: [], other: { id: 'juan', name: 'Juan' } } as never); });
    await act(async () => { ana.reject(new Error('Error al cargar la conversación con Ana')); });
    expect(screen.queryByText('Error al cargar la conversación con Ana')).not.toBeInTheDocument();
  });

  test('feed público: elegir Educación y después Salud; si Educación llega última, se ven los de Salud', async () => {
    const pending: Record<string, ReturnType<typeof deferred<never>>> = {};
    vi.mocked(api.projects.list).mockImplementation(((params: Record<string, string> = {}) => {
      const key = params.category || 'Todos';
      pending[key] = deferred<never>();
      return pending[key].promise;
    }) as never);
    render(<MemoryRouter><PublicFeed /></MemoryRouter>);
    const p = (id: string, title: string) => ({ id, title, ngo_name: 'ONG', category: 'x', location: 'Córdoba',
      volunteers_needed: 10, current_volunteers: 0, cost_per_person: 0, funding_goal: 0, current_funding: 0, type: 'fugaz' });
    await act(async () => { pending['Todos'].resolve({ projects: [] } as never); });

    fireEvent.click(screen.getByRole('button', { name: /Educación/ }));
    fireEvent.click(screen.getByRole('button', { name: /Salud/ }));
    await act(async () => { pending['Salud'].resolve({ projects: [p('s1', 'Campaña de vacunación')] } as never); });
    await act(async () => { pending['Educación'].resolve({ projects: [p('e1', 'Apoyo escolar')] } as never); });

    expect(screen.getByText('Campaña de vacunación')).toBeInTheDocument();
    expect(screen.queryByText('Apoyo escolar')).not.toBeInTheDocument();
  });

  test('perfil público: saltar de Ana a Juan; si el perfil de Ana llega último, se sigue viendo Juan', async () => {
    const ana = deferred<never>();
    const juan = deferred<never>();
    vi.mocked(api.voluntarios.getProfile).mockImplementation(((id: string) => (id === 'ana' ? ana.promise : juan.promise)) as never);
    render(
      <MemoryRouter initialEntries={['/volunteer/ana']}>
        <Go to="/volunteer/juan" />
        <Routes><Route path="/volunteer/:id" element={<VolunteerPublicProfile />} /></Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('ir a /volunteer/juan'));
    const prof = (id: string, name: string) => ({ volunteer: { id, name, avatar: null, bio: '', location: '', followers: 0, following_count: 0 },
      habilidades: [], stats: { total_enrollments: 0, approved_enrollments: 0, total_horas: 0 }, participaciones: [] });
    await act(async () => { juan.resolve(prof('juan', 'Juan Pérez') as never); });
    await act(async () => { ana.resolve(prof('ana', 'Ana López') as never); });

    expect(screen.getAllByText('Juan Pérez').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ana López')).not.toBeInTheDocument();
  });
});

// Los otros órdenes: la vieja llega PRIMERO mientras la nueva sigue en vuelo (tiene que seguir cargando y no
// mostrar lo viejo), o la vieja FALLA al final (su error no es de la pantalla actual).
describe('F15: los otros órdenes de llegada', () => {
  const chat = () => render(
    <MemoryRouter initialEntries={['/messages/ana']}>
      <Go to="/messages/juan" />
      <Routes><Route path="/messages/:userId" element={<ChatThread />} /></Routes>
    </MemoryRouter>
  );
  const msg = (id: string, body: string, from: string) =>
    ({ id, sender_id: from, receiver_id: 'u-me', body, created_at: '2026-10-14T12:00:00Z', read: true });

  test('chat: el hilo de Ana llega mientras Juan sigue cargando → sigue el indicador de carga, sin mensajes de Ana', async () => {
    auth.user = { id: 'u-me', name: 'María', role: 'volunteer' };
    const ana = deferred<never>(); const juan = deferred<never>();
    vi.mocked(api.messages.thread).mockImplementation(((id: string) => (id === 'ana' ? ana.promise : juan.promise)) as never);
    chat();
    fireEvent.click(screen.getByText('ir a /messages/juan'));
    await act(async () => { ana.resolve({ messages: [msg('m1', 'Hola, soy Ana', 'ana')], other: { id: 'ana', name: 'Ana' } } as never); });
    expect(screen.getByRole('status', { name: 'Cargando mensajes' })).toBeInTheDocument();
    expect(screen.queryByText('Hola, soy Ana')).not.toBeInTheDocument();
    await act(async () => { juan.resolve({ messages: [msg('m2', 'Hola, soy Juan', 'juan')], other: { id: 'juan', name: 'Juan' } } as never); });
    expect(screen.getByText('Hola, soy Juan')).toBeInTheDocument();
  });

  test('chat: el error de la conversación anterior no queda en la nueva', async () => {
    auth.user = { id: 'u-me', name: 'María', role: 'volunteer' };
    const juan = deferred<never>();
    vi.mocked(api.messages.thread).mockImplementation(((id: string) =>
      (id === 'ana' ? Promise.reject(new Error('No pudimos cargar la conversación')) : juan.promise)) as never);
    chat();
    expect(await screen.findByText('No pudimos cargar la conversación')).toBeInTheDocument();
    fireEvent.click(screen.getByText('ir a /messages/juan'));
    await act(async () => { juan.resolve({ messages: [], other: { id: 'juan', name: 'Juan' } } as never); });
    expect(screen.queryByText('No pudimos cargar la conversación')).not.toBeInTheDocument();
  });

  const profile = () => render(
    <MemoryRouter initialEntries={['/volunteer/ana']}>
      <Go to="/volunteer/juan" />
      <Routes><Route path="/volunteer/:id" element={<VolunteerPublicProfile />} /></Routes>
    </MemoryRouter>
  );
  const prof = (id: string, name: string) => ({ volunteer: { id, name, avatar: null, bio: '', location: '', followers: 0, following_count: 0 },
    habilidades: [], stats: { total_enrollments: 0, approved_enrollments: 0, total_horas: 0 }, participaciones: [] });

  test('perfil: el de Ana llega mientras Juan sigue cargando → sigue cargando', async () => {
    const ana = deferred<never>(); const juan = deferred<never>();
    vi.mocked(api.voluntarios.getProfile).mockImplementation(((id: string) => (id === 'ana' ? ana.promise : juan.promise)) as never);
    profile();
    fireEvent.click(screen.getByText('ir a /volunteer/juan'));
    await act(async () => { ana.resolve(prof('ana', 'Ana López') as never); });
    expect(screen.getByRole('status', { name: 'Cargando perfil' })).toBeInTheDocument();
    expect(screen.queryByText('Ana López')).not.toBeInTheDocument();
  });

  test('perfil: si el de Ana falla después de mostrar a Juan, no aparece su error', async () => {
    const ana = deferred<never>(); const juan = deferred<never>();
    vi.mocked(api.voluntarios.getProfile).mockImplementation(((id: string) => (id === 'ana' ? ana.promise : juan.promise)) as never);
    profile();
    fireEvent.click(screen.getByText('ir a /volunteer/juan'));
    await act(async () => { juan.resolve(prof('juan', 'Juan Pérez') as never); });
    await act(async () => { ana.reject(new Error('Error al cargar perfil de Ana')); });
    expect(screen.getAllByText('Juan Pérez').length).toBeGreaterThan(0);
    expect(screen.queryByText('Error al cargar perfil de Ana')).not.toBeInTheDocument();
  });

  const feed = () => {
    const pending: Record<string, ReturnType<typeof deferred<never>>> = {};
    vi.mocked(api.projects.list).mockImplementation(((params: Record<string, string> = {}) => {
      const key = params.category || 'Todos';
      pending[key] = deferred<never>();
      return pending[key].promise;
    }) as never);
    const utils = render(<MemoryRouter><PublicFeed /></MemoryRouter>);
    return { pending, ...utils };
  };
  const p = (id: string, title: string) => ({ id, title, ngo_name: 'ONG', category: 'x', location: 'Córdoba',
    volunteers_needed: 10, current_volunteers: 0, cost_per_person: 0, funding_goal: 0, current_funding: 0, type: 'fugaz' });

  test('feed: Educación llega mientras Salud sigue cargando → siguen los esqueletos de carga', async () => {
    const { pending } = feed();
    await act(async () => { pending['Todos'].resolve({ projects: [] } as never); });
    fireEvent.click(screen.getByRole('button', { name: /Educación/ }));
    fireEvent.click(screen.getByRole('button', { name: /Salud/ }));
    await act(async () => { pending['Educación'].resolve({ projects: [p('e1', 'Apoyo escolar')] } as never); });
    expect(screen.getByRole('status', { name: 'Cargando proyectos' })).toBeInTheDocument();
    expect(screen.queryByText('Apoyo escolar')).not.toBeInTheDocument();
  });

  test('feed: si Educación falla después de mostrar Salud, los proyectos de Salud no se borran', async () => {
    const { pending } = feed();
    await act(async () => { pending['Todos'].resolve({ projects: [] } as never); });
    fireEvent.click(screen.getByRole('button', { name: /Educación/ }));
    fireEvent.click(screen.getByRole('button', { name: /Salud/ }));
    await act(async () => { pending['Salud'].resolve({ projects: [p('s1', 'Campaña de vacunación')] } as never); });
    await act(async () => { pending['Educación'].reject(new Error('fallo')); });
    expect(screen.getByText('Campaña de vacunación')).toBeInTheDocument();
  });
});
