// src/app/components/StaleResponsesById.test.tsx
//
// F15 (§83) en el resto de las pantallas que cargan por un parámetro de la URL: detalle de proyecto, perfiles
// públicos de ONG y empresa, y las pantallas de la ONG por proyecto (inscriptos, KPIs) y de su equipo. Si se pasa
// del recurso A al B sin desmontar la pantalla (otro link de la misma ruta, o atrás/adelante del navegador) y la
// respuesta de A llega última, se mostraba A bajo la URL de B. Mismo método que StaleResponses.test.tsx:
// promesas que el test resuelve en el orden que quiere (primero la nueva, después la vieja).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router';
import type { ReactElement } from 'react';
import { deferred } from '../../test/postFixtures';

vi.mock('../../lib/AuthContext', () => {
  const auth = { user: { id: 'u-ngo', name: 'ONG', role: 'ngo' }, openAuthModal: () => {}, initializing: false };
  return { useAuth: () => auth };
});
vi.mock('./MomentsGrid', () => ({ MomentsGrid: () => null }));
vi.mock('./MomentsFeed', () => ({ MomentsFeed: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      projects: { ...actual.api.projects, get: vi.fn(), kpis: { ...actual.api.projects.kpis, list: vi.fn() } },
      ngos: { ...actual.api.ngos, get: vi.fn() },
      empresas: { ...actual.api.empresas, get: vi.fn() },
      enrollments: { ...actual.api.enrollments, byProject: vi.fn() },
      follows: { ...actual.api.follows,
        projectStatus: vi.fn().mockResolvedValue({ following: false }),
        ngoStatus: vi.fn().mockResolvedValue({ following: false }) },
    },
  };
});

import { api } from '../../lib/api';
import { ProjectDetails } from './ProjectDetails';
import { NGOPublicProfile } from './NGOPublicProfile';
import { CompanyPublicProfile } from './CompanyPublicProfile';
import { NGOProjectDetail } from './NGOProjectDetail';
import { NGOKPIs } from './NGOKPIs';
import { NGOEmpleados } from './NGOEmpleados';

