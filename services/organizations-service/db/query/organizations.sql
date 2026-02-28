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
