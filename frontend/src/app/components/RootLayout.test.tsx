// src/app/components/RootLayout.test.tsx
//
// §128: el layout del lado público/voluntario (Root) no tiene que encogerse dentro de #root (flex en columna) y
// tiene que reservar al final el espacio del botón del chatbot. jsdom no hace layout: se comprueban la clase y
// que el espacio esté (con barra inferior) o sea el más alto (portada, sin barra).
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));
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
