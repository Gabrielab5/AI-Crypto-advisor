# Feedback Model — Votes as a Personalization Signal

## How votes are stored today

```sql
CREATE TABLE votes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  section    TEXT NOT NULL,        -- 'coin_prices' | 'market_news' | 'ai_insight' | 'meme'
  item_id    TEXT NOT NULL,        -- 'main' or a specific item id (meme id, news id, coin id)
  vote       SMALLINT NOT NULL,    -- +1 (helpful) or -1 (not helpful)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, section, item_id)
);
```

Each row records one user's thumbs-up or thumbs-down on one content unit. Re-voting on the same `(user_id, section, item_id)` tuple updates the existing row (upsert), so the table always reflects the user's latest opinion, not a raw event log.

---

## How this data could train a personalization model

**Collaborative filtering signal:** If users with similar `interested_assets` and `investor_type` profiles consistently downvote a certain AI model's insight style, the dashboard could deprioritize that model for new users who match the same profile.

**Content-based signal:** Downvotes on specific coin cards can inform which assets to drop from a user's feed even if they selected them during onboarding — preferences drift, explicit signals update them.

**Implicit cold-start fix:** New users with no vote history inherit rankings from the nearest neighbor cluster in preference space (assets + investor type).

---

## Suggested schema extensions for richer signals

```sql
-- Replace the current binary vote with a richer event stream
CREATE TABLE interactions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  section      TEXT NOT NULL,
  item_id      TEXT NOT NULL,
  event        TEXT NOT NULL,       -- 'view' | 'vote_up' | 'vote_down' | 'click' | 'expand' | 'share'
  dwell_ms     INTEGER,             -- milliseconds the card was in the viewport (IntersectionObserver)
  scroll_depth SMALLINT,            -- 0–100 % of card scrolled through
  re_reads     SMALLINT DEFAULT 0,  -- number of times viewport re-entered
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Materialised daily aggregate for the ML pipeline
CREATE MATERIALIZED VIEW user_item_affinity AS
SELECT
  user_id,
  section,
  item_id,
  SUM(CASE event WHEN 'vote_up' THEN 2 WHEN 'vote_down' THEN -2
                 WHEN 'click'   THEN 1 WHEN 'expand'    THEN 0.5
                 ELSE 0 END)                          AS affinity_score,
  AVG(dwell_ms)                                       AS avg_dwell_ms,
  COUNT(*) FILTER (WHERE event = 're_read')           AS re_read_count
FROM interactions
GROUP BY user_id, section, item_id;
```

---

## Recommended ML approach

| Scenario | Approach |
|----------|----------|
| Enough vote history (≥ 50 users) | **Collaborative filtering** (matrix factorization, e.g. ALS) on the `affinity_score` matrix |
| Rich item metadata (coin sector, news source, AI model) | **Content-based filtering** — embed item features, compute cosine similarity to user's liked items |
| Both signals available | **Hybrid model** — weighted combination; collaborative filtering fills gaps the content model misses for new item types |
| Real-time re-ranking | **Bandit algorithm** (contextual ε-greedy or Thompson sampling) — treats each section slot as an arm, uses live vote feedback to converge without a full retrain cycle |

**Practical next step:** Export the `user_item_affinity` view as a CSV, train a lightweight SVD model with `surprise` or `implicit`, and serve recommendations via a `/api/recommendations` endpoint that the dashboard queries once on load to reorder coin and news cards before rendering.
