-- Esquema inicial: sesiones de bots + cola de campañas salientes

CREATE TABLE IF NOT EXISTS wa_sessions (
  phone VARCHAR(32) PRIMARY KEY,
  tipo VARCHAR(32),
  last_msg_id VARCHAR(80),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_sessions (
  chat_id VARCHAR(32) PRIMARY KEY,
  tipo VARCHAR(32),
  last_update_id VARCHAR(32),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  phone VARCHAR(32) NOT NULL,
  name VARCHAR(200),
  email VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contacts_list_idx ON contacts(list_id);

CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  subject VARCHAR(255),
  body TEXT,
  template_name VARCHAR(120),
  template_lang VARCHAR(12) DEFAULT 'es',
  default_vars JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  total_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS broadcasts_status_idx ON broadcasts(status);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  phone VARCHAR(32),
  email VARCHAR(200),
  name VARCHAR(200),
  vars JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  wa_message_id VARCHAR(80),
  error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bcast_recipients_bcast_idx ON broadcast_recipients(broadcast_id);
CREATE INDEX IF NOT EXISTS bcast_recipients_status_idx ON broadcast_recipients(status);
CREATE INDEX IF NOT EXISTS bcast_recipients_wa_msg_idx ON broadcast_recipients(wa_message_id);
