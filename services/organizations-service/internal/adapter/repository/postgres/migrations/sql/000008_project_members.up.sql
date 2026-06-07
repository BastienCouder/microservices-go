CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  role TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id),
  CONSTRAINT project_members_project_id_not_blank CHECK (btrim(project_id) <> ''),
  CONSTRAINT project_members_role_not_blank CHECK (btrim(role) <> '')
);

CREATE INDEX IF NOT EXISTS project_members_organization_user_idx
  ON project_members (organization_id, user_id);

CREATE INDEX IF NOT EXISTS project_members_organization_project_idx
  ON project_members (organization_id, project_id);
