ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS brand_description TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT;

UPDATE projects AS p
SET
  brand_name = NULLIF(BTRIM(bc.brand_name), ''),
  brand_description = NULLIF(BTRIM(bc.positioning), ''),
  industry = NULLIF(BTRIM(bc.category), '')
FROM brand_canon AS bc
WHERE bc.project_id = p.id;
