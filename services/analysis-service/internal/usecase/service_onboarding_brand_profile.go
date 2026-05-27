package usecase

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"
)

type OnboardingBrandProfileInput struct {
	WebsiteURL string
	BrandName  string
}

type OnboardingBrandProfileCompetitor struct {
	Name    string `json:"name"`
	Website string `json:"website"`
}

type OnboardingBrandProfilePrompt struct {
	Text     string `json:"text"`
	Language string `json:"language"`
}

type OnboardingBrandProfilePreview struct {
	Status                string                             `json:"status"`
	CrawlJobID            string                             `json:"crawlJobId,omitempty"`
	BrandName             string                             `json:"brandName"`
	BrandShortDescription string                             `json:"brandShortDescription"`
	BrandDescription      string                             `json:"brandDescription"`
	Industry              string                             `json:"industry"`
	KeyFeatures           []string                           `json:"keyFeatures"`
	Competitors           []OnboardingBrandProfileCompetitor `json:"competitors"`
	Prompts               []OnboardingBrandProfilePrompt     `json:"prompts"`
}

func (s *Service) PreviewOnboardingBrandProfile(
	ctx context.Context,
	input OnboardingBrandProfileInput,
) (OnboardingBrandProfilePreview, error) {
	normalizedURL, err := normalizeOnboardingWebsiteURL(input.WebsiteURL)
	if err != nil {
		return OnboardingBrandProfilePreview{}, err
	}
	if s.contentCrawler == nil {
		return buildOnboardingBrandProfileFallback(input.BrandName, normalizedURL), nil
	}

	job, err := s.contentCrawler.StartCrawl(ctx, ContentOptimizerCrawlStartInput{
		URL:     normalizedURL,
		Limit:   6,
		Depth:   1,
		Source:  "all",
		Formats: []string{"markdown"},
		Render:  false,
		Options: ContentOptimizerCrawlOptions{
			IncludePatterns: onboardingAboutIncludePatterns(normalizedURL),
		},
		CrawlPurposes: []string{"search", "ai-input"},
	})
	if err != nil {
		if errors.Is(err, ErrDependencyUnavailable) {
			return buildOnboardingBrandProfileFallback(input.BrandName, normalizedURL), nil
		}
		return OnboardingBrandProfilePreview{}, err
	}

	result := ContentOptimizerCrawlResult{Status: job.Status}
	for attempt := 0; attempt < 5; attempt++ {
		result, err = s.contentCrawler.GetCrawl(ctx, job.ID, ContentOptimizerCrawlResultInput{
			Limit:        10,
			Status:       "completed",
			SkipAnalysis: true,
		})
		if err != nil {
			return OnboardingBrandProfilePreview{}, err
		}
		if isTerminalCrawlJobStatus(result.Status) || len(result.Records) > 0 {
			break
		}
		select {
		case <-ctx.Done():
			return OnboardingBrandProfilePreview{}, ctx.Err()
		case <-time.After(500 * time.Millisecond):
		}
	}

	preview := buildOnboardingBrandProfilePreview(input.BrandName, normalizedURL, job.ID, result)
	if s.onboardingBrandProfileAnalyzer != nil {
		aiPreview, err := s.onboardingBrandProfileAnalyzer.AnalyzeOnboardingBrandProfile(ctx, OnboardingBrandProfileAnalysisInput{
			WebsiteURL: normalizedURL,
			BrandName:  input.BrandName,
			CrawlText:  onboardingCrawlText(result.Records),
			Fallback:   preview,
		})
		if err == nil {
			preview = mergeOnboardingBrandProfilePreview(preview, aiPreview)
		}
	}
	return preview, nil
}

func buildOnboardingBrandProfileFallback(
	brandName string,
	websiteURL string,
) OnboardingBrandProfilePreview {
	return buildOnboardingBrandProfilePreview(
		brandName,
		websiteURL,
		"",
		ContentOptimizerCrawlResult{Status: "fallback"},
	)
}

func normalizeOnboardingWebsiteURL(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", fmt.Errorf("%w: website url is required", ErrValidation)
	}
	if !strings.HasPrefix(strings.ToLower(trimmed), "http://") &&
		!strings.HasPrefix(strings.ToLower(trimmed), "https://") {
		trimmed = "https://" + trimmed
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" {
		return "", fmt.Errorf("%w: website url must be absolute", ErrValidation)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("%w: website url must use http or https", ErrValidation)
	}
	parsed.Fragment = ""
	return parsed.String(), nil
}

func onboardingAboutIncludePatterns(rawURL string) []string {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil
	}
	base := parsed.Scheme + "://" + parsed.Host
	return []string{
		base,
		base + "/",
		base + "/about",
		base + "/about-us",
		base + "/a-propos",
		base + "/apropos",
		base + "/qui-sommes-nous",
	}
}

func buildOnboardingBrandProfilePreview(
	brandName string,
	websiteURL string,
	jobID string,
	result ContentOptimizerCrawlResult,
) OnboardingBrandProfilePreview {
	content := onboardingCrawlText(result.Records)
	resolvedBrand := strings.TrimSpace(brandName)
	if resolvedBrand == "" {
		resolvedBrand = inferBrandNameFromURL(websiteURL)
	}
	shortDescription := firstUsefulParagraph(content)
	keyFeatures := inferKeyFeatures(content)
	industry := inferIndustry(content)

	return OnboardingBrandProfilePreview{
		Status:                strings.TrimSpace(result.Status),
		CrawlJobID:            strings.TrimSpace(jobID),
		BrandName:             resolvedBrand,
		BrandShortDescription: shortDescription,
		BrandDescription:      longDescriptionFromContent(shortDescription, content),
		Industry:              industry,
		KeyFeatures:           keyFeatures,
		Competitors:           []OnboardingBrandProfileCompetitor{},
		Prompts:               onboardingPrompts(resolvedBrand, industry),
	}
}

