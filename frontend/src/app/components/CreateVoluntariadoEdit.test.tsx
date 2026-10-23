// src/app/components/CreateVoluntariadoEdit.test.tsx — editar un voluntariado desde el panel de la ONG (§255).
//
// El backend tenía `PUT /api/projects/:id` parcial desde §95, pero ninguna pantalla lo usaba: una ONG no podía
// corregir nada de lo que publicó (ni cargarle el lugar en el mapa a uno viejo). Ahora el mismo formulario del alta
// abre precargado en /ngo/dashboard/project/:id/editar y manda SOLO lo que cambió. El tipo (fugaz/sostenido) queda
// fijo: cambiarlo cambia el compromiso que aceptaron los inscriptos (decisión del usuario).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-ngo', name: 'ONG', email: 'o@x.com', role: 'ngo' } }) }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    geocodeAddress: vi.fn(),
    api: { ...actual.api, projects: { ...actual.api.projects, get: vi.fn(), update: vi.fn(), create: vi.fn() } },
  };
});

import { api, ApiError, geocodeAddress } from '../../lib/api';
import { CreateVoluntariado } from './CreateVoluntariado';

const get = vi.mocked(api.projects.get);
const update = vi.mocked(api.projects.update);
const create = vi.mocked(api.projects.create);
const geocode = vi.mocked(geocodeAddress);
window.scrollTo = vi.fn() as never; // jsdom no lo implementa

const PROJECT = {
  id: 'p1', ngo_id: 'n1', title: 'Jornada de limpieza en el Lago', description: 'Limpiamos la costa de la laguna',
  full_description: 'Llevar guantes', category: 'Medio Ambiente', location: 'Mar Chiquita', modality: 'presencial',
  type: 'fugaz', duration: '1 jornada', hours_per_week: null, volunteers_needed: 10, current_volunteers: 2,
  funding_goal: 0, current_funding: 0, cost_per_person: 0, roles_needed: ['Logística'], requirements: ['Ropa cómoda'],
  latitude: null, longitude: null, status: 'active', followers: 0, comments: [], ratings: [], kpis: [], avg_rating: 0,
  can_manage: true,
};

const mount = (project: Record<string, unknown> = PROJECT) => {
  get.mockResolvedValue({ project: project as never });
  render(
    <MemoryRouter initialEntries={['/ngo/dashboard/project/p1/editar']}><Routes>
      <Route path="/ngo/dashboard/project/:projectId/editar" element={<CreateVoluntariado />} />
      <Route path="/ngo/dashboard/project/:projectId" element={<p>Detalle del voluntariado</p>} />
    </Routes></MemoryRouter>,
  );
};
const fill = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const continuar = () => click(/Continuar/);
const guardar = async () => {
  click(/Guardar cambios/);
  await waitFor(() => expect(screen.getByText('Detalle del voluntariado')).toBeInTheDocument());
};

beforeEach(() => {
  get.mockReset();
  update.mockReset().mockResolvedValue({ project: {} as never });
  create.mockReset();
  geocode.mockReset();
});

