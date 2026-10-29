// src/app/components/NGOPatrocinios.test.tsx
import { MemoryRouter } from 'react-router';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { NGOPatrocinios } from './NGOPatrocinios';
import type { Patrocinio } from '../../lib/api';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      ngos: { ...actual.api.ngos, patrocinios: { list: vi.fn(), decide: vi.fn() } },
    },
  };
});

import { api } from '../../lib/api';

const pendiente: Patrocinio = {
  empresa_id: 'emp-1', project_id: 'proj-1', estado: 'propuesto', mensaje: 'Queremos sumarnos',
  aporte: 0, created_at: '', updated_at: '', project_title: 'Reforestación Urbana',
  empresa_name: 'TechCorp',
};

describe('<NGOPatrocinios />', () => {
  beforeEach(() => {
    vi.mocked(api.ngos.patrocinios.list).mockReset();
    vi.mocked(api.ngos.patrocinios.decide).mockReset();
  });

  test('muestra las propuestas pendientes con el mensaje de la empresa', async () => {
    vi.mocked(api.ngos.patrocinios.list).mockResolvedValue({ patrocinios: [pendiente] });
    render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('TechCorp')).toBeInTheDocument());
    expect(screen.getByText('Queremos sumarnos')).toBeInTheDocument();
    expect(screen.getByText(/Reforestación Urbana/)).toBeInTheDocument();
  });

  test('aceptar llama a decide con estado "aceptado" y refresca', async () => {
    vi.mocked(api.ngos.patrocinios.list)
      .mockResolvedValueOnce({ patrocinios: [pendiente] })
      .mockResolvedValueOnce({ patrocinios: [{ ...pendiente, estado: 'aceptado' }] });
    vi.mocked(api.ngos.patrocinios.decide).mockResolvedValue({ message: 'ok' });

    render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('TechCorp')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Aceptar'));
    await waitFor(() => expect(api.ngos.patrocinios.decide).toHaveBeenCalledWith('emp-1', 'proj-1', 'aceptado'));
    await waitFor(() => expect(api.ngos.patrocinios.list).toHaveBeenCalledTimes(2));
  });

  test('rechazar llama a decide con estado "rechazado"', async () => {
    vi.mocked(api.ngos.patrocinios.list).mockResolvedValue({ patrocinios: [pendiente] });
    vi.mocked(api.ngos.patrocinios.decide).mockResolvedValue({ message: 'ok' });

    render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('TechCorp')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Rechazar'));
    await waitFor(() => expect(api.ngos.patrocinios.decide).toHaveBeenCalledWith('emp-1', 'proj-1', 'rechazado'));
  });

  test('sin propuestas, muestra el estado vacío', async () => {
    vi.mocked(api.ngos.patrocinios.list).mockResolvedValue({ patrocinios: [] });
    render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Todavía no recibiste propuestas/)).toBeInTheDocument());
  });

  test('el historial muestra etiqueta y color de cada estado decidido (REVISION S7)', async () => {
    vi.mocked(api.ngos.patrocinios.list).mockResolvedValue({ patrocinios: [
      { ...pendiente, estado: 'aceptado', project_id: 'proj-a' },
      { ...pendiente, estado: 'rechazado', project_id: 'proj-r' },
    ] });
    render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);
    const aceptado = await screen.findByText('Aceptado');
    expect(aceptado.className).toContain('bg-emerald-50 text-emerald-700');
    expect(screen.getByText('Rechazado').className).toContain('bg-red-50 text-red-600');
  });
});

// §265: cada pendiente lleva a su acuerdo; si la ONG acepta y falta la empresa (cambiaron los puntos, §264), se avisa.
describe('<NGOPatrocinios />: el acuerdo', () => {
  beforeEach(() => {
    vi.mocked(api.ngos.patrocinios.list).mockReset().mockResolvedValue({ patrocinios: [pendiente] });
    vi.mocked(api.ngos.patrocinios.decide).mockReset();
  });

  test('"Ver acuerdo" lleva a la pantalla del acuerdo', async () => {
    render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Ver acuerdo: puntos y charla' })).toHaveAttribute('href', '/ngo/patrocinios/emp-1/proj-1');
  });

  test('aceptar sin la empresa al día: avisa que falta la empresa', async () => {
    vi.mocked(api.ngos.patrocinios.decide).mockResolvedValue({ message: 'Aceptaste esta versión del acuerdo; falta que la empresa la acepte' });
    render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Aceptar/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('falta que la empresa la acepte');
  });

  test('aceptar y cerrar: sin aviso extra', async () => {
    vi.mocked(api.ngos.patrocinios.decide).mockResolvedValue({ message: 'Propuesta aceptada' });
    render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Aceptar/ }));
    await waitFor(() => expect(api.ngos.patrocinios.decide).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
