package usecase

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"
)

const (
	defaultContentCrawlLimit = 25
	defaultContentCrawlDepth = 2
	maxContentCrawlLimit     = 1000
	maxContentCrawlDepth     = 25
)

type ContentOptimizerCrawlOptions struct {
	IncludeExternalLinks bool     `json:"includeExternalLinks"`
	IncludeSubdomains    bool     `json:"includeSubdomains"`
	IncludePatterns      []string `json:"includePatterns,omitempty"`
	ExcludePatterns      []string `json:"excludePatterns,omitempty"`
}

type ContentOptimizerCrawlStartInput struct {
	URL           string                       `json:"url"`
	Limit         int                          `json:"limit"`
	Depth         int                          `json:"depth"`
	Source        string                       `json:"source"`
	Formats       []string                     `json:"formats"`
	Render        bool                         `json:"render"`
	Options       ContentOptimizerCrawlOptions `json:"options"`
	CrawlPurposes []string                     `json:"crawlPurposes"`
}

type ContentOptimizerCrawlResultInput struct {
	Cursor string `json:"cursor,omitempty"`
	Limit  int    `json:"limit,omitempty"`
	Status string `json:"status,omitempty"`
}

type ContentOptimizerCrawlJob struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

type ContentOptimizerIssue struct {
	ID             string `json:"id"`
	Category       string `json:"category"`
	Severity       string `json:"severity"`
	Title          string `json:"title"`
	Description    string `json:"description"`
	Recommendation string `json:"recommendation"`
	FixType        string `json:"fixType"`
}

type ContentOptimizerCrawlRecord struct {
	URL        string                  `json:"url"`
	Status     string                  `json:"status"`
	HTTPStatus int                     `json:"httpStatus,omitempty"`
	Title      string                  `json:"title,omitempty"`
	Markdown   string                  `json:"markdown,omitempty"`
	HTML       string                  `json:"html,omitempty"`
	JSON       any                     `json:"json,omitempty"`
	Issues     []ContentOptimizerIssue `json:"issues,omitempty"`
}

type ContentOptimizerCrawlResult struct {
	ID                 string                        `json:"id"`
	Status             string                        `json:"status"`
	BrowserSecondsUsed float64                       `json:"browserSecondsUsed,omitempty"`
	Total              int                           `json:"total"`
	Finished           int                           `json:"finished"`
	Records            []ContentOptimizerCrawlRecord `json:"records"`
	Cursor             string                        `json:"cursor,omitempty"`
}

type ContentOptimizerCrawlSnapshot struct {
	ProjectID      string                      `json:"projectId"`
	OrganizationID int64                       `json:"organizationId"`
	JobID          string                      `json:"jobId"`
	Result         ContentOptimizerCrawlResult `json:"result"`
	CreatedAt      time.Time                   `json:"createdAt"`
	UpdatedAt      time.Time                   `json:"updatedAt"`
}

func (s *Service) StartContentOptimizerCrawl(
	ctx context.Context,
	projectID string,
	organizationID int64,
	input ContentOptimizerCrawlStartInput,
) (ContentOptimizerCrawlJob, error) {
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return ContentOptimizerCrawlJob{}, err
	}
	normalized, err := normalizeContentOptimizerCrawlStartInput(input)
	if err != nil {
		return ContentOptimizerCrawlJob{}, err
	}
	if s.contentCrawler == nil {
		return ContentOptimizerCrawlJob{}, fmt.Errorf("%w: content crawler is not configured", ErrDependencyUnavailable)
	}

	return s.contentCrawler.StartCrawl(ctx, normalized)
}

