// Búsqueda de centros de acopio / refugios para el bot entrante de WhatsApp.
// Dos modos: por cercanía (haversine sobre lat/long) y por ciudad (texto).
// Todas las coordenadas existen en la DB, así que la búsqueda por ubicación es fiable.

import { and, eq, ilike, ne, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { centros, telefonos } from '@/db/schema';

export type Tipo = 'acopio' | 'refugio';

export interface CentroHit {
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
}

const COLS = {
  id: centros.id,
  name: centros.name,
  address: centros.address,
  ciudad: centros.ciudad,
  contacto: centros.contacto,
  estado: centros.estado,
  tipo: centros.tipo,
  lat: centros.latitude,
  lng: centros.longitude,
};

function toHit(r: Record<string, unknown>): CentroHit {
  return {
    id: String(r.id),
    name: String(r.name),
    address: (r.address as string) ?? null,
    ciudad: (r.ciudad as string) ?? null,
    contacto: (r.contacto as string) ?? null,
    estado: String(r.estado),
    tipo: String(r.tipo),
    lat: Number(r.lat),
    lng: Number(r.lng),
  };
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Base: activos y no cerrados (en emergencia no ofrecemos centros cerrados).
function baseFilters(tipo?: Tipo): SQL[] {
  const f: SQL[] = [eq(centros.active, true), ne(centros.estado, 'cerrado')];
  if (tipo) f.push(eq(centros.tipo, tipo));
  return f;
}

/** Los `limit` centros más cercanos a un punto. Si no se pasa tipo, busca ambos. */
export async function nearest(
  lat: number,
  lng: number,
  opts: { tipo?: Tipo; limit?: number } = {}
): Promise<CentroHit[]> {
  const rows = await db.select(COLS).from(centros).where(and(...baseFilters(opts.tipo)));
  return rows
    .map(toHit)
    .map((h) => ({ ...h, distanceKm: haversineKm(lat, lng, h.lat, h.lng) }))
    .sort((a, b) => (a.distanceKm! - b.distanceKm!))
    .slice(0, opts.limit ?? 3);
}

/** Centros cuya ciudad coincide (ilike) con el texto. */
export async function byCity(
  city: string,
  opts: { tipo?: Tipo; limit?: number } = {}
): Promise<CentroHit[]> {
  const q = city.trim();
  if (q.length < 3) return [];
  const rows = await db
    .select(COLS)
    .from(centros)
    .where(and(...baseFilters(opts.tipo), ilike(centros.ciudad, `%${q}%`)))
    .limit(opts.limit ?? 5);
  return rows.map(toHit);
}

/** Teléfonos de emergencia (nacionales o por ciudad si se indica). */
export async function emergencyPhones(opts: { city?: string; limit?: number } = {}) {
  const f: SQL[] = [eq(telefonos.active, true)];
  if (opts.city && opts.city.trim().length >= 3) f.push(ilike(telefonos.ciudad, `%${opts.city.trim()}%`));
  return db
    .select({ name: telefonos.name, number: telefonos.number, description: telefonos.description })
    .from(telefonos)
    .where(and(...f))
    .limit(opts.limit ?? 6);
}
