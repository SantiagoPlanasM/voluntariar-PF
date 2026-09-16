// src/app/components/CompanyPublicProfile.test.tsx
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthProvider } from '../../lib/AuthContext';
import { CompanyPublicProfile } from './CompanyPublicProfile';
import type { Empresa } from '../../lib/api';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: { ...actual.api, empresas: { me: vi.fn(), get: vi.fn(), update: vi.fn() } },
  };
});

import { api } from '../../lib/api';

const empresa: Empresa = {
  id: 'emp-1', user_id: 'user-comp-1', name: 'TechCorp',
  industry: 'Tecnología', description: 'Somos TechCorp', mission: 'RSE fuerte',
  location: 'Córdoba, Argentina', followers: 12,
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/company/:id" element={<CompanyPublicProfile />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('<CompanyPublicProfile />', () => {
  beforeEach(() => { vi.mocked(api.empresas.get).mockReset(); });

  test('muestra nombre, ubicación, industria y misión de la empresa', async () => {
    vi.mocked(api.empresas.get).mockResolvedValue({ empresa });
    renderAt('/company/emp-1');

    await waitFor(() => expect(screen.getByText('TechCorp')).toBeInTheDocument());
    expect(screen.getByText(/Córdoba, Argentina/)).toBeInTheDocument();
    expect(screen.getByText('Tecnología')).toBeInTheDocument();
    expect(screen.getByText('RSE fuerte')).toBeInTheDocument();
  });

  test('pide el perfil por el :id de la URL', async () => {
    vi.mocked(api.empresas.get).mockResolvedValue({ empresa });
    renderAt('/company/emp-1');
    await waitFor(() => expect(api.empresas.get).toHaveBeenCalledWith('emp-1'));
  });

  test('no explota si la empresa no tiene descripción, misión ni ubicación', async () => {
    vi.mocked(api.empresas.get).mockResolvedValue({
      empresa: { ...empresa, description: undefined, mission: undefined, location: undefined },
    });
    expect(() => renderAt('/company/emp-1')).not.toThrow();
    await waitFor(() => expect(screen.getByText('TechCorp')).toBeInTheDocument());
  });
});
