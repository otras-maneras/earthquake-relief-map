import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { centros, centroSugerencias } from '@/db/schema';
import { requireRole } from '@/lib/guard';
import { sugerenciaSchema, SUGERENCIA_FIELDS } from '@/lib/validation';

const idSchema = z.string().uuid();

// POST = APLICAR la sugerencia: fusiona los campos propuestos al centro de origen y
// la marca como `applied`. El admin puede mandar `fields` con los valores finales
// (los editó en el panel); si no, se usa el payload guardado. `recibe` se une con
// lo que el centro ya recibe. Solo superadmin/cargador (igual que editar un centro).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireRole('superadmin', 'cargador');
  if ('response' in g) return g.response;

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const [sug] = await db.select().from(centroSugerencias).where(eq(centroSugerencias.id, id));
  if (!sug) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  if (sug.status !== 'pending') return NextResponse.json({ error: 'Ya fue resuelta' }, { status: 409 });

  const body = await req.json().catch(() => null);
  // Fuente de los valores a aplicar: lo que confirmó el admin, o el payload original.
  const raw = body && typeof body === 'object' && body.fields ? body.fields : sug.payload;
  const parsed = sugerenciaSchema.partial().safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const d = parsed.data as Record<string, unknown>;

  const [centro] = await db.select().from(centros).where(eq(centros.id, sug.centroId));
  if (!centro) return NextResponse.json({ error: 'El punto ya no existe' }, { status: 404 });

  const updates: Record<string, unknown> = {};
  for (const f of SUGERENCIA_FIELDS) {
    const v = d[f];
    if (v === undefined || v === null) continue;
    if (f === 'recibe') {
      const arr = Array.isArray(v) ? (v as string[]) : [];
      if (!arr.length) continue;
      // Unir con lo existente, sin duplicados (complementar, no borrar).
      const existing = Array.isArray(centro.recibe) ? (centro.recibe as string[]) : [];
      updates.recibe = Array.from(new Set([...existing, ...arr]));
    } else if (typeof v === 'string') {
      const t = v.trim();
      if (t) updates[f] = t;
    } else {
      updates[f] = v;
    }
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date();
    await db.update(centros).set(updates).where(eq(centros.id, sug.centroId));
  }

  await db
    .update(centroSugerencias)
    .set({ status: 'applied', resolvedAt: new Date(), resolvedBy: g.session.id })
    .where(eq(centroSugerencias.id, id));

  return NextResponse.json({ ok: true, applied: Object.keys(updates).filter((k) => k !== 'updatedAt') });
}

// DELETE = DESCARTAR la sugerencia (no toca el centro). Solo superadmin/cargador.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireRole('superadmin', 'cargador');
  if ('response' in g) return g.response;

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const [row] = await db
    .update(centroSugerencias)
    .set({ status: 'rejected', resolvedAt: new Date(), resolvedBy: g.session.id })
    .where(eq(centroSugerencias.id, id))
    .returning({ id: centroSugerencias.id });
  if (!row) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
