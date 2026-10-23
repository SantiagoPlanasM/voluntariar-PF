// src/app/components/NGOProjectDetailManage.test.tsx — administrar el voluntariado desde el panel de la ONG (§255).
//
// Antes el detalle del panel solo mostraba las inscripciones: no había forma de editar el voluntariado.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, Project } from '../../lib/api';
import { UiProvider } from '../ui/UiProvider';

vi.mock('./MomentsFeed', () => ({ MomentsFeed: () => null }));
import { NGOProjectDetail } from './NGOProjectDetail';

const project = {
  id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación', description: 'd', category: 'Medio Ambiente', location: 'Córdoba',
  type: 'fugaz', status: 'active', volunteers_needed: 10, current_volunteers: 1, funding_goal: 0, current_funding: 0, cost_per_person: 0,
} as Project;

const mount = () => render(
  <MemoryRouter initialEntries={['/ngo/dashboard/project/proj-1']}><Routes>
    <Route path="/ngo/dashboard/project/:projectId" element={<NGOProjectDetail />} />
    <Route path="/ngo/dashboard/project/:projectId/editar" element={<p>Formulario de edición</p>} />
  </Routes></MemoryRouter>);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api.projects, 'get').mockResolvedValue({ project } as never);
  vi.spyOn(api.enrollments, 'byProject').mockResolvedValue({ enrollments: [] });
});

describe('Panel de la ONG: editar el voluntariado', () => {
  test('"Editar" abre el formulario de edición de ese voluntariado', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    expect(screen.getByText('Formulario de edición')).toBeInTheDocument();
  });
});

// §256: finalizar o cancelar desde el panel (el PUT ya aceptaba `status`, pero ninguna pantalla lo usaba). Con
// confirmación propia (useConfirm), porque los dos sacan el voluntariado de circulación; se puede volver a activar.
describe('Panel de la ONG: finalizar o cancelar el voluntariado', () => {
  const mountWithUi = (status = 'active') => {
    vi.spyOn(api.projects, 'get').mockResolvedValue({ project: { ...project, status } } as never);
    return render(
      <UiProvider><MemoryRouter initialEntries={['/ngo/dashboard/project/proj-1']}><Routes>
        <Route path="/ngo/dashboard/project/:projectId" element={<NGOProjectDetail />} />
      </Routes></MemoryRouter></UiProvider>);
  };
  const estado = () => screen.getByRole('region', { name: 'Estado del voluntariado' });

  test('activo: lo dice y ofrece finalizar y cancelar (no "Volver a activar")', async () => {
    mountWithUi();
    await screen.findByRole('region', { name: 'Estado del voluntariado' });
    expect(within(estado()).getByText('Activo')).toBeInTheDocument();
    expect(within(estado()).getByRole('button', { name: 'Finalizar' })).toBeInTheDocument();
    expect(within(estado()).getByRole('button', { name: 'Cancelar voluntariado' })).toBeInTheDocument();
    expect(within(estado()).queryByRole('button', { name: 'Volver a activar' })).not.toBeInTheDocument();
  });

  test('finalizar pide confirmación; al confirmar manda completed y muestra "Finalizado"', async () => {
    const update = vi.spyOn(api.projects, 'update').mockResolvedValue({ project: { ...project, status: 'completed' } } as never);
    mountWithUi();
    fireEvent.click(await screen.findByRole('button', { name: 'Finalizar' }));
    const dialog = screen.getByRole('dialog', { name: '¿Finalizar este voluntariado?' });
    expect(dialog).toHaveTextContent('Deja de recibir inscripciones y donaciones');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finalizar voluntariado' }));
    await waitFor(() => expect(within(estado()).getByText('Finalizado')).toBeInTheDocument());
    expect(update).toHaveBeenCalledWith('proj-1', { status: 'completed' });
    expect(within(estado()).getByRole('button', { name: 'Volver a activar' })).toBeInTheDocument();
    expect(within(estado()).queryByRole('button', { name: 'Finalizar' })).not.toBeInTheDocument();
  });

  test('cancelar avisa que sale de Explorar y manda cancelled', async () => {
    const update = vi.spyOn(api.projects, 'update').mockResolvedValue({ project: { ...project, status: 'cancelled' } } as never);
    mountWithUi();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar voluntariado' }));
    const dialog = screen.getByRole('dialog', { name: '¿Cancelar este voluntariado?' });
    expect(dialog).toHaveTextContent('Deja de aparecer en Explorar');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar voluntariado' }));
    await waitFor(() => expect(within(estado()).getByText('Cancelado')).toBeInTheDocument());
    expect(update).toHaveBeenCalledWith('proj-1', { status: 'cancelled' });
  });

  test('"Volver" en la confirmación no cambia nada', async () => {
    const update = vi.spyOn(api.projects, 'update');
    mountWithUi();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar voluntariado' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Volver' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(update).not.toHaveBeenCalled();
    expect(within(estado()).getByText('Activo')).toBeInTheDocument();
  });

  test('cancelado: "Volver a activar" manda active sin pedir confirmación', async () => {
    const update = vi.spyOn(api.projects, 'update').mockResolvedValue({ project: { ...project, status: 'active' } } as never);
    mountWithUi('cancelled');
    await screen.findByRole('region', { name: 'Estado del voluntariado' });
    expect(within(estado()).getByText('Cancelado')).toBeInTheDocument();
    fireEvent.click(within(estado()).getByRole('button', { name: 'Volver a activar' }));
    await waitFor(() => expect(within(estado()).getByText('Activo')).toBeInTheDocument());
    expect(update).toHaveBeenCalledWith('proj-1', { status: 'active' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('si el cambio falla, lo dice y el estado no cambia', async () => {
    vi.spyOn(api.projects, 'update').mockRejectedValue(new Error('No pudimos guardar el cambio.'));
    mountWithUi();
    fireEvent.click(await screen.findByRole('button', { name: 'Finalizar' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Finalizar voluntariado' }));
    expect(await within(estado()).findByRole('alert')).toHaveTextContent('No pudimos guardar el cambio.');
    expect(within(estado()).getByText('Activo')).toBeInTheDocument();
  });
});
