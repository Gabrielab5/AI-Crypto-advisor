# 🪙 AI Crypto Advisor

[![Build](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-336791?style=flat-square&logo=postgresql)](https://postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?style=flat-square&logo=typescript)](https://typescriptlang.org)

> A personalized crypto investor dashboard powered by AI. Select your assets, investor profile, and content preferences — get a live feed of prices, news, AI-generated insights, and memes, all tuned to your style.

---

## 📸 Live Demo

| | URL |
|---|---|
| **Frontend** | _deploy to Vercel — see [DEPLOYMENT.md](DEPLOYMENT.md)_ |
| **API** | _deploy to Render — see [DEPLOYMENT.md](DEPLOYMENT.md)_ |

---

## ✨ Features

- **Personalized onboarding** — 3-step wizard: assets, investor type, content preferences
- **Live coin prices** — top 8 coins from CoinGecko, filtered to your interests; "Explore More" loads next 10
- **Coin detail modal** — 7/30-day recharts price chart, ATH, supply, momentum score, news, per-coin voting
- **AI market insights** — OpenRouter → HuggingFace → Gemini fallback chain; insight cached 24h per user-prefs hash, refreshed in background so it never blocks page load
- **AI personalization** — learns from 👎 votes; disliked coins are excluded from future results and appended to the AI prompt as "do not focus on X"
- **Curated news feed** — CryptoPanic API with static fallback; every item has a "Read more →" source link
- **Meme card** — 15 matched crypto memes (memegen.link), shuffles on every auto-refresh
- **Smart vote system** — 👍/👎 per section and per-coin; first vote shows toast, switching updates, same vote toggles off silently
- **Watchlist** — ⭐ star in Navbar opens a slide-in panel with live prices & 24h changes; star in coin modal to add/remove
- **Dark / light theme** — CSS variable tokens, toggleable, persisted to DB and localStorage
- **Auto-refresh** — live data every 60 seconds with "Updated Xs ago" indicator
- **Offline resilience** — stale-while-revalidate: last known data shows instantly from localStorage, fresh data replaces it silently when it arrives
- **Cache warmup** — CoinGecko data pre-fetched on server startup; first user request is always instant
- **Settings drawer** — password reset, theme toggle, preferences link
- **Production-grade** — Helmet, rate limiting, parameterized queries, CORS, trust proxy

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite, TypeScript, Tailwind CSS v3 |
| Charts | Recharts |
| Icons | Lucide React |
| Routing | react-router-dom v7 |
| HTTP client | Axios + JWT interceptor |
| Backend | Node.js 20, Express 4 |
| Database | PostgreSQL 14, `pg` pool |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Security | Helmet, express-rate-limit |
| AI | OpenRouter API → HuggingFace fallback |
| News | CryptoPanic API |
| Prices | CoinGecko free API |
| Email | Nodemailer |
| Tests | Jest + Supertest (BE) · Vitest + RTL (FE) |
| Deploy | Vercel (client) + Render (server) |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────┐
│                   Browser                   │
│  React + Vite + Tailwind (Vercel)           │
│  /login  /register  /onboarding  /dashboard │
└──────────────┬──────────────────────────────┘
               │ HTTPS + JWT
┌──────────────▼──────────────────────────────┐
│          Express API (Render)               │
│  /api/auth  /api/preferences  /api/votes    │
│  /api/dashboard  /api/coins                 │
└──────┬────────────────────┬─────────────────┘
       │                    │
┌──────▼──────┐    ┌────────▼────────────────┐
│ PostgreSQL  │    │   External APIs          │
│ (Render DB) │    │  CoinGecko (free)        │
│ users       │    │  OpenRouter / HuggingFace│
│ preferences │    │  CryptoPanic (optional)  │
│ votes       │    └─────────────────────────┘
└─────────────┘
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js ≥ 18
- PostgreSQL 14+

### 1. Clone & install
```bash
git clone <repo-url>
cd AI-Crypto-advisor
npm run install:all      # installs server + client deps
```

### 2. Configure environment
```bash
cp server/.env.example server/.env
# Edit server/.env — set DATABASE_URL, JWT_SECRET, and API keys

cp client/.env.example client/.env
# Set VITE_API_URL=http://localhost:5000
```

### 3. Set up the database
```bash
# First-time: create DB + apply full schema
cd server && npm run db:init

# Existing install (adds new columns only):
cd server && npm run db:migrate
```

### 4. Run in development
```bash
# Two terminals:
npm run dev:server    # → http://localhost:5000
npm run dev:client    # → http://localhost:5173
```

---

## 📡 API Reference

Base URL: `http://localhost:5000`

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password }` → JWT + user |
| POST | `/api/auth/login` | `{ email, password }` → JWT + user |
| POST | `/api/auth/request-password-reset` | `{ email }` → sends reset link |
| POST | `/api/auth/reset-password` | `{ token, password }` → updates password |

### Dashboard _(JWT required)_
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard` | All 4 sections (prices, news, AI, meme + memes pool) personalized to user prefs |
| GET | `/api/coins/:id` | Coin detail: ATH, supply, 7d/30d changes |
| GET | `/api/coins/:id/chart?days=7` | Price history (7 or 30 days) |
| GET | `/api/coins/market?page=2&per_page=10` | Paginated market data for "Explore More Coins" |

