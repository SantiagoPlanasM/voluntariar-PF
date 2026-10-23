// src/app/components/LocationPicker.test.tsx — selector de ubicación del alta de voluntariados.
//
// Antes el alta mandaba solo el texto de la ubicación, sin coordenadas: todo voluntariado creado desde la app caía
// en un punto inventado del mapa. El selector deja buscar la dirección (Nominatim) o tocar el mapa, y arrastrar el
// pin para ajustar. Leaflet es el real (jsdom no mide tamaños: el clic en el mapa se dispara desde la instancia).
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import L from 'leaflet';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, geocodeAddress: vi.fn() };
});

import { geocodeAddress } from '../../lib/api';
import { LocationPicker } from './LocationPicker';

const geocode = vi.mocked(geocodeAddress);
const SARMIENTO = { label: 'Parque Sarmiento, Córdoba', lat: -31.4287, lng: -64.1756 };
const PLAZA = { label: 'Plaza San Martín, Córdoba', lat: -31.4165, lng: -64.1835 };

let mapSpy: ReturnType<typeof vi.spyOn>;
let markerSpy: ReturnType<typeof vi.spyOn>;
const leafletMap = () => mapSpy.mock.results[0].value as L.Map;
const lastMarker = () => markerSpy.mock.results[markerSpy.mock.results.length - 1].value as L.Marker;

beforeEach(() => {
  geocode.mockReset();
  mapSpy = vi.spyOn(L, 'map');
  markerSpy = vi.spyOn(L, 'marker');
  vi.spyOn(L.Map.prototype, 'setView');
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

const mount = (props: Partial<React.ComponentProps<typeof LocationPicker>> = {}) => {
  const onChange = vi.fn();
  const utils = render(<LocationPicker query="Parque Sarmiento" value={null} onChange={onChange} {...props} />);
  return { ...utils, onChange };
};
const buscar = () => fireEvent.click(screen.getByRole('button', { name: 'Buscar en el mapa' }));

describe('LocationPicker: búsqueda de dirección', () => {
  test('busca el texto de la ubicación y, al elegir un resultado, marca ese punto y centra el mapa', async () => {
    geocode.mockResolvedValue([SARMIENTO, PLAZA]);
    const { onChange } = mount();
    buscar();
    expect(geocode).toHaveBeenCalledWith('Parque Sarmiento');
    const lista = await screen.findByRole('list', { name: 'Direcciones encontradas' });
    expect(lista.querySelectorAll('button')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: PLAZA.label }));
    expect(onChange).toHaveBeenCalledWith({ lat: PLAZA.lat, lng: PLAZA.lng });
    expect(leafletMap().setView).toHaveBeenCalledWith([PLAZA.lat, PLAZA.lng], 16);
    expect(screen.queryByRole('list', { name: 'Direcciones encontradas' })).not.toBeInTheDocument();
  });

  test('con menos de 3 letras no se puede buscar', () => {
    mount({ query: ' ab ' });
    expect(screen.getByRole('button', { name: 'Buscar en el mapa' })).toBeDisabled();
  });

  test('sin resultados: lo dice y propone tocar el mapa', async () => {
    geocode.mockResolvedValue([]);
    mount();
    buscar();
    expect(await screen.findByRole('status')).toHaveTextContent('No encontramos esa dirección. Marcá el lugar tocando el mapa.');
  });

  test('si la búsqueda falla, muestra el mensaje del error', async () => {
    geocode.mockRejectedValue(new Error('No pudimos buscar la dirección. Marcá el lugar tocando el mapa.'));
    mount();
    buscar();
    expect(await screen.findByRole('status')).toHaveTextContent('No pudimos buscar la dirección.');
  });

  test('mientras busca el botón queda deshabilitado; dos búsquedas seguidas quedan a 1 s como mínimo (Nominatim)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    geocode.mockResolvedValue([]);
    mount();
    buscar();
    expect(screen.getByRole('button', { name: 'Buscar en el mapa' })).toBeDisabled();
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar en el mapa' })).not.toBeDisabled());
    const t0 = Date.now();
    buscar();
    await waitFor(() => expect(geocode).toHaveBeenCalledTimes(2));
    expect(Date.now() - t0).toBeGreaterThanOrEqual(900);
  });
});

describe('LocationPicker: el mapa y el pin', () => {
  test('sin ubicación: no hay pin y el mapa arranca en Córdoba; tocar el mapa marca el punto (6 decimales)', () => {
    const { container, onChange } = mount();
    expect(container.querySelectorAll('.custom-map-pin')).toHaveLength(0);
    expect(leafletMap().getCenter()).toMatchObject({ lat: -31.4201, lng: -64.1888 });
    act(() => { leafletMap().fire('click', { latlng: L.latLng(-31.41234567, -64.18765432) }); });
    expect(onChange).toHaveBeenCalledWith({ lat: -31.412346, lng: -64.187654 });
  });

  test('con ubicación: un solo pin arrastrable en ese punto; al soltarlo avisa el punto nuevo', () => {
    const { container, onChange } = mount({ value: { lat: SARMIENTO.lat, lng: SARMIENTO.lng } });
    expect(container.querySelectorAll('.custom-map-pin')).toHaveLength(1);
    expect(leafletMap().getCenter()).toMatchObject({ lat: SARMIENTO.lat, lng: SARMIENTO.lng });
    expect(leafletMap().getZoom()).toBe(16); // de cerca: se ve la cuadra (sin punto, 13: la ciudad)
    const m = lastMarker();
    expect(m.options.draggable).toBe(true);
    expect(m.getLatLng()).toMatchObject({ lat: SARMIENTO.lat, lng: SARMIENTO.lng });
    act(() => { m.setLatLng([-31.5, -64.25]); m.fire('dragend'); });
    expect(onChange).toHaveBeenCalledWith({ lat: -31.5, lng: -64.25 });
  });

  test('si cambia la ubicación se mueve el mismo pin (no se suma otro); "Quitar del mapa" la borra', () => {
    const { container, rerender, onChange } = mount({ value: { lat: SARMIENTO.lat, lng: SARMIENTO.lng } });
    rerender(<LocationPicker query="x" value={{ lat: PLAZA.lat, lng: PLAZA.lng }} onChange={onChange} />);
    expect(container.querySelectorAll('.custom-map-pin')).toHaveLength(1);
    expect(lastMarker().getLatLng()).toMatchObject({ lat: PLAZA.lat, lng: PLAZA.lng });
    fireEvent.click(screen.getByRole('button', { name: 'Quitar del mapa' }));
    expect(onChange).toHaveBeenCalledWith(null);
    rerender(<LocationPicker query="x" value={null} onChange={onChange} />);
    expect(container.querySelectorAll('.custom-map-pin')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Quitar del mapa' })).not.toBeInTheDocument();
  });

  test('el aviso cambia según haya o no un punto marcado', () => {
    const { rerender, onChange } = mount();
    expect(screen.getByText(/Tocá el mapa para marcar el lugar exacto/)).toBeInTheDocument();
    rerender(<LocationPicker query="x" value={{ lat: -31.4, lng: -64.2 }} onChange={onChange} />);
    expect(screen.getByText(/Lugar marcado\. Arrastrá el pin para ajustarlo/)).toBeInTheDocument();
  });
});
