# microservices-go

Monorepo Go microservices avec API Gateway, auth Kratos, gestion utilisateurs, organisations, permissions, billing, notifications, project/analysis/ia et attribution.

## Services

- `services/api-gateway`: auth middleware, rate limiting, routing.
- `services/auth-service`: validation de session Kratos.
- `services/user-service`: profil utilisateur (PostgreSQL).
- `services/organizations-service`: organizations, teams, members, roles (PostgreSQL).
- `services/permission-service`: vérification RBAC (PostgreSQL).
- `services/billing-service`: plans et quotas (PostgreSQL).
- `services/notification-service`: envoi/listing notifications (PostgreSQL).
- `services/project-service`: gestion des projets, prompts, concurrents, modèles IA.
- `services/analysis-service`: orchestration des runs d’analyse, dashboard, perception, alertes.
- `services/ia-service`: exécution IA et extraction de marque (sans LangGraph).
- `services/attribution-service`: métriques de funnel IA (visits/signups/trials/paid/revenue) liées aux projets.
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
- Project: `http://localhost:8088`
- Analysis: `http://localhost:8089`
- IA: `http://localhost:8091`
- Attribution: `http://localhost:8092`
- Kratos public: `http://localhost:4433`
- Kratos admin: `http://localhost:4434`
- RabbitMQ UI: `http://localhost:15672`
- Web: `http://localhost:3000`
- App (SPA): `http://localhost:19020`
- Doc: `http://localhost:3001`
- Email preview: `http://localhost:3002`

## Endpoints principaux (via Gateway)

- `GET /health`
- `GET /auth/validate`
- `GET /auth/me`
- `POST /users`
- `GET /users/me`
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
- `POST /projects`
- `GET /projects`
- `POST /analysis/projects/{project_id}/analyze`
- `GET /analysis/projects/{project_id}/dashboard`
- `POST /ai/execute`
- `POST /attribution/projects/{project_id}/events`
- `GET /attribution/projects/{project_id}/funnel`

## Parcours auth → app → permissions (dev)

1) Se connecter sur `http://localhost:3000/auth` (Kratos via `auth-service`/Gateway).
2) Ouvrir `http://localhost:19020` (SPA) :
   - si nécessaire, créer le profil user (`POST /users`),
   - créer une organisation (le créateur est automatiquement ajouté comme `owner`),
   - tester les endpoints protégés (ex: création d’équipe) et `POST /permissions/check`.

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
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm organizations-migrate
docker compose run --rm user-migrate
```

Autres services (ORM migrations):

```bash
docker compose run --rm permission-migrate
docker compose run --rm billing-migrate
docker compose run --rm notification-migrate
docker compose run --rm project-migrate
docker compose run --rm analysis-migrate
docker compose run --rm attribution-migrate
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
docker compose -f docker-compose.yml -f docker-compose.dev.yml up email
```

## Cloudflare DNS (Kubernetes)

L’overlay prod est maintenant compatible Cloudflare via `external-dns`.

1. Créer un token Cloudflare avec permissions DNS (`Zone:DNS:Edit`, `Zone:Zone:Read`).
2. Renseigner `deployments/k8s/apps/overlays/prod/secrets/cloudflare_api_token`.
3. Ajuster vos domaines:
   - `deployments/k8s/apps/overlays/prod/ingress.yaml`
   - `deployments/k8s/infra/helm/external-dns/values.yaml` (`domainFilters`)
4. Installer l’infra:

```bash
deployments/k8s/infra/helm/install-infra.sh
```

## Backup PostgreSQL vers Cloudflare R2 (Docker)

Un service `postgres-backup-r2` exécute un `pg_dumpall`, compresse en `gzip`, puis envoie sur R2 (API S3).

Secrets Docker à remplir:

- `deployments/secrets/r2_account_id.txt`
- `deployments/secrets/r2_access_key_id.txt`
- `deployments/secrets/r2_secret_access_key.txt`

Lancement:

```bash
R2_BUCKET=your-r2-bucket docker compose --profile infra --profile backup up -d postgres postgres-backup-r2
```

Réglages:

- intervalle: `BACKUP_INTERVAL_SECONDS` (par défaut dans compose: `86400`)
- préfixe objet: `R2_PREFIX` (par défaut dans compose: `postgres`)
