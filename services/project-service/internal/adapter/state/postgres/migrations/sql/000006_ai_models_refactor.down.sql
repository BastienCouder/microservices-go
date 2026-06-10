ALTER TABLE ai_models
ADD COLUMN IF NOT EXISTS label TEXT,
ADD COLUMN IF NOT EXISTS model_group TEXT,
ADD COLUMN IF NOT EXISTS model_id TEXT;

UPDATE ai_models
SET
  label = COALESCE(NULLIF(label, ''), display_name),
  model_group = COALESCE(NULLIF(model_group, ''), group_name),
  model_id = COALESCE(NULLIF(model_id, ''), provider_model_id);

ALTER TABLE ai_models
ALTER COLUMN label SET NOT NULL,
ALTER COLUMN model_id SET NOT NULL;

ALTER TABLE ai_models
DROP CONSTRAINT IF EXISTS ai_models_display_name_not_blank,
DROP CONSTRAINT IF EXISTS ai_models_group_name_not_blank,
DROP CONSTRAINT IF EXISTS ai_models_icon_key_not_blank,
DROP CONSTRAINT IF EXISTS ai_models_provider_model_id_not_blank,
DROP CONSTRAINT IF EXISTS ai_models_provider_provider_model_id_unique;

ALTER TABLE ai_models
DROP COLUMN IF EXISTS display_name,
DROP COLUMN IF EXISTS group_name,
DROP COLUMN IF EXISTS provider_model_id;
