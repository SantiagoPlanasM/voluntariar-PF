// src/app/components/TeamSection.test.tsx — "Equipos" en la Configuración del voluntario (§296).
//
// Las invitaciones se aceptan o rechazan; en los equipos activos hay un link al panel de esa ONG y "Salir" (con
// confirmación). Sin invitaciones ni equipos, la sección no se muestra (la mayoría de los voluntarios no tiene).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { api, TeamMembership } from '../../lib/api';

const { confirm } = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock('../ui/UiProvider', async () => {
  const actual = await vi.importActual<typeof import('../ui/UiProvider')>('../ui/UiProvider');
  return { ...actual, useConfirm: () => confirm };
});
import { TeamSection } from './TeamSection';

const ms = (ngo_id: string, ngo_name: string, role: TeamMembership['role'], status: TeamMembership['status']): TeamMembership =>
  ({ ngo_id, ngo_name, ngo_logo: null, role, status });
const mount = () => render(<MemoryRouter><TeamSection /></MemoryRouter>);
const row = async (name: string) => (await screen.findByText(name)).closest('li') as HTMLElement;

beforeEach(() => {
  vi.restoreAllMocks();
  confirm.mockReset().mockResolvedValue(true);
  vi.spyOn(api.team, 'mine').mockResolvedValue({ memberships: [ms('ngo-1', 'Sustentando', 'coordinator', 'invited'), ms('ngo-4', 'TechSocial', 'communicator', 'active')] });
});

describe('Configuración: Equipos', () => {
  test('una invitación: aceptarla la pasa a activa, con el link al panel', async () => {
    const accept = vi.spyOn(api.team, 'accept').mockResolvedValue({ membership: ms('ngo-1', 'Sustentando', 'coordinator', 'active') });
    mount();
    const inv = await row('Sustentando');
    expect(within(inv).getByText(/te invitó a su equipo: Coordinación/i)).toBeInTheDocument();
    expect(within(inv).queryByRole('link')).toBeNull();
    fireEvent.click(within(inv).getByRole('button', { name: 'Aceptar invitación de Sustentando' }));
    await waitFor(() => expect(accept).toHaveBeenCalledWith('ngo-1'));
    expect(await within(await row('Sustentando')).findByRole('link', { name: 'Abrir el panel de Sustentando' })).toHaveAttribute('href', '/equipo/ngo-1');
  });

  test('rechazar una invitación la saca de la lista', async () => {
    const leave = vi.spyOn(api.team, 'leave').mockResolvedValue({ removed: true });
    mount();
    fireEvent.click(within(await row('Sustentando')).getByRole('button', { name: 'Rechazar invitación de Sustentando' }));
    await waitFor(() => expect(leave).toHaveBeenCalledWith('ngo-1'));
    await waitFor(() => expect(screen.queryByText('Sustentando')).toBeNull());
  });

  test('un equipo activo: link al panel con el rol, y "Salir" con confirmación', async () => {
    const leave = vi.spyOn(api.team, 'leave').mockResolvedValue({ removed: true });
    mount();
    const act = await row('TechSocial');
    expect(within(act).getByRole('link', { name: 'Abrir el panel de TechSocial' })).toHaveAttribute('href', '/equipo/ngo-4');
    expect(within(act).getByText('Comunicación')).toBeInTheDocument();
    confirm.mockResolvedValueOnce(false);
    fireEvent.click(within(act).getByRole('button', { name: 'Salir del equipo de TechSocial' }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(leave).not.toHaveBeenCalled();
    fireEvent.click(within(act).getByRole('button', { name: 'Salir del equipo de TechSocial' }));
    await waitFor(() => expect(leave).toHaveBeenCalledWith('ngo-4'));
  });

  test('sin invitaciones ni equipos, no se muestra nada', async () => {
    vi.mocked(api.team.mine).mockResolvedValue({ memberships: [] });
    const { container } = mount();
    await waitFor(() => expect(api.team.mine).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  test('con #equipos en la dirección (el aviso de invitación), hace scroll a la sección una vez cargada', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(<MemoryRouter initialEntries={['/profile#equipos']}><TeamSection /></MemoryRouter>);
    const section = await screen.findByRole('region', { name: 'Equipos' });
    expect(section).toHaveAttribute('id', 'equipos');
    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
    expect(scroll.mock.contexts[0]).toBe(section);
  });

  test('con #equipos, aceptar una invitación no vuelve a mover la pantalla', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    vi.spyOn(api.team, 'accept').mockResolvedValue({ membership: ms('ngo-1', 'Sustentando', 'coordinator', 'active') });
    render(<MemoryRouter initialEntries={['/profile#equipos']}><TeamSection /></MemoryRouter>);
    fireEvent.click(within(await row('Sustentando')).getByRole('button', { name: 'Aceptar invitación de Sustentando' }));
    await within(await row('Sustentando')).findByRole('link', { name: 'Abrir el panel de Sustentando' });
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  test('el margen lo pone la pantalla que la usa', async () => {
    render(<MemoryRouter><TeamSection className="mx-4 mt-4" /></MemoryRouter>);
    expect((await screen.findByRole('region', { name: 'Equipos' })).className).toContain('mx-4 mt-4');
  });

  test('sin #equipos no hace scroll', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    mount();
    await screen.findByRole('region', { name: 'Equipos' });
    expect(scroll).not.toHaveBeenCalled();
  });

  test('si falla la carga, tampoco rompe la pantalla', async () => {
    vi.mocked(api.team.mine).mockRejectedValue(new Error('red'));
    const { container } = mount();
    await waitFor(() => expect(api.team.mine).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
