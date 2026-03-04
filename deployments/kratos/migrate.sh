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

if [ -z "${KRATOS_OIDC_GOOGLE_CLIENT_ID:-}" ] && [ -f /run/secrets/google_oidc_client_id ]; then
  KRATOS_OIDC_GOOGLE_CLIENT_ID="$(tr -d '\r\n' < /run/secrets/google_oidc_client_id)"
  export KRATOS_OIDC_GOOGLE_CLIENT_ID
fi
if [ -z "${KRATOS_OIDC_GOOGLE_CLIENT_SECRET:-}" ] && [ -f /run/secrets/google_oidc_client_secret ]; then
  KRATOS_OIDC_GOOGLE_CLIENT_SECRET="$(tr -d '\r\n' < /run/secrets/google_oidc_client_secret)"
  export KRATOS_OIDC_GOOGLE_CLIENT_SECRET
fi

if [ -z "${KRATOS_OIDC_GOOGLE_CLIENT_ID:-}" ]; then
  echo "KRATOS_OIDC_GOOGLE_CLIENT_ID is required (env or /run/secrets/google_oidc_client_id)" >&2
  exit 1
fi
if [ -z "${KRATOS_OIDC_GOOGLE_CLIENT_SECRET:-}" ]; then
  echo "KRATOS_OIDC_GOOGLE_CLIENT_SECRET is required (env or /run/secrets/google_oidc_client_secret)" >&2
  exit 1
fi

export DSN="postgres://${KRATOS_DB_USER}:${KRATOS_DB_PASSWORD}@${KRATOS_DB_HOST}:${KRATOS_DB_PORT}/${KRATOS_DB_NAME}?sslmode=${KRATOS_DB_SSLMODE}"

CONFIG_TEMPLATE="/etc/config/kratos/kratos.yml"
CONFIG_RENDERED="/tmp/kratos.yml"

esc() {
  printf '%s' "$1" | sed 's/[\/&]/\\&/g'
}

ESC_DSN="$(esc "${DSN}")"
ESC_GOOGLE_CLIENT_ID="$(esc "${KRATOS_OIDC_GOOGLE_CLIENT_ID}")"
ESC_GOOGLE_CLIENT_SECRET="$(esc "${KRATOS_OIDC_GOOGLE_CLIENT_SECRET}")"

sed \
  -e "s|\${DSN}|${ESC_DSN}|g" \
  -e "s|\${KRATOS_OIDC_GOOGLE_CLIENT_ID}|${ESC_GOOGLE_CLIENT_ID}|g" \
  -e "s|\${KRATOS_OIDC_GOOGLE_CLIENT_SECRET}|${ESC_GOOGLE_CLIENT_SECRET}|g" \
  "${CONFIG_TEMPLATE}" > "${CONFIG_RENDERED}"

exec kratos migrate sql up -e --yes -c "${CONFIG_RENDERED}"
