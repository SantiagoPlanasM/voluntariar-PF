// src/app/components/ProjectMap.test.tsx
//
// Caracterización de los marcadores de <ProjectMap> (mapa chico y ampliado) con Leaflet real en jsdom
// (REVISION S7): los dos mapas dibujaban pines y punto del usuario con código copiado. Estos tests
// se escribieron y pasaron con el código viejo antes de extraer la parte común.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import L from 'leaflet';
import { ProjectMap, getProjectCoords } from './ProjectMap';
import type { Project } from '../../lib/api';

const project = (id: string, category: string, lat: number, lng: number): Project => ({
  id, title: `Proyecto ${id}`, category, latitude: lat, longitude: lng,
  location: 'Córdoba', ngo_name: `ONG ${id}`,
} as unknown as Project);

const P1 = project('p1', 'Educación', -31.40, -64.18);   // azul  #3B82F6
const P2 = project('p2', 'Salud',     -31.41, -64.19);   // coral #F43F5E
const P3 = project('p3', 'Educación', -31.42, -64.20);

const renderMap = (projects: Project[], onSelectProject = vi.fn()) => {
  const utils = render(
    <MemoryRouter><ProjectMap projects={projects} onSelectProject={onSelectProject} /></MemoryRouter>,
  );
  return { ...utils, onSelectProject };
};

// El mapa chico vive en el contenedor del render; el ampliado, en un portal sobre document.body.
const inlineRoot = (container: HTMLElement) => container;
const modalRoot = () => document.querySelector('.fixed.inset-0') as HTMLElement;
const pins = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLElement>('.custom-map-pin'));
const userPins = (root: ParentNode) => root.querySelectorAll('.user-loc-pin');
const pinColor = (pin: HTMLElement) => (pin.querySelector('[style*="background-color"]') as HTMLElement).style.backgroundColor;
const isSelected = (pin: HTMLElement) => pin.innerHTML.includes('scale-125');

const mockGeolocation = (lat: number, lng: number) => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: lat, longitude: lng } } as GeolocationPosition) },
  });
};

let panTo: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // jsdom no trae ResizeObserver (lo usa el mapa ampliado) ni hace animaciones: alcanza con un doble.
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  panTo = vi.spyOn(L.Map.prototype, 'panTo').mockImplementation(function (this: L.Map) { return this; });
  vi.spyOn(L.Map.prototype, 'flyTo').mockImplementation(function (this: L.Map) { return this; });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Caracterización de getProjectCoords antes de pasar de `isNaN` global a `Number.isNaN` (Sonar S7773):
// el global convierte antes ('abc' → NaN), Number.isNaN no. Tiene que seguir igual con strings.
describe('getProjectCoords', () => {
  const withCoords = (latitude: unknown, longitude: unknown) =>
    ({ id: 'x', latitude, longitude, location: 'Sarmiento' } as unknown as Project);
  const SARMIENTO = { lat: -31.4287, lng: -64.1756 };

  test('coordenadas numéricas: se usan tal cual', () => {
    expect(getProjectCoords(withCoords(-31.5, -64.2))).toEqual({ lat: -31.5, lng: -64.2 });
  });

  test('coordenadas como string numérico: se convierten a número', () => {
    expect(getProjectCoords(withCoords('-31.5', '-64.2'))).toEqual({ lat: -31.5, lng: -64.2 });
  });

  test.each([
    ['latitud no numérica', 'abc', -64.2],
    ['longitud no numérica', -31.5, 'abc'],
    ['latitud NaN', Number.NaN, -64.2],
    ['longitud null', -31.5, null],
  ])('%s: cae al respaldo por ubicación', (_caso, lat, lng) => {
    expect(getProjectCoords(withCoords(lat, lng))).toEqual(SARMIENTO);
  });
});

