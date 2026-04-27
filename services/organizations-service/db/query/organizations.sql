-- name: CreateOrganization :one
INSERT INTO organizations (name, owner_user_id, created_at, deleted_at)
VALUES ($1, $2, $3, NULL)
RETURNING id, name, owner_user_id, created_at, deleted_at;

-- name: GetOrganizationByID :one
SELECT id, name, owner_user_id, created_at, deleted_at
FROM organizations
WHERE id = $1
  AND deleted_at IS NULL;

-- name: CreateTeam :one
INSERT INTO teams (organization_id, name, created_at, deleted_at)
SELECT o.id, $2, $3, NULL
FROM organizations o
WHERE o.id = $1
  AND o.deleted_at IS NULL
RETURNING id, organization_id, name, created_at, deleted_at;

-- name: ListTeamsByOrganization :many
SELECT id, organization_id, name, created_at, deleted_at
FROM teams
WHERE organization_id = $1
  AND deleted_at IS NULL
ORDER BY id;

-- name: UpsertMember :exec
INSERT INTO organization_members (organization_id, user_id, team_id, added_at, deleted_at)
SELECT o.id, $2, $3, $4, NULL
FROM organizations o
LEFT JOIN teams t ON t.id = $3 AND t.organization_id = o.id AND t.deleted_at IS NULL
WHERE o.id = $1
  AND o.deleted_at IS NULL
  AND ($3 IS NULL OR t.id IS NOT NULL)
ON CONFLICT (organization_id, user_id)
DO UPDATE SET team_id = EXCLUDED.team_id,
              added_at = EXCLUDED.added_at,
              deleted_at = NULL;

-- name: InsertMemberRole :exec
INSERT INTO member_roles (organization_id, user_id, role)
SELECT $1, $2, $3
WHERE EXISTS (
  SELECT 1
  FROM organization_members m
  WHERE m.organization_id = $1
    AND m.user_id = $2
    AND m.deleted_at IS NULL
)
ON CONFLICT (organization_id, user_id, role) DO NOTHING;

-- name: GetMemberByOrgAndUser :one
SELECT organization_id, user_id, COALESCE(team_id, 0) AS team_id, added_at, deleted_at
FROM organization_members
WHERE organization_id = $1
  AND user_id = $2
  AND deleted_at IS NULL;

-- name: ListMemberRolesByOrgAndUser :many
SELECT role
FROM member_roles mr
WHERE mr.organization_id = $1
  AND mr.user_id = $2
  AND EXISTS (
    SELECT 1
    FROM organization_members m
    WHERE m.organization_id = $1
      AND m.user_id = $2
      AND m.deleted_at IS NULL
  )
ORDER BY role;

-- name: CreateInvitation :one
INSERT INTO organization_invitations (
  organization_id,
  project_id,
  email,
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
SELECT o.id, $2, $3, $4, $5, $6, 'pending', $7, 0, $8, $9, NULL, NULL
FROM organizations o
WHERE o.id = $1
  AND o.deleted_at IS NULL
RETURNING id, organization_id, project_id, email, role, token, message, status, invited_by_user_id, accepted_by_user_id, created_at, expires_at, responded_at, deleted_at;

-- name: ListInvitationsByOrganization :many
SELECT id, organization_id, project_id, email, role, token, message, status, invited_by_user_id, accepted_by_user_id, created_at, expires_at, responded_at, deleted_at
FROM organization_invitations
WHERE organization_id = $1
  AND deleted_at IS NULL
ORDER BY id DESC;

-- name: GetInvitationByID :one
SELECT id, organization_id, project_id, email, role, token, message, status, invited_by_user_id, accepted_by_user_id, created_at, expires_at, responded_at, deleted_at
FROM organization_invitations
WHERE organization_id = $1
  AND id = $2
  AND deleted_at IS NULL;

-- name: GetInvitationByTokenForUpdate :one
SELECT id, organization_id, project_id, email, role, token, message, status, invited_by_user_id, accepted_by_user_id, created_at, expires_at, responded_at, deleted_at
FROM organization_invitations
WHERE token = $1
  AND deleted_at IS NULL
FOR UPDATE;

-- name: UpdateInvitationByID :one
UPDATE organization_invitations
SET email = $3,
    role = $4,
    message = $5,
    expires_at = $6
WHERE organization_id = $1
  AND id = $2
  AND status = 'pending'
  AND deleted_at IS NULL
RETURNING id, organization_id, project_id, email, role, token, message, status, invited_by_user_id, accepted_by_user_id, created_at, expires_at, responded_at, deleted_at;

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
RETURNING id, organization_id, project_id, email, role, token, message, status, invited_by_user_id, accepted_by_user_id, created_at, expires_at, responded_at, deleted_at;

-- name: MarkInvitationRefused :one
UPDATE organization_invitations
SET status = 'refused',
    accepted_by_user_id = $2,
    responded_at = $3
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id, organization_id, project_id, email, role, token, message, status, invited_by_user_id, accepted_by_user_id, created_at, expires_at, responded_at, deleted_at;
