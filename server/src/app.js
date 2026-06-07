const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const pool       = require('./db/pool');

const { requireAuth }   = require('./middleware/auth');
const authRoutes        = require('./routes/auth');
const userRoutes        = require('./routes/users');
const voteRoutes        = require('./routes/votes');
const preferencesRoutes = require('./routes/preferences');
const dashboardRoutes   = require('./routes/dashboard');
const coinsRoutes       = require('./routes/coins');
const alertsRoutes      = require('./routes/alerts');
const watchlistRoutes   = require('./routes/watchlist');
const newsRoutes        = require('./routes/news');

const app = express();

app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS — allow only the configured client origin
app.use(cors({
  origin:         process.env.CLIENT_URL || 'http://localhost:5173',
  credentials:    true,
  exposedHeaders: ['X-Synthetic-Data'],
}));

app.use(express.json());

// Rate limiting on auth endpoints (disabled in test environment)
if (process.env.NODE_ENV !== 'test') {
  const authLimiter = rateLimit({
    windowMs:        15 * 60 * 1000,
    max:             process.env.NODE_ENV === 'production' ? 10 : 100,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { error: 'Too many requests — please wait 15 minutes and try again.' },
  });
  app.use('/api/auth', authLimiter);
}

// Health
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
app.use('/api/votes',       requireAuth, voteRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/dashboard',   dashboardRoutes);
app.use('/api/coins',       requireAuth, coinsRoutes);
app.use('/api/alerts',      alertsRoutes);
app.use('/api/watchlist',   requireAuth, watchlistRoutes);
app.use('/api/news',        newsRoutes);

module.exports = app;
