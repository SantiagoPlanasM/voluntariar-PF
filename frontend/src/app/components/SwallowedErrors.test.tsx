// src/app/components/SwallowedErrors.test.tsx
//
// REVISION.md F9: errores tragados en silencio. Si la carga fallaba se mostraba el estado VACÍO ("Todavía
// no recibiste propuestas", "Sin KPIs todavía", "Sin notificaciones", un panel de ONG sin proyectos), y si
// una acción fallaba (aceptar un patrocinio, retirar una propuesta, marcar como leídas) no pasaba nada.
// Ahora: el error se ve, con "Reintentar" en las cargas.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';

const navigateSpy = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useParams: () => ({ projectId: 'proj-1' }), useNavigate: () => navigateSpy };
});

vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Test', email: 't@example.com', role: 'ngo' }, logout: vi.fn() }),
}));

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      ngos: { ...actual.api.ngos, me: vi.fn(), patrocinios: { list: vi.fn(), decide: vi.fn() } },
      projects: { ...actual.api.projects, get: vi.fn(), list: vi.fn(), kpis: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } },
      notifications: { ...actual.api.notifications, list: vi.fn(), markAllRead: vi.fn() },
      empresas: { ...actual.api.empresas, me: vi.fn(), patrocinios: { list: vi.fn(), propose: vi.fn(), withdraw: vi.fn() } },
    },
  };
});

import { api, ApiError } from '../../lib/api';
import { NGOPatrocinios } from './NGOPatrocinios';
import { NGODashboard } from './NGODashboard';
import { NGOKPIs } from './NGOKPIs';
import { NotificationsScreen } from './NotificationsScreen';
import { CompanyOwnProfile } from './CompanyOwnProfile';

const mount = (el: ReactElement) => render(<MemoryRouter>{el}</MemoryRouter>);
const fail500 = () => Promise.reject(new ApiError('Error al obtener los datos', 500));

beforeEach(() => {
  navigateSpy.mockReset();
  vi.mocked(api.projects.get).mockResolvedValue({ project: { title: 'Reforestación Urbana' } } as never);
});
afterEach(() => { vi.restoreAllMocks(); });

