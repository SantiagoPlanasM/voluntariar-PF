// src/app/components/CompanyOwnProfile.test.tsx
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../../lib/AuthContext';
import { UiProvider } from '../ui/UiProvider';
import { CompanyOwnProfile } from './CompanyOwnProfile';
import type { Empresa, Patrocinio, Project } from '../../lib/api';

// Mockeamos el módulo api entero — este test no debe pegarle a la red real,
// solo verificar que el componente pinta lo que `api.empresas.me()` devuelve
// y que al guardar/proponer/retirar llama a los endpoints correctos.
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      empresas: {
        me: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
        patrocinios: { list: vi.fn(), propose: vi.fn(), withdraw: vi.fn() },
      },
      projects: { ...actual.api.projects, list: vi.fn() },
    },
  };
});

import { api } from '../../lib/api';

const baseEmpresa: Empresa = {
  id: 'emp-1', user_id: 'user-comp-1', name: 'TechCorp',
  industry: 'Tecnología', description: 'Somos TechCorp', mission: '',
  location: '', followers: 3,
};

const activeProject: Project = {
  id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación Urbana', description: '',
  category: 'Medio Ambiente', location: 'Córdoba', type: 'sostenido', status: 'active',
  volunteers_needed: 10, current_volunteers: 2, funding_goal: 0, current_funding: 0, cost_per_person: 0,
} as Project;

const patrocinioAceptado: Patrocinio = {
  empresa_id: 'emp-1', project_id: 'proj-9', estado: 'aceptado', aporte: 0,
  created_at: '', updated_at: '', project_title: 'Banco de Alimentos', ngo_name: 'Sustentando',
};

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AuthProvider><UiProvider>{ui}</UiProvider></AuthProvider>
    </MemoryRouter>
  );
}

