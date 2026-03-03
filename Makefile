.PHONY: run-gateway run-user run-organizations run-permission run-billing run-notification run-auth migrate-user migrate-organizations migrate-permission migrate-billing migrate-notification sqlc-generate-user sqlc-generate-organizations sqlc-generate-permission sqlc-generate-billing sqlc-generate-notification sqlc-generate-all test test-integration-org test-integration-user test-integration-permission test-integration-billing test-integration-notification test-integration-db lint lint-fix fmt up down up-dev down-dev logs-dev kratos-init kratos-init-dev up-front up-doc up-email up-mcp up-backend up-infra up-monitoring up-migrations up-full up-dev-front up-dev-backend up-dev-infra up-dev-monitoring up-dev-migrations up-dev-min up-dev-full clean-dev-go-cache reset-dev-backend

COMPOSE_PROD = docker compose -p microservices-go-prod -f docker-compose.yml
COMPOSE_DEV = docker compose -p microservices-go-dev -f docker-compose.yml -f docker-compose.override.yml

PROFILES_PROD_ALL = --profile frontend --profile doc --profile email --profile mcp --profile backend --profile infra --profile monitoring
PROFILES_DEV_ALL = --profile frontend --profile doc --profile email --profile mcp --profile backend --profile monitoring

run-gateway:
	HTTP_ADDR=:8080 USER_SERVICE_URL=http://localhost:8081 AUTH_SERVICE_URL=http://localhost:8083 ORGANIZATIONS_SERVICE_URL=http://localhost:8084 PERMISSION_SERVICE_URL=http://localhost:8085 PERMISSION_SERVICE_GRPC_ADDR=localhost:9085 BILLING_SERVICE_URL=http://localhost:8086 NOTIFICATION_SERVICE_URL=http://localhost:8087 RATE_LIMIT_RPM=120 go run ./services/api-gateway/cmd/api

run-user:
	HTTP_ADDR=:8081 USER_DB_HOST=localhost USER_DB_PORT=5432 USER_DB_USER=usersvc USER_DB_NAME=usersvc USER_DB_SSLMODE=disable USER_DB_PASSWORD=usersvc go run ./services/user-service/cmd/api

migrate-user:
	@test -n "$$USER_DB_HOST" || (echo "USER_DB_HOST is required" && exit 1)
	@test -n "$$USER_DB_PORT" || (echo "USER_DB_PORT is required" && exit 1)
	@test -n "$$USER_DB_USER" || (echo "USER_DB_USER is required" && exit 1)
	@test -n "$$USER_DB_NAME" || (echo "USER_DB_NAME is required" && exit 1)
	@test -n "$$USER_DB_SSLMODE" || (echo "USER_DB_SSLMODE is required" && exit 1)
	@test -n "$$USER_DB_PASSWORD" || (echo "USER_DB_PASSWORD is required" && exit 1)
	go run ./services/user-service/cmd/migrate

run-organizations:
	HTTP_ADDR=:8084 ORG_DB_HOST=localhost ORG_DB_PORT=5432 ORG_DB_USER=orgsvc ORG_DB_NAME=orgsvc ORG_DB_SSLMODE=disable ORG_DB_PASSWORD=orgsvc go run ./services/organizations-service/cmd/api

migrate-organizations:
	@test -n "$$ORG_DB_HOST" || (echo "ORG_DB_HOST is required" && exit 1)
	@test -n "$$ORG_DB_PORT" || (echo "ORG_DB_PORT is required" && exit 1)
	@test -n "$$ORG_DB_USER" || (echo "ORG_DB_USER is required" && exit 1)
	@test -n "$$ORG_DB_NAME" || (echo "ORG_DB_NAME is required" && exit 1)
	@test -n "$$ORG_DB_SSLMODE" || (echo "ORG_DB_SSLMODE is required" && exit 1)
	@test -n "$$ORG_DB_PASSWORD" || (echo "ORG_DB_PASSWORD is required" && exit 1)
	go run ./services/organizations-service/cmd/migrate

migrate-permission:
	@test -n "$$PERMISSION_DB_HOST" || (echo "PERMISSION_DB_HOST is required" && exit 1)
	@test -n "$$PERMISSION_DB_PORT" || (echo "PERMISSION_DB_PORT is required" && exit 1)
	@test -n "$$PERMISSION_DB_USER" || (echo "PERMISSION_DB_USER is required" && exit 1)
	@test -n "$$PERMISSION_DB_NAME" || (echo "PERMISSION_DB_NAME is required" && exit 1)
	@test -n "$$PERMISSION_DB_SSLMODE" || (echo "PERMISSION_DB_SSLMODE is required" && exit 1)
	@test -n "$$PERMISSION_DB_PASSWORD" || (echo "PERMISSION_DB_PASSWORD is required" && exit 1)
	go run ./services/permission-service/cmd/migrate

