package usecase

import (
	"context"
	"errors"
	"time"
)

var (
	ErrValidation   = errors.New("validation error")
	ErrUnauthorized = errors.New("unauthorized")
	ErrNotFound     = errors.New("not found")
)

const (
	StageVisit  = "visit"
	StageSignup = "signup"
	StageTrial  = "trial"
	StagePaid   = "paid"
)

type Event struct {
	ID           int64     `json:"id"`
	ProjectID    string    `json:"projectId"`
	Stage        string    `json:"stage"`
	Source       string    `json:"source"`
	Count        int64     `json:"count"`
	RevenueCents int64     `json:"revenueCents"`
	OccurredAt   time.Time `json:"occurredAt"`
	CreatedAt    time.Time `json:"createdAt"`
}

type RecordEventInput struct {
	ProjectID    string
	UserID       string
	Stage        string
	Source       string
	Count        int64
	RevenueCents int64
	OccurredAt   time.Time
}

type FunnelData struct {
	ProjectID         string `json:"projectId"`
	Visits            int64  `json:"visits"`
	Signups           int64  `json:"signups"`
	Trials            int64  `json:"trials"`
	Paid              int64  `json:"paid"`
	RevenueCents      int64  `json:"revenueCents"`
	VisitToSignupRate int    `json:"visitToSignupRate"`
	SignupToTrialRate int    `json:"signupToTrialRate"`
	TrialToPaidRate   int    `json:"trialToPaidRate"`
	WindowStart       string `json:"windowStart"`
	WindowEnd         string `json:"windowEnd"`
}

type Repository interface {
	InsertEvent(ctx context.Context, event Event) (Event, error)
	ListEvents(ctx context.Context, projectID string, from, to time.Time, limit int) ([]Event, error)
	GetFunnelTotals(ctx context.Context, projectID string, from, to time.Time) (FunnelTotals, error)
}

type FunnelTotals struct {
	Visits       int64
	Signups      int64
	Trials       int64
	Paid         int64
	RevenueCents int64
}

type ProjectAccessVerifier interface {
	EnsureProjectOwnedByUser(ctx context.Context, projectID, userID string) error
}

type Service struct {
	repo            Repository
	projectVerifier ProjectAccessVerifier
	now             func() time.Time
}
