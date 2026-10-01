import type { InboundAttachment, NormalizedInbound } from './types.js';

function pushWaMedia(
  out: NormalizedInbound,
  type: InboundAttachment['type'],
  block: Record<string, unknown> | undefined,
  providerId?: string,
): void {
  if (!block) return;
  out.attachments.push({
    type,
    mime: (block.mime_type as string) ?? null,
    file_name: (block.filename as string) ?? null,
    caption: (block.caption as string) ?? null,
    provider_media_id: providerId ?? (block.id as string) ?? null,
  });
  if (block.caption && !out.text_body) out.text_body = String(block.caption);
}

export function normalizeWhatsAppMessage(raw: Record<string, unknown>): NormalizedInbound | null {
  if (!raw.from || !raw.id) return null;

  const base: NormalizedInbound = {
    channel: 'whatsapp',
    external_id: String(raw.id),
    sender_id: String(raw.from),
    sender_name: null,
    message_type: 'other',
    text_body: null,
    attachments: [],
    location: null,
    raw_payload: raw,
  };

  const type = String(raw.type ?? 'other');

  if (type === 'text') {
    base.message_type = 'text';
    base.text_body = (raw.text as { body?: string } | undefined)?.body ?? null;
    return base;
  }

  if (type === 'location') {
    const loc = raw.location as { latitude?: number; longitude?: number } | undefined;
    base.message_type = 'location';
    if (loc?.latitude != null) {
      base.location = { lat: Number(loc.latitude), lng: Number(loc.longitude) };
    }
    return base;
  }

  if (type === 'interactive') {
    base.message_type = 'interactive';
    const inter = raw.interactive as Record<string, Record<string, unknown>> | undefined;
    base.text_body =
      (inter?.button_reply?.title as string) ||
      (inter?.list_reply?.title as string) ||
      (inter?.button_reply?.id as string) ||
      null;
    return base;
  }

  if (type === 'image') {
    base.message_type = 'photo';
    pushWaMedia(base, 'photo', raw.image as Record<string, unknown>, (raw.image as { id?: string })?.id);
    return base;
  }

  if (type === 'video') {
    base.message_type = 'video';
    pushWaMedia(base, 'video', raw.video as Record<string, unknown>, (raw.video as { id?: string })?.id);
    return base;
  }

  if (type === 'document') {
    base.message_type = 'document';
    pushWaMedia(base, 'document', raw.document as Record<string, unknown>, (raw.document as { id?: string })?.id);
    return base;
  }

  if (type === 'audio' || type === 'voice') {
    base.message_type = 'document';
    pushWaMedia(base, 'document', (raw.audio || raw.voice) as Record<string, unknown>, ((raw.audio || raw.voice) as { id?: string })?.id);
    return base;
  }

  return base;
}

export function extractWhatsAppMessages(body: unknown): NormalizedInbound[] {
  const out: NormalizedInbound[] = [];
  const pushRaw = (raw: Record<string, unknown> | null | undefined) => {
    const n = raw ? normalizeWhatsAppMessage(raw) : null;
    if (n) out.push(n);
  };

  const b = body as Record<string, unknown>;
  for (const e of (b?.entry as Record<string, unknown>[]) || []) {
    for (const ch of (e?.changes as Record<string, unknown>[]) || []) {
      const value = ch?.value as Record<string, unknown> | undefined;
      for (const msg of (value?.messages as Record<string, unknown>[]) || []) pushRaw(msg);
    }
  }
  const data = b?.data as Record<string, unknown> | undefined;
  if (data?.message && (data.message as Record<string, unknown>).from) {
    pushRaw(data.message as Record<string, unknown>);
  }
  return out;
}

export function normalizeTelegramUpdate(body: Record<string, unknown>): NormalizedInbound | null {
  const updateId = body.update_id != null ? String(body.update_id) : null;
  if (!updateId) return null;

  const cq = body.callback_query as Record<string, unknown> | undefined;
  if (cq) {
    const msg = cq.message as Record<string, unknown> | undefined;
    const chat = msg?.chat as Record<string, unknown> | undefined;
    const from = cq.from as Record<string, unknown> | undefined;
    const chatId = chat?.id != null ? String(chat.id) : null;
    if (!chatId) return null;
    return {
      channel: 'telegram',
      external_id: updateId,
      sender_id: chatId,
      sender_name: (from?.first_name as string) ?? null,
      message_type: 'interactive',
      text_body: typeof cq.data === 'string' ? cq.data : null,
      attachments: [],
      raw_payload: body,
    };
  }

  const msg = body.message as Record<string, unknown> | undefined;
  if (!msg) return null;

  const chat = msg.chat as Record<string, unknown> | undefined;
  const from = msg.from as Record<string, unknown> | undefined;
  const chatId = chat?.id != null ? String(chat.id) : null;
  if (!chatId) return null;

  const senderName = [from?.first_name, from?.last_name].filter(Boolean).join(' ') || null;

  const base: NormalizedInbound = {
    channel: 'telegram',
    external_id: updateId,
    sender_id: chatId,
    sender_name: senderName,
    message_type: 'other',
    text_body: typeof msg.text === 'string' ? msg.text : null,
    attachments: [],
    location: null,
    raw_payload: body,
  };

  const loc = msg.location as { latitude?: number; longitude?: number } | undefined;
  if (loc?.latitude != null) {
    base.message_type = 'location';
    base.location = { lat: loc.latitude, lng: Number(loc.longitude) };
    return base;
  }

  const photos = msg.photo as Array<{ file_id?: string; file_size?: number }> | undefined;
  if (photos?.length) {
    const best = photos[photos.length - 1];
    base.message_type = 'photo';
    base.attachments.push({
      type: 'photo',
      telegram_file_id: best.file_id ?? null,
      byte_size: best.file_size ?? null,
      caption: (msg.caption as string) ?? null,
    });
    if (msg.caption) base.text_body = String(msg.caption);
    return base;
  }

  const video = msg.video as { file_id?: string; mime_type?: string; file_name?: string; file_size?: number } | undefined;
  if (video?.file_id) {
    base.message_type = 'video';
    base.attachments.push({
      type: 'video',
      mime: video.mime_type ?? null,
      file_name: video.file_name ?? null,
      telegram_file_id: video.file_id,
      byte_size: video.file_size ?? null,
      caption: (msg.caption as string) ?? null,
    });
    if (msg.caption) base.text_body = String(msg.caption);
    return base;
  }

  const doc = msg.document as { file_id?: string; mime_type?: string; file_name?: string; file_size?: number } | undefined;
  if (doc?.file_id) {
    base.message_type = 'document';
    base.attachments.push({
      type: 'document',
      mime: doc.mime_type ?? null,
      file_name: doc.file_name ?? null,
      telegram_file_id: doc.file_id,
      byte_size: doc.file_size ?? null,
      caption: (msg.caption as string) ?? null,
    });
    if (msg.caption) base.text_body = String(msg.caption);
    return base;
  }

  const voice = (msg.voice || msg.audio) as { file_id?: string; mime_type?: string; file_size?: number } | undefined;
  if (voice?.file_id) {
    base.message_type = 'document';
    base.attachments.push({
      type: 'document',
      mime: voice.mime_type ?? 'audio/ogg',
      file_name: null,
      telegram_file_id: voice.file_id,
      byte_size: voice.file_size ?? null,
      caption: (msg.caption as string) ?? null,
    });
    if (msg.caption) base.text_body = String(msg.caption);
    return base;
  }

  if (typeof msg.text === 'string') {
    base.message_type = 'text';
    return base;
  }

  return base;
}