migrate-billing:
	@test -n "$$BILLING_DB_HOST" || (echo "BILLING_DB_HOST is required" && exit 1)
	@test -n "$$BILLING_DB_PORT" || (echo "BILLING_DB_PORT is required" && exit 1)
	@test -n "$$BILLING_DB_USER" || (echo "BILLING_DB_USER is required" && exit 1)
	@test -n "$$BILLING_DB_NAME" || (echo "BILLING_DB_NAME is required" && exit 1)
	@test -n "$$BILLING_DB_SSLMODE" || (echo "BILLING_DB_SSLMODE is required" && exit 1)
	@test -n "$$BILLING_DB_PASSWORD" || (echo "BILLING_DB_PASSWORD is required" && exit 1)
	go run ./services/billing-service/cmd/migrate

migrate-notification:
	@test -n "$$NOTIFICATION_DB_HOST" || (echo "NOTIFICATION_DB_HOST is required" && exit 1)
	@test -n "$$NOTIFICATION_DB_PORT" || (echo "NOTIFICATION_DB_PORT is required" && exit 1)
	@test -n "$$NOTIFICATION_DB_USER" || (echo "NOTIFICATION_DB_USER is required" && exit 1)
	@test -n "$$NOTIFICATION_DB_NAME" || (echo "NOTIFICATION_DB_NAME is required" && exit 1)
	@test -n "$$NOTIFICATION_DB_SSLMODE" || (echo "NOTIFICATION_DB_SSLMODE is required" && exit 1)
	@test -n "$$NOTIFICATION_DB_PASSWORD" || (echo "NOTIFICATION_DB_PASSWORD is required" && exit 1)
	go run ./services/notification-service/cmd/migrate

migrate-organizations-docker:
	docker compose run --rm organizations-migrate

migrate-organizations-docker-dev:
	$(COMPOSE_DEV) run --rm organizations-migrate

migrate-user-docker:
	docker compose run --rm user-migrate

migrate-user-docker-dev:
	$(COMPOSE_DEV) run --rm user-migrate

migrate-permission-docker:
	docker compose run --rm permission-migrate

migrate-permission-docker-dev:
	$(COMPOSE_DEV) run --rm permission-migrate

migrate-billing-docker:
	docker compose run --rm billing-migrate

migrate-billing-docker-dev:
	$(COMPOSE_DEV) run --rm billing-migrate

migrate-notification-docker:
	docker compose run --rm notification-migrate

migrate-notification-docker-dev:
	$(COMPOSE_DEV) run --rm notification-migrate

sqlc-generate-organizations:
	docker run --rm -v $$(pwd):/src -w /src/services/organizations-service sqlc/sqlc:latest generate

sqlc-generate-user:
	docker run --rm -v $$(pwd):/src -w /src/services/user-service sqlc/sqlc:latest generate

sqlc-generate-permission:
	docker run --rm -v $$(pwd):/src -w /src/services/permission-service sqlc/sqlc:latest generate

sqlc-generate-billing:
	docker run --rm -v $$(pwd):/src -w /src/services/billing-service sqlc/sqlc:latest generate

sqlc-generate-notification:
	docker run --rm -v $$(pwd):/src -w /src/services/notification-service sqlc/sqlc:latest generate

sqlc-generate-all: sqlc-generate-user sqlc-generate-organizations sqlc-generate-permission sqlc-generate-billing sqlc-generate-notification

run-permission:
	HTTP_ADDR=:8085 GRPC_ADDR=:9085 PERMISSION_DB_HOST=localhost PERMISSION_DB_PORT=5432 PERMISSION_DB_USER=permsvc PERMISSION_DB_NAME=permsvc PERMISSION_DB_SSLMODE=disable PERMISSION_DB_PASSWORD=permsvc ORGANIZATIONS_SERVICE_URL=http://localhost:8084 go run ./services/permission-service/cmd/api

run-billing:
	HTTP_ADDR=:8086 BILLING_DB_HOST=localhost BILLING_DB_PORT=5432 BILLING_DB_USER=billsvc BILLING_DB_NAME=billsvc BILLING_DB_SSLMODE=disable BILLING_DB_PASSWORD=billsvc go run ./services/billing-service/cmd/api

