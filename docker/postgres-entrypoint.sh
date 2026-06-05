#!/bin/sh

set -eu

read_secret() {
  secret_file="/run/secrets/$1"

  if [ ! -f "$secret_file" ]; then
    echo "Missing Docker secret file: $secret_file" >&2
    exit 1
  fi

  secret_value="$(tr -d '\r' < "$secret_file" | tr -d '\n')"

  if [ -z "$secret_value" ]; then
    echo "Docker secret is empty: $secret_file" >&2
    exit 1
  fi

  printf '%s' "$secret_value"
}

export POSTGRES_USER="$(read_secret postgres_user)"
export POSTGRES_PASSWORD="$(read_secret postgres_password)"
export POSTGRES_DB="$(read_secret postgres_db)"

exec docker-entrypoint.sh postgres
