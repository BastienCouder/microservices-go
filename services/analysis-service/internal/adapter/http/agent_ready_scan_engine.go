package http

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"math"
	stdhttp "net/http"
	"net/url"
	"strings"
	"time"
)

const agentReadyResponseReadLimit = 512 * 1024

type agentReadyAnalyzer struct {
	client  *stdhttp.Client
	timeout time.Duration
}

type agentReadyHTTPResponse struct {
	statusCode int
	header     stdhttp.Header
	body       []byte
	err        error
}

type agentReadyAnalysisContext struct {
	request          agentReadyScanRequest
	baseURL          *url.URL
	robots           agentReadyHTTPResponse
	robotsText       string
	home             agentReadyHTTPResponse
	htmlHome         agentReadyHTTPResponse
	markdownHome     agentReadyHTTPResponse
	sitemap          agentReadyHTTPResponse
	sitemapURL       string
	hasFetchedRobots bool
	hasFetchedHome   bool
}

func newAgentReadyAnalyzer(client *stdhttp.Client, timeout time.Duration) *agentReadyAnalyzer {
	if client == nil {
		client = stdhttp.DefaultClient
	}
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	return &agentReadyAnalyzer{client: client, timeout: timeout}
}

func (a *agentReadyAnalyzer) analyze(input agentReadyScanRequest) agentReadyScanResult {
	input = normalizeAgentReadyScanRequest(input)
	if err := validateAgentReadyScanRequest(input); err != nil {
		return agentReadyScanResult{
			Status: "failed",
			URL:    strings.TrimSpace(input.URL),
			Mode:   input.Mode,
			Error:  err.Error(),
		}
	}

	parsed, err := url.Parse(input.URL)
	if err != nil {
		return agentReadyScanResult{
			Status: "failed",
			URL:    input.URL,
			Mode:   input.Mode,
			Error:  "url must be absolute",
		}
	}

	ctx := &agentReadyAnalysisContext{
		request: input,
		baseURL: parsed,
	}
	results := make([]agentReadyCheckResult, 0, len(input.Checks))
	for _, checkID := range input.Checks {
		switch checkID {
		case "robots_txt":
			results = append(results, a.checkRobots(ctx))
		case "sitemap":
			results = append(results, a.checkSitemap(ctx))
		case "link_headers":
			results = append(results, a.checkLinkHeaders(ctx))
		case "markdown_negotiation":
			results = append(results, a.checkMarkdownNegotiation(ctx))
		case "ai_bot_rules":
			results = append(results, a.checkAIBotRules(ctx))
		case "content_signals":
			results = append(results, a.checkContentSignals(ctx))
		}
	}

	result := scoreAgentReadyScan(input.URL, input.Mode, results)
	result.Status = "done"
	return result
}

func (a *agentReadyAnalyzer) checkRobots(ctx *agentReadyAnalysisContext) agentReadyCheckResult {
	ctx.ensureRobots(a)
	if ctx.robots.err != nil {
		return makeAgentReadyCheckResult("robots_txt", "fail", "robots.txt could not be fetched", []string{ctx.robots.err.Error()})
	}
	if ctx.robots.statusCode != stdhttp.StatusOK {
		return makeAgentReadyCheckResult("robots_txt", "fail", fmt.Sprintf("robots.txt returned HTTP %d", ctx.robots.statusCode), nil)
	}
	if strings.TrimSpace(ctx.robotsText) == "" {
		return makeAgentReadyCheckResult("robots_txt", "fail", "robots.txt is empty", nil)
	}
	if !hasRobotsUserAgent(ctx.robotsText) {
		return makeAgentReadyCheckResult("robots_txt", "warning", "robots.txt exists but no User-agent group was detected", nil)
	}
	return makeAgentReadyCheckResult("robots_txt", "pass", "robots.txt is reachable and declares crawler groups", collectRobotsEvidence(ctx.robotsText))
}

func (a *agentReadyAnalyzer) checkSitemap(ctx *agentReadyAnalysisContext) agentReadyCheckResult {
	ctx.ensureSitemap(a)
	if ctx.sitemapURL == "" {
		return makeAgentReadyCheckResult("sitemap", "fail", "No sitemap reference was found in robots.txt and /sitemap.xml was unavailable", nil)
	}
	if ctx.sitemap.err != nil {
		return makeAgentReadyCheckResult("sitemap", "fail", "sitemap could not be fetched", []string{ctx.sitemap.err.Error()})
	}
	if ctx.sitemap.statusCode != stdhttp.StatusOK {
		return makeAgentReadyCheckResult("sitemap", "fail", fmt.Sprintf("sitemap returned HTTP %d", ctx.sitemap.statusCode), []string{ctx.sitemapURL})
	}
	if !isValidSitemapXML(ctx.sitemap.body) {
		return makeAgentReadyCheckResult("sitemap", "warning", "sitemap was found but does not look like a valid urlset or sitemapindex XML document", []string{ctx.sitemapURL})
	}
	return makeAgentReadyCheckResult("sitemap", "pass", "A valid sitemap was found", []string{ctx.sitemapURL})
}

