package usecase

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	defaultContentCrawlDepth = 2
	maxContentCrawlLimit     = 1000
	maxContentCrawlDepth     = 25
)

const (
	starterContentSelectedLimit = 10
	growthContentSelectedLimit  = 50
	agencyContentSelectedLimit  = 200
)

type ContentOptimizerCrawlOptions struct {
	IncludeExternalLinks bool     `json:"includeExternalLinks"`
	IncludeSubdomains    bool     `json:"includeSubdomains"`
	IncludePatterns      []string `json:"includePatterns,omitempty"`
	ExcludePatterns      []string `json:"excludePatterns,omitempty"`
}

type ContentOptimizerCrawlStartInput struct {
	ProjectID      string                       `json:"-"`
	OrganizationID int64                        `json:"-"`
	URL            string                       `json:"url"`
	Limit          int                          `json:"limit"`
	Depth          int                          `json:"depth"`
	Source         string                       `json:"source"`
	Formats        []string                     `json:"formats"`
	Render         bool                         `json:"render"`
	Options        ContentOptimizerCrawlOptions `json:"options"`
	CrawlPurposes  []string                     `json:"crawlPurposes"`
}

type ContentOptimizerCrawlResultInput struct {
	Cursor       string `json:"cursor,omitempty"`
	Limit        int    `json:"limit,omitempty"`
	Status       string `json:"status,omitempty"`
	SkipAnalysis bool   `json:"skipAnalysis,omitempty"`
}

type ContentOptimizerAnalysisStartInput struct {
	Records         []ContentOptimizerCrawlRecord `json:"records"`
	ModelID         string                        `json:"modelId"`
	ProviderModelID string                        `json:"providerModelId"`
	ProviderID      string                        `json:"providerId"`
	CreditCost      int                           `json:"creditCost"`
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
	Source         string `json:"source,omitempty"`
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
	AnalysisStatus     string                        `json:"analysisStatus,omitempty"`
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
	normalized.ProjectID = strings.TrimSpace(projectID)
	normalized.OrganizationID = organizationID
	if len(normalized.Options.IncludePatterns) > 0 {
		limit, hasLimit, err := s.contentSelectedCrawlLimit(ctx, organizationID)
		if err != nil {
			return ContentOptimizerCrawlJob{}, err
		}
		if hasLimit && len(normalized.Options.IncludePatterns) > limit {
			return ContentOptimizerCrawlJob{}, fmt.Errorf("%w: selected crawl cannot exceed plan limit of %d pages", ErrValidation, limit)
		}
		if hasLimit && normalized.Limit > limit {
			normalized.Limit = limit
		}
	}

	job, err := s.contentCrawler.StartCrawl(ctx, normalized)
	if err != nil {
		return ContentOptimizerCrawlJob{}, err
	}
	if strings.TrimSpace(job.ID) == "" {
		return ContentOptimizerCrawlJob{}, fmt.Errorf("%w: content crawler returned an empty job id", ErrDependencyUnavailable)
	}
	if len(normalized.Options.IncludePatterns) > 0 {
		_ = s.saveLatestContentOptimizerCrawl(ctx, projectID, organizationID, job.ID, ContentOptimizerCrawlResult{
			ID:       job.ID,
			Status:   job.Status,
			Total:    normalized.Limit,
			Finished: 0,
			Records:  nil,
		})
	}
	return job, nil
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
		Cursor:       strings.TrimSpace(input.Cursor),
		Limit:        input.Limit,
		Status:       strings.ToLower(strings.TrimSpace(input.Status)),
		SkipAnalysis: input.SkipAnalysis,
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
	if isTerminalCrawlJobStatus(result.Status) && shouldSaveContentOptimizerCrawlResult(normalized, result) {
		if err := s.saveLatestContentOptimizerCrawl(ctx, projectID, organizationID, jobID, result); err != nil {
			return ContentOptimizerCrawlResult{}, err
		}
	}
	return result, nil
}

