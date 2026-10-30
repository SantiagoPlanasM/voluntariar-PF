// src/app/components/CreateVoluntariadoPhoto.test.tsx — la foto del voluntariado al crearlo y al editarlo (§282).
//
// Pedido del usuario: "no sé dónde se le pondría foto al voluntariado". Criterio: en el paso 3 hay "Foto del
// voluntariado (opcional)". Al editar se ve la actual. Al elegir una, se ve la vista previa y se puede quitar. Al
// guardar, primero se crea o edita el voluntariado y DESPUÉS se sube la foto (comprimida, campo `photo`) a
// PUT /projects/:id/photo; sin foto elegida no se sube nada. Si la foto falla, el voluntariado ya quedó guardado: se
// sigue igual y un aviso lo dice. Un archivo que no es JPEG, PNG o WebP se rechaza al elegirlo.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { UiProvider } from '../ui/UiProvider';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-ngo', name: 'ONG', email: 'o@x.com', role: 'ngo' } }) }));
vi.mock('../../lib/imageCompress', async () => {
  const actual = await vi.importActual<typeof import('../../lib/imageCompress')>('../../lib/imageCompress');
  return { ...actual, compressImage: vi.fn() };
});
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: { ...actual.api, projects: { ...actual.api.projects, get: vi.fn(), update: vi.fn(), create: vi.fn(), uploadPhoto: vi.fn() } },
  };
});

import { api, ApiError } from '../../lib/api';
import { compressImage } from '../../lib/imageCompress';
import { CreateVoluntariado } from './CreateVoluntariado';

const get = vi.mocked(api.projects.get);
const update = vi.mocked(api.projects.update);
const create = vi.mocked(api.projects.create);
const uploadPhoto = vi.mocked(api.projects.uploadPhoto);
const compress = vi.mocked(compressImage);
window.scrollTo = vi.fn() as never;
URL.createObjectURL = vi.fn(() => 'blob:vista-previa');
URL.revokeObjectURL = vi.fn();

const PROJECT = {
  id: 'p1', ngo_id: 'n1', title: 'Jornada de limpieza', description: 'Limpiamos la costa de la laguna',
  category: 'Medio Ambiente', location: 'Remoto', modality: 'remoto', type: 'fugaz', duration: '1 jornada',
  volunteers_needed: 10, current_volunteers: 0, funding_goal: 0, current_funding: 0, cost_per_person: 0,
  roles_needed: [], requirements: [], status: 'active', image: 'https://res.cloudinary.com/x/actual.jpg', can_manage: true,
};
const fill = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const foto = (type = 'image/jpeg') => new File(['x'.repeat(50)], 'foto.jpg', { type });
const elegir = (file: File) => fireEvent.change(screen.getByLabelText('Elegir una foto para el voluntariado'), { target: { files: [file] } });

const routes = (entry: string) => render(
  <UiProvider><MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/ngo/create" element={<CreateVoluntariado />} />
    <Route path="/ngo/dashboard/project/:projectId/editar" element={<CreateVoluntariado />} />
    <Route path="/ngo/dashboard/project/:projectId" element={<p>Detalle del voluntariado</p>} />
    <Route path="/ngo/dashboard" element={<p>Panel de la ONG</p>} />
  </Routes></MemoryRouter></UiProvider>);
const altaHastaExtras = () => {
  routes('/ngo/create');
  fill('Título del voluntariado', 'Limpieza del río');
  fill('Descripción corta', 'Juntamos residuos en la costanera');
  click(/Continuar/);
  click(/Remoto/);
  fill('Duración del evento', '1 jornada');
  fill('Voluntarios necesarios', '10');
  click(/Continuar/);
};
const edicionHastaExtras = async () => {
  get.mockResolvedValue({ project: PROJECT as never });
  routes('/ngo/dashboard/project/p1/editar');
  await screen.findByRole('heading', { name: 'Editar voluntariado' });
  click(/Continuar/);
  click(/Continuar/);
};

beforeEach(() => {
  get.mockReset();
  update.mockReset().mockResolvedValue({ project: {} as never });
  create.mockReset().mockResolvedValue({ project: { id: 'nuevo' } as never });
  uploadPhoto.mockReset().mockResolvedValue({ project: {} as never });
  compress.mockReset().mockImplementation(async (f: File) => new File(['comprimida'], 'foto.jpg', { type: 'image/jpeg' }));
});

