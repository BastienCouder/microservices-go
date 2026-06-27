# microservices-go

SHELL := /bin/sh

-include config/secrets.generated.mk

COMPOSE := docker compose
COMPOSE_FILES := -f docker-compose.yml -f docker-compose.secrets.generated.yml

COMPOSE_PROD_PROJECT ?= microservices-go-prod
COMPOSE_DEV := $(COMPOSE) -p microservices-go-dev $(COMPOSE_FILES) -f docker-compose.dev.yml
COMPOSE_PROD := $(COMPOSE) -p $(COMPOSE_PROD_PROJECT) $(COMPOSE_FILES)
COMPOSE_PROD_LOCAL := $(COMPOSE_PROD)
COMPOSE_PROD_LOCAL_SERIAL := $(COMPOSE_PROD_LOCAL)

ANSIBLE_INVENTORY := ansible/inventory/production.ini
ANSIBLE_PLAYBOOK := ansible/playbooks/deploy.yml
ANSIBLE_BACKUP_CRON_PLAYBOOK := ansible/playbooks/postgres-r2-backup-cron.yml

PROD_REMOTE_PATH ?= /opt/visia
PROD_REMOTE_USER ?= deploy
PROD_REMOTE_COMPOSE_PROJECT ?= visia

SECRETS_DIR := secrets
STRIPE_FORWARD_TO ?= http://localhost:50000/billing/stripe/webhook
STRIPE_TRIGGER_EVENT ?= checkout.session.completed
STRIPE_CLI_DOCKER_IMAGE ?= stripe/stripe-cli:latest
FRONTEND_BUN_IMAGE ?= oven/bun:1.2.22
FRONTEND_NODE_IMAGE ?= node:22-bookworm
GOLANGCI_LINT_VERSION ?= v2.1.6
GO_TOOLCHAIN_VERSION ?= go1.25.7
BACKUP_POSTGRES_HOST ?= postgres
BACKUP_POSTGRES_PORT ?= 5432
BACKUP_POSTGRES_USER ?= postgres
R2_PREFIX ?= postgres
R2_REGION ?= auto
SEED_USER_EMAIL ?= couderbastien
SEED_COMPOSE_PROJECT_NAME_PROD ?= $(COMPOSE_PROD_PROJECT)

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

GO_SERVICE_DIR = services/$(SERVICE)

