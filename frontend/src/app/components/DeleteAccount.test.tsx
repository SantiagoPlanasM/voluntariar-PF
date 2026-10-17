// src/app/components/DeleteAccount.test.tsx
//
// Borrar la propia cuenta (§177–§178; backend en routes/auth.js):
//   - <DeleteAccountSection />: "Borrar mi cuenta" en los tres perfiles propios. Pide confirmar en la pantalla (sin
//     window.confirm) y manda el email con el link (POST /auth/me/delete-request). A una ONG le advierte que se borran
//     sus proyectos y las inscripciones de otros.
//   - /cuenta/borrar?token=…: adonde lleva el link. Explica qué se borra y recién con "Sí, borrar mi cuenta" lo hace
//     (POST /auth/delete-account) y cierra la sesión.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, ApiError } from '../../lib/api';

const { auth } = vi.hoisted(() => ({
  auth: { user: { id: 'u1', name: 'María', email: 'maria@example.com', role: 'volunteer' } as Record<string, unknown> | null, logout: vi.fn() },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
import { DeleteAccountSection } from './DeleteAccountSection';
import { DeleteAccountPage } from './DeleteAccountPage';

const TOKEN = 'a'.repeat(43);

beforeEach(() => {
  vi.restoreAllMocks();
  auth.logout.mockReset();
  auth.user = { id: 'u1', name: 'María', email: 'maria@example.com', role: 'volunteer' };
});

describe('api.auth: borrar la cuenta', () => {
  test('requestDeletion: POST /auth/me/delete-request; deleteAccount: POST /auth/delete-account con el token', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ sent: true }) } as Response));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await api.auth.requestDeletion();
      let [url, init] = fetchMock.mock.calls.at(-1)! as unknown as [string, RequestInit];
      expect(String(url)).toMatch(/\/auth\/me\/delete-request$/);
      expect(init.method).toBe('POST');
      await api.auth.deleteAccount(TOKEN);
      [url, init] = fetchMock.mock.calls.at(-1)! as unknown as [string, RequestInit];
      expect(String(url)).toMatch(/\/auth\/delete-account$/);
      expect(init.method).toBe('POST');
      expect(JSON.parse(String(init.body))).toEqual({ token: TOKEN });
    } finally { vi.unstubAllGlobals(); }
  });
});

