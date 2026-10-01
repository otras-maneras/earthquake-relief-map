// Bot entrante de WhatsApp para buscar centros de acopio / refugios / personas.
// Responde con MENSAJES DE SESIÓN (ventana de 24 h abierta porque el usuario
// escribió primero) → no requiere plantillas aprobadas de Meta.
//
// Flujo optimizado y autocorrectivo:
//   texto/saludo        → menú con botones (Refugio / Acopio / Buscar Familiar)
//   botón tipo_*        → guarda el filtro y pide ubicación o ciudad
//   ubicación (pin)     → los 3 más cercanos del tipo elegido (o mixtos si no hay tipo)
//   texto = ciudad      → resultados de esa ciudad (si falla, avisa y da opción de reintentar)
//   texto = telefonos   → teléfonos de emergencia
//   botón familiar      → pide nombre/cédula
//   estado familiar     → busca en APIs consolidadas de personas y devuelve resultados
//   comando menu/inicio → limpia el estado y vuelve al menú principal
//   autocorrección      → detecta si el usuario escribe nombres/cédulas en estados incorrectos y redirige.

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { waSessions } from '@/db/schema';
import { kapsoConfig, sendText, sendButtons, sendLocationRequest, type KapsoConfig } from '@/lib/kapso';
import { nearest, byCity, emergencyPhones, type CentroHit, type Tipo } from '@/lib/centros-search';

// Mensaje entrante ya normalizado (desde el webhook).
export interface InboundMessage {
  id: string;
  from: string; // wa-id del usuario
  type: 'text' | 'location' | 'interactive' | 'other';
  text?: string;
  location?: { lat: number; lng: number };
  replyId?: string; // id del botón/lista pulsado
}

const SITE = 'https://acopiove.org';

// ---- Estado de conversación (tabla wa_sessions) ----

async function loadSession(phone: string) {
  const [row] = await db.select().from(waSessions).where(eq(waSessions.phone, phone)).limit(1);
  return row ?? null;
}

async function saveSession(phone: string, patch: { tipo?: string | null; lastMsgId?: string }) {
  await db
    .insert(waSessions)
    .values({ phone, tipo: patch.tipo ?? null, lastMsgId: patch.lastMsgId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: waSessions.phone,
      set: { ...patch, updatedAt: new Date() },
    });
}

// ---- Formato de respuestas ----

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
    `${i}. *${h.name}* (${estadoTag(h.estado)})${dist}`,
    h.address || h.ciudad || '',
    `📍 ${mapsLink(h.lat, h.lng)}`,
    h.contacto ? `📞 ${h.contacto}` : '',
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
  return `${head}\n\n${hits.map(formatHit).join('\n\n')}\n\nMás info y mapa: ${SITE}`;
}

// ---- Acciones ----

async function send(label: string, p: Promise<{ ok: boolean; status: number; error?: string }>) {
  const r = await p;
  if (!r.ok) throw new Error(`send ${label} falló: HTTP ${r.status} ${r.error ?? ''}`);
  return r;
}

async function sendWelcome(cfg: KapsoConfig, to: string) {
  await send('welcome', sendButtons(cfg, {
    to,
    body:
      '👋 Hola, soy el asistente oficial de *AcopioVE*.\n\n' +
      'Te ayudo a obtener información crítica en tiempo real sobre el sismo:\n\n' +
      '🏠 *Refugio:* Ubica refugios y puntos de resguardo.\n' +
      '📦 *Acopio:* Encuentra centros para llevar o recibir donaciones.\n' +
      '🔍 *Buscar Familiar:* Consulta personas desaparecidas o localizadas en hospitales.\n\n' +
      '✍️ Escribe *telefonos* para números de emergencia en cualquier momento.',
    buttons: [
      { id: 'tipo_refugio', title: '🏠 Refugio' },
      { id: 'tipo_acopio', title: '📦 Acopio' },
      { id: 'buscar_familiar', title: '🔍 Buscar Familiar' },
    ],
  }));
}

async function askLocation(cfg: KapsoConfig, to: string, tipo: string) {
  const q = tipo === 'refugio' ? 'refugio' : 'centro de acopio';
  await send('askLocation', sendLocationRequest(cfg, {
    to,
    body: `Para encontrar el ${q} más cercano, comparte tu ubicación 📍 usando el botón de abajo, o escribe el nombre de tu ciudad (ej: *Caraballeda*).\n\nEscribe *menu* para volver al inicio.`,
  }));
}

