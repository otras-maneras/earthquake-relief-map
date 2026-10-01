import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { contactLists, contacts } from '@/db/schema';
import { requireRole } from '@/lib/guard';
import { buildSeedContacts, type SeedSource } from '@/lib/contact-seed';

interface Ctx { params: Promise<{ id: string }> }

// POST { source: 'centros'|'voluntarios'|'telefonos' }: vuelca contactos de nuestra
// propia base (con nombre, dirección, notas, etc.) a la lista. Para coordinar con
// cada sector sin cargar a mano.
export async function POST(req: Request, { params }: Ctx) {
  const g = await requireRole('superadmin');
  if ('response' in g) return g.response;
  const s = g.session;
  const { id } = await params;

  const [list] = await db.select({ id: contactLists.id }).from(contactLists).where(eq(contactLists.id, id));
  if (!list) return NextResponse.json({ error: 'No existe la lista' }, { status: 404 });

  const source = (await req.json().catch(() => null))?.source as SeedSource;
  if (!['centros', 'voluntarios', 'telefonos'].includes(source)) {
    return NextResponse.json({ error: 'Fuente inválida' }, { status: 400 });
  }

  const { contacts: seed, found, skippedNoPhone } = await buildSeedContacts(source);
  if (seed.length === 0) return NextResponse.json({ added: 0, found, skippedNoPhone });

  const rows = seed.map((c) => ({ ...c, listId: id }));
  // El índice único (list_id, phone) descarta duplicados ya existentes.
  const inserted = await db.insert(contacts).values(rows).onConflictDoNothing().returning({ id: contacts.id });
  return NextResponse.json({ added: inserted.length, found, skippedNoPhone, skippedDup: rows.length - inserted.length });
}
