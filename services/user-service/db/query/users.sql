-- name: CreateUser :one
INSERT INTO users (auth_identity_id, email, first_name, last_name, banned, banned_at, created_at, deleted_at)
VALUES ($1, $2, $3, $4, false, NULL, $5, NULL)
RETURNING id, auth_identity_id, email, first_name, last_name, banned, banned_at, created_at, deleted_at;

-- name: GetUserByID :one
SELECT id, auth_identity_id, email, first_name, last_name, banned, banned_at, created_at, deleted_at
FROM users
WHERE id = $1
  AND deleted_at IS NULL;

-- name: GetUserByAuthIdentityID :one
SELECT id, auth_identity_id, email, first_name, last_name, banned, banned_at, created_at, deleted_at
FROM users
WHERE auth_identity_id = $1
  AND deleted_at IS NULL;

-- name: SoftDeleteUser :execrows
UPDATE users
SET auth_identity_id = $2,
    email = $3,
    first_name = $4,
    last_name = $5,
    deleted_at = $6
WHERE id = $1
  AND deleted_at IS NULL;

-- name: SetUserBanned :execrows
UPDATE users
SET banned = $2,
    banned_at = $3
WHERE id = $1
  AND deleted_at IS NULL;

-- name: RestoreUser :execrows
UPDATE users
SET deleted_at = NULL
WHERE id = $1
  AND deleted_at IS NOT NULL;
