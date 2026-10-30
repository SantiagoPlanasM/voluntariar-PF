// src/app/components/CreateVoluntariadoScrollTimer.test.tsx
//
// §292: el CI de 81fb24a falló (Frontend · tests · UTC) con "ReferenceError: document is not defined" en
// CreateVoluntariado.tsx. "Continuar" con errores deja un setTimeout de 80 ms que lleva la vista al primer campo con
// error; si el componente se desmonta antes (en el test, al terminar; en la app, al salir de la pantalla), el timeout
// igual corría. En el CI llegó después de que jsdom se cerrara. Ahora se cancela al desmontar y al volver a llamar.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-ngo', name: 'ONG', email: 'o@x.com', role: 'ngo' } }) }));

import { CreateVoluntariado } from './CreateVoluntariado';

window.scrollTo = vi.fn() as never; // jsdom no implementa ninguno de los dos
Element.prototype.scrollIntoView = vi.fn() as never;
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Crear voluntariado: el desplazamiento al primer error', () => {
  test('desmontado antes de los 80 ms, el timeout no corre', () => {
    vi.useFakeTimers();
    const { unmount } = render(<MemoryRouter><CreateVoluntariado /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));   // paso 1 vacío: hay errores
    const lookup = vi.spyOn(document, 'getElementById');
    unmount();
    vi.advanceTimersByTime(200);
    expect(lookup).not.toHaveBeenCalled();
  });

  test('montado, lleva la vista al primer campo con error (una sola vez aunque se toque dos veces)', () => {
    vi.useFakeTimers();
    vi.mocked(Element.prototype.scrollIntoView).mockClear();
    render(<MemoryRouter><CreateVoluntariado /></MemoryRouter>);
    const lookup = vi.spyOn(document, 'getElementById');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    vi.advanceTimersByTime(200);
    const scrolls = lookup.mock.calls.filter(([id]) => String(id).startsWith('field-'));
    expect(scrolls).toHaveLength(1);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
