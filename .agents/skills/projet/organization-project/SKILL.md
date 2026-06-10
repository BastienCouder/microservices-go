---
name: organization-project
description: Use when working on the Organization/Project feature: organisation, organization, projet, project, memberships, invitations, organization hierarchy, project CRUD, project settings, active project selection, sidebar organization/project switcher, X-Organization-ID scoping, organizations-service, project-service, or project access across downstream features.
---

# Organization Project

Use this skill for changes that touch organization membership/hierarchy or project ownership/scoping.

## Mental Model

There are two bounded contexts:

- **Organization**: owns memberships, teams, roles, invitations, and the hierarchy endpoint that lists projects for an organization.
- **Project**: owns project details, brand metadata, competitors, prompts, model selection, provider credentials, impact integrations, and downstream analysis scope.

`organizationId` is an `int64` in Go services but usually a `string` in the frontend. `projectId` is a string everywhere. Normalize at boundaries and do not silently mix route/query IDs with persisted local selection.

## Core Files

Frontend:

- `apps/app/src/shared/selection.ts` - selected organization/project query params and localStorage helpers.
- `apps/app/src/shared/models.ts` - frontend organization, invitation, hierarchy, and project summary types.
- `apps/app/src/shared/api/gateway.ts` - `gatewayJSON` and `X-Organization-ID` header injection.
- `apps/app/src/lib/api-config.ts` - public route builders for organizations and projects.
- `apps/app/src/lib/query-keys.ts` - React Query keys scoped by organization/project.
- `apps/app/src/components/sidebar/sidebar.tsx` - loads memberships/hierarchy, resolves active organization/project, stores selection, and builds scoped links.
- `apps/app/src/components/sidebar/sidebar-organization-switcher.tsx` - project picker UI.
- `apps/app/src/components/sidebar/sidebar-state.ts` - hierarchy normalization and preferred ID selection.
- `apps/app/src/app/router.tsx` - add routes here when creating organization/project pages.
- `apps/app/src/features/README.md` - feature folder convention to follow for new pages.

Backend organization:

- `services/organizations-service/internal/domain/organization.go` - organization, team, member, role, invitation domain rules.
- `services/organizations-service/internal/usecase/service.go` - organization/member/team/invitation use cases.
- `services/organizations-service/internal/usecase/types_hierarchy.go` - `ProjectLister` boundary and hierarchy response.
- `services/organizations-service/internal/adapter/http/handler.go` - HTTP routes for organizations, hierarchy, members, invitations.
- `services/organizations-service/db/query/organizations.sql` - sqlc queries.
- `services/organizations-service/internal/adapter/repository/postgres/repository.go` - repository implementation.
- `services/organizations-service/internal/adapter/client/project/client.go` - organization service client for project summaries.
- `services/organizations-service/internal/adapter/repository/postgres/migrations/sql` - organization schema migrations.

Backend project:

- `services/project-service/internal/usecase/types.go` - project and project-scoped DTOs.
- `services/project-service/internal/usecase/service_projects.go` - project CRUD and lifecycle.
- `services/project-service/internal/usecase/service_competitors.go` - project competitors.
- `services/project-service/internal/usecase/service_prompts.go` - project prompts.
- `services/project-service/internal/usecase/service_models.go` - project model selection and catalog.
- `services/project-service/internal/usecase/service_provider_credentials.go` - project-scoped provider keys.
- `services/project-service/internal/usecase/service_impact_integrations.go` - GA4, Stripe, ingestion settings.
- `services/project-service/internal/adapter/http/handler.go` - project HTTP routes.
- `services/project-service/internal/adapter/state/postgres/state_store.go` - project persistence.
- `services/project-service/internal/adapter/state/postgres/migrations/sql` - project schema migrations.
- `contracts/proto/project/v1/project.proto` - gRPC project access and scheduled job contracts.
- `services/project-service/internal/adapter/grpc/server.go` - gRPC implementation.

Cross-service:

- `services/api-gateway/internal/adapter/http/routes.go` - public route proxying.
- `services/api-gateway/internal/adapter/http/user_scope.go` and `permissions.go` - authenticated user/org context.
- `services/analysis-service/internal/adapter/client/project/client.go` - analysis reads project access/data.
- `services/billing-service/internal/adapter/client/project/client.go` - billing/project dependency.

