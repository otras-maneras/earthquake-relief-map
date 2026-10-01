// Bot entrante de Telegram: mismo propósito que wa-bot.ts (buscar centros de
// acopio / refugios / personas), pero sin depender de Meta ni de ventanas de
// 24h. Mensajes genéricos (sin nombre de marca) porque este bot no está atado
// a un proyecto en particular.
//
// Reusa la lógica de datos (centros-search.ts, /api/personas) tal cual la usa
// el bot de WhatsApp; solo cambia el transporte y el formato de los mensajes
// (HTML de Telegram en vez de *markdown* de WhatsApp) y la tabla de sesión
// (telegram_sessions, separada de wa_sessions para no tocar el bot en vivo).

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { telegramSessions } from '@/db/schema';
import {
  telegramConfig,
  sendText,
  sendLocationRequest,
  answerCallback,
  escapeHtml,
  type TelegramConfig,
} from '@/lib/telegram';
import { nearest, byCity, emergencyPhones, type CentroHit, type Tipo } from '@/lib/centros-search';
import { queryLocalPersonas, detectTipo } from '@/lib/wa-bot';

// Update de Telegram ya normalizado (desde el webhook).
export interface InboundTelegramMessage {
  id: string; // update_id (dedupe)
  chatId: string;
  type: 'text' | 'location' | 'callback' | 'other';
  text?: string;
  location?: { lat: number; lng: number };
  replyId?: string; // callback_data del botón pulsado
  callbackQueryId?: string; // para responder y cerrar el "cargando" del botón
}

// ---- Estado de conversación (tabla telegram_sessions) ----

async function loadSession(chatId: string) {
  const [row] = await db.select().from(telegramSessions).where(eq(telegramSessions.chatId, chatId)).limit(1);
  return row ?? null;
}

async function saveSession(chatId: string, patch: { tipo?: string | null; lastUpdateId?: string }) {
  await db
    .insert(telegramSessions)
    .values({ chatId, tipo: patch.tipo ?? null, lastUpdateId: patch.lastUpdateId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: telegramSessions.chatId,
      set: { ...patch, updatedAt: new Date() },
    });
}

// ---- Formato de respuestas (HTML de Telegram) ----

function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function estadoTag(estado: string) {
  if (estado === 'lleno') return '🟠 lleno';
  if (estado === 'cerrado') return '🔴 cerrado';
  return '🟢 abierto';
}

