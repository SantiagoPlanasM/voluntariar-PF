// src/app/components/SettingsScreen.test.tsx — Configuración (/settings), nueva en el rediseño (§240).
// Criterio de aceptación (antes de escribir los casos):
//  - sin sesión: el aviso y "Iniciar sesión" abre el ingreso;
//  - "Volver" lleva al perfil de cada rol (/profile, /ngo/profile, /company/profile);
//  - el CV solo para el voluntario; la cuenta de Mercado Pago solo para la ONG (link a /ngo/profile#mercadopago);
//  - el tema: Automático / Claro / Oscuro; elegir uno lo aplica a <html data-theme> y lo recuerda (Automático lo olvida);
//  - "Cerrar sesión" pregunta; si confirma, cierra y va a la portada; si no, nada;
//  - "Borrar mi cuenta" y "Privacidad y términos" están acá (antes, en el medio de cada perfil).
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { UiProvider } from '../ui/UiProvider';

const { auth, navigate } = vi.hoisted(() => ({
  auth: { user: null as null | Record<string, unknown>, logout: vi.fn(), openAuthModal: vi.fn() },
  navigate: vi.fn(),
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useNavigate: () => navigate }));
vi.mock('./CvSection', () => ({ CvSection: ({ userId }: { userId: string }) => <p>CV de {userId}</p> }));

import { SettingsScreen } from './SettingsScreen';

const as = (role: string) => { auth.user = { id: 'u1', name: 'María', email: 'm@x.com', role }; };
const mount = () => render(<MemoryRouter><UiProvider><SettingsScreen /></UiProvider></MemoryRouter>);

beforeEach(() => {
  auth.user = null;
  auth.logout.mockReset();
  auth.openAuthModal.mockReset();
  navigate.mockReset();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => localStorage.clear());

describe('SettingsScreen', () => {
  test('sin sesión: el aviso y "Iniciar sesión" abre el ingreso', () => {
    mount();
    expect(screen.getByText('Iniciá sesión para ver tu configuración.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(auth.openAuthModal).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'Configuración' })).not.toBeInTheDocument();
  });

  test.each([
    ['volunteer', '/profile'],
    ['ngo', '/ngo/profile'],
    ['company', '/company/profile'],
  ])('%s: "Volver" lleva a %s', (role, ruta) => {
    as(role);
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Configuración' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', ruta);
  });

  test('los tres roles tienen "Cambiar contraseña" (§272)', () => {
    for (const role of ['volunteer', 'ngo', 'company']) {
      as(role);
      const { unmount } = mount();
      expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeInTheDocument();
      unmount();
    }
  });

  test('voluntario: ve su CV y no la cuenta de Mercado Pago', () => {
    as('volunteer');
    mount();
    expect(screen.getByText('CV de u1')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Mercado Pago/ })).not.toBeInTheDocument();
  });

  test('ONG: la cuenta de Mercado Pago (al perfil) y sin CV', () => {
    as('ngo');
    mount();
    expect(screen.getByRole('link', { name: /Cuenta de Mercado Pago/ })).toHaveAttribute('href', '/ngo/profile#mercadopago');
    expect(screen.queryByText(/CV de/)).not.toBeInTheDocument();
  });

  test('empresa: ni CV ni Mercado Pago', () => {
    as('company');
    mount();
    expect(screen.queryByText(/CV de/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Mercado Pago/ })).not.toBeInTheDocument();
  });

  test('tema: arranca en Automático; Oscuro y Claro se aplican y se recuerdan; Automático los olvida', () => {
    as('volunteer');
    mount();
    const tema = screen.getByRole('radiogroup', { name: 'Tema' });
    expect(within(tema).getByRole('radio', { name: 'Automático' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(tema).getByRole('radio', { name: 'Oscuro' }));
    expect(within(tema).getByRole('radio', { name: 'Oscuro' })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('v_theme')).toBe('dark');
    fireEvent.click(within(tema).getByRole('radio', { name: 'Claro' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem('v_theme')).toBe('light');
    fireEvent.click(within(tema).getByRole('radio', { name: 'Automático' }));
    expect(localStorage.getItem('v_theme')).toBeNull();
  });

  test('el tema guardado se respeta al volver a entrar', () => {
    localStorage.setItem('v_theme', 'dark');
    as('volunteer');
    mount();
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  test('"Cerrar sesión" pregunta: "Volver" no hace nada; confirmar cierra y va a la portada', async () => {
    as('volunteer');
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    let d = await screen.findByRole('dialog', { name: '¿Cerrar sesión?' });
    fireEvent.click(within(d).getByRole('button', { name: 'Volver' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(auth.logout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    d = await screen.findByRole('dialog', { name: '¿Cerrar sesión?' });
    fireEvent.click(within(d).getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(auth.logout).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalledWith('/');
  });

  test('acá están "Privacidad y términos" y "Borrar mi cuenta"', () => {
    as('company');
    mount();
    expect(screen.getByRole('link', { name: 'Privacidad y términos' })).toHaveAttribute('href', '/privacidad');
    expect(screen.getByRole('button', { name: 'Borrar mi cuenta' })).toBeInTheDocument();
  });
});