async function sendCityNotFound(cfg: KapsoConfig, to: string, city: string, tipo: string) {
  const label = tipo === 'refugio' ? 'refugios' : 'centros de acopio';
  await send('cityNotFound', sendLocationRequest(cfg, {
    to,
    body:
      `⚠️ No encontré ${label} registrados en *"${city}"*.\n\n` +
      `Puedes:\n` +
      `📍 Compartir tu ubicación con el botón de abajo.\n` +
      `✍️ Escribir otra ciudad de Venezuela (ej: *La Guaira*, *Chacao*, *Naiguatá*).\n\n` +
      `Escribe *menu* para regresar al menú de bienvenida.`,
  }));
}

async function askFamiliarPrompt(cfg: KapsoConfig, to: string) {
  await send('askFamiliar', sendText(cfg, {
    to,
    body:
      '🔍 *Búsqueda de personas (AcopioVE):*\n\n' +
      'Por favor, escribe el **nombre completo o número de cédula** del familiar que deseas buscar. ' +
      'Consultaré de inmediato en los registros de SOS Venezuela y Localizados Venezuela.\n\n' +
      'Escribe *menu* para volver al inicio.',
  }));
}

// Exportado: lo reusa también el bot de Telegram (mismo endpoint local de personas).
export async function queryLocalPersonas(query: string): Promise<any[]> {
  try {
    const res = await fetch(`http://127.0.0.1:4100/api/personas?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const body = await res.json();
    return body.data || [];
  } catch (err) {
    console.error('Error consultando API local de personas:', err);
    return [];
  }
}

async function replyFamiliarSearch(cfg: KapsoConfig, to: string, text: string) {
  const query = text.trim();
  if (query.length < 2) {
    await send('familiarShort', sendText(cfg, {
      to,
      body: '⚠️ El término de búsqueda debe tener al menos 2 letras. Por favor, escribe un nombre más completo o número de cédula.',
    }));
    return;
  }

  const results = await queryLocalPersonas(query);
  if (results.length === 0) {
    await send('familiarEmpty', sendText(cfg, {
      to,
      body:
        `❌ No encontramos registros para *"${query}"*.\n\n` +
        `Puedes intentar con otro nombre o apellido, o buscar en la web completa para ver fotos e información: acopiove.org/busquedas\n\n` +
        `Escribe otro nombre para seguir buscando, o *menu* para volver al menú.`,
    }));
    return;
  }

  const limit = 5;
  const hits = results.slice(0, limit);

  let body = `🔍 *Resultados de búsqueda para "${query}":*\n\n`;
  hits.forEach((p, idx) => {
    const statusIcon = p.tipo === 'localizado' ? '🟢' : '🚨';
    body += `${idx + 1}. ${statusIcon} *${p.nombre}*\n`;
    body += `• *Estado:* ${p.status}\n`;
    body += `• *Ubicación:* ${p.lugar}\n`;
    if (p.cedula) body += `• *Cédula/Doc:* ${p.cedula}\n`;
    if (p.observaciones) body += `• *Notas:* _${p.observaciones}_\n`;
    body += `• *Fuente:* ${p.fuente}\n\n`;
  });

  if (results.length > limit) {
    body += `⚠️ _Mostrando ${limit} de ${results.length} coincidencias. Consulta el listado completo con fotos en acopiove.org/busquedas_\n\n`;
  }

  body += `Escribe otro nombre para buscar, o *menu* para regresar al inicio.`;

  await send('familiarResults', sendText(cfg, { to, body }));
}

async function replyNearest(cfg: KapsoConfig, to: string, lat: number, lng: number, tipo?: string | null) {
  const tFilter = (tipo === 'refugio' || tipo === 'acopio') ? tipo : undefined;
  const hits = await nearest(lat, lng, { tipo: tFilter, limit: 3 });
  if (hits.length === 0) {
    await send('nearestEmpty', sendText(cfg, { to, body: `No encontré ${tipoLabel(tipo).toLowerCase()} cerca. Mira el mapa completo en ${SITE}` }));
    return;
  }
  await send('nearest', sendText(cfg, { to, body: resultsText(hits, tipo, true) }));
}

async function replyCity(cfg: KapsoConfig, to: string, city: string, tipo?: string | null): Promise<boolean> {
  const tFilter = (tipo === 'refugio' || tipo === 'acopio') ? tipo : undefined;
  const hits = await byCity(city, { tipo: tFilter, limit: 5 });
  if (hits.length === 0) return false;
  await send('city', sendText(cfg, { to, body: resultsText(hits, tipo, false) }));
  return true;
}

async function replyPhones(cfg: KapsoConfig, to: string) {
  const phones = await emergencyPhones({ limit: 6 });
  if (phones.length === 0) {
    await send('phonesEmpty', sendText(cfg, { to, body: `Consulta los teléfonos de emergencia en ${SITE}` }));
    return;
  }
  const body =
    '📞 *Teléfonos de emergencia:*\n\n' +
    phones.map((p) => `• *${p.name}*: ${p.number}${p.description ? ` — ${p.description}` : ''}`).join('\n') +
    `\n\nMás info: ${SITE}`;
  await send('phones', sendText(cfg, { to, body }));
}

// Detecta tipo a partir de palabras clave del texto. Exportado: lo reusa Telegram.
export function detectTipo(text: string): Tipo | undefined {
  const t = text.toLowerCase();
  if (/refugi|albergue|dormir|techo/.test(t)) return 'refugio';
  if (/acopi|donar|donaci|llevar|ayuda|v[ií]veres|comida|agua/.test(t)) return 'acopio';
  return undefined;
}

// ---- Dispatcher ----

export async function processInbound(messages: InboundMessage[]): Promise<{ handled: number }> {
  const cfg = kapsoConfig();
  if (!cfg) return { handled: 0 };
  let handled = 0;

  for (const m of messages) {
    if (!m.from || !m.id) continue;
    const session = await loadSession(m.from);
    // Idempotencia de webhooks de Meta
    if (session?.lastMsgId === m.id) continue;
    const tipo = session?.tipo ?? null;

    try {
      // Primer mensaje de un contacto nuevo: SIEMPRE responder con el menú de
      // bienvenida, sin intentar interpretar el contenido. `session === null`
      // significa que no hay ninguna interacción previa registrada.
      if (!session) {
        await sendWelcome(cfg, m.from);
        await saveSession(m.from, { tipo: null, lastMsgId: m.id });
        handled++;
        continue;
      }

      if (m.type === 'location' && m.location) {
        await replyNearest(cfg, m.from, m.location.lat, m.location.lng, tipo);
      } else if (m.type === 'interactive' && m.replyId) {
        if (m.replyId === 'tipo_refugio') {
          await saveSession(m.from, { tipo: 'refugio' });
          await askLocation(cfg, m.from, 'refugio');
        } else if (m.replyId === 'tipo_acopio') {
          await saveSession(m.from, { tipo: 'acopio' });
          await askLocation(cfg, m.from, 'acopio');
        } else if (m.replyId === 'buscar_familiar') {
          await saveSession(m.from, { tipo: 'buscar_familiar' });
          await askFamiliarPrompt(cfg, m.from);
        } else if (m.replyId === 'telefonos') {
          await replyPhones(cfg, m.from);
        } else if (m.replyId.startsWith('buscar_familiar_')) {
          const query = m.replyId.substring('buscar_familiar_'.length);
          await saveSession(m.from, { tipo: 'buscar_familiar' });
          await replyFamiliarSearch(cfg, m.from, query);
        } else if (m.replyId === 'volver_inicio') {
          await saveSession(m.from, { tipo: null });
          await sendWelcome(cfg, m.from);
        } else {
          await sendWelcome(cfg, m.from);
        }
      } else if (m.type === 'text' && m.text) {
        const text = m.text.trim();
        const textLower = text.toLowerCase();

        // 1. Comandos globales de reinicio y menú
        if (['menu', 'menú', 'hola', 'inicio', 'asistente', 'start', 'ayuda'].includes(textLower)) {
          await saveSession(m.from, { tipo: null });
          await sendWelcome(cfg, m.from);
        }
        // 2. Consulta de teléfonos
        else if (['telefonos', 'teléfonos', 'telefono', 'teléfono', 'contacto', 'emergencia'].includes(textLower)) {
          await replyPhones(cfg, m.from);
        }
        else {
          // Analizar heurística para detectar si el usuario quiere buscar personas
          const isCedula = /^(v|e)?-?\d{6,9}$/i.test(textLower.replace(/\s+/g, ''));
          const hasFamiliarKeywords = /\b(buscar|familiar|desaparecido|localizado|saber de|cedula|cédula|persona|encuentra|d[oó]nde est[aá])\b/.test(textLower);
          
          let forceFamiliar = isCedula || hasFamiliarKeywords;
          let searchQuery = text;

          if (hasFamiliarKeywords) {
            // Limpiar palabras funcionales del texto para dejar solo el nombre a buscar
            searchQuery = text.replace(/\b(buscar a|buscar al familiar|buscar|familiar|desaparecido|localizado|saber de|cedula|cédula|persona|encuentra|d[oó]nde est[aá]n?|d[oó]nde se encuentra)\b/gi, '').trim();
            if (searchQuery.length < 2) {
              searchQuery = text;
            }
          }

          if (forceFamiliar) {
            // Forzar transición a búsqueda de familiar
            await saveSession(m.from, { tipo: 'buscar_familiar' });
            await replyFamiliarSearch(cfg, m.from, searchQuery);
          }
          // 3. Estado de búsqueda de familiares
          else if (tipo === 'buscar_familiar') {
            await replyFamiliarSearch(cfg, m.from, text);
          }
          // 4. Búsqueda de centros / refugios
          else {
            const detected = detectTipo(text);
            const activeTipo = detected ?? tipo;

            if (activeTipo && activeTipo !== 'buscar_familiar') {
              // Intentar buscar como ciudad primero
              const asCity = await replyCity(cfg, m.from, text, activeTipo);
              if (asCity) {
                if (detected && detected !== tipo) {
                  await saveSession(m.from, { tipo: detected });
                }
              } else {
                // Si la ciudad falló, verificamos en paralelo si existen personas con ese nombre antes de arrojar error
                const peopleResults = await queryLocalPersonas(text);
                if (peopleResults.length > 0) {
                  // Redirigir automáticamente a familiar
                  await saveSession(m.from, { tipo: 'buscar_familiar' });
                  await send('autoTransitionNotice', sendText(cfg, {
                    to: m.from,
                    body: `💡 *Nota:* Detectamos que estás buscando a una persona. Cambié tu conversación a *Buscar Familiar*.`,
                  }));
                  await replyFamiliarSearch(cfg, m.from, text);
                } else {
                  // Si no hay personas ni ciudad, y la consulta tiene espacios (ej: "Juan Perez"), ofrecemos un menú interactivo aclaratorio
                  if (text.includes(' ')) {
                    await send('clarifyIntent', sendButtons(cfg, {
                      to: m.from,
                      body: `⚠️ No encontré ciudades ni registros de personas que coincidan exactamente con *"${text}"*.\n\n¿Qué deseabas hacer?`,
                      buttons: [
                        { id: `buscar_familiar_${text}`, title: '🔍 Buscar Persona' },
                        { id: `tipo_${activeTipo}`, title: '📍 Buscar Ciudad' },
                        { id: 'volver_inicio', title: '🏠 Menú Principal' }
                      ]
                    }));
                  } else {
                    await sendCityNotFound(cfg, m.from, text, activeTipo);
                  }
                }
              }
            } else {
              // Conversación libre inicial
              if (detected) {
                await saveSession(m.from, { tipo: detected });
                await askLocation(cfg, m.from, detected);
              } else {
                // Verificar si escribió un nombre con espacios directo
                if (text.includes(' ') && text.length > 5) {
                  const peopleResults = await queryLocalPersonas(text);
                  if (peopleResults.length > 0) {
                    await saveSession(m.from, { tipo: 'buscar_familiar' });
                    await replyFamiliarSearch(cfg, m.from, text);
                  } else {
                    await sendWelcome(cfg, m.from);
                  }
                } else {
                  await sendWelcome(cfg, m.from);
                }
              }
            }
          }
        }
      } else {
        await sendWelcome(cfg, m.from);
      }

      // Guardar el mensaje atendido con éxito
      await saveSession(m.from, { lastMsgId: m.id });
      handled++;
    } catch (e) {
      console.error(`[wa-bot] error procesando ${m.id} (${m.type}):`, e instanceof Error ? e.message : e);
    }
  }

  return { handled };
}
