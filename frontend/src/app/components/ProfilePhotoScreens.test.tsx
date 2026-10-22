// src/app/components/ProfilePhotoScreens.test.tsx
//
// "Cambiar foto" en los tres perfiles propios (PLAN_FALTANTE.md, Etapa 2, §163). El componente se prueba en
// ProfilePhotoPicker.test.tsx; acá, que cada pantalla lo tenga y que la foto del encabezado cambie sin recargar:
// la del voluntario sale de la sesión (AuthContext), y el logo de la ONG o la empresa de su estado local.
// Rediseño (§240): "Cambiar foto" está dentro de "Editar perfil", y "Borrar mi cuenta" pasó a Configuración (/settings).
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../../lib/AuthContext';
import type { Empresa, NGO } from '../../lib/api';

vi.mock('../../lib/imageCompress', async () => {
  const actual = await vi.importActual<typeof import('../../lib/imageCompress')>('../../lib/imageCompress');
  return { ...actual, compressImage: vi.fn(async (f: File) => f) };
});
vi.mock('./MomentsGrid', () => ({ MomentsGrid: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      auth: { ...actual.api.auth, me: vi.fn(), uploadPhoto: vi.fn() },
      ngos: { ...actual.api.ngos, me: vi.fn() },
      empresas: { ...actual.api.empresas, me: vi.fn(), patrocinios: { ...actual.api.empresas.patrocinios, list: vi.fn().mockResolvedValue({ patrocinios: [] }) } },
      projects: { ...actual.api.projects, list: vi.fn().mockResolvedValue({ projects: [] }) },
      enrollments: { ...actual.api.enrollments, my: vi.fn().mockResolvedValue({ enrollments: [] }) },
      catalog: { ...actual.api.catalog, habilidades: vi.fn().mockResolvedValue({ habilidades: [] }) },
      follows: {
        ...actual.api.follows,
        myNgos: vi.fn().mockResolvedValue({ ngos: [] }),
        myFollowing: vi.fn().mockResolvedValue({ volunteers: [] }),
        myFollowers: vi.fn().mockResolvedValue({ volunteers: [] }),
      },
      voluntarios: { ...actual.api.voluntarios, habilidades: { list: vi.fn().mockResolvedValue({ habilidades: [] }), update: vi.fn() } },
    },
  };
});
import { api } from '../../lib/api';
import { NGOOwnProfile } from './NGOOwnProfile';
import { CompanyOwnProfile } from './CompanyOwnProfile';
import { VolunteerProfile } from './VolunteerProfile';

const NEW_URL = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_480,h_480,c_fill,g_auto/v1/nueva.jpg';

const ngo: NGO = { id: 'ngo-1', user_id: 'u-ngo', name: 'Sustentando', logo: 'https://old/logo.png', followers: 2 } as NGO;
const empresa: Empresa = { id: 'emp-1', user_id: 'u-comp', name: 'TechCorp', logo: 'https://old/emp.png', followers: 3 } as Empresa;

const sessionAs = (user: Record<string, unknown>) => {
  localStorage.setItem('v_token', 'tok');
  localStorage.setItem('v_user', JSON.stringify(user));
  vi.mocked(api.auth.me).mockResolvedValue({ user } as never);
};
const mount = (ui: React.ReactElement) => render(<MemoryRouter><AuthProvider>{ui}</AuthProvider></MemoryRouter>);
/** Abre "Editar perfil" (si hace falta) y elige una foto. */
const choosePhoto = () => {
  if (!screen.queryByLabelText('Elegir una foto de perfil')) fireEvent.click(screen.getByRole('button', { name: 'Editar perfil' }));
  chooseFile();
};
const chooseFile = () => fireEvent.change(screen.getByLabelText('Elegir una foto de perfil'),
  { target: { files: [new File(['x'], 'yo.jpg', { type: 'image/jpeg' })] } });

beforeEach(() => {
  vi.mocked(api.auth.uploadPhoto).mockReset();
  vi.mocked(api.ngos.me).mockReset().mockResolvedValue({ ngo, projects: [], stats: {} as never, pending_enrollments: [] });
  vi.mocked(api.empresas.me).mockReset().mockResolvedValue({ empresa });
});
afterEach(() => localStorage.clear());

