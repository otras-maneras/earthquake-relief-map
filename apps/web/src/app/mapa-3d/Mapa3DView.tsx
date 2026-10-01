'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, X, Mountain, Flame, Sun, Box } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { normalizeSearchText } from '@/lib/text';

// Vista 3D de los edificios de Catia La Mar evaluados por Microsoft AI for Good Lab
// (mismo dataset que la capa "Edificios Dañados (IA)" de /busquedas, ver DanosMicrosoftLayer.tsx).
// Basemap: OpenFreeMap (vector tiles OSM, sin API key). Altura de cada edificio = % de daño estimado
// (no es la altura real del edificio: es una codificación visual de severidad).
//
// Capas adicionales opcionales: mismos datos que los layers 2D de /busquedas
// (SismoLayer.tsx, Sismo1967Layer.tsx, ClimaLayer.tsx, AlertasLayer.tsx, RainLayer.tsx,
// y "Daños Estructurales" de /api/personas), reimplementadas con la API de MapLibre
// (fuentes GeoJSON/raster + capas circle/fill/line/raster) en vez de componentes de Leaflet.
const CENTER: [number, number] = [-67.0207, 10.6084];
const DATA_URL = '/danos-catia-la-mar.json';
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const OWM_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_KEY || '';

// Sentinel-1 Likely Damaged Areas (terremoto Venezuela junio 2026) — FeatureServer ArcGIS
// público (sin API key) de Corey Scher (CUNY) y Jamon Van Den Hoek (Oregon State), método
// de coherence-change con Copernicus Sentinel-1. Capa 0 "Structures": ~2.7M polígonos de
// edificios a escala nacional con `damage` (0/1) y `damage_probability`. Se consulta por
// bbox visible y solo con daño (damage=1); tope de 2000 por página y zoom mínimo para no
// jalar el país entero.
const LIKELY_DMG_LAYER = 'https://services7.arcgis.com/WSiUmUhlFx4CtMBB/ArcGIS/rest/services/202610_s1_likelydmgareas/FeatureServer/0';
const LIKELY_DMG_MIN_ZOOM = 13;

const EPICENTROS = [
  {
    id: 'precursor', name: 'Sismo Precursor - San Felipe', magnitude: '7.2 Mw', intensity: 'VIII (Severo)',
    time: '24 de Junio de 2026, 06:04:32 PM VET', depth: '21.9 km', lat: 10.407, lng: -68.493, radiusM: 35000, color: '#d97706',
  },
  {
    id: 'principal', name: 'Sismo Principal - Yumare / Morón', magnitude: '7.5 Mw', intensity: 'IX (Violento)',
    time: '24 de Junio de 2026, 06:05:11 PM VET', depth: '10.0 km', lat: 10.435, lng: -68.472, radiusM: 65000, color: '#ef4444',
  },
];

const EPI_1967 = { lat: 10.602, lng: -67.326, mag: '6.6 Mw', depth: '23 km', place: '32 km al oeste de Catia La Mar', radiusM: 40000 };

const CIUDADES_CLIMA = [
  { name: 'Caracas', lat: 10.48, lng: -66.9 },
  { name: 'La Guaira', lat: 10.6, lng: -66.93 },
  { name: 'Los Teques', lat: 10.34, lng: -67.04 },
  { name: 'Maracay', lat: 10.25, lng: -67.6 },
  { name: 'Valencia', lat: 10.16, lng: -68.0 },
  { name: 'San Felipe', lat: 10.34, lng: -68.74 },
  { name: 'Barquisimeto', lat: 10.07, lng: -69.32 },
  { name: 'Puerto Cabello', lat: 10.47, lng: -68.01 },
];

const ALERTAS_BBOX = { lngMin: -73, lngMax: -59, latMin: 0, latMax: 16 };

function condicionClima(code: number): string {
  if (code === 0) return 'Despejado';
  if (code <= 3) return 'Parcialmente nublado';
  if (code <= 48) return 'Niebla';
  if (code <= 57) return 'Llovizna';
  if (code <= 67) return 'Lluvia';
  if (code <= 82) return 'Chubascos';
  return 'Tormenta';
}

function relativeTime(ms: number): string {
  const h = Math.floor((Date.now() - ms) / 3_600_000);
  if (h < 1) return 'hace menos de 1 h';
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} día(s)`;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] as string));
}

/** La API /api/personas responde { data: Persona[] }, no { items }. */
function parsePersonasRows(body: unknown): PersonaRow[] {
  if (Array.isArray(body)) return body as PersonaRow[];
  if (body && typeof body === 'object') {
    const o = body as { data?: PersonaRow[]; items?: PersonaRow[] };
    return o.data ?? o.items ?? [];
  }
  return [];
}

function raiseLayersOnTop(map: maplibregl.Map, layerIds: string[]) {
  for (const id of layerIds) {
    if (map.getLayer(id)) {
      try { map.moveLayer(id); } catch { /* ignore */ }
    }
  }
}

/** Orden de apilado: SAR y puntos interactivos quedan encima del resto de overlays. */
function syncOverlayOrder(map: maplibregl.Map) {
  const personaLayers = PERSONA_CLUSTER_LAYERS.flatMap((c) => [`${c.id}-clusters`, `${c.id}-punto`]);
  const stack = [
    'heatmap-personas',
    'shakemap-fill', 'shakemap-line',
    'epicentros-circles', 'epicentros-line', 'epicentros',
    'replicas',
    'sismo1967', 'sismo1967-circle', 'sismo1967-punto',
    'clima', 'clima-label',
    'alertas',
    'lluvia',
    'danos-estructurales',
    'likely-dmg-fill', 'likely-dmg-line',
    'sar-terra-fill', 'sar-terra-line',
    ...personaLayers,
    'persona-search-marker',
  ];
  raiseLayersOnTop(map, stack);
}

type PersonaRow = {
  id?: string;
  nombre?: string;
  cedula?: string | null;
  status?: string;
  lugar?: string;
  observaciones?: string | null;
  tipo?: string;
  category?: string;
  lat?: number | null;
  lng?: number | null;
  fuente?: string;
};

const TIPO_LABELS: Record<string, string> = {
  desaparecido: 'Se busca',
  localizado: 'Localizado',
  redh: 'REDH',
  ayudavenezuela: 'Terremoto VE',
  hub: 'Venezuela Ayuda',
  demano: 'De Mano en Mano',
  insumos: 'Insumos',
  danos: 'Daño estructural',
};

function matchesPersonaSearch(p: PersonaRow, q: string): boolean {
  const ql = normalizeSearchText(q);
  const fields = [p.nombre, p.lugar, p.cedula, p.observaciones, p.status, p.category, p.fuente];
  return fields.some((f) => f && normalizeSearchText(String(f)).includes(ql));
}

const PERSONA_CLUSTER_LAYERS = [
  { id: 'personas-desaparecido', tipo: 'desaparecido', color: '#ef4444', title: 'Se busca' },
  { id: 'personas-localizado', tipo: 'localizado', color: '#059669', title: 'Localizados (Salud)' },
  { id: 'personas-redh', tipo: 'redh', color: '#ea580c', title: 'REDH AVAPRE' },
  { id: 'personas-ayudavenezuela', tipo: 'ayudavenezuela', color: '#16a34a', title: 'Terremoto Venezuela' },
  { id: 'personas-hub', tipo: 'hub', color: '#0891b2', title: 'Venezuela Ayuda' },
  { id: 'personas-demano', tipo: 'demano', color: '#0d9488', title: 'De Mano en Mano' },
  { id: 'personas-insumos', tipo: 'insumos', color: '#8b5cf6', title: 'Centros de Insumos' },
] as const;

function groupPersonasFeatures(items: PersonaRow[]): GeoJSON.Feature[] {
  const groups: Record<string, { lat: number; lng: number; personas: PersonaRow[] }> = {};
  for (const p of items) {
    if (p.lat == null || p.lng == null) continue;
    const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    if (!groups[key]) groups[key] = { lat: p.lat, lng: p.lng, personas: [] };
    groups[key].personas.push(p);
  }
  return Object.values(groups).map((g) => ({
    type: 'Feature' as const,
    properties: {
      lugar: g.personas[0]?.lugar || 'Sin ubicación',
      count: g.personas.length,
      personasJson: JSON.stringify(g.personas.slice(0, 25)),
    },
    geometry: { type: 'Point' as const, coordinates: [g.lng, g.lat] },
  }));
}

function personaPopupHtml(props: Record<string, unknown>): string {
  let personas: PersonaRow[] = [];
  try { personas = JSON.parse(String(props.personasJson || '[]')); } catch { /* ignore */ }
  const count = Number(props.count) || personas.length;
  const shown = personas.slice(0, 3);
  const rest = count - shown.length;
  const rows = shown.map((p) => {
    const estado = p.status || p.category || '';
    return `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #e5e7eb"><strong>${esc(p.nombre || 'Sin nombre')}</strong>${estado ? `<br/><span style="color:#6b7280">${esc(estado)}</span>` : ''}${p.lugar ? `<br/><span style="font-size:10px;color:#64748b">${esc(p.lugar)}</span>` : ''}</div>`;
  }).join('');
  const more = rest > 0 ? `<p style="margin:6px 0 0;color:#6b7280;font-size:10px">+${rest} más en este punto</p>` : '';
  return `<div style="font-size:12px;font-family:sans-serif;line-height:1.4"><strong>${esc(props.lugar || 'Ubicación')}</strong>${count > 1 ? ` <span style="color:#6b7280">(${count})</span>` : ''}${rows}${more}</div>`;
}

