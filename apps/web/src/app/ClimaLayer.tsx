'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Capa de clima (Open-Meteo, sin API key). Muestra el clima actual en ciudades
// clave de la zona afectada; una sola llamada multipunto. Refresca cada 10 min.
const CIUDADES = [
  { name: 'Caracas', lat: 10.48, lng: -66.9 },
  { name: 'La Guaira', lat: 10.6, lng: -66.93 },
  { name: 'Los Teques', lat: 10.34, lng: -67.04 },
  { name: 'Maracay', lat: 10.25, lng: -67.6 },
  { name: 'Valencia', lat: 10.16, lng: -68.0 },
  { name: 'San Felipe', lat: 10.34, lng: -68.74 },
  { name: 'Barquisimeto', lat: 10.07, lng: -69.32 },
  { name: 'Puerto Cabello', lat: 10.47, lng: -68.01 },
];

function condicion(code: number): string {
  if (code === 0) return 'Despejado';
  if (code <= 3) return 'Parcialmente nublado';
  if (code <= 48) return 'Niebla';
  if (code <= 57) return 'Llovizna';
  if (code <= 67) return 'Lluvia';
  if (code <= 77) return 'Nieve';
  if (code <= 82) return 'Chubascos';
  if (code <= 86) return 'Nieve';
  return 'Tormenta';
}

export default function ClimaLayer({ show }: { show: boolean }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    let alive = true;
    const clear = () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
    if (!show) { clear(); return; }

    const load = async () => {
      const lats = CIUDADES.map((c) => c.lat).join(',');
      const lngs = CIUDADES.map((c) => c.lng).join(',');
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=auto`);
        if (!res.ok || !alive) return;
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [data];
        clear();
        const g = L.layerGroup();
        arr.forEach((d: any, i: number) => {
          const c = CIUDADES[i];
          if (!c) return;
          const cur = d.current || {};
          const temp = Math.round(cur.temperature_2m ?? 0);
          const lluvia = (cur.precipitation ?? 0) > 0;
          const bg = lluvia ? '#3b82f6' : '#0f766e';
          const icon = L.divIcon({
            className: 'clima-badge',
            html: `<div style="background:${bg};color:#fff;font-family:sans-serif;font-size:11px;font-weight:800;padding:2px 6px;border-radius:999px;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);white-space:nowrap">${temp}°${lluvia ? ' · lluvia' : ''}</div>`,
            iconSize: [40, 20],
            iconAnchor: [20, 10],
          });
          const m = L.marker([c.lat, c.lng], { icon });
          m.bindPopup(
            `<div style="font-size:12px;font-family:sans-serif;line-height:1.5"><strong>${c.name}</strong><br/>${temp} °C · ${condicion(cur.weather_code ?? 0)}<br/>Lluvia: ${cur.precipitation ?? 0} mm · Viento: ${Math.round(cur.wind_speed_10m ?? 0)} km/h<br/><span style="color:#9ca3af;font-size:10px">Fuente: Open-Meteo</span></div>`,
          );
          m.addTo(g);
        });
        g.addTo(map);
        layerRef.current = g;
      } catch {
        /* silencioso */
      }
    };
    load();
    const id = setInterval(load, 600000);
    return () => { alive = false; clearInterval(id); clear(); };
  }, [map, show]);

  return null;
}
