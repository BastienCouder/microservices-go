---
name: go-auth-ory-kratos
description: Guide for integrating Ory Kratos authentication into a Go SaaS backend. Covers email OTP, Google OAuth, session validation middleware, Docker setup, and Next.js frontend integration. Use when building secure authentication without writing auth logic yourself.
---

# Ory Kratos Authentication (Go + Next.js)

## Overview

Ory Kratos is a self-hosted identity server. The Go backend should avoid custom auth logic and only validate sessions against Kratos.

Architecture:

- User -> Next.js frontend
- Frontend/backend -> Ory Kratos (`/sessions/whoami`, self-service flows)
- Kratos -> PostgreSQL (identities)
- Kratos -> SMTP provider (emails)
- Kratos -> Google OAuth provider

## Version Policy (Mandatory)

- Always use latest stable versions for Kratos, PostgreSQL, and related integrations.
- Always prefer the most recent stable version available when updating or initializing Kratos stacks.
- Never use prerelease versions (`alpha`, `beta`, `rc`) unless explicitly requested.
- Verify stable tags from official sources before pinning images and SDK versions.

## Phase 1: Docker Setup

```yaml
services:
  kratos:
    image: oryd/kratos:v1.3.0
    ports:
      - "4433:4433" # public API
      - "4434:4434" # admin API (internal-only in production)
    command: serve -c /etc/config/kratos/kratos.yml --dev --watch-courier
    volumes:
      - ./kratos:/etc/config/kratos
    environment:
      DSN: postgres://kratos:secret@postgres:5432/kratos?sslmode=disable

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: kratos
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: kratos
    volumes:
      - kratos_pg_data:/var/lib/postgresql/data

volumes:
  kratos_pg_data:
```

## Phase 2: Kratos Configuration (`kratos/kratos.yml`)

```yaml
version: v1.3.0

dsn: postgres://kratos:secret@postgres:5432/kratos?sslmode=disable

serve:
  public:
    base_url: http://localhost:4433/
    cors:
      enabled: true
      allowed_origins:
        - http://localhost:3000
  admin:
    base_url: http://localhost:4434/

selfservice:
  default_browser_return_url: http://localhost:3000/

  flows:
    login:
      ui_url: http://localhost:3000/auth/login
    registration:
      ui_url: http://localhost:3000/auth/register
    recovery:
      enabled: true
      ui_url: http://localhost:3000/auth/recovery

  methods:
    code:
      enabled: true
      config:
        lifespan: 15m

    oidc:
      enabled: true
      config:
        providers:
          - id: google
            provider: google
            client_id: YOUR_GOOGLE_CLIENT_ID
            client_secret: YOUR_GOOGLE_CLIENT_SECRET
            mapper_url: file:///etc/config/kratos/google.jsonnet
            scope:
              - email
              - profile

courier:
  smtp:
    connection_uri: smtps://resend:YOUR_RESEND_API_KEY@smtp.resend.com:465
    from_address: noreply@myapp.com
    from_name: My SaaS

identity:
  default_schema_id: default
  schemas:
    - id: default
      url: file:///etc/config/kratos/identity.schema.json
```

## Phase 3: Identity Schema (`kratos/identity.schema.json`)

```json
{
  "$id": "https://myapp.com/schemas/identity.schema.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "User",
  "type": "object",
  "properties": {
    "traits": {
      "type": "object",
      "properties": {
        "email": {
          "type": "string",
          "format": "email",
          "title": "Email",
          "ory.sh/kratos": {
            "credentials": {
              "code": {
                "identifier": true,
                "via": "email"
              }
            },
            "recovery": {
              "via": "email"
            },
            "verification": {
              "via": "email"
            }
          }
        },
        "name": {
          "type": "string",
          "title": "Full Name"
        }
      },
      "required": ["email"]
    }
  }
}
```

## Phase 4: Google Mapper (`kratos/google.jsonnet`)

```jsonnet
local claims = std.extVar('claims');
{
  identity: {
    traits: {
      email: claims.email,
      name: claims.name,
    },
  },
}
```

## Phase 5: Go Session Middleware

