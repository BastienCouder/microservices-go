CREATE TABLE IF NOT EXISTS project_service_meta (
  id SMALLINT PRIMARY KEY,
  seq BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_service_meta_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  website_url TEXT NOT NULL,
  brand_name TEXT,
  brand_description TEXT,
  industry TEXT,
  primary_language TEXT NOT NULL DEFAULT 'fr',
  country TEXT NOT NULL DEFAULT 'FR',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects (user_id);
CREATE INDEX IF NOT EXISTS projects_domain_idx ON projects (domain);

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  intent TEXT,
  language TEXT NOT NULL DEFAULT 'fr',
  country TEXT NOT NULL DEFAULT 'FR',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prompts_project_id_idx ON prompts (project_id);
CREATE INDEX IF NOT EXISTS prompts_active_idx ON prompts (project_id, is_active);

CREATE TABLE IF NOT EXISTS competitors (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT,
  website_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS competitors_project_id_idx ON competitors (project_id);

CREATE TABLE IF NOT EXISTS ai_models (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  icon_key TEXT NOT NULL,
  provider_model_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  supports_live_search BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_models_provider_name_unique UNIQUE (provider, name),
  CONSTRAINT ai_models_provider_provider_model_id_unique UNIQUE (provider, provider_model_id),
  CONSTRAINT ai_models_display_name_not_blank CHECK (btrim(display_name) <> ''),
  CONSTRAINT ai_models_group_name_not_blank CHECK (btrim(group_name) <> ''),
  CONSTRAINT ai_models_icon_key_not_blank CHECK (btrim(icon_key) <> ''),
  CONSTRAINT ai_models_provider_model_id_not_blank CHECK (btrim(provider_model_id) <> '')
);

CREATE TABLE IF NOT EXISTS project_models (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES ai_models(id) ON DELETE RESTRICT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, model_id)
);

CREATE INDEX IF NOT EXISTS project_models_project_id_idx ON project_models (project_id);

CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS outbox_events_status_sort_idx ON outbox_events (status, sort_order);

INSERT INTO project_service_meta (id, seq, updated_at)
SELECT
  1,
  COALESCE((payload ->> 'seq')::BIGINT, 0),
  COALESCE(updated_at, NOW())
FROM project_service_state
WHERE id = 1
ON CONFLICT (id) DO UPDATE
SET seq = EXCLUDED.seq,
    updated_at = EXCLUDED.updated_at;

INSERT INTO projects (
  id,
  user_id,
  name,
  domain,
  website_url,
  brand_name,
  brand_description,
  industry,
  primary_language,
  country,
  status,
  created_at,
  updated_at
)
SELECT
  entry.key,
  COALESCE(NULLIF(entry.value ->> 'userId', ''), 'legacy'),
  entry.value ->> 'name',
  entry.value ->> 'domain',
  entry.value ->> 'websiteUrl',
  NULLIF(entry.value ->> 'brandName', ''),
  NULLIF(entry.value ->> 'brandDescription', ''),
  NULLIF(entry.value ->> 'industry', ''),
  COALESCE(NULLIF(entry.value ->> 'primaryLanguage', ''), 'fr'),
  COALESCE(NULLIF(entry.value ->> 'country', ''), 'FR'),
  COALESCE(NULLIF(entry.value ->> 'status', ''), 'draft'),
  COALESCE(NULLIF(entry.value ->> 'createdAt', '')::TIMESTAMPTZ, NOW()),
  COALESCE(NULLIF(entry.value ->> 'updatedAt', '')::TIMESTAMPTZ, NOW())
FROM project_service_state state
CROSS JOIN LATERAL jsonb_each(COALESCE(state.payload -> 'projects', '{}'::JSONB)) AS entry(key, value)
WHERE state.id = 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO prompts (
  id,
  project_id,
  text,
  intent,
  language,
  country,
  is_active,
  created_at,
  updated_at
)
SELECT
  entry.key,
  entry.value ->> 'projectId',
  entry.value ->> 'text',
  NULLIF(entry.value ->> 'intent', ''),
  COALESCE(NULLIF(entry.value ->> 'language', ''), 'fr'),
  COALESCE(NULLIF(entry.value ->> 'country', ''), 'FR'),
  COALESCE((entry.value ->> 'isActive')::BOOLEAN, TRUE),
  COALESCE(NULLIF(entry.value ->> 'createdAt', '')::TIMESTAMPTZ, NOW()),
  COALESCE(NULLIF(entry.value ->> 'updatedAt', '')::TIMESTAMPTZ, NOW())
FROM project_service_state state
CROSS JOIN LATERAL jsonb_each(COALESCE(state.payload -> 'prompts', '{}'::JSONB)) AS entry(key, value)
WHERE state.id = 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO competitors (
  id,
  project_id,
  name,
  domain,
  website_url,
  is_active,
  created_at,
  updated_at
)
SELECT
  entry.key,
  entry.value ->> 'projectId',
  entry.value ->> 'name',
  NULLIF(entry.value ->> 'domain', ''),
  NULLIF(entry.value ->> 'websiteUrl', ''),
  COALESCE((entry.value ->> 'isActive')::BOOLEAN, TRUE),
  COALESCE(NULLIF(entry.value ->> 'createdAt', '')::TIMESTAMPTZ, NOW()),
  COALESCE(NULLIF(entry.value ->> 'updatedAt', '')::TIMESTAMPTZ, NOW())
FROM project_service_state state
CROSS JOIN LATERAL jsonb_each(COALESCE(state.payload -> 'competitors', '{}'::JSONB)) AS entry(key, value)
WHERE state.id = 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_models (
  id,
  provider,
  name,
  display_name,
  group_name,
  icon_key,
  provider_model_id,
  is_active,
  supports_live_search,
  created_at,
  updated_at
)
SELECT
  entry.key,
  entry.value ->> 'provider',
  entry.value ->> 'name',
  COALESCE(NULLIF(entry.value ->> 'label', ''), entry.value ->> 'name', entry.key),
  COALESCE(
    NULLIF(entry.value ->> 'group', ''),
    CASE
      WHEN lower(coalesce(entry.value ->> 'name', '')) LIKE 'gpt%' OR lower(coalesce(entry.value ->> 'provider', '')) = 'openai' THEN 'chatgpt'
      WHEN lower(coalesce(entry.value ->> 'name', '')) LIKE 'claude%' OR lower(coalesce(entry.value ->> 'provider', '')) = 'anthropic' THEN 'claude'
      WHEN lower(coalesce(entry.value ->> 'name', '')) LIKE 'gemini%' OR lower(coalesce(entry.value ->> 'provider', '')) = 'google' THEN 'gemini'
      WHEN lower(coalesce(entry.value ->> 'name', '')) LIKE 'sonar%' OR lower(coalesce(entry.value ->> 'provider', '')) = 'perplexity' THEN 'perplexity'
      WHEN lower(coalesce(entry.value ->> 'name', '')) LIKE 'mistral%' OR lower(coalesce(entry.value ->> 'provider', '')) = 'mistral' THEN 'mistral'
      WHEN lower(coalesce(entry.value ->> 'name', '')) LIKE 'deepseek%' OR lower(coalesce(entry.value ->> 'provider', '')) = 'deepseek' THEN 'deepseek'
      WHEN lower(coalesce(entry.value ->> 'name', '')) LIKE 'groq%' OR lower(coalesce(entry.value ->> 'provider', '')) = 'groq' THEN 'groq'
      WHEN lower(coalesce(entry.value ->> 'name', '')) LIKE 'grok%' OR lower(coalesce(entry.value ->> 'provider', '')) = 'grok' THEN 'grok'
      ELSE lower(split_part(coalesce(entry.value ->> 'name', entry.value ->> 'provider', entry.key), '-', 1))
    END
  ),
  COALESCE(NULLIF(entry.value ->> 'iconKey', ''), lower(coalesce(entry.value ->> 'provider', 'unknown'))),
  COALESCE(NULLIF(entry.value ->> 'modelId', ''), entry.value ->> 'name', entry.key),
  COALESCE((entry.value ->> 'isActive')::BOOLEAN, TRUE),
  COALESCE((entry.value ->> 'supportsLiveSearch')::BOOLEAN, FALSE),
  COALESCE(NULLIF(entry.value ->> 'createdAt', '')::TIMESTAMPTZ, NOW()),
  COALESCE(NULLIF(entry.value ->> 'updatedAt', '')::TIMESTAMPTZ, NOW())
FROM project_service_state state
CROSS JOIN LATERAL jsonb_each(COALESCE(state.payload -> 'models', '{}'::JSONB)) AS entry(key, value)
WHERE state.id = 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_models (
  project_id,
  model_id,
  is_enabled,
  created_at,
  updated_at
)
SELECT
  project_entry.key,
  model_entry.key,
  COALESCE(model_entry.value::BOOLEAN, FALSE),
  NOW(),
  NOW()
FROM project_service_state state
CROSS JOIN LATERAL jsonb_each(COALESCE(state.payload -> 'projectModels', '{}'::JSONB)) AS project_entry(key, value)
CROSS JOIN LATERAL jsonb_each_text(COALESCE(project_entry.value, '{}'::JSONB)) AS model_entry(key, value)
WHERE state.id = 1
ON CONFLICT (project_id, model_id) DO NOTHING;

INSERT INTO outbox_events (
  id,
  event_type,
  status,
  payload,
  sort_order,
  created_at,
  updated_at
)
SELECT
  ordered.event_id,
  event_payload ->> 'eventType',
  event_payload ->> 'status',
  COALESCE(event_payload -> 'payload', '{}'::JSONB),
  ordered.ordinality::INTEGER,
  COALESCE(NULLIF(event_payload ->> 'createdAt', '')::TIMESTAMPTZ, NOW()),
  COALESCE(NULLIF(event_payload ->> 'updatedAt', '')::TIMESTAMPTZ, NOW())
FROM project_service_state state
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(state.payload -> 'outboxOrder', '[]'::JSONB)) WITH ORDINALITY AS ordered(event_id, ordinality)
CROSS JOIN LATERAL (SELECT state.payload -> 'outbox' -> ordered.event_id AS event_payload) AS payload_ref
WHERE state.id = 1
  AND payload_ref.event_payload IS NOT NULL
ON CONFLICT (id) DO NOTHING;
