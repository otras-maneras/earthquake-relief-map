import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { processInboundTelegram, type InboundTelegramMessage } from '@/lib/telegram-bot';

// Webhook de Telegram. Solo mensajes entrantes (Telegram no reenvía estados de
// entrega como Meta). Servido por hook.acopiove.org (subdominio DNS-only, sin
// proxy de Cloudflare) — el mismo que usa el webhook de Kapso, porque Telegram
// también pega desde IPs fijas de datacenter que Bot Fight Mode puede bloquear.
//
// Verificación: Telegram manda el secret_token configurado en setWebhook como
// header X-Telegram-Bot-Api-Secret-Token (comparación exacta, no HMAC). Fail-closed
// si hay secret configurado.

function secretOk(req: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true; // sin secret configurado (dev): no exigimos
  const header = req.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Extrae el mensaje entrante de un Update de Telegram y lo normaliza.
function parseUpdate(update: Record<string, unknown>): InboundTelegramMessage | null {
  const updateId = update.update_id != null ? String(update.update_id) : undefined;
  if (!updateId) return null;

  const cq = update.callback_query as Record<string, unknown> | undefined;
  if (cq) {
    const msg = cq.message as Record<string, unknown> | undefined;
    const chat = msg?.chat as Record<string, unknown> | undefined;
    const chatId = chat?.id != null ? String(chat.id) : undefined;
    if (!chatId) return null;
    return {
      id: updateId,
      chatId,
      type: 'callback',
      replyId: typeof cq.data === 'string' ? cq.data : undefined,
      callbackQueryId: cq.id != null ? String(cq.id) : undefined,
    };
  }

  const msg = update.message as Record<string, unknown> | undefined;
  if (msg) {
    const chat = msg.chat as Record<string, unknown> | undefined;
    const chatId = chat?.id != null ? String(chat.id) : undefined;
    if (!chatId) return null;
    const loc = msg.location as { latitude?: number; longitude?: number } | undefined;
    if (loc?.latitude != null) {
      return { id: updateId, chatId, type: 'location', location: { lat: loc.latitude, lng: Number(loc.longitude) } };
    }
    if (typeof msg.text === 'string') {
      return { id: updateId, chatId, type: 'text', text: msg.text };
    }
    return { id: updateId, chatId, type: 'other' };
  }

  return null;
}

export async function POST(req: Request) {
  if (!secretOk(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  if (!body) return NextResponse.json({ ok: true, handled: 0 });

  const parsed = parseUpdate(body);
  const handled = parsed ? (await processInboundTelegram([parsed])).handled : 0;

  return NextResponse.json({ ok: true, handled });
}
