'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, useMap, Circle, Polyline, GeoJSON, CircleMarker } from 'react-leaflet';
import L from 'leaflet';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { ChevronLeft, ChevronRight, Layers, PlusCircle } from 'lucide-react';
import { type Centro, ESTADO_COLOR, ESTADO_LABEL } from '@/lib/centros';
import SarLayer from './SarLayer';
import Sismo1967Layer from './Sismo1967Layer';
import RainLayer from './RainLayer';
import ClimaLayer from './ClimaLayer';
import AlertasLayer from './AlertasLayer';
import DanosMicrosoftLayer from './DanosMicrosoftLayer';

const DEFAULT_CENTER: [number, number] = [10.4806, -66.9036]; // Caracas, Venezuela (fallback)

// Capa de tiles personalizada con prioridad alta (fetchpriority=high y loading=eager) para mejorar LCP
function PriorityTileLayer() {
  const map = useMap();

  useEffect(() => {
    const PriorityLayer = L.TileLayer.extend({
      createTile: function (coords: any, done: any) {
        const tile = (L.TileLayer.prototype as any).createTile.call(this, coords, done) as HTMLImageElement;
        tile.setAttribute('fetchpriority', 'high');
        (tile as any).fetchPriority = 'high';
        tile.loading = 'eager';
        return tile;
      },
    });

    const layer = new (PriorityLayer as any)(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }
    );

    layer.addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [map]);

  return null;
}

