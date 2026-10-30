// src/app/components/NGOOwnProfileTransparency.test.tsx — cargar los datos de transparencia desde "Editar perfil" (§285).
//
// Criterio: el formulario trae "CUIT" y "Link a balances y documentos" precargados; al guardar los manda (`cuit`,
// `transparency_url`) junto con el resto. El error del backend (CUIT inválido, link sin https) se muestra tal cual.
// El perfil propio también muestra la sección de transparencia.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../../lib/AuthContext';
import type { NGO } from '../../lib/api';

vi.mock('./MomentsGrid', () => ({ MomentsGrid: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      auth: { ...actual.api.auth, me: vi.fn() },
      ngos: { ...actual.api.ngos, me: vi.fn(), update: vi.fn() },
      projects: { ...actual.api.projects, list: vi.fn().mockResolvedValue({ projects: [] }) },
    },
  };
});
import { api, ApiError } from '../../lib/api';
import { NGOOwnProfile } from './NGOOwnProfile';

const ngo = { id: 'ngo-1', user_id: 'u-ngo', name: 'Sustentando', followers: 2, cuit: '30-71234567-1', transparency_url: 'https://s.org/b' } as NGO;
const user = { id: 'u-ngo', name: 'Sustentando', email: 's@x.org', role: 'ngo' };

beforeEach(() => {
  localStorage.setItem('v_token', 'tok');
  localStorage.setItem('v_user', JSON.stringify(user));
  vi.mocked(api.auth.me).mockResolvedValue({ user } as never);
  vi.mocked(api.ngos.me).mockReset().mockResolvedValue({ ngo, projects: [], stats: {} as never, pending_enrollments: [] });
  vi.mocked(api.ngos.update).mockReset().mockResolvedValue({ ngo });
});
afterEach(() => localStorage.clear());

const mount = () => render(<MemoryRouter><AuthProvider><NGOOwnProfile /></AuthProvider></MemoryRouter>);
const editar = async () => fireEvent.click(await screen.findByRole('button', { name: 'Editar perfil' }));

describe('Perfil propio de la ONG: datos de transparencia', () => {
  test('el perfil muestra la sección, y el formulario los trae precargados', async () => {
    mount();
    expect(await screen.findByRole('region', { name: 'Datos de transparencia' })).toHaveTextContent('30-71234567-1');
    await editar();
    expect(screen.getByLabelText('CUIT')).toHaveValue('30-71234567-1');
    expect(screen.getByLabelText('Link a balances y documentos')).toHaveValue('https://s.org/b');
  });

  test('al guardar manda cuit y transparency_url', async () => {
    mount();
    await editar();
    fireEvent.change(screen.getByLabelText('CUIT'), { target: { value: '20123456786' } });
    fireEvent.change(screen.getByLabelText('Link a balances y documentos'), { target: { value: 'https://s.org/memoria' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));
    await waitFor(() => expect(api.ngos.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sustentando', cuit: '20123456786', transparency_url: 'https://s.org/memoria' })));
  });

  test('el error del backend se muestra tal cual', async () => {
    vi.mocked(api.ngos.update).mockRejectedValue(new ApiError('El CUIT no es válido: son 11 números con el dígito verificador correcto', 400));
    mount();
    await editar();
    fireEvent.change(screen.getByLabelText('CUIT'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El CUIT no es válido');
  });
});
