---
name: perception-brand-alignment
description: Use when implementing, reviewing, or debugging AI Perception scoring that should compare AI responses against the project's Brand Canon / Brand Profile. Covers readiness, missing context, axis alignment, competitor handling, backend aggregation, frontend perception displays, and tests preventing visibility metrics from inflating perception scores.
---

# Perception Brand Alignment

AI Perception must measure brand-canon alignment, not monitoring visibility.

## Product Rule

- Monitoring answers: "Are we mentioned, ranked, cited, and compared?"
- Perception answers: "Do AI responses describe the brand the same way the Brand Profile defines it?"

Do not let `brandPosition == top`, `brandMentioned == true`, or citations alone produce excellent perception scores.

## Scoring Rules

Before scoring, evaluate Brand Canon readiness from:

- brand name
- category
- positioning / description
- audience
- use cases
- features / strengths
- competitors

When context is missing:

- Missing use cases must not score as aligned use cases.
- Missing features must not score as aligned features.
- Missing competitors must be `not_configured` / low signal, not `100`.
- Missing category and positioning must cap positioning alignment.

Prefer exposing missing-context metadata so the UI can explain why scores are capped or unavailable.

## Axis Semantics

- `positioning`: compare AI category and positioning claims against Brand Canon category/positioning.
- `use_cases`: compare AI-stated use cases against configured Brand Canon use cases.
- `features`: compare AI-stated strengths/features against configured Brand Canon features.
- `competitors`: compare AI-stated competitive framing against configured project competitors.
- `sentiment`: measure tone separately; do not use it to compensate for missing factual alignment.

## Core Files

- Backend scoring: `services/analysis-service/internal/usecase/service_perception.go`
- Backend aggregation metadata: `services/analysis-service/internal/usecase/service_runs.go`
- Backend tests: `services/analysis-service/internal/usecase/service_perception_test.go`, `services/analysis-service/internal/usecase/service_test.go`
- Frontend data derivation: `apps/app/src/features/perception/_lib/shared/perception-data-analytics.ts`
- Frontend merge/API types: `apps/app/src/features/perception/_lib/shared/perception-data-api.ts`, `apps/app/src/features/perception/_lib/shared/perception-data-types.ts`
- Frontend score UI: `apps/app/src/features/perception/_components/*`

## Validation Cases

Always cover these cases when changing scoring:

- Empty or nearly empty Brand Canon with perception responses must not produce an excellent overall score.
- `brandPosition == top` with missing category/positioning must not produce `100` positioning.
- No configured competitors must not produce `100` competitors.
- Filled Brand Canon with matching AI response should score high.
- Filled Brand Canon with mismatching AI response should score low.

Run the narrowest useful checks:

```bash
env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./services/analysis-service/internal/usecase
docker run --rm -v /home/bastiencdr/dev/microservices-go:/workspace -w /workspace/apps/app oven/bun:1.2.22 sh -lc "bun test src/features/perception/_lib/shared/perception-data-api.test.ts"
```
