ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS projects_organization_deleted_idx
  ON projects (organization_id, deleted_at);
