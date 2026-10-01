import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db';
import { contactLists, contacts } from '@/db/schema';
import { requireRole } from '@/lib/guard';

interface Ctx { params: Promise<{ id: string }> }

// GET: detalle de la lista + sus contactos.
export async function GET(_req: Request, { params }: Ctx) {
  const g = await requireRole('superadmin');
  if ('response' in g) return g.response;
  const s = g.session;
  const { id } = await params;

  const [list] = await db.select().from(contactLists).where(eq(contactLists.id, id));
  if (!list) return NextResponse.json({ error: 'No existe' }, { status: 404 });

  const items = await db.select().from(contacts).where(eq(contacts.listId, id)).orderBy(asc(contacts.name));
  return NextResponse.json({ ...list, contacts: items });
}

// PATCH: renombrar.
export async function PATCH(req: Request, { params }: Ctx) {
  const g = await requireRole('superadmin');
  if ('response' in g) return g.response;
  const s = g.session;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const name = (body?.name || '').toString().trim();
  if (!name) return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 });

  const [row] = await db.update(contactLists).set({ name: name.slice(0, 160) }).where(eq(contactLists.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  return NextResponse.json(row);
}

// DELETE: borrar lista (y sus contactos en cascada).
export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await requireRole('superadmin');
  if ('response' in g) return g.response;
  const s = g.session;
  const { id } = await params;
  await db.delete(contactLists).where(eq(contactLists.id, id));
  return NextResponse.json({ ok: true });
}
