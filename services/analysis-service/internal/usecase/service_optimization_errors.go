package usecase

import (
	"context"
	"errors"
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
	dashboard, err := s.GetDashboard(ctx, projectID, organizationID)
	if err != nil {
		return OptimizationErrorBoard{}, err
	}
	perception, err := s.buildPerceptionFromDashboard(ctx, projectID, organizationID, dashboard)
	if err != nil {
		return OptimizationErrorBoard{}, err
	}

	crawlerErrors, err := s.listCrawlerOptimizationErrors(ctx, projectID, organizationID)
	if err != nil {
		return OptimizationErrorBoard{}, err
	}

	errors := make([]OptimizationError, 0, len(perception.TopErrors)+len(crawlerErrors))
	perceptionCount := 0
	for _, item := range perception.TopErrors {
		perceptionCount++
		severity := normalizeOptimizationSeverity(item.Severity)
		if severity == "low" && item.OptimizePriority != "" {
			severity = normalizeOptimizationSeverity(item.OptimizePriority)
		}
		errors = append(errors, OptimizationError{
			ID:                  "perception:" + item.ID,
			Source:              "perception",
			Severity:            severity,
			Title:               strings.TrimSpace(item.Title),
			TitleKey:            strings.TrimSpace(item.TitleKey),
			Issue:               strings.TrimSpace(item.Issue),
			IssueKey:            strings.TrimSpace(item.IssueKey),
			Impact:              strings.TrimSpace(item.Impact),
			ImpactKey:           strings.TrimSpace(item.ImpactKey),
			Type:                strings.TrimSpace(item.Type),
			FixType:             strings.TrimSpace(item.FixType),
			OptimizePriority:    strings.TrimSpace(item.OptimizePriority),
			DetectedInModels:    append([]string(nil), item.DetectedInModels...),
			GeneratedContent:    strings.TrimSpace(item.GeneratedContent),
			GeneratedContentKey: strings.TrimSpace(item.GeneratedContentKey),
			TranslationParams:   copyMetadata(item.TranslationParams),
		})
	}
	errors = append(errors, crawlerErrors...)

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
			"projectId":               projectID,
			"generatedAt":             time.Now().UTC().Format(time.RFC3339Nano),
			"totalErrors":             len(errors),
			"monitoringErrors":        0,
			"monitoringDerivedErrors": 0,
			"perceptionErrors":        perceptionCount,
			"crawlerErrors":           len(crawlerErrors),
			"analyzedResponses":       perception.Metadata["analyzedResponses"],
		},
	}, nil
}

func filterNonPerceptionResponses(responses []AIResponse) []AIResponse {
	out := make([]AIResponse, 0, len(responses))
	for _, response := range responses {
		if strings.TrimSpace(response.RunType) == "perception" {
			continue
		}
		out = append(out, response)
	}
	return out
}

type monitoringModelStats struct {
	modelID   string
	total     int
	mentions  int
	citations int
	top       int
	bottom    int
	negative  int
}