function pinSvg(color: string, size: number, tipo?: string) {
  let inner = '';
  if (tipo === 'alojamiento') {
    inner = `<g transform="translate(3, 2.25) scale(0.75)"><path d="M12 5.5l-4 3.5v5.5h3v-3h2v3h3v-5.5z" fill="${color}"/></g>`;
  } else if (tipo === 'refugio') {
    inner = `<g transform="translate(3, 2.25) scale(0.75)"><path d="M12 5.25L7 9.25v6.5h10v-6.5zm0 2.25l3 2.4v4.1h-2v-2.5h-2v2.5H9v-4.1z" fill="${color}"/></g>`;
  } else {
    // acopio (defecto): caja tridimensional de ayuda
    inner = `<g transform="translate(4.5, 3.7) scale(0.62)" stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </g>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,.35))">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}"/>
    <circle cx="12" cy="9" r="5.4" fill="#ffffff"/>
    ${inner}
  </svg>`;
}
const ICON_CACHE: Record<string, L.DivIcon> = {};
function getCachedIcon(estado: string, active: boolean, tipo?: string) {
  const key = `${estado}-${active}-${tipo || 'acopio'}`;
  if (!ICON_CACHE[key]) {
    const size = active ? 42 : 30;
    const color = active ? '#111827' : (ESTADO_COLOR[estado] || '#e11d48');
    ICON_CACHE[key] = L.divIcon({
      className: 'centro-pin',
      html: pinSvg(color, size, tipo),
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
      popupAnchor: [0, -size + 4],
    });
  }
  return ICON_CACHE[key];
}

const REPLICA_ICON_CACHE: Record<string, L.DivIcon> = {};
function getReplicaIcon(mag: number, color: string) {
  const radius = 4 + Math.max(0, mag - 3) * 3;
  const key = `${mag}-${color}`;
  if (!REPLICA_ICON_CACHE[key]) {
    REPLICA_ICON_CACHE[key] = L.divIcon({
      className: 'replica-pin',
      html: `<div style="
        width: ${radius * 2}px;
        height: ${radius * 2}px;
        background: ${color};
        border: 1px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [radius * 2, radius * 2],
      iconAnchor: [radius, radius],
      popupAnchor: [0, -radius],
    });
  }
  return REPLICA_ICON_CACHE[key];
}

type Sismo = { id: string; mag: number; place: string; time: number; depth: number; lat: number; lng: number };

function relativeTime(ms: number): string {
  const h = Math.floor((Date.now() - ms) / 3_600_000);
  if (h < 1) return 'hace menos de 1 h';
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d > 1 ? 's' : ''}`;
}

type Frescura = 'verde' | 'amarillo' | 'rojo';
const FRESCURA_COLOR: Record<Frescura, string> = { verde: '#16a34a', amarillo: '#d97706', rojo: '#dc2626' };

// Estado de frescura de un centro: verde = confirmado alguna vez por la comunidad
// ("verificado"); amarillo = sin confirmar pero editado/creado hace <= 7 días;
// rojo = sin confirmar y sin actualizaciones hace más de 7 días.
function frescuraEstado(c: Centro): Frescura {
  if (c.lastConfirmedAt) return 'verde';
  const ms = c.updatedAt ? new Date(c.updatedAt).getTime() : NaN;
  if (Number.isNaN(ms)) return 'rojo';
  const ageDays = (Date.now() - ms) / 86_400_000;
  return ageDays <= 7 ? 'amarillo' : 'rojo';
}

function frescura(c: Centro): { dot: string; label: string } {
  const estado = frescuraEstado(c);
  const ts = c.lastConfirmedAt || c.updatedAt;
  const ms = ts ? new Date(ts).getTime() : NaN;
  if (Number.isNaN(ms)) return { dot: FRESCURA_COLOR[estado], label: '' };
  const label = estado === 'verde' ? `Confirmado ${relativeTime(ms)}` : `Actualizado ${relativeTime(ms)}`;
  return { dot: FRESCURA_COLOR[estado], label };
}

function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] as string));
}
function popupHtml(c: Centro) {
  const fr = frescura(c);
  return `<div style="min-width:210px">
    <div style="display:flex;align-items:center;gap:6px">
      <strong style="font-size:14px">${esc(c.name)}</strong>
      <span style="font-size:10px;font-weight:700;color:#fff;background:${ESTADO_COLOR[c.estado]};padding:1px 6px;border-radius:999px">${ESTADO_LABEL[c.estado]}</span>
    </div>
    ${c.address ? `<div style="color:#6b7280;font-size:12px;margin-top:2px">${esc(c.address)}</div>` : ''}
    ${c.recibe?.length ? `<div style="font-size:11px;margin-top:6px"><span style="color:#6b7280">Recibe:</span> ${esc(c.recibe.join(', '))}</div>` : ''}
    ${c.necesitaAhora ? `<div style="font-size:12px;margin-top:6px;font-weight:700;color:#b45309">Necesita ahora: ${esc(c.necesitaAhora)}</div>` : ''}
    ${c.horario ? `<div style="font-size:11px;margin-top:4px;color:#374151">Horario: ${esc(c.horario)}</div>` : ''}
    ${c.contacto ? `<div style="font-size:11px;margin-top:2px;color:#374151">Tel: ${esc(c.contacto)}</div>` : ''}
    <div style="font-size:10px;margin-top:6px;color:#6b7280;display:flex;align-items:center;gap:5px;flex-wrap:wrap">
      ${fr.label ? `<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:7px;height:7px;border-radius:999px;background:${fr.dot};display:inline-block"></span>${fr.label}</span>` : ''}
      ${c.fuente ? `<span style="color:#9ca3af">${fr.label ? '· ' : ''}Fuente: ${esc(c.fuente)}</span>` : ''}
    </div>
    <a href="https://www.google.com/maps/dir/?api=1&destination=${esc(c.latitude)},${esc(c.longitude)}" target="_blank" rel="noopener noreferrer" style="display:block;margin-top:8px;width:100%;font-size:11px;font-weight:700;color:#1e293b;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px;cursor:pointer;text-align:center;text-decoration:none">Cómo llegar (Google Maps)</a>
    <button onclick="window.dispatchEvent(new CustomEvent('acopiove:confirmar',{detail:'${esc(c.id)}'}))" style="margin-top:8px;width:100%;font-size:11px;font-weight:700;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:6px 8px;cursor:pointer">Confirmar que sigue abierto</button>
    <button onclick="window.dispatchEvent(new CustomEvent('acopiove:sugerir',{detail:'${esc(c.id)}'}))" style="margin-top:6px;width:100%;font-size:11px;font-weight:700;color:#1976D2;background:#eff5ff;border:1px solid #cfe0ff;border-radius:8px;padding:6px 8px;cursor:pointer">Completar o corregir info</button>
  </div>`;
}

// Reencuadra el mapa a los centros visibles (corre al cargar y al cambiar filtros).
function MapController({ centros }: { centros: Centro[] }) {
  const map = useMap();
  useEffect(() => {
    const pts = centros
      .map((c) => [parseFloat(c.latitude), parseFloat(c.longitude)] as [number, number])
      .filter((p) => !Number.isNaN(p[0]) && !Number.isNaN(p[1]));
    if (pts.length === 1) map.setView(pts[0], 14);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [60, 60] });
  }, [centros, map]);
  return null;
}

// Marcadores con CLUSTERING: a bajo zoom se agrupan en burbujas; al acercarse se abren.
function ClusterLayer({
  centros,
  selected,
  hovered,
  onSelect,
}: {
  centros: Centro[];
  selected: string | null;
  hovered: string | null;
  onSelect: (id: string) => void;
}) {
  const map = useMap();
  const groupRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const activeRef = useRef<string | null>(null);

  // Escuchar el nivel de zoom actual del mapa para ocultar/mostrar centros cerrados según cercanía
  const [zoomLevel, setZoomLevel] = useState<number>(() => map.getZoom());

  useEffect(() => {
    const handleZoom = () => {
      setZoomLevel(map.getZoom());
    };
    map.on('zoomend', handleZoom);
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map]);

  // Crear el grupo de clusters una sola vez.
  useEffect(() => {
    const group = (L as any).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 55,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      // Color del grupo por frescura de sus centros (peor caso manda), no por
      // cantidad: rojo si alguno lleva +7 días sin confirmar/actualizar, ámbar si
      // ninguno es rojo pero hay alguno sin confirmar, verde si todos están confirmados.
      iconCreateFunction: (cluster: any) => {
        const children = cluster.getAllChildMarkers();
        let peor: Frescura = 'verde';
        for (const child of children) {
          const f: Frescura = child._fresc || 'rojo';
          if (f === 'rojo') { peor = 'rojo'; break; }
          if (f === 'amarillo') peor = 'amarillo';
        }
        return L.divIcon({
          html: `<div><span>${children.length}</span></div>`,
          className: `marker-cluster centro-cluster-${peor}`,
          iconSize: L.point(40, 40),
        });
      },
    });
    groupRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      groupRef.current = null;
      markersRef.current = {};
    };
  }, [map]);

  // (Re)construir los marcadores cuando cambia el set de centros, el zoom o la selección.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();
    markersRef.current = {};
    const layers: any[] = [];
    const isZoomedIn = zoomLevel >= 11;

    for (const c of centros) {
      // Ocultar centros cerrados en la vista general (zoom < 11), a menos que estén seleccionados explícitamente
      if (c.estado === 'cerrado' && !isZoomedIn && c.id !== selected) {
        continue;
      }
      const lat = parseFloat(c.latitude);
      const lng = parseFloat(c.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
      const m = L.marker([lat, lng], {
        icon: getCachedIcon(c.estado, false, c.tipo),
        title: c.name,
        alt: c.name,
      });
      (m as any)._estado = c.estado;
      (m as any)._tipo = c.tipo;
      (m as any)._fresc = frescuraEstado(c);
      m.bindPopup(popupHtml(c), { minWidth: 210 });
      m.on('click', () => onSelect(c.id));
      markersRef.current[c.id] = m;
      layers.push(m);
    }
    group.addLayers(layers); // bulk add (más rápido que uno por uno)
    activeRef.current = null;
  }, [centros, zoomLevel, selected, onSelect]);

  // Al seleccionar (desde la lista o el mapa): abrir cluster y popup.
  useEffect(() => {
    const group = groupRef.current;
    if (!group || !selected) return;
    const m = markersRef.current[selected];
    if (m) group.zoomToShowLayer(m, () => m.openPopup());
  }, [selected]);

  // Resaltar el marcador activo (seleccionado o con hover) sin recorrer todos.
  useEffect(() => {
    const want = selected || hovered || null;
    if (activeRef.current === want) return;
    const setIc = (id: string | null, active: boolean) => {
      if (!id) return;
      const m = markersRef.current[id];
      if (m) m.setIcon(getCachedIcon((m as any)._estado, active, (m as any)._tipo));
    };
    setIc(activeRef.current, false);
    setIc(want, true);
    activeRef.current = want;
  }, [selected, hovered, centros]);

  return null;
}

function UbicacionButton({
  centros,
  onSelect,
  onUserCoordsChange,
}: {
  centros: Centro[];
  onSelect: (id: string) => void;
  onUserCoordsChange: (coords: [number, number] | null) => void;
}) {
  const map = useMap();
  const [loading, setLoading] = useState(false);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLoading(false);
        const { latitude, longitude } = position.coords;
        const coords: [number, number] = [latitude, longitude];
        onUserCoordsChange(coords);
        map.flyTo(coords, 14, { duration: 1.2 });

        let nearest: Centro | null = null;
        let minDist = Infinity;
        for (const c of centros) {
          const cLat = parseFloat(c.latitude);
          const cLon = parseFloat(c.longitude);
          if (Number.isNaN(cLat) || Number.isNaN(cLon)) continue;
          const d = Math.pow(latitude - cLat, 2) + Math.pow(longitude - cLon, 2);
          if (d < minDist) {
            minDist = d;
            nearest = c;
          }
        }
        if (nearest) setTimeout(() => onSelect(nearest!.id), 1200);
      },
      (error) => {
        setLoading(false);
        console.error('Error al obtener ubicación:', error);
        alert('No se pudo acceder a tu ubicación. Asegúrate de habilitar los permisos de GPS.');
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="absolute bottom-[104px] right-4 z-[999] pointer-events-auto">
      <button
        onClick={handleLocate}
        className={`w-11 h-11 bg-ap-surface border border-ap-border rounded-full shadow-agentos-md flex items-center justify-center text-ap-primary hover:bg-ap-surface-hover hover:scale-105 active:scale-95 transition-all ${loading ? 'animate-pulse' : ''}`}
        title="Mi ubicación y centros más cercanos"
        aria-label="Usar mi ubicación GPS"
      >
        {loading ? (
          <svg className="animate-spin h-5 w-5 text-ap-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2v4M12 18v4M4 12h4M18 12h4" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
          </svg>
        )}
      </button>
    </div>
  );
}

const EPICENTROS = [
  {
    id: 'precursor',
    name: 'Sismo Precursor - San Felipe',
    magnitude: '7.2 Mw',
    intensity: 'VIII (Severo)',
    time: '24 de Junio de 2026, 06:04:32 PM VET (22:04:32 UTC)',
    depth: '21.9 km',
    lat: 10.407,
    lng: -68.493,
    radius: 35000, // 35 km
    color: '#d97706',
    isPrecursor: true,
    desc: 'Sismo precursor del doblete. Ocurrió a las 18:04:32 VET, antecediendo al sismo principal por escasos 39 segundos. Sentido con gran fuerza en toda la región.',
  },
  {
    id: 'principal',
    name: 'Sismo Principal - Yumare / Morón',
    magnitude: '7.5 Mw',
    intensity: 'IX (Violento)',
    time: '24 de Junio de 2026, 06:05:11 PM VET (22:05:11 UTC)',
    depth: '10.0 km',
    lat: 10.435,
    lng: -68.472,
    radius: 65000, // 65 km
    color: '#ef4444',
    isPrecursor: false,
    desc: 'Sismo principal del doblete, extremadamente superficial, desencadenado por la ruptura del sismo precursor 39 segundos después. Causó el mayor impacto destructivo.',
  },
];

const getEpicenterIcon = (isPrecursor: boolean) => {
  return L.divIcon({
    className: 'custom-epicenter-icon',
    html: `<div class="relative w-[30px] h-[30px] flex items-center justify-center pointer-events-none">
      <div class="epicenter-pulse-ring ${isPrecursor ? 'epicenter-pulse-ring-precursor' : ''}"></div>
      <div class="epicenter-dot ${isPrecursor ? 'epicenter-dot-precursor' : ''}"></div>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};



