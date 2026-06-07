package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/project-service/internal/security"
	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
)

type persistedState struct {
	Seq                   int64                                               `json:"seq"`
	Projects              map[string]*usecase.Project                         `json:"projects"`
	Prompts               map[string]*usecase.Prompt                          `json:"prompts"`
	Competitors           map[string]*usecase.Competitor                      `json:"competitors"`
	Models                map[string]usecase.AIModel                          `json:"models"`
	BrandCanonByProject   map[string]*usecase.BrandCanon                      `json:"brandCanonByProject"`
	ProjectModels         map[string]map[string]bool                          `json:"projectModels"`
	ModelSelectionChanges map[string]usecase.ProjectModelSelectionChangeUsage `json:"modelSelectionChanges"`
	ImpactIntegrations    map[string]*usecase.ProjectImpactIntegrations       `json:"impactIntegrations"`
	Outbox                map[string]*usecase.OutboxEvent                     `json:"outbox"`
	OutboxOrder           []string                                            `json:"outboxOrder"`
}

type StateStore struct {
	db    *pgxpool.Pool
	codec *security.SecretCodec
}

func NewStateStore(db *pgxpool.Pool, secretEncryptionKey string) (*StateStore, error) {
	codec, err := security.NewSecretCodec(secretEncryptionKey)
	if err != nil {
		return nil, err
	}
	return &StateStore{db: db, codec: codec}, nil
}

func (s *StateStore) Load(ctx context.Context) ([]byte, bool, error) {
	state := persistedState{
		Projects:              make(map[string]*usecase.Project),
		Prompts:               make(map[string]*usecase.Prompt),
		Competitors:           make(map[string]*usecase.Competitor),
		Models:                make(map[string]usecase.AIModel),
		BrandCanonByProject:   make(map[string]*usecase.BrandCanon),
		ProjectModels:         make(map[string]map[string]bool),
		ModelSelectionChanges: make(map[string]usecase.ProjectModelSelectionChangeUsage),
		ImpactIntegrations:    make(map[string]*usecase.ProjectImpactIntegrations),
		Outbox:                make(map[string]*usecase.OutboxEvent),
		OutboxOrder:           make([]string, 0),
	}

	if err := s.loadProjects(ctx, &state); err != nil {
		return nil, false, err
	}
	if err := s.loadPrompts(ctx, &state); err != nil {
		return nil, false, err
	}
	if err := s.loadPromptModels(ctx, &state); err != nil {
		return nil, false, err
	}
	if err := s.loadCompetitors(ctx, &state); err != nil {
		return nil, false, err
	}
	if err := s.loadBrandCanon(ctx, &state); err != nil {
		return nil, false, err
	}
	if err := s.loadProjectModels(ctx, &state); err != nil {
		return nil, false, err
	}
	if err := s.loadModelSelectionChanges(ctx, &state); err != nil {
		return nil, false, err
	}
	if err := s.loadImpactIntegrations(ctx, &state); err != nil {
		return nil, false, err
	}
	if err := s.loadOutbox(ctx, &state); err != nil {
		return nil, false, err
	}

	if len(state.Projects) == 0 && len(state.Prompts) == 0 && len(state.Competitors) == 0 && len(state.Models) == 0 {
		return nil, false, nil
	}

	payload, err := json.Marshal(state)
	if err != nil {
		return nil, false, fmt.Errorf("marshal project state: %w", err)
	}
	return payload, true, nil
}

