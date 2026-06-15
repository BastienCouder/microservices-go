CREATE TABLE IF NOT EXISTS member_roles (
  organization_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (organization_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS member_roles_user_idx
  ON member_roles (user_id, organization_id);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL,
  organization_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (project_id, organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_members_org_user_idx
  ON project_members (organization_id, user_id);

CREATE INDEX IF NOT EXISTS project_members_org_project_idx
  ON project_members (organization_id, project_id);
