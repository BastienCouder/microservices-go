CREATE TABLE IF NOT EXISTS analysis_service_meta (
  id SMALLINT PRIMARY KEY,
  seq BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analysis_service_meta_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  request_id TEXT,
  run_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'running',
  prompts_count INTEGER NOT NULL DEFAULT 0,
  models_count INTEGER NOT NULL DEFAULT 0,
  expected_responses INTEGER NOT NULL DEFAULT 0,
  completed_responses INTEGER NOT NULL DEFAULT 0,
  visibility_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analysis_runs_project_request_unique UNIQUE (project_id, request_id)
);

CREATE INDEX IF NOT EXISTS analysis_runs_project_id_idx ON analysis_runs (project_id);
CREATE INDEX IF NOT EXISTS analysis_runs_project_created_idx ON analysis_runs (project_id, created_at);

CREATE TABLE IF NOT EXISTS prompt_runs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  prompt_id TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prompt_runs_unique UNIQUE (run_id, prompt_id)
);

CREATE INDEX IF NOT EXISTS prompt_runs_run_id_idx ON prompt_runs (run_id);

CREATE TABLE IF NOT EXISTS ai_responses (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  prompt_run_id TEXT NOT NULL REFERENCES prompt_runs(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  raw_response TEXT NOT NULL,
  brand_mentioned BOOLEAN NOT NULL DEFAULT FALSE,
  brand_position TEXT NOT NULL DEFAULT 'unknown',
  citation_found BOOLEAN NOT NULL DEFAULT FALSE,
  cited_urls JSONB NOT NULL DEFAULT '[]'::JSONB,
  sentiment TEXT NOT NULL DEFAULT 'neutral',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_responses_unique UNIQUE (prompt_run_id, model_id)
);

CREATE INDEX IF NOT EXISTS ai_responses_run_id_idx ON ai_responses (run_id);
CREATE INDEX IF NOT EXISTS ai_responses_prompt_run_id_idx ON ai_responses (prompt_run_id);

INSERT INTO analysis_service_meta (id, seq, updated_at)
SELECT
  1,
  COALESCE((payload ->> 'seq')::BIGINT, 0),
  COALESCE(updated_at, NOW())
FROM analysis_service_state
WHERE id = 1
ON CONFLICT (id) DO UPDATE
SET seq = EXCLUDED.seq,
    updated_at = EXCLUDED.updated_at;

INSERT INTO analysis_runs (
  id,
  project_id,
  request_id,
  run_type,
  status,
  prompts_count,
  models_count,
  expected_responses,
  completed_responses,
  visibility_score,
  created_at,
  updated_at
)
SELECT
  entry.key,
  entry.value ->> 'projectId',
  request_ref.request_id,
  COALESCE(NULLIF(entry.value ->> 'runType', ''), 'manual'),
  COALESCE(NULLIF(entry.value ->> 'status', ''), 'running'),
  COALESCE((entry.value ->> 'promptsCount')::INTEGER, 0),
  COALESCE((entry.value ->> 'modelsCount')::INTEGER, 0),
  COALESCE((entry.value ->> 'expectedResponses')::INTEGER, 0),
  COALESCE((entry.value ->> 'completedResponses')::INTEGER, 0),
  COALESCE((entry.value ->> 'visibilityScore')::INTEGER, 0),
  COALESCE(NULLIF(entry.value ->> 'createdAt', '')::TIMESTAMPTZ, NOW()),
  COALESCE(NULLIF(entry.value ->> 'updatedAt', '')::TIMESTAMPTZ, NOW())
FROM analysis_service_state state
CROSS JOIN LATERAL jsonb_each(COALESCE(state.payload -> 'runs', '{}'::JSONB)) AS entry(key, value)
LEFT JOIN LATERAL (
  SELECT split_part(request_entry.key, '|', 2) AS request_id
  FROM jsonb_each_text(COALESCE(state.payload -> 'runByRequest', '{}'::JSONB)) AS request_entry(key, value)
  WHERE request_entry.value = entry.key
  LIMIT 1
) AS request_ref ON TRUE
WHERE state.id = 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO prompt_runs (
  id,
  run_id,
  prompt_id,
  prompt_text,
  created_at
)
SELECT
  entry.key,
  entry.value ->> 'runId',
  entry.value ->> 'promptId',
  COALESCE(entry.value ->> 'promptText', ''),
  COALESCE(NULLIF(entry.value ->> 'createdAt', '')::TIMESTAMPTZ, NOW())
FROM analysis_service_state state
CROSS JOIN LATERAL jsonb_each(COALESCE(state.payload -> 'promptRuns', '{}'::JSONB)) AS entry(key, value)
WHERE state.id = 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_responses (
  id,
  run_id,
  prompt_run_id,
  model_id,
  raw_response,
  brand_mentioned,
  brand_position,
  citation_found,
  cited_urls,
  sentiment,
  created_at
)
SELECT
  entry.key,
  entry.value ->> 'runId',
  entry.value ->> 'promptRunId',
  entry.value ->> 'modelId',
  COALESCE(entry.value ->> 'rawResponse', ''),
  COALESCE((entry.value ->> 'brandMentioned')::BOOLEAN, FALSE),
  COALESCE(NULLIF(entry.value ->> 'brandPosition', ''), 'unknown'),
  COALESCE((entry.value ->> 'citationFound')::BOOLEAN, FALSE),
  COALESCE(entry.value -> 'citedUrls', '[]'::JSONB),
  COALESCE(NULLIF(entry.value ->> 'sentiment', ''), 'neutral'),
  COALESCE(NULLIF(entry.value ->> 'createdAt', '')::TIMESTAMPTZ, NOW())
FROM analysis_service_state state
CROSS JOIN LATERAL jsonb_each(COALESCE(state.payload -> 'responses', '{}'::JSONB)) AS entry(key, value)
WHERE state.id = 1
ON CONFLICT (id) DO NOTHING;
