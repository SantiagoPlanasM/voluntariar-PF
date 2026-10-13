// src/app/components/CompanyDashboard.test.tsx
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { CompanyDashboard } from './CompanyDashboard';
import type { CompanyDashboard as CompanyDashboardData, CompanyDashboardProject } from '../../lib/api';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      empresas: { ...actual.api.empresas, dashboard: vi.fn() },
    },
  };
});

import { api } from '../../lib/api';

const project = (over: Partial<CompanyDashboardProject> = {}): CompanyDashboardProject => ({
  project_id: 'proj-1', title: 'Reforestación Urbana', image: null, project_status: 'active',
  volunteers_needed: 50, current_volunteers: 23,
  ngo_id: 'ngo-1', ngo_name: 'Sustentando', ngo_logo: null,
  sponsorship_status: 'aceptado', decided_at: '2026-09-01 10:00:00',
  hours_logged: 10, volunteers_count: 1,
  ...over,
});

const dashboard = (over: Partial<CompanyDashboardData> = {}): CompanyDashboardData => ({
  stats:  { sponsored_projects: 2, pending_proposals: 1, rejected_proposals: 0 },
  impact: { total_hours: 15, volunteers_reached: 1 },
  projects: [project()],
  ...over,
});

const renderIt = () => render(<MemoryRouter><CompanyDashboard /></MemoryRouter>);

