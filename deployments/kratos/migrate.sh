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
if [ -z "${KRATOS_SMTP_CONNECTION_URI:-}" ] && [ -f /run/secrets/resend_smtp_connection_uri ]; then
  KRATOS_SMTP_CONNECTION_URI="$(tr -d '\r\n' < /run/secrets/resend_smtp_connection_uri)"
  export KRATOS_SMTP_CONNECTION_URI
fi
if [ -z "${KRATOS_SMTP_FROM_ADDRESS:-}" ] && [ -f /run/secrets/resend_from_email ]; then
  resend_from="$(tr -d '\r\n' < /run/secrets/resend_from_email)"
  case "${resend_from}" in
    *\<*\>) KRATOS_SMTP_FROM_ADDRESS="${resend_from#*<}"; KRATOS_SMTP_FROM_ADDRESS="${KRATOS_SMTP_FROM_ADDRESS%>*}" ;;
    *) KRATOS_SMTP_FROM_ADDRESS="${resend_from}" ;;
  esac
  export KRATOS_SMTP_FROM_ADDRESS
fi
: "${KRATOS_SMTP_FROM_NAME:=Visia}"
export KRATOS_SMTP_FROM_NAME

if [ -z "${KRATOS_OIDC_GOOGLE_CLIENT_ID:-}" ]; then
  echo "KRATOS_OIDC_GOOGLE_CLIENT_ID is required (env or /run/secrets/google_oidc_client_id)" >&2
  exit 1
fi
if [ -z "${KRATOS_OIDC_GOOGLE_CLIENT_SECRET:-}" ]; then
  echo "KRATOS_OIDC_GOOGLE_CLIENT_SECRET is required (env or /run/secrets/google_oidc_client_secret)" >&2
  exit 1
fi
if [ -z "${KRATOS_SMTP_CONNECTION_URI:-}" ]; then
  echo "KRATOS_SMTP_CONNECTION_URI is required (env or /run/secrets/resend_smtp_connection_uri)" >&2
  exit 1
fi
if [ -z "${KRATOS_SMTP_FROM_ADDRESS:-}" ]; then
  echo "KRATOS_SMTP_FROM_ADDRESS is required (env or /run/secrets/resend_from_email)" >&2
  exit 1
fi

export DSN="postgres://${KRATOS_DB_USER}:${KRATOS_DB_PASSWORD}@${KRATOS_DB_HOST}:${KRATOS_DB_PORT}/${KRATOS_DB_NAME}?sslmode=${KRATOS_DB_SSLMODE}"

CONFIG_RENDERED="/tmp/kratos.yml"
sh /etc/config/kratos/render-config.sh > "${CONFIG_RENDERED}"

exec kratos migrate sql up -e --yes -c "${CONFIG_RENDERED}"
