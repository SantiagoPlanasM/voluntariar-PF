// src/app/components/PublicFeedStats.test.tsx
//
// §129: los números de la portada estaban fijos ("24 proyectos activos", "2.4k voluntarios", "12 ONGs aliadas")
// y en producción, con la base vacía, mentían. Ahora vienen de GET /api/stats. Si todo da 0 (deploy nuevo) o el
// pedido falla, la fila no se muestra: ni números falsos, ni ceros, ni un error en la portada.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: null, initializing: false, openAuthModal: vi.fn() }) }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      stats: vi.fn(),
      projects: { ...actual.api.projects, list: vi.fn().mockResolvedValue({ projects: [] }) },
    },
  };
});

import { api } from '../../lib/api';
import { PublicFeed } from './PublicFeed';
import { compactNumber } from '../../lib/format';

const stats = vi.mocked(api.stats);
const mount = () => render(<MemoryRouter><PublicFeed /></MemoryRouter>);
const statsRow = () => screen.queryByRole('list', { name: 'VoluntariAR en números' });

// Con llaves: mockReset() devuelve el propio mock, y una función devuelta por beforeEach vitest la toma como
// limpieza y la EJECUTA después de cada test (llamaba a stats() sin catch y el rechazo caía en otro test; §129).
beforeEach(() => { stats.mockReset(); });

describe('portada: números reales', () => {
  test('muestra lo que devuelve la API (no los números fijos de antes)', async () => {
    stats.mockResolvedValue({ active_projects: 7, volunteers: 2400, ngos: 3 });
    mount();
    await waitFor(() => expect(statsRow()).not.toBeNull());
    const row = statsRow()!;
    expect(row).toHaveTextContent('7proyectos activos');
    expect(row).toHaveTextContent('2,4kvoluntarios');
    expect(row).toHaveTextContent('3ONGs aliadas');
    expect(row).not.toHaveTextContent('24');
    expect(stats).toHaveBeenCalledTimes(1);
  });

  test('singular cuando hay uno', async () => {
    stats.mockResolvedValue({ active_projects: 1, volunteers: 1, ngos: 1 });
    mount();
    await waitFor(() => expect(statsRow()).not.toBeNull());
    expect(statsRow()).toHaveTextContent('1proyecto activo1voluntario1ONG aliada');
  });

  test('base vacía (todo en 0): no se muestra la fila', async () => {
    stats.mockResolvedValue({ active_projects: 0, volunteers: 0, ngos: 0 });
    mount();
    await waitFor(() => expect(stats).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(statsRow()).toBeNull();
    expect(screen.queryByText('2.4k')).toBeNull();
  });

  test('si el pedido falla, tampoco (ni error en la portada)', async () => {
    // Como un fetch real: rechaza después, no al crear la promesa.
    stats.mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new TypeError('Failed to fetch')), 0)));
    mount();
    await waitFor(() => expect(stats).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(statsRow()).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('compactNumber', () => {
  test('hasta 999 tal cual; desde 1000, en miles con una coma decimal y sin ",0"', () => {
    expect(compactNumber(0)).toBe('0');
    expect(compactNumber(999)).toBe('999');
    expect(compactNumber(1000)).toBe('1k');
    expect(compactNumber(2400)).toBe('2,4k');
    expect(compactNumber(2449)).toBe('2,4k');
    expect(compactNumber(12500)).toBe('12,5k');
  });
});
