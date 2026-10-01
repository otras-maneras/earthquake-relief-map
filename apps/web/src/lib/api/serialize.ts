// Serializadores de la API pública v1: fila de DB → DTO estable, GeoJSON y CSV.
// El DTO es el CONTRATO público: no renombrar campos sin versionar (v2).

import { DATA_ATTRIBUTION, DATA_LICENSE } from './http';

export interface CentroRow {
  id: string;
  name: string;
  address: string | null;
  latitude: string;
  longitude: string;
  recibe: unknown;
  necesitaAhora: string | null;
  horario: string | null;
  contacto: string | null;
  estado: string;
  tipo: string;
  responsable: string | null;
  fuente: string | null;
  pais: string | null;
  ciudad: string | null;
  updatedAt: Date | null;
}

export interface CentroDTO {
  id: string;
  name: string;
  tipo: string; // 'acopio' | 'refugio'
  estado: string; // 'abierto' | 'lleno' | 'cerrado'
  address: string | null;
  ciudad: string | null;
  pais: string | null;
  lat: number;
  lng: number;
  recibe: string[];
  necesita_ahora: string | null;
  horario: string | null;
  contacto: string | null;
  responsable: string | null;
  fuente: string | null;
  updated_at: string | null;
}

export function toCentroDTO(r: CentroRow): CentroDTO {
  return {
    id: r.id,
    name: r.name,
    tipo: r.tipo,
    estado: r.estado,
    address: r.address,
    ciudad: r.ciudad,
    pais: r.pais,
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    recibe: Array.isArray(r.recibe) ? (r.recibe as string[]) : [],
    necesita_ahora: r.necesitaAhora,
    horario: r.horario,
    contacto: r.contacto,
    responsable: r.responsable,
    fuente: r.fuente,
    updated_at: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

export interface TelefonoRow {
  id: string;
  name: string;
  number: string;
  description: string | null;
  pais: string | null;
  ciudad: string | null;
  updatedAt: Date | null;
}

export interface TelefonoDTO {
  id: string;
  name: string;
  number: string;
  description: string | null;
  ciudad: string | null;
  pais: string | null;
  updated_at: string | null;
}

export function toTelefonoDTO(r: TelefonoRow): TelefonoDTO {
  return {
    id: r.id,
    name: r.name,
    number: r.number,
    description: r.description,
    ciudad: r.ciudad,
    pais: r.pais,
    updated_at: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

// ---- GeoJSON (FeatureCollection de Puntos) ----

export function toFeatureCollection(items: CentroDTO[]) {
  return {
    type: 'FeatureCollection' as const,
    metadata: { license: DATA_LICENSE, attribution: DATA_ATTRIBUTION, count: items.length },
    features: items.map((c) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
      properties: {
        id: c.id,
        name: c.name,
        tipo: c.tipo,
        estado: c.estado,
        address: c.address,
        ciudad: c.ciudad,
        pais: c.pais,
        recibe: c.recibe,
        necesita_ahora: c.necesita_ahora,
        horario: c.horario,
        contacto: c.contacto,
        responsable: c.responsable,
        fuente: c.fuente,
        updated_at: c.updated_at,
      },
    })),
  };
}

// ---- CSV ----

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.join('|') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function centrosToCSV(items: CentroDTO[]): string {
  const cols: (keyof CentroDTO)[] = [
    'id', 'name', 'tipo', 'estado', 'address', 'ciudad', 'pais', 'lat', 'lng',
    'recibe', 'necesita_ahora', 'horario', 'contacto', 'responsable', 'fuente', 'updated_at',
  ];
  const head = cols.join(',');
  const rows = items.map((c) => cols.map((k) => csvCell(c[k])).join(','));
  return [head, ...rows].join('\n');
}
