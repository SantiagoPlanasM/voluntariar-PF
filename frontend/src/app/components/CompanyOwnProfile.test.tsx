// src/app/components/CompanyOwnProfile.test.tsx
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../../lib/AuthContext';
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
      <AuthProvider>{ui}</AuthProvider>
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

    await waitFor(() => expect(screen.getByText('TechCorp')).toBeInTheDocument());
    expect(screen.getByText('Tecnología')).toBeInTheDocument();
    expect(screen.getByText('Somos TechCorp')).toBeInTheDocument();
  });

  test('al editar y guardar, envía solo los campos del formulario (update parcial)', async () => {
    vi.mocked(api.empresas.me).mockResolvedValue({ empresa: baseEmpresa });
    vi.mocked(api.empresas.update).mockResolvedValue({ empresa: { ...baseEmpresa, description: 'Nueva descripción' } });
    renderWithProviders(<CompanyOwnProfile />);

    await waitFor(() => expect(screen.getByText('TechCorp')).toBeInTheDocument());

    // Abrir modo edición (botón de lápiz, sin texto — se identifica por rol de botón)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // primer botón del header es "Editar"

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
    await waitFor(() => expect(screen.getByText('TechCorp')).toBeInTheDocument());
  });

  test('muestra los patrocinios existentes con su estado', async () => {
    vi.mocked(api.empresas.me).mockResolvedValue({ empresa: baseEmpresa });
    vi.mocked(api.empresas.patrocinios.list).mockResolvedValue({ patrocinios: [patrocinioAceptado] });
    renderWithProviders(<CompanyOwnProfile />);

    await waitFor(() => expect(screen.getByText('Banco de Alimentos')).toBeInTheDocument());
    expect(screen.getByText('Sustentando')).toBeInTheDocument();
    expect(screen.getByText('Aceptado')).toBeInTheDocument();
  });

  test('proponer patrocinio: envía project_id y mensaje, y refresca la lista', async () => {
    vi.mocked(api.empresas.me).mockResolvedValue({ empresa: baseEmpresa });
    vi.mocked(api.empresas.patrocinios.propose).mockResolvedValue({ message: 'ok' });
    renderWithProviders(<CompanyOwnProfile />);

    await waitFor(() => expect(screen.getByText('TechCorp')).toBeInTheDocument());
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
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithProviders(<CompanyOwnProfile />);
    await waitFor(() => expect(screen.getByText('Banco de Alimentos')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Retirar propuesta'));
    await waitFor(() => expect(api.empresas.patrocinios.withdraw).toHaveBeenCalledWith('proj-7'));
  });
});

