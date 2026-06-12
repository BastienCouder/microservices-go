ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS public_id TEXT;

UPDATE organizations
SET public_id = 'org_' || substring(md5(id::text || clock_timestamp()::text || random()::text) for 24)
WHERE public_id IS NULL OR btrim(public_id) = '';

ALTER TABLE organizations
  ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_public_id
  ON organizations(public_id);
