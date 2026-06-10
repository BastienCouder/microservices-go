DROP INDEX IF EXISTS idx_org_invitations_project_id;

ALTER TABLE organization_invitations
  DROP COLUMN IF EXISTS project_id;
