-- AI Crypto Advisor — full schema (safe to re-run)
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
  interested_assets  TEXT[]      DEFAULT '{}',
  investor_type      VARCHAR(50),
  content_types      TEXT[]      DEFAULT '{}',
  theme_preference   VARCHAR(10) DEFAULT 'dark',
  pinned_coins       TEXT[]      DEFAULT '{}'
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

CREATE TABLE IF NOT EXISTS price_alerts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coin_id      VARCHAR(100) NOT NULL,
  coin_symbol  VARCHAR(20)  NOT NULL,
  coin_name    VARCHAR(100),
  condition    VARCHAR(10)  NOT NULL CHECK (condition IN ('above','below')),
  target_price NUMERIC      NOT NULL,
  triggered    BOOLEAN      DEFAULT FALSE,
  triggered_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_insight_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  model      VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_votes_user_id       ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_section_item  ON votes(section, item_id);
CREATE INDEX IF NOT EXISTS idx_users_reset_token   ON users(reset_token) WHERE reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_user         ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active       ON price_alerts(user_id) WHERE triggered = FALSE;
CREATE INDEX IF NOT EXISTS idx_insight_history     ON ai_insight_history(user_id, created_at DESC);
