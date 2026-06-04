require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db/pool');

const authRoutes        = require('./routes/auth');
const userRoutes        = require('./routes/users');
const voteRoutes        = require('./routes/votes');
const preferencesRoutes = require('./routes/preferences');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'ok', db: 'disconnected' });
  }
});

app.use('/api/auth',        authRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/votes',       voteRoutes);
app.use('/api/preferences', preferencesRoutes);

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
