// src/app/components/A11yNames.test.tsx
//
// REVISION F13: botones de solo ícono (cerrar, volver, enviar, aprobar/rechazar, editar/borrar, estrellas…) y
// campos sin etiqueta asociada. Un lector de pantalla los anunciaba como "botón" o "campo de edición", sin decir
// qué hacen; aprobar y rechazar una inscripción eran indistinguibles.
//
// Chequeo general: se monta cada pantalla (con los formularios abiertos) y se exige que NINGÚN botón ni campo
// tenga nombre accesible vacío. `queryAllByRole(rol, { name: '' })` usa el mismo cálculo de nombre que los
// lectores de pantalla (aria-label, <label>, texto visible, title).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import type { ReactElement } from 'react';

// vi.mock se eleva arriba de todo: los datos que usan los mocks van en vi.hoisted.
const { auth, project, ngo, empresa } = vi.hoisted(() => {
  const auth = {
    user: { id: 'u-vol', name: 'María García', email: 'maria@example.com', role: 'volunteer' } as Record<string, unknown>,
    showAuthModal: true, authModalIntent: '', authModalTab: 'login' as 'login' | 'register',
    openAuthModal: vi.fn(), closeAuthModal: vi.fn(), setAuthModalTab: vi.fn(),
    login: vi.fn(), register: vi.fn(), logout: vi.fn(), loading: false, initializing: false, token: 't',
  };
  const project = {
    id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación', description: 'd', full_description: 'd', category: 'Medio Ambiente',
    location: 'Córdoba', type: 'fugaz', status: 'active', volunteers_needed: 10, current_volunteers: 1, funding_goal: 0,
    current_funding: 0, cost_per_person: 0, followers: 0, ngo_name: 'Sustentando', roles: ['Coordinador'], requirements: ['Mayor de 18'],
    comments: [], ratings: [], categories: [], tags: [], gallery: [], my_enrollment_status: 'approved', is_following: false,
    is_participant: true, can_manage: false, image: '', my_enrollment: { status: 'approved' },
  };
  const ngo = { id: 'ngo-1', name: 'Sustentando', description: 'd', mission: 'm', location: 'Córdoba', category: 'Medio Ambiente', followers: 3 };
  const empresa = { id: 'emp-1', name: 'TechCorp', description: 'd', mission: 'm', location: 'Córdoba', industry: 'Tecnología', category: '' };
  return { auth, project, ngo, empresa };
});
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/ChatContext', () => ({
  useChat: () => ({ onMessage: () => () => {}, refreshConversations: () => {} }),
}));
vi.mock('./MomentsGrid', () => ({ MomentsGrid: () => null }));
vi.mock('./MomentsFeed', () => ({ MomentsFeed: () => null }));
vi.mock('./ProjectMap', () => ({ ProjectMap: () => null }));

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  const ok = (v: unknown) => vi.fn().mockResolvedValue(v);
  return {
    ...actual,
    api: {
      ...actual.api,
      projects: {
        ...actual.api.projects,
        get: ok({ project }), list: ok({ projects: [project] }), recommended: ok({ projects: [] }),
        comment: vi.fn(), rate: vi.fn(), create: vi.fn(),
        kpis: { list: ok({ kpis: [{ id: 'k1', project_id: 'proj-1', nombre: 'Árboles', valor: 10, tipo_valor: 'numero', unidad: 'u', fecha: null }] }),
          create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      },
      ngos: {
        ...actual.api.ngos,
        me: ok({ ngo, projects: [project], stats: { total_projects: 1, active_projects: 1, total_volunteers: 1, pending: 1 },
          pending_enrollments: [{ id: 'e1', project_id: 'proj-1', project_title: 'Reforestación', volunteer_name: 'Juan Pérez', volunteer_email: 'j@x.com' }] }),
        get: ok({ ngo, projects: [project] }), update: vi.fn(),
      },
      empresas: {
        ...actual.api.empresas,
        me: ok({ empresa }), get: ok({ empresa }), update: vi.fn(),
        patrocinios: { list: ok({ patrocinios: [] }), propose: vi.fn(), withdraw: vi.fn() },
      },
      enrollments: {
        ...actual.api.enrollments,
        byProject: ok({ enrollments: [{ id: 'e2', user_id: 'u-2', volunteer_name: 'Ana', volunteer_email: 'a@x.com', status: 'approved', hours_logged: 0 }] }),
        updateStatus: vi.fn(), logHours: vi.fn(), enroll: vi.fn(), my: ok({ enrollments: [] }),
      },
      follows: {
        ...actual.api.follows,
        projectStatus: ok({ following: false }), ngoStatus: ok({ following: false }),
        myNgos: ok({ ngos: [] }), myFollowing: ok({ volunteers: [] }), myFollowers: ok({ volunteers: [] }),
        volunteerFollowStatus: ok({ following: false }), volunteerFollowers: ok({ volunteers: [] }), volunteerFollowing: ok({ volunteers: [] }),
      },
      catalog: { ...actual.api.catalog, habilidades: ok({ habilidades: [{ id: 'h1', nombre: 'Primeros auxilios' }] }) },
      voluntarios: { ...actual.api.voluntarios,
        habilidades: { list: ok({ habilidades: [{ id: 'h1', nombre: 'Primeros auxilios', nivel: 'basico' }] }), update: vi.fn() },
        getProfile: ok({ volunteer: { id: 'user-55', name: 'Ana', avatar: null, bio: '', location: '', followers: 0, following_count: 0 },
          habilidades: [], stats: { total_enrollments: 0, approved_enrollments: 0, total_horas: 0 }, participaciones: [] }) },
      messages: { ...actual.api.messages,
        thread: ok({ messages: [{ id: 'm1', sender_id: 'u-2', receiver_id: 'u-vol', body: 'Hola', created_at: '2026-10-14T12:00:00Z', read: true }],
          other: { id: 'u-2', name: 'Juan' } }),
        markRead: ok({}), send: vi.fn() },
      notifications: { ...actual.api.notifications, list: ok({ notifications: [] }), markAllRead: vi.fn() },
      faqs: { list: ok({ faqs: [] }), ask: vi.fn() },
    },
  };
});

