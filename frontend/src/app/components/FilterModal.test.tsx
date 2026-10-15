// src/app/components/FilterModal.test.tsx
import { describe, test, expect } from 'vitest';
import { filterProjects, DEFAULT_FILTERS } from './FilterModal';
import type { Project } from '../../lib/api';

function makeProject(overrides: Partial<Project>): Project {
  return {
    id: 'p1', ngo_id: 'ngo-1', title: 'Test', description: '', category: 'Educación',
    location: '', duration: '', type: 'fugaz', status: 'active', volunteers_needed: 5,
    current_volunteers: 0, funding_goal: 0, current_funding: 0, cost_per_person: 0,
    ...overrides,
  } as Project;
}

describe('filterProjects — filtro de modalidad', () => {
  // Regresión: un proyecto remoto cuya ubicación es el medio digital (ej.
  // "Zoom", "Google Meet" — justo lo que CreateVoluntariado.tsx sugiere
  // cargar ahí) debe aparecer bajo el filtro "remoto" aunque el texto de la
  // ubicación no contenga la palabra "remoto".
  test('un proyecto remoto con ubicación "Zoom" pasa el filtro remoto', () => {
    const p = makeProject({ modality: 'remoto', location: 'Zoom' });
    const result = filterProjects([p], '', { ...DEFAULT_FILTERS, modality: 'remoto' });
    expect(result).toHaveLength(1);
  });

  test('un proyecto presencial no pasa el filtro remoto', () => {
    const p = makeProject({ modality: 'presencial', location: 'Parque Sarmiento' });
    const result = filterProjects([p], '', { ...DEFAULT_FILTERS, modality: 'remoto' });
    expect(result).toHaveLength(0);
  });

  test('un proyecto híbrido pasa el filtro híbrido y no el remoto ni el presencial', () => {
    const p = makeProject({ modality: 'hibrido', location: 'Parque Sarmiento y Google Meet' });
    expect(filterProjects([p], '', { ...DEFAULT_FILTERS, modality: 'hibrido' })).toHaveLength(1);
    expect(filterProjects([p], '', { ...DEFAULT_FILTERS, modality: 'remoto' })).toHaveLength(0);
    expect(filterProjects([p], '', { ...DEFAULT_FILTERS, modality: 'presencial' })).toHaveLength(0);
  });

  test('sin filtro de modalidad ("all"), pasan todos', () => {
    const projects = [
      makeProject({ id: 'a', modality: 'remoto', location: 'Zoom' }),
      makeProject({ id: 'b', modality: 'presencial', location: 'Córdoba' }),
      makeProject({ id: 'c', modality: 'hibrido', location: 'Mixto' }),
    ];
    expect(filterProjects(projects, '', DEFAULT_FILTERS)).toHaveLength(3);
  });
});

// REVISION S8: la búsqueda comparaba en minúsculas pero CON acentos: "cordoba" no encontraba "Córdoba" ni
// "educacion" a "Educación". Ahora ignora acentos de los dos lados (como lib/badWords.ts).
describe('filterProjects — búsqueda sin distinguir acentos', () => {
  const ids = (q: string, ps: Project[], f = DEFAULT_FILTERS) => filterProjects(ps, q, f).map(p => p.id);

  test('sin tilde encuentra el texto con tilde, en cada campo buscable', () => {
    const ps = [
      makeProject({ id: 'loc', location: 'Córdoba Capital', category: 'X' }),
      makeProject({ id: 'cat', category: 'Educación' }),
      makeProject({ id: 'tit', title: 'Huerta en el jardín', category: 'X' }),
      makeProject({ id: 'des', description: 'Apoyo a la nutrición', category: 'X' }),
      makeProject({ id: 'ngo', ngo_name: 'Fundación Sol', category: 'X' }),
    ];
    expect(ids('cordoba', ps)).toEqual(['loc']);
    expect(ids('educacion', ps)).toEqual(['cat']);
    expect(ids('jardin', ps)).toEqual(['tit']);
    expect(ids('nutricion', ps)).toEqual(['des']);
    expect(ids('fundacion', ps)).toEqual(['ngo']);
  });

  test('con tilde (o en mayúsculas) encuentra el texto sin tilde', () => {
    const ps = [makeProject({ id: 'a', location: 'Cordoba', category: 'Educacion' })];
    expect(ids('Córdoba', ps)).toEqual(['a']);
    expect(ids('  EDUCACIÓN ', ps)).toEqual(['a']);
  });

  test('la ñ se compara como n (mismo criterio que badWords) y lo que no coincide sigue afuera', () => {
    const ps = [makeProject({ id: 'a', title: 'Niños del barrio', category: 'X' })];
    expect(ids('ninos', ps)).toEqual(['a']);
    expect(ids('niñas', ps)).toEqual([]);
  });

  test('el filtro de categorías también ignora acentos y mayúsculas', () => {
    const ps = [makeProject({ id: 'a', category: 'Educacion' }), makeProject({ id: 'b', category: 'Salud' })];
    expect(ids('', ps, { ...DEFAULT_FILTERS, categories: ['Educación'] })).toEqual(['a']);
    expect(ids('', [makeProject({ id: 'c', category: 'EDUCACIÓN' })], { ...DEFAULT_FILTERS, categories: ['educacion'] })).toEqual(['c']);
  });

  test('un proyecto sin categoría no pasa un filtro de categorías (ni siquiera uno vacío)', () => {
    const ps = [makeProject({ id: 'a', category: undefined }), makeProject({ id: 'b', category: '' })];
    expect(ids('', ps, { ...DEFAULT_FILTERS, categories: ['Educación'] })).toEqual([]);
    expect(ids('', ps, { ...DEFAULT_FILTERS, categories: [''] })).toEqual([]);
  });
});
