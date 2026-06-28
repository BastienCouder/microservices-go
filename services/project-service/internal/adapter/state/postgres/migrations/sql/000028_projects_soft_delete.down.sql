DROP INDEX IF EXISTS projects_organization_deleted_idx;

ALTER TABLE projects
  DROP COLUMN IF EXISTS deleted_at;