func (s *Service) AnalyzeSelectedContentOptimizerRecords(
	ctx context.Context,
	projectID string,
	organizationID int64,
	records []ContentOptimizerCrawlRecord,
) (ContentOptimizerCrawlResult, error) {
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return ContentOptimizerCrawlResult{}, err
	}
	normalizedRecords := normalizeSelectedContentOptimizerRecords(records)
	if len(normalizedRecords) == 0 {
		return ContentOptimizerCrawlResult{}, fmt.Errorf("%w: at least one selected record is required", ErrValidation)
	}
	if len(normalizedRecords) > maxContentCrawlLimit {
		return ContentOptimizerCrawlResult{}, fmt.Errorf("%w: selected records cannot exceed %d", ErrValidation, maxContentCrawlLimit)
	}

	jobID := "selected-analysis-" + strconv.FormatInt(s.now().UTC().UnixNano(), 10)
	reservation, err := s.ReserveCreditUsage(ctx, CreditUsageInput{
		RequestID:      jobID,
		OrganizationID: organizationID,
		ProjectID:      projectID,
		RunType:        RunTypeContentSelectedAnalysis,
		Credits:        len(normalizedRecords),
	})
	if err != nil {
		return ContentOptimizerCrawlResult{}, err
	}

	result := ContentOptimizerCrawlResult{
		ID:             jobID,
		Status:         "completed",
		AnalysisStatus: "completed",
		Total:          len(normalizedRecords),
		Finished:       len(normalizedRecords),
		Records:        normalizedRecords,
	}
	result = s.analyzeContentOptimizerCrawlResult(ctx, projectID, organizationID, result)
	if err := s.saveLatestContentOptimizerCrawl(ctx, projectID, organizationID, jobID, result); err != nil {
		_, _ = s.ReleaseCreditUsage(ctx, reservation.ID)
		return ContentOptimizerCrawlResult{}, err
	}
	if _, err := s.CompleteCreditUsage(ctx, reservation.ID); err != nil {
		return ContentOptimizerCrawlResult{}, err
	}
	return result, nil
}

func (s *Service) StartContentOptimizerAnalysis(
	ctx context.Context,
	projectID string,
	organizationID int64,
	input ContentOptimizerAnalysisStartInput,
) (AnalysisRun, error) {
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return AnalysisRun{}, err
	}
	records := normalizeSelectedContentOptimizerRecords(input.Records)
	if len(records) == 0 {
		return AnalysisRun{}, fmt.Errorf("%w: at least one selected record is required", ErrValidation)
	}
	input.ModelID = strings.TrimSpace(input.ModelID)
	input.ProviderModelID = strings.TrimSpace(input.ProviderModelID)
	input.ProviderID = strings.TrimSpace(input.ProviderID)
	if input.ModelID == "" || input.ProviderModelID == "" || input.ProviderID == "" {
		return AnalysisRun{}, fmt.Errorf("%w: modelId, providerModelId and providerId are required", ErrValidation)
	}
	if input.CreditCost <= 0 {
		return AnalysisRun{}, fmt.Errorf("%w: creditCost must be positive", ErrValidation)
	}
	if s.projectModels != nil {
		enabled, err := s.projectModels.ListProjectEnabledModels(ctx, projectID, organizationID)
		if err != nil {
			return AnalysisRun{}, err
		}
		allowed := false
		for _, id := range enabled {
			if strings.TrimSpace(id) == input.ModelID {
				allowed = true
				break
			}
		}
		if !allowed {
			return AnalysisRun{}, fmt.Errorf("%w: selected model is not enabled for this project", ErrValidation)
		}
	}

	requestID := "content-analysis-" + strconv.FormatInt(s.now().UTC().UnixNano(), 10)
	run, err := s.ReserveCreditUsage(ctx, CreditUsageInput{
		RequestID: requestID, OrganizationID: organizationID, ProjectID: projectID,
		RunType: RunTypeContentSelectedAnalysis, Credits: len(records) * input.CreditCost,
	})
	if err != nil {
		return AnalysisRun{}, err
	}

	baseRecords := append([]ContentOptimizerCrawlRecord(nil), records...)
	if latest, latestErr := s.GetLatestContentOptimizerCrawl(ctx, projectID, organizationID); latestErr == nil && len(latest.Result.Records) > 0 {
		baseRecords = append([]ContentOptimizerCrawlRecord(nil), latest.Result.Records...)
	}
	go s.runContentOptimizerAnalysis(run.ID, projectID, organizationID, baseRecords, records, input.ProviderModelID, input.ProviderID)
	return run, nil
}

