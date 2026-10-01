import { config } from '../config.js';
import {
  claimInboundBatch,
  markInboundAckSent,
  markInboundDone,
  markInboundFailed,
  markInboundForwarded,
  updateInboundAttachments,
  type InboundRow,
} from '../db/inbound.js';
import { enrichAttachments } from './media.js';
import { forwardToInboxApi } from './forward.js';
import { kapsoConfig, sendText } from '../channels/kapso.js';
import { telegramConfig, sendText as tgSendText } from '../channels/telegram.js';
import type { InboundAttachment } from './types.js';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function ackMessage(ref: string): string {
  return config.inbound.autoReplyText.replace(/\{ref\}/g, ref);
}

async function sendAutoReply(row: InboundRow): Promise<void> {
  if (!config.inbound.autoReplyEnabled) return;
  if (row.ack_sent_at) return;

  const body = ackMessage(row.ack_ref);

  if (row.channel === 'whatsapp') {
    const cfg = kapsoConfig();
    if (!cfg) throw new Error('Kapso not configured for auto-reply');
    const r = await sendText(cfg, { to: row.sender_id, body });
    if (!r.ok) throw new Error(r.error || 'WhatsApp auto-reply failed');
  } else if (row.channel === 'telegram') {
    const cfg = telegramConfig();
    if (!cfg) throw new Error('Telegram not configured for auto-reply');
    const r = await tgSendText(cfg, { chatId: row.sender_id, text: body });
    if (!r.ok) throw new Error(r.error || 'Telegram auto-reply failed');
  }

  await markInboundAckSent(row.id);
}

async function processOneInbound(row: InboundRow): Promise<void> {
  const attachments = (Array.isArray(row.attachments) ? row.attachments : []) as InboundAttachment[];
  const enriched = await enrichAttachments(row.channel as 'whatsapp' | 'telegram', attachments);
  await updateInboundAttachments(row.id, enriched);

  if (config.inbox.apiUrl) {
    try {
      await forwardToInboxApi(row, enriched);
      await markInboundForwarded(row.id, true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'forward failed';
      await markInboundForwarded(row.id, false, msg);
      if (config.inbox.forwardRequired) throw e;
    }
  }

  await sendAutoReply(row);
  await markInboundDone(row.id);
}

async function processInboundBatch(): Promise<boolean> {
  const batch = await claimInboundBatch(3);
  if (batch.length === 0) return false;

  for (const row of batch) {
    try {
      await processOneInbound(row);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error';
      console.error(`[ingest] failed ${row.ack_ref}:`, msg);
      await markInboundFailed(row.id, msg);
    }
  }
  return true;
}

export async function runIngestWorkerLoop(signal?: AbortSignal): Promise<void> {
  console.log('[ingest-worker] started');
  while (!signal?.aborted) {
    const didWork = await processInboundBatch();
    if (!didWork) await sleep(1500);
  }
  console.log('[ingest-worker] stopped');
}
