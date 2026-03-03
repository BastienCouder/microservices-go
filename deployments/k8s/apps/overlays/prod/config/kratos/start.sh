#!/bin/sh

set -eu

read_secret() {
  file_path="$1"
  if [ -z "${file_path:-}" ]; then
    return 1
  fi
  if [ ! -f "${file_path}" ]; then
    return 1
  fi
  cat "${file_path}"
}

KRATOS_DB_PASSWORD="$(read_secret "${KRATOS_DB_PASSWORD_FILE:-}")"
KRATOS_OIDC_GOOGLE_CLIENT_ID="$(read_secret "${KRATOS_OIDC_GOOGLE_CLIENT_ID_FILE:-}")"
KRATOS_OIDC_GOOGLE_CLIENT_SECRET="$(read_secret "${KRATOS_OIDC_GOOGLE_CLIENT_SECRET_FILE:-}")"
KRATOS_SMTP_CONNECTION_URI="$(read_secret "${KRATOS_SMTP_CONNECTION_URI_FILE:-}")"
KRATOS_COOKIE_SECRET="$(read_secret "${KRATOS_COOKIE_SECRET_FILE:-}")"
KRATOS_CIPHER_SECRET="$(read_secret "${KRATOS_CIPHER_SECRET_FILE:-}")"

: "${KRATOS_DB_HOST:?KRATOS_DB_HOST is required}"
: "${KRATOS_DB_PORT:?KRATOS_DB_PORT is required}"
: "${KRATOS_DB_USER:?KRATOS_DB_USER is required}"
: "${KRATOS_DB_NAME:?KRATOS_DB_NAME is required}"
: "${KRATOS_DB_SSLMODE:?KRATOS_DB_SSLMODE is required}"

export DSN="postgres://${KRATOS_DB_USER}:${KRATOS_DB_PASSWORD}@${KRATOS_DB_HOST}:${KRATOS_DB_PORT}/${KRATOS_DB_NAME}?sslmode=${KRATOS_DB_SSLMODE}"
export KRATOS_OIDC_GOOGLE_CLIENT_ID
export KRATOS_OIDC_GOOGLE_CLIENT_SECRET
export KRATOS_SMTP_CONNECTION_URI
export KRATOS_COOKIE_SECRET
export KRATOS_CIPHER_SECRET

exec kratos serve -c /etc/config/kratos/kratos.yml --watch-courier
