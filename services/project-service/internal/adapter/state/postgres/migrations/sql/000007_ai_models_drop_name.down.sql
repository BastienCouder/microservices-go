ALTER TABLE ai_models
ADD COLUMN IF NOT EXISTS name TEXT;

UPDATE ai_models
SET name = COALESCE(NULLIF(name, ''), NULLIF(provider_model_id, ''), id);

ALTER TABLE ai_models
ALTER COLUMN name SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_models_provider_name_unique'
  ) THEN
    ALTER TABLE ai_models
    ADD CONSTRAINT ai_models_provider_name_unique UNIQUE (provider, name);
  END IF;
END $$;
