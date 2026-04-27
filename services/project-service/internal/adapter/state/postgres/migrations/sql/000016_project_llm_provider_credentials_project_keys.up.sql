DROP TABLE IF EXISTS project_llm_provider_credentials;

CREATE TABLE project_llm_provider_credentials (
  project_id TEXT NOT NULL,
  organization_id BIGINT NOT NULL,
  provider TEXT NOT NULL,
  api_key_ciphertext TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, provider),
  CONSTRAINT project_llm_provider_credentials_project_fk
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX project_llm_provider_credentials_org_idx
  ON project_llm_provider_credentials (organization_id);

CREATE INDEX project_llm_provider_credentials_project_idx
  ON project_llm_provider_credentials (project_id);
