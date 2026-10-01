'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Capa de daño satelital (Sentinel-1 SAR vía TerraVE). Consulta por bounding box
// la zona visible y dibuja círculos por área de daño. Reutilizable como hijo de
// cualquier <MapContainer> de react-leaflet. (Misma lógica que en /busquedas.)
export default function SarLayer({ showSAR }: { showSAR: boolean }) {
  const map = useMap();
  const [sarData, setSarData] = useState<any[]>([]);
  const circlesRef = useRef<L.Circle[]>([]);

  const updateSar = async () => {
    if (!showSAR) {
      circlesRef.current.forEach((c) => map.removeLayer(c));
      circlesRef.current = [];
      setSarData([]);
      return;
    }

    const bounds = map.getBounds();
    const url = `https://terra-ve.vercel.app/api/satelital?lat_min=${bounds.getSouth()}&lat_max=${bounds.getNorth()}&lng_min=${bounds.getWest()}&lng_max=${bounds.getEast()}&limit=800`;

    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const body = await res.json();
      if (body && body.data) setSarData(body.data);
    } catch (err) {
      console.error('[SAR_LAYER] Error consultando API TerraVE:', err);
    }
  };

  useMapEvents({ moveend: updateSar, zoomend: updateSar });

  useEffect(() => {
    updateSar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSAR]);

  useEffect(() => {
    circlesRef.current.forEach((c) => map.removeLayer(c));
    circlesRef.current = [];
    if (!showSAR || sarData.length === 0) return;

    const newCircles: L.Circle[] = [];
    sarData.forEach((item) => {
      const radius = Math.max(Math.sqrt(item.area_m2 / Math.PI), 5);
      const popupHtml = `
        <div style="font-family: sans-serif; font-size: 11px; padding: 2px 4px; line-height: 1.4;">
          <h4 style="margin: 0 0 5px 0; color: #0891b2; font-weight: 800; text-transform: uppercase; font-size: 11px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">Daño Satelital (TerraVE)</h4>
          <p style="margin: 3px 0; color: #334155;"><strong>Área estimada:</strong> ${parseFloat(item.area_m2).toLocaleString('es-VE', { maximumFractionDigits: 1 })} m²</p>
          <p style="margin: 3px 0; color: #334155;"><strong>Satélite:</strong> Sentinel-1 GRD</p>
          <p style="margin: 3px 0; color: #334155;"><strong>Fecha:</strong> ${item.fecha_imagen}</p>
          <p style="margin: 5px 0 0 0; color: #64748b; font-size: 8.5px; font-style: italic; border-top: 1px dashed #e2e8f0; padding-top: 3px;">Fuente: TerraVE / Earth Engine</p>
        </div>`;

      const circle = L.circle([item.centro_lat, item.centro_lng], {
        radius,
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
      newCircles.forEach((c) => map.removeLayer(c));
    };
  }, [map, sarData, showSAR]);

  return null;
}
