import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { centros, centroSugerencias } from '@/db/schema';
import { requireAuth } from '@/lib/guard';

// Lista de sugerencias de complemento pendientes (status='pending'), cada una con
// el centro de origen (valores actuales) para mostrar actual vs propuesto. Solo admin.
export async function GET() {
  const g = await requireAuth();
  if ('response' in g) return g.response;

  const rows = await db
    .select({ s: centroSugerencias, centro: centros })
    .from(centroSugerencias)
    .innerJoin(centros, eq(centroSugerencias.centroId, centros.id))
    .where(eq(centroSugerencias.status, 'pending'))
    .orderBy(desc(centroSugerencias.createdAt));

  return NextResponse.json(rows);
}
