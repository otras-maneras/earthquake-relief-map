import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { contactLists, contacts } from '@/db/schema';
import { requireRole } from '@/lib/guard';
import { normalizePhone } from '@/lib/kapso';

interface Ctx { params: Promise<{ id: string }> }

// POST: agregar contactos en bloque. Acepta { items:[{phone,name}] } o { text:"phone, nombre\n..." }.
export async function POST(req: Request, { params }: Ctx) {
  const g = await requireRole('superadmin');
  if ('response' in g) return g.response;
  const s = g.session;
  const { id } = await params;

  const [list] = await db.select({ id: contactLists.id }).from(contactLists).where(eq(contactLists.id, id));
  if (!list) return NextResponse.json({ error: 'No existe la lista' }, { status: 404 });

  const body = await req.json().catch(() => null);
  let raw: { phone: string; name?: string }[] = [];
  if (Array.isArray(body?.items)) {
    raw = body.items;
  } else if (typeof body?.text === 'string') {
    raw = body.text.split('\n').map((line: string) => {
      const [phone, ...rest] = line.split(',');
      return { phone: phone || '', name: rest.join(',').trim() };
    });
  }

  const source = (body?.source || 'manual').toString().slice(0, 40);
  const seen = new Set<string>();
  const rows = raw
    .map((r) => ({ phone: normalizePhone(r.phone), name: (r.name || '').toString().trim().slice(0, 200) || null }))
    .filter((r) => r.phone.length >= 8 && !seen.has(r.phone) && seen.add(r.phone))
    .map((r) => ({ listId: id, phone: r.phone, name: r.name, source }));

  if (rows.length === 0) return NextResponse.json({ added: 0, skipped: raw.length });

  // El índice único (list_id, phone) descarta duplicados ya existentes.
  const inserted = await db.insert(contacts).values(rows).onConflictDoNothing().returning({ id: contacts.id });
  return NextResponse.json({ added: inserted.length, skipped: raw.length - inserted.length });
}

// DELETE ?contactId=...: quitar un contacto de la lista.
export async function DELETE(req: Request, { params }: Ctx) {
  const g = await requireRole('superadmin');
  if ('response' in g) return g.response;
  const s = g.session;
  const { id } = await params;
  const contactId = new URL(req.url).searchParams.get('contactId');
  if (!contactId) return NextResponse.json({ error: 'Falta contactId' }, { status: 400 });
  await db.delete(contacts).where(eq(contacts.id, contactId));
  return NextResponse.json({ ok: true });
}
