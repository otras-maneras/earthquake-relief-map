import { NextResponse } from 'next/server';
import { db } from '@/db';
import { centros } from '@/db/schema';
import { centroSchema } from '@/lib/validation';
import { blockedFor, hit, clientIp } from '@/lib/ratelimit';

// Submit PÚBLICO (sin auth): cualquiera sugiere un centro/refugio. Queda active=false
// (pendiente) hasta que un admin lo apruebe en el panel.
export async function POST(req: Request) {
  // Anti-spam: máx 8 sugerencias por IP cada 10 min.
  const key = `submit:ip:${clientIp(req)}`;
  if (blockedFor(key) > 0) {
    return NextResponse.json({ error: 'Demasiadas sugerencias seguidas. Probá más tarde.' }, { status: 429 });
  }
  hit(key, 8, 10 * 60 * 1000, 10 * 60 * 1000);

  const body: any = await req.json().catch(() => null);
  // Honeypot anti-bots
  if (body && body.website) return NextResponse.json({ ok: true });

  const parsed = centroSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
  }
  const d = parsed.data;
  await db.insert(centros).values({
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
    fuente: d.fuente ?? 'Sugerencia de la comunidad',
    pais: d.pais ?? null,
    ciudad: d.ciudad ?? null,
    active: false,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
