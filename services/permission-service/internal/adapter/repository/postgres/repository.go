package postgres

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/permission-service/internal/adapter/repository/postgres/sqlc"
	"github.com/bastiencouder/microservices-go/services/permission-service/internal/domain"
)

type Repository struct {
	db      *pgxpool.Pool
	queries *sqlc.Queries
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db, queries: sqlc.New(db)}
}

func roleGrantsFullAccess(role string) bool {
	return role == "editor" || role == "super_admin"
}

func roleGrantsAdminAccess(role string) bool {
	return role == "super_admin"
}

func (r *Repository) CheckPolicy(ctx context.Context, in domain.CheckInput) (domain.CheckResult, error) {
	action := strings.ToLower(strings.TrimSpace(in.Action))
	resource := strings.ToLower(strings.TrimSpace(in.Resource))

	if action == "admin" && resource == "users" {
		for _, role := range in.Roles {
			if roleGrantsAdminAccess(role) {
				return domain.CheckResult{Allowed: true, Reason: "role grants admin access"}, nil
			}
		}
		return domain.CheckResult{Allowed: false, Reason: "missing admin role for requested action"}, nil
	}

	for _, role := range in.Roles {
		if roleGrantsFullAccess(role) {
			return domain.CheckResult{Allowed: true, Reason: "role grants full access"}, nil
		}
	}

	if isProjectScopedResource(resource, in.ProjectID, in.ResourceID) {
		memberships, err := r.ListProjectMembersByUser(ctx, in.OrganizationID, in.UserID)
		if err != nil {
			return domain.CheckResult{}, fmt.Errorf("list project memberships: %w", err)
		}
		for _, membership := range memberships {
			if membership.ProjectID != in.ProjectID {
				continue
			}
			if projectRoleAllowsAction(membership.Role, action) {
				return domain.CheckResult{Allowed: true, Reason: "project membership grants access"}, nil
			}
			return domain.CheckResult{Allowed: false, Reason: "project role denied"}, nil
		}
	}

	count, err := r.queries.CountMatchingPolicies(ctx, sqlc.CountMatchingPoliciesParams{
		Column1: []int64{0, in.OrganizationID},
		Column2: in.Roles,
		Column3: []string{action, "*"},
		Column4: []string{resource, "*"},
	})
	if err != nil {
		return domain.CheckResult{}, fmt.Errorf("query permission policies: %w", err)
	}

	if count > 0 {
		return domain.CheckResult{Allowed: true, Reason: "matching policy found"}, nil
	}

	return domain.CheckResult{Allowed: false, Reason: "missing required role for requested action"}, nil
}

