import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { telefonos } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { telefonoSchema } from '@/lib/validation';
import { blockedFor, hit, clientIp } from '@/lib/ratelimit';

// GET público: teléfonos activos. Rate-limit anti-scraping/hammering.
export async function GET(req: Request) {
  const key = `get-telefonos:${clientIp(req)}`;
  if (blockedFor(key) > 0) return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 });
  hit(key, 60, 60_000, 5 * 60_000);

  const rows = await db
    .select({
      id: telefonos.id,
      name: telefonos.name,
      number: telefonos.number,
      description: telefonos.description,
      pais: telefonos.pais,
      ciudad: telefonos.ciudad,
    })
    .from(telefonos)
    .where(eq(telefonos.active, true))
    .orderBy(desc(telefonos.createdAt));
  // Caché en CDN/Cloudflare (ver nota en /api/centros): descarga el origen en picos.
  return NextResponse.json(rows, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}

// POST autenticado: crear teléfono.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = telefonoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
  }
  const d = parsed.data;
  const [row] = await db
    .insert(telefonos)
    .values({
      name: d.name,
      number: d.number,
      description: d.description ?? null,
      pais: d.pais ?? null,
      ciudad: d.ciudad ?? null,
      active: d.active ?? true,
      createdBy: s.id,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
