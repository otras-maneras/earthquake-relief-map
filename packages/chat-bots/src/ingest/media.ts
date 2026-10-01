import { config } from '../config.js';
import type { InboundAttachment } from './types.js';

const KAPSO_BASE = 'https://api.kapso.ai/meta/whatsapp/v24.0';

export async function resolveWhatsAppMediaUrl(mediaId: string): Promise<string | null> {
  if (!config.kapso.apiKey || !mediaId) return null;
  const metaRes = await fetch(`${KAPSO_BASE}/${mediaId}`, {
    headers: { 'X-API-Key': config.kapso.apiKey },
    signal: AbortSignal.timeout(20000),
  });
  if (!metaRes.ok) return null;
  const meta = (await metaRes.json()) as { url?: string };
  return meta.url ?? null;
}

export async function resolveTelegramFileUrl(fileId: string): Promise<string | null> {
  const token = config.telegram.botToken;
  if (!token || !fileId) return null;
  const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { ok?: boolean; result?: { file_path?: string } };
  if (!data.ok || !data.result?.file_path) return null;
  return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
}

export async function enrichAttachments(
  channel: 'whatsapp' | 'telegram',
  attachments: InboundAttachment[],
): Promise<InboundAttachment[]> {
  const out: InboundAttachment[] = [];
  for (const att of attachments) {
    const copy = { ...att };
    if (!copy.download_url) {
      if (channel === 'whatsapp' && copy.provider_media_id) {
        copy.download_url = (await resolveWhatsAppMediaUrl(copy.provider_media_id)) ?? null;
      }
      if (channel === 'telegram' && copy.telegram_file_id) {
        copy.download_url = (await resolveTelegramFileUrl(copy.telegram_file_id)) ?? null;
      }
    }
    out.push(copy);
  }
  return out;
}

export async function downloadAttachment(url: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const headers: Record<string, string> = {};
  if (url.includes('lookaside.fbsbx.com') || url.includes('facebook.com')) {
    if (config.kapso.apiKey) headers.Authorization = `Bearer ${config.kapso.apiKey}`;
    headers['X-API-Key'] = config.kapso.apiKey;
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
  if (!res.ok) return null;
  const mime = res.headers.get('content-type') || 'application/octet-stream';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mime };
}
