import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { centros } from '@/db/schema';
import { blockedFor, hit, clientIp } from '@/lib/ratelimit';

const idSchema = z.string().uuid();

// Confirmación PÚBLICA de un toque: "este punto sigue vigente/abierto".
// No cambia datos del centro (no cierra ni edita): solo sella `last_confirmed_at`
// y suma al conteo, para mostrar frescura en el mapa. Reportar CIERRE o CAMBIOS va
// por el flujo de sugerencias (revisión en el panel), no por acá.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  // Anti-abuso: máx 40 confirmaciones por IP cada 10 min (es acción de bajo riesgo).
  const key = `confirmar:ip:${clientIp(req)}`;
  if (blockedFor(key) > 0) {
    return NextResponse.json({ error: 'Demasiadas confirmaciones seguidas. Probá más tarde.' }, { status: 429 });
  }
  hit(key, 40, 10 * 60 * 1000, 10 * 60 * 1000);

  const [row] = await db
    .update(centros)
    .set({ lastConfirmedAt: new Date(), confirmaciones: sql`${centros.confirmaciones} + 1` })
    .where(eq(centros.id, id))
    .returning({ id: centros.id, lastConfirmedAt: centros.lastConfirmedAt, confirmaciones: centros.confirmaciones });

  if (!row) return NextResponse.json({ error: 'Punto no encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true, lastConfirmedAt: row.lastConfirmedAt, confirmaciones: row.confirmaciones }, { status: 200 });
}
