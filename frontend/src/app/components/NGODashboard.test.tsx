// src/app/components/NGODashboard.test.tsx
//
// REVISION F14: GET /ngos/me manda `project_title` en cada solicitud pendiente, pero el tipo no lo declaraba y
// la pantalla no lo mostraba: con varios proyectos, la ONG no sabía a qué voluntariado se anotó cada persona.
// Y si la misma persona se anotaba en dos, sus dos filas (y sus botones aprobar/rechazar) eran idénticas.
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'ONG', role: 'ngo' }, logout: vi.fn() }) }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  const pending = (id: string, project_id: string, project_title: string) => ({
    id, user_id: 'u-juan', project_id, project_title, status: 'pending', created_at: '2026-10-14 12:00:00',
    volunteer_name: 'Juan Pérez', volunteer_email: 'juan@example.com',
  });
  return {
    ...actual,
    api: {
      ...actual.api,
      ngos: {
        ...actual.api.ngos,
        me: vi.fn().mockResolvedValue({
          ngo: { id: 'ngo-1', name: 'Sustentando', followers: 0 }, projects: [],
          stats: { total_projects: 2, active_projects: 2, completed_projects: 0, total_volunteers: 0, total_funding: 0, pending_enrollments: 2 },
          pending_enrollments: [pending('e1', 'proj-1', 'Reforestación Urbana'), pending('e2', 'proj-2', 'Huerta Comunitaria')],
        }),
      },
    },
  };
});

import { api } from '../../lib/api';
import { NGODashboard } from './NGODashboard';

// §128: en el celular el encabezado (Equipo, Momentos, Nuevo) no entraba y la pantalla tenía scroll horizontal.
// jsdom no aplica Tailwind: se comprueban las clases que lo resuelven y que los botones sin texto visible
// conserven su nombre accesible.
// Rediseño (§240): Equipo y Momentos salieron del encabezado (están en la navegación); quedan Notificaciones (solo
// en el celular) y "Crear voluntariado" ("Crear" en el celular).
describe('NGODashboard: encabezado en el celular', () => {
  test('Crear: el texto largo solo desde sm y el corto solo en el celular', async () => {
    render(<MemoryRouter><NGODashboard /></MemoryRouter>);
    // El del encabezado es el único con el texto corto "Crear" (el estado vacío tiene otro link a /ngo/create).
    const crear = (await screen.findByText('Crear')).closest('a')!;
    expect(crear).toHaveAttribute('href', '/ngo/create');
    expect(within(crear).getByText('Crear voluntariado').className).toContain('hidden sm:inline');
    expect(within(crear).getByText('Crear').className).toContain('sm:hidden');
    const campana = screen.getByRole('link', { name: 'Notificaciones' });
    expect(campana).toHaveAttribute('href', '/ngo/notifications');
    expect(campana.className).toContain('md:hidden');
  });

  test('el nombre de la ONG se trunca y los botones no se achican', async () => {
    render(<MemoryRouter><NGODashboard /></MemoryRouter>);
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Sustentando' });
    expect(h1.className).toContain('truncate');
    expect(h1.parentElement!.className).toContain('min-w-0');
    expect(h1.parentElement!.parentElement!.className).toContain('min-w-0');
    expect(screen.getByRole('link', { name: 'Notificaciones' }).parentElement!.className).toContain('flex-shrink-0');
  });
});

// En el celular Patrocinios, Publicaciones y Equipo no están en la barra: el Panel tiene sus accesos.
describe('NGODashboard: accesos', () => {
  test('Patrocinios, Publicaciones y Equipo', async () => {
    vi.spyOn(api.team, 'members').mockResolvedValue({ members: [] });
    render(<MemoryRouter><NGODashboard /></MemoryRouter>);
    const nav = await screen.findByRole('navigation', { name: 'Accesos del panel' });
    expect(within(nav).getByRole('link', { name: /Patrocinios/ })).toHaveAttribute('href', '/ngo/patrocinios');
    expect(within(nav).getByRole('link', { name: /Publicaciones/ })).toHaveAttribute('href', '/ngo/momentos');
    expect(within(nav).getByRole('link', { name: /Equipo/ })).toHaveAttribute('href', '/ngo/equipo');
  });
});

describe('NGODashboard: solicitudes pendientes', () => {
  test('cada solicitud muestra a qué voluntariado es', async () => {
    render(<MemoryRouter><NGODashboard /></MemoryRouter>);
    const heading = await screen.findByRole('heading', { name: /Postulaciones sin responder/ });
    expect(heading).toHaveTextContent('Postulaciones sin responder (2)');
    const box = heading.closest('section')!;
    expect(within(box).getByText('Reforestación Urbana')).toBeInTheDocument();
    expect(within(box).getByText('Huerta Comunitaria')).toBeInTheDocument();
  });

  test('la misma persona en dos proyectos: los botones dicen cuál aprueban o rechazan', async () => {
    render(<MemoryRouter><NGODashboard /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Aprobar a Juan Pérez en Reforestación Urbana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar a Juan Pérez en Reforestación Urbana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprobar a Juan Pérez en Huerta Comunitaria' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar a Juan Pérez en Huerta Comunitaria' })).toBeInTheDocument();
  });
});

// §256: la ONG puede finalizar o cancelar un voluntariado. Antes cualquier estado que no fuera activo decía "Completado".
describe('NGODashboard: el estado de cada voluntariado', () => {
  test('finalizado y cancelado se distinguen; el activo no lleva etiqueta', async () => {
    const proj = (id: string, title: string, status: string) =>
      ({ id, title, status, category: 'Salud', type: 'fugaz', volunteers_needed: 10, current_volunteers: 0, funding_goal: 0, current_funding: 0 });
    vi.mocked(api.ngos.me).mockResolvedValueOnce({
      ngo: { id: 'ngo-1', name: 'Sustentando', followers: 0 },
      projects: [proj('a', 'Huerta en marcha', 'active'), proj('b', 'Jornada que ya pasó', 'completed'), proj('c', 'Jornada suspendida', 'cancelled')],
      stats: { total_projects: 3, active_projects: 1, completed_projects: 1, total_volunteers: 0, total_funding: 0, pending_enrollments: 0 },
      pending_enrollments: [],
    } as never);
    render(<MemoryRouter><NGODashboard /></MemoryRouter>);
    const row = async (title: string) => (await screen.findByText(title)).closest('a') as HTMLElement;
    expect((await row('Jornada que ya pasó')).textContent).toContain('· Finalizado');
    expect((await row('Jornada suspendida')).textContent).toContain('· Cancelado');
    expect((await row('Huerta en marcha')).textContent).not.toMatch(/Finalizado|Cancelado|Completado/);
    expect(screen.queryByText(/Completado/)).not.toBeInTheDocument();
  });
});
