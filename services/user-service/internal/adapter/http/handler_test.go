package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/services/user-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/user-service/internal/usecase"
)

func TestDeleteMeSoftDeletesAuthenticatedUser(t *testing.T) {
	repo := &handlerFakeRepo{}
	svc := usecase.NewService(repo)
	handler := NewHandler(svc, nil)
	mux := http.NewServeMux()
	handler.Register(mux)

	user, err := svc.CreateUser(
		t.Context(),
		"kratos-id-1",
		"ada@example.com",
		"Ada",
		"Lovelace",
	)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}

	req := httptest.NewRequest(http.MethodDelete, "/users/me", nil)
	req.Header.Set("X-Authenticated-Identity-ID", "kratos-id-1")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
	if repo.deletedID != user.ID {
		t.Fatalf("expected deleted user id %d, got %d", user.ID, repo.deletedID)
	}
	if repo.users[user.ID].DeletedAt == nil {
		t.Fatal("expected deleted_at to be set")
	}
	if repo.users[user.ID].Email == "ada@example.com" {
		t.Fatal("expected email to be anonymized")
	}
}

type handlerFakeRepo struct {
	nextID    int64
	users     map[int64]*domain.User
	deletedID int64
}

func (f *handlerFakeRepo) Create(_ context.Context, user *domain.User) error {
	f.nextID++
	if f.users == nil {
		f.users = make(map[int64]*domain.User)
	}
	user.ID = f.nextID
	clone := *user
	f.users[user.ID] = &clone
	return nil
}

func (f *handlerFakeRepo) List(_ context.Context) ([]domain.User, error) {
	users := make([]domain.User, 0, len(f.users))
	for _, user := range f.users {
		clone := *user
		users = append(users, clone)
	}
	return users, nil
}

func (f *handlerFakeRepo) GetByID(_ context.Context, id int64) (*domain.User, error) {
	user, ok := f.users[id]
	if !ok || user.DeletedAt != nil {
		return nil, domain.ErrUserNotFound
	}
	clone := *user
	return &clone, nil
}

func (f *handlerFakeRepo) GetByAuthIdentityID(_ context.Context, authIdentityID string) (*domain.User, error) {
	for _, user := range f.users {
		if user.AuthIdentityID == authIdentityID && user.DeletedAt == nil {
			clone := *user
			return &clone, nil
		}
	}
	return nil, domain.ErrUserNotFound
}

func (f *handlerFakeRepo) UpdateProfile(_ context.Context, id int64, firstName, lastName string) (*domain.User, error) {
	user, ok := f.users[id]
	if !ok || user.DeletedAt != nil {
		return nil, domain.ErrUserNotFound
	}
	user.FirstName = firstName
	user.LastName = lastName
	clone := *user
	return &clone, nil
}

func (f *handlerFakeRepo) SetBanned(_ context.Context, id int64, banned bool, at time.Time) error {
	user, ok := f.users[id]
	if !ok || user.DeletedAt != nil {
		return domain.ErrUserNotFound
	}
	user.Banned = banned
	if banned {
		value := at
		user.BannedAt = &value
		return nil
	}
	user.BannedAt = nil
	return nil
}

func (f *handlerFakeRepo) SoftDelete(_ context.Context, id int64, at time.Time, anonymized domain.AnonymizedUser) error {
	user, ok := f.users[id]
	if !ok || user.DeletedAt != nil {
		return domain.ErrUserNotFound
	}
	f.deletedID = id
	value := at
	user.DeletedAt = &value
	user.AuthIdentityID = anonymized.AuthIdentityID
	user.Email = anonymized.Email
	user.FirstName = anonymized.FirstName
	user.LastName = anonymized.LastName
	return nil
}

func (f *handlerFakeRepo) Restore(_ context.Context, id int64) error {
	user, ok := f.users[id]
	if !ok || user.DeletedAt == nil {
		return domain.ErrUserNotFound
	}
	user.DeletedAt = nil
	return nil
}
