// Consulta de centros/teléfonos para la API pública v1.
// Filtros simples (tipo, ciudad, estado, pais, bbox, updatedSince) van en SQL;
// `recibe` (intersección de arrays) y `near` (haversine) se resuelven en JS — el
// dataset es chico (~cientos de filas), así que es simple y suficiente.

import { and, desc, eq, gte, sql, type SQL, type Column } from 'drizzle-orm';
import { db } from '@/db';
import { centros, telefonos } from '@/db/schema';
import type { CentroRow, TelefonoRow } from './serialize';

// ilike insensible a acentos (requiere la extensión unaccent): "bogota" → "Bogotá".
function unaccentIlike(col: Column, value: string): SQL {
  return sql`unaccent(${col}) ilike unaccent(${`%${value}%`})`;
}

export interface CentrosQuery {
  tipo?: string;
  ciudad?: string;
  estado?: string;
  pais?: string;
  recibe?: string[];
  bbox?: [number, number, number, number]; // minLng, minLat, maxLng, maxLat
  near?: { lat: number; lng: number; radiusKm?: number };
  updatedSince?: Date;
  limit: number;
  offset: number;
}

const ALLOWED_TIPO = new Set(['acopio', 'refugio']);
const ALLOWED_ESTADO = new Set(['abierto', 'lleno', 'cerrado']);

function num(v: string | null): number | undefined {
  if (v == null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function parseCentrosQuery(p: URLSearchParams): CentrosQuery {
  const limit = Math.min(Math.max(Number(p.get('limit')) || 100, 1), 500);
  const offset = Math.max(Number(p.get('offset')) || 0, 0);

  const tipo = p.get('tipo')?.toLowerCase();
  const estado = p.get('estado')?.toLowerCase();
  const recibe = (p.get('recibe') || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

  let bbox: CentrosQuery['bbox'];
  const bboxRaw = (p.get('bbox') || '').split(',').map((s) => Number(s.trim()));
  if (bboxRaw.length === 4 && bboxRaw.every(Number.isFinite)) {
    bbox = [bboxRaw[0], bboxRaw[1], bboxRaw[2], bboxRaw[3]];
  }

  let near: CentrosQuery['near'];
  const nearRaw = (p.get('near') || '').split(',').map((s) => Number(s.trim()));
  if (nearRaw.length === 2 && nearRaw.every(Number.isFinite)) {
    near = { lat: nearRaw[0], lng: nearRaw[1], radiusKm: num(p.get('radius')) };
  }

  const since = p.get('updatedSince');
  const updatedSince = since && !Number.isNaN(Date.parse(since)) ? new Date(since) : undefined;

  return {
    tipo: tipo && ALLOWED_TIPO.has(tipo) ? tipo : undefined,
    ciudad: p.get('ciudad')?.trim() || undefined,
    estado: estado && ALLOWED_ESTADO.has(estado) ? estado : undefined,
    pais: p.get('pais')?.trim() || undefined,
    recibe: recibe.length ? recibe : undefined,
    bbox,
    near,
    updatedSince,
    limit,
    offset,
  };
}

const CENTRO_COLS = {
  id: centros.id,
  name: centros.name,
  address: centros.address,
  latitude: centros.latitude,
  longitude: centros.longitude,
  recibe: centros.recibe,
  necesitaAhora: centros.necesitaAhora,
  horario: centros.horario,
  contacto: centros.contacto,
  estado: centros.estado,
  tipo: centros.tipo,
  responsable: centros.responsable,
  fuente: centros.fuente,
  pais: centros.pais,
  ciudad: centros.ciudad,
  updatedAt: centros.updatedAt,
};

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export async function queryCentros(
  q: CentrosQuery,
): Promise<{ rows: CentroRow[]; total: number; distances?: Map<string, number> }> {
  const f: SQL[] = [eq(centros.active, true)];
  if (q.tipo) f.push(eq(centros.tipo, q.tipo));
  if (q.estado) f.push(eq(centros.estado, q.estado));
  if (q.ciudad) f.push(unaccentIlike(centros.ciudad, q.ciudad));
  if (q.pais) f.push(unaccentIlike(centros.pais, q.pais));
  if (q.updatedSince) f.push(gte(centros.updatedAt, q.updatedSince));
  if (q.bbox) {
    const [minLng, minLat, maxLng, maxLat] = q.bbox;
    f.push(sql`cast(${centros.latitude} as double precision) between ${minLat} and ${maxLat}`);
    f.push(sql`cast(${centros.longitude} as double precision) between ${minLng} and ${maxLng}`);
  }

  let rows = (await db.select(CENTRO_COLS).from(centros).where(and(...f)).orderBy(desc(centros.createdAt))) as CentroRow[];

  // recibe: el centro recibe AL MENOS una de las categorías pedidas.
  if (q.recibe?.length) {
    const want = new Set(q.recibe);
    rows = rows.filter((r) => Array.isArray(r.recibe) && (r.recibe as string[]).some((x) => want.has(String(x).toLowerCase())));
  }

  let distances: Map<string, number> | undefined;
  if (q.near) {
    const { lat, lng, radiusKm } = q.near;
    distances = new Map();
    const withDist = rows.map((r) => {
      const d = haversineKm(lat, lng, Number(r.latitude), Number(r.longitude));
      distances!.set(r.id, d);
      return { r, d };
    });
    let filtered = withDist;
    if (radiusKm != null) filtered = withDist.filter((x) => x.d <= radiusKm);
    filtered.sort((a, b) => a.d - b.d);
    rows = filtered.map((x) => x.r);
  }

  const total = rows.length;
  const page = rows.slice(q.offset, q.offset + q.limit);
  return { rows: page, total, distances };
}

const TELEFONO_COLS = {
  id: telefonos.id,
  name: telefonos.name,
  number: telefonos.number,
  description: telefonos.description,
  pais: telefonos.pais,
  ciudad: telefonos.ciudad,
  updatedAt: telefonos.updatedAt,
};

export async function queryTelefonos(p: URLSearchParams): Promise<{ rows: TelefonoRow[]; total: number }> {
  const limit = Math.min(Math.max(Number(p.get('limit')) || 200, 1), 500);
  const offset = Math.max(Number(p.get('offset')) || 0, 0);
  const f: SQL[] = [eq(telefonos.active, true)];
  const ciudad = p.get('ciudad')?.trim();
  const pais = p.get('pais')?.trim();
  if (ciudad) f.push(unaccentIlike(telefonos.ciudad, ciudad));
  if (pais) f.push(unaccentIlike(telefonos.pais, pais));

  const all = (await db.select(TELEFONO_COLS).from(telefonos).where(and(...f)).orderBy(desc(telefonos.createdAt))) as TelefonoRow[];
  return { rows: all.slice(offset, offset + limit), total: all.length };
}
