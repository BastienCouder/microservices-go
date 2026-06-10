package http

import (
	"errors"
	"net/url"
	"strings"
)

type agentReadyScanRequest struct {
	URL    string   `json:"url"`
	Mode   string   `json:"mode"`
	Checks []string `json:"checks"`
}

type agentReadyQueuedResponse struct {
	ScanID string `json:"scan_id"`
	Status string `json:"status"`
	URL    string `json:"url"`
}

type agentReadyScanResult struct {
	ScanID     string                    `json:"scan_id"`
	Status     string                    `json:"status"`
	URL        string                    `json:"url"`
	Mode       string                    `json:"mode"`
	Score      int                       `json:"score"`
	Level      string                    `json:"level"`
	Summary    agentReadyScanSummary     `json:"summary"`
	Categories []agentReadyCategoryScore `json:"categories"`
	Checks     []agentReadyCheckResult   `json:"checks"`
	Error      string                    `json:"error,omitempty"`
}

type agentReadyScanSummary struct {
	Passed  int `json:"passed"`
	Failed  int `json:"failed"`
	Warning int `json:"warning"`
	Skipped int `json:"skipped"`
}

type agentReadyCategoryScore struct {
	ID       string `json:"id"`
	Label    string `json:"label"`
	Score    int    `json:"score"`
	MaxScore int    `json:"max_score"`
}

type agentReadyCheckResult struct {
	ID               string                    `json:"id"`
	Label            string                    `json:"label"`
	CategoryID       string                    `json:"category_id"`
	CategoryLabel    string                    `json:"category_label"`
	Status           string                    `json:"status"`
	Score            int                       `json:"score"`
	MaxScore         int                       `json:"max_score"`
	Goal             string                    `json:"goal"`
	Issue            string                    `json:"issue"`
	HowToImplement   string                    `json:"how_to_implement"`
	Resources        []agentReadyCheckResource `json:"resources"`
	Prompt           string                    `json:"prompt"`
	Evidence         []string                  `json:"evidence,omitempty"`
	Optional         bool                      `json:"optional,omitempty"`
	ExcludedFromBase bool                      `json:"excluded_from_base,omitempty"`
}

type agentReadyCheckResource struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type agentReadyCategoryDefinition struct {
	ID       string
	Label    string
	MaxScore int
}

type agentReadyCheckDefinition struct {
	ID             string
	Label          string
	CategoryID     string
	Weight         int
	Goal           string
	HowToImplement string
	Resources      []agentReadyCheckResource
	Prompt         string
	Optional       bool
}

var agentReadyCategoryDefinitions = []agentReadyCategoryDefinition{
	{ID: "discoverability", Label: "Discoverability", MaxScore: 35},
	{ID: "content", Label: "Content", MaxScore: 35},
	{ID: "bot_access", Label: "Bot Access Control", MaxScore: 30},
}

