import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { centros } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { findPossibleDuplicate } from '@/lib/api/duplicates';

// Lista de sugerencias pendientes de revisión (active=false). Solo admin.
// Cada fila incluye `possibleDuplicate` si hay un centro activo cercano y
// parecido, para ayudar al revisor a no publicar puntos repetidos.
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const rows = await db.select().from(centros).where(eq(centros.active, false)).orderBy(desc(centros.createdAt));
  const withDup = await Promise.all(
    rows.map(async (r) => {
      const dup = await findPossibleDuplicate(Number(r.latitude), Number(r.longitude), r.name, r.id);
      return { ...r, possibleDuplicate: dup };
    }),
  );
  return NextResponse.json(withDup);
}
