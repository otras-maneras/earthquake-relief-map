// Modelo unificado "Punto" para el endpoint público /v1/puntos.
// Junta el "directorio de ayuda" en un solo contrato: acopios, refugios,
// teléfonos de emergencia (DB propia) y puntos de salud/hospitales (CIVIS).
// NO incluye personas (PII). Sirve en vivo + cache de CDN; si una fuente
// externa cae, el resto se sigue sirviendo.

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { centros, telefonos } from '@/db/schema';
import { DATA_ATTRIBUTION, DATA_LICENSE } from './http';

export interface PuntoDTO {
  id: string;
  tipo: string; // 'acopio' | 'refugio' | 'salud' | 'telefono'
  nombre: string;
  lat: number | null;
  lng: number | null;
  ciudad: string | null;
  pais: string | null;
  estado: string | null; // 'abierto' | 'lleno' | 'cerrado' | null
  categorias: string[]; // qué recibe (acopios)
  telefono: string | null; // número (tipo telefono) o contacto
  descripcion: string | null;
  fuente: string | null;
  fuente_url: string | null;
  actualizado_en: string | null;
}

const ACOPIOVE_URL = 'https://acopiove.org';
const CIVIS_URL = 'https://civisvenezuela.com';

function fromCentro(r: typeof centros.$inferSelect): PuntoDTO {
  return {
    id: r.id,
    tipo: r.tipo, // acopio | refugio | alojamiento
    nombre: r.name,
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    ciudad: r.ciudad,
    pais: r.pais,
    estado: r.estado,
    categorias: Array.isArray(r.recibe) ? (r.recibe as string[]) : [],
    telefono: r.contacto,
    descripcion: r.necesitaAhora,
    fuente: r.fuente || 'AcopioVE',
    fuente_url: ACOPIOVE_URL,
    actualizado_en: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

function fromTelefono(r: typeof telefonos.$inferSelect): PuntoDTO {
  return {
    id: `tel-${r.id}`,
    tipo: 'telefono',
    nombre: r.name,
    lat: null,
    lng: null,
    ciudad: r.ciudad,
    pais: r.pais,
    estado: null,
    categorias: [],
    telefono: r.number,
    descripcion: r.description,
    fuente: 'AcopioVE',
    fuente_url: ACOPIOVE_URL,
    actualizado_en: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

function fromCivis(p: any): PuntoDTO | null {
  const lat = p?.ubicacion?.lat ?? null;
  const lng = p?.ubicacion?.lng ?? null;
  if (!p?.id || !p?.nombre) return null;
  return {
    id: `salud-${p.id}`,
    tipo: 'salud',
    nombre: p.nombre,
    lat: lat != null ? Number(lat) : null,
    lng: lng != null ? Number(lng) : null,
    ciudad: null,
    pais: 'Venezuela',
    estado: p.estado === 'abierto' ? 'abierto' : null,
    categorias: [],
    telefono: null,
    descripcion: p.detalle || p.direccion || null,
    fuente: 'CIVIS Venezuela',
    fuente_url: CIVIS_URL,
    actualizado_en: p.actualizadoEn || null,
  };
}

// Reúne todas las fuentes del directorio. Cada fuente externa es tolerante a fallos.
export async function buildPuntos(): Promise<PuntoDTO[]> {
  const [centroRows, telRows, civis] = await Promise.all([
    db.select().from(centros).where(eq(centros.active, true)),
    db.select().from(telefonos).where(eq(telefonos.active, true)),
    fetch(`${CIVIS_URL}/api/puntos`, { next: { revalidate: 300 } })
      .then((r) => (r.ok ? r.json() : { puntos: [] }))
      .catch(() => ({ puntos: [] })),
  ]);

  const puntos: PuntoDTO[] = [];
  for (const r of centroRows) puntos.push(fromCentro(r));
  for (const r of telRows) puntos.push(fromTelefono(r));
  const civisArr = Array.isArray(civis?.puntos) ? civis.puntos : [];
  for (const p of civisArr) {
    const dto = fromCivis(p);
    if (dto) puntos.push(dto);
  }
  return puntos;
}

// ---- Filtros (en JS; el dataset es chico y se cachea en el borde) ----

export interface PuntosQuery {
  tipo?: string[];
  ciudad?: string;
  pais?: string;
  near?: { lat: number; lng: number; radiusKm?: number };
  limit: number;
  offset: number;
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function num(v: string | null): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function parsePuntosQuery(p: URLSearchParams): PuntosQuery {
  const limit = Math.min(Math.max(Number(p.get('limit')) || 200, 1), 1000);
  const offset = Math.max(Number(p.get('offset')) || 0, 0);

  const tipoRaw = (p.get('tipo') || '').trim();
  const tipo = tipoRaw ? tipoRaw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : undefined;

  let near: PuntosQuery['near'];
  const nearRaw = (p.get('near') || '').split(',').map((s) => Number(s.trim()));
  if (nearRaw.length === 2 && nearRaw.every(Number.isFinite)) {
    near = { lat: nearRaw[0], lng: nearRaw[1], radiusKm: num(p.get('radius')) };
  }

  return {
    tipo,
    ciudad: p.get('ciudad')?.trim() || undefined,
    pais: p.get('pais')?.trim() || undefined,
    near,
    limit,
    offset,
  };
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function filterPuntos(all: PuntoDTO[], q: PuntosQuery): { rows: PuntoDTO[]; total: number } {
  let list = all;

  if (q.tipo) {
    const set = new Set(q.tipo);
    list = list.filter((p) => set.has(p.tipo));
  }
  if (q.ciudad) {
    const c = norm(q.ciudad);
    list = list.filter((p) => p.ciudad && norm(p.ciudad).includes(c));
  }
  if (q.pais) {
    const c = norm(q.pais);
    list = list.filter((p) => p.pais && norm(p.pais).includes(c));
  }

  if (q.near) {
    const { lat, lng, radiusKm } = q.near;
    // near solo aplica a puntos con coordenadas (los teléfonos quedan fuera).
    list = list
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({ p, d: haversineKm(lat, lng, p.lat as number, p.lng as number) }))
      .filter((x) => (radiusKm ? x.d <= radiusKm : true))
      .sort((a, b) => a.d - b.d)
      .map((x) => x.p);
  }

  const total = list.length;
  return { rows: list.slice(q.offset, q.offset + q.limit), total };
}

// ---- Serializadores ----

export function puntosToFeatureCollection(items: PuntoDTO[]) {
  const withCoords = items.filter((p) => p.lat != null && p.lng != null);
  return {
    type: 'FeatureCollection' as const,
    metadata: { license: DATA_LICENSE, attribution: DATA_ATTRIBUTION, count: withCoords.length },
    features: withCoords.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      properties: { ...p },
    })),
  };
}

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.join('|') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function puntosToCSV(items: PuntoDTO[]): string {
  const cols: (keyof PuntoDTO)[] = [
    'id', 'tipo', 'nombre', 'lat', 'lng', 'ciudad', 'pais', 'estado',
    'categorias', 'telefono', 'descripcion', 'fuente', 'fuente_url', 'actualizado_en',
  ];
  const head = cols.join(',');
  const rows = items.map((p) => cols.map((k) => csvCell(p[k])).join(','));
  return [head, ...rows].join('\n');
}
