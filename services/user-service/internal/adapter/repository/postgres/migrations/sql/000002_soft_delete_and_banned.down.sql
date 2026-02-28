DROP INDEX IF EXISTS idx_users_deleted_at;
DROP INDEX IF EXISTS idx_users_email_active;
DROP INDEX IF EXISTS idx_users_auth_identity_id_active;

ALTER TABLE users
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS banned_at,
  DROP COLUMN IF EXISTS banned;

ALTER TABLE users
  ADD CONSTRAINT users_auth_identity_id_key UNIQUE (auth_identity_id),
  ADD CONSTRAINT users_email_key UNIQUE (email);

CREATE INDEX IF NOT EXISTS idx_users_auth_identity_id ON users(auth_identity_id);
