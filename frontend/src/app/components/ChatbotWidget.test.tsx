// src/app/components/ChatbotWidget.test.tsx
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../../lib/AuthContext';
import { ChatbotWidget } from './ChatbotWidget';
import type { AskFaqResponse, Faq } from '../../lib/api';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: { ...actual.api, faqs: { list: vi.fn(), ask: vi.fn() } },
  };
});

import { api } from '../../lib/api';

const faqs: Faq[] = [
  { id: 'f1', categoria: 'voluntario', pregunta: '¿Cómo me inscribo a un voluntariado?', respuesta: 'Entrá al proyecto y tocá Inscribirme.' },
  { id: 'f2', categoria: 'general', pregunta: '¿Voluntariar tiene costo?', respuesta: 'No, es gratis.' },
];

function renderWidget() {
  return render(
    <MemoryRouter>
      <AuthProvider><ChatbotWidget /></AuthProvider>
    </MemoryRouter>
  );
}

describe('<ChatbotWidget />', () => {
  beforeEach(() => {
    vi.mocked(api.faqs.list).mockReset().mockResolvedValue({ faqs });
    vi.mocked(api.faqs.ask).mockReset();
  });

  test('arranca cerrado y sin pedir nada a la API', () => {
    renderWidget();
    expect(screen.queryByPlaceholderText('Escribí tu pregunta...')).not.toBeInTheDocument();
    expect(api.faqs.list).not.toHaveBeenCalled();
  });

  test('al abrir, carga y muestra sugerencias iniciales', async () => {
    renderWidget();
    fireEvent.click(screen.getByTitle('Ayuda rápida'));

    await waitFor(() => expect(screen.getByText('¿Cómo me inscribo a un voluntariado?')).toBeInTheDocument());
    expect(screen.getByText('¿Voluntariar tiene costo?')).toBeInTheDocument();
  });

  test('tocar una sugerencia pregunta y muestra la respuesta con match', async () => {
    const response: AskFaqResponse = { matched: true, best: faqs[0] };
    vi.mocked(api.faqs.ask).mockResolvedValue(response);
    renderWidget();
    fireEvent.click(screen.getByTitle('Ayuda rápida'));

    await waitFor(() => expect(screen.getByText('¿Cómo me inscribo a un voluntariado?')).toBeInTheDocument());
    fireEvent.click(screen.getByText('¿Cómo me inscribo a un voluntariado?'));

    expect(api.faqs.ask).toHaveBeenCalledWith('¿Cómo me inscribo a un voluntariado?', undefined);
    await waitFor(() => expect(screen.getByText('Entrá al proyecto y tocá Inscribirme.')).toBeInTheDocument());
  });

  test('escribir y enviar una pregunta sin match muestra sugerencias de respaldo', async () => {
    const response: AskFaqResponse = {
      matched: false,
      suggestions: [{ id: 'f1', pregunta: '¿Cómo me inscribo a un voluntariado?' }],
    };
    vi.mocked(api.faqs.ask).mockResolvedValue(response);
    renderWidget();
    fireEvent.click(screen.getByTitle('Ayuda rápida'));
    await waitFor(() => expect(api.faqs.list).toHaveBeenCalled());

    const input = screen.getByPlaceholderText('Escribí tu pregunta...');
    fireEvent.change(input, { target: { value: 'cual es el sentido de la vida' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(screen.getByText(/No encontré una respuesta exacta/)).toBeInTheDocument());
  });

  test('no envía preguntas vacías', async () => {
    renderWidget();
    fireEvent.click(screen.getByTitle('Ayuda rápida'));
    await waitFor(() => expect(api.faqs.list).toHaveBeenCalled());

    fireEvent.keyDown(screen.getByPlaceholderText('Escribí tu pregunta...'), { key: 'Enter' });
    expect(api.faqs.ask).not.toHaveBeenCalled();
  });
});