func (a *agentReadyAnalyzer) checkLinkHeaders(ctx *agentReadyAnalysisContext) agentReadyCheckResult {
	ctx.ensureHome(a)
	if ctx.home.err != nil {
		return makeAgentReadyCheckResult("link_headers", "fail", "home page headers could not be fetched", []string{ctx.home.err.Error()})
	}
	linkValues := ctx.home.header.Values("Link")
	if len(linkValues) == 0 {
		return makeAgentReadyCheckResult("link_headers", "warning", "No HTTP Link header was found on the home page", nil)
	}
	if !hasUsefulLinkHeader(linkValues) {
		return makeAgentReadyCheckResult("link_headers", "warning", "Link headers exist but no docs, API, feed, sitemap, or .well-known target was detected", linkValues)
	}
	return makeAgentReadyCheckResult("link_headers", "pass", "Useful Link headers are available for discovery", linkValues)
}

func (a *agentReadyAnalyzer) checkMarkdownNegotiation(ctx *agentReadyAnalysisContext) agentReadyCheckResult {
	ctx.ensureMarkdown(a)
	if ctx.markdownHome.err != nil {
		return makeAgentReadyCheckResult("markdown_negotiation", "fail", "markdown representation could not be fetched", []string{ctx.markdownHome.err.Error()})
	}
	if ctx.markdownHome.statusCode < 200 || ctx.markdownHome.statusCode >= 300 {
		return makeAgentReadyCheckResult("markdown_negotiation", "fail", fmt.Sprintf("markdown request returned HTTP %d", ctx.markdownHome.statusCode), nil)
	}

	contentType := strings.ToLower(ctx.markdownHome.header.Get("Content-Type"))
	body := bytes.TrimSpace(ctx.markdownHome.body)
	if len(body) == 0 {
		return makeAgentReadyCheckResult("markdown_negotiation", "fail", "markdown request returned an empty response", nil)
	}
	if strings.Contains(contentType, "text/markdown") || looksLikeMarkdown(body) {
		return makeAgentReadyCheckResult("markdown_negotiation", "pass", "The home page returns usable Markdown for Accept: text/markdown", []string{contentType})
	}
	return makeAgentReadyCheckResult("markdown_negotiation", "fail", "The home page does not return a usable Markdown representation", []string{contentType})
}

func (a *agentReadyAnalyzer) checkAIBotRules(ctx *agentReadyAnalysisContext) agentReadyCheckResult {
	ctx.ensureRobots(a)
	if ctx.robots.err != nil || ctx.robots.statusCode != stdhttp.StatusOK {
		return makeAgentReadyCheckResult("ai_bot_rules", "fail", "AI bot rules could not be checked because robots.txt is unavailable", nil)
	}
	matches := detectAIBotRules(ctx.robotsText)
	if len(matches) == 0 {
		return makeAgentReadyCheckResult("ai_bot_rules", "warning", "robots.txt does not include explicit rules for known AI crawlers", nil)
	}
	return makeAgentReadyCheckResult("ai_bot_rules", "pass", "Explicit AI crawler rules were detected", matches)
}

func (a *agentReadyAnalyzer) checkContentSignals(ctx *agentReadyAnalysisContext) agentReadyCheckResult {
	ctx.ensureHome(a)
	if ctx.home.err != nil {
		return makeAgentReadyCheckResult("content_signals", "fail", "content signal headers could not be checked", []string{ctx.home.err.Error()})
	}
	evidence := detectContentSignals(ctx.home.header)
	if len(evidence) == 0 {
		return makeAgentReadyCheckResult("content_signals", "warning", "No Content-Signal header or equivalent policy link was detected", nil)
	}
	return makeAgentReadyCheckResult("content_signals", "pass", "Content usage signals were detected", evidence)
}

func (ctx *agentReadyAnalysisContext) ensureRobots(a *agentReadyAnalyzer) {
	if ctx.hasFetchedRobots {
		return
	}
	ctx.hasFetchedRobots = true
	robotsURL := ctx.baseURL.ResolveReference(&url.URL{Path: "/robots.txt"}).String()
	ctx.robots = a.fetch(ctx.request.URL, stdhttp.MethodGet, robotsURL, nil)
	ctx.robotsText = string(ctx.robots.body)
}

