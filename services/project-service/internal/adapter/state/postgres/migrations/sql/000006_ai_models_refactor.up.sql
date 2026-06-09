ALTER TABLE ai_models
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS group_name TEXT,
ADD COLUMN IF NOT EXISTS provider_model_id TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'ai_models'
      AND column_name = 'label'
  ) THEN
    EXECUTE $sql$
      UPDATE ai_models
      SET
        display_name = COALESCE(NULLIF(display_name, ''), NULLIF(label, ''), NULLIF(name, ''), id),
        group_name = COALESCE(
          NULLIF(group_name, ''),
          NULLIF(model_group, ''),
          CASE
            WHEN lower(coalesce(name, '')) LIKE 'gpt%' OR lower(coalesce(provider, '')) = 'openai' THEN 'chatgpt'
            WHEN lower(coalesce(name, '')) LIKE 'claude%' OR lower(coalesce(provider, '')) = 'anthropic' THEN 'claude'
            WHEN lower(coalesce(name, '')) LIKE 'gemini%' OR lower(coalesce(provider, '')) = 'google' THEN 'gemini'
            WHEN lower(coalesce(name, '')) LIKE 'sonar%' OR lower(coalesce(name, '')) LIKE 'perplexity%' OR lower(coalesce(provider, '')) = 'perplexity' THEN 'perplexity'
            WHEN lower(coalesce(name, '')) LIKE 'mistral%' OR lower(coalesce(provider, '')) = 'mistral' THEN 'mistral'
            WHEN lower(coalesce(name, '')) LIKE 'deepseek%' OR lower(coalesce(provider, '')) = 'deepseek' THEN 'deepseek'
            WHEN lower(coalesce(name, '')) LIKE 'groq%' OR lower(coalesce(provider, '')) = 'groq' THEN 'groq'
            WHEN lower(coalesce(name, '')) LIKE 'grok%' OR lower(coalesce(provider, '')) = 'grok' THEN 'grok'
            ELSE lower(split_part(coalesce(name, provider, id), '-', 1))
          END
        ),
        provider_model_id = COALESCE(NULLIF(provider_model_id, ''), NULLIF(model_id, ''), NULLIF(name, ''), id),
        icon_key = COALESCE(
          NULLIF(icon_key, ''),
          CASE
            WHEN lower(coalesce(provider, '')) IN ('openai', 'anthropic', 'google', 'perplexity', 'mistral', 'deepseek', 'groq', 'grok') THEN lower(provider)
            ELSE lower(split_part(coalesce(name, provider, id), '-', 1))
          END
        )
    $sql$;
  ELSE
    EXECUTE $sql$
      UPDATE ai_models
      SET
        display_name = COALESCE(NULLIF(display_name, ''), NULLIF(name, ''), id),
        group_name = COALESCE(
          NULLIF(group_name, ''),
          CASE
            WHEN lower(coalesce(name, '')) LIKE 'gpt%' OR lower(coalesce(provider, '')) = 'openai' THEN 'chatgpt'
            WHEN lower(coalesce(name, '')) LIKE 'claude%' OR lower(coalesce(provider, '')) = 'anthropic' THEN 'claude'
            WHEN lower(coalesce(name, '')) LIKE 'gemini%' OR lower(coalesce(provider, '')) = 'google' THEN 'gemini'
            WHEN lower(coalesce(name, '')) LIKE 'sonar%' OR lower(coalesce(name, '')) LIKE 'perplexity%' OR lower(coalesce(provider, '')) = 'perplexity' THEN 'perplexity'
            WHEN lower(coalesce(name, '')) LIKE 'mistral%' OR lower(coalesce(provider, '')) = 'mistral' THEN 'mistral'
            WHEN lower(coalesce(name, '')) LIKE 'deepseek%' OR lower(coalesce(provider, '')) = 'deepseek' THEN 'deepseek'
            WHEN lower(coalesce(name, '')) LIKE 'groq%' OR lower(coalesce(provider, '')) = 'groq' THEN 'groq'
            WHEN lower(coalesce(name, '')) LIKE 'grok%' OR lower(coalesce(provider, '')) = 'grok' THEN 'grok'
            ELSE lower(split_part(coalesce(name, provider, id), '-', 1))
          END
        ),
        provider_model_id = COALESCE(NULLIF(provider_model_id, ''), NULLIF(name, ''), id),
        icon_key = COALESCE(
          NULLIF(icon_key, ''),
          CASE
            WHEN lower(coalesce(provider, '')) IN ('openai', 'anthropic', 'google', 'perplexity', 'mistral', 'deepseek', 'groq', 'grok') THEN lower(provider)
            ELSE lower(split_part(coalesce(name, provider, id), '-', 1))
          END
        )
    $sql$;
  END IF;
END $$;

ALTER TABLE ai_models
ALTER COLUMN display_name SET NOT NULL,
ALTER COLUMN group_name SET NOT NULL,
ALTER COLUMN icon_key SET NOT NULL,
ALTER COLUMN provider_model_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_models_provider_provider_model_id_unique'
  ) THEN
    ALTER TABLE ai_models
    ADD CONSTRAINT ai_models_provider_provider_model_id_unique UNIQUE (provider, provider_model_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_models_display_name_not_blank'
  ) THEN
    ALTER TABLE ai_models
    ADD CONSTRAINT ai_models_display_name_not_blank CHECK (btrim(display_name) <> '');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_models_group_name_not_blank'
  ) THEN
    ALTER TABLE ai_models
    ADD CONSTRAINT ai_models_group_name_not_blank CHECK (btrim(group_name) <> '');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_models_icon_key_not_blank'
  ) THEN
    ALTER TABLE ai_models
    ADD CONSTRAINT ai_models_icon_key_not_blank CHECK (btrim(icon_key) <> '');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_models_provider_model_id_not_blank'
  ) THEN
    ALTER TABLE ai_models
    ADD CONSTRAINT ai_models_provider_model_id_not_blank CHECK (btrim(provider_model_id) <> '');
  END IF;
END $$;

ALTER TABLE ai_models
DROP COLUMN IF EXISTS label,
DROP COLUMN IF EXISTS model_group,
DROP COLUMN IF EXISTS model_id;
