const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Parse db name from DATABASE_URL so we can create it if missing
const dbUrl = new URL(process.env.DATABASE_URL);
const DB_NAME = dbUrl.pathname.slice(1); // strip leading "/"

async function ensureDatabase() {
  // Connect to the default "postgres" maintenance DB to issue CREATE DATABASE
  const adminUrl = new URL(process.env.DATABASE_URL);
  adminUrl.pathname = '/postgres';
  const admin = new Pool({ connectionString: adminUrl.toString() });
  try {
    const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
    if (rows.length === 0) {
      await admin.query(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`✓ Database "${DB_NAME}" created`);
    } else {
      console.log(`✓ Database "${DB_NAME}" already exists`);
    }
  } finally {
    await admin.end();
  }
}

async function applySchema() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const schema = fs.readFileSync(path.resolve(__dirname, '../../db/schema.sql'), 'utf8');
  try {
    await pool.query(schema);
    console.log('✓ Schema applied successfully');
  } finally {
    await pool.end();
  }
}

async function init() {
  try {
    await ensureDatabase();
    await applySchema();
  } catch (err) {
    console.error('✗ Init failed:', err.message || err);
    if (err.code) console.error('  Code:', err.code);
    if (err.detail) console.error('  Detail:', err.detail);
    process.exit(1);
  }
}

init();
