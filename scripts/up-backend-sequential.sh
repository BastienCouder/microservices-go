#!/usr/bin/env bash

set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-microservices-go-prod}"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-docker-compose.yml}"

COMPOSE_CMD=(docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE_PATH}")

SERVICES=(
  postgres
  redis
  rabbitmq
  kratos
  auth-service
  user-service
  organizations-service
  permission-service
  billing-service
  notification-service
  project-service
  analysis-service
  ia-service
  attribution-service
  api-gateway
)

echo "Starting backend services sequentially with ${COMPOSE_FILE_PATH} (project: ${PROJECT_NAME})"

for service in "${SERVICES[@]}"; do
  echo ""
  echo "==> Starting ${service}"
  "${COMPOSE_CMD[@]}" up -d --build "${service}"
done

echo ""
echo "Backend services started sequentially."
