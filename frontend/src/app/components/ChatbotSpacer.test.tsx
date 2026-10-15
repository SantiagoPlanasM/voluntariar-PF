// src/app/components/ChatbotSpacer.test.tsx
//
// §128: el botón flotante del chatbot (fixed, abajo a la derecha) tapaba lo último de cada pantalla, porque los
// layouts solo reservaban el alto de la barra inferior. ChatbotSpacer agrega ese espacio al final del contenido,
// salvo en el hilo de un chat, que tiene altura fija y quedaría con un hueco y scroll.
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ChatbotSpacer } from './ChatbotWidget';

const at = (path: string, props: { withBottomNav?: boolean } = {}) =>
  render(<MemoryRouter initialEntries={[path]}><ChatbotSpacer {...props} /></MemoryRouter>);
const spacer = () => screen.queryByTestId('chatbot-spacer');

describe('ChatbotSpacer', () => {
  test('con barra inferior: 80 px en el celular (más los 64 de la barra) y 96 desde md', () => {
    at('/explore');
    expect(spacer()!.className).toContain('h-20');
    expect(spacer()!.className).toContain('md:h-24');
    expect(spacer()).toHaveAttribute('aria-hidden', 'true');
  });

  test('sin barra inferior (portada pública): 144 px en el celular', () => {
    at('/', { withBottomNav: false });
    expect(spacer()!.className).toContain('h-36');
    expect(spacer()!.className).not.toContain('h-20');
  });

  test('no se dibuja en el hilo de un chat (voluntario, ONG y empresa)', () => {
    for (const p of ['/messages/u1', '/ngo/messages/u1', '/company/messages/u1', '/messages/u1/']) {
      const { unmount } = at(p);
      expect(spacer()).toBeNull();
      unmount();
    }
  });

  test('sí en la lista de conversaciones y en el resto', () => {
    for (const p of ['/messages', '/ngo/messages', '/profile', '/ngo/dashboard']) {
      const { unmount } = at(p);
      expect(spacer()).not.toBeNull();
      unmount();
    }
  });
});
