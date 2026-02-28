-- name: CreateOrganization :one
INSERT INTO organizations (name, owner_user_id, created_at)
VALUES ($1, $2, $3)
RETURNING id, name, owner_user_id, created_at;

-- name: GetOrganizationByID :one
SELECT id, name, owner_user_id, created_at
FROM organizations
WHERE id = $1;

-- name: CreateTeam :one
INSERT INTO teams (organization_id, name, created_at)
VALUES ($1, $2, $3)
RETURNING id, organization_id, name, created_at;

-- name: ListTeamsByOrganization :many
SELECT id, organization_id, name, created_at
FROM teams
WHERE organization_id = $1
ORDER BY id;

-- name: UpsertMember :exec
INSERT INTO organization_members (organization_id, user_id, team_id, added_at)
VALUES ($1, $2, $3, $4)
ON CONFLICT (organization_id, user_id)
DO UPDATE SET team_id = EXCLUDED.team_id;

-- name: InsertMemberRole :exec
INSERT INTO member_roles (organization_id, user_id, role)
VALUES ($1, $2, $3)
ON CONFLICT (organization_id, user_id, role) DO NOTHING;

-- name: GetMemberByOrgAndUser :one
SELECT organization_id, user_id, COALESCE(team_id, 0) AS team_id, added_at
FROM organization_members
WHERE organization_id = $1 AND user_id = $2;

-- name: ListMemberRolesByOrgAndUser :many
SELECT role
FROM member_roles
WHERE organization_id = $1 AND user_id = $2
ORDER BY role;
