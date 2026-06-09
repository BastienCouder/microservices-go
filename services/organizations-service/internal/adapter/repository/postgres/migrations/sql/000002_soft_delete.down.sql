DROP INDEX IF EXISTS idx_organization_members_deleted_at;
DROP INDEX IF EXISTS idx_organizations_deleted_at;

ALTER TABLE organization_members
  DROP COLUMN IF EXISTS deleted_at;

ALTER TABLE organizations
  DROP COLUMN IF EXISTS deleted_at;
