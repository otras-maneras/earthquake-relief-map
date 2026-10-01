import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { telefonos } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { telefonoSchema } from '@/lib/validation';

const idSchema = z.string().uuid();

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = telefonoSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const d = parsed.data;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (d.name !== undefined) updates.name = d.name;
  if (d.number !== undefined) updates.number = d.number;
  if (d.description !== undefined) updates.description = d.description;
  if (d.pais !== undefined) updates.pais = d.pais;
  if (d.ciudad !== undefined) updates.ciudad = d.ciudad;
  if (d.active !== undefined) updates.active = d.active;

  const [row] = await db.update(telefonos).set(updates).where(eq(telefonos.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  await db.delete(telefonos).where(eq(telefonos.id, id));
  return NextResponse.json({ ok: true });
}
