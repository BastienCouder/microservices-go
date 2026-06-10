---
name: organization-members-roles
description: Use when working on organization member management, roles, super_admin/owner/admin/member/project_member rules, user table actions, project membership assignment, invitations scoped to projects, permission checks, or bugs around organization/project access in the frontend, api-gateway, organizations-service, permission-service, or project-service.
---

# Organization Members Roles

Use this skill for changes around organization users, roles, actions, project membership, and permission behavior.

## Mental Model

There are two different membership layers:

- **Organization member**: a user belongs to an organization and has organization roles in `organization_members` / `member_roles`.
- **Project member**: a user is assigned to one or more projects in project-service `project_members`.

A user can be an organization member without being assigned to every project. `owner`, `admin`, and `super_admin` are organization-level roles that can manage all projects. `project_member` is an internal organization role for users invited only to a project; do not expose it as a manual role option in the frontend role select.

## Roles

Frontend member role select should use exactly:

- `owner`
- `admin`
- `member`

New organization invitations should use only `admin` and `member`; do not invite `owner`. Do not expose `super_admin` in frontend role selects; keep it recognized as a backend role for existing users and permission checks.

Backend/project invitation may still use:

- `project_member` for project-scoped organization membership
- `viewer` as the project membership role when assigning someone to a project
- `banned` as a backend state/role for banned organization members

Invitation deletion should revoke/disable the invitation through `DELETE /organizations/{orgId}/invitations/{invitationId}` rather than creating a hard-delete UI flow.

Full organization/project management access is granted by `owner`, `admin`, and `super_admin`. Keep that list aligned in organizations-service hierarchy logic and permission-service permission checks.

## Core Files

Frontend organization feature:

- `apps/app/src/features/organizations/view/client.tsx` - user table, current user row, action policy use, dialogs, project editor.
- `apps/app/src/features/organizations/core/organization-page-api.ts` - resources loading, normalizers, project member API calls, debug logs.
- `apps/app/src/features/organizations/core/project-membership.ts` - project name helpers, orphan guards, action policy helpers.
- `apps/app/src/features/organizations/core/project-membership.test.ts` - frontend policy and guard tests.
- `apps/app/src/lib/api-config.ts` - organization/project route builders.
- `apps/app/src/shared/api/gateway.ts` - `X-Organization-ID` and gateway calls.

Backend organization:

- `services/organizations-service/internal/domain/organization.go` - role normalization, member/invitation domain types.
- `services/organizations-service/internal/usecase/service.go` - member roles, hierarchy access, invitation acceptance.
- `services/organizations-service/internal/usecase/service_hierarchy_test.go` - owner/admin/super_admin project visibility tests.
- `services/organizations-service/internal/usecase/service_invitations_test.go` - invitation/project_member behavior.
- `services/organizations-service/internal/adapter/http/handler.go` - organization member/invitation routes.
- `services/organizations-service/internal/adapter/repository/postgres/repository.go` - member and role persistence.

Backend permission/gateway/project:

- `services/permission-service/internal/adapter/repository/postgres/repository.go` - full access role checks and policy lookup.
- `services/permission-service/internal/adapter/repository/postgres/repository_test.go` - `roleGrantsFullAccess` tests.
- `services/api-gateway/internal/adapter/http/permissions.go` - action/resource mapping, e.g. `/members` -> `members`.
- `services/api-gateway/internal/adapter/http/auth_middleware.go` - permission enforcement and organization context.
- `services/project-service/internal/adapter/http/handler.go` - project member routes and project-scope enforcement.
- `services/project-service/internal/adapter/http/handler_test.go` - project members route access tests.
- `services/project-service/internal/usecase/service_project_members.go` - project member assign/list/remove and project-scope guards.

## Action Policy

When editing the organization user table, preserve these rules:

1. `member` and `project_member` viewers see no action controls in the table.
2. `admin` and `super_admin` can act on non-owner users, but cannot perform actions on an `owner`.
3. `owner` sees all actions except removing/deleting users from the organization.
4. Only an `owner` can assign the `owner` role to someone else.
5. Do not allow editing the current user's own role.
6. Do not show project access editing for an `owner`; owner access to projects is implicit.
7. Do not allow editing the current user's project assignments if it would leave them with no project.
8. Do not disable actions just because the target user is owner; instead apply the rules above: admins cannot act on owner, owner can see allowed actions, owner cannot remove users.
9. Highlight the current user row with a distinct background and keep the action state consistent with self-edit guards.

## Project Membership Rules

- The user table should show the names of projects each user belongs to.
- Admin/owner/super_admin project editing must list all organization projects, not just projects assigned to the current user.
- The source for all projects in the organization page is `/organizations/{id}/hierarchy`; if only assigned projects appear, check organizations-service hierarchy access first.
- Loading project members calls `/projects/{projectId}/members`; if 403 occurs, inspect gateway audit logs first. If gateway allows but project-service returns 403, check local project-scope enforcement in project-service.
- When adding/removing project membership, prevent leaving a project with zero users.
- When editing the current user's project assignments, disable any change that would leave the current user with no project.

## Debugging Checklist

For missing projects in the project editor:

1. Check frontend logs from `organization-page-api.ts`: `hierarchy payload` and `resources normalized`.
2. If `raw.projects` is already incomplete, debug `organizations-service` and project-service list APIs, not the table UI.
3. Confirm Docker containers were rebuilt/restarted after backend changes.
4. Check gateway logs for permission decisions: `docker compose logs --tail=120 api-gateway permission-service organizations-service project-service`.
5. Distinguish gateway 403 from upstream 403: gateway audit `permission_check result=allowed` followed by `http_access status=403` means the downstream service denied.

## Implementation Workflow

1. Start with tests for policy/guard behavior before changing implementation.
2. For frontend role/action changes, update `project-membership.ts`, `client.tsx`, and `project-membership.test.ts` together.
3. For role semantics, update organizations-service, permission-service, and tests together.
4. For project visibility, update organizations-service hierarchy and its tests.
5. For project member route authorization, update gateway/resource mapping or project-service scope enforcement depending on where the 403 originates.
6. Keep frontend parsing tolerant, but normalize `email`, roles, project IDs, and user IDs at API boundaries.

## Validation

Use the smallest set that covers the change:

- Frontend project/member policy tests: `docker run --rm -v /home/bastiencdr/dev/microservices-go/apps/app:/app -w /app oven/bun:alpine bun test src/features/organizations/core/project-membership.test.ts`
- Frontend typecheck: `docker run --rm -v /home/bastiencdr/dev/microservices-go/apps/app:/app -w /app oven/bun:alpine bun x tsc --noEmit`
- Organization + permission tests: `env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./services/organizations-service/internal/usecase ./services/permission-service/internal/adapter/repository/postgres`
- Project member route tests: `env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./services/project-service/internal/adapter/http ./services/project-service/internal/usecase`
- Gateway permission tests: `env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./services/api-gateway/internal/adapter/http`

After backend changes used by local Docker, rebuild/restart only impacted services, for example:

- `docker compose build organizations-service permission-service project-service`
- `docker compose up -d organizations-service permission-service project-service`
