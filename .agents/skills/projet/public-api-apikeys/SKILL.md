---
name: public-api-apikeys
description: Use when designing, implementing, or reviewing the customer-facing public API authenticated with organization API keys, including /v1 route exposure, plan/entitlement checks, API key validation, quotas, rate limits, ID-returning create flows, and exclusions for admin, auth, billing, provider credential, and internal routes.
---

# Public API API Keys

Use this skill when adding or changing the public API for paying users who call the product with an API key.

## Product Intent

Expose a stable, versioned customer API under `/v1`. This product should be API-first: customers must be able to create, retrieve, list, update, and operate their durable resources without relying on a dashboard UI.

Keep the API documented, scoped by organization/project, and safe to call from customer backends.

Authentication:

```http
Authorization: Bearer <api_key>
```

The API key resolves the organization. Do not require cookies, Ory/Kratos sessions, or browser auth on `/v1/*`.

## API Key Configuration To Add

Add gateway config for public API key auth:

- `PUBLIC_API_ENABLED`: optional bool, default false until rollout.
- `PUBLIC_API_RATE_LIMIT_RPM`: per-key request limit.
- `PUBLIC_API_BURST`: per-key burst limit when using token bucket style limits.
- `PUBLIC_API_ALLOWED_PLANS`: comma-separated plan allowlist, for example `developer,growth,pro,agency-enterprise`.
- `PUBLIC_API_KEY_HEADER`: optional override, default `Authorization`.
- `PUBLIC_API_KEY_PREFIX`: generated key prefix, keep compatible with existing organization keys, for example `org_`.
- `PUBLIC_API_DEFAULT_KEY_SCOPES`: comma-separated scopes for new keys, for example `projects:read,analysis:write`.

API key persistence already exists in `organizations-service`:

- `organization_api_keys` table
- `CreateOrganizationAPIKey`
- `ListOrganizationAPIKeys`
- `RevokeOrganizationAPIKey`

Before exposing `/v1/*`, add a validation path that can resolve a raw key to:

- `organization_id`
- `api_key_id`
- `api_key_name`
- active/revoked state
- key prefix for audit logs
- scopes, if scoped keys are implemented

Preferred implementation:

1. Store only hashes, never raw API keys.
2. Validate by hashing the presented key and matching an active non-revoked key.
3. Return no secret material from validation responses.
4. Update `last_used_at` asynchronously or in a cheap best-effort write.
5. Audit denied and allowed requests with `api_key_id`, `organization_id`, route, method, and status.

Because the product is API-first, expose API key management through the public API, but only for keys with a management scope. A regular project/ingestion key must not be able to create more keys unless it explicitly has `api_keys:write`.

API key management routes:

```http
GET    /v1/api-keys
POST   /v1/api-keys
GET    /v1/api-keys/{api_key_id}
PATCH  /v1/api-keys/{api_key_id}
DELETE /v1/api-keys/{api_key_id}
```

`POST /v1/api-keys` returns the raw secret exactly once. List/get responses return metadata only: id, name, prefix, scopes, created_at, last_used_at, revoked_at.

## Gateway Behavior

Add a dedicated public API auth middleware before normal session auth:

1. Match `/v1` and `/v1/*`.
2. Extract bearer token from `Authorization`.
3. Validate API key through organizations-service or a small internal API key validator.
4. Load billing entitlements for the organization.
5. Reject if plan is not allowed or subscription is inactive.
6. Apply per-key rate limits and endpoint-specific quotas.
7. Inject internal auth headers for upstream services:
   - `X-Organization-ID`
   - `X-Public-API-Key-ID`
   - `X-Public-API-Key-Name`
   - no `X-Authenticated-User-ID` unless a service absolutely requires it.
8. Proxy to the existing service route or a purpose-built public handler.

Do not run browser permission checks for `/v1/*`; use organization/project ownership checks and API key scopes instead.

## API-First Retrieval Rules

In an API-first product with no required interface, every durable resource must have both item and collection retrieval.

Every create/start endpoint must return the resource ID in the response body and should also include a `Location` header when a follow-up endpoint exists.

Examples:

```json
{
  "id": "scan_123",
  "status": "queued",
  "url": "/v1/agent-ready/scans/scan_123"
}
```

For async jobs:

- `POST` returns `202 Accepted`, a job ID, status, and follow-up URL.
- `GET /resource/{id}` fetches status/result by ID.
- `GET /resource` lists durable jobs/resources with pagination and filters so clients can recover IDs, reconcile state, and build their own UI.

Only skip collection retrieval for ephemeral operations that are intentionally not persisted.

For AI Agent Ready specifically:

- Keep `POST /v1/agent-ready/scans`.
- Keep `GET /v1/agent-ready/scans/{scan_id}`.
- Add `GET /v1/agent-ready/scans`.
- The `POST` response must include `scan_id`; the collection route exists for history, recovery, and reconciliation.

## Public Routes

Recommended MVP surface:

