// Worker en proceso que drena la cola de campañas: toma destinatarios pendientes,
// envía la plantilla por Kapso con throttle y actualiza estado/contadores en la DB.
// Persistido en Postgres → sobrevive reinicios (al arrancar retoma las 'sending').
// Un solo proceso Next + flag singleton evita drenados concurrentes.

import { and, eq, sql, asc } from 'drizzle-orm';
import { db } from '@/db';
import { broadcasts, broadcastRecipients } from '@/db/schema';
import { kapsoConfig, sendTemplate } from '@/lib/kapso';

const THROTTLE_MS = 350; // ~3 mensajes/seg; Meta igual aplica su límite por tier

const g = globalThis as unknown as { __bcastRunning?: boolean };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processOne(): Promise<boolean> {
  // Toma una campaña en envío con destinatarios pendientes (FIFO por creación).
  const [bcast] = await db
    .select()
    .from(broadcasts)
    .where(eq(broadcasts.status, 'sending'))
    .orderBy(asc(broadcasts.createdAt))
    .limit(1);

  if (!bcast) return false;

  const pending = await db
    .select()
    .from(broadcastRecipients)
    .where(and(eq(broadcastRecipients.broadcastId, bcast.id), eq(broadcastRecipients.status, 'pending')))
    .orderBy(asc(broadcastRecipients.id))
    .limit(1);

  if (pending.length === 0) {
    // No quedan pendientes: cerrar la campaña.
    await db
      .update(broadcasts)
      .set({ status: 'done', finishedAt: new Date() })
      .where(eq(broadcasts.id, bcast.id));
    return true; // sigue, puede haber otra campaña
  }

  const r = pending[0];

  if (bcast.type === 'email') {
    const apiKey = process.env.RESEND_API_KEY;
    const fromName = process.env.RESEND_FROM_NAME || 'AcopioVE';
    const fromEmail = process.env.RESEND_FROM_EMAIL || '';

    if (!apiKey || !fromEmail) {
      await db.update(broadcastRecipients)
        .set({ status: 'failed', error: 'Resend no configurado (RESEND_API_KEY o RESEND_FROM_EMAIL faltante)', updatedAt: new Date() })
        .where(eq(broadcastRecipients.id, r.id));
      await db.update(broadcasts)
        .set({ failCount: sql`${broadcasts.failCount} + 1` })
        .where(eq(broadcasts.id, bcast.id));
      return true;
    }

    if (!r.email) {
      await db.update(broadcastRecipients)
        .set({ status: 'failed', error: 'Destinatario sin correo electronico', updatedAt: new Date() })
        .where(eq(broadcastRecipients.id, r.id));
      await db.update(broadcasts)
        .set({ failCount: sql`${broadcasts.failCount} + 1` })
        .where(eq(broadcasts.id, bcast.id));
      return true;
    }

    try {
      const from = `${fromName} <${fromEmail}>`;
      const subject = bcast.subject || bcast.name;
      let bodyText = bcast.body || '';
      if (r.name) {
        bodyText = bodyText.replace(/\{nombre\}/gi, r.name);
      }
      if (Array.isArray(r.vars) && r.vars[0]) {
        const org = String(r.vars[0]);
        bodyText = bodyText.replace(/\{organizacion\}/gi, org);
        bodyText = bodyText.replace(/\{\{organizacion\}\}/gi, org);
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from,
          to: r.email,
          subject,
          text: bodyText,
          html: renderEmailHtml(bodyText)
        })
      });

      const text = await res.text();
      let resData: any;
      try { resData = text ? JSON.parse(text) : {}; } catch { resData = text; }

      if (res.ok) {
        const msgId = resData?.id || null;
        await db.update(broadcastRecipients)
          .set({ status: 'sent', waMessageId: msgId, error: null, updatedAt: new Date() })
          .where(eq(broadcastRecipients.id, r.id));
        await db.update(broadcasts)
          .set({ sentCount: sql`${broadcasts.sentCount} + 1` })
          .where(eq(broadcasts.id, bcast.id));
      } else {
        const errMsg = resData?.error?.message || `HTTP ${res.status}`;
        await db.update(broadcastRecipients)
          .set({ status: 'failed', error: errMsg.slice(0, 500), updatedAt: new Date() })
          .where(eq(broadcastRecipients.id, r.id));
        await db.update(broadcasts)
          .set({ failCount: sql`${broadcasts.failCount} + 1` })
          .where(eq(broadcasts.id, bcast.id));
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Error de conexion';
      await db.update(broadcastRecipients)
        .set({ status: 'failed', error: errMsg.slice(0, 500), updatedAt: new Date() })
        .where(eq(broadcastRecipients.id, r.id));
      await db.update(broadcasts)
        .set({ failCount: sql`${broadcasts.failCount} + 1` })
        .where(eq(broadcasts.id, bcast.id));
    }
  } else {
    const cfg = kapsoConfig();
    if (!cfg) {
      await db.update(broadcastRecipients)
        .set({ status: 'failed', error: 'Kapso no configurado', updatedAt: new Date() })
        .where(eq(broadcastRecipients.id, r.id));
      await db.update(broadcasts)
        .set({ failCount: sql`${broadcasts.failCount} + 1` })
        .where(eq(broadcasts.id, bcast.id));
      return true;
    }

    if (!r.phone) {
      await db.update(broadcastRecipients)
        .set({ status: 'failed', error: 'Destinatario sin telefono', updatedAt: new Date() })
        .where(eq(broadcastRecipients.id, r.id));
      await db.update(broadcasts)
        .set({ failCount: sql`${broadcasts.failCount} + 1` })
        .where(eq(broadcasts.id, bcast.id));
      return true;
    }

    const res = await sendTemplate(cfg, {
      to: r.phone,
      name: bcast.templateName || '',
      language: bcast.templateLang || 'es',
      bodyParams: Array.isArray(r.vars) ? (r.vars as string[]) : [],
    });

    if (res.ok) {
      const msgId = res.data?.messages?.[0]?.id || null;
      await db.update(broadcastRecipients)
        .set({ status: 'sent', waMessageId: msgId, error: null, updatedAt: new Date() })
        .where(eq(broadcastRecipients.id, r.id));
      await db.update(broadcasts)
        .set({ sentCount: sql`${broadcasts.sentCount} + 1` })
        .where(eq(broadcasts.id, bcast.id));
    } else {
      await db.update(broadcastRecipients)
        .set({ status: 'failed', error: (res.error || 'error').slice(0, 500), updatedAt: new Date() })
        .where(eq(broadcastRecipients.id, r.id));
      await db.update(broadcasts)
        .set({ failCount: sql`${broadcasts.failCount} + 1` })
        .where(eq(broadcasts.id, bcast.id));
    }
  }

  await sleep(THROTTLE_MS);
  return true;
}

async function drain() {
  try {
    // Procesa de a un destinatario por iteración hasta vaciar la cola.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const more = await processOne();
      if (!more) break;
    }
  } catch (e) {
    console.error('[broadcast-worker]', e);
  } finally {
    g.__bcastRunning = false;
  }
}

/** Arranca el drenado si no está corriendo. Idempotente. */
export function startDrainer() {
  if (g.__bcastRunning) return;
  g.__bcastRunning = true;
  // No await: corre en background dentro del proceso del servidor.
  void drain();
}

/**
 * Genera una plantilla HTML responsive y premium basada en el diseño y colores de AcopioVE.
 */
export function renderEmailHtml(bodyText: string, showWaButton = true): string {
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
  `.trim();
}
