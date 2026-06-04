require('dotenv').config();
const pool = require('./db/pool');
const app  = require('./app');

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
  app.listen(PORT, () => console.log(`✓ Server running on http://localhost:${PORT}`));
}

start();
