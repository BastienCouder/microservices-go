CREATE TABLE IF NOT EXISTS organizations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS member_roles (
  organization_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (organization_id, user_id, role),
  FOREIGN KEY (organization_id, user_id)
    REFERENCES organization_members(organization_id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_members_organization_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_member_roles_org_user ON member_roles(organization_id, user_id);
