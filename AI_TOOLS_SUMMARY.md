# AI Tools Used — AI Crypto Advisor

## Tools

### 1. Claude Code (CLI — Anthropic)
**Used for:** End-to-end implementation across all five development stages.

| Stage | What Claude Code did |
|-------|----------------------|
| Stage 1 — Scaffold | Initialized the monorepo structure, Express server, React+Vite client, PostgreSQL schema, JWT middleware, and all base routes |
| Stage 2 — Auth & Onboarding | Built registration/login flows, bcrypt hashing, JWT issuing, the 3-step onboarding wizard component, and preferences API |
| Stage 3 — Dashboard | Wired CoinGecko, CryptoPanic, and OpenRouter/HuggingFace APIs; built the tiered cache system; implemented all four dashboard sections |
| Stage 4 — Polish | Added coin detail modal with Recharts price charts, momentum score, toast notifications, watchlist pin/unpin, price alerts, dark/light theme token system, meme refresh button, vote buttons with animation, and the settings drawer |
| Stage 5 — Production | Wrote all test suites (Jest + Supertest, Vitest + RTL), added Helmet/rate-limiting/CORS, created vercel.json and render.yaml, fixed TypeScript build errors, authored documentation |

**Prompt style:** Mostly high-level feature requests ("add a coin detail modal with a 7/30d chart") plus targeted fixes ("the build fails with TS error on line 380 — fix it"). Claude Code read existing files before editing, made multi-file changes atomically, and ran the build/test suite itself to verify.

---

### 2. Claude (claude.ai — chat interface)
**Used for:** Design decisions and architectural questions before coding started.

Examples:
- "What's the best fallback chain if OpenRouter is rate-limited?" → chose HuggingFace Inference API then a static paragraph
- "How should I structure the CSS theming so light/dark doesn't require touching every component?" → CSS custom property tokens on `:root` / `html.light`

---

## What worked well

- **Iterative, context-aware editing** — Claude Code read files before editing and never wrote code that conflicted with existing patterns (naming, file layout, import style).
- **Test generation** — Given the component contract, Claude Code wrote comprehensive Vitest + RTL tests that caught real issues (e.g., the TS prop mismatch on `CoinModal` surfaced only when the build ran).
- **Production checklist discipline** — Helmet, rate-limiting, parameterized queries, CORS locking, and env-var documentation were all added in one pass without missing items.

## What needed human correction

- **Fake-timer tests** — The first meme-refresh test used `vi.runAllTimersAsync()` which conflicts with the seconds-ticker interval in Dashboard, causing infinite act() warnings. Required re-thinking the test strategy to avoid timers entirely.
- **MemeCard quoted titles** — `getByText('Test meme')` failed because the template renders `"Test meme"` (with quotes); needed a regex matcher. The AI missed this because it didn't simulate the rendered output.
- **Deployment steps** — Claude Code cannot click through the Render/Vercel web dashboards; the actual service creation and secret injection must be done by hand.
