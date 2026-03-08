CREATE TABLE IF NOT EXISTS analysis_service_state (
  id SMALLINT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analysis_service_state_singleton CHECK (id = 1)
);