func (s *Service) runContentOptimizerAnalysis(runID string, projectID string, organizationID int64, baseRecords []ContentOptimizerCrawlRecord, records []ContentOptimizerCrawlRecord, modelID string, providerID string) {
	ctx := context.Background()
	for index := range records {
		records[index].Issues = nil
	}
	result := ContentOptimizerCrawlResult{
		ID: runID, Status: "completed", AnalysisStatus: "completed",
		Total: len(records), Finished: len(records), Records: records,
	}
	result = s.analyzeContentOptimizerCrawlResultWithModel(ctx, projectID, organizationID, result, modelID, providerID)
	analyzedByURL := make(map[string]ContentOptimizerCrawlRecord, len(result.Records))
	for _, record := range result.Records {
		analyzedByURL[strings.TrimSpace(record.URL)] = record
	}
	merged := append([]ContentOptimizerCrawlRecord(nil), baseRecords...)
	for index, record := range merged {
		if analyzed, ok := analyzedByURL[strings.TrimSpace(record.URL)]; ok {
			merged[index] = analyzed
			delete(analyzedByURL, strings.TrimSpace(record.URL))
		}
	}
	for _, record := range analyzedByURL {
		merged = append(merged, record)
	}
	result.Records = merged
	result.Total = len(merged)
	result.Finished = len(merged)
	if err := s.saveLatestContentOptimizerCrawl(ctx, projectID, organizationID, runID, result); err != nil {
		_, _ = s.ReleaseCreditUsage(ctx, runID)
		return
	}
	_, _ = s.CompleteCreditUsage(ctx, runID)
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
	localSnapshot, hasLocalSnapshot := s.contentCrawls[contentOptimizerCrawlKey(projectID, organizationID)]
	if hasLocalSnapshot && localSnapshot != nil && localSnapshot.Result.AnalysisStatus == "completed" {
		out := copyContentOptimizerCrawlSnapshot(localSnapshot)
		s.mu.RUnlock()
		return out, nil
	}
	s.mu.RUnlock()

	if provider, ok := s.contentCrawler.(interface {
		GetLatestCrawl(context.Context, string, int64) (ContentOptimizerCrawlSnapshot, error)
	}); ok {
		snapshot, err := provider.GetLatestCrawl(ctx, projectID, organizationID)
		if err == nil {
			return snapshot, nil
		}
		if !errors.Is(err, ErrNotFound) {
			return ContentOptimizerCrawlSnapshot{}, err
		}
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

func (s *Service) GetContentOptimizerSelectionDraft(
	ctx context.Context,
	projectID string,
	organizationID int64,
) (ContentOptimizerSelectionDraft, error) {
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return ContentOptimizerSelectionDraft{}, err
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	draft, ok := s.contentSelections[contentOptimizerCrawlKey(projectID, organizationID)]
	if !ok || draft == nil {
		return ContentOptimizerSelectionDraft{}, fmt.Errorf("%w: content optimizer selection not found", ErrNotFound)
	}
	return copyContentOptimizerSelectionDraft(draft), nil
}

func (s *Service) SaveContentOptimizerSelectionDraft(
	ctx context.Context,
	projectID string,
	organizationID int64,
	draft ContentOptimizerSelectionDraft,
) (ContentOptimizerSelectionDraft, error) {
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return ContentOptimizerSelectionDraft{}, err
	}
	normalized := ContentOptimizerSelectionDraft{
		ProjectID:      strings.TrimSpace(projectID),
		OrganizationID: organizationID,
		JobID:          strings.TrimSpace(draft.JobID),
		SelectedURLs:   normalizeTrimmedStringList(draft.SelectedURLs),
		Result:         copyContentOptimizerCrawlResult(draft.Result),
		UpdatedAt:      s.now().UTC(),
	}
	if normalized.JobID == "" {
		normalized.JobID = strings.TrimSpace(normalized.Result.ID)
	}
	if normalized.Result.ID == "" {
		normalized.Result.ID = normalized.JobID
	}
	if normalized.Result.Total < len(normalized.Result.Records) {
		normalized.Result.Total = len(normalized.Result.Records)
	}
	if normalized.Result.Finished < len(normalized.Result.Records) && isTerminalCrawlJobStatus(normalized.Result.Status) {
		normalized.Result.Finished = len(normalized.Result.Records)
	}
	if len(normalized.Result.Records) == 0 {
		return ContentOptimizerSelectionDraft{}, fmt.Errorf("%w: selection result records are required", ErrValidation)
	}

	key := contentOptimizerCrawlKey(projectID, organizationID)

	s.mu.Lock()
	defer s.mu.Unlock()

	backup := s.snapshotLocked()
	s.contentSelections[key] = &normalized
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return ContentOptimizerSelectionDraft{}, err
	}
	return copyContentOptimizerSelectionDraft(&normalized), nil
}