```go
package auth

import (
    "context"
    "encoding/json"
    "io"
    "net/http"
    "os"
)

type KratosSession struct {
    ID     string `json:"id"`
    Active bool   `json:"active"`
    Identity struct {
        ID     string `json:"id"`
        Traits struct {
            Email string `json:"email"`
            Name  string `json:"name"`
        } `json:"traits"`
    } `json:"identity"`
}

type contextKey string

const SessionKey contextKey = "session"

var kratosClient = &http.Client{}

func KratosMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        kratosURL := os.Getenv("KRATOS_PUBLIC_URL")

        req, err := http.NewRequestWithContext(r.Context(), "GET", kratosURL+"/sessions/whoami", nil)
        if err != nil {
            http.Error(w, "Internal Server Error", http.StatusInternalServerError)
            return
        }

        req.Header.Set("Cookie", r.Header.Get("Cookie"))
        if token := r.Header.Get("X-Session-Token"); token != "" {
            req.Header.Set("X-Session-Token", token)
        }

        resp, err := kratosClient.Do(req)
        if err != nil || resp.StatusCode != http.StatusOK {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }
        defer resp.Body.Close()

        body, _ := io.ReadAll(resp.Body)
        var session KratosSession
        if err := json.Unmarshal(body, &session); err != nil || !session.Active {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }

        ctx := context.WithValue(r.Context(), SessionKey, &session)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func GetSession(r *http.Request) *KratosSession {
    s, _ := r.Context().Value(SessionKey).(*KratosSession)
    return s
}
```

## Phase 6: Route Registration (Go)

```go
package main

import (
    "encoding/json"
    "net/http"

    "github.com/yourorg/myapp/auth"
)

func main() {
    mux := http.NewServeMux()

    apiMux := http.NewServeMux()
    apiMux.HandleFunc("GET /api/me", meHandler)
    apiMux.HandleFunc("GET /api/dashboard", dashboardHandler)

    mux.Handle("/api/", auth.KratosMiddleware(apiMux))

    http.ListenAndServe(":8080", mux)
}

func meHandler(w http.ResponseWriter, r *http.Request) {
    session := auth.GetSession(r)
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "id":    session.Identity.ID,
        "email": session.Identity.Traits.Email,
        "name":  session.Identity.Traits.Name,
    })
}
```

## Phase 7: Next.js Integration

### Email OTP Flow

```ts
const KRATOS_URL = process.env.NEXT_PUBLIC_KRATOS_URL

export async function initLoginFlow() {
  const res = await fetch(`${KRATOS_URL}/self-service/login/api`)
  return res.json()
}

export async function submitEmail(flowId: string, email: string) {
  const res = await fetch(`${KRATOS_URL}/self-service/login?flow=${flowId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'code', identifier: email }),
  })
  return res.json()
}

export async function submitCode(flowId: string, code: string) {
  const res = await fetch(`${KRATOS_URL}/self-service/login?flow=${flowId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'code', code }),
  })
  return res.json()
}
```

### Google OAuth

```ts
export function loginWithGoogle() {
  window.location.href = `${KRATOS_URL}/self-service/login/browser?return_to=${window.location.origin}/dashboard`
}
```

### Session Check + Logout

```ts
export async function getSession() {
  const res = await fetch(`${KRATOS_URL}/sessions/whoami`, {
    credentials: 'include',
  })
  if (!res.ok) return null
  return res.json()
}

export async function logout() {
  const res = await fetch(`${KRATOS_URL}/self-service/logout/browser`, {
    credentials: 'include',
  })
  const { logout_url } = await res.json()
  window.location.href = logout_url
}
```

## Environment Variables

```text
# Go backend
KRATOS_PUBLIC_URL=http://localhost:4433

# Kratos
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
RESEND_API_KEY=re_xxx

# Next.js
NEXT_PUBLIC_KRATOS_URL=http://localhost:4433
```

## Responsibility Split

### What Kratos Handles

- Email OTP generation and delivery
- OTP expiration / verification rules
- Google OAuth flow (state, CSRF, exchange)
- Session lifecycle (issue, verify, revoke)
- Account recovery / verification flows
- Auth-related security controls

### What Go Backend Handles

- Validate active session via `GET /sessions/whoami`
- Authorize protected routes using Kratos session context

## Quality Checklist

### Infrastructure

- [ ] Kratos runs with PostgreSQL
- [ ] Public API reachable (`4433`)
- [ ] Admin API not publicly exposed in production
- [ ] PostgreSQL volume persisted

### Configuration

- [ ] `kratos.yml` URLs aligned with environment
- [ ] Identity schema includes email as code identifier
- [ ] Google mapper configured
- [ ] SMTP configured correctly
- [ ] OAuth credentials configured

### Backend

- [ ] Middleware applied on protected routes
- [ ] Cookie and `X-Session-Token` forwarded to Kratos
- [ ] `KRATOS_PUBLIC_URL` provided via environment

### Frontend

- [ ] Login flow initialized before form submission
- [ ] OTP flow split into email step then code step
- [ ] Session token or cookies forwarded correctly
- [ ] Logout uses Kratos logout flow

### Security

- [ ] Admin API not public
- [ ] CORS restricted to known frontend origins
- [ ] HTTPS enabled in production
- [ ] OAuth redirect URIs whitelisted in provider console