func (s *StateStore) Save(ctx context.Context, payload []byte) error {
	var state persistedState
	if err := json.Unmarshal(payload, &state); err != nil {
		return fmt.Errorf("decode project state payload: %w", err)
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin project state transaction: %w", err)
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback(context.Background())
		}
	}()

	for _, statement := range []string{
		`DELETE FROM outbox_events`,
		`DELETE FROM prompt_models`,
		`DELETE FROM project_models`,
		`DELETE FROM project_model_selection_changes`,
		`DELETE FROM project_impact_integrations`,
		`DELETE FROM brand_canon`,
		`DELETE FROM competitors`,
		`DELETE FROM prompts`,
		`DELETE FROM projects`,
	} {
		if _, err := tx.Exec(ctx, statement); err != nil {
			return fmt.Errorf("reset project tables: %w", err)
		}
	}

	if err := insertProjects(ctx, tx, state.Projects); err != nil {
		return err
	}
	if err := insertBrandCanon(ctx, tx, state.BrandCanonByProject); err != nil {
		return err
	}
	if err := insertPrompts(ctx, tx, state.Prompts); err != nil {
		return err
	}
	if err := insertPromptModels(ctx, tx, state.Prompts); err != nil {
		return err
	}
	if err := insertCompetitors(ctx, tx, state.Competitors); err != nil {
		return err
	}
	if err := insertProjectSelections(ctx, tx, state.ProjectModels); err != nil {
		return err
	}
	if err := insertModelSelectionChanges(ctx, tx, state.ModelSelectionChanges); err != nil {
		return err
	}
	if err := s.insertImpactIntegrations(ctx, tx, state.ImpactIntegrations); err != nil {
		return err
	}
	if err := insertOutboxEvents(ctx, tx, state.Outbox, state.OutboxOrder); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit project state transaction: %w", err)
	}
	tx = nil
	return nil
}

func (s *StateStore) loadProjects(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT id, organization_id, created_by, name, domain, website_url, attribution_source, brand_name, brand_description, industry, primary_language, country, created_at, updated_at
		FROM projects
		ORDER BY created_at ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("select projects: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			item              usecase.Project
			attributionSource *string
			brandName         *string
			brandDescription  *string
			industry          *string
		)
		if err := rows.Scan(
			&item.ID,
			&item.OrganizationID,
			&item.CreatedBy,
			&item.Name,
			&item.Domain,
			&item.WebsiteURL,
			&attributionSource,
			&brandName,
			&brandDescription,
			&industry,
			&item.PrimaryLanguage,
			&item.Country,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return fmt.Errorf("scan project: %w", err)
		}
		item.AttributionSource = stringValue(attributionSource)
		item.BrandName = stringValue(brandName)
		item.BrandDescription = stringValue(brandDescription)
		item.Industry = stringValue(industry)
		project := item
		state.Projects[item.ID] = &project
	}
	return rows.Err()
}

func (s *StateStore) loadPrompts(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT id, project_id, text, intent, kind, schedule_mode, schedule_cron, schedule_timezone, status, is_active, created_at, updated_at
		FROM prompts
		ORDER BY created_at ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("select prompts: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			item             usecase.Prompt
			intent           *string
			kind             *string
			scheduleMode     *string
			scheduleCron     *string
			scheduleTimezone *string
			status           *string
		)
		if err := rows.Scan(
			&item.ID,
			&item.ProjectID,
			&item.Text,
			&intent,
			&kind,
			&scheduleMode,
			&scheduleCron,
			&scheduleTimezone,
			&status,
			&item.IsActive,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return fmt.Errorf("scan prompt: %w", err)
		}
		item.Intent = stringValue(intent)
		item.Kind = stringValue(kind)
		item.Schedule = usecase.PromptSchedule{
			Mode:       stringValue(scheduleMode),
			Cron:       stringValue(scheduleCron),
			Timezone:   stringValue(scheduleTimezone),
			ModelCrons: map[string]string{},
		}
		if item.Schedule.Mode == "" {
			item.Schedule.Mode = usecase.PromptScheduleModeGlobal
		}
		if item.Schedule.Cron == "" {
			item.Schedule.Cron = usecase.DefaultPromptCron
		}
		if item.Schedule.Timezone == "" {
			item.Schedule.Timezone = usecase.DefaultPromptTimezone
		}
		item.Status = stringValue(status)
		if item.Status == "" {
			if item.IsActive {
				item.Status = usecase.PromptStatusActive
			} else {
				item.Status = usecase.PromptStatusDisabled
			}
		}
		prompt := item
		state.Prompts[item.ID] = &prompt
	}
	return rows.Err()
}

