'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Capa de alertas de desastres (GDACS, sin API key). Muestra eventos activos
// (sismos, inundaciones, ciclones, etc.) de la región, coloreados por nivel de
// alerta (verde/naranja/rojo). Puede estar vacía si no hay alertas activas.
const ALERT_COLOR: Record<string, string> = { Green: '#16a34a', Orange: '#ea580c', Red: '#dc2626' };
// bbox región Venezuela / Caribe sur
const BBOX = { lngMin: -73, lngMax: -59, latMin: 0, latMax: 16 };

export default function AlertasLayer({ show }: { show: boolean }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    let alive = true;
    const clear = () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
    if (!show) { clear(); return; }

    const load = async () => {
      try {
        const res = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP');
        if (!res.ok || !alive) return;
        const data = await res.json();
        const feats = (data.features || []).filter((f: any) => {
          const [lng, lat] = f.geometry?.coordinates || [0, 0];
          return lng > BBOX.lngMin && lng < BBOX.lngMax && lat > BBOX.latMin && lat < BBOX.latMax;
        });
        clear();
        const g = L.layerGroup();
        feats.forEach((f: any) => {
          const [lng, lat] = f.geometry.coordinates;
          const p = f.properties || {};
          const color = ALERT_COLOR[p.alertlevel] || '#6b7280';
          const marker = L.circleMarker([lat, lng], { radius: 11, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9 });
          marker.bindPopup(
            `<div style="font-size:12px;font-family:sans-serif;line-height:1.5"><strong style="color:${color}">Alerta ${p.alertlevel || ''} · ${p.eventtype || ''}</strong><br/>${p.name || p.htmldescription || ''}<br/>${p.country || ''}<br/><span style="color:#6b7280">Desde: ${p.fromdate || ''}</span><br/><span style="color:#9ca3af;font-size:10px">Fuente: GDACS</span></div>`,
          );
          marker.addTo(g);
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
