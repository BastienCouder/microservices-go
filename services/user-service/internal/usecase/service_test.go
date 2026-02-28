package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/services/user-service/internal/domain"
)

type fakeRepo struct {
	created *domain.User
}

func (f *fakeRepo) Create(_ context.Context, user *domain.User) error {
	user.ID = 1
	clone := *user
	f.created = &clone
	return nil
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

func (f *fakeRepo) SoftDelete(_ context.Context, id int64, at time.Time) error {
	if f.created == nil || f.created.ID != id {
		return domain.ErrUserNotFound
	}
	ts := at
	f.created.DeletedAt = &ts
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
