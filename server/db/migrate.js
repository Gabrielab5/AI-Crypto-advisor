const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const MIGRATIONS = [
  // v1 → v2
  `DO $$ BEGIN
    ALTER TABLE users ADD COLUMN reset_token TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END $$`,
  `DO $$ BEGIN
    ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMPTZ;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END $$`,
  // v2 → v3
  `DO $$ BEGIN
    ALTER TABLE user_preferences ADD COLUMN theme_preference VARCHAR(10) DEFAULT 'dark';
  EXCEPTION WHEN duplicate_column THEN NULL;
  END $$`,
  // v3 → v4 (watchlist + alerts + AI memory)
  `DO $$ BEGIN
    ALTER TABLE user_preferences ADD COLUMN pinned_coins TEXT[] DEFAULT '{}';
  EXCEPTION WHEN duplicate_column THEN NULL;
  END $$`,
  `CREATE TABLE IF NOT EXISTS price_alerts (
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
  )`,
  `CREATE TABLE IF NOT EXISTS ai_insight_history (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    model      VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_user     ON price_alerts(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_active   ON price_alerts(user_id) WHERE triggered = FALSE`,
  `CREATE INDEX IF NOT EXISTS idx_insight_history ON ai_insight_history(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL`,
];

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log('Running migrations…');
  try {
    for (const sql of MIGRATIONS) {
      await pool.query(sql);
      console.log(`  ✓ ${sql.slice(0, 72).replace(/\s+/g, ' ')}…`);
    }
    console.log('✓ All migrations applied');
  } finally {
    await pool.end();
  }
}

module.exports = { migrate };

if (require.main === module) {
  migrate().catch(err => {
    console.error('✗ Migration failed:', err.message);
    process.exit(1);
  });
}
