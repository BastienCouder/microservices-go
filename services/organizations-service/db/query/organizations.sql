-- name: CreateOrganization :one
INSERT INTO organizations (name, owner_user_id, created_at, deleted_at)
VALUES ($1, $2, $3, NULL)
RETURNING id, name, owner_user_id, created_at, deleted_at;

-- name: GetOrganizationByID :one
SELECT id, name, owner_user_id, created_at, deleted_at
FROM organizations
WHERE id = $1
  AND deleted_at IS NULL;

-- name: CreateInvitation :one
INSERT INTO organization_invitations (
  organization_id,
  project_id,
  email,
  locale,
  role,
  token,
  message,
  status,
  invited_by_user_id,
  accepted_by_user_id,
  created_at,
  expires_at,
  responded_at,
  deleted_at
)
SELECT o.id, $2, $3, $4, $5, $6, $7, 'pending', $8, 0, $9, $10, NULL, NULL
FROM organizations o
WHERE o.id = $1
  AND o.deleted_at IS NULL
RETURNING id, organization_id, project_id, email, locale, role, token, message, status, invited_by_user_id, accepted_by_user_id, created_at, expires_at, responded_at, deleted_at;

-- name: ListInvitationsByOrganization :many
SELECT id, organization_id, project_id, email, locale, role, token, message, status, invited_by_user_id, accepted_by_user_id, created_at, expires_at, responded_at, deleted_at
FROM organization_invitations
WHERE organization_id = $1
  AND deleted_at IS NULL
ORDER BY id DESC;

-- name: GetInvitationByID :one
SELECT id, organization_id, project_id, email, locale, role, token, message, status, invited_by_user_id, accepted_by_user_id, created_at, expires_at, responded_at, deleted_at
FROM organization_invitations
WHERE organization_id = $1
  AND id = $2
  AND deleted_at IS NULL;

-- name: GetInvitationByTokenForUpdate :one
SELECT id, organization_id, project_id, email, locale, role, token, message, status, invited_by_user_id, accepted_by_user_id, created_at, expires_at, responded_at, deleted_at
FROM organization_invitations
WHERE token = $1
  AND deleted_at IS NULL
FOR UPDATE;

-- name: UpdateInvitationByID :one
UPDATE organization_invitations
SET email = $3,
    locale = $4,
    role = $5,
    message = $6,
    expires_at = $7
WHERE organization_id = $1
  AND id = $2
  AND status = 'pending'
  AND deleted_at IS NULL
RETURNING id, organization_id, project_id, email, locale, role, token, message, status, invited_by_user_id, accepted_by_user_id, created_at, expires_at, responded_at, deleted_at;

-- name: RevokeInvitationByID :execrows
UPDATE organization_invitations
SET status = 'revoked',
    deleted_at = $3,
    responded_at = COALESCE(responded_at, $3)
WHERE organization_id = $1
  AND id = $2
  AND deleted_at IS NULL;

-- name: MarkInvitationAccepted :one
UPDATE organization_invitations
SET status = 'accepted',
    accepted_by_user_id = $2,
    responded_at = $3
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id, organization_id, project_id, email, locale, role, token, message, status, invited_by_user_id, accepted_by_user_id, created_at, expires_at, responded_at, deleted_at;

-- name: MarkInvitationRefused :one
UPDATE organization_invitations
SET status = 'refused',
    accepted_by_user_id = $2,
    responded_at = $3
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id, organization_id, project_id, email, locale, role, token, message, status, invited_by_user_id, accepted_by_user_id, created_at, expires_at, responded_at, deleted_at;