run-notification:
	HTTP_ADDR=:8087 NOTIFICATION_DB_HOST=localhost NOTIFICATION_DB_PORT=5432 NOTIFICATION_DB_USER=notifsvc NOTIFICATION_DB_NAME=notifsvc NOTIFICATION_DB_SSLMODE=disable NOTIFICATION_DB_PASSWORD=notifsvc go run ./services/notification-service/cmd/api

run-auth:
	HTTP_ADDR=:8083 KRATOS_PUBLIC_URL=http://localhost:4433 ALLOWED_ORIGIN=http://localhost:3000 go run ./services/auth-service/cmd/api

test:
	go test ./services/...

test-integration-org:
	@test -n "$$ORG_TEST_DATABASE_URL" || (echo "ORG_TEST_DATABASE_URL is required" && exit 1)
	go test -tags=integration ./services/organizations-service/internal/adapter/repository/postgres

test-integration-user:
	@test -n "$$USER_TEST_DATABASE_URL" || (echo "USER_TEST_DATABASE_URL is required" && exit 1)
	go test -tags=integration ./services/user-service/internal/adapter/repository/postgres

test-integration-permission:
	@test -n "$$PERMISSION_TEST_DATABASE_URL" || (echo "PERMISSION_TEST_DATABASE_URL is required" && exit 1)
	go test -tags=integration ./services/permission-service/internal/adapter/repository/postgres

test-integration-billing:
	@test -n "$$BILLING_TEST_DATABASE_URL" || (echo "BILLING_TEST_DATABASE_URL is required" && exit 1)
	go test -tags=integration ./services/billing-service/internal/adapter/repository/postgres

test-integration-notification:
	@test -n "$$NOTIFICATION_TEST_DATABASE_URL" || (echo "NOTIFICATION_TEST_DATABASE_URL is required" && exit 1)
	go test -tags=integration ./services/notification-service/internal/adapter/repository/postgres

test-integration-db: test-integration-org test-integration-user test-integration-permission test-integration-billing test-integration-notification

lint:
	go run github.com/golangci/golangci-lint/cmd/golangci-lint@latest run --config .golangci.yml

lint-fix:
	go run github.com/golangci/golangci-lint/cmd/golangci-lint@latest run --fix --config .golangci.yml

fmt:
	gofmt -w cmd services

up:
	$(COMPOSE_PROD) $(PROFILES_PROD_ALL) up --build

down:
	$(COMPOSE_PROD) down --remove-orphans

up-front:
	$(COMPOSE_PROD) --profile frontend up -d --build

up-doc:
	$(COMPOSE_PROD) --profile doc up -d --build

up-email:
	$(COMPOSE_PROD) --profile email up -d --build

up-mcp:
	$(COMPOSE_PROD) --profile mcp up -d --build

up-backend:
	$(COMPOSE_PROD) --profile backend up -d --build

up-infra:
	$(COMPOSE_PROD) --profile infra up -d

up-monitoring:
	$(COMPOSE_PROD) --profile monitoring up -d

up-migrations:
	$(COMPOSE_PROD) --profile migrations up --build

up-full:
	$(COMPOSE_PROD) $(PROFILES_PROD_ALL) up -d --build

up-dev:
	$(COMPOSE_DEV) $(PROFILES_DEV_ALL) up --build

up-dev-front:
	$(COMPOSE_DEV) --profile frontend up -d --build

up-dev-backend:
	$(COMPOSE_DEV) --profile backend up -d --build

clean-dev-go-cache:
	docker volume rm -f microservices-go-dev_go-mod-cache microservices-go-dev_go-build-cache || true

reset-dev-backend: down-dev clean-dev-go-cache
	$(COMPOSE_DEV) --profile backend up -d --build

up-dev-infra:
	$(COMPOSE_DEV) --profile backend up -d

up-dev-monitoring:
	$(COMPOSE_DEV) --profile monitoring up -d

up-dev-migrations:
	$(COMPOSE_DEV) --profile migrations up --build

up-dev-min:
	$(COMPOSE_DEV) --profile backend up -d --build

up-dev-full:
	$(COMPOSE_DEV) $(PROFILES_DEV_ALL) up -d --build

down-dev:
	$(COMPOSE_DEV) down --remove-orphans

logs-dev:
	$(COMPOSE_DEV) logs -f

kratos-init:
	$(COMPOSE_PROD) --profile infra up -d postgres
	$(COMPOSE_PROD) --profile migrations run --rm kratos-migrate
	$(COMPOSE_PROD) --profile infra up -d kratos

kratos-init-dev:
	$(COMPOSE_DEV) --profile backend up -d postgres
	$(COMPOSE_DEV) --profile migrations run --rm kratos-migrate
	$(COMPOSE_DEV) --profile backend up -d kratos
