// src/app/components/ProjectMap.test.tsx
//
// Caracterización de los marcadores de <ProjectMap> (mapa chico y ampliado) con Leaflet real en jsdom
// (REVISION S7): los dos mapas dibujaban pines y punto del usuario con código copiado. Estos tests
// se escribieron y pasaron con el código viejo antes de extraer la parte común.
// Rediseño (§240, DESIGN.md → Mapa): todos los pines son del color de la tinta (#0F1419), sin un color por
// categoría; para saber de qué proyecto es un pin, se lo toca y se mira a quién avisa.
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

const P1 = project('p1', 'Educación', -31.40, -64.18);
const P2 = project('p2', 'Salud',     -31.41, -64.19);
const INK = 'rgb(15, 20, 25)';
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
  const withCoords = (latitude: unknown, longitude: unknown, id = 'x', location = 'Sarmiento') =>
    ({ id, latitude, longitude, location } as unknown as Project);
  // Sin coordenadas el punto sale del id: siempre el mismo para ese proyecto, sin mirar el texto de la ubicación
  // (antes: palabras clave de la semilla, y si no, la posición en la lista, que cambiaba al filtrar).
  const RESPALDO_X = getProjectCoords(withCoords(null, null));

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
  ])('%s: cae al respaldo del id', (_caso, lat, lng) => {
    expect(getProjectCoords(withCoords(lat, lng))).toEqual(RESPALDO_X);
  });

  test('respaldo: el texto de la ubicación no lo mueve (sin palabras clave de la semilla)', () => {
    expect(RESPALDO_X).not.toEqual({ lat: -31.4287, lng: -64.1756 }); // el punto fijo de "Sarmiento"
    expect(getProjectCoords(withCoords(null, null, 'x', 'Centro vecinal de Villa Allende'))).toEqual(RESPALDO_X);
    expect(getProjectCoords(withCoords(null, null, 'x', 'Salta 123'))).toEqual(RESPALDO_X);
  });

  test('respaldo: ids distintos caen en puntos distintos, a entre 1,5 y 4 km del centro de Córdoba', () => {
    const ids = ['a', 'b', 'p-1', 'p-2', '6f1c2a90-0000-4000-8000-000000000001', '6f1c2a90-0000-4000-8000-000000000002'];
    const puntos = ids.map(id => getProjectCoords(withCoords(null, null, id)));
    expect(new Set(puntos.map(p => `${p.lat},${p.lng}`)).size).toBe(ids.length);
    for (const p of puntos) {
      const r = Math.hypot(p.lat - -31.4201, p.lng - -64.1888);
      expect(r).toBeGreaterThanOrEqual(0.015 - 1e-9);
      expect(r).toBeLessThan(0.04);
    }
  });

  test('respaldo: los puntos se reparten en distintas direcciones y distancias (ni en una línea ni en un círculo)', () => {
    const puntos = Array.from({ length: 30 }, (_, i) => getProjectCoords(withCoords(null, null, `proyecto-${i}`)));
    const direcciones = new Set(puntos.map(p => Math.round(Math.atan2(p.lat - -31.4201, p.lng - -64.1888) * 4)));
    const distancias = new Set(puntos.map(p => Math.round(Math.hypot(p.lat - -31.4201, p.lng - -64.1888) * 1000)));
    expect(direcciones.size).toBeGreaterThanOrEqual(8);
    expect(distancias.size).toBeGreaterThanOrEqual(8);
  });
});

