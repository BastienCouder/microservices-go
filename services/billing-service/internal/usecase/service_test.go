package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

type fakeRepo struct {
	sub *domain.Subscription
}

func (f *fakeRepo) Upsert(_ context.Context, subscription *domain.Subscription) error {
	clone := *subscription
	f.sub = &clone
	return nil
}

func (f *fakeRepo) GetByOrganizationID(_ context.Context, organizationID int64) (*domain.Subscription, error) {
	if f.sub == nil || f.sub.OrganizationID != organizationID {
		return nil, domain.ErrSubscriptionMissing
	}
	clone := *f.sub
	return &clone, nil
}

func TestUpsertSubscription(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo)
	_, err := svc.UpsertSubscription(context.Background(), 1, "pro", 10, 10000)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	_, err = svc.UpsertSubscription(context.Background(), 0, "", 0, 0)
	if !errors.Is(err, domain.ErrInvalidSubscription) {
		t.Fatalf("expected invalid subscription error, got %v", err)
	}
}
