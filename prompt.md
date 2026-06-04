# Prompt Log

This file tracks AI prompts used in complex or non-obvious code sections.
Only add an entry when the generated logic would be hard to reconstruct without the original intent.

---

## Format

```
### [YYYY-MM-DD] <short title>
**File:** `path/to/file.ts` (line range)
**Prompt:** <the prompt or key instruction given to the AI>
**Why logged:** <what makes this logic non-obvious>
```

---

## Entries

### [2026-06-04] Database schema design
**File:** `server/db/schema.sql`
**Prompt:**
> Design a PostgreSQL schema for a personalized crypto dashboard with users, per-user asset/content preferences, and a voting system (thumbs up/down) on sections like news, signals, and coins. Use UUIDs, proper FK constraints, and indexes for query patterns.

**Why logged:** The `votes` table uses a composite unique constraint `(user_id, section, item_id)` with an upsert pattern — the combination is intentional to allow vote updates without duplicates across arbitrary content sections.

---

### [2026-06-04] JWT auth middleware
**File:** `server/src/middleware/auth.js`
**Prompt:**
> Write Express middleware that validates a Bearer JWT, attaches the decoded payload to `req.user`, and returns structured JSON errors (not HTML) for missing/expired tokens.

**Why logged:** The middleware intentionally swallows the JWT error detail (instead of forwarding `err.message`) to avoid leaking token internals to clients.

---

### [2026-06-04] Startup DB connection check
**File:** `server/src/index.js`
**Prompt:**
> Add a startup check that pings the database before the server begins accepting connections. If the DB is unreachable, log a helpful error and exit. Also expose DB status in the /health endpoint.

**Why logged:** `process.exit(1)` on DB failure is deliberate — a server with no DB should not silently start and return 500s on every request.
