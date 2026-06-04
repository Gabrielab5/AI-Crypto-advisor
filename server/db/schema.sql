-- AI Crypto Advisor Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  interested_assets TEXT[]  DEFAULT '{}',
  investor_type   VARCHAR(50),        -- e.g. 'conservative', 'moderate', 'aggressive'
  content_types   TEXT[]  DEFAULT '{}'  -- e.g. 'news', 'analysis', 'alerts'
);

CREATE TABLE IF NOT EXISTS votes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section    VARCHAR(100) NOT NULL,   -- e.g. 'news', 'signals', 'coins'
  item_id    VARCHAR(255) NOT NULL,   -- external item identifier
  vote       SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, section, item_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_section_item ON votes(section, item_id);
