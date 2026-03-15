package usecase

import (
	"context"
	"log"
	"sort"
	"strings"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

func (s *Service) emitStripeAttribution(ctx context.Context, previousStatus string, event StripeWebhookEvent) {
	if s == nil || s.attribution == nil {
		return
	}

	stage, count, revenueCents := attributionStageFromStripeEvent(previousStatus, event)
	if stage == "" || count <= 0 {
		return
	}

	project, ok := s.resolveAttributionProject(ctx, event)
	if !ok {
		log.Printf("billing-service attribution skipped: no project mapping for organization %d", event.OrganizationID)
		return
	}

	source := normalizeAttributionSource(event.AttributionSource)
	if source == "unknown" {
		source = normalizeAttributionSource(project.AttributionSource)
	}

	if err := s.attribution.RecordEvent(ctx, AttributionEventInput{
		ProjectID:      project.ID,
		OrganizationID: event.OrganizationID,
		Stage:          stage,
		Source:         source,
		Count:          count,
		RevenueCents:   revenueCents,
		OccurredAt:     s.now().UTC(),
	}); err != nil {
		log.Printf(
			"billing-service attribution emit failed for org %d project %s stage %s: %v",
			event.OrganizationID,
			project.ID,
			stage,
			err,
		)
	}
}

func (s *Service) resolveAttributionProject(ctx context.Context, event StripeWebhookEvent) (ProjectSummary, bool) {
	projectID := strings.TrimSpace(event.ProjectID)
	if projectID != "" {
		return ProjectSummary{
			ID:                projectID,
			OrganizationID:    event.OrganizationID,
			AttributionSource: normalizeAttributionSource(event.AttributionSource),
		}, true
	}
	if s.projectResolver == nil || event.OrganizationID <= 0 {
		return ProjectSummary{}, false
	}

	projects, err := s.projectResolver.ListProjectsByOrganization(ctx, event.OrganizationID)
	if err != nil || len(projects) == 0 {
		return ProjectSummary{}, false
	}

	sort.SliceStable(projects, func(i, j int) bool {
		leftActive := strings.EqualFold(strings.TrimSpace(projects[i].Status), "active")
		rightActive := strings.EqualFold(strings.TrimSpace(projects[j].Status), "active")
		if leftActive != rightActive {
			return leftActive
		}
		return projects[i].CreatedAt.After(projects[j].CreatedAt)
	})

	return projects[0], true
}

func attributionStageFromStripeEvent(previousStatus string, event StripeWebhookEvent) (stage string, count int64, revenueCents int64) {
	if event.Type == "invoice.paid" {
		return "paid", 1, maxInt64(0, event.RevenueCents)
	}

	currentStatus := domain.NormalizeSubscriptionStatus(event.Status)
	prevStatus := domain.NormalizeSubscriptionStatus(previousStatus)
	if currentStatus == domain.SubscriptionStatusTrialing && prevStatus != domain.SubscriptionStatusTrialing {
		return "trial", 1, 0
	}

	return "", 0, 0
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

func maxInt64(left, right int64) int64 {
	if left > right {
		return left
	}
	return right
}