// Los mosaicos salían de los servidores internos de Google (mt0..3.google.com/vt), sin clave y sin atribución:
// sus condiciones no lo permiten. Ahora los dos mapas usan los mosaicos de OpenStreetMap y muestran la atribución.
// (Primero se usó CARTO: en Chrome sus mosaicos sin clave salen con la marca "API KEY REQUIRED"; un test en jsdom
// no lo puede ver, porque no baja imágenes.)
describe('<ProjectMap /> mosaicos y atribución', () => {
  const tileUrls = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((c: unknown[]) => String(c[0]));

  test('mapa chico y ampliado: mosaicos de OpenStreetMap (no de Google ni de CARTO) con su atribución', () => {
    const tileLayer = vi.spyOn(L, 'tileLayer');
    const { container } = renderMap([P1]);
    fireEvent.click(screen.getByTitle('Abrir mapa ampliado (Pop-up)'));
    expect(tileLayer).toHaveBeenCalledTimes(2);
    for (const url of tileUrls(tileLayer)) {
      expect(url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    }
    // OpenStreetMap llega hasta el zoom 19: con 20 se podría acercar a un mapa gris (mosaicos que no existen).
    expect(tileLayer.mock.calls.map((c: unknown[]) => (c[1] as L.TileLayerOptions).maxZoom)).toEqual([19, 19]);
    for (const root of [container, modalRoot()]) {
      const attribution = root.querySelector('.leaflet-control-attribution');
      expect(attribution?.textContent).toContain('© OpenStreetMap');
      expect(attribution?.querySelector('a[href="https://www.openstreetmap.org/copyright"]')).not.toBeNull();
    }
  });
});

// D31 (Issue #32, §254): un voluntariado remoto no está en ningún lugar, pero tenía pin (en el punto de respaldo) y
// sumaba en "N proyectos en tu área". Se vio en producción con "Test" (modalidad remoto).
describe('<ProjectMap /> los remotos no van al mapa', () => {
  const remoto = { ...project('r1', 'Educación', -31.43, -64.21), modality: 'remoto' } as Project;
  const remotoPorTexto = { ...project('r2', 'Salud', -31.44, -64.22), location: 'Remoto', modality: undefined } as unknown as Project;
  const virtual = { ...project('r3', 'Salud', -31.45, -64.23), location: 'Virtual (Zoom)', modality: undefined } as unknown as Project;
  const hibrido = { ...project('h1', 'Salud', -31.46, -64.24), modality: 'hibrido' } as Project;

  test('mapa chico: sin pin para los remotos (por modalidad o por "remoto"/"virtual" en la ubicación); híbrido sí', () => {
    const { container } = renderMap([P1, remoto, remotoPorTexto, virtual, hibrido]);
    expect(pins(container)).toHaveLength(2);
    expect(screen.getByText('2 proyectos')).toBeInTheDocument();
  });

  test('mapa ampliado: tampoco; el título y los conteos por categoría no los cuentan', () => {
    renderMap([P1, P2, remoto, remotoPorTexto]);
    fireEvent.click(screen.getByTitle('Abrir mapa ampliado (Pop-up)'));
    expect(pins(modalRoot())).toHaveLength(2);
    expect(screen.getByText('2 proyectos solidarios geolocalizados')).toBeInTheDocument();
    expect(screen.getByTitle('Filtrar por Educación (1 proyectos)')).toBeInTheDocument();
    expect(screen.getByTitle('Filtrar por Salud (1 proyectos)')).toBeInTheDocument();
  });
});

describe('<ProjectMap /> mapa chico — marcadores', () => {
  test('un pin por proyecto, todos color tinta y ninguno seleccionado', () => {
    const { container } = renderMap([P1, P2]);
    const p = pins(inlineRoot(container));
    expect(p).toHaveLength(2);
    expect(pinColor(p[0])).toBe(INK);
    expect(pinColor(p[1])).toBe(INK);
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
    expect(userIcon.innerHTML).toContain('bg-[#0F1419]');
    expect(userIcon.style.width).toBe('16px');
    expect(userIcon.style.marginLeft).toBe('-8px');
    fireEvent.click(pins(container)[0]);
    expect(userPins(container)).toHaveLength(1);
    expect(pins(container)).toHaveLength(2);
  });

  test('si cambian los proyectos se quitan los pines viejos', () => {
    const { container, rerender } = renderMap([P1, P2, P3]);
    expect(pins(container)).toHaveLength(3);
    const onSelect = vi.fn();
    rerender(<MemoryRouter><ProjectMap projects={[P2]} onSelectProject={onSelect} /></MemoryRouter>);
    const p = pins(container);
    expect(p).toHaveLength(1);
    fireEvent.click(p[0]);
    expect(onSelect).toHaveBeenCalledWith(P2);
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
    const { onSelectProject } = renderMap([P1, P2, P3]);
    openModal();
    expect(pins(modalRoot())).toHaveLength(3);
    fireEvent.click(screen.getByTitle('Filtrar por Salud (1 proyectos)'));
    const p = pins(modalRoot());
    expect(p).toHaveLength(1);
    fireEvent.click(p[0]);
    expect(onSelectProject).toHaveBeenCalledWith(P2);
  });

  test('un proyecto sin coordenadas no cambia de lugar al filtrar por categoría', () => {
    const sinCoords = (id: string, category: string) =>
      ({ id, title: `Proyecto ${id}`, category, latitude: null, longitude: null, location: 'Córdoba' } as unknown as Project);
    const Q1 = sinCoords('q1', 'Salud'), Q2 = sinCoords('q2', 'Educación');
    // L.marker([lat, lng]) se llama una vez por pin, en el orden de la lista (filtrada) que se dibuja.
    const marker = vi.spyOn(L, 'marker');
    const dibujados = () => marker.mock.calls.map((c: unknown[]) => c[0]);
    renderMap([Q1, Q2]);
    openModal();
    marker.mockClear();
    fireEvent.click(screen.getByTitle('Filtrar por Salud (1 proyectos)'));   // redibuja todo: deja [Q1]
    fireEvent.click(screen.getByTitle('Quitar filtro: Salud'));              // vuelve a [Q1, Q2]
    const [, q2Completa] = dibujados().slice(-2);
    marker.mockClear();
    fireEvent.click(screen.getByTitle('Filtrar por Educación (1 proyectos)')); // solo Q2: pasa a ser el primero
    expect(pins(modalRoot())).toHaveLength(1);
    expect(dibujados()).toEqual([q2Completa]);
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
