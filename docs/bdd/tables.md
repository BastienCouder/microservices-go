# Tables de base de donnees

Document d'ownership cible des tables PostgreSQL par service backend.
La colonne `Contraintes / defaut` reprend les informations utiles au niveau colonne; les index, contraintes composees et politiques applicatives ne sont pas exhaustifs.

## Vue d ensemble

| Service | Tables |
| --- | --- |
| `analysis-service` | `analysis_runs`, `prompt_runs`, `ai_responses`, `crawler_runs`, `crawler_pages`, `optimize_actions` |
| `api-gateway` | Aucune table PostgreSQL propre detectee |
| `attribution-service` | Aucune table PostgreSQL propre detectee |
| `auth-service` | Aucune table PostgreSQL propre detectee |
| `billing-service` | `billing_subscriptions`, `billing_stripe_webhook_events`, `billing_plan_settings`, `billing_pricing_tiers`, `billing_credit_cost_settings` |
| `ia-service` | `ai_models` |
| `langgraph-scheduler` | Aucune table PostgreSQL propre detectee |
| `notification-service` | `notifications` |
| `organizations-service` | `organizations`, `organization_members`, `member_roles`, `organization_invitations`, `organization_api_keys`, `project_members` |
| `permission-service` | `permission_role_policies` |
| `project-service` | `projects`, `prompts`, `competitors`, `brand_canon`, `project_models`, `outbox_events`, `prompt_models`, `project_impact_integrations`, `project_model_selection_changes` |
| `user-service` | `users`, `user_consent` |

## analysis-service

### `analysis_runs`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `TEXT` | PRIMARY KEY |
| `project_id` | `TEXT` | NOT NULL |
| `request_id` | `TEXT` | - |
| `run_type` | `TEXT` | NOT NULL DEFAULT 'manual' |
| `status` | `TEXT` | NOT NULL DEFAULT 'running' |
| `prompts_count` | `INTEGER` | NOT NULL DEFAULT 0 |
| `models_count` | `INTEGER` | NOT NULL DEFAULT 0 |
| `expected_responses` | `INTEGER` | NOT NULL DEFAULT 0 |
| `completed_responses` | `INTEGER` | NOT NULL DEFAULT 0 |
| `visibility_score` | `INTEGER` | NOT NULL DEFAULT 0 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `organization_id` | `BIGINT` | NOT NULL DEFAULT 0 |
| `created_by` | `BIGINT` | NOT NULL DEFAULT 0 |
| `credits_count` | `INTEGER` | NOT NULL DEFAULT 0 |

### `prompt_runs`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `TEXT` | PRIMARY KEY |
| `run_id` | `TEXT` | NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE |
| `prompt_id` | `TEXT` | NOT NULL |
| `prompt_text` | `TEXT` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |

### `ai_responses`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `TEXT` | PRIMARY KEY |
| `run_id` | `TEXT` | NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE |
| `prompt_run_id` | `TEXT` | NOT NULL REFERENCES prompt_runs(id) ON DELETE CASCADE |
| `model_id` | `TEXT` | NOT NULL |
| `raw_response` | `TEXT` | NOT NULL |
| `brand_mentioned` | `BOOLEAN` | NOT NULL DEFAULT FALSE |
| `brand_position` | `TEXT` | NOT NULL DEFAULT 'unknown' |
| `citation_found` | `BOOLEAN` | NOT NULL DEFAULT FALSE |
| `cited_urls` | `JSONB` | NOT NULL DEFAULT '[]'::JSONB |
| `sentiment` | `TEXT` | NOT NULL DEFAULT 'neutral' |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |

### `crawler_runs` et `crawler_pages`

Les runs de découverte et de crawl Markdown sont stockés dans `crawler_runs`.
Les résultats progressifs de chaque URL sont stockés dans `crawler_pages` et supprimés en cascade avec leur run.

### `optimize_actions`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `TEXT` | PRIMARY KEY |
| `project_id` | `TEXT` | NOT NULL |
| `priority` | `TEXT` | NOT NULL DEFAULT 'medium' |
| `type` | `TEXT` | NOT NULL |
| `title` | `TEXT` | NOT NULL |
| `issue` | `TEXT` | NOT NULL |
| `impact` | `TEXT` | - |
| `generated_content` | `TEXT` | NOT NULL |
| `status` | `TEXT` | NOT NULL DEFAULT 'draft' |
| `source_error_id` | `TEXT` | - |
| `metadata` | `JSONB` | NOT NULL DEFAULT '{}'::jsonb |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |

