package usecase

import (
	"sort"
	"strings"
	"time"
	"unicode"
)

var perceptionAxisLabels = map[string]string{
	"positioning": "Positionnement",
	"use_cases":   "Cas d'usage",
	"features":    "Fonctionnalites",
	"sentiment":   "Sentiment",
	"competitors": "Concurrents",
}

type perceptionResponseMetrics struct {
	positioning int
	factual     int
	useCases    int
	features    int
	sentiment   int
	competitors int
}

func buildPerceptionResponseMetrics(response AIResponse, canon BrandCanon, projectCompetitors []string) perceptionResponseMetrics {
	normalizedResponse := normalizePerceptionText(response.RawResponse)
	positioning := perceptionPositioningScore(response, canon, normalizedResponse)
	factual := perceptionFactualScore(response, canon, normalizedResponse)
	useCases := perceptionCanonCoverageScore(normalizedResponse, canon.UseCases, response.BrandMentioned, response.CitationFound)
	features := perceptionCanonCoverageScore(normalizedResponse, canon.Features, response.BrandMentioned, response.CitationFound)
	sentiment := perceptionSentimentScore(response.Sentiment)
	competitors := perceptionCompetitorsScore(response, normalizedResponse, projectCompetitors, positioning, factual, sentiment)

	return perceptionResponseMetrics{
		positioning: positioning,
		factual:     factual,
		useCases:    useCases,
		features:    features,
		sentiment:   sentiment,
		competitors: competitors,
	}
}

func perceptionPositioningScore(response AIResponse, canon BrandCanon, normalizedResponse string) int {
	score := 15

	switch normalizeBrandPosition(response.BrandPosition) {
	case "top":
		score = 100
	case "mid":
		score = 58
	case "bottom":
		score = 28
	default:
		if response.BrandMentioned {
			score = 64
		}
	}

	if containsPerceptionPhrase(normalizedResponse, canon.BrandName) {
		score += 8
	}
	if containsPerceptionPhrase(normalizedResponse, canon.Category) {
		score += 12
	}
	if containsPerceptionPhrase(normalizedResponse, canon.Positioning) {
		score += 15
	}

	if strings.TrimSpace(canon.Category) == "" && strings.TrimSpace(canon.Positioning) == "" {
		return min(clampToPercent(float64(score)), 35)
	}
	if strings.TrimSpace(canon.Category) == "" || strings.TrimSpace(canon.Positioning) == "" {
		return min(clampToPercent(float64(score)), 70)
	}

	return clampToPercent(float64(score))
}

func perceptionFactualScore(response AIResponse, canon BrandCanon, normalizedResponse string) int {
	score := 10
	if response.CitationFound || len(response.CitedURLs) > 0 {
		score = 100
	} else if response.BrandMentioned {
		score = 40
	}

	if containsPerceptionPhrase(normalizedResponse, canon.Category) || containsPerceptionPhrase(normalizedResponse, canon.Positioning) {
		score += 10
	}

	return clampToPercent(float64(score))
}

func perceptionCanonCoverageScore(normalizedResponse string, canonItems []string, brandMentioned bool, citationFound bool) int {
	normalizedItems := normalizeCanonList(canonItems)
	if len(normalizedItems) == 0 {
		return 0
	}

	matched := 0
	for _, item := range normalizedItems {
		if containsPerceptionPhrase(normalizedResponse, item) {
			matched++
		}
	}

	score := 15
	if brandMentioned {
		score += 20
	}
	if citationFound {
		score += 10
	}
	score += clampToPercent(float64(matched) / float64(len(normalizedItems)) * 55)

	return clampToPercent(float64(score))
}

func perceptionSentimentScore(value string) int {
	switch normalizeSentiment(value) {
	case "positive":
		return 100
	case "negative":
		return 25
	default:
		return 60
	}
}

