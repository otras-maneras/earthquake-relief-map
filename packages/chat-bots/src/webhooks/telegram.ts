import type { Request, Response } from 'express';
import { verifyTelegramSecret } from '../channels/telegram.js';
import { processInboundTelegram, type InboundTelegramMessage } from '../bots/telegram-bot.js';
import { normalizeTelegramUpdate } from '../ingest/normalize.js';
import { persistInboundEvents, shouldRunSearchBot } from '../ingest/persist.js';
import { isMediaInbound } from '../ingest/types.js';

function parseUpdateForBot(body: Record<string, unknown>): InboundTelegramMessage | null {
  const updateId = body.update_id != null ? String(body.update_id) : undefined;
  if (!updateId) return null;

  const cq = body.callback_query as Record<string, unknown> | undefined;
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

  const msg = body.message as Record<string, unknown> | undefined;
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

export async function telegramWebhookPost(req: Request, res: Response): Promise<void> {
  if (!verifyTelegramSecret((name) => req.get(name) ?? undefined)) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const body = req.body as Record<string, unknown> | null;
  if (!body) {
    res.json({ ok: true, handled: 0, ingested: 0 });
    return;
  }

  const normalized = normalizeTelegramUpdate(body);
  const events = normalized ? [normalized] : [];
  const ingest = await persistInboundEvents(events);

  let handled = 0;
  if (normalized && shouldRunSearchBot(events)) {
    const parsed = parseUpdateForBot(body);
    if (parsed && !isMediaInbound(normalized)) {
      ({ handled } = await processInboundTelegram([parsed]));
    }
  }

  res.json({ ok: true, handled, ingested: ingest.ingested, mediaQueued: ingest.mediaQueued });
}