func (s *Service) GetContentOptimizerCrawl(
	ctx context.Context,
	projectID string,
	organizationID int64,
	jobID string,
	input ContentOptimizerCrawlResultInput,
) (ContentOptimizerCrawlResult, error) {
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return ContentOptimizerCrawlResult{}, err
	}
	jobID = strings.TrimSpace(jobID)
	if jobID == "" {
		return ContentOptimizerCrawlResult{}, fmt.Errorf("%w: crawl job id is required", ErrValidation)
	}
	if s.contentCrawler == nil {
		return ContentOptimizerCrawlResult{}, fmt.Errorf("%w: content crawler is not configured", ErrDependencyUnavailable)
	}

	normalized := ContentOptimizerCrawlResultInput{
		Cursor: strings.TrimSpace(input.Cursor),
		Limit:  input.Limit,
		Status: strings.ToLower(strings.TrimSpace(input.Status)),
	}
	if normalized.Limit < 0 {
		return ContentOptimizerCrawlResult{}, fmt.Errorf("%w: limit must be positive", ErrValidation)
	}
	if normalized.Status != "" && !isAllowedCrawlRecordStatus(normalized.Status) {
		return ContentOptimizerCrawlResult{}, fmt.Errorf("%w: invalid crawl result status", ErrValidation)
	}

	result, err := s.contentCrawler.GetCrawl(ctx, jobID, normalized)
	if err != nil {
		return ContentOptimizerCrawlResult{}, err
	}
	result = analyzeContentOptimizerCrawlResult(result)
	if isTerminalCrawlJobStatus(result.Status) && shouldSaveContentOptimizerCrawlResult(normalized, result) {
		if err := s.saveLatestContentOptimizerCrawl(ctx, projectID, organizationID, jobID, result); err != nil {
			return ContentOptimizerCrawlResult{}, err
		}
	}
	return result, nil
}

func (s *Service) GetLatestContentOptimizerCrawl(
	ctx context.Context,
	projectID string,
	organizationID int64,
) (ContentOptimizerCrawlSnapshot, error) {
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return ContentOptimizerCrawlSnapshot{}, err
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	snapshot, ok := s.contentCrawls[contentOptimizerCrawlKey(projectID, organizationID)]
	if !ok || snapshot == nil {
		return ContentOptimizerCrawlSnapshot{}, fmt.Errorf("%w: content optimizer crawl not found", ErrNotFound)
	}
	out := copyContentOptimizerCrawlSnapshot(snapshot)
	out.Result = analyzeContentOptimizerCrawlResult(out.Result)
	return out, nil
}

func (s *Service) saveLatestContentOptimizerCrawl(
	ctx context.Context,
	projectID string,
	organizationID int64,
	jobID string,
	result ContentOptimizerCrawlResult,
) error {
	now := s.now().UTC()
	key := contentOptimizerCrawlKey(projectID, organizationID)

	s.mu.Lock()
	defer s.mu.Unlock()

	backup := s.snapshotLocked()
	createdAt := now
	if current, ok := s.contentCrawls[key]; ok && current != nil && !current.CreatedAt.IsZero() {
		createdAt = current.CreatedAt
	}
	s.contentCrawls[key] = &ContentOptimizerCrawlSnapshot{
		ProjectID:      strings.TrimSpace(projectID),
		OrganizationID: organizationID,
		JobID:          strings.TrimSpace(jobID),
		Result:         copyContentOptimizerCrawlResult(result),
		CreatedAt:      createdAt,
		UpdatedAt:      now,
	}
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return err
	}
	return nil
}

