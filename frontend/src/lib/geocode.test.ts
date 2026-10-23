// src/lib/geocode.test.ts — buscador de direcciones del alta de voluntariados (Nominatim, OpenStreetMap).
//
// Criterio de aceptación: le pega a Nominatim (no a nuestra API) con la dirección, en Argentina, en español y hasta
// 5 resultados; nunca manda el token de la sesión a un tercero; devuelve { label, lat, lng } con números y descarta
// lo que no tenga coordenadas válidas; si Nominatim falla o no hay red, un mensaje en español que dice qué hacer.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { geocodeAddress, GEOCODER_URL } from './api';

let fetchMock: ReturnType<typeof vi.fn>;
const responde = (body: unknown, ok = true, status = 200) =>
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body } as Response);

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('v_token', 'tok-123');
});
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe('geocodeAddress', () => {
  test('consulta a Nominatim con la dirección, en Argentina, en español y hasta 5 resultados, sin el token', async () => {
    responde([]);
    await geocodeAddress('  Parque Sarmiento, Córdoba ');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    const u = new URL(url);
    expect(`${u.origin}${u.pathname}`).toBe(GEOCODER_URL);
    expect(GEOCODER_URL).toBe('https://nominatim.openstreetmap.org/search');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      q: 'Parque Sarmiento, Córdoba', format: 'jsonv2', countrycodes: 'ar', limit: '5', 'accept-language': 'es',
    });
    expect(JSON.stringify(init ?? {})).not.toContain('tok-123');
  });

  test('devuelve etiqueta y coordenadas numéricas; descarta las que no son números', async () => {
    responde([
      { display_name: 'Parque Sarmiento, Córdoba', lat: '-31.4287', lon: '-64.1756' },
      { display_name: 'Roto', lat: 'abc', lon: '-64' },
      { display_name: 'Sin lon', lat: '-31' },
      { display_name: 'Plaza San Martín, Córdoba', lat: '-31.4165', lon: '-64.1835' },
    ]);
    expect(await geocodeAddress('plaza')).toEqual([
      { label: 'Parque Sarmiento, Córdoba', lat: -31.4287, lng: -64.1756 },
      { label: 'Plaza San Martín, Córdoba', lat: -31.4165, lng: -64.1835 },
    ]);
  });

  test('una respuesta que no es una lista cuenta como sin resultados', async () => {
    responde({ error: 'raro' });
    expect(await geocodeAddress('algo')).toEqual([]);
  });

  test.each([
    ['Nominatim responde 429', () => responde({}, false, 429)],
    ['no hay red', () => fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))],
    ['la respuesta no es JSON', () => fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } } as unknown as Response)],
  ])('%s: error con un mensaje en español que dice qué hacer', async (_caso, preparar) => {
    preparar();
    await expect(geocodeAddress('algo')).rejects.toThrow('No pudimos buscar la dirección. Marcá el lugar tocando el mapa.');
  });
});