describe('<CompanyOwnProfile />', () => {
  beforeEach(() => {
    vi.mocked(api.empresas.me).mockReset();
    vi.mocked(api.empresas.update).mockReset();
    vi.mocked(api.empresas.patrocinios.list).mockReset().mockResolvedValue({ patrocinios: [] });
    vi.mocked(api.empresas.patrocinios.propose).mockReset();
    vi.mocked(api.empresas.patrocinios.withdraw).mockReset();
    vi.mocked(api.projects.list).mockReset().mockResolvedValue({ projects: [activeProject] });
  });

  test('carga y muestra el perfil de la empresa (nombre e industria)', async () => {
    vi.mocked(api.empresas.me).mockResolvedValue({ empresa: baseEmpresa });
    renderWithProviders(<CompanyOwnProfile />);

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'TechCorp' })).toBeInTheDocument());
    expect(screen.getByText(/^Tecnología/)).toBeInTheDocument();
    expect(screen.getByText('Somos TechCorp')).toBeInTheDocument();
  });

  test('al editar y guardar, envía solo los campos del formulario (update parcial)', async () => {
    vi.mocked(api.empresas.me).mockResolvedValue({ empresa: baseEmpresa });
    vi.mocked(api.empresas.update).mockResolvedValue({ empresa: { ...baseEmpresa, description: 'Nueva descripción' } });
    renderWithProviders(<CompanyOwnProfile />);

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'TechCorp' })).toBeInTheDocument());

    // Abrir modo edición (rediseño, §240: el botón "Editar perfil" del encabezado)
    fireEvent.click(screen.getByRole('button', { name: 'Editar perfil' }));

    const descriptionInput = await screen.findByDisplayValue('Somos TechCorp');
    fireEvent.change(descriptionInput, { target: { value: 'Nueva descripción' } });

    fireEvent.click(screen.getByText('Guardar cambios'));

    await waitFor(() => expect(api.empresas.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'TechCorp', description: 'Nueva descripción', industry: 'Tecnología' })
    ));
  });

  test('no explota si la empresa no tiene descripción ni misión', async () => {
    vi.mocked(api.empresas.me).mockResolvedValue({
      empresa: { ...baseEmpresa, description: undefined, mission: undefined },
    });
    expect(() => renderWithProviders(<CompanyOwnProfile />)).not.toThrow();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'TechCorp' })).toBeInTheDocument());
  });

  test('muestra los patrocinios existentes con su estado', async () => {
    vi.mocked(api.empresas.me).mockResolvedValue({ empresa: baseEmpresa });
    vi.mocked(api.empresas.patrocinios.list).mockResolvedValue({ patrocinios: [patrocinioAceptado] });
    renderWithProviders(<CompanyOwnProfile />);

    await waitFor(() => expect(screen.getByText('Banco de Alimentos')).toBeInTheDocument());
    expect(screen.getByText('Sustentando')).toBeInTheDocument();
    expect(screen.getByText('Aceptado')).toBeInTheDocument();
    // §265: cada patrocinio lleva a su acuerdo.
    expect(screen.getByRole('link', { name: 'Ver acuerdo' })).toHaveAttribute('href', '/company/patrocinios/emp-1/proj-9');
  });

  test('proponer patrocinio: envía project_id y mensaje, y refresca la lista', async () => {
    vi.mocked(api.empresas.me).mockResolvedValue({ empresa: baseEmpresa });
    vi.mocked(api.empresas.patrocinios.propose).mockResolvedValue({ message: 'ok' });
    renderWithProviders(<CompanyOwnProfile />);

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'TechCorp' })).toBeInTheDocument());
    fireEvent.click(screen.getByText('Proponer'));

    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: 'proj-1' } });
    fireEvent.change(screen.getByPlaceholderText('Mensaje para la ONG (opcional)'), { target: { value: 'Queremos sumarnos' } });
    fireEvent.click(screen.getByText('Enviar propuesta'));

    await waitFor(() => expect(api.empresas.patrocinios.propose).toHaveBeenCalledWith('proj-1', 'Queremos sumarnos'));
    // Tras proponer, vuelve a pedir la lista para reflejar el nuevo estado
    await waitFor(() => expect(api.empresas.patrocinios.list).toHaveBeenCalledTimes(2));
  });

  test('retirar una propuesta pendiente llama a withdraw con el project_id correcto', async () => {
    const pendiente: Patrocinio = { ...patrocinioAceptado, estado: 'propuesto', project_id: 'proj-7' };
    vi.mocked(api.empresas.me).mockResolvedValue({ empresa: baseEmpresa });
    vi.mocked(api.empresas.patrocinios.list).mockResolvedValue({ patrocinios: [pendiente] });
    vi.mocked(api.empresas.patrocinios.withdraw).mockResolvedValue({ message: 'ok' });
    // La pregunta es el diálogo propio (useConfirm), no la del navegador (hallazgo B1 de la revisión de diseño).
    const nativo = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithProviders(<CompanyOwnProfile />);
    await waitFor(() => expect(screen.getByText('Banco de Alimentos')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Retirar propuesta'));
    const d = await screen.findByRole('dialog', { name: '¿Retirar la propuesta para Banco de Alimentos?' });
    expect(within(d).getByText('La ONG deja de verla. Podés volver a proponer después.')).toBeInTheDocument();
    expect(nativo).not.toHaveBeenCalled();
    expect(api.empresas.patrocinios.withdraw).not.toHaveBeenCalled();

    fireEvent.click(within(d).getByRole('button', { name: 'Retirar propuesta' }));
    await waitFor(() => expect(api.empresas.patrocinios.withdraw).toHaveBeenCalledWith('proj-7'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Tras retirar, vuelve a pedir la lista.
    await waitFor(() => expect(api.empresas.patrocinios.list).toHaveBeenCalledTimes(2));
    nativo.mockRestore();
  });

  test('con dos propuestas pendientes, pregunta por la que se tocó y retira esa', async () => {
    vi.mocked(api.empresas.me).mockResolvedValue({ empresa: baseEmpresa });
    vi.mocked(api.empresas.patrocinios.list).mockResolvedValue({ patrocinios: [
      { ...patrocinioAceptado, estado: 'propuesto', project_id: 'proj-7' },
      { ...patrocinioAceptado, estado: 'propuesto', project_id: 'proj-8', project_title: 'Huerta Comunitaria' },
    ] });
    vi.mocked(api.empresas.patrocinios.withdraw).mockResolvedValue({ message: 'ok' });

    renderWithProviders(<CompanyOwnProfile />);
    await waitFor(() => expect(screen.getByText('Huerta Comunitaria')).toBeInTheDocument());

    fireEvent.click(screen.getAllByTitle('Retirar propuesta')[1]);
    const d = await screen.findByRole('dialog', { name: '¿Retirar la propuesta para Huerta Comunitaria?' });
    // Es una acción destructiva: el foco arranca en "Volver", no en el botón que retira.
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Volver' })).toHaveFocus());
    fireEvent.click(within(d).getByRole('button', { name: 'Retirar propuesta' }));
    await waitFor(() => expect(api.empresas.patrocinios.withdraw).toHaveBeenCalledWith('proj-8'));
    expect(api.empresas.patrocinios.withdraw).toHaveBeenCalledTimes(1);
  });

  test('"Volver" en la pregunta de retirar no retira nada', async () => {
    const pendiente: Patrocinio = { ...patrocinioAceptado, estado: 'propuesto', project_id: 'proj-7' };
    vi.mocked(api.empresas.me).mockResolvedValue({ empresa: baseEmpresa });
    vi.mocked(api.empresas.patrocinios.list).mockResolvedValue({ patrocinios: [pendiente] });

    renderWithProviders(<CompanyOwnProfile />);
    await waitFor(() => expect(screen.getByText('Banco de Alimentos')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Retirar propuesta'));
    const d = await screen.findByRole('dialog', { name: '¿Retirar la propuesta para Banco de Alimentos?' });
    fireEvent.click(within(d).getByRole('button', { name: 'Volver' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.empresas.patrocinios.withdraw).not.toHaveBeenCalled();
    expect(api.empresas.patrocinios.list).toHaveBeenCalledTimes(1);
  });

  test('cada estado de patrocinio tiene su etiqueta y su color (REVISION S7)', async () => {
    vi.mocked(api.empresas.me).mockResolvedValue({ empresa: baseEmpresa });
    vi.mocked(api.empresas.patrocinios.list).mockResolvedValue({ patrocinios: [
      { ...patrocinioAceptado, estado: 'propuesto', project_id: 'proj-p' },
      { ...patrocinioAceptado, estado: 'aceptado',  project_id: 'proj-a' },
      { ...patrocinioAceptado, estado: 'rechazado', project_id: 'proj-r' },
    ] });
    renderWithProviders(<CompanyOwnProfile />);

    const pendiente = await screen.findByText('Pendiente');
    expect(pendiente.className).toContain('bg-surface-soft text-ink-soft');
    expect(screen.getByText('Aceptado').className).toContain('bg-people-soft text-people-text');
    expect(screen.getByText('Rechazado').className).toContain('bg-surface-soft text-ink-soft');
  });
});

