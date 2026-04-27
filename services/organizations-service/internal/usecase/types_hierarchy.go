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

type ProjectMemberAssigner interface {
	AssignProjectMember(ctx context.Context, projectID string, organizationID, userID int64, role string) error
}

type ProjectSummary struct {
	ID                string    `json:"id"`
	OrganizationID    int64     `json:"organizationId"`
	Name              string    `json:"name"`
	Status            string    `json:"status"`
	BrandName         string    `json:"brandName,omitempty"`
	BrandDescription  string    `json:"brandDescription,omitempty"`
	AttributionSource string    `json:"attributionSource,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`
}

type OrganizationHierarchy struct {
	Organization domain.Organization `json:"organization"`
	Projects     []ProjectSummary    `json:"projects"`
}
