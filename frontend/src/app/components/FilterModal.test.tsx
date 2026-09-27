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
