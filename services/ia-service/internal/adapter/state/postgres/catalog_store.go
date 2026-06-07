package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/ia-service/internal/usecase"
)

type CatalogStore struct {
	db *pgxpool.Pool
}

func NewCatalogStore(db *pgxpool.Pool) *CatalogStore {
	return &CatalogStore{db: db}
}

func (s *CatalogStore) LoadModels(ctx context.Context) (map[string]usecase.AIModel, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, display_name, provider, group_name, icon_key, provider_model_id, is_active, supports_live_search,
		       credit_cost, input_price_per_million, output_price_per_million, openrouter_pricing
		FROM ai_models
		ORDER BY display_name ASC, id ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("select ai models: %w", err)
	}
	defer rows.Close()

	models := make(map[string]usecase.AIModel)
	for rows.Next() {
		var (
			item        usecase.AIModel
			inputPrice  sql.NullFloat64
			outputPrice sql.NullFloat64
			rawPricing  []byte
		)
		if err := rows.Scan(
			&item.ID,
			&item.Label,
			&item.Provider,
			&item.Group,
			&item.IconKey,
			&item.ModelID,
			&item.IsActive,
			&item.SupportsLiveSearch,
			&item.CreditCost,
			&inputPrice,
			&outputPrice,
			&rawPricing,
		); err != nil {
			return nil, fmt.Errorf("scan ai model: %w", err)
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
				return nil, fmt.Errorf("decode model openrouter pricing: %w", err)
			}
		}
		item.IconPath = "/models/" + item.IconKey + ".svg"
		models[item.ID] = item
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return models, nil
}

func (s *CatalogStore) SaveModels(ctx context.Context, models map[string]usecase.AIModel) error {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin ai model catalog transaction: %w", err)
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback(context.Background())
		}
	}()

	if _, err := tx.Exec(ctx, `DELETE FROM ai_models`); err != nil {
		return fmt.Errorf("reset ai models: %w", err)
	}
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
		`, model.ID, model.Provider, model.Label, model.Group, model.IconKey, model.ModelID, model.IsActive, model.SupportsLiveSearch, creditCost, model.InputPricePerMillion, model.OutputPricePerMillion, rawPricing); err != nil {
			return fmt.Errorf("insert ai model %s: %w", model.ID, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit ai model catalog transaction: %w", err)
	}
	tx = nil
	return nil
}

func sortedModelIDs(items map[string]usecase.AIModel) []string {
	ids := make([]string, 0, len(items))
	for id := range items {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}
