ALTER TABLE ai_models
  DROP COLUMN IF EXISTS openrouter_pricing,
  DROP COLUMN IF EXISTS output_price_per_million,
  DROP COLUMN IF EXISTS input_price_per_million,
  DROP COLUMN IF EXISTS credit_cost;