describe('"Cambiar foto" en los perfiles propios', () => {
  test('ONG: el logo del encabezado pasa a ser la foto nueva', async () => {
    const user = { id: 'u-ngo', name: 'Sustentando', email: 's@x.org', role: 'ngo', avatar: 'https://old/logo.png' };
    sessionAs(user);
    vi.mocked(api.auth.uploadPhoto).mockResolvedValue({ user: { ...user, avatar: NEW_URL } } as never);
    mount(<NGOOwnProfile />);
    expect(await screen.findByRole('img', { name: 'Sustentando' })).toHaveAttribute('src', 'https://old/logo.png');
    choosePhoto();
    await waitFor(() => expect(screen.getByRole('img', { name: 'Sustentando' })).toHaveAttribute('src', NEW_URL));
    expect(api.auth.uploadPhoto).toHaveBeenCalledTimes(1);
  });

  test('empresa: el logo del encabezado pasa a ser la foto nueva', async () => {
    const user = { id: 'u-comp', name: 'TechCorp', email: 't@x.com', role: 'company', avatar: 'https://old/emp.png' };
    sessionAs(user);
    vi.mocked(api.auth.uploadPhoto).mockResolvedValue({ user: { ...user, avatar: NEW_URL } } as never);
    mount(<CompanyOwnProfile />);
    expect(await screen.findByRole('img', { name: 'TechCorp' })).toHaveAttribute('src', 'https://old/emp.png');
    choosePhoto();
    await waitFor(() => expect(screen.getByRole('img', { name: 'TechCorp' })).toHaveAttribute('src', NEW_URL));
  });

  test('voluntario: la foto del encabezado (la de la sesión) pasa a ser la nueva', async () => {
    const user = { id: 'u-vol', name: 'María', email: 'm@x.com', role: 'volunteer', avatar: 'https://old/maria.png' };
    sessionAs(user);
    vi.mocked(api.auth.uploadPhoto).mockResolvedValue({ user: { ...user, avatar: NEW_URL } } as never);
    mount(<VolunteerProfile />);
    expect(await screen.findByRole('img', { name: 'María' })).toHaveAttribute('src', 'https://old/maria.png');
    choosePhoto();
    await waitFor(() => expect(screen.getByRole('img', { name: 'María' })).toHaveAttribute('src', NEW_URL));
  });

  // §178: "Borrar mi cuenta" se llega desde los tres perfiles propios; desde el rediseño (§240), por Configuración
  // (SettingsScreen.test.tsx prueba que ahí está).
  test('los tres perfiles llevan a Configuración', async () => {
    sessionAs({ id: 'u-ngo', name: 'Sustentando', email: 's@x.org', role: 'ngo' });
    const a = mount(<NGOOwnProfile />);
    expect(await screen.findByRole('link', { name: 'Configuración' })).toHaveAttribute('href', '/settings');
    a.unmount();
    sessionAs({ id: 'u-comp', name: 'TechCorp', email: 't@x.com', role: 'company' });
    const b = mount(<CompanyOwnProfile />);
    expect(await screen.findByRole('link', { name: 'Configuración' })).toHaveAttribute('href', '/settings');
    b.unmount();
    sessionAs({ id: 'u-vol', name: 'María', email: 'm@x.com', role: 'volunteer' });
    mount(<VolunteerProfile />);
    expect(await screen.findByRole('link', { name: 'Configuración' })).toHaveAttribute('href', '/settings');
  });

  test('"Cambiar foto" aparece al editar el perfil y se va al cancelar', async () => {
    sessionAs({ id: 'u-ngo', name: 'Sustentando', email: 's@x.org', role: 'ngo' });
    mount(<NGOOwnProfile />);
    await screen.findByRole('img', { name: 'Sustentando' });
    expect(screen.queryByRole('button', { name: 'Cambiar foto' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar perfil' }));
    expect(screen.getByRole('button', { name: 'Cambiar foto' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar edición' }));
    expect(screen.queryByRole('button', { name: 'Cambiar foto' })).not.toBeInTheDocument();
  });
});