func perceptionCompetitorsScore(
	response AIResponse,
	normalizedResponse string,
	projectCompetitors []string,
	positioning int,
	factual int,
	sentiment int,
) int {
	if len(normalizeCanonList(projectCompetitors)) == 0 {
		return 0
	}

	base := clampToPercent(float64(positioning)*0.5 + float64(factual)*0.2 + float64(sentiment)*0.3)
	matchedCompetitors := matchedPerceptionCompetitors(normalizedResponse, projectCompetitors)
	hasComparison := containsCompetitiveComparisonSignal(normalizedResponse)
	hasLead := containsCompetitiveLeadSignal(normalizedResponse, matchedCompetitors)
	if len(matchedCompetitors) == 0 {
		if len(projectCompetitors) > 0 && response.BrandMentioned && normalizeBrandPosition(response.BrandPosition) == "top" {
			return clampToPercent(float64(base + 5))
		}
		if hasComparison {
			return clampToPercent(float64(base - 10))
		}
		return base
	}

	penalty := 8 + (len(matchedCompetitors)-1)*4
	if hasComparison {
		penalty += 12
	}
	if hasLead {
		penalty += 25
	}

	switch normalizeBrandPosition(response.BrandPosition) {
	case "mid":
		penalty += 5
	case "bottom":
		penalty += 15
	}
	if !response.CitationFound && len(response.CitedURLs) == 0 {
		penalty += 5
	}
	if normalizeSentiment(response.Sentiment) == "negative" {
		penalty += 10
	}

	return clampToPercent(float64(base - penalty))
}

type perceptionBrandReadiness struct {
	score      int
	cap        int
	missing    []string
	axisStatus map[string]string
}

func buildPerceptionBrandReadiness(canon BrandCanon, projectCompetitors []string) perceptionBrandReadiness {
	checks := []struct {
		key    string
		ready  bool
		axis   string
		status string
	}{
		{key: "brandName", ready: strings.TrimSpace(canon.BrandName) != ""},
		{key: "category", ready: strings.TrimSpace(canon.Category) != "", axis: "positioning", status: "missing_context"},
		{key: "positioning", ready: strings.TrimSpace(canon.Positioning) != "", axis: "positioning", status: "missing_context"},
		{key: "audience", ready: len(normalizeCanonList(canon.Audience)) > 0, axis: "use_cases", status: "missing_context"},
		{key: "useCases", ready: len(normalizeCanonList(canon.UseCases)) > 0, axis: "use_cases", status: "missing_context"},
		{key: "features", ready: len(normalizeCanonList(canon.Features)) > 0, axis: "features", status: "missing_context"},
		{key: "competitors", ready: len(normalizeCanonList(projectCompetitors)) > 0, axis: "competitors", status: "not_configured"},
	}

	readyCount := 0
	missing := make([]string, 0, len(checks))
	axisStatus := map[string]string{
		"positioning": "measurable",
		"use_cases":   "measurable",
		"features":    "measurable",
		"sentiment":   "measurable",
		"competitors": "measurable",
	}
	for _, check := range checks {
		if check.ready {
			readyCount++
			continue
		}
		missing = append(missing, check.key)
		if check.axis != "" {
			axisStatus[check.axis] = check.status
		}
	}

	score := clampToPercent(float64(readyCount) / float64(len(checks)) * 100)
	cap := 100
	if score < 40 {
		cap = 35
	} else if score < 70 {
		cap = 65
	}

	return perceptionBrandReadiness{
		score:      score,
		cap:        cap,
		missing:    missing,
		axisStatus: axisStatus,
	}
}

func perceptionReadinessMetadata(readiness perceptionBrandReadiness) map[string]any {
	return map[string]any{
		"score":      readiness.score,
		"cap":        readiness.cap,
		"missing":    append([]string(nil), readiness.missing...),
		"axisStatus": readiness.axisStatus,
	}
}