import { AuthModal } from './AuthModal';
import { ChatbotWidget } from './ChatbotWidget';
import { ChatThread } from './ChatThread';
import { ReviewModal } from './ReviewModal';
import { ReviewsModal } from './ReviewsModal';
import { NGOKPIs } from './NGOKPIs';
import { NGODashboard } from './NGODashboard';
import { NGOOwnProfile } from './NGOOwnProfile';
import { CompanyOwnProfile } from './CompanyOwnProfile';
import { VolunteerProfile } from './VolunteerProfile';
import { CreateVoluntariado } from './CreateVoluntariado';
import { ProjectDetails } from './ProjectDetails';
import { ExploreScreen } from './ExploreScreen';
import { NGOProjectDetail } from './NGOProjectDetail';
import { NotificationsScreen } from './NotificationsScreen';
import { CompanyPublicProfile } from './CompanyPublicProfile';
import { NGOPublicProfile } from './NGOPublicProfile';
import { PublicFeed } from './PublicFeed';
import { FeedPostCard } from './FeedPostCard';
import { NGOEmpleados } from './NGOEmpleados';
import { VolunteerPublicProfile } from './VolunteerPublicProfile';

const ROLES = ['button', 'textbox', 'combobox', 'spinbutton', 'searchbox', 'link'] as const;

/** Elementos interactivos sin nombre accesible (y los <input type="date">, que no tienen rol en jsdom). */
function unnamed(root: HTMLElement = document.body): string[] {
  const els = ROLES.flatMap((r) => within(root).queryAllByRole(r, { name: '' }));
  root.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach((d) => {
    if (!d.getAttribute('aria-label') && !d.labels?.length) els.push(d);
  });
  return els.map((e) => e.outerHTML.replace(/\s+/g, ' ').slice(0, 140));
}

const at = (path: string, route: string, el: ReactElement) =>
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={el} /></Routes></MemoryRouter>);
const as = (role: string, extra: Record<string, unknown> = {}) => {
  auth.user = { id: `u-${role}`, name: 'Usuario', email: 'u@x.com', role, ...extra };
};

beforeEach(() => {
  as('volunteer');
  auth.showAuthModal = true;
  window.scrollTo = vi.fn() as never;
  Element.prototype.scrollIntoView = vi.fn(); // jsdom no lo implementa (ChatThread y el chatbot lo usan)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ empleados: [] }) }));
});

