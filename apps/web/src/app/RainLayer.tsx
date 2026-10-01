'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Capa de precipitación (OpenWeatherMap). Tiles XYZ estándar con soporte de zoom
// completo (a diferencia del radar de RainViewer, que tope en ~z12). La key va por
// env NEXT_PUBLIC_OPENWEATHER_KEY. Reutilizable como hijo de un <MapContainer>.
const OWM_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_KEY || '';

export default function RainLayer({ show }: { show: boolean }) {
  const map = useMap();
  const layerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!show || !OWM_KEY) return;

    const layer = L.tileLayer(
      `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
      {
        opacity: 0.6,
        zIndex: 350,
        maxZoom: 20,
        attribution: '© <a href="https://openweathermap.org/">OpenWeather</a>',
      },
    );
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    };
  }, [map, show]);

  return null;
}
