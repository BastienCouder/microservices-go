---
name: app-mcp-server
description: Use when designing, implementing, or reviewing a Model Context Protocol server for this microservices-go app. Covers MCP tools/resources/prompts for projects, prompts, competitors, analysis runs, AI Agent Ready scans, content crawls, attribution events, API-key authentication, public API-first routing, safety boundaries, pagination, idempotency, and validation.
---

# App MCP Server

Use this skill when creating or changing an MCP server that lets AI assistants operate this app through the public API.

## Core Principle

Build the MCP server on top of the public API-first surface, not directly against databases or internal microservice routes.

Use the `public-api-apikeys` skill alongside this one when the public API surface, API key auth, plan checks, or `/v1` route mapping is involved.

The MCP server should act like a careful customer backend:

- Authenticate with a customer API key.
- Call `/v1/*` routes only.
- Respect plan entitlements, quotas, rate limits, and idempotency.
- Return concise structured data so agents can chain tools reliably.
- Avoid exposing secrets, internal tokens, provider credentials, OAuth state, Stripe internals, or browser/session-only operations.

## Recommended Stack

Default to TypeScript with the official MCP SDK unless the repo has a stronger local convention.

Preferred transport:

- Streamable HTTP for hosted/remote MCP.
- stdio only for local developer use.

Suggested location:

```text
services/app-mcp-server/
```

Suggested config:

- `APP_API_BASE_URL`: public API gateway base URL.
- `APP_API_KEY`: API key used by the MCP server.
- `MCP_TRANSPORT`: `http` or `stdio`.
- `MCP_HTTP_ADDR`: listen address for hosted MCP.
- `MCP_TOOL_TIMEOUT_MS`: per-tool timeout.
- `MCP_DEFAULT_LIMIT`: default pagination limit.
- `MCP_MAX_LIMIT`: maximum pagination limit.

Never hard-code API keys. Support env vars and secret files if the deployment pattern already uses them.

## Tool Design

Tool names should be action-oriented and prefixed with `app_`.

Use read-only annotations for list/get tools, destructive annotations for deletes, and idempotent annotations for operations where `Idempotency-Key` is used.

Every tool should:

- Validate input with Zod/Pydantic/equivalent.
- Accept `limit` and `cursor` for collection reads.
- Return IDs and follow-up URLs for created jobs/resources.
- Surface actionable errors with the upstream status code and a short remediation hint.
- Avoid huge payloads; return summaries plus IDs, and let agents call detail tools.

## Resource Model

Expose durable app objects as MCP resources where useful:

- `app://projects/{project_id}`
- `app://projects/{project_id}/prompts`
- `app://projects/{project_id}/competitors`
- `app://analysis/runs/{run_id}`
- `app://agent-ready/scans/{scan_id}`
- `app://projects/{project_id}/content/crawls/{crawl_id}`

Resources are for retrieval and context. Mutations must be tools.

## Prompts

Add MCP prompts only when they improve repeatable workflows:

- `app_monitor_brand_visibility`
- `app_audit_agent_readiness`
- `app_analyze_content_opportunities`
- `app_review_traffic_attribution`

Prompts should ask for a `project_id` or enough filters to find one. They should instruct the assistant to list candidates before mutating anything when multiple projects match.

## Tool Surface

Start with this practical set. Prefer complete CRUD/read coverage for durable API-first resources, then add workflow tools.

### Account And Usage

```text
app_get_me
app_get_usage
app_get_billing_entitlements
```

### API Keys

Only expose these tools if the MCP API key has `api_keys:read` or `api_keys:write` scope.

```text
app_list_api_keys
app_create_api_key
app_get_api_key
app_update_api_key
app_revoke_api_key
```

`app_create_api_key` returns the raw secret once. Mark it as sensitive in text output and structured data. Never log it.

### Projects

```text
app_list_projects
app_create_project
app_get_project
app_update_project
app_delete_project
```

For destructive project deletion, require an explicit confirmation field such as `confirm: true`.

### Models

```text
app_list_project_models
app_replace_project_models
```

Do not expose provider credential tools through MCP in the first version.

### Prompts

```text
app_list_project_prompts
app_create_project_prompts
app_get_prompt
app_update_prompt
app_delete_prompt
```

