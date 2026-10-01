import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
  type proto
} from '@whiskeysockets/baileys';
import pino from 'pino';
// @ts-ignore
import qrcode from 'qrcode-terminal';
import { persistInboundEvents } from '../ingest/persist.js';
import { processInbound } from '../bots/whatsapp.js';
import { isMediaInbound, type NormalizedInbound } from '../ingest/types.js';

let sock: WASocket | null = null;

const logger = pino({ level: 'info' });

export async function initBaileysSocket(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false, // Controlamos la terminal manualmente abajo
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('\n--- ESCANEA ESTE CÓDIGO QR PARA AUTENTICAR CON WHATSAPP ---');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('[baileys] conexión cerrada debido a:', lastDisconnect?.error, ', reconectando:', shouldReconnect);
      if (shouldReconnect) {
        initBaileysSocket();
      }
    } else if (connection === 'open') {
      console.log('[baileys] ¡conexión abierta exitosamente!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;
    for (const msg of m.messages) {
      if (msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!jid) continue;

      try {
        const normalized = await normalizeBaileysMessage(jid, msg);
        if (!normalized) continue;

        // Registrar y guardar en base de datos unificada (Frente A)
        await persistInboundEvents([normalized]);

        // Decidir si va al bot conversacional o a la cola de ingesta
        if (isMediaInbound(normalized)) {
          // El worker de ingesta asíncrono responderá con autorespuesta A4 y forward HTTP
          console.log(`[baileys] mensaje multimedia de ${jid} encolado para ingesta`);
        } else {
          // Enviar al bot de búsqueda de forma síncrona
          const inbound = {
            id: normalized.external_id,
            from: normalized.sender_id,
            type: (normalized.message_type === 'text' || normalized.message_type === 'location' || normalized.message_type === 'interactive' ? normalized.message_type : 'other') as 'text' | 'location' | 'interactive' | 'other',
            text: normalized.text_body || undefined,
            location: normalized.location || undefined,
          };
          await processInbound([inbound]);
        }
      } catch (err) {
        console.error('[baileys] error al procesar mensaje entrante:', err);
      }
    }
  });

  return sock;
}

export function getBaileysSocket(): WASocket | null {
  return sock;
}

// Envío de respuestas usando el socket activo de Baileys
export async function sendBaileysText(to: string, body: string): Promise<boolean> {
  if (!sock) {
    console.error('[baileys] no se puede enviar mensaje, socket no inicializado');
    return false;
  }
  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text: body });
  return true;
}

// Normalización de los mensajes provenientes de Baileys al tipo NormalizedInbound
async function normalizeBaileysMessage(
  jid: string,
  msg: proto.IWebMessageInfo
): Promise<NormalizedInbound | null> {
  const message = msg.message;
  if (!message) return null;

  const senderId = jid.split('@')[0];
  const senderName = msg.pushName || null;
  const externalId = msg.key.id || String(Date.now());

  const base: NormalizedInbound = {
    channel: 'whatsapp',
    external_id: externalId,
    sender_id: senderId,
    sender_name: senderName,
    message_type: 'other',
    text_body: null,
    attachments: [],
    location: null,
    raw_payload: msg,
  };

  // Texto simple
  if (message.conversation) {
    base.message_type = 'text';
    base.text_body = message.conversation;
    return base;
  }
  if (message.extendedTextMessage?.text) {
    base.message_type = 'text';
    base.text_body = message.extendedTextMessage.text;
    return base;
  }

  // Ubicación
  if (message.locationMessage) {
    base.message_type = 'location';
    const lat = message.locationMessage.degreesLatitude;
    const lng = message.locationMessage.degreesLongitude;
    if (lat != null && lng != null) {
      base.location = { lat, lng };
    }
    return base;
  }

  // Respuestas interactivas (Botones / Listas de WhatsApp)
  if (message.buttonsResponseMessage) {
    base.message_type = 'interactive';
    base.text_body = message.buttonsResponseMessage.selectedButtonId || null;
    return base;
  }
  if (message.listResponseMessage) {
    base.message_type = 'interactive';
    base.text_body = message.listResponseMessage.singleSelectReply?.selectedRowId || null;
    return base;
  }

  // Medios: Imagen
  if (message.imageMessage) {
    base.message_type = 'photo';
    base.text_body = message.imageMessage.caption || null;
    base.attachments.push({
      type: 'photo',
      mime: message.imageMessage.mimetype || 'image/jpeg',
      file_name: (message.imageMessage as any).fileName || null,
      caption: message.imageMessage.caption || null,
      byte_size: message.imageMessage.fileLength ? Number(message.imageMessage.fileLength) : null,
      provider_media_id: message.imageMessage.mediaKey ? Buffer.from(message.imageMessage.mediaKey).toString('hex') : null,
    });
    return base;
  }

  // Medios: Video
  if (message.videoMessage) {
    base.message_type = 'video';
    base.text_body = message.videoMessage.caption || null;
    base.attachments.push({
      type: 'video',
      mime: message.videoMessage.mimetype || 'video/mp4',
      file_name: (message.videoMessage as any).fileName || null,
      caption: message.videoMessage.caption || null,
      byte_size: message.videoMessage.fileLength ? Number(message.videoMessage.fileLength) : null,
      provider_media_id: message.videoMessage.mediaKey ? Buffer.from(message.videoMessage.mediaKey).toString('hex') : null,
    });
    return base;
  }

  // Medios: Documento
  if (message.documentMessage) {
    base.message_type = 'document';
    base.text_body = message.documentMessage.caption || null;
    base.attachments.push({
      type: 'document',
      mime: message.documentMessage.mimetype || 'application/octet-stream',
      file_name: message.documentMessage.fileName || null,
      caption: message.documentMessage.caption || null,
      byte_size: message.documentMessage.fileLength ? Number(message.documentMessage.fileLength) : null,
      provider_media_id: message.documentMessage.mediaKey ? Buffer.from(message.documentMessage.mediaKey).toString('hex') : null,
    });
    return base;
  }

  // Medios: Audio / Nota de voz
  if (message.audioMessage) {
    base.message_type = 'document';
    base.attachments.push({
      type: 'document',
      mime: message.audioMessage.mimetype || 'audio/ogg',
      file_name: null,
      caption: null,
      byte_size: message.audioMessage.fileLength ? Number(message.audioMessage.fileLength) : null,
      provider_media_id: message.audioMessage.mediaKey ? Buffer.from(message.audioMessage.mediaKey).toString('hex') : null,
    });
    return base;
  }

  return base;
}