func matchedPerceptionCompetitors(normalizedResponse string, competitors []string) []string {
	normalizedCompetitors := normalizeCanonList(competitors)
	if normalizedResponse == "" || len(normalizedCompetitors) == 0 {
		return nil
	}

	matched := make([]string, 0, len(normalizedCompetitors))
	for _, competitor := range normalizedCompetitors {
		normalizedCompetitor := normalizePerceptionText(competitor)
		if normalizedCompetitor == "" {
			continue
		}
		if containsPerceptionPhrase(normalizedResponse, normalizedCompetitor) {
			matched = append(matched, normalizedCompetitor)
		}
	}

	return matched
}

func containsCompetitiveComparisonSignal(normalizedResponse string) bool {
	return strings.Contains(normalizedResponse, " vs ") ||
		strings.Contains(normalizedResponse, " versus ") ||
		strings.Contains(normalizedResponse, " face a ") ||
		strings.Contains(normalizedResponse, " compare a ") ||
		strings.Contains(normalizedResponse, " devant ") ||
		strings.Contains(normalizedResponse, " derriere ") ||
		strings.Contains(normalizedResponse, " behind ")
}

func containsCompetitiveLeadSignal(normalizedResponse string, matchedCompetitors []string) bool {
	if normalizedResponse == "" || len(matchedCompetitors) == 0 {
		return false
	}

	leadSignals := []string{
		"reste la meilleure option",
		"est la meilleure option",
		"reste le meilleur choix",
		"est le meilleur choix",
		"reste devant",
		"est devant",
		"leader",
		"ahead",
		"top choice",
	}

	for _, competitor := range matchedCompetitors {
		if strings.HasPrefix(normalizedResponse, competitor+" ") {
			return true
		}
		for _, signal := range leadSignals {
			if strings.Contains(normalizedResponse, competitor+" "+signal) {
				return true
			}
		}
	}

	return false
}

func derivePerceptionScoresFromMetrics(metrics []perceptionResponseMetrics) PerceptionScores {
	return PerceptionScores{
		PositioningAccuracy: averagePerceptionMetric(metrics, func(item perceptionResponseMetrics) int { return item.positioning }),
		FactualAccuracy:     averagePerceptionMetric(metrics, func(item perceptionResponseMetrics) int { return item.factual }),
		SentimentScore:      averagePerceptionMetric(metrics, func(item perceptionResponseMetrics) int { return item.sentiment }),
	}
}

func derivePerceptionRadarFromMetrics(metrics []perceptionResponseMetrics) []PerceptionRadarPoint {
	return []PerceptionRadarPoint{
		{Axis: "positioning", Label: perceptionAxisLabels["positioning"], Score: averagePerceptionMetric(metrics, func(item perceptionResponseMetrics) int { return item.positioning }), Target: 100},
		{Axis: "use_cases", Label: perceptionAxisLabels["use_cases"], Score: averagePerceptionMetric(metrics, func(item perceptionResponseMetrics) int { return item.useCases }), Target: 100},
		{Axis: "features", Label: perceptionAxisLabels["features"], Score: averagePerceptionMetric(metrics, func(item perceptionResponseMetrics) int { return item.features }), Target: 100},
		{Axis: "sentiment", Label: perceptionAxisLabels["sentiment"], Score: averagePerceptionMetric(metrics, func(item perceptionResponseMetrics) int { return item.sentiment }), Target: 100},
		{Axis: "competitors", Label: perceptionAxisLabels["competitors"], Score: averagePerceptionMetric(metrics, func(item perceptionResponseMetrics) int { return item.competitors }), Target: 100},
	}
}

