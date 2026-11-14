// src/app/components/FilterModalSheet.test.tsx — T9 de la revisión contra DESIGN.md (§340).
//
// Los filtros de Explorar pasan a la hoja común (`Sheet`) con los botones y los colores del sistema: sin colores
// fijos (el chip de categoría elegido llevaba un color en `style`, y su punto no se veía en oscuro: D35), cada
// opción dice si está elegida (`aria-pressed`), los títulos van en minúscula corrida y el botón cuenta bien
// ("1 voluntariado").
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FilterModal, DEFAULT_FILTERS, FilterState } from './FilterModal';
import type { Project } from '../../lib/api';

const p = (id: string, over: Partial<Project> = {}) => ({
  id, title: `Proyecto ${id}`, description: '', category: 'Educación', location: 'Córdoba', type: 'fugaz',
  modality: 'presencial', cost_per_person: 0, ngo_name: 'ONG', ...over,
}) as unknown as Project;

const open = (projects: Project[] = [], filters: FilterState = DEFAULT_FILTERS) => {
  const onApply = vi.fn(); const onClose = vi.fn(); const onReset = vi.fn();
  render(<FilterModal isOpen onClose={onClose} allProjects={projects} searchQuery="" currentFilters={filters} onApply={onApply} onReset={onReset} />);
  return { onApply, onClose, onReset, d: screen.getByRole('dialog', { name: 'Filtros' }) };
};

describe('<FilterModal />: la hoja de filtros', () => {
  test('un solo "Cerrar", con nombre accesible', () => {
    const { d, onClose } = open();
    const cerrar = within(d).getAllByRole('button', { name: 'Cerrar' });
    expect(cerrar).toHaveLength(1);
    fireEvent.click(cerrar[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('los títulos de las secciones, sin mayúsculas de título', () => {
    const { d } = open();
    expect(within(d).getAllByRole('heading', { level: 3 }).map(h => h.textContent))
      .toEqual(['Categorías', 'Tipo', 'Modalidad', 'Costo', 'Carga horaria']);
  });

  test('el botón cuenta en singular y en plural', () => {
    const { d } = open([p('1'), p('2', { category: 'Salud' })]);
    expect(within(d).getByRole('button', { name: 'Mostrar 2 voluntariados' })).toBeInTheDocument();
    fireEvent.click(within(d).getByRole('button', { name: 'Salud' }));
    expect(within(d).getByRole('button', { name: 'Mostrar 1 voluntariado' })).toBeInTheDocument();
    fireEvent.click(within(d).getByRole('button', { name: /^Sostenido/ }));
    expect(within(d).getByRole('button', { name: 'Mostrar 0 voluntariados' })).toBeInTheDocument();
  });

  test('cada opción dice si está elegida (aria-pressed): categorías, tipo, modalidad, costo y horas', () => {
    const { d } = open([], { categories: ['Salud'], type: 'fugaz', modality: 'remoto', cost: 'gratis', hours: 'hasta5' });
    const pressed = (name: string | RegExp) => within(d).getByRole('button', { name }).getAttribute('aria-pressed');
    expect(pressed('Salud')).toBe('true');
    expect(pressed('Educación')).toBe('false');
    expect(pressed(/^Fugaz/)).toBe('true');
    expect(pressed(/^Todos/)).toBe('false');
    expect(pressed('Remoto')).toBe('true');
    expect(pressed('Presencial')).toBe('false');
    expect(pressed(/^Sin costo/)).toBe('true');
    expect(pressed(/^Hasta 5 h por semana/)).toBe('true');
    expect(pressed(/^Hasta 2 h por semana/)).toBe('false');
  });

  test('elegir y sacar una categoría; el contador dice cuántas hay', () => {
    const { d } = open();
    expect(within(d).queryByText(/elegida/)).toBeNull();
    fireEvent.click(within(d).getByRole('button', { name: 'Salud' }));
    expect(within(d).getByText('1 elegida')).toBeInTheDocument();
    fireEvent.click(within(d).getByRole('button', { name: 'Educación' }));
    expect(within(d).getByText('2 elegidas')).toBeInTheDocument();
    fireEvent.click(within(d).getByRole('button', { name: 'Salud' }));
    expect(within(d).getByText('1 elegida')).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Salud' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('sin colores fijos: nada con `style` de color, ni hexadecimales, ni la paleta vieja', () => {
    const { d } = open([], { ...DEFAULT_FILTERS, categories: ['Salud'] });
    expect([...d.querySelectorAll<HTMLElement>('[style]')].filter(el => /color/i.test(el.getAttribute('style') ?? ''))).toEqual([]);
    const classes = [...d.querySelectorAll('[class]')].map(el => el.getAttribute('class')).join(' ');
    expect(classes).not.toMatch(/#[0-9a-f]{6}/i);
    expect(classes).not.toMatch(/(gray|emerald|amber|red|blue)-\d/);
    expect(classes).not.toMatch(/text-white/);
    // La categoría elegida: fondo `ink` con el texto que cambia con el tema.
    expect(within(d).getByRole('button', { name: 'Salud' }).className).toMatch(/bg-ink text-on-ink/);
  });

  test('"Mostrar…" aplica lo elegido y cierra', () => {
    const { d, onApply, onClose } = open([p('1')]);
    fireEvent.click(within(d).getByRole('button', { name: /^Sin costo/ }));
    fireEvent.click(within(d).getByRole('button', { name: 'Híbrido' }));
    fireEvent.click(within(d).getByRole('button', { name: /^Mostrar/ }));
    expect(onApply).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, cost: 'gratis', modality: 'hibrido' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('"Limpiar filtros" vuelve todo a cero sin cerrar', () => {
    const { d, onReset, onClose } = open([], { categories: ['Salud'], type: 'sostenido', modality: 'remoto', cost: 'gratis', hours: 'hasta2' });
    fireEvent.click(within(d).getByRole('button', { name: 'Limpiar filtros' }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(within(d).getByRole('button', { name: 'Salud' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(d).getByRole('button', { name: /^Todos/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(d).getAllByRole('button', { name: /^Cualquiera/ }).every(b => b.getAttribute('aria-pressed') === 'true')).toBe(true);
  });

  test('cerrada no dibuja nada', () => {
    render(<FilterModal isOpen={false} onClose={() => {}} allProjects={[]} searchQuery="" currentFilters={DEFAULT_FILTERS} onApply={() => {}} onReset={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