function BuscarPersonasButton() {
  return (
    <div className="absolute bottom-[208px] right-4 z-[999] pointer-events-auto">
      <div className="relative">
        <span className="attention-pulse-ring" aria-hidden="true" />
        <a
          href="/busquedas"
          className="relative w-11 h-11 bg-ap-surface border border-ap-border rounded-full shadow-agentos-md flex items-center justify-center text-ap-primary hover:bg-ap-surface-hover hover:scale-105 active:scale-95 transition-all"
          title="Búsqueda avanzada de personas"
          aria-label="Ir a la búsqueda avanzada de personas"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </a>
      </div>
    </div>
  );
}

function CompartirButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="absolute bottom-[156px] right-4 z-[999] pointer-events-auto">
      <button
        onClick={onClick}
        className="w-11 h-11 bg-ap-surface border border-ap-border rounded-full shadow-agentos-md flex items-center justify-center text-ap-primary hover:bg-ap-surface-hover hover:scale-105 active:scale-95 transition-all"
        title="Compartir aplicación"
        aria-label="Compartir enlace de la aplicación"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </button>
    </div>
  );
}

function ZoomButtons() {
  const map = useMap();
  return (
    <>
      <div className="absolute top-3 left-3 z-[999] pointer-events-auto">
        <button
          onClick={() => map.zoomIn()}
          className="w-11 h-11 bg-ap-surface border border-ap-border rounded-full shadow-agentos-md flex items-center justify-center text-ap-primary hover:bg-ap-surface-hover hover:scale-105 active:scale-95 transition-all text-xl font-bold leading-none"
          title="Acercar"
          aria-label="Acercar mapa"
        >+</button>
      </div>
      <div className="absolute top-[60px] left-3 z-[999] pointer-events-auto">
        <button
          onClick={() => map.zoomOut()}
          className="w-11 h-11 bg-ap-surface border border-ap-border rounded-full shadow-agentos-md flex items-center justify-center text-ap-primary hover:bg-ap-surface-hover hover:scale-105 active:scale-95 transition-all text-xl font-bold leading-none"
          title="Alejar"
          aria-label="Alejar mapa"
        >−</button>
      </div>
    </>
  );
}

function AñadirButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="absolute bottom-[260px] right-4 z-[999] pointer-events-auto">
      <button
        onClick={onClick}
        className="w-11 h-11 bg-ap-surface border border-ap-border rounded-full flex items-center justify-center shadow-agentos-md text-ap-primary hover:bg-ap-surface-hover hover:scale-105 active:scale-95 transition-all"
        title="Añadir o cargar información de un centro"
        aria-label="Añadir centro o refugio"
      >
        <PlusCircle size={20} />
      </button>
    </div>
  );
}

function LayerSectionMap({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-ap-border/40 first:pt-0 first:border-t-0">
      <div className="text-[8.5px] font-extrabold text-ap-muted tracking-wide">{title}</div>
      {children}
    </div>
  );
}

function LayerToggleMap({ checked, onChange, color, title, sub }: { checked: boolean; onChange: (v: boolean) => void; color: string; title: string; sub?: string }) {
  return (
    <label className="flex items-start gap-2.5 text-[11px] font-semibold text-ap-secondary cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded border-ap-border text-ap-primary focus:ring-ap-primary cursor-pointer w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5" style={{ background: color }} />
      <div className="flex flex-col leading-tight min-w-0">
        <span className="font-semibold text-ap-primary text-[11px] truncate">{title}</span>
        {sub && <span className="text-[8.5px] text-ap-muted font-normal leading-[1.15]">{sub}</span>}
      </div>
    </label>
  );
}

