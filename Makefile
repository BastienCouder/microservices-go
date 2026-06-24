# microservices-go

SHELL := /bin/sh

-include config/secrets.generated.mk

COMPOSE := docker compose
COMPOSE_FILES := -f docker-compose.yml -f docker-compose.secrets.generated.yml
COMPOSE_DEV := $(COMPOSE) -p microservices-go-dev $(COMPOSE_FILES) -f docker-compose.dev.yml
COMPOSE_PROD := $(COMPOSE) -p microservices-go-prod $(COMPOSE_FILES)
COMPOSE_PROD_LOCAL := $(COMPOSE_PROD)
COMPOSE_PROD_LOCAL_SERIAL := $(COMPOSE_PROD_LOCAL)

ANSIBLE_INVENTORY := ansible/inventory/production.ini
ANSIBLE_PLAYBOOK := ansible/playbooks/deploy.yml
ANSIBLE_BACKUP_CRON_PLAYBOOK := ansible/playbooks/postgres-r2-backup-cron.yml

SECRETS_DIR := secrets
STRIPE_FORWARD_TO ?= http://localhost:50000/billing/stripe/webhook
STRIPE_TRIGGER_EVENT ?= checkout.session.completed
STRIPE_CLI_DOCKER_IMAGE ?= stripe/stripe-cli:latest

PROFILES_DEV := --profile frontend --profile backend
PROFILES_PROD := --profile frontend --profile backend --profile infra

SQLC_SERVICES := user-service organizations-service permission-service billing-service notification-service
MIGRATION_SERVICES := user organizations permission billing notification project analysis ia

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
	rabbitmq_url.txt \
	ga4_oauth_client_id.txt \
	ga4_oauth_client_secret.txt \
	redis_password.txt

OPTIONAL_SECRETS := \
	r2_bucket.txt \
	r2_account_id.txt \
	r2_access_key_id.txt \
	r2_secret_access_key.txt \
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
	stripe_price_correction_credits.txt \
	project_http_addr.txt \
	project_metrics_addr.txt \
	analysis_http_addr.txt \
	analysis_metrics_addr.txt \
	ia_http_addr.txt \
	ia_metrics_addr.txt

.DEFAULT_GOAL := help

.PHONY: help \
	dev dev-build dev-down dev-logs dev-migrate dev-reset dev-clean-cache \
	dev-doc dev-email dev-mcp \
	prod prod-build prod-down prod-restart prod-rebuild prod-logs prod-migrate \
	prod-front prod-app prod-web prod-services prod-service \
	prod-services-api-gateway prod-services-user prod-services-organizations \
	prod-services-permission prod-services-billing prod-services-notification \
	prod-services-project prod-services-analysis prod-services-ia prod-services-crawler \
	prod-services-kratos \
	prod-ping prod-check deploy-prod deploy-prod-front deploy-prod-app deploy-prod-web deploy-prod-services deploy-prod-service deploy-prod-backup-cron \
	prod-doc prod-email prod-mcp \
	db-generate db-migrate \
	stripe-listen stripe-trigger stripe-trigger-checkout \
	secrets-generate secrets-verify-generated secrets-init secrets-check \
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
	@echo ""
	@echo "  Database"
	@echo "    make db-generate      Run sqlc for all configured services"
	@echo "    make db-migrate       Alias for dev migrations"
	@echo ""
	@echo "  Stripe"
	@echo "    make stripe-listen    Forward Stripe webhooks to local gateway ($(STRIPE_FORWARD_TO))"
	@echo "    make stripe-listen-docker Forward Stripe webhooks with Docker (requires STRIPE_API_KEY env)"
	@echo "    make stripe-trigger   Trigger a Stripe event (STRIPE_TRIGGER_EVENT=name)"
	@echo "    make stripe-trigger-checkout Trigger checkout.session.completed"
	@echo ""
	@echo "  Production"
	@echo "    make prod             Start web + app + backend + infra in production"
	@echo "    make prod-build       Rebuild and start web + app + backend + infra"
	@echo "    make prod-down        Stop production stack"
	@echo "    make prod-logs        Follow prod logs (SERVICE=name optional)"
	@echo "    make prod-restart     Restart one running service (SERVICE=name)"
	@echo "    make prod-rebuild     Rebuild and restart one service (SERVICE=name)"
	@echo "    make prod-front       Rebuild and start only web + app"
	@echo "    make prod-app         Rebuild and start only app"
	@echo "    make prod-web         Rebuild and start only web"
	@echo "    make prod-services    Run migrations, then rebuild and start backend services"
	@echo "    make prod-service     Rebuild and start only one service (SERVICE=name)"
	@echo "    make prod-services-analysis Rebuild and start analysis-service"
	@echo "    make prod-services-billing  Rebuild and start billing-service"
	@echo "    make prod-services-project  Rebuild and start project-service"
	@echo "    make prod-services-crawler  Rebuild and start crawler-service"
	@echo "    make prod-services-api-gateway Rebuild and start api-gateway"
	@echo "    make prod-migrate     Run all production migrations"
	@echo "    make prod-doc         Start docs only, sequentially"
	@echo "    make prod-email       Start email renderer only, sequentially"
	@echo "    make prod-mcp         Start MCP server only, sequentially"
	@echo "    make prod-ping        Ping production inventory"
	@echo "    make prod-check       Ansible syntax check"
	@echo "    make deploy-prod      Deploy full production stack with Ansible"
	@echo "    make deploy-prod-front Deploy only web + app with Ansible"
	@echo "    make deploy-prod-app  Deploy only app with Ansible"
	@echo "    make deploy-prod-web  Deploy only web with Ansible"
	@echo "    make deploy-prod-services Deploy backend services with Ansible"
	@echo "    make deploy-prod-service SERVICE=name  Deploy one service with Ansible"
	@echo "    make deploy-prod-backup-cron Configure daily PostgreSQL R2 backup cron with Ansible"
	@echo ""
	@echo "  Secrets"
	@echo "    make secrets-generate Regenerate Makefile/Compose/Ansible secrets files"
	@echo "    make secrets-verify-generated Fail if generated secrets files are stale"
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