describe('<CompanyDashboard />', () => {
  beforeEach(() => vi.mocked(api.empresas.dashboard).mockReset());

  test('muestra los 4 KPIs con los valores del backend', async () => {
    vi.mocked(api.empresas.dashboard).mockResolvedValue(dashboard());
    renderIt();

    await waitFor(() => expect(screen.getByText('Panel de impacto')).toBeInTheDocument());
    const kpi = (label: string) => screen.getByText(label).parentElement as HTMLElement;

    expect(within(kpi('Proyectos patrocinados')).getByText('2')).toBeInTheDocument();
    expect(within(kpi('Propuestas pendientes')).getByText('1')).toBeInTheDocument();
    expect(within(kpi('Horas de voluntariado')).getByText('15')).toBeInTheDocument();
    expect(within(kpi('Voluntarios alcanzados')).getByText('1')).toBeInTheDocument();
  });

  test('proyecto aceptado: muestra horas, voluntarios y cupos, y enlaza al detalle', async () => {
    vi.mocked(api.empresas.dashboard).mockResolvedValue(dashboard());
    renderIt();

    const row = (await screen.findByText('Reforestación Urbana')).closest('a') as HTMLAnchorElement;
    expect(row).toHaveAttribute('href', '/project/proj-1');
    expect(within(row).getByText('Aceptado')).toBeInTheDocument();
    expect(within(row).getByText(/10 h verificadas · 1 voluntario · 23\/50 cupos/)).toBeInTheDocument();
    expect(within(row).getByText('Sustentando')).toBeInTheDocument();
  });

  test('proyecto pendiente: sin horas (no aplican todavía) y con aviso de espera', async () => {
    vi.mocked(api.empresas.dashboard).mockResolvedValue(dashboard({
      projects: [project({ sponsorship_status: 'propuesto', hours_logged: 99, volunteers_count: 9 })],
    }));
    renderIt();

    const row = (await screen.findByText('Reforestación Urbana')).closest('a') as HTMLAnchorElement;
    expect(within(row).getByText('Pendiente')).toBeInTheDocument();
    expect(within(row).getByText('Esperando respuesta de la ONG')).toBeInTheDocument();
    expect(within(row).queryByText(/h verificadas/)).not.toBeInTheDocument();
  });

  test('proyecto rechazado: solo el badge, sin horas ni aviso de espera', async () => {
    vi.mocked(api.empresas.dashboard).mockResolvedValue(dashboard({
      projects: [project({ sponsorship_status: 'rechazado', hours_logged: 99 })],
    }));
    renderIt();

    const row = (await screen.findByText('Reforestación Urbana')).closest('a') as HTMLAnchorElement;
    expect(within(row).getByText('Rechazado')).toBeInTheDocument();
    expect(within(row).queryByText(/h verificadas/)).not.toBeInTheDocument();
    expect(within(row).queryByText(/Esperando respuesta/)).not.toBeInTheDocument();
  });

  test('horas decimales con coma, plural de voluntarios y contador de rechazadas', async () => {
    vi.mocked(api.empresas.dashboard).mockResolvedValue(dashboard({
      stats:  { sponsored_projects: 1, pending_proposals: 0, rejected_proposals: 2 },
      impact: { total_hours: 7.5, volunteers_reached: 3 },
      projects: [project({ hours_logged: 7.5, volunteers_count: 3 })],
    }));
    renderIt();

    await screen.findByText('Reforestación Urbana');
    expect(screen.getByText(/7,5 h verificadas · 3 voluntarios/)).toBeInTheDocument();
    expect(screen.getByText('2 rechazadas')).toBeInTheDocument();
  });

  test('una sola rechazada va en singular, y sin rechazadas no aparece el contador', async () => {
    vi.mocked(api.empresas.dashboard).mockResolvedValue(dashboard({
      stats: { sponsored_projects: 0, pending_proposals: 0, rejected_proposals: 1 },
    }));
    const { unmount } = renderIt();
    expect(await screen.findByText('1 rechazada')).toBeInTheDocument();
    unmount();

    vi.mocked(api.empresas.dashboard).mockResolvedValue(dashboard());
    renderIt();
    await screen.findByText('Panel de impacto');
    expect(screen.queryByText(/rechazada/)).not.toBeInTheDocument();
  });

  test('proyecto no activo muestra su etiqueta; uno activo no', async () => {
    vi.mocked(api.empresas.dashboard).mockResolvedValue(dashboard({
      projects: [
        project({ project_id: 'a', title: 'Proyecto A', project_status: 'completed' }),
        project({ project_id: 'b', title: 'Proyecto B', project_status: 'active' }),
      ],
    }));
    renderIt();

    const rowA = (await screen.findByText('Proyecto A')).closest('a') as HTMLElement;
    const rowB = screen.getByText('Proyecto B').closest('a') as HTMLElement;
    expect(within(rowA).getByText('Finalizado')).toBeInTheDocument();
    expect(within(rowB).queryByText('Finalizado')).not.toBeInTheDocument();
    expect(within(rowB).queryByText('Activo')).not.toBeInTheDocument();
  });

  test('sin patrocinios: estado vacío con accesos a explorar y al perfil', async () => {
    vi.mocked(api.empresas.dashboard).mockResolvedValue(dashboard({
      stats:  { sponsored_projects: 0, pending_proposals: 0, rejected_proposals: 0 },
      impact: { total_hours: 0, volunteers_reached: 0 },
      projects: [],
    }));
    renderIt();

    expect(await screen.findByText('Todavía no tenés patrocinios.')).toBeInTheDocument();
    expect(screen.getByText('Explorar proyectos').closest('a')).toHaveAttribute('href', '/explore');
    expect(screen.getByText('Ir a mi empresa').closest('a')).toHaveAttribute('href', '/company/profile');
  });

  test('si la API falla muestra el error y "Reintentar" vuelve a pedir los datos', async () => {
    vi.mocked(api.empresas.dashboard)
      .mockRejectedValueOnce(new Error('Error al obtener el panel de la empresa'))
      .mockResolvedValueOnce(dashboard());
    renderIt();

    expect(await screen.findByText('Error al obtener el panel de la empresa')).toBeInTheDocument();
    expect(screen.queryByText('Panel de impacto')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Reintentar'));
    expect(await screen.findByText('Panel de impacto')).toBeInTheDocument();
    expect(api.empresas.dashboard).toHaveBeenCalledTimes(2);
  });
});