### Competitors

```text
app_list_project_competitors
app_create_project_competitors
app_get_competitor
app_update_competitor
app_delete_competitor
```

### Analysis And Visibility

```text
app_start_analysis_run
app_list_project_analysis_runs
app_get_analysis_run
app_get_project_analysis_quota
app_get_project_analytics_summary
```

`app_start_analysis_run` must use `Idempotency-Key` when provided and return `run_id`, status, and follow-up URL.

### Perception And Optimization

```text
app_get_project_perception
app_start_perception_run
app_get_brand_canon
app_update_brand_canon
app_get_optimization_errors
app_list_optimize_actions
app_create_optimize_action
app_update_optimize_action
app_delete_optimize_action
```

### Content Optimizer

```text
app_start_content_crawl
app_list_content_crawls
app_get_latest_content_crawl
app_get_content_crawl
app_analyze_content_records
```

`app_start_content_crawl` returns `crawl_id`/job ID and follow-up URL. The list tool exists because the product is API-first and clients must be able to recover IDs.

### Attribution

```text
app_create_attribution_event
app_list_attribution_events
app_get_attribution_funnel
app_get_traffic_report
app_ingest_attribution_event
```

Keep event ingestion simple and validate `stage`, `source`, `count`, `revenue_cents`, and `occurred_at`.

### AI Agent Ready

```text
app_start_agent_ready_scan
app_list_agent_ready_scans
app_get_agent_ready_scan
```

`app_start_agent_ready_scan` calls `POST /v1/agent-ready/scans` and returns `scan_id`, `status`, and follow-up URL.

`app_list_agent_ready_scans` is required for API-first recovery/history:

- lost scan ID
- scan history
- polling reconciliation
- filtering by `url`, `status`, `created_after`, `created_before`

## Workflow Tools

After basic tools work, add high-level workflow tools that compose multiple API calls:

```text
app_run_visibility_check
app_audit_site_agent_readiness
app_create_project_with_monitoring_setup
app_get_project_health_snapshot
```

Workflow tools should be thin orchestration layers. They must still return underlying IDs so agents can continue with detail/list tools.

## Safety Boundaries

Do not expose MCP tools for:

- browser auth/session routes
- user profile deletion
- organization members or invitations in v1
- raw billing subscription mutation
- Stripe webhook/admin sync routes
- provider API key or LLM credential management
- GA4 OAuth callback/start flows
- internal routes
- notification sends unless explicitly requested later
- permission-service routes

Destructive tools must include clear confirmation fields.

Tools that create costly jobs must describe quota impact and accept optional idempotency keys.

## Response Shape

Prefer structured responses:

```json
{
  "id": "scan_123",
  "status": "queued",
  "url": "/v1/agent-ready/scans/scan_123",
  "next": {
    "tool": "app_get_agent_ready_scan",
    "arguments": { "scan_id": "scan_123" }
  }
}
```

For lists:

```json
{
  "items": [],
  "next_cursor": null,
  "has_more": false
}
```

Do not return entire histories by default. Use summaries and pagination.

## Implementation Workflow

1. Read the current `public-api-apikeys` skill and confirm the `/v1` route names.
2. Scaffold `services/app-mcp-server` with TypeScript MCP SDK.
3. Implement a shared API client with bearer auth, timeouts, JSON parsing, pagination helpers, and idempotency header support.
4. Implement read-only tools first: me, usage, projects, prompts, competitors, runs, scans.
5. Add mutation tools with confirmation/idempotency where needed.
6. Add resources for project, run, scan, and crawl detail pages.
7. Add workflow tools only after primitives are tested.
8. Add tests for input validation, API client errors, pagination, and dangerous-tool confirmations.
9. Validate with build/typecheck and MCP Inspector.

## Validation

For a TypeScript MCP server:

```bash
cd services/app-mcp-server
npm run build
npx @modelcontextprotocol/inspector
```

If the service uses the repo's Docker setup, add a Dockerfile and compose service after local build passes.

Also run relevant backend tests when public API routes change:

```bash
env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./services/api-gateway/internal/adapter/http ./services/organizations-service/internal/usecase ./services/billing-service/internal/usecase
```
