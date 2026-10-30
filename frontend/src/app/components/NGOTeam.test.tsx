// src/app/components/NGOTeam.test.tsx — "Acceso del equipo" del dueño de la ONG (/ngo/equipo, §296).
//
// Lista a quienes tienen acceso (con su rol y si todavía no aceptaron), invita por email con un rol, cambia el rol
// y saca a alguien (con confirmación). Los errores del backend (sin cuenta, ya invitada) se muestran tal cual.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { api, ApiError, TeamMember } from '../../lib/api';

const { confirm } = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock('../ui/UiProvider', async () => {
  const actual = await vi.importActual<typeof import('../ui/UiProvider')>('../ui/UiProvider');
  return { ...actual, useConfirm: () => confirm };
});
import { NGOTeam } from './NGOTeam';

const m = (user_id: string, name: string, role: TeamMember['role'], status: TeamMember['status']): TeamMember =>
  ({ user_id, name, email: `${user_id}@x.com`, avatar: null, role, status, created_at: '2026-10-30 12:00:00' });
const mount = () => render(<MemoryRouter><NGOTeam /></MemoryRouter>);
const row = async (name: string) => (await screen.findByText(name)).closest('li') as HTMLElement;

beforeEach(() => {
  vi.restoreAllMocks();
  confirm.mockReset().mockResolvedValue(true);
  vi.spyOn(api.team, 'members').mockResolvedValue({ members: [m('u1', 'Ana', 'coordinator', 'active'), m('u2', 'Beto', 'communicator', 'invited')] });
});

describe('Acceso del equipo', () => {
  test('lista a cada persona con su rol, y marca la invitación sin aceptar', async () => {
    mount();
    const ana = await row('Ana');
    expect(within(ana).getByRole('combobox', { name: 'Rol de Ana' })).toHaveValue('coordinator');
    expect(within(ana).queryByText('Invitación enviada')).toBeNull();
    const beto = await row('Beto');
    expect(within(beto).getByRole('combobox', { name: 'Rol de Beto' })).toHaveValue('communicator');
    expect(within(beto).getByText('Invitación enviada')).toBeInTheDocument();
  });

  test('invitar por email con un rol: llama a la API y la persona aparece en la lista', async () => {
    const invite = vi.spyOn(api.team, 'invite').mockResolvedValue({ member: m('u3', 'Caro', 'communicator', 'invited') });
    mount();
    await row('Ana');
    fireEvent.change(screen.getByLabelText('Email de la persona'), { target: { value: 'caro@x.com' } });
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'communicator' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invitar' }));
    await waitFor(() => expect(invite).toHaveBeenCalledWith('caro@x.com', 'communicator'));
    expect(await row('Caro')).toBeInTheDocument();
    expect(screen.getByLabelText('Email de la persona')).toHaveValue('');
  });

  test('si el backend no puede invitar, se muestra su mensaje', async () => {
    vi.spyOn(api.team, 'invite').mockRejectedValue(new ApiError('No hay ninguna cuenta con ese email. Pedile que se registre como voluntario.', 404));
    mount();
    await row('Ana');
    fireEvent.change(screen.getByLabelText('Email de la persona'), { target: { value: 'nadie@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invitar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay ninguna cuenta con ese email');
  });

  test('cambiar el rol', async () => {
    const setRole = vi.spyOn(api.team, 'setRole').mockResolvedValue({ member: m('u1', 'Ana', 'communicator', 'active') });
    mount();
    fireEvent.change(within(await row('Ana')).getByRole('combobox', { name: 'Rol de Ana' }), { target: { value: 'communicator' } });
    await waitFor(() => expect(setRole).toHaveBeenCalledWith('u1', 'communicator'));
  });

  test('sacar a alguien pide confirmación; si se cancela, no pasa nada', async () => {
    const remove = vi.spyOn(api.team, 'remove').mockResolvedValue({ removed: true });
    confirm.mockResolvedValueOnce(false);
    mount();
    const quitar = () => within(screen.getByText('Ana').closest('li') as HTMLElement).getByRole('button', { name: 'Sacar a Ana del equipo' });
    await row('Ana');
    fireEvent.click(quitar());
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(quitar());
    await waitFor(() => expect(remove).toHaveBeenCalledWith('u1'));
    await waitFor(() => expect(screen.queryByText('Ana')).toBeNull());
  });

  test('sin nadie todavía: lo explica', async () => {
    vi.mocked(api.team.members).mockResolvedValue({ members: [] });
    mount();
    expect(await screen.findByText(/Todavía no sumaste a nadie/)).toBeInTheDocument();
  });
});
