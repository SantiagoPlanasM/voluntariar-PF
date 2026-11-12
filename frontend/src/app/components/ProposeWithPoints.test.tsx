// src/app/components/ProposeWithPoints.test.tsx — patrocinio, paso 5: proponer con puntos (§329).
//
// Decisión del usuario (11/11): la empresa propone con puntos. En "Proponer" (CompanyOwnProfile) se arman los puntos
// antes de mandar, con el mismo formulario del acuerdo (SponsorshipPointForm), y viajan en el mismo pedido que la
// propuesta (`points`). Sin puntos, la propuesta sale como siempre (sin `points`).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Project } from '../../lib/api';

vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-comp', name: 'TechCorp', email: 'c@example.com', role: 'company' }, logout: vi.fn(), openAuthModal: vi.fn() }),
}));

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      empresas: { ...actual.api.empresas, me: vi.fn(), patrocinios: { list: vi.fn(), propose: vi.fn(), withdraw: vi.fn() } },
      projects: { ...actual.api.projects, list: vi.fn(), get: vi.fn() },
    },
  };
});

import { api, ApiError } from '../../lib/api';
import { CompanyOwnProfile } from './CompanyOwnProfile';

const empresa = { id: 'emp-1', user_id: 'u-comp', name: 'TechCorp', industry: '', description: '', mission: '', location: '', followers: 0 };
const projects = [1, 2, 3].map(n => ({ id: `proj-${n}`, title: `Proyecto ${n}`, status: 'active', ngo_id: 'ngo-1' }) as Project);

/** Abre "Proponer" con el proyecto 2 elegido. */
async function abrir() {
  render(<MemoryRouter initialEntries={['/company/profile?proponer=proj-2']}><CompanyOwnProfile /></MemoryRouter>);
  const select = (await screen.findByRole('combobox', { name: 'Proyecto a patrocinar' })) as HTMLSelectElement;
  await waitFor(() => expect(select.value).toBe('proj-2'));
}
/** Completa el formulario de un punto (ya abierto) y toca "Listo". */
function completar(type: string, detail: string, amount?: string) {
  fireEvent.change(screen.getByLabelText('Tipo de punto'), { target: { value: type } });
  fireEvent.change(screen.getByLabelText('Detalle del punto'), { target: { value: detail } });
  if (amount !== undefined) fireEvent.change(screen.getByLabelText('Monto en pesos'), { target: { value: amount } });
  fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
}
function agregar(type: string, detail: string, amount?: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Agregar punto' }));
  completar(type, detail, amount);
}
const lista = () => screen.getByRole('list', { name: 'Puntos de la propuesta' });
const enviar = () => fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));

