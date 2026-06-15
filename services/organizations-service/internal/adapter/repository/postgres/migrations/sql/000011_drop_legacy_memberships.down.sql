CREATE TABLE IF NOT EXISTS organization_members (
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS member_roles (
  organization_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (organization_id, user_id, role),
  CONSTRAINT fk_member_roles_member
    FOREIGN KEY (organization_id, user_id)
    REFERENCES organization_members(organization_id, user_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  role TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, organization_id, user_id),
  CONSTRAINT project_members_project_id_not_blank CHECK (btrim(project_id) <> ''),
  CONSTRAINT project_members_role_not_blank CHECK (btrim(role) <> '')
);

CREATE INDEX IF NOT EXISTS idx_members_organization_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_member_roles_org_user ON member_roles(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_deleted_at ON organization_members(deleted_at);
CREATE INDEX IF NOT EXISTS project_members_organization_user_idx
  ON project_members (organization_id, user_id);
CREATE INDEX IF NOT EXISTS project_members_organization_project_idx
  ON project_members (organization_id, project_id);
