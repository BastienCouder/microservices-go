package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/bastiencouder/microservices-go/services/permission-service/internal/domain"
)

type fakeRepo struct {
	result domain.CheckResult
}

type fakeRoleResolver struct {
	roles []string
}

func (f *fakeRepo) Check(_ context.Context, _ domain.CheckInput) (domain.CheckResult, error) {
	return f.result, nil
}

func (f *fakeRoleResolver) RolesForUser(_ context.Context, _, _ int64) ([]string, error) {
	return append([]string(nil), f.roles...), nil
}

func TestCheck(t *testing.T) {
	svc := NewService(
		&fakeRepo{result: domain.CheckResult{Allowed: true, Reason: "ok"}},
		&fakeRoleResolver{roles: []string{"viewer"}},
	)
	result, err := svc.Check(context.Background(), domain.CheckInput{
		OrganizationID: 1,
		UserID:         1,
		Action:         "read",
		Resource:       "organization",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Allowed {
		t.Fatalf("expected allowed")
	}

	_, err = svc.Check(context.Background(), domain.CheckInput{})
	if !errors.Is(err, domain.ErrInvalidPermissionCheck) {
		t.Fatalf("expected invalid permission error, got %v", err)
	}
}
