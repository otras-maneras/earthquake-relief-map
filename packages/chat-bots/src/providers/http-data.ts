import { config } from '../config.js';

export type CentroHit = {
  id: string;
  name: string;
  address: string | null;
  ciudad: string | null;
  contacto: string | null;
  estado: string;
  tipo: string;
  lat: number;
  lng: number;
  distanceKm?: number;
};

export type PersonHit = {
  nombre: string;
  status: string;
  lugar: string;
  cedula: string | null;
  observaciones: string | null;
  fuente: string | null;
  tipo: string | null;
};

type PuntoDto = {
  id?: string;
  nombre?: string;
  descripcion?: string | null;
  ciudad?: string | null;
  telefono?: string | null;
  estado?: string | null;
  tipo?: string | null;
  lat?: number | string;
  lng?: number | string;
  latitude?: number | string;
  longitude?: number | string;
  distance_km?: number;
  distanceKm?: number;
};

type PersonaDto = {
  nombre?: string;
  estado?: string;
  ubicacion_general?: string;
  cedula?: string | null;
  fuente?: string | null;
  observaciones?: string | null;
  tipo?: string | null;
  status?: string;
  lugar?: string;
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapPunto(p: PuntoDto, origin?: { lat: number; lng: number }): CentroHit | null {
  const lat = num(p.lat ?? p.latitude);
  const lng = num(p.lng ?? p.longitude);
  if (!p.nombre || (!lat && !lng)) return null;
  const distanceKm =
    p.distanceKm ?? p.distance_km ?? (origin ? haversineKm(origin.lat, origin.lng, lat, lng) : undefined);
  return {
    id: String(p.id ?? `${lat},${lng}`),
    name: p.nombre,
    address: p.descripcion ?? null,
    ciudad: p.ciudad ?? null,
    contacto: p.telefono ?? null,
    estado: p.estado ?? 'abierto',
    tipo: p.tipo ?? 'acopio',
    lat,
    lng,
    distanceKm: distanceKm != null ? Math.round(distanceKm * 10) / 10 : undefined,
  };
}

async function fetchJson<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${config.dataApiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`DATA API ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }
  return (await res.json()) as T;
}

function extractPuntos(body: unknown): PuntoDto[] {
  if (Array.isArray(body)) return body as PuntoDto[];
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as PuntoDto[];
    if (Array.isArray(o.puntos)) return o.puntos as PuntoDto[];
    if (Array.isArray(o.rows)) return o.rows as PuntoDto[];
  }
  return [];
}

export async function searchCentrosNear(
  lat: number,
  lng: number,
  tipo: 'refugio' | 'acopio',
  radiusKm = 15,
  limit = 3,
): Promise<CentroHit[]> {
  const body = await fetchJson<unknown>('/puntos', {
    tipo,
    near: `${lat},${lng}`,
    radius: radiusKm,
    limit,
  });
  const origin = { lat, lng };
  return extractPuntos(body)
    .map((p) => mapPunto(p, origin))
    .filter((x): x is CentroHit => x != null)
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    .slice(0, limit);
}

export async function searchCentrosByCity(
  ciudad: string,
  tipo: 'refugio' | 'acopio',
  limit = 5,
): Promise<CentroHit[]> {
  const body = await fetchJson<unknown>('/puntos', { tipo, ciudad, limit });
  return extractPuntos(body)
    .map((p) => mapPunto(p))
    .filter((x): x is CentroHit => x != null)
    .slice(0, limit);
}

export async function listEmergencyPhones(limit = 6): Promise<CentroHit[]> {
  const body = await fetchJson<unknown>('/puntos', { tipo: 'telefono', limit });
  return extractPuntos(body)
    .map((p) => mapPunto(p))
    .filter((x): x is CentroHit => x != null)
    .slice(0, limit);
}

export async function searchPersonas(q: string, limit = 5): Promise<PersonHit[]> {
  if (!config.personasSearchPath) return [];
  const path = config.personasSearchPath.startsWith('/')
    ? config.personasSearchPath
    : `/${config.personasSearchPath}`;
  const body = await fetchJson<unknown>(path, { q, limit });
  const rows: PersonaDto[] = Array.isArray(body)
    ? (body as PersonaDto[])
    : ((body as { data?: PersonaDto[] })?.data ?? []);
  return rows.slice(0, limit).map((p) => ({
    nombre: p.nombre ?? 'Sin nombre',
    status: p.status ?? p.estado ?? 'desconocido',
    lugar: p.lugar ?? p.ubicacion_general ?? '—',
    cedula: p.cedula ?? null,
    observaciones: p.observaciones ?? null,
    fuente: p.fuente ?? null,
    tipo: p.tipo ?? null,
  }));
}

export function formatCentroLine(c: CentroHit, i: number): string {
  const dist = c.distanceKm != null ? ` (${c.distanceKm} km)` : '';
  const addr = c.address ? `\n   📍 ${c.address}` : '';
  const city = c.ciudad ? `\n   🏙 ${c.ciudad}` : '';
  const phone = c.contacto ? `\n   📞 ${c.contacto}` : '';
  const state = c.estado ? `\n   🟢 ${c.estado}` : '';
  return `${i + 1}. *${c.name}*${dist}${addr}${city}${phone}${state}`;
}

export function formatPersonaLine(p: PersonHit, i: number): string {
  const ced = p.cedula ? `\n   🪪 ${p.cedula}` : '';
  const obs = p.observaciones ? `\n   📝 ${p.observaciones}` : '';
  const src = p.fuente ? `\n   🔗 ${p.fuente}` : '';
  return `${i + 1}. *${p.nombre}*\n   Estado: ${p.status}\n   Lugar: ${p.lugar}${ced}${obs}${src}`;
}
