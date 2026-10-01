import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

const BASE = 'https://api.kapso.ai/meta/whatsapp/v24.0';

export interface KapsoConfig {
  apiKey: string;
  phoneNumberId: string;
  wabaId: string;
}

export function kapsoConfig(): KapsoConfig | null {
  const { apiKey, phoneNumberId, wabaId } = config.kapso;
  if (!apiKey || !phoneNumberId) return null;
  return { apiKey, phoneNumberId, wabaId };
}

function headers(cfg: KapsoConfig): Record<string, string> {
  return { 'X-API-Key': cfg.apiKey, 'Content-Type': 'application/json' };
}

export interface KapsoResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function call<T>(cfg: KapsoConfig, path: string, init?: RequestInit): Promise<KapsoResult<T>> {
  try {
    const r = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...headers(cfg), ...(init?.headers || {}) },
    });
    const text = await r.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }
    if (!r.ok) {
      const err = (data as { error?: { message?: string } })?.error?.message || `HTTP ${r.status}`;
      return { ok: false, status: r.status, error: err, data: data as T };
    }
    return { ok: true, status: r.status, data: data as T };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'network error' };
  }
}

export function normalizePhone(raw: string | null | undefined, defaultCc = config.defaultPhoneCountry): string {
  if (!raw) return '';
  let s = raw.trim();
  const hadPlus = s.startsWith('+');
  s = s.replace(/[^0-9]/g, '');
  if (!s) return '';
  if (hadPlus) return s;
  if (s.startsWith('00')) return s.slice(2);
  if (s.startsWith('0')) return defaultCc + s.slice(1);
  if (s.length <= 11 && !s.startsWith(defaultCc)) return defaultCc + s;
  return s;
}

export type MetaTemplate = { id?: string; name: string; language: string; status: string };

export async function listTemplates(cfg: KapsoConfig): Promise<KapsoResult<{ data: MetaTemplate[] }>> {
  if (!cfg.wabaId) return { ok: true, status: 200, data: { data: [] } };
  return call(cfg, `/${cfg.wabaId}/message_templates?limit=100`);
}

export async function sendTemplate(
  cfg: KapsoConfig,
  opts: { to: string; name: string; language: string; bodyParams: string[] },
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

export async function sendText(
  cfg: KapsoConfig,
  opts: { to: string; body: string },
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

export async function sendButtons(
  cfg: KapsoConfig,
  opts: { to: string; body: string; buttons: { id: string; title: string }[] },
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

export async function sendLocationRequest(
  cfg: KapsoConfig,
  opts: { to: string; body: string },
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

export function verifyKapsoSignature(
  rawBody: string,
  getHeader: (name: string) => string | undefined,
): boolean {
  const secret = config.kapso.webhookSecret;
  if (!secret) return true;
  const header = getHeader('x-webhook-signature') || getHeader('x-hub-signature-256') || '';
  if (!header) return false;
  const got = header.replace(/^sha256=/i, '').trim();
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  if (got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function extractMessageId(result: KapsoResult<{ messages?: { id: string }[] }>): string | undefined {
  return result.data?.messages?.[0]?.id;
}