func normalizeSelectedContentOptimizerRecords(records []ContentOptimizerCrawlRecord) []ContentOptimizerCrawlRecord {
	normalized := make([]ContentOptimizerCrawlRecord, 0, len(records))
	seen := make(map[string]struct{}, len(records))
	for _, record := range records {
		record.URL = strings.TrimSpace(record.URL)
		if record.URL == "" {
			continue
		}
		if _, ok := seen[record.URL]; ok {
			continue
		}
		seen[record.URL] = struct{}{}
		if strings.TrimSpace(record.Status) == "" {
			record.Status = "completed"
		}
		normalized = append(normalized, record)
	}
	return normalized
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
	if len(normalized.Options.IncludePatterns) > 0 {
		if normalized.Limit <= 0 {
			normalized.Limit = len(normalized.Options.IncludePatterns)
		}
		if normalized.Limit > maxContentCrawlLimit {
			return ContentOptimizerCrawlStartInput{}, fmt.Errorf("%w: limit cannot exceed %d", ErrValidation, maxContentCrawlLimit)
		}
	} else if normalized.Limit < 0 {
		return ContentOptimizerCrawlStartInput{}, fmt.Errorf("%w: limit must be positive", ErrValidation)
	}
	return normalized, nil
}

func (s *Service) contentSelectedCrawlLimit(ctx context.Context, organizationID int64) (int, bool, error) {
	if s.billingQuota == nil {
		return agencyContentSelectedLimit, true, nil
	}
	provider, ok := s.billingQuota.(BillingEntitlementsProvider)
	if !ok {
		return agencyContentSelectedLimit, true, nil
	}
	entitlements, found, err := provider.GetOrganizationEntitlements(ctx, organizationID)
	if err != nil {
		return 0, false, err
	}
	if !found {
		return starterContentSelectedLimit, true, nil
	}
	limit, limited := contentSelectedCrawlLimitForPlan(entitlements.Plan)
	return limit, limited, nil
}

