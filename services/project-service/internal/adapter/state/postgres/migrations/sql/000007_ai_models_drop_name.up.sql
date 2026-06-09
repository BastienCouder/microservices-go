ALTER TABLE ai_models
DROP CONSTRAINT IF EXISTS ai_models_provider_name_unique;

ALTER TABLE ai_models
DROP COLUMN IF EXISTS name;
