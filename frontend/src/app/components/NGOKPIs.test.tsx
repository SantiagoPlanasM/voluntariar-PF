// src/app/components/NGOKPIs.test.tsx
//
// La fecha de un KPI ("YYYY-MM-DD", columna TEXT) se mostraba un día antes en Córdoba: `new Date(fecha)`
// la interpretaba como medianoche UTC (REVISION.md F2). El componente tiene que usar formatDateOnly.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { KPI } from '../../lib/api';

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useParams: () => ({ projectId: 'proj-1' }), useNavigate: () => vi.fn() };
});

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      projects: {
        ...actual.api.projects,
        get: vi.fn(),
        kpis: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      },
    },
  };
});

import { api } from '../../lib/api';
import { NGOKPIs } from './NGOKPIs';

const kpi = {
  id: 'k1', project_id: 'proj-1', nombre: 'Árboles plantados', descripcion: null, valor: 120,
  tipo_valor: 'numero', unidad: 'árboles', fecha: '2026-10-01', created_at: '2026-10-01 12:00:00',
} as unknown as KPI;

describe('<NGOKPIs />: fecha del KPI', () => {
  let prevTZ: string | undefined;
  beforeEach(() => {
    prevTZ = process.env.TZ;
    process.env.TZ = 'America/Argentina/Cordoba';
    vi.mocked(api.projects.get).mockResolvedValue({ project: { title: 'Reforestación Urbana' } } as never);
    vi.mocked(api.projects.kpis.list).mockResolvedValue({ kpis: [kpi] });
  });
  afterEach(() => { if (prevTZ === undefined) delete process.env.TZ; else process.env.TZ = prevTZ; });

  test('"2026-10-01" se muestra como el 1 de octubre, no como el 30 de septiembre', async () => {
    render(<NGOKPIs />);
    await waitFor(() => expect(screen.getAllByText('Árboles plantados').length).toBeGreaterThan(0));
    const expected = new Date(2026, 9, 1).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(/^30 sept/)).not.toBeInTheDocument();
  });
});
