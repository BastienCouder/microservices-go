package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrInvalidSubscription = errors.New("invalid subscription")
	ErrSubscriptionMissing = errors.New("subscription not found")
)

type Subscription struct {
	OrganizationID int64
	Plan           string
	Seats          int
	MonthlyQuota   int
	UpdatedAt      time.Time
}

func (s *Subscription) Validate() error {
	if s.OrganizationID <= 0 {
		return fmt.Errorf("%w: organization id must be positive", ErrInvalidSubscription)
	}
	if strings.TrimSpace(s.Plan) == "" {
		return fmt.Errorf("%w: plan is required", ErrInvalidSubscription)
	}
	if s.Seats <= 0 {
		return fmt.Errorf("%w: seats must be positive", ErrInvalidSubscription)
	}
	if s.MonthlyQuota <= 0 {
		return fmt.Errorf("%w: monthly quota must be positive", ErrInvalidSubscription)
	}
	return nil
}