.PHONY: help \
	dev dev-build dev-down dev-logs dev-migrate dev-reset dev-clean-cache \
	dev-doc dev-email \
	prod prod-build prod-down prod-restart prod-rebuild prod-logs prod-migrate \
	prod-front prod-app prod-web prod-services prod-service \
	prod-services-api-gateway prod-services-user prod-services-organizations \
	prod-services-permission prod-services-billing prod-services-notification \
	prod-services-project prod-services-analysis prod-services-ia prod-services-crawler \
	prod-services-kratos \
	prod-ping prod-check deploy-prod deploy-prod-front deploy-prod-app deploy-prod-web deploy-prod-services deploy-prod-service deploy-prod-backup-cron \
	backup-r2-once \
	prod-doc prod-email \
	db-generate db-migrate \
	stripe-listen stripe-listen-docker stripe-trigger stripe-trigger-checkout \
	secrets-generate secrets-verify-generated secrets-init secrets-check \
	test lint lint-services lint-fix fmt build build-services ci ci-services \
	go-test go-vet go-build go-ci docker-build \
	app-lint app-build app-ci \
	web-lint web-typecheck web-build web-ci \
	email-build email-ci \
	langgraph-check langgraph-test langgraph-build langgraph-ci \
	crawler-check crawler-build crawler-ci \
	ts-ci frontend-ci ci-all \
	seed-nike seed-nike-live seed-nike-prod seed-nike-prod-live \
	seed-nike-prod-server seed-nike-prod-live-server deploy-prod-seed-nike deploy-prod-seed-nike-live \
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
	@echo "    make seed-nike-prod   Migrate and seed a complete Nike project locally"
	@echo "    make seed-nike-prod-live Migrate and seed a complete Nike project locally with live analysis"
	@echo "    make seed-nike-prod-server Run prod Nike seed on the VPS"
	@echo "    make seed-nike-prod-live-server Run prod Nike live seed on the VPS"
	@echo "    make deploy-prod-seed-nike Deploy prod, then run Nike seed on the VPS"
	@echo "    make deploy-prod-seed-nike-live Deploy prod, then run live Nike seed on the VPS"
	@echo "    make prod-doc         Start docs only, sequentially"
	@echo "    make prod-email       Start email renderer only, sequentially"
	@echo "    make prod-ping        Ping production inventory"
	@echo "    make prod-check       Ansible syntax check"
	@echo "    make deploy-prod      Deploy full production stack with Ansible"
	@echo "    make deploy-prod-front Deploy only web + app with Ansible"
	@echo "    make deploy-prod-app  Deploy only app with Ansible"
	@echo "    make deploy-prod-web  Deploy only web with Ansible"
	@echo "    make deploy-prod-services Deploy backend services with Ansible"
	@echo "    make deploy-prod-service SERVICE=name  Deploy one service with Ansible"
	@echo "    make deploy-prod-backup-cron Configure daily PostgreSQL R2 backup cron with Ansible"
	@echo "    make backup-r2-once   Run a one-shot PostgreSQL backup to R2"
	@echo ""
	@echo "  Secrets"
	@echo "    make secrets-generate Regenerate Makefile/Compose/Ansible secrets files"
	@echo "    make secrets-verify-generated Fail if generated secrets files are stale"
	@echo "    make secrets-init     Create missing secret files"
	@echo "    make secrets-check    Ensure required secrets are non-empty"
	@echo ""
	@echo "  Quality"
	@echo "    make test             Run Go tests"
	@echo "    make lint             Run lint/checks for services and apps"
	@echo "    make lint-services    Run golangci-lint for Go services only"
	@echo "    make fmt              Format Go code"
	@echo "    make build            Build services and apps"
	@echo "    make build-services   Build Go services only"
	@echo "    make ci               Run full repo CI (services + apps)"
	@echo "    make ci-services      Run Go services CI only"
	@echo "    make go-test SERVICE=api-gateway   Run tests for one Go service"
	@echo "    make go-vet SERVICE=api-gateway    Run go vet for one Go service"
	@echo "    make go-build SERVICE=api-gateway  Build one Go service"
	@echo "    make go-ci SERVICE=api-gateway     Run vet + test + build for one Go service"
	@echo "    make docker-build SERVICE=api-gateway Build one service image with Docker Compose"
	@echo "    make app-lint         Lint apps/app"
	@echo "    make app-build        Build apps/app"
	@echo "    make app-ci           Lint + build apps/app"
	@echo "    make web-lint         Lint apps/web"
	@echo "    make web-typecheck    Typecheck apps/web"
	@echo "    make web-build        Build apps/web"
	@echo "    make web-ci           Lint + typecheck + build apps/web"
	@echo "    make email-build      Build apps/email"
	@echo "    make email-ci         Build apps/email"
	@echo "    make langgraph-ci     Check + test + build services/langgraph-scheduler"
	@echo "    make crawler-ci       Check + build services/crawler-service"
	@echo "    make ts-ci            Run TS/email checks"
	@echo "    make frontend-ci      Run app + web checks"
	@echo "    make ci-all           Run Go + frontend + TS/email checks"
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

prod-ping:
	ansible -i $(ANSIBLE_INVENTORY) production -m ping --ask-become-pass

prod-check:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --syntax-check

deploy-prod:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --ask-become-pass

deploy-prod-front:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --ask-become-pass -e '{"deploy_services":["web","app"],"deploy_run_migrations":false}'

deploy-prod-app:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --ask-become-pass -e '{"deploy_services":["app"],"deploy_run_migrations":false}'

deploy-prod-web:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --ask-become-pass -e '{"deploy_services":["web"],"deploy_run_migrations":false}'

deploy-prod-services:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --ask-become-pass -e '{"deploy_profiles":["backend"]}'

deploy-prod-service:
	@test -n "$(SERVICE)" || (echo "Usage: make deploy-prod-service SERVICE=api-gateway"; exit 1)
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_PLAYBOOK) --ask-become-pass -e '{"deploy_services":["$(SERVICE)"]}'

deploy-prod-backup-cron:
	ansible-playbook -i $(ANSIBLE_INVENTORY) $(ANSIBLE_BACKUP_CRON_PLAYBOOK) --ask-become-pass

