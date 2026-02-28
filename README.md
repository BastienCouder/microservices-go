# microservices-go

Monorepo Go microservices avec API Gateway, auth Kratos, gestion utilisateurs, organisations, permissions, billing et notifications.

## Services

- `services/api-gateway`: auth middleware, rate limiting, routing.
- `services/auth-service`: validation de session Kratos.
- `services/user-service`: profil utilisateur (PostgreSQL).
- `services/organizations-service`: organizations, teams, members, roles (PostgreSQL).
- `services/permission-service`: vérification RBAC (PostgreSQL).
- `services/billing-service`: plans et quotas (PostgreSQL).
- `services/notification-service`: envoi/listing notifications (PostgreSQL).
- `services/mcp-server`: outils MCP backend.
- `apps/web`: frontend Next.js.
- `apps/doc`: documentation.
- `apps/email`: templates React Email + preview local.

## Démarrage rapide (Docker)

```bash
make up
```

Services exposés:

- Gateway: `http://localhost:8080`
- Auth: `http://localhost:8083`
- User: `http://localhost:8081`
- Organizations: `http://localhost:8084`
- Permission: `http://localhost:8085`
- Billing: `http://localhost:8086`
- Notification: `http://localhost:8087`
- Kratos public: `http://localhost:4433`
- Kratos admin: `http://localhost:4434`
- RabbitMQ UI: `http://localhost:15672`
- Web: `http://localhost:3000`
- Doc: `http://localhost:3001`
- Email preview: `http://localhost:3002`

## Endpoints principaux (via Gateway)

- `GET /health`
- `GET /auth/validate`
- `GET /auth/me`
- `POST /users`
- `GET /users/{id}`
- `GET /users/by-auth/{auth_identity_id}`
- `POST /organizations`
- `GET /organizations/{id}`
- `POST /organizations/{id}/teams`
- `GET /organizations/{id}/teams`
- `POST /organizations/{id}/members`
- `GET /organizations/{id}/members`
- `POST /organizations/{id}/members/{user_id}/roles`
- `POST /permissions/check`
- `POST /billing/subscriptions`
- `GET /billing/quotas/{organization_id}`
- `POST /notifications/send`
- `GET /notifications?limit=20`

## Tests et qualité

Unit tests:

```bash
make test
```

Integration test PostgreSQL pour organizations repository:

```bash
export ORG_TEST_DATABASE_URL='postgres://orgsvc:orgsvc@localhost:5432/orgsvc?sslmode=disable'
make test-integration-org
```

Lint strict:

```bash
make lint
```

## Organizations DB stack

- Driver/runtime: `pgx/v5` (`pgxpool`)
- Typed SQL: `sqlc` (`services/organizations-service/sqlc.yaml`)
- Dynamic SQL uniquement: `Squirrel`
- Migrations: `golang-migrate` (embarquées, source `iofs`)

Commandes utiles:

```bash
make sqlc-generate-organizations
export ORG_DATABASE_URL='postgres://orgsvc:orgsvc@localhost:5432/orgsvc?sslmode=disable'
make migrate-organizations
```

En Docker (recommandé):

```bash
docker compose run --rm organizations-migrate
# ou en dev
docker compose -f docker-compose.dev.yml run --rm organizations-migrate
docker compose run --rm user-migrate
```

Autres services (ORM migrations):

```bash
docker compose run --rm permission-migrate
docker compose run --rm billing-migrate
docker compose run --rm notification-migrate
```

## CI

Workflow backend:

- `golangci-lint` strict (`.golangci.yml`)
- tests unitaires Go
- test d’intégration PostgreSQL pour `organizations-service`

Fichier: `.github/workflows/backend-ci.yml`.

## React Email

Initialisation dans `apps/email` avec React Email + Bun.

Lancer localement:

```bash
cd apps/email
bun install
bun run dev
```

Ou via Docker dev:

```bash
docker compose -f docker-compose.dev.yml up email
```
