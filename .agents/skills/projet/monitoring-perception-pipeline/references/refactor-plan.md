# Monitoring / Perception Refactor Plan

## Goal

Separate prompt monitoring from brand perception while keeping a bridge between them.

Monitoring should measure visibility in market-intent answers. Perception should measure brand understanding from dedicated perception questions, with optional lower-weight monitoring signals.

## Current State

- `project-service` runs prompts through `RunManualAnalysis` and `runAnalysis`.
- `analysis-service` records `AIResponse.RawResponse` and derives perception metrics in `service_perception.go`.
- The frontend monitoring page loads `recent_prompts` from `apps/app/src/lib/monitoring-data.ts`.
- The frontend perception page loads derived perception data from `apps/app/src/lib/perception-data.ts`.
- Prompt records currently expose `intent`, model coverage, schedule, status, and active state, but no explicit durable `kind` for monitoring vs perception.

## Target Data Model

Add an explicit prompt kind.

Suggested values:

```text
monitoring
perception
```

Preferred field name:

```text
kind
```

Fallback if preserving existing semantics is easier:

```text
intent
```

Recommendation: use `kind` for the product mode and keep `intent` for funnel/search intent such as awareness, consideration, decision, organic, commercial, branded.

## Phase 1: Persist Prompt Kind

Backend:

- Add `kind` to prompt domain type and schema.
- Default existing prompts to `monitoring`.
- Accept `kind` in create/update prompt requests.
- Return `kind` in list prompt payloads.

Likely files:

- `services/project-service/schema/prompts.ts`
- `services/project-service/internal/usecase/types.go`
- `services/project-service/internal/usecase/service_prompts.go`
- `services/project-service/internal/adapter/http/handler.go`

Frontend:

- Add `kind` to `ProjectPromptRecord`, `PromptItem`, and normalizers.
- Keep existing UI unchanged unless the page is explicitly managing perception prompts.

Likely files:

- `apps/app/src/features/prompts/_lib/types.ts`
- `apps/app/src/features/prompts/_lib/prompt-normalizers.ts`
- `apps/app/src/features/prompts/_lib/prompt-api.ts`
- `apps/app/src/features/prompts/_lib/prompt-data-factory.ts`

Tests:

- Prompt create/list/update preserves kind.
- Missing kind normalizes to `monitoring`.

## Phase 2: Seed Perception Prompts

Create a dedicated perception prompt generator for each project.

Base prompt set.

Use exactly 3 prompts by default:

1. What is `{brand}`, and how would you describe its positioning in `{category}`?
2. Who is `{brand}` for, and what problems or use cases does it solve?
3. How does `{brand}` compare with its competitors, and what are its main strengths, weaknesses, and trust signals?

Rules:

- Keep prompts short, model-neutral, and stable over time.
- Store generated prompts with `kind=perception`.
- Do not show perception prompts in the default monitoring prompt catalog unless a filter/tab is added.
- Do not generate one prompt per competitor by default; the third prompt can include known competitors in context at execution time.

Likely files:

- `services/project-service/internal/usecase/service_prompts.go`
- `services/project-service/internal/usecase/service_projects.go`
- `apps/app/src/features/prompts/_lib/prompt-seed-factory.ts`

Tests:

- Project finalization creates monitoring prompts and perception prompts separately.
- Competitor prompt generation is deterministic.

## Phase 3: Run Perception Analyses

Add a way to trigger perception runs.

Options:

- Reuse `RunManualAnalysis` with `RunType="perception"` and prompt kind filtering.
- Add a dedicated usecase method such as `RunPerceptionAnalysis`.

Recommendation: start with `RunType="perception"` and explicit prompt kind filtering; add a named method only if callers multiply.

Execution rules:

- Only `kind=perception` prompts should feed perception runs.
- Perception runs should use every active model enabled for the project.
- Perception should run at most once every 7 days per project unless manually forced.
- Persist `runType` so analysis-service can distinguish sources later.
- Use a weekly schedule/cadence separate from monitoring prompt cadence.

Likely files:

- `services/project-service/internal/usecase/service_pipeline.go`
- `services/project-service/internal/usecase/types.go`
- `services/project-service/internal/adapter/http/handler.go`
- `services/analysis-service/internal/usecase/service_runs.go`

Tests:

- Running perception analysis rejects monitoring-only prompt IDs.
- Running perception analysis resolves all active project model IDs.
- Fresh perception responses skip automatic weekly execution.
- Manual force can bypass freshness if a force option is added.
- Run type is persisted and returned with analysis runs or response metadata.

## Phase 4: Aggregate Perception By Source

Update perception scoring to prefer dedicated perception responses.

Recommended behavior:

- If perception responses exist, compute primary perception from them.
- If no perception responses exist, fall back to current behavior for backward compatibility.
- If hybrid scoring is enabled, blend perception and monitoring response metrics with `70/30`.

Metadata to expose:

```json
{
  "perceptionResponses": 24,
  "monitoringResponsesUsed": 8,
  "perceptionWeight": 0.7,
  "monitoringWeight": 0.3,
  "sourceMode": "perception_primary"
}
```

Likely files:

- `services/analysis-service/internal/usecase/service_perception.go`
- `services/analysis-service/internal/usecase/types.go`
- `apps/app/src/lib/perception-data.ts`

Tests:

- Perception responses are selected before monitoring responses.
- Hybrid weighting is deterministic.
- Backward compatibility works when all historical responses lack kind/run type.

## Phase 5: Frontend UX

Monitoring:

- Keep monitoring activity cards showing the prompt question.
- Keep rich response formatting only in detail views.
- Filter monitoring lists to `kind=monitoring` if the backend starts returning perception prompts in the same endpoint.

Perception:

- Show metadata about source counts and last perception analysis.
- Add a CTA to run perception analysis if no perception responses exist.
- Show the next weekly refresh state if scheduling metadata is available.
- Keep perception scores visually separate from monitoring SOV/mention metrics.

Likely files:

- `apps/app/src/lib/monitoring-data.ts`
- `apps/app/src/lib/perception-data.ts`
- `apps/app/src/features/monitoring/_components/activity/*`
- `apps/app/src/features/perception/*`

Tests:

- Monitoring data loader ignores perception prompts for recent monitoring stream.
- Perception loader parses source metadata.

## Phase 6: Migration And Backfill

Migration:

- Existing prompts default to `kind=monitoring`.
- Generated perception prompts should be idempotent by project and prompt template key.
- Existing AI responses without run type remain eligible as fallback only.

Backfill:

- Do not rewrite historical monitoring responses as perception responses.
- Optionally enqueue one perception run per active project after migration, then rely on weekly refresh.

## Rollout Order

1. Persist and expose prompt kind with default `monitoring`.
2. Add frontend normalization for kind without visible UX changes.
3. Add perception prompt generator and tests.
4. Add perception run path.
5. Add weekly freshness guard and all-active-model resolution.
6. Update perception aggregation with source filtering/fallback.
7. Update perception UI metadata.
8. Add a project-level action to run perception analysis.
9. Backfill active projects.

## Open Decisions

- Should perception prompts be visible in the existing Prompts page, hidden, or shown under a new tab?
- Should perception runs count against the same billing quota as monitoring prompt runs?
- Should hybrid weighting be always on or configurable per project?