func (s *StateStore) loadPromptModels(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT prompt_id, model_id
		FROM prompt_models
		ORDER BY prompt_id ASC, model_id ASC
	`)
	if err != nil {
		return fmt.Errorf("select prompt models: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var promptID string
		var modelID string
		if err := rows.Scan(&promptID, &modelID); err != nil {
			return fmt.Errorf("scan prompt model: %w", err)
		}
		prompt := state.Prompts[promptID]
		if prompt == nil {
			continue
		}
		prompt.ModelIDs = append(prompt.ModelIDs, modelID)
	}
	return rows.Err()
}

func (s *StateStore) loadCompetitors(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT id, project_id, name, domain, website_url, is_active, created_at, updated_at
		FROM competitors
		ORDER BY created_at ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("select competitors: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			item       usecase.Competitor
			domain     *string
			websiteURL *string
		)
		if err := rows.Scan(
			&item.ID,
			&item.ProjectID,
			&item.Name,
			&domain,
			&websiteURL,
			&item.IsActive,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return fmt.Errorf("scan competitor: %w", err)
		}
		item.Domain = stringValue(domain)
		item.WebsiteURL = stringValue(websiteURL)
		competitor := item
		state.Competitors[item.ID] = &competitor
	}
	return rows.Err()
}

func (s *StateStore) loadBrandCanon(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
			SELECT project_id, brand_name, category, positioning, audience, use_cases, features, created_at, updated_at
		FROM brand_canon
		ORDER BY project_id ASC
	`)
	if err != nil {
		return fmt.Errorf("select brand canon: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			item        usecase.BrandCanon
			brandName   *string
			category    *string
			positioning *string
			rawAudience []byte
			rawUseCases []byte
			rawFeatures []byte
		)
		if err := rows.Scan(
			&item.ProjectID,
			&brandName,
			&category,
			&positioning,
			&rawAudience,
			&rawUseCases,
			&rawFeatures,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return fmt.Errorf("scan brand canon: %w", err)
		}

		item.BrandName = stringValue(brandName)
		item.Category = stringValue(category)
		item.Positioning = stringValue(positioning)
		item.Audience = decodeStringSlice(rawAudience)
		item.UseCases = decodeStringSlice(rawUseCases)
		item.Features = decodeStringSlice(rawFeatures)

		canon := item
		state.BrandCanonByProject[item.ProjectID] = &canon
	}
	return rows.Err()
}

func (s *StateStore) loadModels(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT id, display_name, provider, group_name, icon_key, provider_model_id, is_active, supports_live_search,
			credit_cost, input_price_per_million, output_price_per_million, openrouter_pricing
		FROM ai_models
		ORDER BY display_name ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("select models: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			item        usecase.AIModel
			group       *string
			iconKey     *string
			inputPrice  sql.NullFloat64
			outputPrice sql.NullFloat64
			rawPricing  []byte
		)
		if err := rows.Scan(
			&item.ID,
			&item.Label,
			&item.Provider,
			&group,
			&iconKey,
			&item.ModelID,
			&item.IsActive,
			&item.SupportsLiveSearch,
			&item.CreditCost,
			&inputPrice,
			&outputPrice,
			&rawPricing,
		); err != nil {
			return fmt.Errorf("scan model: %w", err)
		}
		if item.CreditCost < 1 {
			item.CreditCost = 1
		}
		if inputPrice.Valid {
			value := inputPrice.Float64
			item.InputPricePerMillion = &value
		}
		if outputPrice.Valid {
			value := outputPrice.Float64
			item.OutputPricePerMillion = &value
		}
		if len(rawPricing) > 0 {
			if err := json.Unmarshal(rawPricing, &item.OpenRouterPricing); err != nil {
				return fmt.Errorf("decode model openrouter pricing: %w", err)
			}
		}
		item.Group = stringValue(group)
		item.IconKey = stringValue(iconKey)
		item.IconPath = iconPathFromKey(item.IconKey)
		state.Models[item.ID] = item
	}
	return rows.Err()
}

