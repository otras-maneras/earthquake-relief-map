'use client';

import { useEffect, useState } from 'react';
import { GeoJSON, Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Capa histórica: Terremoto de Caracas de 1967 (M6.6, 29-30 jul 1967).
// Contornos de intensidad (ShakeMap USGS, evento iscgem833882) + epicentro.
// Se renderiza como hijo de un <MapContainer> de react-leaflet.

const EPI_1967 = { lat: 10.602, lng: -67.326, mag: '6.6 Mw', depth: '23 km', place: '32 km al oeste de Catia La Mar' };

const icon1967 = L.divIcon({
  className: 'epi-1967-icon',
  html: `<div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center">
    <div style="width:14px;height:14px;border-radius:50%;background:#7c3aed;border:2px solid #fff;box-shadow:0 0 0 4px rgba(124,58,237,0.25)"></div>
  </div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

export default function Sismo1967Layer({ show }: { show: boolean }) {
  const [intensity, setIntensity] = useState<any>(null);

  useEffect(() => {
    fetch('/shakemap-1967-intensity.json').then((r) => (r.ok ? r.json() : null)).then(setIntensity).catch(() => {});
  }, []);

  if (!show) return null;

  return (
    <>
      {intensity && (
        <GeoJSON
          key="sm1967"
          data={intensity}
          style={(feature) => {
            const p = (feature?.properties as any) || {};
            return { color: p.color || '#7c3aed', weight: p.weight || 2, opacity: 0.85 };
          }}
          onEachFeature={(feature, layer) => {
            const p = (feature.properties as any) || {};
            layer.bindPopup(
              `<div style="font-size:12px;font-family:sans-serif;line-height:1.4"><strong style="color:#7c3aed">Terremoto de Caracas 1967</strong><br/>Intensidad MMI ${p.value}<br/><span style="color:#9ca3af;font-size:10px">ShakeMap USGS · evento iscgem833882</span></div>`,
            );
          }}
        />
      )}

      <Circle
        center={[EPI_1967.lat, EPI_1967.lng]}
        radius={40000}
        pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.06, weight: 1.5, dashArray: '5, 5', interactive: false }}
      />

      <Marker position={[EPI_1967.lat, EPI_1967.lng]} icon={icon1967}>
        <Popup minWidth={220}>
          <div style={{ fontSize: '12px', lineHeight: '1.4', fontFamily: 'sans-serif' }}>
            <div style={{ fontWeight: 800, color: '#7c3aed', fontSize: '13px' }}>Terremoto de Caracas · 1967</div>
            <div style={{ marginTop: '6px', color: '#1e2126' }}><strong>Magnitud:</strong> {EPI_1967.mag}</div>
            <div style={{ color: '#1e2126' }}><strong>Profundidad:</strong> {EPI_1967.depth}</div>
            <div style={{ color: '#1e2126' }}><strong>Fecha:</strong> 29-30 de julio de 1967</div>
            <div style={{ color: '#1e2126' }}><strong>Epicentro:</strong> {EPI_1967.place}</div>
            <div style={{ marginTop: '6px', color: '#6b7280', fontSize: '11px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '4px' }}>
              Sismo histórico de referencia. Fuente: catálogo ISC-GEM / ShakeMap USGS.
            </div>
          </div>
        </Popup>
      </Marker>
    </>
  );
}
