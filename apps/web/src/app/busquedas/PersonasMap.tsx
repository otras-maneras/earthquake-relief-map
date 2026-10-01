'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Person, PersonTipo } from './entidad';
import SismoLayer from '@/app/SismoLayer';
import Sismo1967Layer from '@/app/Sismo1967Layer';
import RainLayer from '@/app/RainLayer';
import ClimaLayer from '@/app/ClimaLayer';
import AlertasLayer from '@/app/AlertasLayer';
import DanosMicrosoftLayer from '@/app/DanosMicrosoftLayer';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const DEFAULT_CENTER: [number, number] = [10.4806, -66.9036]; // Caracas, Venezuela

// Un pin agrupa varias fichas en la misma coordenada: si no son todas del mismo
// tipo, se dibuja como 'mixto' (contador en vez de ícono).
type PinTipo = PersonTipo | 'mixto';

// Helper para sanitizar strings y prevenir XSS en popups
function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] as string));
}

// Capa dinámica que hace fetch de datos satelitales SAR de TerraVE según la pantalla actual (Bounding Box)
function SarLayer({ showSAR }: { showSAR: boolean }) {
  const map = useMap();
  const [sarData, setSarData] = useState<any[]>([]);
  const circlesRef = useRef<L.Circle[]>([]);

  const updateSar = async () => {
    if (!showSAR) {
      circlesRef.current.forEach(c => map.removeLayer(c));
      circlesRef.current = [];
      setSarData([]);
      return;
    }

    const bounds = map.getBounds();
    const lat_min = bounds.getSouth();
    const lat_max = bounds.getNorth();
    const lng_min = bounds.getWest();
    const lng_max = bounds.getEast();

    // Limitamos a un máximo de 800 zonas de daño en pantalla para no saturar Leaflet
    const url = `https://terra-ve.vercel.app/api/satelital?lat_min=${lat_min}&lat_max=${lat_max}&lng_min=${lng_min}&lng_max=${lng_max}&limit=800`;

    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const body = await res.json();
      if (body && body.data) {
        setSarData(body.data);
      }
    } catch (err) {
      console.error("[SAR_LAYER] Error consultando API TerraVE:", err);
    }
  };

  // Escuchar eventos de movimiento y zoom del mapa
  useMapEvents({
    moveend: updateSar,
    zoomend: updateSar,
  });

  // Carga inicial y cambios en showSAR
  useEffect(() => {
    updateSar();
  }, [showSAR]);

  // Renderizar círculos de Leaflet en el mapa
  useEffect(() => {
    // Limpiar capas anteriores
    circlesRef.current.forEach(c => map.removeLayer(c));
    circlesRef.current = [];

    if (!showSAR || sarData.length === 0) return;

    const newCircles: L.Circle[] = [];

    sarData.forEach((item) => {
      // Calcular radio exacto a partir del área física en m²
      const radius = Math.max(Math.sqrt(item.area_m2 / Math.PI), 5); // Mínimo 5 metros para visibilidad

      const popupHtml = `
        <div style="font-family: sans-serif; font-size: 11px; padding: 2px 4px; line-height: 1.4;">
          <h4 style="margin: 0 0 5px 0; color: #0891b2; font-weight: 800; text-transform: uppercase; font-size: 11px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
            Daño Satelital (TerraVE)
          </h4>
          <p style="margin: 3px 0; color: #334155;"><strong>Área estimada:</strong> ${parseFloat(item.area_m2).toLocaleString('es-VE', { maximumFractionDigits: 1 })} m²</p>
          <p style="margin: 3px 0; color: #334155;"><strong>Satélite:</strong> Sentinel-1 GRD</p>
          <p style="margin: 3px 0; color: #334155;"><strong>Fecha:</strong> ${item.fecha_imagen}</p>
          <p style="margin: 5px 0 0 0; color: #64748b; font-size: 8.5px; font-style: italic; border-top: 1px dashed #e2e8f0; padding-top: 3px;">Fuente: TerraVE / Earth Engine</p>
        </div>
      `;

      const circle = L.circle([item.centro_lat, item.centro_lng], {
        radius: radius,
        color: '#06b6d4',
        fillColor: '#06b6d4',
        fillOpacity: 0.25,
        weight: 1.5,
      }).bindPopup(popupHtml, { maxWidth: 200 });

      circle.addTo(map);
      newCircles.push(circle);
    });

    circlesRef.current = newCircles;

    return () => {
      newCircles.forEach(c => map.removeLayer(c));
    };
  }, [map, sarData, showSAR]);

  return null;
}

