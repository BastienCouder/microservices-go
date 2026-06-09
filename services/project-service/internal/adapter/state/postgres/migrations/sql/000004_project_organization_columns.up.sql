ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS organization_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by BIGINT NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS projects_user_id_idx;
ALTER TABLE projects DROP COLUMN IF EXISTS user_id;

CREATE INDEX IF NOT EXISTS projects_organization_id_idx ON projects (organization_id);
CREATE INDEX IF NOT EXISTS projects_created_by_idx ON projects (created_by);