describe('NGOPatrocinios', () => {
  const pendiente = {
    empresa_id: 'emp-1', project_id: 'proj-1', estado: 'propuesto', mensaje: '', aporte: 0,
    created_at: '', updated_at: '', project_title: 'Reforestación Urbana', empresa_name: 'TechCorp',
  };

  test('si la lista no carga: error con "Reintentar", no el estado vacío', async () => {
    vi.mocked(api.ngos.patrocinios.list).mockReset()
      .mockImplementationOnce(fail500 as never)
      .mockResolvedValueOnce({ patrocinios: [pendiente] } as never);
    mount(<NGOPatrocinios />);
    await waitFor(() => expect(screen.getByText('Error al obtener los datos')).toBeInTheDocument());
    expect(screen.queryByText(/Todavía no recibiste propuestas/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    await waitFor(() => expect(screen.getByText('TechCorp')).toBeInTheDocument());
  });

  test('si aceptar falla, se muestra el error', async () => {
    vi.mocked(api.ngos.patrocinios.list).mockReset().mockResolvedValue({ patrocinios: [pendiente] } as never);
    vi.mocked(api.ngos.patrocinios.decide).mockReset().mockRejectedValue(new ApiError('Esta propuesta ya fue decidida', 409));
    mount(<NGOPatrocinios />);
    await waitFor(() => expect(screen.getByText('TechCorp')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Aceptar'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Esta propuesta ya fue decidida'));
  });
});

describe('NGODashboard', () => {
  test('si el panel no carga: error con "Reintentar", no un panel vacío', async () => {
    vi.mocked(api.ngos.me).mockReset().mockImplementation(fail500 as never);
    mount(<NGODashboard />);
    await waitFor(() => expect(screen.getByText('Error al obtener los datos')).toBeInTheDocument());
    const calls = vi.mocked(api.ngos.me).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    await waitFor(() => expect(vi.mocked(api.ngos.me).mock.calls.length).toBeGreaterThan(calls));
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  test('con 401 (sesión vencida) vuelve al inicio', async () => {
    vi.mocked(api.ngos.me).mockReset().mockRejectedValue(new ApiError('Token inválido o expirado', 401));
    mount(<NGODashboard />);
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/'));
  });
});

describe('NGOKPIs', () => {
  test('si los KPIs no cargan: error con "Reintentar", no "Sin KPIs todavía"', async () => {
    vi.mocked(api.projects.kpis.list).mockReset().mockImplementation(fail500 as never);
    mount(<NGOKPIs />);
    await waitFor(() => expect(screen.getByText('Error al obtener los datos')).toBeInTheDocument());
    expect(screen.queryByText('Sin KPIs todavía')).not.toBeInTheDocument();
    const calls = vi.mocked(api.projects.kpis.list).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    await waitFor(() => expect(vi.mocked(api.projects.kpis.list).mock.calls.length).toBeGreaterThan(calls));
  });
});

describe('NotificationsScreen', () => {
  const unreadNotif = { id: 'n1', user_id: 'u1', type: 'enrollment_approved', title: 'Te aprobaron', body: '', read: false, created_at: '2026-10-01 12:00:00' };

  test('si no cargan: error con "Reintentar", no "Sin notificaciones"', async () => {
    vi.mocked(api.notifications.list).mockReset().mockImplementation(fail500 as never);
    mount(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText('Error al obtener los datos')).toBeInTheDocument());
    expect(screen.queryByText('Sin notificaciones')).not.toBeInTheDocument();
    const calls = vi.mocked(api.notifications.list).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    await waitFor(() => expect(vi.mocked(api.notifications.list).mock.calls.length).toBeGreaterThan(calls));
  });

  test('si "marcar todas como leídas" falla, se muestra el error', async () => {
    vi.mocked(api.notifications.list).mockReset().mockResolvedValue({ notifications: [unreadNotif] } as never);
    vi.mocked(api.notifications.markAllRead).mockReset().mockRejectedValue(new TypeError('Failed to fetch'));
    mount(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText('Te aprobaron')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /leídas/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/No pudimos marcar/));
  });
});

describe('CompanyOwnProfile: sección de patrocinios', () => {
  const empresa = { id: 'emp-1', user_id: 'u1', name: 'TechCorp', industry: '', description: '', mission: '', location: '', followers: 0 };
  const propuesta = {
    empresa_id: 'emp-1', project_id: 'proj-9', estado: 'propuesto', aporte: 0, created_at: '', updated_at: '',
    project_title: 'Banco de Alimentos', ngo_name: 'Sustentando',
  };
  beforeEach(() => {
    vi.mocked(api.empresas.me).mockReset().mockResolvedValue({ empresa } as never);
    vi.mocked(api.projects.list).mockReset().mockResolvedValue({ projects: [] } as never);
  });

  test('si los patrocinios no cargan: error con "Reintentar", no "Todavía no hay patrocinios"', async () => {
    vi.mocked(api.empresas.patrocinios.list).mockReset()
      .mockImplementationOnce(fail500 as never)
      .mockResolvedValueOnce({ patrocinios: [propuesta] } as never);
    mount(<CompanyOwnProfile />);
    await waitFor(() => expect(screen.getByText('Error al obtener los datos')).toBeInTheDocument());
    expect(screen.queryByText('Todavía no hay patrocinios')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    await waitFor(() => expect(screen.getByText('Banco de Alimentos')).toBeInTheDocument());
  });

  test('si retirar una propuesta falla, se muestra el error', async () => {
    vi.mocked(api.empresas.patrocinios.list).mockReset().mockResolvedValue({ patrocinios: [propuesta] } as never);
    vi.mocked(api.empresas.patrocinios.withdraw).mockReset().mockRejectedValue(new ApiError('Ya fue aceptada', 409));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount(<CompanyOwnProfile />);
    await waitFor(() => expect(screen.getByText('Banco de Alimentos')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Retirar propuesta'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Ya fue aceptada'));
  });
});
