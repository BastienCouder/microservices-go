CREATE TABLE IF NOT EXISTS project_service_state (
  id SMALLINT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_service_state_singleton CHECK (id = 1)
);
