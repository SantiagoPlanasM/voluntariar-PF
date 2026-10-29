// src/app/components/ResetPasswordPage.test.tsx — /restablecer?token=…, adonde lleva el email de "¿Olvidaste tu
// contraseña?" (§275).
//
// Criterio: sin código en el link, avisa que no es válido y ofrece pedir uno nuevo (abre el modal en "Iniciar sesión").
// Con código: la contraseña nueva y su repetición (cada una con su botón para mostrarla). Si no coinciden, avisa sin
// llamar al backend; con los campos vacíos no se puede guardar. Si coinciden, manda el código y la nueva; al salir bien
// avisa y ofrece iniciar sesión. Un error del backend (link vencido o usado, reglas) se muestra tal cual.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, ApiError } from '../../lib/api';

const { auth } = vi.hoisted(() => ({ auth: { user: null as unknown, openAuthModal: vi.fn() } }));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
import { ResetPasswordPage } from './ResetPasswordPage';

const TOKEN = 'b'.repeat(43);
const abrir = (search = `?token=${TOKEN}`) => render(
  <MemoryRouter initialEntries={[`/restablecer${search}`]}><Routes>
    <Route path="/restablecer" element={<ResetPasswordPage />} />
  </Routes></MemoryRouter>);
const completar = (nueva: string, repetir: string) => {
  fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: nueva } });
  fireEvent.change(screen.getByLabelText('Repetí la contraseña nueva'), { target: { value: repetir } });
};

beforeEach(() => { vi.restoreAllMocks(); auth.openAuthModal.mockReset(); });

describe('/restablecer (ResetPasswordPage)', () => {
  test('sin código: el link no es válido y ofrece pedir uno nuevo desde el login', () => {
    const reset = vi.spyOn(api.auth, 'resetPassword');
    abrir('');
    expect(screen.getByRole('heading', { name: 'Este link no es válido' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña nueva')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pedir un link nuevo' }));
    expect(auth.openAuthModal).toHaveBeenCalledWith('', 'login');
    expect(reset).not.toHaveBeenCalled();
  });

  test('con código: guarda la nueva, avisa y ofrece iniciar sesión', async () => {
    const reset = vi.spyOn(api.auth, 'resetPassword').mockResolvedValue({ message: 'Contraseña actualizada' });
    abrir();
    expect(screen.getByRole('heading', { name: 'Elegí una contraseña nueva' })).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña nueva')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Contraseña nueva')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('button', { name: 'Mostrar contraseña nueva' })).toBeInTheDocument();
    completar('NuevaClave1', 'NuevaClave1');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    await waitFor(() => expect(reset).toHaveBeenCalledWith(TOKEN, 'NuevaClave1'));
    expect(await screen.findByRole('heading', { name: 'Listo: tu contraseña cambió' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña nueva')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(auth.openAuthModal).toHaveBeenCalledWith('', 'login');
  });

  // §277: visto en producción, los dos campos eran iguales y vacíos (el nombre era solo un aria-label, que no se ve).
  test('cada campo tiene su etiqueta visible', () => {
    abrir();
    for (const texto of ['Contraseña nueva', 'Repetí la contraseña nueva']) {
      const input = screen.getByLabelText(texto) as HTMLInputElement;
      expect(input.labels?.length).toBe(1);
      expect(input.labels?.[0]).toHaveTextContent(texto);
      expect(input).not.toHaveAttribute('aria-label');
    }
  });

  test('si no coinciden: avisa y no llama al backend; vacíos, no se puede guardar', () => {
    const reset = vi.spyOn(api.auth, 'resetPassword');
    abrir();
    expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toBeDisabled();
    completar('NuevaClave1', 'NuevaClave2');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Las dos contraseñas no coinciden');
    expect(reset).not.toHaveBeenCalled();
  });

  test('un error del backend se muestra tal cual, el formulario sigue y se puede pedir otro link', async () => {
    vi.spyOn(api.auth, 'resetPassword').mockRejectedValue(
      new ApiError('El link venció. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".', 400));
    abrir();
    completar('NuevaClave1', 'NuevaClave1');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El link venció');
    expect(screen.getByLabelText('Contraseña nueva')).toHaveValue('NuevaClave1');
    fireEvent.click(screen.getByRole('button', { name: 'Pedir un link nuevo' }));
    expect(auth.openAuthModal).toHaveBeenCalledWith('', 'login');
  });
});
