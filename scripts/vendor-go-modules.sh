#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GO_BIN="${GO_BIN:-/home/bastiencdr/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.25.7.linux-amd64/bin/go}"
GOMODCACHE_DIR="${GOMODCACHE_DIR:-/home/bastiencdr/go/pkg/mod}"
GOCACHE_DIR="${GOCACHE_DIR:-/tmp/go-vendor-cache}"

if [[ ! -x "$GO_BIN" ]]; then
  echo "go toolchain not found: $GO_BIN" >&2
  exit 1
fi

modules=(
  services/analysis-service
  services/api-gateway
  services/attribution-service
  services/auth-service
  services/billing-service
  services/contracts
  services/ia-service
  services/notification-service
  services/organizations-service
  services/permission-service
  services/project-service
  services/user-service
)

for mod in "${modules[@]}"; do
  echo "==> $mod"
  (
    cd "$ROOT_DIR/$mod"
    env \
      GOWORK=off \
      GOMODCACHE="$GOMODCACHE_DIR" \
      GOPROXY=off \
      GOSUMDB=off \
      GOCACHE="$GOCACHE_DIR" \
      "$GO_BIN" mod tidy
    env \
      GOWORK=off \
      GOMODCACHE="$GOMODCACHE_DIR" \
      GOPROXY=off \
      GOSUMDB=off \
      GOCACHE="$GOCACHE_DIR" \
      "$GO_BIN" mod vendor
  )
done
