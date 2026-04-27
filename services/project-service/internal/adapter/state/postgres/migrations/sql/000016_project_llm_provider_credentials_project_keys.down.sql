DROP TABLE IF EXISTS project_llm_provider_credentials;

CREATE TABLE project_llm_provider_credentials (
  organization_id BIGINT NOT NULL,
  provider TEXT NOT NULL,
  has_api_key BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, provider)
);

CREATE INDEX project_llm_provider_credentials_org_idx
  ON project_llm_provider_credentials (organization_id);
