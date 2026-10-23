// src/lib/mapTiles.ts — el fondo de todos los mapas (Explorar, mapa ampliado y el selector de ubicación).
//
// Antes los mosaicos salían de los servidores internos de Google (mt0..3.google.com/vt), sin clave y con la
// atribución apagada: sus condiciones no lo permiten. CARTO (estilo Voyager) dibuja datos de OpenStreetMap, es
// gratis para un uso como este y pide mostrar la atribución de los dos.
import L from 'leaflet';

export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
export const TILE_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>';

export function addBaseTiles(map: L.Map) {
  return L.tileLayer(TILE_URL, { subdomains: 'abcd', maxZoom: 20, attribution: TILE_ATTRIBUTION }).addTo(map);
}
