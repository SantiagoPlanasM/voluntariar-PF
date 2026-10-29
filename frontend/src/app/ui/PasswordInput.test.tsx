// src/app/ui/PasswordInput.test.tsx — el campo de contraseña con el botón del ojo (§274).
//
// Criterio: el botón alterna entre mostrar y ocultar sin mandar el formulario que lo contiene (en el login, tocar el
// ojo no puede iniciar sesión), y el campo deja lugar a la derecha para el ícono (si no, lo escrito queda debajo).
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PasswordInput } from './PasswordInput';

describe('PasswordInput', () => {
  test('tocar el ojo dentro de un formulario no lo envía', () => {
    const submit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(<form onSubmit={submit}><PasswordInput aria-label="Contraseña" defaultValue="Secreta1" /></form>);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text');
  });

  test('suma lugar para el ícono a las clases que recibe', () => {
    render(<PasswordInput aria-label="Contraseña" className="w-full h-11" />);
    expect(screen.getByLabelText('Contraseña')).toHaveClass('w-full', 'h-11', 'pr-12');
  });
});
