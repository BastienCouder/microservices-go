ALTER TABLE organization_invitations
  ADD COLUMN IF NOT EXISTS project_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_org_invitations_project_id
  ON organization_invitations(organization_id, project_id)
  WHERE project_id <> '';
