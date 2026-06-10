---
name: provider-models
description: Use when working on the Models feature: LLM model catalog, project model selection, provider labels/icons, provider API keys, Developer plan eligibility, Admin Models, onboarding model selection, or downstream Monitoring/Perception/Prompts behavior that depends on project models.
---

# Provider Models

Use this skill for changes that touch the LLM model catalog or the project-level model selection flow.

## Mental Model

There are three related layers:

- **Global catalog**: all known AI models and whether they are active.
- **Project selection**: active catalog models enabled for one project.
- **Provider credentials**: project-scoped API keys that make Developer plan models runnable.

Monitoring, Perception, Pages, and Prompts read project models indirectly. When model selection changes, invalidate their query caches too.

## Core Files

Frontend:

- `apps/app/src/features/models/view/client.tsx` - Models page selection UI and project model save flow.
- `apps/app/src/features/models/_lib/catalog-client.ts` - catalog normalization, provider normalization, labels, sorting, API calls, credential requirements.
- `apps/app/src/features/models/_lib/model-access.ts` - shared model types and organization helpers.
- `apps/app/src/features/models/_hooks/use-project-model-selection.ts` - local/server project model selection reconciliation.
- `apps/app/src/features/models/_hooks/use-provider-credential-mutations.ts` - provider key save/delete mutations and cache updates.
- `apps/app/src/features/models/_components/provider-api-keys-panel.tsx` - reusable provider API key form.
- `apps/app/src/features/admin-models/view/template.tsx` - admin catalog activation and OpenRouter sync UI.
- `apps/app/src/features/onboarding/step-models.tsx` - onboarding model selection and provider key UX.
- `apps/app/src/lib/project-models.ts` - shared model payload normalization for Monitoring, Perception, Pages, and Prompts.
- `apps/app/src/lib/query-keys.ts` - React Query keys for model-dependent caches.
- `apps/app/src/lib/monitoring-data.ts` and `apps/app/src/lib/perception-data.ts` - consumers of project model payloads.
- `apps/app/src/public/models/*.svg` - provider/model icons.
- `apps/app/src/public/locales/*/translations.json` - onboarding and shared copy.

Backend:

- `services/project-service/internal/usecase/service_models.go` - catalog, project selection, OpenRouter sync, plan limits.
- `services/project-service/internal/usecase/service_provider_credentials.go` - provider credential status, save/delete, credential resolution.
- `services/project-service/internal/usecase/types.go` - AI model and credential types.
- `services/project-service/internal/adapter/http/handler.go` - HTTP routes for models and provider credentials.
- `services/project-service/internal/adapter/state/postgres/state_store.go` - persistence for models, project selections, credentials.
- `services/project-service/internal/adapter/state/postgres/migrations/sql/*project_llm_provider_credentials*.sql` - credential persistence migrations.
- `services/project-service/internal/adapter/client/ia/client.go` - model data sent to IA service.
- `services/ia-service/internal/adapter/provider/*` - provider-specific execution behavior.

## Working Rules

1. Treat `catalog-client.ts` and `project-models.ts` as paired source-of-truth files: frontend Models UI uses the former, downstream app data uses the latter.
2. Keep `normalizeProviderId`, `buildProviderLabel`, provider icon maps, provider ordering, and tests aligned.
3. Preserve tolerant payload parsing: accept enveloped and plain backend payloads, plus Go-style and JS-style field names.
4. Project model selection must only save active catalog models and must respect billing selection limits.
5. Developer plan eligibility depends on provider credentials or OpenRouter coverage; update `getProviderKeyRequirements` and `isProviderUsableWithCredentials` together.
6. When provider key UX changes, check both Models page and Onboarding because they share `ProviderApiKeysPanel`.
7. After saving project models, invalidate `projectModels`, `monitoring`, `perception`, and project `prompts` query caches.
8. After catalog activation or OpenRouter sync, invalidate both active and all catalog queries.
9. Do not rename provider IDs casually; provider IDs are persistence keys. Prefer changing display labels unless a migration is intended.
10. If backend model or credential payloads change, update frontend normalization and tests in the same patch.

## Common Tasks

### Add or rename a provider label

- Update aliases in `normalizeProviderId` when incoming provider strings vary.
- Update display output in `buildProviderLabel` in both `catalog-client.ts` and `project-models.ts` when downstream UI also shows the provider.
- Update `PROVIDER_ICON_PATHS` in `ProviderApiKeysPanel` when credentials can be configured for the provider.
- Add or update icon assets in `apps/app/src/public/models`.
- Update `catalog-client.test.ts`.

### Change model selection behavior

- Start in `ModelsClient` and `useProjectModelSelection`.
- Check Developer plan branches: usable model filtering, provider credential readiness, and missing key messaging.
- Keep saved model IDs as backend model IDs, not display labels.
- Invalidate model-dependent pages after save: Monitoring, Perception, Pages, Prompts.

### Change provider API key behavior

- Start in `use-provider-credential-mutations.ts` and `ProviderApiKeysPanel`.
- Keep credentials project-scoped.
- Save/delete should update local query data, invalidate the credential query, clear drafts, and close/reset panel state when relevant.
- Backend persistence changes must cover handler, usecase, store, migration, and tests.

### Change admin catalog behavior

- Start in `admin-models/view/template.tsx` and `service_models.go`.
- Active/inactive changes affect project selection and downstream model lists.
- OpenRouter sync filters live in `service_models.go`; frontend sync options live in Admin Models.
- After changing active state, verify inactive models cannot be newly selected for projects.

### Change downstream model display

- Start in `project-models.ts`.
- Then check `monitoring-data.ts`, `perception-data.ts`, `use-prompts-source-data.ts`, and Monitoring filter helpers.
- Keep `id`, `providerModelId`, `displayName`, and `groupName` lookup behavior compatible because prompts/responses may reference any of them.

## Validation

Use the smallest useful set:

- Frontend typecheck: `docker run --rm -v /home/bastiencdr/dev/microservices-go/apps/app:/app -w /app oven/bun:alpine bun x tsc --noEmit`
- Frontend model tests: `docker run --rm -v /home/bastiencdr/dev/microservices-go/apps/app:/app -w /app oven/bun:alpine bun test src/features/models/_lib/catalog-client.test.ts`
- Downstream model tests when touching `project-models.ts`, Monitoring, or Perception: `bun test src/lib/monitoring-data.test.ts src/lib/perception-data.test.ts`
- Backend usecase tests: `env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./services/project-service/internal/usecase`
- Backend HTTP/store tests when routes or persistence change: `go test ./services/project-service/internal/adapter/...`

Prefer targeted tests first, then broaden if a shared normalizer, backend contract, or cache behavior changed.
