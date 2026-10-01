import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { centros } from '@/db/schema';
import { requireRole } from '@/lib/guard';
import { centroSchema } from '@/lib/validation';

const idSchema = z.string().uuid();

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireRole('superadmin', 'cargador');
  if ('response' in g) return g.response;

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = centroSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const d = parsed.data;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (d.name !== undefined) updates.name = d.name;
  if (d.address !== undefined) updates.address = d.address;
  if (d.latitude !== undefined) updates.latitude = String(d.latitude);
  if (d.longitude !== undefined) updates.longitude = String(d.longitude);
  if (d.recibe !== undefined) updates.recibe = d.recibe;
  if (d.necesitaAhora !== undefined) updates.necesitaAhora = d.necesitaAhora;
  if (d.horario !== undefined) updates.horario = d.horario;
  if (d.contacto !== undefined) updates.contacto = d.contacto;
  if (d.estado !== undefined) updates.estado = d.estado;
  if (d.tipo !== undefined) updates.tipo = d.tipo;
  if (d.responsable !== undefined) updates.responsable = d.responsable;
  if (d.fuente !== undefined) updates.fuente = d.fuente;
  if (d.pais !== undefined) updates.pais = d.pais;
  if (d.ciudad !== undefined) updates.ciudad = d.ciudad;

  const [row] = await db.update(centros).set(updates).where(eq(centros.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireRole('superadmin');
  if ('response' in g) return g.response;

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  await db.delete(centros).where(eq(centros.id, id));
  return NextResponse.json({ ok: true });
}
