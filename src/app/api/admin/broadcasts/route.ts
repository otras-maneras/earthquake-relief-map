import { NextResponse } from 'next/server';
import { inArray, desc } from 'drizzle-orm';
import { db } from '@/db';
import { broadcasts, broadcastRecipients, contacts } from '@/db/schema';
import { requireRole } from '@/lib/guard';
import { kapsoConfig, listTemplates, normalizePhone } from '@/lib/kapso';
import { startDrainer } from '@/lib/broadcast-worker';

// GET: historial de campañas con su progreso.
export async function GET() {
  const g = await requireRole('superadmin');
  if ('response' in g) return g.response;
  const s = g.session;
  // Retoma cualquier campaña que haya quedado a medias tras un reinicio.
  startDrainer();
  const rows = await db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).limit(100);
  return NextResponse.json(rows);
}

// POST: crea una campaña y la encola. Valida que la plantilla esté APROBADA.
export async function POST(req: Request) {
  const g = await requireRole('superadmin');
  if ('response' in g) return g.response;
  const s = g.session;

  const cfg = kapsoConfig();
  if (!cfg) return NextResponse.json({ error: 'Kapso no configurado' }, { status: 503 });

  const b = await req.json().catch(() => null);
  const name = (b?.name || '').toString().trim();
  const templateName = (b?.templateName || '').toString().trim();
  const templateLang = (b?.templateLang || 'es').toString();
  const listIds: string[] = Array.isArray(b?.listIds) ? b.listIds : [];
  const manualText = (b?.manualText || '').toString();
  const defaultVars: string[] = Array.isArray(b?.defaultVars) ? b.defaultVars.map((x: unknown) => String(x)) : [];

  if (!name || !templateName) {
    return NextResponse.json({ error: 'Falta el nombre de la campaña o la plantilla' }, { status: 400 });
  }

  // Validar que la plantilla exista y esté aprobada.
  const tpl = await listTemplates(cfg);
  if (!tpl.ok) return NextResponse.json({ error: 'No se pudo verificar la plantilla' }, { status: 502 });
  const match = (tpl.data?.data || []).find((t) => t.name === templateName && t.language === templateLang);
  if (!match) return NextResponse.json({ error: 'La plantilla no existe en ese idioma' }, { status: 400 });
  if (match.status !== 'APPROVED') {
    return NextResponse.json({ error: `La plantilla está en estado ${match.status}, no APPROVED` }, { status: 400 });
  }

  // Reunir destinatarios: de las listas + manuales, deduplicados por teléfono.
  const recipients = new Map<string, { phone: string; name: string | null }>();

  if (listIds.length > 0) {
    const rows = await db.select({ phone: contacts.phone, name: contacts.name }).from(contacts).where(inArray(contacts.listId, listIds));
    for (const r of rows) if (r.phone) recipients.set(r.phone, { phone: r.phone, name: r.name });
  }
  for (const line of manualText.split('\n')) {
    const [rawPhone, ...rest] = line.split(',');
    const phone = normalizePhone(rawPhone);
    if (phone.length >= 8) recipients.set(phone, { phone, name: rest.join(',').trim() || null });
  }

  const list = [...recipients.values()];
  if (list.length === 0) return NextResponse.json({ error: 'No hay destinatarios válidos' }, { status: 400 });

  // Resuelve variables por contacto: el token {nombre} se reemplaza por el nombre.
  const resolveVars = (contactName: string | null) =>
    defaultVars.map((v) => v.replace(/\{nombre\}/gi, contactName || '').trim());

  const [bcast] = await db
    .insert(broadcasts)
    .values({
      name: name.slice(0, 200),
      templateName,
      templateLang,
      defaultVars,
      status: 'sending',
      totalCount: list.length,
      createdBy: s.id,
    })
    .returning();

  // Inserta destinatarios en lotes para no exceder límites de parámetros.
  const CHUNK = 500;
  for (let i = 0; i < list.length; i += CHUNK) {
    const slice = list.slice(i, i + CHUNK).map((r) => ({
      broadcastId: bcast.id,
      phone: r.phone,
      name: r.name,
      vars: resolveVars(r.name),
    }));
    await db.insert(broadcastRecipients).values(slice);
  }

  startDrainer();
  return NextResponse.json({ ...bcast, queued: list.length }, { status: 201 });
}