describe('<DeleteAccountSection />', () => {
  const openConfirm = () => fireEvent.click(screen.getByRole('button', { name: 'Borrar mi cuenta' }));

  test('pide confirmar en la pantalla: "Cancelar" no manda nada; "Mandarme el email" lo pide y avisa a qué casilla', async () => {
    const req = vi.spyOn(api.auth, 'requestDeletion').mockResolvedValue({ sent: true });
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<DeleteAccountSection />);
    openConfirm();
    const box = screen.getByRole('group', { name: '¿Querés borrar tu cuenta?' });
    fireEvent.click(within(box).getByRole('button', { name: 'Cancelar' }));
    expect(req).not.toHaveBeenCalled();
    openConfirm();
    fireEvent.click(screen.getByRole('button', { name: 'Mandarme el email' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Te mandamos un email a maria@example.com');
    expect(req).toHaveBeenCalledTimes(1);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  test('a una ONG le advierte que se borran sus proyectos y las inscripciones', () => {
    auth.user = { id: 'u2', name: 'Sustentando', email: 's@x.org', role: 'ngo' };
    render(<DeleteAccountSection />);
    openConfirm();
    expect(screen.getByText(/tus proyectos/)).toBeInTheDocument();
    expect(screen.getByText(/inscripciones de los voluntarios/)).toBeInTheDocument();
  });

  test('a un voluntario no le habla de proyectos', () => {
    render(<DeleteAccountSection />);
    openConfirm();
    expect(screen.queryByText(/tus proyectos/)).toBeNull();
  });

  test('error del servidor: muestra su mensaje y se puede reintentar', async () => {
    vi.spyOn(api.auth, 'requestDeletion')
      .mockRejectedValueOnce(new ApiError('No podemos mandar emails por el momento, así que no se puede confirmar el borrado.', 503))
      .mockResolvedValueOnce({ sent: true });
    render(<DeleteAccountSection />);
    openConfirm();
    fireEvent.click(screen.getByRole('button', { name: 'Mandarme el email' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No podemos mandar emails por el momento');
    fireEvent.click(screen.getByRole('button', { name: 'Mandarme el email' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Te mandamos un email');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('sin red: mensaje de conexión (no el "Failed to fetch" del navegador)', async () => {
    vi.spyOn(api.auth, 'requestDeletion').mockRejectedValue(new TypeError('Failed to fetch'));
    render(<DeleteAccountSection />);
    openConfirm();
    fireEvent.click(screen.getByRole('button', { name: 'Mandarme el email' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/conexión/i);
    expect(alert).not.toHaveTextContent('Failed to fetch');
  });

  test('mientras se manda: "Mandando…" deshabilitado', async () => {
    let resolve!: (v: { sent: boolean }) => void;
    vi.spyOn(api.auth, 'requestDeletion').mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<DeleteAccountSection />);
    openConfirm();
    fireEvent.click(screen.getByRole('button', { name: 'Mandarme el email' }));
    expect(await screen.findByRole('button', { name: 'Mandando…' })).toBeDisabled();
    resolve({ sent: true });
  });
});

describe('/cuenta/borrar (DeleteAccountPage)', () => {
  const mount = (search = `?token=${TOKEN}`) => render(
    <MemoryRouter initialEntries={[`/cuenta/borrar${search}`]}><Routes>
      <Route path="/cuenta/borrar" element={<DeleteAccountPage />} />
      <Route path="/" element={<p>inicio</p>} />
    </Routes></MemoryRouter>);

  test('explica qué se borra y no borra nada hasta confirmar', () => {
    const del = vi.spyOn(api.auth, 'deleteAccount');
    mount();
    expect(screen.getByRole('heading', { name: 'Borrar tu cuenta' })).toBeInTheDocument();
    expect(screen.getByText(/no se puede deshacer/i)).toBeInTheDocument();
    expect(screen.getByText(/si sos una ONG/i)).toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();
  });

  test('"Sí, borrar mi cuenta": la borra con el token, cierra la sesión y lo confirma', async () => {
    const del = vi.spyOn(api.auth, 'deleteAccount').mockResolvedValue({ deleted: true });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar mi cuenta' }));
    expect(await screen.findByRole('heading', { name: 'Tu cuenta se borró' })).toBeInTheDocument();
    expect(del).toHaveBeenCalledWith(TOKEN);
    expect(auth.logout).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: 'Ir al inicio' }));
    expect(screen.getByText('inicio')).toBeInTheDocument();
  });

  test('link vencido o ya usado: el mensaje del servidor, sin cerrar la sesión', async () => {
    vi.spyOn(api.auth, 'deleteAccount').mockRejectedValue(new ApiError('El link venció. Pedí uno nuevo desde tu perfil.', 400));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar mi cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El link venció. Pedí uno nuevo desde tu perfil.');
    expect(auth.logout).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sí, borrar mi cuenta' })).toBeEnabled();
  });

  test('sin token en la URL: link inválido, sin botón para borrar', () => {
    mount('');
    expect(screen.getByRole('heading', { name: 'Este link no es válido' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sí, borrar mi cuenta' })).toBeNull();
  });

  test('mientras se borra: botón deshabilitado ("Borrando…")', async () => {
    vi.spyOn(api.auth, 'deleteAccount').mockReturnValue(new Promise(() => {}));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar mi cuenta' }));
    expect(await screen.findByRole('button', { name: 'Borrando…' })).toBeDisabled();
  });
});
