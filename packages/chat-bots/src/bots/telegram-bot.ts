import { config, isPersonasSearchEnabled, searchUrl } from '../config.js';
import { getTgSession, upsertTgSession } from '../db/sessions.js';
import {
  telegramConfig,
  sendText,
  sendLocationRequest,
  answerCallback,
  escapeHtml,
  type TelegramConfig,
} from '../channels/telegram.js';
import {
  searchCentrosNear,
  searchCentrosByCity,
  listEmergencyPhones,
  searchPersonas,
  type CentroHit,
} from '../providers/http-data.js';
import { detectTipo, estadoTag, mapsLink } from './shared.js';

export interface InboundTelegramMessage {
  id: string;
  chatId: string;
  type: 'text' | 'location' | 'callback' | 'other';
  text?: string;
  location?: { lat: number; lng: number };
  replyId?: string;
  callbackQueryId?: string;
}

function tipoLabel(tipo?: string | null): string {
  if (tipo === 'refugio') return 'Refugios';
  if (tipo === 'acopio') return 'Centros de acopio';
  return 'Centros y refugios';
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

function resultsText(hits: CentroHit[], tipo?: string | null, near = false): string {
  const head = `${tipoLabel(tipo)} ${near ? 'más cercanos' : 'encontrados'}:`;
  return `${head}\n\n${hits.map(formatHit).join('\n\n')}`;
}

function cbData(prefix: string, value: string): string {
  const max = 64 - prefix.length;
  return prefix + value.slice(0, Math.max(0, max));
}

async function send(label: string, p: Promise<{ ok: boolean; status: number; error?: string }>) {
  const r = await p;
  if (!r.ok) throw new Error(`send ${label} falló: HTTP ${r.status} ${r.error ?? ''}`);
  return r;
}

async function sendWelcome(cfg: TelegramConfig, chatId: string) {
  const familiarLine = isPersonasSearchEnabled()
    ? '🔍 <b>Buscar Familiar:</b> consulta personas desaparecidas o localizadas.\n'
    : '';
  const buttons: { text: string; data: string }[][] = [
    [
      { text: '🏠 Refugio', data: 'tipo_refugio' },
      { text: '📦 Acopio', data: 'tipo_acopio' },
    ],
  ];
  if (isPersonasSearchEnabled()) {
    buttons.push([{ text: '🔍 Buscar Familiar', data: 'buscar_familiar' }]);
  }
  await send(
    'welcome',
    sendText(cfg, {
      chatId,
      text:
        `👋 Hola. ${escapeHtml(config.botWelcomeIntro)}\n\n` +
        '🏠 <b>Refugio:</b> ubica refugios y puntos de resguardo.\n' +
        '📦 <b>Acopio:</b> encuentra centros para llevar o recibir donaciones.\n' +
        familiarLine +
        '✍️ Escribe <b>telefonos</b> para números de emergencia en cualquier momento.',
      buttons,
    }),
  );
}

async function askLocation(cfg: TelegramConfig, chatId: string, tipo: string) {
  const q = tipo === 'refugio' ? 'refugio' : 'centro de acopio';
  await send(
    'askLocation',
    sendLocationRequest(cfg, {
      chatId,
      text: `Para encontrar el ${q} más cercano, comparte tu ubicación con el botón de abajo, o escribe el nombre de tu ciudad.\n\nEscribe <b>menu</b> para volver al inicio.`,
    }),
  );
}

async function sendCityNotFound(cfg: TelegramConfig, chatId: string, city: string, tipo: string) {
  const label = tipo === 'refugio' ? 'refugios' : 'centros de acopio';
  await send(
    'cityNotFound',
    sendLocationRequest(cfg, {
      chatId,
      text:
        `⚠️ No encontré ${label} registrados en <b>"${escapeHtml(city)}"</b>.\n\n` +
        `Puedes compartir ubicación o escribir otra ciudad.\n\nEscribe <b>menu</b> para regresar.`,
    }),
  );
}

async function askFamiliarPrompt(cfg: TelegramConfig, chatId: string) {
  await send(
    'askFamiliar',
    sendText(cfg, {
      chatId,
      text:
        '🔍 <b>Búsqueda de personas:</b>\n\nEscribe el nombre completo o número de cédula.\n\nEscribe <b>menu</b> para volver.',
    }),
  );
}

async function replyFamiliarSearch(cfg: TelegramConfig, chatId: string, text: string) {
  if (!isPersonasSearchEnabled()) {
    await send(
      'familiarDisabled',
      sendText(cfg, { chatId, text: 'La búsqueda de personas no está habilitada.' }),
    );
    return;
  }
  const query = text.trim();
  if (query.length < 2) {
    await send(
      'familiarShort',
      sendText(cfg, { chatId, text: '⚠️ El término debe tener al menos 2 letras.' }),
    );
    return;
  }

  const results = await searchPersonas(query);
  if (results.length === 0) {
    const webHint = searchUrl() ? `\n\nConsulta ${escapeHtml(searchUrl())}` : '';
    await send(
      'familiarEmpty',
      sendText(cfg, {
        chatId,
        text: `❌ No encontramos registros para <b>"${escapeHtml(query)}"</b>.${webHint}`,
      }),
    );
    return;
  }

  const limit = 5;
  const hits = results.slice(0, limit);
  let body = `🔍 <b>Resultados para "${escapeHtml(query)}":</b>\n\n`;
  hits.forEach((p, idx) => {
    const statusIcon = p.tipo === 'localizado' ? '🟢' : '🚨';
    body += `${idx + 1}. ${statusIcon} <b>${escapeHtml(p.nombre)}</b>\n`;
    body += `• Estado: ${escapeHtml(p.status)}\n`;
    body += `• Ubicación: ${escapeHtml(p.lugar)}\n`;
    if (p.cedula) body += `• Cédula/Doc: ${escapeHtml(p.cedula)}\n`;
    if (p.observaciones) body += `• Notas: <i>${escapeHtml(p.observaciones)}</i>\n`;
    if (p.fuente) body += `• Fuente: ${escapeHtml(p.fuente)}\n`;
    body += '\n';
  });
  if (results.length > limit) {
    body += `⚠️ <i>Mostrando ${limit} de ${results.length} coincidencias.</i>\n\n`;
  }
  body += 'Escribe otro nombre o <b>menu</b> para regresar.';
  await send('familiarResults', sendText(cfg, { chatId, text: body }));
}

async function replyNearest(cfg: TelegramConfig, chatId: string, lat: number, lng: number, tipo?: string | null) {
  const tFilter = tipo === 'refugio' || tipo === 'acopio' ? tipo : 'acopio';
  const hits = await searchCentrosNear(lat, lng, tFilter, 15, 3);
  if (hits.length === 0) {
    await send(
      'nearestEmpty',
      sendText(cfg, { chatId, text: `No encontré ${tipoLabel(tipo).toLowerCase()} cerca.` }),
    );
    return;
  }
  await send('nearest', sendText(cfg, { chatId, text: resultsText(hits, tipo, true) }));
}

async function replyCity(cfg: TelegramConfig, chatId: string, city: string, tipo?: string | null): Promise<boolean> {
  const tFilter = tipo === 'refugio' || tipo === 'acopio' ? tipo : 'acopio';
  const hits = await searchCentrosByCity(city, tFilter, 5);
  if (hits.length === 0) return false;
  await send('city', sendText(cfg, { chatId, text: resultsText(hits, tipo, false) }));
  return true;
}

async function replyPhones(cfg: TelegramConfig, chatId: string) {
  const phones = await listEmergencyPhones(6);
  if (phones.length === 0) {
    await send('phonesEmpty', sendText(cfg, { chatId, text: 'No hay teléfonos de emergencia registrados.' }));
    return;
  }
  const body =
    '📞 <b>Teléfonos de emergencia:</b>\n\n' +
    phones
      .map(
        (p) =>
          `• <b>${escapeHtml(p.name)}</b>: ${escapeHtml(p.contacto ?? '—')}${p.address ? ` — ${escapeHtml(p.address)}` : ''}`,
      )
      .join('\n');
  await send('phones', sendText(cfg, { chatId, text: body }));
}

export async function processInboundTelegram(messages: InboundTelegramMessage[]): Promise<{ handled: number }> {
  const cfg = telegramConfig();
  if (!cfg) return { handled: 0 };
  let handled = 0;

  for (const m of messages) {
    if (!m.chatId || !m.id) continue;
    const session = await getTgSession(m.chatId);
    if (session?.last_update_id === m.id) continue;
    const tipo = session?.tipo ?? null;

    try {
      if (m.callbackQueryId) await answerCallback(cfg, m.callbackQueryId).catch(() => {});

      if (!session) {
        await sendWelcome(cfg, m.chatId);
        await upsertTgSession(m.chatId, { tipo: null, last_update_id: m.id });
        handled++;
        continue;
      }

      if (m.type === 'location' && m.location) {
        await replyNearest(cfg, m.chatId, m.location.lat, m.location.lng, tipo);
      } else if (m.type === 'callback' && m.replyId) {
        if (m.replyId === 'tipo_refugio') {
          await upsertTgSession(m.chatId, { tipo: 'refugio' });
          await askLocation(cfg, m.chatId, 'refugio');
        } else if (m.replyId === 'tipo_acopio') {
          await upsertTgSession(m.chatId, { tipo: 'acopio' });
          await askLocation(cfg, m.chatId, 'acopio');
        } else if (m.replyId === 'buscar_familiar') {
          await upsertTgSession(m.chatId, { tipo: 'buscar_familiar' });
          await askFamiliarPrompt(cfg, m.chatId);
        } else if (m.replyId === 'telefonos') {
          await replyPhones(cfg, m.chatId);
        } else if (m.replyId.startsWith('bf_')) {
          const query = m.replyId.substring('bf_'.length);
          await upsertTgSession(m.chatId, { tipo: 'buscar_familiar' });
          await replyFamiliarSearch(cfg, m.chatId, query);
        } else if (m.replyId === 'volver_inicio') {
          await upsertTgSession(m.chatId, { tipo: null });
          await sendWelcome(cfg, m.chatId);
        } else {
          await sendWelcome(cfg, m.chatId);
        }
      } else if (m.type === 'text' && m.text) {
        const text = m.text.trim();
        const textLower = text.toLowerCase();

        if (['menu', 'menú', '/menu', '/start', 'hola', 'inicio', 'asistente', 'start', 'ayuda', '/help'].includes(textLower)) {
          await upsertTgSession(m.chatId, { tipo: null });
          await sendWelcome(cfg, m.chatId);
        } else if (['telefonos', 'teléfonos', 'telefono', 'teléfono', 'contacto', 'emergencia', '/telefonos'].includes(textLower)) {
          await replyPhones(cfg, m.chatId);
        } else {
          const isCedula = /^(v|e)?-?\d{6,9}$/i.test(textLower.replace(/\s+/g, ''));
          const hasFamiliarKeywords =
            isPersonasSearchEnabled() &&
            /\b(buscar|familiar|desaparecido|localizado|saber de|cedula|cédula|persona|encuentra|d[oó]nde est[aá])\b/.test(
              textLower,
            );
          let forceFamiliar = isPersonasSearchEnabled() && (isCedula || hasFamiliarKeywords);
          let searchQuery = text;

          if (hasFamiliarKeywords) {
            searchQuery = text
              .replace(
                /\b(buscar a|buscar al familiar|buscar|familiar|desaparecido|localizado|saber de|cedula|cédula|persona|encuentra|d[oó]nde est[aá]n?|d[oó]nde se encuentra)\b/gi,
                '',
              )
              .trim();
            if (searchQuery.length < 2) searchQuery = text;
          }

          if (forceFamiliar) {
            await upsertTgSession(m.chatId, { tipo: 'buscar_familiar' });
            await replyFamiliarSearch(cfg, m.chatId, searchQuery);
          } else if (tipo === 'buscar_familiar') {
            await replyFamiliarSearch(cfg, m.chatId, text);
          } else {
            const detected = detectTipo(text);
            const activeTipo = detected ?? tipo;

            if (activeTipo && activeTipo !== 'buscar_familiar') {
              const asCity = await replyCity(cfg, m.chatId, text, activeTipo);
              if (asCity) {
                if (detected && detected !== tipo) await upsertTgSession(m.chatId, { tipo: detected });
              } else if (isPersonasSearchEnabled()) {
                const peopleResults = await searchPersonas(text);
                if (peopleResults.length > 0) {
                  await upsertTgSession(m.chatId, { tipo: 'buscar_familiar' });
                  await send(
                    'autoTransitionNotice',
                    sendText(cfg, {
                      chatId: m.chatId,
                      text: '💡 Detectamos que estás buscando a una persona. Cambié tu conversación a <b>Buscar Familiar</b>.',
                    }),
                  );
                  await replyFamiliarSearch(cfg, m.chatId, text);
                } else if (text.includes(' ')) {
                  await send(
                    'clarifyIntent',
                    sendText(cfg, {
                      chatId: m.chatId,
                      text: `⚠️ No encontré ciudades ni registros que coincidan con <b>"${escapeHtml(text)}"</b>.`,
                      buttons: [
                        [{ text: '🔍 Buscar Persona', data: cbData('bf_', text) }],
                        [{ text: '📍 Buscar Ciudad', data: `tipo_${activeTipo}` }],
                        [{ text: '🏠 Menú', data: 'volver_inicio' }],
                      ],
                    }),
                  );
                } else {
                  await sendCityNotFound(cfg, m.chatId, text, activeTipo);
                }
              } else {
                await sendCityNotFound(cfg, m.chatId, text, activeTipo);
              }
            } else if (detected) {
              await upsertTgSession(m.chatId, { tipo: detected });
              await askLocation(cfg, m.chatId, detected);
            } else if (isPersonasSearchEnabled() && text.includes(' ') && text.length > 5) {
              const peopleResults = await searchPersonas(text);
              if (peopleResults.length > 0) {
                await upsertTgSession(m.chatId, { tipo: 'buscar_familiar' });
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

      await upsertTgSession(m.chatId, { last_update_id: m.id });
      handled++;
    } catch (e) {
      console.error(`[telegram-bot] error ${m.id}:`, e instanceof Error ? e.message : e);
    }
  }

  return { handled };
}
