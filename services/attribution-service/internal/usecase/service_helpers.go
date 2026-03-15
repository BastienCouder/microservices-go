package usecase

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"
)

func (s *Service) ensureProjectAccess(ctx context.Context, projectID, userID string) error {
	if s.projectVerifier == nil {
		return nil
	}
	return s.projectVerifier.EnsureProjectOwnedByUser(ctx, projectID, userID)
}

func (s *Service) ensureProjectOrganizationAccess(ctx context.Context, projectID string, organizationID int64) error {
	if s.projectVerifier == nil {
		return nil
	}
	return s.projectVerifier.EnsureProjectInOrganization(ctx, projectID, organizationID)
}

func normalizeStage(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case StageVisit:
		return StageVisit
	case StageSignup:
		return StageSignup
	case StageTrial:
		return StageTrial
	case StagePaid:
		return StagePaid
	default:
		return ""
	}
}

func normalizeWindow(from, to time.Time, nowFn func() time.Time) (time.Time, time.Time, error) {
	windowEnd := to
	if windowEnd.IsZero() {
		windowEnd = nowFn().UTC()
	} else {
		windowEnd = windowEnd.UTC()
	}
	windowStart := from
	if windowStart.IsZero() {
		windowStart = windowEnd.Add(-30 * 24 * time.Hour)
	} else {
		windowStart = windowStart.UTC()
	}
	if windowStart.After(windowEnd) {
		return time.Time{}, time.Time{}, fmt.Errorf("%w: from must be before to", ErrValidation)
	}
	return windowStart, windowEnd, nil
}

func percent(numerator, denominator int64) int {
	if denominator <= 0 {
		return 0
	}
	return int(math.Round(float64(numerator) / float64(denominator) * 100))
}
