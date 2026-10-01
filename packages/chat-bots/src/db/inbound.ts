import { query } from './pool.js';
import type { NormalizedInbound } from '../ingest/types.js';

export type InboundRow = {
  id: string;
  ack_ref: string;
  channel: string;
  external_id: string;
  sender_id: string;
  sender_name: string | null;
  message_type: string;
  text_body: string | null;
  attachments: unknown;
  location: unknown;
  status: string;
  forward_status: string | null;
  forward_error: string | null;
  ack_sent_at: Date | null;
  forwarded_at: Date | null;
  processed_at: Date | null;
  error: string | null;
  received_at: Date;
};

function makeAckRef(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function insertInbound(
  event: NormalizedInbound,
  initialStatus = 'received',
): Promise<{ row: InboundRow | null; created: boolean }> {
  for (let i = 0; i < 5; i++) {
    const ackRef = makeAckRef();
    try {
      const r = await query<InboundRow>(
        `INSERT INTO inbound_messages (
           ack_ref, channel, external_id, sender_id, sender_name,
           message_type, text_body, attachments, location, raw_payload, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11)
         ON CONFLICT (channel, external_id) DO NOTHING
         RETURNING *`,
        [
          ackRef,
          event.channel,
          event.external_id,
          event.sender_id,
          event.sender_name ?? null,
          event.message_type,
          event.text_body ?? null,
          JSON.stringify(event.attachments),
          event.location ? JSON.stringify(event.location) : null,
          event.raw_payload ? JSON.stringify(event.raw_payload) : null,
          initialStatus,
        ],
      );
      if (r.rows[0]) return { row: r.rows[0], created: true };
      const existing = await query<InboundRow>(
        'SELECT * FROM inbound_messages WHERE channel = $1 AND external_id = $2',
        [event.channel, event.external_id],
      );
      return { row: existing.rows[0] ?? null, created: false };
    } catch (e) {
      if (i === 4) throw e;
    }
  }
  return { row: null, created: false };
}

export async function claimInboundBatch(limit = 5): Promise<InboundRow[]> {
  const r = await query<InboundRow>(
    `UPDATE inbound_messages SET status = 'processing', updated_at = NOW()
     WHERE id IN (
       SELECT id FROM inbound_messages
       WHERE status = 'received'
         AND message_type IN ('photo', 'video', 'document')
       ORDER BY received_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [limit],
  );
  return r.rows;
}

export async function updateInboundAttachments(id: string, attachments: unknown): Promise<void> {
  await query('UPDATE inbound_messages SET attachments = $2::jsonb, updated_at = NOW() WHERE id = $1', [
    id,
    JSON.stringify(attachments),
  ]);
}

export async function markInboundAckSent(id: string): Promise<void> {
  await query(
    `UPDATE inbound_messages SET ack_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [id],
  );
}

export async function markInboundForwarded(id: string, ok: boolean, error?: string): Promise<void> {
  await query(
    `UPDATE inbound_messages SET
       forward_status = $2,
       forward_error = $3,
       forwarded_at = CASE WHEN $4 THEN NOW() ELSE forwarded_at END,
       updated_at = NOW()
     WHERE id = $1`,
    [id, ok ? 'sent' : 'failed', error?.slice(0, 500) ?? null, ok],
  );
}

export async function markInboundDone(id: string): Promise<void> {
  await query(
    `UPDATE inbound_messages SET status = 'processed', processed_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [id],
  );
}

export async function markInboundFailed(id: string, error: string): Promise<void> {
  await query(
    `UPDATE inbound_messages SET status = 'failed', error = $2, updated_at = NOW() WHERE id = $1`,
    [id, error.slice(0, 500)],
  );
}

export async function listInbound(limit = 50, status?: string): Promise<InboundRow[]> {
  if (status) {
    const r = await query<InboundRow>(
      'SELECT * FROM inbound_messages WHERE status = $1 ORDER BY received_at DESC LIMIT $2',
      [status, limit],
    );
    return r.rows;
  }
  const r = await query<InboundRow>(
    'SELECT * FROM inbound_messages ORDER BY received_at DESC LIMIT $1',
    [limit],
  );
  return r.rows;
}

export async function getInbound(id: string): Promise<InboundRow | null> {
  const r = await query<InboundRow>('SELECT * FROM inbound_messages WHERE id = $1', [id]);
  return r.rows[0] ?? null;
}

export async function getInboundByAckRef(ref: string): Promise<InboundRow | null> {
  const r = await query<InboundRow>('SELECT * FROM inbound_messages WHERE ack_ref = $1', [ref.toUpperCase()]);
  return r.rows[0] ?? null;
}
