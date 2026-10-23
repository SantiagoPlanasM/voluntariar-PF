import React, { useEffect, useId, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import {
  MapPin, Maximize2, Navigation, ExternalLink, X, Compass, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Project } from '../../lib/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Modal } from './Modal';
import { addBaseTiles, createPinIcon, DEFAULT_CENTER } from '../../lib/mapTiles';

const DEFAULT_ZOOM = 13;

// Colores vivos y definidos según categoría para pines y filtros
export const CATEGORY_COLORS: Record<string, { bg: string; border: string }> = {
  'Medio Ambiente': { bg: '#0F1419', border: '#0F1419' },
  'Alimentación':   { bg: '#0F1419', border: '#0F1419' },
  'Educación':      { bg: '#0F1419', border: '#0F1419' },
  'Animales':       { bg: '#0F1419', border: '#0F1419' },
  'Salud':          { bg: '#0F1419', border: '#0F1419' },
  'Construcción':   { bg: '#0F1419', border: '#0F1419' },
  'Tecnología':     { bg: '#0F1419', border: '#0F1419' },
};

// Todos los pines van en `ink` (DESIGN.md: sin colores por categoría; el azul y el verde son solo dinero y personas).
export function getCategoryColor(_cat?: string) {
  return { bg: '#0F1419', border: '#0F1419' };
}

// Hash FNV-1a de 32 bits: el mismo texto da siempre el mismo número.
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// Coordenadas del proyecto; si no tiene, un punto de respaldo alrededor del centro de Córdoba que sale de su id.
// Antes el respaldo buscaba palabras clave de la semilla en la ubicación ("centro" llevaba al microcentro
// cualquier "Centro vecinal…") y si no, usaba la posición en la lista: el pin saltaba de lugar al filtrar.
export function getProjectCoords(p: Project): { lat: number; lng: number } {
  if (p.latitude != null && p.longitude != null) {
    // Convertir antes de mirar NaN: Number.isNaN('abc') da false (el isNaN global convertía solo).
    const lat = Number(p.latitude), lng = Number(p.longitude);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
  }

  const h = hashId(p.id || '');
  const angle = h % 360;
  const radius = 0.015 + (Math.floor(h / 360) % 25) / 1000;
  const rad = (angle * Math.PI) / 180;
  return {
    lat: DEFAULT_CENTER.lat + radius * Math.sin(rad),
    lng: DEFAULT_CENTER.lng + radius * Math.cos(rad),
  };
}

type MappedProject = { project: Project; coords: { lat: number; lng: number }; colors: { bg: string } };

// Redibuja los pines y el punto del usuario. Común al mapa chico y al ampliado (antes copiado en los
// dos, REVISION S7): quita los marcadores anteriores y devuelve los nuevos para guardarlos en el ref.
// Lo único que difería es la duración del paneo al tocar un pin (`panDuration`).
function drawMarkers(
  map: L.Map,
  previous: L.Marker[],
  mappedProjects: MappedProject[],
  selectedId: string | undefined,
  userLocation: { lat: number; lng: number } | null,
  panDuration: number,
  onPick: (p: Project) => void,
): L.Marker[] {
  previous.forEach(m => m.remove());
  const markers: L.Marker[] = [];

  mappedProjects.forEach(({ project, coords, colors }) => {
    const customIcon = createPinIcon(colors.bg, selectedId === project.id);
    const marker = L.marker([coords.lat, coords.lng], { icon: customIcon }).addTo(map);

    marker.on('click', () => {
      map.panTo([coords.lat, coords.lng], { animate: true, duration: panDuration });
      onPick(project);
    });

    markers.push(marker);
  });

  if (userLocation) {
    const userHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-4 h-4 bg-[#0F1419] rounded-full border-2 border-white shadow-md z-10"></div>
          <div class="absolute w-8 h-8 bg-[#0F1419] rounded-full opacity-25 animate-ping"></div>
        </div>
      `;
    const userIcon = L.divIcon({
      html: userHtml,
      className: 'user-loc-pin',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    markers.push(L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map));
  }

  return markers;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE MODAL / POP-UP DEL MAPA AMPLIADO
// ─────────────────────────────────────────────────────────────────────────────
interface ProjectMapModalProps {
  projects: Project[];
  initialSelectedProject?: Project | null;
  onClose: () => void;
  onSelectProject?: (p: Project) => void;
}

function ProjectMapModal({
  projects,
  initialSelectedProject = null,
  onClose,
  onSelectProject,
}: ProjectMapModalProps) {
  const navigate = useNavigate();
  const modalMapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkersRef = useRef<L.Marker[]>([]);

  const [selectedProject, setSelectedProject] = useState<Project | null>(initialSelectedProject);
  const titleId = useId();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Referencia y estado de scroll para la barra horizontal de categorías
  const filterScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = filterScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scrollFilters = (direction: 'left' | 'right') => {
    if (!filterScrollRef.current) return;
    const amount = direction === 'left' ? -220 : 220;
    filterScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    setTimeout(checkScroll, 250);
  };

  // Convertir el scroll vertical del mouse en scroll horizontal sobre las categorías
  useEffect(() => {
    const el = filterScrollRef.current;
    if (!el) return;

    checkScroll();

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY * 1.2;
        checkScroll();
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', checkScroll);
    const timer = setTimeout(checkScroll, 150);

    return () => {
      clearTimeout(timer);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  const toggleCategory = (catName: string) => {
    setSelectedCategories(prev =>
      prev.includes(catName) ? prev.filter(c => c !== catName) : [...prev, catName]
    );
  };

  const clearCategories = () => {
    setSelectedCategories([]);
  };

  // Filtrado de proyectos por categorías seleccionadas (permite seleccionar múltiples)
  const filteredProjects = useMemo(() => {
    if (selectedCategories.length === 0) return projects;
    return projects.filter(p => p.category && selectedCategories.includes(p.category));
  }, [projects, selectedCategories]);

  // Conteo de proyectos por categoría
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return counts;
  }, [projects]);

  // Proyectos mapeados para Leaflet
  const mappedProjects = useMemo(() => {
    return filteredProjects.map(p => ({
      project: p,
      coords: getProjectCoords(p),
      colors: getCategoryColor(p.category),
    }));
  }, [filteredProjects]);

  // Limpiar proyecto seleccionado si deja de coincidir con el filtro
  useEffect(() => {
    if (selectedProject && !filteredProjects.some(p => p.id === selectedProject.id)) {
      setSelectedProject(null);
    }
  }, [filteredProjects, selectedProject]);

  // Escape, foco y bloqueo del scroll: <Modal> (antes un listener propio en window).

  // Actualizar marcadores
  const updateMarkers = useCallback(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    leafletMarkersRef.current = drawMarkers(
      map, leafletMarkersRef.current, mappedProjects, selectedProject?.id, userLocation, 0.4,
      project => {
        setSelectedProject(project);
        if (onSelectProject) onSelectProject(project);
      },
    );
  }, [mappedProjects, selectedProject, userLocation, onSelectProject]);

  // Inicializar Leaflet en el modal
  useEffect(() => {
    if (!modalMapContainerRef.current) return;

    const initialCenter = selectedProject
      ? getProjectCoords(selectedProject)
      : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];

    const map = L.map(modalMapContainerRef.current, {
      center: initialCenter as L.LatLngExpression,
      zoom: selectedProject ? 14 : DEFAULT_ZOOM,
      zoomControl: false,
    });

    addBaseTiles(map);

    leafletMapRef.current = map;
    updateMarkers();

    // Invalidad tamaño múltiples veces para garantizar carga perfecta sin mosaicos grises
    const t1 = setTimeout(() => map.invalidateSize(), 50);
    const t2 = setTimeout(() => map.invalidateSize(), 200);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (modalMapContainerRef.current) {
      resizeObserver.observe(modalMapContainerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      resizeObserver.disconnect();
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  // Sincronizar marcadores cuando cambian
  useEffect(() => {
    updateMarkers();
  }, [mappedProjects, updateMarkers]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setIsLocating(false);
        if (leafletMapRef.current) {
          leafletMapRef.current.flyTo([coords.lat, coords.lng], 14);
        }
      },
      err => {
        setIsLocating(false);
        console.warn('No se pudo obtener ubicación:', err.message);
        if (leafletMapRef.current) {
          leafletMapRef.current.flyTo([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_ZOOM);
        }
      },
      { timeout: 7000 }
    );
  };

  const handleZoomIn = () => leafletMapRef.current?.zoomIn();
  const handleZoomOut = () => leafletMapRef.current?.zoomOut();

  return createPortal(
    <Modal onClose={onClose} labelledBy={titleId}
      overlayClassName="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 md:p-8 animate-in fade-in duration-200"
      className="relative w-full max-w-5xl h-[88vh] bg-white rounded-3xl shadow-2xl border border-gray-200/90 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
    >
        {/* Header del Pop-up */}
        {/* Header del Pop-up con Filtros Interactivos (Multiselección) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white z-10 shrink-0 gap-3">
          {/* Título y Conteo */}
          <div className="flex items-center justify-between min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <Compass className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 id={titleId} className="font-bold text-sm sm:text-base text-gray-900 truncate">
                  Mapa de Voluntariados
                </h3>
                <p className="text-xs text-gray-500 truncate flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  <span>
                    {selectedCategories.length === 0
                      ? `${projects.length} proyectos solidarios geolocalizados`
                      : `${filteredProjects.length} de ${projects.length} proyectos mostrados`}
                  </span>
                </p>
              </div>
            </div>

            {/* Botón cerrar en pantallas pequeñas */}
            <button
              onClick={onClose}
              className="md:hidden w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors shrink-0"
              title="Cerrar (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filtros Interactivos por Categoría (Multiselección) con Scroll Horizontal y Flechas */}
          <div className="flex items-center min-w-0 flex-1 gap-1 justify-end">
            {canScrollLeft && (
              <button
                type="button"
                onClick={() => scrollFilters('left')}
                className="w-7 h-7 rounded-full bg-white shadow-xs border border-gray-200 text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-all shrink-0 cursor-pointer"
                title="Categorías anteriores"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            <div
              ref={filterScrollRef}
              onScroll={checkScroll}
              className="flex items-center gap-1.5 overflow-x-auto scroll-smooth py-1 px-1 min-w-0 scrollbar-none"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {selectedCategories.length > 0 && (
                <button
                  type="button"
                  onClick={clearCategories}
                  className="text-xs font-bold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-2.5 py-1 rounded-full transition-all shrink-0 cursor-pointer shadow-xs"
                  title="Mostrar todos los proyectos"
                >
                  Todos ({projects.length})
                </button>
              )}

              {Object.entries(CATEGORY_COLORS).map(([name, col]) => {
                const isSelected = selectedCategories.includes(name);
                const count = categoryCounts[name] || 0;

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleCategory(name)}
                    title={
                      isSelected
                        ? `Quitar filtro: ${name}`
                        : `Filtrar por ${name} (${count} proyectos)`
                    }
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer shrink-0 select-none active:scale-95 ${
                      isSelected
                        ? 'shadow-sm text-white font-semibold'
                        : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200/90 hover:border-gray-300'
                    }`}
                    style={
                      isSelected
                        ? { backgroundColor: col.bg, borderColor: col.border }
                        : undefined
                    }
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 transition-transform ${
                        isSelected ? 'bg-white scale-125' : ''
                      }`}
                      style={!isSelected ? { backgroundColor: col.bg } : undefined}
                    />
                    <span>{name}</span>
                    {count > 0 && (
                      <span
                        className={`text-xs px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                          isSelected
                            ? 'bg-black/15 text-white'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {canScrollRight && (
              <button
                type="button"
                onClick={() => scrollFilters('right')}
                className="w-7 h-7 rounded-full bg-white shadow-xs border border-gray-200 text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-all shrink-0 cursor-pointer"
                title="Más categorías"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Botón cerrar en escritorio */}
          <button
            onClick={onClose}
            className="hidden md:flex w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 items-center justify-center transition-colors shrink-0 ml-2 cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenedor del Mapa Leaflet */}
        <div className="relative flex-1 w-full min-h-0 bg-[#f8f9fa]">
          <style>{`
            .leaflet-container {
              background-color: #f1f3f4 !important;
              font-family: inherit;
            }
          `}</style>
          <div ref={modalMapContainerRef} className="w-full h-full z-0" />

          {/* Controles Flotantes dentro del Modal */}
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-1.5 pointer-events-auto">
            <button
              onClick={handleLocateMe}
              title="Centrar en mi ubicación"
              disabled={isLocating}
              className="w-9 h-9 rounded-full bg-white/95 backdrop-blur-md shadow-md border border-gray-200/80 text-gray-700 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform disabled:opacity-50"
            >
              <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin text-emerald-600' : 'text-gray-700'}`} />
            </button>

            <button
              onClick={handleZoomIn}
              title="Acercar"
              className="w-9 h-9 rounded-full bg-white/95 backdrop-blur-md shadow-md border border-gray-200/80 text-gray-700 font-bold text-sm flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform"
            >
              +
            </button>

            <button
              onClick={handleZoomOut}
              title="Alejar"
              className="w-9 h-9 rounded-full bg-white/95 backdrop-blur-md shadow-md border border-gray-200/80 text-gray-700 font-bold text-sm flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform"
            >
              −
            </button>
          </div>

          {/* Mensaje si no hay proyectos con los filtros activos */}
          {filteredProjects.length === 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-white/95 backdrop-blur-md px-6 py-4 rounded-2xl shadow-xl border border-gray-200 text-center max-w-xs pointer-events-auto">
              <p className="text-sm font-bold text-gray-800">No hay proyectos para las categorías seleccionadas</p>
              <button
                type="button"
                onClick={clearCategories}
                className="mt-2.5 inline-block text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 font-bold px-3 py-1.5 rounded-lg border border-gray-200 transition-colors cursor-pointer"
              >
                Restablecer filtros
              </button>
            </div>
          )}

          {/* Tarjeta Flotante al Seleccionar un Proyecto */}
          {selectedProject && (
            <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-88 z-20 pointer-events-auto animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="bg-white/98 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-gray-200/80 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {selectedProject.image ? (
                      <img
                        src={selectedProject.image}
                        alt={selectedProject.title}
                        className="w-12 h-12 rounded-xl object-cover border border-gray-100 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-people-soft text-people-text flex items-center justify-center shrink-0">
                        <MapPin className="w-6 h-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                        {selectedProject.category || 'General'}
                      </span>
                      <h4 className="font-bold text-xs sm:text-sm text-gray-900 truncate mt-0.5" title={selectedProject.title}>
                        {selectedProject.title}
                      </h4>
                      <p className="text-xs text-gray-500 truncate">
                        {selectedProject.ngo_name || 'Organización Solidaria'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedProject(null)} aria-label="Cerrar detalle"
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                  <span className="text-gray-500 flex items-center gap-1.5 truncate max-w-[190px]">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{selectedProject.location || 'Córdoba'}</span>
                  </span>
                  <button
                    onClick={() => {
                      onClose();
                      navigate(`/project/${selectedProject.id}`);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
                  >
                    <span>Ver Proyecto</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
    </Modal>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL (INLINE)
// ─────────────────────────────────────────────────────────────────────────────
interface ProjectMapProps {
  projects: Project[];
  className?: string;
  onSelectProject?: (p: Project) => void;
}

export function ProjectMap({ projects, className = '', onSelectProject }: ProjectMapProps) {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkersRef = useRef<L.Marker[]>([]);

  const mappedProjects = useMemo(() => {
    return projects.map(p => ({
      project: p,
      coords: getProjectCoords(p),
      colors: getCategoryColor(p.category),
    }));
  }, [projects]);

  const updateMarkers = useCallback(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    leafletMarkersRef.current = drawMarkers(
      map, leafletMarkersRef.current, mappedProjects, selectedProject?.id, userLocation, 0.5,
      project => {
        setSelectedProject(project);
        if (onSelectProject) onSelectProject(project);
      },
    );
  }, [mappedProjects, selectedProject, userLocation, onSelectProject]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    });

    addBaseTiles(map);

    leafletMapRef.current = map;
    updateMarkers();

    const timer = setTimeout(() => {
      if (leafletMapRef.current) {
        leafletMapRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    updateMarkers();
  }, [mappedProjects, updateMarkers]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setIsLocating(false);
        if (leafletMapRef.current) {
          leafletMapRef.current.flyTo([coords.lat, coords.lng], 14);
        }
      },
      err => {
        setIsLocating(false);
        console.warn('No se pudo obtener ubicación:', err.message);
        if (leafletMapRef.current) {
          leafletMapRef.current.flyTo([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_ZOOM);
        }
      },
      { timeout: 7000 }
    );
  };

  const handleZoomIn = () => leafletMapRef.current?.zoomIn();
  const handleZoomOut = () => leafletMapRef.current?.zoomOut();

  return (
    <>
      <div
        className={`relative rounded-3xl overflow-hidden shadow-sm border border-gray-200/70 h-[280px] w-full bg-[#f8f9fa] ${className}`}
      >
        <style>{`
          .leaflet-container {
            background-color: #f1f3f4 !important;
            font-family: inherit;
          }
        `}</style>

        {/* Contenedor del Mapa Inline */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* ── Pastilla Superior con Conteo Dinámico ──────────────────────── */}
        <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-2 pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-sm border border-gray-200/80 text-xs text-gray-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-extrabold text-gray-900">{projects.length} proyectos</span>
            <span className="hidden sm:inline text-gray-500">en tu área</span>
          </div>
        </div>

        {/* ── Botones de Control Flotantes (Zoom, GPS, Pop-up Ampliado) ─────────── */}
        <div className="absolute top-3.5 right-3.5 z-10 flex flex-col gap-1.5 pointer-events-auto">
          {/* Abrir Pop-up de Mapa Ampliado */}
          <button
            onClick={() => setIsModalOpen(true)}
            title="Abrir mapa ampliado (Pop-up)"
            className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md shadow-sm border border-gray-200/80 text-gray-700 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Ubicación del usuario */}
          <button
            onClick={handleLocateMe}
            title="Centrar en mi ubicación"
            disabled={isLocating}
            className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md shadow-sm border border-gray-200/80 text-gray-700 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform disabled:opacity-50"
          >
            <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin text-emerald-600' : 'text-gray-700'}`} />
          </button>

          {/* Zoom In */}
          <button
            onClick={handleZoomIn}
            title="Acercar"
            className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md shadow-sm border border-gray-200/80 text-gray-700 font-bold text-sm flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform"
          >
            +
          </button>

          {/* Zoom Out */}
          <button
            onClick={handleZoomOut}
            title="Alejar"
            className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md shadow-sm border border-gray-200/80 text-gray-700 font-bold text-sm flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform"
          >
            −
          </button>
        </div>

        {/* ── Tarjeta Flotante al Seleccionar un Proyecto ──────────────────── */}
        {selectedProject && (
          <div className="absolute bottom-3.5 left-3.5 right-3.5 sm:left-auto sm:right-3.5 sm:w-80 z-20 pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="bg-white/98 backdrop-blur-md rounded-2xl p-3.5 shadow-xl border border-gray-200/80 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {selectedProject.image ? (
                    <img
                      src={selectedProject.image}
                      alt={selectedProject.title}
                      className="w-11 h-11 rounded-xl object-cover border border-gray-100 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-people-soft text-people-text flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                      {selectedProject.category || 'General'}
                    </span>
                    <h4 className="font-bold text-xs text-gray-900 truncate mt-0.5" title={selectedProject.title}>
                      {selectedProject.title}
                    </h4>
                    <p className="text-xs text-gray-500 truncate">
                      {selectedProject.ngo_name || 'Organización Solidaria'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProject(null)} aria-label="Cerrar detalle"
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-xs">
                <span className="text-gray-500 flex items-center gap-1 truncate max-w-[170px]">
                  <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="truncate">{selectedProject.location || 'Córdoba'}</span>
                </span>
                <button
                  onClick={() => navigate(`/project/${selectedProject.id}`)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 shadow-sm shrink-0"
                >
                  <span>Ver</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Pop-up de Mapa Ampliado ──────────────────────────────── */}
      {isModalOpen && (
        <ProjectMapModal
          projects={projects}
          initialSelectedProject={selectedProject}
          onClose={() => setIsModalOpen(false)}
          onSelectProject={onSelectProject}
        />
      )}
    </>
  );
}
