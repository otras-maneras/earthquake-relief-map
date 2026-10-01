import { config, isPersonasSearchEnabled, mapUrl, searchUrl } from '../config.js';
import { getWaSession, upsertWaSession } from '../db/sessions.js';
import {
  kapsoConfig,
  sendText,
  sendButtons,
  sendLocationRequest,
  type KapsoConfig,
} from '../channels/kapso.js';
import {
  searchCentrosNear,
  searchCentrosByCity,
  listEmergencyPhones,
  searchPersonas,
  type CentroHit,
} from '../providers/http-data.js';
import { detectTipo, estadoTag, mapsLink } from './shared.js';

export interface InboundMessage {
  id: string;
  from: string;
  type: 'text' | 'location' | 'interactive' | 'other';
  text?: string;
  location?: { lat: number; lng: number };
  replyId?: string;
}

function tipoLabel(tipo?: string | null): string {
  if (tipo === 'refugio') return 'Refugios';
  if (tipo === 'acopio') return 'Centros de acopio';
  return 'Centros y refugios';
}

function formatHit(h: CentroHit, i: number): string {
  const dist = h.distanceKm != null ? ` · a ${h.distanceKm.toFixed(1)} km` : '';
  const lines = [
    `${i}. *${h.name}* (${estadoTag(h.estado)})${dist}`,
    h.address || h.ciudad || '',
    `📍 ${mapsLink(h.lat, h.lng)}`,
    h.contacto ? `📞 ${h.contacto}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

function resultsText(hits: CentroHit[], tipo?: string | null, near = false): string {
  const head = `${tipoLabel(tipo)} ${near ? 'más cercanos' : 'encontrados'}:`;
  return `${head}\n\n${hits.map(formatHit).join('\n\n')}\n\nMás info y mapa: ${mapUrl()}`;
}

async function send(label: string, p: Promise<{ ok: boolean; status: number; error?: string }>) {
  const r = await p;
  if (!r.ok) throw new Error(`send ${label} falló: HTTP ${r.status} ${r.error ?? ''}`);
  return r;
}

function welcomeBody(): { body: string; buttons: { id: string; title: string }[] } {
  const brand = config.botBrandedWelcome && config.botName ? `, soy *${config.botName}*` : '';
  const familiarLine = isPersonasSearchEnabled()
    ? '🔍 *Buscar Familiar:* Consulta personas desaparecidas o localizadas.\n'
    : '';
  const familiarBtn = isPersonasSearchEnabled()
    ? [{ id: 'buscar_familiar', title: '🔍 Buscar Familiar' }]
    : [];
  return {
    body:
      `👋 Hola${brand}.\n\n` +
      `${config.botWelcomeIntro}\n\n` +
      '🏠 *Refugio:* Ubica refugios y puntos de resguardo.\n' +
      '📦 *Acopio:* Encuentra centros para llevar o recibir donaciones.\n' +
      familiarLine +
      '✍️ Escribe *telefonos* para números de emergencia en cualquier momento.',
    buttons: [
      { id: 'tipo_refugio', title: '🏠 Refugio' },
      { id: 'tipo_acopio', title: '📦 Acopio' },
      ...familiarBtn,
    ].slice(0, 3),
  };
}

async function sendWelcome(cfg: KapsoConfig, to: string) {
  const w = welcomeBody();
  await send('welcome', sendButtons(cfg, { to, body: w.body, buttons: w.buttons }));
}

async function askLocation(cfg: KapsoConfig, to: string, tipo: string) {
  const q = tipo === 'refugio' ? 'refugio' : 'centro de acopio';
  await send(
    'askLocation',
    sendLocationRequest(cfg, {
      to,
      body: `Para encontrar el ${q} más cercano, comparte tu ubicación 📍 usando el botón de abajo, o escribe el nombre de tu ciudad.\n\nEscribe *menu* para volver al inicio.`,
    }),
  );
}

async function sendCityNotFound(cfg: KapsoConfig, to: string, city: string, tipo: string) {
  const label = tipo === 'refugio' ? 'refugios' : 'centros de acopio';
  await send(
    'cityNotFound',
    sendLocationRequest(cfg, {
      to,
      body:
        `⚠️ No encontré ${label} registrados en *"${city}"*.\n\n` +
        `Puedes:\n📍 Compartir tu ubicación con el botón de abajo.\n✍️ Escribir otra ciudad.\n\nEscribe *menu* para regresar.`,
    }),
  );
}

async function askFamiliarPrompt(cfg: KapsoConfig, to: string) {
  await send(
    'askFamiliar',
    sendText(cfg, {
      to,
      body:
        '🔍 *Búsqueda de personas:*\n\nEscribe el **nombre completo o número de cédula** del familiar que deseas buscar.\n\nEscribe *menu* para volver al inicio.',
    }),
  );
}

async function replyFamiliarSearch(cfg: KapsoConfig, to: string, text: string) {
  if (!isPersonasSearchEnabled()) {
    await send(
      'familiarDisabled',
      sendText(cfg, { to, body: 'La búsqueda de personas no está habilitada en este despliegue.' }),
    );
    return;
  }
  const query = text.trim();
  if (query.length < 2) {
    await send(
      'familiarShort',
      sendText(cfg, {
        to,
        body: '⚠️ El término de búsqueda debe tener al menos 2 letras.',
      }),
    );
    return;
  }

  const results = await searchPersonas(query);
  if (results.length === 0) {
    const webHint = searchUrl() ? `\n\nConsulta el listado completo en ${searchUrl()}` : '';
    await send(
      'familiarEmpty',
      sendText(cfg, {
        to,
        body: `❌ No encontramos registros para *"${query}"*.${webHint}\n\nEscribe otro nombre o *menu* para volver.`,
      }),
    );
    return;
  }

  const limit = 5;
  const hits = results.slice(0, limit);
  let body = `🔍 *Resultados para "${query}":*\n\n`;
  hits.forEach((p, idx) => {
    const statusIcon = p.tipo === 'localizado' ? '🟢' : '🚨';
    body += `${idx + 1}. ${statusIcon} *${p.nombre}*\n`;
    body += `• *Estado:* ${p.status}\n`;
    body += `• *Ubicación:* ${p.lugar}\n`;
    if (p.cedula) body += `• *Cédula/Doc:* ${p.cedula}\n`;
    if (p.observaciones) body += `• *Notas:* _${p.observaciones}_\n`;
    if (p.fuente) body += `• *Fuente:* ${p.fuente}\n`;
    body += '\n';
  });
  if (results.length > limit) {
    body += `⚠️ _Mostrando ${limit} de ${results.length} coincidencias._\n\n`;
  }
  body += 'Escribe otro nombre para buscar, o *menu* para regresar.';
  await send('familiarResults', sendText(cfg, { to, body }));
}

async function replyNearest(cfg: KapsoConfig, to: string, lat: number, lng: number, tipo?: string | null) {
  const tFilter = tipo === 'refugio' || tipo === 'acopio' ? tipo : 'acopio';
  const hits = await searchCentrosNear(lat, lng, tFilter, 15, 3);
  if (hits.length === 0) {
    await send(
      'nearestEmpty',
      sendText(cfg, {
        to,
        body: `No encontré ${tipoLabel(tipo).toLowerCase()} cerca. Mira el mapa completo en ${mapUrl()}`,
      }),
    );
    return;
  }
  await send('nearest', sendText(cfg, { to, body: resultsText(hits, tipo, true) }));
}

async function replyCity(cfg: KapsoConfig, to: string, city: string, tipo?: string | null): Promise<boolean> {
  const tFilter = tipo === 'refugio' || tipo === 'acopio' ? tipo : 'acopio';
  const hits = await searchCentrosByCity(city, tFilter, 5);
  if (hits.length === 0) return false;
  await send('city', sendText(cfg, { to, body: resultsText(hits, tipo, false) }));
  return true;
}

async function replyPhones(cfg: KapsoConfig, to: string) {
  const phones = await listEmergencyPhones(6);
  if (phones.length === 0) {
    await send(
      'phonesEmpty',
      sendText(cfg, { to, body: `Consulta los teléfonos de emergencia en ${mapUrl()}` }),
    );
    return;
  }
  const body =
    '📞 *Teléfonos de emergencia:*\n\n' +
    phones.map((p) => `• *${p.name}*: ${p.contacto ?? '—'}${p.address ? ` — ${p.address}` : ''}`).join('\n') +
    `\n\nMás info: ${mapUrl()}`;
  await send('phones', sendText(cfg, { to, body }));
}

export async function processInbound(messages: InboundMessage[]): Promise<{ handled: number }> {
  const cfg = kapsoConfig();
  if (!cfg) return { handled: 0 };
  let handled = 0;

  for (const m of messages) {
    if (!m.from || !m.id) continue;
    const session = await getWaSession(m.from);
    if (session?.last_msg_id === m.id) continue;
    const tipo = session?.tipo ?? null;

    try {
      if (!session) {
        await sendWelcome(cfg, m.from);
        await upsertWaSession(m.from, { tipo: null, last_msg_id: m.id });
        handled++;
        continue;
      }

      if (m.type === 'location' && m.location) {
        await replyNearest(cfg, m.from, m.location.lat, m.location.lng, tipo);
      } else if (m.type === 'interactive' && m.replyId) {
        if (m.replyId === 'tipo_refugio') {
          await upsertWaSession(m.from, { tipo: 'refugio' });
          await askLocation(cfg, m.from, 'refugio');
        } else if (m.replyId === 'tipo_acopio') {
          await upsertWaSession(m.from, { tipo: 'acopio' });
          await askLocation(cfg, m.from, 'acopio');
        } else if (m.replyId === 'buscar_familiar') {
          await upsertWaSession(m.from, { tipo: 'buscar_familiar' });
          await askFamiliarPrompt(cfg, m.from);
        } else if (m.replyId === 'telefonos') {
          await replyPhones(cfg, m.from);
        } else if (m.replyId.startsWith('buscar_familiar_')) {
          const query = m.replyId.substring('buscar_familiar_'.length);
          await upsertWaSession(m.from, { tipo: 'buscar_familiar' });
          await replyFamiliarSearch(cfg, m.from, query);
        } else if (m.replyId === 'volver_inicio') {
          await upsertWaSession(m.from, { tipo: null });
          await sendWelcome(cfg, m.from);
        } else {
          await sendWelcome(cfg, m.from);
        }
      } else if (m.type === 'text' && m.text) {
        const text = m.text.trim();
        const textLower = text.toLowerCase();

        if (['menu', 'menú', 'hola', 'inicio', 'asistente', 'start', 'ayuda'].includes(textLower)) {
          await upsertWaSession(m.from, { tipo: null });
          await sendWelcome(cfg, m.from);
        } else if (['telefonos', 'teléfonos', 'telefono', 'teléfono', 'contacto', 'emergencia'].includes(textLower)) {
          await replyPhones(cfg, m.from);
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
            await upsertWaSession(m.from, { tipo: 'buscar_familiar' });
            await replyFamiliarSearch(cfg, m.from, searchQuery);
          } else if (tipo === 'buscar_familiar') {
            await replyFamiliarSearch(cfg, m.from, text);
          } else {
            const detected = detectTipo(text);
            const activeTipo = detected ?? tipo;

            if (activeTipo && activeTipo !== 'buscar_familiar') {
              const asCity = await replyCity(cfg, m.from, text, activeTipo);
              if (asCity) {
                if (detected && detected !== tipo) await upsertWaSession(m.from, { tipo: detected });
              } else if (isPersonasSearchEnabled()) {
                const peopleResults = await searchPersonas(text);
                if (peopleResults.length > 0) {
                  await upsertWaSession(m.from, { tipo: 'buscar_familiar' });
                  await send(
                    'autoTransitionNotice',
                    sendText(cfg, {
                      to: m.from,
                      body: '💡 *Nota:* Detectamos que estás buscando a una persona. Cambié tu conversación a *Buscar Familiar*.',
                    }),
                  );
                  await replyFamiliarSearch(cfg, m.from, text);
                } else if (text.includes(' ')) {
                  await send(
                    'clarifyIntent',
                    sendButtons(cfg, {
                      to: m.from,
                      body: `⚠️ No encontré ciudades ni registros de personas que coincidan con *"${text}"*.\n\n¿Qué deseabas hacer?`,
                      buttons: [
                        { id: `buscar_familiar_${text}`, title: '🔍 Buscar Persona' },
                        { id: `tipo_${activeTipo}`, title: '📍 Buscar Ciudad' },
                        { id: 'volver_inicio', title: '🏠 Menú' },
                      ],
                    }),
                  );
                } else {
                  await sendCityNotFound(cfg, m.from, text, activeTipo);
                }
              } else {
                await sendCityNotFound(cfg, m.from, text, activeTipo);
              }
            } else if (detected) {
              await upsertWaSession(m.from, { tipo: detected });
              await askLocation(cfg, m.from, detected);
            } else if (isPersonasSearchEnabled() && text.includes(' ') && text.length > 5) {
              const peopleResults = await searchPersonas(text);
              if (peopleResults.length > 0) {
                await upsertWaSession(m.from, { tipo: 'buscar_familiar' });
                await replyFamiliarSearch(cfg, m.from, text);
              } else {
                await sendWelcome(cfg, m.from);
              }
            } else {
              await sendWelcome(cfg, m.from);
            }
          }
        }
      } else {
        await sendWelcome(cfg, m.from);
      }

      await upsertWaSession(m.from, { last_msg_id: m.id });
      handled++;
    } catch (e) {
      console.error(`[wa-bot] error ${m.id}:`, e instanceof Error ? e.message : e);
    }
  }

  return { handled };
}
