require('dotenv').config();
const pool = require('./db/pool');
const app  = require('./app');
const { init }       = require('./db/init');
const { migrate }    = require('../db/migrate');
const { warmCache }      = require('./routes/dashboard');
const { warmChartCache } = require('./routes/coins');
const { verifySmtp }     = require('./routes/auth');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('✓ Database connected');
  } catch (err) {
    console.error('✗ Database connection failed:', err.message);
    console.error('  Make sure DATABASE_URL is set and the DB is running.');
    process.exit(1);
  }

  try {
    await init();
  } catch (err) {
    console.error('✗ DB init error (continuing):', err.message);
  }

  try {
    await migrate();
  } catch (err) {
    console.error('✗ DB migration error (continuing):', err.message);
  }

  // Warm coin price + news cache so first user request is instant
  warmCache().then(() => console.log('✓ Dashboard cache warmed')).catch(err => {
    console.warn('⚠ Dashboard cache warmup failed (non-fatal):', err.message);
  });

  // Seed chart cache with synthetic data instantly (no network calls)
  warmChartCache();
  console.log('✓ Chart cache seeded with synthetic data');

  // Verify SMTP connection (non-blocking)
  verifySmtp().catch(() => {});

  app.listen(PORT, () => console.log(`✓ Server running on http://localhost:${PORT}`));
}

start();
