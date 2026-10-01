'use client';

import { useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const icon = L.icon({
  iconUrl: (markerIcon as any).src ?? (markerIcon as any),
  iconRetinaUrl: (markerIcon2x as any).src ?? (markerIcon2x as any),
  shadowUrl: (markerShadow as any).src ?? (markerShadow as any),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const DEFAULT_CENTER: [number, number] = [10.4806, -66.9036]; // Caracas, Venezuela (fallback)


function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const [busy, setBusy] = useState(false);
  const center: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;

  const locate = () => {
    if (!navigator.geolocation) return alert('Tu navegador no soporta geolocalización.');
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onChange(latitude, longitude);
        mapRef.current?.flyTo([latitude, longitude], 16);
        setBusy(false);
      },
      () => {
        setBusy(false);
        alert('No se pudo obtener tu ubicación.');
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer ref={mapRef} center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; CARTO &copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        <ClickHandler onChange={onChange} />
        {lat != null && lng != null && (
          <Marker
            position={[lat, lng]}
            draggable
            icon={icon}
            eventHandlers={{
              dragend(e) {
                const m = (e.target as L.Marker).getLatLng();
                onChange(m.lat, m.lng);
              },
            }}
          />
        )}
      </MapContainer>

      <button
        type="button"
        onClick={locate}
        disabled={busy}
        className="absolute top-2 right-2 z-[1000] bg-ap-surface border border-ap-border rounded-lg px-3 py-1.5 text-[12px] font-bold text-ap-primary shadow-agentos-sm disabled:opacity-50"
      >
        {busy ? 'Buscando…' : '📍 Usar mi ubicación'}
      </button>
      <div className="absolute bottom-2 left-2 z-[1000] bg-ap-surface/90 border border-ap-border rounded-lg px-2.5 py-1 text-[11px] text-ap-muted">
        Tocá el mapa para fijar el punto
      </div>
    </div>
  );
}
