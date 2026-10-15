// src/app/components/RootLayout.test.tsx
//
// §128: el layout del lado público/voluntario (Root) no tiene que encogerse dentro de #root (flex en columna) y
// tiene que reservar al final el espacio del botón del chatbot. jsdom no hace layout: se comprueban la clase y
// que el espacio esté (con barra inferior) o sea el más alto (portada, sin barra).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

type TestUser = { id: string; name: string; email: string; role: string; avatar?: string } | null;
const { auth } = vi.hoisted(() => ({
  auth: { user: null as TestUser, logout: vi.fn(), openAuthModal: vi.fn() },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/ChatContext', () => ({ useChat: () => ({ unreadTotal: 0 }) }));
vi.mock('./BottomNav', () => ({ BottomNav: () => null }));
vi.mock('./AuthModal', () => ({ AuthModal: () => null }));

import { Root } from './Root';

const at = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route element={<Root />}>
        <Route path="/" element={<p>Portada</p>} />
        <Route path="/explore" element={<p>Pantalla de prueba</p>} />
      </Route>
    </Routes>
  </MemoryRouter>);

beforeEach(() => { auth.user = null; auth.logout.mockReset(); auth.openAuthModal.mockReset(); });

describe('Root', () => {
  test('el contenedor exterior no se encoge (flex-shrink-0)', () => {
    at('/explore');
    expect(screen.getByText('Pantalla de prueba').parentElement!.parentElement!.className).toContain('flex-shrink-0');
  });

  test('con barra inferior: el espacio del chatbot va después de la pantalla', () => {
    at('/explore');
    const spacer = screen.getByTestId('chatbot-spacer');
    expect(screen.getByText('Pantalla de prueba').nextElementSibling).toBe(spacer);
    expect(spacer.className).toContain('h-20');
  });

  test('portada (sin barra inferior): el espacio es el alto', () => {
    at('/');
    expect(screen.getByTestId('chatbot-spacer').className).toContain('h-36');
  });
});

// §130: la barra lateral (escritorio) mostraba "Cerrar sesión" a un visitante sin sesión. Ahora, sin sesión, ofrece
// "Iniciar sesión" (abre el login); con sesión, "Cerrar sesión" como antes.
describe('Root: barra lateral según la sesión', () => {
  test('visitante: "Iniciar sesión" abre el login y no hay "Cerrar sesión"', () => {
    at('/explore');
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(auth.openAuthModal).toHaveBeenCalledTimes(1);
    expect(auth.logout).not.toHaveBeenCalled();
  });

  test('con sesión: "Cerrar sesión" cierra la sesión y no hay "Iniciar sesión"', () => {
    auth.user = { id: 'u1', name: 'María', email: 'm@x.com', role: 'volunteer' };
    at('/explore');
    expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });
});
