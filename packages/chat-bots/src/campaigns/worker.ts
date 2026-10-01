import { config } from '../config.js';
import {
  claimNextBroadcast,
  claimPendingRecipients,
  finishBroadcastIfDone,
  markRecipientFailed,
  markRecipientSent,
} from '../db/campaigns.js';
import { kapsoConfig, normalizePhone, sendTemplate, extractMessageId } from '../channels/kapso.js';
import { getBaileysSocket } from '../channels/baileys.js';

const THROTTLE_MS = 350;
let messagesSentInBatch = 0;
const BATCH_LIMIT = Number(process.env.BROADCAST_BATCH_LIMIT || 30);
const BATCH_REST_MS = Number(process.env.BROADCAST_BATCH_REST_MS || 90000);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function renderEmailHtml(bodyText: string, showWaButton = true): string {
  // Normalizar los saltos de línea literales escapados (\n) que puedan venir de la base de datos
  const normalizedBody = bodyText
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');

  // Convertir los saltos de línea a párrafos
  const paragraphs = normalizedBody.split('\n\n').map(p => p.trim()).filter(Boolean);

  // Logo de marca (alojado en producción para que cargue en los clientes de correo).
  const logoUrl = 'https://acopiove.org/brand/logo-lockup.png';

  // Botón de WhatsApp: al escribirnos se abre la ventana de servicio de 24h de Meta,
  // habilitando que podamos responderles/coordinar por WhatsApp.
  const waNumber = (process.env.WHATSAPP_CONTACT_NUMBER || '12013381819').replace(/[^0-9]/g, '');
  const waText = encodeURIComponent('Hola, quiero coordinar con AcopioVE.');
  const waLink = `https://wa.me/${waNumber}?text=${waText}`;
  const waHtml = showWaButton ? `
        <div style="text-align: center; margin: 0 0 10px 0;">
          <a href="${waLink}" target="_blank" style="background-color: #25D366; color: #ffffff; padding: 13px 26px; font-size: 15px; font-weight: bold; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.12); font-family: sans-serif;">
            Escríbenos por WhatsApp
          </a>
        </div>
        <p style="margin: 0; font-size: 12px; color: #7b8087; text-align: center; font-family: sans-serif;">
          Coordina con nuestro equipo en tiempo real.
        </p>
  ` : '';

  const waContainer = showWaButton ? `
              <div style="margin: 30px 0 0 0; padding-top: 28px; border-top: 1px solid rgba(0,0,0,0.06);">
                ${waHtml}
              </div>
  ` : '';

  let ctaHtml = '';
  const cleanedParagraphs = [...paragraphs];
  
  // Expresión regular para detectar URLs que empiecen con http
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  
  // Buscar el enlace principal (una URL sola en su propia línea) para convertirlo en botón.
  // Recorre de atrás hacia adelante; deja el texto que la acompaña como párrafo normal.
  const urlLineRe = /^https?:\/\/\S+$/;
  for (let i = cleanedParagraphs.length - 1; i >= 0; i--) {
    const lines = cleanedParagraphs[i].split('\n');
    const li = lines.findIndex((l) => urlLineRe.test(l.trim()));
    if (li !== -1) {
      const url = lines[li].trim();
      let buttonLabel = 'Ingresar a la Plataforma';
      if (url.includes('/admin')) {
        buttonLabel = 'Ir al Panel de Control';
      } else if (url.includes('/donate')) {
        buttonLabel = 'Colaborar / Donar';
      }

      ctaHtml = `
        <div style="text-align: center; margin: 35px 0;">
          <a href="${url}" target="_blank" style="background-color: #003D8F; color: #ffffff; padding: 14px 28px; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px rgba(0,61,143,0.25); font-family: sans-serif; transition: background-color 0.2s ease;">
            ${buttonLabel}
          </a>
        </div>
      `;
      // Quita solo la línea de la URL; conserva el texto que la introducía.
      lines.splice(li, 1);
      const rest = lines.join('\n').trim();
      if (rest) cleanedParagraphs[i] = rest;
      else cleanedParagraphs.splice(i, 1);
      break;
    }
  }

  const contentHtml = cleanedParagraphs.map(p => {
    // Si contiene enlaces normales, los convertimos en links cliqueables estilizados.
    // Recorta la puntuación final () . , ; : que la regex captura de más (ej: "(https://acopiove.org)")
    // para que no quede dentro del href y el enlace funcione bien.
    let htmlP = p.replace(urlRegex, (m) => {
      const trail = m.match(/[).,;:!?]+$/);
      const suffix = trail ? trail[0] : '';
      const url = suffix ? m.slice(0, m.length - suffix.length) : m;
      return `<a href="${url}" target="_blank" style="color: #1976D2; text-decoration: underline; font-weight: bold;">${url}</a>${suffix}`;
    });
    // Soporte para negrita de markdown (**texto**)
    htmlP = htmlP.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    htmlP = htmlP.replace(/\n/g, '<br />');
    return `<p style="margin: 0 0 18px 0; font-size: 16px; line-height: 1.65; color: #4d5158; font-family: sans-serif;">${htmlP}</p>`;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Centros Acopio Venezuela</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eaecee; font-family: sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #eaecee; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04); overflow: hidden; border: 1px solid rgba(0, 0, 0, 0.08);">
          <!-- Barra tricolor (se ve aunque el cliente bloquee imágenes) -->
          <tr>
            <td style="font-size:0; line-height:0;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%"><tr>
                <td height="5" style="background-color:#003D8F; line-height:5px;">&nbsp;</td>
                <td height="5" style="background-color:#F4B400; line-height:5px;">&nbsp;</td>
                <td height="5" style="background-color:#EA4335; line-height:5px;">&nbsp;</td>
              </tr></table>
            </td>
          </tr>
          <!-- Encabezado con logo -->
          <tr>
            <td style="padding: 30px 36px 22px 36px; background-color: #ffffff; text-align: center; border-bottom: 1px solid rgba(0,0,0,0.06);">
              <img src="${logoUrl}" alt="AcopioVE · Centros de Acopio Venezuela" width="220" style="display:inline-block; width:220px; max-width:72%; height:auto; border:0;" />
              <p style="margin: 14px 0 0 0; font-size: 12px; color: #7b8087; text-transform: uppercase; letter-spacing: 1.5px; font-family: sans-serif; font-weight: 600;">Mapa humanitario en tiempo real</p>
            </td>
          </tr>
          <!-- Contenido -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              ${contentHtml}
              ${ctaHtml}
              ${waContainer}
            </td>
          </tr>
          <!-- Datos + qué ofrecemos -->
          <tr>
            <td style="padding: 0 36px 12px 36px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid rgba(0,0,0,0.05); border-radius: 10px;">
                <tr>
                  <td style="padding: 18px 22px; text-align: center;">
                    <p style="margin: 0 0 6px 0; font-size: 15px; font-weight: bold; color: #003D8F; font-family: sans-serif;">+560 centros y refugios &middot; 19 países &middot; en tiempo real</p>
                    <p style="margin: 0; font-size: 13px; line-height: 1.65; color: #4d5158; font-family: sans-serif;">Mapa interactivo de acopio y refugios &middot; Teléfonos de emergencia &middot; Contacto familiar (Cruz Roja) &middot; Voluntarios intérpretes &middot; Canales de donación verificados</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Pie de página -->
          <tr>
            <td style="padding: 28px 36px 36px 36px; background-color: #f8fafc; border-top: 1px solid rgba(0, 0, 0, 0.04); text-align: center;">
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #7b8087; font-family: sans-serif;">
                AcopioVE es un proyecto comunitario e independiente para la respuesta al terremoto de Venezuela de 2026. No es un sitio oficial ni gubernamental. La información se verifica a partir de fuentes públicas y de la comunidad.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

async function sendEmail(to: string, subject: string, bodyText: string, name?: string | null): Promise<void> {
  const { apiKey, fromName, fromEmail } = config.resend;
  if (!apiKey || !fromEmail) throw new Error('Resend not configured');

  let body = bodyText;
  if (name) body = body.replace(/\{nombre\}/gi, name);
  const from = `${fromName} <${fromEmail}>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text: body, html: renderEmailHtml(body) }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Resend ${res.status}: ${err}`);
  }
}