func deriveMonitoringTopErrors(responses []AIResponse) []OptimizationError {
	if len(responses) == 0 {
		return nil
	}

	modelStats := make(map[string]*monitoringModelStats)
	mentions := 0
	citations := 0
	top := 0
	bottom := 0
	negative := 0

	for _, response := range responses {
		modelID := strings.TrimSpace(response.ModelID)
		if modelID == "" {
			modelID = "unknown-model"
		}
		stats := modelStats[modelID]
		if stats == nil {
			stats = &monitoringModelStats{modelID: modelID}
			modelStats[modelID] = stats
		}
		stats.total++
		if response.BrandMentioned {
			mentions++
			stats.mentions++
		}
		if response.CitationFound {
			citations++
			stats.citations++
		}
		if response.BrandPosition == "top" {
			top++
			stats.top++
		}
		if response.BrandPosition == "bottom" {
			bottom++
			stats.bottom++
		}
		if response.Sentiment == "negative" {
			negative++
			stats.negative++
		}
	}

	total := float64(len(responses))
	mentionRate := float64(mentions) / total
	citationRate := float64(citations) / total
	topRate := float64(top) / total
	bottomRate := float64(bottom) / total
	negativeRate := float64(negative) / total

	errors := make([]OptimizationError, 0, 5)
	if mentionRate < 0.45 {
		severity := "medium"
		if mentionRate < 0.25 {
			severity = "high"
		}
		errors = append(errors, OptimizationError{
			ID:                  "monitoring-derived:visibility_gap",
			Source:              "monitoring",
			Origin:              "derived",
			Severity:            severity,
			Title:               "La marque ressort trop peu dans les prompts suivis",
			TitleKey:            "errorTypeMonitoringVisibilityGap",
			Issue:               "Le taux de mention reste insuffisant sur les requetes monitoring prioritaires.",
			IssueKey:            "topErrorsMonitoringVisibilityIssue",
			Impact:              "La marque risque d'etre absente des recommandations IA sur les moments d'intention cle.",
			ImpactKey:           "topErrorsMonitoringVisibilityImpact",
			Type:                "monitoring_visibility_gap",
			FixType:             "prompt_patch",
			OptimizePriority:    severity,
			DetectedInModels:    lowestMentionModels(modelStats, 2),
			GeneratedContent:    "Revoir les prompts coeur de marche, renforcer les pages de positionnement et les preuves citees par les IA.",
			GeneratedContentKey: "generatedContentMonitoringVisibilityGap",
			TranslationParams:   map[string]any{},
		})
	}
	if mentionRate >= 0.45 && citationRate < 0.35 {
		severity := "medium"
		if citationRate < 0.2 {
			severity = "high"
		}
		errors = append(errors, OptimizationError{
			ID:                  "monitoring-derived:citation_gap",
			Source:              "monitoring",
			Origin:              "derived",
			Severity:            severity,
			Title:               "La marque est mentionnee mais manque de sources citees",
			TitleKey:            "errorTypeMonitoringCitationGap",
			Issue:               "Les IA citent encore trop rarement des preuves ou URLs fiables quand elles parlent de la marque.",
			IssueKey:            "topErrorsMonitoringCitationIssue",
			Impact:              "La credibilite de la marque reste fragile dans les reponses et comparatifs IA.",
			ImpactKey:           "topErrorsMonitoringCitationImpact",
			Type:                "monitoring_citation_gap",
			FixType:             "faq_snippet",
			OptimizePriority:    severity,
			DetectedInModels:    lowestCitationModels(modelStats, 2),
			GeneratedContent:    "Ajouter des contenus davantage citables: FAQ, comparatifs, chiffres, preuves produit et pages de reference.",
			GeneratedContentKey: "generatedContentMonitoringCitationGap",
			TranslationParams:   map[string]any{},
		})
	}
	if mentionRate >= 0.45 && topRate < 0.25 && bottomRate >= 0.3 {
		severity := "medium"
		if bottomRate >= 0.45 {
			severity = "high"
		}
		errors = append(errors, OptimizationError{
			ID:                  "monitoring-derived:ranking_gap",
			Source:              "monitoring",
			Origin:              "derived",
			Severity:            severity,
			Title:               "La marque perd les positions hautes sur les prompts suivis",
			TitleKey:            "errorTypeMonitoringRankingGap",
			Issue:               "Les reponses mentionnent la marque mais la placent trop rarement en tete et trop souvent en bas de classement.",
			IssueKey:            "topErrorsMonitoringRankingIssue",
			Impact:              "La visibilite IA devient moins competitive sur les prompts a forte intention.",
			ImpactKey:           "topErrorsMonitoringRankingImpact",
			Type:                "monitoring_ranking_gap",
			FixType:             "website_copy",
			OptimizePriority:    severity,
			DetectedInModels:    worstRankingModels(modelStats, 2),
			GeneratedContent:    "Clarifier la proposition de valeur, les differentiants et les comparatifs concurrentiels sur les pages cle.",
			GeneratedContentKey: "generatedContentMonitoringRankingGap",
			TranslationParams:   map[string]any{},
		})
	}
	if negativeRate >= 0.35 {
		severity := "medium"
		if negativeRate >= 0.5 {
			severity = "high"
		}
		errors = append(errors, OptimizationError{
			ID:                  "monitoring-derived:negative_shift",
			Source:              "monitoring",
			Origin:              "derived",
			Severity:            severity,
			Title:               "La tonalite des reponses devient trop negative",
			TitleKey:            "errorTypeMonitoringNegativeShift",
			Issue:               "Une part trop importante des reponses monitoring parle de la marque avec une tonalite negative.",
			IssueKey:            "topErrorsMonitoringNegativeShiftIssue",
			Impact:              "La desirabilite et la confiance baissent dans les recommandations et comparatifs IA.",
			ImpactKey:           "topErrorsMonitoringNegativeShiftImpact",
			Type:                "monitoring_negative_shift",
			FixType:             "website_copy",
			OptimizePriority:    severity,
			DetectedInModels:    mostNegativeModels(modelStats, 2),
			GeneratedContent:    "Renforcer les contenus de reassurance, les cas clients, les preuves de resultat et les objections traitees.",
			GeneratedContentKey: "generatedContentMonitoringNegativeShift",
			TranslationParams:   map[string]any{},
		})
	}
	if hasMonitoringVolatility(modelStats) {
		errors = append(errors, OptimizationError{
			ID:                  "monitoring-derived:model_volatility",
			Source:              "monitoring",
			Origin:              "derived",
			Severity:            "medium",
			Title:               "Les modeles racontent des histoires trop differentes sur la marque",
			TitleKey:            "errorTypeMonitoringModelVolatility",
			Issue:               "Les performances monitoring varient fortement d'un modele a l'autre, signe d'un positionnement encore instable.",
			IssueKey:            "topErrorsMonitoringModelVolatilityIssue",
			Impact:              "La marque peut sembler forte sur certains assistants et faible sur d'autres, ce qui reduit la coherence globale.",
			ImpactKey:           "topErrorsMonitoringModelVolatilityImpact",
			Type:                "monitoring_model_volatility",
			FixType:             "prompt_patch",
			OptimizePriority:    "medium",
			DetectedInModels:    volatilityModels(modelStats, 2),
			GeneratedContent:    "Uniformiser les contenus de positionnement, les cas d'usage et les comparatifs pour reduire l'ecart entre modeles.",
			GeneratedContentKey: "generatedContentMonitoringModelVolatility",
			TranslationParams:   map[string]any{},
		})
	}

	return errors
}