```http
GET    /v1/me
GET    /v1/usage
GET    /v1/billing/entitlements

GET    /v1/api-keys
POST   /v1/api-keys
GET    /v1/api-keys/{api_key_id}
PATCH  /v1/api-keys/{api_key_id}
DELETE /v1/api-keys/{api_key_id}

GET    /v1/projects
POST   /v1/projects
GET    /v1/projects/{project_id}
PATCH  /v1/projects/{project_id}
DELETE /v1/projects/{project_id}

GET    /v1/projects/{project_id}/models
PATCH  /v1/projects/{project_id}/models

GET    /v1/projects/{project_id}/prompts
POST   /v1/projects/{project_id}/prompts
GET    /v1/prompts/{prompt_id}
PATCH  /v1/prompts/{prompt_id}
DELETE /v1/prompts/{prompt_id}

GET    /v1/projects/{project_id}/competitors
POST   /v1/projects/{project_id}/competitors
GET    /v1/competitors/{competitor_id}
PATCH  /v1/competitors/{competitor_id}
DELETE /v1/competitors/{competitor_id}

POST   /v1/projects/{project_id}/analysis/runs
GET    /v1/projects/{project_id}/analysis/runs
GET    /v1/analysis/runs/{run_id}
GET    /v1/projects/{project_id}/analysis/quota
GET    /v1/projects/{project_id}/analytics/summary

GET    /v1/projects/{project_id}/perception
POST   /v1/projects/{project_id}/perception/runs
GET    /v1/projects/{project_id}/brand-canon
PATCH  /v1/projects/{project_id}/brand-canon
GET    /v1/projects/{project_id}/optimization-errors
GET    /v1/projects/{project_id}/optimize-actions
POST   /v1/projects/{project_id}/optimize-actions
PATCH  /v1/projects/{project_id}/optimize-actions/{action_id}
DELETE /v1/projects/{project_id}/optimize-actions/{action_id}

POST   /v1/projects/{project_id}/content/crawls
GET    /v1/projects/{project_id}/content/crawls
GET    /v1/projects/{project_id}/content/crawls/latest
GET    /v1/projects/{project_id}/content/crawls/{crawl_id}
POST   /v1/projects/{project_id}/content/analyze

POST   /v1/projects/{project_id}/events
GET    /v1/projects/{project_id}/events
GET    /v1/projects/{project_id}/funnel
GET    /v1/projects/{project_id}/traffic
POST   /v1/projects/{project_id}/ingest

POST   /v1/agent-ready/scans
GET    /v1/agent-ready/scans
GET    /v1/agent-ready/scans/{scan_id}
```

Collection routes must support `limit` and `cursor`. Add useful filters per resource:

- scans: `status`, `url`, `created_after`, `created_before`
- runs: `status`, `run_type`, `created_after`, `created_before`
- prompts: `search`, `status`, `kind`
- competitors: `search`, `active`
- crawls: `status`, `url`, `created_after`, `created_before`
- events: `from`, `to`, `source`, `stage`

## Routes To Keep Private

Do not expose these through public API keys:

```http
/auth/*
/users/*
/organizations/*/members
/organizations/*/invitations
/billing/plans
/billing/subscriptions
/billing/stripe/*
/ai-models POST
/ai-models PATCH
/ai-models/sync/*
/projects/*/llm-provider-credentials
/projects/*/impact-integrations/ga4/oauth/*
/internal/*
/notifications/*
/permissions/*
```

Do not expose organization member/invitation management in the first API-first surface unless the product explicitly needs team administration by API. API key management is allowed through `/v1/api-keys` only with explicit management scope.

## Endpoint Mapping Notes

Prefer public route names that are stable and customer-facing, then map internally:

- `/v1/projects/{id}/analysis/runs` -> existing manual analysis route.
- `/v1/projects/{id}/analytics/summary` -> existing analysis dashboard read model.
- `/v1/projects/{id}/content/crawls` -> content optimizer crawl.
- `/v1/agent-ready/scans` -> existing gateway agent-ready scan handlers.
- `/v1/projects/{id}/ingest` -> attribution ingestion.
- `/v1/billing/entitlements` -> billing quota/plan read model.

Hide dashboard-only names and implementation details from public paths.

## Quotas And Plans

Use billing entitlements to gate public API access.

Minimum checks:

- plan is in `PUBLIC_API_ALLOWED_PLANS`
- subscription status is active/trialing or otherwise allowed by product policy
- monthly prompt quota is enforced for analysis/perception/content actions
- crawl limits are enforced separately from cheap read endpoints
- rate limits are per API key, not just per IP

Return structured errors:

```json
{
  "error": {
    "code": "quota_exceeded",
    "message": "Monthly analysis quota exceeded."
  }
}
```

Use consistent status codes:

- `401` missing/invalid API key
- `403` plan not allowed, revoked key, or project not in organization
- `404` resource not found or not owned by organization
- `409` idempotency conflict
- `429` rate limit or quota exceeded
- `5xx` dependency/server errors

## Request Design

For mutating and async endpoints, support idempotency:

```http
Idempotency-Key: customer-generated-key
```

Store idempotency by `api_key_id + method + path + idempotency_key`.

All list routes must support pagination when they can grow:

- `limit`
- `cursor`
- optional filters

Default list ordering should be newest first for jobs/runs/scans/crawls/events and stable name order for catalog-like resources.

Avoid returning secrets, provider API keys, raw credentials, internal tokens, Stripe secrets, or OAuth state.

## Implementation Workflow

1. Add tests for public API key validation and `/v1` routing in api-gateway.
2. Add organization API key validation in organizations-service or a small internal client used by the gateway.
3. Add gateway config/env loading for public API feature flag, allowed plans, and rate limits.
4. Add `/v1` route table with explicit allowlist, not broad proxying.
5. Map each public route to existing upstream handlers or create thin public handlers when response shape must differ.
6. Ensure every `POST` that creates/starts work returns the new ID and follow-up URL.
7. Add quota/rate/audit coverage before enabling in Docker or production config.

## Validation

Gateway route/auth tests:

```bash
env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./services/api-gateway/internal/adapter/http
```

Organizations API key tests:

```bash
env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./services/organizations-service/internal/usecase ./services/organizations-service/internal/adapter/http ./services/organizations-service/internal/adapter/repository/postgres
```

Billing entitlement tests when plan gating changes:

```bash
env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./services/billing-service/internal/usecase ./services/billing-service/internal/adapter/http
```
