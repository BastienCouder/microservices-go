package usecase

import (
	"context"
	"time"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
)

type ProjectLister interface {
	ListProjectsByOrganization(ctx context.Context, organizationID int64) ([]ProjectSummary, error)
}

type ProjectUserLister interface {
	ListProjectsByOrganizationForUser(ctx context.Context, organizationID, userID int64) ([]ProjectSummary, error)
}

type InvitationNotifier interface {
	SendInvitation(ctx context.Context, notification InvitationNotification) error
}

type UserEmailResolver interface {
	UserEmail(ctx context.Context, userID int64) (string, error)
}

type UserProfileResolver interface {
	UserProfile(ctx context.Context, userID int64) (UserProfile, error)
}

type UserProfile struct {
	Email     string
	FirstName string
	LastName  string
}

type InvitationNotification struct {
	Email            string
	OrganizationID   int64
	OrganizationName string
	Locale           string
	Role             string
	Message          string
	ProjectName      string
	AcceptURL        string
	ExpiresAt        *time.Time
}

type ProjectSummary struct {
	ID                string    `json:"id"`
	OrganizationID    int64     `json:"organizationId"`
	Name              string    `json:"name"`
	BrandName         string    `json:"brandName,omitempty"`
	BrandDescription  string    `json:"brandDescription,omitempty"`
	AttributionSource string    `json:"attributionSource,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`
}

type OrganizationHierarchy struct {
	Organization domain.Organization `json:"organization"`
	Projects     []ProjectSummary    `json:"projects"`
}
