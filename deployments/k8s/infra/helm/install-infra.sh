#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null 2>&1 || true
helm repo add jetstack https://charts.jetstack.io >/dev/null 2>&1 || true
helm repo add bitnami https://charts.bitnami.com/bitnami >/dev/null 2>&1 || true
helm repo update

kubectl create namespace ingress-nginx --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace cert-manager --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace msgo-infra --dry-run=client -o yaml | kubectl apply -f -

kubectl -n msgo-infra create secret generic infra-secrets \
  --from-file=postgres_superuser_password="${ROOT_DIR}/../../apps/overlays/prod/secrets/postgres_superuser_password" \
  --from-file=usersvc_db_password="${ROOT_DIR}/../../apps/overlays/prod/secrets/usersvc_db_password" \
  --from-file=orgsvc_db_password="${ROOT_DIR}/../../apps/overlays/prod/secrets/orgsvc_db_password" \
  --from-file=permsvc_db_password="${ROOT_DIR}/../../apps/overlays/prod/secrets/permsvc_db_password" \
  --from-file=billsvc_db_password="${ROOT_DIR}/../../apps/overlays/prod/secrets/billsvc_db_password" \
  --from-file=notifsvc_db_password="${ROOT_DIR}/../../apps/overlays/prod/secrets/notifsvc_db_password" \
  --from-file=kratos_db_password="${ROOT_DIR}/../../apps/overlays/prod/secrets/kratos_db_password" \
  --from-file=rabbitmq_password="${ROOT_DIR}/../../apps/overlays/prod/secrets/rabbitmq_password" \
  --from-file=redis_password="${ROOT_DIR}/../../apps/overlays/prod/secrets/redis_password" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n msgo-infra create configmap rabbitmq-definitions \
  --from-file=load_definition.json="${ROOT_DIR}/../../../rabbitmq/definitions.json" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n msgo-infra create configmap rabbitmq-extra-conf \
  --from-file=rabbitmq.conf="${ROOT_DIR}/../../../rabbitmq/rabbitmq.conf" \
  --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --values "${ROOT_DIR}/ingress-nginx/values.yaml"

helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --values "${ROOT_DIR}/cert-manager/values.yaml" \
  --set crds.enabled=true

helm upgrade --install postgresql bitnami/postgresql \
  --namespace msgo-infra \
  --values "${ROOT_DIR}/postgres/values.yaml"

helm upgrade --install redis bitnami/redis \
  --namespace msgo-infra \
  --values "${ROOT_DIR}/redis/values.yaml"

helm upgrade --install rabbitmq bitnami/rabbitmq \
  --namespace msgo-infra \
  --values "${ROOT_DIR}/rabbitmq/values.yaml"
