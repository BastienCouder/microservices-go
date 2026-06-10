CREATE TABLE IF NOT EXISTS ai_models (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  icon_key TEXT NOT NULL,
  provider_model_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  supports_live_search BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  credit_cost INTEGER NOT NULL DEFAULT 1,
  input_price_per_million DOUBLE PRECISION,
  output_price_per_million DOUBLE PRECISION,
  openrouter_pricing JSONB,
  CONSTRAINT ai_models_provider_provider_model_id_unique UNIQUE (provider, provider_model_id),
  CONSTRAINT ai_models_display_name_not_blank CHECK (btrim(display_name) <> ''),
  CONSTRAINT ai_models_group_name_not_blank CHECK (btrim(group_name) <> ''),
  CONSTRAINT ai_models_icon_key_not_blank CHECK (btrim(icon_key) <> ''),
  CONSTRAINT ai_models_provider_model_id_not_blank CHECK (btrim(provider_model_id) <> '')
);

DROP TABLE IF EXISTS brand_canon;