func normalizeContentOptimizerCrawlStartInput(input ContentOptimizerCrawlStartInput) (ContentOptimizerCrawlStartInput, error) {
	normalized := input
	normalized.URL = strings.TrimSpace(input.URL)
	if normalized.URL == "" {
		return ContentOptimizerCrawlStartInput{}, fmt.Errorf("%w: url is required", ErrValidation)
	}
	parsed, err := url.Parse(normalized.URL)
	if err != nil || parsed.Host == "" {
		return ContentOptimizerCrawlStartInput{}, fmt.Errorf("%w: url must be absolute", ErrValidation)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return ContentOptimizerCrawlStartInput{}, fmt.Errorf("%w: url must use http or https", ErrValidation)
	}

	if normalized.Limit <= 0 {
		normalized.Limit = defaultContentCrawlLimit
	}
	if normalized.Limit > maxContentCrawlLimit {
		return ContentOptimizerCrawlStartInput{}, fmt.Errorf("%w: limit cannot exceed %d", ErrValidation, maxContentCrawlLimit)
	}
	if normalized.Depth <= 0 {
		normalized.Depth = defaultContentCrawlDepth
	}
	if normalized.Depth > maxContentCrawlDepth {
		return ContentOptimizerCrawlStartInput{}, fmt.Errorf("%w: depth cannot exceed %d", ErrValidation, maxContentCrawlDepth)
	}

	normalized.Source = strings.ToLower(strings.TrimSpace(normalized.Source))
	if normalized.Source == "" {
		normalized.Source = "all"
	}
	if normalized.Source != "all" && normalized.Source != "sitemaps" && normalized.Source != "links" {
		return ContentOptimizerCrawlStartInput{}, fmt.Errorf("%w: source must be all, sitemaps or links", ErrValidation)
	}

	normalized.Formats = normalizeStringList(normalized.Formats)
	if len(normalized.Formats) == 0 {
		normalized.Formats = []string{"markdown"}
	}
	for _, format := range normalized.Formats {
		if format != "html" && format != "markdown" && format != "json" {
			return ContentOptimizerCrawlStartInput{}, fmt.Errorf("%w: invalid crawl format", ErrValidation)
		}
	}

	normalized.CrawlPurposes = normalizeStringList(normalized.CrawlPurposes)
	if len(normalized.CrawlPurposes) == 0 {
		normalized.CrawlPurposes = []string{"search", "ai-input"}
	}
	for _, purpose := range normalized.CrawlPurposes {
		if purpose != "search" && purpose != "ai-input" && purpose != "ai-train" {
			return ContentOptimizerCrawlStartInput{}, fmt.Errorf("%w: invalid crawl purpose", ErrValidation)
		}
	}

	normalized.Options.IncludePatterns = normalizeTrimmedStringList(normalized.Options.IncludePatterns)
	normalized.Options.ExcludePatterns = normalizeTrimmedStringList(normalized.Options.ExcludePatterns)
	return normalized, nil
}

func normalizeStringList(values []string) []string {
	normalized := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.ToLower(strings.TrimSpace(value))
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	return normalized
}

func normalizeTrimmedStringList(values []string) []string {
	normalized := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	return normalized
}

func isAllowedCrawlRecordStatus(status string) bool {
	switch status {
	case "queued", "completed", "disallowed", "skipped", "errored", "cancelled":
		return true
	default:
		return false
	}
}

func isTerminalCrawlJobStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "completed", "cancelled_due_to_timeout", "cancelled_due_to_limits", "cancelled_by_user", "errored":
		return true
	default:
		return false
	}
}

func shouldSaveContentOptimizerCrawlResult(input ContentOptimizerCrawlResultInput, result ContentOptimizerCrawlResult) bool {
	if input.Limit <= 0 {
		return true
	}
	if result.Total <= 0 {
		return len(result.Records) > 0
	}
	return len(result.Records) >= result.Total
}

func contentOptimizerCrawlKey(projectID string, organizationID int64) string {
	return fmt.Sprintf("%d|%s", organizationID, strings.TrimSpace(projectID))
}

func analyzeContentOptimizerCrawlResult(result ContentOptimizerCrawlResult) ContentOptimizerCrawlResult {
	result.Records = append([]ContentOptimizerCrawlRecord(nil), result.Records...)
	for index := range result.Records {
		result.Records[index].Issues = analyzeContentOptimizerRecord(result.Records[index])
	}
	return result
}

