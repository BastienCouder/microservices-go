#!/bin/sh

set -eu

if [ -z "${KRATOS_DB_PASSWORD_FILE:-}" ]; then
  echo "KRATOS_DB_PASSWORD_FILE is required" >&2
  exit 1
fi

KRATOS_DB_PASSWORD="$(cat "${KRATOS_DB_PASSWORD_FILE}")"
if [ -z "${KRATOS_DB_PASSWORD}" ]; then
  echo "KRATOS_DB_PASSWORD_FILE is empty" >&2
  exit 1
fi

: "${KRATOS_DB_HOST:?KRATOS_DB_HOST is required}"
: "${KRATOS_DB_PORT:?KRATOS_DB_PORT is required}"
: "${KRATOS_DB_USER:?KRATOS_DB_USER is required}"
: "${KRATOS_DB_NAME:?KRATOS_DB_NAME is required}"
: "${KRATOS_DB_SSLMODE:?KRATOS_DB_SSLMODE is required}"

export DSN="postgres://${KRATOS_DB_USER}:${KRATOS_DB_PASSWORD}@${KRATOS_DB_HOST}:${KRATOS_DB_PORT}/${KRATOS_DB_NAME}?sslmode=${KRATOS_DB_SSLMODE}"

exec kratos serve -c /etc/config/kratos/kratos.yml --dev --watch-courier
