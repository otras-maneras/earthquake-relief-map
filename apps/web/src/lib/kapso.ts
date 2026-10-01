// Cliente de Kapso (API oficial de WhatsApp Cloud, vía proxy de Meta).
// Solo servidor: usa secretos de entorno. Para campañas salientes del panel.
//
// Regla clave de Meta: para iniciar conversación en frío (fuera de la ventana de
// 24h) hay que usar PLANTILLAS pre-aprobadas. Por eso v1 envía plantillas.

const BASE = 'https://api.kapso.ai/meta/whatsapp/v24.0';

export interface KapsoConfig {
  apiKey: string;
  phoneNumberId: string;
  wabaId: string;
}

export function kapsoConfig(): KapsoConfig | null {
  const apiKey = process.env.KAPSO_API_KEY;
  const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID;
  const wabaId = process.env.KAPSO_WABA_ID || '';
  if (!apiKey || !phoneNumberId) return null;
  return { apiKey, phoneNumberId, wabaId };
}

function headers(cfg: KapsoConfig) {
  return { 'X-API-Key': cfg.apiKey, 'Content-Type': 'application/json' };
}

/**
 * Normaliza un teléfono a solo dígitos con código de país (formato wa-id).
 * Heurística para Venezuela: 0XXXXXXXXXX → 58XXXXXXXXXX. Devuelve '' si es inválido.
 */
export function normalizePhone(raw: string | null | undefined, defaultCc = '58'): string {
  if (!raw) return '';
  let s = raw.trim();
  const hadPlus = s.startsWith('+');
  s = s.replace(/[^0-9]/g, '');
  if (!s) return '';
  if (hadPlus) return s; // ya venía en internacional
  if (s.startsWith('00')) return s.slice(2);
  if (s.startsWith('0')) return defaultCc + s.slice(1); // local VE
  if (s.length <= 11 && !s.startsWith(defaultCc)) {
    // número local sin 0 ni país: anteponer país por defecto
    return defaultCc + s;
  }
  return s;
}

/** ¿Parece un teléfono enviable? (al menos 8 dígitos tras normalizar) */
export function isSendablePhone(raw: string | null | undefined): boolean {
  return normalizePhone(raw).length >= 8;
}

export interface KapsoResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function call<T>(cfg: KapsoConfig, path: string, init?: RequestInit): Promise<KapsoResult<T>> {
  try {
    const r = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers(cfg), ...(init?.headers || {}) }, cache: 'no-store' });
    const text = await r.text();
    let data: unknown;
    try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
    if (!r.ok) {
      const err = (data as { error?: { message?: string } })?.error?.message || `HTTP ${r.status}`;
      return { ok: false, status: r.status, error: err, data: data as T };
    }
    return { ok: true, status: r.status, data: data as T };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'network error' };
  }
}

// ---- Plantillas (WABA) ----

export interface MetaTemplate {
  id?: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components?: unknown[];
}

export async function listTemplates(cfg: KapsoConfig): Promise<KapsoResult<{ data: MetaTemplate[] }>> {
  return call(cfg, `/${cfg.wabaId}/message_templates?limit=100`);
}

/** Crea (y envía a aprobación de Meta) una plantilla de solo cuerpo con N variables posicionales. */
export async function createTemplate(
  cfg: KapsoConfig,
  opts: { name: string; language: string; category: 'UTILITY' | 'MARKETING'; body: string; examples: string[] }
): Promise<KapsoResult<{ id?: string; status?: string }>> {
  const components: Record<string, unknown>[] = [{ type: 'BODY', text: opts.body }];
  // Si el cuerpo tiene variables {{n}}, Meta exige ejemplos.
  const varCount = countVars(opts.body);
  if (varCount > 0) {
    const ex = Array.from({ length: varCount }, (_, i) => opts.examples[i] || 'Ejemplo');
    (components[0] as Record<string, unknown>).example = { body_text: [ex] };
  }
  return call(cfg, `/${cfg.wabaId}/message_templates`, {
    method: 'POST',
    body: JSON.stringify({ name: opts.name, language: opts.language, category: opts.category, components }),
  });
}

// ---- Envío ----

/** Envía un mensaje de plantilla a un destinatario con parámetros posicionales de cuerpo. */
export async function sendTemplate(
  cfg: KapsoConfig,
  opts: { to: string; name: string; language: string; bodyParams: string[] }
): Promise<KapsoResult<{ messages?: { id: string }[] }>> {
  const template: Record<string, unknown> = {
    name: opts.name,
    language: { code: opts.language },
  };
  if (opts.bodyParams.length > 0) {
    template.components = [
      { type: 'body', parameters: opts.bodyParams.map((t) => ({ type: 'text', text: t })) },
    ];
  }
  return call(cfg, `/${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ messaging_product: 'whatsapp', to: opts.to, type: 'template', template }),
  });
}

// ---- Mensajes de sesión (ventana de 24 h, sin plantilla) ----
// Solo válidos cuando el usuario escribió primero en las últimas 24 h. Se usan
// para responder al bot entrante de búsqueda de centros/refugios.

/** Envía un mensaje de texto libre (respuesta dentro de la ventana de 24 h). */
export async function sendText(
  cfg: KapsoConfig,
  opts: { to: string; body: string }
): Promise<KapsoResult<{ messages?: { id: string }[] }>> {
  return call(cfg, `/${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: opts.to,
      type: 'text',
      text: { preview_url: true, body: opts.body.slice(0, 4096) },
    }),
  });
}

/** Botones de respuesta rápida (máx. 3). `id` vuelve en el webhook como button_reply.id. */
export async function sendButtons(
  cfg: KapsoConfig,
  opts: { to: string; body: string; buttons: { id: string; title: string }[] }
): Promise<KapsoResult<{ messages?: { id: string }[] }>> {
  return call(cfg, `/${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: opts.to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: opts.body.slice(0, 1024) },
        action: {
          buttons: opts.buttons.slice(0, 3).map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    }),
  });
}

/** Pide al usuario que comparta su ubicación (botón nativo "Enviar ubicación"). */
export async function sendLocationRequest(
  cfg: KapsoConfig,
  opts: { to: string; body: string }
): Promise<KapsoResult<{ messages?: { id: string }[] }>> {
  return call(cfg, `/${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: opts.to,
      type: 'interactive',
      interactive: {
        type: 'location_request_message',
        body: { text: opts.body.slice(0, 1024) },
        action: { name: 'send_location' },
      },
    }),
  });
}

/** Cuenta variables posicionales {{1}}, {{2}}... distintas en un texto. */
export function countVars(body: string): number {
  const set = new Set<number>();
  for (const m of body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) set.add(Number(m[1]));
  return set.size;
}
