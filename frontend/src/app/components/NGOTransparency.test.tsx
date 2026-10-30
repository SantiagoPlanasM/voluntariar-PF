// src/app/components/NGOTransparency.test.tsx — "Datos de transparencia" de una ONG (§285).
//
// Criterio: si la ONG cargó CUIT o link, una sección con el CUIT y un link "Ver balances y documentos" que abre en otra
// pestaña (rel="noopener noreferrer"), y la aclaración de que los carga la organización y la plataforma no los verifica.
// Sin datos, no se muestra. El perfil público de la ONG la tiene.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: null, openAuthModal: () => {}, logout: () => {} }) }));
vi.mock('./MomentsGrid', () => ({ MomentsGrid: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      ngos: { ...actual.api.ngos, get: vi.fn() },
      follows: { ...actual.api.follows, ngoStatus: vi.fn().mockResolvedValue({ following: false }) },
    },
  };
});
import { api, NGO } from '../../lib/api';
import { NGOTransparency } from './NGOTransparency';
import { NGOPublicProfile } from './NGOPublicProfile';

const URL_ = 'https://sustentando.org/balances';

describe('Datos de transparencia', () => {
  test('con CUIT y link: los muestra, el link abre aparte y aclara que no se verifican', () => {
    render(<NGOTransparency cuit="30-71234567-1" url={URL_} />);
    const region = screen.getByRole('region', { name: 'Datos de transparencia' });
    expect(within(region).getByText('30-71234567-1')).toBeInTheDocument();
    const link = within(region).getByRole('link', { name: 'Ver balances y documentos' });
    expect(link).toHaveAttribute('href', URL_);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(region).toHaveTextContent('Los carga la organización; VoluntariAR no los verifica.');
  });

  test('solo uno de los dos: muestra ese; sin ninguno, no se muestra', () => {
    const { rerender } = render(<NGOTransparency cuit="30-71234567-1" url={null} />);
    expect(screen.queryByRole('link', { name: 'Ver balances y documentos' })).toBeNull();
    rerender(<NGOTransparency cuit={null} url={URL_} />);
    expect(screen.getByRole('link', { name: 'Ver balances y documentos' })).toBeInTheDocument();
    expect(screen.queryByText(/CUIT/)).toBeNull();
    rerender(<NGOTransparency cuit={null} url={null} />);
    expect(screen.queryByRole('region', { name: 'Datos de transparencia' })).toBeNull();
  });

  test('el perfil público de la ONG la muestra', async () => {
    vi.mocked(api.ngos.get).mockResolvedValue({
      ngo: { id: 'n1', user_id: 'u-ngo', name: 'Sustentando', followers: 0, cuit: '30-71234567-1', transparency_url: URL_ } as NGO,
      projects: [],
    } as never);
    render(<MemoryRouter initialEntries={['/ngo/n1']}><Routes><Route path="/ngo/:id" element={<NGOPublicProfile />} /></Routes></MemoryRouter>);
    const region = await screen.findByRole('region', { name: 'Datos de transparencia' });
    expect(within(region).getByText('30-71234567-1')).toBeInTheDocument();
  });
});
