package postgres

import (
	"context"
	"fmt"
	"strings"

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
	return role == "owner" || role == "admin" || role == "super_admin"
}

func (r *Repository) Check(ctx context.Context, in domain.CheckInput) (domain.CheckResult, error) {
	for _, role := range in.Roles {
		if roleGrantsFullAccess(role) {
			return domain.CheckResult{Allowed: true, Reason: "role grants full access"}, nil
		}
	}

	action := strings.ToLower(strings.TrimSpace(in.Action))
	resource := strings.ToLower(strings.TrimSpace(in.Resource))

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
