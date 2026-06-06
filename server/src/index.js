require('dotenv').config();
const pool = require('./db/pool');
const app  = require('./app');
const { init }       = require('./db/init');
const { migrate }    = require('../db/migrate');
const { warmCache }  = require('./routes/dashboard');

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

  // Warm CoinGecko cache so first user request is instant
  warmCache().then(() => console.log('✓ CoinGecko cache warmed')).catch(err => {
    console.warn('⚠ Cache warmup failed (non-fatal):', err.message);
  });

  app.listen(PORT, () => console.log(`✓ Server running on http://localhost:${PORT}`));
}

start();
