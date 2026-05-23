-- migrations/add_chat_sessions.sql
-- Run this in your Supabase SQL editor to create the chat_sessions table.

CREATE TABLE IF NOT EXISTS chat_sessions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  messages   JSONB NOT NULL DEFAULT '[]',  -- array of {role, content}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);

-- Auto-update the updated_at timestamp on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
