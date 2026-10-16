// src/app/components/VolunteerProfileErrors.test.tsx
//
// Perfil propio del voluntario (REVISION S1): las seis cargas (participaciones, catálogo de habilidades, mis
// habilidades, ONGs seguidas, siguiendo, seguidores) se tragaban los errores y la pantalla mostraba
// "Aún no participaste…", "Todavía no sigues a ninguna ONG." y contadores en 0, como si fueran datos.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../lib/AuthContext', () => {
  const auth = {
    user: { id: 'u-me', name: 'María', email: 'm@x.com', role: 'volunteer' },
    openAuthModal: vi.fn(), logout: vi.fn(), login: vi.fn(), initializing: false,
  };
  return { useAuth: () => auth };
});
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      // `me`: lo pide la sección "Mi CV" (§166), que tiene su propio aviso; acá no es lo que se prueba.
      auth: { ...actual.api.auth, updateMe: vi.fn(), me: vi.fn().mockResolvedValue({ user: {}, profile: { has_cv: false } }) },
      enrollments: { ...actual.api.enrollments, my: vi.fn() },
      catalog: { ...actual.api.catalog, habilidades: vi.fn() },
      follows: { ...actual.api.follows, myNgos: vi.fn(), myFollowing: vi.fn(), myFollowers: vi.fn() },
      voluntarios: { ...actual.api.voluntarios, habilidades: { list: vi.fn(), update: vi.fn() } },
    },
  };
});

import { api, ApiError, EnrollmentWithProject, NGO, VolunteerPublic } from '../../lib/api';
import { VolunteerProfile } from './VolunteerProfile';

const enrollment = { id: 'e1', project_id: 'p1', title: 'Reforestación', ngo_name: 'Verde', status: 'approved' } as EnrollmentWithProject;
const ngo = { id: 'n1', name: 'Fundación Verde', followers: 4 } as NGO;
const juan: VolunteerPublic = { user_id: 'u-2', name: 'Juan', followers: 1 };
const skill = { id: 'h1', nombre: 'Primeros auxilios', nivel: 'basico' };

const m = {
  my: vi.mocked(api.enrollments.my), catalog: vi.mocked(api.catalog.habilidades),
  skills: vi.mocked(api.voluntarios.habilidades.list), ngos: vi.mocked(api.follows.myNgos),
  following: vi.mocked(api.follows.myFollowing), followers: vi.mocked(api.follows.myFollowers),
};
const allOk = () => {
  m.my.mockReset().mockResolvedValue({ enrollments: [enrollment] });
  m.catalog.mockReset().mockResolvedValue({ habilidades: [{ id: 'h1', nombre: 'Primeros auxilios' }] });
  m.skills.mockReset().mockResolvedValue({ habilidades: [skill] } as never);
  m.ngos.mockReset().mockResolvedValue({ ngos: [ngo] });
  m.following.mockReset().mockResolvedValue({ volunteers: [juan] });
  m.followers.mockReset().mockResolvedValue({ volunteers: [juan, { ...juan, user_id: 'u-3' }] });
};
const boom = () => new ApiError('Error interno del servidor', 500);
const mount = () => render(<MemoryRouter><VolunteerProfile /></MemoryRouter>);
/** Valor del contador de la tarjeta de estadísticas con esa etiqueta. */
const stat = (label: string) => screen.getByText(label, { selector: 'p' }).previousElementSibling!;

beforeEach(() => {
  allOk();
  vi.mocked(api.auth.updateMe).mockReset().mockResolvedValue({} as never);
  vi.mocked(api.voluntarios.habilidades.update).mockReset().mockResolvedValue({ habilidades: [] } as never);
});

