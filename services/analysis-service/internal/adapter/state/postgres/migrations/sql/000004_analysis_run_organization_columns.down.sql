DROP INDEX IF EXISTS analysis_runs_created_by_idx;
DROP INDEX IF EXISTS analysis_runs_organization_id_idx;

ALTER TABLE analysis_runs
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS organization_id;
