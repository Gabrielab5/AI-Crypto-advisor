/**
 * Incremental migration — adds new columns to existing tables.
 * Safe to run multiple times; uses ALTER TABLE ... IF NOT EXISTS pattern.
 */
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const MIGRATIONS = [
  // v1 → v2: password reset columns
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token        TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMPTZ`,
  // v2 → v3: theme preference
  `ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) DEFAULT 'dark'`,
  // indices
  `CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL`,
];

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log('Running migrations…');
  try {
    for (const sql of MIGRATIONS) {
      await pool.query(sql);
      console.log(`  ✓ ${sql.slice(0, 70)}…`);
    }
    console.log('✓ All migrations applied');
  } catch (err) {
    console.error('✗ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
