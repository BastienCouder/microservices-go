#!/bin/sh

set -eu

: "${POSTGRES_HOST:?POSTGRES_HOST is required}"
: "${POSTGRES_PORT:?POSTGRES_PORT is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD_FILE:?POSTGRES_PASSWORD_FILE is required}"
: "${POSTGRES_COMPOSE_FILE:?POSTGRES_COMPOSE_FILE is required}"

if [ ! -f "${POSTGRES_PASSWORD_FILE}" ]; then
  echo "POSTGRES_PASSWORD_FILE does not exist: ${POSTGRES_PASSWORD_FILE}" >&2
  exit 1
fi

if [ ! -f "${POSTGRES_COMPOSE_FILE}" ]; then
  echo "POSTGRES_COMPOSE_FILE does not exist: ${POSTGRES_COMPOSE_FILE}" >&2
  exit 1
fi

POSTGRES_PASSWORD="$(tr -d '\r\n' < "${POSTGRES_PASSWORD_FILE}")"
if [ -z "${POSTGRES_PASSWORD}" ]; then
  echo "POSTGRES_PASSWORD_FILE is empty" >&2
  exit 1
fi

export PGPASSWORD="${POSTGRES_PASSWORD}"

is_valid_identifier() {
  case "$1" in
    ""|*[!a-z0-9_]*)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

extract_service_databases() {
  awk '
    function trim(value) {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      gsub(/^"/, "", value)
      gsub(/"$/, "", value)
      return value
    }
    match($0, /^[[:space:]]+([A-Z0-9_]+_DB_USER|KRATOS_DB_USER):[[:space:]]*(.+)$/, parts) {
      prefix = parts[1]
      sub(/_DB_USER$/, "", prefix)
      users[prefix] = trim(parts[2])
    }
    match($0, /^[[:space:]]+([A-Z0-9_]+_DB_NAME|KRATOS_DB_NAME):[[:space:]]*(.+)$/, parts) {
      prefix = parts[1]
      sub(/_DB_NAME$/, "", prefix)
      names[prefix] = trim(parts[2])
    }
    END {
      for (prefix in users) {
        if (prefix in names) {
          print users[prefix] ":" names[prefix]
        }
      }
    }
  ' "${POSTGRES_COMPOSE_FILE}" | sort -u
}

wait_for_postgres() {
  until pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres >/dev/null 2>&1; do
    sleep 1
  done
}

create_role_if_missing() {
  role_name="$1"
  if psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${role_name}'" | grep -q 1; then
    return
  fi
  psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres -c "CREATE ROLE \"${role_name}\" LOGIN PASSWORD '${role_name}'"
}

create_database_if_missing() {
  role_name="$1"
  db_name="$2"
  if psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${db_name}'" | grep -q 1; then
    return
  fi
  psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres -c "CREATE DATABASE \"${db_name}\" OWNER \"${role_name}\""
}

wait_for_postgres

extract_service_databases | while IFS=':' read -r db_user db_name; do
  if ! is_valid_identifier "${db_user}"; then
    echo "Skipping invalid role identifier: ${db_user}" >&2
    continue
  fi
  if ! is_valid_identifier "${db_name}"; then
    echo "Skipping invalid database identifier: ${db_name}" >&2
    continue
  fi
  create_role_if_missing "${db_user}"
  create_database_if_missing "${db_user}" "${db_name}"
done

echo "postgres bootstrap complete"