function removeClusterSource(map: maplibregl.Map, id: string) {
  for (const lid of [`${id}-clusters`, `${id}-punto`]) {
    if (map.getLayer(lid)) map.removeLayer(lid);
  }
  if (map.getSource(id)) map.removeSource(id);
}

function addClusterSource(map: maplibregl.Map, id: string, fc: GeoJSON.FeatureCollection, color: string) {
  map.addSource(id, { type: 'geojson', data: fc, cluster: true, clusterMaxZoom: 14, clusterRadius: 50 });
  map.addLayer({
    id: `${id}-clusters`, type: 'circle', source: id, filter: ['has', 'point_count'],
    paint: {
      'circle-color': color,
      'circle-radius': ['step', ['get', 'point_count'], 14, 5, 18, 20, 22, 50, 28],
      'circle-opacity': 0.9,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5,
    },
  });
  map.addLayer({
    id: `${id}-punto`, type: 'circle', source: id, filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': color,
      'circle-radius': 7,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
      'circle-opacity': 0.95,
    },
  });
  raiseLayersOnTop(map, [`${id}-clusters`, `${id}-punto`]);
}

type ClusterHandlerCleanup = () => void;

function bindClusterInteractions(map: maplibregl.Map, id: string): ClusterHandlerCleanup {
  const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true });

  const onClusterClick = (e: maplibregl.MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) return;
    const clusterId = feature.properties?.cluster_id;
    const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
    if (clusterId == null || !src?.getClusterExpansionZoom) return;
    const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
    src.getClusterExpansionZoom(clusterId).then((zoom) => {
      map.easeTo({ center: coords, zoom });
    }).catch(() => { /* ignore */ });
  };

  const onPointClick = (e: maplibregl.MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    popup.setLngLat(e.lngLat).setHTML(personaPopupHtml(f.properties || {})).addTo(map);
  };

  const onEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
  const onLeave = () => { map.getCanvas().style.cursor = ''; };

  map.on('click', `${id}-clusters`, onClusterClick);
  map.on('click', `${id}-punto`, onPointClick);
  map.on('mouseenter', `${id}-clusters`, onEnter);
  map.on('mouseenter', `${id}-punto`, onEnter);
  map.on('mouseleave', `${id}-clusters`, onLeave);
  map.on('mouseleave', `${id}-punto`, onLeave);

  return () => {
    map.off('click', `${id}-clusters`, onClusterClick);
    map.off('click', `${id}-punto`, onPointClick);
    map.off('mouseenter', `${id}-clusters`, onEnter);
    map.off('mouseenter', `${id}-punto`, onEnter);
    map.off('mouseleave', `${id}-clusters`, onLeave);
    map.off('mouseleave', `${id}-punto`, onLeave);
    popup.remove();
  };
}

function LayerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-ap-border/40 first:pt-0 first:border-t-0">
      <div className="text-[9.5px] font-extrabold text-ap-muted uppercase tracking-wide">{title}</div>
      {children}
    </div>
  );
}

