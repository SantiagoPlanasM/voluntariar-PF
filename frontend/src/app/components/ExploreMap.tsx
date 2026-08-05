import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Project } from '../../lib/api';
import { Loader2, Navigation } from 'lucide-react';

const L_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const L_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

const LOCATION_COORDS: Record<string, [number, number]> = {
  'Parque Sarmiento, Córdoba': [-31.4278, -64.1795],
  'Río Suquía, Córdoba': [-31.4050, -64.1880],
  'Galpón Central, Córdoba': [-31.4110, -64.1720],
  'Universidad Blas Pascal, Córdoba': [-31.3485, -64.2635],
  'Microcentro, Córdoba': [-31.4135, -64.1810],
  'Comedor Central, Barrio Müller': [-31.4190, -64.1480],
  'Barrio Güemes, Córdoba': [-31.4255, -64.1945],
  'Barrio Alberdi, Córdoba': [-31.4095, -64.2045],
  'Barrio General Paz, Córdoba': [-31.4085, -64.1685],
  'Barrio San Vicente, Córdoba': [-31.4245, -64.1530],
  'Plaza San Martín, Córdoba': [-31.4137, -64.1812],
  'Parque de las Tejas, Córdoba': [-31.4312, -64.1878],
};

function getCoords(locationStr: string, index: number): [number, number] {
  for (const key of Object.keys(LOCATION_COORDS)) {
    if (locationStr.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(locationStr.toLowerCase())) {
      const base = LOCATION_COORDS[key];
      // Add very tiny offset to prevent exact duplicates from overlapping completely
      return [base[0] + (index * 0.00015), base[1] + (index * 0.00015)];
    }
  }
  // Return spread coord around Cordoba center
  const seed = index * 0.01;
  return [-31.4135 + Math.sin(seed) * 0.02, -64.18105 + Math.cos(seed) * 0.02];
}

interface ExploreMapProps {
  projects: Project[];
}

export function ExploreMap({ projects }: ExploreMapProps) {
  const navigate = useNavigate();
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);

  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);

  // 1. Load Leaflet script & CSS dynamically from CDN
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = L_CSS;
      document.head.appendChild(link);
    }

    if ((window as any).L) {
      setLeafletLoaded(true);
    } else {
      const script = document.createElement('script');
      script.src = L_JS;
      script.async = true;
      script.onload = () => setLeafletLoaded(true);
      document.body.appendChild(script);
    }
  }, []);

  // 2. Locate User
  useEffect(() => {
    if (!leafletLoaded) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => {
        // Fallback to Cordoba center
        setUserLocation([-31.417, -64.183]);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, [leafletLoaded]);

  // 3. Initialize Map Instance
  useEffect(() => {
    if (!leafletLoaded || !userLocation || !mapDivRef.current) return;
    const L = (window as any).L;

    // Remove existing map if exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    // Initialize Map centered on user location
    const map = L.map(mapDivRef.current, {
      zoomControl: false,
    }).setView(userLocation, 13);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Standard OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    mapInstanceRef.current = map;

    // Create user pulsing marker icon
    const userIcon = L.divIcon({
      className: 'custom-user-icon',
      html: '<div class="user-marker-pulse"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    // Add user marker
    userMarkerRef.current = L.marker(userLocation, { icon: userIcon })
      .addTo(map)
      .bindPopup('<div class="font-bold text-xs text-blue-600">Tu ubicación actual</div>');

    // Handle React router navigation inside Leaflet popups
    map.on('popupopen', (e: any) => {
      const container = e.popup.getElement();
      const btn = container?.querySelector('.view-project-btn');
      if (btn) {
        btn.addEventListener('click', (ev: Event) => {
          ev.preventDefault();
          const id = btn.getAttribute('data-id');
          if (id) navigate(`/project/${id}`);
        });
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [leafletLoaded, userLocation]);

  // 4. Update Markers when projects list changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!leafletLoaded || !map) return;
    const L = (window as any).L;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Custom marker icon for projects
    const projectIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Plot new pins
    const newMarkers = projects.map((p, idx) => {
      const coords = getCoords(p.location, idx);
      
      const popupHTML = `
        <div class="p-1 max-w-[200px] font-sans">
          ${p.image ? `<img src="${p.image}" class="w-full h-24 object-cover rounded-lg mb-2 shadow-sm" style="display:block;" />` : ''}
          <span class="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-full mb-1">${p.category}</span>
          <h4 class="text-sm font-bold text-gray-900 leading-tight mb-1 truncate">${p.title}</h4>
          <p class="text-xs text-gray-500 mb-2 truncate">${p.ngo_name || 'ONG'}</p>
          <a href="/project/${p.id}" data-id="${p.id}" class="view-project-btn block text-center w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-colors no-underline">Ver detalles</a>
        </div>
      `;

      const m = L.marker(coords, { icon: projectIcon })
        .addTo(map)
        .bindPopup(popupHTML);

      return m;
    });

    markersRef.current = newMarkers;

    // Auto-fit bounds if we have projects
    if (newMarkers.length > 0) {
      const group = L.featureGroup([
        userMarkerRef.current,
        ...newMarkers
      ].filter(Boolean));
      map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 });
    }
  }, [projects, leafletLoaded, userLocation]);

  // Recenter button
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (map && userLocation) {
      map.setView(userLocation, 14, { animate: true });
    }
  };

  if (!leafletLoaded || locating || !userLocation) {
    return (
      <div className="w-full h-[500px] bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center gap-3 shadow-xs">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm text-gray-500 font-semibold animate-pulse">Obteniendo mapa y geolocalización...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[500px] rounded-2xl shadow-sm border border-gray-100 overflow-hidden bg-gray-100">
      
      {/* Map Element */}
      <div ref={mapDivRef} className="w-full h-full z-10" />

      {/* Recenter floating button */}
      <button 
        onClick={handleRecenter}
        className="absolute bottom-4 right-4 z-20 w-11 h-11 bg-white hover:bg-gray-50 text-gray-700 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all border border-gray-100 cursor-pointer"
        title="Centrar en mi ubicación"
      >
        <Navigation className="w-5 h-5" />
      </button>

      {/* Embedded Pulsing style */}
      <style>{`
        .user-marker-pulse {
          background: #3b82f6;
          border: 2px solid white;
          border-radius: 50%;
          height: 14px;
          width: 14px;
          position: absolute;
          left: 50%;
          top: 50%;
          margin: -7px 0 0 -7px;
          box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
          animation: marker-pulse 1.8s infinite;
        }
        @keyframes marker-pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6);
          }
          70% {
            transform: scale(1.1);
            box-shadow: 0 0 0 12px rgba(59, 130, 246, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
          }
        }
        /* Leaflet popup customization */
        .leaflet-popup-content-wrapper {
          border-radius: 16px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          border: 1px solid #f3f4f6;
        }
        .leaflet-popup-content {
          margin: 12px;
        }
      `}</style>
    </div>
  );
}
