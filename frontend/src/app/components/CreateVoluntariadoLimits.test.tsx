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
window.scrollTo = vi.fn() as never; // jsdom no lo implementa (lo llama "Continuar")
const fill = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });

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

  // Se manda recortado (`title.trim()`), como lo cuenta el backend: los espacios alrededor no suman.
  test('80 justos, con espacios alrededor, pasan al paso 2', () => {
    mount();
    fill('Título del voluntariado', '  ' + 'x'.repeat(80) + ' ');
    fill('Descripción corta', 'Una descripción suficiente');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.queryByText('Máximo 80 caracteres')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ubicación')).toBeInTheDocument();
  });

  test('una descripción corta de más de 1000 no pasa del paso 1; 1000 justos (con espacios) sí', () => {
    mount();
    fill('Título del voluntariado', 'Limpieza del río');
    fill('Descripción corta', 'x'.repeat(1001));
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.getByText('Máximo 1000 caracteres')).toBeInTheDocument();
    fill('Descripción corta', ' ' + 'x'.repeat(1000) + '  ');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.queryByText('Máximo 1000 caracteres')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ubicación')).toBeInTheDocument();
  });

  test('la descripción completa (paso 3) tiene maxLength 5000', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Sostenido/ }));
    fill('Título del voluntariado', 'Limpieza del río');
    fill('Descripción corta', 'Juntamos residuos en la costanera');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    fill('Ubicación', 'Córdoba');
    fill('Horas por semana', '4');
    fill('Voluntarios necesarios', '10');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.getByLabelText('Descripción completa')).toHaveAttribute('maxLength', '5000');
  });
});

// §203 (SonarCloud S6853): las etiquetas visibles no estaban asociadas a su campo (sin htmlFor/id): el nombre accesible
// salía solo del aria-label, y tocar el texto de la etiqueta no llevaba al campo. Se busca por el texto VISIBLE de la
// etiqueta (con el "*" o el "(opcional)", que el aria-label no tiene): solo lo encuentra si está asociada.
describe('Crear voluntariado: cada etiqueta está asociada a su campo', () => {
  test('pasos 1, 2 y 3: el texto de la etiqueta lleva a su campo', () => {
    // Arrange / Act: paso 1
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Sostenido/ }));
    // Assert
    expect(screen.getByLabelText('Título del voluntariado *')).toHaveAttribute('id', 'crear-titulo');
    expect(screen.getByLabelText('Descripción corta *')).toHaveAttribute('id', 'crear-descripcion');

    fill('Título del voluntariado', 'Limpieza del río');
    fill('Descripción corta', 'Juntamos residuos en la costanera');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.getByLabelText('Horas por semana *')).toHaveAttribute('id', 'crear-horas');
    expect(screen.getByLabelText('Voluntarios necesarios *')).toHaveAttribute('id', 'crear-voluntarios');

    fill('Ubicación', 'Córdoba');
    fill('Horas por semana', '4');
    fill('Voluntarios necesarios', '10');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    // el espacio antes de "(opcional)" es un margen (ml-1), no texto: JSX descarta el salto de línea
    expect(screen.getByLabelText(/^Descripción completa\s*\(opcional\)$/)).toHaveAttribute('id', 'crear-descripcion-completa');
    expect(screen.getByText('Meta de financiamiento', { selector: 'label' })).toHaveAttribute('for', 'crear-meta');
  });

  test('fugaz: "Duración del evento *" lleva a su campo', () => {
    mount();
    fill('Título del voluntariado', 'Limpieza del río');
    fill('Descripción corta', 'Juntamos residuos en la costanera');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.getByLabelText('Duración del evento *')).toHaveAttribute('id', 'crear-duracion');
  });
});
