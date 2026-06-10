DROP TABLE IF EXISTS project_llm_provider_credentials;

DROP INDEX IF EXISTS prompt_model_schedules_prompt_id_idx;
DROP TABLE IF EXISTS prompt_model_schedules;

DROP TABLE IF EXISTS project_service_meta;

ALTER TABLE project_model_selection_changes
  DROP CONSTRAINT IF EXISTS project_model_selection_changes_pkey;

ALTER TABLE project_model_selection_changes
  ADD PRIMARY KEY (project_id, usage_month);
