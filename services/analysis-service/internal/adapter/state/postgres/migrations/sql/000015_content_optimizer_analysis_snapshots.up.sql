CREATE TABLE IF NOT EXISTS content_optimizer_crawls (
  project_id TEXT NOT NULL,
  organization_id BIGINT NOT NULL,
  job_id TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, organization_id)
);

CREATE INDEX IF NOT EXISTS content_optimizer_crawls_updated_at_idx
  ON content_optimizer_crawls (updated_at);