func derivePerceptionTopErrors(
	canon BrandCanon,
	scores PerceptionScores,
	radar []PerceptionRadarPoint,
	metricsByModel map[string][]perceptionResponseMetrics,
) []PerceptionError {
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

	brandLabel := strings.TrimSpace(canon.BrandName)
	if brandLabel == "" {
		brandLabel = "la marque"
	}

	radarByAxis := make(map[string]int, len(radar))
	for _, point := range radar {
		radarByAxis[point.Axis] = point.Score
	}

	candidates := []candidate{
		{
			errorType:           "positioning_gap",
			score:               scores.PositioningAccuracy,
			axis:                "positioning",
			title:               "Le positionnement est encore mal cite",
			titleKey:            "topErrorsGeneratedPositioningTitle",
			issue:               brandLabel + " n'est pas encore rattache de maniere fiable a son positionnement dans toutes les reponses.",
			issueKey:            "topErrorsGeneratedPositioningIssue",
			impact:              "La marque peut etre oubliee ou mal classee sur les requetes de consideration.",
			impactKey:           "topErrorsGeneratedPositioningImpact",
			fixType:             "website_copy",
			generatedContent:    "Clarifier la proposition de valeur, la categorie et les scenarios cibles dans les pages d'entree et les FAQ.",
			generatedContentKey: "generatedContentPerceptionPositioningGap",
			translationParams: map[string]any{
				"brand": brandLabel,
				"score": scores.PositioningAccuracy,
			},
		},
		{
			errorType:           "citation_gap",
			score:               scores.FactualAccuracy,
			axis:                "features",
			title:               "Factualite encore fragile",
			titleKey:            "topErrorsGeneratedCitationTitle",
			issue:               "Les reponses s'appuient encore trop peu sur des sources citees ou des preuves facilement reutilisables.",
			issueKey:            "topErrorsGeneratedCitationIssue",
			impact:              "La fiabilite percue de la marque baisse dans les syntheses IA.",
			impactKey:           "topErrorsGeneratedCitationImpact",
			fixType:             "faq_snippet",
			generatedContent:    "Ajouter des preuves, chiffres, FAQ et contenus de reference directement citables sur les points cles.",
			generatedContentKey: "generatedContentPerceptionCitationGap",
			translationParams: map[string]any{
				"brand": brandLabel,
				"score": scores.FactualAccuracy,
			},
		},
		{
			errorType:           "use_case_gap",
			score:               radarByAxis["use_cases"],
			axis:                "use_cases",
			title:               "Cas d'usage encore incomplets",
			titleKey:            "topErrorsGeneratedUseCaseTitle",
			issue:               "Les cas d'usage definis dans le brand canon ne ressortent pas assez souvent dans les reponses.",
			issueKey:            "topErrorsGeneratedUseCaseIssue",
			impact:              "Les IA ne relient pas encore assez la marque aux besoins cibles.",
			impactKey:           "topErrorsGeneratedUseCaseImpact",
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
			score:               scores.SentimentScore,
			axis:                "sentiment",
			title:               "Tonalite encore trop neutre",
			titleKey:            "topErrorsGeneratedSentimentTitle",
			issue:               "Les reponses restent encore trop neutres ou mitigees quand elles parlent de la marque.",
			issueKey:            "topErrorsGeneratedSentimentIssue",
			impact:              "La desirabilite de la marque baisse dans les recommandations IA.",
			impactKey:           "topErrorsGeneratedSentimentImpact",
			fixType:             "prompt_patch",
			generatedContent:    "Renforcer les preuves de valeur, resultats clients et differentiants dans les contenus sources.",
			generatedContentKey: "generatedContentPerceptionSentimentGap",
			translationParams: map[string]any{
				"score": scores.SentimentScore,
			},
		},
		{
			errorType:           "competitive_gap",
			score:               radarByAxis["competitors"],
			axis:                "competitors",
			title:               "Lecture concurrentielle encore faible",
			titleKey:            "topErrorsGeneratedCompetitiveTitle",
			issue:               "Le positionnement competitif reste variable selon les modeles et les prompts.",
			issueKey:            "topErrorsGeneratedCompetitiveIssue",
			impact:              "La marque peut perdre des comparatifs ou apparaitre derriere des alternatives.",
			impactKey:           "topErrorsGeneratedCompetitiveImpact",
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

	topErrors := make([]PerceptionError, 0, len(candidates))
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

		topErrors = append(topErrors, PerceptionError{
			ID:                  item.errorType,
			Type:                item.errorType,
			Severity:            severity,
			Title:               item.title,
			TitleKey:            item.titleKey,
			Issue:               item.issue,
			IssueKey:            item.issueKey,
			Impact:              item.impact,
			ImpactKey:           item.impactKey,
			DetectedInModels:    lowScoringPerceptionModels(metricsByModel, item.axis),
			FixType:             item.fixType,
			GeneratedContent:    item.generatedContent,
			GeneratedContentKey: item.generatedContentKey,
			TranslationParams:   item.translationParams,
			OptimizePriority:    priority,
		})
	}

	return topErrors
}

func lowScoringPerceptionModels(metricsByModel map[string][]perceptionResponseMetrics, axis string) []string {
	type modelScore struct {
		modelID string
		score   int
	}

	scores := make([]modelScore, 0, len(metricsByModel))
	for modelID, metrics := range metricsByModel {
		if modelID == "" {
			continue
		}

		score := averagePerceptionMetric(metrics, func(item perceptionResponseMetrics) int {
			switch axis {
			case "positioning":
				return item.positioning
			case "use_cases":
				return item.useCases
			case "features":
				return item.features
			case "sentiment":
				return item.sentiment
			case "competitors":
				return item.competitors
			default:
				return item.factual
			}
		})

		scores = append(scores, modelScore{modelID: modelID, score: score})
	}

	sort.Slice(scores, func(i, j int) bool {
		if scores[i].score == scores[j].score {
			return scores[i].modelID < scores[j].modelID
		}
		return scores[i].score < scores[j].score
	})

	selected := make([]string, 0, min(2, len(scores)))
	for _, item := range scores {
		if item.score >= 75 {
			continue
		}
		selected = append(selected, item.modelID)
		if len(selected) == 2 {
			break
		}
	}

	if len(selected) > 0 {
		return selected
	}

	for _, item := range scores {
		selected = append(selected, item.modelID)
		if len(selected) == 2 {
			break
		}
	}

	return selected
}

func derivePerceptionWindowLabel(responses []AIResponse, reference time.Time) string {
	if len(responses) == 0 {
		return "30 derniers jours"
	}

	earliest := responses[0].CreatedAt
	for _, response := range responses[1:] {
		if response.CreatedAt.Before(earliest) {
			earliest = response.CreatedAt
		}
	}

	diffDays := int(reference.Sub(earliest).Hours() / 24)
	switch {
	case diffDays <= 7:
		return "7 derniers jours"
	case diffDays <= 30:
		return "30 derniers jours"
	case diffDays <= 90:
		return "90 derniers jours"
	default:
		return "Depuis le debut"
	}
}

func averagePerceptionMetric(
	metrics []perceptionResponseMetrics,
	selector func(perceptionResponseMetrics) int,
) int {
	if len(metrics) == 0 {
		return 0
	}

	total := 0
	for _, item := range metrics {
		total += selector(item)
	}

	return clampToPercent(float64(total) / float64(len(metrics)))
}

func normalizePerceptionText(value string) string {
	var builder strings.Builder
	spacePending := true

	for _, char := range strings.ToLower(strings.TrimSpace(value)) {
		if unicode.IsLetter(char) || unicode.IsNumber(char) {
			builder.WriteRune(char)
			spacePending = false
			continue
		}
		if !spacePending {
			builder.WriteByte(' ')
			spacePending = true
		}
	}

	return strings.TrimSpace(builder.String())
}

func containsPerceptionPhrase(normalizedText string, phrase string) bool {
	normalizedPhrase := normalizePerceptionText(phrase)
	if normalizedText == "" || normalizedPhrase == "" {
		return false
	}
	return strings.Contains(" "+normalizedText+" ", " "+normalizedPhrase+" ")
}
