import { NextResponse } from 'next/server';
import { getVoluntarios } from '@/lib/voluntarios';
import { blockedFor, hit, clientIp } from '@/lib/ratelimit';

// Proxy propio sobre la fuente externa de voluntarios intérpretes (Interp-Aid).
// Cachea en CDN y sirve la copia de respaldo de la DB si la fuente se cae.
// Depende de upstream + DB, así que no se prerenderiza.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const key = `get-voluntarios:${clientIp(req)}`;
  if (blockedFor(key) > 0) {
    return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 });
  }
  hit(key, 60, 60_000, 5 * 60_000); // 60/min por IP → bloqueo 5 min

  const { volunteers, stale, fetchedAt } = await getVoluntarios();

  // Caché en CDN: la fuente externa se consulta a lo sumo cada ~5 min.
  return NextResponse.json(
    { volunteers, stale, fetchedAt, count: volunteers.length },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  );
}
