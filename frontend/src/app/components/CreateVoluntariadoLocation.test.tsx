// src/app/components/CreateVoluntariadoLocation.test.tsx
//
// El alta no mandaba coordenadas (solo el texto de la ubicación): el backend las acepta desde hace rato
// (`latitude`/`longitude`, routes/projects.js), pero todo voluntariado creado desde la app quedaba sin ellas y el mapa
// lo dibujaba en un punto inventado. Ahora el paso Detalles tiene un selector (buscar la dirección o tocar el mapa).
// Desde §260, en un presencial marcar el lugar es obligatorio (sin pin no aparece en Explorar); en un híbrido, no.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-ngo', name: 'ONG', email: 'o@x.com', role: 'ngo' } }) }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    geocodeAddress: vi.fn(),
    api: { ...actual.api, projects: { ...actual.api.projects, create: vi.fn() } },
  };
});

import { api, geocodeAddress } from '../../lib/api';
import { CreateVoluntariado } from './CreateVoluntariado';

const create = vi.mocked(api.projects.create);
const geocode = vi.mocked(geocodeAddress);
window.scrollTo = vi.fn() as never; // jsdom no lo implementa

const fill = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

/** Paso 1 completo y pasa al paso 2 (fugaz, presencial por defecto). */
const hastaDetalles = () => {
  render(<MemoryRouter><CreateVoluntariado /></MemoryRouter>);
  fill('Título del voluntariado', 'Limpieza del río');
  fill('Descripción corta', 'Juntamos residuos en la costanera');
  click(/Continuar/);
  fill('Duración del evento', '1 jornada');
  fill('Voluntarios necesarios', '10');
};
const publicar = async () => {
  click(/Continuar/);
  click(/Publicar Voluntariado/);
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  return create.mock.calls[0][0];
};

beforeEach(() => {
  create.mockReset().mockResolvedValue({ project: {} as never });
  geocode.mockReset();
});

describe('Crear voluntariado: lugar en el mapa', () => {
  test('presencial: se busca la dirección, se elige un resultado y el alta manda latitude/longitude', async () => {
    geocode.mockResolvedValue([{ label: 'Parque Sarmiento, Córdoba', lat: -31.4287, lng: -64.1756 }]);
    hastaDetalles();
    fill('Ubicación', 'Parque Sarmiento');
    click('Buscar en el mapa');
    expect(geocode).toHaveBeenCalledWith('Parque Sarmiento');
    fireEvent.click(await screen.findByRole('button', { name: 'Parque Sarmiento, Córdoba' }));
    click(/Continuar/);
    expect(screen.getByText('Lugar marcado en el mapa')).toBeInTheDocument();
    click(/Publicar Voluntariado/);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0]).toMatchObject({ location: 'Parque Sarmiento', latitude: -31.4287, longitude: -64.1756 });
  });

  test('presencial sin marcar el lugar: no deja pasar del paso Detalles y no publica (§260)', () => {
    hastaDetalles();
    fill('Ubicación', 'Parque Sarmiento');
    click(/Continuar/);
    expect(screen.getByText('Marcá el lugar en el mapa: buscá la dirección o tocá el mapa')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publicar Voluntariado/ })).not.toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  test('híbrido sin marcar el lugar se puede publicar: van sin coordenadas y el resumen lo avisa', async () => {
    hastaDetalles();
    click(/Híbrido/);
    fill('Ubicación', 'Parque Sarmiento y Google Meet');
    click(/Continuar/);
    expect(screen.getByText('Sin lugar marcado en el mapa')).toBeInTheDocument();
    click(/Publicar Voluntariado/);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const body = create.mock.calls[0][0];
    expect(body.latitude).toBeUndefined();
    expect(body.longitude).toBeUndefined();
  });

  test('remoto: no hay mapa, y si había un punto marcado no se manda', async () => {
    geocode.mockResolvedValue([{ label: 'Parque Sarmiento, Córdoba', lat: -31.4287, lng: -64.1756 }]);
    hastaDetalles();
    fill('Ubicación', 'Parque Sarmiento');
    click('Buscar en el mapa');
    fireEvent.click(await screen.findByRole('button', { name: 'Parque Sarmiento, Córdoba' }));
    click(/Remoto/);
    expect(screen.queryByRole('button', { name: 'Buscar en el mapa' })).not.toBeInTheDocument();
    const body = await publicar();
    expect(body).toMatchObject({ modality: 'remoto', location: 'Remoto' });
    expect(body.latitude).toBeUndefined();
    expect(body.longitude).toBeUndefined();
  });

  test('híbrido: también tiene el mapa', () => {
    hastaDetalles();
    click(/Híbrido/);
    expect(screen.getByRole('button', { name: 'Buscar en el mapa' })).toBeInTheDocument();
  });
});
