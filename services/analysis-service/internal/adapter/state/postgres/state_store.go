package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
)

type persistedState struct {
	Seq                int64                                             `json:"seq"`
	Runs               map[string]*usecase.AnalysisRun                   `json:"runs"`
	RunsByProject      map[string][]string                               `json:"runsByProject"`
	PromptRuns         map[string]*usecase.PromptRun                     `json:"promptRuns"`
	PromptRunsByRun    map[string][]string                               `json:"promptRunsByRun"`
	Responses          map[string]*usecase.AIResponse                    `json:"responses"`
	ResponsesByRun     map[string][]string                               `json:"responsesByRun"`
	ResponseIndexByRun map[string]map[string]string                      `json:"responseIndexByRun"`
	RunByRequest       map[string]string                                 `json:"runByRequest"`
	Alerts             map[string]*usecase.Alert                         `json:"alerts"`
	AlertsByProject    map[string][]string                               `json:"alertsByProject"`
	ContentCrawls      map[string]*usecase.ContentOptimizerCrawlSnapshot `json:"contentCrawls"`
	OptimizeActions    map[string]*usecase.OptimizeAction                `json:"optimizeActions"`
	ActionsByProject   map[string][]string                               `json:"actionsByProject"`
}

type StateStore struct {
	db *pgxpool.Pool
}

func NewStateStore(db *pgxpool.Pool) *StateStore {
	return &StateStore{db: db}
}

func (s *StateStore) Load(ctx context.Context) ([]byte, bool, error) {
	state := persistedState{
		Runs:               make(map[string]*usecase.AnalysisRun),
		RunsByProject:      make(map[string][]string),
		PromptRuns:         make(map[string]*usecase.PromptRun),
		PromptRunsByRun:    make(map[string][]string),
		Responses:          make(map[string]*usecase.AIResponse),
		ResponsesByRun:     make(map[string][]string),
		ResponseIndexByRun: make(map[string]map[string]string),
		RunByRequest:       make(map[string]string),
		Alerts:             make(map[string]*usecase.Alert),
		AlertsByProject:    make(map[string][]string),
		ContentCrawls:      make(map[string]*usecase.ContentOptimizerCrawlSnapshot),
		OptimizeActions:    make(map[string]*usecase.OptimizeAction),
		ActionsByProject:   make(map[string][]string),
	}

	if err := s.loadRuns(ctx, &state); err != nil {
		return nil, false, err
	}
	if err := s.loadPromptRuns(ctx, &state); err != nil {
		return nil, false, err
	}
	if err := s.loadResponses(ctx, &state); err != nil {
		return nil, false, err
	}
	if err := s.loadAlerts(ctx, &state); err != nil {
		return nil, false, err
	}
	if err := s.loadContentCrawls(ctx, &state); err != nil {
		return nil, false, err
	}
	if err := s.loadOptimizeActions(ctx, &state); err != nil {
		return nil, false, err
	}

	if len(state.Runs) == 0 && len(state.PromptRuns) == 0 && len(state.Responses) == 0 && len(state.Alerts) == 0 {
		return nil, false, nil
	}

	payload, err := json.Marshal(state)
	if err != nil {
		return nil, false, fmt.Errorf("marshal analysis state: %w", err)
	}
	return payload, true, nil
}

func (s *StateStore) Save(ctx context.Context, payload []byte) error {
	var state persistedState
	if err := json.Unmarshal(payload, &state); err != nil {
		return fmt.Errorf("decode analysis state payload: %w", err)
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin analysis state transaction: %w", err)
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback(context.Background())
		}
	}()

	for _, statement := range []string{
		`DELETE FROM content_optimizer_crawls`,
		`DELETE FROM optimize_actions`,
		`DELETE FROM alerts`,
		`DELETE FROM ai_responses`,
		`DELETE FROM prompt_runs`,
		`DELETE FROM analysis_runs`,
	} {
		if _, err := tx.Exec(ctx, statement); err != nil {
			return fmt.Errorf("reset analysis tables: %w", err)
		}
	}

	if err := insertAnalysisRuns(ctx, tx, state.Runs, state.RunByRequest); err != nil {
		return err
	}
	if err := insertPromptRuns(ctx, tx, state.PromptRuns); err != nil {
		return err
	}
	if err := insertResponses(ctx, tx, state.Responses); err != nil {
		return err
	}
	if err := insertAlerts(ctx, tx, state.Alerts); err != nil {
		return err
	}
	if err := insertContentCrawls(ctx, tx, state.ContentCrawls); err != nil {
		return err
	}
	if err := insertOptimizeActions(ctx, tx, state.OptimizeActions); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit analysis state transaction: %w", err)
	}
	tx = nil
	return nil
}

