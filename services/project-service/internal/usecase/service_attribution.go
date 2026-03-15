package usecase

import (
	"context"
	"log"
	"strings"
)

func (s *Service) emitProjectSignupAttribution(ctx context.Context, project Project) {
	if s == nil || s.attributionClient == nil {
		return
	}

	if err := s.attributionClient.RecordEvent(ctx, AttributionEventInput{
		ProjectID:      project.ID,
		OrganizationID: project.OrganizationID,
		UserID:         project.CreatedBy,
		Stage:          "signup",
		Source:         project.AttributionSource,
		Count:          1,
	}); err != nil {
		log.Printf("project-service attribution signup emit failed for project %s: %v", project.ID, err)
	}
}

func normalizeAttributionSource(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return "unknown"
	}
	value = strings.ReplaceAll(value, "_", "-")
	value = strings.ReplaceAll(value, " ", "-")
	return value
}