func (s *StateStore) loadProjectModels(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT project_id, model_id, is_enabled
		FROM project_models
		ORDER BY project_id ASC, model_id ASC
	`)
	if err != nil {
		return fmt.Errorf("select project models: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var projectID string
		var modelID string
		var enabled bool
		if err := rows.Scan(&projectID, &modelID, &enabled); err != nil {
			return fmt.Errorf("scan project model: %w", err)
		}
		if state.ProjectModels[projectID] == nil {
			state.ProjectModels[projectID] = make(map[string]bool)
		}
		state.ProjectModels[projectID][modelID] = enabled
	}
	return rows.Err()
}

func (s *StateStore) loadModelSelectionChanges(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT project_id, usage_month, change_count
		FROM project_model_selection_changes
		ORDER BY project_id ASC
	`)
	if err != nil {
		return fmt.Errorf("select project model selection changes: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var projectID string
		var usageMonth string
		var changeCount int
		if err := rows.Scan(&projectID, &usageMonth, &changeCount); err != nil {
			return fmt.Errorf("scan project model selection change: %w", err)
		}
		state.ModelSelectionChanges[projectID] = usecase.ProjectModelSelectionChangeUsage{
			Month: usageMonth,
			Count: changeCount,
		}
	}
	return rows.Err()
}

func (s *StateStore) loadImpactIntegrations(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT project_id,
		       ga4_property_id,
			       ga4_service_account_ciphertext,
			       ga4_oauth_refresh_token_ciphertext,
			       ga4_connected_at,
			       ga4_updated_at
		FROM project_impact_integrations
		ORDER BY project_id ASC
	`)
	if err != nil {
		return fmt.Errorf("select project impact integrations: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			projectID               string
			ga4PropertyID           *string
			ga4ServiceAccountCipher *string
			ga4OAuthRefreshCipher   *string
			ga4ConnectedAt          *time.Time
			ga4UpdatedAt            *time.Time
		)
		if err := rows.Scan(
			&projectID,
			&ga4PropertyID,
			&ga4ServiceAccountCipher,
			&ga4OAuthRefreshCipher,
			&ga4ConnectedAt,
			&ga4UpdatedAt,
		); err != nil {
			return fmt.Errorf("scan project impact integration: %w", err)
		}

		ga4ServiceAccountJSON, err := s.codec.Decrypt(stringValue(ga4ServiceAccountCipher))
		if err != nil {
			return fmt.Errorf("decrypt ga4 service account for project %s: %w", projectID, err)
		}
		ga4OAuthRefreshToken, err := s.codec.Decrypt(stringValue(ga4OAuthRefreshCipher))
		if err != nil {
			return fmt.Errorf("decrypt ga4 oauth refresh token for project %s: %w", projectID, err)
		}
		value := usecase.ProjectImpactIntegrations{
			ProjectID: projectID,
			GA4: usecase.ProjectGA4Integration{
				PropertyID:         stringValue(ga4PropertyID),
				ServiceAccountJSON: ga4ServiceAccountJSON,
				OAuthRefreshToken:  ga4OAuthRefreshToken,
				ConnectedAt:        timeValue(ga4ConnectedAt),
				UpdatedAt:          timeValue(ga4UpdatedAt),
			},
		}
		state.ImpactIntegrations[projectID] = &value
	}
	return rows.Err()
}

func (s *StateStore) loadOutbox(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT id, event_type, status, payload, sort_order, created_at, updated_at
		FROM outbox_events
		ORDER BY sort_order ASC, created_at ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("select outbox events: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			item      usecase.OutboxEvent
			raw       []byte
			sortOrder int
		)
		if err := rows.Scan(&item.ID, &item.EventType, &item.Status, &raw, &sortOrder, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return fmt.Errorf("scan outbox event: %w", err)
		}
		if len(raw) > 0 {
			if err := json.Unmarshal(raw, &item.Payload); err != nil {
				return fmt.Errorf("decode outbox payload: %w", err)
			}
		}
		event := item
		state.Outbox[item.ID] = &event
		state.OutboxOrder = append(state.OutboxOrder, item.ID)
	}
	return rows.Err()
}

func insertProjectModelsCatalog(ctx context.Context, tx pgx.Tx, models map[string]usecase.AIModel) error {
	for _, modelID := range sortedModelIDs(models) {
		model := models[modelID]
		creditCost := model.CreditCost
		if creditCost < 1 {
			creditCost = 1
		}
		var rawPricing []byte
		if len(model.OpenRouterPricing) > 0 {
			payload, err := json.Marshal(model.OpenRouterPricing)
			if err != nil {
				return fmt.Errorf("encode ai model %s openrouter pricing: %w", model.ID, err)
			}
			rawPricing = payload
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO ai_models (
				id, provider, display_name, group_name, icon_key, provider_model_id, is_active, supports_live_search,
				credit_cost, input_price_per_million, output_price_per_million, openrouter_pricing, created_at, updated_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, NOW(), NOW())
		`, model.ID, model.Provider, model.Label, nullIfEmptyOrFallback(model.Group, model.Provider), nullIfEmptyOrFallback(model.IconKey, model.Provider), nullIfEmptyOrFallback(model.ModelID, model.ID), model.IsActive, model.SupportsLiveSearch, creditCost, model.InputPricePerMillion, model.OutputPricePerMillion, rawPricing); err != nil {
			return fmt.Errorf("insert ai model %s: %w", model.ID, err)
		}
	}
	return nil
}

