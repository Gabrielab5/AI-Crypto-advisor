-- AI Crypto Advisor Database Schema
-- Safe to run multiple times (all statements use IF NOT EXISTS)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(100) NOT NULL,
  email               VARCHAR(255) UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  reset_token         TEXT,
  reset_token_expiry  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  interested_assets  TEXT[]       DEFAULT '{}',
  investor_type      VARCHAR(50),
  content_types      TEXT[]       DEFAULT '{}',
  theme_preference   VARCHAR(10)  DEFAULT 'dark'
);

CREATE TABLE IF NOT EXISTS votes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section    VARCHAR(100) NOT NULL,
  item_id    VARCHAR(255) NOT NULL,
  vote       SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, section, item_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_user_id       ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_section_item  ON votes(section, item_id);
CREATE INDEX IF NOT EXISTS idx_users_reset_token   ON users(reset_token) WHERE reset_token IS NOT NULL;
