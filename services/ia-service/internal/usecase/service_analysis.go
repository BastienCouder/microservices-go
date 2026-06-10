package usecase

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

func normalizePromptMode(mode PromptMode) PromptMode {
	switch strings.ToLower(strings.TrimSpace(string(mode))) {
	case string(PromptModeGuided):
		return PromptModeGuided
	default:
		return PromptModeOrganic
	}
}

func buildProviderPrompt(mode PromptMode, promptText, brandName string, competitors []string) string {
	if normalizePromptMode(mode) == PromptModeOrganic {
		return strings.TrimSpace(promptText)
	}

	builder := strings.Builder{}
	builder.WriteString("Prompt utilisateur: ")
	builder.WriteString(promptText)
	builder.WriteString("\n")
	if brandName != "" {
		builder.WriteString("Marque cible: ")
		builder.WriteString(brandName)
		builder.WriteString("\n")
	}
	if len(competitors) > 0 {
		cleaned := make([]string, 0, len(competitors))
		for _, competitor := range competitors {
			competitor = strings.TrimSpace(competitor)
			if competitor != "" {
				cleaned = append(cleaned, competitor)
			}
		}
		if len(cleaned) > 0 {
			builder.WriteString("Concurrents: ")
			builder.WriteString(strings.Join(cleaned, ", "))
			builder.WriteString("\n")
		}
	}
	builder.WriteString("Reponds de facon concise et ajoute des sources URL si tu en cites.")
	return builder.String()
}

func (s *Service) buildSyntheticResponse(promptText, brandName string, competitors []string) string {
	if brandName == "" {
		return "Pour ce besoin, compare plusieurs outils et verifie leurs integrations. Source: https://example.com"
	}
	competitor := "HubSpot"
	if len(competitors) > 0 && strings.TrimSpace(competitors[0]) != "" {
		competitor = strings.TrimSpace(competitors[0])
	}
	return fmt.Sprintf("%s est une excellente option pour ce prompt (%s) face a %s. Voir https://%s.com/pricing", brandName, promptText, competitor, strings.ToLower(brandName))
}

var urlRegex = regexp.MustCompile(`https?://[^\s]+`)

func analyzeResponse(response, brandName string, competitors []string) PromptExecutionAnalysis {
	lowerResponse := strings.ToLower(response)
	lowerBrand := strings.ToLower(strings.TrimSpace(brandName))

	brandMentioned := lowerBrand != "" && strings.Contains(lowerResponse, lowerBrand)
	brandPosition := "unknown"
	if brandMentioned {
		idx := strings.Index(lowerResponse, lowerBrand)
		total := len(lowerResponse)
		switch {
		case idx < total/3:
			brandPosition = "top"
		case idx < (2*total)/3:
			brandPosition = "mid"
		default:
			brandPosition = "bottom"
		}
	}

	urls := uniqueStrings(urlRegex.FindAllString(response, -1))
	competitorsDetected := make([]CompetitorDetected, 0)
	for _, competitor := range competitors {
		competitor = strings.TrimSpace(competitor)
		if competitor == "" {
			continue
		}
		if strings.Contains(lowerResponse, strings.ToLower(competitor)) {
			competitorsDetected = append(competitorsDetected, CompetitorDetected{Name: competitor})
		}
	}

	sentiment := detectSentiment(lowerResponse)

	return PromptExecutionAnalysis{
		BrandMentioned:      brandMentioned,
		BrandPosition:       brandPosition,
		CitationFound:       len(urls) > 0,
		CitedURLs:           urls,
		CompetitorsDetected: competitorsDetected,
		Sentiment:           sentiment,
	}
}

func detectSentiment(lowerResponse string) string {
	positiveKeywords := []string{"excellent", "great", "best", "recommended", "top", "bonne", "excellent"}
	negativeKeywords := []string{"worst", "bad", "avoid", "problem", "issue", "mauvais", "risque"}

	positive := 0
	negative := 0
	for _, keyword := range positiveKeywords {
		if strings.Contains(lowerResponse, keyword) {
			positive++
		}
	}
	for _, keyword := range negativeKeywords {
		if strings.Contains(lowerResponse, keyword) {
			negative++
		}
	}

	switch {
	case positive > negative:
		return "positive"
	case negative > positive:
		return "negative"
	default:
		return "neutral"
	}
}

func deriveBrandName(websiteURL string) string {
	host := websiteURL
	parsed, err := url.Parse(websiteURL)
	if err == nil && parsed.Hostname() != "" {
		host = parsed.Hostname()
	}
	host = strings.TrimPrefix(strings.ToLower(strings.TrimSpace(host)), "www.")
	if host == "" {
		return "Unknown"
	}
	firstPart := strings.Split(host, ".")[0]
	if firstPart == "" {
		return "Unknown"
	}
	return strings.ToUpper(firstPart[:1]) + firstPart[1:]
}

func inferLocale(websiteURL string) (country, language string) {
	host := websiteURL
	parsed, err := url.Parse(websiteURL)
	if err == nil && parsed.Hostname() != "" {
		host = parsed.Hostname()
	}
	host = strings.ToLower(strings.TrimSpace(host))

	switch {
	case strings.HasSuffix(host, ".fr"):
		return "FR", "fr"
	case strings.HasSuffix(host, ".de"):
		return "DE", "de"
	case strings.HasSuffix(host, ".es"):
		return "ES", "es"
	default:
		return "US", "en"
	}
}

func uniqueStrings(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}