## Working Rules

1. Preserve organization scoping: frontend calls that mutate/read organization-owned project data should pass `organizationId` so `gatewayJSON` sends `X-Organization-ID`.
2. Keep URL query params, localStorage selection, and React Query keys aligned. Relevant params are `org`, `organizationId`, `organization_id`, `projectId`, `project_id`, and `project`.
3. Do not let a stale selected project leak across organizations. When organization changes, reselect from the loaded hierarchy.
4. Treat `/organizations/{id}/hierarchy` as the sidebar source for projects. If project summary fields change, update `ProjectSummary`, the project client, frontend `OrganizationProjectSummary`, and sidebar normalization together.
5. Project endpoints should validate both `projectId` and `organizationId` when the operation is organization-scoped.
6. Keep tolerant frontend parsing for backend payloads where it already exists, but prefer adding typed normalizers close to the feature.
7. When project identity or brand fields change, check Monitoring, Perception, Pages, Prompts, Brands, Models, Analysis, Attribution, and Billing consumers.
8. If project access semantics change, update HTTP handlers, gRPC `CheckProjectAccess`, downstream project clients, and tests in the same patch.
9. For organization roles/invitations, normalize roles and emails through domain helpers. Do not duplicate validation in handlers.
10. For database changes, add forward and rollback migrations, update sqlc queries/generated code where applicable, and cover repository/usecase behavior.

## Common Tasks

### Build or change the organization/projects UI

- Follow `apps/app/src/features/README.md`: `features/<feature>/index.ts`, `view/index.tsx`, optional `view/template.tsx` and `view/client.tsx`.
- Add the route in `apps/app/src/app/router.tsx`; the sidebar already links to `/organizations`.
- Reuse `apiRoutes.organizations`, `apiRoutes.projects`, `gatewayJSON`, `appQueryKeys`, and `shared/selection`.
- Use the hierarchy endpoint for project lists unless the screen explicitly needs a project-service list.
- After create/update/delete, invalidate organization hierarchy, project details, and any affected downstream query keys.

### Change organization hierarchy, members, or invitations

- Start in `organizations-service/internal/domain/organization.go` and `internal/usecase/service.go`.
- Update `db/query/organizations.sql`, repository, and sqlc output when persistence changes.
- For hierarchy project fields, update `types_hierarchy.go`, `adapter/client/project/client.go`, project-service list response, frontend `shared/models.ts`, and sidebar normalization.
- Cover invitation status transitions: pending, accepted, refused, revoked, expired.

### Change project creation or project settings

- Start in `project-service/internal/usecase/types.go` and `service_projects.go`.
- Update handler request parsing, state store, migrations, and tests.
- Mirror new frontend fields in `api-config.ts`, feature normalizers, and shared project summaries when they appear in the sidebar/hierarchy.
- Check onboarding if the field is collected during initial project setup.

### Change selected organization/project behavior

- Start with `shared/selection.ts`, `sidebar.tsx`, `sidebar-state.ts`, and `query-keys.ts`.
- Keep scoped links generated by `buildScopedHref`; avoid manually concatenating query strings.
- Changing a project should preserve the current page and update only the scope params.
- Changing organization should remove or replace invalid project IDs.

### Change cross-service project access

- Start with `contracts/proto/project/v1/project.proto`, `project-service/internal/adapter/grpc/server.go`, and `project-service/internal/usecase/service_projects.go`.
- Then update downstream clients in analysis, billing, organizations, or permission services.
- Regenerate protobuf code if the proto contract changes.

## Validation

Use the smallest useful set first:

- Frontend typecheck: `docker run --rm -v /home/bastiencdr/dev/microservices-go/apps/app:/app -w /app oven/bun:alpine bun x tsc --noEmit`
- Frontend targeted tests: `docker run --rm -v /home/bastiencdr/dev/microservices-go/apps/app:/app -w /app oven/bun:alpine bun test <test-file>`
- Organization service tests: `env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./services/organizations-service/internal/...`
- Project service tests: `env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./services/project-service/internal/...`
- API gateway routing/permission tests: `env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./services/api-gateway/internal/adapter/http`

Broaden validation when a shared contract, migration, gateway route, or project access rule changes.