func (s *StateStore) loadRuns(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT id, project_id, organization_id, created_by, request_id, run_type, status, prompts_count, models_count, credits_count, expected_responses, completed_responses, visibility_score, created_at, updated_at
		FROM analysis_runs
		ORDER BY created_at ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("select analysis runs: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			item      usecase.AnalysisRun
			requestID *string
		)
		if err := rows.Scan(
			&item.ID,
			&item.ProjectID,
			&item.OrganizationID,
			&item.CreatedBy,
			&requestID,
			&item.RunType,
			&item.Status,
			&item.PromptsCount,
			&item.ModelsCount,
			&item.CreditsCount,
			&item.ExpectedResponses,
			&item.CompletedResponses,
			&item.VisibilityScore,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return fmt.Errorf("scan analysis run: %w", err)
		}
		run := item
		state.Runs[item.ID] = &run
		state.RunsByProject[item.ProjectID] = append(state.RunsByProject[item.ProjectID], item.ID)
		if requestID != nil && *requestID != "" {
			state.RunByRequest[item.ProjectID+"|"+*requestID] = item.ID
		}
	}
	return rows.Err()
}

func (s *StateStore) loadPromptRuns(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT id, run_id, prompt_id, prompt_text, created_at
		FROM prompt_runs
		ORDER BY created_at ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("select prompt runs: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var item usecase.PromptRun
		if err := rows.Scan(&item.ID, &item.RunID, &item.PromptID, &item.PromptText, &item.CreatedAt); err != nil {
			return fmt.Errorf("scan prompt run: %w", err)
		}
		promptRun := item
		state.PromptRuns[item.ID] = &promptRun
		state.PromptRunsByRun[item.RunID] = append(state.PromptRunsByRun[item.RunID], item.ID)
	}
	return rows.Err()
}

func (s *StateStore) loadResponses(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT id, run_id, prompt_run_id, model_id, raw_response, brand_mentioned, brand_position, citation_found, cited_urls, sentiment, created_at
		FROM ai_responses
		ORDER BY created_at ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("select ai responses: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			item usecase.AIResponse
			raw  []byte
		)
		if err := rows.Scan(
			&item.ID,
			&item.RunID,
			&item.PromptRunID,
			&item.ModelID,
			&item.RawResponse,
			&item.BrandMentioned,
			&item.BrandPosition,
			&item.CitationFound,
			&raw,
			&item.Sentiment,
			&item.CreatedAt,
		); err != nil {
			return fmt.Errorf("scan ai response: %w", err)
		}
		if len(raw) > 0 {
			if err := json.Unmarshal(raw, &item.CitedURLs); err != nil {
				return fmt.Errorf("decode cited urls: %w", err)
			}
		}
		response := item
		state.Responses[item.ID] = &response
		state.ResponsesByRun[item.RunID] = append(state.ResponsesByRun[item.RunID], item.ID)
		if state.ResponseIndexByRun[item.RunID] == nil {
			state.ResponseIndexByRun[item.RunID] = make(map[string]string)
		}
		state.ResponseIndexByRun[item.RunID][item.PromptRunID+"|"+item.ModelID] = item.ID
	}
	return rows.Err()
}

func (s *StateStore) loadAlerts(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT id, project_id, alert_type, severity, title, description, is_read, created_at, updated_at
		FROM alerts
		ORDER BY created_at ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("select alerts: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var item usecase.Alert
		if err := rows.Scan(
			&item.ID,
			&item.ProjectID,
			&item.AlertType,
			&item.Severity,
			&item.Title,
			&item.Description,
			&item.IsRead,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return fmt.Errorf("scan alert: %w", err)
		}
		alert := item
		state.Alerts[item.ID] = &alert
		state.AlertsByProject[item.ProjectID] = append(state.AlertsByProject[item.ProjectID], item.ID)
	}
	return rows.Err()
}

