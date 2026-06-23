CREATE TABLE crawler_runs (
  id UUID PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('discovery', 'markdown')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'partially_completed', 'errored', 'cancelled')),
  root_url TEXT NOT NULL,
  page_limit INTEGER NOT NULL DEFAULT 25,
  depth_limit INTEGER NOT NULL DEFAULT 2,
  include_urls JSONB NOT NULL DEFAULT '[]'::JSONB,
  total_pages INTEGER NOT NULL DEFAULT 0,
  completed_pages INTEGER NOT NULL DEFAULT 0,
  failed_pages INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX crawler_runs_project_created_idx
  ON crawler_runs (organization_id, project_id, created_at DESC);
CREATE INDEX crawler_runs_status_idx ON crawler_runs (status);

CREATE TABLE crawler_pages (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES crawler_runs(id) ON DELETE CASCADE,
  normalized_url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'crawling', 'completed', 'errored', 'cancelled')),
  http_status INTEGER,
  markdown TEXT,
  markdown_chars INTEGER NOT NULL DEFAULT 0,
  quality_score INTEGER,
  quality_status TEXT,
  quality_notes TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crawler_pages_run_url_unique UNIQUE (run_id, normalized_url)
);

CREATE INDEX crawler_pages_run_position_idx ON crawler_pages (run_id, position);
CREATE INDEX crawler_pages_run_status_idx ON crawler_pages (run_id, status);

-- L'ancien snapshot et ses usages facturés sont volontairement abandonnés.
DROP TABLE IF EXISTS content_optimizer_crawls;
DELETE FROM analysis_runs WHERE run_type = 'content_crawl';