func contentSelectedCrawlLimitForPlan(plan string) (int, bool) {
	switch strings.ToLower(strings.TrimSpace(plan)) {
	case "starter", "free":
		return starterContentSelectedLimit, true
	case "growth", "pro-monthly":
		return growthContentSelectedLimit, true
	case "pro", "agency", "pro-yearly":
		return agencyContentSelectedLimit, true
	case "agency-enterprise", "enterprise":
		return 0, false
	default:
		return starterContentSelectedLimit, true
	}
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
	case "queued", "running", "completed", "partially_completed", "disallowed", "skipped", "errored", "cancelled":
		return true
	default:
		return false
	}
}

func isTerminalCrawlJobStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "completed", "partially_completed", "cancelled_due_to_timeout", "cancelled_due_to_limits", "cancelled_by_user", "errored":
		return true
	default:
		return false
	}
}

func shouldSaveContentOptimizerCrawlResult(input ContentOptimizerCrawlResultInput, result ContentOptimizerCrawlResult) bool {
	if input.Limit <= 0 || result.Total <= 0 {
		return len(result.Records) > 0
	}
	return len(result.Records) >= result.Total
}

func contentOptimizerCrawlKey(projectID string, organizationID int64) string {
	return fmt.Sprintf("%d|%s", organizationID, strings.TrimSpace(projectID))
}

func analyzeContentOptimizerCrawlResult(result ContentOptimizerCrawlResult) ContentOptimizerCrawlResult {
	result.AnalysisStatus = "completed"
	result.Records = append([]ContentOptimizerCrawlRecord(nil), result.Records...)
	for index := range result.Records {
		result.Records[index].Issues = mergeContentOptimizerIssues(
			withContentOptimizerIssueSource(
				analyzeContentOptimizerRecord(result.Records[index]),
				"rule",
			),
			result.Records[index].Issues,
		)
	}
	return result
}

func withContentOptimizerIssueSource(issues []ContentOptimizerIssue, source string) []ContentOptimizerIssue {
	nextIssues := append([]ContentOptimizerIssue(nil), issues...)
	for index := range nextIssues {
		if strings.TrimSpace(nextIssues[index].Source) == "" {
			nextIssues[index].Source = source
		}
	}
	return nextIssues
}

func (s *Service) analyzeContentOptimizerCrawlResult(
	ctx context.Context,
	projectID string,
	organizationID int64,
	result ContentOptimizerCrawlResult,
) ContentOptimizerCrawlResult {
	return s.analyzeContentOptimizerCrawlResultWithModel(ctx, projectID, organizationID, result, "", "")
}

func (s *Service) analyzeContentOptimizerCrawlResultWithModel(
	ctx context.Context,
	projectID string,
	organizationID int64,
	result ContentOptimizerCrawlResult,
	modelID string,
	providerID string,
) ContentOptimizerCrawlResult {
	result = analyzeContentOptimizerCrawlResult(result)
	if s.contentIssueAnalyzer == nil {
		return result
	}

	for index := range result.Records {
		record := result.Records[index]
		aiIssues, err := s.contentIssueAnalyzer.AnalyzeContentIssues(ctx, ContentIssueAnalysisInput{
			ProjectID:           projectID,
			OrganizationID:      organizationID,
			ModelID:             modelID,
			ProviderID:          providerID,
			Record:              record,
			DeterministicIssues: append([]ContentOptimizerIssue(nil), record.Issues...),
		})
		if err != nil {
			continue
		}
		result.Records[index].Issues = mergeContentOptimizerIssues(
			record.Issues,
			withContentOptimizerIssueSource(aiIssues, "ai"),
		)
	}
	return result
}

func mergeContentOptimizerIssues(groups ...[]ContentOptimizerIssue) []ContentOptimizerIssue {
	merged := make([]ContentOptimizerIssue, 0)
	seen := make(map[string]struct{})
	for _, group := range groups {
		for _, issue := range group {
			fixType := strings.TrimSpace(issue.FixType)
			if fixType == "" {
				continue
			}
			if strings.TrimSpace(issue.ID) == "" {
				issue.ID = fixType
			}
			key := fixType
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			merged = append(merged, issue)
		}
	}
	return merged
}

