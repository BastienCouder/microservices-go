ALTER TABLE ai_models
ADD COLUMN IF NOT EXISTS group_name TEXT;

UPDATE ai_models
SET group_name = CASE
  WHEN lower(coalesce(group_name, '')) <> '' THEN group_name
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
WHERE coalesce(group_name, '') = '';
