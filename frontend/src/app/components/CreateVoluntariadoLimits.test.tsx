// src/app/components/CreateVoluntariadoLimits.test.tsx
//
// §145: desde §143 el backend limita el título a 80 caracteres, la descripción corta a 1000 y la completa a 5000.
// El formulario mostraba "n/80" pero no limitaba: un título largo daba error recién al publicar (paso 3).
// Ahora los campos tienen el mismo tope y el paso 1 lo valida con su mensaje.
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-ngo', name: 'ONG', email: 'o@x.com', role: 'ngo' } }) }));

import { CreateVoluntariado } from './CreateVoluntariado';

const mount = () => render(<MemoryRouter><CreateVoluntariado /></MemoryRouter>);

describe('Crear voluntariado: los topes del backend también en el formulario', () => {
  test('título 80, descripción corta 1000 y completa 5000 (maxLength)', () => {
    mount();
    expect(screen.getByLabelText('Título del voluntariado')).toHaveAttribute('maxLength', '80');
    expect(screen.getByLabelText('Descripción corta')).toHaveAttribute('maxLength', '1000');
    expect(screen.getByText(/\/1000 caracteres/)).toBeInTheDocument();
  });

  test('un título de más de 80 (pegado o autocompletado) no pasa del paso 1', () => {
    mount();
    fireEvent.change(screen.getByLabelText('Título del voluntariado'), { target: { value: 'x'.repeat(81) } });
    fireEvent.change(screen.getByLabelText('Descripción corta'), { target: { value: 'Una descripción suficiente' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.getByText('Máximo 80 caracteres')).toBeInTheDocument();
    expect(screen.getByLabelText('Título del voluntariado')).toBeInTheDocument();
  });
});
