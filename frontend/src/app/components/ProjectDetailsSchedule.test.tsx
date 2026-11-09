// src/app/components/ProjectDetailsSchedule.test.tsx — el "Cuándo" del voluntariado en su detalle (§315): la fecha y,
// si tiene, el link de Google Calendar y el .ics. Sin fecha, no aparece nada.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: null, openAuthModal: vi.fn() }) }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      projects: { ...actual.api.projects, get: vi.fn() },
      follows: { ...actual.api.follows, projectStatus: vi.fn().mockResolvedValue({ following: false }) },
      posts: { ...actual.api.posts, list: vi.fn().mockResolvedValue({ posts: [] }) },
    },
  };
});
import { api } from '../../lib/api';
import { formatDateOnly } from '../../lib/format';
import { ProjectDetails } from './ProjectDetails';

const project = (extra: Record<string, unknown> = {}) => ({
  project: {
    id: 'proj-1', ngo_id: 'ngo-1', ngo_name: 'ONG Verde', title: 'Reforestación', location: 'Costanera', status: 'active', type: 'fugaz',
    comments: [], kpis: [], ratings: [], avg_rating: 0, my_enrollment: null, funding_goal: 0, current_funding: 0,
    volunteers_needed: 10, current_volunteers: 2, ...extra,
  },
});
const mount = () => render(
  <MemoryRouter initialEntries={['/project/proj-1']}><Routes><Route path="/project/:id" element={<ProjectDetails />} /></Routes></MemoryRouter>);
const cargado = () => screen.findByRole('heading', { name: 'Cómo vamos' });

beforeEach(() => { vi.mocked(api.projects.get).mockReset(); });

describe('ProjectDetails: cuándo es (§315)', () => {
  test('con fecha y horas: la muestra, con Google Calendar y el .ics del voluntariado', async () => {
    vi.mocked(api.projects.get).mockResolvedValue(project({ start_date: '2026-12-05', start_time: '09:00', end_time: '13:00' }) as never);
    mount();
    await cargado();
    expect(screen.getByText(`${formatDateOnly('2026-12-05')}, de 09:00 a 13:00 h`)).toBeInTheDocument();
    const google = new URL(screen.getByRole('link', { name: 'Agregar a Google Calendar' }).getAttribute('href')!);
    expect(google.searchParams.get('dates')).toBe('20261205T120000Z/20261205T160000Z');
    expect(google.searchParams.get('text')).toBe('Voluntariado: Reforestación (ONG Verde)');
    expect(google.searchParams.get('details')).toContain('/project/proj-1');
    const ics = screen.getByRole('link', { name: 'Descargar .ics' });
    expect(ics).toHaveAttribute('download', 'voluntariado.ics');
    expect(decodeURIComponent(ics.getAttribute('href')!)).toContain('UID:voluntariado-proj-1@voluntariar');
  });

  test('sin fecha: no hay "Cuándo" ni links de calendario', async () => {
    vi.mocked(api.projects.get).mockResolvedValue(project() as never);
    mount();
    await cargado();
    expect(screen.queryByRole('link', { name: 'Agregar a Google Calendar' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Descargar .ics' })).toBeNull();
  });
});