func (s *StateStore) loadContentCrawls(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT project_id, organization_id, job_id, result, created_at, updated_at
		FROM content_optimizer_crawls
		ORDER BY updated_at ASC, project_id ASC
	`)
	if err != nil {
		return fmt.Errorf("select content optimizer crawls: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			item      usecase.ContentOptimizerCrawlSnapshot
			rawResult []byte
		)
		if err := rows.Scan(
			&item.ProjectID,
			&item.OrganizationID,
			&item.JobID,
			&rawResult,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return fmt.Errorf("scan content optimizer crawl: %w", err)
		}
		if err := json.Unmarshal(rawResult, &item.Result); err != nil {
			return fmt.Errorf("decode content optimizer crawl result: %w", err)
		}
		snapshot := item
		state.ContentCrawls[fmt.Sprintf("%d|%s", item.OrganizationID, item.ProjectID)] = &snapshot
	}
	return rows.Err()
}

func (s *StateStore) loadOptimizeActions(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT id, project_id, priority, type, title, issue, impact, generated_content, status, source_error_id, metadata, created_at, updated_at
		FROM optimize_actions
		ORDER BY created_at ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("select optimize actions: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			item          usecase.OptimizeAction
			impact        *string
			sourceErrorID *string
			rawMetadata   []byte
		)
		if err := rows.Scan(
			&item.ID,
			&item.ProjectID,
			&item.Priority,
			&item.Type,
			&item.Title,
			&item.Issue,
			&impact,
			&item.GeneratedContent,
			&item.Status,
			&sourceErrorID,
			&rawMetadata,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return fmt.Errorf("scan optimize action: %w", err)
		}
		item.Impact = stringValue(impact)
		item.SourceErrorID = stringValue(sourceErrorID)
		item.Metadata = decodeMap(rawMetadata)
		action := item
		state.OptimizeActions[item.ID] = &action
		state.ActionsByProject[item.ProjectID] = append(state.ActionsByProject[item.ProjectID], item.ID)
	}
	return rows.Err()
}

func insertAnalysisRuns(ctx context.Context, tx pgx.Tx, runs map[string]*usecase.AnalysisRun, runByRequest map[string]string) error {
	requestIDs := reverseRunRequestMap(runByRequest)
	for _, runID := range sortedAnalysisRunIDs(runs) {
		run := runs[runID]
		requestID := requestIDs[runID]
		if _, err := tx.Exec(ctx, `
			INSERT INTO analysis_runs (id, project_id, organization_id, created_by, request_id, run_type, status, prompts_count, models_count, credits_count, expected_responses, completed_responses, visibility_score, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		`, run.ID, run.ProjectID, run.OrganizationID, run.CreatedBy, nullableString(requestID), run.RunType, run.Status, run.PromptsCount, run.ModelsCount, run.CreditsCount, run.ExpectedResponses, run.CompletedResponses, run.VisibilityScore, run.CreatedAt, run.UpdatedAt); err != nil {
			return fmt.Errorf("insert analysis run %s: %w", run.ID, err)
		}
	}
	return nil
}

func insertPromptRuns(ctx context.Context, tx pgx.Tx, promptRuns map[string]*usecase.PromptRun) error {
	for _, promptRunID := range sortedPromptRunIDs(promptRuns) {
		promptRun := promptRuns[promptRunID]
		if _, err := tx.Exec(ctx, `
			INSERT INTO prompt_runs (id, run_id, prompt_id, prompt_text, created_at)
			VALUES ($1, $2, $3, $4, $5)
		`, promptRun.ID, promptRun.RunID, promptRun.PromptID, promptRun.PromptText, promptRun.CreatedAt); err != nil {
			return fmt.Errorf("insert prompt run %s: %w", promptRun.ID, err)
		}
	}
	return nil
}

func insertResponses(ctx context.Context, tx pgx.Tx, responses map[string]*usecase.AIResponse) error {
	for _, responseID := range sortedResponseIDs(responses) {
		response := responses[responseID]
		rawCitedURLs, err := json.Marshal(response.CitedURLs)
		if err != nil {
			return fmt.Errorf("marshal cited urls for %s: %w", response.ID, err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO ai_responses (id, run_id, prompt_run_id, model_id, raw_response, brand_mentioned, brand_position, citation_found, cited_urls, sentiment, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
		`, response.ID, response.RunID, response.PromptRunID, response.ModelID, response.RawResponse, response.BrandMentioned, response.BrandPosition, response.CitationFound, rawCitedURLs, response.Sentiment, response.CreatedAt); err != nil {
			return fmt.Errorf("insert ai response %s: %w", response.ID, err)
		}
	}
	return nil
}