describe('Editar voluntariado: precarga', () => {
  test('abre con los datos actuales en los tres pasos y el tipo no se puede cambiar', async () => {
    mount();
    expect(await screen.findByRole('heading', { name: 'Editar voluntariado' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('p1');
    expect(screen.getByLabelText('Título del voluntariado')).toHaveValue('Jornada de limpieza en el Lago');
    expect(screen.getByLabelText('Descripción corta')).toHaveValue('Limpiamos la costa de la laguna');
    expect(screen.getByRole('button', { name: /Fugaz/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Sostenido/ })).toBeDisabled();
    expect(screen.getByText('El tipo no se puede cambiar después de publicar.')).toBeInTheDocument();
    continuar();
    expect(screen.getByLabelText('Ubicación')).toHaveValue('Mar Chiquita');
    expect(screen.getByLabelText('Duración del evento')).toHaveValue('1 jornada');
    expect(screen.getByLabelText('Voluntarios necesarios')).toHaveValue(10);
    expect(screen.getByText(/Tocá el mapa para marcar el lugar exacto/)).toBeInTheDocument();
    continuar();
    expect(screen.getByLabelText('Descripción completa')).toHaveValue('Llevar guantes');
    expect(screen.getByRole('button', { name: 'Quitar rol Logística' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar requisito Ropa cómoda' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar cambios/ })).toBeInTheDocument();
  });

  test('con lugar en el mapa, abre con el punto marcado', async () => {
    mount({ ...PROJECT, latitude: -30.921014, longitude: -62.687917 });
    await screen.findByRole('heading', { name: 'Editar voluntariado' });
    continuar();
    expect(screen.getByText(/Lugar marcado\. Arrastrá el pin/)).toBeInTheDocument();
  });

  test('un remoto abre como remoto (sin mapa) y, sin cambios, no manda nada', async () => {
    mount({ ...PROJECT, modality: 'remoto', location: 'Remoto' });
    await screen.findByRole('heading', { name: 'Editar voluntariado' });
    continuar();
    expect(screen.getByLabelText('Plataforma o medio digital')).toHaveValue('Remoto');
    expect(screen.queryByRole('button', { name: 'Buscar en el mapa' })).not.toBeInTheDocument();
    continuar();
    await guardar();
    expect(update).not.toHaveBeenCalled();
  });

  test('una categoría que no está entre las sugeridas aparece elegida y no se manda si no se toca', async () => {
    mount({ ...PROJECT, category: 'Construcción' });
    await screen.findByRole('heading', { name: 'Editar voluntariado' });
    continuar();
    expect(screen.getByRole('button', { name: 'Construcción' })).toBeInTheDocument();
    continuar();
    fill('Descripción completa', 'Llevar guantes y gorra');
    await guardar();
    expect(update).toHaveBeenCalledWith('p1', { full_description: 'Llevar guantes y gorra' });
  });
});

describe('Editar voluntariado: guardar manda solo lo que cambió', () => {
  test('cambiar el título manda solo el título y vuelve al detalle', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Editar voluntariado' });
    fill('Título del voluntariado', 'Jornada en la laguna');
    continuar(); continuar();
    await guardar();
    expect(update).toHaveBeenCalledWith('p1', { title: 'Jornada en la laguna' });
    expect(create).not.toHaveBeenCalled();
  });

  test('sin cambios no manda nada y vuelve al detalle', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Editar voluntariado' });
    continuar(); continuar();
    await guardar();
    expect(update).not.toHaveBeenCalled();
  });

  test('cargarle el lugar en el mapa manda solo latitude y longitude', async () => {
    geocode.mockResolvedValue([{ label: 'Ex-Hotel Mar Chiquita, Miramar de Ansenuza, Córdoba', lat: -30.921014, lng: -62.687917 }]);
    mount();
    await screen.findByRole('heading', { name: 'Editar voluntariado' });
    continuar();
    click('Buscar en el mapa');
    fireEvent.click(await screen.findByRole('button', { name: /Ex-Hotel Mar Chiquita/ }));
    continuar();
    await guardar();
    expect(update).toHaveBeenCalledWith('p1', { latitude: -30.921014, longitude: -62.687917 });
  });

  test('pasar a remoto borra el lugar (null, no "sin tocar")', async () => {
    mount({ ...PROJECT, latitude: -30.921014, longitude: -62.687917 });
    await screen.findByRole('heading', { name: 'Editar voluntariado' });
    continuar();
    click(/Remoto/);
    continuar();
    await guardar();
    expect(update).toHaveBeenCalledWith('p1', { modality: 'remoto', location: 'Remoto', latitude: null, longitude: null });
  });

  test('vaciar la descripción completa la borra (null)', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Editar voluntariado' });
    continuar(); continuar();
    fill('Descripción completa', '   ');
    await guardar();
    expect(update).toHaveBeenCalledWith('p1', { full_description: null });
  });

  test('quitar un rol manda la lista nueva', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Editar voluntariado' });
    continuar(); continuar();
    click('Quitar rol Logística');
    await guardar();
    expect(update).toHaveBeenCalledWith('p1', { roles_needed: [] });
  });

  test('si el backend lo rechaza (cupos), se muestra el error y no sale de la pantalla', async () => {
    update.mockRejectedValue(new ApiError('No podés bajar la capacidad a 1: ya hay 2 voluntarios aprobados.', 400));
    mount();
    await screen.findByRole('heading', { name: 'Editar voluntariado' });
    continuar();
    fill('Voluntarios necesarios', '1');
    continuar();
    click(/Guardar cambios/);
    expect(await screen.findByText('No podés bajar la capacidad a 1: ya hay 2 voluntarios aprobados.')).toBeInTheDocument();
    expect(update).toHaveBeenCalledWith('p1', { volunteers_needed: 1 });
    expect(screen.queryByText('Detalle del voluntariado')).not.toBeInTheDocument();
  });

  test('las validaciones del alta valen también al editar', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Editar voluntariado' });
    fill('Título del voluntariado', 'ab');
    continuar();
    expect(screen.getByText('Mínimo 3 caracteres')).toBeInTheDocument();
  });
});

describe('Editar voluntariado: no se puede abrir', () => {
  test('si el voluntariado no existe, lo dice (sin formulario)', async () => {
    get.mockRejectedValue(new ApiError('Proyecto no encontrado', 404));
    render(
      <MemoryRouter initialEntries={['/ngo/dashboard/project/p1/editar']}><Routes>
        <Route path="/ngo/dashboard/project/:projectId/editar" element={<CreateVoluntariado />} />
      </Routes></MemoryRouter>,
    );
    expect(await screen.findByText('No encontramos este voluntariado')).toBeInTheDocument();
    expect(screen.queryByLabelText('Título del voluntariado')).not.toBeInTheDocument();
  });

  test('si no es de la ONG de la sesión, lo dice (sin formulario)', async () => {
    mount({ ...PROJECT, can_manage: false });
    expect(await screen.findByText('Solo la organización que lo publicó puede editarlo.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Título del voluntariado')).not.toBeInTheDocument();
  });
});
