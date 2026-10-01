import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

const BASE = 'https://api.telegram.org';

export interface TelegramConfig {
  token: string;
}

export function telegramConfig(): TelegramConfig | null {
  const token = config.telegram.botToken;
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
    });
    const data = (await r.json().catch(() => undefined)) as { ok?: boolean; description?: string };
    if (!r.ok || data?.ok === false) {
      return { ok: false, status: r.status, error: data?.description || `HTTP ${r.status}`, data: data as T };
    }
    return { ok: true, status: r.status, data: data as T };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'network error' };
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendText(
  cfg: TelegramConfig,
  opts: { chatId: string | number; text: string; buttons?: { text: string; data: string }[][] },
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

export async function sendLocationRequest(
  cfg: TelegramConfig,
  opts: { chatId: string | number; text: string },
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

export async function answerCallback(cfg: TelegramConfig, callbackQueryId: string): Promise<TelegramResult> {
  return call(cfg, 'answerCallbackQuery', { callback_query_id: callbackQueryId });
}

export async function setWebhook(cfg: TelegramConfig, url: string, secretToken?: string): Promise<TelegramResult> {
  return call(cfg, 'setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: ['message', 'callback_query'],
  });
}

export function verifyTelegramSecret(getHeader: (name: string) => string | undefined): boolean {
  const secret = config.telegram.webhookSecret;
  if (!secret) return true;
  const header = getHeader('x-telegram-bot-api-secret-token') || '';
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type TgUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    text?: string;
    location?: { latitude: number; longitude: number };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number } };
  };
};
