-- name: CreateUser :one
INSERT INTO users (auth_identity_id, email, first_name, last_name, created_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, auth_identity_id, email, first_name, last_name, created_at;

-- name: GetUserByID :one
SELECT id, auth_identity_id, email, first_name, last_name, created_at
FROM users
WHERE id = $1;

-- name: GetUserByAuthIdentityID :one
SELECT id, auth_identity_id, email, first_name, last_name, created_at
FROM users
WHERE auth_identity_id = $1;
