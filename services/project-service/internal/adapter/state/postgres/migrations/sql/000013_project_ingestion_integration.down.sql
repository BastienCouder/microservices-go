ALTER TABLE project_impact_integrations
  DROP COLUMN IF EXISTS ingestion_updated_at,
  DROP COLUMN IF EXISTS ingestion_connected_at,
  DROP COLUMN IF EXISTS ingestion_signing_token_ciphertext;