describe('perfil propio: errores de carga (REVISION S1)', () => {
  test('si todo falla: un aviso con "Reintentar", sin textos de vacío ni contadores en 0; reintentar carga todo', async () => {
    for (const fn of Object.values(m)) fn.mockReset().mockRejectedValueOnce(boom());
    allOkAfterFirst();
    mount();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Error interno del servidor');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText('Aún no participaste en ningún proyecto')).toBeNull();
    expect(screen.queryByText('Todavía no sigues a ninguna ONG.')).toBeNull();
    expect(screen.queryByText('Todavía no seguís a ningún voluntario.')).toBeNull();
    for (const label of ['Aprobadas', 'Pendientes', 'Total', 'Seguidores', 'Siguiendo']) expect(stat(label)).toHaveTextContent('—');
    expect(screen.getByText(/Mis ONGs seguidas/)).not.toHaveTextContent('(0)');
    expect(screen.getByText(/Voluntarios que sigo/)).not.toHaveTextContent('(0)');
    // Sin habilidades la sección se oculta; si su carga falló, se ve con el aviso.
    expect(screen.getByText('Habilidades').parentElement).toHaveTextContent('No se pudo cargar.');

    fireEvent.click(within(alert).getByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByText('Fundación Verde')).toBeInTheDocument();
    expect(await screen.findByText('Reforestación')).toBeInTheDocument();
    expect(screen.getByText('Juan')).toBeInTheDocument();
    expect(screen.getByText('Primeros auxilios · Básico')).toBeInTheDocument();
    expect(stat('Seguidores')).toHaveTextContent('2');
    expect(stat('Aprobadas')).toHaveTextContent('1');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('No se pudo cargar.')).toBeNull();
    for (const fn of Object.values(m)) expect(fn).toHaveBeenCalledTimes(2);
  });

  test('si falla solo una sección, el resto se ve normal y esa no dice "todavía no…"', async () => {
    m.ngos.mockReset().mockRejectedValue(boom());
    m.my.mockResolvedValue({ enrollments: [] });
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno del servidor');
    expect(screen.queryByText('Todavía no sigues a ninguna ONG.')).toBeNull();
    expect(screen.getByText('No se pudo cargar.')).toBeInTheDocument();
    // Las otras cargaron bien: su vacío sí es un dato.
    expect(await screen.findByText('Aún no participaste en ningún proyecto')).toBeInTheDocument();
    expect(stat('Total')).toHaveTextContent('0');
    expect(await screen.findByText('Juan')).toBeInTheDocument();
    expect(stat('Seguidores')).toHaveTextContent('2');
  });

  test('sin conexión: mensaje propio, no el "Failed to fetch" del navegador', async () => {
    m.followers.mockReset().mockRejectedValue(new TypeError('Failed to fetch'));
    mount();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar parte de tu perfil. Revisá tu conexión.');
    expect(alert).not.toHaveTextContent('Failed to fetch');
    expect(stat('Seguidores')).toHaveTextContent('—');
    expect(stat('Siguiendo')).toHaveTextContent('1');
  });

  test('si no cargaron tus habilidades, guardar el perfil no las borra (antes mandaba la lista vacía)', async () => {
    m.skills.mockReset().mockRejectedValue(boom());
    mount();
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Editar perfil' }));
    expect(screen.getByText('No pudimos cargar tus habilidades: reintentá para editarlas.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Primeros auxilios' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));
    await vi.waitFor(() => expect(api.auth.updateMe).toHaveBeenCalled());
    expect(api.voluntarios.habilidades.update).not.toHaveBeenCalled();
  });

  test('lo mismo si no cargó el catálogo (no se pueden elegir habilidades)', async () => {
    m.catalog.mockReset().mockRejectedValue(boom());
    mount();
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Editar perfil' }));
    expect(screen.getByText('No pudimos cargar tus habilidades: reintentá para editarlas.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));
    await vi.waitFor(() => expect(api.auth.updateMe).toHaveBeenCalled());
    expect(api.voluntarios.habilidades.update).not.toHaveBeenCalled();
  });

  test('con todo cargado, guardar sí manda las habilidades', async () => {
    mount();
    expect(await screen.findByText('Primeros auxilios · Básico')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar perfil' }));
    fireEvent.click(await screen.findByRole('button', { name: /Guardar cambios/ }));
    await vi.waitFor(() => expect(api.voluntarios.habilidades.update).toHaveBeenCalledWith([{ habilidad_id: 'h1', nivel: 'basico' }]));
  });

  test('mientras "Reintentar" carga las participaciones no dice "Aún no participaste…"', async () => {
    let resolve!: (v: { enrollments: EnrollmentWithProject[] }) => void;
    m.my.mockReset().mockRejectedValueOnce(boom()).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    mount();
    fireEvent.click(within(await screen.findByRole('alert')).getByRole('button', { name: /Reintentar/ }));
    await screen.findByText('Fundación Verde');
    expect(screen.queryByText('Aún no participaste en ningún proyecto')).toBeNull();
    resolve({ enrollments: [] });
    expect(await screen.findByText('Aún no participaste en ningún proyecto')).toBeInTheDocument();
  });

  test('un error viejo que llega después de "Reintentar" no vuelve a mostrar el aviso', async () => {
    let rejectOld!: (e: unknown) => void;
    m.my.mockReset().mockRejectedValueOnce(boom()).mockResolvedValue({ enrollments: [enrollment] });
    m.ngos.mockReset().mockReturnValueOnce(new Promise((_, r) => { rejectOld = r; })).mockResolvedValue({ ngos: [ngo] });
    mount();
    fireEvent.click(within(await screen.findByRole('alert')).getByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByText('Fundación Verde')).toBeInTheDocument();
    expect(await screen.findByText('Reforestación')).toBeInTheDocument();
    rejectOld(boom());
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('No se pudo cargar.')).toBeNull();
  });
});

/** Después del primer rechazo (mockRejectedValueOnce), cada carga responde bien. */
function allOkAfterFirst() {
  m.my.mockResolvedValue({ enrollments: [enrollment] });
  m.catalog.mockResolvedValue({ habilidades: [{ id: 'h1', nombre: 'Primeros auxilios' }] });
  m.skills.mockResolvedValue({ habilidades: [skill] } as never);
  m.ngos.mockResolvedValue({ ngos: [ngo] });
  m.following.mockResolvedValue({ volunteers: [juan] });
  m.followers.mockResolvedValue({ volunteers: [juan, { ...juan, user_id: 'u-3' }] });
}