// Capa de tiles de CARTO Positron
function BaseTileLayer() {
  const map = useMap();

  useEffect(() => {
    const layer = L.tileLayer(
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

// Controlador de cámara para centrar el mapa al seleccionar
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [map, center, zoom]);
  return null;
}

// Mapeo de metadatos de Reporte VE (colores de categoría)
const REPORTE_VE_META: Record<string, { color: string }> = {
  electricity: { color: '#f59e0b' },
  water: { color: '#0ea5e9' },
  medicine: { color: '#ef4444' },
  food: { color: '#84cc16' },
  fuel: { color: '#8b5cf6' },
  telecoms: { color: '#14b8a6' },
  other: { color: '#6b7280' },
};

// Generador de dibujos SVG vectoriales internos para evitar emojis
function getIconDrawing(tipo: string, color: string, category?: string): string {
  if (tipo === 'localizado') {
    // Checkmark ✓
    return `<path d="M9 9.5l2 2L15 7.5" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  }
  if (tipo === 'desaparecido') {
    // Exclamation !
    return `<circle cx="12" cy="11.8" r="0.9" fill="${color}"/>
            <path d="M12 6.2v4" stroke="${color}" stroke-width="2" stroke-linecap="round" fill="none"/>`;
  }
  if (tipo === 'insumos') {
    // Caja/Crate 3D 📦
    return `<path d="M12 5.2L8.2 7.3L12 9.4L15.8 7.3Z M8.2 8.3v3.2L12 13.6v-3.2Z M15.8 8.3v3.2L12 13.6v-3.2Z" fill="${color}"/>`;
  }
  if (tipo === 'danos') {
    // Edificio con grieta 🏚️
    return `<path d="M12 4.5L7.5 8.2V13.8H16.5V8.2Z" fill="none" stroke="${color}" stroke-width="1.2" stroke-linejoin="round"/>
            <path d="M12 4.5L10.8 8.2H13.2L12 12.2" stroke="${color}" stroke-width="1.2" stroke-linecap="round" fill="none"/>`;
  }
  if (tipo === 'reporte_ve') {
    const cat = category || 'other';
    if (cat === 'electricity') {
      // Rayo ⚡
      return `<path d="M12.5 5.5l-2.5 4h2l-0.5 3 3-4h-2z" fill="${color}" stroke="${color}" stroke-width="0.3"/>`;
    }
    if (cat === 'water') {
      // Gota de agua 💧
      return `<path d="M12 5.8c-1.3 1.5-2.2 2.7-2.2 3.8 0 1.2 0.9 2.2 2.2 2.2s2.2-1 2.2-2.2c0-1.1-0.9-2.3-2.2-3.8z" fill="${color}"/>`;
    }
    if (cat === 'medicine') {
      // Píldora 💊
      return `<path d="M9.5 7.5a1.8 1.8 0 0 1 2.5 0l1.4 1.4a1.8 1.8 0 0 1 0 2.5a1.8 1.8 0 0 1-2.5 0L9.5 10a1.8 1.8 0 0 1 0-2.5z" fill="${color}"/>`;
    }
    if (cat === 'food') {
      // Plato/Soporte de comida 🍞
      return `<path d="M9 8.5h6v1.8a2.7 2.7 0 0 1-5.4 0V8.5z" fill="${color}"/>
              <rect x="8.5" y="7.5" width="7" height="1" rx="0.3" fill="${color}"/>`;
    }
    if (cat === 'fuel') {
      // Surtidor de gasolina ⛽
      return `<rect x="9.5" y="6.2" width="4" height="5.6" rx="0.5" fill="${color}"/>
              <rect x="10.5" y="7.1" width="2" height="1.4" fill="#ffffff"/>
              <path d="M14 8h0.6v2.5H14z" fill="${color}"/>`;
    }
    if (cat === 'telecoms') {
      // Barras de señal 📶
      return `<rect x="9" y="10" width="1" height="2" fill="${color}"/>
              <rect x="10.5" y="8.5" width="1" height="3.5" fill="${color}"/>
              <rect x="12" y="7" width="1" height="5" fill="${color}"/>
              <rect x="13.5" y="5.5" width="1" height="6.5" fill="${color}"/>`;
    }
    // info/other 📍
    return `<circle cx="12" cy="7" r="1" fill="${color}"/>
            <rect x="11.2" y="8.8" width="1.6" height="3.2" rx="0.3" fill="${color}"/>`;
  }
  if (tipo === 'hub') {
    if (category === 'oferta') {
      // Corazón/mano de ayuda (oferta) ❤️
      return `<path d="M12 12.4l-2.8-2.7c-0.9-0.9-0.9-2.2 0-3 0.8-0.8 2-0.8 2.8 0 0.8-0.8 2-0.8 2.8 0 0.9 0.8 0.9 2.1 0 3z" fill="${color}"/>`;
    }
    // Pin/persona genérica del hub 👥
    return `<circle cx="12" cy="8.3" r="1.6" fill="${color}"/>
            <path d="M9 12.4c0-1.7 1.3-2.8 3-2.8s3 1.1 3 2.8z" fill="${color}"/>`;
  }
  if (tipo === 'responsegrid') {
    // Lista de necesidades 📋
    return `<rect x="9" y="6" width="6" height="7.5" rx="1" fill="none" stroke="${color}" stroke-width="1.2"/>
            <path d="M10.5 8.5h3 M10.5 10h3 M10.5 11.5h2" stroke="${color}" stroke-width="1" stroke-linecap="round"/>`;
  }
  if (tipo === 'demano') {
    // Cruz médica en caja (necesidades de insumos hospitalarios) ➕
    return `<rect x="8.5" y="5.7" width="7" height="7" rx="1.2" fill="none" stroke="${color}" stroke-width="1.2"/>
            <path d="M12 7.4v3.6 M10.2 9.2h3.6" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/>`;
  }
  if (tipo === 'acopio') {
    // Caja abierta de donaciones 🎁
    return `<path d="M8.2 8.6h7.6v4.4H8.2z" fill="none" stroke="${color}" stroke-width="1.2"/>
            <path d="M7.6 6.6h8.8v2H7.6z M12 6.6v6.4" stroke="${color}" stroke-width="1.2" fill="none"/>`;
  }
  if (tipo === 'refugio') {
    // Casa (techo solidario) 🏠
    return `<path d="M6.8 10.2L12 6l5.2 4.2v3.4H6.8z" fill="none" stroke="${color}" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="M10.7 13.6v-2.3h2.6v2.3" stroke="${color}" stroke-width="1.1" fill="none"/>`;
  }
  if (tipo === 'salud') {
    // Cruz sanitaria ➕
    return `<path d="M12 5.8v6.8 M8.6 9.2h6.8" stroke="${color}" stroke-width="2.1" stroke-linecap="round" fill="none"/>`;
  }
  return '';
}

// SVG del pin personalizado con el conteo de personas o dibujo vectorial
function pinSvg(color: string, size: number, countOrDrawing: string | number) {
  const isNumber = typeof countOrDrawing === 'number';
  
  let innerHtml = '';
  if (isNumber) {
    innerHtml = `<circle cx="12" cy="9" r="5.4" fill="#ffffff"/>
                 <text x="12" y="11.5" font-size="7.5" font-weight="900" font-family="sans-serif" fill="#1e2126" text-anchor="middle">${countOrDrawing}</text>`;
  } else {
    innerHtml = `<circle cx="12" cy="9" r="5.4" fill="#ffffff"/>
                 <g transform="translate(3, 2.25) scale(0.75)">${countOrDrawing}</g>`;
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,.35))">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}"/>
    ${innerHtml}
  </svg>`;
}

const ICON_CACHE: Record<string, L.DivIcon> = {};
function getPinColor(tipo: PinTipo, specificColor?: string): string {
  if (tipo === 'localizado') return '#059669';
  if (tipo === 'desaparecido') return '#ef4444';
  if (tipo === 'insumos') return '#8b5cf6';
  if (tipo === 'danos') return '#db2777';
  if (tipo === 'hub') return '#0891b2';
  if (tipo === 'responsegrid') return '#4f46e5';
  if (tipo === 'ayudavenezuela') return '#16a34a';
  if (tipo === 'redh') return '#ea580c';
  if (tipo === 'demano') return '#0d9488';
  if (tipo === 'acopio') return '#7c3aed';
  if (tipo === 'refugio') return '#0f766e';
  if (tipo === 'salud') return '#0e7490';
  if (tipo === 'reporte_ve') return specificColor || '#f59e0b';
  return '#1e293b'; // Mixto
}

function getCachedIcon(tipo: PinTipo, countOrDrawing: string | number, specificColor?: string) {
  const color = getPinColor(tipo, specificColor);
  const key = `${tipo}-${color}-${countOrDrawing}`;
  if (!ICON_CACHE[key]) {
    const size = 38;
    ICON_CACHE[key] = L.divIcon({
      className: 'persona-pin',
      html: pinSvg(color, size, countOrDrawing),
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
      popupAnchor: [0, -size + 4],
    });
  }
  return ICON_CACHE[key];
}

type PersonasMapProps = {
  persons: Person[];
  selectedId: string | null;
  onSelectPerson: (p: Person) => void;
  center: [number, number];
  zoom: number;
  showSAR?: boolean;
  smShakemap?: boolean;
  smEpicentros?: boolean;
  smReplicas?: boolean;
  showRain?: boolean;
  showClima?: boolean;
  showAlertas?: boolean;
  show1967?: boolean;
  showDanosIA?: boolean;
};

type GroupedLocation = {
  lat: number;
  lng: number;
  tipo: PinTipo;
  lugar: string;
  personas: Person[];
  category?: string;
};

// Capa optimizada con CLUSTERING para evitar lentitud ante alto volumen de items
function ClusterLayer({
  groupedLocations,
  selectedId,
  onSelectPerson,
}: {
  groupedLocations: GroupedLocation[];
  selectedId: string | null;
  onSelectPerson: (p: Person) => void;
}) {
  const map = useMap();
  const groupRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});

  // Crear el grupo de clusters una sola vez.
  useEffect(() => {
    const group = (L as any).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 45,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
    });
    groupRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      groupRef.current = null;
      markersRef.current = {};
    };
  }, [map]);

  // Reconstruir marcadores al cambiar los datos filtrados
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();
    markersRef.current = {};
    const layers: any[] = [];

    for (const g of groupedLocations) {
      let countOrDrawing: string | number = g.personas.length;
      let specificColor: string | undefined = undefined;

      // Si es un reporte único, calculamos su dibujo SVG interno
      if (g.personas.length === 1) {
        const p = g.personas[0];
        const meta = REPORTE_VE_META[g.category || 'other'] || REPORTE_VE_META.other;
        specificColor = p.tipo === 'reporte_ve' ? meta.color : (p.tipo === 'insumos' ? '#8b5cf6' : (p.tipo === 'danos' ? '#db2777' : (p.tipo === 'hub' ? '#0891b2' : (p.tipo === 'responsegrid' ? '#4f46e5' : (p.tipo === 'redh' ? '#ea580c' : (p.tipo === 'demano' ? '#0d9488' : undefined))))));
        const pinColor = getPinColor(g.tipo, specificColor);
        countOrDrawing = getIconDrawing(g.tipo, pinColor, g.category);
      }

      const m = L.marker([g.lat, g.lng], {
        icon: getCachedIcon(g.tipo, countOrDrawing, specificColor),
        title: g.lugar,
        alt: g.lugar,
      });

      // Crear el popup dinámicamente con manejadores de eventos nativos
      const popupContent = document.createElement('div');
      popupContent.className = 'min-w-[250px] max-w-[290px] flex flex-col max-h-[300px] font-sans text-ap-secondary';

      const headerEl = document.createElement('div');
      headerEl.className = 'border-b border-ap-border pb-2 mb-2';

      const titleEl = document.createElement('h3');
      titleEl.className = 'font-bold text-ap-primary font-outfit text-[13.5px] leading-tight';
      titleEl.innerHTML = `${esc(g.lugar)} <span class="text-ap-muted font-normal">(${g.personas.length})</span>`;
      headerEl.appendChild(titleEl);

      // Selector de filtros para el popup
      const filterBar = document.createElement('div');
      filterBar.className = 'flex gap-1 mt-1.5 text-[9px] font-bold uppercase';
      
      const btnAll = document.createElement('button');
      btnAll.className = 'px-2 py-0.5 rounded bg-ap-primary text-white cursor-pointer';
      btnAll.innerText = 'Todos';
      
      const btnDesap = document.createElement('button');
      btnDesap.className = 'px-2 py-0.5 rounded bg-ap-bg border border-ap-border text-ap-muted hover:text-ap-primary cursor-pointer';
      btnDesap.innerText = 'Desap.';
      
      const btnLoc = document.createElement('button');
      btnLoc.className = 'px-2 py-0.5 rounded bg-ap-bg border border-ap-border text-ap-muted hover:text-ap-primary cursor-pointer';
      btnLoc.innerText = 'Loc.';

      filterBar.appendChild(btnAll);
      filterBar.appendChild(btnDesap);
      filterBar.appendChild(btnLoc);
      headerEl.appendChild(filterBar);
      popupContent.appendChild(headerEl);

      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'space-y-2.5 overflow-y-auto max-h-[190px] pr-1';
      popupContent.appendChild(itemsContainer);

      let currentFilter: 'todos' | 'desaparecido' | 'localizado' = 'todos';
      let displayedCount = 0;
      const limit = 15;

      function getFilteredList() {
        if (currentFilter === 'todos') return g.personas;
        return g.personas.filter(p => {
          if (currentFilter === 'localizado') {
            return p.status === 'Localizado' || p.status === 'A salvo' || p.status === 'Alta Médica' || p.tipo === 'localizado' || p.tipo === 'insumos' || (p.tipo === 'redh' && p.status === 'Localizado') || p.tipo === 'ayudavenezuela';
          } else {
            return p.status === 'Desaparecido' || p.tipo === 'desaparecido' || (p.tipo === 'redh' && p.status === 'Desaparecido');
          }
        });
      }

      function renderNextBatch() {
        const filtered = getFilteredList();
        const batch = filtered.slice(displayedCount, displayedCount + limit);
        
        for (const p of batch) {
          const div = document.createElement('div');
          div.className = 'cursor-pointer hover:opacity-85 transition-opacity py-1';
          
          let borderClass = 'border-l-2 pl-2 border-slate-500';
          let statusStyle = 'text-slate-700';
          let styleColor = '';

          if (p.tipo === 'localizado') {
            borderClass = 'border-l-2 pl-2 border-emerald-500';
            statusStyle = 'text-emerald-700 font-bold';
          } else if (p.tipo === 'desaparecido') {
            borderClass = 'border-l-2 pl-2 border-red-500';
            statusStyle = 'text-red-700 font-bold';
          } else if (p.tipo === 'insumos') {
            borderClass = 'border-l-2 pl-2 border-purple-500';
            statusStyle = 'text-purple-700 font-bold';
            styleColor = '#8b5cf6';
          } else if (p.tipo === 'danos') {
            borderClass = 'border-l-2 pl-2 border-pink-500';
            statusStyle = 'text-pink-700 font-bold';
            styleColor = '#db2777';
          } else if (p.tipo === 'reporte_ve') {
            const meta = REPORTE_VE_META[p.category || 'other'] || REPORTE_VE_META.other;
            borderClass = '';
            statusStyle = 'font-bold';
            styleColor = meta.color;
          } else if (p.tipo === 'hub') {
            borderClass = '';
            statusStyle = 'font-bold';
            styleColor = '#0891b2';
          } else if (p.tipo === 'responsegrid') {
            borderClass = '';
            statusStyle = 'font-bold';
            styleColor = '#4f46e5';
          } else if (p.tipo === 'redh') {
            borderClass = 'border-l-2 pl-2 border-orange-500';
            statusStyle = 'text-orange-700 font-bold';
            styleColor = '#ea580c';
          } else if (p.tipo === 'demano') {
            borderClass = 'border-l-2 pl-2 border-teal-500';
            statusStyle = 'text-teal-700 font-bold';
            styleColor = '#0d9488';
          }

          if (p.tipo === 'reporte_ve' || p.tipo === 'hub' || p.tipo === 'responsegrid' || p.tipo === 'demano') {
            div.style.borderLeft = `2px solid ${styleColor}`;
            div.style.paddingLeft = '8px';
          }

          div.innerHTML = `
            <div class="font-extrabold text-[12px] text-ap-primary leading-tight font-outfit ${p.tipo !== 'reporte_ve' && p.tipo !== 'insumos' && p.tipo !== 'danos' && p.tipo !== 'hub' && p.tipo !== 'responsegrid' ? borderClass : ''}">
              ${esc(p.nombre)}
            </div>
            <div class="flex justify-between items-center text-[10px] text-ap-muted mt-0.5 pl-2">
              <span>${p.cedula ? `Doc: ${esc(p.cedula)}` : 'N/T'}</span>
              <span class="${statusStyle}" style="${styleColor ? `color: ${styleColor}` : ''}">
                ${esc(p.status)}
              </span>
            </div>
            <div class="text-[9px] text-ap-muted/70 pl-2 mt-0.5">
              Fuente: ${esc(p.fuente)}
            </div>
            ${p.observaciones ? `
              <div class="text-[10px] text-ap-secondary italic mt-1 bg-ap-bg/50 px-1 py-0.5 rounded leading-normal ml-2">
                ${esc(p.observaciones)}
              </div>
            ` : ''}
          `;

          div.addEventListener('click', () => {
            onSelectPerson(p);
            m.closePopup();
          });

          itemsContainer.appendChild(div);
        }
        
        displayedCount += batch.length;
        
        const totalFiltered = filtered.length;
        if (displayedCount < totalFiltered) {
          const loadMore = document.createElement('div');
          loadMore.className = 'text-center py-1.5 text-[10px] font-bold text-ap-primary hover:underline cursor-pointer';
          loadMore.innerText = `Cargar más (${totalFiltered - displayedCount} restantes)`;
          loadMore.addEventListener('click', () => {
            loadMore.remove();
            renderNextBatch();
          });
          itemsContainer.appendChild(loadMore);
        }
      }

      itemsContainer.addEventListener('scroll', () => {
        if (itemsContainer.scrollHeight - itemsContainer.scrollTop <= itemsContainer.clientHeight + 10) {
          const loadMoreBtn = itemsContainer.querySelector('.cursor-pointer:last-child') as HTMLElement;
          if (loadMoreBtn && loadMoreBtn.innerText.includes('Cargar más')) {
            loadMoreBtn.click();
          }
        }
      });

      function updateFilter(newFilter: typeof currentFilter, activeBtn: HTMLButtonElement) {
        currentFilter = newFilter;
        displayedCount = 0;
        itemsContainer.innerHTML = '';
        
        [btnAll, btnDesap, btnLoc].forEach(b => {
          b.className = 'px-2 py-0.5 rounded bg-ap-bg border border-ap-border text-ap-muted hover:text-ap-primary cursor-pointer';
        });
        activeBtn.className = 'px-2 py-0.5 rounded bg-ap-primary text-white cursor-pointer';
        
        renderNextBatch();
      }

      btnAll.addEventListener('click', () => updateFilter('todos', btnAll));
      btnDesap.addEventListener('click', () => updateFilter('desaparecido', btnDesap));
      btnLoc.addEventListener('click', () => updateFilter('localizado', btnLoc));

      renderNextBatch();
      m.bindPopup(popupContent, { minWidth: 250 });

      // Guardar referencia por ID de cada persona para abrirlos programáticamente
      for (const p of g.personas) {
        markersRef.current[p.id] = m;
      }
      layers.push(m);
    }

    group.addLayers(layers);
  }, [groupedLocations, onSelectPerson]);

  // Al seleccionar programáticamente desde el panel lateral, hacer zoom y abrir popup
  useEffect(() => {
    const group = groupRef.current;
    if (!group || !selectedId) return;
    const m = markersRef.current[selectedId];
    if (m) {
      group.zoomToShowLayer(m, () => {
        m.openPopup();
      });
    }
  }, [selectedId]);

  return null;
}

