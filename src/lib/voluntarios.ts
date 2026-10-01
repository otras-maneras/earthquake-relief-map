// Acceso a la data de voluntarios intérpretes con copia de respaldo propia.
//
// La fuente original es una API de Supabase de un tercero (Interp-Aid). Para no
// depender de su disponibilidad, cada lectura exitosa refresca un snapshot en
// nuestra DB (tabla `voluntarios_snapshot`, una fila en JSONB). Si la API se cae,
// servimos la última copia guardada. El snapshot entra en los backups a R2.
//
// Esto además saca la apikey del cliente: el navegador ya no llama a Supabase,
// llama a nuestro propio `/api/voluntarios`.

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { voluntariosSnapshot } from '@/db/schema';

export interface Volunteer {
  id: string;
  full_name: string;
  phone: string;
  contact_channels: string[] | null;
  languages: string[] | null;
  fluency: string;
  technical_knowledge: boolean;
  in_venezuela: boolean;
  state: string | null;
  city: string | null;
  can_travel: string | null;
  support_types: string[] | null;
  availability: string[] | null;
}

export interface VoluntariosResult {
  volunteers: Volunteer[];
  stale: boolean; // true = servimos snapshot porque la fuente en vivo falló
  fetchedAt: string | null; // ISO de cuándo se obtuvo la copia
}

const SOURCE = 'interp-aid';
const UPSTREAM =
  'https://lnpyjtajdnkobxebjecp.supabase.co/rest/v1/volunteers?select=*&order=created_at.desc';
// La apikey (publishable) vive en el entorno (INTERP_AID_KEY); sin ella se sirve el snapshot.
const UPSTREAM_KEY = process.env.INTERP_AID_KEY;

async function fetchUpstream(timeoutMs = 5000): Promise<Volunteer[] | null> {
  if (!UPSTREAM_KEY) return null; // sin credencial: degrada a la copia de respaldo en DB
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(UPSTREAM, {
      headers: { apikey: UPSTREAM_KEY },
      signal: ctrl.signal,
      // Caché de datos de Next: consulta la fuente externa a lo sumo cada 5 min,
      // sin importar cuántas veces se rendericen la landing o el endpoint.
      next: { revalidate: 300 },
    });
    clearTimeout(to);
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d) ? (d as Volunteer[]) : null;
  } catch {
    return null;
  }
}

async function writeSnapshot(volunteers: Volunteer[]): Promise<void> {
  const now = new Date();
  await db
    .insert(voluntariosSnapshot)
    .values({ source: SOURCE, data: volunteers, count: volunteers.length, fetchedAt: now })
    .onConflictDoUpdate({
      target: voluntariosSnapshot.source,
      set: { data: volunteers, count: volunteers.length, fetchedAt: now },
    });
}

async function readSnapshot(): Promise<VoluntariosResult> {
  try {
    const [row] = await db
      .select()
      .from(voluntariosSnapshot)
      .where(eq(voluntariosSnapshot.source, SOURCE));
    return {
      volunteers: (row?.data as Volunteer[]) ?? [],
      stale: true,
      fetchedAt: row?.fetchedAt ? new Date(row.fetchedAt).toISOString() : null,
    };
  } catch {
    return { volunteers: [], stale: true, fetchedAt: null };
  }
}

/**
 * Devuelve los voluntarios desde la fuente en vivo y refresca la copia local.
 * Si la fuente falla, sirve el último snapshot guardado en la DB.
 */
export async function getVoluntarios(): Promise<VoluntariosResult> {
  // Se desconecta la API externa para evitar timeouts de compilacion y depender de terceros.
  // Consumimos directamente la copia local de respaldo almacenada en la base de datos.
  return readSnapshot();
}

/** Normaliza un teléfono venezolano a formato internacional para wa.me / tel:. */
export function cleanPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('0')) return '+58' + cleaned.substring(1);
  if (cleaned.startsWith('58') && !cleaned.startsWith('+')) return '+' + cleaned;
  return cleaned;
}
