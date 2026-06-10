ALTER TABLE analysis_runs
  ADD COLUMN IF NOT EXISTS organization_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS analysis_runs_organization_id_idx ON analysis_runs (organization_id);
CREATE INDEX IF NOT EXISTS analysis_runs_created_by_idx ON analysis_runs (created_by);
