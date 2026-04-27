CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id),
  CONSTRAINT project_members_role_not_blank CHECK (btrim(role) <> '')
);

CREATE INDEX IF NOT EXISTS project_members_organization_user_idx
  ON project_members (organization_id, user_id);