func insertBrandCanon(ctx context.Context, tx pgx.Tx, canonByProject map[string]*usecase.BrandCanon) error {
	for _, projectID := range sortedBrandCanonProjectIDs(canonByProject) {
		canon := canonByProject[projectID]
		if canon == nil {
			continue
		}
		audience, err := json.Marshal(canon.Audience)
		if err != nil {
			return fmt.Errorf("marshal brand canon audience for project %s: %w", projectID, err)
		}
		useCases, err := json.Marshal(canon.UseCases)
		if err != nil {
			return fmt.Errorf("marshal brand canon use cases for project %s: %w", projectID, err)
		}
		features, err := json.Marshal(canon.Features)
		if err != nil {
			return fmt.Errorf("marshal brand canon features for project %s: %w", projectID, err)
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO brand_canon (project_id, brand_name, category, positioning, audience, use_cases, features, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)
		`, canon.ProjectID, nullIfEmpty(canon.BrandName), nullIfEmpty(canon.Category), nullIfEmpty(canon.Positioning), string(audience), string(useCases), string(features), canon.CreatedAt, canon.UpdatedAt); err != nil {
			return fmt.Errorf("insert brand canon for project %s: %w", projectID, err)
		}
	}
	return nil
}

func insertProjects(ctx context.Context, tx pgx.Tx, projects map[string]*usecase.Project) error {
	for _, projectID := range sortedProjectIDs(projects) {
		project := projects[projectID]
		if _, err := tx.Exec(ctx, `
			INSERT INTO projects (id, organization_id, created_by, name, domain, website_url, attribution_source, brand_name, brand_description, industry, primary_language, country, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		`, project.ID, project.OrganizationID, project.CreatedBy, project.Name, project.Domain, project.WebsiteURL, nullIfEmpty(project.AttributionSource), nullIfEmpty(project.BrandName), nullIfEmpty(project.BrandDescription), nullIfEmpty(project.Industry), nullIfEmptyOrFallback(project.PrimaryLanguage, "fr"), nullIfEmptyOrFallback(project.Country, "FR"), project.CreatedAt, project.UpdatedAt); err != nil {
			return fmt.Errorf("insert project %s: %w", project.ID, err)
		}
	}
	return nil
}

func insertPrompts(ctx context.Context, tx pgx.Tx, prompts map[string]*usecase.Prompt) error {
	for _, promptID := range sortedPromptIDs(prompts) {
		prompt := prompts[promptID]
		if _, err := tx.Exec(ctx, `
			INSERT INTO prompts (id, project_id, text, intent, kind, language, country, schedule_mode, schedule_cron, schedule_timezone, status, is_active, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, 'fr', 'FR', $6, $7, $8, $9, $10, $11, $12)
		`, prompt.ID, prompt.ProjectID, prompt.Text, nullIfEmpty(prompt.Intent), nullIfEmptyOrFallback(prompt.Kind, usecase.PromptKindMonitoring), nullIfEmptyOrFallback(prompt.Schedule.Mode, usecase.PromptScheduleModeGlobal), nullIfEmptyOrFallback(prompt.Schedule.Cron, usecase.DefaultPromptCron), nullIfEmptyOrFallback(prompt.Schedule.Timezone, usecase.DefaultPromptTimezone), nullIfEmptyOrFallback(prompt.Status, usecase.PromptStatusActive), prompt.IsActive, prompt.CreatedAt, prompt.UpdatedAt); err != nil {
			return fmt.Errorf("insert prompt %s: %w", prompt.ID, err)
		}
	}
	return nil
}

func insertPromptModels(ctx context.Context, tx pgx.Tx, prompts map[string]*usecase.Prompt) error {
	for _, promptID := range sortedPromptIDs(prompts) {
		prompt := prompts[promptID]
		for _, modelID := range sortedUniqueStrings(prompt.ModelIDs) {
			if _, err := tx.Exec(ctx, `
				INSERT INTO prompt_models (prompt_id, model_id, created_at, updated_at)
				VALUES ($1, $2, NOW(), NOW())
			`, prompt.ID, modelID); err != nil {
				return fmt.Errorf("insert prompt model %s/%s: %w", prompt.ID, modelID, err)
			}
		}
	}
	return nil
}

func insertCompetitors(ctx context.Context, tx pgx.Tx, competitors map[string]*usecase.Competitor) error {
	for _, competitorID := range sortedCompetitorIDs(competitors) {
		competitor := competitors[competitorID]
		if _, err := tx.Exec(ctx, `
			INSERT INTO competitors (id, project_id, name, domain, website_url, is_active, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, competitor.ID, competitor.ProjectID, competitor.Name, nullIfEmpty(competitor.Domain), nullIfEmpty(competitor.WebsiteURL), competitor.IsActive, competitor.CreatedAt, competitor.UpdatedAt); err != nil {
			return fmt.Errorf("insert competitor %s: %w", competitor.ID, err)
		}
	}
	return nil
}

func insertProjectSelections(ctx context.Context, tx pgx.Tx, selections map[string]map[string]bool) error {
	projectIDs := make([]string, 0, len(selections))
	for projectID := range selections {
		projectIDs = append(projectIDs, projectID)
	}
	sort.Strings(projectIDs)
	for _, projectID := range projectIDs {
		modelIDs := make([]string, 0, len(selections[projectID]))
		for modelID := range selections[projectID] {
			modelIDs = append(modelIDs, modelID)
		}
		sort.Strings(modelIDs)
		for _, modelID := range modelIDs {
			if _, err := tx.Exec(ctx, `
				INSERT INTO project_models (project_id, model_id, is_enabled, created_at, updated_at)
				VALUES ($1, $2, $3, NOW(), NOW())
			`, projectID, modelID, selections[projectID][modelID]); err != nil {
				return fmt.Errorf("insert project model %s/%s: %w", projectID, modelID, err)
			}
		}
	}
	return nil
}

func insertModelSelectionChanges(
	ctx context.Context,
	tx pgx.Tx,
	items map[string]usecase.ProjectModelSelectionChangeUsage,
) error {
	projectIDs := make([]string, 0, len(items))
	for projectID := range items {
		projectIDs = append(projectIDs, projectID)
	}
	sort.Strings(projectIDs)
	for _, projectID := range projectIDs {
		item := items[projectID]
		if strings.TrimSpace(item.Month) == "" || item.Count <= 0 {
			continue
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO project_model_selection_changes (project_id, usage_month, change_count, created_at, updated_at)
			VALUES ($1, $2, $3, NOW(), NOW())
		`, projectID, item.Month, item.Count); err != nil {
			return fmt.Errorf("insert project model selection change %s: %w", projectID, err)
		}
	}
	return nil
}

func (s *StateStore) insertImpactIntegrations(
	ctx context.Context,
	tx pgx.Tx,
	items map[string]*usecase.ProjectImpactIntegrations,
) error {
	projectIDs := make([]string, 0, len(items))
	for projectID := range items {
		projectIDs = append(projectIDs, projectID)
	}
	sort.Strings(projectIDs)

	for _, projectID := range projectIDs {
		item := items[projectID]
		if item == nil {
			continue
		}

		ga4ServiceAccountCipher, err := s.codec.Encrypt(item.GA4.ServiceAccountJSON)
		if err != nil {
			return fmt.Errorf("encrypt ga4 service account for project %s: %w", projectID, err)
		}
		ga4OAuthRefreshCipher, err := s.codec.Encrypt(item.GA4.OAuthRefreshToken)
		if err != nil {
			return fmt.Errorf("encrypt ga4 oauth refresh token for project %s: %w", projectID, err)
		}
		if _, err := tx.Exec(ctx, `
				INSERT INTO project_impact_integrations (
					project_id,
					ga4_property_id,
					ga4_service_account_ciphertext,
					ga4_oauth_refresh_token_ciphertext,
					ga4_connected_at,
					ga4_updated_at,
					created_at,
					updated_at
				)
				VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
			`,
			projectID,
			nullIfEmpty(item.GA4.PropertyID),
			nullIfEmpty(ga4ServiceAccountCipher),
			nullIfEmpty(ga4OAuthRefreshCipher),
			nullIfZeroTime(item.GA4.ConnectedAt),
			nullIfZeroTime(item.GA4.UpdatedAt),
		); err != nil {
			return fmt.Errorf("insert project impact integration %s: %w", projectID, err)
		}
	}
	return nil
}

func insertOutboxEvents(ctx context.Context, tx pgx.Tx, outbox map[string]*usecase.OutboxEvent, ordered []string) error {
	for index, eventID := range orderedOutboxIDs(outbox, ordered) {
		event := outbox[eventID]
		raw, err := json.Marshal(event.Payload)
		if err != nil {
			return fmt.Errorf("marshal outbox payload %s: %w", event.ID, err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO outbox_events (id, event_type, status, payload, sort_order, created_at, updated_at)
			VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
		`, event.ID, event.EventType, event.Status, raw, index, event.CreatedAt, event.UpdatedAt); err != nil {
			return fmt.Errorf("insert outbox event %s: %w", event.ID, err)
		}
	}
	return nil
}

func sortedProjectIDs(items map[string]*usecase.Project) []string {
	ids := make([]string, 0, len(items))
	for id := range items {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func sortedPromptIDs(items map[string]*usecase.Prompt) []string {
	ids := make([]string, 0, len(items))
	for id := range items {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func sortedCompetitorIDs(items map[string]*usecase.Competitor) []string {
	ids := make([]string, 0, len(items))
	for id := range items {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func sortedBrandCanonProjectIDs(items map[string]*usecase.BrandCanon) []string {
	ids := make([]string, 0, len(items))
	for id := range items {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func sortedModelIDs(items map[string]usecase.AIModel) []string {
	ids := make([]string, 0, len(items))
	for id := range items {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func orderedOutboxIDs(outbox map[string]*usecase.OutboxEvent, order []string) []string {
	seen := make(map[string]bool, len(order))
	orderedIDs := make([]string, 0, len(outbox))
	for _, id := range order {
		if outbox[id] == nil || seen[id] {
			continue
		}
		seen[id] = true
		orderedIDs = append(orderedIDs, id)
	}
	extras := make([]string, 0)
	for id := range outbox {
		if seen[id] {
			continue
		}
		extras = append(extras, id)
	}
	sort.Strings(extras)
	return append(orderedIDs, extras...)
}

func sortedUniqueStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	sort.Strings(out)
	return out
}

func nullIfEmpty(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func nullIfEmptyOrFallback(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
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

func timeValue(value *time.Time) time.Time {
	if value == nil {
		return time.Time{}
	}
	return value.UTC()
}

func nullIfZeroTime(value time.Time) any {
	if value.IsZero() {
		return nil
	}
	return value
}

func iconPathFromKey(iconKey string) string {
	if iconKey == "" {
		return ""
	}
	return "/models/" + iconKey + ".svg"
}
