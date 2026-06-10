ALTER TABLE users
  ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_auth_identity_id_key,
  DROP CONSTRAINT IF EXISTS users_email_key;

DROP INDEX IF EXISTS idx_users_auth_identity_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_identity_id_active
  ON users(auth_identity_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_active
  ON users(email)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
