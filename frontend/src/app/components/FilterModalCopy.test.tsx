// src/app/components/FilterModalCopy.test.tsx — D40 (Issue #41, sesión exploratoria 2, §330).
//
// La app habla de vos. La hoja de filtros tenía dos textos en tuteo: "Personaliza tu búsqueda de voluntariados" y
// "Elige según el tiempo y dedicación que desees aportar".
import { describe, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { FilterModal, DEFAULT_FILTERS } from './FilterModal';

const open = () => render(
  <FilterModal isOpen onClose={() => {}} allProjects={[]} searchQuery="" currentFilters={DEFAULT_FILTERS} onApply={() => {}} onReset={() => {}} />,
);

describe('Hoja de filtros: los textos van de vos', () => {
  test('"Personalizá tu búsqueda" y "Elegí según el tiempo"', () => {
    open();
    const d = screen.getByRole('dialog');
    expect(within(d).getByText('Personalizá tu búsqueda de voluntariados')).toBeInTheDocument();
    expect(within(d).getByText('Elegí según el tiempo y la dedicación que quieras aportar')).toBeInTheDocument();
  });

  test('no queda ningún verbo en tuteo', () => {
    open();
    const text = screen.getByRole('dialog').textContent ?? '';
    expect(text).not.toMatch(/\b(Personaliza|Elige|desees|Selecciona|Filtra|Busca|Encuentra)\b/);
  });
});
