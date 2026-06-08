package usecase

import (
	"fmt"
	"time"
)

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
