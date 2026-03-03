#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
helm repo add grafana https://grafana.github.io/helm-charts >/dev/null 2>&1 || true
helm repo update

kubectl create namespace msgo-observability --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace msgo-observability \
  --values "${ROOT_DIR}/observability/kube-prometheus-stack-values.yaml"

helm upgrade --install loki grafana/loki \
  --namespace msgo-observability \
  --values "${ROOT_DIR}/observability/loki-values.yaml"

helm upgrade --install promtail grafana/promtail \
  --namespace msgo-observability \
  --values "${ROOT_DIR}/observability/promtail-values.yaml"
