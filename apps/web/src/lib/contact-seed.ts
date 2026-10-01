// Construye contactos estructurados a partir de la data que ya tenemos
// (centros de acopio, voluntarios intérpretes, teléfonos). Fuente única usada
// por la ruta de siembra del panel y por el script de carga inicial.

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { centros, telefonos, voluntariosSnapshot } from '@/db/schema';
import { normalizePhone } from '@/lib/kapso';
import type { Volunteer } from '@/lib/voluntarios';

export type SeedSource = 'centros' | 'voluntarios' | 'telefonos';

export interface SeedContact {
  phone: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  address: string | null;
  organization: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  source: SeedSource;
}

function splitName(full: string | null | undefined): { firstName: string | null; lastName: string | null } {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function joinNotes(parts: (string | null | undefined)[]): string | null {
  const s = parts.filter((p) => p && p.toString().trim()).join(' · ');
  return s || null;
}

async function fromCentros(): Promise<SeedContact[]> {
  const rows = await db.select().from(centros).where(eq(centros.active, true));
  return rows.map((c) => {
    const recibe = Array.isArray(c.recibe) ? (c.recibe as string[]).join(', ') : '';
    const { firstName, lastName } = splitName(c.responsable);
    return {
      phone: normalizePhone(c.contacto),
      name: c.responsable || c.name,
      firstName,
      lastName,
      email: null,
      address: c.address || null,
      organization: c.name,
      city: c.ciudad || null,
      country: c.pais || null,
      notes: joinNotes([
        c.tipo ? `Tipo: ${c.tipo}` : null,
        recibe ? `Recibe: ${recibe}` : null,
        c.horario ? `Horario: ${c.horario}` : null,
        c.estado ? `Estado: ${c.estado}` : null,
        c.necesitaAhora ? `Necesita: ${c.necesitaAhora}` : null,
        c.fuente ? `Fuente: ${c.fuente}` : null,
      ]),
      source: 'centros' as const,
    };
  });
}

async function fromVoluntarios(): Promise<SeedContact[]> {
  const [snap] = await db.select().from(voluntariosSnapshot).where(eq(voluntariosSnapshot.source, 'interp-aid'));
  const vols = (snap?.data as Volunteer[]) || [];
  return vols.map((v) => {
    const { firstName, lastName } = splitName(v.full_name);
    const langs = (v.languages || []).join(', ');
    const support = (v.support_types || []).join(', ');
    const avail = (v.availability || []).join(', ');
    return {
      phone: normalizePhone(v.phone),
      name: v.full_name,
      firstName,
      lastName,
      email: null,
      address: null,
      organization: null,
      city: v.city || null,
      country: v.in_venezuela ? 'Venezuela' : null,
      notes: joinNotes([
        langs ? `Idiomas: ${langs}` : null,
        v.fluency ? `Fluidez: ${v.fluency}` : null,
        support ? `Apoyo: ${support}` : null,
        avail ? `Disponibilidad: ${avail}` : null,
        v.state ? `Estado: ${v.state}` : null,
        v.technical_knowledge ? 'Conocimiento técnico' : null,
      ]),
      source: 'voluntarios' as const,
    };
  });
}

async function fromTelefonos(): Promise<SeedContact[]> {
  const rows = await db.select().from(telefonos).where(eq(telefonos.active, true));
  return rows.map((t) => ({
    phone: normalizePhone(t.number),
    name: t.name,
    firstName: null,
    lastName: null,
    email: null,
    address: null,
    organization: t.name,
    city: t.ciudad || null,
    country: t.pais || null,
    notes: t.description || null,
    source: 'telefonos' as const,
  }));
}

/** Devuelve contactos enviables (teléfono válido) y deduplicados por teléfono. */
export async function buildSeedContacts(source: SeedSource): Promise<{ contacts: SeedContact[]; found: number; skippedNoPhone: number }> {
  let all: SeedContact[];
  if (source === 'centros') all = await fromCentros();
  else if (source === 'voluntarios') all = await fromVoluntarios();
  else all = await fromTelefonos();

  const found = all.length;
  const seen = new Set<string>();
  const contacts: SeedContact[] = [];
  let skippedNoPhone = 0;
  for (const c of all) {
    if (c.phone.length < 8) { skippedNoPhone++; continue; }
    if (seen.has(c.phone)) continue;
    seen.add(c.phone);
    contacts.push(c);
  }
  return { contacts, found, skippedNoPhone };
}
