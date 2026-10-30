// src/app/components/CreateVoluntariadoLists.test.tsx — los requisitos del paso 3 (§298).
// Un requisito repetido no se agrega ni muestra error (projectForm.reqError devuelve 'duplicate', que la pantalla
// tiene que ignorar: si no, el texto "duplicate" aparecería como error).
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-ngo', name: 'ONG', email: 'o@x.com', role: 'ngo' } }) }));
import { CreateVoluntariado } from './CreateVoluntariado';

window.scrollTo = vi.fn() as never;
const fill = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
const click = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));

describe('Crear voluntariado: requisitos', () => {
  test('un requisito repetido no se agrega ni muestra error', () => {
    render(<MemoryRouter><CreateVoluntariado /></MemoryRouter>);
    fill('Título del voluntariado', 'Limpieza del río');
    fill('Descripción corta', 'Juntamos residuos en la costanera');
    click(/Continuar/);
    click(/Remoto/);
    fill('Duración del evento', '1 jornada');
    fill('Voluntarios necesarios', '10');
    click(/Continuar/);
    fill('Requisito personalizado', 'Traer gorra');
    click('Agregar requisito');
    fill('Requisito personalizado', 'Traer gorra');
    click('Agregar requisito');
    expect(screen.getAllByRole('button', { name: 'Quitar requisito Traer gorra' })).toHaveLength(1);
    expect(screen.queryByText('duplicate')).toBeNull();
  });
});
