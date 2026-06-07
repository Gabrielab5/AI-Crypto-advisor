# Feedback Model

## What we collect today

Every thumbs-up or thumbs-down a user clicks gets saved to the `votes` table:

```sql
CREATE TABLE votes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  section    TEXT NOT NULL,     -- 'coin_prices' | 'market_news' | 'ai_insight' | 'meme'
  item_id    TEXT NOT NULL,     -- 'main' for the whole section, or the specific coin/news/meme id
  vote       SMALLINT NOT NULL, -- +1 or -1
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, section, item_id)
);
```

The unique constraint means re-voting the same item just updates the existing row — no duplicate rows piling up. One row = one user's current opinion on one thing.

---

## How the data is used right now

**Coin filtering** — when the dashboard builds the coin list for a user, it queries all their `-1` votes where `section = 'coin_prices'` and `item_id != 'main'`. Those coin IDs are excluded from the list entirely. If a user keeps downvoting bitcoin, bitcoin disappears from their dashboard.

**AI prompt injection** — the same disliked coin IDs get appended to the AI insight prompt. Something like: "do not focus on BTC, ETH". So not only does the coin card disappear, the AI stops talking about it too.

**Ordering** — coins the user selected during onboarding are placed first in the list. Coins they've never interacted with fill the remaining slots up to 8.

---

## How it could train a model (suggestion, not implemented)

Right now votes are just filtered out or injected into a prompt. They're not actually used to train anything. Here's how that could work:

**Step 1 — store votes as a matrix**

Each user×coin pair has a score: `+1` (liked), `-1` (disliked), or missing (not seen / no opinion). This is a classic collaborative filtering setup. Once you have enough users (call it 50+), you can train a matrix factorization model — something like SVD or ALS — on this data. The model learns that users who dislike coin X tend to dislike coin Y, and can pre-filter before the user even votes.

**Step 2 — add richer signals**

Votes are binary and explicit. But there's implicit data too — how long a user looked at a card, whether they opened the detail modal, whether they clicked "Read more" on a news item. Adding a simple `interactions` table to capture these would give the model a lot more signal, especially for new users who haven't voted much yet:

```sql
CREATE TABLE interactions (
  user_id    INTEGER NOT NULL REFERENCES users(id),
  section    TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  event      TEXT NOT NULL,  -- 'view' | 'click' | 'expand' | 'vote_up' | 'vote_down'
  dwell_ms   INTEGER,        -- time the card was visible (IntersectionObserver)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

A user who spends 8 seconds reading an AI insight is telling us more than a user who scrolls past in half a second, even if neither voted.

**Step 3 — materialized aggregate for the ML pipeline**

You don't want the ML model reading raw event rows. Roll it up daily into a per-user-per-item score:

```sql
CREATE MATERIALIZED VIEW user_item_affinity AS
SELECT
  user_id, section, item_id,
  SUM(CASE event
    WHEN 'vote_up'   THEN  2
    WHEN 'vote_down' THEN -2
    WHEN 'click'     THEN  1
    WHEN 'expand'    THEN  0.5
    ELSE 0
  END) AS score,
  AVG(dwell_ms) AS avg_dwell
FROM interactions
GROUP BY user_id, section, item_id;
```

Export this as a CSV, train SVD with the `surprise` library or `implicit`, get item embeddings back. The recommendations endpoint returns a reordered list of coins and news items.

**Step 4 — new user cold start**

New users have no vote history. Two options:
- Fall back to the onboarding prefs (assets + investor type) as a proxy — same as now
- Find the nearest existing users by profile similarity and inherit their top-voted items

The second is better once there's enough data. Until then, onboarding prefs are fine.

---

## What would actually need to change to implement this

- Add the `interactions` table + a frontend event emitter (IntersectionObserver for dwell time, click handlers already exist)
- A cron job that refreshes the `user_item_affinity` view daily
- A training script (Python, runs offline on the exported CSV)
- A new `/api/recommendations` endpoint that loads model output and reorders the dashboard items before returning them
- The dashboard route reads from recommendations first, falls back to current logic if model output is missing
