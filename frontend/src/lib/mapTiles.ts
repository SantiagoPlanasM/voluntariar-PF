// src/lib/mapTiles.ts — lo común a todos los mapas (Explorar, mapa ampliado y el selector de ubicación del alta):
// el fondo, el centro por defecto y el pin.
//
// Antes los mosaicos salían de los servidores internos de Google (mt0..3.google.com/vt), sin clave y con la
// atribución apagada: sus condiciones no lo permiten. CARTO (estilo Voyager) dibuja datos de OpenStreetMap, es
// gratis para un uso como este y pide mostrar la atribución de los dos.
import L from 'leaflet';

export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
export const TILE_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>';

// Coordenadas base de Córdoba Capital
export const DEFAULT_CENTER = { lat: -31.4201, lng: -64.1888 };

export function addBaseTiles(map: L.Map) {
  return L.tileLayer(TILE_URL, { subdomains: 'abcd', maxZoom: 20, attribution: TILE_ATTRIBUTION }).addTo(map);
}

export function createPinIcon(bg: string, isSelected: boolean) {
  const html = `
    <div class="group relative cursor-pointer transform transition-transform duration-200 ${isSelected ? 'scale-125 z-50' : 'hover:scale-110'}">
      <div style="background-color: ${bg}; border-color: #ffffff;"
           class="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 text-white">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>
      <div style="border-top-color: ${bg};"
           class="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] mx-auto -mt-[1px]"></div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-map-pin',
    iconSize: [32, 38],
    iconAnchor: [16, 38],
  });
}
