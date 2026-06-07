# microservices-go

SHELL := /bin/sh

COMPOSE := docker compose
COMPOSE_DEV := $(COMPOSE) -p microservices-go-dev -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_PROD := $(COMPOSE) -p microservices-go-prod -f docker-compose.yml

ANSIBLE_INVENTORY := ansible/inventory/production.ini
ANSIBLE_PLAYBOOK := ansible/playbooks/deploy.yml

SECRETS_DIR := secrets

PROFILES_DEV := --profile frontend --profile backend
PROFILES_PROD := --profile frontend --profile backend --profile infra

SQLC_SERVICES := user-service organizations-service permission-service billing-service notification-service
MIGRATION_SERVICES := user organizations permission billing notification project analysis ia attribution

REQUIRED_SECRETS := \
	postgres_superuser_password.txt \
	usersvc_db_password.txt \
	orgsvc_db_password.txt \
	permsvc_db_password.txt \
	billsvc_db_password.txt \
	notifsvc_db_password.txt \
	projectsvc_db_password.txt \
	analysissvc_db_password.txt \
	iasvc_db_password.txt \
	attrsvc_db_password.txt \
	kratos_db_password.txt \
	internal_jwt_secret.txt \
	gateway_http_addr.txt \
	gateway_metrics_addr.txt \
	db_host.txt \
	db_port.txt \
	db_sslmode.txt \
	organizations_db_user.txt \
	organizations_db_name.txt \
	openrouter_api_key.txt \
	cloudflare_account_id.txt \
	cloudflare_api_token.txt \
	resend_api_key.txt \
	resend_from_email.txt \
	resend_smtp_connection_uri.txt \
	google_oidc_client_id.txt \
	google_oidc_client_secret.txt \
	stripe_secret_key.txt \
	stripe_webhook_secret.txt \
	stripe_enabled.txt \
	stripe_checkout_success_url.txt \
	stripe_checkout_cancel_url.txt \
	stripe_customer_portal_return_url.txt \
	stripe_price_starter_monthly.txt \
	stripe_price_starter_yearly.txt \
	stripe_price_growth_monthly.txt \
	stripe_price_growth_yearly.txt \
	stripe_price_pro_monthly.txt \
	stripe_price_pro_yearly.txt \
	stripe_price_correction_credits.txt \
	rabbitmq_url.txt \
	ga4_oauth_client_id.txt \
	ga4_oauth_client_secret.txt \
	redis_password.txt

OPTIONAL_SECRETS := \
	r2_bucket.txt \
	r2_account_id.txt \
	r2_access_key_id.txt \
	r2_secret_access_key.txt \
	grafana_admin_user.txt \
	grafana_admin_password.txt \
	auth_http_addr.txt \
	auth_metrics_addr.txt \
	user_http_addr.txt \
	user_metrics_addr.txt \
	organizations_http_addr.txt \
	organizations_metrics_addr.txt \
	permission_http_addr.txt \
	permission_metrics_addr.txt \
	billing_http_addr.txt \
	billing_metrics_addr.txt \
	notification_http_addr.txt \
	notification_metrics_addr.txt \
	project_http_addr.txt \
	project_metrics_addr.txt \
	analysis_http_addr.txt \
	analysis_metrics_addr.txt \
	ia_http_addr.txt \
	ia_metrics_addr.txt \
	attribution_http_addr.txt \
	attribution_metrics_addr.txt

.DEFAULT_GOAL := help

.PHONY: help \
	dev dev-build dev-down dev-logs dev-migrate dev-reset dev-clean-cache \
	dev-doc dev-email dev-mcp dev-monitoring \
	prod prod-build prod-down prod-logs prod-migrate prod-ping prod-check deploy-prod \
	prod-doc prod-email prod-mcp prod-monitoring \
	db-generate db-migrate \
	secrets-init secrets-check \
	test lint lint-fix fmt ci \
	seed-nike seed-nike-live \
	up-dev-full down-dev logs-dev up-full down logs migrate-all \
	$(foreach service,$(MIGRATION_SERVICES),migrate-$(service) migrate-$(service)-dev)

help:
	@echo ""
	@echo "microservices-go"
	@echo ""
	@echo "  Dev"
	@echo "    make dev              Start dev stack"
	@echo "    make dev-build        Rebuild and start dev stack"
	@echo "    make dev-down         Stop dev stack"
	@echo "    make dev-logs         Follow dev logs (SERVICE=name optional)"
	@echo "    make dev-migrate      Run all dev migrations"
	@echo "    make dev-reset        Stop, clean Go cache, rebuild backend"
	@echo "    make dev-doc          Start docs only"
	@echo "    make dev-email        Start email renderer only"
	@echo "    make dev-mcp          Start MCP server only"
	@echo "    make dev-monitoring   Start monitoring only"
	@echo ""
	@echo "  Database"
	@echo "    make db-generate      Run sqlc for all configured services"
	@echo "    make db-migrate       Alias for dev migrations"
	@echo ""
	@echo "  Production"
	@echo "    make prod             Start production stack"
	@echo "    make prod-build       Rebuild and start production stack"
	@echo "    make prod-down        Stop production stack"
	@echo "    make prod-logs        Follow prod logs (SERVICE=name optional)"
	@echo "    make prod-migrate     Run all production migrations"
	@echo "    make prod-doc         Start docs only"
	@echo "    make prod-email       Start email renderer only"
	@echo "    make prod-mcp         Start MCP server only"
	@echo "    make prod-monitoring  Start monitoring only"
	@echo "    make prod-ping        Ping production inventory"
	@echo "    make prod-check       Ansible syntax check"
	@echo "    make deploy-prod      Run production deploy playbook"
	@echo ""
	@echo "  Secrets"
	@echo "    make secrets-init     Create missing secret files"
	@echo "    make secrets-check    Ensure required secrets are non-empty"
	@echo ""
	@echo "  Quality"
	@echo "    make test             Run Go tests"
	@echo "    make lint             Run golangci-lint"
	@echo "    make fmt              Format Go code"
	@echo "    make ci               Run fmt check, lint, test"
	@echo ""