func lowestMentionModels(stats map[string]*monitoringModelStats, limit int) []string {
	return pickMonitoringModels(stats, limit, func(item *monitoringModelStats) float64 {
		if item.total == 0 {
			return 1
		}
		return float64(item.mentions) / float64(item.total)
	}, true)
}

func lowestCitationModels(stats map[string]*monitoringModelStats, limit int) []string {
	return pickMonitoringModels(stats, limit, func(item *monitoringModelStats) float64 {
		if item.total == 0 {
			return 1
		}
		return float64(item.citations) / float64(item.total)
	}, true)
}

func worstRankingModels(stats map[string]*monitoringModelStats, limit int) []string {
	return pickMonitoringModels(stats, limit, func(item *monitoringModelStats) float64 {
		if item.total == 0 {
			return 0
		}
		return float64(item.bottom-item.top) / float64(item.total)
	}, true)
}

func mostNegativeModels(stats map[string]*monitoringModelStats, limit int) []string {
	return pickMonitoringModels(stats, limit, func(item *monitoringModelStats) float64 {
		if item.total == 0 {
			return 0
		}
		return float64(item.negative) / float64(item.total)
	}, false)
}

func volatilityModels(stats map[string]*monitoringModelStats, limit int) []string {
	return pickMonitoringModels(stats, limit, func(item *monitoringModelStats) float64 {
		if item.total == 0 {
			return 0
		}
		mentionRate := float64(item.mentions) / float64(item.total)
		rankingSpread := float64(item.top+item.bottom) / float64(item.total)
		return (1 - mentionRate) + rankingSpread
	}, false)
}

func hasMonitoringVolatility(stats map[string]*monitoringModelStats) bool {
	if len(stats) < 2 {
		return false
	}
	minMention := 1.0
	maxMention := 0.0
	for _, item := range stats {
		if item.total == 0 {
			continue
		}
		rate := float64(item.mentions) / float64(item.total)
		if rate < minMention {
			minMention = rate
		}
		if rate > maxMention {
			maxMention = rate
		}
	}
	return maxMention-minMention >= 0.45
}

func pickMonitoringModels(
	stats map[string]*monitoringModelStats,
	limit int,
	score func(*monitoringModelStats) float64,
	ascending bool,
) []string {
	type row struct {
		modelID string
		score   float64
	}
	rows := make([]row, 0, len(stats))
	for _, item := range stats {
		if item == nil || item.modelID == "" {
			continue
		}
		rows = append(rows, row{modelID: item.modelID, score: score(item)})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].score == rows[j].score {
			return rows[i].modelID < rows[j].modelID
		}
		if ascending {
			return rows[i].score < rows[j].score
		}
		return rows[i].score > rows[j].score
	})
	if limit <= 0 || limit > len(rows) {
		limit = len(rows)
	}
	out := make([]string, 0, limit)
	for _, item := range rows[:limit] {
		out = append(out, item.modelID)
	}
	return out
}

