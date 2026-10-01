import { and, eq, between } from 'drizzle-orm';
import { db } from '@/db';
import { centros } from '@/db/schema';

// Detección ligera de duplicados para la moderación de sugerencias:
// un centro ACTIVO cercano (≤200 m) con nombre parecido o muy próximo (≤50 m).
// No bloquea: solo marca para que el revisor decida.

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Palabras genéricas que no aportan a la identidad del punto.
const STOP = new Set(['centro', 'acopio', 'refugio', 'punto', 'apoyo', 'ayuda', 'para', 'sede', 'casa', 'los', 'las', 'del']);

function significantTokens(s: string): Set<string> {
  return new Set(norm(s).split(' ').filter((w) => w.length >= 4 && !STOP.has(w)));
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type DuplicateMatch = { id: string; name: string; distanceM: number } | null;

export async function findPossibleDuplicate(
  lat: number,
  lng: number,
  name: string,
  excludeId?: string,
): Promise<DuplicateMatch> {
  const d = 0.0018; // ~200 m de bbox para acotar el query
  const rows = await db
    .select({ id: centros.id, name: centros.name, latitude: centros.latitude, longitude: centros.longitude })
    .from(centros)
    .where(
      and(
        eq(centros.active, true),
        between(centros.latitude, String(lat - d), String(lat + d)),
        between(centros.longitude, String(lng - d), String(lng + d)),
      ),
    )
    .limit(50);

  const subTokens = significantTokens(name);
  let best: DuplicateMatch = null;
  for (const r of rows) {
    if (excludeId && r.id === excludeId) continue;
    const distanceM = haversineM(lat, lng, Number(r.latitude), Number(r.longitude));
    if (distanceM > 200) continue;
    const rTokens = significantTokens(r.name);
    const sharesName = [...subTokens].some((t) => rTokens.has(t));
    if (distanceM <= 50 || sharesName) {
      if (!best || distanceM < best.distanceM) {
        best = { id: r.id, name: r.name, distanceM: Math.round(distanceM) };
      }
    }
  }
  return best;
}
