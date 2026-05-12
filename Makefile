# =============================================================================
# microservices-go — Makefile
# =============================================================================
# Usage : make <target>
# Aide  : make help
# =============================================================================
 
# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
 
COMPOSE_PROD = docker compose -p microservices-go-prod -f docker-compose.yml
COMPOSE_DEV  = docker compose -p microservices-go-dev  -f docker-compose.yml -f docker-compose.dev.yml
 
PROFILES_PROD = --profile frontend --profile doc --profile email --profile mcp --profile backend --profile infra --profile monitoring
PROFILES_DEV  = --profile frontend --profile doc --profile email --profile mcp --profile backend --profile monitoring
 
# Couleurs pour l'affichage
BOLD  = \033[1m
RESET = \033[0m
CYAN  = \033[36m
GREEN = \033[32m
YELLOW = \033[33m
 
# -----------------------------------------------------------------------------
# Aide
# -----------------------------------------------------------------------------
 
.DEFAULT_GOAL := help
 
help: ## Affiche cette aide
	@echo ""
	@echo "  $(BOLD)microservices-go$(RESET)"
	@echo ""
	@echo "  $(CYAN)── Production ──────────────────────────────────────────────$(RESET)"
	@grep -E '^(up|down|logs)[^:]*:.*##' $(MAKEFILE_LIST) | grep -v dev | awk 'BEGIN{FS=":.*##"} {printf "  $(GREEN)%-30s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "  $(CYAN)── Développement ───────────────────────────────────────────$(RESET)"
	@grep -E '^(up-dev|down-dev|logs-dev|reset-dev|clean-dev)[^:]*:.*##' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*##"} {printf "  $(GREEN)%-30s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "  $(CYAN)── Run local (sans Docker) ─────────────────────────────────$(RESET)"
	@grep -E '^run-[^:]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*##"} {printf "  $(GREEN)%-30s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "  $(CYAN)── Migrations ──────────────────────────────────────────────$(RESET)"
	@grep -E '^migrate-[^:]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*##"} {printf "  $(GREEN)%-30s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "  $(CYAN)── Base de données ─────────────────────────────────────────$(RESET)"
	@grep -E '^(sqlc|seed)[^:]*:.*##' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*##"} {printf "  $(GREEN)%-30s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "  $(CYAN)── Qualité du code ─────────────────────────────────────────$(RESET)"
	@grep -E '^(test|lint|fmt)[^:]*:.*##' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*##"} {printf "  $(GREEN)%-30s$(RESET) %s\n", $$1, $$2}'
	@echo ""
 
# =============================================================================
# PRODUCTION
# =============================================================================
 
# --- Stack complète -----------------------------------------------------------
 
up-full: ## [PROD] Démarre tous les services
	$(COMPOSE_PROD) $(PROFILES_PROD) up -d --build
 
down: ## [PROD] Arrête tous les services
	$(COMPOSE_PROD) down --remove-orphans
 
logs: ## [PROD] Logs en direct (SERVICE=nom pour filtrer, ex: make logs SERVICE=api-gateway)
	$(COMPOSE_PROD) logs -f $(or $(SERVICE),)
 
# --- Démarrage par couche ----------------------------------------------------
 
up-infra: ## [PROD] Démarre l'infra (postgres, redis, rabbitmq)
	$(COMPOSE_PROD) --profile infra up -d
 
up-backend: ## [PROD] Démarre tous les microservices backend
	$(COMPOSE_PROD) --profile backend up -d --build
 
up-frontend: ## [PROD] Démarre web + app
	$(COMPOSE_PROD) --profile frontend up -d --build
 
up-monitoring: ## [PROD] Démarre Grafana + Prometheus + Loki
	$(COMPOSE_PROD) --profile monitoring up -d
 
up-migrations: ## [PROD] Exécute toutes les migrations
	$(COMPOSE_PROD) --profile migrations up --build
 
up-backup: ## [PROD] Démarre la sauvegarde automatique postgres → R2
	$(COMPOSE_PROD) --profile infra --profile backup up -d postgres postgres-backup-r2
 
up-doc: ## [PROD] Démarre le service de documentation
	$(COMPOSE_PROD) --profile doc up -d --build
 
up-email: ## [PROD] Démarre le service email (renderer)
	$(COMPOSE_PROD) --profile email up -d --build
 
up-mcp: ## [PROD] Démarre le serveur MCP
	$(COMPOSE_PROD) --profile mcp up -d --build
 
# --- Initialisation Kratos (auth) --------------------------------------------
 
kratos-init: ## [PROD] Initialise Kratos (postgres → migration → kratos)
	@echo "$(YELLOW)▶ Démarrage de postgres...$(RESET)"
	$(COMPOSE_PROD) --profile infra up -d postgres
	@echo "$(YELLOW)▶ Migration Kratos...$(RESET)"
	$(COMPOSE_PROD) --profile migrations run --rm kratos-migrate
	@echo "$(YELLOW)▶ Démarrage de Kratos...$(RESET)"
	$(COMPOSE_PROD) --profile infra up -d kratos
	@echo "$(GREEN)✓ Kratos prêt$(RESET)"
 
# =============================================================================
# DÉVELOPPEMENT
# =============================================================================
 
up-dev-full: ## [DEV] Démarre tous les services en mode dev
	$(COMPOSE_DEV) $(PROFILES_DEV) up -d --build
 
down-dev: ## [DEV] Arrête tous les services dev
	$(COMPOSE_DEV) down --remove-orphans
 
logs-dev: ## [DEV] Logs en direct de tous les services dev
	$(COMPOSE_DEV) logs -f
 
up-dev-frontend: ## [DEV] Démarre web + app en mode dev
	$(COMPOSE_DEV) --profile frontend up -d --build
 
up-dev-backend: ## [DEV] Démarre les microservices en mode dev
	$(COMPOSE_DEV) --profile backend up -d --build
 
up-dev-monitoring: ## [DEV] Démarre le monitoring en mode dev
	$(COMPOSE_DEV) --profile monitoring up -d
 
up-dev-migrations: ## [DEV] Exécute les migrations en mode dev
	$(COMPOSE_DEV) --profile migrations up --build
 
kratos-init-dev: ## [DEV] Initialise Kratos en mode dev
	@echo "$(YELLOW)▶ Démarrage de postgres...$(RESET)"
	$(COMPOSE_DEV) --profile backend up -d postgres
	@echo "$(YELLOW)▶ Migration Kratos...$(RESET)"
	$(COMPOSE_DEV) --profile migrations run --rm kratos-migrate
	@echo "$(YELLOW)▶ Démarrage de Kratos...$(RESET)"
	$(COMPOSE_DEV) --profile backend up -d kratos
	@echo "$(GREEN)✓ Kratos prêt$(RESET)"
 
clean-dev-go-cache: ## [DEV] Supprime les caches Go (modules + build)
	docker volume rm -f microservices-go-dev_go-mod-cache microservices-go-dev_go-build-cache || true
	@echo "$(GREEN)✓ Caches Go supprimés$(RESET)"
 
reset-dev-backend: down-dev clean-dev-go-cache ## [DEV] Reset complet du backend dev (stop + clean cache + rebuild)
	$(COMPOSE_DEV) --profile backend up -d --build
 
# =============================================================================
# RUN LOCAL (sans Docker — nécessite postgres local)
# =============================================================================
 
run-gateway: ## [LOCAL] api-gateway
	HTTP_ADDR=:8080 \
	USER_SERVICE_URL=http://localhost:8081 \
	AUTH_SERVICE_URL=http://localhost:8083 \
	ORGANIZATIONS_SERVICE_URL=http://localhost:8084 \
	PERMISSION_SERVICE_URL=http://localhost:8085 \
	PERMISSION_SERVICE_GRPC_ADDR=localhost:9085 \
	BILLING_SERVICE_URL=http://localhost:8086 \
	NOTIFICATION_SERVICE_URL=http://localhost:8087 \
	PROJECT_SERVICE_URL=http://localhost:8088 \
	ANALYSIS_SERVICE_URL=http://localhost:8089 \
	IA_SERVICE_URL=http://localhost:8091 \
	ATTRIBUTION_SERVICE_URL=http://localhost:8092 \
	RATE_LIMIT_RPM=120 \
	go run ./services/api-gateway/cmd/api
 
run-user: ## [LOCAL] user-service
	HTTP_ADDR=:8081 \
	USER_DB_HOST=localhost USER_DB_PORT=5432 USER_DB_USER=usersvc USER_DB_NAME=usersvc USER_DB_SSLMODE=disable USER_DB_PASSWORD=usersvc \
	go run ./services/user-service/cmd/api
 
run-auth: ## [LOCAL] auth-service
	HTTP_ADDR=:8083 \
	KRATOS_PUBLIC_URL=http://localhost:4433 \
	ALLOWED_ORIGIN=http://localhost:3000 \
	go run ./services/auth-service/cmd/api
 
run-organizations: ## [LOCAL] organizations-service
	HTTP_ADDR=:8084 \
	ORG_DB_HOST=localhost ORG_DB_PORT=5432 ORG_DB_USER=orgsvc ORG_DB_NAME=orgsvc ORG_DB_SSLMODE=disable ORG_DB_PASSWORD=orgsvc \
	go run ./services/organizations-service/cmd/api
 
run-permission: ## [LOCAL] permission-service
	HTTP_ADDR=:8085 GRPC_ADDR=:9085 \
	PERMISSION_DB_HOST=localhost PERMISSION_DB_PORT=5432 PERMISSION_DB_USER=permsvc PERMISSION_DB_NAME=permsvc PERMISSION_DB_SSLMODE=disable PERMISSION_DB_PASSWORD=permsvc \
	ORGANIZATIONS_SERVICE_URL=http://localhost:8084 \
	INTERNAL_JWT_SECRET=$${INTERNAL_JWT_SECRET:?INTERNAL_JWT_SECRET is required} \
	INTERNAL_JWT_ISSUER=api-gateway \
	GRPC_ALLOW_INSECURE=true \
	go run ./services/permission-service/cmd/api
 
run-billing: ## [LOCAL] billing-service
	HTTP_ADDR=:8086 \
	BILLING_DB_HOST=localhost BILLING_DB_PORT=5432 BILLING_DB_USER=billsvc BILLING_DB_NAME=billsvc BILLING_DB_SSLMODE=disable BILLING_DB_PASSWORD=billsvc \
	INTERNAL_JWT_SECRET=$${INTERNAL_JWT_SECRET:?INTERNAL_JWT_SECRET is required} \
	INTERNAL_JWT_ISSUER=api-gateway \
	STRIPE_ENABLED=false \
	go run ./services/billing-service/cmd/api
 
run-notification: ## [LOCAL] notification-service
	HTTP_ADDR=:8087 \
	NOTIFICATION_DB_HOST=localhost NOTIFICATION_DB_PORT=5432 NOTIFICATION_DB_USER=notifsvc NOTIFICATION_DB_NAME=notifsvc NOTIFICATION_DB_SSLMODE=disable NOTIFICATION_DB_PASSWORD=notifsvc \
	go run ./services/notification-service/cmd/api
 
run-project: ## [LOCAL] project-service
	HTTP_ADDR=:8088 GRPC_ADDR=:9088 \
	PROJECT_DB_HOST=localhost PROJECT_DB_PORT=5432 PROJECT_DB_USER=projectsvc PROJECT_DB_NAME=projectsvc PROJECT_DB_SSLMODE=disable PROJECT_DB_PASSWORD=projectsvc \
	ANALYSIS_SERVICE_GRPC_ADDR=localhost:9089 \
	IA_SERVICE_GRPC_ADDR=localhost:9091 \
	RABBITMQ_URL=$${RABBITMQ_URL:?RABBITMQ_URL is required} \
	RABBITMQ_EXCHANGE=microservices.events \
	RABBITMQ_PROJECT_FINALIZE_QUEUE=project.finalize \
	RABBITMQ_PROJECT_FINALIZE_ROUTING_KEY=project.finalized \
	INTERNAL_JWT_SECRET=$${INTERNAL_JWT_SECRET:?INTERNAL_JWT_SECRET is required} \
	INTERNAL_JWT_ISSUER=api-gateway \
	GRPC_ALLOW_INSECURE=true \
	go run ./services/project-service/cmd/api
 
run-analysis: ## [LOCAL] analysis-service
	HTTP_ADDR=:8089 GRPC_ADDR=:9089 \
	ANALYSIS_DB_HOST=localhost ANALYSIS_DB_PORT=5432 ANALYSIS_DB_USER=analysissvc ANALYSIS_DB_NAME=analysissvc ANALYSIS_DB_SSLMODE=disable ANALYSIS_DB_PASSWORD=analysissvc \
	PROJECT_SERVICE_GRPC_ADDR=localhost:9088 \
	INTERNAL_JWT_SECRET=$${INTERNAL_JWT_SECRET:?INTERNAL_JWT_SECRET is required} \
	INTERNAL_JWT_ISSUER=api-gateway \
	GRPC_ALLOW_INSECURE=true \
	go run ./services/analysis-service/cmd/api
 
run-ia: ## [LOCAL] ia-service (IA_EXECUTION_MODE=mock par défaut)
	HTTP_ADDR=:8091 GRPC_ADDR=:9091 \
	IA_EXECUTION_MODE=$${IA_EXECUTION_MODE:-mock} \
	IA_PROVIDER_BASE_URL=$${IA_PROVIDER_BASE_URL:-https://openrouter.ai/api/v1} \
	IA_PROVIDER_HTTP_REFERER=$${IA_PROVIDER_HTTP_REFERER:-http://localhost:30004} \
	IA_PROVIDER_APP_NAME=$${IA_PROVIDER_APP_NAME:-microservices-go} \
	IA_PROVIDER_TIMEOUT_MS=5000 \
	INTERNAL_JWT_SECRET=$${INTERNAL_JWT_SECRET:?INTERNAL_JWT_SECRET is required} \
	INTERNAL_JWT_ISSUER=api-gateway \
	GRPC_ALLOW_INSECURE=true \
	go run ./services/ia-service/cmd/api
 
run-attribution: ## [LOCAL] attribution-service
	HTTP_ADDR=:8092 \
	ATTRIBUTION_DB_HOST=localhost ATTRIBUTION_DB_PORT=5432 ATTRIBUTION_DB_USER=attrsvc ATTRIBUTION_DB_NAME=attrsvc ATTRIBUTION_DB_SSLMODE=disable ATTRIBUTION_DB_PASSWORD=attrsvc \
	PROJECT_SERVICE_GRPC_ADDR=localhost:9088 \
	INTERNAL_JWT_SECRET=$${INTERNAL_JWT_SECRET:?INTERNAL_JWT_SECRET is required} \
	INTERNAL_JWT_ISSUER=api-gateway \
	GRPC_ALLOW_INSECURE=true \
	go run ./services/attribution-service/cmd/api
 
# =============================================================================
# MIGRATIONS (via Docker)
# =============================================================================
 
# --- Production --------------------------------------------------------------
 
migrate-user: ## [PROD] Migration user-service
	$(COMPOSE_PROD) run --rm user-migrate
 
migrate-organizations: ## [PROD] Migration organizations-service
	$(COMPOSE_PROD) run --rm organizations-migrate
 
migrate-permission: ## [PROD] Migration permission-service
	$(COMPOSE_PROD) run --rm permission-migrate
 
migrate-billing: ## [PROD] Migration billing-service
	$(COMPOSE_PROD) run --rm billing-migrate
 
migrate-notification: ## [PROD] Migration notification-service
	$(COMPOSE_PROD) run --rm notification-migrate
 
migrate-project: ## [PROD] Migration project-service
	$(COMPOSE_PROD) run --rm project-migrate
 
migrate-analysis: ## [PROD] Migration analysis-service
	$(COMPOSE_PROD) run --rm analysis-migrate
 
migrate-attribution: ## [PROD] Migration attribution-service
	$(COMPOSE_PROD) run --rm attribution-migrate
 
migrate-all: ## [PROD] Toutes les migrations
	@echo "$(YELLOW)▶ Migrations en cours...$(RESET)"
	$(COMPOSE_PROD) --profile migrations up --build
	@echo "$(GREEN)✓ Migrations terminées$(RESET)"
 
# --- Dev ---------------------------------------------------------------------
 
migrate-user-dev: ## [DEV] Migration user-service
	$(COMPOSE_DEV) run --rm user-migrate
 
migrate-organizations-dev: ## [DEV] Migration organizations-service
	$(COMPOSE_DEV) run --rm organizations-migrate
 
migrate-permission-dev: ## [DEV] Migration permission-service
	$(COMPOSE_DEV) run --rm permission-migrate
 
migrate-billing-dev: ## [DEV] Migration billing-service
	$(COMPOSE_DEV) run --rm billing-migrate
 
migrate-notification-dev: ## [DEV] Migration notification-service
	$(COMPOSE_DEV) run --rm notification-migrate
 
migrate-project-dev: ## [DEV] Migration project-service
	$(COMPOSE_DEV) run --rm project-migrate
 
migrate-analysis-dev: ## [DEV] Migration analysis-service
	$(COMPOSE_DEV) run --rm analysis-migrate
 
migrate-attribution-dev: ## [DEV] Migration attribution-service
	$(COMPOSE_DEV) run --rm attribution-migrate
 
# --- Local (sans Docker) — variables d'env requises --------------------------
 
migrate-user-local: ## [LOCAL] Migration user-service (requiert USER_DB_* en env)
	@$(call check_env,USER_DB_HOST,USER_DB_PORT,USER_DB_USER,USER_DB_NAME,USER_DB_SSLMODE,USER_DB_PASSWORD)
	go run ./services/user-service/cmd/migrate
 
migrate-organizations-local: ## [LOCAL] Migration organizations-service (requiert ORG_DB_* en env)
	@$(call check_env,ORG_DB_HOST,ORG_DB_PORT,ORG_DB_USER,ORG_DB_NAME,ORG_DB_SSLMODE,ORG_DB_PASSWORD)
	go run ./services/organizations-service/cmd/migrate
 
migrate-permission-local: ## [LOCAL] Migration permission-service (requiert PERMISSION_DB_* en env)
	@$(call check_env,PERMISSION_DB_HOST,PERMISSION_DB_PORT,PERMISSION_DB_USER,PERMISSION_DB_NAME,PERMISSION_DB_SSLMODE,PERMISSION_DB_PASSWORD)
	go run ./services/permission-service/cmd/migrate
 
migrate-billing-local: ## [LOCAL] Migration billing-service (requiert BILLING_DB_* en env)
	@$(call check_env,BILLING_DB_HOST,BILLING_DB_PORT,BILLING_DB_USER,BILLING_DB_NAME,BILLING_DB_SSLMODE,BILLING_DB_PASSWORD)
	go run ./services/billing-service/cmd/migrate
 
migrate-notification-local: ## [LOCAL] Migration notification-service (requiert NOTIFICATION_DB_* en env)
	@$(call check_env,NOTIFICATION_DB_HOST,NOTIFICATION_DB_PORT,NOTIFICATION_DB_USER,NOTIFICATION_DB_NAME,NOTIFICATION_DB_SSLMODE,NOTIFICATION_DB_PASSWORD)
	go run ./services/notification-service/cmd/migrate
 
migrate-project-local: ## [LOCAL] Migration project-service (requiert PROJECT_DB_* en env)
	@$(call check_env,PROJECT_DB_HOST,PROJECT_DB_PORT,PROJECT_DB_USER,PROJECT_DB_NAME,PROJECT_DB_SSLMODE,PROJECT_DB_PASSWORD)
	go run ./services/project-service/cmd/migrate
 
migrate-analysis-local: ## [LOCAL] Migration analysis-service (requiert ANALYSIS_DB_* en env)
	@$(call check_env,ANALYSIS_DB_HOST,ANALYSIS_DB_PORT,ANALYSIS_DB_USER,ANALYSIS_DB_NAME,ANALYSIS_DB_SSLMODE,ANALYSIS_DB_PASSWORD)
	go run ./services/analysis-service/cmd/migrate
 
migrate-attribution-local: ## [LOCAL] Migration attribution-service (requiert ATTRIBUTION_DB_* en env)
	@$(call check_env,ATTRIBUTION_DB_HOST,ATTRIBUTION_DB_PORT,ATTRIBUTION_DB_USER,ATTRIBUTION_DB_NAME,ATTRIBUTION_DB_SSLMODE,ATTRIBUTION_DB_PASSWORD)
	go run ./services/attribution-service/cmd/migrate
 
# =============================================================================
# BASE DE DONNÉES
# =============================================================================
 
sqlc-generate-user: ## [SQLC] Génère le code SQL pour user-service
	docker run --rm -v $$(pwd):/src -w /src/services/user-service sqlc/sqlc:latest generate
 
sqlc-generate-organizations: ## [SQLC] Génère le code SQL pour organizations-service
	docker run --rm -v $$(pwd):/src -w /src/services/organizations-service sqlc/sqlc:latest generate
 
sqlc-generate-permission: ## [SQLC] Génère le code SQL pour permission-service
	docker run --rm -v $$(pwd):/src -w /src/services/permission-service sqlc/sqlc:latest generate
 
sqlc-generate-billing: ## [SQLC] Génère le code SQL pour billing-service
	docker run --rm -v $$(pwd):/src -w /src/services/billing-service sqlc/sqlc:latest generate
 
sqlc-generate-notification: ## [SQLC] Génère le code SQL pour notification-service
	docker run --rm -v $$(pwd):/src -w /src/services/notification-service sqlc/sqlc:latest generate
 
sqlc-generate-all: ## [SQLC] Génère le code SQL pour tous les services
sqlc-generate-all: sqlc-generate-user sqlc-generate-organizations sqlc-generate-permission sqlc-generate-billing sqlc-generate-notification
	@echo "$(GREEN)✓ Génération SQLC terminée$(RESET)"
 
seed-nike: ## [SEED] Injecte les données de démo Nike (mode synthetic)
	docker run --rm \
	  -v $$(pwd):/workspace -w /workspace \
	  -v /usr/bin/docker:/usr/local/bin/docker \
	  -v /usr/libexec/docker/cli-plugins:/usr/libexec/docker/cli-plugins \
	  -v /var/run/docker.sock:/var/run/docker.sock \
	  -e SEED_COMPOSE_PROJECT_NAME=$${SEED_COMPOSE_PROJECT_NAME:-microservices-go} \
	  -e SEED_COMPOSE_FILES=$${SEED_COMPOSE_FILES:-docker-compose.yml} \
	  -e SEED_ANALYSIS_MODE=$${SEED_ANALYSIS_MODE:-synthetic} \
	  oven/bun:1.2.22 bun scripts/seed-nike-backend.ts
 
seed-nike-live: ## [SEED] Injecte les données de démo Nike (mode live — appels API réels)
	SEED_ANALYSIS_MODE=live $(MAKE) seed-nike
 
# =============================================================================
# QUALITÉ DU CODE
# =============================================================================
 
test: ## [TEST] Tests unitaires de tous les services
	go test ./services/...
 
test-integration-user: ## [TEST] Tests d'intégration user-service (requiert USER_TEST_DATABASE_URL)
	@test -n "$$USER_TEST_DATABASE_URL" || (echo "$(YELLOW)⚠ USER_TEST_DATABASE_URL est requis$(RESET)" && exit 1)
	go test -tags=integration ./services/user-service/internal/adapter/repository/postgres
 
test-integration-org: ## [TEST] Tests d'intégration organizations-service (requiert ORG_TEST_DATABASE_URL)
	@test -n "$$ORG_TEST_DATABASE_URL" || (echo "$(YELLOW)⚠ ORG_TEST_DATABASE_URL est requis$(RESET)" && exit 1)
	go test -tags=integration ./services/organizations-service/internal/adapter/repository/postgres
 
test-integration-permission: ## [TEST] Tests d'intégration permission-service (requiert PERMISSION_TEST_DATABASE_URL)
	@test -n "$$PERMISSION_TEST_DATABASE_URL" || (echo "$(YELLOW)⚠ PERMISSION_TEST_DATABASE_URL est requis$(RESET)" && exit 1)
	go test -tags=integration ./services/permission-service/internal/adapter/repository/postgres
 
test-integration-billing: ## [TEST] Tests d'intégration billing-service (requiert BILLING_TEST_DATABASE_URL)
	@test -n "$$BILLING_TEST_DATABASE_URL" || (echo "$(YELLOW)⚠ BILLING_TEST_DATABASE_URL est requis$(RESET)" && exit 1)
	go test -tags=integration ./services/billing-service/internal/adapter/repository/postgres
 
test-integration-notification: ## [TEST] Tests d'intégration notification-service (requiert NOTIFICATION_TEST_DATABASE_URL)
	@test -n "$$NOTIFICATION_TEST_DATABASE_URL" || (echo "$(YELLOW)⚠ NOTIFICATION_TEST_DATABASE_URL est requis$(RESET)" && exit 1)
	go test -tags=integration ./services/notification-service/internal/adapter/repository/postgres
 
test-integration-all: ## [TEST] Tous les tests d'intégration
test-integration-all: test-integration-user test-integration-org test-integration-permission test-integration-billing test-integration-notification
	@echo "$(GREEN)✓ Tous les tests d'intégration passés$(RESET)"
 
lint: ## [LINT] Analyse statique du code
	go run github.com/golangci/golangci-lint/cmd/golangci-lint@latest run --config .golangci.yml
 
lint-fix: ## [LINT] Analyse statique + corrections automatiques
	go run github.com/golangci/golangci-lint/cmd/golangci-lint@latest run --fix --config .golangci.yml
 
fmt: ## [FORMAT] Formate tout le code Go
	gofmt -w cmd services
	@echo "$(GREEN)✓ Formatage terminé$(RESET)"
 
# =============================================================================
# Utilitaires internes
# =============================================================================
 
# Vérifie qu'une liste de variables d'environnement sont définies
# Usage : @$(call check_env,VAR1,VAR2,VAR3)
define check_env
  $(foreach var,$(1),$(if $(value $(var)),,$(error $(YELLOW)⚠ $(var) est requis$(RESET))))
endef
 
.PHONY: help \
  up-full down logs \
  up-infra up-backend up-frontend up-monitoring up-migrations up-backup up-doc up-email up-mcp \
  kratos-init \
  up-dev-full down-dev logs-dev \
  up-dev-frontend up-dev-backend up-dev-monitoring up-dev-migrations \
  kratos-init-dev clean-dev-go-cache reset-dev-backend \
  run-gateway run-user run-auth run-organizations run-permission run-billing \
  run-notification run-project run-analysis run-ia run-attribution \
  migrate-user migrate-organizations migrate-permission migrate-billing \
  migrate-notification migrate-project migrate-analysis migrate-attribution migrate-all \
  migrate-user-dev migrate-organizations-dev migrate-permission-dev migrate-billing-dev \
  migrate-notification-dev migrate-project-dev migrate-analysis-dev migrate-attribution-dev \
  migrate-user-local migrate-organizations-local migrate-permission-local migrate-billing-local \
  migrate-notification-local migrate-project-local migrate-analysis-local migrate-attribution-local \
  sqlc-generate-user sqlc-generate-organizations sqlc-generate-permission \
  sqlc-generate-billing sqlc-generate-notification sqlc-generate-all \
  seed-nike seed-nike-live \
  test test-integration-user test-integration-org test-integration-permission \
  test-integration-billing test-integration-notification test-integration-all \
  lint lint-fix fmt