func (ctx *agentReadyAnalysisContext) ensureHome(a *agentReadyAnalyzer) {
	if ctx.hasFetchedHome {
		return
	}
	ctx.hasFetchedHome = true
	ctx.home = a.fetch(ctx.request.URL, stdhttp.MethodHead, ctx.request.URL, nil)
	if ctx.home.err != nil || ctx.home.statusCode == stdhttp.StatusMethodNotAllowed || ctx.home.statusCode == stdhttp.StatusNotImplemented {
		ctx.home = a.fetch(ctx.request.URL, stdhttp.MethodGet, ctx.request.URL, nil)
	}
}

func (ctx *agentReadyAnalysisContext) ensureMarkdown(a *agentReadyAnalyzer) {
	if ctx.markdownHome.header != nil || ctx.markdownHome.err != nil {
		return
	}
	ctx.htmlHome = a.fetch(ctx.request.URL, stdhttp.MethodGet, ctx.request.URL, stdhttp.Header{"Accept": []string{"text/html"}})
	ctx.markdownHome = a.fetch(ctx.request.URL, stdhttp.MethodGet, ctx.request.URL, stdhttp.Header{"Accept": []string{"text/markdown"}})
}

func (ctx *agentReadyAnalysisContext) ensureSitemap(a *agentReadyAnalyzer) {
	if ctx.sitemap.header != nil || ctx.sitemap.err != nil || ctx.sitemapURL != "" {
		return
	}
	ctx.ensureRobots(a)
	ctx.sitemapURL = firstSitemapURL(ctx.robotsText)
	if ctx.sitemapURL == "" {
		ctx.sitemapURL = ctx.baseURL.ResolveReference(&url.URL{Path: "/sitemap.xml"}).String()
	}
	ctx.sitemap = a.fetch(ctx.request.URL, stdhttp.MethodGet, ctx.sitemapURL, nil)
	if ctx.sitemap.statusCode != stdhttp.StatusOK && firstSitemapURL(ctx.robotsText) == "" {
		ctx.sitemapURL = ""
	}
}

func (a *agentReadyAnalyzer) fetch(referer string, method string, target string, header stdhttp.Header) agentReadyHTTPResponse {
	requestCtx, cancel := context.WithTimeout(context.Background(), a.timeout)
	defer cancel()
	req, err := stdhttp.NewRequestWithContext(requestCtx, method, target, nil)
	if err != nil {
		return agentReadyHTTPResponse{err: err}
	}
	req.Header.Set("User-Agent", "Riligar-Agent-Ready-Audit/1.0")
	if referer != "" {
		req.Header.Set("Referer", referer)
	}
	for key, values := range header {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}
	resp, err := a.client.Do(req)
	if err != nil {
		return agentReadyHTTPResponse{err: err}
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	body, err := io.ReadAll(io.LimitReader(resp.Body, agentReadyResponseReadLimit))
	if err != nil {
		return agentReadyHTTPResponse{statusCode: resp.StatusCode, header: resp.Header.Clone(), err: err}
	}
	return agentReadyHTTPResponse{statusCode: resp.StatusCode, header: resp.Header.Clone(), body: body}
}

func makeAgentReadyCheckResult(checkID string, status string, issue string, evidence []string) agentReadyCheckResult {
	definition, _ := agentReadyCheckDefinitionByID(checkID)
	category, _ := agentReadyCategoryByID(definition.CategoryID)
	return agentReadyCheckResult{
		ID:             definition.ID,
		Label:          definition.Label,
		CategoryID:     definition.CategoryID,
		CategoryLabel:  category.Label,
		Status:         status,
		MaxScore:       definition.Weight,
		Goal:           definition.Goal,
		Issue:          issue,
		HowToImplement: definition.HowToImplement,
		Resources:      definition.Resources,
		Prompt:         definition.Prompt,
		Evidence:       evidence,
		Optional:       definition.Optional,
	}
}

func scoreAgentReadyScan(scanURL string, mode string, checks []agentReadyCheckResult) agentReadyScanResult {
	categoryByID := make(map[string]agentReadyCategoryScore, len(agentReadyCategoryDefinitions))
	for _, category := range agentReadyCategoryDefinitions {
		categoryByID[category.ID] = agentReadyCategoryScore{ID: category.ID, Label: category.Label}
	}

	totalScore := 0.0
	totalMax := 0
	summary := agentReadyScanSummary{}
	scoredChecks := make([]agentReadyCheckResult, 0, len(checks))

	for _, check := range checks {
		score := 0.0
		switch check.Status {
		case "pass":
			summary.Passed++
			score = float64(check.MaxScore)
		case "warning":
			summary.Warning++
			score = float64(check.MaxScore) * 0.5
		case "skipped":
			summary.Skipped++
			if check.Optional {
				check.ExcludedFromBase = true
			}
		case "not_applicable":
			summary.Skipped++
			check.ExcludedFromBase = true
		default:
			summary.Failed++
		}

		if !check.ExcludedFromBase {
			totalScore += score
			totalMax += check.MaxScore
			category := categoryByID[check.CategoryID]
			category.Score += int(math.Round(score))
			category.MaxScore += check.MaxScore
			categoryByID[check.CategoryID] = category
		}
		check.Score = int(math.Round(score))
		scoredChecks = append(scoredChecks, check)
	}

	score := 0
	if totalMax > 0 {
		score = int(math.Round(totalScore / float64(totalMax) * 100))
	}

	categories := make([]agentReadyCategoryScore, 0, len(agentReadyCategoryDefinitions))
	for _, category := range agentReadyCategoryDefinitions {
		scoreCategory := categoryByID[category.ID]
		if scoreCategory.MaxScore == 0 {
			scoreCategory.MaxScore = category.MaxScore
		}
		categories = append(categories, scoreCategory)
	}

	return agentReadyScanResult{
		Status:     "done",
		URL:        scanURL,
		Mode:       mode,
		Score:      score,
		Level:      agentReadyLevel(score),
		Summary:    summary,
		Categories: categories,
		Checks:     scoredChecks,
	}
}

func agentReadyLevel(score int) string {
	if score >= 80 {
		return "Ready"
	}
	if score >= 50 {
		return "Partially Ready"
	}
	return "Not Ready"
}

func hasRobotsUserAgent(body string) bool {
	for _, line := range strings.Split(body, "\n") {
		if strings.HasPrefix(strings.ToLower(strings.TrimSpace(line)), "user-agent:") {
			return true
		}
	}
	return false
}

func collectRobotsEvidence(body string) []string {
	evidence := []string{}
	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		lower := strings.ToLower(trimmed)
		if strings.HasPrefix(lower, "user-agent:") || strings.HasPrefix(lower, "sitemap:") {
			evidence = append(evidence, trimmed)
		}
		if len(evidence) >= 4 {
			break
		}
	}
	return evidence
}

