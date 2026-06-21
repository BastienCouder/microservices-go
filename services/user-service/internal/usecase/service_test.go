package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/services/user-service/internal/domain"
)

type fakeRepo struct {
	created       *domain.User
	softDeletedID int64
	softDeletedAt time.Time
	anonymized    *domain.AnonymizedUser
}

func (f *fakeRepo) Create(_ context.Context, user *domain.User) error {
	user.ID = 1
	clone := *user
	f.created = &clone
	return nil
}

func (f *fakeRepo) List(_ context.Context) ([]domain.User, error) {
	if f.created == nil {
		return nil, nil
	}
	clone := *f.created
	return []domain.User{clone}, nil
}

func (f *fakeRepo) GetByID(_ context.Context, id int64) (*domain.User, error) {
	if f.created != nil && f.created.ID == id {
		clone := *f.created
		return &clone, nil
	}
	return nil, domain.ErrUserNotFound
}

func (f *fakeRepo) GetByAuthIdentityID(_ context.Context, authIdentityID string) (*domain.User, error) {
	if f.created != nil && f.created.AuthIdentityID == authIdentityID {
		clone := *f.created
		return &clone, nil
	}
	return nil, domain.ErrUserNotFound
}

func (f *fakeRepo) UpdateProfile(_ context.Context, id int64, firstName, lastName string) (*domain.User, error) {
	if f.created == nil || f.created.ID != id {
		return nil, domain.ErrUserNotFound
	}
	f.created.FirstName = firstName
	f.created.LastName = lastName
	clone := *f.created
	return &clone, nil
}

func (f *fakeRepo) SetBanned(_ context.Context, id int64, banned bool, at time.Time) error {
	if f.created == nil || f.created.ID != id {
		return domain.ErrUserNotFound
	}
	f.created.Banned = banned
	if banned {
		ts := at
		f.created.BannedAt = &ts
		return nil
	}
	f.created.BannedAt = nil
	return nil
}

func (f *fakeRepo) SoftDelete(_ context.Context, id int64, at time.Time, anonymized domain.AnonymizedUser) error {
	if f.created == nil || f.created.ID != id {
		return domain.ErrUserNotFound
	}
	f.softDeletedID = id
	f.softDeletedAt = at
	clone := anonymized
	f.anonymized = &clone
	ts := at
	f.created.DeletedAt = &ts
	f.created.AuthIdentityID = anonymized.AuthIdentityID
	f.created.Email = anonymized.Email
	f.created.FirstName = anonymized.FirstName
	f.created.LastName = anonymized.LastName
	return nil
}

func (f *fakeRepo) Restore(_ context.Context, id int64) error {
	if f.created == nil || f.created.ID != id {
		return domain.ErrUserNotFound
	}
	f.created.DeletedAt = nil
	return nil
}

func TestCreateUser(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		repo := &fakeRepo{}
		svc := NewService(repo)
		user, err := svc.CreateUser(context.Background(), "kratos-id-1", "ada@example.com", "Ada", "Lovelace")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if user.ID != 1 {
			t.Fatalf("unexpected id: %d", user.ID)
		}
	})

	t.Run("validation error", func(t *testing.T) {
		repo := &fakeRepo{}
		svc := NewService(repo)
		_, err := svc.CreateUser(context.Background(), "", "", "", "")
		if !errors.Is(err, domain.ErrInvalidUser) {
			t.Fatalf("expected validation error, got %v", err)
		}
	})
}

func TestUpdateUserProfile(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo)
	created, err := svc.CreateUser(context.Background(), "kratos-id-1", "ada@example.com", "Ada", "Lovelace")
	if err != nil {
		t.Fatalf("create user: %v", err)
	}

	updated, err := svc.UpdateUserProfile(context.Background(), created.ID, "  Augusta  ", "  King  ")
	if err != nil {
		t.Fatalf("update user profile: %v", err)
	}
	if updated.FirstName != "Augusta" || updated.LastName != "King" {
		t.Fatalf("expected trimmed profile names, got %q %q", updated.FirstName, updated.LastName)
	}
}

func TestDeleteUserAnonymizesProfile(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo)
	now := time.Date(2026, 4, 30, 12, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return now }
	created, err := svc.CreateUser(context.Background(), "kratos-id-1", "ada@example.com", "Ada", "Lovelace")
	if err != nil {
		t.Fatalf("create user: %v", err)
	}

	if err := svc.DeleteUser(context.Background(), created.ID); err != nil {
		t.Fatalf("delete user: %v", err)
	}

	if repo.softDeletedID != created.ID {
		t.Fatalf("expected soft deleted id %d, got %d", created.ID, repo.softDeletedID)
	}
	if !repo.softDeletedAt.Equal(now) {
		t.Fatalf("expected deleted at %s, got %s", now, repo.softDeletedAt)
	}
	if repo.anonymized == nil {
		t.Fatal("expected anonymized user payload")
	}
	if repo.anonymized.AuthIdentityID != "deleted-user-1" {
		t.Fatalf("unexpected anonymized auth identity id: %q", repo.anonymized.AuthIdentityID)
	}
	if repo.anonymized.Email != "deleted-user-1@anonymized.local" {
		t.Fatalf("unexpected anonymized email: %q", repo.anonymized.Email)
	}
	if repo.anonymized.FirstName != "Deleted" || repo.anonymized.LastName != "User" {
		t.Fatalf("unexpected anonymized name: %q %q", repo.anonymized.FirstName, repo.anonymized.LastName)
	}
}