## api-gateway

Aucune table PostgreSQL propre detectee dans les migrations du service.

## attribution-service

Aucune table PostgreSQL propre detectee. Le service lit les integrations projet et calcule les rapports traffic via providers externes.

## auth-service

Aucune table PostgreSQL propre detectee dans les migrations du service.

## billing-service

### `billing_subscriptions`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `organization_id` | `BIGINT` | PRIMARY KEY |
| `plan` | `TEXT` | NOT NULL |
| `seats` | `INTEGER` | NOT NULL |
| `monthly_quota` | `INTEGER` | NOT NULL |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL |
| `stripe_customer_id` | `TEXT` | NOT NULL DEFAULT '' |
| `stripe_subscription_id` | `TEXT` | NOT NULL DEFAULT '' |
| `stripe_price_id` | `TEXT` | NOT NULL DEFAULT '' |
| `billing_cycle` | `TEXT` | NOT NULL DEFAULT 'monthly' |
| `status` | `TEXT` | NOT NULL DEFAULT 'active' |
| `cancel_at_period_end` | `BOOLEAN` | NOT NULL DEFAULT FALSE |
| `current_period_end` | `TIMESTAMPTZ` | - |
| `correction_credits` | `INTEGER` | NOT NULL DEFAULT 0 |

### `billing_stripe_webhook_events`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `event_id` | `TEXT` | PRIMARY KEY |
| `event_type` | `TEXT` | NOT NULL |
| `processed_at` | `TIMESTAMPTZ` | NOT NULL |

### `billing_plan_settings`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `plan` | `TEXT` | PRIMARY KEY |
| `monthly_price_cents` | `INTEGER` | NOT NULL |
| `yearly_price_cents` | `INTEGER` | NOT NULL |
| `monthly_quota` | `INTEGER` | NOT NULL |
| `model_selection_limit` | `INTEGER` | NOT NULL |
| `monthly_model_change_limit` | `INTEGER` | NOT NULL |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL |
| `max_projects` | `INTEGER` | NOT NULL DEFAULT 0 |
| `is_most_chosen` | `BOOLEAN` | NOT NULL DEFAULT FALSE |
| `allow_ai_briefs` | `BOOLEAN` | NOT NULL DEFAULT FALSE |

### `billing_pricing_tiers`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `prompt_volume` | `INTEGER` | PRIMARY KEY |
| `label` | `TEXT` | NOT NULL |
| `developer_price_cents` | `INTEGER` | - |
| `starter_price_cents` | `INTEGER` | - |
| `growth_price_cents` | `INTEGER` | - |
| `pro_price_cents` | `INTEGER` | - |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL |
| `prices_json` | `JSONB` | NOT NULL DEFAULT '{}'::jsonb |
| `deleted` | `BOOLEAN` | NOT NULL DEFAULT FALSE |

### `billing_credit_cost_settings`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `singleton` | `BOOLEAN` | PRIMARY KEY DEFAULT TRUE |
| `default_credit_cost` | `INTEGER` | NOT NULL |
| `rules_json` | `JSONB` | NOT NULL DEFAULT '[]'::jsonb |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |

## ia-service

### `ai_models`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `TEXT` | PRIMARY KEY |
| `provider` | `TEXT` | NOT NULL |
| `display_name` | `TEXT` | NOT NULL |
| `group_name` | `TEXT` | NOT NULL |
| `icon_key` | `TEXT` | NOT NULL |
| `provider_model_id` | `TEXT` | NOT NULL |
| `is_active` | `BOOLEAN` | NOT NULL DEFAULT TRUE |
| `supports_live_search` | `BOOLEAN` | NOT NULL DEFAULT FALSE |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `credit_cost` | `INTEGER` | NOT NULL DEFAULT 1 |
| `input_price_per_million` | `DOUBLE PRECISION` | - |
| `output_price_per_million` | `DOUBLE PRECISION` | - |
| `openrouter_pricing` | `JSONB` | - |

