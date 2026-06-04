# AI Crypto Advisor

A personalized crypto investor dashboard powered by AI. Users complete a short onboarding quiz (assets, risk profile, content preferences) and receive a tailored feed of prices, news, signals, and AI-generated analysis — all tuned to their style.

---

## Architecture

```
AI-Crypto-advisor/
├── client/          React + Vite + TypeScript  →  Vercel
└── server/          Node.js + Express          →  Render
```

**Data flow:** Client → Express REST API → PostgreSQL (persistent data) + OpenRouter AI (analysis) + CryptoPanic (news).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS v3 |
| Routing | react-router-dom v6 |
| HTTP client | axios |
| Backend | Node.js, Express 4 |
| Database | PostgreSQL 14, `pg` pool |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| AI | OpenRouter API |
| News | CryptoPanic API (optional) |
| Deploy | Vercel (client) + Render (server) |

---

## Prerequisites

- Node.js ≥ 18
- PostgreSQL 14+ running locally
- (Optional) OpenRouter and CryptoPanic API keys

---

## Local Setup

### 1. Clone & install

```bash
git clone <repo>
cd AI-Crypto-advisor
npm run install:all
```

### 2. Configure environment

```bash
# Server
cp server/.env.example server/.env
# Edit server/.env — set DATABASE_URL with your Postgres user/password:
# DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/ai_crypto_advisor

# Client
cp client/.env.example client/.env
```

### 3. Create the database and apply schema

```bash
# Create the database (run once)
createdb ai_crypto_advisor

# Apply schema (creates all tables)
cd server && npm run db:init
```

If `createdb` is not on your PATH, open pgAdmin or run:
```sql
CREATE DATABASE ai_crypto_advisor;
```

### 4. Run in development

Open two terminals:

```bash
# Terminal 1 — API server  →  http://localhost:5000
npm run dev:server

# Terminal 2 — React app   →  http://localhost:5173
npm run dev:client
```

---

## Database Schema

```
users              — id, name, email, password_hash, created_at
user_preferences   — user_id (FK), interested_assets[], investor_type, content_types[]
votes              — id, user_id (FK), section, item_id, vote (+1/-1), created_at
```

Full schema: [`server/db/schema.sql`](server/db/schema.sql)

---

## API Reference

Base URL: `http://localhost:5000`

### Auth

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | `{ name, email, password }` | Create account |
| POST | `/api/auth/login` | `{ email, password }` | Get JWT token |

### Users _(requires `Authorization: Bearer <token>`)_

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Current user + preferences |
| PATCH | `/api/users/preferences` | Update interested assets, risk type, content types |

### Votes _(requires auth)_

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/votes` | Cast or update vote `{ section, item_id, vote: 1 \| -1 }` |
| GET | `/api/votes?section=news` | Fetch user's votes, optionally filtered by section |

### Health

```
GET /health   →  { status: "ok", db: "connected" }
```

---

## Environment Variables

### Server (`server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | — | HTTP port (default `5000`) |
| `DATABASE_URL` | ✓ | PostgreSQL connection string |
| `JWT_SECRET` | ✓ | Secret for signing JWTs — use a long random string in prod |
| `OPENROUTER_API_KEY` | ✓ | OpenRouter key for AI analysis |
| `CRYPTOPANIC_API_KEY` | — | CryptoPanic key for crypto news feed |
| `CLIENT_URL` | — | Frontend origin for CORS (default `http://localhost:5173`) |
| `NODE_ENV` | — | `development` or `production` |

### Client (`client/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✓ | Backend base URL (default `http://localhost:5000`) |

---

## Deployment

### Client → Vercel

```bash
cd client
npm run build          # verify build passes locally
# push to GitHub, import repo in Vercel
# set VITE_API_URL to your Render backend URL
```

### Server → Render

- New Web Service → connect repo, set root dir to `server/`
- Build command: `npm install`
- Start command: `npm start`
- Add all env vars from `server/.env.example` in the Render dashboard
- Run `npm run db:init` once after first deploy (use Render shell)