function formatHit(h: CentroHit, i: number): string {
  const dist = h.distanceKm != null ? ` · a ${h.distanceKm.toFixed(1)} km` : '';
  const lines = [
    `${i}. <b>${escapeHtml(h.name)}</b> (${estadoTag(h.estado)})${dist}`,
    escapeHtml(h.address || h.ciudad || ''),
    `📍 ${mapsLink(h.lat, h.lng)}`,
    h.contacto ? `📞 ${escapeHtml(h.contacto)}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

function tipoLabel(tipo?: string | null) {
  if (tipo === 'refugio') return 'Refugios';
  if (tipo === 'acopio') return 'Centros de acopio';
  return 'Centros y refugios';
}

function resultsText(hits: CentroHit[], tipo?: string | null, near = false): string {
  const head = `${tipoLabel(tipo)} ${near ? 'más cercanos' : 'encontrados'}:`;
  return `${head}\n\n${hits.map(formatHit).join('\n\n')}`;
}

// Recorta el callback_data a los 64 bytes que permite Telegram.
function cbData(prefix: string, value: string): string {
  const max = 64 - prefix.length;
  return prefix + value.slice(0, Math.max(0, max));
}

// ---- Acciones ----

async function send(label: string, p: Promise<{ ok: boolean; status: number; error?: string }>) {
  const r = await p;
  if (!r.ok) throw new Error(`send ${label} falló: HTTP ${r.status} ${r.error ?? ''}`);
  return r;
}

async function sendWelcome(cfg: TelegramConfig, chatId: string) {
  await send('welcome', sendText(cfg, {
    chatId,
    text:
      '👋 Hola. Te ayudo a obtener información en tiempo real sobre la emergencia:\n\n' +
      '🏠 <b>Refugio:</b> ubica refugios y puntos de resguardo.\n' +
      '📦 <b>Acopio:</b> encuentra centros para llevar o recibir donaciones.\n' +
      '🔍 <b>Buscar Familiar:</b> consulta personas desaparecidas o localizadas.\n\n' +
      '✍️ Escribe <b>telefonos</b> para números de emergencia en cualquier momento.',
    buttons: [
      [
        { text: '🏠 Refugio', data: 'tipo_refugio' },
        { text: '📦 Acopio', data: 'tipo_acopio' },
      ],
      [{ text: '🔍 Buscar Familiar', data: 'buscar_familiar' }],
    ],
  }));
}

async function askLocation(cfg: TelegramConfig, chatId: string, tipo: string) {
  const q = tipo === 'refugio' ? 'refugio' : 'centro de acopio';
  await send('askLocation', sendLocationRequest(cfg, {
    chatId,
    text: `Para encontrar el ${q} más cercano, comparte tu ubicación con el botón de abajo, o escribe el nombre de tu ciudad (ej: <i>Caraballeda</i>).\n\nEscribe <b>menu</b> para volver al inicio.`,
  }));
}

async function sendCityNotFound(cfg: TelegramConfig, chatId: string, city: string, tipo: string) {
  const label = tipo === 'refugio' ? 'refugios' : 'centros de acopio';
  await send('cityNotFound', sendLocationRequest(cfg, {
    chatId,
    text:
      `⚠️ No encontré ${label} registrados en <b>"${escapeHtml(city)}"</b>.\n\n` +
      `Puedes:\n` +
      `📍 Compartir tu ubicación con el botón de abajo.\n` +
      `✍️ Escribir otra ciudad de Venezuela (ej: <i>La Guaira</i>, <i>Chacao</i>, <i>Naiguatá</i>).\n\n` +
      `Escribe <b>menu</b> para regresar al menú.`,
  }));
}

async function askFamiliarPrompt(cfg: TelegramConfig, chatId: string) {
  await send('askFamiliar', sendText(cfg, {
    chatId,
    text:
      '🔍 <b>Búsqueda de personas:</b>\n\n' +
      'Escribe el nombre completo o número de cédula del familiar que deseas buscar.\n\n' +
      'Escribe <b>menu</b> para volver al inicio.',
  }));
}

async function replyFamiliarSearch(cfg: TelegramConfig, chatId: string, text: string) {
  const query = text.trim();
  if (query.length < 2) {
    await send('familiarShort', sendText(cfg, {
      chatId,
      text: '⚠️ El término de búsqueda debe tener al menos 2 letras. Escribe un nombre más completo o número de cédula.',
    }));
    return;
  }

  const results = await queryLocalPersonas(query);
  if (results.length === 0) {
    await send('familiarEmpty', sendText(cfg, {
      chatId,
      text:
        `❌ No encontramos registros para <b>"${escapeHtml(query)}"</b>.\n\n` +
        `Puedes intentar con otro nombre o apellido.\n\n` +
        `Escribe otro nombre para seguir buscando, o <b>menu</b> para volver al menú.`,
    }));
    return;
  }

  const limit = 5;
  const hits = results.slice(0, limit);

  let body = `🔍 <b>Resultados para "${escapeHtml(query)}":</b>\n\n`;
  hits.forEach((p, idx) => {
    const statusIcon = p.tipo === 'localizado' ? '🟢' : '🚨';
    body += `${idx + 1}. ${statusIcon} <b>${escapeHtml(String(p.nombre ?? ''))}</b>\n`;
    body += `• Estado: ${escapeHtml(String(p.status ?? ''))}\n`;
    body += `• Ubicación: ${escapeHtml(String(p.lugar ?? ''))}\n`;
    if (p.cedula) body += `• Cédula/Doc: ${escapeHtml(String(p.cedula))}\n`;
    if (p.observaciones) body += `• Notas: <i>${escapeHtml(String(p.observaciones))}</i>\n`;
    body += `• Fuente: ${escapeHtml(String(p.fuente ?? ''))}\n\n`;
  });

  if (results.length > limit) {
    body += `⚠️ <i>Mostrando ${limit} de ${results.length} coincidencias.</i>\n\n`;
  }

  body += `Escribe otro nombre para buscar, o <b>menu</b> para regresar al inicio.`;

  await send('familiarResults', sendText(cfg, { chatId, text: body }));
}

async function replyNearest(cfg: TelegramConfig, chatId: string, lat: number, lng: number, tipo?: string | null) {
  const tFilter = (tipo === 'refugio' || tipo === 'acopio') ? tipo : undefined;
  const hits = await nearest(lat, lng, { tipo: tFilter, limit: 3 });
  if (hits.length === 0) {
    await send('nearestEmpty', sendText(cfg, { chatId, text: `No encontré ${tipoLabel(tipo).toLowerCase()} cerca.` }));
    return;
  }
  await send('nearest', sendText(cfg, { chatId, text: resultsText(hits, tipo, true) }));
}

async function replyCity(cfg: TelegramConfig, chatId: string, city: string, tipo?: string | null): Promise<boolean> {
  const tFilter = (tipo === 'refugio' || tipo === 'acopio') ? tipo : undefined;
  const hits = await byCity(city, { tipo: tFilter, limit: 5 });
  if (hits.length === 0) return false;
  await send('city', sendText(cfg, { chatId, text: resultsText(hits, tipo, false) }));
  return true;
}

async function replyPhones(cfg: TelegramConfig, chatId: string) {
  const phones = await emergencyPhones({ limit: 6 });
  if (phones.length === 0) {
    await send('phonesEmpty', sendText(cfg, { chatId, text: 'No hay teléfonos de emergencia registrados por ahora.' }));
    return;
  }
  const body =
    '📞 <b>Teléfonos de emergencia:</b>\n\n' +
    phones.map((p) => `• <b>${escapeHtml(p.name)}</b>: ${escapeHtml(p.number)}${p.description ? ` — ${escapeHtml(p.description)}` : ''}`).join('\n');
  await send('phones', sendText(cfg, { chatId, text: body }));
}

// ---- Dispatcher ----

export async function processInboundTelegram(messages: InboundTelegramMessage[]): Promise<{ handled: number }> {
  const cfg = telegramConfig();
  if (!cfg) return { handled: 0 };
  let handled = 0;

  for (const m of messages) {
    if (!m.chatId || !m.id) continue;
    const session = await loadSession(m.chatId);
    if (session?.lastUpdateId === m.id) continue; // idempotencia
    const tipo = session?.tipo ?? null;

    try {
      if (m.callbackQueryId) await answerCallback(cfg, m.callbackQueryId).catch(() => {});

      if (!session) {
        await sendWelcome(cfg, m.chatId);
        await saveSession(m.chatId, { tipo: null, lastUpdateId: m.id });
        handled++;
        continue;
      }

      if (m.type === 'location' && m.location) {
        await replyNearest(cfg, m.chatId, m.location.lat, m.location.lng, tipo);
      } else if (m.type === 'callback' && m.replyId) {
        if (m.replyId === 'tipo_refugio') {
          await saveSession(m.chatId, { tipo: 'refugio' });
          await askLocation(cfg, m.chatId, 'refugio');
        } else if (m.replyId === 'tipo_acopio') {
          await saveSession(m.chatId, { tipo: 'acopio' });
          await askLocation(cfg, m.chatId, 'acopio');
        } else if (m.replyId === 'buscar_familiar') {
          await saveSession(m.chatId, { tipo: 'buscar_familiar' });
          await askFamiliarPrompt(cfg, m.chatId);
        } else if (m.replyId === 'telefonos') {
          await replyPhones(cfg, m.chatId);
        } else if (m.replyId.startsWith('bf_')) {
          const query = m.replyId.substring('bf_'.length);
          await saveSession(m.chatId, { tipo: 'buscar_familiar' });
          await replyFamiliarSearch(cfg, m.chatId, query);
        } else if (m.replyId === 'volver_inicio') {
          await saveSession(m.chatId, { tipo: null });
          await sendWelcome(cfg, m.chatId);
        } else {
          await sendWelcome(cfg, m.chatId);
        }
      } else if (m.type === 'text' && m.text) {
        const text = m.text.trim();
        const textLower = text.toLowerCase();

        if (['menu', 'menú', '/menu', '/start', 'hola', 'inicio', 'asistente', 'start', 'ayuda', '/help'].includes(textLower)) {
          await saveSession(m.chatId, { tipo: null });
          await sendWelcome(cfg, m.chatId);
        } else if (['telefonos', 'teléfonos', 'telefono', 'teléfono', 'contacto', 'emergencia', '/telefonos'].includes(textLower)) {
          await replyPhones(cfg, m.chatId);
        } else {
          const isCedula = /^(v|e)?-?\d{6,9}$/i.test(textLower.replace(/\s+/g, ''));
          const hasFamiliarKeywords = /\b(buscar|familiar|desaparecido|localizado|saber de|cedula|cédula|persona|encuentra|d[oó]nde est[aá])\b/.test(textLower);

          let forceFamiliar = isCedula || hasFamiliarKeywords;
          let searchQuery = text;

          if (hasFamiliarKeywords) {
            searchQuery = text.replace(/\b(buscar a|buscar al familiar|buscar|familiar|desaparecido|localizado|saber de|cedula|cédula|persona|encuentra|d[oó]nde est[aá]n?|d[oó]nde se encuentra)\b/gi, '').trim();
            if (searchQuery.length < 2) searchQuery = text;
          }

          if (forceFamiliar) {
            await saveSession(m.chatId, { tipo: 'buscar_familiar' });
            await replyFamiliarSearch(cfg, m.chatId, searchQuery);
          } else if (tipo === 'buscar_familiar') {
            await replyFamiliarSearch(cfg, m.chatId, text);
          } else {
            const detected = detectTipo(text);
            const activeTipo = detected ?? tipo;

            if (activeTipo && activeTipo !== 'buscar_familiar') {
              const asCity = await replyCity(cfg, m.chatId, text, activeTipo);
              if (asCity) {
                if (detected && detected !== tipo) await saveSession(m.chatId, { tipo: detected });
              } else {
                const peopleResults = await queryLocalPersonas(text);
                if (peopleResults.length > 0) {
                  await saveSession(m.chatId, { tipo: 'buscar_familiar' });
                  await send('autoTransitionNotice', sendText(cfg, {
                    chatId: m.chatId,
                    text: `💡 Detectamos que estás buscando a una persona. Cambié tu conversación a <b>Buscar Familiar</b>.`,
                  }));
                  await replyFamiliarSearch(cfg, m.chatId, text);
                } else if (text.includes(' ')) {
                  await send('clarifyIntent', sendText(cfg, {
                    chatId: m.chatId,
                    text: `⚠️ No encontré ciudades ni registros de personas que coincidan exactamente con <b>"${escapeHtml(text)}"</b>.\n\n¿Qué deseabas hacer?`,
                    buttons: [
                      [{ text: '🔍 Buscar Persona', data: cbData('bf_', text) }],
                      [{ text: '📍 Buscar Ciudad', data: `tipo_${activeTipo}` }],
                      [{ text: '🏠 Menú Principal', data: 'volver_inicio' }],
                    ],
                  }));
                } else {
                  await sendCityNotFound(cfg, m.chatId, text, activeTipo);
                }
              }
            } else if (detected) {
              await saveSession(m.chatId, { tipo: detected });
              await askLocation(cfg, m.chatId, detected);
            } else if (text.includes(' ') && text.length > 5) {
              const peopleResults = await queryLocalPersonas(text);
              if (peopleResults.length > 0) {
                await saveSession(m.chatId, { tipo: 'buscar_familiar' });
                await replyFamiliarSearch(cfg, m.chatId, text);
              } else {
                await sendWelcome(cfg, m.chatId);
              }
            } else {
              await sendWelcome(cfg, m.chatId);
            }
          }
        }
      } else {
        await sendWelcome(cfg, m.chatId);
      }

      await saveSession(m.chatId, { lastUpdateId: m.id });
      handled++;
    } catch (e) {
      console.error(`[telegram-bot] error procesando ${m.id} (${m.type}):`, e instanceof Error ? e.message : e);
    }
  }

  return { handled };
}
