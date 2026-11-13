// src/app/components/NGOProjectDetailMoney.test.tsx — D37 (Issue #38, sesión exploratoria 2, §330).
//
// Lo recaudado salía con `toLocaleString()` sin idioma y el `$` pegado: en un Chrome en inglés se leía "$8,500".
// El resto de la app escribe "$ 8.500" (`formatMoney`, es-AR).
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, Project } from '../../lib/api';

vi.mock('./MomentsFeed', () => ({ MomentsFeed: () => null }));
import { NGOProjectDetail } from './NGOProjectDetail';

const project = {
  id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación', description: 'd', category: 'Medio Ambiente', location: 'Córdoba',
  type: 'fugaz', status: 'active', volunteers_needed: 10, current_volunteers: 1, funding_goal: 20000, current_funding: 8500, cost_per_person: 0,
} as Project;

const mount = () => render(
  <MemoryRouter initialEntries={['/ngo/dashboard/project/proj-1']}><Routes>
    <Route path="/ngo/dashboard/project/:projectId" element={<NGOProjectDetail />} />
  </Routes></MemoryRouter>);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api.projects, 'get').mockResolvedValue({ project } as never);
  vi.spyOn(api.enrollments, 'byProject').mockResolvedValue({ enrollments: [] });
});
afterEach(() => vi.restoreAllMocks());

describe('Detalle del voluntariado de la ONG: lo recaudado', () => {
  test('se escribe "$ 8.500", como en el resto de la app', async () => {
    mount();
    expect(await screen.findByText('$ 8.500')).toBeInTheDocument();
  });

  test('no depende del idioma del navegador', async () => {
    // Un navegador en inglés: `toLocaleString()` sin idioma devuelve "8,500".
    const original = Number.prototype.toLocaleString;
    vi.spyOn(Number.prototype, 'toLocaleString').mockImplementation(function (this: number, locales?: Intl.LocalesArgument, options?: Intl.NumberFormatOptions) {
      return original.call(this, locales ?? 'en-US', options);
    });
    mount();
    expect(await screen.findByText('$ 8.500')).toBeInTheDocument();
    expect(screen.queryByText(/8,500/)).not.toBeInTheDocument();
  });

  test('un monto que llega como texto (Postgres) también se formatea', async () => {
    vi.spyOn(api.projects, 'get').mockResolvedValue({ project: { ...project, current_funding: '8500' } } as never);
    mount();
    expect(await screen.findByText('$ 8.500')).toBeInTheDocument();
  });
});
