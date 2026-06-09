DROP INDEX IF EXISTS projects_created_by_idx;
DROP INDEX IF EXISTS projects_organization_id_idx;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';

ALTER TABLE projects
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS organization_id;

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects (user_id);
