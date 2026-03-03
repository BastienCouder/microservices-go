# Security Best Practices Report

Date: 2026-03-03  
Scope: Go services in `/var/www/microservices-go/services` + API gateway, contracts, and deployment manifests.

## Executive Summary

The most important risk is an authorization gap in user read endpoints that can expose other users' data to any authenticated account.  
There are also several transport and secret-management weaknesses (plaintext internal gRPC, shared/default secrets, default broker credentials) that increase blast radius in case of internal network access.  
gRPC `Deprecated` comments found in generated files are expected generator output and are not contract deprecations.

## Critical Findings

### SEC-001 - Broken Object-Level Authorization on user read endpoints
- Severity: Critical
- Impact: Any authenticated user can query other users' records (including email/profile fields), enabling horizontal privilege escalation and data leakage.
- Evidence:
  - API gateway exposes `/users` via authenticated middleware but no permission check path rule for `/users`:
    - `services/api-gateway/internal/adapter/http/routes.go:31`
    - `services/api-gateway/internal/adapter/http/permissions.go:64`
  - User service returns user by arbitrary ID without ownership/admin guard:
    - `services/user-service/internal/adapter/http/handler.go:105`
  - User domain includes sensitive profile fields returned by this endpoint:
    - `services/user-service/internal/domain/user.go:18`
- Recommendation:
  - Enforce ownership/admin checks for `GET /users/{id}` and `GET /users/by-auth/{id}`.
  - Prefer `GET /users/me` for regular users, keep lookup-by-id/by-auth restricted to admin paths.
  - Add dedicated authorization tests in gateway + user-service.

## High Findings

### SEC-002 - Inter-service gRPC transport is plaintext (`insecure.NewCredentials`)
- Severity: High
- Evidence:
  - `services/project-service/internal/adapter/client/analysis/client.go:113`
  - `services/project-service/internal/adapter/client/ia/client.go:112`
  - `services/analysis-service/internal/adapter/client/project/client.go:113`
  - `services/attribution-service/internal/adapter/client/project/client.go:113`
  - `services/api-gateway/internal/adapter/http/permission_grpc.go:28`
- Recommendation:
  - Enable TLS/mTLS for internal gRPC.
  - Use per-service cert identities (SPIFFE/SPIRE or cert-manager) and verify SAN/authority.
  - Keep REST for frontend only, but secure all service-to-service gRPC channels.

### SEC-003 - Shared/default internal JWT secret and default broker creds in runtime config
- Severity: High
- Evidence:
  - Same default internal JWT secret repeated in compose:
    - `docker-compose.yml:83`
    - `docker-compose.yml:349`
  - Default RabbitMQ credentials used by project service:
    - `docker-compose.yml:345`
  - Dev run targets also use fixed weak secrets:
    - `Makefile:169`
    - `Makefile:172`
- Recommendation:
  - Remove hardcoded defaults, load from secret manager/K8s secret only.
  - Rotate existing internal JWT secret and broker credentials.
  - Use distinct secrets per environment and short rotation windows.

## Medium Findings

### SEC-004 - Client IP trust is based on unvalidated `X-Forwarded-For`
- Severity: Medium
- Evidence:
  - First `X-Forwarded-For` value is trusted directly:
    - `services/api-gateway/internal/adapter/http/headers.go:12`
  - Used for rate limiting decisions:
    - `services/api-gateway/internal/adapter/http/proxy.go:17`
- Recommendation:
  - Trust forwarding headers only from known proxy IP ranges.
  - Otherwise derive client IP from socket peer (`RemoteAddr`) and ignore spoofable headers.

### SEC-005 - Manual JWT implementation duplicated across services
- Severity: Medium
- Evidence:
  - Custom verify logic (manual split/base64/hmac/claims checks):
    - `services/project-service/internal/security/internal_jwt.go:89`
    - `services/analysis-service/internal/security/internal_jwt.go:89`
    - `services/ia-service/internal/security/internal_jwt.go:89`
    - `services/api-gateway/internal/adapter/http/internal_jwt.go:56`
- Recommendation:
  - Migrate to a maintained JWT library with strict parser options, key ID support (`kid`), and better claim validation ergonomics.
  - Centralize implementation in shared internal package to avoid drift.

### SEC-006 - Header spoofing surface for internal identity headers when claims are absent
- Severity: Medium
- Evidence:
  - Gateway forwards cloned request headers and only sets `Authorization`:
    - `services/api-gateway/internal/adapter/http/internal_proxy_auth.go:20`
  - Service middleware also clones headers and only overwrites identity headers when claims exist:
    - `services/project-service/internal/security/internal_jwt.go:50`
- Recommendation:
  - Explicitly strip inbound `X-Authenticated-*` and `X-Organization-ID` at gateway before proxying.
  - In service auth middleware, always clear these headers before re-populating from verified claims.

### SEC-007 - Production-like compose profile contains insecure operational defaults
- Severity: Medium
- Evidence:
  - Postgres SSL disabled in app envs (example):
    - `docker-compose.yml:341`
  - Grafana default admin/admin:
    - `docker-compose.yml:544`
    - `docker-compose.yml:545`
- Recommendation:
  - Treat compose `prod` profile as non-production unless hardened.
  - Enforce TLS for DB/broker where applicable.
  - Move Grafana admin credentials to secrets and rotate defaults.

## Informational

### INF-001 - Why gRPC generated contracts show `Deprecated` comments
- Evidence:
  - Example generated method:
    - `contracts/gen/go/analysis/v1/analysis.pb.go:57`
- Explanation:
  - These comments are generated by `protoc-gen-go` for legacy `Descriptor()` compatibility methods.
  - They do **not** mean your protobuf message/field/service is deprecated in `contracts/proto/*`.
  - No `deprecated = true` option was found in source proto contracts.

## Version Hygiene (Current vs Newer)

- Current in repo:
  - `google.golang.org/grpc v1.67.0` (multiple `go.mod`)
  - `google.golang.org/protobuf v1.34.2` in several services/contracts
  - Buf plugins:
    - `buf.build/protocolbuffers/go:v1.36.10`
    - `buf.build/grpc/go:v1.5.1`
- Newer upstream versions found (as of 2026-03-03):
  - Go stable: `go1.25.4`
  - `google.golang.org/grpc`: `v1.78.0`
  - `google.golang.org/protobuf`: `v1.36.10`
  - `google.golang.org/protobuf/cmd/protoc-gen-go`: `v1.36.11`
  - `google.golang.org/grpc/cmd/protoc-gen-go-grpc`: `v1.6.1`

Inference:
- Buf plugin tags generally track generator tool versions; validate `buf.build/protocolbuffers/go:v1.36.11` and `buf.build/grpc/go:v1.6.1` availability in your Buf registry before bumping.

## Suggested Remediation Order

1. Fix SEC-001 authorization gap and add regression tests.
2. Enforce TLS/mTLS on internal gRPC links (SEC-002).
3. Rotate secrets + remove weak defaults (SEC-003).
4. Hard-strip/overwrite forwarded identity headers (SEC-006) and harden proxy IP handling (SEC-004).
5. Replace custom JWT implementation and centralize (SEC-005).
6. Harden compose operational defaults (SEC-007).
