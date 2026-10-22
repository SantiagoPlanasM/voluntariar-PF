// src/app/components/AssistantScreen.test.tsx
//
// El asistente de preguntas frecuentes, ahora como conversación fijada de Mensajes (antes ChatbotWidget, flotante).
// Mismas garantías que tenía el widget: sugerencias iniciales por rol, respuesta con coincidencia, sugerencias de
// respaldo sin coincidencia, no manda preguntas vacías y no se cae si la API falla.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { AskFaqResponse, Faq } from '../../lib/api';

const { auth } = vi.hoisted(() => ({ auth: { user: { id: 'u1', role: 'volunteer' } as null | { id: string; role: string } } }));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, faqs: { list: vi.fn(), ask: vi.fn() } } };
});

import { api } from '../../lib/api';
import { AssistantScreen, messagesBase } from './AssistantScreen';

const faqs: Faq[] = [
  { id: 'f1', categoria: 'voluntario', pregunta: '¿Cómo me inscribo a un voluntariado?', respuesta: 'Entrá al proyecto y tocá Inscribirme.' },
  { id: 'f2', categoria: 'general', pregunta: '¿VoluntariAR tiene costo?', respuesta: 'No, es gratis.' },
];

const renderIt = () => render(<MemoryRouter><AssistantScreen /></MemoryRouter>);

beforeEach(() => {
  auth.user = { id: 'u1', role: 'volunteer' };
  vi.mocked(api.faqs.list).mockReset().mockResolvedValue({ faqs });
  vi.mocked(api.faqs.ask).mockReset();
});

describe('<AssistantScreen />', () => {
  test('al abrir carga las sugerencias de la categoría del rol', async () => {
    renderIt();
    expect(await screen.findByRole('button', { name: faqs[0].pregunta })).toBeInTheDocument();
    expect(api.faqs.list).toHaveBeenCalledWith('voluntario');
    expect(screen.getByRole('heading', { name: 'Asistente VoluntariAR' })).toBeInTheDocument();
  });

  test('la ONG pide sus preguntas; la empresa, todas', async () => {
    auth.user = { id: 'u2', role: 'ngo' };
    const { unmount } = renderIt();
    await waitFor(() => expect(api.faqs.list).toHaveBeenCalledWith('ngo'));
    unmount();
    vi.mocked(api.faqs.list).mockClear();
    auth.user = { id: 'u3', role: 'company' };
    renderIt();
    await waitFor(() => expect(api.faqs.list).toHaveBeenCalledWith(undefined));
  });

  test('tocar una sugerencia pregunta y muestra la respuesta', async () => {
    vi.mocked(api.faqs.ask).mockResolvedValue({ matched: true, best: faqs[0], suggestions: [] } as AskFaqResponse);
    renderIt();
    fireEvent.click(await screen.findByRole('button', { name: faqs[0].pregunta }));
    expect(await screen.findByText(faqs[0].respuesta)).toBeInTheDocument();
    expect(api.faqs.ask).toHaveBeenCalledWith(faqs[0].pregunta, 'voluntario');
  });

  test('sin coincidencia: muestra preguntas parecidas, y tocar una vuelve a preguntar', async () => {
    vi.mocked(api.faqs.ask)
      .mockResolvedValueOnce({ matched: false, best: null, suggestions: [{ id: 'f2', pregunta: faqs[1].pregunta }] } as unknown as AskFaqResponse)
      .mockResolvedValueOnce({ matched: true, best: faqs[1], suggestions: [] } as AskFaqResponse);
    renderIt();
    await screen.findByRole('button', { name: faqs[0].pregunta });
    fireEvent.change(screen.getByRole('textbox', { name: 'Tu pregunta' }), { target: { value: 'algo raro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));
    expect(await screen.findByText(/No encontré una respuesta exacta/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: faqs[1].pregunta }));
    expect(await screen.findByText(faqs[1].respuesta)).toBeInTheDocument();
  });

  test('si la API falla, lo dice sin romper la pantalla', async () => {
    vi.mocked(api.faqs.ask).mockRejectedValue(new Error('red'));
    renderIt();
    fireEvent.change(screen.getByRole('textbox', { name: 'Tu pregunta' }), { target: { value: 'hola' } });
    fireEvent.submit(screen.getByRole('textbox', { name: 'Tu pregunta' }).closest('form')!);
    expect(await screen.findByText(/No pude procesar tu pregunta/)).toBeInTheDocument();
  });

  test('no envía preguntas vacías: el botón Enviar solo aparece con texto', async () => {
    renderIt();
    await screen.findByRole('button', { name: faqs[0].pregunta });
    expect(screen.queryByRole('button', { name: 'Enviar pregunta' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Tu pregunta' }), { target: { value: '   ' } });
    fireEvent.submit(screen.getByRole('textbox', { name: 'Tu pregunta' }).closest('form')!);
    expect(api.faqs.ask).not.toHaveBeenCalled();
  });

  test('"Volver" lleva a la bandeja de cada rol', () => {
    renderIt();
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/messages');
    expect(messagesBase('ngo')).toBe('/ngo/messages');
    expect(messagesBase('company')).toBe('/company/messages');
    expect(messagesBase(undefined)).toBe('/messages');
  });
});
