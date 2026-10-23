// src/app/components/LocationPicker.tsx — el lugar del voluntariado en el mapa (alta, paso Detalles).
//
// Antes el alta mandaba solo el texto de la ubicación y el mapa de Explorar ponía esos voluntariados en un punto
// inventado. Acá se busca la dirección (Nominatim, vía `geocodeAddress`) o se toca el mapa, y el pin se arrastra para
// ajustar. Es opcional: sin punto marcado el voluntariado se publica igual (sin coordenadas).
import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeAddress, type GeocodeResult } from '../../lib/api';
import { addBaseTiles, createPinIcon, DEFAULT_CENTER } from '../../lib/mapTiles';

type LatLng = { lat: number; lng: number };

interface LocationPickerProps {
  /** Lo que se busca: el texto del campo "Ubicación". */
  query: string;
  value: LatLng | null;
  onChange: (v: LatLng | null) => void;
}

const INK = '#0F1419';
const MIN_GAP_MS = 1000; // Nominatim: como máximo un pedido por segundo
const round6 = (n: number) => Math.round(n * 1e6) / 1e6; // ~10 cm: más decimales no suman nada

export function LocationPicker({ query, value, onChange }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  // Los handlers de Leaflet se registran una sola vez: leen el onChange de turno desde el ref.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastSearchRef = useRef(0);

  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: value ? [value.lat, value.lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      zoom: value ? 16 : 13,
      zoomControl: true,
    });
    addBaseTiles(map);
    map.on('click', (e: L.LeafletMouseEvent) => onChangeRef.current({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng) }));
    mapRef.current = map;
    // El paso aparece con una animación: sin esto Leaflet mide el contenedor antes de tiempo (mosaicos grises).
    const timer = setTimeout(() => map.invalidateSize(), 150);
    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // El pin sigue a `value`: se crea la primera vez, después se mueve (no se suma otro) y se quita con null.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
      return;
    }
    const marker = L.marker([value.lat, value.lng], { icon: createPinIcon(INK, false), draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      onChangeRef.current({ lat: round6(p.lat), lng: round6(p.lng) });
    });
    markerRef.current = marker;
  }, [value]);

  const canSearch = query.trim().length >= 3 && !searching;

  const search = async () => {
    if (!canSearch) return;
    setSearching(true);
    setMessage('');
    setResults([]);
    const wait = lastSearchRef.current + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastSearchRef.current = Date.now();
    try {
      const found = await geocodeAddress(query);
      setResults(found);
      if (found.length === 0) setMessage('No encontramos esa dirección. Marcá el lugar tocando el mapa.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No pudimos buscar la dirección.');
    } finally {
      setSearching(false);
    }
  };

  const pick = (r: GeocodeResult) => {
    const v = { lat: round6(r.lat), lng: round6(r.lng) };
    onChange(v);
    mapRef.current?.setView([v.lat, v.lng], 16);
    setResults([]);
  };

  return (
    <div className="mt-2 space-y-2">
      <button type="button" onClick={search} disabled={!canSearch}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
        {searching ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
        Buscar en el mapa
      </button>

      {results.length > 0 && (
        <ul aria-label="Direcciones encontradas" className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {results.map(r => (
            <li key={`${r.lat},${r.lng},${r.label}`}>
              <button type="button" onClick={() => pick(r)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p role="status" className="text-xs text-gray-600">{message}</p>}

      <div ref={containerRef} aria-label="Mapa para marcar el lugar del voluntariado"
        className="h-56 w-full rounded-xl overflow-hidden border border-gray-200 z-0" />

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          {value
            ? 'Lugar marcado. Arrastrá el pin para ajustarlo.'
            : 'Tocá el mapa para marcar el lugar exacto (opcional: sin esto, en el mapa de Explorar aparece en un punto aproximado).'}
        </p>
        {value && (
          <button type="button" onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 shrink-0">
            <X className="w-3.5 h-3.5" aria-hidden="true" /> Quitar del mapa
          </button>
        )}
      </div>
    </div>
  );
}
