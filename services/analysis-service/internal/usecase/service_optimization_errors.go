package usecase

import (
	"context"
	"sort"
	"strings"
	"time"
)

var optimizationSeverityTitles = map[string]string{
	"high":   "Haute",
	"medium": "Moyenne",
	"low":    "Basse",
}

var optimizationSeverityOrder = []string{"high", "medium", "low"}

func (s *Service) GetOptimizationErrors(ctx context.Context, projectID string, organizationID int64) (OptimizationErrorBoard, error) {
	perception, err := s.GetPerception(ctx, projectID, organizationID)
	if err != nil {
		return OptimizationErrorBoard{}, err
	}
	alerts, err := s.ListAlerts(ctx, projectID, organizationID, false)
	if err != nil {
		return OptimizationErrorBoard{}, err
	}

	errors := make([]OptimizationError, 0, len(alerts)+len(perception.TopErrors))
	monitoringCount := 0
	for _, alert := range alerts {
		severity := normalizeOptimizationSeverity(alert.Severity)
		monitoringCount++
		errors = append(errors, OptimizationError{
			ID:               "monitoring:" + alert.ID,
			Source:           "monitoring",
			Severity:         severity,
			Title:            strings.TrimSpace(alert.Title),
			Issue:            strings.TrimSpace(alert.Description),
			Impact:           "Alerte monitoring detectee sur les reponses IA du projet.",
			Type:             strings.TrimSpace(alert.AlertType),
			FixType:          "prompt_patch",
			OptimizePriority: severity,
			GeneratedContent: "Verifier les prompts, les reponses recentes et les sources qui declenchent cette alerte.",
			CreatedAt:        alert.CreatedAt.UTC().Format(time.RFC3339Nano),
		})
	}

	perceptionCount := 0
	for _, item := range perception.TopErrors {
		perceptionCount++
		severity := normalizeOptimizationSeverity(item.Severity)
		if severity == "low" && item.OptimizePriority != "" {
			severity = normalizeOptimizationSeverity(item.OptimizePriority)
		}
		errors = append(errors, OptimizationError{
			ID:               "perception:" + item.ID,
			Source:           "perception",
			Severity:         severity,
			Title:            strings.TrimSpace(item.Title),
			Issue:            strings.TrimSpace(item.Issue),
			Impact:           strings.TrimSpace(item.Impact),
			Type:             strings.TrimSpace(item.Type),
			FixType:          strings.TrimSpace(item.FixType),
			OptimizePriority: strings.TrimSpace(item.OptimizePriority),
			DetectedInModels: append([]string(nil), item.DetectedInModels...),
			GeneratedContent: strings.TrimSpace(item.GeneratedContent),
		})
	}

	sort.SliceStable(errors, func(i, j int) bool {
		left := optimizationSeverityRank(errors[i].Severity)
		right := optimizationSeverityRank(errors[j].Severity)
		if left != right {
			return left < right
		}
		if errors[i].Source != errors[j].Source {
			return errors[i].Source < errors[j].Source
		}
		return errors[i].Title < errors[j].Title
	})

	return OptimizationErrorBoard{
		Errors:  errors,
		Columns: buildOptimizationErrorColumns(errors),
		Metadata: map[string]any{
			"projectId":         projectID,
			"generatedAt":       time.Now().UTC().Format(time.RFC3339Nano),
			"totalErrors":       len(errors),
			"monitoringErrors":  monitoringCount,
			"perceptionErrors":  perceptionCount,
			"analyzedResponses": perception.Metadata["analyzedResponses"],
		},
	}, nil
}

func buildOptimizationErrorColumns(errors []OptimizationError) []OptimizationErrorColumn {
	columns := make([]OptimizationErrorColumn, 0, len(optimizationSeverityOrder))
	for _, severity := range optimizationSeverityOrder {
		columnErrors := make([]OptimizationError, 0)
		for _, item := range errors {
			if item.Severity == severity {
				columnErrors = append(columnErrors, item)
			}
		}
		columns = append(columns, OptimizationErrorColumn{
			Severity: severity,
			Title:    optimizationSeverityTitles[severity],
			Count:    len(columnErrors),
			Errors:   columnErrors,
		})
	}
	return columns
}

func normalizeOptimizationSeverity(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "high", "haute":
		return "high"
	case "medium", "moyenne":
		return "medium"
	default:
		return "low"
	}
}

func optimizationSeverityRank(value string) int {
	for index, severity := range optimizationSeverityOrder {
		if value == severity {
			return index
		}
	}
	return len(optimizationSeverityOrder)
}