seed-nike-prod-server:
	@test -n "$(SEED_USER_EMAIL)" || (echo "Usage: make seed-nike-prod-server SEED_USER_EMAIL=email@example.com"; exit 1)
	ansible -i $(ANSIBLE_INVENTORY) production \
		--ask-become-pass \
		--become \
		--become-user=$(PROD_REMOTE_USER) \
		-m shell \
		-a 'cd $(PROD_REMOTE_PATH) && make seed-nike-prod COMPOSE_PROD_PROJECT=$(PROD_REMOTE_COMPOSE_PROJECT) SEED_COMPOSE_PROJECT_NAME_PROD=$(PROD_REMOTE_COMPOSE_PROJECT) SEED_USER_EMAIL="$(SEED_USER_EMAIL)"'

seed-nike-prod-live-server:
	@test -n "$(SEED_USER_EMAIL)" || (echo "Usage: make seed-nike-prod-live-server SEED_USER_EMAIL=email@example.com"; exit 1)
	ansible -i $(ANSIBLE_INVENTORY) production \
		--ask-become-pass \
		--become \
		--become-user=$(PROD_REMOTE_USER) \
		-m shell \
		-a 'cd $(PROD_REMOTE_PATH) && make seed-nike-prod-live COMPOSE_PROD_PROJECT=$(PROD_REMOTE_COMPOSE_PROJECT) SEED_COMPOSE_PROJECT_NAME_PROD=$(PROD_REMOTE_COMPOSE_PROJECT) SEED_USER_EMAIL="$(SEED_USER_EMAIL)"'

deploy-prod-seed-nike: deploy-prod
	$(MAKE) seed-nike-prod-server SEED_USER_EMAIL="$(SEED_USER_EMAIL)"

deploy-prod-seed-nike-live: deploy-prod
	$(MAKE) seed-nike-prod-live-server SEED_USER_EMAIL="$(SEED_USER_EMAIL)"

backup-r2-once: secrets-check
	$(COMPOSE_PROD_LOCAL) --profile infra --profile backup run --rm --no-deps \
		-e BACKUP_RUN_ONCE=1 \
		-e BACKUP_POSTGRES_HOST=$(BACKUP_POSTGRES_HOST) \
		-e BACKUP_POSTGRES_PORT=$(BACKUP_POSTGRES_PORT) \
		-e BACKUP_POSTGRES_USER=$(BACKUP_POSTGRES_USER) \
		-e R2_PREFIX=$(R2_PREFIX) \
		-e R2_REGION=$(R2_REGION) \
		postgres-backup-r2

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
	@python3 scripts/run_go_tests.py

