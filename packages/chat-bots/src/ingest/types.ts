export type InboundChannel = 'whatsapp' | 'telegram';

export type InboundMessageType =
  | 'text'
  | 'photo'
  | 'video'
  | 'document'
  | 'location'
  | 'interactive'
  | 'other';

export type InboundAttachment = {
  type: 'photo' | 'video' | 'document';
  mime?: string | null;
  file_name?: string | null;
  caption?: string | null;
  byte_size?: number | null;
  /** ID nativo del canal para descargar el binario */
  provider_media_id?: string | null;
  /** file_id de Telegram */
  telegram_file_id?: string | null;
  /** URL temporal tras resolver (Meta/Kapso o Telegram) */
  download_url?: string | null;
};

export type NormalizedInbound = {
  channel: InboundChannel;
  external_id: string;
  sender_id: string;
  sender_name?: string | null;
  message_type: InboundMessageType;
  text_body?: string | null;
  attachments: InboundAttachment[];
  location?: { lat: number; lng: number } | null;
  raw_payload?: unknown;
};

export function isMediaInbound(msg: NormalizedInbound): boolean {
  return msg.message_type === 'photo' || msg.message_type === 'video' || msg.message_type === 'document';
}

export function isBotHandledInbound(msg: NormalizedInbound): boolean {
  return (
    msg.message_type === 'text' ||
    msg.message_type === 'location' ||
    msg.message_type === 'interactive'
  );
}