## langgraph-scheduler

Aucune table PostgreSQL propre detectee dans les migrations du service.

## notification-service

### `notifications`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `BIGSERIAL` | PRIMARY KEY |
| `channel` | `TEXT` | NOT NULL |
| `recipient` | `TEXT` | NOT NULL |
| `subject` | `TEXT` | - |
| `message` | `TEXT` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL |

## organizations-service

### `organizations`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `BIGSERIAL` | PRIMARY KEY |
| `name` | `TEXT` | NOT NULL |
| `owner_user_id` | `BIGINT` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL |
| `deleted_at` | `TIMESTAMPTZ` | - |

### `user_consent`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `UUID` | PRIMARY KEY DEFAULT gen_random_uuid() |
| `user_id` | `BIGINT` | NOT NULL REFERENCES users(id) ON DELETE CASCADE |
| `type` | `TEXT` | NOT NULL |
| `version` | `TEXT` | NOT NULL DEFAULT 'v1' |
| `accepted_at` | `TIMESTAMPTZ` | NOT NULL |

Une seule acceptation est conservée par utilisateur, type et version. Le consentement `privacy_policy/v1` est obligatoire à la création du profil et contrôlé à chaque login.

### `organization_members`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `organization_id` | `BIGINT` | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE |
| `user_id` | `BIGINT` | NOT NULL |
| `added_at` | `TIMESTAMPTZ` | NOT NULL |
| `deleted_at` | `TIMESTAMPTZ` | - |

### `member_roles`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `organization_id` | `BIGINT` | NOT NULL |
| `user_id` | `BIGINT` | NOT NULL |
| `role` | `TEXT` | NOT NULL |

### `organization_invitations`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `BIGSERIAL` | PRIMARY KEY |
| `organization_id` | `BIGINT` | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE |
| `email` | `TEXT` | NOT NULL |
| `role` | `TEXT` | NOT NULL |
| `token` | `TEXT` | NOT NULL UNIQUE |
| `message` | `TEXT` | NOT NULL DEFAULT '' |
| `status` | `TEXT` | NOT NULL CHECK (status IN ('pending', 'accepted', 'refused', 'revoked')) |
| `invited_by_user_id` | `BIGINT` | NOT NULL |
| `accepted_by_user_id` | `BIGINT` | NOT NULL DEFAULT 0 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL |
| `expires_at` | `TIMESTAMPTZ` | - |
| `responded_at` | `TIMESTAMPTZ` | - |
| `deleted_at` | `TIMESTAMPTZ` | - |
| `project_id` | `TEXT` | NOT NULL DEFAULT '' |

### `organization_api_keys`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `BIGSERIAL` | PRIMARY KEY |
| `organization_id` | `BIGINT` | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE |
| `name` | `TEXT` | NOT NULL |
| `prefix` | `TEXT` | NOT NULL |
| `key_hash` | `TEXT` | NOT NULL UNIQUE |
| `created_at` | `TIMESTAMPTZ` | NOT NULL |
| `last_used_at` | `TIMESTAMPTZ` | - |
| `revoked_at` | `TIMESTAMPTZ` | - |

