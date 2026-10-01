import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { centros } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { centroSchema } from '@/lib/validation';
import { blockedFor, hit, clientIp } from '@/lib/ratelimit';

// GET público: centros activos para el mapa/lista. Rate-limit anti-scraping/hammering.
export async function GET(req: Request) {
  const key = `get-centros:${clientIp(req)}`;
  if (blockedFor(key) > 0) return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 });
  hit(key, 60, 60_000, 5 * 60_000); // 60/min por IP → bloqueo 5 min

  const rows = await db
    .select({
      id: centros.id,
      name: centros.name,
      address: centros.address,
      latitude: centros.latitude,
      longitude: centros.longitude,
      recibe: centros.recibe,
      necesitaAhora: centros.necesitaAhora,
      horario: centros.horario,
      contacto: centros.contacto,
      estado: centros.estado,
      tipo: centros.tipo,
      responsable: centros.responsable,
      fuente: centros.fuente,
      pais: centros.pais,
      ciudad: centros.ciudad,
      updatedAt: centros.updatedAt,
      lastConfirmedAt: centros.lastConfirmedAt,
      confirmaciones: centros.confirmaciones,
    })
    .from(centros)
    .where(eq(centros.active, true))
    .orderBy(desc(centros.createdAt));
  // Caché en CDN/Cloudflare: sirve la copia ~60s sin tocar la DB y refresca en
  // background otros 5 min (la data cambia poco; protege el origen ante picos).
  return NextResponse.json(rows, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}

// POST autenticado: crear centro.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = centroSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
  }
  const d = parsed.data;
  const [row] = await db
    .insert(centros)
    .values({
      name: d.name,
      address: d.address ?? null,
      latitude: String(d.latitude),
      longitude: String(d.longitude),
      recibe: d.recibe,
      necesitaAhora: d.necesitaAhora ?? null,
      horario: d.horario ?? null,
      contacto: d.contacto ?? null,
      estado: d.estado,
      tipo: d.tipo,
      responsable: d.responsable ?? null,
      fuente: d.fuente ?? null,
      pais: d.pais ?? null,
      ciudad: d.ciudad ?? null,
      createdBy: s.id,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
