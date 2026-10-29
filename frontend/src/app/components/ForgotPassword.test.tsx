// src/app/components/ForgotPassword.test.tsx — "¿Olvidaste tu contraseña?" dentro del modal de acceso (§275).
//
// Criterio: el link aparece en "Iniciar sesión" (no en "Crear cuenta") y abre un formulario con el email, que arranca
// con lo que ya se había escrito. Un email inválido se avisa sin llamar al backend. Si el backend responde, el mensaje
// es el mismo haya o no una cuenta (el backend no lo dice y la pantalla tampoco); un error del backend (sin emails,
// demasiados pedidos) se muestra tal cual. "Volver a iniciar sesión" vuelve al formulario de login.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from '../../lib/AuthContext';
import { api, ApiError } from '../../lib/api';
import { AuthModal } from './AuthModal';

function OpenOnce() {
  const { openAuthModal } = useAuth();
  const done = useRef(false);
  useEffect(() => { if (!done.current) { done.current = true; openAuthModal('', 'login'); } }, [openAuthModal]);
  return null;
}
const abrir = async () => {
  render(<MemoryRouter><AuthProvider><OpenOnce /><AuthModal /></AuthProvider></MemoryRouter>);
  await screen.findByRole('dialog', { name: 'Iniciar sesión' });
};
const SENT = /Si hay una cuenta con ese email, te mandamos un link/;

beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('AuthModal: ¿Olvidaste tu contraseña?', () => {
  test('está en "Iniciar sesión" y no en "Crear cuenta"', async () => {
    await abrir();
    expect(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    expect(screen.queryByRole('button', { name: '¿Olvidaste tu contraseña?' })).toBeNull();
  });

  test('pide el link con el email que ya estaba escrito y muestra el mismo aviso siempre', async () => {
    const forgot = vi.spyOn(api.auth, 'forgotPassword').mockResolvedValue({ sent: true });
    await abrir();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'maria@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    expect(screen.getByRole('dialog', { name: 'Recuperar la contraseña' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña')).toBeNull();
    expect(screen.getByLabelText('Email')).toHaveValue('maria@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Mandarme el link' }));
    await waitFor(() => expect(forgot).toHaveBeenCalledWith('maria@example.com'));
    expect(await screen.findByRole('status')).toHaveTextContent(SENT);
    expect(screen.getByRole('status')).toHaveTextContent('1 hora');
  });

  test('email inválido: avisa y no llama al backend', async () => {
    const forgot = vi.spyOn(api.auth, 'forgotPassword');
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'no-es-un-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mandarme el link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Email inválido');
    expect(forgot).not.toHaveBeenCalled();
  });

  test('un error del backend se muestra tal cual y se puede reintentar', async () => {
    const forgot = vi.spyOn(api.auth, 'forgotPassword')
      .mockRejectedValueOnce(new ApiError('No podemos mandar emails por el momento, así que no se puede recuperar la contraseña.', 503))
      .mockResolvedValueOnce({ sent: true });
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'maria@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mandarme el link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No podemos mandar emails por el momento');
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mandarme el link' }));
    expect(await screen.findByRole('status')).toHaveTextContent(SENT);
    expect(forgot).toHaveBeenCalledTimes(2);
  });

  test('tocar "¿Olvidaste tu contraseña?" no intenta iniciar sesión', async () => {
    const login = vi.spyOn(api.auth, 'login');
    await abrir();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'maria@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    expect(screen.getByRole('dialog', { name: 'Recuperar la contraseña' })).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  test('si se cierra estando en "Recuperar la contraseña", al volver a abrir arranca en el login', async () => {
    function Reabrir() {
      const { openAuthModal } = useAuth();
      return <button type="button" onClick={() => openAuthModal('', 'login')}>Reabrir</button>;
    }
    render(<MemoryRouter><AuthProvider><OpenOnce /><Reabrir /><AuthModal /></AuthProvider></MemoryRouter>);
    await screen.findByRole('dialog', { name: 'Iniciar sesión' });
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }));
    expect(await screen.findByRole('dialog', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  });

  test('"Volver a iniciar sesión" vuelve al login', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Volver a iniciar sesión' }));
    expect(screen.getByRole('dialog', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });
});