describe('Foto del voluntariado', () => {
  test('alta: primero crea el voluntariado y después sube la foto comprimida a su id', async () => {
    altaHastaExtras();
    elegir(foto());
    expect(screen.getByRole('img', { name: 'Vista previa de la foto del voluntariado' })).toHaveAttribute('src', 'blob:vista-previa');
    click(/Publicar Voluntariado/);
    await waitFor(() => expect(uploadPhoto).toHaveBeenCalledTimes(1));
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(uploadPhoto.mock.invocationCallOrder[0]);
    const [id, form] = uploadPhoto.mock.calls[0];
    expect(id).toBe('nuevo');
    expect((form.get('photo') as File).name).toBe('foto.jpg');
    expect((form.get('photo') as File).size).toBe('comprimida'.length);   // la comprimida, no la original (50 bytes)
    expect(compress).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Panel de la ONG')).toBeInTheDocument();
  });

  test('alta sin foto: no sube nada', async () => {
    altaHastaExtras();
    click(/Publicar Voluntariado/);
    expect(await screen.findByText('Panel de la ONG')).toBeInTheDocument();
    expect(uploadPhoto).not.toHaveBeenCalled();
  });

  test('edición: se ve la foto actual; cambiarla sube solo la foto (sin otros cambios no hay PUT)', async () => {
    await edicionHastaExtras();
    expect(screen.getByRole('img', { name: 'Foto actual del voluntariado' })).toHaveAttribute('src', PROJECT.image);
    elegir(foto());
    click(/Guardar cambios/);
    await waitFor(() => expect(uploadPhoto).toHaveBeenCalledWith('p1', expect.any(FormData)));
    expect(update).not.toHaveBeenCalled();
    expect(await screen.findByText('Detalle del voluntariado')).toBeInTheDocument();
  });

  // §297: la tarjeta de Explorar recorta la foto; la ONG elige qué parte se ve.
  test('encuadre al crear: aparece con una foto elegida, se ve en la vista previa y va en el alta', async () => {
    altaHastaExtras();
    expect(screen.queryByRole('radiogroup', { name: 'Encuadre en las tarjetas' })).toBeNull();
    elegir(foto());
    const grupo = await screen.findByRole('radiogroup', { name: 'Encuadre en las tarjetas' });
    expect(screen.getByRole('radio', { name: 'Centro' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'Arriba' }));
    expect(grupo).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Vista previa de la foto del voluntariado' })).toHaveClass('object-top');
    click(/Publicar/);
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ image_position: 'top' })));
  });

  test('encuadre al editar: arranca en el guardado y cambiarlo solo manda ese campo', async () => {
    get.mockResolvedValue({ project: { ...PROJECT, image_position: 'bottom' } as never });
    routes('/ngo/dashboard/project/p1/editar');
    await screen.findByRole('heading', { name: 'Editar voluntariado' });
    click(/Continuar/);
    click(/Continuar/);
    expect(screen.getByRole('radio', { name: 'Abajo' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('img', { name: 'Foto actual del voluntariado' })).toHaveClass('object-bottom');
    fireEvent.click(screen.getByRole('radio', { name: 'Centro' }));
    click(/Guardar cambios/);
    await waitFor(() => expect(update).toHaveBeenCalledWith('p1', { image_position: 'center' }));
  });

  test('"Quitar" descarta la foto elegida antes de guardar', async () => {
    await edicionHastaExtras();
    elegir(foto());
    click('Quitar la foto elegida');
    expect(screen.queryByRole('img', { name: 'Vista previa de la foto del voluntariado' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Foto actual del voluntariado' })).toBeInTheDocument();
    click(/Guardar cambios/);
    expect(await screen.findByText('Detalle del voluntariado')).toBeInTheDocument();
    expect(uploadPhoto).not.toHaveBeenCalled();
  });

  test('si la foto falla, el voluntariado ya se guardó: sigue y avisa', async () => {
    uploadPhoto.mockRejectedValue(new ApiError('La subida de fotos no está disponible por el momento', 503));
    altaHastaExtras();
    elegir(foto());
    click(/Publicar Voluntariado/);
    expect(await screen.findByText('Panel de la ONG')).toBeInTheDocument();
    expect(await screen.findByText(/se publicó, pero la foto no se pudo subir.*no está disponible/)).toBeInTheDocument();
  });

  test('un archivo que no es JPEG, PNG o WebP se rechaza al elegirlo', async () => {
    altaHastaExtras();
    elegir(new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Elegí una foto JPEG, PNG o WebP');
    expect(screen.queryByRole('img', { name: 'Vista previa de la foto del voluntariado' })).toBeNull();
    click(/Publicar Voluntariado/);
    expect(await screen.findByText('Panel de la ONG')).toBeInTheDocument();
    expect(uploadPhoto).not.toHaveBeenCalled();
  });
});