dev: secrets-check
	$(COMPOSE_DEV) $(PROFILES_DEV) up

dev-build: secrets-check
	$(COMPOSE_DEV) $(PROFILES_DEV) up --build

dev-down:
	$(COMPOSE_DEV) down --remove-orphans

dev-logs:
	$(COMPOSE_DEV) logs -f $(SERVICE)

dev-migrate: secrets-check
	$(COMPOSE_DEV) --profile migrations up --build

dev-clean-cache:
	docker volume rm -f microservices-go-dev_go-mod-cache microservices-go-dev_go-build-cache || true

dev-reset: dev-down dev-clean-cache
	$(COMPOSE_DEV) --profile backend up --build

dev-doc: secrets-check
	$(COMPOSE_DEV) --profile doc up

dev-email: secrets-check
	$(COMPOSE_DEV) --profile email up

dev-mcp: secrets-check
	$(COMPOSE_DEV) --profile mcp up

dev-monitoring: secrets-check
	$(COMPOSE_DEV) --profile monitoring up

db-generate:
	@for service in $(SQLC_SERVICES); do \
		echo "Generating SQLC for $$service"; \
		docker run --rm -v "$$(pwd):/src" -w "/src/services/$$service" sqlc/sqlc:latest generate; \
	done

db-migrate: dev-migrate

prod: secrets-check
	$(COMPOSE_PROD) $(PROFILES_PROD) up -d

prod-build: secrets-check
	$(COMPOSE_PROD) $(PROFILES_PROD) up -d --build

prod-down:
	$(COMPOSE_PROD) down --remove-orphans

prod-logs:
	$(COMPOSE_PROD) logs -f $(SERVICE)

prod-migrate: secrets-check
	$(COMPOSE_PROD) --profile migrations up --build

prod-doc: secrets-check
	$(COMPOSE_PROD) --profile doc up -d

prod-email: secrets-check
	$(COMPOSE_PROD) --profile email up -d

prod-mcp: secrets-check
	$(COMPOSE_PROD) --profile mcp up -d

prod-monitoring: secrets-check
	$(COMPOSE_PROD) --profile monitoring up -d

prod-ping:
	ansible -i $(ANSIBLE_INVENTORY) production -m ping --ask-become-pass

prod-check:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --syntax-check

deploy-prod:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --ask-become-pass

secrets-init:
	@mkdir -p $(SECRETS_DIR)
	@for file in $(REQUIRED_SECRETS) $(OPTIONAL_SECRETS); do \
		touch "$(SECRETS_DIR)/$$file"; \
	done
	@echo "Secret files created in $(SECRETS_DIR). Fill required files before running Compose."

secrets-check:
	@test -d $(SECRETS_DIR) || (echo "Missing directory: $(SECRETS_DIR)"; echo "Run: make secrets-init"; exit 1)
	@missing=0; \
	for file in $(REQUIRED_SECRETS); do \
		if [ ! -s "$(SECRETS_DIR)/$$file" ]; then \
			echo "Missing or empty secret: $(SECRETS_DIR)/$$file"; \
			missing=1; \
		fi; \
	done; \
	if [ "$$missing" -ne 0 ]; then \
		echo "Fill required secrets or run: make secrets-init"; \
		exit 1; \
	fi

test:
	@for dir in services/*; do \
		if [ -f "$$dir/go.mod" ]; then \
			echo "Testing $$dir"; \
			(cd "$$dir" && go test ./...); \
		fi; \
	done

lint:
	GOWORK=$$(pwd)/services/go.work go run github.com/golangci/golangci-lint/cmd/golangci-lint@latest run --config .golangci.yml

lint-fix:
	GOWORK=$$(pwd)/services/go.work go run github.com/golangci/golangci-lint/cmd/golangci-lint@latest run --fix --config .golangci.yml

fmt:
	gofmt -w services

ci:
	@test -z "$$(gofmt -l services)" || (echo "Go files need formatting:"; gofmt -l services; exit 1)
	$(MAKE) lint
	$(MAKE) test

seed-nike:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace \
		-v /usr/bin/docker:/usr/local/bin/docker \
		-v /usr/libexec/docker/cli-plugins:/usr/libexec/docker/cli-plugins \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-e SEED_COMPOSE_PROJECT_NAME=$${SEED_COMPOSE_PROJECT_NAME:-microservices-go} \
		-e SEED_COMPOSE_FILES=$${SEED_COMPOSE_FILES:-docker-compose.yml} \
		-e SEED_ANALYSIS_MODE=$${SEED_ANALYSIS_MODE:-synthetic} \
		oven/bun:1.2.22 bun scripts/seed-nike-backend.ts

seed-nike-live:
	SEED_ANALYSIS_MODE=live $(MAKE) seed-nike

# Backward-compatible aliases.
up-dev-full: dev-build
down-dev: dev-down
logs-dev: dev-logs
up-full: prod-build
down: prod-down
logs: prod-logs
migrate-all: prod-migrate

$(foreach service,$(MIGRATION_SERVICES),migrate-$(service)-dev):
	$(COMPOSE_DEV) run --rm $(patsubst migrate-%-dev,%,$@)-migrate

$(foreach service,$(MIGRATION_SERVICES),migrate-$(service)):
	$(COMPOSE_PROD) run --rm $(patsubst migrate-%,%,$@)-migrate
