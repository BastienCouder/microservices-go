DROP INDEX IF EXISTS idx_organizations_public_id;

ALTER TABLE organizations
  DROP COLUMN IF EXISTS public_id;