lint-services:
	@config_arg=""; \
	if [ -f .golangci.yml ]; then \
		config_arg="--config ../../.golangci.yml"; \
	else \
		echo "No .golangci.yml found, running golangci-lint with default config."; \
	fi; \
	results_file=$$(mktemp); \
	failed=0; \
	passed_count=0; \
	failed_count=0; \
	esc=$$(printf '\033'); \
	green="$$esc[32m"; \
	red="$$esc[31m"; \
	reset="$$esc[0m"; \
	for dir in services/*; do \
		if [ -f "$$dir/go.mod" ]; then \
			service=$${dir#services/}; \
			log_file=$$(mktemp); \
			echo "Linting $$dir"; \
			if (cd "$$dir" && GOTOOLCHAIN=$(GO_TOOLCHAIN_VERSION) GOWORK=$$(pwd)/../go.work \
				go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@$(GOLANGCI_LINT_VERSION) run $$config_arg) >"$$log_file" 2>&1; then \
				passed_count=$$((passed_count + 1)); \
				printf "%s\t%s\n" "$$service" "PASS" >> "$$results_file"; \
			else \
				failed=1; \
				failed_count=$$((failed_count + 1)); \
				cat "$$log_file"; \
				printf "%s\t%s\n" "$$service" "FAIL" >> "$$results_file"; \
			fi; \
			rm -f "$$log_file"; \
		fi; \
	done; \
	printf "\n%-30s | %s\n" "Lint target" "Status"; \
	printf "%-30s-+-%s\n" "------------------------------" "------"; \
	while IFS=$$(printf '\t') read -r service status; do \
		printf "%-30s | %s\n" "$$service" "$$status"; \
	done < "$$results_file"; \
	printf "\nPassed services: %b%d%b | Failed services: %b%d%b\n" "$$green" "$$passed_count" "$$reset" "$$red" "$$failed_count" "$$reset"; \
	rm -f "$$results_file"; \
	exit $$failed

lint: lint-services app-lint web-lint langgraph-check crawler-check

lint-fix:
	@if [ -f .golangci.yml ]; then \
		for dir in services/*; do \
			if [ -f "$$dir/go.mod" ]; then \
				echo "Lint-fixing $$dir"; \
				(cd "$$dir" && GOTOOLCHAIN=$(GO_TOOLCHAIN_VERSION) GOWORK=$$(pwd)/../go.work \
					go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@$(GOLANGCI_LINT_VERSION) run --fix --config ../../.golangci.yml) || exit $$?; \
			fi; \
		done; \
	else \
		echo "No .golangci.yml found, running golangci-lint --fix with default config."; \
		for dir in services/*; do \
			if [ -f "$$dir/go.mod" ]; then \
				echo "Lint-fixing $$dir"; \
				(cd "$$dir" && GOTOOLCHAIN=$(GO_TOOLCHAIN_VERSION) GOWORK=$$(pwd)/../go.work \
					go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@$(GOLANGCI_LINT_VERSION) run --fix) || exit $$?; \
			fi; \
		done; \
	fi

build-services:
	@results_file=$$(mktemp); \
	failed=0; \
	passed_count=0; \
	failed_count=0; \
	esc=$$(printf '\033'); \
	green="$$esc[32m"; \
	red="$$esc[31m"; \
	reset="$$esc[0m"; \
	for dir in services/*; do \
		if [ -f "$$dir/go.mod" ]; then \
			service=$${dir#services/}; \
			log_file=$$(mktemp); \
			echo "Building $$dir"; \
			if (cd "$$dir" && GOTOOLCHAIN=$(GO_TOOLCHAIN_VERSION) GOWORK=$$(pwd)/../go.work go build ./...) >"$$log_file" 2>&1; then \
				passed_count=$$((passed_count + 1)); \
				printf "%s\t%s\n" "$$service" "PASS" >> "$$results_file"; \
			else \
				failed=1; \
				failed_count=$$((failed_count + 1)); \
				cat "$$log_file"; \
				printf "%s\t%s\n" "$$service" "FAIL" >> "$$results_file"; \
			fi; \
			rm -f "$$log_file"; \
		fi; \
	done; \
	printf "\n%-30s | %s\n" "Build target" "Status"; \
	printf "%-30s-+-%s\n" "------------------------------" "------"; \
	while IFS=$$(printf '\t') read -r service status; do \
		printf "%-30s | %s\n" "$$service" "$$status"; \
	done < "$$results_file"; \
	printf "\nPassed services: %b%d%b | Failed services: %b%d%b\n" "$$green" "$$passed_count" "$$reset" "$$red" "$$failed_count" "$$reset"; \
	rm -f "$$results_file"; \
	exit $$failed

build: build-services app-build web-build email-build langgraph-build crawler-build

fmt:
	gofmt -w services

ci-services:
	$(MAKE) secrets-verify-generated
	@test -z "$$(gofmt -l services)" || (echo "Go files need formatting:"; gofmt -l services; exit 1)
	$(MAKE) lint-services
	$(MAKE) test
	$(MAKE) build-services

ci: ci-services frontend-ci ts-ci

go-test:
	@test -n "$(SERVICE)" || (echo "Usage: make go-test SERVICE=api-gateway"; exit 1)
	@test -f "$(GO_SERVICE_DIR)/go.mod" || (echo "Unknown Go service: $(SERVICE)"; exit 1)
	cd "$(GO_SERVICE_DIR)" && go test ./...

go-vet:
	@test -n "$(SERVICE)" || (echo "Usage: make go-vet SERVICE=api-gateway"; exit 1)
	@test -f "$(GO_SERVICE_DIR)/go.mod" || (echo "Unknown Go service: $(SERVICE)"; exit 1)
	cd "$(GO_SERVICE_DIR)" && go vet ./...

go-build:
	@test -n "$(SERVICE)" || (echo "Usage: make go-build SERVICE=api-gateway"; exit 1)
	@test -f "$(GO_SERVICE_DIR)/go.mod" || (echo "Unknown Go service: $(SERVICE)"; exit 1)
	cd "$(GO_SERVICE_DIR)" && go build ./...

go-ci: go-vet go-test go-build

docker-build:
	@test -n "$(SERVICE)" || (echo "Usage: make docker-build SERVICE=api-gateway"; exit 1)
	docker compose build "$(SERVICE)"

app-lint:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace/apps/app \
		$(FRONTEND_BUN_IMAGE) sh -lc "bun install --frozen-lockfile && bun run lint"

app-build:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace/apps/app \
		$(FRONTEND_BUN_IMAGE) sh -lc "bun install --frozen-lockfile && bun run build"

app-ci: app-lint app-build

web-lint:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace/apps/web \
		$(FRONTEND_NODE_IMAGE) sh -lc "corepack enable && npm install -g bun && bun install --frozen-lockfile && bun run lint"

web-typecheck:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace/apps/web \
		$(FRONTEND_NODE_IMAGE) sh -lc "corepack enable && npm install -g bun && bun install --frozen-lockfile && bun run check-types"

web-build:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace/apps/web \
		$(FRONTEND_NODE_IMAGE) sh -lc "corepack enable && npm install -g bun && bun install --frozen-lockfile && npm run build"

web-ci: web-lint web-typecheck web-build

email-build:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace/apps/email \
		$(FRONTEND_BUN_IMAGE) sh -lc "bun install --frozen-lockfile && bun run build"

email-ci: email-build

langgraph-check:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace/services/langgraph-scheduler \
		$(FRONTEND_BUN_IMAGE) sh -lc "bun install --frozen-lockfile && bun run check"

langgraph-test:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace/services/langgraph-scheduler \
		$(FRONTEND_BUN_IMAGE) sh -lc "bun install --frozen-lockfile && bun test"

langgraph-build:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace/services/langgraph-scheduler \
		$(FRONTEND_BUN_IMAGE) sh -lc "bun install --frozen-lockfile && bun run build"

langgraph-ci: langgraph-check langgraph-test langgraph-build

crawler-check:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace/services/crawler-service \
		$(FRONTEND_BUN_IMAGE) sh -lc "bun install --frozen-lockfile && bun run check"

crawler-build:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace/services/crawler-service \
		$(FRONTEND_BUN_IMAGE) sh -lc "bun install --frozen-lockfile && bun run build"

crawler-ci: crawler-check crawler-build

ts-ci: langgraph-ci crawler-ci email-ci

frontend-ci: app-ci web-ci

ci-all: ci

seed-nike:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace \
		-v /usr/bin/docker:/usr/local/bin/docker \
		-v /usr/libexec/docker/cli-plugins:/usr/libexec/docker/cli-plugins \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-e SEED_COMPOSE_PROJECT_NAME=microservices-go \
		-e SEED_COMPOSE_FILES=docker-compose.yml \
		-e SEED_USER_EMAIL=$(SEED_USER_EMAIL) \
		-e SEED_ANALYSIS_MODE=synthetic \
		$(FRONTEND_BUN_IMAGE) bun scripts/seed-nike-backend.ts

seed-nike-live:
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace \
		-v /usr/bin/docker:/usr/local/bin/docker \
		-v /usr/libexec/docker/cli-plugins:/usr/libexec/docker/cli-plugins \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-e SEED_COMPOSE_PROJECT_NAME=microservices-go \
		-e SEED_COMPOSE_FILES=docker-compose.yml \
		-e SEED_USER_EMAIL=$(SEED_USER_EMAIL) \
		-e SEED_ANALYSIS_MODE=live \
		$(FRONTEND_BUN_IMAGE) bun scripts/seed-nike-backend.ts

seed-nike-prod: prod-migrate
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace \
		-v /usr/bin/docker:/usr/local/bin/docker \
		-v /usr/libexec/docker/cli-plugins:/usr/libexec/docker/cli-plugins \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-e SEED_COMPOSE_PROJECT_NAME=$(SEED_COMPOSE_PROJECT_NAME_PROD) \
		-e SEED_COMPOSE_FILES=docker-compose.yml,docker-compose.secrets.generated.yml \
		-e SEED_USER_EMAIL=$(SEED_USER_EMAIL) \
		-e SEED_ANALYSIS_MODE=synthetic \
		$(FRONTEND_BUN_IMAGE) bun scripts/seed-nike-backend.ts

seed-nike-prod-live: prod-migrate
	docker run --rm \
		-v "$$(pwd):/workspace" -w /workspace \
		-v /usr/bin/docker:/usr/local/bin/docker \
		-v /usr/libexec/docker/cli-plugins:/usr/libexec/docker/cli-plugins \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-e SEED_COMPOSE_PROJECT_NAME=$(SEED_COMPOSE_PROJECT_NAME_PROD) \
		-e SEED_COMPOSE_FILES=docker-compose.yml,docker-compose.secrets.generated.yml \
		-e SEED_USER_EMAIL=$(SEED_USER_EMAIL) \
		-e SEED_ANALYSIS_MODE=live \
		$(FRONTEND_BUN_IMAGE) bun scripts/seed-nike-backend.ts

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