func (r *Repository) ListOrganizationRoles(ctx context.Context, organizationID, userID int64) ([]string, error) {
	rows, err := r.db.Query(ctx, `
		SELECT role
		FROM member_roles
		WHERE organization_id = ANY($1)
		  AND user_id = $2
		ORDER BY role
	`, []int64{0, organizationID}, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	roles := make([]string, 0)
	for rows.Next() {
		var role string
		if err := rows.Scan(&role); err != nil {
			return nil, err
		}
		roles = append(roles, strings.TrimSpace(strings.ToLower(role)))
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return roles, nil
}

func (r *Repository) ListOrganizationsByUser(ctx context.Context, userID int64) ([]domain.Membership, error) {
	rows, err := r.db.Query(ctx, `
		SELECT organization_id, role
		FROM member_roles
		WHERE user_id = $1
		ORDER BY organization_id, role
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byOrg := make(map[int64][]string)
	order := make([]int64, 0)
	for rows.Next() {
		var organizationID int64
		var role string
		if err := rows.Scan(&organizationID, &role); err != nil {
			return nil, err
		}
		if _, ok := byOrg[organizationID]; !ok {
			order = append(order, organizationID)
		}
		byOrg[organizationID] = append(byOrg[organizationID], strings.TrimSpace(strings.ToLower(role)))
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	memberships := make([]domain.Membership, 0, len(order))
	for _, organizationID := range order {
		memberships = append(memberships, domain.Membership{
			OrganizationID: organizationID,
			UserID:         userID,
			Roles:          append([]string(nil), byOrg[organizationID]...),
		})
	}
	return memberships, nil
}

func (r *Repository) ClaimGlobalSuperAdmin(ctx context.Context, userID int64) (*domain.Member, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(727379360001)`); err != nil {
		return nil, err
	}

	var existing int
	if err := tx.QueryRow(ctx, `
		SELECT 1
		FROM member_roles
		WHERE role = 'super_admin'
		LIMIT 1
	`).Scan(&existing); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	} else if existing == 1 {
		return nil, domain.ErrSuperAdminAlreadyClaimed
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO member_roles (organization_id, user_id, role)
		VALUES (0, $1, 'super_admin')
		ON CONFLICT (organization_id, user_id, role) DO NOTHING
	`, userID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &domain.Member{
		OrganizationID: 0,
		UserID:         userID,
		Roles:          []string{"super_admin"},
	}, nil
}

func (r *Repository) GrantGlobalSuperAdmin(ctx context.Context, userID int64) (*domain.Member, error) {
	if _, err := r.db.Exec(ctx, `
		INSERT INTO member_roles (organization_id, user_id, role)
		VALUES (0, $1, 'super_admin')
		ON CONFLICT (organization_id, user_id, role) DO NOTHING
	`, userID); err != nil {
		return nil, err
	}
	return &domain.Member{
		OrganizationID: 0,
		UserID:         userID,
		Roles:          []string{"super_admin"},
	}, nil
}

func (r *Repository) ListGlobalSuperAdmins(ctx context.Context) ([]int64, error) {
	rows, err := r.db.Query(ctx, `
		SELECT user_id
		FROM member_roles
		WHERE organization_id = 0
		  AND role = 'super_admin'
		ORDER BY user_id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	userIDs := make([]int64, 0)
	for rows.Next() {
		var userID int64
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		userIDs = append(userIDs, userID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return userIDs, nil
}

func (r *Repository) HasGlobalSuperAdmin(ctx context.Context) (bool, error) {
	var exists bool
	if err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM member_roles
			WHERE organization_id = 0
			  AND role = 'super_admin'
		)
	`).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (r *Repository) ListMembers(ctx context.Context, organizationID int64) ([]domain.Member, error) {
	rows, err := r.db.Query(ctx, `
		SELECT user_id, COALESCE(array_agg(role ORDER BY role), '{}'::text[]) AS roles
		FROM member_roles
		WHERE organization_id = $1
		GROUP BY user_id
		ORDER BY user_id
	`, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.Member, 0)
	for rows.Next() {
		var member domain.Member
		var roles []string
		if err := rows.Scan(&member.UserID, &roles); err != nil {
			return nil, err
		}
		member.OrganizationID = organizationID
		member.Roles = append([]string(nil), roles...)
		out = append(out, member)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Repository) UpsertMember(ctx context.Context, member *domain.Member) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if _, err := tx.Exec(ctx, `
		DELETE FROM member_roles
		WHERE organization_id = $1
		  AND user_id = $2
	`, member.OrganizationID, member.UserID); err != nil {
		return err
	}

	for _, role := range member.Roles {
		if _, err := tx.Exec(ctx, `
			INSERT INTO member_roles (organization_id, user_id, role)
			VALUES ($1, $2, $3)
			ON CONFLICT (organization_id, user_id, role) DO NOTHING
		`, member.OrganizationID, member.UserID, role); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *Repository) UpdateMemberRoles(ctx context.Context, organizationID, userID int64, roles []string) (*domain.Member, error) {
	member := &domain.Member{
		OrganizationID: organizationID,
		UserID:         userID,
		Roles:          append([]string(nil), roles...),
	}
	if err := r.UpsertMember(ctx, member); err != nil {
		return nil, err
	}
	return member, nil
}

func (r *Repository) RemoveMember(ctx context.Context, organizationID, userID int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if _, err := tx.Exec(ctx, `
		DELETE FROM project_members
		WHERE organization_id = $1
		  AND user_id = $2
	`, organizationID, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM member_roles
		WHERE organization_id = $1
		  AND user_id = $2
	`, organizationID, userID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *Repository) ListProjectMembers(ctx context.Context, organizationID int64, projectID string) ([]domain.ProjectMember, error) {
	rows, err := r.db.Query(ctx, `
		SELECT project_id, organization_id, user_id, role
		FROM project_members
		WHERE organization_id = $1
		  AND project_id = $2
		ORDER BY user_id
	`, organizationID, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProjectMembers(rows)
}

func (r *Repository) ListProjectMembersByUser(ctx context.Context, organizationID, userID int64) ([]domain.ProjectMember, error) {
	rows, err := r.db.Query(ctx, `
		SELECT project_id, organization_id, user_id, role
		FROM project_members
		WHERE organization_id = $1
		  AND user_id = $2
		ORDER BY project_id
	`, organizationID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProjectMembers(rows)
}

func (r *Repository) UpsertProjectMember(ctx context.Context, member *domain.ProjectMember) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO project_members (project_id, organization_id, user_id, role)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (project_id, organization_id, user_id)
		DO UPDATE SET role = EXCLUDED.role
	`, member.ProjectID, member.OrganizationID, member.UserID, member.Role)
	return err
}

func (r *Repository) RemoveProjectMember(ctx context.Context, organizationID int64, projectID string, userID int64) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM project_members
		WHERE organization_id = $1
		  AND project_id = $2
		  AND user_id = $3
	`, organizationID, projectID, userID)
	return err
}

func (r *Repository) DeleteOrganizationPermissions(ctx context.Context, organizationID int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if _, err := tx.Exec(ctx, `DELETE FROM project_members WHERE organization_id = $1`, organizationID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM member_roles WHERE organization_id = $1`, organizationID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM permission_role_policies WHERE organization_id = $1`, organizationID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func isProjectScopedResource(resource, projectID, resourceID string) bool {
	resource = strings.ToLower(strings.TrimSpace(resource))
	if strings.TrimSpace(projectID) != "" {
		return resource == "projects" || resource == "prompts" || resource == "competitors" || resource == "analysis" || resource == "ia" || resource == "members"
	}
	if strings.TrimSpace(resourceID) != "" {
		return resource == "prompts" || resource == "competitors"
	}
	return false
}

func projectRoleAllowsAction(role, action string) bool {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "editor":
		return true
	case "viewer":
		return normalizeAction(action) == "read"
	default:
		return false
	}
}

func normalizeAction(action string) string {
	switch strings.ToLower(strings.TrimSpace(action)) {
	case "create", "update", "delete":
		return strings.ToLower(strings.TrimSpace(action))
	default:
		return "read"
	}
}

func scanProjectMembers(rows pgx.Rows) ([]domain.ProjectMember, error) {
	out := make([]domain.ProjectMember, 0)
	for rows.Next() {
		var member domain.ProjectMember
		if err := rows.Scan(&member.ProjectID, &member.OrganizationID, &member.UserID, &member.Role); err != nil {
			return nil, err
		}
		member.Role = strings.TrimSpace(strings.ToLower(member.Role))
		out = append(out, member)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].ProjectID == out[j].ProjectID {
			return out[i].UserID < out[j].UserID
		}
		return out[i].ProjectID < out[j].ProjectID
	})
	return out, nil
}
