// src/app/components/NGOShortcuts.test.tsx — los accesos del Panel de la ONG a Patrocinios, Publicaciones y Equipo.
//
// En el celular la barra lateral no está y la barra inferior solo tiene Panel, Explorar, Crear, Mensajes y Perfil:
// Patrocinios, Publicaciones y Equipo quedaban sin acceso (Equipo, solo por Configuración). El Panel los tiene a los
// tres; en escritorio también, al lado de la barra lateral.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { api } from '../../lib/api';
import { NGOShortcuts } from './NGOShortcuts';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api.team, 'members').mockResolvedValue({ members: [] });
  vi.spyOn(api.ngos.validation, 'get').mockResolvedValue({ validation: { status: 'none' } });
});

// §319: la pantalla de postulaciones, primero en los accesos (aunque no haya pendientes: también son las aprobadas).
test('el Panel tiene el acceso a Postulaciones, el primero', () => {
  render(<MemoryRouter><NGOShortcuts /></MemoryRouter>);
  const links = within(screen.getByRole('navigation', { name: 'Accesos del panel' })).getAllByRole('link');
  expect(links[0]).toHaveAttribute('href', '/ngo/postulaciones');
  expect(links[0]).toHaveTextContent('Filtrá, buscá y decidí varias juntas');
});

// §317: DESIGN.md pide "Validar la ONG" desde el Panel.
test('el Panel tiene el acceso a la validación', async () => {
  render(<MemoryRouter><NGOShortcuts /></MemoryRouter>);
  const nav = screen.getByRole('navigation', { name: 'Accesos del panel' });
  expect(within(nav).getByRole('link', { name: /Validación/ })).toHaveAttribute('href', '/ngo/validacion');
  expect(await within(nav).findByText('Pedí la insignia azul de ONG validada')).toBeInTheDocument();
});

describe('Panel de la ONG: accesos', () => {
  test('Patrocinios, Publicaciones y Equipo, cada uno a su pantalla', async () => {
    render(<MemoryRouter><NGOShortcuts /></MemoryRouter>);
    const nav = screen.getByRole('navigation', { name: 'Accesos del panel' });
    expect(within(nav).getByRole('link', { name: /Patrocinios/ })).toHaveAttribute('href', '/ngo/patrocinios');
    expect(within(nav).getByRole('link', { name: /Publicaciones/ })).toHaveAttribute('href', '/ngo/momentos');
    expect(within(nav).getByRole('link', { name: /Equipo/ })).toHaveAttribute('href', '/ngo/equipo');
    expect(await within(nav).findByText(/Sumá voluntarios/)).toBeInTheDocument();
  });

  test('cada acceso dice para qué es', () => {
    render(<MemoryRouter><NGOShortcuts /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Patrocinios/ })).toHaveTextContent('Propuestas y acuerdos con empresas');
    expect(screen.getByRole('link', { name: /Publicaciones/ })).toHaveTextContent('Momentos de tus voluntariados');
  });
});
