# Security Best Practices Report

## Executive Summary

Audit scope covered the current web application codepaths and the Go backend entrypoints, using the `security-best-practices` skill plus direct code inspection.

Three findings stood out:

1. Multiple Go services intentionally expose `/metrics` on their main listeners and explicitly bypass internal auth for that path.
2. The MCP HTTP transport uses `http.ListenAndServe` directly, without request timeouts or `MaxHeaderBytes`, which leaves it open to resource-exhaustion attacks.
3. The backend CI pipeline does not run `govulncheck` or an equivalent dependency vulnerability scan.

No direct XSS sink, unsafe HTML rendering, or browser-side secret storage issue was identified in the TypeScript files inspected during this audit. The `return_to` flow in the web auth app is normalized back to the configured app origin, which materially reduces open-redirect risk in the currently visible browser flow.

## High Severity

### SEC-001

- Rule ID: GO-DEPLOY-002
- Severity: High
- Location:
  - `services/api-gateway/cmd/api/main.go:61`
  - `services/auth-service/cmd/api/main.go:34`
  - `services/project-service/cmd/api/main.go:103`
  - `services/user-service/cmd/api/main.go:43`
  - `services/project-service/internal/security/internal_jwt.go:87`
- Evidence:

```go
// services/api-gateway/cmd/api/main.go
mux.Handle("/metrics", promhttp.Handler())
```

```go
// services/auth-service/cmd/api/main.go
mux.Handle("/metrics", promhttp.Handler())
```

```go
// services/project-service/internal/security/internal_jwt.go
func isPublicPath(path string) bool {
	return path == "/health" || path == "/ready" || path == "/metrics"
}
```

- Impact: If these listeners are reachable outside a strictly private network, they expose operational telemetry without authentication, which can leak service topology, traffic shape, dependency names, error rates, and capacity signals useful for reconnaissance and targeted abuse.
- Fix: Move `/metrics` onto a dedicated private listener, or require strong network-level restriction and authentication in front of it. At minimum, stop exempting `/metrics` in `isPublicPath` for services that should not expose observability endpoints broadly.
- Mitigation: Restrict reachability at ingress, service mesh, security groups, or Kubernetes NetworkPolicy so only the metrics scraper can access these endpoints.
- False positive notes: If all service ports are guaranteed to be private and unreachable from user-controlled networks, severity drops. That guarantee is not visible in the application code inspected here.

### SEC-002

- Rule ID: GO-HTTP-001
- Severity: High
- Location: `services/mcp-server/cmd/server/main.go:64`
- Evidence:

```go
mux := http.NewServeMux()
mux.Handle("/mcp", handler)
mux.Handle("/metrics", promhttp.Handler())
return http.ListenAndServe(httpAddr, mux)
```

- Impact: The MCP server HTTP mode runs without `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`, `IdleTimeout`, or `MaxHeaderBytes`, which makes it materially more susceptible to slow-client and header-based resource exhaustion.
- Fix: Replace `http.ListenAndServe` with an explicit `http.Server` configured with conservative timeouts and header limits, consistent with the other Go services in this repo.
- Mitigation: Keep the MCP transport on `stdio` only, or bind the HTTP transport behind a trusted reverse proxy that enforces aggressive upstream timeouts and request limits.
- False positive notes: A reverse proxy can reduce exposure, but the application code still lacks the service-local protections required by the skill guidance.

## Medium Severity

### SEC-003

- Rule ID: GO-DEPLOY-001 / GO-SUPPLY-001 baseline
- Severity: Medium
- Location: `.github/workflows/backend-ci.yml:21`
- Evidence:

```yaml
jobs:
  lint:
  test:
  organizations-integration:
```

The workflow runs linting and tests, but no `govulncheck` or equivalent dependency vulnerability scan is present.

- Impact: Known vulnerable dependencies or standard-library reachable issues can ship unnoticed even when unit and integration tests pass.
- Fix: Add a dedicated CI step running `govulncheck ./...` for the Go workspace, and fail the pipeline on actionable findings.
- Mitigation: If centralized dependency scanning already exists outside GitHub Actions, document it in-repo so this control is auditable.
- False positive notes: This finding only covers the visible repository workflow. An external CI/CD platform or org-level scanner could already exist, but that control is not visible here.

## Notes And Assumptions

- The frontend auth flow currently normalizes `return_to` against the configured app origin in `apps/web/src/app/auth/auth-routing.ts`, so I did not classify it as an exploitable open redirect in the visible implementation.
- I did not find `dangerouslySetInnerHTML` in the inspected frontend scope.
- I did not run dynamic tests or deployment-level verification, so ingress/WAF/private-network assumptions still need runtime confirmation.