export default function CentrosMap({
  centros,
  selected,
  hovered,
  onSelect,
  userCoords,
  onUserCoordsChange,
  onClickAñadir,
}: {
  centros: Centro[];
  selected: string | null;
  hovered: string | null;
  onSelect: (id: string) => void;
  userCoords: [number, number] | null;
  onUserCoordsChange: (coords: [number, number] | null) => void;
  onClickAñadir: () => void;
}) {
  const [showShakemap, setShowShakemap] = useState(true);
  const [showEpicentros, setShowEpicentros] = useState(true);
  const [showReplicas, setShowReplicas] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Bandas de intensidad sentida (ShakeMap oficial USGS del sismo principal M7.5).
  const [intensity, setIntensity] = useState<any>(null);
  // Réplicas en vivo (USGS), se autoactualizan cada 5 min.
  const [sismos, setSismos] = useState<Sismo[]>([]);

  // Panel de capas (pestaña derecha)
  const [layersOpen, setLayersOpen] = useState(false);
  // Estado para la leyenda de intensidad sentida (desplegable)
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  // Capas extra: activadas por defecto las de sismos, desactivadas el resto
  const [showSAR, setShowSAR] = useState(false);
  const [show1967, setShow1967] = useState(false);
  const [showRain, setShowRain] = useState(false);
  const [showClima, setShowClima] = useState(false);
  const [showAlertas, setShowAlertas] = useState(false);
  const [showDanosIA, setShowDanosIA] = useState(false);

  useEffect(() => {
    fetch('/shakemap-intensity.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setIntensity(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const load = () =>
      fetch('/api/sismos')
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setSismos(Array.isArray(d) ? d : []))
        .catch(() => {});
    load();
    const id = setInterval(load, 300_000); // refresca cada 5 min → "en vivo"
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleShare = async () => {
    const shareData = {
      title: 'AcopioVE · Mapa de centros de acopio',
      text: 'Encuentra centros de acopio, refugios y teléfonos de emergencia en Venezuela y la diáspora en tiempo real.',
      url: typeof window !== 'undefined' ? window.location.href : 'https://acopiove.org',
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error al compartir:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareData.url);
        setToastMessage('📋 Enlace copiado al portapapeles');
      } catch (err) {
        console.error('Error al copiar:', err);
      }
    }
  };

  return (
    <MapContainer center={DEFAULT_CENTER} zoom={7} scrollWheelZoom zoomControl={false} preferCanvas style={{ height: '100%', width: '100%' }}>
      <PriorityTileLayer />
      <MapController centros={centros} />

      {/* Zonas de afectación por intensidad sentida (debajo de marcadores y epicentros). */}
      {showShakemap && intensity && (
        <GeoJSON
          data={intensity}
          style={(feature) => {
            const c = (feature?.properties as any)?.color || '#de2d26';
            return { color: c, weight: 0.8, opacity: 0.5, fillColor: c, fillOpacity: 0.42 };
          }}
          onEachFeature={(feature, layer) => {
            const p = (feature.properties as any) || {};
            layer.bindPopup(
              `<div style="font-size:12px;font-family:sans-serif;line-height:1.4">
                <strong style="color:${p.color}">Intensidad: ${p.label}</strong><br/>
                Escala de Mercalli — MMI ${p.mmi}<br/>
                <span style="color:#9ca3af;font-size:10px">Sismo principal M7.5 · ShakeMap USGS</span>
              </div>`
            );
          }}
        />
      )}

      <ClusterLayer centros={centros} selected={selected} hovered={hovered} onSelect={onSelect} />

      {userCoords && (
        <Marker
          position={userCoords}
          icon={L.divIcon({
            className: 'user-location-pin',
            html: `<div class="relative w-[18px] h-[18px] flex items-center justify-center">
              <div class="absolute w-[12px] h-[12px] bg-blue-500 border-2 border-white rounded-full shadow-md z-10"></div>
              <div class="absolute w-[18px] h-[18px] bg-blue-500 rounded-full opacity-40 animate-ping"></div>
            </div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          })}
        >
          <Popup>
            <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>Tu ubicación actual</div>
          </Popup>
        </Marker>
      )}

      {showEpicentros &&
        EPICENTROS.map((e) => (
          <Circle
            key={`circle-${e.id}`}
            center={[e.lat, e.lng]}
            radius={e.radius}
            pathOptions={{
              color: e.color,
              fillColor: e.color,
              fillOpacity: 0.08,
              weight: 1.5,
              dashArray: '5, 5',
              interactive: false,
            }}
          />
        ))}

      {showEpicentros && (
        <Polyline
          positions={[
            [EPICENTROS[0].lat, EPICENTROS[0].lng],
            [EPICENTROS[1].lat, EPICENTROS[1].lng],
          ]}
          pathOptions={{
            color: '#ef4444',
            weight: 2.5,
            dashArray: '5, 10',
            opacity: 0.6,
          }}
        >
          <Popup>
            <div style={{ fontSize: '11px', textAlign: 'center', fontFamily: 'sans-serif' }}>
              <strong>Propagación de Ruptura (Falla de Boconó)</strong><br />
              Dirección del doblete sísmico (intervalo de 39s)
            </div>
          </Popup>
        </Polyline>
      )}

      {showEpicentros &&
        EPICENTROS.map((e) => (
          <Marker key={`marker-${e.id}`} position={[e.lat, e.lng]} icon={getEpicenterIcon(e.isPrecursor)}>
            <Popup minWidth={220}>
              <div style={{ fontSize: '12px', lineHeight: '1.4', fontFamily: 'sans-serif' }}>
                <div style={{ fontWeight: '800', color: e.color, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {e.name}
                </div>
                <div style={{ marginTop: '6px', color: '#1e2126' }}>
                  <strong>Magnitud:</strong> <span style={{ fontWeight: 'bold' }}>{e.magnitude}</span> ({e.intensity})
                </div>
                <div style={{ color: '#1e2126' }}>
                  <strong>Profundidad:</strong> {e.depth}
                </div>
                <div style={{ color: '#1e2126' }}>
                  <strong>Hora Local:</strong> {e.time}
                </div>
                <div style={{ marginTop: '6px', color: '#6b7280', fontSize: '11px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '4px' }}>
                  {e.desc}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

      {/* Réplicas en vivo (USGS) — círculos chicos por magnitud. */}
      {showReplicas &&
        sismos.map((s) => {
          const fuerte = s.mag >= 4.5;
          const color = fuerte ? '#dc2626' : '#f59e0b';
          const icon = getReplicaIcon(s.mag, color);
          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={icon}
            >
              <Popup>
                <div style={{ fontSize: '12px', fontFamily: 'sans-serif', lineHeight: 1.4 }}>
                  <strong style={{ color }}>Réplica M{s.mag}</strong>
                  <br />
                  {esc(s.place)}
                  <br />
                  <span style={{ color: '#6b7280' }}>Prof. {s.depth} km · {relativeTime(s.time)}</span>
                  <br />
                  <span style={{ color: '#9ca3af', fontSize: '10px' }}>Fuente: USGS</span>
                </div>
              </Popup>
            </Marker>
          );
        })}

      {/* Capas opcionales */}
      <SarLayer showSAR={showSAR} />
      <Sismo1967Layer show={show1967} />
      <RainLayer show={showRain} />
      <ClimaLayer show={showClima} />
      <AlertasLayer show={showAlertas} />
      <DanosMicrosoftLayer show={showDanosIA} />

      <BuscarPersonasButton />
      <AñadirButton onClick={onClickAñadir} />
      <CompartirButton onClick={handleShare} />
      <ZoomButtons />
      <UbicacionButton centros={centros} onSelect={onSelect} onUserCoordsChange={onUserCoordsChange} />

      {/* Pestaña de Capas — lado derecho */}
      {!layersOpen && (
        <button
          type="button"
          onClick={() => setLayersOpen(true)}
          aria-label="Mostrar capas del mapa"
          title="Capas del mapa"
          className="absolute top-[152px] right-0 z-[999] bg-white/90 backdrop-blur-md border border-ap-border border-r-0 rounded-l-xl shadow-agentos-md pointer-events-auto flex flex-col items-center gap-1.5 px-1.5 py-3 hover:bg-ap-surface-hover transition-colors cursor-pointer"
        >
          <Layers size={14} className="text-ap-primary" />
          <span className="text-[9px] font-extrabold text-ap-primary uppercase tracking-wide [writing-mode:vertical-rl]">Capas</span>
        </button>
      )}
      {layersOpen && (
        <div className="absolute top-[76px] right-0 z-[999] bg-white/90 backdrop-blur-md border border-ap-border border-r-0 rounded-l-xl shadow-agentos-md flex flex-col w-[min(13.5rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-150px)] pointer-events-auto overflow-hidden">
          <button
            type="button"
            onClick={() => setLayersOpen(false)}
            aria-expanded={layersOpen}
            className="shrink-0 flex items-center justify-between w-full text-[10px] font-extrabold text-ap-primary tracking-wide cursor-pointer select-none px-3 pt-3 pb-2 border-b border-ap-border/50"
          >
            <ChevronRight size={14} className="text-ap-muted" />
            <span>Capas del mapa</span>
          </button>
          <div className="overflow-y-auto overscroll-contain min-h-0 px-3 pb-3 pt-2.5 flex flex-col gap-2.5">
            <div className="flex flex-col gap-3">

              <LayerSectionMap title="Sismos 2026">
                <LayerToggleMap checked={showShakemap} onChange={setShowShakemap} color="#de2d26" title="ShakeMap" sub="Bandas de intensidad sentida (USGS)" />
                <LayerToggleMap checked={showEpicentros} onChange={setShowEpicentros} color="#ef4444" title="Epicentros + Ruptura" sub="Doblete M7.2 y M7.5 · Boconó" />
                <LayerToggleMap checked={showReplicas} onChange={setShowReplicas} color="#f59e0b" title="Réplicas en vivo" sub="USGS · cada 5 min" />
              </LayerSectionMap>

              <LayerSectionMap title="Histórico">
                <LayerToggleMap checked={show1967} onChange={setShow1967} color="#7c3aed" title="Terremoto 1967" sub="Intensidad y epicentro M6.6" />
              </LayerSectionMap>

              <LayerSectionMap title="Daños">
                <LayerToggleMap checked={showSAR} onChange={setShowSAR} color="#06b6d4" title="Daño Satelital (SAR)" sub="Sentinel-1 / TerraVE" />
                <LayerToggleMap checked={showDanosIA} onChange={setShowDanosIA} color="#b91c1c" title="Edificios dañados (IA)" sub="Catia La Mar · Microsoft AI" />
              </LayerSectionMap>

              <LayerSectionMap title="Clima y alertas">
                <LayerToggleMap checked={showRain} onChange={setShowRain} color="#3b82f6" title="Lluvia" sub="Tiles · OpenWeatherMap" />
                <LayerToggleMap checked={showClima} onChange={setShowClima} color="#0f766e" title="Clima por ciudad" sub="Temp / lluvia / viento" />
                <LayerToggleMap checked={showAlertas} onChange={setShowAlertas} color="#dc2626" title="Alertas de desastres" sub="Nivel GDACS" />
              </LayerSectionMap>

            </div>
          </div>
        </div>
      )}

      {/* Leyenda de intensidad sentida (acompaña ShakeMap). */}
      {/* Leyenda de intensidad sentida (acompaña ShakeMap) */}
      {showShakemap && intensity && !legendCollapsed && (
        <div className="absolute bottom-[156px] left-3 z-[999] bg-white/90 backdrop-blur-md border border-ap-border rounded-xl px-3 py-2 shadow-agentos-md pointer-events-auto flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-1.5 border-b border-ap-border/30 pb-1 shrink-0">
            <div className="text-[10px] font-extrabold text-ap-primary uppercase tracking-wide">Intensidad sentida</div>
            <button
              onClick={() => setLegendCollapsed(true)}
              className="text-ap-muted hover:text-ap-primary p-0.5"
              title="Plegar leyenda"
              aria-label="Plegar leyenda"
            >
              <ChevronLeft size={14} />
            </button>
          </div>
          {[
            { c: '#a50f15', l: 'Severa' },
            { c: '#de2d26', l: 'Muy fuerte' },
            { c: '#fb6a4a', l: 'Fuerte' },
            { c: '#fcae91', l: 'Moderada' },
            { c: '#fee5d9', l: 'Leve' },
          ].map((row) => (
            <div key={row.l} className="flex items-center gap-1.5 leading-tight">
              <span className="w-3 h-3 rounded-sm border border-black/10 shrink-0" style={{ background: row.c }} />
              <span className="text-[10.5px] font-semibold text-ap-secondary">{row.l}</span>
            </div>
          ))}
          {showReplicas && sismos.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-ap-border/50 flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border border-red-600 shrink-0" style={{ background: 'rgba(220,38,38,.45)' }} />
              <span className="text-[10.5px] font-semibold text-ap-secondary">Réplicas · {sismos.length} (USGS)</span>
            </div>
          )}
          {/* Clusters de centros: color por frescura, no por cantidad */}
          <div className="mt-2 pt-2 border-t border-ap-border/50">
            <div className="text-[10px] font-extrabold text-ap-primary uppercase tracking-wide mb-1.5">Grupos de centros</div>
            <div className="flex items-center gap-2 leading-tight">
              <span className="w-5 h-5 rounded-full border border-[#16a34a] shrink-0 flex items-center justify-center text-[9px] font-extrabold text-black" style={{ background: 'rgba(22,163,74,0.6)' }}>9</span>
              <span className="text-[10.5px] font-semibold text-ap-secondary">Todos confirmados</span>
            </div>
            <div className="flex items-center gap-2 leading-tight mt-1">
              <span className="w-5 h-5 rounded-full border border-[#d97706] shrink-0 flex items-center justify-center text-[9px] font-extrabold text-black" style={{ background: 'rgba(217,119,6,0.6)' }}>9</span>
              <span className="text-[10.5px] font-semibold text-ap-secondary">Con alguno sin confirmar (&lt;7 días)</span>
            </div>
            <div className="flex items-center gap-2 leading-tight mt-1">
              <span className="w-5 h-5 rounded-full border border-[#dc2626] shrink-0 flex items-center justify-center text-[9px] font-extrabold text-black" style={{ background: 'rgba(220,38,38,0.6)' }}>9</span>
              <span className="text-[10.5px] font-semibold text-ap-secondary">Con alguno sin actualizar +7 días</span>
            </div>
          </div>
        </div>
      )}

      {showShakemap && intensity && legendCollapsed && (
        <button
          type="button"
          onClick={() => setLegendCollapsed(false)}
          aria-label="Mostrar leyenda de intensidad"
          title="Leyenda de intensidad"
          className="absolute bottom-[200px] left-0 z-[999] bg-white/90 backdrop-blur-md border border-ap-border border-l-0 rounded-r-xl shadow-agentos-md pointer-events-auto flex flex-col items-center gap-1.5 px-1.5 py-3 hover:bg-ap-surface-hover transition-colors cursor-pointer"
        >
          <ChevronRight size={14} className="text-ap-primary" />
          <span className="text-[9px] font-extrabold text-ap-primary uppercase tracking-wide [writing-mode:vertical-rl] font-sans">
            Leyenda
          </span>
        </button>
      )}

      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[10000] bg-ap-primary text-white text-[12px] font-bold px-4 py-2.5 rounded-xl shadow-agentos-md border border-white/10 flex items-center gap-1.5 pointer-events-none animate-toast">
          {toastMessage}
        </div>
      )}
    </MapContainer>
  );
}
