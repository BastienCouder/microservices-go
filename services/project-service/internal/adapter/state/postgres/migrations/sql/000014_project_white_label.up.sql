ALTER TABLE projects
ADD COLUMN IF NOT EXISTS white_label JSONB;

UPDATE projects
SET white_label = jsonb_build_object(
  'version', 1,
  'branding', jsonb_strip_nulls(
    jsonb_build_object(
      'platformName', COALESCE(NULLIF(brand_name, ''), NULLIF(name, ''), 'Client Workspace'),
      'customDomain', NULLIF(domain, '')
    )
  ),
  'reporting', jsonb_build_object(
    'template', 'executive',
    'locale', COALESCE(NULLIF(primary_language, ''), 'fr'),
    'timezone', 'UTC',
    'frequency', 'monthly',
    'recipients', '[]'::jsonb,
    'liveShareEnabled', false,
    'shareLinkTTLHours', 168
  )
)
WHERE white_label IS NULL;
