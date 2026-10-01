import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { centros, centroSugerencias } from '@/db/schema';
import { sugerenciaSchema, SUGERENCIA_FIELDS } from '@/lib/validation';
import { blockedFor, hit, clientIp } from '@/lib/ratelimit';

const idSchema = z.string().uuid();

// Submit PÚBLICO (sin auth): cualquiera sugiere complementar/corregir un punto YA
// publicado. Queda como `pending` en centro_sugerencias hasta que un admin la
// revise y la fusione (o descarte) en el panel.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  // Anti-spam: máx 10 sugerencias por IP cada 10 min (igual que el alta pública).
  const key = `sugerir:ip:${clientIp(req)}`;
  if (blockedFor(key) > 0) {
    return NextResponse.json({ error: 'Demasiadas sugerencias seguidas. Probá más tarde.' }, { status: 429 });
  }
  hit(key, 10, 10 * 60 * 1000, 10 * 60 * 1000);

  const body: any = await req.json().catch(() => null);
  // Honeypot anti-bots: respondemos OK falso sin guardar nada.
  if (body && body.website) return NextResponse.json({ ok: true }, { status: 201 });

  const parsed = sugerenciaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
  }
  const d = parsed.data as Record<string, unknown>;

  // El punto debe existir y estar publicado.
  const [centro] = await db.select({ id: centros.id }).from(centros).where(eq(centros.id, id));
  if (!centro) return NextResponse.json({ error: 'Punto no encontrado' }, { status: 404 });

  // Quedarse solo con los campos propuestos no vacíos.
  const payload: Record<string, unknown> = {};
  for (const f of SUGERENCIA_FIELDS) {
    const v = d[f];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) payload[f] = t;
    } else if (Array.isArray(v)) {
      if (v.length) payload[f] = v;
    } else {
      payload[f] = v;
    }
  }

  const mensaje = typeof d.mensaje === 'string' ? d.mensaje.trim() : '';
  if (Object.keys(payload).length === 0 && !mensaje) {
    return NextResponse.json({ error: 'Agregá al menos un dato o un mensaje.' }, { status: 400 });
  }

  await db.insert(centroSugerencias).values({
    centroId: id,
    payload,
    mensaje: mensaje || null,
    contactoReporta: typeof d.contactoReporta === 'string' ? d.contactoReporta.trim() || null : null,
    fuente: typeof d.fuente === 'string' ? d.fuente.trim() || null : null,
    status: 'pending',
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