db-generate:
	@for service in $(SQLC_SERVICES); do \
		echo "Generating SQLC for $$service"; \
		docker run --rm -v "$$(pwd):/src" -w "/src/services/$$service" sqlc/sqlc:latest generate; \
	done

db-migrate: dev-migrate

stripe-listen:
	@if command -v stripe >/dev/null 2>&1; then \
		stripe listen --forward-to "$(STRIPE_FORWARD_TO)"; \
	else \
		echo "Stripe CLI introuvable."; \
		echo "Installe-le localement, ou utilise: make stripe-listen-docker STRIPE_API_KEY=sk_test_..."; \
		exit 127; \
	fi

stripe-listen-docker:
	@test -n "$(STRIPE_API_KEY)" || (echo "Missing STRIPE_API_KEY. Example: make stripe-listen-docker STRIPE_API_KEY=sk_test_..."; exit 1)
	docker run --rm -it --network host \
		-e STRIPE_API_KEY="$(STRIPE_API_KEY)" \
		$(STRIPE_CLI_DOCKER_IMAGE) \
		listen --forward-to "$(STRIPE_FORWARD_TO)"

stripe-trigger:
	@if command -v stripe >/dev/null 2>&1; then \
		stripe trigger "$(STRIPE_TRIGGER_EVENT)"; \
	else \
		echo "Stripe CLI introuvable."; \
		echo "Installe-le localement d'abord pour utiliser stripe-trigger."; \
		exit 127; \
	fi

stripe-trigger-checkout:
	@if command -v stripe >/dev/null 2>&1; then \
		stripe trigger checkout.session.completed; \
	else \
		echo "Stripe CLI introuvable."; \
		echo "Installe-le localement d'abord pour utiliser stripe-trigger-checkout."; \
		exit 127; \
	fi

prod: secrets-check
	$(COMPOSE_PROD_LOCAL_SERIAL) $(PROFILES_PROD) up -d

prod-build: secrets-check
	$(COMPOSE_PROD_LOCAL_SERIAL) $(PROFILES_PROD) up -d --build

prod-down:
	$(COMPOSE_PROD_LOCAL) down --remove-orphans

prod-restart:
	$(COMPOSE_PROD_LOCAL) restart $(SERVICE)

prod-rebuild:
	$(COMPOSE_PROD_LOCAL_SERIAL) $(PROFILES_PROD) up -d --build $(SERVICE)

prod-logs:
	$(COMPOSE_PROD_LOCAL) logs -f $(SERVICE)

prod-front: secrets-check
	$(COMPOSE_PROD_LOCAL) up -d --build web app

prod-app: secrets-check
	$(COMPOSE_PROD_LOCAL) up -d --build app

prod-web: secrets-check
	$(COMPOSE_PROD_LOCAL) up -d --build web

prod-services: prod-migrate
	$(COMPOSE_PROD_LOCAL_SERIAL) --profile backend build --no-cache
	$(COMPOSE_PROD_LOCAL_SERIAL) --profile backend up -d --force-recreate

