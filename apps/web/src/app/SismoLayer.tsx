'use client';

import { useEffect, useState } from 'react';
import { GeoJSON, Circle, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Capa de terremoto reutilizable (misma que el mapa de inicio): bandas de
// intensidad ShakeMap (USGS), epicentros del doblete y réplicas en vivo.
// Se renderiza como hijo de un <MapContainer> de react-leaflet.

type Sismo = { id: string; mag: number; place: string; time: number; depth: number; lat: number; lng: number };

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
    radius: 35000,
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
    radius: 65000,
    color: '#ef4444',
    isPrecursor: false,
    desc: 'Sismo principal del doblete, extremadamente superficial, desencadenado por la ruptura del sismo precursor 39 segundos después. Causó el mayor impacto destructivo.',
  },
];

const getEpicenterIcon = (isPrecursor: boolean) =>
  L.divIcon({
    className: 'custom-epicenter-icon',
    html: `<div class="relative w-[30px] h-[30px] flex items-center justify-center pointer-events-none">
      <div class="epicenter-pulse-ring ${isPrecursor ? 'epicenter-pulse-ring-precursor' : ''}"></div>
      <div class="epicenter-dot ${isPrecursor ? 'epicenter-dot-precursor' : ''}"></div>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

const REPLICA_ICON_CACHE: Record<string, L.DivIcon> = {};
function getReplicaIcon(mag: number, color: string) {
  const radius = 4 + Math.max(0, mag - 3) * 3;
  const key = `${mag}-${color}`;
  if (!REPLICA_ICON_CACHE[key]) {
    REPLICA_ICON_CACHE[key] = L.divIcon({
      className: 'replica-pin',
      html: `<div style="width:${radius * 2}px;height:${radius * 2}px;background:${color};border:1px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
      iconSize: [radius * 2, radius * 2],
      iconAnchor: [radius, radius],
      popupAnchor: [0, -radius],
    });
  }
  return REPLICA_ICON_CACHE[key];
}

function relativeTime(ms: number): string {
  const h = Math.floor((Date.now() - ms) / 3_600_000);
  if (h < 1) return 'hace menos de 1 h';
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d > 1 ? 's' : ''}`;
}

function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] as string));
}

export default function SismoLayer({ shakemap = false, epicentros = false, replicas = false }: { shakemap?: boolean; epicentros?: boolean; replicas?: boolean }) {
  const [intensity, setIntensity] = useState<any>(null);
  const [sismos, setSismos] = useState<Sismo[]>([]);

  useEffect(() => {
    fetch('/shakemap-intensity.json').then((r) => (r.ok ? r.json() : null)).then((d) => setIntensity(d)).catch(() => {});
  }, []);

  useEffect(() => {
    const load = () => fetch('/api/sismos').then((r) => (r.ok ? r.json() : [])).then((d) => setSismos(Array.isArray(d) ? d : [])).catch(() => {});
    load();
    const id = setInterval(load, 300_000);
    return () => clearInterval(id);
  }, []);

  if (!shakemap && !epicentros && !replicas) return null;

  return (
    <>
      {shakemap && intensity && (
        <GeoJSON
          data={intensity}
          style={(feature) => {
            const c = (feature?.properties as any)?.color || '#de2d26';
            return { color: c, weight: 0.8, opacity: 0.5, fillColor: c, fillOpacity: 0.42 };
          }}
          onEachFeature={(feature, layer) => {
            const p = (feature.properties as any) || {};
            layer.bindPopup(
              `<div style="font-size:12px;font-family:sans-serif;line-height:1.4"><strong style="color:${p.color}">Intensidad: ${p.label}</strong><br/>Escala de Mercalli — MMI ${p.mmi}<br/><span style="color:#9ca3af;font-size:10px">Sismo principal M7.5 · ShakeMap USGS</span></div>`,
            );
          }}
        />
      )}

      {epicentros && (
        <>
          {EPICENTROS.map((e) => (
            <Circle
              key={`circle-${e.id}`}
              center={[e.lat, e.lng]}
              radius={e.radius}
              pathOptions={{ color: e.color, fillColor: e.color, fillOpacity: 0.08, weight: 1.5, dashArray: '5, 5', interactive: false }}
            />
          ))}
          <Polyline
            positions={[[EPICENTROS[0].lat, EPICENTROS[0].lng], [EPICENTROS[1].lat, EPICENTROS[1].lng]]}
            pathOptions={{ color: '#ef4444', weight: 2.5, dashArray: '5, 10', opacity: 0.6 }}
          >
            <Popup>
              <div style={{ fontSize: '11px', textAlign: 'center', fontFamily: 'sans-serif' }}>
                <strong>Propagación de Ruptura (Falla de Boconó)</strong><br />Dirección del doblete sísmico (intervalo de 39s)
              </div>
            </Popup>
          </Polyline>
          {EPICENTROS.map((e) => (
            <Marker key={`marker-${e.id}`} position={[e.lat, e.lng]} icon={getEpicenterIcon(e.isPrecursor)}>
              <Popup minWidth={220}>
                <div style={{ fontSize: '12px', lineHeight: '1.4', fontFamily: 'sans-serif' }}>
                  <div style={{ fontWeight: '800', color: e.color, fontSize: '13px' }}>{e.name}</div>
                  <div style={{ marginTop: '6px', color: '#1e2126' }}><strong>Magnitud:</strong> <span style={{ fontWeight: 'bold' }}>{e.magnitude}</span> ({e.intensity})</div>
                  <div style={{ color: '#1e2126' }}><strong>Profundidad:</strong> {e.depth}</div>
                  <div style={{ color: '#1e2126' }}><strong>Hora Local:</strong> {e.time}</div>
                  <div style={{ marginTop: '6px', color: '#6b7280', fontSize: '11px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '4px' }}>{e.desc}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </>
      )}

      {replicas && sismos.map((s) => {
        const color = s.mag >= 4.5 ? '#dc2626' : '#f59e0b';
        return (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={getReplicaIcon(s.mag, color)}>
            <Popup>
              <div style={{ fontSize: '12px', fontFamily: 'sans-serif', lineHeight: 1.4 }}>
                <strong style={{ color }}>Réplica M{s.mag}</strong><br />{esc(s.place)}<br />
                <span style={{ color: '#6b7280' }}>Prof. {s.depth} km · {relativeTime(s.time)}</span><br />
                <span style={{ color: '#9ca3af', fontSize: '10px' }}>Fuente: USGS</span>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