func (s *Service) listCrawlerOptimizationErrors(ctx context.Context, projectID string, organizationID int64) ([]OptimizationError, error) {
	snapshot, err := s.GetLatestContentOptimizerCrawl(ctx, projectID, organizationID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}

	createdAt := snapshot.UpdatedAt
	if createdAt.IsZero() {
		createdAt = snapshot.CreatedAt
	}

	items := make([]OptimizationError, 0)
	for _, record := range snapshot.Result.Records {
		pageURL := strings.TrimSpace(record.URL)
		for index, issue := range record.Issues {
			id := strings.TrimSpace(issue.ID)
			if id == "" {
				id = contentOptimizerIssueID(pageURL, strings.TrimSpace(issue.FixType))
				if id == "page" || strings.HasSuffix(id, "-") {
					id = contentOptimizerIssueID(pageURL, strings.TrimSpace(issue.Category))
				}
				if id == "page" || strings.HasSuffix(id, "-") {
					id = contentOptimizerIssueID(pageURL, "issue")
				}
			}
			if index > 0 && id == "" {
				id = contentOptimizerIssueID(pageURL, "issue")
			}

			severity := normalizeOptimizationSeverity(issue.Severity)
			textKeys := crawlerOptimizationTextKeys(issue, pageURL)
			items = append(items, OptimizationError{
				ID:                  "crawler:" + id,
				Source:              "crawler",
				Resource:            pageURL,
				Severity:            severity,
				Title:               strings.TrimSpace(issue.Title),
				TitleKey:            textKeys.titleKey,
				Issue:               strings.TrimSpace(issue.Description),
				IssueKey:            textKeys.issueKey,
				Impact:              crawlerOptimizationImpact(pageURL),
				ImpactKey:           textKeys.impactKey,
				Type:                crawlerOptimizationType(issue),
				FixType:             crawlerOptimizationFixType(issue),
				OptimizePriority:    severity,
				GeneratedContent:    strings.TrimSpace(issue.Recommendation),
				GeneratedContentKey: textKeys.generatedContentKey,
				TranslationParams:   textKeys.params,
				CreatedAt:           formatOptimizationErrorTime(createdAt),
			})
		}
	}
	return items, nil
}

type optimizationTextKeys struct {
	titleKey            string
	issueKey            string
	impactKey           string
	generatedContentKey string
	params              map[string]any
}

func crawlerOptimizationTextKeys(issue ContentOptimizerIssue, pageURL string) optimizationTextKeys {
	fixType := strings.TrimSpace(issue.FixType)
	if fixType == "" {
		return optimizationTextKeys{
			impactKey: "crawlerImpactPage",
			params: map[string]any{
				"resource": pageURL,
			},
		}
	}

	suffix := toCamelCaseKeySuffix(fixType)
	return optimizationTextKeys{
		titleKey:            "crawlerIssue" + suffix + "Title",
		issueKey:            "crawlerIssue" + suffix + "Issue",
		impactKey:           "crawlerIssue" + suffix + "Impact",
		generatedContentKey: "crawlerIssue" + suffix + "Fix",
		params: map[string]any{
			"resource": pageURL,
		},
	}
}

func toCamelCaseKeySuffix(value string) string {
	parts := strings.FieldsFunc(strings.TrimSpace(value), func(r rune) bool {
		return r == '_' || r == '-' || r == ' '
	})
	if len(parts) == 0 {
		return "Generic"
	}

	var builder strings.Builder
	for _, part := range parts {
		if part == "" {
			continue
		}
		normalized := strings.ToLower(part)
		builder.WriteString(strings.ToUpper(normalized[:1]))
		if len(normalized) > 1 {
			builder.WriteString(normalized[1:])
		}
	}

	if builder.Len() == 0 {
		return "Generic"
	}
	return builder.String()
}

func crawlerOptimizationImpact(pageURL string) string {
	pageURL = strings.TrimSpace(pageURL)
	if pageURL == "" {
		return "Point detecte par le crawl de contenu."
	}
	return "Point detecte par le crawl de contenu sur " + pageURL + "."
}

func crawlerOptimizationType(issue ContentOptimizerIssue) string {
	fixType := strings.TrimSpace(issue.FixType)
	if fixType != "" {
		return fixType
	}
	category := strings.TrimSpace(issue.Category)
	if category != "" {
		return category
	}
	return "crawler_issue"
}

func crawlerOptimizationFixType(issue ContentOptimizerIssue) string {
	fixType := strings.ToLower(strings.TrimSpace(issue.FixType))
	category := strings.ToLower(strings.TrimSpace(issue.Category))
	if strings.Contains(fixType, "schema") {
		return "schema_update"
	}
	if strings.Contains(fixType, "faq") {
		return "faq_snippet"
	}
	if strings.Contains(fixType, "http") || strings.Contains(category, "technical") {
		return "prompt_patch"
	}
	return "website_copy"
}

func formatOptimizationErrorTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339Nano)
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