func firstSitemapURL(body string) string {
	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(strings.ToLower(trimmed), "sitemap:") {
			return strings.TrimSpace(strings.TrimPrefix(trimmed, strings.SplitN(trimmed, ":", 2)[0]+":"))
		}
	}
	return ""
}

func isValidSitemapXML(body []byte) bool {
	decoder := xml.NewDecoder(bytes.NewReader(body))
	for {
		token, err := decoder.Token()
		if err != nil {
			return false
		}
		if start, ok := token.(xml.StartElement); ok {
			name := strings.ToLower(start.Name.Local)
			return name == "urlset" || name == "sitemapindex"
		}
	}
}

func hasUsefulLinkHeader(values []string) bool {
	usefulTokens := []string{".well-known", "api", "docs", "documentation", "sitemap", "feed", "alternate"}
	for _, value := range values {
		lower := strings.ToLower(value)
		for _, token := range usefulTokens {
			if strings.Contains(lower, token) {
				return true
			}
		}
	}
	return false
}

func looksLikeMarkdown(body []byte) bool {
	text := strings.TrimSpace(string(body))
	if text == "" || strings.Contains(strings.ToLower(text), "<html") {
		return false
	}
	if strings.HasPrefix(text, "#") || strings.Contains(text, "\n#") {
		return true
	}
	return strings.Contains(text, "](") || strings.Contains(text, "- ")
}

func detectAIBotRules(body string) []string {
	knownBots := []string{"gptbot", "chatgpt-user", "claudebot", "google-extended", "perplexitybot", "ccbot", "anthropic-ai"}
	matches := []string{}
	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		lower := strings.ToLower(trimmed)
		if !strings.HasPrefix(lower, "user-agent:") {
			continue
		}
		for _, bot := range knownBots {
			if strings.Contains(lower, bot) {
				matches = append(matches, trimmed)
				break
			}
		}
	}
	return matches
}

func detectContentSignals(header stdhttp.Header) []string {
	evidence := []string{}
	for key, values := range header {
		lowerKey := strings.ToLower(key)
		if strings.Contains(lowerKey, "content-signal") || strings.Contains(lowerKey, "content_signal") {
			for _, value := range values {
				evidence = append(evidence, key+": "+value)
			}
		}
	}
	for _, value := range header.Values("Link") {
		lower := strings.ToLower(value)
		if strings.Contains(lower, "content-signal") || strings.Contains(lower, "content signal") || strings.Contains(lower, "tdmrep") {
			evidence = append(evidence, value)
		}
	}
	return evidence
}
