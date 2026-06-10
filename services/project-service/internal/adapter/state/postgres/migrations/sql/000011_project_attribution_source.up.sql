ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS attribution_source TEXT;
