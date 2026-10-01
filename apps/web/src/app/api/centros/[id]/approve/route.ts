import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { centros } from '@/db/schema';
import { requireRole } from '@/lib/guard';

// Aprobar una sugerencia: la publica en el mapa (active=true). Solo superadmin.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireRole('superadmin');
  if ('response' in g) return g.response;
  
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const [row] = await db.update(centros).set({ active: true, updatedAt: new Date() }).where(eq(centros.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