var agentReadyCheckDefinitions = []agentReadyCheckDefinition{
	{
		ID:         "robots_txt",
		Label:      "robots.txt",
		CategoryID: "discoverability",
		Weight:     10,
		Goal:       "Expose crawl rules in a reachable robots.txt file.",
		HowToImplement: "Publish /robots.txt with clear User-agent groups, Allow/Disallow directives, " +
			"and sitemap references for important public content.",
		Resources: []agentReadyCheckResource{
			{Label: "Google robots.txt", URL: "https://developers.google.com/search/docs/crawling-indexing/robots/intro"},
		},
		Prompt: "Create a standards-compliant robots.txt that allows public content crawling and declares the sitemap.",
	},
	{
		ID:             "sitemap",
		Label:          "Sitemap",
		CategoryID:     "discoverability",
		Weight:         10,
		Goal:           "Publish a valid sitemap and reference it from robots.txt.",
		HowToImplement: "Generate a sitemap.xml or sitemap index, keep it updated, and add a Sitemap directive in robots.txt.",
		Resources: []agentReadyCheckResource{
			{Label: "sitemaps.org", URL: "https://www.sitemaps.org/"},
		},
		Prompt: "Add a valid sitemap.xml or sitemap index and reference it from robots.txt.",
	},
	{
		ID:             "link_headers",
		Label:          "Link headers",
		CategoryID:     "discoverability",
		Weight:         15,
		Goal:           "Expose machine-discoverable links to docs, feeds, manifests, APIs, or well-known resources.",
		HowToImplement: "Add HTTP Link headers on the home page for useful agent entry points such as documentation, feeds, APIs, or .well-known resources.",
		Resources: []agentReadyCheckResource{
			{Label: "RFC 8288 Web Linking", URL: "https://www.rfc-editor.org/rfc/rfc8288"},
		},
		Prompt: "Add useful HTTP Link headers on the home page for agent discovery of docs, feeds, APIs, or .well-known resources.",
	},
	{
		ID:             "markdown_negotiation",
		Label:          "Markdown negotiation",
		CategoryID:     "content",
		Weight:         35,
		Goal:           "Serve an agent-readable content representation when clients request text/markdown.",
		HowToImplement: "Support Accept: text/markdown on public content pages and return clean Markdown with headings, links, and core body text.",
		Resources: []agentReadyCheckResource{
			{Label: "MDN content negotiation", URL: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Content_negotiation"},
		},
		Prompt: "Implement Accept: text/markdown negotiation for public pages and return clean, useful Markdown content.",
	},
	{
		ID:             "ai_bot_rules",
		Label:          "AI bot rules",
		CategoryID:     "bot_access",
		Weight:         10,
		Goal:           "Make AI crawler policy explicit instead of leaving agent access ambiguous.",
		HowToImplement: "Add explicit robots.txt groups for the AI crawlers you want to allow or block, and keep the policy consistent with your content strategy.",
		Resources: []agentReadyCheckResource{
			{Label: "OpenAI robots.txt guidance", URL: "https://platform.openai.com/docs/bots"},
		},
		Prompt: "Add explicit robots.txt policy groups for known AI crawlers such as GPTBot, ChatGPT-User, ClaudeBot, Google-Extended, and PerplexityBot.",
	},
	{
		ID:             "content_signals",
		Label:          "Content Signals",
		CategoryID:     "bot_access",
		Weight:         20,
		Goal:           "Expose machine-readable content usage preferences where agents can discover them.",
		HowToImplement: "Return a Content-Signal header or link to an equivalent policy document from important public pages.",
		Resources: []agentReadyCheckResource{
			{Label: "IETF HTTP fields", URL: "https://www.rfc-editor.org/rfc/rfc9110"},
		},
		Prompt: "Add a Content-Signal header or equivalent machine-readable content usage policy on public pages.",
	},
}

func defaultAgentReadyCheckIDs() []string {
	ids := make([]string, 0, len(agentReadyCheckDefinitions))
	for _, definition := range agentReadyCheckDefinitions {
		ids = append(ids, definition.ID)
	}
	return ids
}

func agentReadyCheckDefinitionByID(id string) (agentReadyCheckDefinition, bool) {
	for _, definition := range agentReadyCheckDefinitions {
		if definition.ID == id {
			return definition, true
		}
	}
	return agentReadyCheckDefinition{}, false
}

func agentReadyCategoryByID(id string) (agentReadyCategoryDefinition, bool) {
	for _, category := range agentReadyCategoryDefinitions {
		if category.ID == id {
			return category, true
		}
	}
	return agentReadyCategoryDefinition{}, false
}

func validateAgentReadyScanRequest(input agentReadyScanRequest) error {
	rawURL := strings.TrimSpace(input.URL)
	if rawURL == "" {
		return errors.New("url is required")
	}
	parsed, err := url.ParseRequestURI(rawURL)
	if err != nil || parsed.Host == "" {
		return errors.New("url must be absolute")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return errors.New("url must use http or https")
	}
	if input.Mode != "" && input.Mode != "content-site" {
		return errors.New("only content-site mode is supported")
	}
	seen := map[string]struct{}{}
	for _, checkID := range input.Checks {
		trimmed := strings.TrimSpace(checkID)
		if trimmed == "" {
			return errors.New("checks must not contain empty ids")
		}
		if _, ok := seen[trimmed]; ok {
			return errors.New("checks must not contain duplicates")
		}
		seen[trimmed] = struct{}{}
		if _, ok := agentReadyCheckDefinitionByID(trimmed); !ok {
			return errors.New("unsupported check id")
		}
	}
	return nil
}

func normalizeAgentReadyScanRequest(input agentReadyScanRequest) agentReadyScanRequest {
	input.URL = strings.TrimSpace(input.URL)
	if input.Mode == "" {
		input.Mode = "content-site"
	}
	if len(input.Checks) == 0 {
		input.Checks = defaultAgentReadyCheckIDs()
	}
	for index, checkID := range input.Checks {
		input.Checks[index] = strings.TrimSpace(checkID)
	}
	return input
}
