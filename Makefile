.PHONY: run-gateway run-user run-organizations run-permission run-billing run-notification run-auth migrate-user migrate-organizations migrate-permission migrate-billing migrate-notification sqlc-generate-user sqlc-generate-organizations sqlc-generate-permission sqlc-generate-billing sqlc-generate-notification sqlc-generate-all test test-integration-org test-integration-user test-integration-permission test-integration-billing test-integration-notification test-integration-db lint lint-fix fmt up down up-dev down-dev logs-dev kratos-init kratos-init-dev

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
	docker compose -f docker-compose.dev.yml run --rm organizations-migrate

migrate-user-docker:
	docker compose run --rm user-migrate

migrate-user-docker-dev:
	docker compose -f docker-compose.dev.yml run --rm user-migrate

migrate-permission-docker:
	docker compose run --rm permission-migrate

migrate-permission-docker-dev:
	docker compose -f docker-compose.dev.yml run --rm permission-migrate

migrate-billing-docker:
	docker compose run --rm billing-migrate

migrate-billing-docker-dev:
	docker compose -f docker-compose.dev.yml run --rm billing-migrate

migrate-notification-docker:
	docker compose run --rm notification-migrate

migrate-notification-docker-dev:
	docker compose -f docker-compose.dev.yml run --rm notification-migrate

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
	docker compose up --build

down:
	docker compose down

up-dev:
	docker compose -f docker-compose.dev.yml up --build

down-dev:
	docker compose -f docker-compose.dev.yml down

logs-dev:
	docker compose -f docker-compose.dev.yml logs -f

kratos-init:
	docker compose up -d postgres
	docker compose run --rm kratos-migrate
	docker compose up -d kratos

kratos-init-dev:
	docker compose -f docker-compose.dev.yml up -d postgres
	docker compose -f docker-compose.dev.yml run --rm kratos-migrate
	docker compose -f docker-compose.dev.yml up -d kratos
