import { query } from './pool.js';

export type ContactList = {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
};

export type Contact = {
  id: string;
  list_id: string;
  phone: string;
  name: string | null;
  email: string | null;
  created_at: Date;
};

export type Broadcast = {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  body: string | null;
  template_name: string | null;
  template_lang: string | null;
  default_vars: unknown;
  status: string;
  total_count: number;
  sent_count: number;
  fail_count: number;
  created_at: Date;
  finished_at: Date | null;
};

export type BroadcastRecipient = {
  id: string;
  broadcast_id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  vars: unknown;
  status: string;
  wa_message_id: string | null;
  error: string | null;
};

export async function listContactLists(): Promise<ContactList[]> {
  const r = await query<ContactList>(
    'SELECT id, name, description, created_at FROM contact_lists ORDER BY created_at DESC',
  );
  return r.rows;
}

export async function createContactList(name: string, description?: string): Promise<ContactList> {
  const r = await query<ContactList>(
    'INSERT INTO contact_lists (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at',
    [name, description ?? null],
  );
  return r.rows[0];
}

export async function listContacts(listId: string): Promise<Contact[]> {
  const r = await query<Contact>(
    'SELECT id, list_id, phone, name, email, created_at FROM contacts WHERE list_id = $1 ORDER BY created_at',
    [listId],
  );
  return r.rows;
}

export async function addContact(
  listId: string,
  phone: string,
  name?: string,
  email?: string,
): Promise<Contact> {
  const r = await query<Contact>(
    `INSERT INTO contacts (list_id, phone, name, email)
     VALUES ($1, $2, $3, $4)
     RETURNING id, list_id, phone, name, email, created_at`,
    [listId, phone, name ?? null, email ?? null],
  );
  return r.rows[0];
}

export async function createBroadcast(input: {
  name: string;
  type: string;
  subject?: string;
  body?: string;
  templateName?: string;
  templateLang?: string;
  defaultVars?: string[];
  recipients: Array<{ phone?: string; email?: string; name?: string; vars?: string[] }>;
}): Promise<Broadcast> {
  const pool = (await import('./pool.js')).getPool();
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const br = await db.query<Broadcast>(
      `INSERT INTO broadcasts (name, type, subject, body, template_name, template_lang, default_vars, total_count, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'queued')
       RETURNING *`,
      [
        input.name,
        input.type,
        input.subject ?? null,
        input.body ?? null,
        input.templateName ?? null,
        input.templateLang ?? 'es',
        JSON.stringify(input.defaultVars ?? []),
        input.recipients.length,
      ],
    );
    const broadcast = br.rows[0];
    for (const rec of input.recipients) {
      await db.query(
        `INSERT INTO broadcast_recipients (broadcast_id, phone, email, name, vars)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          broadcast.id,
          rec.phone ?? null,
          rec.email ?? null,
          rec.name ?? null,
          JSON.stringify(rec.vars ?? []),
        ],
      );
    }
    await db.query('COMMIT');
    return broadcast;
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }
}

export async function listBroadcasts(limit = 50): Promise<Broadcast[]> {
  const r = await query<Broadcast>(
    'SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
  return r.rows;
}

export async function getBroadcast(id: string): Promise<Broadcast | null> {
  const r = await query<Broadcast>('SELECT * FROM broadcasts WHERE id = $1', [id]);
  return r.rows[0] ?? null;
}

export async function getBroadcastRecipients(broadcastId: string): Promise<BroadcastRecipient[]> {
  const r = await query<BroadcastRecipient>(
    'SELECT * FROM broadcast_recipients WHERE broadcast_id = $1 ORDER BY updated_at',
    [broadcastId],
  );
  return r.rows;
}

export async function claimNextBroadcast(): Promise<Broadcast | null> {
  const r = await query<Broadcast>(
    `UPDATE broadcasts SET status = 'sending'
     WHERE id = (
       SELECT id FROM broadcasts WHERE status = 'queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
  );
  return r.rows[0] ?? null;
}

export async function claimPendingRecipients(
  broadcastId: string,
  limit: number,
): Promise<BroadcastRecipient[]> {
  const r = await query<BroadcastRecipient>(
    `UPDATE broadcast_recipients SET status = 'sending', updated_at = NOW()
     WHERE id IN (
       SELECT id FROM broadcast_recipients
       WHERE broadcast_id = $1 AND status = 'pending'
       ORDER BY updated_at LIMIT $2 FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [broadcastId, limit],
  );
  return r.rows;
}

export async function markRecipientSent(id: string, waMessageId?: string): Promise<void> {
  await query(
    `UPDATE broadcast_recipients SET status = 'sent', wa_message_id = $2, updated_at = NOW() WHERE id = $1`,
    [id, waMessageId ?? null],
  );
  await query(
    `UPDATE broadcasts SET sent_count = sent_count + 1 WHERE id = (
       SELECT broadcast_id FROM broadcast_recipients WHERE id = $1
     )`,
    [id],
  );
}

export async function markRecipientFailed(id: string, error: string): Promise<void> {
  await query(
    `UPDATE broadcast_recipients SET status = 'failed', error = $2, updated_at = NOW() WHERE id = $1`,
    [id, error.slice(0, 500)],
  );
  await query(
    `UPDATE broadcasts SET fail_count = fail_count + 1 WHERE id = (
       SELECT broadcast_id FROM broadcast_recipients WHERE id = $1
     )`,
    [id],
  );
}

export async function finishBroadcastIfDone(broadcastId: string): Promise<void> {
  const r = await query<{ pending: string }>(
    `SELECT COUNT(*)::text AS pending FROM broadcast_recipients
     WHERE broadcast_id = $1 AND status IN ('pending', 'sending')`,
    [broadcastId],
  );
  if (Number(r.rows[0]?.pending || 0) === 0) {
    await query(
      `UPDATE broadcasts SET status = 'done', finished_at = NOW() WHERE id = $1`,
      [broadcastId],
    );
  }
}

export async function findRecipientByWaMessageId(waMessageId: string): Promise<BroadcastRecipient | null> {
  const r = await query<BroadcastRecipient>(
    'SELECT * FROM broadcast_recipients WHERE wa_message_id = $1 LIMIT 1',
    [waMessageId],
  );
  return r.rows[0] ?? null;
}

export async function markRecipientDelivered(waMessageId: string): Promise<void> {
  await query(
    `UPDATE broadcast_recipients SET status = 'delivered', updated_at = NOW()
     WHERE wa_message_id = $1 AND status = 'sent'`,
    [waMessageId],
  );
}

export async function markRecipientRead(waMessageId: string): Promise<void> {
  await query(
    `UPDATE broadcast_recipients SET status = 'read', updated_at = NOW()
     WHERE wa_message_id = $1`,
    [waMessageId],
  );
}

export async function getContactsByListId(listId: string): Promise<Contact[]> {
  return listContacts(listId);
}
