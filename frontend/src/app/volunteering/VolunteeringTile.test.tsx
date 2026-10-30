// La tarjeta de Explorar (4:5) recorta la foto: se ve la parte que eligió la ONG (§297).
import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Project } from '../../lib/api';
import { VolunteeringTile } from './VolunteeringTile';

const project = (over: Partial<Project> = {}) => ({
  id: 'p1', ngo_id: 'n1', title: 'Huerta', description: 'd', category: 'Ambiente', location: 'Córdoba', type: 'fugaz',
  volunteers_needed: 10, current_volunteers: 2, funding_goal: 0, current_funding: 0, cost_per_person: 0, image: 'https://x/foto.jpg', ...over,
}) as Project;
const img = (over: Partial<Project>) => render(<MemoryRouter><VolunteeringTile project={project(over)} /></MemoryRouter>).container.querySelector('img');

describe('VolunteeringTile: encuadre', () => {
  test('abajo, arriba y, sin dato, al centro', () => {
    expect(img({ image_position: 'bottom' })).toHaveClass('object-bottom');
    expect(img({ image_position: 'top' })).toHaveClass('object-top');
    expect(img({})).toHaveClass('object-center');
  });
});
