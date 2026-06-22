#!/bin/sh

set -eu

require_env() {
  var_name="$1"
  eval "value=\${$var_name-}"

  if [ -z "${value}" ]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi

  printf '%s' "${value}"
}

read_secret() {
  var_name="$1"
  file_var_name="${var_name}_FILE"

  eval "direct_value=\${$var_name-}"
  eval "file_path=\${$file_var_name-}"

  if [ -n "${direct_value}" ] && [ -n "${file_path}" ]; then
    echo "Both ${var_name} and ${file_var_name} are set; use only one." >&2
    exit 1
  fi

  if [ -n "${direct_value}" ]; then
    printf '%s' "${direct_value}"
    return
  fi

  if [ -n "${file_path}" ]; then
    if [ ! -f "${file_path}" ]; then
      echo "Secret file for ${var_name} not found: ${file_path}" >&2
      exit 1
    fi
    tr -d '\r\n' < "${file_path}"
    return
  fi

  echo "Missing required secret: ${var_name} or ${file_var_name}" >&2
  exit 1
}

ensure_dependencies() {
  if command -v aws >/dev/null 2>&1; then
    return
  fi

  echo "Installing aws-cli in backup container..." >&2
  apk add --no-cache aws-cli >/dev/null
}

run_backup() {
  postgres_host="$(require_env BACKUP_POSTGRES_HOST)"
  postgres_port="$(require_env BACKUP_POSTGRES_PORT)"
  postgres_user="$(require_env BACKUP_POSTGRES_USER)"
  bucket="$(read_secret R2_BUCKET)"
  r2_prefix="$(require_env R2_PREFIX)"
  r2_region="$(require_env R2_REGION)"
  account_id="$(read_secret R2_ACCOUNT_ID)"
  access_key_id="$(read_secret R2_ACCESS_KEY_ID)"
  secret_access_key="$(read_secret R2_SECRET_ACCESS_KEY)"
  postgres_password="$(read_secret BACKUP_POSTGRES_PASSWORD)"

  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  hostname_value="$(hostname)"
  object_key="${r2_prefix%/}/${hostname_value}-pgdumpall-${timestamp}.sql.gz"
  endpoint_url="https://${account_id}.r2.cloudflarestorage.com"

  tmp_dir="$(mktemp -d)"
  tmp_file="${tmp_dir}/backup.sql.gz"
  cleanup() {
    rm -rf "${tmp_dir}"
  }
  trap 'cleanup' EXIT INT TERM

  ensure_dependencies

  echo "Starting PostgreSQL backup for ${postgres_host}:${postgres_port} -> s3://${bucket}/${object_key}" >&2

  export PGPASSWORD="${postgres_password}"
  export AWS_ACCESS_KEY_ID="${access_key_id}"
  export AWS_SECRET_ACCESS_KEY="${secret_access_key}"
  export AWS_DEFAULT_REGION="${r2_region}"

  pg_dumpall \
    --host="${postgres_host}" \
    --port="${postgres_port}" \
    --username="${postgres_user}" | gzip -9 > "${tmp_file}"

  aws s3 cp \
    "${tmp_file}" \
    "s3://${bucket}/${object_key}" \
    --endpoint-url "${endpoint_url}" \
    --only-show-errors

  echo "Backup uploaded successfully to s3://${bucket}/${object_key}" >&2

  cleanup
  trap - EXIT INT TERM
}

if [ "${BACKUP_RUN_ONCE-}" = "1" ]; then
  run_backup
  exit 0
fi

if [ -n "${BACKUP_INTERVAL_SECONDS:-}" ]; then
  while true; do
    run_backup
    sleep "${BACKUP_INTERVAL_SECONDS}"
  done
fi

run_backup