prod-service:
	@test -n "$(SERVICE)" || (echo "Usage: make prod-service SERVICE=analysis-service"; exit 1)
	$(MAKE) prod-rebuild SERVICE=$(SERVICE)

prod-services-api-gateway:
	$(MAKE) prod-rebuild SERVICE=api-gateway

prod-services-user:
	$(MAKE) prod-rebuild SERVICE=user-service

prod-services-organizations:
	$(MAKE) prod-rebuild SERVICE=organizations-service

prod-services-permission:
	$(MAKE) prod-rebuild SERVICE=permission-service

prod-services-billing:
	$(MAKE) prod-rebuild SERVICE=billing-service

prod-services-notification:
	$(MAKE) prod-rebuild SERVICE=notification-service

prod-services-project:
	$(MAKE) prod-rebuild SERVICE=project-service

prod-services-analysis:
	$(MAKE) prod-rebuild SERVICE=analysis-service

prod-services-ia:
	$(MAKE) prod-rebuild SERVICE=ia-service

prod-services-crawler:
	$(MAKE) prod-rebuild SERVICE=crawler-service

prod-services-kratos:
	$(MAKE) prod-rebuild SERVICE=kratos

prod-migrate: secrets-check
	$(COMPOSE_PROD_LOCAL_SERIAL) up -d postgres
	$(COMPOSE_PROD_LOCAL_SERIAL) up postgres-bootstrap
	@for service in \
		kratos-migrate \
		user-migrate \
		organizations-migrate \
		permission-migrate \
		billing-migrate \
		project-migrate \
		analysis-migrate \
		ia-migrate \
		notification-migrate; do \
		echo "==> Building $$service"; \
		$(COMPOSE_PROD_LOCAL_SERIAL) build $$service || exit $$?; \
		echo "==> Running $$service"; \
		$(COMPOSE_PROD_LOCAL_SERIAL) up --no-deps $$service || exit $$?; \
	done

prod-doc: secrets-check
	$(COMPOSE_PROD_LOCAL_SERIAL) --profile doc up -d

prod-email: secrets-check
	$(COMPOSE_PROD_LOCAL_SERIAL) --profile email up -d

prod-mcp: secrets-check
	$(COMPOSE_PROD_LOCAL_SERIAL) --profile mcp up -d

prod-ping:
	ansible -i $(ANSIBLE_INVENTORY) production -m ping --ask-become-pass

prod-check:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --syntax-check

deploy-prod:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --ask-become-pass

deploy-prod-front:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --ask-become-pass -e '{"deploy_services":["web","app"]}'

deploy-prod-app:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --ask-become-pass -e '{"deploy_services":["app"]}'

deploy-prod-web:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --ask-become-pass -e '{"deploy_services":["web"]}'

deploy-prod-services:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --ask-become-pass -e '{"deploy_profiles":["backend"]}'

deploy-prod-service:
	@test -n "$(SERVICE)" || (echo "Usage: make deploy-prod-service SERVICE=api-gateway"; exit 1)
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --ask-become-pass -e '{"deploy_services":["$(SERVICE)"]}'

deploy-prod-backup-cron:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_BACKUP_CRON_PLAYBOOK) --ask-become-pass

secrets-generate:
	python3 scripts/generate_secrets_config.py

secrets-verify-generated:
	python3 scripts/generate_secrets_config.py --check

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
	$(MAKE) secrets-verify-generated
	@test -z "$$(gofmt -l services)" || (echo "Go files need formatting:"; gofmt -l services; exit 1)
	$(MAKE) lint
	$(MAKE) test

seed-nike:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace \
		-v /usr/bin/docker:/usr/local/bin/docker \
		-v /usr/libexec/docker/cli-plugins:/usr/libexec/docker/cli-plugins \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-e SEED_COMPOSE_PROJECT_NAME=microservices-go \
		-e SEED_COMPOSE_FILES=docker-compose.yml \
		-e SEED_ANALYSIS_MODE=synthetic \
		oven/bun:1.2.22 bun scripts/seed-nike-backend.ts

seed-nike-live:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace \
		-v /usr/bin/docker:/usr/local/bin/docker \
		-v /usr/libexec/docker/cli-plugins:/usr/libexec/docker/cli-plugins \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-e SEED_COMPOSE_PROJECT_NAME=microservices-go \
		-e SEED_COMPOSE_FILES=docker-compose.yml \
		-e SEED_ANALYSIS_MODE=live \
		oven/bun:1.2.22 bun scripts/seed-nike-backend.ts

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
