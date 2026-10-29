// src/app/components/PasswordSection.test.tsx — cambiar la contraseña en Configuración (§272).
//
// Criterio: "Cambiar contraseña" abre el formulario (actual, nueva, repetir la nueva). Si la nueva y su repetición no
// coinciden, avisa sin llamar al backend. Si coinciden, manda las dos al backend y, si sale bien, avisa y cierra el
// formulario; un error del backend (actual equivocada, reglas) se muestra tal cual y el formulario sigue abierto.
// Con los campos vacíos, "Guardar" no se puede tocar.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api, ApiError } from '../../lib/api';
import { PasswordSection } from './PasswordSection';

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const abrir = () => { render(<PasswordSection />); fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' })); };
const completar = (actual: string, nueva: string, repetir: string) => {
  fill('Contraseña actual', actual); fill('Contraseña nueva', nueva); fill('Repetí la contraseña nueva', repetir);
};

beforeEach(() => { vi.restoreAllMocks(); });

describe('Configuración: cambiar la contraseña', () => {
  test('sale bien: manda actual y nueva, avisa y cierra el formulario', async () => {
    const change = vi.spyOn(api.auth, 'changePassword').mockResolvedValue({ message: 'Contraseña actualizada' });
    abrir();
    completar('Password1', 'NuevaClave2', 'NuevaClave2');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    await waitFor(() => expect(change).toHaveBeenCalledWith('Password1', 'NuevaClave2'));
    expect(await screen.findByRole('status')).toHaveTextContent('Listo: tu contraseña cambió.');
    expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument();
  });

  test('la repetición no coincide: avisa y no llama al backend', () => {
    const change = vi.spyOn(api.auth, 'changePassword');
    abrir();
    completar('Password1', 'NuevaClave2', 'NuevaClave3');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Las dos contraseñas nuevas no coinciden');
    expect(change).not.toHaveBeenCalled();
  });

  test('un error del backend se muestra y el formulario sigue abierto', async () => {
    vi.spyOn(api.auth, 'changePassword').mockRejectedValue(new ApiError('La contraseña actual no es correcta', 400));
    abrir();
    completar('Mala1234', 'NuevaClave2', 'NuevaClave2');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña actual no es correcta');
    expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument();
  });

  test('con campos vacíos no se puede guardar; los campos son de contraseña', () => {
    abrir();
    expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toBeDisabled();
    expect(screen.getByLabelText('Contraseña nueva')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Contraseña actual')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByLabelText('Contraseña nueva')).toHaveAttribute('autocomplete', 'new-password');
  });
});
