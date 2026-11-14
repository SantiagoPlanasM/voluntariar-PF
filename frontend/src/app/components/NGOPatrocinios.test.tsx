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
    expect(aceptado.className).toContain('bg-people-soft text-people-text');
    expect(screen.getByText('Rechazado').className).toContain('bg-surface-soft text-ink-soft');
  });
});

// T7 de la revisión contra DESIGN.md (§339): la pantalla con las reglas de los paneles y los componentes comunes.
describe('<NGOPatrocinios />: la forma del panel', () => {
  beforeEach(() => {
    vi.mocked(api.ngos.patrocinios.list).mockReset();
    vi.mocked(api.ngos.patrocinios.decide).mockReset();
  });

  test('mientras carga muestra un esqueleto con nombre, no un spinner', async () => {
    vi.mocked(api.ngos.patrocinios.list).mockReturnValue(new Promise(() => {}));
    const { container } = render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);
    expect(screen.getByRole('status', { name: 'Cargando propuestas' })).toBeInTheDocument();
    expect(container.querySelector('.skeleton')).not.toBeNull();
    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  test('la empresa sin logo va con sus iniciales en el avatar cuadrado; con logo, la imagen', async () => {
    vi.mocked(api.ngos.patrocinios.list).mockResolvedValue({ patrocinios: [
      pendiente,
      { ...pendiente, project_id: 'proj-2', empresa_name: 'Banco Sur', empresa_logo: 'https://res.cloudinary.com/x/logo.png' },
      { ...pendiente, project_id: 'proj-3', estado: 'rechazado', empresa_name: 'Molinos Río' },
    ] });
    const { container } = render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);
    await screen.findByText('TechCorp');
    const initials = [...container.querySelectorAll<HTMLElement>('[data-initial]')];
    // Pendiente sin logo y la del historial sin logo (antes: un cuadrado gris vacío).
    expect(initials.map(el => el.textContent)).toEqual(['TE', 'MR']);
    expect(initials.every(el => el.style.borderRadius === '28%')).toBe(true);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://res.cloudinary.com/x/logo.png');
    expect(img!.style.borderRadius).toBe('28%');
  });

  test('después de decidir, la lista sigue a la vista mientras se vuelve a pedir (sin esqueleto)', async () => {
    vi.mocked(api.ngos.patrocinios.list)
      .mockResolvedValueOnce({ patrocinios: [pendiente] })
      .mockReturnValueOnce(new Promise(() => {}));
    vi.mocked(api.ngos.patrocinios.decide).mockResolvedValue({ message: 'Propuesta rechazada' });
    render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    await waitFor(() => expect(api.ngos.patrocinios.list).toHaveBeenCalledTimes(2));
    expect(screen.getByText('TechCorp')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('mientras se guarda una decisión, los dos botones de esa propuesta quedan deshabilitados y "Aceptar" lo dice', async () => {
    vi.mocked(api.ngos.patrocinios.list).mockResolvedValue({ patrocinios: [pendiente, { ...pendiente, project_id: 'proj-2', project_title: 'Huerta' }] });
    vi.mocked(api.ngos.patrocinios.decide).mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);
    const aceptar = await screen.findAllByRole('button', { name: 'Aceptar' });
    fireEvent.click(aceptar[0]);
    const guardando = await screen.findByRole('button', { name: 'Guardando…' });
    expect(guardando).toBeDisabled();
    const rechazar = screen.getAllByRole('button', { name: 'Rechazar' });
    expect(rechazar[0]).toBeDisabled();
    // La otra propuesta no se toca.
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeEnabled();
    expect(rechazar[1]).toBeEnabled();
  });

  test('si la decisión no se guarda: avisa, no vuelve a pedir la lista y los botones quedan otra vez activos', async () => {
    vi.mocked(api.ngos.patrocinios.list).mockResolvedValue({ patrocinios: [pendiente] });
    vi.mocked(api.ngos.patrocinios.decide).mockRejectedValue(new TypeError('Failed to fetch'));
    render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar tu decisión');
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeEnabled();
    expect(api.ngos.patrocinios.list).toHaveBeenCalledTimes(1);
  });

  test('después de decidir y recargar, las que siguen pendientes vuelven a tener los botones activos', async () => {
    vi.mocked(api.ngos.patrocinios.list).mockResolvedValue({ patrocinios: [pendiente] });
    vi.mocked(api.ngos.patrocinios.decide).mockResolvedValue({ message: 'Aceptaste esta versión del acuerdo; falta que la empresa la acepte' });
    render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar' }));
    await waitFor(() => expect(api.ngos.patrocinios.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aceptar' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeEnabled();
  });

  test('"Reintentar" después de un error de carga: se va el error y vuelve el esqueleto', async () => {
    vi.mocked(api.ngos.patrocinios.list)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockReturnValueOnce(new Promise(() => {}));
    render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar las propuestas');
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByRole('status', { name: 'Cargando propuestas' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('si falla la recarga después de decidir, avisa y deja la lista como estaba', async () => {
    vi.mocked(api.ngos.patrocinios.list)
      .mockResolvedValueOnce({ patrocinios: [pendiente] })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.mocked(api.ngos.patrocinios.decide).mockResolvedValue({ message: 'Propuesta aceptada' });
    render(<MemoryRouter><NGOPatrocinios /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu decisión se guardó, pero no pudimos actualizar la lista');
    expect(screen.getByText('TechCorp')).toBeInTheDocument();
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
