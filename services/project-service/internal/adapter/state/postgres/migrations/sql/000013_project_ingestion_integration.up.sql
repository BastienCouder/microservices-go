ALTER TABLE project_impact_integrations
  ADD COLUMN IF NOT EXISTS ingestion_signing_token_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS ingestion_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ingestion_updated_at TIMESTAMPTZ;
