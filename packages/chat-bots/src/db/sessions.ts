import { query } from './pool.js';

export type WaSession = { phone: string; tipo: string | null; last_msg_id: string | null };

export async function getWaSession(phone: string): Promise<WaSession | null> {
  const r = await query<WaSession>(
    'SELECT phone, tipo, last_msg_id FROM wa_sessions WHERE phone = $1',
    [phone],
  );
  return r.rows[0] ?? null;
}

export async function upsertWaSession(
  phone: string,
  patch: { tipo?: string | null; last_msg_id?: string | null },
): Promise<void> {
  await query(
    `INSERT INTO wa_sessions (phone, tipo, last_msg_id, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (phone) DO UPDATE SET
       tipo = COALESCE($2, wa_sessions.tipo),
       last_msg_id = COALESCE($3, wa_sessions.last_msg_id),
       updated_at = NOW()`,
    [phone, patch.tipo ?? null, patch.last_msg_id ?? null],
  );
}

export type TgSession = { chat_id: string; tipo: string | null; last_update_id: string | null };

export async function getTgSession(chatId: string): Promise<TgSession | null> {
  const r = await query<TgSession>(
    'SELECT chat_id, tipo, last_update_id FROM telegram_sessions WHERE chat_id = $1',
    [chatId],
  );
  return r.rows[0] ?? null;
}

export async function upsertTgSession(
  chatId: string,
  patch: { tipo?: string | null; last_update_id?: string | null },
): Promise<void> {
  await query(
    `INSERT INTO telegram_sessions (chat_id, tipo, last_update_id, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (chat_id) DO UPDATE SET
       tipo = COALESCE($2, telegram_sessions.tipo),
       last_update_id = COALESCE($3, telegram_sessions.last_update_id),
       updated_at = NOW()`,
    [chatId, patch.tipo ?? null, patch.last_update_id ?? null],
  );
}