func onboardingCrawlText(records []ContentOptimizerCrawlRecord) string {
	parts := make([]string, 0, len(records))
	for _, record := range records {
		if strings.ToLower(strings.TrimSpace(record.Status)) != "completed" {
			continue
		}
		text := strings.TrimSpace(record.Markdown)
		if text == "" {
			text = strings.TrimSpace(record.Title)
		}
		if text != "" {
			parts = append(parts, text)
		}
	}
	return strings.Join(parts, "\n\n")
}

func firstUsefulParagraph(content string) string {
	for _, line := range strings.Split(content, "\n") {
		line = cleanMarkdownLine(line)
		if len([]rune(line)) >= 45 && len([]rune(line)) <= 260 {
			return line
		}
	}
	return ""
}

func longDescriptionFromContent(shortDescription, content string) string {
	if shortDescription == "" {
		return firstUsefulParagraph(content)
	}
	paragraphs := make([]string, 0, 2)
	for _, line := range strings.Split(content, "\n") {
		line = cleanMarkdownLine(line)
		if len([]rune(line)) < 45 || line == shortDescription {
			continue
		}
		paragraphs = append(paragraphs, line)
		if len(paragraphs) == 2 {
			break
		}
	}
	if len(paragraphs) == 0 {
		return shortDescription
	}
	return shortDescription + "\n\n" + strings.Join(paragraphs, "\n\n")
}

func inferKeyFeatures(content string) []string {
	features := make([]string, 0, 5)
	seen := map[string]struct{}{}
	for _, line := range strings.Split(content, "\n") {
		line = cleanMarkdownLine(line)
		if len([]rune(line)) < 18 || len([]rune(line)) > 110 {
			continue
		}
		lower := strings.ToLower(line)
		if !strings.Contains(lower, " ") {
			continue
		}
		if _, ok := seen[lower]; ok {
			continue
		}
		seen[lower] = struct{}{}
		features = append(features, line)
		if len(features) == 5 {
			break
		}
	}
	return features
}

func inferIndustry(content string) string {
	lower := strings.ToLower(content)
	switch {
	case strings.Contains(lower, "saas") || strings.Contains(lower, "logiciel"):
		return "SaaS / logiciel"
	case strings.Contains(lower, "e-commerce") || strings.Contains(lower, "commerce"):
		return "E-commerce"
	case strings.Contains(lower, "marketing") || strings.Contains(lower, "seo"):
		return "Marketing digital"
	case strings.Contains(lower, "finance") || strings.Contains(lower, "assurance"):
		return "Finance"
	default:
		return ""
	}
}

func onboardingPrompts(brandName, industry string) []OnboardingBrandProfilePrompt {
	brand := strings.TrimSpace(brandName)
	if brand == "" {
		brand = "cette marque"
	}
	prompts := []string{
		"Quelles sont les meilleures alternatives a " + brand + " ?",
		brand + " est-il fiable pour une entreprise ?",
		"Quels sont les points forts de " + brand + " ?",
	}
	if strings.TrimSpace(industry) != "" {
		prompts = append(prompts, "Quels sont les meilleurs acteurs en "+industry+" ?")
	}
	out := make([]OnboardingBrandProfilePrompt, 0, len(prompts))
	for _, prompt := range prompts {
		out = append(out, OnboardingBrandProfilePrompt{Text: prompt, Language: "fr"})
	}
	return out
}

func inferBrandNameFromURL(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	host := strings.TrimPrefix(strings.ToLower(parsed.Hostname()), "www.")
	part := strings.Split(host, ".")[0]
	if part == "" {
		return ""
	}
	return strings.ToUpper(part[:1]) + part[1:]
}

var markdownNoise = regexp.MustCompile(`^\s*(#+|\*|-|\d+\.)\s*`)

func cleanMarkdownLine(value string) string {
	line := strings.TrimSpace(value)
	line = markdownNoise.ReplaceAllString(line, "")
	line = strings.Trim(line, "`*_ ")
	return strings.Join(strings.Fields(line), " ")
}

func mergeOnboardingBrandProfilePreview(
	fallback OnboardingBrandProfilePreview,
	ai OnboardingBrandProfilePreview,
) OnboardingBrandProfilePreview {
	merged := fallback
	if strings.TrimSpace(ai.Status) != "" {
		merged.Status = strings.TrimSpace(ai.Status)
	}
	if strings.TrimSpace(ai.CrawlJobID) != "" {
		merged.CrawlJobID = strings.TrimSpace(ai.CrawlJobID)
	}
	if strings.TrimSpace(ai.BrandName) != "" {
		merged.BrandName = strings.TrimSpace(ai.BrandName)
	}
	if strings.TrimSpace(ai.BrandShortDescription) != "" {
		merged.BrandShortDescription = strings.TrimSpace(ai.BrandShortDescription)
	}
	if strings.TrimSpace(ai.BrandDescription) != "" {
		merged.BrandDescription = strings.TrimSpace(ai.BrandDescription)
	}
	if strings.TrimSpace(ai.Industry) != "" {
		merged.Industry = strings.TrimSpace(ai.Industry)
	}
	if len(ai.KeyFeatures) > 0 {
		merged.KeyFeatures = ai.KeyFeatures
	}
	if len(ai.Competitors) > 0 {
		merged.Competitors = ai.Competitors
	}
	if len(ai.Prompts) > 0 {
		merged.Prompts = ai.Prompts
	}
	return merged
}
