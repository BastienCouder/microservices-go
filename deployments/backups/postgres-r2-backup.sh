#!/bin/sh
set -eu

log() {
  printf '[postgres-r2-backup] %s\n' "$*"
}

require_env() {
  key="$1"
  eval "value=\${$key:-}"
  if [ -z "$value" ]; then
    log "missing required env: $key"
    exit 1
  fi
}

read_secret() {
  secret_path="$1"
  if [ ! -f "$secret_path" ]; then
    log "secret file not found: $secret_path"
    exit 1
  fi
  value="$(tr -d '\r\n' < "$secret_path")"
  if [ -z "$value" ]; then
    log "secret file is empty: $secret_path"
    exit 1
  fi
  printf '%s' "$value"
}

require_env BACKUP_POSTGRES_HOST
require_env BACKUP_POSTGRES_PORT
require_env BACKUP_POSTGRES_USER
require_env BACKUP_POSTGRES_PASSWORD_FILE
require_env BACKUP_INTERVAL_SECONDS
require_env R2_BUCKET
require_env R2_ACCOUNT_ID_FILE
require_env R2_ACCESS_KEY_ID_FILE
require_env R2_SECRET_ACCESS_KEY_FILE

if ! command -v aws >/dev/null 2>&1; then
  log "installing aws-cli"
  apk add --no-cache aws-cli >/dev/null
fi

if ! command -v pg_dumpall >/dev/null 2>&1; then
  log "pg_dumpall not available in container"
  exit 1
fi

while true; do
  now_utc="$(date -u +"%Y%m%dT%H%M%SZ")"
  file_name="postgres-${now_utc}.sql.gz"
  backup_prefix="${R2_PREFIX:-postgres}"
  object_key="${backup_prefix}/${file_name}"
  tmp_file="$(mktemp "/tmp/${file_name}.XXXXXX")"

  PGPASSWORD="$(read_secret "$BACKUP_POSTGRES_PASSWORD_FILE")"
  export PGPASSWORD

  r2_account_id="$(read_secret "$R2_ACCOUNT_ID_FILE")"
  r2_access_key_id="$(read_secret "$R2_ACCESS_KEY_ID_FILE")"
  r2_secret_access_key="$(read_secret "$R2_SECRET_ACCESS_KEY_FILE")"
  r2_endpoint="${R2_ENDPOINT:-https://${r2_account_id}.r2.cloudflarestorage.com}"

  log "starting PostgreSQL dump"
  if pg_dumpall \
    --host "$BACKUP_POSTGRES_HOST" \
    --port "$BACKUP_POSTGRES_PORT" \
    --username "$BACKUP_POSTGRES_USER" \
    | gzip -9 > "$tmp_file"; then
    log "dump done, uploading to s3://${R2_BUCKET}/${object_key}"
  else
    log "dump failed"
    rm -f "$tmp_file"
    sleep "$BACKUP_INTERVAL_SECONDS"
    continue
  fi

  if AWS_ACCESS_KEY_ID="$r2_access_key_id" \
    AWS_SECRET_ACCESS_KEY="$r2_secret_access_key" \
    AWS_DEFAULT_REGION="${R2_REGION:-auto}" \
    aws --endpoint-url "$r2_endpoint" s3 cp "$tmp_file" "s3://${R2_BUCKET}/${object_key}"; then
    log "upload completed"
  else
    log "upload failed"
  fi

  rm -f "$tmp_file"
  sleep "$BACKUP_INTERVAL_SECONDS"
done
