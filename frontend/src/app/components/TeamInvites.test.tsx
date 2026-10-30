// src/app/components/TeamInvites.test.tsx — el aviso de invitación al equipo de una ONG en el Inicio del voluntario.
//
// Antes la invitación solo se veía en Configuración → Equipos. Ahora aparece arriba del Inicio con "Aceptar" y
// "Rechazar"; al aceptar queda el link al panel de esa ONG. Los equipos ya activos no se muestran acá (están en el
// perfil) y, sin invitaciones o si falla la carga, no se muestra nada.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { api, ApiError, TeamMembership } from '../../lib/api';
import { TeamInvites } from './TeamInvites';

const ms = (ngo_id: string, ngo_name: string, role: TeamMembership['role'], status: TeamMembership['status']): TeamMembership =>
  ({ ngo_id, ngo_name, ngo_logo: null, role, status });
const mount = () => render(<MemoryRouter><TeamInvites /></MemoryRouter>);
const invite = async (name: string) => (await screen.findByText(new RegExp(`${name} te invitó a su equipo`))).closest('li') as HTMLElement;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api.team, 'mine').mockResolvedValue({ memberships: [ms('ngo-1', 'Sustentando', 'coordinator', 'invited'), ms('ngo-4', 'TechSocial', 'communicator', 'active')] });
});

describe('Inicio: invitación al equipo de una ONG', () => {
  test('muestra solo las invitaciones, con el rol y qué puede hacer', async () => {
    mount();
    const inv = await invite('Sustentando');
    expect(within(inv).getByText(/Coordinación/)).toBeInTheDocument();
    expect(within(inv).getByText(/Ve y responde postulaciones/)).toBeInTheDocument();
    expect(screen.queryByText(/TechSocial/)).toBeNull();
  });

  test('aceptar: queda "Ya sos parte" con el link al panel de esa ONG', async () => {
    const accept = vi.spyOn(api.team, 'accept').mockResolvedValue({ membership: ms('ngo-1', 'Sustentando', 'coordinator', 'active') });
    mount();
    fireEvent.click(within(await invite('Sustentando')).getByRole('button', { name: 'Aceptar invitación de Sustentando' }));
    await waitFor(() => expect(accept).toHaveBeenCalledWith('ngo-1'));
    expect(await screen.findByText(/Ya sos parte del equipo de Sustentando/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir el panel de Sustentando' })).toHaveAttribute('href', '/equipo/ngo-1');
    expect(screen.queryByRole('button', { name: /Aceptar invitación/ })).toBeNull();
    expect(screen.queryByText(/TechSocial/)).toBeNull();
  });

  test('rechazar: el aviso desaparece', async () => {
    const leave = vi.spyOn(api.team, 'leave').mockResolvedValue({ removed: true });
    const { container } = mount();
    fireEvent.click(within(await invite('Sustentando')).getByRole('button', { name: 'Rechazar invitación de Sustentando' }));
    await waitFor(() => expect(leave).toHaveBeenCalledWith('ngo-1'));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  test('si aceptar falla, se dice y la invitación sigue ahí', async () => {
    vi.spyOn(api.team, 'accept').mockRejectedValue(new ApiError('La invitación ya no existe', 404));
    mount();
    fireEvent.click(within(await invite('Sustentando')).getByRole('button', { name: 'Aceptar invitación de Sustentando' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La invitación ya no existe');
    expect(screen.getByRole('button', { name: 'Aceptar invitación de Sustentando' })).toBeEnabled();
  });

  test('solo equipos activos: no se muestra nada', async () => {
    vi.mocked(api.team.mine).mockResolvedValue({ memberships: [ms('ngo-4', 'TechSocial', 'communicator', 'active')] });
    const { container } = mount();
    await waitFor(() => expect(api.team.mine).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  test('si falla la carga, tampoco rompe el Inicio', async () => {
    vi.mocked(api.team.mine).mockRejectedValue(new Error('red'));
    const { container } = mount();
    await waitFor(() => expect(api.team.mine).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
