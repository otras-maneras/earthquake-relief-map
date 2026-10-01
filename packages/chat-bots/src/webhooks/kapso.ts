import type { Request, Response } from 'express';
import { verifyKapsoSignature } from '../channels/kapso.js';
import { processInbound, type InboundMessage } from '../bots/whatsapp.js';
import {
  markRecipientDelivered,
  markRecipientRead,
  markRecipientFailed,
  findRecipientByWaMessageId,
} from '../db/campaigns.js';
import { extractWhatsAppMessages } from '../ingest/normalize.js';
import { persistInboundEvents } from '../ingest/persist.js';
import { isMediaInbound } from '../ingest/types.js';

function parseInboundForBot(body: unknown): InboundMessage[] {
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
  for (const e of (b?.entry as Record<string, unknown>[]) || []) {
    for (const ch of (e?.changes as Record<string, unknown>[]) || []) {
      const value = ch?.value as Record<string, unknown> | undefined;
      for (const msg of (value?.messages as Record<string, unknown>[]) || []) push(msg);
    }
  }
  const data = b?.data as Record<string, unknown> | undefined;
  if (data?.message && (data.message as Record<string, unknown>).from) {
    push(data.message as Record<string, unknown>);
  }
  return out;
}

function parseStatuses(body: unknown): { id?: string; status?: string }[] {
  const statuses: { id?: string; status?: string }[] = [];
  const b = body as Record<string, unknown>;
  for (const e of (b?.entry as Record<string, unknown>[]) || []) {
    for (const ch of (e?.changes as Record<string, unknown>[]) || []) {
      for (const st of ((ch?.value as Record<string, unknown>)?.statuses as Record<string, unknown>[]) || []) {
        statuses.push({ id: st.id as string, status: st.status as string });
      }
    }
  }
  const data = b?.data as Record<string, unknown> | undefined;
  const kapsoMsg = data?.message as { id?: string } | undefined;
  if (kapsoMsg?.id && data?.status) {
    statuses.push({ id: String(kapsoMsg.id), status: String(data.status) });
  }
  return statuses;
}

export function kapsoWebhookGet(req: Request, res: Response): void {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const secret = process.env.KAPSO_WEBHOOK_SECRET;
  if (mode === 'subscribe' && (!secret || token === secret) && challenge) {
    res.status(200).send(String(challenge));
    return;
  }
  res.status(403).send('forbidden');
}

export async function kapsoWebhookPost(req: Request, res: Response): Promise<void> {
  const raw = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
  if (!verifyKapsoSignature(raw, (name) => req.get(name) ?? undefined)) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const body = req.body;
  let updated = 0;
  for (const st of parseStatuses(body)) {
    if (!st.id || !st.status) continue;
    if (st.status === 'delivered') {
      await markRecipientDelivered(st.id);
      updated++;
    } else if (st.status === 'read') {
      await markRecipientRead(st.id);
      updated++;
    } else if (st.status === 'failed') {
      const rec = await findRecipientByWaMessageId(st.id);
      if (rec) await markRecipientFailed(rec.id, 'delivery failed');
      updated++;
    }
  }

  const normalized = extractWhatsAppMessages(body);
  const ingest = await persistInboundEvents(normalized);

  let handled = 0;
  const botMessages = parseInboundForBot(body).filter((m) => {
    const ev = normalized.find((n) => n.external_id === m.id);
    return ev ? !isMediaInbound(ev) : true;
  });

  if (botMessages.length > 0) {
    ({ handled } = await processInbound(botMessages));
  }

  res.json({
    ok: true,
    handled,
    ingested: ingest.ingested,
    mediaQueued: ingest.mediaQueued,
    statusesUpdated: updated,
  });
}