### `project_members`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `project_id` | `TEXT` | NOT NULL |
| `organization_id` | `BIGINT` | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE |
| `user_id` | `BIGINT` | NOT NULL |
| `role` | `TEXT` | NOT NULL |
| `added_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |

## permission-service

### `permission_role_policies`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `BIGSERIAL` | PRIMARY KEY |
| `organization_id` | `BIGINT` | NOT NULL |
| `role` | `TEXT` | NOT NULL |
| `action` | `TEXT` | NOT NULL |
| `resource` | `TEXT` | NOT NULL |

## project-service

### `projects`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `TEXT` | PRIMARY KEY |
| `name` | `TEXT` | NOT NULL |
| `domain` | `TEXT` | NOT NULL |
| `website_url` | `TEXT` | NOT NULL |
| `brand_name` | `TEXT` | - |
| `brand_description` | `TEXT` | - |
| `industry` | `TEXT` | - |
| `primary_language` | `TEXT` | NOT NULL DEFAULT 'fr' |
| `country` | `TEXT` | NOT NULL DEFAULT 'FR' |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `organization_id` | `BIGINT` | NOT NULL DEFAULT 0 |
| `created_by` | `BIGINT` | NOT NULL DEFAULT 0 |
| `attribution_source` | `TEXT` | - |

### `prompts`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `TEXT` | PRIMARY KEY |
| `project_id` | `TEXT` | NOT NULL REFERENCES projects(id) ON DELETE CASCADE |
| `text` | `TEXT` | NOT NULL |
| `intent` | `TEXT` | - |
| `language` | `TEXT` | NOT NULL DEFAULT 'fr' |
| `country` | `TEXT` | NOT NULL DEFAULT 'FR' |
| `is_active` | `BOOLEAN` | NOT NULL DEFAULT TRUE |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `status` | `TEXT` | DEFAULT 'active' NOT NULL |
| `schedule_mode` | `TEXT` | DEFAULT 'global' NOT NULL |
| `schedule_cron` | `TEXT` | DEFAULT '0 */6 * * *' NOT NULL |
| `schedule_timezone` | `TEXT` | DEFAULT 'UTC' NOT NULL |
| `kind` | `TEXT` | NOT NULL DEFAULT 'monitoring' |

### `competitors`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `TEXT` | PRIMARY KEY |
| `project_id` | `TEXT` | NOT NULL REFERENCES projects(id) ON DELETE CASCADE |
| `name` | `TEXT` | NOT NULL |
| `domain` | `TEXT` | - |
| `website_url` | `TEXT` | - |
| `is_active` | `BOOLEAN` | NOT NULL DEFAULT TRUE |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |

### `brand_canon`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `project_id` | `TEXT` | PRIMARY KEY |
| `brand_name` | `TEXT` | - |
| `category` | `TEXT` | - |
| `positioning` | `TEXT` | - |
| `audience` | `JSONB` | NOT NULL DEFAULT '[]'::JSONB |
| `use_cases` | `JSONB` | NOT NULL DEFAULT '[]'::JSONB |
| `features` | `JSONB` | NOT NULL DEFAULT '[]'::JSONB |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |

### `project_models`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `project_id` | `TEXT` | NOT NULL REFERENCES projects(id) ON DELETE CASCADE |
| `model_id` | `TEXT` | NOT NULL, reference logique vers ia-service.ai_models(id) |
| `is_enabled` | `BOOLEAN` | NOT NULL DEFAULT TRUE |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |

### `outbox_events`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `TEXT` | PRIMARY KEY |
| `event_type` | `TEXT` | NOT NULL |
| `status` | `TEXT` | NOT NULL |
| `payload` | `JSONB` | NOT NULL |
| `sort_order` | `INTEGER` | NOT NULL DEFAULT 0 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |

### `prompt_models`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `prompt_id` | `TEXT` | NOT NULL REFERENCES prompts(id) ON DELETE CASCADE |
| `model_id` | `TEXT` | NOT NULL, reference logique vers ia-service.ai_models(id) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |

### `project_impact_integrations`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `project_id` | `TEXT` | PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE |
| `ga4_property_id` | `TEXT` | - |
| `ga4_service_account_ciphertext` | `TEXT` | - |
| `ga4_connected_at` | `TIMESTAMPTZ` | - |
| `ga4_updated_at` | `TIMESTAMPTZ` | - |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `ga4_oauth_refresh_token_ciphertext` | `TEXT` | - |

### `project_model_selection_changes`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `project_id` | `TEXT` | PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE |
| `usage_month` | `TEXT` | NOT NULL |
| `change_count` | `INTEGER` | NOT NULL DEFAULT 0 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT NOW() |

## user-service

### `users`

| Colonne | Type | Contraintes / defaut |
| --- | --- | --- |
| `id` | `BIGSERIAL` | PRIMARY KEY |
| `auth_identity_id` | `TEXT` | NOT NULL UNIQUE |
| `email` | `TEXT` | NOT NULL UNIQUE |
| `first_name` | `TEXT` | NOT NULL |
| `last_name` | `TEXT` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL |
| `banned` | `BOOLEAN` | NOT NULL DEFAULT FALSE |
| `banned_at` | `TIMESTAMPTZ` | - |
| `deleted_at` | `TIMESTAMPTZ` | - |
