CREATE TABLE IF NOT EXISTS analysis_service_meta (
  id SMALLINT PRIMARY KEY,
  seq BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analysis_service_meta_singleton CHECK (id = 1)
);

INSERT INTO analysis_service_meta (id, seq, updated_at)
VALUES (1, 0, NOW())
ON CONFLICT (id) DO NOTHING;
