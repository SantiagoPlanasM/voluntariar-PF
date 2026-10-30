// src/app/components/NGOTeamCard.test.tsx — el acceso al equipo desde el Panel de la ONG.
//
// En el celular la barra lateral (que tiene "Equipo") no está: se llegaba solo por Perfil → Configuración. La
// tarjeta del Panel lleva a /ngo/equipo y resume cuántos miembros e invitaciones hay. Si la carga falla, el acceso
// sigue estando (sin números).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { api, TeamMember } from '../../lib/api';
import { NGOTeamCard } from './NGOTeamCard';

const member = (user_id: string, status: TeamMember['status']): TeamMember =>
  ({ user_id, name: user_id, email: `${user_id}@x.com`, avatar: null, role: 'coordinator', status, created_at: '2026-10-20 12:00:00' });
const mount = () => render(<MemoryRouter><NGOTeamCard /></MemoryRouter>);
const link = () => screen.getByRole('link', { name: /Equipo/ });

beforeEach(() => { vi.restoreAllMocks(); });

describe('Panel de la ONG: tarjeta del equipo', () => {
  test('cuenta miembros e invitaciones pendientes y lleva a /ngo/equipo', async () => {
    vi.spyOn(api.team, 'members').mockResolvedValue({ members: [member('a', 'active'), member('b', 'active'), member('c', 'invited')] });
    mount();
    expect(await screen.findByText('2 miembros · 1 invitación pendiente')).toBeInTheDocument();
    expect(link()).toHaveAttribute('href', '/ngo/equipo');
  });

  test('singular y plural', async () => {
    vi.spyOn(api.team, 'members').mockResolvedValue({ members: [member('a', 'active'), member('c', 'invited'), member('d', 'invited')] });
    mount();
    expect(await screen.findByText('1 miembro · 2 invitaciones pendientes')).toBeInTheDocument();
  });

  test('sin invitaciones: no dice "0 invitaciones"', async () => {
    vi.spyOn(api.team, 'members').mockResolvedValue({ members: [member('a', 'active'), member('b', 'active')] });
    mount();
    expect(await screen.findByText('2 miembros')).toBeInTheDocument();
  });

  test('solo invitaciones: no dice "0 miembros"', async () => {
    vi.spyOn(api.team, 'members').mockResolvedValue({ members: [member('c', 'invited')] });
    mount();
    expect(await screen.findByText('1 invitación pendiente')).toBeInTheDocument();
  });

  test('sin equipo: invita a sumar gente', async () => {
    vi.spyOn(api.team, 'members').mockResolvedValue({ members: [] });
    mount();
    expect(await screen.findByText(/Sumá voluntarios que te ayuden/)).toBeInTheDocument();
    expect(link()).toHaveAttribute('href', '/ngo/equipo');
  });

  test('si la carga falla, el acceso sigue, sin números', async () => {
    const members = vi.spyOn(api.team, 'members').mockRejectedValue(new Error('red'));
    mount();
    await waitFor(() => expect(members).toHaveBeenCalled());
    expect(link()).toHaveAttribute('href', '/ngo/equipo');
    expect(screen.queryByText(/miembro|invitaci|Sumá/)).toBeNull();
  });
});