func analyzeContentOptimizerRecord(record ContentOptimizerCrawlRecord) []ContentOptimizerIssue {
	issues := make([]ContentOptimizerIssue, 0, 12)
	topic := contentOptimizerPageTopic(record)
	host := contentOptimizerPageHost(record.URL)
	if record.Status != "completed" || record.HTTPStatus >= 400 {
		return append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "http_error"),
			Category:       "technical",
			Severity:       "high",
			Title:          "Page inaccessible pendant le crawl",
			Description:    "La page ne peut pas etre analysee correctement tant qu'elle retourne une erreur ou un statut non complete.",
			Recommendation: fmt.Sprintf("Verifier %s: retourner un statut 200 et supprimer les redirections inutiles avant de lancer l'analyse de contenu.", record.URL),
			FixType:        "fix_http_status",
		})
	}

	content := strings.TrimSpace(record.Markdown)
	if content == "" {
		content = strings.TrimSpace(record.HTML)
	}
	lowerContent := strings.ToLower(content)
	lowerHTML := strings.ToLower(record.HTML)
	wordCount := len(strings.Fields(content))
	h1Count := contentOptimizerMarkdownHeadingCount(content, 1)
	h1Text := contentOptimizerFirstMarkdownHeading(content, 1)
	h2Count := contentOptimizerMarkdownHeadingCount(content, 2) + contentOptimizerMarkdownHeadingCount(content, 3)

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
	} else if titleLength := len([]rune(strings.TrimSpace(record.Title))); titleLength < 20 || titleLength > 65 {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "weak_title"),
			Category:       "seo",
			Severity:       "medium",
			Title:          "Title SEO peu optimise",
			Description:    "Le titre existe mais sa longueur ou son contexte limite sa performance dans les resultats de recherche.",
			Recommendation: fmt.Sprintf("Reecrire le title autour de 45 a 60 caracteres: \"%s: avantages, prix et FAQ | %s\".", topic, host),
			FixType:        "improve_title",
		})
	}

	if strings.TrimSpace(record.HTML) != "" && !contentOptimizerHasMetaDescription(record.HTML) {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "missing_meta_description"),
			Category:       "seo",
			Severity:       "medium",
			Title:          "Meta description absente",
			Description:    "Aucune meta description exploitable n'a ete detectee dans le HTML crawle.",
			Recommendation: fmt.Sprintf("Ajouter une meta description de 140 a 160 caracteres qui resume %s, la preuve principale et l'action suivante.", strings.ToLower(topic)),
			FixType:        "add_meta_description",
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
	} else if wordCount < 300 {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "limited_depth"),
			Category:       "geo",
			Severity:       "low",
			Title:          "Profondeur de contenu limitee",
			Description:    "La page couvre le sujet mais donne encore peu de contexte pour une reponse IA fiable.",
			Recommendation: fmt.Sprintf("Ajouter des sections \"Cas d'usage\", \"Limites\", \"Comparaison\" et \"Preuves\" pour rendre %s plus citable.", strings.ToLower(topic)),
			FixType:        "add_topic_depth",
		})
	}

	if h1Count != 1 || len([]rune(h1Text)) < 20 {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "weak_h1"),
			Category:       "seo",
			Severity:       "medium",
			Title:          "H1 absent ou ambigu",
			Description:    "La page devrait exposer un seul H1 clair qui confirme le sujet principal.",
			Recommendation: fmt.Sprintf("Ajouter un H1 unique et descriptif du type \"%s: prix, avantages et cas d'usage\".", topic),
			FixType:        "improve_h1",
		})
	}

	if h2Count < 2 {
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

	if !contentOptimizerHasInternalLinks(content, record.URL) && !contentOptimizerHasInternalLinks(record.HTML, record.URL) {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "missing_internal_links"),
			Category:       "seo",
			Severity:       "medium",
			Title:          "Maillage interne insuffisant",
			Description:    "Aucun lien interne utile n'a ete detecte dans le contenu extrait.",
			Recommendation: fmt.Sprintf("Ajouter 2 a 4 liens internes depuis %s vers une FAQ, un guide comparatif, une page preuve et une page conversion.", record.URL),
			FixType:        "add_internal_links",
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

	if !containsAny(lowerContent, "en resume", "en résumé", "reponse courte", "réponse courte", "la reponse", "la réponse", "definition", "définition") {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "missing_direct_answer"),
			Category:       "geo",
			Severity:       "medium",
			Title:          "Reponse directe absente",
			Description:    "Les moteurs generatifs privilegient les pages qui donnent une reponse concise avant le detail.",
			Recommendation: fmt.Sprintf("Ajouter en haut de page un paragraphe \"Reponse courte\" de 40 a 60 mots expliquant clairement %s.", strings.ToLower(topic)),
			FixType:        "add_direct_answer",
		})
	}

	if !contentOptimizerHasEvidenceSignals(lowerContent) {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "missing_evidence"),
			Category:       "geo",
			Severity:       "medium",
			Title:          "Preuves et sources insuffisantes",
			Description:    "Le contenu manque de chiffres, sources, temoignages ou preuves qui rendent une reponse IA verifiable.",
			Recommendation: fmt.Sprintf("Ajouter au moins 3 preuves pour %s: chiffre, exemple client, source citee, date de mise a jour ou resultat mesurable.", strings.ToLower(topic)),
			FixType:        "add_evidence",
		})
	}

	if !containsAny(lowerContent, host, "entreprise", "marque", "produit", "service", "secteur", "audience", "localisation") {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "missing_entity_context"),
			Category:       "geo",
			Severity:       "low",
			Title:          "Contexte d'entite incomplet",
			Description:    "La page ne donne pas assez de contexte sur l'entite, l'offre, le secteur ou l'audience visee.",
			Recommendation: fmt.Sprintf("Ajouter un bloc \"A propos\" indiquant qui propose %s, pour quelle audience, dans quel secteur et avec quelle differenciation.", strings.ToLower(topic)),
			FixType:        "add_entity_context",
		})
	}

	if !containsAny(lowerContent, "fonctionnalite", "fonctionnalité", "fonctionnalites", "fonctionnalités", "benefice", "bénéfice", "avantage", "offre", "solution", "service", "produit", "prix", "tarif") {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "missing_offer_clarity"),
			Category:       "geo",
			Severity:       "medium",
			Title:          "Offre peu explicite",
			Description:    "La page ne decrit pas assez clairement ce qui est propose, avec quelles fonctionnalites et quels benefices.",
			Recommendation: fmt.Sprintf("Ajouter un bloc \"Ce que propose %s\" avec 3 a 5 fonctionnalites, les benefices associes et les criteres qui differencient l'offre.", strings.ToLower(topic)),
			FixType:        "clarify_offer",
		})
	}

	if !containsAny(lowerContent, "pour les", "pour qui", "equipe", "équipes", "pme", "startup", "independant", "indépendant", "marketing", "sales", "agence", "cas d'usage", "use case", "utilisateurs") {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "missing_audience_use_cases"),
			Category:       "geo",
			Severity:       "medium",
			Title:          "Audience et cas d'usage incomplets",
			Description:    "La page ne donne pas assez de contexte sur les utilisateurs cibles et les situations dans lesquelles recommander l'offre.",
			Recommendation: fmt.Sprintf("Ajouter une section \"Pour qui\" avec 3 audiences cibles et 3 cas d'usage concrets pour %s.", strings.ToLower(topic)),
			FixType:        "add_audience_use_cases",
		})
	}

	if !containsAny(lowerContent, "alternative", "comparatif", "compare", "comparaison", "versus", "vs", "difference", "différence", "criteres", "critères", "choisir") {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "missing_comparison_context"),
			Category:       "geo",
			Severity:       "low",
			Title:          "Contexte de comparaison absent",
			Description:    "Les moteurs generatifs recommandent mieux une offre quand les criteres de choix et alternatives sont explicites.",
			Recommendation: fmt.Sprintf("Ajouter un bloc \"Comment choisir\" ou \"Comparaison\" qui explique quand choisir %s, quand choisir une alternative et quels criteres regarder.", strings.ToLower(topic)),
			FixType:        "add_comparison_context",
		})
	}

	if !contentOptimizerHasFreshnessSignals(lowerContent) {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "missing_freshness_signal"),
			Category:       "geo",
			Severity:       "low",
			Title:          "Fraicheur du contenu peu visible",
			Description:    "La page ne donne pas de signal clair sur la date de mise a jour ou la recence des informations.",
			Recommendation: fmt.Sprintf("Ajouter une date de mise a jour ou une mention de version pour rendre les informations sur %s plus fiables dans les reponses IA.", strings.ToLower(topic)),
			FixType:        "add_freshness_signal",
		})
	}

	if strings.TrimSpace(record.HTML) != "" && !containsAny(lowerHTML, "schema.org", "application/ld+json", "\"@type\"", "\"@context\"") {
		issues = append(issues, ContentOptimizerIssue{
			ID:             contentOptimizerIssueID(record.URL, "missing_schema_markup"),
			Category:       "geo",
			Severity:       "medium",
			Title:          "Schema markup absent",
			Description:    "Aucune donnee structuree JSON-LD ou schema.org n'a ete detectee dans le HTML crawle.",
			Recommendation: fmt.Sprintf("Ajouter un JSON-LD adapte a %s: WebPage, BreadcrumbList, FAQPage si FAQ presente, et Organization ou Product selon la page.", strings.ToLower(topic)),
			FixType:        "add_schema_markup",
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

	return issues
}

func contentOptimizerHasMetaDescription(html string) bool {
	lowerHTML := strings.ToLower(html)
	return strings.Contains(lowerHTML, "<meta") &&
		strings.Contains(lowerHTML, "name=\"description\"") &&
		strings.Contains(lowerHTML, "content=")
}

func contentOptimizerMarkdownHeadingCount(content string, level int) int {
	prefix := strings.Repeat("#", level) + " "
	count := 0
	for _, line := range strings.Split(content, "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), prefix) {
			count++
		}
	}
	return count
}

func contentOptimizerFirstMarkdownHeading(content string, level int) string {
	prefix := strings.Repeat("#", level) + " "
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, prefix) {
			return strings.TrimSpace(strings.TrimPrefix(trimmed, prefix))
		}
	}
	return ""
}

func contentOptimizerHasInternalLinks(content string, pageURL string) bool {
	if strings.TrimSpace(content) == "" {
		return false
	}
	host := contentOptimizerPageHost(pageURL)
	lowerContent := strings.ToLower(content)
	return strings.Contains(lowerContent, "](/") ||
		strings.Contains(lowerContent, "href=\"/") ||
		strings.Contains(lowerContent, "href='/") ||
		(host != "site" && strings.Contains(lowerContent, strings.ToLower(host)))
}

func contentOptimizerHasEvidenceSignals(lowerContent string) bool {
	if containsAny(lowerContent, "%", "source", "etude", "étude", "client", "temoignage", "témoignage", "cas client", "benchmark", "donnees", "données") {
		return true
	}
	for _, token := range strings.Fields(lowerContent) {
		for _, char := range token {
			if char >= '0' && char <= '9' {
				return true
			}
		}
	}
	return false
}

func contentOptimizerHasFreshnessSignals(lowerContent string) bool {
	return containsAny(lowerContent, "mis a jour", "mis à jour", "derniere mise", "dernière mise", "version", "actualise", "actualisé", "2024", "2025", "2026")
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
