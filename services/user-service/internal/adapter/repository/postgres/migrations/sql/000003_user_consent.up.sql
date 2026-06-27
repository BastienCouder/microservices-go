CREATE TABLE IF NOT EXISTS user_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  accepted_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT user_consent_type_version_unique UNIQUE (user_id, type, version)
);

CREATE INDEX IF NOT EXISTS idx_user_consent_user_id ON user_consent(user_id);
