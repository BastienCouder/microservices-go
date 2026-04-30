ALTER TABLE project_impact_integrations
  ADD COLUMN IF NOT EXISTS ga4_oauth_refresh_token_ciphertext TEXT;
