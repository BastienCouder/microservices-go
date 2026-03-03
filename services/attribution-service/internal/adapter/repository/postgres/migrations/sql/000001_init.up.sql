CREATE TABLE IF NOT EXISTS attribution_events (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  source TEXT NOT NULL,
  count BIGINT NOT NULL,
  revenue_cents BIGINT NOT NULL DEFAULT 0,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attribution_events_stage_valid CHECK (stage IN ('visit', 'signup', 'trial', 'paid')),
  CONSTRAINT attribution_events_count_positive CHECK (count > 0),
  CONSTRAINT attribution_events_revenue_non_negative CHECK (revenue_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_attribution_events_project_occurred_at
  ON attribution_events (project_id, occurred_at DESC);