async function processOneRecipient(): Promise<number | null> {
  if (messagesSentInBatch >= BATCH_LIMIT) {
    console.log(`[worker] Límite de lote alcanzado (${BATCH_LIMIT}). Descansando ${BATCH_REST_MS / 1000}s para evitar bloqueos...`);
    messagesSentInBatch = 0;
    return BATCH_REST_MS;
  }

  let broadcast = await claimNextBroadcast();
  if (!broadcast) {
    const r = await import('../db/pool.js').then((m) =>
      m.query<{ id: string }>(
        `SELECT id FROM broadcasts WHERE status = 'sending' ORDER BY created_at LIMIT 1`,
      ),
    );
    if (!r.rows[0]) return null;
    broadcast = (await import('../db/campaigns.js').then((m) => m.getBroadcast(r.rows[0].id)))!;
    if (!broadcast) return null;
  }

  const recipients = await claimPendingRecipients(broadcast.id, 1);
  if (recipients.length === 0) {
    await finishBroadcastIfDone(broadcast.id);
    return 100;
  }

  const r = recipients[0];
  const defaultVars = Array.isArray(broadcast.default_vars) ? (broadcast.default_vars as string[]) : [];
  const vars = Array.isArray(r.vars) && (r.vars as string[]).length ? (r.vars as string[]) : defaultVars;

  let delayMs = THROTTLE_MS;

  try {
    if (broadcast.type === 'email') {
      if (!r.email) throw new Error('Missing email');
      let body = broadcast.body || '';
      if (r.name) body = body.replace(/\{nombre\}/gi, r.name);
      await sendEmail(r.email, broadcast.subject || broadcast.name, body, r.name);
      await markRecipientSent(r.id);
      delayMs = 250;
    } else {
      // WhatsApp
      const baileysSock = getBaileysSocket();
      if (baileysSock) {
        const phone = normalizePhone(r.phone);
        if (!phone) throw new Error('Invalid phone');
        const jid = `${phone}@s.whatsapp.net`;

        // 1. Simulación de escritura (Antispam)
        await baileysSock.sendPresenceUpdate('composing', jid);
        const typingTime = Math.floor(Math.random() * 1000) + 1000;
        await sleep(typingTime);
        await baileysSock.sendPresenceUpdate('paused', jid);

        // 2. Formatear el mensaje usando el cuerpo
        let body = broadcast.body || '';
        if (r.name) body = body.replace(/\{nombre\}/gi, r.name);
        vars.forEach((v, idx) => {
          body = body.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), v);
        });

        // 3. Enviar el mensaje
        const sent = await baileysSock.sendMessage(jid, { text: body });
        if (!sent) throw new Error('Baileys failed to send message');
        
        await markRecipientSent(r.id, sent.key.id || undefined);
        messagesSentInBatch++;

        // 4. Jitter largo para WhatsApp Web / Baileys (entre 3 y 6 segundos)
        delayMs = Math.floor(Math.random() * 3000) + 3000;
      } else {
        const cfg = kapsoConfig();
        if (!cfg) throw new Error('Kapso not configured');
        const phone = normalizePhone(r.phone);
        if (!phone) throw new Error('Invalid phone');
        if (!broadcast.template_name) throw new Error('Missing template_name');
        const result = await sendTemplate(cfg, {
          to: phone,
          name: broadcast.template_name,
          language: broadcast.template_lang || 'es',
          bodyParams: vars,
        });
        if (!result.ok) throw new Error(result.error || 'send failed');
        await markRecipientSent(r.id, extractMessageId(result));
        messagesSentInBatch++;

        // 5. Jitter ligero para API oficial (entre 400 y 1200 ms)
        delayMs = Math.floor(Math.random() * 800) + 400;
      }
    }
  } catch (e) {
    await markRecipientFailed(r.id, e instanceof Error ? e.message : 'unknown error');
  }

  await finishBroadcastIfDone(broadcast.id);
  return delayMs;
}

export async function runWorkerLoop(signal?: AbortSignal): Promise<void> {
  console.log('[worker] broadcast worker started');
  while (!signal?.aborted) {
    const delay = await processOneRecipient();
    if (delay === null) {
      await sleep(2000);
      continue;
    }
    await sleep(delay);
  }
  console.log('[worker] broadcast worker stopped');
}
