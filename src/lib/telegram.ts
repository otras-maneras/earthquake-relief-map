// Cliente de la API de Telegram Bot (https://core.telegram.org/bots/api).
// Solo servidor: usa el token de entorno. Espejo funcional de kapso.ts para el
// bot entrante, pero sin ventanas de 24h ni plantillas — Telegram no las exige.

const BASE = 'https://api.telegram.org';

export interface TelegramConfig {
  token: string;
}

export function telegramConfig(): TelegramConfig | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  return { token };
}

export interface TelegramResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function call<T>(cfg: TelegramConfig, method: string, body: Record<string, unknown>): Promise<TelegramResult<T>> {
  try {
    const r = await fetch(`${BASE}/bot${cfg.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await r.json().catch(() => undefined);
    if (!r.ok || (data && data.ok === false)) {
      return { ok: false, status: r.status, error: data?.description || `HTTP ${r.status}`, data };
    }
    return { ok: true, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'network error' };
  }
}

/** Escapa texto dinámico (nombres, ciudades, notas) para insertar seguro dentro de HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Mensaje de texto simple, con teclado inline opcional (botones). */
export async function sendText(
  cfg: TelegramConfig,
  opts: { chatId: string | number; text: string; buttons?: { text: string; data: string }[][] }
): Promise<TelegramResult> {
  return call(cfg, 'sendMessage', {
    chat_id: opts.chatId,
    text: opts.text.slice(0, 4096),
    parse_mode: 'HTML',
    disable_web_page_preview: false,
    reply_markup: opts.buttons
      ? { inline_keyboard: opts.buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))) }
      : { remove_keyboard: true },
  });
}

/** Pide ubicación con el botón nativo de Telegram (teclado persistente, no inline). */
export async function sendLocationRequest(
  cfg: TelegramConfig,
  opts: { chatId: string | number; text: string }
): Promise<TelegramResult> {
  return call(cfg, 'sendMessage', {
    chat_id: opts.chatId,
    text: opts.text.slice(0, 4096),
    parse_mode: 'HTML',
    reply_markup: {
      keyboard: [[{ text: '📍 Compartir ubicación', request_location: true }], [{ text: 'Menú' }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

/** Responde al callback_query para quitar el "cargando" del botón pulsado. */
export async function answerCallback(cfg: TelegramConfig, callbackQueryId: string): Promise<TelegramResult> {
  return call(cfg, 'answerCallbackQuery', { callback_query_id: callbackQueryId });
}

/** Registra la URL del webhook en Telegram. */
export async function setWebhook(
  cfg: TelegramConfig,
  url: string,
  secretToken?: string
): Promise<TelegramResult> {
  return call(cfg, 'setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: ['message', 'callback_query'],
  });
}
