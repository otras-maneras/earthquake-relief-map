'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Capa de edificios afectados (Catia La Mar, La Guaira) evaluados por Microsoft AI for
// Good Lab con machine learning sobre imágenes satelitales Vantor (25-jun-2026), vía
// OCHA HDX. Snapshot estático (no cambia): 9.128 polígonos con % de daño estimado.
// Fuente: https://data.humdata.org/dataset/venezuela-earthquakes-catia-la-mar
const DATA_URL = '/danos-catia-la-mar.json';

function colorFor(pct: number) {
  if (pct >= 0.6) return '#b91c1c'; // severo
  if (pct >= 0.3) return '#f97316'; // moderado
  return '#facc15'; // leve
}

export default function DanosMicrosoftLayer({ show }: { show: boolean }) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const dataRef = useRef<any>(null);

  useEffect(() => {
    let alive = true;
    const clear = () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
    if (!show) { clear(); return; }

    const render = (data: any) => {
      if (!alive) return;
      clear();
      const g = L.geoJSON(data, {
        style: (feature) => {
          const pct = (feature?.properties as any)?.damage_pct_0m ?? 0;
          const c = colorFor(pct);
          return { color: c, weight: 0.6, opacity: 0.6, fillColor: c, fillOpacity: 0.45 };
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties || {};
          const pct = Math.round((p.damage_pct_0m ?? 0) * 100);
          layer.bindPopup(
            `<div style="font-size:12px;font-family:sans-serif;line-height:1.5">
              <strong style="color:${colorFor(p.damage_pct_0m ?? 0)}">Edificio ${p.id ?? ''} · ${pct}% de daño estimado</strong><br/>
              Evaluación por IA sobre imagen satelital (25-jun-2026)<br/>
              <span style="color:#9ca3af;font-size:10px">Fuente: Microsoft AI for Good Lab / OCHA HDX. Requiere verificación de campo.</span>
            </div>`,
          );
        },
      });
      g.addTo(map);
      layerRef.current = g;
    };

    if (dataRef.current) {
      render(dataRef.current);
    } else {
      fetch(DATA_URL)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || !alive) return;
          dataRef.current = data;
          render(data);
        })
        .catch(() => {
          /* silencioso */
        });
    }

    return () => { alive = false; clear(); };
  }, [map, show]);

  return null;
}
