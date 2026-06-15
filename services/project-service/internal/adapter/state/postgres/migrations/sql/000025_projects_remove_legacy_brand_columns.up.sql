INSERT INTO brand_canon (
  project_id,
  brand_name,
  category,
  positioning,
  audience,
  use_cases,
  features,
  created_at,
  updated_at
)
SELECT
  p.id,
  NULLIF(BTRIM(p.brand_name), ''),
  NULLIF(BTRIM(p.industry), ''),
  NULLIF(BTRIM(p.brand_description), ''),
  '[]'::JSONB,
  '[]'::JSONB,
  '[]'::JSONB,
  p.created_at,
  p.updated_at
FROM projects p
WHERE
  NULLIF(BTRIM(p.brand_name), '') IS NOT NULL
  OR NULLIF(BTRIM(p.brand_description), '') IS NOT NULL
  OR NULLIF(BTRIM(p.industry), '') IS NOT NULL
ON CONFLICT (project_id) DO UPDATE
SET
  brand_name = COALESCE(NULLIF(BTRIM(brand_canon.brand_name), ''), EXCLUDED.brand_name),
  category = COALESCE(NULLIF(BTRIM(brand_canon.category), ''), EXCLUDED.category),
  positioning = COALESCE(NULLIF(BTRIM(brand_canon.positioning), ''), EXCLUDED.positioning),
  created_at = LEAST(brand_canon.created_at, EXCLUDED.created_at),
  updated_at = GREATEST(brand_canon.updated_at, EXCLUDED.updated_at);

ALTER TABLE projects
  DROP COLUMN IF EXISTS brand_name,
  DROP COLUMN IF EXISTS brand_description,
  DROP COLUMN IF EXISTS industry;
