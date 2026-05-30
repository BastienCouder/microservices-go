ALTER TABLE ai_models
  ADD COLUMN IF NOT EXISTS credit_cost INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS input_price_per_million DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS output_price_per_million DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS openrouter_pricing JSONB;

UPDATE ai_models
SET credit_cost = 1
WHERE credit_cost IS NULL OR credit_cost < 1;
