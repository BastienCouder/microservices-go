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
	dashboard, err := s.getProjectDashboardData(ctx, projectID, organizationID)
	if err != nil {
		return OptimizationErrorBoard{}, err
	}
	perception, err := s.buildPerceptionFromDashboard(ctx, projectID, organizationID, dashboard)
	if err != nil {
		return OptimizationErrorBoard{}, err
	}
	perceptionErrors := derivePerceptionOptimizationErrors(perception)

	crawlerUnavailable := false
	crawlerErrors, err := s.listCrawlerOptimizationErrors(ctx, projectID, organizationID)
	if err != nil {
		if errors.Is(err, ErrDependencyUnavailable) {
			crawlerUnavailable = true
			crawlerErrors = nil
		} else {
			return OptimizationErrorBoard{}, err
		}
	}

	errors := make([]OptimizationError, 0, len(perceptionErrors)+len(crawlerErrors))
	errors = append(errors, perceptionErrors...)
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
			"perceptionErrors":        len(perceptionErrors),
			"crawlerErrors":           len(crawlerErrors),
			"crawlerUnavailable":      crawlerUnavailable,
			"analyzedResponses":       perception.Metadata["analyzedResponses"],
		},
	}, nil
}

func derivePerceptionOptimizationErrors(perception PerceptionData) []OptimizationError {
	if !isPerceptionBrandContextReady(perception.BrandCanon) {
		return nil
	}

	type candidate struct {
		errorType           string
		score               int
		axis                string
		title               string
		titleKey            string
		issue               string
		issueKey            string
		impact              string
		impactKey           string
		fixType             string
		generatedContent    string
		generatedContentKey string
		translationParams   map[string]any
	}

	brandLabel := strings.TrimSpace(perception.BrandCanon.BrandName)
	if brandLabel == "" {
		brandLabel = "la marque"
	}

	radarByAxis := make(map[string]int, len(perception.Radar))
	for _, point := range perception.Radar {
		radarByAxis[point.Axis] = point.Score
	}

	metricsByModel := make(map[string][]perceptionResponseMetrics)
	for _, response := range perception.Responses {
		if response.Metrics == nil {
			continue
		}
		modelID := strings.TrimSpace(response.ModelID)
		if modelID == "" {
			continue
		}
		metricsByModel[modelID] = append(metricsByModel[modelID], perceptionResponseMetrics{
			positioning: response.Metrics.Positioning,
			factual:     response.Metrics.Factual,
			useCases:    response.Metrics.UseCases,
			features:    response.Metrics.Features,
			sentiment:   response.Metrics.Sentiment,
			competitors: response.Metrics.Competitors,
		})
	}

	candidates := []candidate{
		{
			errorType:           "positioning_gap",
			score:               perception.Scores.PositioningAccuracy,
			axis:                "positioning",
			title:               "Le positionnement est encore mal cite",
			titleKey:            "perceptionGeneratedPositioningTitle",
			issue:               brandLabel + " n'est pas encore rattache de maniere fiable a son positionnement dans toutes les reponses.",
			issueKey:            "perceptionGeneratedPositioningIssue",
			impact:              "La marque peut etre oubliee ou mal classee sur les requetes de consideration.",
			impactKey:           "perceptionGeneratedPositioningImpact",
			fixType:             "website_copy",
			generatedContent:    "Clarifier la proposition de valeur, la categorie et les scenarios cibles dans les pages d'entree et les FAQ.",
			generatedContentKey: "generatedContentPerceptionPositioningGap",
			translationParams: map[string]any{
				"brand": brandLabel,
				"score": perception.Scores.PositioningAccuracy,
			},
		},
		{
			errorType:           "citation_gap",
			score:               perception.Scores.FactualAccuracy,
			axis:                "features",
			title:               "Factualite encore fragile",
			titleKey:            "perceptionGeneratedCitationTitle",
			issue:               "Les reponses s'appuient encore trop peu sur des sources citees ou des preuves facilement reutilisables.",
			issueKey:            "perceptionGeneratedCitationIssue",
			impact:              "La fiabilite percue de la marque baisse dans les syntheses IA.",
			impactKey:           "perceptionGeneratedCitationImpact",
			fixType:             "faq_snippet",
			generatedContent:    "Ajouter des preuves, chiffres, FAQ et contenus de reference directement citables sur les points cles.",
			generatedContentKey: "generatedContentPerceptionCitationGap",
			translationParams: map[string]any{
				"brand": brandLabel,
				"score": perception.Scores.FactualAccuracy,
			},
		},
		{
			errorType:           "use_case_gap",
			score:               radarByAxis["use_cases"],
			axis:                "use_cases",
			title:               "Cas d'usage encore incomplets",
			titleKey:            "perceptionGeneratedUseCaseTitle",
			issue:               "Les cas d'usage definis dans le brand canon ne ressortent pas assez souvent dans les reponses.",
			issueKey:            "perceptionGeneratedUseCaseIssue",
			impact:              "Les IA ne relient pas encore assez la marque aux besoins cibles.",
			impactKey:           "perceptionGeneratedUseCaseImpact",
			fixType:             "website_copy",
			generatedContent:    "Rendre les use cases prioritaires plus visibles dans la navigation, les hero sections et les pages de comparaison.",
			generatedContentKey: "generatedContentPerceptionUseCaseGap",
			translationParams: map[string]any{
				"brand": brandLabel,
				"score": radarByAxis["use_cases"],
			},
		},
		{
			errorType:           "sentiment_gap",
			score:               perception.Scores.SentimentScore,
			axis:                "sentiment",
			title:               "Tonalite encore trop neutre",
			titleKey:            "perceptionGeneratedSentimentTitle",
			issue:               "Les reponses restent encore trop neutres ou mitigees quand elles parlent de la marque.",
			issueKey:            "perceptionGeneratedSentimentIssue",
			impact:              "La desirabilite de la marque baisse dans les recommandations IA.",
			impactKey:           "perceptionGeneratedSentimentImpact",
			fixType:             "prompt_patch",
			generatedContent:    "Renforcer les preuves de valeur, resultats clients et differentiants dans les contenus sources.",
			generatedContentKey: "generatedContentPerceptionSentimentGap",
			translationParams: map[string]any{
				"score": perception.Scores.SentimentScore,
			},
		},
		{
			errorType:           "competitive_gap",
			score:               radarByAxis["competitors"],
			axis:                "competitors",
			title:               "Lecture concurrentielle encore faible",
			titleKey:            "perceptionGeneratedCompetitiveTitle",
			issue:               "Le positionnement competitif reste variable selon les modeles et les prompts.",
			issueKey:            "perceptionGeneratedCompetitiveIssue",
			impact:              "La marque peut perdre des comparatifs ou apparaitre derriere des alternatives.",
			impactKey:           "perceptionGeneratedCompetitiveImpact",
			fixType:             "schema_update",
			generatedContent:    "Ajouter des comparatifs, tableaux de differenciation et contenus de preuve contre les alternatives majeures.",
			generatedContentKey: "generatedContentPerceptionCompetitiveGap",
			translationParams: map[string]any{
				"score": radarByAxis["competitors"],
			},
		},
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].score < candidates[j].score
	})

	errors := make([]OptimizationError, 0, len(candidates))
	for _, item := range candidates {
		if item.score >= 90 {
			continue
		}

		severity := "low"
		priority := "low"
		switch {
		case item.score < 50:
			severity = "high"
			priority = "high"
		case item.score < 75:
			severity = "medium"
			priority = "medium"
		}

		errors = append(errors, OptimizationError{
			ID:                  "perception:" + item.errorType,
			Source:              "perception",
			Severity:            severity,
			Title:               item.title,
			TitleKey:            item.titleKey,
			Issue:               item.issue,
			IssueKey:            item.issueKey,
			Impact:              item.impact,
			ImpactKey:           item.impactKey,
			Type:                item.errorType,
			FixType:             item.fixType,
			OptimizePriority:    priority,
			DetectedInModels:    lowScoringPerceptionModels(metricsByModel, item.axis),
			GeneratedContent:    item.generatedContent,
			GeneratedContentKey: item.generatedContentKey,
			TranslationParams:   item.translationParams,
		})
	}

	return errors
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