func insertAlerts(ctx context.Context, tx pgx.Tx, alerts map[string]*usecase.Alert) error {
	for _, alertID := range sortedAlertIDs(alerts) {
		alert := alerts[alertID]
		if _, err := tx.Exec(ctx, `
			INSERT INTO alerts (id, project_id, alert_type, severity, title, description, is_read, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, alert.ID, alert.ProjectID, alert.AlertType, alert.Severity, alert.Title, alert.Description, alert.IsRead, alert.CreatedAt, alert.UpdatedAt); err != nil {
			return fmt.Errorf("insert alert %s: %w", alert.ID, err)
		}
	}
	return nil
}

func insertContentCrawls(ctx context.Context, tx pgx.Tx, crawls map[string]*usecase.ContentOptimizerCrawlSnapshot) error {
	for _, key := range sortedContentCrawlKeys(crawls) {
		crawl := crawls[key]
		rawResult, err := json.Marshal(crawl.Result)
		if err != nil {
			return fmt.Errorf("marshal content optimizer crawl result for %s: %w", key, err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO content_optimizer_crawls (project_id, organization_id, job_id, result, created_at, updated_at)
			VALUES ($1, $2, $3, $4::jsonb, $5, $6)
		`, crawl.ProjectID, crawl.OrganizationID, crawl.JobID, string(rawResult), crawl.CreatedAt, crawl.UpdatedAt); err != nil {
			return fmt.Errorf("insert content optimizer crawl %s: %w", key, err)
		}
	}
	return nil
}

func insertOptimizeActions(ctx context.Context, tx pgx.Tx, actions map[string]*usecase.OptimizeAction) error {
	for _, actionID := range sortedOptimizeActionIDs(actions) {
		action := actions[actionID]
		rawMetadata, err := json.Marshal(action.Metadata)
		if err != nil {
			return fmt.Errorf("marshal optimize action metadata for %s: %w", action.ID, err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO optimize_actions (id, project_id, priority, type, title, issue, impact, generated_content, status, source_error_id, metadata, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
		`, action.ID, action.ProjectID, action.Priority, action.Type, action.Title, action.Issue, nullIfEmpty(action.Impact), action.GeneratedContent, action.Status, nullIfEmpty(action.SourceErrorID), string(rawMetadata), action.CreatedAt, action.UpdatedAt); err != nil {
			return fmt.Errorf("insert optimize action %s: %w", action.ID, err)
		}
	}
	return nil
}

func reverseRunRequestMap(runByRequest map[string]string) map[string]string {
	reversed := make(map[string]string, len(runByRequest))
	for key, runID := range runByRequest {
		if runID == "" {
			continue
		}
		parts := strings.SplitN(key, "|", 2)
		if len(parts) != 2 || parts[1] == "" {
			continue
		}
		reversed[runID] = parts[1]
	}
	return reversed
}

func sortedAnalysisRunIDs(items map[string]*usecase.AnalysisRun) []string {
	ids := make([]string, 0, len(items))
	for id := range items {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func sortedPromptRunIDs(items map[string]*usecase.PromptRun) []string {
	ids := make([]string, 0, len(items))
	for id := range items {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func sortedResponseIDs(items map[string]*usecase.AIResponse) []string {
	ids := make([]string, 0, len(items))
	for id := range items {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func sortedAlertIDs(items map[string]*usecase.Alert) []string {
	ids := make([]string, 0, len(items))
	for id := range items {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func sortedContentCrawlKeys(items map[string]*usecase.ContentOptimizerCrawlSnapshot) []string {
	ids := make([]string, 0, len(items))
	for id := range items {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func sortedOptimizeActionIDs(items map[string]*usecase.OptimizeAction) []string {
	ids := make([]string, 0, len(items))
	for id := range items {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func nullIfEmpty(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func decodeStringSlice(raw []byte) []string {
	if len(raw) == 0 {
		return []string{}
	}
	var values []string
	if err := json.Unmarshal(raw, &values); err != nil {
		return []string{}
	}
	return values
}

func decodeMap(raw []byte) map[string]any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	var values map[string]any
	if err := json.Unmarshal(raw, &values); err != nil {
		return map[string]any{}
	}
	if values == nil {
		return map[string]any{}
	}
	return values
}