describe('Proponer un patrocinio con puntos', () => {
  beforeEach(() => {
    vi.mocked(api.empresas.me).mockReset().mockResolvedValue({ empresa } as never);
    vi.mocked(api.empresas.patrocinios.list).mockReset().mockResolvedValue({ patrocinios: [] } as never);
    vi.mocked(api.empresas.patrocinios.propose).mockReset().mockResolvedValue({ message: 'ok' } as never);
    vi.mocked(api.projects.list).mockReset().mockResolvedValue({ projects } as never);
    vi.mocked(api.projects.get).mockReset();
  });

  test('los puntos armados viajan con la propuesta, en orden, con el monto solo en dinero', async () => {
    await abrir();
    expect(screen.queryByRole('list', { name: 'Puntos de la propuesta' })).not.toBeInTheDocument();
    agregar('money', '  Plantines ', '450000');
    agregar('supplies', 'Bolsas');
    fireEvent.change(screen.getByLabelText('Mensaje para la ONG'), { target: { value: 'Queremos sumar' } });

    const items = within(lista()).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Dinero');
    expect(items[0]).toHaveTextContent('Plantines');
    expect(items[0]).toHaveTextContent('$ 450.000');
    expect(items[1]).toHaveTextContent('Insumos');
    expect(items[1]).toHaveTextContent('Bolsas');

    enviar();
    await waitFor(() => expect(api.empresas.patrocinios.propose).toHaveBeenCalledWith('proj-2', 'Queremos sumar', [
      { type: 'money', detail: 'Plantines', amount: 450000 },
      { type: 'supplies', detail: 'Bolsas' },
    ]));
    // Después de mandar, la lista se pide de nuevo y el formulario se cierra con los puntos borrados.
    await waitFor(() => expect(api.empresas.patrocinios.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Enviar propuesta' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByText('Proponer'));
    expect(screen.queryByRole('list', { name: 'Puntos de la propuesta' })).not.toBeInTheDocument();
  });

  test('sin puntos, la propuesta sale como siempre (sin el tercer argumento)', async () => {
    await abrir();
    enviar();
    await waitFor(() => expect(api.empresas.patrocinios.propose).toHaveBeenCalledWith('proj-2', undefined));
  });

  test('editar y quitar un punto antes de mandar', async () => {
    await abrir();
    agregar('supplies', 'Bolsas');
    agregar('outreach', 'Redes');
    agregar('other', 'Sobra');

    fireEvent.click(screen.getByRole('button', { name: 'Editar punto: Bolsas' }));
    expect(screen.getByLabelText('Detalle del punto')).toHaveValue('Bolsas');
    expect(screen.getByLabelText('Tipo de punto')).toHaveValue('supplies');
    completar('money', 'Bolsas y guantes', '1000');
    // Al volver a editarlo, el formulario trae también el monto.
    fireEvent.click(screen.getByRole('button', { name: 'Editar punto: Bolsas y guantes' }));
    expect(screen.getByLabelText('Monto en pesos')).toHaveValue(1000);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Borrar punto: Sobra' }));

    const items = within(lista()).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Bolsas y guantes');
    expect(items[0]).toHaveTextContent('$ 1.000');

    enviar();
    await waitFor(() => expect(api.empresas.patrocinios.propose).toHaveBeenCalledWith('proj-2', undefined, [
      { type: 'money', detail: 'Bolsas y guantes', amount: 1000 },
      { type: 'outreach', detail: 'Redes' },
    ]));
  });

  test('quitar el único punto: vuelve a salir sin puntos', async () => {
    await abrir();
    agregar('supplies', 'Bolsas');
    fireEvent.click(screen.getByRole('button', { name: 'Borrar punto: Bolsas' }));
    expect(screen.queryByRole('list', { name: 'Puntos de la propuesta' })).not.toBeInTheDocument();
    enviar();
    await waitFor(() => expect(api.empresas.patrocinios.propose).toHaveBeenCalledWith('proj-2', undefined));
  });

  test('un punto sin detalle no se agrega y lo dice; "Cancelar" cierra el formulario sin agregar', async () => {
    await abrir();
    agregar('supplies', '   ');
    expect(screen.getByText('El detalle no puede estar vacío')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Puntos de la propuesta' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Detalle del punto')).toBeInTheDocument();
    // Corregido, entra y el error se va.
    completar('supplies', 'Bolsas');
    expect(screen.queryByText('El detalle no puede estar vacío')).not.toBeInTheDocument();
    expect(within(lista()).getAllByRole('listitem')).toHaveLength(1);

    agregar('supplies', '');
    expect(screen.getByText('El detalle no puede estar vacío')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Detalle del punto')).not.toBeInTheDocument();
    expect(screen.queryByText('El detalle no puede estar vacío')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar punto' })).toBeInTheDocument();
  });

  test('con un punto a medio escribir no se manda: pide terminarlo o cancelarlo', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar punto' }));
    // Un formulario a la vez, y arranca en "Insumos" (sin monto).
    expect(screen.queryByRole('button', { name: 'Agregar punto' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de punto')).toHaveValue('supplies');
    expect(screen.queryByLabelText('Monto en pesos')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Detalle del punto'), { target: { value: 'Bolsas' } });
    enviar();
    expect(await screen.findByText('Terminá o cancelá el punto que estás escribiendo antes de enviar.')).toBeInTheDocument();
    expect(api.empresas.patrocinios.propose).not.toHaveBeenCalled();
  });

  test('si el backend rechaza la propuesta, muestra su mensaje y los puntos siguen ahí', async () => {
    vi.mocked(api.empresas.patrocinios.propose).mockRejectedValue(new ApiError('Un punto de dinero necesita un monto mayor a 0', 400));
    await abrir();
    agregar('money', 'Plata', '');
    enviar();
    expect(await screen.findByText('Un punto de dinero necesita un monto mayor a 0')).toBeInTheDocument();
    expect(within(lista()).getAllByRole('listitem')).toHaveLength(1);
    // El error se va al seguir armando la propuesta: al agregar otro punto o al editar uno.
    fireEvent.click(screen.getByRole('button', { name: 'Agregar punto' }));
    expect(screen.queryByText('Un punto de dinero necesita un monto mayor a 0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    enviar();
    expect(await screen.findByText('Un punto de dinero necesita un monto mayor a 0')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar punto: Plata' }));
    expect(screen.queryByText('Un punto de dinero necesita un monto mayor a 0')).not.toBeInTheDocument();
  });

  test('con 20 puntos ya no se puede agregar otro, y lo dice', async () => {
    await abrir();
    // Por texto y no por rol: 20 altas con getByRole pasaban los 5 s con toda la suite corriendo.
    const rapido = (detail: string) => {
      fireEvent.click(screen.getByText('Agregar punto'));
      fireEvent.change(screen.getByLabelText('Detalle del punto'), { target: { value: detail } });
      fireEvent.click(screen.getByText('Listo'));
    };
    for (let i = 1; i <= 19; i++) rapido(`Punto ${i}`);
    expect(screen.getByRole('button', { name: 'Agregar punto' })).toBeInTheDocument();
    rapido('Punto 20');
    expect(screen.queryByRole('button', { name: 'Agregar punto' })).not.toBeInTheDocument();
    expect(screen.getByText('Llegaste al máximo de 20 puntos.')).toBeInTheDocument();
    // Editar sigue andando con 20.
    expect(screen.getByRole('button', { name: 'Editar punto: Punto 20' })).toBeInTheDocument();
  });

  // Al re-proponer, el backend conserva los puntos del acuerdo rechazado y suma los nuevos: la pantalla lo avisa.
  test('si ese proyecto tiene una propuesta rechazada, avisa que sus puntos se mantienen y lleva al acuerdo', async () => {
    const rechazado = { empresa_id: 'emp-1', project_id: 'proj-2', estado: 'rechazado', project_title: 'Proyecto 2', ngo_name: 'ONG' };
    vi.mocked(api.empresas.patrocinios.list).mockResolvedValue({ patrocinios: [rechazado] } as never);
    await abrir();
    const aviso = screen.getByText(/La ONG rechazó tu propuesta anterior/);
    expect(aviso).toHaveTextContent('Los puntos de ese acuerdo se mantienen: lo que agregues acá se suma.');
    expect(within(aviso).getByRole('link', { name: 'Ver el acuerdo anterior' })).toHaveAttribute('href', '/company/patrocinios/emp-1/proj-2');
    // Con otro proyecto elegido, el aviso no está.
    fireEvent.change(screen.getByRole('combobox', { name: 'Proyecto a patrocinar' }), { target: { value: 'proj-1' } });
    expect(screen.queryByText(/La ONG rechazó tu propuesta anterior/)).not.toBeInTheDocument();
  });

  test('sin propuesta rechazada no hay aviso', async () => {
    await abrir();
    expect(screen.queryByText(/La ONG rechazó tu propuesta anterior/)).not.toBeInTheDocument();
  });

  test('los botones de cada punto miden 44 px (tocables)', async () => {
    await abrir();
    agregar('supplies', 'Bolsas');
    for (const name of ['Editar punto: Bolsas', 'Borrar punto: Bolsas']) {
      expect(screen.getByRole('button', { name }).className).toMatch(/\bw-11\b.*\bh-11\b/);
    }
  });
});