export default function PersonasMap({ persons, selectedId, onSelectPerson, center, zoom, showSAR = true, smShakemap = false, smEpicentros = false, smReplicas = false, showRain = false, showClima = false, showAlertas = false, show1967 = false, showDanosIA = false }: PersonasMapProps) {
  // Agrupado de personas por coordenadas
  const groupedLocations = useMemo(() => {
    const groups: Record<string, GroupedLocation> = {};

    for (const p of persons) {
      if (p.lat === null || p.lng === null) continue;
      const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

      if (!groups[key]) {
        groups[key] = {
          lat: p.lat,
          lng: p.lng,
          tipo: p.tipo,
          lugar: p.lugar,
          personas: [],
          category: p.category,
        };
      }
      groups[key].personas.push(p);

      // Si hay más de un elemento en esta coordenada
      if (groups[key].personas.length > 1) {
        let allSameType = true;
        const firstType = groups[key].personas[0].tipo;
        for (const item of groups[key].personas) {
          if (item.tipo !== firstType) {
            allSameType = false;
            break;
          }
        }
        groups[key].tipo = allSameType ? firstType : 'mixto';
      }
    }

    return Object.values(groups);
  }, [persons]);

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={11}
        zoomControl={false}
        preferCanvas={true}
        className="w-full h-full"
        style={{ zIndex: 1 }}
      >
        <BaseTileLayer />
        <MapController center={center} zoom={zoom} />
        <SarLayer showSAR={showSAR} />
        <SismoLayer shakemap={smShakemap} epicentros={smEpicentros} replicas={smReplicas} />
        <Sismo1967Layer show={show1967} />
        <RainLayer show={showRain} />
        <ClimaLayer show={showClima} />
        <AlertasLayer show={showAlertas} />
        <DanosMicrosoftLayer show={showDanosIA} />

        {/* Capa de Marcadores Agrupados por Cercanía (Clustering) */}
        <ClusterLayer
          groupedLocations={groupedLocations}
          selectedId={selectedId}
          onSelectPerson={onSelectPerson}
        />
      </MapContainer>

    </div>
  );
}