### Watchlist _(JWT required)_
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/watchlist` | User's watchlist with live CoinGecko prices |
| POST | `/api/watchlist` | Add coin `{ coin_id, coin_symbol, coin_name? }` |
| DELETE | `/api/watchlist/:coin_id` | Remove a coin from watchlist |

### Preferences, Votes, Users _(JWT required)_
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/preferences` | Current user preferences |
| POST | `/api/preferences` | Save (upsert) all preferences |
| GET/POST | `/api/votes` | Fetch or cast `{ section, item_id, vote: 'up'\|'down' }` |
| DELETE | `/api/votes` | Remove a vote `{ section, item_id }` (toggle-off) |
| GET | `/api/votes/summary` | Returns `{ liked: string[], disliked: string[] }` per-coin votes |
| GET | `/api/users/me` | User profile + preferences |
| PATCH | `/api/users/preferences` | Update individual preference fields |

### Health
```
GET /health  →  { status: "ok", db: "connected" }
```

---

## 🔐 Environment Variables

### Server (`server/.env`)
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✓ | PostgreSQL connection string |
| `JWT_SECRET` | ✓ | Long random string — change in production |
| `OPENROUTER_API_KEY` | — | openrouter.ai — free tier available |
| `HUGGINGFACE_API_KEY` | — | huggingface.co/settings/tokens — free |
| `CRYPTOPANIC_API_KEY` | — | cryptopanic.com — optional, uses fallback if absent |
| `CLIENT_URL` | — | Frontend origin for CORS (default: `http://localhost:5173`) |
| `PORT` | — | HTTP port (default: `5000`) |
| `SMTP_HOST/PORT/USER/PASS/FROM` | — | Email, production only for password reset |

### Client (`client/.env`)
| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✓ | Backend URL (default: `http://localhost:5000`) |

---

## 🚢 Deployment

### Client → Vercel
1. Push repo to GitHub
2. Import in Vercel, set root directory to `client/`
3. Set env var: `VITE_API_URL=https://your-render-api.onrender.com`
4. Deploy — `vercel.json` handles SPA routing

### Server → Render
1. New Web Service → connect repo, root dir: `server/`
2. Build: `npm install` · Start: `npm start`
3. Add all env vars from `server/.env.example` in Render dashboard
4. After first deploy, open Render Shell and run:
   ```bash
   node db/init.js    # first-time schema
   node db/migrate.js # subsequent column additions
   ```

---

## 🧪 Tests

```bash
# Backend — Jest + Supertest (106 tests, 10 suites)
cd server && npm test

# Frontend — Vitest + React Testing Library (149 tests, 16 suites)
cd client && npm test
```

Coverage: auth flows, password reset, preferences CRUD, vote validation, dashboard resilience (offline fallback, stale-while-revalidate), coin modal, news feed, watchlist, theme toggle, drawer, onboarding wizard, protected routes.

---

## 💡 AI Personalization & Feedback Loop

Each dashboard section has 👍/👎 vote buttons. Votes are stored per-user in the `votes` table with `(user_id, section, item_id)` unique constraint. Clicking the same vote again removes it (toggle-off, no toast). Switching vote direction shows "Preference updated ✓".

Per-coin votes in the Coin Detail Modal feed directly into the next dashboard build: 👎 coins are excluded from the coin list and their IDs are appended to the AI prompt as exclusions. 👍 coins are prioritized in the ordering.

The AI insight is cached 24h per user+preferences hash, generated in the background on cache miss, and never blocks the page from loading — the user always sees something immediately, whether it's the cached real insight or a fallback template while the real one is being computed.

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m 'feat: add something'`
4. Push and open a PR

Please run `npm test` in both `server/` and `client/` before submitting.
