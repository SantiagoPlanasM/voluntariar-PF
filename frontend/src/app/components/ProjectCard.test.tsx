// src/app/components/ProjectCard.test.tsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../../lib/AuthContext';
import { ProjectCard } from './ProjectCard';
import type { Project } from '../../lib/api';

// ProjectCard usa useAuth() (necesita <AuthProvider>) y <Link>/useNavigate
// (necesita un router) — este wrapper le da ambas cosas sin pegarle a la
// red: AuthProvider arranca deslogueado si no hay nada en localStorage
// (jsdom empieza siempre vacío en cada test).
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

const baseProject: Project = {
  id: 'proj-1',
  ngo_id: 'ngo-1',
  title: 'Reforestación Urbana',
  description: 'Plantamos árboles nativos',
  location: 'Córdoba',
  type: 'fugaz',
  category: 'Medio Ambiente',
  volunteers_needed: 20,
  current_volunteers: 5,
  funding_goal: 0,
  current_funding: 0,
  cost_per_person: 0,
  followers: 0,
} as Project;

describe('<ProjectCard />', () => {
  test('muestra el título, la ubicación y la categoría del proyecto', () => {
    renderWithProviders(<ProjectCard project={baseProject} />);
    expect(screen.getByText('Reforestación Urbana')).toBeInTheDocument();
    expect(screen.getByText(/Córdoba/)).toBeInTheDocument();
  });

  test('muestra el progreso de voluntarios inscriptos sobre el total', () => {
    renderWithProviders(<ProjectCard project={baseProject} />);
    // La tarjeta muestra "5 / 20" (current_volunteers / volunteers_needed) en un único span
    expect(screen.getByText(/5\s*\/\s*20/)).toBeInTheDocument();
  });

  test('no explota si faltan campos opcionales (funding, roles, etc.)', () => {
    const minimal = { ...baseProject, funding_goal: undefined, current_funding: undefined } as unknown as Project;
    expect(() => renderWithProviders(<ProjectCard project={minimal} />)).not.toThrow();
  });
});
