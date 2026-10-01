-- Cola de ingesta multicanal (Frente A)

CREATE TABLE IF NOT EXISTS inbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ack_ref VARCHAR(12) NOT NULL UNIQUE,
  channel VARCHAR(16) NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  sender_id VARCHAR(64) NOT NULL,
  sender_name VARCHAR(200),
  message_type VARCHAR(32) NOT NULL,
  text_body TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  location JSONB,
  raw_payload JSONB,
  status VARCHAR(24) NOT NULL DEFAULT 'received',
  forward_status VARCHAR(24),
  forward_error TEXT,
  ack_sent_at TIMESTAMPTZ,
  forwarded_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS inbound_messages_channel_external_idx
  ON inbound_messages (channel, external_id);

CREATE INDEX IF NOT EXISTS inbound_messages_status_idx ON inbound_messages (status);
CREATE INDEX IF NOT EXISTS inbound_messages_received_idx ON inbound_messages (received_at DESC);
