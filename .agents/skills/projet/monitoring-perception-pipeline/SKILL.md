---
name: monitoring-perception-pipeline
description: Use when designing, implementing, or reviewing the separation between prompt monitoring and brand perception. Covers monitoring prompts vs perception prompts, prompt kind/runType design, analysis-service perception aggregation, project-service prompt execution, frontend monitoring/perception data loaders, and refactor planning for generating perception from dedicated brand-understanding questions.
---

# Monitoring Perception Pipeline

Use this skill when work touches how AI prompt analyses feed monitoring metrics and brand perception.

## Mental Model

Keep two product questions separate:

- **Monitoring** answers: "Do AI models mention us, rank us, cite us, and compare us in market-intent prompts?"
- **Perception** answers: "How do AI models understand the brand, category, audience, use cases, differentiation, and trust signals?"

Monitoring data can inform perception, but it should not be the only source for perception. Dedicated perception prompts produce cleaner signals for positioning and brand understanding.

## Prompt Kinds

Use an explicit prompt kind or equivalent persisted field:

- `monitoring`: market, recommendation, comparison, purchasing, visibility, share-of-voice prompts.
- `perception`: brand identity, category, audience, use-case, feature, differentiation, credibility, sentiment prompts.

Do not infer prompt kind only from prompt text. Text heuristics are acceptable for migration/backfill, but new code should persist the kind.

Recommended perception prompt themes:

Use exactly three default perception prompts. They should cover the page's real needs: positioning, audience/use cases, and differentiation/trust.

1. What is `{brand}`, and how would you describe its positioning in `{category}`?
2. Who is `{brand}` for, and what problems or use cases does it solve?
3. How does `{brand}` compare with its competitors, and what are its main strengths, weaknesses, and trust signals?

Run these prompts on every active model enabled for the project.

## Aggregation Rule

Default recommendation:

- Compute monitoring metrics from `monitoring` runs only.
- Compute perception metrics from `perception` runs first.
- Run perception on a weekly cadence, not on every monitoring analysis.
- Skip perception execution when a project already has fresh perception responses from the last 7 days.
- Optionally blend monitoring into perception with a lower weight when a global brand score is needed.

Suggested hybrid weights:

- `70%` dedicated perception responses
- `30%` monitoring responses

Keep the source breakdown visible in metadata so the UI and tests can explain score changes.

## Core Files

Frontend monitoring:

- `apps/app/src/lib/monitoring-data.ts`
- `apps/app/src/features/monitoring/_components/activity/*`
- `apps/app/src/features/prompts/_lib/prompt-data-factory.ts`

Frontend perception:

- `apps/app/src/lib/perception-data.ts`
- `apps/app/src/features/perception/*`

Frontend prompt catalog:

- `apps/app/src/features/prompts/_lib/types.ts`
- `apps/app/src/features/prompts/_lib/prompt-normalizers.ts`
- `apps/app/src/features/prompts/_lib/prompt-api.ts`
- `apps/app/src/features/prompts/_lib/use-prompts-mutations.ts`

Project service:

- `services/project-service/internal/usecase/service_prompts.go`
- `services/project-service/internal/usecase/service_pipeline.go`
- `services/project-service/internal/usecase/types.go`
- `services/project-service/internal/adapter/http/handler.go`
- `services/project-service/schema/prompts.ts`

Analysis service:

- `services/analysis-service/internal/usecase/service_perception.go`
- `services/analysis-service/internal/usecase/service_runs.go`
- `services/analysis-service/internal/usecase/types.go`
- `services/analysis-service/schema/ai-responses.ts`

## Implementation Workflow

1. Add or confirm persisted prompt kind semantics before changing UI behavior.
2. Keep monitoring pages scoped to monitoring prompts and monitoring run types.
3. Add dedicated perception prompt generation and execution without replacing existing monitoring prompts.
4. Update analysis-service perception aggregation to filter or weight responses by source kind.
5. Expose source metadata in perception API responses.
6. Update frontend loaders and UI copy to make monitoring vs perception score sources explicit.
7. Add tests at the boundary where kind is normalized, run, stored, and aggregated.

## Refactor Plan

For the detailed implementation plan, read:

- `references/refactor-plan.md`

Load that reference when asked to implement, estimate, sequence, or review this refactor.

## Validation

Use the narrowest useful checks for the touched layer.

Frontend:

```bash
docker run --rm -v /home/bastiencdr/dev/microservices-go/apps/app:/app -w /app oven/bun:alpine bun test src/lib/monitoring-data.test.ts src/lib/perception-data.test.ts
docker run --rm -v /home/bastiencdr/dev/microservices-go/apps/app:/app -w /app oven/bun:alpine bun x tsc --noEmit
```

Project service:

```bash
env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./services/project-service/internal/usecase ./services/project-service/internal/adapter/http
```

Analysis service:

```bash
env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./services/analysis-service/internal/usecase ./services/analysis-service/internal/adapter/http
```
