CREATE TABLE IF NOT EXISTS project_impact_integrations (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  ga4_property_id TEXT,
  ga4_service_account_ciphertext TEXT,
  ga4_connected_at TIMESTAMPTZ,
  ga4_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