function Go({ to }: { to: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>ir a {to}</button>;
}
const mount = (from: string, to: string, route: string, el: ReactElement) => render(
  <MemoryRouter initialEntries={[from]}>
    <Go to={to} />
    <Routes><Route path={route} element={el} /></Routes>
  </MemoryRouter>
);
/** mockImplementation que devuelve una promesa distinta según el id: la del test decide cuándo se resuelve. */
const byId = (map: Record<string, Promise<unknown>>) => ((id: string) => map[id]) as never;

const project = (id: string, title: string) => ({
  id, ngo_id: 'ngo-1', title, description: 'd', full_description: 'd', category: 'x', location: 'Córdoba', type: 'fugaz',
  status: 'active', volunteers_needed: 10, current_volunteers: 0, funding_goal: 0, current_funding: 0, cost_per_person: 0,
  followers: 0, ngo_name: 'ONG', roles_needed: [], requirements: [], comments: [], ratings: [], kpis: [], my_enrollment: null,
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as never;
});

describe('F15 en pantallas por :id — la respuesta vieja no pisa a la nueva', () => {
  test('detalle de proyecto: de A a B, A llega última → se ve B', async () => {
    const a = deferred<unknown>(); const b = deferred<unknown>();
    vi.mocked(api.projects.get).mockImplementation(byId({ 'p-a': a.promise, 'p-b': b.promise }));
    mount('/project/p-a', '/project/p-b', '/project/:id', <ProjectDetails />);
    fireEvent.click(screen.getByText('ir a /project/p-b'));
    await act(async () => { b.resolve({ project: project('p-b', 'Proyecto Bravo') }); });
    await act(async () => { a.resolve({ project: project('p-a', 'Proyecto Alfa') }); });
    expect(screen.getAllByText('Proyecto Bravo').length).toBeGreaterThan(0);
    expect(screen.queryByText('Proyecto Alfa')).not.toBeInTheDocument();
  });

  test('detalle de proyecto: si A falla al final, no tapa a B con un error', async () => {
    const a = deferred<unknown>(); const b = deferred<unknown>();
    vi.mocked(api.projects.get).mockImplementation(byId({ 'p-a': a.promise, 'p-b': b.promise }));
    mount('/project/p-a', '/project/p-b', '/project/:id', <ProjectDetails />);
    fireEvent.click(screen.getByText('ir a /project/p-b'));
    await act(async () => { b.resolve({ project: project('p-b', 'Proyecto Bravo') }); });
    await act(async () => { a.reject(new Error('fallo')); });
    expect(screen.getAllByText('Proyecto Bravo').length).toBeGreaterThan(0);
  });

  test('perfil de ONG: de A a B, A llega última → se ve B', async () => {
    const a = deferred<unknown>(); const b = deferred<unknown>();
    vi.mocked(api.ngos.get).mockImplementation(byId({ 'n-a': a.promise, 'n-b': b.promise }));
    mount('/ngo/n-a', '/ngo/n-b', '/ngo/:id', <NGOPublicProfile />);
    fireEvent.click(screen.getByText('ir a /ngo/n-b'));
    const ngo = (id: string, name: string) => ({ ngo: { id, user_id: `u-${id}`, name, followers: 0 }, projects: [] });
    await act(async () => { b.resolve(ngo('n-b', 'ONG Bravo')); });
    await act(async () => { a.resolve(ngo('n-a', 'ONG Alfa')); });
    expect(screen.getAllByText('ONG Bravo').length).toBeGreaterThan(0);
    expect(screen.queryByText('ONG Alfa')).not.toBeInTheDocument();
  });

  test('perfil de empresa: de A a B, A llega última → se ve B', async () => {
    const a = deferred<unknown>(); const b = deferred<unknown>();
    vi.mocked(api.empresas.get).mockImplementation(byId({ 'e-a': a.promise, 'e-b': b.promise }));
    mount('/company/e-a', '/company/e-b', '/company/:id', <CompanyPublicProfile />);
    fireEvent.click(screen.getByText('ir a /company/e-b'));
    const emp = (id: string, name: string) => ({ empresa: { id, user_id: `u-${id}`, name, followers: 0 } });
    await act(async () => { b.resolve(emp('e-b', 'Empresa Bravo')); });
    await act(async () => { a.resolve(emp('e-a', 'Empresa Alfa')); });
    expect(screen.getAllByText('Empresa Bravo').length).toBeGreaterThan(0);
    expect(screen.queryByText('Empresa Alfa')).not.toBeInTheDocument();
  });

  test('inscriptos de un proyecto (ONG): de A a B, A llega última → se ven los de B', async () => {
    const a = deferred<unknown>(); const b = deferred<unknown>();
    vi.mocked(api.projects.get).mockImplementation(((id: string) =>
      Promise.resolve({ project: project(id, id === 'p-a' ? 'Proyecto Alfa' : 'Proyecto Bravo') })) as never);
    vi.mocked(api.enrollments.byProject).mockImplementation(byId({ 'p-a': a.promise, 'p-b': b.promise }));
    mount('/ngo/dashboard/project/p-a', '/ngo/dashboard/project/p-b', '/ngo/dashboard/project/:projectId', <NGOProjectDetail />);
    fireEvent.click(screen.getByText('ir a /ngo/dashboard/project/p-b'));
    const enr = (id: string, name: string) => ({ enrollments: [{ id, user_id: `u-${id}`, project_id: 'x', status: 'pending',
      volunteer_name: name, volunteer_email: `${id}@x.com`, created_at: '2026-10-15 12:00:00' }] });
    await act(async () => { b.resolve(enr('e-b', 'Voluntaria Bravo')); });
    await act(async () => { a.resolve(enr('e-a', 'Voluntaria Alfa')); });
    expect(screen.getAllByText('Voluntaria Bravo').length).toBeGreaterThan(0);
    expect(screen.queryByText('Voluntaria Alfa')).not.toBeInTheDocument();
    expect(screen.queryByText('Proyecto Alfa')).not.toBeInTheDocument();
  });

  test('KPIs (ONG): de A a B, A llega última → se ven los KPIs y el título de B', async () => {
    const ka = deferred<unknown>(); const kb = deferred<unknown>();
    const pa = deferred<unknown>(); const pb = deferred<unknown>();
    vi.mocked(api.projects.kpis.list).mockImplementation(byId({ 'p-a': ka.promise, 'p-b': kb.promise }));
    vi.mocked(api.projects.get).mockImplementation(byId({ 'p-a': pa.promise, 'p-b': pb.promise }));
    mount('/ngo/kpis/p-a', '/ngo/kpis/p-b', '/ngo/kpis/:projectId', <NGOKPIs />);
    fireEvent.click(screen.getByText('ir a /ngo/kpis/p-b'));
    const kpi = (id: string, nombre: string) => ({ kpis: [{ id, project_id: 'x', nombre, valor: 1, tipo_valor: 'numero', unidad: 'u', fecha: null }] });
    await act(async () => { kb.resolve(kpi('k-b', 'KPI Bravo')); pb.resolve({ project: project('p-b', 'Proyecto Bravo') }); });
    await act(async () => { ka.resolve(kpi('k-a', 'KPI Alfa')); pa.resolve({ project: project('p-a', 'Proyecto Alfa') }); });
    expect(screen.getAllByText('KPI Bravo').length).toBeGreaterThan(0);
    expect(screen.queryByText('KPI Alfa')).not.toBeInTheDocument();
    expect(screen.getByText('Proyecto Bravo')).toBeInTheDocument();
    expect(screen.queryByText('Proyecto Alfa')).not.toBeInTheDocument();
  });

  test('equipo de la ONG: de A a B, A llega última → se ve el equipo de B', async () => {
    const a = deferred<unknown>(); const b = deferred<unknown>();
    vi.stubGlobal('fetch', vi.fn((url: string) => (String(url).includes('/ngos/n-a/') ? a.promise : b.promise)));
    mount('/ngo/empleados/n-a', '/ngo/empleados/n-b', '/ngo/empleados/:id', <NGOEmpleados />);
    fireEvent.click(screen.getByText('ir a /ngo/empleados/n-b'));
    const res = (nombre: string) => ({ ok: true, json: async () => ({ empleados: [{ id: nombre, nombre, apellido: 'X', email: 'e@x.com', rol: 'coordinador' }] }) });
    await act(async () => { b.resolve(res('Bravo')); });
    await act(async () => { a.resolve(res('Alfa')); });
    expect(screen.getByText('Bravo X')).toBeInTheDocument();
    expect(screen.queryByText('Alfa X')).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

// Los otros dos órdenes de llegada, en las seis pantallas (la mutación mostró que el test de arriba solo cubría
// "la nueva primero"): la vieja FALLA al final (su error no tapa a la nueva) y la vieja llega PRIMERO con la nueva
// en vuelo (se sigue viendo "cargando", no la pantalla con datos vacíos o viejos).
type Case = {
  name: string; from: string; to: string; route: string; el: () => ReactElement; loading: string; bText: string;
  setup: (a: Promise<unknown>, b: Promise<unknown>) => void;
  a: () => unknown; b: () => unknown; reject?: (e: Error) => unknown;
};
const CASES: Case[] = [
  { name: 'detalle de proyecto', from: '/project/p-a', to: '/project/p-b', route: '/project/:id', el: () => <ProjectDetails />,
    loading: 'Cargando voluntariado', bText: 'Proyecto Bravo',
    setup: (a, b) => vi.mocked(api.projects.get).mockImplementation(byId({ 'p-a': a, 'p-b': b })),
    a: () => ({ project: project('p-a', 'Proyecto Alfa') }), b: () => ({ project: project('p-b', 'Proyecto Bravo') }) },
  { name: 'perfil de ONG', from: '/ngo/n-a', to: '/ngo/n-b', route: '/ngo/:id', el: () => <NGOPublicProfile />,
    loading: 'Cargando organización', bText: 'ONG Bravo',
    setup: (a, b) => vi.mocked(api.ngos.get).mockImplementation(byId({ 'n-a': a, 'n-b': b })),
    a: () => ({ ngo: { id: 'n-a', user_id: 'u-a', name: 'ONG Alfa', followers: 0 }, projects: [] }),
    b: () => ({ ngo: { id: 'n-b', user_id: 'u-b', name: 'ONG Bravo', followers: 0 }, projects: [] }) },
  { name: 'perfil de empresa', from: '/company/e-a', to: '/company/e-b', route: '/company/:id', el: () => <CompanyPublicProfile />,
    loading: 'Cargando empresa', bText: 'Empresa Bravo',
    setup: (a, b) => vi.mocked(api.empresas.get).mockImplementation(byId({ 'e-a': a, 'e-b': b })),
    a: () => ({ empresa: { id: 'e-a', user_id: 'u-a', name: 'Empresa Alfa', followers: 0 } }),
    b: () => ({ empresa: { id: 'e-b', user_id: 'u-b', name: 'Empresa Bravo', followers: 0 } }) },
  { name: 'inscriptos (ONG)', from: '/ngo/dashboard/project/p-a', to: '/ngo/dashboard/project/p-b',
    route: '/ngo/dashboard/project/:projectId', el: () => <NGOProjectDetail />, loading: 'Cargando voluntariado', bText: 'Voluntaria Bravo',
    setup: (a, b) => {
      vi.mocked(api.projects.get).mockImplementation(((id: string) =>
        Promise.resolve({ project: project(id, id === 'p-a' ? 'Proyecto Alfa' : 'Proyecto Bravo') })) as never);
      vi.mocked(api.enrollments.byProject).mockImplementation(byId({ 'p-a': a, 'p-b': b }));
    },
    a: () => ({ enrollments: [{ id: 'e-a', user_id: 'u-a', project_id: 'x', status: 'pending', volunteer_name: 'Voluntaria Alfa', volunteer_email: 'a@x.com', created_at: '' }] }),
    b: () => ({ enrollments: [{ id: 'e-b', user_id: 'u-b', project_id: 'x', status: 'pending', volunteer_name: 'Voluntaria Bravo', volunteer_email: 'b@x.com', created_at: '' }] }) },
  { name: 'KPIs (ONG)', from: '/ngo/kpis/p-a', to: '/ngo/kpis/p-b', route: '/ngo/kpis/:projectId', el: () => <NGOKPIs />,
    loading: 'Cargando KPIs', bText: 'KPI Bravo',
    setup: (a, b) => {
      vi.mocked(api.projects.get).mockResolvedValue({ project: project('p', 'Proyecto') } as never);
      vi.mocked(api.projects.kpis.list).mockImplementation(byId({ 'p-a': a, 'p-b': b }));
    },
    a: () => ({ kpis: [{ id: 'k-a', project_id: 'x', nombre: 'KPI Alfa', valor: 1, tipo_valor: 'numero', unidad: 'u', fecha: null }] }),
    b: () => ({ kpis: [{ id: 'k-b', project_id: 'x', nombre: 'KPI Bravo', valor: 1, tipo_valor: 'numero', unidad: 'u', fecha: null }] }) },
  { name: 'equipo (ONG)', from: '/ngo/empleados/n-a', to: '/ngo/empleados/n-b', route: '/ngo/empleados/:id', el: () => <NGOEmpleados />,
    loading: 'Cargando equipo', bText: 'Bravo X',
    setup: (a, b) => vi.stubGlobal('fetch', vi.fn((url: string) => (String(url).includes('/ngos/n-a/') ? a : b))),
    a: () => ({ ok: true, json: async () => ({ empleados: [{ id: 'a', nombre: 'Alfa', apellido: 'X', email: 'a@x.com', rol: 'coordinador' }] }) }),
    b: () => ({ ok: true, json: async () => ({ empleados: [{ id: 'b', nombre: 'Bravo', apellido: 'X', email: 'b@x.com', rol: 'coordinador' }] }) }) },
];

describe('F15 en pantallas por :id — los otros órdenes de llegada', () => {
  for (const c of CASES) {
    test(`${c.name}: la vieja falla al final → no tapa ni vacía a la nueva`, async () => {
      const a = deferred<unknown>(); const b = deferred<unknown>();
      c.setup(a.promise, b.promise);
      mount(c.from, c.to, c.route, c.el());
      fireEvent.click(screen.getByText(`ir a ${c.to}`));
      await act(async () => { b.resolve(c.b()); });
      await act(async () => { a.reject(new Error('fallo de la vieja')); });
      expect(screen.getAllByText(c.bText).length).toBeGreaterThan(0);
      vi.unstubAllGlobals();
    });

    test(`${c.name}: la vieja llega primero con la nueva en vuelo → sigue "cargando", sin datos viejos`, async () => {
      const a = deferred<unknown>(); const b = deferred<unknown>();
      c.setup(a.promise, b.promise);
      mount(c.from, c.to, c.route, c.el());
      fireEvent.click(screen.getByText(`ir a ${c.to}`));
      await act(async () => { a.resolve(c.a()); });
      expect(screen.getByRole('status', { name: c.loading })).toBeInTheDocument();
      await act(async () => { b.resolve(c.b()); });
      expect(screen.getAllByText(c.bText).length).toBeGreaterThan(0);
      vi.unstubAllGlobals();
    });
  }
});
