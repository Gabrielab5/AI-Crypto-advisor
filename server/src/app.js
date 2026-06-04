const express = require('express');
const cors    = require('cors');
const pool    = require('./db/pool');

const authRoutes        = require('./routes/auth');
const userRoutes        = require('./routes/users');
const voteRoutes        = require('./routes/votes');
const preferencesRoutes = require('./routes/preferences');
const dashboardRoutes   = require('./routes/dashboard');

const app = express();

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
app.use('/api/dashboard',   dashboardRoutes);

module.exports = app;