// Polígono aproximando un círculo geográfico (Leaflet dibuja círculos en metros; MapLibre
// solo tiene "circle" en píxeles, así que para radios reales generamos el polígono a mano).
function geoCircle(lat: number, lng: number, radiusM: number, points = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const latR = (lat * Math.PI) / 180;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = (radiusM * Math.cos(angle)) / (111320 * Math.cos(latR));
    const dy = (radiusM * Math.sin(angle)) / 110540;
    coords.push([lng + dx, lat + dy]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

function LayerToggle({ checked, onChange, color, title, sub }: { checked: boolean; onChange: (v: boolean) => void; color: string; title: string; sub?: string }) {
  return (
    <label className="flex items-start gap-2.5 text-[12px] font-semibold text-ap-secondary cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded border-ap-border text-ap-primary focus:ring-ap-primary cursor-pointer w-4 h-4 shrink-0 mt-0.5" />
      <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5" style={{ background: color }} />
      <div className="flex flex-col leading-tight min-w-0">
        <span className="font-bold text-ap-primary truncate">{title}</span>
        {sub && <span className="text-[9.5px] text-ap-muted font-normal">{sub}</span>}
      </div>
    </label>
  );
}

export default function Mapa3DView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [personasVersion, setPersonasVersion] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchPopupRef = useRef<maplibregl.Popup | null>(null);

  const [showDanosIA, setShowDanosIA] = useState(true);
  const [showShakemap, setShowShakemap] = useState(false);
  const [showEpicentros, setShowEpicentros] = useState(false);
  const [showReplicas, setShowReplicas] = useState(false);
  const [show1967, setShow1967] = useState(false);
  const [showClima, setShowClima] = useState(false);
  const [showAlertas, setShowAlertas] = useState(false);
  const [showRain, setShowRain] = useState(false);
  const [showDanosEstructurales, setShowDanosEstructurales] = useState(false);
  const [showLikelyDmg, setShowLikelyDmg] = useState(true);
  const [showDesaparecidos, setShowDesaparecidos] = useState(false);
  const [showLocalizados, setShowLocalizados] = useState(false);
  const [showRedh, setShowRedh] = useState(false);
  const [showAyudavenezuela, setShowAyudavenezuela] = useState(false);
  const [showHub, setShowHub] = useState(false);
  const [showDemano, setShowDemano] = useState(false);
  const [showInsumos, setShowInsumos] = useState(false);
  const [showSAR, setShowSAR] = useState(true);

  // Modos de vista adicionales (íconos debajo del buscador, no son capas de datos).
  const [flatView, setFlatView] = useState(false);
  const [showTerrain, setShowTerrain] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showSky, setShowSky] = useState(false);

  const personasCacheRef = useRef<{ ts: number; items: PersonaRow[] } | null>(null);
  const clusterCleanupRef = useRef<Record<string, ClusterHandlerCleanup>>({});

  const loadPersonasCache = async (): Promise<PersonaRow[]> => {
    const now = Date.now();
    const cached = personasCacheRef.current;
    if (cached && now - cached.ts < 60_000) return cached.items;
    const res = await fetch('/api/personas');
    if (!res.ok) throw new Error('personas');
    const rows = parsePersonasRows(await res.json());
    personasCacheRef.current = { ts: now, items: rows };
    setPersonasVersion((v) => v + 1);
    return rows;
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    const items = personasCacheRef.current?.items ?? [];
    return items
      .filter((p) => p.lat != null && p.lng != null && matchesPersonaSearch(p, q))
      .slice(0, 25);
  }, [searchQuery, personasVersion]);

  const flyToPersona = (p: PersonaRow) => {
    const map = mapRef.current;
    if (!map || p.lat == null || p.lng == null) return;
    const coords: [number, number] = [p.lng, p.lat];
    const ID = 'persona-search-marker';
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: p, geometry: { type: 'Point', coordinates: coords } }],
    };
    const src = map.getSource(ID) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(fc);
    else {
      map.addSource(ID, { type: 'geojson', data: fc });
      map.addLayer({
        id: ID, type: 'circle', source: ID,
        paint: {
          'circle-color': '#fff',
          'circle-radius': 11,
          'circle-stroke-color': '#2563eb',
          'circle-stroke-width': 4,
          'circle-opacity': 1,
        },
      });
    }
    syncOverlayOrder(map);
    searchPopupRef.current?.remove();
    const tipo = TIPO_LABELS[p.tipo || ''] || p.tipo || 'Reporte';
    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat(coords)
      .setHTML(`<div style="font-size:12px;font-family:sans-serif;line-height:1.4"><strong>${esc(p.nombre || 'Sin nombre')}</strong><br/><span style="color:#6b7280">${esc(tipo)}${p.status ? ` · ${esc(p.status)}` : ''}</span>${p.lugar ? `<br/><span style="font-size:10px;color:#64748b">${esc(p.lugar)}</span>` : ''}</div>`)
      .addTo(map);
    searchPopupRef.current = popup;
    map.easeTo({ center: coords, zoom: 17, duration: 900 });
  };

  // Inicialización del mapa (una sola vez).
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: CENTER,
      zoom: 16,
      pitch: 60,
      bearing: -20,
      canvasContextAttributes: { antialias: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-left');
    map.on('error', (e) => setError(e?.error?.message || 'No se pudo cargar el mapa 3D.'));

    map.on('load', () => {
      map.addSource('danos-catia-la-mar', { type: 'geojson', data: DATA_URL });
      map.addLayer({
        id: 'danos-3d',
        type: 'fill-extrusion',
        source: 'danos-catia-la-mar',
        paint: {
          'fill-extrusion-height': ['interpolate', ['linear'], ['coalesce', ['get', 'damage_pct_0m'], 0], 0, 5, 1, 45],
          'fill-extrusion-base': 0,
          'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'damage_pct_0m'], 0], 0, '#facc15', 0.3, '#f97316', 0.6, '#b91c1c'],
          'fill-extrusion-opacity': 0.88,
        },
      });
      const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true });
      map.on('click', 'danos-3d', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const pct = Math.round(((f.properties?.damage_pct_0m as number) ?? 0) * 100);
        popup.setLngLat(e.lngLat).setHTML(
          `<div style="font-size:12px;font-family:sans-serif;line-height:1.5"><strong>Edificio ${f.properties?.id ?? ''} · ${pct}% de daño estimado</strong><br/><span style="color:#9ca3af;font-size:10px">Fuente: Microsoft AI for Good Lab / OCHA HDX. Requiere verificación de campo.</span></div>`,
        ).addTo(map);
      });
      map.on('mouseenter', 'danos-3d', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'danos-3d', () => { map.getCanvas().style.cursor = ''; });

      setMapReady(true);
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Visibilidad de la capa base 3D (Edificios Dañados IA)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer('danos-3d')) return;
    map.setLayoutProperty('danos-3d', 'visibility', showDanosIA ? 'visible' : 'none');
  }, [mapReady, showDanosIA]);

  // Precarga personas al abrir el buscador
  useEffect(() => {
    if (!searchOpen || !mapReady) return;
    loadPersonasCache().catch(() => { /* silencioso */ });
    const t = setTimeout(() => searchInputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [searchOpen, mapReady]);

  // Helper genérico: bindea un popup HTML a una capa por click + cursor pointer.
  const bindPopup = (map: maplibregl.Map, layerId: string, html: (props: any) => string) => {
    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true });
    map.on('click', layerId, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      popup.setLngLat(e.lngLat).setHTML(html(f.properties || {})).addTo(map);
    });
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
  };

  // ShakeMap 2026 (bandas de intensidad sentida, USGS)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const ID = 'shakemap';
    if (showShakemap) {
      if (!map.getSource(ID)) {
        map.addSource(ID, { type: 'geojson', data: '/shakemap-intensity.json' });
        map.addLayer({ id: `${ID}-fill`, type: 'fill', source: ID, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.42 } });
        map.addLayer({ id: `${ID}-line`, type: 'line', source: ID, paint: { 'line-color': ['get', 'color'], 'line-width': 0.8, 'line-opacity': 0.5 } });
        bindPopup(map, `${ID}-fill`, (p) => `<div style="font-size:12px;font-family:sans-serif"><strong style="color:${p.color}">Intensidad: ${p.label}</strong><br/>Escala de Mercalli — MMI ${p.mmi}<br/><span style="color:#9ca3af;font-size:10px">Sismo principal M7.5 · ShakeMap USGS</span></div>`);
        syncOverlayOrder(map);
      }
    } else if (map.getSource(ID)) {
      map.removeLayer(`${ID}-fill`); map.removeLayer(`${ID}-line`); map.removeSource(ID);
    }
  }, [mapReady, showShakemap]);

  // Epicentros del doblete 2026 (puntos + línea de ruptura + radios de impacto)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const ID = 'epicentros';
    if (showEpicentros) {
      if (!map.getSource(ID)) {
        const points: GeoJSON.Feature[] = EPICENTROS.map((e) => ({
          type: 'Feature', properties: e, geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
        }));
        const line: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: EPICENTROS.map((e) => [e.lng, e.lat]) } };
        const circles = EPICENTROS.map((e) => geoCircle(e.lat, e.lng, e.radiusM));

        map.addSource(`${ID}-circles`, { type: 'geojson', data: { type: 'FeatureCollection', features: circles } });
        map.addLayer({ id: `${ID}-circles`, type: 'line', source: `${ID}-circles`, paint: { 'line-color': '#ef4444', 'line-width': 1.5, 'line-dasharray': [3, 3], 'line-opacity': 0.5 } });

        map.addSource(`${ID}-line`, { type: 'geojson', data: line });
        map.addLayer({ id: `${ID}-line`, type: 'line', source: `${ID}-line`, paint: { 'line-color': '#ef4444', 'line-width': 2.5, 'line-dasharray': [2, 3], 'line-opacity': 0.6 } });

        map.addSource(ID, { type: 'geojson', data: { type: 'FeatureCollection', features: points } });
        map.addLayer({ id: ID, type: 'circle', source: ID, paint: { 'circle-radius': 8, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
        bindPopup(map, ID, (p) => `<div style="font-size:12px;font-family:sans-serif;line-height:1.4"><strong style="color:${p.color}">${p.name}</strong><br/><strong>Magnitud:</strong> ${p.magnitude} (${p.intensity})<br/><strong>Profundidad:</strong> ${p.depth}<br/><strong>Hora:</strong> ${p.time}</div>`);
        syncOverlayOrder(map);
      }
    } else if (map.getSource(ID)) {
      map.removeLayer(ID); map.removeSource(ID);
      map.removeLayer(`${ID}-line`); map.removeSource(`${ID}-line`);
      map.removeLayer(`${ID}-circles`); map.removeSource(`${ID}-circles`);
    }
  }, [mapReady, showEpicentros]);

  // Réplicas en vivo (USGS, vía /api/sismos)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const ID = 'replicas';
    let alive = true;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const remove = () => { if (map.getSource(ID)) { map.removeLayer(ID); map.removeSource(ID); } };

    if (showReplicas) {
      const load = async () => {
        try {
          const res = await fetch('/api/sismos');
          if (!res.ok || !alive) return;
          const sismos = await res.json();
          const features: GeoJSON.Feature[] = (Array.isArray(sismos) ? sismos : []).map((s: any) => ({
            type: 'Feature', properties: s, geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
          }));
          const src = map.getSource(ID) as maplibregl.GeoJSONSource | undefined;
          if (src) { src.setData({ type: 'FeatureCollection', features }); return; }
          map.addSource(ID, { type: 'geojson', data: { type: 'FeatureCollection', features } });
          map.addLayer({
            id: ID, type: 'circle', source: ID,
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 3, 4, 7, 22],
              'circle-color': ['case', ['>=', ['get', 'mag'], 4.5], '#dc2626', '#f59e0b'],
              'circle-stroke-color': '#fff', 'circle-stroke-width': 1,
            },
          });
          bindPopup(map, ID, (p) => `<div style="font-size:12px;font-family:sans-serif"><strong>Réplica M${p.mag}</strong><br/>${p.place || ''}<br/><span style="color:#6b7280">Prof. ${p.depth} km · ${relativeTime(p.time)}</span><br/><span style="color:#9ca3af;font-size:10px">Fuente: USGS</span></div>`);
          syncOverlayOrder(map);
        } catch { /* silencioso */ }
      };
      load();
      intervalId = setInterval(load, 300_000);
    } else {
      remove();
    }
    return () => { alive = false; if (intervalId) clearInterval(intervalId); };
  }, [mapReady, showReplicas]);

  // Terremoto de Caracas 1967 (histórico)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const ID = 'sismo1967';
    if (show1967) {
      if (!map.getSource(ID)) {
        map.addSource(ID, { type: 'geojson', data: '/shakemap-1967-intensity.json' });
        map.addLayer({ id: ID, type: 'line', source: ID, paint: { 'line-color': ['coalesce', ['get', 'color'], '#7c3aed'], 'line-width': ['coalesce', ['get', 'weight'], 2], 'line-opacity': 0.85 } });
        bindPopup(map, ID, (p) => `<div style="font-size:12px;font-family:sans-serif"><strong style="color:#7c3aed">Terremoto de Caracas 1967</strong><br/>Intensidad MMI ${p.value}<br/><span style="color:#9ca3af;font-size:10px">ShakeMap USGS · evento iscgem833882</span></div>`);

        const circle = geoCircle(EPI_1967.lat, EPI_1967.lng, EPI_1967.radiusM);
        map.addSource(`${ID}-circle`, { type: 'geojson', data: circle });
        map.addLayer({ id: `${ID}-circle`, type: 'line', source: `${ID}-circle`, paint: { 'line-color': '#7c3aed', 'line-width': 1.5, 'line-dasharray': [3, 3], 'line-opacity': 0.5 } });

        const point: GeoJSON.Feature = { type: 'Feature', properties: EPI_1967, geometry: { type: 'Point', coordinates: [EPI_1967.lng, EPI_1967.lat] } };
        map.addSource(`${ID}-punto`, { type: 'geojson', data: point });
        map.addLayer({ id: `${ID}-punto`, type: 'circle', source: `${ID}-punto`, paint: { 'circle-radius': 7, 'circle-color': '#7c3aed', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
        bindPopup(map, `${ID}-punto`, (p) => `<div style="font-size:12px;font-family:sans-serif"><strong style="color:#7c3aed">Terremoto de Caracas · 1967</strong><br/><strong>Magnitud:</strong> ${p.mag}<br/><strong>Profundidad:</strong> ${p.depth}<br/><strong>Epicentro:</strong> ${p.place}</div>`);
        syncOverlayOrder(map);
      }
    } else if (map.getSource(ID)) {
      map.removeLayer(ID); map.removeSource(ID);
      map.removeLayer(`${ID}-circle`); map.removeSource(`${ID}-circle`);
      map.removeLayer(`${ID}-punto`); map.removeSource(`${ID}-punto`);
    }
  }, [mapReady, show1967]);

  // Clima por ciudad (Open-Meteo)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const ID = 'clima';
    let alive = true;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const remove = () => { if (map.getLayer(`${ID}-label`)) map.removeLayer(`${ID}-label`); if (map.getSource(ID)) { map.removeLayer(ID); map.removeSource(ID); } };

    if (showClima) {
      const load = async () => {
        const lats = CIUDADES_CLIMA.map((c) => c.lat).join(',');
        const lngs = CIUDADES_CLIMA.map((c) => c.lng).join(',');
        try {
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=auto`);
          if (!res.ok || !alive) return;
          const data = await res.json();
          const arr = Array.isArray(data) ? data : [data];
          const features: GeoJSON.Feature[] = arr.map((d: any, i: number) => {
            const c = CIUDADES_CLIMA[i];
            const cur = d.current || {};
            const lluvia = (cur.precipitation ?? 0) > 0;
            return {
              type: 'Feature',
              properties: { name: c.name, temp: Math.round(cur.temperature_2m ?? 0), lluvia, precip: cur.precipitation ?? 0, viento: Math.round(cur.wind_speed_10m ?? 0), condicion: condicionClima(cur.weather_code ?? 0) },
              geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
            };
          });
          const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
          const src = map.getSource(ID) as maplibregl.GeoJSONSource | undefined;
          if (src) { src.setData(fc); return; }
          map.addSource(ID, { type: 'geojson', data: fc });
          map.addLayer({ id: ID, type: 'circle', source: ID, paint: { 'circle-radius': 12, 'circle-color': ['case', ['get', 'lluvia'], '#3b82f6', '#0f766e'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
          map.addLayer({ id: `${ID}-label`, type: 'symbol', source: ID, layout: { 'text-field': ['concat', ['to-string', ['get', 'temp']], '°'], 'text-size': 11, 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': '#fff' } });
          bindPopup(map, ID, (p) => `<div style="font-size:12px;font-family:sans-serif"><strong>${p.name}</strong><br/>${p.temp} °C · ${p.condicion}<br/>Lluvia: ${p.precip} mm · Viento: ${p.viento} km/h<br/><span style="color:#9ca3af;font-size:10px">Fuente: Open-Meteo</span></div>`);
          syncOverlayOrder(map);
        } catch { /* silencioso */ }
      };
      load();
      intervalId = setInterval(load, 600_000);
    } else {
      remove();
    }
    return () => { alive = false; if (intervalId) clearInterval(intervalId); };
  }, [mapReady, showClima]);

  // Alertas de desastres (GDACS)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const ID = 'alertas';
    let alive = true;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const remove = () => { if (map.getSource(ID)) { map.removeLayer(ID); map.removeSource(ID); } };

    if (showAlertas) {
      const load = async () => {
        try {
          const res = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP');
          if (!res.ok || !alive) return;
          const data = await res.json();
          const feats = (data.features || []).filter((f: any) => {
            const [lng, lat] = f.geometry?.coordinates || [0, 0];
            return lng > ALERTAS_BBOX.lngMin && lng < ALERTAS_BBOX.lngMax && lat > ALERTAS_BBOX.latMin && lat < ALERTAS_BBOX.latMax;
          }).map((f: any) => ({ ...f, properties: { ...f.properties, alertColor: { Green: '#16a34a', Orange: '#ea580c', Red: '#dc2626' }[f.properties?.alertlevel as string] || '#6b7280' } }));
          const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: feats };
          const src = map.getSource(ID) as maplibregl.GeoJSONSource | undefined;
          if (src) { src.setData(fc); return; }
          map.addSource(ID, { type: 'geojson', data: fc });
          map.addLayer({ id: ID, type: 'circle', source: ID, paint: { 'circle-radius': 9, 'circle-color': ['get', 'alertColor'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
          bindPopup(map, ID, (p) => `<div style="font-size:12px;font-family:sans-serif"><strong style="color:${p.alertColor}">Alerta ${p.alertlevel || ''} · ${p.eventtype || ''}</strong><br/>${p.name || ''}<br/>${p.country || ''}<br/><span style="color:#6b7280">Desde: ${p.fromdate || ''}</span></div>`);
          syncOverlayOrder(map);
        } catch { /* silencioso */ }
      };
      load();
      intervalId = setInterval(load, 600_000);
    } else {
      remove();
    }
    return () => { alive = false; if (intervalId) clearInterval(intervalId); };
  }, [mapReady, showAlertas]);

  // Lluvia (radar OpenWeatherMap, raster)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !OWM_KEY) return;
    const ID = 'lluvia';
    if (showRain) {
      if (!map.getSource(ID)) {
        map.addSource(ID, { type: 'raster', tiles: [`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`], tileSize: 256 });
        map.addLayer({ id: ID, type: 'raster', source: ID, paint: { 'raster-opacity': 0.6 } });
        syncOverlayOrder(map);
      }
    } else if (map.getSource(ID)) {
      map.removeLayer(ID); map.removeSource(ID);
    }
  }, [mapReady, showRain]);

  // Daños Estructurales (Mapa de Daños VE, vía /api/personas)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const ID = 'danos-estructurales';
    let alive = true;
    if (showDanosEstructurales) {
      (async () => {
        try {
          const res = await fetch('/api/personas');
          if (!res.ok || !alive) return;
          const data = await res.json();
          const items = parsePersonasRows(data).filter((p) => p.tipo === 'danos' && p.lat != null && p.lng != null);
          const features: GeoJSON.Feature[] = items.map((p) => ({ type: 'Feature', properties: p, geometry: { type: 'Point', coordinates: [p.lng!, p.lat!] } }));
          const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
          if (!alive) return;
          const src = map.getSource(ID) as maplibregl.GeoJSONSource | undefined;
          if (src) { src.setData(fc); return; }
          map.addSource(ID, { type: 'geojson', data: fc });
          map.addLayer({ id: ID, type: 'circle', source: ID, paint: { 'circle-radius': 8, 'circle-color': '#db2777', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2, 'circle-opacity': 0.95 } });
          raiseLayersOnTop(map, [ID]);
          bindPopup(map, ID, (p) => `<div style="font-size:12px;font-family:sans-serif"><strong style="color:#db2777">${p.lugar || p.nombre || 'Edificio dañado'}</strong><br/>${p.category || p.status || ''}<br/><span style="color:#9ca3af;font-size:10px">Fuente: Mapa de Daños VE</span></div>`);
          syncOverlayOrder(map);
        } catch { /* silencioso */ }
      })();
    } else if (map.getSource(ID)) {
      map.removeLayer(ID); map.removeSource(ID);
    }
    return () => { alive = false; };
  }, [mapReady, showDanosEstructurales]);

  // Capas de Personas (/api/personas) — un fetch compartido, clustering MapLibre nativo
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    let alive = true;

    const toggles: Record<string, boolean> = {
      'personas-desaparecido': showDesaparecidos,
      'personas-localizado': showLocalizados,
      'personas-redh': showRedh,
      'personas-ayudavenezuela': showAyudavenezuela,
      'personas-hub': showHub,
      'personas-demano': showDemano,
      'personas-insumos': showInsumos,
    };

    const sync = async () => {
      const active = PERSONA_CLUSTER_LAYERS.filter((c) => toggles[c.id]);
      for (const cfg of PERSONA_CLUSTER_LAYERS) {
        if (!toggles[cfg.id]) {
          clusterCleanupRef.current[cfg.id]?.();
          delete clusterCleanupRef.current[cfg.id];
          removeClusterSource(map, cfg.id);
        }
      }
      if (active.length === 0 || !alive) return;

      try {
        const rows = await loadPersonasCache();
        if (!alive) return;
        const items = { ts: personasCacheRef.current?.ts ?? Date.now(), items: rows };

        for (const cfg of active) {
          if (!alive) return;
          const filtered = items.items.filter((p) => p.tipo === cfg.tipo && p.lat != null && p.lng != null);
          const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: groupPersonasFeatures(filtered) };
          const src = map.getSource(cfg.id) as maplibregl.GeoJSONSource | undefined;
          if (src) {
            src.setData(fc);
            continue;
          }
          addClusterSource(map, cfg.id, fc, cfg.color);
          clusterCleanupRef.current[cfg.id]?.();
          clusterCleanupRef.current[cfg.id] = bindClusterInteractions(map, cfg.id);
        }
        syncOverlayOrder(map);
      } catch { /* silencioso */ }
    };

    sync();
    return () => { alive = false; };
  }, [mapReady, showDesaparecidos, showLocalizados, showRedh, showAyudavenezuela, showHub, showDemano, showInsumos]);

  // Sentinel-1 Likely Damaged Areas (Scher / Van Den Hoek) — bbox visible, solo damage=1.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const ID = 'likely-dmg';
    const FILL = `${ID}-fill`;
    const LINE = `${ID}-line`;
    let alive = true;

    const remove = () => {
      if (map.getLayer(LINE)) map.removeLayer(LINE);
      if (map.getLayer(FILL)) map.removeLayer(FILL);
      if (map.getSource(ID)) map.removeSource(ID);
    };

    const update = async () => {
      if (!showLikelyDmg || !alive) return;
      // A escala nacional el servicio tiene millones de polígonos: no consultar muy alejado.
      if (map.getZoom() < LIKELY_DMG_MIN_ZOOM) {
        const src = map.getSource(ID) as maplibregl.GeoJSONSource | undefined;
        if (src) src.setData({ type: 'FeatureCollection', features: [] });
        return;
      }
      const b = map.getBounds();
      const geom = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
      const base =
        `${LIKELY_DMG_LAYER}/query?where=damage%3D1&geometry=${geom}` +
        `&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects` +
        `&outFields=damage_probability,label,class&returnGeometry=true&outSR=4326&resultRecordCount=2000&f=geojson`;
      try {
        // Paginado por resultOffset: hasta 3 páginas (6000 polígonos) para cubrir el
        // viewport sin traer el país entero. maxRecordCount del servicio = 2000.
        const features: GeoJSON.Feature[] = [];
        for (let page = 0; page < 3; page++) {
          const res = await fetch(`${base}&resultOffset=${page * 2000}`);
          if (!res.ok || !alive) break;
          const fc = await res.json();
          if (!fc || fc.type !== 'FeatureCollection') break;
          const batch: GeoJSON.Feature[] = fc.features || [];
          features.push(...batch);
          // Con f=geojson el flag exceededTransferLimit no es fiable; paginamos por
          // tamaño de página: una página llena (2000) implica que puede haber más.
          if (batch.length < 2000) break;
        }
        if (!alive) return;
        const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
        const src = map.getSource(ID) as maplibregl.GeoJSONSource | undefined;
        if (src) { src.setData(fc); syncOverlayOrder(map); return; }
        map.addSource(ID, { type: 'geojson', data: fc });
        // Extrusión (no fill plano): en la vista inclinada por defecto un fill a ras
        // de suelo queda oculto tras los edificios extruidos de "Edificios Dañados (IA)".
        // Altura = codificación visual de la probabilidad de daño (no altura real).
        map.addLayer({
          id: FILL, type: 'fill-extrusion', source: ID,
          paint: {
            'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'damage_probability'], 0.5], 0.5, '#facc15', 0.75, '#f97316', 0.9, '#b91c1c'],
            'fill-extrusion-height': ['interpolate', ['linear'], ['coalesce', ['get', 'damage_probability'], 0.5], 0.5, 8, 1, 32],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.85,
          },
        });
        syncOverlayOrder(map);
        bindPopup(map, FILL, (p) => {
          const pct = Math.round((Number(p.damage_probability) || 0) * 100);
          return `<div style="font-size:12px;font-family:sans-serif;line-height:1.4"><strong style="color:#b91c1c">Edificio con daño probable · ${pct}%</strong><br/><span style="color:#6b7280">${esc(p.label || 'likely_damaged')}</span><br/><span style="color:#9ca3af;font-size:10px">Sentinel-1 (coherence change) · Scher (CUNY) &amp; Van Den Hoek (OSU). Requiere verificación de campo.</span></div>`;
        });
      } catch { /* silencioso */ }
    };

    const onMoveEnd = () => { update(); };

    if (showLikelyDmg) {
      map.on('moveend', onMoveEnd);
      update();
    } else {
      remove();
    }

    return () => {
      alive = false;
      map.off('moveend', onMoveEnd);
    };
  }, [mapReady, showLikelyDmg]);

  // Daño Satelital SAR (TerraVE) — bbox visible, recalcula en moveend/zoomend
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const ID = 'sar-terra';
    const FILL = `${ID}-fill`;
    const LINE = `${ID}-line`;
    let alive = true;

    const remove = () => {
      if (map.getLayer(LINE)) map.removeLayer(LINE);
      if (map.getLayer(FILL)) map.removeLayer(FILL);
      if (map.getSource(ID)) map.removeSource(ID);
    };

    const updateSar = async () => {
      if (!showSAR || !alive) return;
      const b = map.getBounds();
      const url = `https://terra-ve.vercel.app/api/satelital?lat_min=${b.getSouth()}&lat_max=${b.getNorth()}&lng_min=${b.getWest()}&lng_max=${b.getEast()}&limit=800`;
      try {
        const res = await fetch(url);
        if (!res.ok || !alive) return;
        const body = await res.json();
        const rows = Array.isArray(body?.data) ? body.data : [];
        const features: GeoJSON.Feature[] = rows.map((item: { centro_lat: number; centro_lng: number; area_m2: number; fecha_imagen?: string }) => {
          const radiusM = Math.max(Math.sqrt((item.area_m2 || 0) / Math.PI), 5);
          const poly = geoCircle(item.centro_lat, item.centro_lng, radiusM, 32);
          return { ...poly, properties: { area_m2: item.area_m2, fecha_imagen: item.fecha_imagen || '' } };
        });
        const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
        const src = map.getSource(ID) as maplibregl.GeoJSONSource | undefined;
        if (src) { src.setData(fc); syncOverlayOrder(map); return; }
        map.addSource(ID, { type: 'geojson', data: fc });
        map.addLayer({ id: FILL, type: 'fill', source: ID, paint: { 'fill-color': '#06b6d4', 'fill-opacity': 0.42 } });
        map.addLayer({ id: LINE, type: 'line', source: ID, paint: { 'line-color': '#0891b2', 'line-width': 2.5, 'line-opacity': 0.95 } });
        syncOverlayOrder(map);
        bindPopup(map, FILL, (p) => `<div style="font-size:12px;font-family:sans-serif;line-height:1.4"><strong style="color:#06b6d4">Daño Satelital (TerraVE)</strong><br/><strong>Área:</strong> ${Number(p.area_m2 || 0).toLocaleString('es-VE', { maximumFractionDigits: 1 })} m²<br/><strong>Fecha imagen:</strong> ${esc(p.fecha_imagen)}<br/><span style="color:#9ca3af;font-size:10px">Fuente: TerraVE / Sentinel-1</span></div>`);
      } catch { /* silencioso */ }
      finally {
        if (alive) syncOverlayOrder(map);
      }
    };

    const onMoveEnd = () => { updateSar(); };

    if (showSAR) {
      map.on('moveend', onMoveEnd);
      updateSar();
    } else {
      remove();
    }

    return () => {
      alive = false;
      map.off('moveend', onMoveEnd);
    };
  }, [mapReady, showSAR]);

  // Terreno real (relieve 3D) — DEM público (AWS/Mapzen "terrarium", sin API key).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const ID = 'terrain-dem';
    if (showTerrain) {
      if (!map.getSource(ID)) {
        map.addSource(ID, {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256,
          encoding: 'terrarium',
          maxzoom: 15,
        });
      }
      map.setTerrain({ source: ID, exaggeration: 1.5 });
    } else {
      map.setTerrain(null);
    }
  }, [mapReady, showTerrain]);

  // Heatmap de densidad de reportes (todas las personas con coordenadas, /api/personas).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const ID = 'heatmap-personas';
    let alive = true;

    if (showHeatmap) {
      (async () => {
        const rows = await loadPersonasCache();
        if (!alive) return;
        const features: GeoJSON.Feature[] = rows
          .filter((p) => p.lat != null && p.lng != null)
          .map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lng as number, p.lat as number] } }));
        const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
        const src = map.getSource(ID) as maplibregl.GeoJSONSource | undefined;
        if (src) { src.setData(fc); return; }
        map.addSource(ID, { type: 'geojson', data: fc });
        map.addLayer({
          id: ID, type: 'heatmap', source: ID,
          paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': 1.2,
            'heatmap-radius': 28,
            'heatmap-opacity': 0.65,
            'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.2, '#3b82f6', 0.4, '#22c55e', 0.6, '#facc15', 0.8, '#f97316', 1, '#dc2626'],
          },
        });
        syncOverlayOrder(map);
      })();
    } else if (map.getSource(ID)) {
      map.removeLayer(ID); map.removeSource(ID);
    }
    return () => { alive = false; };
  }, [mapReady, showHeatmap]);

  // Cielo + iluminación (look más realista para la vista inclinada).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (showSky) {
      map.setSky({ 'sky-color': '#88C6FC', 'horizon-color': '#ffffff', 'fog-color': '#ffffff', 'fog-ground-blend': 0.5 });
      map.setLight({ anchor: 'viewport', color: '#fff', intensity: 0.55, position: [1.5, 90, 45] });
    } else {
      map.setSky(undefined as unknown as maplibregl.SkySpecification);
      map.setLight({ anchor: 'viewport', color: '#fff', intensity: 0.4 });
    }
  }, [mapReady, showSky]);

  // Toggle vista plana (pitch 0) / inclinada (pitch 60, la original de la página).
  const toggleFlatView = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !flatView;
    setFlatView(next);
    map.easeTo({ pitch: next ? 0 : 60, bearing: next ? 0 : -20, duration: 800 });
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute top-3 left-3 z-10 flex items-start gap-2 pointer-events-auto">
        <div className="flex flex-col gap-2">
          <Link
            href="/busquedas"
            className="w-10 h-10 flex items-center justify-center bg-white/95 border border-ap-border rounded-full shadow-agentos-md text-ap-primary hover:bg-ap-surface-hover transition-colors"
            aria-label="Volver al buscador"
          >
            <ArrowLeft size={18} />
          </Link>
          <button
            type="button"
            onClick={() => {
              setSearchOpen((o) => {
                const next = !o;
                if (!next) setSearchQuery('');
                return next;
              });
            }}
            className={`w-10 h-10 flex items-center justify-center border rounded-full shadow-agentos-md transition-colors ${searchOpen ? 'bg-ap-primary text-white border-ap-primary' : 'bg-white/95 border-ap-border text-ap-primary hover:bg-ap-surface-hover'}`}
            aria-label="Buscar persona o reporte"
            title="Buscar persona o reporte"
          >
            {searchOpen ? <X size={18} /> : <Search size={18} />}
          </button>

          <button
            type="button"
            onClick={toggleFlatView}
            className={`w-10 h-10 flex items-center justify-center border rounded-full shadow-agentos-md transition-colors ${!flatView ? 'bg-ap-primary text-white border-ap-primary' : 'bg-white/95 border-ap-border text-ap-primary hover:bg-ap-surface-hover'}`}
            aria-label="Alternar vista plana / inclinada"
            title="Vista plana / inclinada"
          >
            <Box size={18} />
          </button>
          <button
            type="button"
            onClick={() => setShowTerrain((v) => !v)}
            className={`w-10 h-10 flex items-center justify-center border rounded-full shadow-agentos-md transition-colors ${showTerrain ? 'bg-ap-primary text-white border-ap-primary' : 'bg-white/95 border-ap-border text-ap-primary hover:bg-ap-surface-hover'}`}
            aria-label="Alternar relieve del terreno"
            title="Terreno (relieve real)"
          >
            <Mountain size={18} />
          </button>
          <button
            type="button"
            onClick={() => setShowHeatmap((v) => !v)}
            className={`w-10 h-10 flex items-center justify-center border rounded-full shadow-agentos-md transition-colors ${showHeatmap ? 'bg-ap-primary text-white border-ap-primary' : 'bg-white/95 border-ap-border text-ap-primary hover:bg-ap-surface-hover'}`}
            aria-label="Alternar mapa de calor de reportes"
            title="Mapa de calor (densidad de reportes)"
          >
            <Flame size={18} />
          </button>
          <button
            type="button"
            onClick={() => setShowSky((v) => !v)}
            className={`w-10 h-10 flex items-center justify-center border rounded-full shadow-agentos-md transition-colors ${showSky ? 'bg-ap-primary text-white border-ap-primary' : 'bg-white/95 border-ap-border text-ap-primary hover:bg-ap-surface-hover'}`}
            aria-label="Alternar cielo e iluminación"
            title="Cielo e iluminación"
          >
            <Sun size={18} />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="absolute top-[4.5rem] left-3 z-20 w-[min(20rem,calc(100vw-1.5rem))] bg-white/95 backdrop-blur-md border border-ap-border rounded-xl shadow-agentos-md pointer-events-auto overflow-hidden">
          <div className="px-3 pt-3 pb-2 border-b border-ap-border/50">
            <p className="text-[10px] font-extrabold text-ap-muted uppercase tracking-wide mb-2">Buscar personas</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 text-ap-muted" size={15} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nombre, cédula, hospital, lugar..."
                className="w-full pl-8 pr-3 py-2 text-[13px] bg-ap-bg border border-ap-border rounded-lg focus:outline-none focus:border-ap-primary text-ap-primary placeholder:text-ap-muted"
              />
            </div>
          </div>
          <div className="max-h-[min(16rem,40dvh)] overflow-y-auto">
            {!searchQuery.trim() ? (
              <p className="px-3 py-4 text-[12px] text-ap-muted">Escribí para buscar en todos los reportes con ubicación.</p>
            ) : searchResults.length === 0 ? (
              <p className="px-3 py-4 text-[12px] text-ap-muted">Sin resultados para «{searchQuery}».</p>
            ) : (
              <ul className="divide-y divide-ap-border/40">
                {searchResults.map((p, i) => (
                  <li key={p.id || `${p.nombre}-${i}`}>
                    <button
                      type="button"
                      onClick={() => flyToPersona(p)}
                      className="w-full text-left px-3 py-2.5 hover:bg-ap-surface-hover transition-colors"
                    >
                      <p className="text-[13px] font-bold text-ap-primary truncate">{p.nombre || 'Sin nombre'}</p>
                      <p className="text-[11px] text-ap-muted truncate">
                        {TIPO_LABELS[p.tipo || ''] || p.tipo}
                        {p.status ? ` · ${p.status}` : ''}
                      </p>
                      {p.lugar && <p className="text-[10.5px] text-ap-muted truncate mt-0.5">{p.lugar}</p>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Panel de capas (misma clasificación que /busquedas), colapsado por defecto como
          pestaña angosta en el borde derecho (mismo patrón que la Leyenda de PersonasMap). */}
      {!layersOpen && (
        <button
          type="button"
          onClick={() => setLayersOpen(true)}
          aria-label="Mostrar capas del mapa"
          title="Capas del mapa"
          className="absolute top-3 right-0 z-10 bg-white/95 backdrop-blur-md border border-ap-border border-r-0 rounded-l-xl shadow-agentos-md pointer-events-auto flex flex-col items-center gap-1.5 px-1.5 py-3 hover:bg-ap-surface-hover transition-colors"
        >
          <ChevronLeft size={14} className="text-ap-primary" />
          <span className="text-[9px] font-extrabold text-ap-primary uppercase tracking-wide [writing-mode:vertical-rl]">Capas</span>
        </button>
      )}
      {layersOpen && (
        <div className="absolute top-3 right-0 z-10 bg-white/95 backdrop-blur-md border border-ap-border border-r-0 rounded-l-xl shadow-agentos-md flex flex-col w-[min(15rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-80px)] pointer-events-auto overflow-hidden">
          <button
            type="button"
            onClick={() => setLayersOpen(false)}
            className="shrink-0 flex items-center justify-between w-full text-[10.5px] font-extrabold text-ap-primary uppercase tracking-wide cursor-pointer select-none px-3 pt-2.5 pb-2 border-b border-ap-border/50"
          >
            <span>Capas del mapa</span>
            <ChevronRight size={14} className="text-ap-muted" />
          </button>
          <div className="overflow-y-auto overscroll-contain min-h-0 px-3 pb-3 pt-2 flex flex-col gap-2.5">
            <LayerSection title="Daños">
              <LayerToggle checked={showLikelyDmg} onChange={setShowLikelyDmg} color="#b91c1c" title="Daño probable (Sentinel-1)" sub="Scher / Van Den Hoek · coherence change. Solo edificios con daño; requiere zoom cercano." />
              <LayerToggle checked={showSAR} onChange={setShowSAR} color="#06b6d4" title="Daño Satelital (SAR)" sub="TerraVE · Sentinel-1 / GEE" />
              <LayerToggle checked={showDanosIA} onChange={setShowDanosIA} color="#b91c1c" title="Edificios Dañados (IA)" sub="Catia La Mar · Microsoft AI for Good Lab / OCHA HDX. Altura = % de daño estimado, no altura real." />
              <LayerToggle checked={showDanosEstructurales} onChange={setShowDanosEstructurales} color="#db2777" title="Daños Estructurales" sub="Mapa de Daños VE" />
            </LayerSection>

            <LayerSection title="Personas">
              <LayerToggle checked={showDesaparecidos} onChange={setShowDesaparecidos} color="#ef4444" title="Se busca" sub="SOS Venezuela" />
              <LayerToggle checked={showLocalizados} onChange={setShowLocalizados} color="#059669" title="Localizados (Salud)" sub="LocVE / CIVIS" />
              <LayerToggle checked={showRedh} onChange={setShowRedh} color="#ea580c" title="REDH AVAPRE" sub="Hospitalizados y desaparecidos" />
              <LayerToggle checked={showAyudavenezuela} onChange={setShowAyudavenezuela} color="#16a34a" title="Terremoto Venezuela" sub="Ingresos en hospitales" />
            </LayerSection>

            <LayerSection title="Ayuda y necesidades">
              <LayerToggle checked={showHub} onChange={setShowHub} color="#0891b2" title="Venezuela Ayuda" sub="Hub: personas y solicitudes" />
              <LayerToggle checked={showDemano} onChange={setShowDemano} color="#0d9488" title="De Mano en Mano" sub="Necesidades por unidad" />
              <LayerToggle checked={showInsumos} onChange={setShowInsumos} color="#8b5cf6" title="Centros de Insumos" sub="Centros Insumos VE" />
            </LayerSection>

            <LayerSection title="Sismos y clima">
              <LayerToggle checked={showShakemap} onChange={setShowShakemap} color="#de2d26" title="ShakeMap 2026" sub="Intensidad sentida USGS" />
              <LayerToggle checked={showEpicentros} onChange={setShowEpicentros} color="#ef4444" title="Epicentros 2026" sub="Doblete Yumare / Morón" />
              <LayerToggle checked={showReplicas} onChange={setShowReplicas} color="#f59e0b" title="Réplicas 2026" sub="USGS en vivo" />
              <LayerToggle checked={show1967} onChange={setShow1967} color="#7c3aed" title="Terremoto 1967" sub="Histórico Caracas" />
              <LayerToggle checked={showClima} onChange={setShowClima} color="#0f766e" title="Clima por ciudad" sub="Open-Meteo" />
              <LayerToggle checked={showAlertas} onChange={setShowAlertas} color="#dc2626" title="Alertas de desastres" sub="GDACS" />
              {OWM_KEY && <LayerToggle checked={showRain} onChange={setShowRain} color="#3b82f6" title="Lluvia" sub="Radar OpenWeatherMap" />}
            </LayerSection>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ap-bg/95 text-center px-6">
          <p className="text-sm text-ap-muted">{error}</p>
        </div>
      )}
    </div>
  );
}
