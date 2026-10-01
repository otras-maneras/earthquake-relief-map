import { config } from '../config.js';
import type { InboundRow } from '../db/inbound.js';
import type { InboundAttachment } from './types.js';
import { downloadAttachment } from './media.js';

export type InboxForwardPayload = {
  ref: string;
  channel: string;
  sender_id: string;
  sender_name: string | null;
  message_type: string;
  text: string | null;
  received_at: string;
  location: { lat: number; lng: number } | null;
  attachments: Array<{
    type: string;
    mime: string | null;
    file_name: string | null;
    caption: string | null;
    download_url: string | null;
  }>;
};

function buildPayload(row: InboundRow, attachments: InboundAttachment[]): InboxForwardPayload {
  return {
    ref: row.ack_ref,
    channel: row.channel,
    sender_id: row.sender_id,
    sender_name: row.sender_name,
    message_type: row.message_type,
    text: row.text_body,
    received_at: row.received_at.toISOString(),
    location: (row.location as { lat: number; lng: number } | null) ?? null,
    attachments: attachments.map((a) => ({
      type: a.type,
      mime: a.mime ?? null,
      file_name: a.file_name ?? null,
      caption: a.caption ?? null,
      download_url: a.download_url ?? null,
    })),
  };
}

export async function forwardToInboxApi(row: InboundRow, attachments: InboundAttachment[]): Promise<void> {
  const url = config.inbox.apiUrl;
  if (!url) {
    throw new Error('INBOX_API_URL not configured');
  }

  const payload = buildPayload(row, attachments);
  const useMultipart = config.inbox.forwardMultipart && attachments.some((a) => a.download_url);

  if (useMultipart) {
    const form = new FormData();
    form.append('payload', JSON.stringify(payload));

    let idx = 0;
    for (const att of attachments) {
      if (!att.download_url) continue;
      const file = await downloadAttachment(att.download_url);
      if (!file) continue;
      const name = att.file_name || `${att.type}-${idx}.${guessExt(att.mime, att.type)}`;
      form.append(
        'files',
        new Blob([new Uint8Array(file.buffer)], { type: file.mime }),
        name,
      );
      idx++;
    }

    const headers: Record<string, string> = {};
    if (config.inbox.apiKey) headers[config.inbox.apiKeyHeader] = config.inbox.apiKey;

    const res = await fetch(url, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(120000) });
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`INBOX API ${res.status}: ${err.slice(0, 300)}`);
    }
    return;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (config.inbox.apiKey) headers[config.inbox.apiKeyHeader] = config.inbox.apiKey;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`INBOX API ${res.status}: ${err.slice(0, 300)}`);
  }
}

function guessExt(mime?: string | null, type?: string): string {
  if (mime?.includes('jpeg')) return 'jpg';
  if (mime?.includes('png')) return 'png';
  if (mime?.includes('mp4')) return 'mp4';
  if (mime?.includes('pdf')) return 'pdf';
  if (type === 'photo') return 'jpg';
  if (type === 'video') return 'mp4';
  return 'bin';
}