describe('<ProjectMap /> mapa chico — marcadores', () => {
  test('un pin por proyecto, con el color de su categoría y ninguno seleccionado', () => {
    const { container } = renderMap([P1, P2]);
    const p = pins(inlineRoot(container));
    expect(p).toHaveLength(2);
    expect(pinColor(p[0])).toBe('rgb(59, 130, 246)');
    expect(pinColor(p[1])).toBe('rgb(244, 63, 94)');
    expect(p.some(isSelected)).toBe(false);
    expect(userPins(container)).toHaveLength(0);
  });

  test('tocar un pin lo selecciona, centra el mapa (0.5 s), avisa al padre y muestra la tarjeta', () => {
    const { container, onSelectProject } = renderMap([P1, P2]);
    fireEvent.click(pins(container)[1]);
    expect(onSelectProject).toHaveBeenCalledWith(P2);
    expect(panTo).toHaveBeenCalledWith([P2.latitude, P2.longitude], { animate: true, duration: 0.5 });
    expect(screen.getByText('Proyecto p2')).toBeInTheDocument();
    // Se redibuja: siguen siendo 2 pines (los viejos se quitan) y solo el tocado queda resaltado.
    const p = pins(container);
    expect(p).toHaveLength(2);
    expect(p.map(isSelected)).toEqual([false, true]);
  });

  test('"Centrar en mi ubicación" agrega un solo punto del usuario, que sobrevive a los redibujos', () => {
    mockGeolocation(-31.5, -64.3);
    const { container } = renderMap([P1, P2]);
    fireEvent.click(screen.getByTitle('Centrar en mi ubicación'));
    expect(userPins(container)).toHaveLength(1);
    const userIcon = container.querySelector('.user-loc-pin') as HTMLElement;
    expect(userIcon.innerHTML).toContain('bg-emerald-500');
    expect(userIcon.style.width).toBe('16px');
    expect(userIcon.style.marginLeft).toBe('-8px');
    fireEvent.click(pins(container)[0]);
    expect(userPins(container)).toHaveLength(1);
    expect(pins(container)).toHaveLength(2);
  });

  test('si cambian los proyectos se quitan los pines viejos', () => {
    const { container, rerender } = renderMap([P1, P2, P3]);
    expect(pins(container)).toHaveLength(3);
    rerender(<MemoryRouter><ProjectMap projects={[P2]} /></MemoryRouter>);
    const p = pins(container);
    expect(p).toHaveLength(1);
    expect(pinColor(p[0])).toBe('rgb(244, 63, 94)');
  });
});

describe('<ProjectMap /> mapa ampliado — marcadores', () => {
  const openModal = () => fireEvent.click(screen.getByTitle('Abrir mapa ampliado (Pop-up)'));

  test('abre con un pin por proyecto y respeta el seleccionado del mapa chico', () => {
    const { container } = renderMap([P1, P2]);
    fireEvent.click(pins(container)[0]);
    openModal();
    const p = pins(modalRoot());
    expect(p).toHaveLength(2);
    expect(p.map(isSelected)).toEqual([true, false]);
  });

  test('tocar un pin lo selecciona, centra el mapa (0.4 s) y avisa al padre', () => {
    const { onSelectProject } = renderMap([P1, P2]);
    openModal();
    panTo.mockClear();
    fireEvent.click(pins(modalRoot())[1]);
    expect(onSelectProject).toHaveBeenCalledWith(P2);
    expect(panTo).toHaveBeenCalledWith([P2.latitude, P2.longitude], { animate: true, duration: 0.4 });
    expect(pins(modalRoot()).map(isSelected)).toEqual([false, true]);
  });

  test('el filtro de categoría redibuja solo los pines que coinciden', () => {
    renderMap([P1, P2, P3]);
    openModal();
    expect(pins(modalRoot())).toHaveLength(3);
    fireEvent.click(screen.getByTitle('Filtrar por Salud (1 proyectos)'));
    const p = pins(modalRoot());
    expect(p).toHaveLength(1);
    expect(pinColor(p[0])).toBe('rgb(244, 63, 94)');
  });

  test('el punto del usuario del mapa ampliado es propio (no hereda el del chico) y es uno solo', () => {
    mockGeolocation(-31.5, -64.3);
    renderMap([P1]);
    openModal();
    const modal = modalRoot();
    expect(userPins(modal)).toHaveLength(0);
    act(() => { fireEvent.click(modal.querySelector('[title="Centrar en mi ubicación"]')!); });
    expect(userPins(modal)).toHaveLength(1);
    fireEvent.click(pins(modal)[0]);
    expect(userPins(modal)).toHaveLength(1);
  });
});