func analyzeContentOptimizerRecord(record ContentOptimizerCrawlRecord) []ContentOptimizerIssue {
	issues := make([]ContentOptimizerIssue, 0, 5)
	topic := contentOptimizerPageTopic(record)
	host := contentOptimizerPageHost(record.URL)
	if record.Status != "completed" || record.HTTPStatus >= 400 {
		return append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "http_error"),
			Category:       "technical",
			Severity:       "high",
			Title:          "Page inaccessible pendant le crawl",
			Description:    "La page ne peut pas etre analysee correctement tant qu'elle retourne une erreur ou un statut non complete.",
			Recommendation: fmt.Sprintf("Verifier %s: retourner un statut 200, supprimer les redirections inutiles, puis autoriser le User-Agent CloudflareBrowserRenderingCrawler/1.0.", record.URL),
			FixType:        "fix_http_status",
		})
	}

	content := strings.TrimSpace(record.Markdown)
	if content == "" {
		content = strings.TrimSpace(record.HTML)
	}
	lowerContent := strings.ToLower(content)
	wordCount := len(strings.Fields(content))

	if strings.TrimSpace(record.Title) == "" {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "missing_title"),
			Category:       "seo",
			Severity:       "high",
			Title:          "Titre de page manquant",
			Description:    "Le crawl ne remonte pas de titre exploitable pour cette page.",
			Recommendation: fmt.Sprintf("Definir le title SEO: \"%s: guide, avantages et FAQ | %s\".", topic, host),
			FixType:        "add_title",
		})
	}

	if wordCount < 80 {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "thin_content"),
			Category:       "seo",
			Severity:       "medium",
			Title:          "Contenu trop court",
			Description:    "La page donne peu de contexte aux moteurs de recherche et aux reponses IA.",
			Recommendation: fmt.Sprintf("Ajouter un bloc H2 \"Pourquoi choisir %s\" avec 3 sous-parties: benefices cles, cas d'usage, preuves chiffrables, puis 2 liens internes vers une FAQ et un guide.", topic),
			FixType:        "expand_content",
		})
	}

	if !containsAny(lowerContent, "faq", "questions frequentes", "questions fréquentes", "q&a") {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "missing_faq"),
			Category:       "geo",
			Severity:       "medium",
			Title:          "FAQ absente",
			Description:    "Les moteurs generatifs reprennent mieux les pages qui repondent directement aux questions utilisateurs.",
			Recommendation: fmt.Sprintf("Ajouter une FAQ \"%s\" avec ces questions: \"Comment choisir %s ?\", \"Pour qui est-ce adapte ?\", \"Quels criteres comparer ?\", \"Quelle page consulter ensuite ?\".", topic, strings.ToLower(topic)),
			FixType:        "add_faq",
		})
	}

	if !containsAny(lowerContent, "guide", "blog", "article", "comparatif", "comment choisir") {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "missing_blog_support"),
			Category:       "geo",
			Severity:       "low",
			Title:          "Manque de contenu editorial support",
			Description:    "La page pourrait etre renforcee par un contenu blog/guide qui couvre les intentions informationnelles.",
			Recommendation: fmt.Sprintf("Creer un article blog \"Comment choisir %s: criteres, comparatif et cas d'usage\", puis ajouter un lien depuis cet article vers %s.", strings.ToLower(topic), record.URL),
			FixType:        "create_blog",
		})
	}

	if !containsAny(content, "\n## ", "\n### ") {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "weak_structure"),
			Category:       "seo",
			Severity:       "low",
			Title:          "Structure de contenu faible",
			Description:    "La page manque de sous-sections lisibles pour le crawl et la synthese IA.",
			Recommendation: fmt.Sprintf("Ajouter ces H2 exacts sur la page: \"Pour qui est %s\", \"Benefices\", \"Preuves\", \"Questions frequentes\".", strings.ToLower(topic)),
			FixType:        "improve_headings",
		})
	}

	return issues
}

func contentOptimizerPageTopic(record ContentOptimizerCrawlRecord) string {
	if title := strings.TrimSpace(record.Title); title != "" {
		return title
	}
	parsed, err := url.Parse(strings.TrimSpace(record.URL))
	if err == nil {
		path := strings.Trim(parsed.Path, "/")
		if path != "" {
			parts := strings.Split(path, "/")
			last := strings.TrimSpace(parts[len(parts)-1])
			last = strings.ReplaceAll(last, "-", " ")
			last = strings.ReplaceAll(last, "_", " ")
			if last != "" {
				return last
			}
		}
		if parsed.Host != "" {
			return parsed.Host
		}
	}
	return "cette page"
}

func contentOptimizerPageHost(pageURL string) string {
	parsed, err := url.Parse(strings.TrimSpace(pageURL))
	if err == nil && parsed.Host != "" {
		return parsed.Host
	}
	return "site"
}

func containsAny(value string, candidates ...string) bool {
	for _, candidate := range candidates {
		if strings.Contains(value, candidate) {
			return true
		}
	}
	return false
}

func contentOptimizerIssueID(pageURL string, suffix string) string {
	normalized := strings.ToLower(strings.TrimSpace(pageURL))
	replacer := strings.NewReplacer(
		"https://", "",
		"http://", "",
		"/", "-",
		".", "-",
		"?", "-",
		"&", "-",
		"=", "-",
		"#", "-",
	)
	normalized = strings.Trim(replacer.Replace(normalized), "-")
	if normalized == "" {
		normalized = "page"
	}
	return normalized + "-" + suffix
}