describe('todo botón y campo tiene nombre accesible', () => {
  test('AuthModal (login y registro): cerrar, mostrar/ocultar contraseña y los tres campos', () => {
    render(<MemoryRouter><AuthModal /></MemoryRouter>);
    expect(unnamed()).toEqual([]);
    const eye = screen.getByRole('button', { name: 'Mostrar contraseña' });
    expect(eye).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(eye);
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getAllByRole('button', { name: 'Crear cuenta' })[0]);
    expect(screen.getByRole('textbox', { name: 'Nombre completo' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
  });

  test('ChatbotWidget abierto', async () => {
    render(<MemoryRouter><ChatbotWidget /></MemoryRouter>);
    fireEvent.click(screen.getByTitle('Ayuda rápida'));
    expect(screen.getByRole('button', { name: 'Enviar pregunta' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
  });

  test('ChatThread: volver, campo del mensaje y enviar', async () => {
    at('/messages/u-2', '/messages/:userId', <ChatThread />);
    await screen.findByText('Hola');
    expect(screen.getByRole('textbox', { name: 'Mensaje' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
  });

  test('ReviewModal: cerrar y estrellas con nombre y estado', () => {
    render(<ReviewModal projectId="p" projectTitle="Plantación" onClose={() => {}} onSaved={() => {}} />);
    const three = screen.getByRole('button', { name: '3 estrellas' });
    fireEvent.click(three);
    expect(three).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '1 estrella' })).toHaveAttribute('aria-pressed', 'false');
    expect(unnamed()).toEqual([]);
  });

  test('ReviewsModal (con calificación habilitada)', async () => {
    render(<MemoryRouter><ReviewsModal isOpen onClose={() => {}} projectId="proj-1" projectTitle="Reforestación"
      avgRating={0} initialRatings={[]} canRate onReviewAdded={() => {}} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: '5 estrellas' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '4 estrellas' }));
    expect(screen.getByRole('button', { name: '4 estrellas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '5 estrellas' })).toHaveAttribute('aria-pressed', 'false');
    expect(unnamed()).toEqual([]);
  });

  test('NGOKPIs: volver, editar/borrar con el nombre del KPI y el formulario completo', async () => {
    as('ngo');
    at('/ngo/kpis/proj-1', '/ngo/kpis/:projectId', <NGOKPIs />);
    expect(await screen.findByRole('button', { name: 'Editar KPI Árboles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Borrar KPI Árboles' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar KPI Árboles' }));
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
  });

  test('NGODashboard: aprobar y rechazar se distinguen y dicen a quién', async () => {
    as('ngo');
    render(<MemoryRouter><NGODashboard /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Aprobar a Juan Pérez en Reforestación' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar a Juan Pérez en Reforestación' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
  });

  test('NGOOwnProfile en edición', async () => {
    as('ngo');
    render(<MemoryRouter><NGOOwnProfile /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar perfil' }));
    expect(screen.getByRole('button', { name: 'Cancelar edición' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
  });

  test('CompanyOwnProfile en edición y con el formulario de propuesta abierto', async () => {
    as('company');
    render(<MemoryRouter><CompanyOwnProfile /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar perfil' }));
    expect(screen.getByRole('textbox', { name: 'Industria / Rubro' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
    // la edición reemplaza la sección de patrocinios: se cierra para abrir la propuesta
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar edición' }));
    fireEvent.click(screen.getByRole('button', { name: 'Proponer' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Proyecto a patrocinar' })).toBeInTheDocument());
    expect(unnamed()).toEqual([]);
  });

  test('VolunteerProfile en edición (con nivel de habilidad)', async () => {
    as('volunteer', { bio: '', location: '' });
    render(<MemoryRouter><VolunteerProfile /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar perfil' }));
    expect(await screen.findByRole('combobox', { name: 'Nivel de Primeros auxilios' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /Seguidores/ }));
    const list = await screen.findByRole('dialog', { name: 'Seguidores' });
    expect(within(list).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
  });

  test('CreateVoluntariado: volver, agregar/quitar roles y requisitos, todos los campos', async () => {
    as('ngo');
    render(<MemoryRouter><CreateVoluntariado /></MemoryRouter>);
    const fill = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
    // es un formulario en 3 pasos: se revisa cada uno
    expect(unnamed()).toEqual([]);
    // sostenido: el paso 2 pide horas por semana en vez de duración
    fireEvent.click(screen.getByRole('button', { name: /Sostenido/ }));
    fill('Título del voluntariado', 'Limpieza del río');
    fill('Descripción corta', 'Juntamos residuos en la costanera');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(unnamed()).toEqual([]);
    expect(screen.getByRole('spinbutton', { name: 'Horas por semana' })).toBeInTheDocument();
    fill('Ubicación', 'Córdoba');
    fill('Horas por semana', '4');
    fill('Voluntarios necesarios', '10');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rol personalizado' }), { target: { value: 'Cocinero' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar rol' }));
    expect(screen.getByRole('button', { name: 'Quitar rol Cocinero' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Requisito personalizado' }), { target: { value: 'Gorra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar requisito' }));
    expect(screen.getByRole('button', { name: 'Quitar requisito Gorra' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
  });

  test('ProjectDetails: volver, estrellas, reseña y comentario', async () => {
    at('/project/proj-1', '/project/:id', <ProjectDetails />);
    await screen.findAllByText('Reforestación');
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /^Reseñas/ }));
    const two = screen.getByRole('button', { name: '2 estrellas' });
    fireEvent.click(two);
    expect(two).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '5 estrellas' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('textbox', { name: 'Tu reseña' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /^Comentarios/ }));
    expect(screen.getByRole('textbox', { name: 'Comentario' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar comentario' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
  });

  test('ExploreScreen con búsqueda: limpiar búsqueda', async () => {
    render(<MemoryRouter><ExploreScreen /></MemoryRouter>);
    const search = await screen.findByRole('textbox', { name: 'Buscar voluntariados' });
    fireEvent.change(search, { target: { value: 'río' } });
    expect(screen.getByRole('button', { name: 'Limpiar búsqueda' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
  });

  test('NGOProjectDetail: horas de cada voluntario con su nombre', async () => {
    as('ngo');
    at('/ngo/dashboard/project/proj-1', '/ngo/dashboard/project/:projectId', <NGOProjectDetail />);
    expect(await screen.findByRole('spinbutton', { name: 'Horas de Ana' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
  });

  test('pantallas con "volver": notificaciones, empresa, ONG, empleados', async () => {
    const cases: [string, string, ReactElement, string][] = [
      ['/notifications', '/notifications', <NotificationsScreen />, 'Notificaciones'],
      ['/company/emp-1', '/company/:id', <CompanyPublicProfile />, 'TechCorp'],
      ['/ngo/ngo-1', '/ngo/:id', <NGOPublicProfile />, 'Sustentando'],
      ['/ngo/empleados/ngo-1', '/ngo/empleados/:id', <NGOEmpleados />, 'Equipo'],
    ];
    for (const [path, route, el, text] of cases) {
      const { unmount } = at(path, route, el);
      await screen.findAllByText(new RegExp(text));
      expect(screen.getAllByRole('button', { name: 'Volver' }).length).toBeGreaterThan(0);
      expect(unnamed()).toEqual([]);
      unmount();
    }
  });

  test('VolunteerPublicProfile: volver y la lista de seguidores', async () => {
    at('/volunteer/user-55', '/volunteer/:id', <VolunteerPublicProfile />);
    await screen.findAllByText('Ana');
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Enviar mensaje a Ana' })).toHaveAttribute('href', '/messages/user-55');
    expect(unnamed()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /Seguidores/ }));
    const list = await screen.findByRole('dialog', { name: 'Seguidores' });
    expect(within(list).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
  });

  test('NGOEmpleados con el formulario abierto', async () => {
    as('ngo');
    at('/ngo/empleados/ngo-1', '/ngo/empleados/:id', <NGOEmpleados />);
    fireEvent.click(await screen.findByRole('button', { name: /Agregar/ }));
    expect(screen.getByRole('textbox', { name: 'Apellido' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
  });

  test('PublicFeed (visitante) y FeedPostCard', async () => {
    auth.user = null as never;
    const { unmount } = render(<MemoryRouter><PublicFeed /></MemoryRouter>);
    await screen.findAllByText('Reforestación');
    expect(unnamed()).toEqual([]);
    unmount();
    as('volunteer');
    render(<MemoryRouter><FeedPostCard project={project as never} onRefresh={() => {}} /></MemoryRouter>);
    expect(unnamed()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Expandir detalles' }));
    expect(screen.getByRole('textbox', { name: 'Comentario' })).toBeInTheDocument();
    expect(unnamed()).toEqual([]);
  });
});
