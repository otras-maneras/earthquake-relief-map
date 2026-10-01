import { NextResponse } from 'next/server';
import { sql, eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { contactLists, contacts } from '@/db/schema';
import { requireRole } from '@/lib/guard';

// GET: listas con su conteo de contactos.
export async function GET() {
  const g = await requireRole('superadmin');
  if ('response' in g) return g.response;
  const s = g.session;

  const lists = await db.select().from(contactLists).orderBy(desc(contactLists.createdAt));
  const counts = await db
    .select({ listId: contacts.listId, count: sql<number>`count(*)::int` })
    .from(contacts)
    .groupBy(contacts.listId);
  const countMap = new Map(counts.map((c) => [c.listId, c.count]));

  return NextResponse.json(
    lists.map((l) => ({ ...l, count: countMap.get(l.id) ?? 0 }))
  );
}

// POST: crear lista.
export async function POST(req: Request) {
  const g = await requireRole('superadmin');
  if ('response' in g) return g.response;
  const s = g.session;

  const body = await req.json().catch(() => null);
  const name = (body?.name || '').toString().trim();
  if (!name) return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 });

  const [row] = await db
    .insert(contactLists)
    .values({ name: name.slice(0, 160), description: body?.description?.toString().slice(0, 1000) || null, createdBy: s.id })
    .returning();
  return NextResponse.json({ ...row, count: 0 }, { status: 201 });
}
