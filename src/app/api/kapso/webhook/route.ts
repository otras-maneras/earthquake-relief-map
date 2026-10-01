import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { broadcastRecipients } from '@/db/schema';
import { processInbound, type InboundMessage } from '@/lib/wa-bot';

// Webhook de Kapso/Meta. Hace dos cosas:
//  1) Estados de entrega salientes (delivered/read/failed) → actualiza broadcastRecipients.
//  2) Mensajes ENTRANTES de usuarios → bot de búsqueda de centros/refugios (wa-bot).
// Registro de la URL: apuntar a https://acopiove.org/api/kapso/webhook desde Kapso
// y suscribir el campo "messages" para recibir los entrantes.
//
// Verificación opcional con KAPSO_WEBHOOK_SECRET (?secret= o header X-Webhook-Secret).

// Verificación de webhook estilo Meta (hub.challenge), por si se registra directo.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const secret = process.env.KAPSO_WEBHOOK_SECRET;
  if (mode === 'subscribe' && (!secret || token === secret) && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('forbidden', { status: 403 });
}

// Extrae los mensajes entrantes (formato Meta y envelope Kapso v2) y los normaliza.
function parseInbound(body: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const push = (raw: Record<string, unknown> | null | undefined) => {
    if (!raw || !raw.from || !raw.id) return;
    const type = String(raw.type ?? '');
    const inter = raw.interactive as Record<string, Record<string, unknown>> | undefined;
    const replyId =
      (inter?.button_reply?.id as string) || (inter?.list_reply?.id as string) || undefined;
    const loc = raw.location as { latitude?: number; longitude?: number } | undefined;
    out.push({
      id: String(raw.id),
      from: String(raw.from),
      type: type === 'text' || type === 'location' || type === 'interactive' ? type : 'other',
      text: (raw.text as { body?: string } | undefined)?.body,
      location: loc?.latitude != null ? { lat: Number(loc.latitude), lng: Number(loc.longitude) } : undefined,
      replyId,
    });
  };

  const b = body as Record<string, unknown>;
  // Formato Meta: entry[].changes[].value.messages[]
  for (const e of (b?.entry as Record<string, unknown>[]) || []) {
    for (const ch of (e?.changes as Record<string, unknown>[]) || []) {
      const value = ch?.value as Record<string, unknown> | undefined;
      for (const msg of (value?.messages as Record<string, unknown>[]) || []) push(msg);
    }
  }
  // Envelope Kapso v2: data.message (mensaje entrante suelto)
  const data = b?.data as Record<string, unknown> | undefined;
  if (data?.message && (data.message as Record<string, unknown>).from) {
    push(data.message as Record<string, unknown>);
  }
  return out;
}

// Verifica la firma HMAC-SHA256 que Kapso envía en X-Webhook-Signature (hex, con o
// sin prefijo "sha256="). El endpoint está expuesto vía subdominio DNS-only (gris en
// Cloudflare, sin su bot-mitigation), así que la autenticidad la garantiza esta firma.
// Política fail-closed: si hay secret configurado, exigimos firma válida (403 si no).
function signatureOk(rawBody: string, req: Request): boolean {
  const secret = process.env.KAPSO_WEBHOOK_SECRET;
  if (!secret) return true; // sin secret configurado (dev): no exigimos firma
  const header =
    req.headers.get('x-webhook-signature') || req.headers.get('x-hub-signature-256') || '';
  if (!header) return false; // sin firma → rechazado
  const got = header.replace(/^sha256=/i, '').trim();
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  if (got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!signatureOk(raw, req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  // Junta estados de mensajes en ambos formatos posibles (Meta crudo o envelope Kapso v2).
  const statuses: { id?: string; status?: string }[] = [];

  // Formato Meta: entry[].changes[].value.statuses[]
  const entries = body?.entry || [];
  for (const e of entries) {
    for (const ch of e?.changes || []) {
      for (const st of ch?.value?.statuses || []) statuses.push({ id: st.id, status: st.status });
    }
  }
  // Formato Kapso v2: data.message.id + data.status (o data.statuses)
  if (body?.data?.message?.id && body?.data?.status) {
    statuses.push({ id: body.data.message.id, status: body.data.status });
  }

  let updated = 0;
  for (const st of statuses) {
    if (!st.id || !st.status) continue;
    const status = ['delivered', 'read', 'failed', 'sent'].includes(st.status) ? st.status : null;
    if (!status) continue;
    const res = await db
      .update(broadcastRecipients)
      .set({ status, updatedAt: new Date() })
      .where(eq(broadcastRecipients.waMessageId, st.id))
      .returning({ id: broadcastRecipients.id });
    updated += res.length;
  }

  // 2) Mensajes entrantes de usuarios → bot de búsqueda de centros/refugios.
  let handled = 0;
  const inbound = parseInbound(body);
  if (inbound.length > 0) {
    ({ handled } = await processInbound(inbound));
  }

  return NextResponse.json({ ok: true, updated, handled });
}
