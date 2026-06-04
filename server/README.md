# AI Crypto Advisor — Server

Express API server for the AI Crypto Advisor app.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your actual values
```

### 3. Create the database
```bash
createdb ai_crypto_advisor
psql -d ai_crypto_advisor -f db/schema.sql
```

### 4. Run in development
```bash
npm run dev
```

The server starts at `http://localhost:5000`.

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | — | Health check |
| POST | /api/auth/register | — | Register new user |
| POST | /api/auth/login | — | Login |
| GET | /api/users/me | JWT | Get current user + preferences |
| PATCH | /api/users/preferences | JWT | Update preferences |
| POST | /api/votes | JWT | Cast or update a vote |
| GET | /api/votes | JWT | Get user's votes (optionally filtered by section) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default 5000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for signing JWTs |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI features |
| `CRYPTOPANIC_API_KEY` | CryptoPanic API key for news (optional) |
| `CLIENT_URL` | Frontend URL for CORS |
